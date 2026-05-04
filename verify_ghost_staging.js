/**
 * verify_ghost_staging.js
 * 
 * Physical verification of the Ghost Staging vision.
 * 1. Takes a broken file.
 * 2. Isolates it to a sandbox.
 * 3. Patches the sandbox version.
 * 4. Verifies the sandbox version.
 * 5. Commits to real SOMA.
 */

import fs from 'fs/promises';
import path from 'path';
import { exec } from 'child_process';

async function runTest() {
    const originalFile = path.join(process.cwd(), 'test_error.cjs');
    const stagingDir = path.join(process.cwd(), '.soma', 'staging');
    const stagedFile = path.join(stagingDir, 'test_error.cjs');

    console.log("🌀 [VERIFY] Starting Ghost Staging Stress Test...");

    // 1. ISOLATION
    console.log("🌀 [VERIFY] Phase 1: Isolation...");
    await fs.mkdir(stagingDir, { recursive: true });
    await fs.copyFile(originalFile, stagedFile);
    console.log(`   ✅ File isolated to: ${stagedFile}`);

    // 2. SIMULATED PATCH (Manual for this test to show the transition)
    console.log("🌀 [VERIFY] Phase 2: Simulated Swarm Patch (Fixing the copy)...");
    let content = await fs.readFile(stagedFile, 'utf8');
    // Fixing the bug I introduced earlier
    content = content.replace('scoreMemoryHit(7, 10)', 'scoreMemoryHit(3, 10)');
    await fs.writeFile(stagedFile, content);
    console.log("   ✅ Patch applied to staged copy.");

    // 3. VERIFICATION (Run test against the STAGED file)
    console.log("🌀 [VERIFY] Phase 3: Sandbox Verification...");
    return new Promise((resolve) => {
        // We run the STAGED file to see if it passes
        exec(`node ${stagedFile}`, async (error, stdout, stderr) => {
            const output = stdout + stderr;
            if (!error && !output.toLowerCase().includes('fail')) {
                console.log("   ✅ Sandbox verification PASSED. Fix is safe.");
                
                // 4. COMMIT
                console.log("🌀 [VERIFY] Phase 4: Atomic Commit (Overwriting production)...");
                await fs.copyFile(stagedFile, originalFile);
                await fs.unlink(stagedFile);
                console.log("   ✅ Production file physically updated.");
                console.log("\n🎯 GHOST STAGING VERIFIED. SOMA is surgical.");
                resolve(true);
            } else {
                console.error("   ❌ Sandbox verification FAILED. Production file preserved.");
                console.error(output);
                resolve(false);
            }
        });
    });
}

runTest();
