const duckdb = require('duckdb');
const path = require('path');

const filePath = path.resolve(__dirname, '../../FY2026_GAA.xlsx');
const db = new duckdb.Database(':memory:');

db.run("INSTALL spatial; LOAD spatial;", (err) => {
  if (err) { console.error('Extension error:', err); process.exit(1); }

  // Use st_read to inspect the Excel file (DuckDB spatial extension supports xlsx via GDAL)
  const query = `SELECT * FROM st_read('${filePath}') LIMIT 10`;
  db.all(query, (err, rows) => {
    if (err) {
      console.error('st_read failed:', err.message);
      // Try alternative: use the xlsx reader
      console.log('\nTrying alternative approach...');
      
      const query2 = `SELECT * FROM read_xlsx('${filePath}') LIMIT 10`;
      db.all(query2, (err2, rows2) => {
        if (err2) {
          console.error('read_xlsx also failed:', err2.message);
          console.log('\nTrying with sheet_name option...');
          const query3 = `SELECT * FROM read_xlsx('${filePath}', sheet = 'Sheet 1') LIMIT 10`;
          db.all(query3, (err3, rows3) => {
            if (err3) { console.error('Final attempt failed:', err3.message); process.exit(1); }
            console.log('Rows:', rows3);
            db.close();
          });
        } else {
          console.log('Columns:', Object.keys(rows2[0] || {}));
          console.log('First rows:', rows2);
          db.close();
        }
      });
    } else {
      console.log('Columns:', Object.keys(rows[0] || {}));
      console.log('First rows:', rows);
      db.close();
    }
  });
});
