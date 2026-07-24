/**
 * ═══════════════════════════════════════════════════════════════════
 * PRODUCTION DATA QUALITY VALIDATION SUITE
 * ═══════════════════════════════════════════════════════════════════
 *
 * Validates the parquet files served to the DuckDB-WASM dashboard.
 * Every check is a hard gate: any failure exits non-zero (CI-friendly).
 *
 * Files validated:
 *   - budget_detail.parquet   (source of truth, 522K rows)
 *   - agg_department.parquet  (37 depts)
 *   - agg_expense.parquet     (expense classes)
 *   - agg_agency.parquet      (agency breakdown)
 *   - agg_region.parquet      (18 regions)
 */

const duckdb = require('duckdb');
const path = require('path');
const fs = require('fs');

const DIR = path.resolve(__dirname, '../../dashboard/public/data');
const db = new duckdb.Database(':memory:');

function all(sql) {
  return new Promise((resolve, reject) => db.all(sql, (e, r) => (e ? reject(e) : resolve(r))));
}

// Test harness
let passed = 0;
let failed = 0;
const failures = [];

function assert(name, condition, detail) {
  if (condition) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    failures.push({ name, detail });
    console.log(`  ✗ ${name} — ${detail}`);
  }
}

async function validate() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log(' PRODUCTION DATA QUALITY VALIDATION');
  console.log('═══════════════════════════════════════════════════════════\n');

  // ─── GATE 0: FILE EXISTENCE ────────────────────────────────────────
  console.log('▶ GATE 0: File existence & readability');
  const files = ['budget_detail.parquet', 'agg_department.parquet', 'agg_expense.parquet', 'agg_agency.parquet', 'agg_region.parquet'];
  for (const f of files) {
    const p = path.join(DIR, f);
    assert(`${f} exists`, fs.existsSync(p), 'file missing');
  }

  // ─── GATE 1: COMPLETENESS (ZERO NULLS in core fields) ──────────────
  console.log('\n▶ GATE 1: Completeness — zero nulls in core fields');
  const [nulls] = await all(`
    SELECT
      COUNT(*) FILTER (WHERE department_code IS NULL) AS dept_code,
      COUNT(*) FILTER (WHERE department_name IS NULL) AS dept_name,
      COUNT(*) FILTER (WHERE agency_name IS NULL) AS agency,
      COUNT(*) FILTER (WHERE expense_category IS NULL) AS exp_cat,
      COUNT(*) FILTER (WHERE object_description IS NULL) AS obj,
      COUNT(*) FILTER (WHERE amount_php IS NULL) AS amount,
      COUNT(*) FILTER (WHERE region_id IS NULL) AS region
    FROM '${DIR}/budget_detail.parquet'
  `);
  assert('department_code has no nulls', Number(nulls.dept_code) === 0, `${nulls.dept_code} nulls`);
  assert('department_name has no nulls', Number(nulls.dept_name) === 0, `${nulls.dept_name} nulls`);
  assert('agency_name has no nulls', Number(nulls.agency) === 0, `${nulls.agency} nulls`);
  assert('expense_category has no nulls', Number(nulls.exp_cat) === 0, `${nulls.exp_cat} nulls`);
  assert('object_description has no nulls', Number(nulls.obj) === 0, `${nulls.obj} nulls`);
  assert('amount_php has no nulls', Number(nulls.amount) === 0, `${nulls.amount} nulls`);
  assert('region_id has no nulls', Number(nulls.region) === 0, `${nulls.region} nulls`);

  // ─── GATE 2: VALIDITY (types, ranges, domains) ─────────────────────
  console.log('\n▶ GATE 2: Validity — ranges & domain constraints');
  const [validity] = await all(`
    SELECT
      COUNT(*) FILTER (WHERE amount_php <= 0) AS non_positive,
      COUNT(*) FILTER (WHERE amount_php > 1e15) AS implausible,
      COUNT(*) FILTER (WHERE expense_category NOT IN ('PS','MOOE','CO','FE','Other')) AS bad_category,
      COUNT(*) FILTER (WHERE amount_thousands * 1000 != amount_php) AS derived_mismatch,
      MIN(amount_php) AS min_amt,
      MAX(amount_php) AS max_amt
    FROM '${DIR}/budget_detail.parquet'
  `);
  assert('no non-positive amounts', Number(validity.non_positive) === 0, `${validity.non_positive} rows <= 0`);
  assert('no implausible amounts (>₱1Q)', Number(validity.implausible) === 0, `${validity.implausible} rows`);
  assert('expense_category in valid domain', Number(validity.bad_category) === 0, `${validity.bad_category} bad`);
  assert('derived amount_php = thousands*1000', Number(validity.derived_mismatch) === 0, `${validity.derived_mismatch} mismatches`);
  console.log(`     (min ₱${Number(validity.min_amt).toLocaleString()}, max ₱${(Number(validity.max_amt) / 1e9).toFixed(1)}B)`);

  // ─── GATE 3: UNIQUENESS (no full-row duplicates) ───────────────────
  console.log('\n▶ GATE 3: Uniqueness — no full-row duplicates');
  const [uniq] = await all(`
    SELECT
      COUNT(*) AS total,
      (SELECT COUNT(*) FROM (SELECT DISTINCT * FROM '${DIR}/budget_detail.parquet')) AS distinct_rows
    FROM '${DIR}/budget_detail.parquet'
  `);
  assert('all rows unique', Number(uniq.total) === Number(uniq.distinct_rows),
    `${Number(uniq.total) - Number(uniq.distinct_rows)} dupes`);

  // ─── GATE 4: CONSISTENCY (cross-table referential integrity) ───────
  console.log('\n▶ GATE 4: Consistency — cross-table integrity');
  const [detail] = await all(`SELECT SUM(amount_php) AS t, COUNT(*) AS n FROM '${DIR}/budget_detail.parquet'`);
  const [dept] = await all(`SELECT SUM(total_php) AS t, SUM(line_items) AS n FROM '${DIR}/agg_department.parquet'`);
  const [exp] = await all(`SELECT SUM(total_php) AS t FROM '${DIR}/agg_expense.parquet'`);
  const [agy] = await all(`SELECT SUM(total_php) AS t FROM '${DIR}/agg_agency.parquet'`);
  const [reg] = await all(`SELECT SUM(total_php) AS t FROM '${DIR}/agg_region.parquet'`);

  const detailTotal = Number(detail.t);
  assert('agg_department total matches detail', Number(dept.t) === detailTotal, `${Number(dept.t)} vs ${detailTotal}`);
  assert('agg_expense total matches detail', Number(exp.t) === detailTotal, `${Number(exp.t)} vs ${detailTotal}`);
  assert('agg_agency total matches detail', Number(agy.t) === detailTotal, `${Number(agy.t)} vs ${detailTotal}`);
  assert('agg_region total matches detail', Number(reg.t) === detailTotal, `${Number(reg.t)} vs ${detailTotal}`);
  assert('agg_department line_items matches detail row count', Number(dept.n) === Number(detail.n), `${Number(dept.n)} vs ${Number(detail.n)}`);

  // ─── GATE 5: ACCURACY (known-truth anchors) ────────────────────────
  console.log('\n▶ GATE 5: Accuracy — anchored to known GAA facts');
  // FY2026 GAA program-level total should be ~₱4.08T after filtering
  const grandT = detailTotal / 1e12;
  assert('grand total in expected range (₱3.5T–₱4.5T)', grandT >= 3.5 && grandT <= 4.5, `₱${grandT.toFixed(3)}T`);

  const [deptCount] = await all(`SELECT COUNT(*) AS n FROM '${DIR}/agg_department.parquet'`);
  assert('department count is plausible (30–45)', Number(deptCount.n) >= 30 && Number(deptCount.n) <= 45, `${Number(deptCount.n)}`);

  const [regCount] = await all(`SELECT COUNT(*) AS n FROM '${DIR}/agg_region.parquet'`);
  assert('region count is plausible (17–18)', Number(regCount.n) >= 17 && Number(regCount.n) <= 18, `${Number(regCount.n)}`);

  // ─── GATE 6: EXPENSE BREAKDOWN INTEGRITY ───────────────────────────
  console.log('\n▶ GATE 6: Expense sub-total integrity');
  const [expSplit] = await all(`
    SELECT COUNT(*) FILTER (
      WHERE ps_php + mooe_php + co_php + fe_php != total_php
    ) AS mismatched
    FROM '${DIR}/agg_department.parquet'
  `);
  assert('dept expense splits sum to total', Number(expSplit.mismatched) === 0, `${expSplit.mismatched} depts mismatched`);

  // ─── FINAL VERDICT ─────────────────────────────────────────────────
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log(` VALIDATION RESULT: ${passed} passed, ${failed} failed`);
  console.log('═══════════════════════════════════════════════════════════');

  if (failed > 0) {
    console.log('\n❌ DATA QUALITY GATE FAILED. Blocking issues:');
    failures.forEach((f) => console.log(`   • ${f.name}: ${f.detail}`));
    db.close();
    process.exit(1);
  } else {
    console.log('\n✅ ALL QUALITY GATES PASSED — data is clean, reliable, production-ready.');
    console.log(`   Grand total: ₱${grandT.toFixed(3)}T across ${Number(detail.n).toLocaleString()} verified line items.`);
    db.close();
  }
}

validate().catch((err) => {
  console.error('Validation crashed:', err);
  process.exit(1);
});
