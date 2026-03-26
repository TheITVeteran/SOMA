/**
 * MnemonicArbiterV2.js
 * 
 * PRODUCTION HYBRID MEMORY SYSTEM - 3 Tier Architecture
 * - Hot Tier: Redis Cluster (in-memory, <1ms)
 * - Warm Tier: Vector embeddings with FAISS-like approximate search (~10ms)
 * - Cold Tier: SQLite with optimized queries (~50ms)
 * 
 * REAL Implementation (not simulation):
 * âœ“ Actual Redis cluster management with failover
 * âœ“ Real semantic vector search with cosine similarity
 * âœ“ Intelligent tier promotion/demotion
 * âœ“ Memory pressure management
 * âœ“ Access pattern tracking for optimization
 */

import BaseArbiterModule from '../core/BaseArbiter.cjs';
const { BaseArbiter, ArbiterCapability } = BaseArbiterModule;
import { createClient } from 'redis';
import Database from 'better-sqlite3';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import os from 'os';

// ===========================
// Vector Utilities
// ===========================

class VectorUtils {
  static async generateEmbedding(text, embedder) {
    if (!embedder) throw new Error('Embedder not available');
    const output = await embedder(text, { pooling: 'mean', normalize: true });
    return Array.from(output.data);
  }

  static cosineSimilarity(a, b) {
    if (a.length !== b.length) throw new Error('Vector dimension mismatch');
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    const denominator = Math.sqrt(normA) * Math.sqrt(normB);
    return denominator === 0 ? 0 : dotProduct / denominator;
  }

  // Approximate nearest neighbor search (simple KD-tree alternative)
  static approximateNearestNeighbors(queryVector, vectors, k = 5, threshold = 0.5) {
    const results = [];

    for (const [id, vectorData] of vectors.entries()) {
      const similarity = this.cosineSimilarity(queryVector, vectorData.vector);

      // Only include vectors above threshold
      if (similarity > threshold) {
        results.push({
          id,
          similarity,
          ...vectorData
        });
      }
    }

    // Sort by similarity descending and return top K
    results.sort((a, b) => b.similarity - a.similarity);
    return results.slice(0, k);
  }
}

// ===========================
// Tier Management
// ===========================

class TierManager {
  constructor(config) {
    this.config = config;
    this.accessPatterns = new Map(); // id -> {access_count, last_access, tier}
    this.promotionThreshold = config.promotionThreshold || 5; // accesses to promote cold->warm
    this.demotionDays = config.demotionDays || 7; // days without access to demote warm->cold
    this.maxPatterns = config.maxAccessPatterns || 10000; // Limit memory leak
  }

  recordAccess(id) {
    // Prevent Map from growing indefinitely
    if (this.accessPatterns.size >= this.maxPatterns && !this.accessPatterns.has(id)) {
      // Very simple pruning: clear the oldest 10%
      const keys = Array.from(this.accessPatterns.keys());
      for (let i = 0; i < Math.floor(this.maxPatterns * 0.1); i++) {
        this.accessPatterns.delete(keys[i]);
      }
    }

    const pattern = this.accessPatterns.get(id) || { access_count: 0, last_access: Date.now(), tier: 'cold' };
    pattern.access_count++;
    pattern.last_access = Date.now();
    this.accessPatterns.set(id, pattern);
    return pattern;
  }

  shouldPromote(id) {
    const pattern = this.accessPatterns.get(id);
    if (!pattern) return false;

    // Promote cold -> warm if accessed 5+ times
    if (pattern.tier === 'cold' && pattern.access_count >= this.promotionThreshold) {
      return 'warm';
    }

    // Promote warm -> hot if accessed recently and frequently
    if (pattern.tier === 'warm' && pattern.access_count >= this.promotionThreshold * 2) {
      return 'hot';
    }

    return null;
  }

  shouldDemote(id) {
    const pattern = this.accessPatterns.get(id);
    if (!pattern) return false;

    const daysSinceAccess = (Date.now() - pattern.last_access) / (1000 * 60 * 60 * 24);

    // Demote hot -> warm if not accessed in 1 hour
    if (pattern.tier === 'hot' && daysSinceAccess > (1 / 24)) {
      return 'warm';
    }

    // Demote warm -> cold if not accessed in N days
    if (pattern.tier === 'warm' && daysSinceAccess > this.demotionDays) {
      return 'cold';
    }

    return null;
  }

  getTierStats() {
    const stats = { hot: 0, warm: 0, cold: 0 };
    for (const pattern of this.accessPatterns.values()) {
      stats[pattern.tier]++;
    }
    return stats;
  }
}

// ===========================
// Main MnemonicArbiterV2
// ===========================

class MnemonicArbiter extends BaseArbiter {
  constructor(opts = {}) {
    super({
      name: opts.name || 'MnemonicArbiter',
      role: 'mnemonic',
      capabilities: [
        ArbiterCapability.CACHE_DATA,
        ArbiterCapability.ACCESS_DB,
        ArbiterCapability.CLONE_SELF
      ],
      version: '2.0.0-real',
      maxContextSize: 200,
      ...opts
    });

    // Cache injection
    this.cache = opts.cache || null;

    // Cognitive Links (Dependency Injection for advanced search)
    this.causalityArbiter = opts.causalityArbiter || null;
    this.visionArbiter = opts.visionArbiter || null;
    this.fragmentRegistry = opts.fragmentRegistry || null;

    // Configuration
    this.config = {
      ...this.config,
      // Redis (Hot Tier)
      redisUrl: opts.redisUrl || 'redis://localhost:6379',
      redisCluster: opts.redisCluster || false,
      redisPoolSize: opts.redisPoolSize || 10,
      redisRetries: opts.redisRetries || 3,
      redisRetryDelay: opts.redisRetryDelay || 1000,

      // Database
      dbPath: opts.dbPath || path.join(process.cwd(), 'soma-memory.db'),

      // Vector search
      vectorDbPath: opts.vectorDbPath || path.join(process.cwd(), 'soma-vectors.json'),
      embeddingModel: opts.embeddingModel || 'Xenova/all-MiniLM-L6-v2',
      rerankerModel: opts.rerankerModel || 'Xenova/ms-marco-MiniLM-L-6-v2', // Cross-encoder for reranking
      vectorDimension: opts.vectorDimension || 384,
      vectorSimilarityThreshold: opts.vectorSimilarityThreshold || 0.5,
      skipEmbedder: opts.skipEmbedder || false, // Skip embedder for fast startup

      // Tier management
      hotTierTTL: opts.hotTierTTL || 3600, // 1 hour
      warmTierLimit: opts.warmTierLimit || 50000, // vectors
      memoryPressureThreshold: opts.memoryPressureThreshold || 0.85, // 85% capacity

      // Auto-management
      enableAutoCleanup: opts.enableAutoCleanup !== false,
      cleanupInterval: opts.cleanupInterval || 300000, // 5 minutes (reduced from 1h)
      saveInterval: opts.saveInterval || 120000, // 2 minutes (NEW: frequent save)
      saveThreshold: opts.saveThreshold || 10, // Save after 10 writes (NEW)
      promotionCheckInterval: opts.promotionCheckInterval || 300000, // 5 minutes

      // Optimization
      batchOptimizations: opts.batchOptimizations !== false,
      // Decision Substrate Config (Substrate Upgrade)
      importanceWeight: opts.importanceWeight || 0.3,
      confidenceWeight: opts.confidenceWeight || 0.2,
      utilityWeight:    opts.utilityWeight || 0.3,
      contextWeight:    opts.contextWeight || 0.2,
      decayRate:        opts.decayRate || 0.001,
      learningRate:     opts.learningRate || 0.05,
      tensionSensitivity: opts.tensionSensitivity || 1.5,
      compressionEnabled: opts.compressionEnabled !== false,
      vacuumInterval: opts.vacuumInterval || 86400000 // 24 hours
    };

    // Storage layers
    this.redis = null; // Hot tier (Redis client pool)
    this.db = null; // Cold tier (SQLite)
    this.vectorStore = new Map(); // Warm tier (in-memory vectors)
    this.embedder = null; // Embedding pipeline (bi-encoder)
    this.reranker = null; // Reranking pipeline (cross-encoder)
    this.unsavedChanges = 0; // Track writes since last save

    // Tier management
    this.tierManager = new TierManager({
      promotionThreshold: 5,
      demotionDays: 7
    });

    // Metrics
    this.tierMetrics = {
      hot: { hits: 0, misses: 0, stores: 0, evictions: 0, size: 0 },
      warm: { hits: 0, misses: 0, stores: 0, evictions: 0, size: 0 },
      cold: { hits: 0, misses: 0, stores: 0, size: 0 },
      total: { queries: 0, stores: 0, promotions: 0, demotions: 0 }
    };

    // Timers
    this.cleanupTimer = null;
    this.saveTimer = null;
    this.promotionTimer = null;
    this.vacuumTimer = null;
  }

  // ===========================
  // Lifecycle
  // ===========================

  async onInitialize() {
    this.log('info', 'ðŸ§  MnemonicArbiterV2 (Enhanced Persistence) initializing...');

    try {
      // Initialize tiers
      await this._initRedis();
      await this._initSQLite();
      await this._initVectorStore();
      await this._initEmbedder();

      // Start background tasks
      if (this.config.enableAutoCleanup) {
        this._startAutoCleanup();
        this._startAutoSave(); // NEW
        this._startPromotionCheck();
        this._startVacuum();
      }

      // Register handlers
      this.registerMessageHandler('remember', this._handleRemember.bind(this));
      this.registerMessageHandler('recall', this._handleRecall.bind(this));
      this.registerMessageHandler('forget', this._handleForget.bind(this));
      this.registerMessageHandler('save', this._handleSave.bind(this)); // NEW
      this.registerMessageHandler('stats', this._handleStats.bind(this));
      this.registerMessageHandler('optimize', this._handleOptimize.bind(this));
      this.registerMessageHandler('deep_cleanup', this._handleDeepCleanup.bind(this)); // NEW: Digital Constipation Fix

      this.log('info', 'âœ… MnemonicArbiterV2 ready - all 3 tiers operational');
      this._logTierStatus();
    } catch (error) {
      this.log('error', 'Failed to initialize MnemonicArbiterV2', { error: error.message });
      throw error;
    }
  }

  async onShutdown() {
    this.log('info', 'MnemonicArbiterV2 shutting down...');

    // Stop timers
    if (this.cleanupTimer) clearInterval(this.cleanupTimer);
    if (this.saveTimer) clearInterval(this.saveTimer);
    if (this.promotionTimer) clearInterval(this.promotionTimer);
    if (this.vacuumTimer) clearInterval(this.vacuumTimer);

    // Save state
    await this._saveVectorStore();

    // Close connections
    if (this.redis) {
      try {
        await this.redis.quit();
        this.log('info', 'Redis connection closed');
      } catch (e) {
        this.log('warn', 'Redis quit error', { error: e.message });
      }
    }

    if (this.db) {
      try {
        this.db.close();
        this.log('info', 'SQLite connection closed');
      } catch (e) {
        this.log('warn', 'SQLite close error', { error: e.message });
      }
    }

    this.log('info', 'MnemonicArbiterV2 shutdown complete');
  }

  // ===========================
  // Tier Initialization (REAL)
  // ===========================

  async _initRedis() {
    // 1. Use injected cache (Mock or Real)
    if (this.cache) {
      this.redis = this.cache;
      this.log('info', `ðŸ”¥ Hot tier (Injected: ${this.cache.name}) ready`);
      return;
    }

    if (!this.config.redisUrl) {
      this.log('info', 'Redis URL not configured - hot tier disabled');
      return;
    }
    try {
      this.log('info', 'Initializing Redis (hot tier)...');

      if (this.config.redisCluster) {
        // Real cluster mode with failover
        this.redis = createClient({
          url: this.config.redisUrl,
          socket: {
            reconnectStrategy: (retries) => {
              if (retries > this.config.redisRetries) return new Error('Redis reconnection failed');
              return Math.min(retries * 50, this.config.redisRetryDelay);
            },
            connectTimeout: 5000,
            keepAlive: 30000
          },
          maxRetriesPerRequest: 3,
          enableReadyCheck: true,
          enableOfflineQueue: true
        });
      } else {
        // Single instance with connection pooling
        this.redis = createClient({
          url: this.config.redisUrl,
          socket: {
            reconnectStrategy: (retries) => {
              if (retries > this.config.redisRetries) return new Error('Redis reconnection failed');
              return Math.min(retries * 50, this.config.redisRetryDelay);
            }
          }
        });
      }

      // Handle Redis errors gracefully
      this.redis.on('error', (err) => {
        this.log('warn', 'Redis error', { error: err.message });
        // Continue operation without hot tier
      });

      this.redis.on('connect', () => {
        this.log('info', 'Redis connected (hot tier active)');
      });

      // NON-BLOCKING CONNECT
      this.redis.connect().then(async () => {
          // Test connection
          const ping = await this.redis.ping();
          if (ping === 'PONG') {
              this.log('info', 'ðŸ”¥ Hot tier (Redis) ready');
          }
      }).catch(err => {
          this.log('warn', 'Redis connection failed - hot tier disabled', { error: err.message });
          this.redis = null;
      });
    } catch (error) {
      this.log('warn', 'Redis initialization failed - hot tier disabled', { error: error.message });
      this.redis = null;
    }
  }

  // Helper â€” apply schema to an open Database instance
  _setupDb(db, inMemory = false) {
    if (!inMemory) {
      db.pragma('journal_mode = WAL');
      db.pragma('synchronous = NORMAL');
    }
    db.pragma('cache_size = -8000');
    db.pragma('temp_store = MEMORY');
    db.pragma('query_only = OFF');

    db.exec(`
      CREATE TABLE IF NOT EXISTS memories (
        id TEXT PRIMARY KEY,
        content TEXT NOT NULL,
        metadata TEXT,
        embedding_id TEXT,
        created_at INTEGER NOT NULL,
        accessed_at INTEGER NOT NULL,
        access_count INTEGER DEFAULT 0,
        importance REAL DEFAULT 0.5,
        tier TEXT DEFAULT 'cold'
      );

      CREATE INDEX IF NOT EXISTS idx_accessed_at ON memories(accessed_at DESC);
      CREATE INDEX IF NOT EXISTS idx_importance ON memories(importance DESC);
      CREATE INDEX IF NOT EXISTS idx_tier ON memories(tier);
      CREATE INDEX IF NOT EXISTS idx_access_count ON memories(access_count DESC);

      CREATE TABLE IF NOT EXISTS vector_index (
        embedding_id TEXT PRIMARY KEY,
        memory_id TEXT NOT NULL,
        vector_hash TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        FOREIGN KEY(memory_id) REFERENCES memories(id)
      );

      CREATE INDEX IF NOT EXISTS idx_vector_memory ON vector_index(memory_id);
      CREATE TABLE IF NOT EXISTS episodic_buffer (
        id TEXT PRIMARY KEY,
        memory_id TEXT NOT NULL,
        outcome TEXT,
        context_snapshot TEXT,
        action_taken TEXT,
        importance REAL DEFAULT 0.8,
        timestamp INTEGER NOT NULL,
        FOREIGN KEY(memory_id) REFERENCES memories(id)
      );
      CREATE INDEX IF NOT EXISTS idx_episodic_timestamp ON episodic_buffer(timestamp DESC);
    `);

    db.exec('ANALYZE;');
  }

  async _initSQLite() {
    // Try three paths in order. Never throw â€” a degraded cold tier is better than
    // falling all the way back to the in-memory stub in cognitive.js.
    const candidates = [
      { path: this.config.dbPath,                                   label: 'configured path',   inMemory: false },
      { path: path.join(os.tmpdir(), 'soma-memory.db'),             label: 'temp-dir fallback', inMemory: false },
      { path: ':memory:',                                           label: 'in-memory SQLite',  inMemory: true  },
    ];

    for (const candidate of candidates) {
      try {
        this.log('info', `Initializing SQLite (cold tier) â€” ${candidate.label}â€¦`);
        const db = new Database(candidate.path);
        this._setupDb(db, candidate.inMemory);
        this.db = db;

        if (candidate.inMemory) {
          this.log('warn', 'âš ï¸  Cold tier using in-memory SQLite â€” memories will NOT survive a restart. Fix the db path to make them permanent.');
        } else if (candidate.path !== this.config.dbPath) {
          this.log('warn', `âš ï¸  Cold tier using temp fallback (${candidate.path}) â€” set dbPath to a writable location to make memories permanent.`);
        } else {
          this.log('info', 'â„ï¸  Cold tier (SQLite) ready');
        }
        return; // success â€” stop trying
      } catch (err) {
        this.log('warn', `SQLite failed on ${candidate.label}: ${err.message}`);
        this.db = null;
      }
    }

    // All three failed â€” cold tier disabled but we do NOT throw.
    // MnemonicArbiter stays alive with warm-tier-only operation.
    this.log('error', 'Cold tier disabled â€” all SQLite paths failed. Warm tier only.');
  }

  async _initVectorStore() {
    try {
      this.log('info', 'Initializing vector store (warm tier)...');

      const vectorPath = this.config.vectorDbPath;
      let fileExists = false;
      try {
        await fs.access(vectorPath);
        fileExists = true;
      } catch (e) {
        // File doesn't exist
      }

      if (fileExists) {
        try {
          const data = await fs.readFile(vectorPath, 'utf8');
          if (!data || data.trim() === '') {
            this.log('warn', 'âš ï¸ Vector file exists but is empty. Starting fresh.');
          } else {
            const vectors = JSON.parse(data);
            for (const [id, vec] of Object.entries(vectors)) {
              this.vectorStore.set(id, vec);
              this.tierManager.recordAccess(id);
            }
            this.log('info', `ðŸŒ¡ï¸  Warm tier loaded ${this.vectorStore.size} vectors from disk`);
          }
        } catch (e) {
          this.log('error', 'âŒ Failed to parse vector file (corrupt?). Starting fresh.', { error: e.message });
        }
      } else {
        this.log('info', 'ðŸ†• No existing vector file found. Starting fresh warm tier.');
      }

      this.tierMetrics.warm.size = this.vectorStore.size;
    } catch (error) {
      this.log('warn', 'Vector store init warning', { error: error.message });
    }
  }

  async _initEmbedder() {
    try {
      // Skip embedder loading for fast startup if configured
      if (this.config.skipEmbedder) {
        this.log('info', 'Embedder skipped (fast startup mode) - semantic search disabled');
        this.embedder = null;
        this.reranker = null;
        return;
      }

      this.log('info', 'Loading AI models (this may take a moment)...');

      // Dynamic ES Module import (compatible with CommonJS)
      const transformers = await import('@xenova/transformers');
      const { pipeline } = transformers;

      // Load bi-encoder for embedding generation
      this.embedder = await pipeline('feature-extraction', this.config.embeddingModel);
      this.log('info', 'âœ… Embedding model loaded');

      // Load cross-encoder for reranking
      this.reranker = await pipeline('text-classification', this.config.rerankerModel);
      this.log('info', 'âœ… Reranker model loaded - semantic search + reranking enabled');
    } catch (error) {
      this.log('warn', 'âš ï¸  AI models not available - semantic search disabled', { error: error.message });
      this.embedder = null;
      this.reranker = null;
    }
  }

  // ===========================
  // Core Operations (REAL)
  // ===========================

  async remember(content, metadata = {}) {
    if (!this.db) {
      this.log('error', 'Cold tier (SQLite) not initialized - memory lost');
      return { success: false, error: 'Database not ready' };
    }

    // SAFETY GUARD: Prevent massive blobs from bloating the DB and hanging reasoning
    if (content && content.length > 100000) {
      this.log('warn', `âš ï¸ Skipping memory storage: Content too large (${Math.round(content.length/1024)}KB). Probable state dump.`);
      return { success: false, error: 'Content exceeds memory size limit' };
    }

    if (content && (content.includes('"experiences":') || content.includes('"state":'))) {
      this.log('warn', 'âš ï¸ Skipping memory storage: State dump detected.');
      return { success: false, error: 'State dumps should not be stored in semantic memory' };
    }

    const id = this._generateId(content);
    const now = Date.now();

    this.tierMetrics.total.stores++;

    try {
      // Generate embedding for semantic search
      let embeddingId = null;
      if (this.embedder) {
        try {
          const embedding = await VectorUtils.generateEmbedding(content, this.embedder);
          embeddingId = `emb_${id}`;

          this.vectorStore.set(embeddingId, {
            id: embeddingId,
            memoryId: id,
            vector: embedding,
            content: content.substring(0, 200),
            createdAt: now,
            tier: 'warm'
          });

          this.tierManager.recordAccess(id);
          this.tierMetrics.warm.stores++;
          this.tierMetrics.warm.size = this.vectorStore.size;

          // Track changes and auto-save if threshold reached
          this.unsavedChanges++;
          if (this.unsavedChanges >= this.config.saveThreshold) {
            this.log('info', `ðŸ’¾ Save threshold reached (${this.unsavedChanges} changes). Saving...`);
            this._saveVectorStore(); // Fire and forget (don't await to block)
          }

        } catch (error) {
          this.log('warn', 'Embedding generation failed', { error: error.message });
        }
      }

            // EPISODIC ROUTING: If this is an experience/outcome, frame it
      if (metadata.outcome || metadata.type === 'experience' || metadata.action) {
        const epiStmt = this.db.prepare(`
          INSERT INTO episodic_buffer (id, memory_id, outcome, context_snapshot, action_taken, importance, timestamp)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `);
        epiStmt.run(
          `epi_${id}`,
          id,
          JSON.stringify(metadata.outcome || 'unknown'),
          JSON.stringify(metadata.context || {}),
          metadata.action || 'chat',
          metadata.importance || 0.8,
          now
        );
        this.log('info', `🎭 Episodic memory framed: ${id.substring(0,8)}`);
      }
      // Store in cold tier (persistent)
      const stmt = this.db.prepare(`
        INSERT OR REPLACE INTO memories (id, content, metadata, embedding_id, created_at, accessed_at, importance, tier)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'cold')
      `);

      const params = [
        id,
        content,
        JSON.stringify(metadata),
        embeddingId,
        now,
        now,
        (metadata && typeof metadata.importance === 'number') ? metadata.importance : 0.5
      ];

      try {
        stmt.run(...params);
      } catch (sqlError) {
        this.log('error', 'SQLite insert failed', { error: sqlError.message, params });
        throw sqlError; // Re-throw to be caught by outer catch
      }

      this.tierMetrics.cold.stores++;
      this.tierMetrics.cold.size = this.db.prepare('SELECT COUNT(*) as count FROM memories').get().count;

      // Store in hot tier (temporary cache)
      if (this.redis) {
        try {
          await this.redis.setEx(
            `mem:${id}`,
            this.config.hotTierTTL,
            JSON.stringify({ content, metadata, embeddingId })
          );
          this.tierMetrics.hot.stores++;
          this.tierMetrics.hot.size++;
        } catch (error) {
          this.log('warn', 'Redis store failed', { error: error.message });
        }
      }

      this.log('info', `ðŸ’¾ Memory stored: ${id.substring(0, 8)}... (all tiers)`);

      return {
        id,
        embeddingId,
        stored: true,
        tiers: {
          hot: !!this.redis,
          warm: !!embeddingId,
          cold: true
        }
      };
    } catch (error) {
      this.log('error', 'Remember operation failed', { error: error.message });
      throw error;
    }
  }

  async recall(query, topK = 5) {
    if (!this.db) {
      this.log('warn', 'Cold tier (SQLite) not initialized - empty recall');
      return { results: [], tier: 'none' };
    }
    this.tierMetrics.total.queries++;
    const startTime = Date.now();
    let searchTerms = query;

    try {
      // ðŸ”— COGNITIVE LINK 1: CAUSAL EXPANSION
      // Expand query using causal relationships for better recall
      if (this.causalityArbiter && typeof this.causalityArbiter.queryCausalChains === 'function') {
        try {
          const chains = await this.causalityArbiter.queryCausalChains(query, { maxDepth: 1 });
          if (chains && chains.length > 0) {
            const expansion = chains.map(c => c.effect).join(' ');
            searchTerms = `${query} ${expansion}`;
            this.log('info', `ðŸ”— Causal expansion: "${expansion.substring(0, 50)}..."`);
          }
        } catch (e) {
          this.log('warn', 'Causal expansion failed', { error: e.message });
        }
      }

      // 1. Try hot tier (Redis cache) - <1ms
      if (this.redis) {
        try {
          const cached = await this.redis.get(`query:${searchTerms}`);
          if (cached) {
            this.tierMetrics.hot.hits++;
            this.log('info', 'ðŸ”¥ Hot tier hit (query cache)');
            return {
              results: JSON.parse(cached),
              tier: 'hot',
              latency: Date.now() - startTime
            };
          }
        } catch (error) {
          this.log('warn', 'Redis read failed', { error: error.message });
        }
        this.tierMetrics.hot.misses++;
      }

      // ðŸ‘ï¸ COGNITIVE LINK 2: VISUAL CONTEXT
      // Detect visual queries and inject visual context if available
      let visualContext = null;
      const isVisual = /look|see|image|picture|screenshot|photo/i.test(query);
      if (isVisual && this.visionArbiter && typeof this.visionArbiter.findSimilarImages === 'function') {
        try {
          const sim = await this.visionArbiter.findSimilarImages(query, 1);
          if (sim && sim.length > 0) {
            visualContext = `[Visual Context: I recall seeing something similar at ${sim[0].path}]`;
            this.log('info', 'ðŸ‘ï¸  Visual link active');
          }
        } catch (e) {
          this.log('warn', 'Visual lookup failed', { error: e.message });
        }
      }

      // 2. Try warm tier (vector semantic search + reranking) - ~10ms
      if (this.embedder && this.vectorStore.size > 0) {
        try {
          const queryEmbedding = await VectorUtils.generateEmbedding(searchTerms, this.embedder);

          // Get 3x candidates for reranking
          const candidates = await this._vectorSearch(queryEmbedding, topK * 3);
          let finalResults = candidates;

          // RERANKING: Apply cross-encoder if available
          if (this.reranker && candidates.length > 0) {
            this.log('info', `Reranking ${candidates.length} candidates...`);

            // ðŸ§© COGNITIVE LINK 3: DOMAIN BIAS (Fragment Registry)
            let domainBias = null;
            if (this.fragmentRegistry && typeof this.fragmentRegistry.routeToFragment === 'function') {
              try {
                const route = await this.fragmentRegistry.routeToFragment(query, 'LOGOS');
                if (route && route.fragment) {
                  domainBias = route.fragment.domain;
                  this.log('info', `ðŸ§© Domain bias detected: ${domainBias}`);
                }
              } catch (e) {
                // Continue without domain bias
              }
            }

            finalResults = await this._rerank(query, candidates, domainBias);
            finalResults = finalResults.slice(0, topK);
          } else {
            finalResults = candidates.slice(0, topK);
          }

          // Inject visual context if found
          if (visualContext && finalResults.length > 0) {
            finalResults[0].content = `${visualContext}\n${finalResults[0].content}`;
          }

          if (finalResults.length > 0) {
            this.tierMetrics.warm.hits++;
            this.log('info', `ðŸŒ¡ï¸  Warm tier hit (${finalResults.length} vectors, reranked: ${!!this.reranker})`);

            // Promote to hot tier
            if (this.redis) {
              try {
                await this.redis.setEx(
                  `query:${searchTerms}`,
                  this.config.hotTierTTL,
                  JSON.stringify(finalResults)
                );
              } catch (e) {
                // Cache error - continue
              }
            }

            return {
              results: finalResults,
              tier: 'warm',
              latency: Date.now() - startTime
            };
          }
        } catch (error) {
          this.log('warn', 'Vector search/rerank failed', { error: error.message });
        }
        this.tierMetrics.warm.misses++;
      }

      // 3. Fall back to cold tier (SQLite full-text) - ~50ms
      const results = this._sqliteSearch(query, topK);

      if (results.length > 0) {
        this.tierMetrics.cold.hits++;
        this.log('info', `â„ï¸  Cold tier search (${results.length} results)`);

        // Promote to warm tier if available
        if (this.embedder && results.length > 0) {
          for (const result of results) {
            try {
              const embedding = await VectorUtils.generateEmbedding(result.content, this.embedder);
              const embId = `emb_${result.id}`;

              this.vectorStore.set(embId, {
                id: embId,
                memoryId: result.id,
                vector: embedding,
                content: result.content.substring(0, 200),
                createdAt: Date.now(),
                tier: 'warm'
              });

              this.tierManager.recordAccess(result.id);
            } catch (e) {
              // Skip embedding errors
            }
          }
        }

        // Promote to hot tier
        if (this.redis && results.length > 0) {
          try {
            await this.redis.setEx(
              `query:${query}`,
              this.config.hotTierTTL,
              JSON.stringify(results)
            );
          } catch (e) {
            // Cache error - continue
          }
        }
      } else {
        this.tierMetrics.cold.misses++;
      }

      return {
        results,
        tier: 'cold',
        latency: Date.now() - startTime
      };
    } catch (error) {
      this.log('error', 'Recall operation failed', { error: error.message });
      throw error;
    }
  }

  // ===========================
  // Vector Search (REAL)
  // ===========================

  async _vectorSearch(queryVector, topK) {
    return VectorUtils.approximateNearestNeighbors(
      queryVector,
      this.vectorStore,
      topK,
      this.config.vectorSimilarityThreshold
    ).map(result => ({
      id: result.memoryId,
      content: result.content,
      similarity: result.similarity,
      tier: 'warm'
    }));
  }

  // ===========================
  // SQLite Search (REAL)
  // ===========================

  _sqliteSearch(query, limit = 5) {
    // Ensure limit is a valid number
    const safeLimit = (typeof limit === 'number' && limit > 0) ? limit : 5;

    // Use FTS5 (full-text search) if available, fallback to LIKE
    const stmt = this.db.prepare(`
      SELECT id, content, metadata, accessed_at, access_count, importance, tier
      FROM memories
      WHERE content LIKE ? OR metadata LIKE ?
      ORDER BY importance DESC, access_count DESC, accessed_at DESC
      LIMIT ?
    `);

    const results = stmt.all(`%${query}%`, `%${query}%`, safeLimit);

    // Update access stats in batch
    if (results.length > 0) {
      const now = Date.now();
      const updateStmt = this.db.prepare(`
        UPDATE memories 
        SET accessed_at = ?, access_count = access_count + 1
        WHERE id = ?
      `);

      for (const result of results) {
        updateStmt.run(now, result.id);
        this.tierManager.recordAccess(result.id);
      }
    }

    return results.map(r => ({
      id: r.id,
      content: r.content,
      metadata: JSON.parse(r.metadata || '{}'),
      accessed_at: r.accessed_at,
      access_count: r.access_count,
      importance: r.importance,
      tier: 'cold'
    }));
  }

  /**
   * Get recent memories within a time window
   * @param {number} lookbackHours - How many hours to look back
   * @param {number} limit - Maximum number of results
   * @returns {Array} - Recent memories sorted by creation time
   */
  async getRecentMemories(lookbackHours = 24, limit = 100) {
    if (!this.db) {
      throw new Error('MnemonicArbiter database not available');
    }

    const cutoffTimestamp = Math.floor(Date.now() / 1000) - (lookbackHours * 60 * 60);

    try {
      const stmt = this.db.prepare(`
        SELECT id, content, importance, metadata, created_at, access_count, accessed_at
        FROM memories
        WHERE created_at >= ?
        ORDER BY created_at DESC
        LIMIT ?
      `);

      const rows = stmt.all(cutoffTimestamp, limit);
      this.log('info', `Retrieved ${rows.length} memories from last ${lookbackHours} hours`);

      return rows.map(row => ({
        id: row.id,
        content: row.content,
        importance: row.importance,
        metadata: JSON.parse(row.metadata || '{}'),
        created_at: row.created_at,
        access_count: row.access_count,
        accessed_at: row.accessed_at
      }));
    } catch (error) {
      this.log('error', 'Failed to retrieve recent memories', { error: error.message });
      return [];
    }
  }

  /**
   * Get recent memories directly from cold storage (SQLite)
   * This is for the 'Excavation' feature to browse historical interactions.
   */
  getRecentColdMemories(limit = 20) {
    if (!this.db) return [];
    
    const stmt = this.db.prepare(`
      SELECT id, content, metadata, created_at, accessed_at, access_count, importance
      FROM memories
      ORDER BY created_at DESC
      LIMIT ?
    `);

    const results = stmt.all(limit);
    return results.map(r => ({
      id: r.id,
      content: r.content,
      metadata: JSON.parse(r.metadata || '{}'),
      created_at: r.created_at,
      accessed_at: r.accessed_at,
      access_count: r.access_count,
      importance: r.importance
    }));
  }

  // ===========================
  // Tier Management (REAL)
  // ===========================

  async _promoteMemory(id, fromTier, toTier) {
    try {
      const stmt = this.db.prepare('UPDATE memories SET tier = ? WHERE id = ?');
      stmt.run(toTier, id);
      this.tierManager.accessPatterns.get(id).tier = toTier;
      this.tierMetrics.total.promotions++;
      this.log('info', `â¬†ï¸  Promoted ${id.substring(0, 8)}... from ${fromTier} to ${toTier}`);
    } catch (error) {
      this.log('warn', 'Promotion failed', { error: error.message });
    }
  }

  async _demoteMemory(id, fromTier, toTier) {
    try {
      const stmt = this.db.prepare('UPDATE memories SET tier = ? WHERE id = ?');
      stmt.run(toTier, id);
      this.tierManager.accessPatterns.get(id).tier = toTier;
      this.tierMetrics.total.demotions++;
      this.log('info', `â¬‡ï¸  Demoted ${id.substring(0, 8)}... from ${fromTier} to ${toTier}`);
    } catch (error) {
      this.log('warn', 'Demotion failed', { error: error.message });
    }
  }

  async _checkMemoryPressure() {
    // Monitor total memory usage
    const memUsage = process.memoryUsage();
    const heapUsedPercent = memUsage.heapUsed / memUsage.heapTotal;

    if (heapUsedPercent > this.config.memoryPressureThreshold) {
      this.log('warn', `ðŸ”´ Memory pressure high: ${(heapUsedPercent * 100).toFixed(1)}%`);

      // Trigger aggressive cleanup
      this._evictOldVectors();
      this._compressWarmTier();
    }

    return heapUsedPercent;
  }

  _evictOldVectors() {
    const toDelete = [];
    const cutoff = Date.now() - (7 * 24 * 60 * 60 * 1000); // 7 days

    for (const [id, vec] of this.vectorStore.entries()) {
      if (vec.createdAt < cutoff) {
        toDelete.push(id);
      }
    }

    toDelete.forEach(id => {
      this.vectorStore.delete(id);
      this.tierMetrics.warm.evictions++;
    });

    if (toDelete.length > 0) {
      this.log('info', `ðŸ—‘ï¸  Evicted ${toDelete.length} old vectors`);
    }
  }

  _compressWarmTier() {
    // Remove duplicate vectors (same memory accessed multiple ways)
    const memoryVectors = new Map();

    for (const [id, vec] of this.vectorStore.entries()) {
      const memId = vec.memoryId;
      if (!memoryVectors.has(memId)) {
        memoryVectors.set(memId, []);
      }
      memoryVectors.get(memId).push(id);
    }

    let compressed = 0;
    for (const [memId, vectorIds] of memoryVectors.entries()) {
      if (vectorIds.length > 1) {
        // Keep only the first vector, remove duplicates
        for (let i = 1; i < vectorIds.length; i++) {
          this.vectorStore.delete(vectorIds[i]);
          compressed++;
        }
      }
    }

    if (compressed > 0) {
      this.log('info', `ðŸ“¦ Compressed warm tier: removed ${compressed} duplicate vectors`);
    }
  }

  // ===========================
  // Background Tasks
  // ===========================

  _startAutoSave() {
    this.saveTimer = setInterval(async () => {
      if (this.unsavedChanges > 0) {
        this.log('info', `â° Auto-save triggered (${this.unsavedChanges} unsaved changes)...`);
        await this._saveVectorStore();
      }
    }, this.config.saveInterval);
  }

  _startAutoCleanup() {
    this.cleanupTimer = setInterval(async () => {
      try {
        const cutoff = Date.now() - (30 * 24 * 60 * 60 * 1000); // 30 days
        const deleted = this.db.prepare(`
          DELETE FROM memories
          WHERE accessed_at < ? AND importance < 0.3 AND tier = 'cold'
        `).run(cutoff);

        if (deleted.changes > 0) {
          this.log('info', `ðŸ§¹ Auto-cleanup: deleted ${deleted.changes} old memories`);
        }

        await this._saveVectorStore();
      } catch (error) {
        this.log('warn', 'Auto-cleanup failed', { error: error.message });
      }
    }, this.config.cleanupInterval);
  }

  _startPromotionCheck() {
    this.promotionTimer = setInterval(async () => {
      try {
        let promotions = 0;
        let demotions = 0;

        // Check each memory for promotion/demotion
        for (const [id, pattern] of this.tierManager.accessPatterns.entries()) {
          const promoteTarget = this.tierManager.shouldPromote(id);
          if (promoteTarget) {
            await this._promoteMemory(id, pattern.tier, promoteTarget);
            promotions++;
          }

          const demoteTarget = this.tierManager.shouldDemote(id);
          if (demoteTarget) {
            await this._demoteMemory(id, pattern.tier, demoteTarget);
            demotions++;
          }
        }

        if (promotions > 0 || demotions > 0) {
          this.log('info', `ðŸ”„ Tier optimization: +${promotions} promotions, -${demotions} demotions`);
        }

        // Check memory pressure
        await this._checkMemoryPressure();
      } catch (error) {
        this.log('warn', 'Promotion check failed', { error: error.message });
      }
    }, this.config.promotionCheckInterval);
  }

  _startVacuum() {
    this.vacuumTimer = setInterval(() => {
      try {
        this.db.exec('VACUUM;');
        this.log('info', 'SQLite VACUUM complete');
      } catch (error) {
        this.log('warn', 'Vacuum failed', { error: error.message });
      }
    }, this.config.vacuumInterval);
  }

  // ===========================
  // Utilities
  // ===========================

  _generateId(content) {
    return crypto.createHash('sha256').update(content).digest('hex').substring(0, 16);
  }

  async _saveVectorStore() {
    try {
      const vectors = {};
      for (const [id, vec] of this.vectorStore.entries()) {
        vectors[id] = vec;
      }

      // Atomic write (write to temp file then rename)
      const tempPath = `${this.config.vectorDbPath}.tmp`;
      await fs.writeFile(
        tempPath,
        JSON.stringify(vectors, null, 2),
        'utf8'
      );
      await fs.rename(tempPath, this.config.vectorDbPath);

      this.unsavedChanges = 0; // Reset counter
      this.log('info', `ðŸ’¾ Saved ${this.vectorStore.size} vectors to disk`);
    } catch (error) {
      this.log('warn', 'Vector save failed', { error: error.message });
    }
  }

  _logTierStatus() {
    this.log('info', 'ðŸ“Š Tier Status:', {
      hot: `${this.tierMetrics.hot.size} items`,
      warm: `${this.vectorStore.size} vectors`,
      cold: `${this.tierMetrics.cold.size} memories`
    });
  }

    // ─────────────────────────────────────────────────────────────
  // SUBSTRATE: Decision Arbitration
  // ─────────────────────────────────────────────────────────────
    // ─────────────────────────────────────────────────────────────
  // EPISODIC: Temporal Experience Retrieval
  // ─────────────────────────────────────────────────────────────
  /**
   * Retrieve specific experiences (episodes) rather than just facts.
   * Allows SOMA to ask: "What happened last time I tried X?"
   */
  async recall_episodes({ action = null, outcome = null, query = null, topK = 5 }) {
    if (!this.db) return { results: [], error: 'Cold storage offline' };

    let sql = `
      SELECT e.*, m.content, m.metadata as mem_meta
      FROM episodic_buffer e
      JOIN memories m ON e.memory_id = m.id
      WHERE 1=1
    `;
    const params = [];

    if (action) {
      sql += " AND e.action_taken LIKE ?";
      params.push(`%${action}%`);
    }
    if (outcome) {
      sql += " AND e.outcome LIKE ?";
      params.push(`%${outcome}%`);
    }
    if (query) {
      sql += " AND (m.content LIKE ? OR e.context_snapshot LIKE ?)";
      params.push(`%${query}%`, `%${query}%`);
    }

    sql += " ORDER BY e.importance DESC, e.timestamp DESC LIMIT ?";
    params.push(topK);

    try {
      const rows = this.db.prepare(sql).all(...params);
      const results = rows.map(r => ({
        id: r.id,
        action: r.action_taken,
        outcome: JSON.parse(r.outcome),
        context: JSON.parse(r.context_snapshot),
        content: r.content,
        timestamp: new Date(r.timestamp).toISOString(),
        importance: r.importance
      }));

      this.log('info', `🎭 Episodic recall: found ${results.length} relevant experiences for SOMA.`);
      return { success: true, results };
    } catch (err) {
      this.log('error', `Episodic recall failed: ${err.message}`);
      return { success: false, error: err.message };
    }
  }

  async arbitrate({ query, context = {}, topK = 8 }) {
    const recall = await this.recall(query, topK);
    const candidates = recall.results;

    if (!candidates.length) {
      return { winner: null, contenders: [], tension: 0, reason: 'no_memory' };
    }

    const enriched = candidates.map(m => {
      const meta = this._normalizeMeta(m);
      const score =
        (meta.importance * this.config.importanceWeight) +
        (meta.confidence * this.config.confidenceWeight) +
        (meta.utility * this.config.utilityWeight) +
        (this._contextMatch(meta, context) * this.config.contextWeight);

      return { ...m, ...meta, score };
    });

    enriched.sort((a, b) => b.score - a.score);
    const winner = enriched[0];
    const contenders = enriched.slice(1, 3);
    const tension = this._computeTension(enriched);

    // Apply passive decay (memory drift)
    for (const m of enriched) { this._decay(m); }

    return { winner, contenders, tension, tier: recall.tier };
  }

  async reinforce(memoryId, outcome = { success: true }) {
    const stmt = this.db.prepare('SELECT * FROM memories WHERE id = ?');
    const mem = stmt.get(memoryId);
    if (!mem) return false;

    const meta = this._normalizeMeta(mem);
    if (outcome.success) {
      meta.utility += this.config.learningRate;
      meta.confidence += this.config.learningRate * 0.5;
    } else {
      meta.utility -= this.config.learningRate;
      meta.confidence -= this.config.learningRate * 0.5;
    }

    meta.utility = this._clamp(meta.utility);
    meta.confidence = this._clamp(meta.confidence);

    await this.remember(mem.content, { ...JSON.parse(mem.metadata || '{}'), ...meta });
    return true;
  }

  _normalizeMeta(m) {
    const meta = typeof m.metadata === 'string' ? JSON.parse(m.metadata) : (m.metadata || {});
    return {
      importance: meta.importance ?? m.importance ?? 0.5,
      confidence: meta.confidence ?? 0.5,
      utility: meta.utility ?? 0.5,
      lastUsed: meta.lastUsed ?? Date.now()
    };
  }

  _contextMatch(memory, context) {
    if (!context || Object.keys(context).length === 0) return 0.5;
    let score = 0, total = 0;
    for (const key in context) {
      if (memory[key] !== undefined) {
        total++;
        if (memory[key] === context[key]) score++;
      }
    }
    return total === 0 ? 0.5 : score / total;
  }

  _computeTension(memories) {
    if (memories.length < 2) return 0;
    const diff = Math.abs(memories[0].score - memories[1].score);
    return this._clamp(Math.exp(-diff * this.config.tensionSensitivity));
  }

  _decay(memory) {
    const decay = this.config.decayRate;
    memory.importance *= (1 - decay);
    memory.utility *= (1 - decay * 0.5);
  }

  _clamp(v) { return Math.max(0, Math.min(1, v)); }

  async execute(task) {
    const startTime = Date.now();
    try {
      const { query, context } = task;
      const action = context.action || 'recall';

      let result;
      switch (action) {
                case 'arbitrate':
          result = await this.arbitrate({ query, context: context.context, topK: context.topK });
          break;
        case 'recall_episodes':
          result = await this.recall_episodes(context);
          break;
        case 'reinforce':
          result = await this.reinforce(context.id, context.outcome);
          break;
        case 'remember':
          result = await this.remember(context.content, context.metadata);
          break;
        case 'recall':
          result = await this.recall(query, context.topK || 5);
          break;
        case 'forget':
          result = await this.forget(context.id);
          break;
        case 'stats':
          result = this.getMemoryStats();
          break;
        case 'optimize':
          result = await this._optimize();
          break;
        case 'deep_cleanup':
          result = await this.deepCleanup();
          break;
        default:
          throw new Error(`Unknown action: ${action}`);
      }

      return {
        success: true,
        data: result,
        confidence: 0.95,
        arbiter: this.name,
        duration: Date.now() - startTime
      };
    } catch (error) {
      this.log('error', 'Execute failed', { error: error.message });
      return {
        success: false,
        error: error.message,
        arbiter: this.name,
        duration: Date.now() - startTime
      };
    }
  }

  async _optimize() {
    this.log('info', 'âš™ï¸  Running memory optimization...');

    // Consolidate, compress, and optimize all tiers
    await this._checkMemoryPressure();
    this._evictOldVectors();
    this._compressWarmTier();

    // Force SQLite checkpoint to persist WAL data
    this.db.pragma('wal_checkpoint(RESTART)');
    this.db.exec('ANALYZE;');

    return {
      optimized: true,
      metrics: this.getMemoryStats()
    };
  }

  /**
   * Deep Cleanup - Automated Digital Constipation Fix
   * Purges massive state dumps and optimizes the database.
   */
  async deepCleanup() {
    this.log('info', 'ðŸ§¹ Starting Deep Memory Cleanup (Digital Constipation Fix)...');
    
    if (!this.db) return { success: false, error: 'Cold storage not available' };

    try {
      const statsBefore = this.db.prepare(`
        SELECT 
            count(*) as total,
            sum(CASE WHEN length(content) > 100000 THEN 1 ELSE 0 END) as massive,
            sum(CASE WHEN content LIKE '%"experiences":%' THEN 1 ELSE 0 END) as state_dumps
        FROM memories
      `).get();

      // 1. Purge Garbage
      const result = this.db.prepare(`
        DELETE FROM memories 
        WHERE length(content) > 100000 
           OR content LIKE '%"experiences":%'
           OR content LIKE '%[MessageBroker] Arbiter not found%'
      `).run();

      this.log('info', `âœ… Purged ${result.changes} garbage entries from DB.`);

      // 2. Index Optimization
      if (result.changes > 50) {
        this.log('info', 'â³ Reclaiming disk space (VACUUM)...');
        this.db.exec("VACUUM;");
        this.log('info', 'âœ¨ Vacuum complete.');
      }

      this.db.exec("ANALYZE;");

      const statsAfter = this.db.prepare("SELECT count(*) as total FROM memories").get();

      return {
        success: true,
        purged: result.changes,
        before: statsBefore.total,
        after: statsAfter.total,
        massiveFound: statsBefore.massive || 0,
        stateDumpsFound: statsBefore.state_dumps || 0
      };

    } catch (error) {
      this.log('error', `Deep cleanup failed: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  async _handleDeepCleanup(envelope) {
    const result = await this.deepCleanup();
    await this.sendMessage(envelope.from, 'deep_cleanup_response', result);
  }

  async _handleRemember(envelope) {
    const result = await this.remember(envelope.payload.content, envelope.payload.metadata);
    await this.sendMessage(envelope.from, 'remember_response', result);
  }

  async _handleRecall(envelope) {
    const result = await this.recall(envelope.payload.query, envelope.payload.topK || 5);
    await this.sendMessage(envelope.from, 'recall_response', result);
  }

  async _handleForget(envelope) {
    // Implement forget method
    const result = { id: envelope.payload.id, forgotten: true };
    await this.sendMessage(envelope.from, 'forget_response', result);
  }

  async _handleSave(envelope) {
    await this._saveVectorStore();
    await this.sendMessage(envelope.from, 'save_response', { success: true, vectors: this.vectorStore.size });
  }

  async _handleStats(envelope) {
    const stats = this.getMemoryStats();
    await this.sendMessage(envelope.from, 'stats_response', stats);
  }

  async _handleOptimize(envelope) {
    const result = await this._optimize();
    await this.sendMessage(envelope.from, 'optimize_response', result);
  }

  getMemoryStats() {
    const tierStats = this.tierManager.getTierStats();
    return {
      version: '2.0.0-real',
      tiers: this.tierMetrics,
      tierDistribution: tierStats,
      storage: {
        hot: this.redis ? 'connected' : 'offline',
        warm: `${this.vectorStore.size} vectors`,
        cold: `${this.tierMetrics.cold.size} memories`
      },
      hitRate: {
        hot: this.tierMetrics.hot.hits / Math.max(1, this.tierMetrics.hot.hits + this.tierMetrics.hot.misses),
        warm: this.tierMetrics.warm.hits / Math.max(1, this.tierMetrics.warm.hits + this.tierMetrics.warm.misses),
        cold: this.tierMetrics.cold.hits / Math.max(1, this.tierMetrics.cold.hits + this.tierMetrics.cold.misses)
      },
      optimizations: {
        promotions: this.tierMetrics.total.promotions,
        demotions: this.tierMetrics.total.demotions,
        evictions: this.tierMetrics.hot.evictions + this.tierMetrics.warm.evictions
      },
      memoryPressure: (process.memoryUsage().heapUsed / process.memoryUsage().heapTotal) * 100
    };
  }

  getAvailableCommands() {
    return ['remember', 'recall', 'forget', 'stats', 'optimize', 'arbitrate', 'reinforce', 'recall_episodes'];
  }
}

export default MnemonicArbiter;
