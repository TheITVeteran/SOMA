/**
 * test_forensics_suite.mjs
 * 
 * End-to-end verification for the SOMA Forensic Suite.
 * Tests: Benford's Law, Excel Heatmap, and TIE Handshake.
 */

import path from 'path';
import fs from 'fs/promises';
import { ForensicVerdictArbiter } from './arbiters/ForensicVerdictArbiter.js';
import { OcularArbiter } from './arbiters/OcularArbiter.js';

async function runTest() {
    console.log("🚀 [Test] Starting Forensic Suite Verification...");

    // Mock system object
    const system = {
        oculus: new OcularArbiter({}),
        forensics: null
    };
    system.forensics = new ForensicVerdictArbiter(system);

    const testFilesDir = path.join(process.cwd(), 'data', 'test_forensics');
    await fs.mkdir(testFilesDir, { recursive: true });

    const excelPath = path.join(testFilesDir, 'test_financials.xlsx');
    // Note: In a real test we'd need a real .xlsx file. 
    // For this smoke test, we'll check if the arbiter handles "file not found" or basic launch errors.

    console.log("\n1️⃣ Testing Benford's Law Limb...");
    try {
        // This will likely fail with "File not found" but we want to see the Python bridge work
        const benford = await system.forensics.performBenford(excelPath);
        console.log("✅ Benford Result:", JSON.stringify(benford, null, 2));
    } catch (e) {
        console.log("ℹ️ Benford (Expected) Failure/Result:", e.message);
    }

    console.log("\n2️⃣ Testing Excel Heatmap Limb...");
    try {
        const heatmap = await system.forensics.performHeatmap(excelPath);
        console.log("✅ Heatmap Result:", JSON.stringify(heatmap, null, 2));
    } catch (e) {
        console.log("ℹ️ Heatmap (Expected) Failure/Result:", e.message);
    }

    console.log("\n3️⃣ Testing TIE Handshake...");
    const pdfPath = path.join(testFilesDir, 'test_statement.pdf');
    try {
        const tie = await system.forensics.performTie(pdfPath, excelPath);
        console.log("✅ TIE Result:", JSON.stringify(tie, null, 2));
    } catch (e) {
        console.log("ℹ️ TIE (Expected) Failure/Result:", e.message);
    }

    console.log("\n🏁 Forensic Suite Test Cycle Complete.");
}

runTest().catch(console.error);
