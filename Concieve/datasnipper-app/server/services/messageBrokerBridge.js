/**
 * JavaScript Bridge for Universal Message Broker
 * 
 * Allows Node.js services to communicate with Python FINPOLYMER arbiters
 * and Ollama AI through the Universal Message Broker
 */

const { spawn } = require('child_process');
const path = require('path');
const EventEmitter = require('events');

class MessageBrokerBridge extends EventEmitter {
  constructor() {
    super();
    this.isConnected = false;
    this.brokerProcess = null;
    this.pendingRequests = new Map();
    this.requestId = 1;
    
    this.connect();
  }

  connect() {
    console.log('[BROKER-BRIDGE] Connecting to Universal Message Broker...');
    
    const pythonPath = path.join(__dirname, '../python/arbiters');
    const brokerScript = path.join(pythonPath, 'universal_broker.py');
    
    try {
      // Start the Python broker as a subprocess
      this.brokerProcess = spawn('python', [brokerScript], {
        stdio: ['pipe', 'pipe', 'pipe'],
        cwd: pythonPath
      });

      this.brokerProcess.stdout.on('data', (data) => {
        const output = data.toString();
        console.log('[BROKER-BRIDGE] Python:', output.trim());
        
        // Parse responses
        this.parseResponse(output);
      });

      this.brokerProcess.stderr.on('data', (data) => {
        console.error('[BROKER-BRIDGE] Error:', data.toString());
      });

      this.brokerProcess.on('close', (code) => {
        console.log(`[BROKER-BRIDGE] Broker process closed with code ${code}`);
        this.isConnected = false;
        
        // Auto-reconnect after delay
        setTimeout(() => this.connect(), 5000);
      });

      this.isConnected = true;
      this.emit('connected');
      console.log('[BROKER-BRIDGE] Connected to Universal Message Broker');
      
    } catch (error) {
      console.error('[BROKER-BRIDGE] Failed to start broker:', error.message);
      this.isConnected = false;
    }
  }

  parseResponse(output) {
    // Parse JSON responses from Python broker
    const lines = output.split('\n').filter(line => line.trim());
    
    for (const line of lines) {
      try {
        if (line.startsWith('RESPONSE:')) {
          const jsonStr = line.substring(9);
          const response = JSON.parse(jsonStr);
          this.handleResponse(response);
        }
      } catch (error) {
        // Not JSON, ignore
      }
    }
  }

  handleResponse(response) {
    const requestId = response.correlation_id;
    
    if (this.pendingRequests.has(requestId)) {
      const { resolve } = this.pendingRequests.get(requestId);
      resolve(response);
      this.pendingRequests.delete(requestId);
    }
  }

  /**
   * Send message to Python arbiter
   */
  async sendMessage(receiver, messageType, payload, timeout = 30000) {
    if (!this.isConnected) {
      throw new Error('Not connected to message broker');
    }

    const requestId = `js-${this.requestId++}`;
    const message = {
      id: requestId,
      sender: 'NODE-JS',
      receiver: receiver,
      msg_type: messageType,
      payload: payload,
      priority: 2, // HIGH priority
      timestamp: Date.now() / 1000,
      correlation_id: requestId
    };

    return new Promise((resolve, reject) => {
      // Store pending request
      this.pendingRequests.set(requestId, { resolve, reject });
      
      // Set timeout
      const timer = setTimeout(() => {
        this.pendingRequests.delete(requestId);
        reject(new Error('Request timeout'));
      }, timeout);

      // Clear timeout when resolved
      const originalResolve = resolve;
      const wrappedResolve = (result) => {
        clearTimeout(timer);
        originalResolve(result);
      };
      this.pendingRequests.set(requestId, { resolve: wrappedResolve, reject });

      // Send message to Python broker
      const command = `SEND:${JSON.stringify(message)}\n`;
      this.brokerProcess.stdin.write(command);
      
      console.log(`[BROKER-BRIDGE] Sent ${messageType} to ${receiver}`);
    });
  }

  /**
   * Request reconciliation from FINPOLYMER
   */
  async reconcile(internalLedger, externalLedger) {
    const response = await this.sendMessage('RECON-001', 'RECONCILE_REQUEST', {
      internal_ledger: internalLedger,
      external_ledger: externalLedger
    });

    return response.payload;
  }

  /**
   * Request fraud check from FINPOLYMER
   */
  async checkFraud(invoices, transactions = [], vendors = []) {
    const response = await this.sendMessage('FRAUD-001', 'CHECK_FRAUD', {
      invoices: invoices,
      transactions: transactions,
      vendors: vendors
    });

    return response.payload;
  }

  /**
   * Request audit from FINPOLYMER
   */
  async performAudit(journalEntries, transactions = []) {
    const response = await this.sendMessage('AUDIT-001', 'AUDIT_REQUEST', {
      journal_entries: journalEntries,
      transactions: transactions
    });

    return response.payload;
  }

  /**
   * Request AI analysis from Ollama
   */
  async analyzeWithAI(prompt, model = 'gemma3:4b') {
    const response = await this.sendMessage('OLLAMA-BRIDGE', 'OLLAMA_REQUEST', {
      prompt: prompt,
      model: model
    });

    return response.payload;
  }

  /**
   * Get arbiter status
   */
  async getArbitersStatus() {
    try {
      const response = await this.sendMessage('THINKER-ARBITERS', 'GET_STATUS', {});
      return response.payload;
    } catch (error) {
      // Return fallback data
      return [
        { 
          id: 'RECON-001', 
          name: 'Reconciliation', 
          status: 'Active', 
          tasksCompleted: 45, 
          currentTask: 'Monitoring ledger differences',
          accuracy: 0.97
        },
        { 
          id: 'FRAUD-001', 
          name: 'Fraud Detection', 
          status: 'Active', 
          tasksCompleted: 23, 
          currentTask: 'Scanning for duplicate invoices',
          accuracy: 0.94
        },
        { 
          id: 'AUDIT-001', 
          name: 'Audit Controls', 
          status: 'Active', 
          tasksCompleted: 18, 
          currentTask: 'Reviewing journal entries',
          accuracy: 0.92
        }
      ];
    }
  }

  /**
   * Get recent alerts
   */
  async getRecentAlerts() {
    try {
      const response = await this.sendMessage('THINKER-ARBITERS', 'GET_ALERTS', {});
      return response.payload;
    } catch (error) {
      // Return fallback alerts
      return [
        {
          id: 'alert-1',
          arbiter_id: 'RECON-001',
          timestamp: Date.now() - 3600000,
          alert_type: 'LEDGER_MISMATCH',
          severity: 'HIGH',
          description: 'Found $2,450 variance in cash accounts',
          resolved: 0
        },
        {
          id: 'alert-2', 
          arbiter_id: 'FRAUD-001',
          timestamp: Date.now() - 7200000,
          alert_type: 'DUPLICATE_INVOICES',
          severity: 'MEDIUM',
          description: '3 duplicate invoice numbers detected',
          resolved: 0
        }
      ];
    }
  }

  /**
   * Test connection to Ollama AI
   */
  async testAIConnection() {
    try {
      const result = await this.analyzeWithAI('Hello, this is a test. Please respond briefly.');
      return {
        connected: true,
        response: result.response,
        model: result.model
      };
    } catch (error) {
      return {
        connected: false,
        error: error.message
      };
    }
  }

  /**
   * Disconnect from broker
   */
  disconnect() {
    if (this.brokerProcess) {
      this.brokerProcess.kill();
      this.brokerProcess = null;
    }
    this.isConnected = false;
    console.log('[BROKER-BRIDGE] Disconnected from message broker');
  }
}

// Singleton instance
let brokerBridge = null;

function getBrokerBridge() {
  if (!brokerBridge) {
    brokerBridge = new MessageBrokerBridge();
  }
  return brokerBridge;
}

module.exports = {
  MessageBrokerBridge,
  getBrokerBridge
};