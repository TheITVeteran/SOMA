import { BaseArbiter } from './core/BaseArbiter.js';
import messageBroker from './core/MessageBroker.js';
import TimekeeperArbiter from './TimekeeperArbiter.js';
import StorageArbiter from './StorageArbiter.js';
import SomaArbiter from './SomaArbiter.js';
import ComputerControlArbiter from './ComputerControlArbiter.js';

class ArbiterCoordinator {
  constructor(config = {}) {
    this.config = config;
    this.arbiters = new Map();
    this.initialized = false;
    this.shutdownHooks = [];
    
    console.log('🎛️ ArbiterCoordinator initializing...');
  }

  async initialize() {
    if (this.initialized) {
      console.log('⚠️ ArbiterCoordinator already initialized');
      return;
    }

    try {
      // Initialize core arbiters
      await this.initializeTimekeeper();
      await this.initializeStorage();
      await this.initializeSoma();
      await this.initializeComputerControl();
      
      // Set up coordination
      this.setupCoordination();
      
      // Register shutdown hooks
      this.registerShutdownHooks();
      
      this.initialized = true;
      console.log('🎛️ ✅ ArbiterCoordinator initialization complete');
      console.log(`📊 Active arbiters: ${this.arbiters.size}`);
      
      // Start the autonomous systems!
      await this.startAutonomousOperations();
      
    } catch (error) {
      console.error('❌ ArbiterCoordinator initialization failed:', error.message);
      throw error;
    }
  }

  async initializeTimekeeper() {
    try {
      const timekeeper = new TimekeeperArbiter({
        name: 'ConceiveTimekeeper',
        maxConcurrent: 10,
        maxQueue: 200
      });
      
      await timekeeper.initialize();
      this.arbiters.set('timekeeper', timekeeper);
      
      console.log('⏰ ✅ TimekeeperArbiter initialized');
    } catch (error) {
      console.error('❌ TimekeeperArbiter initialization failed:', error.message);
      throw error;
    }
  }

  async initializeStorage() {
    try {
      const storage = new StorageArbiter({
        name: 'ConceiveStorage'
      });
      
      await storage.initialize();
      this.arbiters.set('storage', storage);
      
      console.log('📦 ✅ StorageArbiter initialized');
    } catch (error) {
      console.error('❌ StorageArbiter initialization failed:', error.message);
      throw error;
    }
  }

  async initializeSoma() {
    try {
      const soma = new SomaArbiter({
        name: 'ConceiveSoma',
        somaApiUrl: process.env.SOMA_API_URL || 'http://localhost:3001'
      });
      
      await soma.initialize();
      this.arbiters.set('soma', soma);
      
      console.log('🧠 ✅ SomaArbiter initialized');
    } catch (error) {
      console.warn('⚠️ SomaArbiter initialization warning:', error.message);
    }
  }

  async initializeComputerControl() {
    try {
      const ctrl = new ComputerControlArbiter({
        name: 'ConceiveControl'
      });
      
      await ctrl.initialize();
      this.arbiters.set('computer_control', ctrl);
      
      console.log('💻 ✅ ComputerControlArbiter initialized');
    } catch (error) {
      console.warn('⚠️ ComputerControlArbiter initialization warning:', error.message);
    }
  }

  setupCoordination() {
    // Listen for inter-arbiter communication
    messageBroker.on('arbiter.register', (name, entry) => {
      console.log(`📝 Arbiter registered: ${name}`);
    });

    // Set up coordination patterns
    this.setupFileProcessingWorkflow();
    this.setupDashboardIntegration();
    this.setupComplianceWorkflows();
    this.setupControlWorkflows();
  }

  setupFileProcessingWorkflow() {
    messageBroker.subscribe('coordinator', 'file_uploaded');
    messageBroker.subscribe('coordinator', 'analyze_file');
  }

  setupDashboardIntegration() {
    messageBroker.subscribe('coordinator', 'dashboard_update');
    messageBroker.subscribe('coordinator', 'metrics_update');
  }

  setupComplianceWorkflows() {
    messageBroker.subscribe('coordinator', 'compliance_check');
    messageBroker.subscribe('coordinator', 'audit_task');
  }

  setupControlWorkflows() {
    // Coordination for computer control tasks
    messageBroker.subscribe('coordinator', 'os_file_search');
    messageBroker.subscribe('coordinator', 'gui_action');
  }

  async startAutonomousOperations() {
    console.log('🤖 Starting autonomous operations...');
    
    // Notify all arbiters that autonomous mode is active
    await messageBroker.sendMessage({
      from: 'ArbiterCoordinator',
      to: 'broadcast',
      type: 'autonomous_mode_active',
      payload: {
        startTime: new Date().toISOString(),
        coordinator: 'ArbiterCoordinator',
        arbiters: Array.from(this.arbiters.keys())
      }
    });

    console.log('🤖 ✅ Autonomous operations started');
  }

  // ═══════════════════════════════════════════════════════════
  // PUBLIC API FOR INTEGRATION
  // ═══════════════════════════════════════════════════════════

  async handleFileUpload(filename, userId, metadata = {}) {
    try {
      const result = await messageBroker.sendMessage({
        from: 'ArbiterCoordinator',
        to: 'ConceiveTimekeeper',
        type: 'file_uploaded',
        payload: { filename, userId, metadata, timestamp: new Date().toISOString() }
      });
      return { success: true, queued: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // ═══════════════════════════════════════════════════════════
  // SHUTDOWN MANAGEMENT
  // ═══════════════════════════════════════════════════════════

  registerShutdownHooks() {
    process.on('SIGINT', () => this.gracefulShutdown('SIGINT'));
    process.on('SIGTERM', () => this.gracefulShutdown('SIGTERM'));
  }

  async gracefulShutdown(signal) {
    console.log(`🛑 Graceful shutdown initiated (${signal})...`);
    try {
      for (const [name, arbiter] of this.arbiters) {
        if (arbiter.shutdown) await arbiter.shutdown();
      }
      await messageBroker.shutdown();
      process.exit(0);
    } catch (error) {
      process.exit(1);
    }
  }
}

const arbiterCoordinator = new ArbiterCoordinator();

if (process.env.NODE_ENV !== 'test') {
  arbiterCoordinator.initialize().catch(error => {
    console.error('❌ Failed to initialize ArbiterCoordinator:', error);
    process.exit(1);
  });
}

export default arbiterCoordinator;
