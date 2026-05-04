/**
 * BaseThinker - Foundation class for domain-specific Thinkers
 *
 * Thinkers are self-contained addons that enhance SOMA's core brains
 * with domain-specific intelligence (finance, legal, medical, etc.)
 *
 * Key Differences from Arbiters:
 * - Arbiters: General coordination and orchestration
 * - Thinkers: Domain expertise that LISTENS to SOMA and adds context
 */

import messageBroker from '../arbiters/core/MessageBroker.js';

export class BaseThinker {
  constructor(config = {}) {
    this.name = config.name || 'BaseThinker';
    this.domain = config.domain || 'general';
    this.capabilities = config.capabilities || [];
    this.enabled = config.enabled !== false; // Default enabled

    // Thinkers have their own knowledge bases
    this.knowledge = {};

    // Track what they learn
    this.insights = [];

    // Logger
    this.logger = config.logger || console;

    this.logger.info(`[${this.name}] 💭 ${this.domain} Thinker initializing...`);
  }

  /**
   * Initialize the thinker
   */
  async initialize() {
    if (!this.enabled) {
      this.logger.warn(`[${this.name}] Thinker is disabled - skipping initialization`);
      return;
    }

    // Load domain knowledge
    await this.loadKnowledge();

    // Register with message broker
    this.registerWithBroker();

    // Subscribe to relevant messages
    this._subscribeToMessages();

    this.logger.info(`[${this.name}] ✅ Thinker ready`);
  }

  /**
   * Load domain-specific knowledge
   * Override in child classes
   */
  async loadKnowledge() {
    this.logger.info(`[${this.name}] Loading domain knowledge...`);
    // Child classes implement this
  }

  /**
   * Register with message broker
   */
  registerWithBroker() {
    messageBroker.registerArbiter(this.name, this, {
      type: `thinker_${this.domain}`,
      capabilities: this.capabilities,
      isThinker: true
    });
  }

  /**
   * Subscribe to messages
   * Override to customize which messages to listen to
   */
  _subscribeToMessages() {
    // Default: listen to SOMA outputs to enhance them
    messageBroker.subscribe(this.name, 'analysis_complete');
    messageBroker.subscribe(this.name, 'reasoning_complete');
  }

  /**
   * Handle incoming messages
   * Override in child classes
   */
  async handleMessage(message = {}) {
    const { type, payload } = message;

    this.logger.info(`[${this.name}] Received message: ${type}`);

    // Default behavior: log and pass through
    return { success: true, processed: false };
  }

  /**
   * Enhance SOMA's output with domain context
   * Core method that child thinkers implement
   */
  async enhanceWithDomainKnowledge(somaOutput, context = {}) {
    this.logger.info(`[${this.name}] Enhancing output with ${this.domain} knowledge...`);

    // Child classes implement domain-specific enhancement
    return {
      ...somaOutput,
      thinkerEnhancement: {
        domain: this.domain,
        thinker: this.name,
        message: 'No enhancement implemented'
      }
    };
  }

  /**
   * Learn from interactions
   * Thinkers get smarter over time
   */
  async learn(interaction) {
    this.insights.push({
      timestamp: new Date(),
      interaction,
      domain: this.domain
    });

    // Keep last 1000 insights
    if (this.insights.length > 1000) {
      this.insights.shift();
    }
  }

  /**
   * Get thinker status
   */
  getStatus() {
    return {
      name: this.name,
      domain: this.domain,
      enabled: this.enabled,
      capabilities: this.capabilities,
      knowledgeLoaded: Object.keys(this.knowledge).length > 0,
      insightsCount: this.insights.length
    };
  }

  /**
   * Enable/disable thinker
   */
  toggle(enabled) {
    this.enabled = enabled;
    this.logger.info(`[${this.name}] Thinker ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Graceful shutdown
   */
  async shutdown() {
    this.logger.info(`[${this.name}] Shutting down thinker...`);

    // Save insights if needed
    await this.saveInsights();

    this.enabled = false;
  }

  /**
   * Save learned insights
   */
  async saveInsights() {
    // Child classes can implement persistence
  }
}

export default BaseThinker;
