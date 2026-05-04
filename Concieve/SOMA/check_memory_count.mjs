import Database from 'better-sqlite3';
const db = new Database('soma-memory.db');
const count = db.prepare('SELECT COUNT(*) as count FROM memories').get().count;
console.log(`Memory count: ${count}`);
db.close();
