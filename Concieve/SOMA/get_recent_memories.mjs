import Database from 'better-sqlite3';
import path from 'path';

const dbPath = path.resolve('soma-memory.db');
const db = new Database(dbPath);

console.log("--- Latest 10 SOMA Memories ---");
const rows = db.prepare('SELECT id, content, created_at FROM memories ORDER BY created_at DESC LIMIT 10').all();

rows.forEach((row, i) => {
    const date = new Date(row.created_at).toLocaleString();
    console.log(`
[${i+1}] ${date} (ID: ${row.id})`);
    console.log(`Content: ${row.content.substring(0, 300)}...`);
});

db.close();
