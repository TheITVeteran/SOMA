import Database from 'better-sqlite3';
import path from 'path';

const dbPath = path.resolve('soma-memory.db');
const db = new Database(dbPath);

console.log("--- Latest SOMA ASI Reflections & Lessons ---");
const rows = db.prepare("SELECT content FROM memories WHERE content LIKE '%asi_reflection%' ORDER BY created_at DESC LIMIT 5").all();

rows.forEach((row, i) => {
    try {
        const data = JSON.parse(row.content);
        console.log(`
[${i+1}] Root Cause: ${data.rootCause}`);
        console.log(`Lessons: ${JSON.stringify(data.lessons)}`);
        console.log(`Hints: ${JSON.stringify(data.patchHints)}`);
    } catch (e) {
        console.log(`
[${i+1}] Raw: ${row.content.substring(0, 200)}...`);
    }
});

db.close();
