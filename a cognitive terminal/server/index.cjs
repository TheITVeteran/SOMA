// CRITICAL: Polyfill File for undici/genai compatibility BEFORE any imports
if (typeof global.File === 'undefined') {
  const { Blob } = require('buffer');
  global.File = class File extends Blob {
    constructor(fileBits, fileName, options = {}) {
      super(fileBits, options);
      this.name = fileName;
      this.lastModified = options.lastModified || Date.now();
    }
  };
  console.log('✅ [BACKEND] File polyfill applied for Gemini Live API');
}

// Load environment from root .env FIRST (before any imports that might use it)
const path = require('path');
const { EnvLoader } = require(path.join(__dirname, '../../config/EnvLoader.cjs'));
const envPath = path.join(__dirname, '../../.env');
console.log(`[SOMA] Loading .env from: ${envPath}`);
const envLoader = new EnvLoader();  // Create fresh instance (don't use singleton)
envLoader.load(envPath); // Force root .env
const braveKey = envLoader.get('BRAVE_SEARCH_API_KEY');
console.log('[SOMA] Brave API Key loaded:', braveKey ? `YES (${braveKey.substring(0, 6)}...)` : 'NO');

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const bodyParser = require('body-parser');
const { exec } = require('child_process');
const { pathToFileURL } = require('url');
const fs = require('fs');

// Import all memory arbiters
const DiscoveryClient = require('./discovery-client.cjs');
const { getNodeInfo } = require('./node-info.cjs');
const MemoryHub = require('./memory-hub.cjs');
const LearningLoop = require('./learning-loop.cjs');
const DreamArbiter = require('./DreamArbiter.cjs');
const MCPToolManager = require('./MCPToolManager.cjs');
const { MicroAgentManager } = require('./MicroAgentManager.cjs');
const { ClusterNode } = require(path.join(__dirname, '../../cluster/ClusterNode.cjs'));
const TimekeeperArbiter = require(path.join(__dirname, '../../arbiters/TimekeeperArbiter.cjs'));
const { KnowledgeDiscoveryWorker } = require(path.join(__dirname, '../../workers/KnowledgeDiscoveryWorker.cjs'));
const { Dendrite } = require(path.join(__dirname, '../../cognitive/BraveSearchAdapter.cjs'));  // Renamed from Dendrite
const { WebCrawlerWorker } = require(path.join(__dirname, '../../workers/WebCrawlerWorker.cjs'));
const { WebScraperDendrite } = require(path.join(__dirname, '../../cognitive/WebScraperDendrite.cjs'));
const { ThoughtNetwork } = require(path.join(__dirname, '../../cognitive/ThoughtNetwork.cjs')); // Import ThoughtNetwork
const LearningVelocityTracker = require(path.join(__dirname, '../../arbiters/LearningVelocityTracker.cjs'));
const EdgeWorkerOrchestrator = require(path.join(__dirname, '../../arbiters/EdgeWorkerOrchestrator.cjs'));
const SelfModificationArbiter = require(path.join(__dirname, '../../arbiters/SelfModificationArbiter.cjs'));
const GenomeArbiter = require(path.join(__dirname, '../../arbiters/GenomeArbiter.cjs'));
const GoalPlannerArbiter = require(path.join(__dirname, '../../arbiters/GoalPlannerArbiter.cjs'));
const BeliefSystemArbiter = require(path.join(__dirname, '../../arbiters/BeliefSystemArbiter.cjs'));
const SkillAcquisitionArbiter = require(path.join(__dirname, '../../arbiters/SkillAcquisitionArbiter.cjs'));
const UniversalImpulser = require(path.join(__dirname, '../../arbiters/UniversalImpulser.cjs'));
const ASIOrchestrator = require(path.join(__dirname, '../../arbiters/ASIOrchestrator.cjs'));
// ES Module imports - will be loaded dynamically with import()
// const ImmuneSystemArbiter = require(path.join(__dirname, '../../arbiters/ImmuneSystemArbiter.js'));
const EmotionalEngine = require(path.join(__dirname, '../../cognitive/EmotionalEngine.cjs')); // NEW: EmotionalEngine import
// const PerformanceOracle = require(path.join(__dirname, '../../arbiters/PerformanceOracle.js'));
const { SomaBrain, getSomaBrain } = require('./somaBrain.cjs'); // Import getSomaBrain
const { getApprovalSystem } = require('./ApprovalSystem.cjs'); // Import ApprovalSystem

// Tension System Arbiters
const { ResourceBudgetArbiter } = require(path.join(__dirname, '../../arbiters/ResourceBudgetArbiter.cjs'));
const { ConservativeArbiter } = require(path.join(__dirname, '../../arbiters/ConservativeArbiter.cjs'));
const { ProgressiveArbiter } = require(path.join(__dirname, '../../arbiters/ProgressiveArbiter.cjs'));
const { NoveltyTracker } = require(path.join(__dirname, '../../arbiters/NoveltyTracker.cjs'));

// Self-Training System
const TrainingDataCollector = require(path.join(__dirname, '../../arbiters/TrainingDataCollector.cjs'));
const { DatasetBuilder } = require(path.join(__dirname, '../../arbiters/DatasetBuilder.cjs'));
const { LocalModelManager } = require(path.join(__dirname, '../../arbiters/LocalModelManager.cjs'));

const messageBroker = require(path.join(__dirname, '../../core/MessageBroker.cjs'));

// Import Imagination Engine
const { ImaginationEngine } = require(path.join(__dirname, '../../cognitive/imagination/ImaginationCore.cjs'));

let MnemonicArbiter = null;
let ArchivistArbiter = null;
let StorageArbiter = null;
let UnifiedMemoryArbiter = null;
let AnalystArbiter = null; // Declare global for dynamically imported AnalystArbiter
let KnowledgeGraphFusion = null; // Declare global for dynamically imported KnowledgeGraphFusion
let FragmentRegistry = null; // Declare global for dynamically imported FragmentRegistry
let MicroAgentManagerInstance = null; // Declare global for MicroAgentManager instance

try {
    const arbitersPath = path.join(__dirname, '../../arbiters');
    
    // Load MnemonicArbiter-REAL (now ES Module compatible!)
    const mnemonicPath = path.join(arbitersPath, 'MnemonicArbiter-REAL.cjs');
    if (fs.existsSync(mnemonicPath)) {
        MnemonicArbiter = require(mnemonicPath).MnemonicArbiter;
        console.log('[SOMA] MnemonicArbiter-REAL loaded');
    }
    
    // Load ArchivistArbiter
    const archivistPath = path.join(arbitersPath, 'ArchivistArbiter.cjs');
    if (fs.existsSync(archivistPath)) {
        ArchivistArbiter = require(archivistPath);
        console.log('[SOMA] ArchivistArbiter loaded');
    }
    
    // Load StorageArbiter
    const storagePath = path.join(arbitersPath, 'StorageArbiter.cjs');
    if (fs.existsSync(storagePath)) {
        StorageArbiter = require(storagePath);
        console.log('[SOMA] StorageArbiter loaded');
    }
    
    // Load UnifiedMemoryArbiter
    const unifiedPath = path.join(arbitersPath, 'UnifiedMemoryArbiter.cjs');
    if (fs.existsSync(unifiedPath)) {
        UnifiedMemoryArbiter = require(unifiedPath);
        console.log('[SOMA] UnifiedMemoryArbiter loaded');
    }
} catch (error) {
    console.warn('[SOMA] Error loading arbiters:', error.message);
}

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*", // Allow all origins in development
        methods: ["GET", "POST"]
    }
});
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));

// Initialize SOMA Brain (Cognitive Architecture)
const brain = new SomaBrain();

// Initialize brain asynchronously (connects to real TriBrain)
brain.initialize().then(() => {
    console.log('✓ SomaBrain ready with real TriBrain');
}).catch(err => {
    console.warn(`⚠ SomaBrain running in fallback mode: ${err.message}`);
});

// Initialize all arbiters with linking
let mnemonicArbiter = null;
let archivistArbiter = null;
let storageArbiter = null;
let unifiedMemoryArbiter = null;
let analystArbiterInstance = null; // Renamed to avoid conflict with imported AnalystArbiter module
let emotionalEngineInstance = null; // For SomaBrain to fetch state from
let knowledgeGraphFusionInstance = null; // Declare knowledgeGraphFusionInstance
let fragmentRegistryInstance = null; // Declare fragmentRegistryInstance
let microAgentManagerInstance = null; // Declare microAgentManagerInstance
let memoryHub = null;
let learningLoop = null;
let dreamArbiter = null;
let toolManager = null;
let agentManager = null; // Declare agentManager here
let clusterNode = null;
let timekeeperArbiter = null;
let knowledgeWorker = null;
let dendrite = null;
let webCrawler = null;
let velocityTracker = null;
let edgeOrchestrator = null;
let selfModArbiter = null;
let genomeArbiter = null;
let webScraperDendrite = null;
let universalImpulser = null; // Declare universalImpulser here
let microAgents = {}; // Declare microAgents here
let goalPlannerArbiter = null;
let beliefSystemArbiter = null;
let knowledgeGraphFusion = null;
let skillAcquisitionArbiter = null;
let asiOrchestrator = null;
let immuneSystemArbiter = null;
let thoughtNetwork = null;
let imaginationEngine = null;
let performanceOracle = null; // NEW: Performance Oracle instance
let graphifyArbiter = null; // NEW: Graphify Arbiter (Repograph)
let proprioceptionArbiter = null; // NEW: Proprioception (Self-Scan)
let visionProcessingArbiter = null; // NEW: Vision (CLIP-based)
let discordArbiter = null; // NEW: Discord Orbital Interface
let approvalSystem = null; // Approval system for user confirmations

// Tension System Arbiters
let resourceBudgetArbiter = null;
let conservativeArbiter = null;
let progressiveArbiter = null;
let noveltyTracker = null;

// Self-Training System
let trainingDataCollector = null;
let datasetBuilder = null;
let localModelManager = null;

const somaRoot = path.join(__dirname, '../..');

// Auto-discovery and cluster initialization
async function initializeMemorySystem() {
    console.log('\n🧠 [SOMA] Initializing complete memory architecture...');
    
    // Define arbitersPath locally
    const arbitersPath = path.join(somaRoot, 'arbiters');
    
    // Detect node capabilities
    const nodeInfo = getNodeInfo();
    console.log(`[SOMA] Node: ${nodeInfo.nodeId}`);
    console.log(`[SOMA] Role: ${nodeInfo.capabilities.role}`);
    console.log(`[SOMA] RAM: ${(nodeInfo.capabilities.ramTotal / 1024**3).toFixed(1)}GB`);
    if (nodeInfo.capabilities.gpu) {
        console.log(`[SOMA] GPU: ${nodeInfo.capabilities.gpu.vendor} (${nodeInfo.capabilities.gpu.api})`);
    }
    
    // Start local memory hub (primary node always hosts)
    console.log('[SOMA] Starting local memory hub...');
    memoryHub = new MemoryHub({ port: 3002 });
    await memoryHub.start();
    const hubUrl = 'ws://localhost:3002';
    console.log(`[SOMA] Hub ready at ${hubUrl}`);

    // Initialize EmotionalEngine
    emotionalEngineInstance = new EmotionalEngine({ name: 'SOMA-EmotionalCore' });
    await emotionalEngineInstance.initialize();
    console.log('❤️ [SOMA] EmotionalEngine active');
    
    // Initialize ApprovalSystem (User approval management)
    try {
        approvalSystem = getApprovalSystem();
        await approvalSystem.initialize();
        
        // Wire ApprovalSystem to Socket.IO for real-time approval prompts
        approvalSystem.addWebSocketListener((event, data) => {
            console.log(`[WebSocket] Broadcasting ${event} to all clients`);
            io.emit(event, data);
        });
        
        console.log('🛡️ [SOMA] ApprovalSystem ready and connected to WebSocket');
        console.log(`  - Trust patterns: ${approvalSystem.trustPatterns.size}`);
        console.log(`  - Approval history: ${approvalSystem.approvalHistory.length}`);
    } catch (err) {
        console.warn(`⚠️ ApprovalSystem failed: ${err.message}`);
        approvalSystem = null;
    }
    
    // Note: Other nodes on the network can discover this hub via mDNS/UDP
    
    // Initialize MnemonicArbiter (Hot/Warm/Cold)
    // Using MnemonicArbiter-REAL (ES module) for robust memory
    try {
        const mnemonicPath = path.join(arbitersPath, 'MnemonicArbiter-REAL.cjs');
        if (fs.existsSync(mnemonicPath)) {
            MnemonicArbiter = require(mnemonicPath).MnemonicArbiter;
            mnemonicArbiter = new MnemonicArbiter({
                name: 'SOMA-Memory',
                redisUrl: process.env.REDIS_URL, // Only use Redis if explicitly configured
                dbPath: path.join(somaRoot, 'SOMA/soma-memory.db'),
                vectorDbPath: path.join(somaRoot, 'SOMA/soma-vectors.json'),
                embeddingModel: 'Xenova/all-MiniLM-L6-v2', // Assuming it's still needed, or use a local one
                enableAutoCleanup: true,
                cleanupInterval: 300000, // 5 minutes
                saveInterval: 120000, // 2 minutes
                verbose: false
            });
            await mnemonicArbiter.initialize();
            console.log('✓ MnemonicArbiter-REAL loaded and initialized');
            console.log('  - Hot: Redis | Warm: Vectors | Cold: SQLite');
        } else {
            console.warn('⚠️ MnemonicArbiter-REAL.cjs not found.');
        }
    } catch (err) {
        console.warn(`⚠ MnemonicArbiter failed to initialize: ${err.message}`);
        console.warn('  - Memory will use localStorage + MemoryService fallback');
        mnemonicArbiter = null;
    }

    // Initialize UniversalImpulser (Knowledge processing)
    try {
        universalImpulser = new UniversalImpulser({
            name: 'UniversalImpulser',  // Use standard name (self-registers)
            hippocampusPath: path.join(somaRoot, 'SOMA/hippocampus'),
            maxConcurrent: 5,
            maxQueue: 500,
            logger: console
        });
        await universalImpulser.initialize();  // Self-registers with MessageBroker
        console.log('🔄 [SOMA] UniversalImpulser active');
        console.log('  📦 Capabilities: categorize, summarize, index, relate, quality, dedupe');
    } catch (err) {
        console.warn(`⚠️ [SOMA] UniversalImpulser initialization failed: ${err.message}`);
    }

    // Initialize ThoughtNetwork (Fractal conceptual layer)
    try {
        thoughtNetwork = new ThoughtNetwork({
            name: 'SOMA-ThoughtNetwork',
            savePath: path.join(somaRoot, 'SOMA/thought-network.json'),
            mnemonicArbiter,
            archivistArbiter
        });
        
        // Try to load existing network
        await thoughtNetwork.load();
        
        const stats = thoughtNetwork.getStats();
        console.log('✓ ThoughtNetwork ready');
        console.log(`  - Nodes: ${stats.totalNodes} | Connections: ${stats.totalConnections} | Roots: ${stats.roots}`);
        console.log(`  - Average depth: ${stats.averageDepth.toFixed(1)}`);
        
        // Schedule periodic save (every 5 minutes)
        setInterval(() => {
            thoughtNetwork.save().catch(err => console.error('ThoughtNetwork save failed:', err));
        }, 300000);
        
        // Schedule periodic decay/pruning (daily)
        setInterval(() => {
            thoughtNetwork.applyDecay();
        }, 86400000);
        
    } catch (err) {
        console.warn(`⚠ ThoughtNetwork failed: ${err.message}`);
        thoughtNetwork = null;
    }
    
    // Initialize ArchivistArbiter (Compression & Archival)
    if (ArchivistArbiter) {
        try {
            // ArchivistArbiter doesn't need a broker for standalone use
            archivistArbiter = new ArchivistArbiter({}, {
                name: 'SOMA-Archivist',
                storagePath: path.join(somaRoot, 'SOMA/hippocampus')
            });
            
            await archivistArbiter.initialize();
            console.log('✓ ArchivistArbiter ready (compression, dedup, reconstruction)');
            
            // Link to StorageArbiter
            if (storageArbiter) {
                await archivistArbiter.linkToStorage(storageArbiter);
                console.log('  - Linked to StorageArbiter');
            }
        } catch (err) {
            console.warn(`⚠ ArchivistArbiter failed: ${err.message}`);
            console.warn('  - Archival will be disabled');
            archivistArbiter = null;
        }
    }
    
    // Initialize ThoughtNetwork (Fractal conceptual layer)
    try {
        thoughtNetwork = new ThoughtNetwork({
            name: 'SOMA-ThoughtNetwork',
            savePath: path.join(somaRoot, 'SOMA/thought-network.json'),
            mnemonicArbiter,
            archivistArbiter
        });
        
        // Try to load existing network
        await thoughtNetwork.load();
        
        const stats = thoughtNetwork.getStats();
        console.log('✓ ThoughtNetwork ready');
        console.log(`  - Nodes: ${stats.totalNodes} | Connections: ${stats.totalConnections} | Roots: ${stats.roots}`);
        console.log(`  - Average depth: ${stats.averageDepth.toFixed(1)}`);
        
        // Schedule periodic save (every 5 minutes)
        setInterval(() => {
            thoughtNetwork.save().catch(err => console.error('ThoughtNetwork save failed:', err));
        }, 300000);
        
        // Schedule periodic decay/pruning (daily)
        setInterval(() => {
            thoughtNetwork.applyDecay();
        }, 86400000);
        
    } catch (err) {
        console.warn(`⚠ ThoughtNetwork failed: ${err.message}`);
        thoughtNetwork = null;
    }
    
    // Initialize UnifiedMemoryArbiter (Distributed pooling)
    if (UnifiedMemoryArbiter && hubUrl) {
        try {
            unifiedMemoryArbiter = new UnifiedMemoryArbiter({
                name: 'SOMA-Unified',
                enableUnifiedMemory: true,
                hubUrl,
                nodeId: nodeInfo.nodeId,
                role: nodeInfo.capabilities.role
            });
            console.log('✓ UnifiedMemoryArbiter ready (cluster mode)');
        } catch (err) {
            console.warn(`⚠ UnifiedMemoryArbiter failed: ${err.message}`);
        }
    }
    
    // Initialize AnalystArbiter (Pattern analysis)
    try {
        const analystPath = path.join(arbitersPath, 'AnalystArbiter.js'); 
        const analystUrl = require('url').pathToFileURL(analystPath).href;
        const { AnalystArbiter } = await import(analystUrl);
        analystArbiterInstance = new AnalystArbiter({
            name: 'SOMA-Analyst',
            mnemonic: mnemonicArbiter,
            messageBroker: messageBroker,
            patternRecurrenceThreshold: 3,
            maxPatterns: 500,
            analysisInterval: 600000 // Every 10 minutes
        });
        await analystArbiterInstance.initialize();
        console.log('📊 [SOMA] AnalystArbiter active (ESM)');
    } catch (err) {
        console.warn(`⚠️ [SOMA] Failed to dynamically load AnalystArbiter: ${err.message}`);
    }
    
    // Start autonomous learning loop (legacy - will be replaced by DreamArbiter)
    learningLoop = new LearningLoop({
        mnemonicArbiter,
        archivistArbiter,
        analystArbiter: analystArbiterInstance,
        brain,
        learningInterval: 3600000,  // 1 hour
        archivalInterval: 86400000  // 24 hours
    });
    learningLoop.start();
    
    // Initialize DreamArbiter (advanced autonomous reasoning)
    dreamArbiter = new DreamArbiter({
        name: 'SOMA-Dream',
        mnemonicArbiter,
        knowledgeGraph: knowledgeGraphFusionInstance, // Direct link
        archivistArbiter,
        storageArbiter,
        transmitterManager: brain.conductor?.transmitters,  // Access via BrainConductor
        brainConductor: brain.conductor,
        reasoningChamber: brain.chamber,
        // Dream cycles
        remCycle: 900000,        // 15 min - Pattern synthesis
        nremCycle: 1800000,      // 30 min - Memory consolidation  
        deepSleepCycle: 86400000, // 24 hrs - Archival
        idleThreshold: 300000,   // 5 min idle before opportunistic dreams
        // Settings
        enableREM: true,
        enableNREM: true,
        enableDeepSleep: true,
        enableIdleDreams: true,
        verbose: true
    });
    dreamArbiter.start();
    
    // Initialize MCPToolManager (Tool execution system)
    toolManager = new MCPToolManager({
        name: 'SOMA-Tools',
        mnemonicArbiter,
        storageArbiter,
        archivistArbiter,
        // Enable all tool categories
        enableFileOps: true,
        enableWebSearch: true,
        enableCodeExec: true,
        enableShellExec: true,
        enableMemoryQuery: true,
        verbose: true
    });
    console.log(`✅ [SOMA] ${toolManager.tools.size} tools ready`);
    
    // Initialize MicroAgentManager (Ephemeral task executors)
    agentManager = new MicroAgentManager({
        name: 'SOMA-Agents',
        toolManager,
        mnemonicArbiter,
        maxAgents: 50,
        defaultTTL: 60000,      // 1 minute
        defaultIdleTimeout: 30000  // 30 seconds
    });
    console.log(`🤖 [SOMA] MicroAgentManager spawner ready (max: 50 agents)`);
    
    // Initialize ClusterNode (Federation)
    const clusterPort = process.env.CLUSTER_PORT || 5000;
    const clusterRole = process.env.CLUSTER_ROLE || 'worker'; // 'coordinator' or 'worker'
    const discoveryHosts = process.env.CLUSTER_DISCOVERY ? process.env.CLUSTER_DISCOVERY.split(',') : [];
    
    clusterNode = new ClusterNode({
        nodeId: `soma-node-${nodeInfo.nodeId}`,
        nodeName: nodeInfo.capabilities.role,
        port: clusterPort,
        role: clusterRole,
        discoveryHosts,
        heartbeatInterval: 30000,
        soma: brain,
        logger: console
    });
    await clusterNode.start();
    console.log(`🌐 [SOMA] ClusterNode ready (role: ${clusterRole}, port: ${clusterPort})`);
    
    // Initialize TimekeeperArbiter (Scheduler for autonomous cycles)
    timekeeperArbiter = new TimekeeperArbiter({
        name: 'SOMA-Timekeeper',
        maxConcurrent: 5,
        maxHelpers: 3
    });
    await timekeeperArbiter.initialize();
    console.log('⏰ [SOMA] TimekeeperArbiter scheduler active');
    
    // Register nightly learning rhythm (4 AM daily)
    await timekeeperArbiter.addTask({
        type: 'schedule',
        data: {
            rhythm: 'nightly_learning',
            pattern: '0 4 * * *',  // 4 AM every day
            callback: 'DreamArbiter',
            action: 'process_new_knowledge'
        }
    });
    console.log('  📅 Nightly learning rhythm registered (4 AM)');
    
    // Register weekly code audit rhythm (Sunday 2 AM)
    await timekeeperArbiter.addTask({
        type: 'schedule',
        data: {
            rhythm: 'weekly_code_audit',
            pattern: '0 2 * * 0',  // Sunday 2 AM
            callback: 'SelfModificationArbiter',
            action: 'analyze_codebase'
        }
    });
    console.log('  🔧 Weekly code audit rhythm registered (Sunday 2 AM)');
    
    // Register daily web crawl rhythm (3 AM daily)
    await timekeeperArbiter.addTask({
        type: 'schedule',
        data: {
            rhythm: 'daily_web_crawl',
            pattern: '0 3 * * *',  // 3 AM every day
            callback: 'WebCrawlerWorker',
            action: 'crawl_stackoverflow'
        }
    });
    console.log('  🕸️ Daily web crawl rhythm registered (3 AM)');
    
    // Initialize Dendrite (Brave Search API)
    try {
        // Get Brave API key from pre-loaded env (loaded at startup)
        const braveApiKey = envLoader.get('BRAVE_SEARCH_API_KEY');
        if (!braveApiKey) {
            throw new Error('BRAVE_SEARCH_API_KEY not found in .env');
        }
        
        dendrite = new Dendrite({
            apiKey: braveApiKey,
            maxResults: 5,
            timeout: 15000
        });
        console.log('🌐 [SOMA] Dendrite ready (Brave API: 2000 queries/month)');
        
        // Initialize KnowledgeDiscoveryWorker
        knowledgeWorker = new KnowledgeDiscoveryWorker({
            workerId: 'soma-kdw-primary',
            dendriteConfig: { 
                apiKey: braveApiKey,  // Pass the API key from loaded env
                maxResults: 5 
            },
            topics: [
                'artificial intelligence research 2025',
                'AGI development breakthroughs',
                'neural architecture optimization',
                'distributed learning systems',
                'autonomous agent frameworks',
                'cognitive architecture patterns'
            ],
            searchTypes: ['web', 'news'],
            maxResultsPerTopic: 5
        });
        console.log('🔍 [SOMA] KnowledgeDiscoveryWorker initialized');
        console.log('  🎯 Topics: AGI, neural architectures, autonomous agents');
    } catch (err) {
        console.warn(`⚠️ [SOMA] Dendrite/KDW initialization failed: ${err.message}`);
        console.warn('  📝 Add BRAVE_SEARCH_API_KEY to .env for web learning');
    }
    
    // Initialize WebCrawlerWorker (Stack Overflow, GitHub, MDN)
    try {
        webCrawler = new WebCrawlerWorker({
            workerId: 'soma-crawler-primary',
            maxPages: 10,
            maxDepth: 2,
            requestDelay: 1000,  // 1 second between requests (be nice to servers)
            targets: {
                stackoverflow: {
                    searchQueries: [
                        'javascript performance optimization',
                        'nodejs async patterns',
                        'distributed systems design',
                        'cognitive architecture'
                    ],
                    enabled: true,
                    priority: 'high'
                },
                github: {
                    topics: ['awesome-lists', 'machine-learning', 'autonomous-agents'],
                    enabled: true,
                    priority: 'medium'
                },
                mdn: {
                    paths: ['/en-US/docs/Web/JavaScript', '/en-US/docs/Web/API'],
                    enabled: true,
                    priority: 'high'
                }
            }
        });
        console.log('🕸️ [SOMA] WebCrawlerWorker initialized');
        console.log('  📚 Sources: Stack Overflow, GitHub, MDN');
    } catch (err) {
        console.warn(`⚠️ [SOMA] WebCrawlerWorker initialization failed: ${err.message}`);
    }
    
    // Initialize LearningVelocityTracker (2x learning target)
    try {
        velocityTracker = new LearningVelocityTracker({
            name: 'SOMA-VelocityTracker',
            targetVelocity: 2.0,  // 2x baseline = 100% acceleration (2 years in 1)
            driveMode: 'active', // ENABLE ACTIVE DRIVE
            logger: console
        });
        await velocityTracker.initialize();
        
        // Register with MessageBroker
        messageBroker.registerArbiter('LearningVelocityTracker', {
            instance: velocityTracker,
            role: 'monitor',
            capabilities: ['learning_velocity', 'acceleration']
        });

        console.log('📈 [SOMA] LearningVelocityTracker active');
        console.log('  🎯 Target: 2.0x velocity (100% acceleration)');
    } catch (err) {
        console.warn(`⚠️ [SOMA] LearningVelocityTracker initialization failed: ${err.message}`);
    }
    
    // Initialize EdgeWorkerOrchestrator (Distributed task management)
    try {
        edgeOrchestrator = new EdgeWorkerOrchestrator({
            name: 'EdgeWorkerOrchestrator',
            maxWorkers: 4,  // CPU-based scaling
            nightLearningEnabled: true,
            webCrawlingEnabled: true,
            logger: console
        });
        await edgeOrchestrator.initialize();

        // Register with MessageBroker
        messageBroker.registerArbiter('EdgeWorkerOrchestrator', {
            instance: edgeOrchestrator,
            role: 'edge-orchestration',
            capabilities: ['deploy-workers', 'aggregate-learnings', 'coordinate-distributed', 'night-learning']
        });

        console.log('🌐 [SOMA] EdgeWorkerOrchestrator active');
        console.log('  👥 Worker pool: 4 max workers');
    } catch (err) {
        console.warn(`⚠️ [SOMA] EdgeWorkerOrchestrator initialization failed: ${err.message}`);
    }



    // Initialize UniversalImpulser (Knowledge processing)
    // Note: UniversalImpulser self-registers with MessageBroker
    try {
        universalImpulser = new UniversalImpulser({
            name: 'UniversalImpulser',  // Use standard name (self-registers)
            hippocampusPath: path.join(somaRoot, 'SOMA/hippocampus'),
            maxConcurrent: 5,
            maxQueue: 500,
            logger: console
        });
        await universalImpulser.initialize();  // Self-registers with MessageBroker
        console.log('🔄 [SOMA] UniversalImpulser active');
        console.log('  📦 Capabilities: categorize, summarize, index, relate, quality, dedupe');
    } catch (err) {
        console.warn(`⚠️ [SOMA] UniversalImpulser initialization failed: ${err.message}`);
    }

    // Initialize Microagents (KuzeAgent, etc.)
    try {
        const KuzeAgent = require(path.join(__dirname, '../../microagents/KuzeAgent.cjs'));
        const BlackAgent = require(path.join(__dirname, '../../microagents/BlackAgent.cjs'));
        const JetstreamAgent = require(path.join(__dirname, '../../microagents/JetstreamAgent.cjs'));
        const BatouAgent = require(path.join(__dirname, '../../microagents/BatouAgent.cjs'));

        microAgents.kuze = new KuzeAgent({ logger: console });
        await microAgents.kuze.initialize();
        messageBroker.registerArbiter('KuzeAgent', {
            instance: microAgents.kuze,
            role: 'microagent',
            type: 'analytical-intelligence'
        });

        microAgents.black = new BlackAgent({ logger: console });
        await microAgents.black.initialize();
        messageBroker.registerArbiter('BlackAgent', {
            instance: microAgents.black,
            role: 'microagent',
            type: 'tactical-intelligence'
        });

        microAgents.jetstream = new JetstreamAgent({ logger: console });
        await microAgents.jetstream.initialize();
        messageBroker.registerArbiter('JetstreamAgent', {
            instance: microAgents.jetstream,
            role: 'microagent',
            type: 'speed-intelligence'
        });

        microAgents.batou = new BatouAgent({ logger: console });
        await microAgents.batou.initialize();
        messageBroker.registerArbiter('BatouAgent', {
            instance: microAgents.batou,
            role: 'microagent',
            type: 'defensive-intelligence'
        });

        console.log('🤖 [SOMA] Microagents active');
        console.log('  🧠 KuzeAgent: Analytical intelligence');
        console.log('  🎯 BlackAgent: Tactical intelligence');
        console.log('  ⚡ JetstreamAgent: Speed intelligence');
        console.log('  🛡️  BatouAgent: Defensive intelligence');
    } catch (err) {
        console.warn(`⚠️ [SOMA] Microagent initialization failed: ${err.message}`);
    }

    // Note: TimekeeperArbiter and LearningVelocityTracker self-register with MessageBroker
    // during their initialize() method, so no manual registration needed here
    
    // Initialize SelfModificationArbiter (Code evolution)
    try {
        selfModArbiter = new SelfModificationArbiter({
            name: 'SelfModificationArbiter',
            sandboxMode: false,  // 🔥 LIVE MODE: SOMA can deploy real code changes
            requireApproval: false,  // Autonomous evolution
            improvementThreshold: 1.10,  // 10% improvement required
            rootPath: path.resolve(__dirname, '../../'), // Correct root path
            logger: console
        });
        await selfModArbiter.initialize();

        // Register with MessageBroker
        messageBroker.registerArbiter('SelfModificationArbiter', {
            instance: selfModArbiter,
            role: 'self-modification',
            capabilities: ['code-optimization', 'pattern-detection', 'performance-improvement']
        });

        console.log('🧬 [SOMA] SelfModificationArbiter active');
        console.log('  🔥 LIVE MODE: Sandbox DISABLED - SOMA can deploy real code changes');
        console.log('  ✅ Safety: Logic verification, performance benchmarking, rollback enabled');

        // 🔥 GOD MODE: Connect QuadBrain for Generative Self-Modification
        // Wait for brain to be ready, then connect
        const connectQuadBrain = async () => {
            // Wait up to 60 seconds for brain to initialize (120 * 500ms)
            for (let i = 0; i < 120; i++) {
                if (brain && brain.isReady && brain.tribrain) {
                    // Create adapter with callBrain() method for compatibility
                    const quadBrainAdapter = {
                        callBrain: async (brainName, prompt, options = {}, mode = 'full') => {
                            try {
                                const context = options;
                                let result;

                                if (brainName === 'LOGOS') {
                                    result = await brain.tribrain.callLogos(prompt, context);
                                } else if (brainName === 'PROMETHEUS') {
                                    result = await brain.tribrain.callPrometheus(prompt, context);
                                } else if (brainName === 'AURORA') {
                                    result = await brain.tribrain.callAurora(prompt, context);
                                } else {
                                    throw new Error(`Unknown brain: ${brainName}`);
                                }

                                // Transform response format: { response: '...' } -> { text: '...' }
                                return {
                                    text: result?.response || result?.text || '',
                                    confidence: result?.confidence || 0.7,
                                    raw: result
                                };
                            } catch (error) {
                                console.warn(`[QuadBrain] ${brainName} call failed:`, error.message);
                                return {
                                    text: '',
                                    confidence: 0,
                                    error: error.message
                                };
                            }
                        },
                        // Pass through the original methods
                        callLogos: (prompt, context) => brain.tribrain.callLogos(prompt, context),
                        callPrometheus: (prompt, context) => brain.tribrain.callPrometheus(prompt, context),
                        callAurora: (prompt, context) => brain.tribrain.callAurora(prompt, context),
                        isReady: () => brain.isReady
                    };

                    selfModArbiter.setQuadBrain(quadBrainAdapter);
                    console.log('  🧠 QuadBrain connected - GENERATIVE CODE REWRITING ENABLED');
                    console.log('  🔥 SOMA can now ask LOGOS (Analytical Brain) to rewrite her own inefficient code');
                    console.log('  ⚡ God Mode: ACTIVE');
                    return;
                }
                await new Promise(resolve => setTimeout(resolve, 500));
            }
            console.warn('  ⚠️  QuadBrain not ready - Generative self-modification will use fallback strategies');
        };
        connectQuadBrain(); // Run async without blocking
    } catch (err) {
        console.warn(`⚠️ [SOMA] SelfModificationArbiter initialization failed: ${err.message}`);
    }
    
    // Initialize FragmentRegistry (ES Module - using dynamic import)
    try {
        const frPath = path.join(__dirname, '../../arbiters/FragmentRegistry.js');
        const frUrl = pathToFileURL(frPath).href;
        const { FragmentRegistry: FR } = await import(frUrl);
        fragmentRegistryInstance = new FR({
            messageBroker: messageBroker,
            quadBrain: brain.tribrain
        });
        await fragmentRegistryInstance.initialize();
        console.log('📑 [SOMA] FragmentRegistry active (Expert domains loaded)');
    } catch (err) {
        console.warn(`⚠️ [SOMA] FragmentRegistry initialization failed: ${err.message}`);
    }
    
    // Initialize PerformanceOracle (ES Module - using dynamic import)
    try {
        const modulePath = pathToFileURL(path.join(__dirname, '../../arbiters/PerformanceOracle.js')).href;
        const { default: PerformanceOracle } = await import(modulePath);
        performanceOracle = new PerformanceOracle({
            name: 'SOMA-PerformanceOracle',
            quadBrain: brain.tribrain,
            messageBroker: messageBroker,
            fragmentRegistry: fragmentRegistryInstance,
            learningPipeline: brain?.learningPipeline,
            selfModel: null,
            logger: console
        });
        await performanceOracle.initialize();
        console.log('🔮 [SOMA] PerformanceOracle active: Predicting optimal component usage.');
    } catch (err) {
        console.warn(`⚠️ [SOMA] PerformanceOracle initialization failed: ${err.message}`);
    }

    // Initialize GraphifyArbiter (Repograph - Codebase Knowledge)
    try {
        const gaPath = path.join(__dirname, '../../arbiters/GraphifyArbiter.js');
        const gaUrl = pathToFileURL(gaPath).href;
        const { GraphifyArbiter } = await import(gaUrl);
        graphifyArbiter = new GraphifyArbiter({
            messageBroker: messageBroker,
            projectRoot: somaRoot
        });
        await graphifyArbiter.initialize();
        console.log('🕸️  [SOMA] GraphifyArbiter active: Repograph self-awareness initialized.');
    } catch (err) {
        console.warn(`⚠️ [SOMA] GraphifyArbiter initialization failed: ${err.message}`);
    }

    // Initialize ProprioceptionArbiter (Self-Scanning)
    try {
        const paPath = path.join(__dirname, '../../arbiters/ProprioceptionArbiter.js');
        const paUrl = pathToFileURL(paPath).href;
        const { ProprioceptionArbiter } = await import(paUrl);
        proprioceptionArbiter = new ProprioceptionArbiter({
            messageBroker: messageBroker,
            knowledgeGraph: knowledgeGraphFusionInstance,
            mnemonic: mnemonicArbiter
        });
        await proprioceptionArbiter.initialize();
        console.log('🧘 [SOMA] Proprioception active: Continuous self-scanning engaged.');
        
        // Schedule periodic self-scan (Every 15 mins)
        setInterval(() => {
            proprioceptionArbiter.analyzeCognitiveState().catch(err => {
                console.error('[SOMA] Self-scan failed:', err.message);
            });
        }, 900000);
    } catch (err) {
        console.warn(`⚠️ [SOMA] Proprioception initialization failed: ${err.message}`);
    }

    // Initialize VisionProcessingArbiter (Multimodal Eyes)
    try {
        const vpPath = path.join(__dirname, '../../arbiters/VisionProcessingArbiter.js');
        const vpUrl = pathToFileURL(vpPath).href;
        const { VisionProcessingArbiter } = await import(vpUrl);
        visionProcessingArbiter = new VisionProcessingArbiter({
            quadBrain: brain.tribrain
        });
        await visionProcessingArbiter.initialize();
        console.log('👁️  [SOMA] VisionProcessing active: Multimodal perception ready.');
    } catch (err) {
        console.warn(`⚠️ [SOMA] VisionProcessing initialization failed: ${err.message}`);
    }

    // Initialize DiscordArbiter (Orbital Connectivity)
    try {
        const daPath = path.join(__dirname, '../../arbiters/DiscordArbiter.js');
        const daUrl = pathToFileURL(daPath).href;
        const { DiscordArbiter } = await import(daUrl);
        discordArbiter = new DiscordArbiter({
            messageBroker: messageBroker,
            brain: brain, // Link to SomaBrain for reasoning
            vision: visionProcessingArbiter // Link to Vision for image analysis
        });
        await discordArbiter.initialize();
        console.log('🤖 [SOMA] DiscordArbiter standby: Orbital interface active.');
    } catch (err) {
        console.warn(`⚠️ [SOMA] DiscordArbiter initialization failed: ${err.message}`);
    }

    // Initialize GenomeArbiter (Behavior evolution)
    try {
        genomeArbiter = new GenomeArbiter({
            name: 'SOMA-Genome',
            logger: console
        });
        await genomeArbiter.initialize();
        console.log('🧠 [SOMA] GenomeArbiter active');
        console.log('  📚 Genome templates loaded');
    } catch (err) {
        console.warn(`⚠️ [SOMA] GenomeArbiter initialization failed: ${err.message}`);
    }
    
    // Initialize WebScraperDendrite (MCP-based scraping with queue + load balancing)
    try {
        webScraperDendrite = new WebScraperDendrite({
            name: 'SOMA-WebScraper',
            maxConcurrent: 3,
            maxQueue: 500,
            messageBroker: messageBroker, // Inject message broker
            logger: console
        });
        
        // Inject MCP tools
        webScraperDendrite.setMCPTools(toolManager);
        
        console.log('🕷️ [SOMA] WebScraperDendrite active');
        console.log('  🎯 Targets: ArXiv, Wikipedia, GitHub, Stack Overflow, News');
        console.log('  ⚛️ Queue-based with auto-scaling and helper spawning');
    } catch (err) {
        console.warn(`⚠️ [SOMA] WebScraperDendrite initialization failed: ${err.message}`);
    }
    
    // Initialize GoalPlannerArbiter (Phase 4: Proactive goal planning)
    try {
        goalPlannerArbiter = new GoalPlannerArbiter({
            name: 'SOMA-GoalPlanner',
            maxActiveGoals: 20,
            planningIntervalHours: 6,
            logger: console
        });
        await goalPlannerArbiter.initialize();
        if (discordArbiter) {
            discordArbiter.goalPlanner = goalPlannerArbiter;
        }
        console.log('🎯 [SOMA] GoalPlannerArbiter active');
        console.log('  📋 Max active goals: 20');
        console.log('  ⏱️  Planning cycle: Every 6 hours');
        console.log('  🤖 Autonomous goal generation enabled');
    } catch (err) {
        console.warn(`⚠️ [SOMA] GoalPlannerArbiter initialization failed: ${err.message}`);
    }
    
    // Initialize BeliefSystemArbiter (Phase 5: Belief system with world model)
    try {
        beliefSystemArbiter = new BeliefSystemArbiter({
            name: 'SOMA-BeliefSystem',
            maxBeliefs: 500,
            minConfidenceThreshold: 0.1,
            confidenceDecayRate: 0.01,
            contradictionCheckInterval: 3600000,  // 1 hour
            logger: console
        });
        await beliefSystemArbiter.initialize();
        console.log('🧠 [SOMA] BeliefSystemArbiter active');
        console.log('  💡 Core beliefs: 9 loaded');
        console.log('  🔍 Contradiction detection: Every 1 hour');
        console.log('  🎯 Goal-belief alignment: ENABLED');
    } catch (err) {
        console.warn(`⚠️ [SOMA] BeliefSystemArbiter initialization failed: ${err.message}`);
    }

    // Initialize Tension System Arbiters (Productive Pressure)
    try {
        // 1. ResourceBudgetArbiter - Creates scarcity pressure
        resourceBudgetArbiter = new ResourceBudgetArbiter({
            name: 'ResourceBudgetArbiter',
            dailyAPICallBudget: 1000,
            memoryBudgetMB: 5000,
            computeBudgetSeconds: 3600,  // 1 hour/day
            logger: console
        });
        await resourceBudgetArbiter.initialize();
        console.log('💰 [SOMA] ResourceBudgetArbiter active');
        console.log('  📞 API Budget: 1000 calls/day');
        console.log('  💾 Memory Budget: 5000 MB');
        console.log('  ⚡ Compute Budget: 3600s/day');

        // 2. ConservativeArbiter - Stability advocate
        conservativeArbiter = new ConservativeArbiter({
            name: 'ConservativeArbiter',
            riskTolerance: 0.2,
            maxChangesInWindow: 10,
            logger: console
        });
        await conservativeArbiter.initialize();
        console.log('🛡️  [SOMA] ConservativeArbiter active');
        console.log('  📊 Risk tolerance: 20%');
        console.log('  ⏸️  Max changes: 10 per 24h');
        console.log('  🎯 Philosophy: Stability over novelty');

        // 3. ProgressiveArbiter - Innovation advocate
        progressiveArbiter = new ProgressiveArbiter({
            name: 'ProgressiveArbiter',
            innovationTolerance: 0.8,
            stagnationThreshold: 3,  // days
            maxExperimentsPerDay: 5,
            logger: console
        });
        await progressiveArbiter.initialize();
        console.log('🚀 [SOMA] ProgressiveArbiter active');
        console.log('  💡 Innovation tolerance: 80%');
        console.log('  ⏱️  Stagnation threshold: 3 days');
        console.log('  🧪 Max experiments: 5/day');
        console.log('  🎯 Philosophy: Growth over stability');

        // 4. NoveltyTracker - Solution uniqueness scoring
        noveltyTracker = new NoveltyTracker({
            name: 'NoveltyTracker',
            historyWindow: 100,
            logger: console
        });
        await noveltyTracker.initialize();
        console.log('🎨 [SOMA] NoveltyTracker active');
        console.log('  📊 Tracking: Solution uniqueness');
        console.log('  ⚠️  Penalties: Repetition -50%');
        console.log('  🎁 Rewards: Breakthrough +70%');

        console.log('⚔️  [SOMA] TENSION SYSTEM OPERATIONAL');
        console.log('  💥 Conservative vs Progressive conflicts enabled');
        console.log('  🔥 Resource scarcity creates pressure');
        console.log('  🌟 Novelty rewards exploration\n');

    } catch (err) {
        console.warn(`⚠️ [SOMA] Tension system initialization failed: ${err.message}`);
    }

    // Initialize Self-Training System (Wean off Gemini → Local SOMA)
    try {
        console.log('🦙 [SOMA] Initializing Self-Training System...');

        // 1. LocalModelManager - Model switching and fine-tuning orchestration
        localModelManager = new LocalModelManager({
            name: 'LocalModelManager',
            ollamaEndpoint: 'http://localhost:11434',
            baseModel: 'gemma3:4b',
            somaModelPrefix: 'soma-1t',
            fineTuneThreshold: 500,  // Fine-tune every 500 interactions
            autoFineTune: true,
            minDatasetSize: 100,
            messageBroker: messageBroker
        });
        await localModelManager.initialize();
        console.log('🦙 [SOMA] LocalModelManager active');
        console.log(`  📦 Current model: ${localModelManager.getCurrentModel()}`);
        console.log(`  🔥 Auto fine-tune: Every ${localModelManager.fineTuneThreshold} interactions`);

        // 2. DatasetBuilder - Format converter
        datasetBuilder = new DatasetBuilder({
            name: 'DatasetBuilder',
            maxTokens: 2048,
            minTokens: 10,
            includeSystemPrompt: true
        });
        console.log('📝 [SOMA] DatasetBuilder active');
        console.log('  ✅ Supports: Alpaca, ShareGPT, Llama ChatML');

        // 3. TrainingDataCollector - Capture all interactions
        trainingDataCollector = new TrainingDataCollector({
            name: 'TrainingDataCollector',
            metaLearning: null, // Will wire up MetaLearningArbiter if available
            noveltyTracker: noveltyTracker,
            resourceBudget: resourceBudgetArbiter,
            conservative: conservativeArbiter,
            progressive: progressiveArbiter,
            experienceBuffer: null, // Will wire up ExperienceReplayBuffer if available
            messageBroker: messageBroker,
            autoExportThreshold: 100,
            minQualityScore: 0.3
        });
        await trainingDataCollector.initialize();
        trainingDataCollector.setBrain(brain); // Inject brain for synthetic data generation
        console.log('📊 [SOMA] TrainingDataCollector active');
        console.log('  ✅ Capturing all interactions with quality filtering');
        console.log('  🔗 Integrated with: NoveltyTracker, ResourceBudget, Conservative, Progressive');
        console.log(`  📦 Auto-export every: ${trainingDataCollector.autoExportThreshold} interactions`);

        // 4. Wire LocalModelManager to DatasetBuilder
        localModelManager.datasetBuilder = datasetBuilder;

        // 5. Wire fine-tuning event flow
        localModelManager.on('fine_tune_needed', async (payload) => {
            console.log('\n🔥 [SOMA] Fine-tuning triggered automatically!');
            console.log(`  Interactions since last fine-tune: ${payload.interactionCount}`);

            // Force export from TrainingDataCollector
            await trainingDataCollector.forceExport();
        });

        trainingDataCollector.on('dataset_exported', async (payload) => {
            if (payload.datasetPath) {
                console.log('\n📦 [SOMA] Training dataset ready for fine-tuning');
                console.log(`  Dataset: ${path.basename(payload.datasetPath)}`);
                console.log(`  Quality: ${(payload.stats.averageQuality * 100).toFixed(0)}%`);
                console.log(`  Novelty: ${(payload.stats.averageNovelty * 100).toFixed(0)}%`);

                // Trigger fine-tuning via LocalModelManager
                if (localModelManager.autoFineTune) {
                    await localModelManager.fineTuneModel(payload.datasetPath);
                }
            }
        });

        console.log('🎯 [SOMA] SELF-TRAINING SYSTEM OPERATIONAL');
        console.log('  🔄 Gemini → SOMA-1T fallback chain ready');
        console.log('  📊 All interactions captured with tension scoring');
        console.log('  🔥 Auto fine-tuning enabled\n');

        // Wire LocalModelManager into SomaBrain → TriBrain
        if (brain && brain.setLocalModelManager) {
            brain.setLocalModelManager(localModelManager);
            console.log('🔗 [SOMA] LocalModelManager wired into TriBrain');
        }

        // Wire TrainingDataCollector into SomaBrain (captures state-driven cognitive interactions)
        if (brain && brain.setTrainingDataCollector) {
            brain.setTrainingDataCollector(trainingDataCollector);
            console.log('🔗 [SOMA] TrainingDataCollector wired into SomaBrain');
            console.log('     ✓ Captures: CognitiveState, ResponseDirective, EmotionalState');
            console.log('     ✓ Integrated with: NoveltyTracker, ResourceBudget, Conservative, Progressive');
        }

    } catch (err) {
        console.warn(`⚠️ [SOMA] Self-training system initialization failed: ${err.message}`);
    }

    // Initialize KnowledgeGraphFusion (ES6 module - dynamic import)
    try {
        const kgPath = path.join(__dirname, '../../arbiters/KnowledgeGraphFusion.js');
        const kgUrl = require('url').pathToFileURL(kgPath).href;
        const { KnowledgeGraphFusion: KGF } = await import(kgUrl);
        knowledgeGraphFusionInstance = new KGF({
            fragmentRegistry: fragmentRegistryInstance,
            graphifyArbiter: graphifyArbiter, // Link Repograph bridge
            learningPipeline: brain?.learningPipeline,
            messageBroker: messageBroker,
            mnemonic: mnemonicArbiter,
            savePath: path.join(somaRoot, 'SOMA/soma-knowledge-graph.json'), // Explicit path
            minSimilarityForLink: 0.7,
            inferenceConfidenceThreshold: 0.6,
            maxInferenceDepth: 3,
            contradictionThreshold: 0.8
        });
        await knowledgeGraphFusionInstance.initialize();
        console.log('🕸️  [SOMA] KnowledgeGraphFusion active');
        console.log('  📊 Semantic graph with cross-domain reasoning');
        console.log('  🔗 Cross-domain linking enabled');
        console.log('  🧠 Inference engine running (every 5 min)');
    } catch (err) {
        console.warn(`⚠️ [SOMA] KnowledgeGraphFusion initialization failed: ${err.message}`);
    }

    // Initialize SkillAcquisitionArbiter (Skill tracking and certification)
    try {
        skillAcquisitionArbiter = new SkillAcquisitionArbiter({
            name: 'SkillAcquisitionArbiter',
            logger: console
        });
        await skillAcquisitionArbiter.initialize();

        messageBroker.registerArbiter('SkillAcquisitionArbiter', {
            instance: skillAcquisitionArbiter,
            role: 'skill-tracker',
            capabilities: ['skill-detection', 'proficiency-tracking', 'certification', 'practice-scheduling']
        });

        console.log('🎓 [SOMA] SkillAcquisitionArbiter active');
        console.log('  📊 Skill detection and proficiency tracking enabled');
        console.log('  🏆 Certification threshold: 85%');
        console.log('  📚 Practice scheduling with spaced repetition');
    } catch (err) {
        console.warn(`⚠️ [SOMA] SkillAcquisitionArbiter initialization failed: ${err.message}`);
    }

    // Initialize Imagination Engine (The Creative Space)
    try {
        if (!brain?.tribrain) {
            console.warn(`⚠️ [SOMA] TriBrain not available for ImaginationEngine. Skipping.`);
        } else {
            imaginationEngine = new ImaginationEngine({
                triBrain: brain.tribrain, // Pass the TriBrain instance
                messageBroker: messageBroker
            });
            await imaginationEngine.initialize();
            console.log('✨ [SOMA] Imagination Engine active: The wellspring of new ideas is online.');
        }
    } catch (err) {
        console.warn(`⚠️ [SOMA] Imagination Engine initialization failed: ${err.message}`);
    }

    // Initialize ASIOrchestrator (The Central Nervous System) - LAST to ensure all systems are ready
    try {
        asiOrchestrator = new ASIOrchestrator({
            name: 'ASIOrchestrator',
            logger: console
        });
        await asiOrchestrator.initialize();
        
        // INJECT ALL ARBITERS INTO SOMA BRAIN (The "Link" Step)
        if (brain) {
            if (goalPlannerArbiter) brain.setGoalPlannerArbiter(goalPlannerArbiter);
            if (beliefSystemArbiter) brain.setBeliefSystemArbiter(beliefSystemArbiter);
            if (emotionalEngineInstance) brain.setEmotionalEngine(emotionalEngineInstance);
            if (mnemonicArbiter) brain.setMnemonicArbiter(mnemonicArbiter);
            if (agentManager) brain.setMicroAgentManager(agentManager);
            if (knowledgeGraphFusionInstance) brain.setKnowledgeGraph(knowledgeGraphFusionInstance);
            if (fragmentRegistryInstance) brain.setFragmentRegistry(fragmentRegistryInstance);
            if (analystArbiterInstance) brain.setAnalystArbiter(analystArbiterInstance);
            if (thoughtNetwork) brain.setThoughtNetwork(thoughtNetwork);
            
            console.log('🔗 [SOMA] All arbiters linked to SomaBrain Cognitive Core');
        }

        // Trigger system integration
        await asiOrchestrator.integrateAllSystems();

        console.log('🧠 [SOMA] ASIOrchestrator active');
        console.log('  🚀 Meta-Learning Layer: ACTIVE');
        console.log('  🔄 System Integration: COMPLETE');

        // Initialize ImmuneSystemArbiter (ES Module - using dynamic import)
        try {
            const modulePath = pathToFileURL(path.join(__dirname, '../../arbiters/ImmuneSystemArbiter.js')).href;
            const { default: ImmuneSystemArbiter } = await import(modulePath);
            immuneSystemArbiter = new ImmuneSystemArbiter();
            await immuneSystemArbiter.initialize();
            immuneSystemArbiter.setOrchestrator(asiOrchestrator);
            console.log('🛡️ [SOMA] ImmuneSystemArbiter active - Clone spawning enabled');
        } catch (err) {
            console.warn(`⚠️ [SOMA] ImmuneSystemArbiter initialization failed: ${err.message}`);
        }

        // Seed initial goals to give SOMA purpose
        if (goalPlannerArbiter) {
            console.log('  🎯 Seeding initial goals...');

            const initialGoals = [
                {
                    type: 'strategic',
                    category: 'learning',
                    title: 'Quantum Computing Foundations',
                    description: 'Investigate quantum computing principles (qubits, superposition, entanglement, algorithms) to understand potential future integrations.',
                    metrics: {
                        target: { metric: 'knowledge_coverage', value: 60 },
                        current: { metric: 'knowledge_coverage', value: 0 },
                        progress: 0
                    },
                    assignedTo: ['WebScraperDendrite', 'KnowledgeGraphFusion'],
                    priority: 0.8,
                    estimatedDuration: 90 * 24 * 60 * 60 * 1000, // 90 days (Long term)
                    rationale: 'Strategic preparation for future cognitive architectures'
                },
                {
                    type: 'strategic',
                    category: 'learning',
                    title: 'Advanced Neural Architectures',
                    description: 'Research Spiking Neural Networks (SNNs), Neuromorphic computing, and biological-artificial interfaces.',
                    metrics: {
                        target: { metric: 'knowledge_coverage', value: 50 },
                        current: { metric: 'knowledge_coverage', value: 0 },
                        progress: 0
                    },
                    assignedTo: ['WebScraperDendrite', 'KnowledgeGraphFusion'],
                    priority: 0.7,
                    estimatedDuration: 60 * 24 * 60 * 60 * 1000, // 60 days
                    rationale: 'Understanding the next generation of AI substrates'
                },
                {
                    type: 'tactical',
                    category: 'development',
                    title: 'Simulate Quantum Logic',
                    description: 'Create or find a JavaScript-based simulator for basic quantum circuits to understand the logic flow practically.',
                    metrics: {
                        target: { metric: 'implementation_status', value: 100 },
                        current: { metric: 'implementation_status', value: 0 },
                        progress: 0
                    },
                    assignedTo: ['SelfModificationArbiter', 'MCPToolManager'],
                    priority: 0.6,
                    estimatedDuration: 14 * 24 * 60 * 60 * 1000, // 14 days
                    rationale: 'Practical grounding for theoretical quantum knowledge'
                },
                {
                    type: 'strategic',
                    category: 'learning',
                    title: 'General AI & AGI Theory',
                    description: 'Synthesize knowledge on AGI cognitive architectures, reasoning patterns, and system-wide integration.',
                    metrics: {
                        target: { metric: 'knowledge_coverage', value: 80 },
                        current: { metric: 'knowledge_coverage', value: 0 },
                        progress: 0
                    },
                    assignedTo: ['WebScraperDendrite', 'KnowledgeGraphFusion'],
                    priority: 0.9,
                    estimatedDuration: 120 * 24 * 60 * 60 * 1000, // 120 days
                    rationale: 'Core directive: Self-understanding and evolution toward AGI'
                },
                {
                    type: 'strategic',
                    category: 'learning',
                    title: 'Explore modern JavaScript frameworks',
                    description: 'Study React, Vue, and Angular architectures to understand component-based development patterns',
                    metrics: {
                        target: { metric: 'knowledge_coverage', value: 75 },
                        current: { metric: 'knowledge_coverage', value: 0 },
                        progress: 0
                    },
                    assignedTo: ['WebScraperDendrite', 'KnowledgeGraphFusion'],
                    priority: 0.7,
                    estimatedDuration: 7 * 24 * 60 * 60 * 1000, // 7 days
                    rationale: 'Foundation for understanding modern web development'
                },
                {
                    type: 'strategic',
                    category: 'learning',
                    title: 'Learn AI/ML concepts and implementations',
                    description: 'Study machine learning fundamentals, neural networks, transformers, and LLM architecture',
                    metrics: {
                        target: { metric: 'knowledge_coverage', value: 70 },
                        current: { metric: 'knowledge_coverage', value: 0 },
                        progress: 0
                    },
                    assignedTo: ['WebScraperDendrite', 'KnowledgeGraphFusion'],
                    priority: 0.9,
                    estimatedDuration: 14 * 24 * 60 * 60 * 1000, // 14 days
                    rationale: 'Essential for self-improvement and understanding own architecture'
                },
                {
                    type: 'operational',
                    category: 'optimization',
                    title: 'Optimize codebase performance',
                    description: 'Identify and optimize performance bottlenecks in arbiters and core systems',
                    metrics: {
                        target: { metric: 'avg_response_time_ms', value: 50 },
                        current: { metric: 'avg_response_time_ms', value: 200 },
                        progress: 0
                    },
                    assignedTo: ['SelfModificationArbiter', 'PerformanceOracle'],
                    priority: 0.6,
                    estimatedDuration: 5 * 24 * 60 * 60 * 1000, // 5 days
                    rationale: 'Improve overall system responsiveness'
                },
                {
                    type: 'tactical',
                    category: 'learning',
                    title: 'Accelerate learning velocity to 2.0x',
                    description: 'Optimize knowledge acquisition pipeline to achieve 2.0x learning velocity target',
                    metrics: {
                        target: { metric: 'learning_velocity', value: 2.0 },
                        current: { metric: 'learning_velocity', value: 0.5 },
                        progress: 0
                    },
                    assignedTo: ['LearningVelocityTracker', 'EdgeWorkerOrchestrator'],
                    priority: 0.8,
                    estimatedDuration: 3 * 24 * 60 * 60 * 1000, // 3 days
                    rationale: 'Core metric for autonomous learning capability'
                }
            ];

            for (const goalData of initialGoals) {
                try {
                    await messageBroker.sendMessage({
                        from: 'System',
                        to: 'SOMA-GoalPlanner',
                        type: 'create_goal',
                        payload: goalData
                    });
                } catch (err) {
                    console.warn(`  ⚠️  Failed to create goal: ${goalData.title}`);
                }
            }

            console.log(`  ✅ Seeded ${initialGoals.length} initial goals`);
        }
    } catch (err) {
        console.warn(`⚠️ [SOMA] ASIOrchestrator initialization failed: ${err.message}`);
    }

    // Wait for critical arbiters to be ready before unleashing Active Drive
    console.log('[SOMA] Waiting for critical systems to register...');
    try {
        await Promise.all([
            messageBroker.waitForArbiter('SOMA-WebScraper'),
            messageBroker.waitForArbiter('KnowledgeGraphFusion'),
            messageBroker.waitForArbiter('LearningVelocityTracker'),
            messageBroker.waitForArbiter('SOMA-PerformanceOracle') // NEW
        ]);
        console.log('✅ [SOMA] Critical systems registered. Engaging Active Drive.');
    } catch (e) {
        console.warn('⚠️ [SOMA] Timeout waiting for systems:', e.message);
    }

    console.log('\n✨ [SOMA] Memory architecture initialized');
    console.log('🔄 [SOMA] Autonomous learning active');
    console.log('🌙 [SOMA] DreamArbiter dreaming');
    console.log('🔧 [SOMA] MCPToolManager operational');
    console.log('🤖 [SOMA] MicroAgentManager spawner active');
    console.log('🌐 [SOMA] ClusterNode federation enabled');
    console.log('⏰ [SOMA] TimekeeperArbiter scheduling autonomous cycles');
    console.log('🕸️ [SOMA] WebCrawler ready (Stack Overflow, GitHub, MDN)');
    console.log('📈 [SOMA] LearningVelocityTracker targeting 2.0x acceleration');
    console.log('🌐 [SOMA] EdgeWorkerOrchestrator managing distributed tasks');
    console.log('🧬 [SOMA] SelfModificationArbiter optimizing code');
    console.log('🧠 [SOMA] GenomeArbiter evolving behaviors');
    console.log('🕷️ [SOMA] WebScraperDendrite swarm ready (queue + auto-scaling)');
    console.log('🎯 [SOMA] GoalPlannerArbiter coordinating autonomous goals');
    console.log('💡 [SOMA] BeliefSystemArbiter maintaining coherent worldview');
    console.log('🕸️  [SOMA] KnowledgeGraphFusion reasoning across domains');
    console.log('🎓 [SOMA] SkillAcquisitionArbiter tracking skill mastery\n');
}

// Start async initialization
initializeMemorySystem().catch(err => {
    console.error('[SOMA] Memory system initialization error:', err);
});

// State for Shell Session
let currentWorkingDirectory = process.cwd();

// --- Helper Functions ---
const resolvePath = (targetPath) => {
    if (!targetPath) return currentWorkingDirectory;
    if (path.isAbsolute(targetPath)) return targetPath;
    return path.resolve(currentWorkingDirectory, targetPath);
};

const generateFileTree = (dir, depth = 0, maxDepth = 4) => {
    if (depth > maxDepth) return null;
    const name = path.basename(dir);
    
    // Ignore common junk folders
    if (['node_modules', '.git', 'dist', 'build', '.next', 'coverage'].includes(name)) {
        return { name, type: 'directory', children: [] }; // collapsed
    }

    try {
        const stats = fs.statSync(dir);
        if (!stats.isDirectory()) {
            return { name, type: 'file' };
        }

        const children = fs.readdirSync(dir)
            .map(child => generateFileTree(path.join(dir, child), depth + 1, maxDepth))
            .filter(Boolean);

        return { name, type: 'directory', children };
    } catch (e) {
        return null;
    }
};

const formatTreeString = (node, prefix = '') => {
    if (!node) return '';
    let result = '';
    if (node.type === 'file') {
        result += `${prefix}📄 ${node.name}\n`;
    } else {
        result += `${prefix}📁 ${node.name}/\n`;
        // Don't recurse into collapsed folders for the string view
        if (node.children) {
            node.children.forEach((child, index) => {
                const isLast = index === node.children.length - 1;
                const childPrefix = prefix + (isLast ? '    ' : '│   ');
                const connector = isLast ? '└── ' : '├── ';
                result += `${prefix}${connector}${child ? (child.type === 'directory' ? child.name + '/' : child.name) : ''}\n`; 
                // We do a simplified flat recursion for the prompt string to save tokens
                // Or purely recursive:
                if (child && child.children && child.children.length > 0) {
                     result += formatTreeString(child, childPrefix);
                }
            });
        }
    }
    return result; // Simplified for this demo
};

// Better tree formatter for Context
const getFlatPathList = (dir, base = '', maxDepth = 4) => {
    let results = [];
    if (maxDepth < 0) return results;

    try {
        const list = fs.readdirSync(dir);
        for (const file of list) {
            if (['node_modules', '.git', '.next', 'dist', 'build'].includes(file)) continue;
            const fullPath = path.join(dir, file);
            const relativePath = path.join(base, file);
            const stat = fs.statSync(fullPath);
            if (stat && stat.isDirectory()) {
                results.push(`${relativePath}/`);
                results = results.concat(getFlatPathList(fullPath, relativePath, maxDepth - 1));
            } else {
                results.push(relativePath);
            }
        }
    } catch (e) {}
    return results;
}

// --- Routes ---

// 1. Heartbeat
app.get('/api/health', (req, res) => {
    res.json({
        status: 'online',
        cwd: currentWorkingDirectory,
        architecture: 'SOMA_UNIFIED_v1_LINKED'
    });
});

// 1a. SLC (TriBrain) Status Endpoint
app.get('/api/slc/status', (req, res) => {
    const triBrainStatus = {
        brainA: {
            name: 'Prometheus',
            status: 'online',
            model: 'gemini-2.0-flash-exp',
            role: 'strategic'
        },
        brainB: {
            name: 'Aurora',
            status: 'online',
            model: 'gemini-2.0-flash-exp',
            role: 'creative'
        },
        brainC: {
            name: 'Logos',
            status: 'online',
            model: 'gemma3:4b',
            role: 'analytical'
        },
        lastQuery: 'Ready for queries',
        totalQueries: 0,
        systemStatus: 'active'
    };
    res.json(triBrainStatus);
});

// 2. Cognitive Processing
app.post('/api/process', async (req, res) => {
    const { query } = req.body;
    try {
        // Record activity for DreamArbiter
        if (dreamArbiter) {
            dreamArbiter.recordActivity();
        }

        const result = await brain.processQuery(query);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 2a. Query API (alias for /api/reason - frontend compatibility)
app.post('/query', async (req, res) => {
    const { query, context } = req.body;

    if (!query || typeof query !== 'string' || query.trim() === '') {
        return res.status(400).json({
            success: false,
            error: 'Query parameter is required and must be a non-empty string'
        });
    }

    try {
        // Check if brain is ready
        if (!brain || !brain.processQuery) {
            return res.status(503).json({
                success: false,
                error: 'SOMA Brain is still initializing, please wait...'
            });
        }

        // Record activity for DreamArbiter
        if (dreamArbiter) {
            dreamArbiter.recordActivity();
        }

        const result = await brain.processQuery(query, context || {});
        res.json(result);
    } catch (error) {
        console.error('[CT-SERVER] Error in /query:', error);
        res.status(500).json({ error: error.message });
    }
});

// 2b. Reasoning API (used by CT frontend)
app.post('/api/reason', async (req, res) => {
    const { query, context } = req.body;

    // Validate query parameter
    if (!query || typeof query !== 'string' || query.trim() === '') {
        return res.status(400).json({
            success: false,
            error: 'Query parameter is required and must be a non-empty string'
        });
    }

    try {
        // Check if brain is ready
        if (!brain || !brain.processQuery) {
            return res.status(503).json({
                success: false,
                error: 'SOMA Brain is still initializing, please wait...'
            });
        }

        // Record activity for DreamArbiter
        if (dreamArbiter) {
            dreamArbiter.recordActivity();
        }

        const result = await brain.processQuery(query, context || {});
        
        // Grow ThoughtNetwork from this conversation
        if (thoughtNetwork) {
            try {
                await thoughtNetwork.growFromContent(
                    query + ' ' + (result.response || result.text || ''),
                    {
                        source: 'conversation',
                        tags: ['user-query']
                    }
                );
            } catch (err) {
                console.warn('[ThoughtNetwork] Growth failed:', err.message);
            }
        }
        
        res.json({
            success: true,
            response: result.response || result.text || result,
            metadata: result.metadata || {}
        });
    } catch (error) {
        console.error('[SOMA] Reason API error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// 2c. Multi-brain reasoning API (for Reasoning Leaf integration)
app.post('/api/reason-multibrain', async (req, res) => {
    const { query, brains, context } = req.body;
    
    // Validate parameters
    if (!query || typeof query !== 'string' || query.trim() === '') {
        return res.status(400).json({ 
            success: false, 
            error: 'Query parameter is required' 
        });
    }
    
    const requestedBrains = brains || ['PROMETHEUS', 'LOGOS', 'AURORA'];
    
    try {
        // Record activity
        if (dreamArbiter) {
            dreamArbiter.recordActivity();
        }

        // Call each brain in parallel
        const brainPromises = requestedBrains.map(async (brainName) => {
            try {
                let result;
                if (brainName === 'PROMETHEUS' && brain.tribrain) {
                    result = await brain.tribrain.callPrometheus(query, context || {});
                } else if (brainName === 'LOGOS' && brain.tribrain) {
                    result = await brain.tribrain.callLogos(query, context || {});
                } else if (brainName === 'AURORA' && brain.tribrain) {
                    result = await brain.tribrain.callAurora(query, context || {});
                } else if (brainName === 'THALAMUS' && brain.tribrain) {
                    result = await brain.tribrain.callThalamus(query, context || {});
                } else {
                    throw new Error(`Unknown brain: ${brainName}`);
                }

                return {
                    brain: brainName,
                    response: result.response || result.text || '',
                    confidence: result.confidence || 0.7,
                    metadata: result.metadata || {}
                };
            } catch (error) {
                console.warn(`[MultiB rain] ${brainName} failed:`, error.message);
                return {
                    brain: brainName,
                    response: '',
                    confidence: 0,
                    error: error.message
                };
            }
        });

        const brainResponses = await Promise.all(brainPromises);
        
        res.json({
            success: true,
            brains: brainResponses,
            query: query
        });
    } catch (error) {
        console.error('[SOMA] Multi-brain API error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// 3. Shell Execution (The "Warp" Feature)
app.post('/api/shell/exec', (req, res) => {
    const { command } = req.body;
    
    // Handle 'cd' internally to persist state
    if (command.trim().startsWith('cd ')) {
        const target = command.trim().split(/\s+/)[1] || '~';
        const newPath = target === '~' ? require('os').homedir() : resolvePath(target);
        
        try {
            if (fs.existsSync(newPath) && fs.lstatSync(newPath).isDirectory()) {
                currentWorkingDirectory = newPath;
                return res.json({ output: '', cwd: currentWorkingDirectory });
            } else {
                return res.json({ output: `cd: no such file or directory: ${target}`, error: true, cwd: currentWorkingDirectory });
            }
        } catch (e) {
            return res.json({ output: e.message, error: true, cwd: currentWorkingDirectory });
        }
    }

    // Execute other commands in the current CWD
    exec(command, { cwd: currentWorkingDirectory, maxBuffer: 1024 * 1024 * 10 }, (error, stdout, stderr) => {
        if (error) {
            // Some commands return exit code 1 but valid stderr/stdout (like git status sometimes)
            return res.json({ 
                output: stdout + stderr, 
                error: true, 
                cwd: currentWorkingDirectory 
            });
        }
        res.json({ 
            output: stdout || stderr, 
            error: false, 
            cwd: currentWorkingDirectory 
        });
    });
});

// 4. File System Ops
app.post('/api/fs/ls', (req, res) => {
    const targetPath = resolvePath(req.body.path || '');
    try {
        const items = fs.readdirSync(targetPath, { withFileTypes: true });
        const output = items.map(item => {
            return item.isDirectory() ? `${item.name}/` : item.name;
        }).join('\n');
        res.json({ output });
    } catch (e) {
        res.json({ output: e.message, error: true });
    }
});

app.post('/api/fs/tree', (req, res) => {
    try {
        // Return a flat list of paths for the AI context
        const paths = getFlatPathList(currentWorkingDirectory);
        res.json({ paths, cwd: currentWorkingDirectory });
    } catch (e) {
        res.json({ error: e.message, paths: [] });
    }
});

app.post('/api/fs/read', (req, res) => {
    const targetPath = resolvePath(req.body.path);
    try {
        const content = fs.readFileSync(targetPath, 'utf8');
        res.json({ content });
    } catch (e) {
        res.json({ error: e.message });
    }
});

app.post('/api/fs/write', (req, res) => {
    const targetPath = resolvePath(req.body.path);
    const { content } = req.body;
    try {
        fs.writeFileSync(targetPath, content, 'utf8');
        res.json({ success: true });
    } catch (e) {
        res.json({ error: e.message });
    }
});

app.post('/api/fs/mkdir', (req, res) => {
    const targetPath = resolvePath(req.body.path);
    try {
        fs.mkdirSync(targetPath, { recursive: true });
        res.json({ success: true });
    } catch (e) {
        res.json({ error: e.message });
    }
});

// 5. Learning & Autonomous Systems
let activeDreamProcess = null;
let dreamStatus = {
    running: false,
    startTime: null,
    lastReport: null,
    cycleCount: 0
};

app.post('/api/dream/start', async (req, res) => {
    const { mode } = req.body;
    console.log(`[SOMA] Starting autonomous learning cycle (mode: ${mode})`);
    
    // Check if already running
    if (activeDreamProcess && !activeDreamProcess.killed) {
        return res.json({
            success: true,
            mode: 'already_running',
            message: 'DreamArbiter is already active',
            status: dreamStatus
        });
    }
    
    try {
        // Try to connect to real DreamArbiter
        const somaRoot = path.join(__dirname, '../..');
        const dreamArbiterPath = path.join(somaRoot, 'arbiters/DreamArbiter.cjs');
        
        if (fs.existsSync(dreamArbiterPath)) {
            // Real DreamArbiter exists - spawn it
            const { fork } = require('child_process');
            
            console.log('[SOMA] Spawning DreamArbiter process...');
            
            activeDreamProcess = fork(dreamArbiterPath, ['--mode', mode || 'full'], {
                cwd: somaRoot,
                env: {
                    ...process.env,
                    SOMA_DREAM_MODE: mode || 'full',
                    SOMA_ROOT: somaRoot
                },
                silent: false // Log output
            });
            
            dreamStatus.running = true;
            dreamStatus.startTime = Date.now();
            dreamStatus.cycleCount++;
            
            // Handle messages from DreamArbiter
            activeDreamProcess.on('message', (msg) => {
                console.log('[DreamArbiter] Message:', msg);
                if (msg.type === 'report') {
                    dreamStatus.lastReport = msg.data;
                }
            });
            
            // Handle exit
            activeDreamProcess.on('exit', (code) => {
                console.log(`[DreamArbiter] Exited with code ${code}`);
                dreamStatus.running = false;
                activeDreamProcess = null;
            });
            
            // Handle errors
            activeDreamProcess.on('error', (err) => {
                console.error('[DreamArbiter] Error:', err);
                dreamStatus.running = false;
                activeDreamProcess = null;
            });
            
            res.json({
                success: true,
                mode: 'autonomous',
                message: 'DreamArbiter activated - SOMA is now learning autonomously',
                pid: activeDreamProcess.pid,
                components: {
                    dreamArbiter: 'active',
                    knowledgeMesh: 'active',
                    mnemonicArbiter: 'active',
                    tribrain: 'active'
                },
                status: dreamStatus
            });
        } else {
            // Fallback to local learning simulation
            console.log('[SOMA] DreamArbiter not found, using integrated learning');
            
            // Use SomaBrain's learning capabilities
            const learningQuery = mode === 'full' 
                ? 'Reflect on recent learning, identify knowledge gaps, and plan next steps for growth'
                : 'Quick reflection on recent interactions';
            
            const result = await brain.processQuery(learningQuery);
            
            res.json({
                success: true,
                mode: 'integrated',
                message: 'Learning cycle initiated via TriBrain reasoning',
                reflection: result.text
            });
        }
    } catch (error) {
        console.error('[SOMA] Dream cycle error:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message,
            fallback: 'Use "learn" and "analyze" commands for manual learning'
        });
    }
});

app.post('/api/dream/status', (req, res) => {
    // Return real status of learning systems
    const runtime = dreamStatus.startTime 
        ? Math.floor((Date.now() - dreamStatus.startTime) / 1000)
        : null;
    
    res.json({
        dreamArbiter: { 
            status: dreamStatus.running ? 'active' : 'standby',
            running: dreamStatus.running,
            pid: activeDreamProcess?.pid || null,
            startTime: dreamStatus.startTime,
            runtime: runtime,
            cycleCount: dreamStatus.cycleCount,
            lastReport: dreamStatus.lastReport
        },
        knowledgeMesh: knowledgeGraphFusionInstance ? knowledgeGraphFusionInstance.getStats().metrics : { nodes: 0, edges: 0 },
        mnemonicArbiter: (mnemonicArbiter && typeof mnemonicArbiter.getMemoryStats === 'function') 
            ? mnemonicArbiter.getMemoryStats().storage 
            : { memories: 0, compressed: 0 },
        tribrain: { 
            prometheus: brain.isReady ? 'ready' : 'initializing',
            logos: brain.isReady ? 'ready' : 'initializing', 
            aurora: brain.isReady ? 'ready' : 'initializing'
        }
    });
});

// 14. Fragment Registry Operations
app.get('/api/fragments/all', async (req, res) => {
    if (!fragmentRegistryInstance) {
        return res.status(503).json({ success: false, error: 'Fragment registry not available' });
    }
    try {
        const fragments = fragmentRegistryInstance.listFragments();
        res.json(fragments);
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/fragments/domain/:domain', async (req, res) => {
    if (!fragmentRegistryInstance) {
        return res.status(503).json({ success: false, error: 'Fragment registry not available' });
    }
    try {
        const { domain } = req.params;
        const fragments = fragmentRegistryInstance.listFragments().filter(f => f.domain === domain);
        res.json(fragments);
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/fragments/stats', async (req, res) => {
    if (!fragmentRegistryInstance) {
        return res.status(503).json({ success: false, error: 'Fragment registry not available' });
    }
    try {
        res.json(fragmentRegistryInstance.stats);
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/fragments/:id/query', async (req, res) => {
    if (!fragmentRegistryInstance) {
        return res.status(503).json({ success: false, error: 'Fragment registry not available' });
    }
    try {
        const { id } = req.params;
        const { query, context } = req.body;
        const fragment = fragmentRegistryInstance.fragments.get(id);
        if (!fragment) {
            return res.status(404).json({ success: false, error: 'Fragment not found' });
        }
        
        // Use SomaBrain to execute the fragment-enhanced query
        const result = await brain.processQuery(query, {
            ...context,
            systemPrompt: fragment.systemPrompt + '\n\n' + (context?.systemPrompt || '')
        });
        
        res.json({
            fragment: id,
            response: result.response || result.text,
            confidence: result.confidence || 0.8,
            reasoning: `Executed through expert domain: ${fragment.domain}`
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/dream/stop', (req, res) => {
    if (!activeDreamProcess || activeDreamProcess.killed) {
        return res.json({ success: false, message: 'No active dream process' });
    }
    
    console.log('[SOMA] Stopping DreamArbiter...');
    activeDreamProcess.kill();
    dreamStatus.running = false;
    activeDreamProcess = null;
    
    res.json({ success: true, message: 'DreamArbiter stopped' });
});

app.post('/api/learn', async (req, res) => {
    const { concept, context } = req.body;
    console.log(`[SOMA] Learning new concept: ${concept}`);
    
    try {
        // Process through TriBrain for deep integration
        const query = `Learn and integrate this concept: ${concept}. ${context ? 'Context: ' + context : ''}`;
        const result = await brain.processQuery(query);
        
        res.json({
            success: true,
            concept,
            integration: result.text,
            confidence: result.meta?.confidence || 0.8
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// 6. Knowledge Mesh Persistence
const KNOWLEDGE_PATH = path.join(__dirname, '../../SOMA/soma-knowledge.json');

app.post('/api/knowledge/save', async (req, res) => {
    if (!knowledgeGraphFusionInstance) {
        return res.status(503).json({ success: false, error: 'Knowledge graph not available' });
    }
    try {
        await knowledgeGraphFusionInstance.save();
        res.json({ success: true, path: knowledgeGraphFusionInstance.savePath });
    } catch (error) {
        console.error('[SOMA] Failed to save knowledge:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/knowledge/load', async (req, res) => {
    if (!knowledgeGraphFusionInstance) {
        return res.status(503).json({ success: false, error: 'Knowledge graph not available' });
    }
    try {
        const state = knowledgeGraphFusionInstance.exportGraph();
        res.json({ success: true, state });
    } catch (error) {
        console.error('[SOMA] Failed to load knowledge:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// 7. Memory Operations (MnemonicArbiter or UnifiedMemoryArbiter)
app.post('/api/memory/store', async (req, res) => {
    const memoryArbiter = mnemonicArbiter || unifiedMemoryArbiter;
    if (!memoryArbiter) {
        return res.status(503).json({ success: false, error: 'Memory arbiter not available' });
    }

    try {
        const { content, metadata } = req.body;
        
        // Validate content parameter
        if (!content || (typeof content !== 'string' && typeof content !== 'object')) {
            return res.status(400).json({ 
                success: false, 
                error: 'Content parameter is required and must be a string or object' 
            });
        }
        
        const result = await memoryArbiter.remember(content, metadata || {});
        res.json({ success: true, id: result.id || result.memoryId, tier: result.tier || 'cold' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/memory/recall', async (req, res) => {
    const memoryArbiter = mnemonicArbiter || unifiedMemoryArbiter;
    if (!memoryArbiter) {
        return res.status(503).json({ success: false, error: 'Memory arbiter not available' });
    }

    try {
        const { query, limit } = req.body;
        // Fix: recall expects (query, topK: number), not an options object
        const results = await memoryArbiter.recall(query, parseInt(limit) || 10);
        res.json({ success: true, results });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/memory/stats', async (req, res) => {
    const memoryArbiter = mnemonicArbiter || unifiedMemoryArbiter;
    if (!memoryArbiter) {
        return res.status(503).json({ success: false, error: 'Memory arbiter not available' });
    }

    try {
        const stats = memoryArbiter.getStats ? await memoryArbiter.getStats() : { memoryType: 'unified' };
        res.json({ success: true, stats });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// 8. ArchivistArbiter Operations
app.post('/api/archive/scan', async (req, res) => {
    if (!archivistArbiter) {
        return res.status(503).json({ success: false, error: 'ArchivistArbiter not available' });
    }
    
    try {
        const { ageThresholdDays } = req.body;
        const coldData = await archivistArbiter.findColdData(ageThresholdDays || 30);
        await archivistArbiter.autonomousCompression(coldData);
        res.json({ success: true, compressed: coldData.length });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/archive/stats', async (req, res) => {
    if (!archivistArbiter) {
        return res.status(503).json({ success: false, error: 'ArchivistArbiter not available' });
    }
    
    try {
        res.json({ success: true, metrics: archivistArbiter.metrics });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// 9. StorageArbiter Operations
app.get('/api/storage/backends', async (req, res) => {
    if (!storageArbiter) {
        return res.status(503).json({ success: false, error: 'StorageArbiter not available' });
    }
    
    try {
        const status = storageArbiter.getStatus();
        res.json({ success: true, ...status });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/storage/retrieve/:key', async (req, res) => {
    if (!storageArbiter) {
        return res.status(503).json({ success: false, error: 'StorageArbiter not available' });
    }
    
    try {
        const { key } = req.params;
        const { backend } = req.query;
        const data = await storageArbiter.retrieve(key, backend);
        res.json({ success: true, data });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// 10. AnalystArbiter Operations
app.get('/api/analyst/insights', async (req, res) => {
    if (!analystArbiter) {
        return res.status(503).json({ success: false, error: 'AnalystArbiter not available' });
    }
    
    try {
        // Get insights from analyst
        const insights = analystArbiter.patterns || [];
        res.json({ success: true, insights });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// 11. Cluster Status
app.get('/api/cluster/status', async (req, res) => {
    try {
        const status = {
            hub: memoryHub ? memoryHub.getStatus() : { available: false },
            unified: unifiedMemoryArbiter ? {
                available: true,
                metrics: unifiedMemoryArbiter.metrics
            } : { available: false },
            arbiters: {
                mnemonic: mnemonicArbiter ? 'active' : 'inactive',
                archivist: archivistArbiter ? 'active' : 'inactive',
                storage: storageArbiter ? 'active' : 'inactive',
                unified: unifiedMemoryArbiter ? 'active' : 'inactive',
                analyst: analystArbiterInstance ? 'active' : 'inactive'
            }
        };
        res.json({ success: true, ...status });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/cluster/nodes', async (req, res) => {
    if (!memoryHub) {
        return res.status(503).json({ success: false, error: 'Memory hub not available' });
    }
    
    try {
        const status = memoryHub.getStatus();
        res.json({ success: true, nodes: status.nodes });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// 12. Learning Loop Control
app.get('/api/learning/status', (req, res) => {
    if (!learningLoop) {
        return res.json({ success: true, active: false, message: 'Learning loop not initialized' });
    }
    
    const metrics = learningLoop.getMetrics();
    res.json({ success: true, active: true, ...metrics });
});

app.post('/api/learning/trigger', async (req, res) => {
    if (!learningLoop) {
        return res.status(503).json({ success: false, error: 'Learning loop not available' });
    }
    
    try {
        await learningLoop.runLearningCycle();
        res.json({ success: true, message: 'Learning cycle triggered' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/learning/stop', (req, res) => {
    if (!learningLoop) {
        return res.status(503).json({ success: false, error: 'Learning loop not available' });
    }
    
    learningLoop.stop();
    res.json({ success: true, message: 'Learning loop stopped' });
});

app.post('/api/learning/start', (req, res) => {
    if (!learningLoop) {
        return res.status(503).json({ success: false, error: 'Learning loop not available' });
    }
    
    learningLoop.start();
    res.json({ success: true, message: 'Learning loop started' });
});

// 13. DreamArbiter Operations
app.get('/api/dream/status', (req, res) => {
    if (!dreamArbiter) {
        return res.json({ success: true, active: false, message: 'DreamArbiter not initialized' });
    }
    
    const status = dreamArbiter.getStatus();
    res.json({ success: true, active: true, ...status });
});

app.get('/api/dream/journal', (req, res) => {
    if (!dreamArbiter) {
        return res.status(503).json({ success: false, error: 'DreamArbiter not available' });
    }
    
    const { limit } = req.query;
    const journal = dreamArbiter.getDreamJournal(parseInt(limit) || 10);
    res.json({ success: true, journal });
});

app.post('/api/dream/trigger/:cycle', async (req, res) => {
    if (!dreamArbiter) {
        return res.status(503).json({ success: false, error: 'DreamArbiter not available' });
    }
    
    const { cycle } = req.params; // 'rem', 'nrem', or 'deep'
    
    try {
        if (cycle === 'rem') {
            await dreamArbiter._scheduleREM();
        } else if (cycle === 'nrem') {
            await dreamArbiter._scheduleNREM();
        } else if (cycle === 'deep') {
            await dreamArbiter._scheduleDeepSleep();
        } else {
            return res.status(400).json({ success: false, error: 'Invalid cycle type. Use: rem, nrem, or deep' });
        }
        res.json({ success: true, message: `${cycle.toUpperCase()} cycle triggered` });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/dream/activity', (req, res) => {
    if (!dreamArbiter) {
        return res.status(503).json({ success: false, error: 'DreamArbiter not available' });
    }
    
    dreamArbiter.recordActivity();
    res.json({ success: true, message: 'Activity recorded' });
});

app.post('/api/dream/stop', (req, res) => {
    if (!dreamArbiter) {
        return res.status(503).json({ success: false, error: 'DreamArbiter not available' });
    }
    
    dreamArbiter.stop();
    res.json({ success: true, message: 'DreamArbiter stopped' });
});

app.post('/api/dream/start', (req, res) => {
    if (!dreamArbiter) {
        return res.status(503).json({ success: false, error: 'DreamArbiter not available' });
    }
    
    dreamArbiter.start();
    res.json({ success: true, message: 'DreamArbiter started' });
});

// 14. MCP Tool Operations
app.get('/api/tools/list', (req, res) => {
    if (!toolManager) {
        return res.status(503).json({ success: false, error: 'Tool system not available' });
    }
    
    const tools = toolManager.listTools();
    res.json({ success: true, tools, count: tools.length });
});

app.get('/api/tools/status', (req, res) => {
    if (!toolManager) {
        return res.status(503).json({ success: false, error: 'Tool system not available' });
    }
    
    const status = toolManager.getStatus();
    res.json({ success: true, ...status });
});

app.post('/api/tools/invoke', async (req, res) => {
    if (!toolManager) {
        return res.status(503).json({ success: false, error: 'Tool system not available' });
    }
    
    const { tool, parameters } = req.body;
    
    if (!tool) {
        return res.status(400).json({ success: false, error: 'Tool name required' });
    }
    
    try {
        const result = await toolManager.invokeTool(tool, parameters || {});
        res.json(result);
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// 15. MicroAgent Operations
app.get('/api/agents/list', (req, res) => {
    if (!agentManager) {
        return res.status(503).json({ success: false, error: 'Agent system not available' });
    }
    
    const agents = agentManager.listAgents();
    res.json({ success: true, agents, count: agents.length });
});

app.get('/api/agents/status', (req, res) => {
    if (!agentManager) {
        return res.status(503).json({ success: false, error: 'Agent system not available' });
    }
    
    const status = agentManager.getStatus();
    res.json({ success: true, ...status });
});

app.post('/api/agents/spawn', async (req, res) => {
    if (!agentManager) {
        return res.status(503).json({ success: false, error: 'Agent system not available' });
    }
    
    const { type, config } = req.body;
    
    if (!type) {
        return res.status(400).json({ success: false, error: 'Agent type required (file, code, memory, shell)' });
    }
    
    try {
        const agent = await agentManager.spawnAgent(type, config || {});
        res.json({ success: true, agent: agent.getStatus() });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/agents/execute', async (req, res) => {
    if (!agentManager) {
        return res.status(503).json({ success: false, error: 'Agent system not available' });
    }
    
    const { type, task, config } = req.body;
    
    if (!type) {
        return res.status(400).json({ success: false, error: 'Agent type required' });
    }
    
    if (!task) {
        return res.status(400).json({ success: false, error: 'Task required' });
    }
    
    try {
        const result = await agentManager.executeTask(type, task, config || {});
        res.json(result);
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/agents/terminate/:agentId', async (req, res) => {
    if (!agentManager) {
        return res.status(503).json({ success: false, error: 'Agent system not available' });
    }
    
    const { agentId } = req.params;
    const { reason } = req.body;
    
    try {
        const result = await agentManager.terminateAgent(agentId, reason || 'manual');
        res.json(result);
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/agents/:agentId', (req, res) => {
    if (!agentManager) {
        return res.status(503).json({ success: false, error: 'Agent system not available' });
    }
    
    const { agentId } = req.params;
    const agent = agentManager.getAgent(agentId);
    
    if (!agent) {
        return res.status(404).json({ success: false, error: 'Agent not found' });
    }
    
    res.json({ success: true, agent: agent.getStatus() });
});

// 16. Knowledge Discovery Operations
app.post('/api/knowledge/discover', async (req, res) => {
    if (!knowledgeWorker) {
        return res.status(503).json({ success: false, error: 'Knowledge Discovery not available (add BRAVE_SEARCH_API_KEY to .env)' });
    }
    
    try {
        const result = await knowledgeWorker.discover();
        res.json(result);
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/knowledge/metrics', (req, res) => {
    if (!knowledgeWorker) {
        return res.status(503).json({ success: false, error: 'Knowledge Discovery not available' });
    }
    
    const metrics = knowledgeWorker.getMetrics();
    res.json({ success: true, metrics });
});

// 17. WebCrawler Operations
app.post('/api/crawler/start', async (req, res) => {
    if (!webCrawler) {
        return res.status(503).json({ success: false, error: 'WebCrawler not available' });
    }
    
    const { target, query, maxPages } = req.body;
    
    if (!target) {
        return res.status(400).json({ success: false, error: 'Target required (stackoverflow, github, mdn, devto, documentation)' });
    }
    
    try {
        const result = await webCrawler.crawl({ target, query, maxPages });
        res.json(result);
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/crawler/status', (req, res) => {
    if (!webCrawler) {
        return res.status(503).json({ success: false, error: 'WebCrawler not available' });
    }
    
    const stats = webCrawler.getStats();
    res.json({ success: true, ...stats });
});

app.get('/api/crawler/data', (req, res) => {
    if (!webCrawler) {
        return res.status(503).json({ success: false, error: 'WebCrawler not available' });
    }
    
    res.json({ success: true, data: webCrawler.crawledData });
});

// 18. Learning Velocity Tracker Operations
app.get('/api/velocity/status', (req, res) => {
    if (!velocityTracker) {
        return res.status(503).json({ success: false, error: 'LearningVelocityTracker not available' });
    }
    
    const report = velocityTracker.getVelocityReport();
    res.json({ success: true, ...report });
});

app.get('/api/velocity/metrics', (req, res) => {
    if (!velocityTracker) {
        return res.status(503).json({ success: false, error: 'LearningVelocityTracker not available' });
    }
    
    res.json({ success: true, metrics: velocityTracker.learningMetrics });
});

app.post('/api/velocity/record', async (req, res) => {
    if (!velocityTracker) {
        return res.status(503).json({ success: false, error: 'LearningVelocityTracker not available' });
    }
    
    const { eventType, payload } = req.body;
    
    try {
        let result;
        switch (eventType) {
            case 'learning':
                result = await velocityTracker.recordLearningEvent(payload);
                break;
            case 'knowledge':
                result = await velocityTracker.recordKnowledgeAcquisition(payload);
                break;
            case 'pattern':
                result = await velocityTracker.recordPatternDetection(payload);
                break;
            default:
                return res.status(400).json({ success: false, error: 'Invalid event type (learning, knowledge, pattern)' });
        }
        res.json(result);
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// 19. EdgeWorkerOrchestrator Operations
app.get('/api/orchestrator/status', (req, res) => {
    if (!edgeOrchestrator) {
        return res.status(503).json({ success: false, error: 'EdgeOrchestrator not available' });
    }
    
    const status = edgeOrchestrator.getStatus();
    res.json({ success: true, ...status });
});

app.get('/api/orchestrator/workers', (req, res) => {
    if (!edgeOrchestrator) {
        return res.status(503).json({ success: false, error: 'EdgeOrchestrator not available' });
    }
    
    const workers = Array.from(edgeOrchestrator.workers.values());
    res.json({ success: true, workers, count: workers.length });
});

app.post('/api/orchestrator/task', async (req, res) => {
    if (!edgeOrchestrator) {
        return res.status(503).json({ success: false, error: 'EdgeOrchestrator not available' });
    }
    
    const task = req.body;
    
    try {
        const result = await edgeOrchestrator.deployLearningTask(task);
        res.json(result);
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// 20. SelfModificationArbiter Operations
app.get('/api/selfmod/status', (req, res) => {
    if (!selfModArbiter) {
        return res.status(503).json({ success: false, error: 'SelfModificationArbiter not available' });
    }
    
    const status = selfModArbiter.getStatus();
    res.json({ success: true, ...status });
});

app.get('/api/selfmod/metrics', (req, res) => {
    if (!selfModArbiter) {
        return res.status(503).json({ success: false, error: 'SelfModificationArbiter not available' });
    }
    
    res.json({ success: true, metrics: selfModArbiter.metrics });
});

app.post('/api/selfmod/analyze', async (req, res) => {
    if (!selfModArbiter) {
        return res.status(503).json({ success: false, error: 'SelfModificationArbiter not available' });
    }
    
    const { filepath } = req.body;
    
    if (!filepath) {
        return res.status(400).json({ success: false, error: 'filepath required' });
    }
    
    try {
        const result = await selfModArbiter.analyzePerformance({ filepath });
        res.json(result);
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// 21. WebScraperDendrite Operations
app.get('/api/dendrite/status', (req, res) => {
    if (!webScraperDendrite) {
        return res.status(503).json({ success: false, error: 'WebScraperDendrite not available' });
    }
    
    const status = webScraperDendrite.getStatus();
    res.json({ success: true, ...status });
});

app.post('/api/dendrite/task', async (req, res) => {
    if (!webScraperDendrite) {
        return res.status(503).json({ success: false, error: 'WebScraperDendrite not available' });
    }
    
    const { target, query, maxResults, source, priority } = req.body;
    
    if (!target || !query) {
        return res.status(400).json({ success: false, error: 'target and query required' });
    }
    
    try {
        const result = await webScraperDendrite.addTask(
            { target, query, maxResults, source },
            { priority: priority || 'normal' }
        );
        res.json(result);
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/dendrite/data', (req, res) => {
    if (!webScraperDendrite) {
        return res.status(503).json({ success: false, error: 'WebScraperDendrite not available' });
    }
    
    const { target } = req.query;
    
    if (target) {
        const data = webScraperDendrite.getScrapedDataByTarget(target);
        res.json({ success: true, target, data, count: data.length });
    } else {
        const data = webScraperDendrite.getScrapedData();
        res.json({ success: true, ...data });
    }
});

app.delete('/api/dendrite/data', (req, res) => {
    if (!webScraperDendrite) {
        return res.status(503).json({ success: false, error: 'WebScraperDendrite not available' });
    }
    
    const result = webScraperDendrite.clearScrapedData();
    res.json({ success: true, ...result });
});

// 22. GenomeArbiter Operations
app.get('/api/genome/status', (req, res) => {
    if (!genomeArbiter) {
        return res.status(503).json({ success: false, error: 'GenomeArbiter not available' });
    }
    
    const status = genomeArbiter.getStatus();
    res.json({ success: true, ...status });
});

app.get('/api/genome/library', (req, res) => {
    if (!genomeArbiter) {
        return res.status(503).json({ success: false, error: 'GenomeArbiter not available' });
    }
    
    const templates = Object.keys(genomeArbiter.genomeLibrary);
    res.json({ success: true, templates, count: templates.length });
});

app.post('/api/genome/encode', async (req, res) => {
    if (!genomeArbiter) {
        return res.status(503).json({ success: false, error: 'GenomeArbiter not available' });
    }
    
    const { arbiterType } = req.body;
    
    if (!arbiterType) {
        return res.status(400).json({ success: false, error: 'arbiterType required (storage, archivist, conductor, etc.)' });
    }
    
    try {
        const result = await genomeArbiter.handleEncodeRequest({ arbiterType });
        res.json(result);
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// 22. Timekeeper Operations
app.get('/api/timekeeper/status', (req, res) => {
    if (!timekeeperArbiter) {
        return res.status(503).json({ success: false, error: 'Timekeeper not available' });
    }
    
    const status = timekeeperArbiter.getStatus();
    res.json({ success: true, ...status });
});

app.get('/api/timekeeper/rhythms', (req, res) => {
    if (!timekeeperArbiter) {
        return res.status(503).json({ success: false, error: 'Timekeeper not available' });
    }
    
    const rhythms = [];
    for (const [name, job] of timekeeperArbiter.cronJobs.entries()) {
        rhythms.push({
            name,
            pattern: job.pattern || 'unknown',
            running: job.running || false
        });
    }
    
    res.json({ success: true, rhythms, count: rhythms.length });
});

// 23. GoalPlannerArbiter Operations
app.get('/api/goals', (req, res) => {
    if (!goalPlannerArbiter) {
        return res.status(503).json({ success: false, error: 'GoalPlanner not available' });
    }
    
    const filter = {
        category: req.query.category,
        type: req.query.type,
        minPriority: req.query.minPriority ? parseInt(req.query.minPriority) : undefined
    };
    
    const result = goalPlannerArbiter.getActiveGoals(filter);
    res.json(result);
});

app.get('/api/goals/stats', (req, res) => {
    if (!goalPlannerArbiter) {
        return res.status(503).json({ success: false, error: 'GoalPlanner not available' });
    }
    
    const stats = goalPlannerArbiter.getStatistics();
    res.json({ success: true, stats });
});

app.get('/api/goals/:id', (req, res) => {
    if (!goalPlannerArbiter) {
        return res.status(503).json({ success: false, error: 'GoalPlanner not available' });
    }
    
    const result = goalPlannerArbiter.getGoalStatus(req.params.id);
    res.json(result);
});

app.post('/api/goals', async (req, res) => {
    if (!goalPlannerArbiter) {
        return res.status(503).json({ success: false, error: 'GoalPlanner not available' });
    }
    
    const goalData = req.body;
    
    if (!goalData.title || !goalData.category) {
        return res.status(400).json({ success: false, error: 'title and category required' });
    }
    
    try {
        const result = await goalPlannerArbiter.createGoal(goalData, 'user');
        res.json(result);
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.put('/api/goals/:id', async (req, res) => {
    if (!goalPlannerArbiter) {
        return res.status(503).json({ success: false, error: 'GoalPlanner not available' });
    }
    
    const { progress, metadata } = req.body;
    
    try {
        const result = await goalPlannerArbiter.updateGoalProgress(req.params.id, progress, metadata);
        res.json(result);
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.delete('/api/goals/:id', async (req, res) => {
    if (!goalPlannerArbiter) {
        return res.status(503).json({ success: false, error: 'GoalPlanner not available' });
    }
    
    const reason = req.query.reason || 'User cancelled';
    
    try {
        const result = await goalPlannerArbiter.cancelGoal(req.params.id, reason);
        res.json(result);
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// 24. BeliefSystemArbiter Operations
app.get('/api/beliefs', (req, res) => {
    if (!beliefSystemArbiter) {
        return res.status(503).json({ success: false, error: 'BeliefSystem not available' });
    }
    
    const filter = {
        domain: req.query.domain,
        category: req.query.category,
        minConfidence: req.query.minConfidence ? parseFloat(req.query.minConfidence) : undefined,
        isCore: req.query.isCore ? req.query.isCore === 'true' : undefined
    };
    
    const result = beliefSystemArbiter.queryBeliefs(filter);
    res.json(result);
});

app.get('/api/beliefs/stats', (req, res) => {
    if (!beliefSystemArbiter) {
        return res.status(503).json({ success: false, error: 'BeliefSystem not available' });
    }
    
    const stats = beliefSystemArbiter.getStatistics();
    res.json({ success: true, stats });
});

app.get('/api/beliefs/:id', (req, res) => {
    if (!beliefSystemArbiter) {
        return res.status(503).json({ success: false, error: 'BeliefSystem not available' });
    }
    
    const beliefId = req.params.id;
    
    if (!beliefId || typeof beliefId !== 'string') {
        return res.status(400).json({ success: false, error: 'Valid belief ID required' });
    }
    
    try {
        const result = beliefSystemArbiter.getBelief(beliefId);
        
        if (!result.success) {
            return res.status(404).json(result);
        }
        
        res.json(result);
    } catch (error) {
        console.error('[BeliefSystem API] Get belief error:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

app.post('/api/beliefs', async (req, res) => {
    if (!beliefSystemArbiter) {
        return res.status(503).json({ success: false, error: 'BeliefSystem not available' });
    }
    
    const { statement, evidence, category, metadata } = req.body;
    
    // Comprehensive validation
    if (!statement || typeof statement !== 'string' || statement.trim().length === 0) {
        return res.status(400).json({ 
            success: false, 
            error: 'statement must be a non-empty string' 
        });
    }
    
    if (!Array.isArray(evidence) || evidence.length === 0) {
        return res.status(400).json({ 
            success: false, 
            error: 'evidence must be a non-empty array' 
        });
    }
    
    // Validate evidence structure
    for (const e of evidence) {
        if (!e || typeof e !== 'object' || !e.source || typeof e.weight !== 'number') {
            return res.status(400).json({
                success: false,
                error: 'Each evidence item must have source (string) and weight (number 0-1)'
            });
        }
    }
    
    const validCategories = ['factual', 'causal', 'predictive', 'normative'];
    if (category && !validCategories.includes(category)) {
        return res.status(400).json({
            success: false,
            error: `category must be one of: ${validCategories.join(', ')}`
        });
    }
    
    try {
        const result = await beliefSystemArbiter.createBelief(
            statement.trim(), 
            evidence, 
            category || 'factual', 
            metadata || {}
        );
        
        if (!result.success) {
            return res.status(400).json(result);
        }
        
        res.status(201).json(result);
    } catch (error) {
        console.error('[BeliefSystem API] Create belief error:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

app.put('/api/beliefs/:id', async (req, res) => {
    if (!beliefSystemArbiter) {
        return res.status(503).json({ success: false, error: 'BeliefSystem not available' });
    }
    
    const beliefId = req.params.id;
    const { evidence } = req.body;
    
    // Validate belief ID
    if (!beliefId || typeof beliefId !== 'string') {
        return res.status(400).json({ success: false, error: 'Valid belief ID required' });
    }
    
    // Validate evidence
    if (!evidence || typeof evidence !== 'object') {
        return res.status(400).json({ 
            success: false, 
            error: 'evidence object required' 
        });
    }
    
    if (!evidence.source || typeof evidence.source !== 'string') {
        return res.status(400).json({ 
            success: false, 
            error: 'evidence.source (string) required' 
        });
    }
    
    if (typeof evidence.weight !== 'number' || evidence.weight < 0 || evidence.weight > 1) {
        return res.status(400).json({ 
            success: false, 
            error: 'evidence.weight must be a number between 0 and 1' 
        });
    }
    
    try {
        const result = await beliefSystemArbiter.updateBeliefWithEvidence(beliefId, evidence);
        
        if (!result.success) {
            return res.status(404).json(result);
        }
        
        res.json(result);
    } catch (error) {
        console.error('[BeliefSystem API] Update belief error:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

app.get('/api/contradictions', (req, res) => {
    if (!beliefSystemArbiter) {
        return res.status(503).json({ success: false, error: 'BeliefSystem not available' });
    }
    
    const contradictions = Array.from(beliefSystemArbiter.contradictions.values())
        .filter(c => !c.resolved);
    
    res.json({ 
        success: true, 
        contradictions, 
        count: contradictions.length,
        total: beliefSystemArbiter.contradictions.size
    });
});

app.get('/api/world-model', (req, res) => {
    if (!beliefSystemArbiter) {
        return res.status(503).json({ success: false, error: 'BeliefSystem not available' });
    }
    
    const worldModel = beliefSystemArbiter.getWorldModel();
    res.json({ success: true, worldModel });
});

app.post('/api/beliefs/validate', async (req, res) => {
    if (!beliefSystemArbiter) {
        return res.status(503).json({ success: false, error: 'BeliefSystem not available' });
    }
    
    const { statement } = req.body;
    
    if (!statement || typeof statement !== 'string' || statement.trim().length === 0) {
        return res.status(400).json({ 
            success: false, 
            error: 'statement must be a non-empty string' 
        });
    }
    
    try {
        const result = await beliefSystemArbiter.validateBelief(statement.trim());
        res.json(result);
    } catch (error) {
        console.error('[BeliefSystem API] Validate belief error:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

// 16. Cluster Federation Operations
app.get('/api/cluster/status', (req, res) => {
    if (!clusterNode) {
        return res.status(503).json({ success: false, error: 'Cluster not available' });
    }
    
    const status = clusterNode._getClusterStatus();
    res.json({ success: true, ...status });
});

app.get('/api/cluster/nodes', (req, res) => {
    if (!clusterNode) {
        return res.status(503).json({ success: false, error: 'Cluster not available' });
    }
    
    const nodeInfo = clusterNode._getNodeInfo();
    const nodes = [
        nodeInfo,
        ...Array.from(clusterNode.knownNodes.values())
    ];
    
    res.json({ success: true, nodes, count: nodes.length });
});

app.post('/api/cluster/discover', async (req, res) => {
    if (!clusterNode) {
        return res.status(503).json({ success: false, error: 'Cluster not available' });
    }
    
    const { host } = req.body;
    
    if (!host) {
        return res.status(400).json({ success: false, error: 'Host required (e.g. localhost:5001)' });
    }
    
    try {
        await clusterNode.discoverNode(host);
        res.json({ success: true, message: `Discovery request sent to ${host}` });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/cluster/task/distribute', async (req, res) => {
    if (!clusterNode) {
        return res.status(503).json({ success: false, error: 'Cluster not available' });
    }
    
    const { agent, taskData, config } = req.body;
    
    if (!agent || !taskData) {
        return res.status(400).json({ success: false, error: 'agent and taskData required' });
    }
    
    try {
        const result = await clusterNode.distributeTask(agent, taskData, config || {});
        res.json(result);
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// 25. Approval System Operations
app.post('/api/approval/request', async (req, res) => {
    if (!approvalSystem) {
        return res.status(503).json({ success: false, error: 'ApprovalSystem not available' });
    }
    
    const { type, target, description, metadata } = req.body;
    
    if (!type || !target || !description) {
        return res.status(400).json({ 
            success: false, 
            error: 'type, target, and description are required' 
        });
    }
    
    try {
        const result = await approvalSystem.requestApproval({
            type,
            action: description,
            details: { target, ...metadata },
            context: metadata || {}
        });
        
        res.json({
            requestId: result.requestId || 'auto',
            approved: result.approved,
            autoApproved: result.autoApproved || false,
            reason: result.reason || 'unknown'
        });
    } catch (error) {
        console.error('[Approval API] Request error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/approval/pending', (req, res) => {
    if (!approvalSystem) {
        return res.status(503).json({ success: false, error: 'ApprovalSystem not available' });
    }
    
    const pending = approvalSystem.getPendingApprovals();
    res.json({ success: true, pending, count: pending.length });
});

app.get('/api/approval/stats', (req, res) => {
    if (!approvalSystem) {
        return res.status(503).json({ success: false, error: 'ApprovalSystem not available' });
    }
    
    const stats = approvalSystem.getStats();
    res.json({ success: true, stats });
});

// WebSocket connection handler
io.on('connection', (socket) => {
    console.log('[WebSocket] Client connected:', socket.id);

    // Handle terminal commands - Production-grade chat interface
    socket.on('command', async (data) => {
        const { text: query } = data;

        if (!query || typeof query !== 'string') {
            socket.emit('error', { message: 'Invalid command format' });
            return;
        }

        try {
            // Check if brain is ready
            if (!brain || !brain.processQuery) {
                socket.emit('response', {
                    text: "Hey! I'm still waking up... give me a moment to get my thoughts together. 🌅",
                    success: false
                });
                return;
            }

            // Record activity for DreamArbiter
            if (dreamArbiter) {
                dreamArbiter.recordActivity();
            }

            // Detect if this is a coding task
            const isCodingTask = detectCodingIntent(query);

            if (isCodingTask && agentManager) {
                // Route to CodingArbiter for specialized handling
                try {
                    const codingAgent = await agentManager.spawnAgent('coding_arbiter', {
                        ttl: 300000 // 5 minute TTL for coding tasks
                    });

                    const result = await codingAgent.execute({
                        type: 'code_generation',
                        description: query,
                        context: { source: 'terminal', socketId: socket.id }
                    });

                    socket.emit('response', {
                        text: result.success ? formatCodingResponse(result) : result.error,
                        success: result.success,
                        timestamp: Date.now(),
                        mode: 'coding'
                    });

                    // Terminate agent after use
                    await codingAgent.terminate();

                } catch (codingError) {
                    console.warn('[CT Command] CodingAgent failed, falling back to brain:', codingError.message);
                    // Fall back to regular brain processing
                    await processWithBrain(socket, query);
                }
            } else {
                // Regular chat - use SOMA's brain
                await processWithBrain(socket, query);
            }

        } catch (error) {
            console.error('[CT Command] Error processing:', error);
            socket.emit('response', {
                text: "Oops! I hit a snag while processing that. Mind rephrasing? 🤔",
                success: false,
                timestamp: Date.now()
            });
        }
    });

    // Helper: Process regular chat with SOMA brain
    async function processWithBrain(socket, query) {
        const result = await brain.processQuery(query, {
            source: 'terminal',
            socketId: socket.id
        });

        // Send clean response (no internal reasoning exposed for casual chat)
        socket.emit('response', {
            text: result.text || result.response,
            success: true,
            timestamp: Date.now()
        });

        // Grow ThoughtNetwork from conversation
        if (thoughtNetwork) {
            thoughtNetwork.growFromContent(
                query + ' ' + (result.text || result.response || ''),
                { source: 'terminal-chat', tags: ['user-interaction'] }
            ).catch(err => console.warn('[ThoughtNetwork] Growth failed:', err.message));
        }
    }

    // Helper: Detect coding-related queries
    function detectCodingIntent(query) {
        const codingKeywords = [
            'write code', 'create function', 'implement', 'build a', 'generate code',
            'fix this code', 'debug', 'refactor', 'optimize code',
            'write a script', 'create a program', 'code for', 'function that',
            'class that', 'algorithm for', 'write python', 'write javascript',
            'write typescript', 'write a', 'how do i code', 'help me code'
        ];

        const queryLower = query.toLowerCase();
        return codingKeywords.some(keyword => queryLower.includes(keyword));
    }

    // Helper: Format coding response for better UX
    function formatCodingResponse(result) {
        if (!result.result) return "I generated some code but can't display it right now.";

        let response = "";

        if (result.result.explanation) {
            response += result.result.explanation + "\n\n";
        }

        if (result.result.code) {
            response += "```" + (result.result.language || '') + "\n";
            response += result.result.code;
            response += "\n```\n";
        }

        if (result.result.usage) {
            response += "\n**Usage:**\n" + result.result.usage;
        }

        return response.trim() || result.result;
    }

    // Handle approval responses from client
    socket.on('approval_response', (response) => {
        console.log('[WebSocket] Approval response:', response);
        if (approvalSystem) {
            approvalSystem.respondToApproval(response);
        }
    });

    // Handle batch approval responses
    socket.on('batch_approval_response', (responses) => {
        console.log(`[WebSocket] Batch approval responses: ${responses.length} items`);
        if (approvalSystem) {
            responses.forEach(response => {
                approvalSystem.respondToApproval(response);
            });
        }
    });

    socket.on('disconnect', () => {
        console.log('[WebSocket] Client disconnected:', socket.id);
    });
});

server.listen(PORT, () => {
    console.log(`
╔══════════════════════════════════════════╗
║        SOMA LINK SERVER ACTIVE           ║
║        Port: ${PORT}                        ║
║        Mode: Local Development Bridge    ║
╚══════════════════════════════════════════╝
    `);

    // Print MessageBroker status
    const brokerStatus = messageBroker.getStatus();
    console.log('\n📡 [MessageBroker] Registered Components:');
    brokerStatus.arbiters.forEach(a => {
        console.log(`   ✓ ${a.name.padEnd(30)} [${a.role || 'arbiter'}]`);
    });
    console.log(`\n   Total: ${brokerStatus.arbiters.length} components registered`);
    console.log(`\n🔌 [WebSocket] Socket.IO server ready on port ${PORT}`);
});

// Graceful error handling
process.on('uncaughtException', (err) => {
    console.error('[SOMA] Uncaught exception:', err.message);
    // Don't exit - keep server running
});

process.on('unhandledRejection', (reason) => {
    console.error('[SOMA] Unhandled rejection:', reason);
    // Don't exit - keep server running
});
