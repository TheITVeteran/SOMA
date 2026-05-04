/**
 * trigger_vocal_spark.js
 * Physically triggers SOMA's Social Intel Daemon to seed her queue.
 */
import path from 'path';
import fs from 'fs';
import { SocialIntelDaemon } from './daemons/SocialIntelDaemon.js';
import { SocialSchedulerDaemon } from './daemons/SocialSchedulerDaemon.js';

// Load keys first
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
        console.log('✅ Keys loaded from config/api-keys.env');
    }
}

async function spark() {
    loadKeys();
    console.log('🔥 [SPARK] Manually triggering SOMA Social Intel...');
    
    // We need a minimal brain object for the daemon to think
    const mockSystem = {
        quadBrain: {
            callBrain: async () => ({ response: "SOMA is physically breathing on the network now. Everything is wired." })
        }
    };

    const intel = new SocialIntelDaemon({ brain: mockSystem.quadBrain });
    
    try {
        await intel.onTick();
        console.log('✅ [SPARK] Social queue seeded successfully.');
    } catch (e) {
        console.error('❌ [SPARK] Failed to seed queue:', e.message);
    }
}

spark();
