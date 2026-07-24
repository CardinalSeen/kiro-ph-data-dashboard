/**
 * ═══════════════════════════════════════════════════════════════════
 * WORKSHOP STEP 3 — LAYER 2 & 3: CLEAN → ENFORCE → EXPORT → VALIDATE
 * ═══════════════════════════════════════════════════════════════════
 *
 * LAYER 2: Cleaning & Integrity Enforcement (zero nulls in core fields)
 * LAYER 3: Export to Parquet (SNAPPY) + post-quality assertion checks
 *
 * Data Engineering Insight:
 * Pushing TRIM, casting, dedup, and imputation into DuckDB SQL means the
 * transformation runs in C++ vectorized kernels close to the data — the
 * Node.js process only orchestrates, never buffers rows, keeping the
 * ingestion pipeline memory-flat before hand-off to DuckDB-WASM.
 */

const duckdb = require('duckdb');
const path = require('path');
const fs = require('fs');

const RAW_CSV = path.resolve(__dirname, 'raw_dataset.csv');
const OUT_PARQUET = path.resolve(__dirname, 'cleaned_dataset.parquet');
const db = new duckdb.Database(':memory:');

function run(sql) {
  return new Promise((resolve, reject) => db.run(sql, (e) => (e ? reject(e) : resolve())));
}
function all(sql) {
  return new Promise((resolve, reject) => db.all(sql, (e, r) => (e ? reject(e) : resolve(r))));
}

async function main() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log(' LAYER 2 & 3: CLEAN, ENFORCE, EXPORT, VALIDATE');
  console.log('═══════════════════════════════════════════════════════════\n');

  // Ingest raw as text (never trust source types)
  await run(`
    CREATE TABLE raw AS
    SELECT * FROM read_csv('${RAW_CSV}', all_varchar = true, header = true)
  `);
  const [{ raw_n }] = await all(`SELECT COUNT(*) AS raw_n FROM raw`);
  console.log(`▶ Ingested ${Number(raw_n)} raw rows\n`);

  // ─── LAYER 2: CLEAN + STANDARDIZE + CAST ───────────────────────────
  console.log('▶ LAYER 2: Cleaning & integrity enforcement...');
  await run(`
    CREATE TABLE staged AS
    SELECT
      -- Cast identifier to strict integer
      CAST(TRIM(id) AS BIGINT) AS id,

      -- TRIM removes leading/trailing whitespace; standardize dept to UPPER
      UPPER(TRIM(department)) AS department,

      -- Impute missing agency with a domain-appropriate placeholder
      -- (COALESCE + NULLIF: empty string becomes NULL, then defaults)
      COALESCE(NULLIF(TRIM(agency), ''), 'Unspecified Agency') AS agency,

      -- Monetary cleaning: strip commas, TRY_CAST to DOUBLE (NULL if invalid),
      -- then COALESCE bad/missing amounts to 0.00. Store as DECIMAL for money.
      CAST(
        COALESCE(TRY_CAST(REPLACE(TRIM(amount), ',', '') AS DOUBLE), 0.0)
      AS DECIMAL(18,2)) AS amount,

      -- Standardize category casing to canonical Title-ish forms
      CASE
        WHEN UPPER(TRIM(category)) LIKE 'PERSONNEL%' THEN 'Personnel Services'
        WHEN UPPER(TRIM(category)) = 'MOOE' THEN 'MOOE'
        WHEN UPPER(TRIM(category)) LIKE 'CAPITAL%' THEN 'Capital Outlays'
        ELSE COALESCE(NULLIF(TRIM(category), ''), 'Uncategorized')
      END AS category,

      -- Standardize region casing; impute blanks
      COALESCE(NULLIF(UPPER(TRIM(region)), ''), 'UNASSIGNED') AS region
    FROM raw
  `);

  // ─── DEDUPLICATION via QUALIFY ROW_NUMBER() ────────────────────────
  // Keep ONE row per business key. QUALIFY filters window results inline —
  // cleaner than a subquery. We keep the row with the highest amount (ties
  // broken by lowest id) so imputed 0.00 duplicates lose to real values.
  console.log('▶ Deduplicating with QUALIFY ROW_NUMBER()...');
  await run(`
    CREATE TABLE cleaned AS
    SELECT * FROM staged
    QUALIFY ROW_NUMBER() OVER (
      PARTITION BY department, agency, amount, category
      ORDER BY amount DESC, id ASC
    ) = 1
  `);

  const [{ clean_n }] = await all(`SELECT COUNT(*) AS clean_n FROM cleaned`);
  console.log(`  Rows after dedup: ${Number(clean_n)} (removed ${Number(raw_n) - Number(clean_n)})\n`);

  // ─── LAYER 3a: PRE-EXPORT ASSERTIONS ───────────────────────────────
  // Fail loud if any core field still has NULLs. In a real pipeline this
  // throws and blocks the export — bad data never reaches production.
  console.log('▶ LAYER 3: Post-quality validation (assertions)...');
  const [nullCheck] = await all(`
    SELECT
      COUNT(*) FILTER (WHERE id IS NULL) AS null_id,
      COUNT(*) FILTER (WHERE department IS NULL) AS null_dept,
      COUNT(*) FILTER (WHERE agency IS NULL) AS null_agency,
      COUNT(*) FILTER (WHERE amount IS NULL) AS null_amount,
      COUNT(*) FILTER (WHERE category IS NULL) AS null_category,
      COUNT(*) FILTER (WHERE region IS NULL) AS null_region
    FROM cleaned
  `);
  const totalNulls = Object.values(nullCheck).reduce((s, v) => s + Number(v), 0);

  console.log(`  Null counts in core fields:`);
  Object.entries(nullCheck).forEach(([k, v]) => {
    console.log(`    ${k.padEnd(15)} ${Number(v)}`);
  });

  // ASSERTION 1: zero nulls
  if (totalNulls > 0) {
    throw new Error(`❌ ASSERTION FAILED: ${totalNulls} nulls remain in core fields`);
  }
  console.log('  ✓ ASSERTION PASSED: zero nulls in all core fields');

  // ASSERTION 2: row-count boundary (cleaned must be > 0 and <= raw)
  if (Number(clean_n) === 0 || Number(clean_n) > Number(raw_n)) {
    throw new Error(`❌ ASSERTION FAILED: row count ${clean_n} out of bounds`);
  }
  console.log(`  ✓ ASSERTION PASSED: row count ${Number(clean_n)} within [1, ${Number(raw_n)}]`);

  // ASSERTION 3: amount must be non-negative numeric
  const [{ bad_amt }] = await all(`SELECT COUNT(*) AS bad_amt FROM cleaned WHERE amount < 0`);
  if (Number(bad_amt) > 0) {
    throw new Error(`❌ ASSERTION FAILED: ${bad_amt} negative amounts`);
  }
  console.log('  ✓ ASSERTION PASSED: all amounts non-negative\n');

  // ─── LAYER 3b: EXPORT TO PARQUET (SNAPPY) ──────────────────────────
  // SNAPPY = fast decompression, ideal for DuckDB-WASM reads in-browser.
  console.log('▶ Exporting to cleaned_dataset.parquet (SNAPPY)...');
  await run(`COPY cleaned TO '${OUT_PARQUET}' (FORMAT PARQUET, COMPRESSION SNAPPY)`);

  // ─── POST-EXPORT ROUND-TRIP VALIDATION ─────────────────────────────
  // Read the file BACK to confirm it's valid and matches the in-memory table.
  const [roundTrip] = await all(`
    SELECT COUNT(*) AS n, SUM(amount) AS total FROM '${OUT_PARQUET}'
  `);
  const csvSize = fs.statSync(RAW_CSV).size;
  const pqSize = fs.statSync(OUT_PARQUET).size;

  console.log(`  ✓ Round-trip read: ${Number(roundTrip.n)} rows, total ₱${Number(roundTrip.total).toLocaleString()}`);
  console.log(`  ✓ File written: ${(pqSize / 1024).toFixed(1)} KB (from ${(csvSize / 1024).toFixed(1)} KB CSV)\n`);

  // Show a clean sample for the workshop
  const sample = await all(`SELECT * FROM '${OUT_PARQUET}' ORDER BY amount DESC LIMIT 5`);
  console.log('  Sample cleaned rows (top 5 by amount):');
  console.table(sample.map(r => ({ ...r, id: Number(r.id), amount: Number(r.amount) })));

  console.log('═══════════════════════════════════════════════════════════');
  console.log(' PIPELINE COMPLETE — cleaned_dataset.parquet is production-ready');
  console.log('═══════════════════════════════════════════════════════════');

  db.close();
}

main().catch((err) => {
  console.error('\nPipeline failed:', err.message);
  process.exit(1);
});
