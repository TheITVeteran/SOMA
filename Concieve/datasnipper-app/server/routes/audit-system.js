const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const { 
  AuditOrchestrator, 
  AuditConfig,
  OrganizerAgent,
  DatabaseManager 
} = require('../services/auditSystem');
const { authenticateToken: auth } = require('../middleware/auth');

// Configure file upload
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadDir = './uploads/audit';
    await fs.mkdir(uploadDir, { recursive: true }).catch(() => {});
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: { 
    fileSize: 50 * 1024 * 1024, // 50MB limit
    files: 10 // Max 10 files at once
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /csv|xlsx|xls|pdf/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (extname || mimetype) {
      return cb(null, true);
    } else {
      cb(new Error('Only CSV, Excel, and PDF files are allowed'));
    }
  }
});

// Store active audit sessions
const activeSessions = new Map();

// Initialize audit system
const auditConfig = new AuditConfig({
  enableAI: true,
  dbPath: path.join(__dirname, '../../audit_database.db'),
  storageRoot: path.join(__dirname, '../../storage'),
  outputPath: path.join(__dirname, '../../audit_outputs'),
  tempPath: path.join(__dirname, '../../temp')
});

// WebSocket connections for progress updates
const progressConnections = new Map();

// Start audit analysis
router.post('/analyze', auth, upload.array('files', 10), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    const orchestrator = new AuditOrchestrator(auditConfig);
    
    // Set up progress callback
    if (req.headers['x-session-id']) {
      const sessionId = req.headers['x-session-id'];
      orchestrator.addProgressCallback((data) => {
        // Send progress via WebSocket if connected
        if (progressConnections.has(sessionId)) {
          progressConnections.get(sessionId).send(JSON.stringify(data));
        }
      });
    }

    // Get file paths
    const filepaths = req.files.map(file => file.path);
    
    // Run audit
    const results = await orchestrator.auditDocuments(
      filepaths, 
      req.body.auditType || 'comprehensive'
    );

    // Store session results
    activeSessions.set(results.session_id, results);

    // Clean up uploaded files after processing
    setTimeout(async () => {
      for (const filepath of filepaths) {
        try {
          await fs.unlink(filepath);
        } catch (error) {
          console.error('Failed to clean up file:', filepath);
        }
      }
    }, 60000); // Clean up after 1 minute

    res.json(results);
  } catch (error) {
    console.error('Audit error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get audit session results
router.get('/session/:sessionId', auth, async (req, res) => {
  try {
    const { sessionId } = req.params;
    
    if (activeSessions.has(sessionId)) {
      return res.json(activeSessions.get(sessionId));
    }

    // Try to load from database
    const dbManager = new DatabaseManager(auditConfig.dbPath);
    const session = await dbManager.get(
      'SELECT * FROM audit_sessions WHERE session_id = ?',
      [sessionId]
    );

    if (session) {
      const findings = await dbManager.all(
        'SELECT * FROM findings WHERE session_id = ?',
        [sessionId]
      );
      
      res.json({
        session,
        findings
      });
    } else {
      res.status(404).json({ error: 'Session not found' });
    }
  } catch (error) {
    console.error('Session retrieval error:', error);
    res.status(500).json({ error: error.message });
  }
});

// List audit sessions
router.get('/sessions', auth, async (req, res) => {
  try {
    const dbManager = new DatabaseManager(auditConfig.dbPath);
    const sessions = await dbManager.all(
      `SELECT session_id, start_time, end_time, status, risk_score, 
              files_processed, total_transactions 
       FROM audit_sessions 
       ORDER BY start_time DESC 
       LIMIT 50`
    );
    
    res.json(sessions);
  } catch (error) {
    console.error('Sessions list error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Export audit report
router.get('/export/:sessionId', auth, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const format = req.query.format || 'excel';
    
    if (!activeSessions.has(sessionId)) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const results = activeSessions.get(sessionId);
    const orchestrator = new AuditOrchestrator(auditConfig);
    
    if (format === 'excel') {
      const outputPath = path.join(
        auditConfig.outputPath, 
        `audit_report_${sessionId}.xlsx`
      );
      
      await orchestrator.exportToExcel(results, outputPath);
      
      res.download(outputPath, (err) => {
        if (err) {
          console.error('Download error:', err);
        }
        // Clean up file after download
        fs.unlink(outputPath).catch(() => {});
      });
    } else if (format === 'json') {
      res.json(results);
    } else {
      res.status(400).json({ error: 'Invalid format. Use excel or json' });
    }
  } catch (error) {
    console.error('Export error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Document management endpoints
router.post('/documents/ingest', auth, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const dbManager = new DatabaseManager(auditConfig.dbPath);
    const organizer = new OrganizerAgent(auditConfig, dbManager);
    
    const result = await organizer.ingestFile(req.file.path, {
      logicalName: req.body.logicalName || req.file.originalname,
      uploader: req.user?.id || 'system',
      tags: req.body.tags ? req.body.tags.split(',') : [],
      notes: req.body.notes || '',
      autoParse: req.body.autoParse !== 'false'
    });

    // Clean up temp file
    setTimeout(() => {
      fs.unlink(req.file.path).catch(() => {});
    }, 5000);

    res.json(result);
  } catch (error) {
    console.error('Document ingest error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Search documents
router.get('/documents/search', auth, async (req, res) => {
  try {
    const dbManager = new DatabaseManager(auditConfig.dbPath);
    const organizer = new OrganizerAgent(auditConfig, dbManager);
    
    const results = await organizer.searchDocuments({
      logicalName: req.query.name,
      uploader: req.query.uploader,
      tag: req.query.tag
    });
    
    res.json(results);
  } catch (error) {
    console.error('Document search error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get document details
router.get('/documents/:docId', auth, async (req, res) => {
  try {
    const dbManager = new DatabaseManager(auditConfig.dbPath);
    const organizer = new OrganizerAgent(auditConfig, dbManager);
    
    const document = await organizer.getDocument(parseInt(req.params.docId));
    
    if (document) {
      res.json(document);
    } else {
      res.status(404).json({ error: 'Document not found' });
    }
  } catch (error) {
    console.error('Document retrieval error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get findings for a session
router.get('/findings/:sessionId', auth, async (req, res) => {
  try {
    const dbManager = new DatabaseManager(auditConfig.dbPath);
    const findings = await dbManager.all(
      `SELECT * FROM findings 
       WHERE session_id = ? 
       ORDER BY severity DESC, created_at DESC`,
      [req.params.sessionId]
    );
    
    res.json(findings.map(f => ({
      ...f,
      metadata: JSON.parse(f.metadata || '{}')
    })));
  } catch (error) {
    console.error('Findings retrieval error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get audit statistics
router.get('/statistics', auth, async (req, res) => {
  try {
    const dbManager = new DatabaseManager(auditConfig.dbPath);
    
    const stats = await dbManager.get(`
      SELECT 
        COUNT(*) as total_sessions,
        AVG(risk_score) as avg_risk_score,
        SUM(files_processed) as total_files_processed,
        SUM(total_transactions) as total_transactions_analyzed
      FROM audit_sessions
      WHERE status = 'completed'
    `);
    
    const recentHighRisk = await dbManager.all(`
      SELECT session_id, risk_score, start_time
      FROM audit_sessions
      WHERE risk_score >= 70 AND status = 'completed'
      ORDER BY start_time DESC
      LIMIT 5
    `);
    
    const findingsSummary = await dbManager.get(`
      SELECT 
        COUNT(CASE WHEN type = 'duplicate' THEN 1 END) as duplicates_total,
        COUNT(CASE WHEN type = 'outlier' THEN 1 END) as outliers_total,
        COUNT(CASE WHEN severity = 'high' THEN 1 END) as high_severity_total
      FROM findings
    `);
    
    res.json({
      ...stats,
      recentHighRisk,
      findingsSummary
    });
  } catch (error) {
    console.error('Statistics error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Progress updates can be handled via Socket.io in main server
// or polling the session endpoint

module.exports = router;