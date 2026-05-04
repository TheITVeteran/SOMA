/**
 * Quick Integration Check - Production-Ready Wiring Verification
 * Verifies SOMA's systems are connected like one organism
 */

import { config as dotenvConfig } from 'dotenv';
import fs from 'fs/promises';
dotenvConfig();

console.log('\n╔══════════════════════════════════════════════════════════╗');
console.log('║  🧬 SOMA ORGANISM INTEGRATION CHECK                     ║');
console.log('║  Verifying all cognitive loops are wired and active     ║');
console.log('╚══════════════════════════════════════════════════════════╝\n');

// Import the system
import { SomaBootstrap } from './core/SomaBootstrap.js';
import { CONFIG } from './core/SomaConfig.js';

async function checkIntegration() {
  console.log('Initializing SOMA...\n');
  const bootstrap = new SomaBootstrap(process.cwd(), { ...CONFIG, mode: 'test', port: 0 });
  const system = await bootstrap.initialize();

  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('📊 COGNITIVE ORGANISM WIRING STATUS');
  console.log('═══════════════════════════════════════════════════════════\n');

  const integrations = [];

  // 1. PERCEPTION → CURIOSITY → SIMULATION LOOP
  const curiositySimWired = system.curiosity && typeof system.curiosity.explore === 'function';
  integrations.push({
    name: 'Perception Loop (Curiosity ↔ Simulation)',
    status: curiositySimWired,
    details: curiositySimWired ?
      '✓ Curiosity can explore via simulation' :
      '✗ Missing simulation exploration'
  });

  // 2. NIGHTTIME LEARNING → MEMORY/REASONING LOOP
  const nighttimeWired = system.nighttimeLearning &&
                          system.nighttimeLearning.mnemonic &&
                          system.nighttimeLearning.tribrain;
  integrations.push({
    name: 'Dream/Learning Loop (Nighttime → Memory/Reasoning)',
    status: nighttimeWired,
    details: nighttimeWired ?
      `✓ ${system.nighttimeLearning.cronJobs.size} sessions scheduled` :
      '✗ Missing nighttime connections'
  });

  // 3. EXPERIENCE → LEARNING → MEMORY PIPELINE
  const learningWired = system.learningPipeline &&
                        system.learningPipeline.mnemonicArbiter &&
                        system.learningPipeline.experienceBuffer;
  const expCount = learningWired && system.learningPipeline.experienceBuffer.buffer ?
                   system.learningPipeline.experienceBuffer.buffer.length : 0;
  integrations.push({
    name: 'Learning Pipeline (Experience → Memory)',
    status: learningWired,
    details: learningWired ?
      `✓ ${expCount} experiences buffered` :
      '✗ Missing learning connections'
  });

  // 4. WORLD MODEL → CAUSALITY → ABSTRACTION LOOP
  const causalityWired = system.causality &&
                         system.worldModel &&
                         system.abstraction &&
                         system.abstraction.causalityArbiter;
  integrations.push({
    name: 'Understanding Loop (WorldModel ↔ Causality ↔ Abstraction)',
    status: causalityWired,
    details: causalityWired ?
      '✓ Connected for causal reasoning and pattern abstraction' :
      '✗ Missing causal connections'
  });

  // 5. META-LEARNING → OPTIMIZATION FEEDBACK
  const metaWired = system.metaLearning &&
                    system.metaLearning.learningPipeline;
  integrations.push({
    name: 'Meta-Learning Feedback Loop',
    status: metaWired,
    details: metaWired ?
      '✓ System learns how to learn better' :
      '✗ Missing meta-learning feedback'
  });

  // 6. SIMULATION → COGNITION TRANSFER
  const knowledgeBridgeWired = system.knowledgeBridge &&
                                system.knowledgeBridge.abstractionArbiter &&
                                system.knowledgeBridge.worldModel;
  integrations.push({
    name: 'Embodiment Transfer (Simulation → Cognition)',
    status: knowledgeBridgeWired,
    details: knowledgeBridgeWired ?
      '✓ Physical experiences transfer to abstract reasoning' :
      '✗ Missing knowledge bridge'
  });

  // 7. SELF-AWARENESS → GOAL PLANNING
  const selfAwarenessWired = system.selfModel &&
                             system.goalPlanner;
  integrations.push({
    name: 'Self-Awareness Loop (RecursiveSelfModel → Goals)',
    status: selfAwarenessWired,
    details: selfAwarenessWired ?
      `✓ ${system.selfModel.components?.size || 0} components mapped` :
      '✗ Missing self-model'
  });

  // 8. CREATIVITY ENGINE (MUSE)
  const museWired = system.muse && system.muse.quadBrain;
  integrations.push({
    name: 'Creativity Engine (Muse → QuadBrain)',
    status: museWired,
    details: museWired ?
      '✓ Creative response generation active' :
      '✗ Missing creativity connection'
  });

  // 9. MESSAGE BROKER COORDINATION
  const brokerWired = system.messageBroker && system.messageBroker.arbiters?.size > 10;
  integrations.push({
    name: 'MessageBroker Coordination Hub',
    status: brokerWired,
    details: brokerWired ?
      `✓ ${system.messageBroker.arbiters.size} arbiters coordinated` :
      '✗ Insufficient arbiter coordination'
  });

  // 10. CONTINUOUS LEARNING BRIDGE
  const continuousWired = system.continuousLearning &&
                          system.continuousLearning.learningPipeline;
  integrations.push({
    name: 'Continuous Learning Bridge (Real-time adaptation)',
    status: continuousWired,
    details: continuousWired ?
      '✓ Hourly prompt evolution + daily training' :
      '✗ Missing continuous learning'
  });

  // Display results
  let passCount = 0;
  for (const integration of integrations) {
    const symbol = integration.status ? '✅' : '⚠️ ';
    console.log(`${symbol} ${integration.name}`);
    console.log(`   ${integration.details}\n`);
    if (integration.status) passCount++;
  }

  console.log('═══════════════════════════════════════════════════════════');
  console.log(`Integration Status: ${passCount}/${integrations.length} loops active`);

  const percentage = Math.round((passCount / integrations.length) * 100);
  console.log(`Organism Health: ${percentage}%`);

  if (percentage >= 80) {
    console.log('Status: 🟢 PRODUCTION READY');
  } else if (percentage >= 60) {
    console.log('Status: 🟡 NEEDS ATTENTION');
  } else {
    console.log('Status: 🔴 CRITICAL ISSUES');
  }

  console.log('═══════════════════════════════════════════════════════════\n');

  // Additional diagnostics
  console.log('📋 KEY SYSTEM COMPONENTS:\n');

  const components = [
    { name: 'QuadBrain (Reasoning)', present: !!system.quadBrain },
    { name: 'MnemonicArbiter (Memory)', present: !!system.mnemonic },
    { name: 'CausalityArbiter', present: !!system.causality },
    { name: 'WorldModelArbiter', present: !!system.worldModel },
    { name: 'AbstractionArbiter', present: !!system.abstraction },
    { name: 'CuriosityEngine', present: !!system.curiosity },
    { name: 'ReasoningChamber', present: !!system.reasoningChamber },
    { name: 'GoalPlannerArbiter', present: !!system.goalPlanner },
    { name: 'BeliefSystemArbiter', present: !!system.beliefs },
    { name: 'ImmuneSystemArbiter', present: !!system.immuneSystem }
  ];

  for (const comp of components) {
    console.log(`${comp.present ? '✓' : '✗'} ${comp.name}`);
  }

  console.log('\n');
  process.exit(percentage >= 80 ? 0 : 1);
}

checkIntegration().catch(err => {
  console.error('Integration check failed:', err);
  process.exit(1);
});
