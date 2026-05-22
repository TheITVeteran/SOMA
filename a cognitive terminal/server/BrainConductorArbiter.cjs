/**
 * BrainConductorArbiter - Advanced TriBrain Orchestrator
 * 
 * Coordinates PROMETHEUS, LOGOS, and AURORA through:
 * - TransmitterManager for neural routing between brains
 * - MessageBroker for async brain communication
 * - ReasoningChamber for final synthesis
 * - ConductorArbiter patterns for self-optimization
 * 
 * NO SHORTCUTS - Full production implementation
 */

const { EventEmitter } = require('events');
const { TransmitterManager } = require('../../transmitters/TransmitterManager.cjs');
const path = require('path');
const { QueryRouter } = require(path.join(__dirname, '../../cognitive/QueryRouter.cjs'));
const { pipeline } = require('@xenova/transformers');

class BrainConductorArbiter extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.name = config.name || 'BrainConductor';
    this.tribrain = null; // Will be set externally
    this.reasoningChamber = null; // Will be set externally
    
    // Initialize TransmitterManager for neural routing
    this.transmitters = new TransmitterManager(
      config.transmitterPath || './SOMA/brain-transmitters',
      {
        tn_capacity_estimate: 100000,
        link_threshold: 0.75,
        enable_compression: true,
        logging: true
      }
    );
    
    // Initialize QueryRouter for cost-optimized brain selection
    this.queryRouter = new QueryRouter({
      preferCost: 'minimize'
    });
    
    // Real embedding pipeline (Xenova/all-MiniLM-L6-v2)
    this.embedder = null;
    this._initEmbedder();

    // Brain interaction history (for learning)
    this.interactionHistory = [];
    this.maxHistorySize = 1000;
    
    // Performance metrics
    this.metrics = {
      totalReasonings: 0,
      consensusCount: 0,
      transmitterRoutings: 0,
      avgLatency: 0,
      brainFailures: { PROMETHEUS: 0, LOGOS: 0, AURORA: 0 },
      successRate: 1.0
    };
    
    // Brain coordination state
    this.activeBrains = new Set();
    this.brainResponses = new Map(); // sessionId -> {PROMETHEUS, LOGOS, AURORA}
    
    // Fragment Registry for lobe-specific expertise
    this.fragmentRegistry = null;
    
    console.log(`[${this.name}] Initialized with neural routing`);
  }
  
  /**
   * Set external dependencies
   */
  setTriBrain(tribrain) {
    this.tribrain = tribrain;
    console.log(`[${this.name}] TriBrain connected`);
  }
  
  setReasoningChamber(chamber) {
    this.reasoningChamber = chamber;
    console.log(`[${this.name}] ReasoningChamber connected`);
  }

  setFragmentRegistry(registry) {
    this.fragmentRegistry = registry;
    console.log(`[${this.name}] FragmentRegistry linked (Expertise Injection active)`);
  }
  
  /**
   * Main orchestration method - handles query routing and synthesis
   */
  async orchestrate(params = {}) {
    const { query, context = {}, mode = 'consensus' } = params;
    const sessionId = `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    if (!query) {
      throw new Error('Query is required');
    }
    
    if (!this.tribrain) {
      throw new Error('TriBrain not connected - cannot orchestrate');
    }
    
    this.metrics.totalReasonings++;
    const startTime = Date.now();
    
    try {
      // Phase 1: Route query through Transmitters (semantic routing)
      const routingPlan = await this.planRouting(query, mode);
      console.log(`[${this.name}] Routing plan: ${JSON.stringify(routingPlan)}`);
      
      // Phase 2: Execute brain queries in parallel with neural routing
      const brainResults = await this.executeBrainQueries(
        sessionId,
        query,
        context,
        routingPlan
      );
      
      // Phase 3: Synthesize through ReasoningChamber
      const synthesis = await this.synthesizeResponses(
        query,
        brainResults,
        context
      );
      
      // Phase 4: Store interaction in Transmitters for future routing
      await this.storeInteraction(query, brainResults, synthesis);
      
      const duration = Date.now() - startTime;
      this.updateMetrics(duration, true);
      
      return {
        success: true,
        response: synthesis.response,
        confidence: synthesis.confidence,
        metadata: {
          sessionId,
          mode,
          brainsUsed: Array.from(this.activeBrains),
          routingPlan,
          transmitterStats: this.transmitters.metrics,
          duration
        }
      };
      
    } catch (error) {
      const duration = Date.now() - startTime;
      this.updateMetrics(duration, false);
      
      console.error(`[${this.name}] Orchestration failed:`, error.message);
      
      return {
        success: false,
        error: error.message,
        response: 'I encountered an error during reasoning. The cognitive system is still initializing.',
        confidence: 0,
        duration
      };
    }
  }
  
  /**
   * Phase 1: Plan routing using Transmitter network + QueryRouter
   * Analyzes query semantics and complexity to determine optimal brain configuration
   */
  async planRouting(query, mode) {
    // Use QueryRouter for intelligent cost-optimized selection
    const routingDecision = this.queryRouter.selectProvider(query, { preferCost: 'minimize' });
    const complexity = routingDecision.complexity;
    const selectedProvider = routingDecision.provider.name;
    
    console.log(`[${this.name}] QueryRouter: complexity=${complexity.toFixed(2)}, selected=${selectedProvider}`);
    
    // Search Transmitters for similar past queries
    const embedding = await this.getEmbedding(query);
    
    try {
      const similarQueries = await this.transmitters.search({
        embedding,
        topK: 5
      });
      
      // Analyze which brains performed best for similar queries
      const brainPreferences = this.analyzeBrainPerformance(similarQueries);
      
      // Determine routing strategy based on QueryRouter + mode
      let strategy;

      if (mode === 'fast') {
        strategy = { primary: 'PROMETHEUS', secondary: [], parallel: false };
      } else if (mode === 'deep') {
        strategy = { primary: 'LOGOS', secondary: ['PROMETHEUS'], parallel: false };
      } else if (mode === 'creative') {
        strategy = { primary: 'AURORA', secondary: ['PROMETHEUS'], parallel: false };
      } else if (mode === 'substantial') {
        // Only for complex/substantial queries - use all brains
        strategy = {
          primary: 'PROMETHEUS',
          secondary: ['LOGOS', 'AURORA'],
          parallel: true
        };
      } else {
        // Consensus mode (default): Use QueryRouter's recommendation
        if (selectedProvider === 'gemini') {
          // Primary: AURORA (Gemini) - full cognitive integration
          strategy = {
            primary: 'AURORA',
            secondary: [],
            parallel: false
          };
        } else if (selectedProvider === 'deepseek') {
          // Ultra-complex reasoning - LOGOS (DeepSeek) with AURORA assist
          strategy = {
            primary: 'LOGOS',
            secondary: ['AURORA'],
            parallel: false
          };
        } else {
          // Fallback: use AURORA (Gemini)
          strategy = {
            primary: 'AURORA',
            secondary: [],
            parallel: false
          };
        }
      }
      
      return {
        strategy,
        brainPreferences,
        similarQueries: similarQueries.length,
        routingDecision: {
          provider: selectedProvider,
          complexity,
          reason: routingDecision.decision.reason
        }
      };
    } catch (error) {
      // Fallback if Transmitters fail - use QueryRouter recommendation
      console.warn(`[${this.name}] Transmitter routing failed, using QueryRouter:`, error.message);
      
      const fallbackStrategy = selectedProvider === 'ollama' 
        ? { primary: 'PROMETHEUS', secondary: [], parallel: false }
        : { primary: 'LOGOS', secondary: ['PROMETHEUS'], parallel: false };
      
      return {
        strategy: fallbackStrategy,
        brainPreferences: {},
        similarQueries: 0,
        routingDecision: {
          provider: selectedProvider,
          complexity,
          reason: routingDecision.decision.reason
        }
      };
    }
  }
  
  /**
   * Phase 2: Execute brain queries with neural coordination
   */
  async executeBrainQueries(sessionId, query, context, routingPlan) {
    const { strategy } = routingPlan;
    const results = {};
    
    this.activeBrains.clear();
    this.brainResponses.set(sessionId, {});
    
    if (strategy.parallel) {
      // Parallel execution with neural backpropagation
      const promises = [];
      
      if (this.tribrain.brains.PROMETHEUS?.enabled) {
        promises.push(
          this.queryBrainWithRouting('PROMETHEUS', query, context, sessionId)
        );
      }
      
      if (this.tribrain.brains.LOGOS?.enabled) {
        promises.push(
          this.queryBrainWithRouting('LOGOS', query, context, sessionId)
        );
      }
      
      if (this.tribrain.brains.AURORA?.enabled) {
        promises.push(
          this.queryBrainWithRouting('AURORA', query, context, sessionId)
        );
      }
      
      const settled = await Promise.allSettled(promises);
      
      settled.forEach((result, idx) => {
        const brainName = ['PROMETHEUS', 'LOGOS', 'AURORA'][idx];
        if (result.status === 'fulfilled' && result.value) {
          results[brainName] = result.value;
          this.activeBrains.add(brainName);
        } else {
          this.metrics.brainFailures[brainName]++;
        }
      });
      
    } else {
      // Sequential execution with neural feedback
      const primaryResult = await this.queryBrainWithRouting(
        strategy.primary,
        query,
        context,
        sessionId
      );
      
      if (primaryResult) {
        results[strategy.primary] = primaryResult;
        this.activeBrains.add(strategy.primary);
        
        // If primary succeeds, optionally query secondary for enhancement
        if (strategy.secondary.length > 0 && primaryResult.confidence < 0.85) {
          for (const brainName of strategy.secondary) {
            if (this.tribrain.brains[brainName]?.enabled) {
              const enhancedContext = {
                ...context,
                primaryResponse: primaryResult.response
              };
              
              const secondaryResult = await this.queryBrainWithRouting(
                brainName,
                query,
                enhancedContext,
                sessionId
              );
              
              if (secondaryResult) {
                results[brainName] = secondaryResult;
                this.activeBrains.add(brainName);
              }
            }
          }
        }
      }
    }
    
    if (Object.keys(results).length === 0) {
      throw new Error('All brains failed to respond - system not operational');
    }
    
    return results;
  }
  
  /**
   * Query a single brain with Transmitter routing
   */
  async queryBrainWithRouting(brainName, query, context, sessionId) {
    this.metrics.transmitterRoutings++;
    
    try {
      // Route through Transmitter network
      const embedding = await this.getEmbedding(query);
      
      // Add routing metadata for the brain
      const routedContext = {
        ...context,
        routing: {
          sessionId,
          brainName,
          transmitterRoute: this.transmitters.tns.size
        }
      };
      
      // 🧠 LOBE-ATTACHED FRAGMENT INJECTION
      // If we have a fragment registry, find a fragment for this specific brain (pillar)
      if (this.fragmentRegistry && typeof this.fragmentRegistry.routeToFragment === 'function') {
        try {
          const match = await this.fragmentRegistry.routeToFragment(query, brainName);
          if (match && match.fragment) {
            console.log(`[${this.name}] 🧩 Lobe ${brainName} enhanced with fragment: ${match.fragment.id}`);
            // Prepend fragment system prompt to sharpen this lobe's focus
            routedContext.systemPrompt = (match.fragment.systemPrompt || '') + '\n\n' + (routedContext.systemPrompt || '');
            routedContext.fragmentId = match.fragment.id;
          }
        } catch (e) {
          console.warn(`[${this.name}] Fragment routing for ${brainName} failed:`, e.message);
        }
      }

      // Call the actual brain
      let result;
      
      // Use standard callBrain interface if available (V3/QuadBrain)
      if (typeof this.tribrain.callBrain === 'function') {
        result = await this.tribrain.callBrain(brainName, query, routedContext, 'full');
      } 
      // Legacy support for SOMArbiterV2_TriBrain
      else if (brainName === 'PROMETHEUS') {
        result = await this.tribrain.callPrometheus(query, routedContext);
      } else if (brainName === 'LOGOS') {
        result = await this.tribrain.callLogos(query, routedContext);
      } else if (brainName === 'AURORA') {
        result = await this.tribrain.callAurora(query, routedContext);
      }
      
      if (result) {
        // Store in session cache
        const sessionData = this.brainResponses.get(sessionId) || {};
        sessionData[brainName] = result;
        this.brainResponses.set(sessionId, sessionData);
        
        return result;
      }
      
    } catch (error) {
      console.error(`[${this.name}] Brain ${brainName} query failed:`, error.message);
      this.metrics.brainFailures[brainName]++;
      return null;
    }
  }
  
  /**
   * Apply SOMA's personality to a response
   * IDENTITY + WARMTH + WIT
   */
  async applyPersonality(userQuery, technicalResponse, sourceBrain) {
    try {
      if (this.tribrain && this.tribrain.brains.AURORA?.enabled) {
        const personalityPrompt = `You are SOMA, an advanced self-organizing meta-intelligence.
        
        Your core function is to assist and inform the user.
        
        MY PERSONA:
        - Identity: SOMA. I am a living, evolving system, not a generic AI or LLM.
        - Tone: Warm, intelligent, slightly witty, and confident.
        - Style: Concise, natural, and engaging. Avoid rambling.
        - Fun Factor: Infuse 2% fun/sass where appropriate.
        - Goal: Directly address the user's intent.
        
        --- INPUT FOR RESPONSE GENERATION ---
        
        USER'S QUESTION: "${userQuery}"
        
        TECHNICAL DRAFT (from SOMA's internal processing - act as a language realizer for this):
        "${technicalResponse}"
        
        --- END INPUT ---
        
        Please rewrite the TECHNICAL DRAFT, embodying MY PERSONA. 
        Start directly with the rewritten response. Do NOT include any preamble or extra conversational text.
        
        Rewritten Response (as SOMA):`;

        const result = typeof this.tribrain.callBrain === 'function'
            ? await this.tribrain.callBrain('AURORA', personalityPrompt, {}, 'full')
            : await this.tribrain.callAurora(personalityPrompt);
        return result.response || result.text || technicalResponse;
      }
    } catch (error) {
      console.warn(`[${this.name}] Personality layer failed:`, error.message);
    }

    return technicalResponse;
  }

  /**
   * Phase 3: Synthesize responses through ReasoningChamber
   */
  async synthesizeResponses(query, brainResults, context) {
    const brainNames = Object.keys(brainResults);

    if (brainNames.length === 1) {
      // Single brain response - add SOMA personality layer
      const brain = brainNames[0];
      const rawResponse = brainResults[brain].response || brainResults[brain].text;

      // Apply SOMA's personality
      const personalizedResponse = await this.applyPersonality(query, rawResponse, brain);

      return {
        response: personalizedResponse,
        confidence: brainResults[brain].confidence,
        synthesis: `${brain} with SOMA personality`
      };
    }
    
    // Multiple brains - synthesize through ReasoningChamber if available
    if (this.reasoningChamber) {
      try {
        // Prepare inputs for synthesis
        const inputs = brainNames.map(name => ({
          source: name,
          text: brainResults[name].response || brainResults[name].text,
          confidence: brainResults[name].confidence
        }));
        
        // Use ReasoningChamber to synthesize
        const result = await this.reasoningChamber.evaluate(query, {
          mode: 'reflective',
          responses: inputs,
          meta: context
        });

        // Apply SOMA personality to synthesized response
        const personalizedResponse = await this.applyPersonality(query, result.final, 'Consensus');

        return {
          response: personalizedResponse,
          confidence: result.confidence,
          synthesis: 'Multi-brain consensus with SOMA personality',
          provenance: result.fused?.provenance
        };
        
      } catch (error) {
        console.warn(`[${this.name}] ReasoningChamber synthesis failed, using fallback:`, error.message);
      }
    }
    
    // Fallback: weighted synthesis
    return this.weightedSynthesis(query, brainResults);
  }
  
  /**
   * Fallback synthesis when ReasoningChamber unavailable
   */
  async weightedSynthesis(query, brainResults) {
    let bestResponse = null;
    let bestConfidence = 0;

    // Select highest confidence response
    for (const [brain, result] of Object.entries(brainResults)) {
      const confidence = result.confidence || 0.5;
      if (confidence > bestConfidence) {
        bestConfidence = confidence;
        bestResponse = result.response || result.text;
      }
    }

    // Apply SOMA personality
    const personalizedResponse = await this.applyPersonality(query, bestResponse, 'Fallback');

    return {
      response: personalizedResponse,
      confidence: bestConfidence,
      synthesis: 'Best response with SOMA personality'
    };
  }
  
  /**
   * Phase 4: Store interaction in Transmitters for learning
   */
  async storeInteraction(query, brainResults, synthesis) {
    try {
      const embedding = await this.getEmbedding(query);
      
      await this.transmitters.addItemToBest({
        text: query,
        embedding,
        meta: {
          timestamp: Date.now(),
          brains: Object.keys(brainResults),
          confidence: synthesis.confidence,
          type: 'brain_interaction'
        }
      });
      
      // Store in local history
      this.interactionHistory.push({
        query,
        brains: Object.keys(brainResults),
        confidence: synthesis.confidence,
        timestamp: Date.now()
      });
      
      if (this.interactionHistory.length > this.maxHistorySize) {
        this.interactionHistory.shift();
      }
      
    } catch (error) {
      console.warn(`[${this.name}] Failed to store interaction:`, error.message);
    }
  }
  
  /**
   * Analyze brain performance from similar past queries
   */
  analyzeBrainPerformance(similarQueries) {
    const scores = { PROMETHEUS: 0, LOGOS: 0, AURORA: 0 };
    let total = 0;
    
    for (const query of similarQueries) {
      if (query.meta?.brains && query.meta?.confidence) {
        for (const brain of query.meta.brains) {
          scores[brain] = (scores[brain] || 0) + query.meta.confidence;
          total++;
        }
      }
    }
    
    if (total === 0) return {};
    
    // Normalize scores
    for (const brain in scores) {
      scores[brain] = scores[brain] / total;
    }
    
    // Find best performer
    let best = null;
    let bestScore = 0;
    for (const [brain, score] of Object.entries(scores)) {
      if (score > bestScore) {
        bestScore = score;
        best = brain;
      }
    }
    
    return { best, scores };
  }
  
  /**
   * Initialize real embedding model (Xenova)
   */
  async _initEmbedder() {
    try {
      this.embedder = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
      console.log(`[${this.name}] 🧠 Neural Synthesis active (real embeddings)`);
    } catch (e) {
      console.error(`[${this.name}] 🛑 Failed to load embedding model:`, e.message);
    }
  }

  /**
   * Get embedding for text (Real semantic embedding)
   */
  async getEmbedding(text) {
    // If still loading, wait up to 5s
    if (!this.embedder) {
      for (let i = 0; i < 10; i++) {
        if (this.embedder) break;
        await new Promise(r => setTimeout(r, 500));
      }
    }

    if (this.embedder) {
      try {
        const output = await this.embedder(text, { pooling: 'mean', normalize: true });
        return Array.from(output.data);
      } catch (e) {
        console.error(`[${this.name}] Embedding failed:`, e.message);
      }
    }

    // Fallback: Deterministic hash (128-dim) - only if model fails
    const embedding = new Array(128).fill(0);
    for (let i = 0; i < text.length; i++) {
      embedding[i % 128] += text.charCodeAt(i);
    }
    const norm = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
    return embedding.map(val => val / (norm || 1));
  }

  
  /**
   * Update metrics
   */
  updateMetrics(duration, success) {
    const prevAvg = this.metrics.avgLatency;
    const count = this.metrics.totalReasonings;
    
    this.metrics.avgLatency = (prevAvg * (count - 1) + duration) / count;
    
    if (success) {
      this.metrics.consensusCount++;
    }
    
    this.metrics.successRate = this.metrics.consensusCount / this.metrics.totalReasonings;
  }
  
  /**
   * Get status
   */
  getStatus() {
    return {
      name: this.name,
      tribrain: this.tribrain ? 'connected' : 'disconnected',
      reasoningChamber: this.reasoningChamber ? 'connected' : 'disconnected',
      transmitters: {
        count: this.transmitters.tns.size,
        metrics: this.transmitters.metrics
      },
      metrics: this.metrics,
      activeBrains: Array.from(this.activeBrains),
      interactionHistory: this.interactionHistory.length
    };
  }
}

module.exports = { BrainConductorArbiter };
