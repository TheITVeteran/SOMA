import WebSocket from 'ws';

async function main() {
    console.log("🔌 Connecting to SOMA MessageBroker Network Bridge...");
    const ws = new WebSocket('ws://localhost:4201');

    ws.on('open', () => {
        console.log("🌐 Connected. Registering and subscribing to vocal_synthesis_requested...");
        ws.send(JSON.stringify({
            type: 'register',
            name: 'TestPerceptionGenerator',
            subscriptions: ['vocal_synthesis_requested']
        }));

        // Wait a brief moment to ensure registration is fully processed
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
                    // We point to an existing image file so FS reads succeed if checked
                    imagePath: 'C:/Users/barry/Desktop/The Stack/SOMA/test_webcam.jpg'
                }
            }));
        }, 1000);
    });

    ws.on('message', (raw) => {
        const msg = JSON.parse(raw.toString());
        if (msg.type === 'signal' && msg.topic === 'vocal_synthesis_requested') {
            console.log("\n🔊 SOMA PROACTIVE SPEECH REQUEST DETECTED!");
            console.log(`💬 Text: "${msg.payload.text}"`);
            console.log(`🎭 Emotion: ${msg.payload.emotion}`);
            console.log(`🏷️ Source: ${msg.payload.source}`);
            console.log("\n✅ Proactive room reaction verification PASSED!");
            ws.close();
            process.exit(0);
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
        console.error("❌ Test timed out after 30 seconds without SOMA vocal response.");
        ws.close();
        process.exit(1);
    }, 30000);
}

main();
