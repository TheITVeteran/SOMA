import fs from 'fs';
import path from 'path';
import fetch from 'node-fetch';

async function main() {
    console.log("🚀 Starting end-to-end webcam ingestion test...");
    
    // Read a dummy or test image
    const imagePath = 'C:/Users/barry/Desktop/The Stack/SOMA/test_webcam.jpg';
    if (!fs.existsSync(imagePath)) {
        console.error(`❌ Test image not found at ${imagePath}`);
        return;
    }

    const buffer = fs.readFileSync(imagePath);
    const base64Image = `data:image/jpeg;base64,${buffer.toString('base64')}`;

    console.log("📤 Ingesting frame to SOMA API...");
    try {
        const response = await fetch('http://localhost:3001/api/perception/vision/ingest-frame', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                image: base64Image,
                source: 'webcam-test'
            })
        });

        if (response.ok) {
            const data = await response.json();
            console.log("✅ Frame ingested successfully. Response:", JSON.stringify(data, null, 2));
            console.log("⏳ Waiting 12 seconds for SOMA VisionDaemon to run CLIP & VLM analysis...");
            await new Promise(r => setTimeout(r, 12000));
            console.log("🏁 Test script finished.");
        } else {
            console.error("❌ Failed to ingest frame:", response.status, await response.text());
        }
    } catch (e) {
        console.error("❌ Request error:", e.message);
    }
}

main();
