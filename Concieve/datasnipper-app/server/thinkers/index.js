/**
 * Thinkers Initialization
 *
 * Loads and initializes all domain-specific Thinkers
 */

const conceiveThinker = require('./ConceiveThinker');

class ThinkerManager {
  constructor() {
    this.thinkers = new Map();
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) {
      console.log('[THINKERS] Already initialized');
      return;
    }

    console.log('[THINKERS] Initializing domain thinkers...');

    try {
      // Initialize ConceiveThinker (Finance/Audit domain)
      await this.registerThinker('conceive', conceiveThinker);

      // Future thinkers can be added here:
      // await this.registerThinker('legal', legalThinker);
      // await this.registerThinker('medical', medicalThinker);

      this.initialized = true;
      console.log(`[THINKERS] ✅ ${this.thinkers.size} thinkers initialized`);

    } catch (error) {
      console.error('[THINKERS] Initialization error:', error);
      throw error;
    }
  }

  async registerThinker(name, thinkerInstance) {
    try {
      console.log(`[THINKERS] Registering ${name} thinker...`);

      // Initialize the thinker
      await thinkerInstance.default.initialize();

      // Store reference
      this.thinkers.set(name, thinkerInstance.default);

      console.log(`[THINKERS] ✓ ${name} thinker registered`);
    } catch (error) {
      console.error(`[THINKERS] Failed to register ${name}:`, error.message);
      // Don't throw - allow server to continue even if a thinker fails
    }
  }

  getThinker(name) {
    return this.thinkers.get(name);
  }

  getAllThinkers() {
    return Array.from(this.thinkers.values()).map(thinker => thinker.getStatus());
  }

  async shutdown() {
    console.log('[THINKERS] Shutting down thinkers...');

    for (const [name, thinker] of this.thinkers) {
      try {
        await thinker.shutdown();
        console.log(`[THINKERS] ✓ ${name} shut down`);
      } catch (error) {
        console.error(`[THINKERS] Error shutting down ${name}:`, error);
      }
    }

    this.thinkers.clear();
    this.initialized = false;
  }
}

// Export singleton
const thinkerManager = new ThinkerManager();
module.exports = thinkerManager;
