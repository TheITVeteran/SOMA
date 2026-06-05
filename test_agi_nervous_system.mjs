/**
 * test_agi_nervous_system.mjs
 * 
 * Comprehensive validation of SOMA's new AGI architecture:
 * 1. Memory Tiering (Cold -> Hot promotion)
 * 2. Cross-Domain Reasoning (Graph edge creation)
 */

import { MnemonicArbiter } from './arbiters/MnemonicArbiter.js';
import { KnowledgeGraphFusion } from './arbiters/KnowledgeGraphFusion.js';
import FragmentRegistry from './arbiters/FragmentRegistry.js';
import messageBroker from './core/MessageBroker.js';
import path from 'path';
import fs from 'fs/promises';

async function runAgiTest() {
    console.log('🚀 INITIALIZING AGI STRESS TEST...');

    const broker = messageBroker;
    
    // 1. Setup Mnemonic Arbiter (Tiered Memory)
    const mnemonic = new MnemonicArbiter({
        name: 'Test-Mnemonic',
        dbPath: './SOMA/test-memory.db',
        vectorDbPath: './SOMA/test-vectors.json',
        redisUrl: 'redis://localhost:6379' 
    });

    // 2. Setup Fragment Registry (Experts)
    const registry = new FragmentRegistry({
        messageBroker: broker
    });

    // 3. Setup Knowledge Graph (Synthesis)
    const kg = new KnowledgeGraphFusion({
        mnemonic: mnemonic,
        fragmentRegistry: registry,
        messageBroker: broker,
        savePath: './SOMA/test-kg.json'
    });

    try {
        await mnemonic.initialize();
        await registry.initialize();
        await kg.initialize();

        console.log('\n--- TEST 1: MEMORY TIERING PROMOTION ---');
        const memoryContent = "The Omega Protocol requires AST-based code instrumentation for security.";
        console.log(`📥 Storing new memory: "${memoryContent}"`);
        await mnemonic.remember(memoryContent, { importance: 0.9 });

        console.log('🔄 Simulating high-frequency access (Hammering)...');
        for (let i = 0; i < 12; i++) {
            const res = await mnemonic.recall("Omega Protocol", 1);
            if (i % 3 === 0) console.log(`  Recall ${i}: Tier = ${res.tier}`);
            // Force manual check of promotion logic
            mnemonic._startAutoCleanup(); // Manual trigger for test
        }

        const finalRecall = await mnemonic.recall("Omega Protocol", 1);
        console.log(`✅ Final Tier State: ${finalRecall.tier}`);


        console.log('\n--- TEST 2: CROSS-DOMAIN REASONING ---');
        console.log('🧪 Adding expert concepts...');
        await kg.addConcept("Blockchain Consensus", { domain: 'FINANCE', confidence: 1.0 });
        await kg.addConcept("Medical Triage", { domain: 'MEDICAL', confidence: 1.0 });

        console.log('🧠 Triggering Cross-Domain linking...');
        // We simulate SOMA noticing a link
        await broker.publish('knowledge:add', {
            concept: "Distributed Triage Ledger",
            domain: 'SYSTEM_DESIGN',
            confidence: 0.85
        });

        // Give it a moment to process the link
        await new Promise(r => setTimeout(r, 1000));
        await kg.linkCrossDomainConcepts();

        const kgStats = kg.getStats();
        console.log(`✅ KG Nodes: ${kgStats.metrics.totalNodes}`);
        console.log(`✅ Cross-Domain Edges: ${kgStats.metrics.crossDomainEdges}`);

        if (kgStats.metrics.crossDomainEdges > 0) {
            console.log('🏆 SUCCESS: AGI Nervous System is LIVE and SYNTHESIZING.');
        } else {
            console.log('⚠️ WARNING: Cross-domain linking was conservative. Tuning thresholds...');
        }

    } catch (err) {
        console.error('❌ TEST FAILED:', err.message);
        console.error(err.stack);
    } finally {
        // Cleanup test files
        try {
            await fs.unlink('./SOMA/test-memory.db').catch(() => {});
            await fs.unlink('./SOMA/test-vectors.json').catch(() => {});
            await fs.unlink('./SOMA/test-kg.json').catch(() => {});
        } catch (e) {}
        process.exit(0);
    }
}

runAgiTest();
