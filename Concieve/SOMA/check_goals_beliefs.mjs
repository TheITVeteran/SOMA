import Database from 'better-sqlite3';
import path from 'path';

const dbPath = path.resolve('soma-memory.db');
const db = new Database(dbPath);

console.log("--- SOMA Goals & Beliefs ---");
const rows = db.prepare("SELECT content FROM memories WHERE content LIKE '%goal%' OR content LIKE '%belief%' LIMIT 5").all();

rows.forEach((row, i) => {
    console.log(`
[${i+1}] Content: ${row.content.substring(0, 500)}...`);
});

db.close();
