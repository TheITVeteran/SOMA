
import Database from 'better-sqlite3';
const db = new Database('soma-memory.db');
const row = db.prepare("SELECT count(*) as count FROM memories WHERE metadata LIKE '%agents_repo%'").get();
console.log(`Indexed files from agents_repo: ${row.count}`);
db.close();
