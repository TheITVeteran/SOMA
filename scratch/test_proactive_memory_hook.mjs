import WebSocket from 'ws';
import Database from 'better-sqlite3';
import path from 'path';

async function main() {
    console.log("🔌 Connecting to SOMA MessageBroker Network Bridge...");
    const ws = new WebSocket('ws://localhost:4201');

    ws.on('open', () => {
        console.log("🌐 Connected. Registering subscriptions...");
        ws.send(JSON.stringify({
            type: 'register',
            name: 'TestPerceptionMemoryHook',
            subscriptions: ['vocal_synthesis_requested']
        }));

        setTimeout(() => {
            console.log("📡 Publishing fake vision.perceived signal (person detected)...");
            ws.send(JSON.stringify({
                type: 'publish',
                topic: 'vision.perceived',
                payload: {
                    channel: 'webcam',
                    analysis: {
                        objects: [
                            { label: 'person', score: 0.95 }
                        ]
                    },
                    // Direct webcam simulation
                    imagePath: 'C:/Users/barry/Desktop/The Stack/SOMA/test_webcam.jpg'
                }
            }));
        }, 1000);
    });

    ws.on('message', async (raw) => {
        const msg = JSON.parse(raw.toString());
        if (msg.type === 'signal' && msg.topic === 'vocal_synthesis_requested') {
            console.log("\n🔊 SOMA PROACTIVE SPEECH REQUEST DETECTED!");
            const spokenText = msg.payload.text;
            console.log(`💬 Text: "${spokenText}"`);
            console.log(`🎭 Emotion: ${msg.payload.emotion}`);
            console.log(`🏷️ Source: ${msg.payload.source}`);

            console.log("\n⏳ Waiting 2 seconds for memory persistence loop...");
            await new Promise(r => setTimeout(r, 2000));

            try {
                console.log("📂 Opening SQLite Memory DB (soma-memory.db)...");
                const dbPath = path.resolve('soma-memory.db');
                const db = new Database(dbPath);

                console.log("🔍 Querying memories table for vocal synthesis entries...");
                const row = db.prepare("SELECT * FROM memories WHERE content LIKE ? ORDER BY created_at DESC LIMIT 1").get(`%voiced: "${spokenText}"%`);

                if (row) {
                    console.log("\n✅ SUCCESS: Found matching memory entry in database!");
                    console.log("ID:", row.id);
                    console.log("Content:", row.content);
                    console.log("Metadata:", row.metadata);
                    console.log("Created At:", new Date(row.created_at).toLocaleString());
                    db.close();
                    ws.close();
                    process.exit(0);
                } else {
                    console.log("\n❌ FAILED: Memory entry not found in database.");
                    // Dump the last 5 records for debugging
                    const lastMems = db.prepare("SELECT content, created_at FROM memories ORDER BY created_at DESC LIMIT 5").all();
                    console.log("Last 5 database entries:");
                    lastMems.forEach((m, idx) => {
                        console.log(`  [${idx}] ${m.content} (${new Date(m.created_at).toLocaleTimeString()})`);
                    });
                    db.close();
                    ws.close();
                    process.exit(1);
                }
            } catch (err) {
                console.error("❌ Database query error:", err.message);
                ws.close();
                process.exit(1);
            }
        }
    });

    ws.on('close', () => {
        console.log("🔌 Disconnected from MessageBroker.");
    });

    ws.on('error', (err) => {
        console.error("❌ Socket error:", err.message);
    });

    // Timeout safety
    setTimeout(() => {
        console.error("❌ Test timed out after 35 seconds without SOMA vocal response.");
        ws.close();
        process.exit(1);
    }, 35000);
}

main();
