import { SOMArbiterV3 } from './arbiters/SOMArbiterV3.js';
import messageBroker from './core/MessageBroker.cjs';
import { CausalityArbiter } from './arbiters/CausalityArbiter.js';

async function runReflection() {
    console.log("--- SOMA Neural Diagnostic ---");

    // 1. Check Lobe Distribution
    console.log("1. Checking Lobes...");
    const lobes = ['COGNITIVE', 'EXECUTIVE', 'KNOWLEDGE', 'LIMBIC', 'EXTERNAL'];
    lobes.forEach(lobe => {
        const arbiters = messageBroker.getArbitersByLobe(lobe);
        console.log(`   - ${lobe}: ${arbiters.length} active organs`);
    });

    // 2. Scan Discovery
    console.log("2. Scanning Discovery (Overflow)...");
    const discovery = await messageBroker.scanForUnusedArbiters();
    console.log(`   - Found ${discovery.length} inactive arbiters on disk.`);

    // 3. Narrative Check
    console.log("3. Testing Stream of Consciousness...");
    const causality = new CausalityArbiter({ name: 'DiagCausality' });
    const brain = new SOMArbiterV3({
        name: 'SomaBrain-Diag',
        causalityArbiter: causality,
        messageBroker: messageBroker
    });

    // Mock a response to trigger reflection
    const dummyResponse = { text: "System is operational and ready for expansion." };
    const dummyQuery = "What is your current state?";
    
    console.log("   - Triggering internal reflection...");
    await brain._updateNarrative(dummyQuery, dummyResponse, {});

    console.log("\n--- Results ---");
    console.log("Current Internal Narrative:", brain.internalNarrative);
    
    if (brain.internalNarrative && brain.internalNarrative.length > 0) {
        console.log("\n✅ SUCCESS: SOMA is self-reflecting.");
    } else {
        console.log("\n⚠️  Narrative still empty (waiting for brain response).");
    }
}

runReflection().catch(e => console.error("Diagnostic Failed:", e.message));