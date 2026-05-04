import Database from 'better-sqlite3';
import path from 'path';

const dbPath = path.resolve('soma-memory.db');
const db = new Database(dbPath);

console.log("--- Memory Types in SOMA ---");
const rows = db.prepare("SELECT content FROM memories LIMIT 100").all();

const types = new Set();
rows.forEach(row => {
    try {
        const data = JSON.parse(row.content);
        if (data.type) types.add(data.type);
        else if (data.id && data.label) types.add('fragment_seed');
        else if (Object.keys(data).every(k => k.includes(''))) types.add('file_index');
    } catch (e) {
        types.add('raw_text');
    }
});

console.log(Array.from(types));
db.close();
