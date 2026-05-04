import path from 'path';
import fs from 'fs/promises';
import Database from 'better-sqlite3';
import crypto from 'crypto';

async function indexFolderManually(folderPath) {
    console.log(`Manual indexing started for: ${folderPath}`);
    const db = new Database('soma-memory.db');
    let count = 0;

    async function scan(dir) {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;

            if (entry.isDirectory()) {
                await scan(fullPath);
            } else if (entry.isFile() && entry.name.endsWith('.md')) {
                const content = await fs.readFile(fullPath, 'utf8');
                const relativePath = path.relative(process.cwd(), fullPath);
                
                const metadata = JSON.stringify({
                    type: 'file_content',
                    path: relativePath,
                    absolutePath: fullPath,
                    indexedAt: new Date().toISOString(),
                    importance: 0.8
                });

                const now = Date.now();
                const id = crypto.randomUUID();

                db.prepare(`
                    INSERT INTO memories (id, content, metadata, created_at, accessed_at, access_count, importance, tier) 
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                `).run(id, content, metadata, now, now, 0, 0.8, 'cold');
                
                count++;
                if (count % 50 === 0) console.log(`Indexed ${count} specialist files...`);
            }
        }
    }

    try {
        await scan(folderPath);
        console.log(`Successfully indexed ${count} files.`);
    } catch (e) {
        console.error(`Indexing failed: ${e.message}`);
    } finally {
        db.close();
    }
}

indexFolderManually(path.join(process.cwd(), 'agents_repo')).catch(console.error);