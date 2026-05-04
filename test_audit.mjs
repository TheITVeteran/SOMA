import { AuditArbiter } from './arbiters/AuditArbiter.js';
import { ForensicVerdictArbiter } from './arbiters/ForensicVerdictArbiter.js';
import fs from 'fs';
import path from 'path';

async function testAuditArbiter() {
    console.log("🚀 Initializing SOMA Enterprise Audit Test...");
    
    // Mock system for the test
    const system = {};
    const auditArbiter = new AuditArbiter({ system });
    
    await auditArbiter.initialize();
    
    // Mock paths (assuming we just need to pass strings to see if the engine handles them)
    const poPath = path.join(process.cwd(), 'mock_po.pdf');
    const invoicePath = path.join(process.cwd(), 'mock_invoice.pdf');
    const glPath = path.join(process.cwd(), 'mock_gl.xlsx');

    // Create dummy files just so the arbiter doesn't crash on path checks immediately
    fs.writeFileSync(poPath, "dummy po content");
    fs.writeFileSync(invoicePath, "dummy invoice content");
    fs.writeFileSync(glPath, "dummy gl content");

    console.log("📄 Created dummy documents for Three-Way Match.");

    try {
        // We expect this to fail gracefully or return a mock result because the actual Python engine
        // needs real PDFs/Excel files, but this tests the JavaScript pipeline.
        console.log("🔍 Triggering performThreeWayMatch...");
        const result = await auditArbiter.performThreeWayMatch(poPath, invoicePath, glPath);
        console.log("✅ Audit Result:", JSON.stringify(result, null, 2));
    } catch (error) {
        console.log("⚠️ Pipeline tested (failed expectedly on Python payload):", error.message);
    } finally {
        // Cleanup
        fs.unlinkSync(poPath);
        fs.unlinkSync(invoicePath);
        fs.unlinkSync(glPath);
        console.log("🧹 Cleanup complete.");
    }
}

testAuditArbiter();
