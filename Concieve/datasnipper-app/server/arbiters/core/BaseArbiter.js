import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';

export class BaseArbiter {
  constructor(config = {}) {
    this.name = config.name || `${this.constructor.name}_${crypto.randomUUID().slice(0, 8)}`;
    this.role = config.role || 'unknown';
    this.capabilities = config.capabilities || [];
    this.config = config;
    
    // Logging
    this.logger = config.logger || console;
    
    // State
    this.initialized = false;
    this.lastActivity = Date.now();
    this.stats = {
      messagesProcessed: 0,
      tasksCompleted: 0,
      errors: 0,
      uptime: Date.now()
    };
    
    // Storage paths
    this.storagePath = config.storagePath || path.join(process.cwd(), 'arbiter-storage', this.name);
    this.ensureStoragePath();
  }

  async ensureStoragePath() {
    try {
      await fs.mkdir(this.storagePath, { recursive: true });
    } catch (error) {
      // Ignore if directory already exists
    }
  }

  async initialize() {
    this.initialized = true;
    this.lastActivity = Date.now();
    this.logger.info(`[${this.name}] ✅ BaseArbiter initialized`);
  }

  async handleMessage(message) {
    this.stats.messagesProcessed++;
    this.lastActivity = Date.now();
    
    // Override in child classes
    return { success: true, handled: false };
  }

  recordActivity(activity, data = {}) {
    this.lastActivity = Date.now();
    this.logger.info(`[${this.name}] Activity: ${activity}`, data);
  }

  recordError(error, context = {}) {
    this.stats.errors++;
    this.logger.error(`[${this.name}] Error: ${error.message}`, context);
  }

  getStatus() {
    return {
      name: this.name,
      role: this.role,
      capabilities: this.capabilities,
      initialized: this.initialized,
      lastActivity: this.lastActivity,
      uptime: Date.now() - this.stats.uptime,
      stats: this.stats
    };
  }

  async shutdown() {
    this.logger.info(`[${this.name}] 🛑 Shutting down...`);
    this.initialized = false;
  }
}