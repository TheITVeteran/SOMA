/**
 * download_poppler.cjs
 * SOMA Sovereign Provisioner V2 — Absolute Extraction.
 */
const fs = require('fs');
const path = require('path');
const https = require('https');
const { execSync } = require('child_process');

const POPPLER_URL = 'https://github.com/oschwartz10612/poppler-windows/releases/download/v24.08.0-0/Release-24.08.0-0.zip';
const TARGET_DIR = path.join(process.cwd(), 'appendages', 'provenance', 'ocular', 'bin');

async function provision() {
    console.log('🌀 [Provisioner] Initiating high-fidelity download...');
    if (!fs.existsSync(TARGET_DIR)) fs.mkdirSync(TARGET_DIR, { recursive: true });

    const zipPath = path.join(TARGET_DIR, 'poppler.zip');
    
    const file = fs.createWriteStream(zipPath);
    https.get(POPPLER_URL, (res) => {
        res.pipe(file);
        file.on('finish', async () => {
            file.close();
            // 🛡️ Physical Delay: Wait for OS handle release
            console.log('✅ [Provisioner] Download finished. Cooling down handles...');
            await new Promise(r => setTimeout(resolve => r(), 3000));
            
            console.log('🚀 [Provisioner] Atomic Extraction starting...');
            try {
                execSync(`powershell -Command "Expand-Archive -Path '${zipPath}' -DestinationPath '${TARGET_DIR}' -Force"`);
                console.log('🎯 [Provisioner] SUCCESS. Binaries physically anchored.');
                fs.unlinkSync(zipPath);
            } catch (e) {
                console.error('❌ [Provisioner] Extraction failed:', e.message);
            }
        });
    });
}
provision();
