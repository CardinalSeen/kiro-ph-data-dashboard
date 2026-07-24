/**
 * ═══════════════════════════════════════════════════════════════════
 * WORKSHOP STEP 3 — LAYER 1: DATA QUALITY ASSESSMENT & DIAGNOSTICS
 * ═══════════════════════════════════════════════════════════════════
 *
 * Goal: Before cleaning, PROFILE the raw data. You cannot fix what you
 * cannot measure. This script reports:
 *   1. Schema & inferred data types
 *   2. Row count
 *   3. Column missingness (null / empty rates)
 *   4. Duplicate detection
 *   5. Formatting anomalies (whitespace, non-numeric monetary values)
 *
 * Data Engineering Insight:
 * Running diagnostics in DuckDB (a columnar, vectorized engine) lets us
 * scan millions of rows without loading the full dataset into JS heap —
 * DuckDB streams from disk, so memory stays flat regardless of file size.
 */

const duckdb = require('duckdb');
const path = require('path');

const RAW_CSV = path.resolve(__dirname, 'raw_dataset.csv');
const db = new duckdb.Database(':memory:');

// Promisified helpers so we can use async/await with DuckDB's callback API
function run(sql) {
  return new Promise((resolve, reject) => db.run(sql, (e) => (e ? reject(e) : resolve())));
}
function all(sql) {
  return new Promise((resolve, reject) => db.all(sql, (e, r) => (e ? reject(e) : resolve(r))));
}

async function audit() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log(' LAYER 1: DATA QUALITY AUDIT');
  console.log('═══════════════════════════════════════════════════════════\n');

  // Load raw CSV as ALL VARCHAR — we do NOT trust the source types yet.
  // Reading everything as text prevents DuckDB from failing on mixed cells
  // (e.g., "N/A" in a numeric column) and lets us diagnose the mess safely.
  await run(`
    CREATE TABLE raw AS
    SELECT * FROM read_csv('${RAW_CSV}', all_varchar = true, header = true)
  `);

  // ─── 1. SCHEMA & DATA TYPES ────────────────────────────────────────
  console.log('▶ 1. SCHEMA (raw column names + inferred types)');
  const schema = await all(`DESCRIBE SELECT * FROM raw`);
  schema.forEach((col) => {
    // Note: column names may carry trailing spaces from the header row
    console.log(`   "${col.column_name}" → ${col.column_type}`);
  });

  // ─── 2. ROW COUNT ──────────────────────────────────────────────────
  const [{ n }] = await all(`SELECT COUNT(*) AS n FROM raw`);
  console.log(`\n▶ 2. ROW COUNT: ${Number(n)} rows`);

  // ─── 3. COLUMN MISSINGNESS ─────────────────────────────────────────
  // We treat NULL, empty string, and common sentinels ('N/A') as "missing".
  console.log('\n▶ 3. COLUMN MISSINGNESS (null / empty / sentinel rate)');
  const columns = schema.map((c) => c.column_name);
  for (const col of columns) {
    const q = `
      SELECT
        COUNT(*) AS total,
        COUNT(*) FILTER (
          WHERE "${col}" IS NULL
             OR TRIM("${col}") = ''
             OR UPPER(TRIM("${col}")) IN ('N/A', 'NA', 'NULL')
        ) AS missing
      FROM raw
    `;
    const [row] = await all(q);
    const pct = ((Number(row.missing) / Number(row.total)) * 100).toFixed(1);
    const flag = Number(row.missing) > 0 ? '  ⚠' : '  ✓';
    console.log(`   ${col.trim().padEnd(12)} ${String(row.missing).padStart(3)} missing (${pct}%)${flag}`);
  }

  // ─── 4. DUPLICATE DETECTION ────────────────────────────────────────
  // Business key = department + agency + amount + category (ignoring id).
  // We normalize (TRIM + LOWER) so "DepEd" and " deped " collapse together.
  console.log('\n▶ 4. DUPLICATE DETECTION (on normalized business key)');
  const [dupes] = await all(`
    SELECT
      COUNT(*) - COUNT(DISTINCT (
        LOWER(TRIM(department)) || '|' ||
        LOWER(TRIM(COALESCE(agency, ''))) || '|' ||
        REPLACE(REPLACE(COALESCE(TRIM(amount), ''), ',', ''), ' ', '') || '|' ||
        LOWER(TRIM(COALESCE(category, '')))
      )) AS duplicate_rows
    FROM raw
  `);
  console.log(`   Duplicate rows (normalized): ${Number(dupes.duplicate_rows)}`);

  // ─── 5. FORMATTING ANOMALIES ───────────────────────────────────────
  console.log('\n▶ 5. FORMATTING ANOMALIES');

  // 5a. Trailing / leading whitespace in text columns
  const [ws] = await all(`
    SELECT
      COUNT(*) FILTER (WHERE department != TRIM(department)) AS dept_ws,
      COUNT(*) FILTER (WHERE category != TRIM(category)) AS cat_ws
    FROM raw
  `);
  console.log(`   Whitespace in 'department': ${Number(ws.dept_ws)} rows`);
  console.log(`   Whitespace in 'category':   ${Number(ws.cat_ws)} rows`);

  // 5b. Inconsistent casing in 'category'
  const cats = await all(`SELECT DISTINCT category FROM raw WHERE category IS NOT NULL ORDER BY category`);
  console.log(`   Distinct 'category' values (case chaos): ${cats.length}`);
  cats.forEach((c) => console.log(`     - "${c.category}"`));

  // 5c. Non-numeric values in the monetary column
  //     TRY_CAST returns NULL when a value can't be parsed as a number.
  const [nonNum] = await all(`
    SELECT COUNT(*) FILTER (
      WHERE amount IS NOT NULL
        AND TRIM(amount) != ''
        AND TRY_CAST(REPLACE(amount, ',', '') AS DOUBLE) IS NULL
    ) AS bad_amounts
    FROM raw
  `);
  console.log(`   Non-numeric 'amount' values: ${Number(nonNum.bad_amounts)} (e.g., "N/A")`);

  console.log('\n═══════════════════════════════════════════════════════════');
  console.log(' AUDIT COMPLETE — issues catalogued, ready for cleaning');
  console.log('═══════════════════════════════════════════════════════════');

  db.close();
}

audit().catch((err) => {
  console.error('Audit failed:', err);
  process.exit(1);
});
