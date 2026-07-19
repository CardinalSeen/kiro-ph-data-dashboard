const duckdb = require('duckdb');
const path = require('path');
const fs = require('fs');

const XLSX_PATH = '/Users/marcsandrino/kiro-ph-data-dashboard/FY2026_GAA.xlsx';
const OUTPUT_PATH = '/Users/marcsandrino/kiro-ph-data-dashboard/FY2026_GAA.parquet';

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
  console.log('Installing spatial extension...');
  await run('INSTALL spatial; LOAD spatial;');

  console.log('Reading FY2026_GAA.xlsx (64MB, this may take a minute)...');
  await run(`CREATE TABLE raw AS SELECT * FROM read_xlsx('${XLSX_PATH}', all_varchar = true)`);

  const [cnt] = await all('SELECT COUNT(*) as rows FROM raw');
  console.log(`Rows read: ${Number(cnt.rows).toLocaleString()}`);

  console.log('Exporting to Parquet with ZSTD compression...');
  await run(`COPY raw TO '${OUTPUT_PATH}' (FORMAT PARQUET, COMPRESSION ZSTD)`);

  const xlsxSize = fs.statSync(XLSX_PATH).size;
  const parquetSize = fs.statSync(OUTPUT_PATH).size;

  console.log(`\nConversion complete!`);
  console.log(`  Input:  FY2026_GAA.xlsx   ${(xlsxSize / 1e6).toFixed(1)} MB`);
  console.log(`  Output: FY2026_GAA.parquet ${(parquetSize / 1e6).toFixed(1)} MB`);
  console.log(`  Compression: ${(xlsxSize / parquetSize).toFixed(1)}x smaller`);
  console.log(`\n  Path: ${OUTPUT_PATH}`);
  console.log(`  Ready for GitHub (well under the 100MB file limit).`);

  db.close();
}

main().catch((err) => {
  console.error('Failed:', err);
  process.exit(1);
});
