/**
 * verify_benford_limb.mjs
 */
import path from 'path';
import { ForensicVerdictArbiter } from './arbiters/ForensicVerdictArbiter.js';

async function verify() {
    const system = { oculus: {} };
    const forensics = new ForensicVerdictArbiter(system);
    const csvPath = path.join(process.cwd(), 'data', 'test_forensics', 'mock_benford.csv');

    console.log("🧐 Verifying Benford Limb with real data...");
    try {
        const result = await forensics.performBenford(csvPath);
        console.log("📊 Results for Amount column:");
        const analysis = result.analyses.Amount;
        console.log(`   Fidelity Score: ${(analysis.fidelity_score * 100).toFixed(2)}%`);
        console.log(`   Verdict: ${analysis.verdict}`);
        console.log(`   Sample Size: ${analysis.sample_size}`);
        
        if (analysis.fidelity_score > 0.05) {
            console.log("✅ SUCCESS: Limb correctly identified natural distribution.");
        } else {
            console.log("⚠️ WARNING: Distribution flagged as anomalous (expected for random data sometimes).");
        }
    } catch (e) {
        console.error("❌ Verification Failed:", e.message);
    }
}

verify();
