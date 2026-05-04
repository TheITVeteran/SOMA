import { BaseArbiter } from './core/BaseArbiter.js';
import messageBroker from './core/MessageBroker.js';
import fetch from 'node-fetch';

export class SomaArbiter extends BaseArbiter {
  static role = 'soma_intelligence';
  static capabilities = ['analyze_finance', 'audit', 'detect_fraud', 'chat', 'forecast'];
  
  constructor(config = {}) {
    super({
      name: config.name || 'SomaArbiter',
      role: SomaArbiter.role,
      capabilities: SomaArbiter.capabilities,
      ...config
    });
    
    // Real SOMA runs on 3001
    this.somaApiUrl = config.somaApiUrl || 'http://localhost:3001';
    this.logger.info(`[${this.name}] 🧠 SomaArbiter initializing (API: ${this.somaApiUrl})...`);
  }

  async initialize() {
    await super.initialize();
    
    // Check if SOMA service is available
    await this.checkSomaHealth();
    
    this.registerWithBroker();
    this._subscribeBrokerMessages();
    
    this.logger.info(`[${this.name}] ✅ SOMA Intelligence active`);
  }

  async checkSomaHealth() {
    try {
      const response = await fetch(`${this.somaApiUrl}/api/health`);
      if (response.ok) {
        const data = await response.json();
        this.logger.info(`[${this.name}] Connected to Real SOMA Engine (Status: ${data.status}, Uptime: ${data.uptime})`);
        return true;
      }
    } catch (error) {
      this.logger.warn(`[${this.name}] ⚠️ Could not connect to SOMA Engine at ${this.somaApiUrl}: ${error.message}. Please run the SOMA shortcut!`);
      return false;
    }
    return false;
  }

  registerWithBroker() {
    messageBroker.registerArbiter(this.name, this, { 
      type: SomaArbiter.role,
      capabilities: SomaArbiter.capabilities 
    });
  }

  _subscribeBrokerMessages() {
    messageBroker.subscribe(this.name, 'analyze_file');
    messageBroker.subscribe(this.name, 'audit_task');
    messageBroker.subscribe(this.name, 'fraud_check');
    messageBroker.subscribe(this.name, 'chat');
  }

  async handleMessage(message = {}) {
    const { type, payload } = message;
    
    switch (type) {
      case 'analyze_file':
        return await this.analyzeFile(payload);
      
      case 'audit_task':
        return await this.performAuditTask(payload);
        
      case 'fraud_check':
        return await this.detectFraud(payload);
        
      case 'chat':
        return await this.handleChat(payload);
        
      default:
        return { success: false, error: 'unknown_message_type' };
    }
  }
  
  // ═══════════════════════════════════════════════════════════
  // SOMA OPERATIONS
  // ═══════════════════════════════════════════════════════════

  async analyzeFile(payload) {
    const { content, filename, context } = payload;
    this.logger.info(`[${this.name}] 🧠 Analyzing file: ${filename}`);
    
    try {
      // Use SOMA's reasoning engine
      const response = await fetch(`${this.somaApiUrl}/api/reason`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: `Analyze this file (${filename}) for financial audit purposes. Identify risks, key figures, and compliance issues.`,
          mode: 'analytical',
          context: `FILE CONTENT:\n${content ? content.substring(0, 20000) : 'No content provided'}`,
          userId: 'system_arbiter'
        })
      });
      
      if (!response.ok) throw new Error(`SOMA API error: ${response.statusText}`);
      
      const data = await response.json();
      
      const result = {
          insight: data.response,
          confidence: data.confidence,
          brain: data.brain
      };
      
      // Broadcast result
      messageBroker.sendMessage({
        from: this.name,
        to: 'broadcast',
        type: 'analysis_complete',
        payload: {
          filename,
          result
        }
      });
      
      return { success: true, result };
      
    } catch (error) {
      this.logger.error(`[${this.name}] Analysis error: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  async performAuditTask(payload) {
    // Similar to analyzeFile but with specific context for general tasks
    return await this.analyzeFile({ ...payload });
  }
  
  async detectFraud(payload) {
    // Specialized fraud detection call
     const { content, filename } = payload;
     try {
      const response = await fetch(`${this.somaApiUrl}/api/reason`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: `Analyze this data for FRAUD. Look for anomalies, round numbers, duplicate payments, or suspicious vendors.`,
          mode: 'critical',
          context: `DATA:\n${content ? content.substring(0, 20000) : 'No content'}`,
          userId: 'fraud_arbiter'
        })
      });

      if (!response.ok) throw new Error(`SOMA API error: ${response.statusText}`);
      const data = await response.json();

      return { success: true, risk_assessment: data.response, confidence: data.confidence };

     } catch(error) {
         return { success: false, error: error.message };
     }
  }

  async handleChat(payload) {
    const { message, history } = payload;
    
    try {
      const response = await fetch(`${this.somaApiUrl}/api/reason`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
            query: message,
            context: history ? JSON.stringify(history) : '' 
        })
      });
      
      const data = await response.json();
      return { success: true, response: data.response };
      
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}

export default SomaArbiter;
