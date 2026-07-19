const duckdb = require('duckdb');

const db = new duckdb.Database(':memory:');

db.run('CREATE TABLE test (id INTEGER, name VARCHAR)', (err) => {
  if (err) { console.error(err); process.exit(1); }

  db.run("INSERT INTO test VALUES (1, 'pipeline'), (2, 'duckdb')", (err) => {
    if (err) { console.error(err); process.exit(1); }

    db.all('SELECT * FROM test', (err, rows) => {
      if (err) { console.error(err); process.exit(1); }

      console.log('Pipeline smoke test passed ✓');
      console.log('Rows:', rows);
      db.close();
    });
  });
});
