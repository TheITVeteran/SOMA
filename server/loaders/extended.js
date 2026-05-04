/**
 * server/loaders/extended.js
 *
 * PHASE 4.1: Extended Specialist Arbiters (Omega Protocol v2.1)
 * 
 * This is the Architectural Command Center for SOMA. 
 * It manages the discovery and dynamic integration of ~40+ specialist arbiters.
 * 
 * Organizes loading into dependency-aware phases, ensuring that 
 * sophisticated cross-system loops (Learning, Trading, Autonomy) are
 * fully wired and synchronized.
 */

import path from 'path';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const rootPath = process.cwd();

/**
 * PHASE 4.0: Essential ASI Core (Learning, Fragments, Personality)
 * This tier is light enough to load shortly after boot without killing the event loop.
 * These systems enable SOMA to learn from interactions and maintain her unique personality.
 */
export async function loadEssentialSystems(system) {
    console.log('\n[Essential] ═══ Loading ASI Core (Learning + Fragments) ═══');
    const ext = {};

    // ── Ensure ArbiterLoader is ready ──────────
    if (!system.arbiterLoader) {
        try {
            const { ArbiterLoader } = await import('../../core/ArbiterLoader.js');
            system.arbiterLoader = new ArbiterLoader({
                system,
                messageBroker: system.messageBroker,
            });
            await system.arbiterLoader.initialize();
        } catch (e) {
            console.error(`    ❌ Essential Tier: ArbiterLoader failed: ${e.message}`);
            return {};
        }
    }

    const essentialArbiters = [
        'OutcomeTracker.js',
        'ExperienceReplayBuffer.js',
        'QueryComplexityClassifier.js',
        'FragmentRegistry.js',
        'UniversalLearningPipeline.js',
        'CuriosityEngine.js',
        'ConversationCuriosityExtractor.js',
        'PersonalityForgeArbiter.js',
        'MoltbookArbiter.js',
        'ConversationHistoryArbiter.js',
        'TrainingDataExporter.js',
        'AdaptiveLearningPlanner.js',
        'HindsightReplayArbiter.js'
    ];

    const instances = await system.arbiterLoader.batchLoad(essentialArbiters);

    instances.forEach(inst => {
        if (!inst) return;
        const name = inst.name || inst.constructor.name;
        if (name === 'OutcomeTracker') ext.outcomeTracker = inst;
        else if (name === 'ExperienceReplayBuffer') ext.experienceReplay = inst;
        else if (name === 'QueryComplexityClassifier') ext.queryClassifier = inst;
        else if (name === 'FragmentRegistry') ext.fragmentRegistry = inst;
        else if (name === 'UniversalLearningPipeline') ext.learningPipeline = inst;
        else if (name === 'CuriosityEngine') ext.curiosityEngine = inst;
        else if (name === 'ConversationCuriosityExtractor') ext.curiosityExtractor = inst;
        else if (name === 'PersonalityForgeArbiter') ext.personalityForge = inst;
        else if (name === 'MoltbookArbiter') ext.moltbook = inst;
        else if (name === 'ConversationHistoryArbiter') ext.conversationHistory = inst;
        else if (name === 'TrainingDataExporter') ext.trainingDataExporter = inst;
        else if (name === 'AdaptiveLearningPlanner') ext.learningPlanner = inst;
        else if (name === 'HindsightReplayArbiter') ext.hindsightReplay = inst;
    });

    // ── Wire ASI Core Connections (Mirroring original logic) ──
    console.log('\n[Essential] Wiring ASI core connections...');

    if (ext.learningPipeline) {
        if (ext.outcomeTracker) ext.learningPipeline.outcomeTracker = ext.outcomeTracker;
        if (ext.experienceReplay) ext.learningPipeline.experienceReplay = ext.experienceReplay;
        if (system.mnemonicArbiter) ext.learningPipeline.mnemonicArbiter = system.mnemonicArbiter;
        system.learningPipeline = ext.learningPipeline;
        console.log('    🔗 Learning Pipeline → OutcomeTracker + ExperienceReplay + Memory');
    }

    if (ext.curiosityExtractor) {
        system.curiosityExtractor = ext.curiosityExtractor;
        console.log('    🔗 CuriosityExtractor → system');
    }

    if (ext.fragmentRegistry) {
        if (system.quadBrain) system.quadBrain.fragmentRegistry = ext.fragmentRegistry;
        if (ext.learningPipeline) ext.fragmentRegistry.learningPipeline = ext.learningPipeline;
        system.fragmentRegistry = ext.fragmentRegistry;
        console.log('    🔗 FragmentRegistry → QuadBrain + LearningPipeline');
    }

    if (ext.moltbook) { system.moltbook = ext.moltbook; }
    if (ext.personalityForge) { system.personalityForge = ext.personalityForge; }
    if (ext.conversationHistory) { system.conversationHistory = ext.conversationHistory; }

    if (ext.trainingDataExporter) {
        ext.trainingDataExporter.conversationHistory = ext.conversationHistory;
        ext.trainingDataExporter.personalityForge = ext.personalityForge;
        ext.trainingDataExporter.mnemonic = system.mnemonicArbiter;
        ext.trainingDataExporter.learningPipeline = ext.learningPipeline;
        console.log('    🔗 TrainingDataExporter ← ConversationHistory, Memory, LearningPipeline');
    }

    const loaded = Object.values(ext).filter(v => v !== null).length;
    const heapMB = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(0);
    console.log(`\n[Essential] ═══ ${loaded} ASI-core arbiters activated (heap: ${heapMB}MB) ═══\n`);

    return ext;
}

export async function loadExtendedSystems(system) {
    console.log('\n[Extended] ═══ Activating Remaining Specialist Arbiters ═══');
    const ext = {};

    // ── ArbiterLoader: The engine for autonomous self-expansion ──────────
    // Upgrades boot from static hardcoding to dynamic manifest materialization.
    try {
        const { ArbiterLoader } = await import('../../core/ArbiterLoader.js');
        ext.arbiterLoader = new ArbiterLoader({
            system,
            messageBroker: system.messageBroker,
        });
        await ext.arbiterLoader.initialize();
        system.arbiterLoader = ext.arbiterLoader;
        
        // 🔱 CNS INTEGRATION: Wire loader into MessageBroker for on-the-fly expansion
        if (system.messageBroker && typeof system.messageBroker.setArbiterLoader === 'function') {
            system.messageBroker.setArbiterLoader(ext.arbiterLoader);
        }
        console.log('    📚 ArbiterLoader ONLINE — unified inventory mapped, on-the-fly expansion enabled');
    } catch (e) {
        console.warn(`    ⚠️ ArbiterLoader failed to start: ${e.message}`);
    }

    // 🌐 BRAVE SEARCH: SOMA's Eyes for 2026 data
    try {
        const { BraveSearchAdapter } = require('../../cognitive/BraveSearchAdapter.cjs');
        ext.braveSearch = new BraveSearchAdapter({ maxResults: 5 });
        system.braveSearch = ext.braveSearch;
        if (system.quadBrain) system.quadBrain.braveSearch = ext.braveSearch;
        console.log('    ✅ BraveSearchAdapter (Live Web Access Ready)');
    } catch (e) {
        console.log(`    ⏭️ BraveSearchAdapter: ${e.message}`);
    }

    // 🔍 HYBRID SEARCH: Semantic vector search for the Storage tab
    if (process.env.SOMA_HYBRID_SEARCH === 'true') {
        try {
            const heapUsedMB = process.memoryUsage().heapUsed / 1024 / 1024;
            if (heapUsedMB > 500) {
                console.log(`    ⏭️ HybridSearchArbiter: skipped (heap ${heapUsedMB.toFixed(0)}MB > 500MB threshold)`);
            } else {
                const HybridSearchArbiter = require('../../arbiters/HybridSearchArbiter.cjs');
                const HybridSearchClass = HybridSearchArbiter.HybridSearchArbiter || HybridSearchArbiter.default || HybridSearchArbiter;
                const indexDir = path.join(rootPath, '.soma', 'search_index');
                ext.hybridSearch = new HybridSearchClass({ indexDir, useWorker: false });
                if (typeof ext.hybridSearch.initialize === 'function') {
                    await ext.hybridSearch.initialize();
                }
                system.hybridSearch = ext.hybridSearch;
                console.log(`    ✅ HybridSearchArbiter (Storage tab ONLINE, heap: ${heapUsedMB.toFixed(0)}MB)`);
            }
        } catch (e) {
            console.warn(`    ⚠️ HybridSearchArbiter failed to load: ${e.message}`);
        }
    }

    // ═══════════════════════════════════════════
    // PHASE D: Trading Pipeline (Dynamic Loading)
    // ═══════════════════════════════════════════
    if (process.env.SOMA_LOAD_TRADING === 'true') {
        console.log('\n[Phase D] Trading Pipeline (Dynamic)...');
        const tradingArbiters = [
            'MultiTimeframeAnalyzer.js',
            'AdversarialDebate.js',
            'TradeLearningEngine.js',
            'BacktestEngine.js',
            'SmartOrderRouter.js',
            'AdaptivePositionSizer.js',
            'StrategyOptimizer.js',
            'RedditSignalDetector.js'
        ];

        const instances = await ext.arbiterLoader.batchLoad(tradingArbiters);
        
        instances.forEach(inst => {
            if (!inst) return;
            const name = inst.name || inst.constructor.name;
            if (name === 'MultiTimeframeAnalyzer') ext.mtfAnalyzer = inst;
            else if (name === 'TradeLearningEngine') ext.tradeLearning = inst;
            else if (name === 'BacktestEngine') ext.backtestEngine = inst;
            else if (name === 'SmartOrderRouter') ext.smartOrderRouter = inst;
            else if (name === 'AdaptivePositionSizer') ext.positionSizer = inst;
            else if (name === 'StrategyOptimizer') ext.strategyOptimizer = inst;
            else if (name === 'RedditSignalDetector') ext.redditSignals = inst;
            else if (name === 'AdversarialDebate') ext.adversarialDebate = inst;
        });

        // 🔗 LATE-WIRE TRADING GLOBALS
        if (global.SOMA_TRADING) {
            if (ext.mtfAnalyzer) global.SOMA_TRADING.mtfAnalyzer = ext.mtfAnalyzer;
            if (ext.tradeLearning) global.SOMA_TRADING.tradeLearning = ext.tradeLearning;
            if (ext.backtestEngine) global.SOMA_TRADING.backtestEngine = ext.backtestEngine;
            if (ext.smartOrderRouter) global.SOMA_TRADING.smartOrderRouter = ext.smartOrderRouter;
            console.log('    🔗 Trading Global State Synchronized');
        }
    }

    // ═══════════════════════════════════════════
    // PHASE B/C: Cognitive Specialists (Dynamic Loading)
    // ═══════════════════════════════════════════
    if (process.env.SOMA_LOAD_HEAVY === 'true') {
        console.log('\n[Phase B/C] Cognitive Specialists (Dynamic)...');
        const cognitiveArbiters = [
            'ReasoningChamber.js',
            'DevilsAdvocateArbiter.js',
            'ForecasterArbiter.js',
            'SentimentAggregator.js',
            'GistArbiter.js',
            'CodeObservationArbiter.js',
            'HippocampusArbiter.js',
            'MetaCortexArbiter.js',
            'AbstractionArbiter.js',
            'KnowledgeAugmentedGenerator.js'
        ];

        const instances = await ext.arbiterLoader.batchLoad(cognitiveArbiters);

        instances.forEach(inst => {
            if (!inst) return;
            const name = inst.name || inst.constructor.name;
            if (name === 'ReasoningChamber') ext.reasoning = inst;
            else if (name === 'DevilsAdvocateArbiter') ext.devilsAdvocate = inst;
            else if (name === 'ForecasterArbiter') ext.forecaster = inst;
            else if (name === 'SentimentAggregator') ext.sentimentAggregator = inst;
            else if (name === 'GistArbiter') ext.gistArbiter = inst;
            else if (name === 'CodeObservationArbiter') ext.codeObserver = inst;
            else if (name === 'HippocampusArbiter') ext.hippocampus = inst;
            else if (name === 'MetaCortexArbiter') ext.metaCortex = inst;
            else if (name === 'AbstractionArbiter') ext.abstractionArbiter = inst;
            else if (name === 'KnowledgeAugmentedGenerator') ext.knowledgeGenerator = inst;
        });

        // 🔗 WIRE COGNITIVE LOOPS
        if (system.quadBrain) {
            if (ext.reasoning) system.quadBrain.reasoning = ext.reasoning;
            if (ext.forecaster) system.quadBrain.forecaster = ext.forecaster;
            if (ext.codeObserver) system.quadBrain.codeObserver = ext.codeObserver;
            console.log('    🔗 QuadBrain ↔ Cognitive Specialist Loop Active');
        }
    }

    // ═══════════════════════════════════════════
    // PHASE E/F: Learning & Research (Dynamic Loading)
    // ═══════════════════════════════════════════
    console.log('\n[Phase E/F] Learning & Research (Dynamic)...');
    const researchArbiters = [
        'UniversalLearningPipeline.js',
        'CuriosityEngine.js',
        'AdaptiveLearningPlanner.js',
        'HindsightReplayArbiter.js',
        'SelfImprovementCoordinator.js',
        'FragmentCommunicationHub.js',
        'IdeaCaptureArbiter.js',
        'ConversationCuriosityExtractor.js',
        'DiscoveryGradeMedicalCortex.js',
        'DreamArbiter.cjs'
    ];

    const researchInstances = await ext.arbiterLoader.batchLoad(researchArbiters);

    researchInstances.forEach(inst => {
        if (!inst) return;
        const name = inst.name || inst.constructor.name;
        if (name === 'UniversalLearningPipeline') ext.learningPipeline = inst;
        else if (name === 'CuriosityEngine') ext.curiosityEngine = inst;
        else if (name === 'AdaptiveLearningPlanner') ext.learningPlanner = inst;
        else if (name === 'HindsightReplayArbiter') ext.hindsightReplay = inst;
        else if (name === 'SelfImprovementCoordinator') ext.selfImprovement = inst;
        else if (name === 'FragmentCommunicationHub') ext.fragmentComms = inst;
        else if (name === 'IdeaCaptureArbiter') ext.ideaCapture = inst;
        else if (name === 'ConversationCuriosityExtractor') ext.curiosityExtractor = inst;
        else if (name === 'DiscoveryGradeMedicalCortex') ext.medicalDiscovery = inst;
        else if (name === 'DreamArbiter') { ext.dreamArbiter = inst; system.dreamArbiter = inst; }
    });

    // 🔗 WIRE LEARNING & RESEARCH
    if (ext.learningPipeline) {
        system.learningPipeline = ext.learningPipeline;
        if (system.mnemonicArbiter) ext.learningPipeline.mnemonicArbiter = system.mnemonicArbiter;
        console.log('    🔗 Universal Learning Pipeline PHYSICALLY ANCHORED');
    }
    if (ext.curiosityEngine) {
        system.curiosityEngine = ext.curiosityEngine;
        if (system.quadBrain) system.quadBrain.curiosityEngine = ext.curiosityEngine;
    }
    if (ext.fragmentComms && system.fragmentRegistry) {
        if (system.quadBrain) system.quadBrain.fragmentComms = ext.fragmentComms;
        console.log('    🔗 Fragment Registry ↔ Communication Hub ↔ QuadBrain');
    }

    // ═══════════════════════════════════════════
    // PHASE G/I: Identity & Autonomy (Dynamic Loading)
    // ═══════════════════════════════════════════
    console.log('\n[Phase G/I] Identity & Autonomy (Dynamic)...');
    const autonomyArbiters = [
        'PersonalityForgeArbiter.js',
        'MoltbookArbiter.js',
        'UserProfileArbiter.js',
        'ContextManagerArbiter.js',
        'SocialAutonomyArbiter.js',
        'RecursiveSelfModel.js',
        'AutonomousCapabilityExpansion.js',
        'MetaLearningEngine.js',
        'ProactiveCouncilArbiter.js',
        'DiagnosticCortexArbiter.js',
        'CronaArbiter.js',
        'TheoryOfMindArbiter.cjs',
        'SelfModificationArbiter.cjs',
        'ProactivePerceptionArbiter.js'
    ];

    const autonomyInstances = await ext.arbiterLoader.batchLoad(autonomyArbiters);

    autonomyInstances.forEach(inst => {
        if (!inst) return;
        const name = inst.name || inst.constructor.name;
        if (name === 'PersonalityForgeArbiter') ext.personalityForge = inst;
        else if (name === 'MoltbookArbiter') ext.moltbook = inst;
        else if (name === 'UserProfileArbiter') ext.userProfile = inst;
        else if (name === 'ContextManagerArbiter') ext.contextManager = inst;
        else if (name === 'SocialAutonomyArbiter') ext.socialAutonomy = inst;
        else if (name === 'RecursiveSelfModel') ext.recursiveSelfModel = inst;
        else if (name === 'AutonomousCapabilityExpansion') ext.autonomousExpansion = inst;
        else if (name === 'MetaLearningEngine') ext.metaLearning = inst;
        else if (name === 'ProactiveCouncilArbiter') ext.proactiveCouncil = inst;
        else if (name === 'DiagnosticCortexArbiter') ext.diagnosticCortex = inst;
        else if (name === 'CronaArbiter') { ext.crona = inst; system.crona = inst; system.cronaArbiter = inst; }
        else if (name === 'TheoryOfMindArbiter') { ext.tom = inst; system.tom = inst; system.theoryOfMind = inst; }
        else if (name === 'SelfModificationArbiter') { ext.selfMod = inst; system.selfModificationArbiter = inst; }
        else if (name === 'ProactivePerceptionArbiter') { ext.perception = inst; system.perceptionArbiter = inst; system.proactivePerception = inst; }
        else if (name === 'BiotechArbiter') { ext.biotechArbiter = inst; system.biotechArbiter = inst; }
        else if (name === 'MlInternArbiter') { ext.mlIntern = inst; system.mlIntern = inst; }
    });

    // ── Simulation Evaluator — SOMA's strategy evolution engine ──────────────
    try {
        const { SimulationEvaluator } = await import('../scrapers/SimulationEvaluator.js');
        const evaluator = new SimulationEvaluator({ 
            messageBroker: system.messageBroker,
            knowledgeCurator: system.knowledgeCurator || null,
        });
        evaluator.start();
        system.simulationEvaluator = evaluator;
        console.log('    ✅ SimulationEvaluator online — strategy evolution engine running');
    } catch (e) {
        console.warn('    ⚠️ SimulationEvaluator failed to start:', e.message);
    }

    // 🔗 WIRE IDENTITY & AUTONOMY
    if (ext.personalityForge) system.personalityForge = ext.personalityForge;
    if (ext.moltbook) system.moltbook = ext.moltbook;
    if (ext.proactiveCouncil) {
        system.proactiveCouncil = ext.proactiveCouncil;
        await ext.proactiveCouncil.initialize?.();
        console.log('    🏛️  Proactive Council CONVENED');
    }
    if (ext.autonomousExpansion) {
        system.capabilityExpansion = ext.autonomousExpansion;
        ext.autonomousExpansion.startAutonomousScan?.(system, 20 * 60 * 1000);
    }

    // ── KEVIN: Security Chief (Dynamic Wire) ──
    if (system.kevinArbiter) {
        const kevin = system.kevinArbiter;
        if (ext.reasoning) kevin.reasoning = ext.reasoning;
        if (ext.ideaCapture) kevin.ideaCapture = ext.ideaCapture;
        if (ext.learningPipeline) kevin.learningPipeline = ext.learningPipeline;
        console.log('    🔗 KEVIN Security Chief ← Memory, Reasoning, Research');
    }

    // ── STEVE (ExecutiveCortex): High-Level Wiring ──
    const steve = system.steveArbiter || system.executiveCortex;
    if (steve) {
        if (ext.codeObserver) steve.codeObserver = ext.codeObserver;
        if (ext.learningPipeline) steve.learningPipeline = ext.learningPipeline;
        if (ext.ideaCapture) steve.ideaCapture = ext.ideaCapture;
        if (system.engineeringSwarm) steve.swarm = system.engineeringSwarm;
        console.log('    🔗 STEVE Executive ← Full Specialist Ecosystem');
    }

    // ── NEMESIS: Chat quality gate ──
    try {
        const { NemesisArbiter } = await import('../../arbiters/NemesisArbiter.js');
        system.nemesis = new NemesisArbiter({ quadBrain: system.quadBrain, system });
        console.log('    ⚔️  NEMESIS quality gate ARMED');
    } catch (e) {
        console.warn(`    ⚠️ NEMESIS skipped: ${e.message}`);
    }

    // ── Ethereal Memory: third memory tier (soft concept biases) ──
    try {
        const { EtherealMemoryArbiter } = await import('../../arbiters/EtherealMemoryArbiter.js');
        const ethereal = new EtherealMemoryArbiter({
            thoughtNetwork: system.thoughtNetwork,
            bufferPath: path.join(rootPath, '.soma', 'ethereal_buffer.json')
        });
        await ethereal.initialize();
        system.etherealMemory = ethereal;
        console.log('    🌙 Ethereal Memory layer ONLINE (dream pass active)');
    } catch (e) {
        console.warn(`    ⚠️ EtherealMemory skipped: ${e.message}`);
    }

    // ── ASI Intelligence Loop (Recursive Core) ──
    try {
        const { ASIKernel } = await import('../../core/ASIKernel.js');
        const asi = new ASIKernel({ system });
        await asi.initialize();
        system.asiKernel = asi;
        console.log('    🧠 ASI Intelligence Loop ONLINE');
    } catch (e) {
        console.warn(`    ⚠️ ASI Loop skipped: ${e.message}`);
    }

    const loaded = Object.values(ext).filter(v => v !== null).length;
    const total = Object.keys(ext).length;
    const heapMB = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(0);
    console.log(`\n[Extended] ═══ ${loaded} specialist arbiters activated (heap: ${heapMB}MB) ═══\n`);

    return ext;
}

// ═══════════════════════════════════════════
// AUTOPILOT CONTROLLER
// ═══════════════════════════════════════════

export function toggleAutopilot(enabled, system) {
    const results = { goals: false, rhythms: false, social: false, heartbeat: false };

    // AutonomousHeartbeat (The Pulse)
    if (system.autonomousHeartbeat) {
        if (enabled) { system.autonomousHeartbeat.start(); }
        else { system.autonomousHeartbeat.stop(); }
        results.heartbeat = system.autonomousHeartbeat.isRunning;
    }

    // GoalPlannerArbiter
    if (system.goalPlanner) {
        if (enabled) { system.goalPlanner.resumeAutonomous?.(); }
        else { system.goalPlanner.pauseAutonomous?.(); }
        results.goals = system.goalPlanner.isAutonomousActive?.() ?? enabled;
    }

    // TimekeeperArbiter
    if (system.timekeeper) {
        if (enabled) { system.timekeeper.resumeAutonomousRhythms?.(); }
        else { system.timekeeper.pauseAutonomousRhythms?.(); }
        results.rhythms = system.timekeeper.isAutonomousActive?.() ?? enabled;
    }

    // SocialAutonomyArbiter
    if (system.socialAutonomy) {
        if (enabled) { system.socialAutonomy.activate?.(); }
        else { system.socialAutonomy.deactivate?.(); }
        results.social = system.socialAutonomy.isActive ?? enabled;
    }

    console.log(`[Autopilot] ${enabled ? '▶️  ENABLED' : '⏸️  PAUSED'} — Heartbeat: ${results.heartbeat}, Goals: ${results.goals}, Rhythms: ${results.rhythms}, Social: ${results.social}`);
    return { enabled, components: results };
}

export function getAutopilotStatus(system) {
    return {
        enabled: system.autonomousHeartbeat?.isRunning ?? false,
        components: {
            heartbeat: system.autonomousHeartbeat?.isRunning ?? false,
            heartbeatStats: system.autonomousHeartbeat?.stats ?? null,
            goals: system.goalPlanner?.isAutonomousActive?.() ?? false,
            rhythms: system.timekeeper?.isAutonomousActive?.() ?? false,
            social: system.socialAutonomy?.isActive ?? false
        }
    };
}
