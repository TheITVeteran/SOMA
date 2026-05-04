// This script tries to trigger the bskyPost function if it exists in the system
// Since we can't easily access the running system object from a separate process,
// we will check if the environment variables are correctly set for the main process.

import fs from 'fs';
import path from 'path';

function checkEnv() {
    console.log('--- Environment Check ---');
    console.log('CWD:', process.cwd());
    
    const envPath = path.join(process.cwd(), 'config', 'api-keys.env');
    if (fs.existsSync(envPath)) {
        console.log('config/api-keys.env exists.');
        const content = fs.readFileSync(envPath, 'utf8');
        const hasId = content.includes('BLUESKY_IDENTIFIER');
        const hasPw = content.includes('BLUESKY_PASSWORD');
        console.log('Has Identifier:', hasId);
        console.log('Has Password:', hasPw);
    } else {
        console.log('config/api-keys.env MISSING!');
    }

    // Check if the worker can be spawned
    const workerPath = path.join(process.cwd(), 'server', 'social', 'bluesky_worker.mjs');
    if (fs.existsSync(workerPath)) {
        console.log('Worker exists at:', workerPath);
    } else {
        console.log('Worker MISSING at:', workerPath);
    }
}

checkEnv();
