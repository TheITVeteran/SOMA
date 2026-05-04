const express = require('express');
const multer = require('multer');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const { ingestFilePath } = require('../services/fileIndexer');
const { logActivity, createNotification, updateDailyMetrics } = require('./dashboard');

const router = express.Router();

// Database setup
const dbPath = path.join(__dirname, '../data/users.db');
const db = new sqlite3.Database(dbPath);

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Initialize files table
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS user_files (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_email TEXT NOT NULL,
    filename TEXT NOT NULL,
    original_name TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_size INTEGER NOT NULL,
    mime_type TEXT NOT NULL,
    upload_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    description TEXT,
    ai_processed INTEGER DEFAULT 0,
    ai_summary TEXT,
    tags TEXT DEFAULT '[]'
  )`);
});

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    // Create unique filename with timestamp
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, file.fieldname + '-' + uniqueSuffix + ext);
  }
});

const fileFilter = (req, file, cb) => {
  // Accept all file types; extraction is handled by the indexer.
  cb(null, true);
};

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB limit
  },
  fileFilter: fileFilter
});

// Upload single file with enhanced error handling
router.post('/upload', (req, res) => {
  console.log('[FILES] Upload request received');
  console.log('[FILES] Headers:', req.headers);
  console.log('[FILES] Content-Type:', req.get('Content-Type'));
  
  upload.single('file')(req, res, (err) => {
    if (err) {
      console.error('[FILES] Multer error:', err.message);
      return res.status(400).json({ 
        error: 'File upload failed', 
        details: err.message,
        code: err.code 
      });
    }
    
    if (!req.file) {
      console.log('[FILES] No file in request');
      console.log('[FILES] Body:', req.body);
      return res.status(400).json({ error: 'No file uploaded' });
    }
    
    console.log('[FILES] File uploaded successfully:', req.file.originalname);

    const defaultEmail = 'john@conceive.com'; // Current user
    const { description, tags } = req.body;
    
    const fileData = {
      user_email: defaultEmail,
      filename: req.file.filename,
      original_name: req.file.originalname,
      file_path: req.file.path,
      file_size: req.file.size,
      mime_type: req.file.mimetype,
      description: description || '',
      tags: JSON.stringify(tags ? tags.split(',').map(tag => tag.trim()) : [])
    };

    db.run(
      `INSERT INTO user_files (user_email, filename, original_name, file_path, file_size, mime_type, description, tags)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        fileData.user_email,
        fileData.filename,
        fileData.original_name,
        fileData.file_path,
        fileData.file_size,
        fileData.mime_type,
        fileData.description,
        fileData.tags
      ],
      function(err) {
        if (err) {
          console.error('Error saving file metadata:', err);
          // Clean up uploaded file if database insert fails
          fs.unlink(req.file.path, (unlinkErr) => {
            if (unlinkErr) console.error('Error removing file:', unlinkErr);
          });
          return res.status(500).json({ error: 'Error saving file' });
        }

        const savedFile = {
          id: this.lastID,
          ...fileData,
          upload_date: new Date().toISOString()
        };

        // Log activity and create notification
        logActivity(defaultEmail, 'file_upload', {
          filename: fileData.original_name,
          size: fileData.file_size,
          type: fileData.mime_type
        }, req);
        
        createNotification(
          defaultEmail,
          'File Uploaded Successfully',
          `${fileData.original_name} has been uploaded and is ready for AI analysis`,
          'success',
          '📄'
        );
        
        // Update daily metrics
        updateDailyMetrics(1, 0, 0, 1, 0);

        // Index uploaded file into SOMA (real processing)
        setTimeout(async () => {
          try {
            const result = await ingestFilePath({
              filePath: fileData.file_path,
              originalName: fileData.original_name,
              mimeType: fileData.mime_type
            });

            db.run(
              'UPDATE user_files SET ai_processed = 1, ai_summary = ? WHERE id = ?',
              [result.summary || '', this.lastID]
            );

            createNotification(
              defaultEmail,
              'SOMA Index Complete',
              `${fileData.original_name} indexed and searchable in War Room.`,
              'info',
              '🧠'
            );
          } catch (err) {
            console.error('[FILES] SOMA ingest failed:', err.message);
          }
        }, 500);

        res.status(201).json({
          message: 'File uploaded successfully - SOMA indexing queued',
          file: savedFile,
          autonomousProcessing: true
        });
      }
    );
  });
});

// Get user files
router.get('/my-files', (req, res) => {
  const defaultEmail = 'john@conceive.com';
  
  db.all(
    'SELECT * FROM user_files WHERE user_email = ? ORDER BY upload_date DESC',
    [defaultEmail],
    (err, files) => {
      if (err) {
        console.error('Error fetching files:', err);
        return res.status(500).json({ error: 'Error fetching files' });
      }
      
      // Parse tags JSON for each file
      const filesWithTags = files.map(file => ({
        ...file,
        tags: file.tags ? JSON.parse(file.tags) : [],
        file_size_mb: (file.file_size / (1024 * 1024)).toFixed(2)
      }));
      
      res.json(filesWithTags);
    }
  );
});

// Download file
router.get('/download/:fileId', (req, res) => {
  const fileId = req.params.fileId;
  const defaultEmail = 'john@conceive.com';
  
  db.get(
    'SELECT * FROM user_files WHERE id = ? AND user_email = ?',
    [fileId, defaultEmail],
    (err, file) => {
      if (err) {
        console.error('Error fetching file:', err);
        return res.status(500).json({ error: 'Error fetching file' });
      }
      
      if (!file) {
        return res.status(404).json({ error: 'File not found' });
      }
      
      // Check if file exists on disk
      if (!fs.existsSync(file.file_path)) {
        return res.status(404).json({ error: 'File not found on disk' });
      }
      
      res.download(file.file_path, file.original_name);
    }
  );
});

// Delete file
router.delete('/:fileId', (req, res) => {
  const fileId = req.params.fileId;
  const defaultEmail = 'john@conceive.com';
  
  db.get(
    'SELECT * FROM user_files WHERE id = ? AND user_email = ?',
    [fileId, defaultEmail],
    (err, file) => {
      if (err) {
        console.error('Error fetching file:', err);
        return res.status(500).json({ error: 'Error fetching file' });
      }
      
      if (!file) {
        return res.status(404).json({ error: 'File not found' });
      }
      
      // Delete from database first
      db.run(
        'DELETE FROM user_files WHERE id = ?',
        [fileId],
        function(err) {
          if (err) {
            console.error('Error deleting file from database:', err);
            return res.status(500).json({ error: 'Error deleting file' });
          }
          
          // Delete file from disk
          fs.unlink(file.file_path, (unlinkErr) => {
            if (unlinkErr) {
              console.error('Error removing file from disk:', unlinkErr);
            }
          });
          
          res.json({ message: 'File deleted successfully' });
        }
      );
    }
  );
});

// Get file info for AI processing
router.get('/info/:fileId', (req, res) => {
  const fileId = req.params.fileId;
  const defaultEmail = 'john@conceive.com';
  
  db.get(
    'SELECT * FROM user_files WHERE id = ? AND user_email = ?',
    [fileId, defaultEmail],
    (err, file) => {
      if (err) {
        console.error('Error fetching file:', err);
        return res.status(500).json({ error: 'Error fetching file' });
      }
      
      if (!file) {
        return res.status(404).json({ error: 'File not found' });
      }
      
      res.json({
        ...file,
        tags: file.tags ? JSON.parse(file.tags) : [],
        file_size_mb: (file.file_size / (1024 * 1024)).toFixed(2)
      });
    }
  );
});

// Update file AI processing status
router.put('/:fileId/ai-status', (req, res) => {
  const fileId = req.params.fileId;
  const { ai_processed, ai_summary } = req.body;
  
  db.run(
    'UPDATE user_files SET ai_processed = ?, ai_summary = ? WHERE id = ?',
    [ai_processed ? 1 : 0, ai_summary || null, fileId],
    function(err) {
      if (err) {
        console.error('Error updating AI status:', err);
        return res.status(500).json({ error: 'Error updating file' });
      }
      
      res.json({ message: 'AI status updated successfully' });
    }
  );
});

module.exports = router;
