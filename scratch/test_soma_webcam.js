import { ComputerControlArbiter } from '../arbiters/ComputerControlArbiter.js';
import { analyzeImageFile } from '../server/utils/LocalVisionFileAnalyzer.js';
import path from 'path';

async function testWebcam() {
    console.log('👁️ [TEST] Initializing ComputerControlArbiter...');
    const control = new ComputerControlArbiter({ name: 'TestComputerControl', dryRun: false });
    await control.initialize();

    console.log('📸 [TEST] Triggering Webcam Capture...');
    try {
        const cap = await control.captureWebcam();
        console.log('Capture Response:', cap);

        if (cap.success) {
            console.log('🧠 [TEST] Analyzing captured frame with local VLM...');
            const result = await analyzeImageFile(cap.imagePath, {
                prompt: 'Describe what is visible in this webcam capture. Mention any visible people, room features, or objects.'
            });
            console.log('✅ [TEST] Vision Analysis Success!');
            console.log('Model Used:', result.model);
            console.log('Summary:', result.summary);
            console.log('Objects:', result.objects);
        } else {
            console.error('❌ [TEST] Capture Failed:', cap.error);
        }
    } catch (e) {
        console.error('❌ [TEST] Error during execution:', e.message);
    } finally {
        await control.onShutdown();
        process.exit(0);
    }
}

testWebcam();
