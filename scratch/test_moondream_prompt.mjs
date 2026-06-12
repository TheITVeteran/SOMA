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
    
    console.log("⚡ Requesting moondream:latest with specific prompt...");
    try {
        const response = await fetch('http://localhost:11434/api/generate', {
            method: 'POST',
            body: JSON.stringify({
                model: 'moondream:latest',
                prompt: "I noticed you're back at your desk. Hello! Describe the scene briefly in one sentence.",
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
