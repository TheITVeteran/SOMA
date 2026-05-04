import { BaseArbiter } from './core/BaseArbiter.js';
import messageBroker from './core/MessageBroker.js';
import fetch from 'node-fetch';

export class ComputerControlArbiter extends BaseArbiter {
  static role = 'computer_control';
  static capabilities = ['file_search_os', 'gui_automation', 'system_tasks'];

  constructor(config = {}) {
    super({
      name: config.name || 'ComputerControlArbiter',
      role: ComputerControlArbiter.role,
      capabilities: ComputerControlArbiter.capabilities,
      ...config
    });
    
    this.controlApiUrl = config.controlApiUrl || 'http://localhost:8001';
  }

  async initialize() {
    await super.initialize();
    this.registerWithBroker();
    this._subscribeBrokerMessages();
    this.logger.info(`[${this.name}] 💻 Computer Control active (API: ${this.controlApiUrl})`);
  }

  registerWithBroker() {
    messageBroker.registerArbiter(this.name, this, { 
      type: ComputerControlArbiter.role,
      capabilities: ComputerControlArbiter.capabilities 
    });
  }

  _subscribeBrokerMessages() {
    messageBroker.subscribe(this.name, 'os_file_search');
    messageBroker.subscribe(this.name, 'gui_action');
  }

  async handleMessage(message = {}) {
    const { type, payload } = message;
    
    switch (type) {
      case 'os_file_search':
      case 'gui_action':
        return await this.executeRemoteTask(payload.query, payload.context);
      
      default:
        return { success: false, error: 'unknown_message_type' };
    }
  }

  async executeRemoteTask(query, context = {}) {
    try {
      const response = await fetch(`${this.controlApiUrl}/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, context })
      });

      if (!response.ok) {
          const err = await response.json();
          throw new Error(err.detail || 'Remote execution failed');
      }

      const result = await response.json();
      return result;
    } catch (error) {
      this.logger.error(`[${this.name}] Execution error: ${error.message}`);
      return { success: false, error: error.message };
    }
  }
}

export default ComputerControlArbiter;
