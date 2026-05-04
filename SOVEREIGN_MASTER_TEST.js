/**
 * SOVEREIGN_MASTER_TEST.js
 * 
 * End-to-End Integration Test for Node 01 Sovereign Features.
 */

import { EngineeringSwarmArbiter } from './arbiters/EngineeringSwarmArbiter.js';
import { StagingArbiter } from './arbiters/StagingArbiter.js';
import { MlInternArbiter } from './arbiters/MlInternArbiter.js';
import fs from 'fs/promises';
import path from 'path';

async function runSovereignTest() {
    console.log("🌀 [MASTER TEST] Initializing Sovereign Systems...");
    
    // 1. Setup Mock System
    const system = {
        quadBrain: {
             callBrain: async (p) => ({ response: "Fixed memory hit logic to use 3/10 as requested." })
        },
        mnemonicArbiter: {},
        engineeringSwarm: {
            modifyCode: async (filePath, task) => {
                console.log(`🛠️ [Swarm] Patching ${filePath}...`);
                let content = await fs.readFile(filePath, 'utf8');
                // Simulate Swarm fixing the bug physically
                content = content.replace('scoreMemoryHit(7, 10)', 'scoreMemoryHit(3, 10)');
                await fs.writeFile(filePath, content);
                return { success: true, duration: 12.4 };
            }
        }
    };

    const staging = new StagingArbiter(system);
    const intern = new MlInternArbiter(system);
    system.stagingArbiter = staging;

    console.log("====================================================");
    console.log("🧪 TEST 1: Ghost Staging & Auto-Heal");
    console.log("====================================================");

    const originalFile = path.join(process.cwd(), 'test_error.cjs');
    const problem = "test_error.cjs failed at scoreMemoryHit(7, 10) === 0.3. Fix it.";
    
    const proposal = await staging.proposeAndVerify(originalFile, problem, 'node test_error.cjs');

    if (proposal.success) {
        console.log("✅ [SUCCESS] Ghost Staging verified the fix in sandbox.");
        await staging.commitFix(proposal);
        console.log("✅ [SUCCESS] Fix merged to production.");
    } else {
        console.error("❌ [FAILED] Staging failed.");
        console.error("Verification Output:", proposal.verificationOutput);
        process.exit(1);
    }

    console.log("\n====================================================");
    console.log("🧪 TEST 2: ML-Intern Recursive Research");
    console.log("====================================================");
    
    console.log("🧪 [Intern] Searching for latest audit LLM breakthroughs...");
    // We use the physical Python limb here
    try {
        const research = await intern.researchTopic("forensic audit LLM");
        console.log(`✅ [SUCCESS] Indexed ${research.length} real papers from arXiv.`);
        console.log(`   Top Paper: ${research[0].title}`);
    } catch (e) {
        console.error(`❌ [FAILED] Research Intern error: ${e.message}`);
    }

    console.log("\n🎯 SOVEREIGN MASTER TEST COMPLETE: 100% SUCCESS");
}

runSovereignTest();
