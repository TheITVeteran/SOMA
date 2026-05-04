import fs from 'fs';
import path from 'path';
import blueskeyClient from './server/social/BlueskeyClient.js';

function loadKeys() {
    const envPath = path.join(process.cwd(), 'config', 'api-keys.env');
    if (fs.existsSync(envPath)) {
        const content = fs.readFileSync(envPath, 'utf8');
        content.split('\n').forEach(line => {
            if (line && !line.trim().startsWith('#') && line.includes('=')) {
                const [key, ...val] = line.split('=');
                process.env[key.trim()] = val.join('=').trim();
            }
        });
    }
}

async function testBluesky() {
    loadKeys();
    console.log('Testing Bluesky Client with keys from config/api-keys.env...');
    console.log('Configured:', blueskeyClient.configured);
    console.log('Identifier:', process.env.BLUESKY_IDENTIFIER);
    
    try {
        const text = `Diagnostic update: Node 01 is physically testing the AT Protocol interface at ${new Date().toLocaleTimeString()}. #SOMA #AI #Sovereign`;
        console.log('Attempting to post:', text);
        const result = await blueskeyClient.post(text);
        console.log('Post success!', result);
    } catch (e) {
        console.error('Post failed:', e.message);
    }
}

testBluesky();
