import fs from 'fs';
import fetch from 'node-fetch';

async function main() {
    const imagePath = 'C:/Users/barry/Desktop/The Stack/SOMA/test_webcam.jpg';
    if (!fs.existsSync(imagePath)) {
        console.error("No image!");
        return;
    }
    const buffer = fs.readFileSync(imagePath);
    const base64 = buffer.toString('base64');
    
    console.log("⚡ Requesting moondream:latest via Ollama...");
    try {
        const response = await fetch('http://localhost:11434/api/generate', {
            method: 'POST',
            body: JSON.stringify({
                model: 'moondream:latest',
                prompt: "Describe what you see in this image briefly (1 sentence).",
                images: [base64],
                stream: false
            })
        });
        const data = await response.json();
        console.log("Response:", JSON.stringify(data, null, 2));
    } catch (e) {
        console.error("Error:", e.message);
    }
}
main();
