import { OcularArbiter } from './arbiters/OcularArbiter.js';
import path from 'path';

async function testOcular() {
    console.log('👁️ [TEST] Initializing Ocular Arbiter...');
    
    // Minimal mock system
    const system = {};
    const ocular = new OcularArbiter(system);
    
    const targetFile = path.join(process.cwd(), 'Articles_Of_Incorporation.pdf');
    console.log(`👁️ [TEST] Analyzing: ${targetFile}`);

    try {
        const result = await ocular.analyzeDocument(targetFile);
        console.log('✅ [TEST] Ocular Analysis Success!');
        console.log('Engine:', result.ocular.engine);
        console.log('Pages:', result.ocular.pages.length);
        console.log('Total Tables found:', result.ocular.total_tables);
        
        if (result.ocular.pages.length > 0) {
            console.log('Visual Evidence path (Page 1):', result.ocular.pages[0].visual_evidence);
            console.log('Text preview (first 100 chars):', result.ocular.pages[0].text.substring(0, 100));
        }
    } catch (e) {
        console.error('❌ [TEST] Ocular Analysis Failed:', e.message);
        if (e.message.includes('poppler')) {
             console.log('💡 Note: pdf2image requires poppler to be installed on the system.');
        }
    }
}

testOcular();
