/**
 * PH Budget Data Pipeline — Ingestion Script
 *
 * Reads FY2026_GAA.xlsx using DuckDB's spatial extension,
 * cleans, deduplicates, transforms, and exports to Parquet.
 *
 * Monetary values: AMT column is in PHP thousands (× 1,000).
 * Derived column `amount_php` stores the full peso value.
 */

const duckdb = require('duckdb');
const path = require('path');
const fs = require('fs');

const XLSX_PATH = path.resolve(__dirname, '../../FY2026_GAA.xlsx');
const OUTPUT_DIR = path.resolve(__dirname, '../output');

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

const db = new duckdb.Database(':memory:');

function run(sql) {
  return new Promise((resolve, reject) => {
    db.run(sql, (err) => (err ? reject(err) : resolve()));
  });
}

function all(sql) {
  return new Promise((resolve, reject) => {
    db.all(sql, (err, rows) => (err ? reject(err) : resolve(rows)));
  });
}

async function main() {
  console.log('═══════════════════════════════════════════════');
  console.log(' PH FY2026 GAA — Data Pipeline');
  console.log('═══════════════════════════════════════════════\n');

  // ─── Step 1: Load extension & ingest raw data ───────────────────────
  console.log('▶ Step 1: Installing DuckDB spatial extension...');
  await run('INSTALL spatial; LOAD spatial;');

  console.log('▶ Step 2: Ingesting Excel file...');
  console.log(`  Source: ${XLSX_PATH}`);
  console.log(`  Size: ${(fs.statSync(XLSX_PATH).size / 1e6).toFixed(1)} MB`);

  await run(`
    CREATE TABLE raw AS
    SELECT * FROM read_xlsx('${XLSX_PATH}', all_varchar = true)
  `);

  const [{ raw_cnt }] = await all('SELECT COUNT(*) as raw_cnt FROM raw');
  console.log(`  Raw rows ingested: ${Number(raw_cnt).toLocaleString()}`);

  // ─── Step 2: Clean, cast types, deduplicate ─────────────────────────
  console.log('\n▶ Step 3: Cleaning, casting types, deduplicating...');

  await run(`
    CREATE TABLE cleaned AS
    SELECT DISTINCT
      CAST(SORDER AS INTEGER) AS sort_order,
      TRIM(DEPARTMENT) AS department_code,
      TRIM(UACS_DPT_DSC) AS department_name,
      TRIM(AGENCY) AS agency_code,
      TRIM(UACS_AGY_DSC) AS agency_name,
      TRIM(PREXC_FPAP_ID) AS program_id,
      CAST(PREXC_LEVEL AS INTEGER) AS program_level,
      TRIM(DSC) AS program_description,
      TRIM(OPERUNIT) AS oper_unit,
      TRIM(UACS_OPER_DSC) AS oper_unit_description,
      TRIM(UACS_REG_ID) AS region_id,
      TRIM(UACS_OPERDIV_ID) AS division_id,
      TRIM(UACS_DIV_DSC) AS division_description,
      TRIM(FUNDCD) AS fund_code,
      TRIM(UACS_FUNDSUBCAT_DSC) AS fund_subcategory,
      TRIM(UACS_EXP_CD) AS expense_class_code,
      TRIM(UACS_EXP_DSC) AS expense_class,
      TRIM(UACS_OBJ_CD) AS object_code,
      TRIM(UACS_OBJ_DSC) AS object_description,
      TRY_CAST(AMT AS BIGINT) AS amount_thousands
    FROM raw
    WHERE
      -- Must have a valid, non-zero amount
      AMT IS NOT NULL
      AND TRY_CAST(AMT AS BIGINT) IS NOT NULL
      AND TRY_CAST(AMT AS BIGINT) > 0
      -- Must have a real department (filter meta/category rows)
      AND TRIM(UACS_DPT_DSC) IS NOT NULL
      AND TRIM(UACS_DPT_DSC) != ''
      AND TRIM(UACS_DPT_DSC) NOT IN ('Automatic Appropriations', 'New General Appropriations')
  `);

  const [{ clean_cnt }] = await all('SELECT COUNT(*) as clean_cnt FROM cleaned');
  console.log(`  Rows after cleaning & dedup: ${Number(clean_cnt).toLocaleString()}`);

  // Check for duplicates removed
  const [{ dup_cnt }] = await all(`
    SELECT (SELECT COUNT(*) FROM raw WHERE AMT IS NOT NULL AND TRY_CAST(AMT AS BIGINT) IS NOT NULL) - ${Number(clean_cnt)} as dup_cnt
  `);
  console.log(`  Rows removed (dupes + meta): ${Number(dup_cnt).toLocaleString()}`);

  // ─── Step 3: Add derived columns ───────────────────────────────────
  console.log('\n▶ Step 4: Adding derived columns...');

  await run(`
    CREATE TABLE budget AS
    SELECT
      *,
      -- Full PHP peso amount
      amount_thousands * 1000 AS amount_php,
      -- Broad expense category for dashboard grouping
      CASE
        WHEN expense_class = 'Personnel Services' THEN 'PS'
        WHEN expense_class = 'Maintenance and Other Operating Expenses' THEN 'MOOE'
        WHEN expense_class = 'Capital Outlays' THEN 'CO'
        WHEN expense_class = 'Financial Expenses' THEN 'FE'
        ELSE 'Other'
      END AS expense_category,
      -- Department short name (text inside parentheses, or full name)
      CASE
        WHEN POSITION('(' IN department_name) > 0
        THEN SUBSTRING(department_name FROM POSITION('(' IN department_name) + 1
             FOR POSITION(')' IN department_name) - POSITION('(' IN department_name) - 1)
        ELSE department_name
      END AS department_short
    FROM cleaned
  `);

  const [{ budget_cnt }] = await all('SELECT COUNT(*) as budget_cnt FROM budget');
  console.log(`  Final budget table: ${Number(budget_cnt).toLocaleString()} rows`);

  // ─── Step 4: Export detail parquet ──────────────────────────────────
  console.log('\n▶ Step 5: Exporting Parquet files...');

  const detailPath = path.join(OUTPUT_DIR, 'budget_detail.parquet');
  await run(`COPY budget TO '${detailPath}' (FORMAT PARQUET, COMPRESSION ZSTD)`);
  console.log(`  ✓ budget_detail.parquet (${Number(budget_cnt).toLocaleString()} rows)`);

  // ─── Step 5: Compute aggregations for the dashboard ─────────────────
  // Department summary
  await run(`
    CREATE TABLE agg_department AS
    SELECT
      department_code,
      department_name,
      department_short,
      COUNT(*) AS line_items,
      SUM(amount_php) AS total_php,
      SUM(CASE WHEN expense_category = 'PS' THEN amount_php ELSE 0 END) AS ps_php,
      SUM(CASE WHEN expense_category = 'MOOE' THEN amount_php ELSE 0 END) AS mooe_php,
      SUM(CASE WHEN expense_category = 'CO' THEN amount_php ELSE 0 END) AS co_php,
      SUM(CASE WHEN expense_category = 'FE' THEN amount_php ELSE 0 END) AS fe_php,
      COUNT(DISTINCT agency_code) AS agency_count
    FROM budget
    GROUP BY department_code, department_name, department_short
    ORDER BY total_php DESC
  `);

  const deptPath = path.join(OUTPUT_DIR, 'agg_department.parquet');
  await run(`COPY agg_department TO '${deptPath}' (FORMAT PARQUET, COMPRESSION ZSTD)`);
  const [{ dept_cnt }] = await all('SELECT COUNT(*) as dept_cnt FROM agg_department');
  console.log(`  ✓ agg_department.parquet (${Number(dept_cnt)} departments)`);

  // Expense class summary
  await run(`
    CREATE TABLE agg_expense AS
    SELECT
      expense_category,
      expense_class,
      COUNT(*) AS line_items,
      SUM(amount_php) AS total_php
    FROM budget
    GROUP BY expense_category, expense_class
    ORDER BY total_php DESC
  `);

  const expPath = path.join(OUTPUT_DIR, 'agg_expense.parquet');
  await run(`COPY agg_expense TO '${expPath}' (FORMAT PARQUET, COMPRESSION ZSTD)`);
  console.log('  ✓ agg_expense.parquet');

  // Agency-level breakdown
  await run(`
    CREATE TABLE agg_agency AS
    SELECT
      department_code,
      department_name,
      department_short,
      agency_code,
      agency_name,
      expense_category,
      COUNT(*) AS line_items,
      SUM(amount_php) AS total_php
    FROM budget
    GROUP BY department_code, department_name, department_short,
             agency_code, agency_name, expense_category
    ORDER BY total_php DESC
  `);

  const agencyPath = path.join(OUTPUT_DIR, 'agg_agency.parquet');
  await run(`COPY agg_agency TO '${agencyPath}' (FORMAT PARQUET, COMPRESSION ZSTD)`);
  const [{ agy_cnt }] = await all('SELECT COUNT(*) as agy_cnt FROM agg_agency');
  console.log(`  ✓ agg_agency.parquet (${Number(agy_cnt)} rows)`);

  // Region-level aggregation (for choropleth map)
  await run(`
    CREATE TABLE agg_region AS
    SELECT
      region_id,
      COUNT(*) AS line_items,
      SUM(amount_php) AS total_php,
      SUM(CASE WHEN expense_category = 'PS' THEN amount_php ELSE 0 END) AS ps_php,
      SUM(CASE WHEN expense_category = 'MOOE' THEN amount_php ELSE 0 END) AS mooe_php,
      SUM(CASE WHEN expense_category = 'CO' THEN amount_php ELSE 0 END) AS co_php,
      SUM(CASE WHEN expense_category = 'FE' THEN amount_php ELSE 0 END) AS fe_php,
      COUNT(DISTINCT department_short) AS department_count,
      COUNT(DISTINCT agency_name) AS agency_count
    FROM budget
    GROUP BY region_id
    ORDER BY total_php DESC
  `);

  const regionPath = path.join(OUTPUT_DIR, 'agg_region.parquet');
  await run(`COPY agg_region TO '${regionPath}' (FORMAT PARQUET, COMPRESSION ZSTD)`);
  const [{ reg_cnt }] = await all('SELECT COUNT(*) as reg_cnt FROM agg_region');
  console.log(`  ✓ agg_region.parquet (${Number(reg_cnt)} regions)`);

  // ─── Step 6: Verification queries ──────────────────────────────────
  console.log('\n▶ Step 6: Verification...');

  const [{ grand_total }] = await all('SELECT SUM(amount_php) as grand_total FROM budget');
  console.log(`  Grand total budget: ₱${(Number(grand_total) / 1e12).toFixed(3)} Trillion`);

  const topDepts = await all('SELECT department_short, total_php FROM agg_department LIMIT 10');
  console.log('\n  Top 10 departments:');
  for (const row of topDepts) {
    console.log(`    ${row.department_short.padEnd(30)} ₱${(Number(row.total_php) / 1e9).toFixed(2)}B`);
  }

  const expBreakdown = await all('SELECT expense_category, total_php FROM agg_expense ORDER BY total_php DESC');
  console.log('\n  Expense breakdown:');
  for (const row of expBreakdown) {
    console.log(`    ${row.expense_category.padEnd(10)} ₱${(Number(row.total_php) / 1e9).toFixed(2)}B`);
  }

  console.log('\n═══════════════════════════════════════════════');
  console.log(' Pipeline complete!');
  console.log('═══════════════════════════════════════════════');
  console.log(`\n Output: ${OUTPUT_DIR}/`);
  console.log('  • budget_detail.parquet   — full line items');
  console.log('  • agg_department.parquet  — dept aggregates');
  console.log('  • agg_expense.parquet     — expense class totals');
  console.log('  • agg_agency.parquet      — agency breakdown');
  console.log('  • agg_region.parquet      — regional aggregates (for map)');

  db.close();
}

main().catch((err) => {
  console.error('\n✗ Pipeline failed:', err);
  process.exit(1);
});
