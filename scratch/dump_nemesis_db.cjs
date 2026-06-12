const Database = require('better-sqlite3');

try {
  const db = new Database('data/nemesis-scores.db');
  console.log('Opened DB successfully.');
  
  // List tables
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
  console.log('Tables:', tables);
  
  for (const t of tables) {
    console.log(`\nTable: ${t.name}`);
    const schema = db.prepare(`PRAGMA table_info(${t.name})`).all();
    console.log('Schema:', schema);
    const count = db.prepare(`SELECT COUNT(*) as c FROM ${t.name}`).get().c;
    console.log(`Total rows: ${count}`);
    const rows = db.prepare(`SELECT * FROM ${t.name} LIMIT 10`).all();
    console.log('Sample rows:', rows);
  }
  
  db.close();
} catch (err) {
  console.error('Error:', err);
}
