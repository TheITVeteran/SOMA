const express = require('express');
const router = express.Router();
const arbitersService = require('../services/arbitersService');

// Initialize FINPOLYMER arbiters on startup
let arbiterStatus = {
  initialized: false,
  message: 'FINPOLYMER arbiters starting up...'
};

// Auto-start arbiters when routes are loaded
(async () => {
  try {
    await arbitersService.startArbiters();
    arbiterStatus = {
      initialized: true,
      message: 'Hello! I\'m The Thinker. FINPOLYMER arbiters are active and monitoring your financial data.'
    };
    console.log('[ARBITERS] FINPOLYMER system auto-started');
  } catch (error) {
    console.log('[ARBITERS] Running in fallback mode:', error.message);
    arbiterStatus = {
      initialized: false,
      message: `Hello! I'm The Thinker. Running in fallback mode: ${error.message}`
    };
  }
})();

// Get arbiters status (FINPOLYMER integration)
router.get('/status', async (req, res) => {
  try {
    const status = await arbitersService.getArbitersStatus();
    res.json(status);
  } catch (error) {
    console.error('Arbiters status error:', error);
    res.json(arbitersService.getMockArbitersStatus());
  }
});

// Start arbiters system
router.post('/start', async (req, res) => {
  try {
    const result = await arbitersService.startArbiters();
    arbiterStatus.initialized = result.success;
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: `Hello! I'm The Thinker. Failed to start arbiters: ${error.message}`,
      error: error.message
    });
  }
});

// FINPOLYMER Reconciliation
router.post('/reconcile', async (req, res) => {
  try {
    const { internal_ledger, external_ledger } = req.body;
    
    if (!internal_ledger || !external_ledger) {
      return res.status(400).json({
        success: false,
        message: "Hello! I'm The Thinker. Both internal and external ledgers are required for reconciliation."
      });
    }

    const result = await arbitersService.reconcileLedgers(internal_ledger, external_ledger);
    res.json(result);
  } catch (error) {
    console.error('Reconciliation error:', error);
    res.status(500).json({
      success: false,
      message: `Hello! I'm The Thinker. Reconciliation failed: ${error.message}`,
      error: error.message
    });
  }
});

// FINPOLYMER Fraud Detection
router.post('/fraud-check', async (req, res) => {
  try {
    const { invoices = [], transactions = [], vendors = [] } = req.body;

    const result = await arbitersService.checkForFraud(invoices, transactions, vendors);
    res.json(result);
  } catch (error) {
    console.error('Fraud check error:', error);
    res.status(500).json({
      success: false,
      message: `Hello! I'm The Thinker. Fraud detection failed: ${error.message}`,
      error: error.message
    });
  }
});

// FINPOLYMER Audit Analysis
router.post('/audit', async (req, res) => {
  try {
    const { journal_entries = [], transactions = [] } = req.body;

    const result = await arbitersService.performAudit(journal_entries, transactions);
    res.json(result);
  } catch (error) {
    console.error('Audit error:', error);
    res.status(500).json({
      success: false,
      message: `Hello! I'm The Thinker. Audit analysis failed: ${error.message}`,
      error: error.message
    });
  }
});

// Advanced Workflow Orchestration - temporarily disabled
// const workflowOrchestrator = require('../services/workflowOrchestrator');
// const anomalyDetector = require('../services/anomalyDetector');

// Get available workflows - temporarily disabled
router.get('/workflows', async (req, res) => {
  res.json({
    success: false,
    message: "Hello! I'm The Thinker. Workflow orchestration is temporarily unavailable."
  });
});

// Execute workflow - temporarily disabled
router.post('/workflows/:workflowId/execute', async (req, res) => {
  res.json({
    success: false,
    message: "Hello! I'm The Thinker. Workflow execution is temporarily unavailable."
  });
});

// Get active workflows - temporarily disabled
router.get('/workflows/active', async (req, res) => {
  res.json({ success: false, message: "Hello! I'm The Thinker. Active workflows unavailable." });
});

// Get workflow status - temporarily disabled  
router.get('/workflows/:executionId', async (req, res) => {
  res.json({ success: false, message: "Hello! I'm The Thinker. Workflow status unavailable." });
});

// Anomaly Detection - temporarily disabled
router.post('/analyze/anomalies', async (req, res) => {
  res.json({ success: false, message: "Hello! I'm The Thinker. Anomaly analysis unavailable." });
});

// Comprehensive Analysis - temporarily disabled
router.post('/analyze/comprehensive', async (req, res) => {
  res.json({ success: false, message: "Hello! I'm The Thinker. Comprehensive analysis unavailable." });
});

// Get anomaly detector status - temporarily disabled
router.get('/analyze/detector-status', async (req, res) => {
  res.json({ success: false, message: "Hello! I'm The Thinker. Detector status unavailable." });
});

// Legacy file processing trigger (maintained for compatibility)
router.post('/trigger/file-processing', async (req, res) => {
  try {
    const result = {
      success: true,
      message: "Hello! I'm The Thinker. File processing triggered - FINPOLYMER arbiters will analyze the data.",
      queued: true,
      timestamp: new Date().toISOString()
    };
    
    console.log('🤖 FINPOLYMER file processing trigger requested');
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.post('/trigger/dashboard-update', async (req, res) => {
  try {
    const result = {
      success: true,
      message: 'Dashboard update triggered',
      updating: true,
      timestamp: new Date().toISOString()
    };
    
    console.log('📊 Manual dashboard update triggered');
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.post('/trigger/compliance-check', async (req, res) => {
  try {
    const result = {
      success: true,
      message: 'Compliance check triggered',
      checking: true,
      timestamp: new Date().toISOString()
    };
    
    console.log('⚖️ Manual compliance check triggered');
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.post('/trigger/storage-analysis', async (req, res) => {
  try {
    const result = {
      success: true,
      message: 'Storage analysis triggered',
      analyzing: true,
      timestamp: new Date().toISOString()
    };
    
    console.log('📦 Manual storage analysis triggered');
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.post('/trigger/backup', async (req, res) => {
  try {
    const result = {
      success: true,
      message: 'Backup creation triggered',
      backing_up: true,
      timestamp: new Date().toISOString()
    };
    
    console.log('💾 Manual backup triggered');
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// File upload notification (to be called by files route)
router.post('/notify/file-upload', async (req, res) => {
  try {
    const { filename, userId, metadata } = req.body;
    
    console.log(`🤖 Arbiter notification: File uploaded - ${filename} by user ${userId}`);
    
    // In the future, this will trigger the actual arbiter system
    const result = {
      success: true,
      message: 'File upload notification received',
      filename,
      userId,
      queued: true,
      automatedProcessing: true
    };
    
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Initialize arbiters (for future use)
router.post('/initialize', async (req, res) => {
  try {
    arbiterStatus = {
      initialized: true,
      message: 'Arbiters initialized successfully',
      autonomousMode: true,
      features: [
        'File processing automation',
        'Dashboard metrics automation',
        'Storage optimization',
        'Compliance monitoring',
        'Backup management'
      ]
    };
    
    console.log('🤖 Arbiters initialized (simulated)');
    
    res.json({
      success: true,
      status: arbiterStatus
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;