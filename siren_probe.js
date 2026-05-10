
import { VocalSynthesisArbiter } from './arbiters/VocalSynthesisArbiter.js';
import dotenv from 'dotenv';
import path from 'path';

async function probe() {
    console.log('🔱 [Poseidon] Initiating Real-Time Siren Probe...');
    dotenv.config();

    const siren = new VocalSynthesisArbiter('ProbeHead', {
        primaryEngine: 'fish-speech',
        fishSpeechUrl: 'http://localhost:8081'
    });

    console.log('🧬 Initializing arbiter...');
    await siren.initialize();

    console.log('🗣️ Requesting synthesis...');
    const result = await siren.handleSynthesis({
        text: "Neural vocal link established. The Poseidon Protocol is functioning. Testing local playback now.",
        emotion: 'excited'
    });

    console.log('📊 Result:', JSON.stringify(result, null, 2));
    
    if (result.success) {
        console.log('✅ Synthesis successful. If you hear this, local playback worked.');
    } else {
        console.log('❌ Synthesis failed:', result.error);
    }

    process.exit(0);
}

probe().catch(console.error);
