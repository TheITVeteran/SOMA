const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const { RAGService, RAGAuditIntegration } = require('../services/ragSystem');
const { AuditOrchestrator, AuditConfig } = require('../services/auditSystem');
const { authenticateToken: auth } = require('../middleware/auth');

// Initialize RAG service
const ragService = new RAGService({
  dbPath: path.join(__dirname, '../../audit_database.db'),
  contextWindow: 5,
  maxTokens: 3000
});

// Initialize audit system for integration
const auditConfig = new AuditConfig({
  dbPath: path.join(__dirname, '../../audit_database.db')
});
const auditOrchestrator = new AuditOrchestrator(auditConfig);

// Create RAG-Audit integration
const ragAudit = new RAGAuditIntegration(ragService, auditOrchestrator);

// Configure file upload
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadDir = './uploads/rag';
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
  limits: { fileSize: 50 * 1024 * 1024 }
});

// Query the RAG system with a question
router.post('/query', auth, async (req, res) => {
  try {
    const { question, projectId, sessionId } = req.body;
    
    if (!question) {
      return res.status(400).json({ error: 'Question is required' });
    }

    let result;
    
    // If session ID provided, query with audit context
    if (sessionId) {
      result = await ragAudit.queryWithAuditContext(question, sessionId);
    } else {
      // Regular RAG query
      const projectContext = projectId ? { projectId } : {};
      result = await ragService.query(question, projectContext);
    }
    
    res.json(result);
  } catch (error) {
    console.error('RAG query error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Index a document for RAG
router.post('/index', auth, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Process document with audit system and index for RAG
    const result = await ragAudit.processAuditDocument(req.file.path, {
      uploader: req.user?.id || 'system',
      project_id: req.body.projectId,
      tags: req.body.tags ? req.body.tags.split(',') : []
    });

    // Clean up temp file
    setTimeout(() => {
      fs.unlink(req.file.path).catch(() => {});
    }, 5000);

    res.json({
      message: 'Document indexed successfully',
      ...result
    });
  } catch (error) {
    console.error('Document indexing error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Search documents
router.get('/search', auth, async (req, res) => {
  try {
    const { query, projectId } = req.query;
    
    if (!query) {
      return res.status(400).json({ error: 'Search query is required' });
    }

    const results = await ragService.searchDocuments(query, {
      projectId
    });
    
    res.json(results);
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get document summary
router.get('/summary/:docId', auth, async (req, res) => {
  try {
    const { docId } = req.params;
    const summary = await ragService.getSummary(parseInt(docId));
    
    res.json({
      doc_id: docId,
      summary
    });
  } catch (error) {
    console.error('Summary error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Compare two documents
router.post('/compare', auth, async (req, res) => {
  try {
    const { docId1, docId2 } = req.body;
    
    if (!docId1 || !docId2) {
      return res.status(400).json({ error: 'Both document IDs are required' });
    }

    const comparison = await ragService.compareDocuments(docId1, docId2);
    
    res.json({
      doc_id_1: docId1,
      doc_id_2: docId2,
      comparison
    });
  } catch (error) {
    console.error('Comparison error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Analyze project with RAG
router.post('/analyze-project', auth, async (req, res) => {
  try {
    const { projectId, question } = req.body;
    
    if (!projectId || !question) {
      return res.status(400).json({ error: 'Project ID and question are required' });
    }

    const analysis = await ragService.analyzeProject(projectId, question);
    
    res.json({
      project_id: projectId,
      question,
      analysis
    });
  } catch (error) {
    console.error('Project analysis error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Batch index multiple documents
router.post('/batch-index', auth, upload.array('files', 10), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    const results = [];
    const projectId = req.body.projectId;
    
    for (const file of req.files) {
      try {
        const result = await ragAudit.processAuditDocument(file.path, {
          uploader: req.user?.id || 'system',
          project_id: projectId,
          filename: file.originalname
        });
        
        results.push({
          filename: file.originalname,
          ...result
        });
        
        // Clean up
        await fs.unlink(file.path).catch(() => {});
      } catch (error) {
        results.push({
          filename: file.originalname,
          error: error.message
        });
      }
    }
    
    res.json({
      message: `Processed ${results.length} documents`,
      results
    });
  } catch (error) {
    console.error('Batch indexing error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get RAG statistics
router.get('/stats', auth, async (req, res) => {
  try {
    const dbManager = ragService.dbManager;
    
    const stats = await dbManager.get(`
      SELECT 
        COUNT(DISTINCT doc_id) as total_documents,
        COUNT(*) as total_chunks,
        AVG(LENGTH(chunk_text)) as avg_chunk_size,
        MAX(created_at) as last_indexed
      FROM document_chunks
    `);
    
    const recentQueries = await dbManager.all(`
      SELECT COUNT(*) as query_count, DATE(created_at) as date
      FROM document_chunks
      WHERE created_at >= date('now', '-7 days')
      GROUP BY DATE(created_at)
      ORDER BY date DESC
    `);
    
    res.json({
      ...stats,
      recent_activity: recentQueries,
      rag_enabled: true,
      model: 'ollama'
    });
  } catch (error) {
    console.error('Stats error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Clear all indexed documents (admin only)
router.delete('/clear-index', auth, async (req, res) => {
  try {
    // Add admin check here if needed
    // if (req.user.role !== 'admin') {
    //   return res.status(403).json({ error: 'Admin access required' });
    // }
    
    const dbManager = ragService.dbManager;
    
    await dbManager.run('DELETE FROM chunk_embeddings');
    await dbManager.run('DELETE FROM document_chunks');
    
    res.json({
      message: 'Index cleared successfully'
    });
  } catch (error) {
    console.error('Clear index error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;