const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const sqlite3 = require('sqlite3').verbose();
const { promisify } = require('util');
const ExcelJS = require('exceljs');
const pdf = require('pdf-parse');
const csv = require('csv-parser');
const { createReadStream } = require('fs');

// Import Ollama service for AI operations
const ollamaService = require('./ollamaService');

class DatabaseManager {
  constructor(dbPath = 'audit_database.db') {
    this.dbPath = dbPath;
    this.db = null;
    this.initDatabase();
  }

  async initDatabase() {
    return new Promise((resolve, reject) => {
      this.db = new sqlite3.Database(this.dbPath, (err) => {
        if (err) {
          console.error('Error opening database:', err);
          reject(err);
        } else {
          this.createTables().then(resolve).catch(reject);
        }
      });
    });
  }

  async createTables() {
    const queries = [
      `CREATE TABLE IF NOT EXISTS audit_sessions (
        session_id TEXT PRIMARY KEY,
        start_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        end_time TIMESTAMP,
        status TEXT,
        risk_score REAL,
        compliance_score REAL,
        files_processed INTEGER,
        total_transactions INTEGER,
        metadata TEXT
      )`,
      `CREATE TABLE IF NOT EXISTS findings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT,
        type TEXT,
        severity TEXT,
        amount REAL,
        description TEXT,
        metadata TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (session_id) REFERENCES audit_sessions(session_id)
      )`,
      `CREATE TABLE IF NOT EXISTS documents_index (
        doc_id INTEGER PRIMARY KEY AUTOINCREMENT,
        logical_name TEXT,
        uploader TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        latest_version_id INTEGER,
        doc_tags TEXT,
        doc_notes TEXT,
        checksum TEXT,
        UNIQUE(logical_name, uploader)
      )`,
      `CREATE TABLE IF NOT EXISTS document_versions (
        version_id INTEGER PRIMARY KEY AUTOINCREMENT,
        doc_id INTEGER,
        filename TEXT,
        storage_path TEXT,
        storage_backend TEXT DEFAULT 'filesystem',
        checksum TEXT,
        size_bytes INTEGER,
        mime_type TEXT,
        uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        parsed_reference TEXT,
        metadata TEXT,
        FOREIGN KEY(doc_id) REFERENCES documents_index(doc_id)
      )`,
      // Create indexes
      `CREATE INDEX IF NOT EXISTS idx_session ON findings(session_id)`,
      `CREATE INDEX IF NOT EXISTS idx_severity ON findings(severity)`,
      `CREATE INDEX IF NOT EXISTS idx_doc_checksum ON documents_index(checksum)`,
      `CREATE INDEX IF NOT EXISTS idx_version_checksum ON document_versions(checksum)`
    ];

    for (const query of queries) {
      await this.run(query);
    }
  }

  async run(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.run(sql, params, function(err) {
        if (err) reject(err);
        else resolve(this);
      });
    });
  }

  async get(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.get(sql, params, (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  async all(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }
}

class AuditConfig {
  constructor(options = {}) {
    this.chunkSize = options.chunkSize || 10000;
    this.maxWorkers = options.maxWorkers || 4;
    this.enableAI = options.enableAI !== false;
    this.materialityThreshold = options.materialityThreshold || 10000.0;
    this.varianceThreshold = options.varianceThreshold || 0.05;
    this.duplicateSimilarity = options.duplicateSimilarity || 0.95;
    this.dbPath = options.dbPath || 'audit_database.db';
    this.outputPath = options.outputPath || './audit_outputs/';
    this.tempPath = options.tempPath || './temp/';
    this.storageRoot = options.storageRoot || './storage/';
    
    this.approvalLimits = options.approvalLimits || {
      junior: 1000,
      senior: 10000,
      manager: 50000,
      director: 100000,
      cfo: Infinity
    };
    
    this.requiredFields = options.requiredFields || [
      'amount', 'date', 'vendor', 'invoice'
    ];

    // Create necessary directories
    this.initDirectories();
  }

  async initDirectories() {
    const dirs = [this.outputPath, this.tempPath, this.storageRoot];
    for (const dir of dirs) {
      await fs.mkdir(dir, { recursive: true }).catch(() => {});
    }
  }
}

class ParserAgent {
  constructor(config, dbManager) {
    this.config = config;
    this.db = dbManager;
  }

  async parseDocument(filepath, progress = null) {
    const fileType = this.detectFileType(filepath);
    
    switch(fileType) {
      case 'csv':
        return await this.parseCSV(filepath, progress);
      case 'excel':
        return await this.parseExcel(filepath, progress);
      case 'pdf':
        return await this.parsePDF(filepath, progress);
      default:
        return { error: `Unsupported file type: ${fileType}` };
    }
  }

  detectFileType(filepath) {
    const ext = path.extname(filepath).toLowerCase();
    const typeMap = {
      '.csv': 'csv',
      '.xlsx': 'excel',
      '.xls': 'excel',
      '.pdf': 'pdf'
    };
    return typeMap[ext] || 'unknown';
  }

  async parseCSV(filepath, progress) {
    return new Promise((resolve, reject) => {
      const results = [];
      const transactions = [];
      const stream = createReadStream(filepath);
      
      stream
        .pipe(csv())
        .on('data', (data) => {
          results.push(data);
          
          // Extract transactions if applicable
          const transaction = this.extractTransaction(data);
          if (transaction) {
            transactions.push(transaction);
          }
        })
        .on('end', () => {
          resolve({
            type: 'csv',
            transactions,
            statistics: this.calculateStatistics(results),
            metadata: {
              file: filepath,
              rows_processed: results.length
            }
          });
        })
        .on('error', reject);
    });
  }

  async parseExcel(filepath, progress) {
    try {
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.readFile(filepath);
      const results = {
        type: 'excel',
        sheets: {},
        transactions: [],
        metadata: {
          file: filepath
        }
      };

      workbook.eachSheet((worksheet, sheetId) => {
        const sheetName = worksheet.name;
        const data = [];

        // Convert worksheet to JSON
        worksheet.eachRow((row, rowNumber) => {
          if (rowNumber === 1) return; // Skip header row handled separately
          const rowData = {};
          row.eachCell((cell, colNumber) => {
            const header = worksheet.getRow(1).getCell(colNumber).value;
            rowData[header] = cell.value;
          });
          if (Object.keys(rowData).length > 0) {
            data.push(rowData);
          }
        });

        results.sheets[sheetName] = {
          rows: data.length,
          columns: data.length > 0 ? Object.keys(data[0]) : [],
          statistics: this.calculateStatistics(data)
        };

        // Extract transactions
        for (const row of data) {
          const transaction = this.extractTransaction(row);
          if (transaction) {
            results.transactions.push(transaction);
          }
        }
      });

      return results;
    } catch (error) {
      return { error: `Failed to parse Excel: ${error.message}` };
    }
  }

  async parsePDF(filepath, progress) {
    try {
      const dataBuffer = await fs.readFile(filepath);
      const data = await pdf(dataBuffer);
      
      // Use Ollama to extract structured data from PDF text
      const extractedData = await ollamaService.parseDocument(data.text, 'pdf');
      
      return {
        type: 'pdf',
        pages: data.numpages,
        text: data.text.substring(0, 1000), // First 1000 chars
        transactions: [], // PDF extraction would need more sophisticated parsing
        extractedData,
        metadata: {
          file: filepath,
          pages: data.numpages,
          info: data.info
        }
      };
    } catch (error) {
      return { error: `Failed to parse PDF: ${error.message}` };
    }
  }

  extractTransaction(row) {
    const transaction = {};
    let hasRequiredData = false;

    // Map common column names
    const columnMappings = {
      amount: ['amount', 'total', 'value', 'payment', 'price'],
      date: ['date', 'transaction_date', 'invoice_date', 'created'],
      vendor: ['vendor', 'supplier', 'payee', 'merchant'],
      description: ['description', 'memo', 'details', 'particular'],
      invoice: ['invoice', 'invoice_no', 'reference', 'document']
    };

    for (const [standard, variants] of Object.entries(columnMappings)) {
      for (const key of Object.keys(row)) {
        const keyLower = key.toLowerCase();
        if (variants.some(v => keyLower.includes(v))) {
          transaction[standard] = row[key];
          if (standard === 'amount' || standard === 'date') {
            hasRequiredData = true;
          }
          break;
        }
      }
    }

    return hasRequiredData ? transaction : null;
  }

  calculateStatistics(data) {
    if (!Array.isArray(data) || data.length === 0) {
      return {};
    }

    const stats = {
      row_count: data.length,
      column_count: Object.keys(data[0] || {}).length,
      numeric_columns: []
    };

    // Find numeric columns and calculate stats
    if (data.length > 0) {
      const firstRow = data[0];
      for (const column of Object.keys(firstRow)) {
        const values = data
          .map(row => parseFloat(row[column]))
          .filter(val => !isNaN(val));
        
        if (values.length > 0) {
          stats.numeric_columns.push({
            name: column,
            count: values.length,
            mean: values.reduce((a, b) => a + b, 0) / values.length,
            min: Math.min(...values),
            max: Math.max(...values)
          });
        }
      }
    }

    return stats;
  }
}

class AnalyzerAgent {
  constructor(config) {
    this.config = config;
  }

  async analyzeTransactions(transactions, progress = null) {
    if (!transactions || transactions.length === 0) {
      return this.emptyAnalysis();
    }

    const analysis = {
      statistics: this.calculateStatistics(transactions),
      anomalies: [],
      duplicates: await this.findDuplicates(transactions),
      outliers: this.detectOutliers(transactions),
      patterns: this.analyzePatterns(transactions),
      risk_score: 0,
      recommendations: []
    };

    // Use Ollama for advanced analysis
    if (this.config.enableAI) {
      const aiAnalysis = await ollamaService.analyzeData(transactions, 'financial');
      analysis.ai_insights = aiAnalysis;
    }

    // Calculate risk score
    analysis.risk_score = this.calculateRiskScore(analysis);
    
    // Generate recommendations
    analysis.recommendations = await this.generateRecommendations(analysis);

    return analysis;
  }

  emptyAnalysis() {
    return {
      statistics: {},
      anomalies: [],
      duplicates: [],
      outliers: [],
      patterns: {},
      risk_score: 0,
      recommendations: ['No transactions to analyze']
    };
  }

  calculateStatistics(transactions) {
    const amounts = transactions
      .map(t => parseFloat(t.amount))
      .filter(a => !isNaN(a));

    if (amounts.length === 0) {
      return { total_transactions: transactions.length };
    }

    return {
      total_transactions: transactions.length,
      amount_stats: {
        total: amounts.reduce((a, b) => a + b, 0),
        mean: amounts.reduce((a, b) => a + b, 0) / amounts.length,
        min: Math.min(...amounts),
        max: Math.max(...amounts)
      }
    };
  }

  async findDuplicates(transactions) {
    const duplicates = [];
    const seen = new Map();

    for (let i = 0; i < transactions.length; i++) {
      const t = transactions[i];
      const key = `${t.amount}_${t.date}_${t.vendor || ''}`;
      
      if (seen.has(key)) {
        duplicates.push({
          type: 'exact_duplicate',
          indices: [seen.get(key), i],
          amount: t.amount,
          confidence: 0.95
        });
      } else {
        seen.set(key, i);
      }
    }

    return duplicates.slice(0, 100); // Limit for performance
  }

  detectOutliers(transactions) {
    const amounts = transactions
      .map((t, idx) => ({ amount: parseFloat(t.amount), index: idx }))
      .filter(a => !isNaN(a.amount));

    if (amounts.length < 10) return [];

    const values = amounts.map(a => a.amount).sort((a, b) => a - b);
    const q1 = values[Math.floor(values.length * 0.25)];
    const q3 = values[Math.floor(values.length * 0.75)];
    const iqr = q3 - q1;
    const lowerBound = q1 - 1.5 * iqr;
    const upperBound = q3 + 1.5 * iqr;

    return amounts
      .filter(a => a.amount < lowerBound || a.amount > upperBound)
      .slice(0, 50)
      .map(a => ({
        type: 'iqr_outlier',
        index: a.index,
        amount: a.amount,
        lower_bound: lowerBound,
        upper_bound: upperBound,
        severity: a.amount > upperBound * 2 ? 'high' : 'medium'
      }));
  }

  analyzePatterns(transactions) {
    const patterns = {};
    const amounts = transactions
      .map(t => parseFloat(t.amount))
      .filter(a => !isNaN(a) && a > 0);

    if (amounts.length > 0) {
      // Round number analysis
      const round100 = amounts.filter(a => a % 100 === 0).length;
      const round1000 = amounts.filter(a => a % 1000 === 0).length;
      
      patterns.round_numbers = {
        round_100_pct: (round100 / amounts.length) * 100,
        round_1000_pct: (round1000 / amounts.length) * 100,
        suspicious: (round100 / amounts.length) > 0.2
      };
    }

    return patterns;
  }

  calculateRiskScore(analysis) {
    let riskScore = 0;
    
    // Weight different factors
    const weights = {
      duplicates: 5,
      high_outliers: 10,
      suspicious_patterns: 15,
      round_numbers: 10
    };

    if (analysis.duplicates.length > 0) {
      riskScore += Math.min(analysis.duplicates.length, 10) * weights.duplicates;
    }

    const highOutliers = analysis.outliers.filter(o => o.severity === 'high');
    if (highOutliers.length > 0) {
      riskScore += Math.min(highOutliers.length, 5) * weights.high_outliers;
    }

    if (analysis.patterns.round_numbers?.suspicious) {
      riskScore += weights.round_numbers;
    }

    return Math.min(100, riskScore);
  }

  async generateRecommendations(analysis) {
    const recommendations = [];
    const riskScore = analysis.risk_score;

    if (riskScore >= 70) {
      recommendations.push("HIGH RISK: Immediate detailed review required");
    } else if (riskScore >= 40) {
      recommendations.push("MODERATE RISK: Schedule review within 5 business days");
    }

    if (analysis.duplicates.length > 5) {
      recommendations.push(`Review ${analysis.duplicates.length} potential duplicate transactions`);
    }

    if (analysis.outliers.length > 0) {
      recommendations.push(`Investigate ${analysis.outliers.length} outlier transactions`);
    }

    // Get AI-powered recommendations if available
    if (this.config.enableAI && analysis.ai_insights) {
      try {
        const aiRecs = await ollamaService.reviewCompliance(analysis, 'audit');
        recommendations.push(aiRecs);
      } catch (error) {
        console.error('AI recommendations error:', error);
      }
    }

    return recommendations;
  }
}

class OrganizerAgent {
  constructor(config, dbManager) {
    this.config = config;
    this.db = dbManager;
    this.storageRoot = config.storageRoot;
  }

  async ingestFile(sourcePath, metadata = {}) {
    const {
      logicalName = path.basename(sourcePath),
      uploader = 'system',
      tags = [],
      notes = '',
      autoParse = true
    } = metadata;

    // Calculate checksum
    const checksum = await this.calculateChecksum(sourcePath);
    const fileSize = (await fs.stat(sourcePath)).size;
    const mimeType = this.getMimeType(sourcePath);

    // Check for duplicates
    const existing = await this.db.get(
      'SELECT * FROM document_versions WHERE checksum = ?',
      [checksum]
    );

    if (existing) {
      return {
        status: 'duplicate',
        existing: existing
      };
    }

    // Create storage path
    const now = new Date();
    const destSubdir = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}`;
    const destDir = path.join(this.storageRoot, destSubdir);
    await fs.mkdir(destDir, { recursive: true });

    const destName = `${checksum.substring(0, 12)}_${path.basename(sourcePath)}`;
    const destPath = path.join(destDir, destName);

    // Copy file to storage
    await fs.copyFile(sourcePath, destPath);

    // Register in database
    const docId = await this.registerDocument(logicalName, uploader, checksum, tags, notes);
    const versionId = await this.registerVersion(
      docId,
      path.basename(sourcePath),
      destPath,
      checksum,
      fileSize,
      mimeType
    );

    return {
      status: 'ingested',
      doc_id: docId,
      version_id: versionId,
      storage_path: destPath,
      checksum: checksum
    };
  }

  async calculateChecksum(filepath) {
    const hash = crypto.createHash('sha256');
    const stream = createReadStream(filepath);
    
    return new Promise((resolve, reject) => {
      stream.on('data', data => hash.update(data));
      stream.on('end', () => resolve(hash.digest('hex')));
      stream.on('error', reject);
    });
  }

  getMimeType(filepath) {
    const ext = path.extname(filepath).toLowerCase();
    const mimeTypes = {
      '.csv': 'text/csv',
      '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      '.xls': 'application/vnd.ms-excel',
      '.pdf': 'application/pdf'
    };
    return mimeTypes[ext] || 'application/octet-stream';
  }

  async registerDocument(logicalName, uploader, checksum, tags, notes) {
    const existing = await this.db.get(
      'SELECT doc_id FROM documents_index WHERE logical_name = ? AND uploader = ?',
      [logicalName, uploader]
    );

    if (existing) {
      await this.db.run(
        'UPDATE documents_index SET checksum = ?, doc_tags = ?, doc_notes = ? WHERE doc_id = ?',
        [checksum, JSON.stringify(tags), notes, existing.doc_id]
      );
      return existing.doc_id;
    }

    const result = await this.db.run(
      `INSERT INTO documents_index (logical_name, uploader, doc_tags, doc_notes, checksum)
       VALUES (?, ?, ?, ?, ?)`,
      [logicalName, uploader, JSON.stringify(tags), notes, checksum]
    );
    
    return result.lastID;
  }

  async registerVersion(docId, filename, storagePath, checksum, sizeBytes, mimeType) {
    const result = await this.db.run(
      `INSERT INTO document_versions 
       (doc_id, filename, storage_path, checksum, size_bytes, mime_type, metadata)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [docId, filename, storagePath, checksum, sizeBytes, mimeType, '{}']
    );

    await this.db.run(
      'UPDATE documents_index SET latest_version_id = ? WHERE doc_id = ?',
      [result.lastID, docId]
    );

    return result.lastID;
  }

  async searchDocuments(criteria = {}) {
    let query = 'SELECT * FROM documents_index WHERE 1=1';
    const params = [];

    if (criteria.logicalName) {
      query += ' AND logical_name LIKE ?';
      params.push(`%${criteria.logicalName}%`);
    }

    if (criteria.uploader) {
      query += ' AND uploader = ?';
      params.push(criteria.uploader);
    }

    if (criteria.tag) {
      query += ' AND doc_tags LIKE ?';
      params.push(`%${criteria.tag}%`);
    }

    query += ' LIMIT 100';
    
    const results = await this.db.all(query, params);
    
    return results.map(r => ({
      ...r,
      doc_tags: JSON.parse(r.doc_tags || '[]')
    }));
  }

  async getDocument(docId) {
    const doc = await this.db.get(
      'SELECT * FROM documents_index WHERE doc_id = ?',
      [docId]
    );

    if (!doc) return null;

    const versions = await this.db.all(
      'SELECT * FROM document_versions WHERE doc_id = ? ORDER BY uploaded_at DESC',
      [docId]
    );

    return {
      ...doc,
      doc_tags: JSON.parse(doc.doc_tags || '[]'),
      versions
    };
  }
}

class AuditOrchestrator {
  constructor(config = null) {
    this.config = config || new AuditConfig();
    this.dbManager = new DatabaseManager(this.config.dbPath);
    this.parser = new ParserAgent(this.config, this.dbManager);
    this.analyzer = new AnalyzerAgent(this.config);
    this.organizer = new OrganizerAgent(this.config, this.dbManager);
    this.sessionId = null;
    this.progressCallbacks = [];
  }

  addProgressCallback(callback) {
    this.progressCallbacks.push(callback);
  }

  notifyProgress(data) {
    this.progressCallbacks.forEach(cb => {
      try {
        cb(data);
      } catch (error) {
        console.error('Progress callback error:', error);
      }
    });
  }

  async auditDocuments(filepaths, auditType = 'comprehensive') {
    // Initialize session
    this.sessionId = crypto.randomBytes(8).toString('hex');
    await this.startSession();

    const results = {
      session_id: this.sessionId,
      status: 'in_progress',
      files_processed: 0,
      errors: [],
      warnings: [],
      parsed_data: [],
      analysis: null,
      report: null
    };

    try {
      // Step 1: Ingest and parse all documents
      const allTransactions = [];
      
      for (const filepath of filepaths) {
        try {
          this.notifyProgress({
            progress: (results.files_processed / filepaths.length) * 33,
            message: `Processing: ${path.basename(filepath)}`
          });

          // Ingest file
          const ingested = await this.organizer.ingestFile(filepath, {
            uploader: 'audit_system',
            tags: ['audit', auditType],
            autoParse: true
          });

          // Parse document
          const parsed = await this.parser.parseDocument(filepath);
          
          if (parsed.error) {
            results.errors.push({ file: filepath, error: parsed.error });
          } else {
            results.parsed_data.push(parsed);
            if (parsed.transactions) {
              allTransactions.push(...parsed.transactions);
            }
          }

          results.files_processed++;
        } catch (error) {
          console.error(`Failed to process ${filepath}:`, error);
          results.errors.push({ file: filepath, error: error.message });
        }
      }

      // Step 2: Analyze transactions
      if (allTransactions.length > 0) {
        this.notifyProgress({
          progress: 66,
          message: `Analyzing ${allTransactions.length} transactions`
        });

        results.analysis = await this.analyzer.analyzeTransactions(allTransactions);
        
        // Use Ollama for comprehensive analysis
        if (this.config.enableAI) {
          const projectData = {
            session_id: this.sessionId,
            total_transactions: allTransactions.length,
            files: filepaths.length
          };
          
          const aiSummary = await ollamaService.summarizeProject(projectData);
          results.analysis.ai_summary = aiSummary;
        }
      } else {
        results.warnings.push('No transactions found to analyze');
      }

      // Step 3: Generate report
      this.notifyProgress({
        progress: 90,
        message: 'Generating report'
      });
      
      results.report = await this.generateReport(results);
      
      // Complete session
      results.status = 'completed';
      await this.completeSession(results);
      
      this.notifyProgress({
        progress: 100,
        message: 'Audit complete'
      });

    } catch (error) {
      console.error('Audit failed:', error);
      results.status = 'failed';
      results.errors.push({ error: error.message });
      await this.failSession(error.message);
    }

    return results;
  }

  async startSession() {
    await this.dbManager.run(
      'INSERT INTO audit_sessions (session_id, status) VALUES (?, ?)',
      [this.sessionId, 'in_progress']
    );
  }

  async completeSession(results) {
    const riskScore = results.analysis?.risk_score || 0;
    const totalTransactions = results.analysis?.statistics?.total_transactions || 0;
    
    await this.dbManager.run(
      `UPDATE audit_sessions 
       SET end_time = CURRENT_TIMESTAMP, status = ?, risk_score = ?, 
           files_processed = ?, total_transactions = ?, metadata = ?
       WHERE session_id = ?`,
      ['completed', riskScore, results.files_processed, totalTransactions, 
       JSON.stringify(results), this.sessionId]
    );

    // Store findings
    if (results.analysis) {
      for (const duplicate of (results.analysis.duplicates || [])) {
        await this.dbManager.run(
          `INSERT INTO findings (session_id, type, severity, amount, description, metadata)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [this.sessionId, 'duplicate', 'medium', duplicate.amount || 0, 
           'Duplicate transaction detected', JSON.stringify(duplicate)]
        );
      }

      for (const outlier of (results.analysis.outliers || [])) {
        await this.dbManager.run(
          `INSERT INTO findings (session_id, type, severity, amount, description, metadata)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [this.sessionId, 'outlier', outlier.severity || 'low', outlier.amount || 0,
           'Outlier transaction detected', JSON.stringify(outlier)]
        );
      }
    }
  }

  async failSession(error) {
    await this.dbManager.run(
      `UPDATE audit_sessions 
       SET end_time = CURRENT_TIMESTAMP, status = ?
       WHERE session_id = ?`,
      [`failed: ${error}`, this.sessionId]
    );
  }

  async generateReport(results) {
    const report = {
      session_id: this.sessionId,
      timestamp: new Date().toISOString(),
      files_processed: results.files_processed,
      errors_count: results.errors.length,
      warnings_count: results.warnings.length
    };

    if (results.analysis) {
      report.summary = {
        risk_score: results.analysis.risk_score || 0,
        total_transactions: results.analysis.statistics?.total_transactions || 0,
        total_amount: results.analysis.statistics?.amount_stats?.total || 0,
        duplicates_found: results.analysis.duplicates?.length || 0,
        outliers_found: results.analysis.outliers?.length || 0,
        recommendations: results.analysis.recommendations || [],
        ai_summary: results.analysis.ai_summary
      };

      report.findings = {
        duplicates: (results.analysis.duplicates || []).slice(0, 10),
        outliers: (results.analysis.outliers || []).slice(0, 10),
        patterns: results.analysis.patterns || {}
      };
    }

    return report;
  }

  async exportToExcel(results, outputPath) {
    const workbook = new ExcelJS.Workbook();

    // Summary sheet
    const summaryData = [results.report?.summary || {}];
    const summarySheet = workbook.addWorksheet('Summary');
    if (summaryData.length > 0 && summaryData[0]) {
      const headers = Object.keys(summaryData[0]);
      summarySheet.addRow(headers);
      summaryData.forEach(row => {
        summarySheet.addRow(headers.map(h => row[h]));
      });
    }

    // Duplicates sheet
    if (results.analysis?.duplicates && results.analysis.duplicates.length > 0) {
      const dupSheet = workbook.addWorksheet('Duplicates');
      const headers = Object.keys(results.analysis.duplicates[0]);
      dupSheet.addRow(headers);
      results.analysis.duplicates.forEach(row => {
        dupSheet.addRow(headers.map(h => row[h]));
      });
    }

    // Outliers sheet
    if (results.analysis?.outliers && results.analysis.outliers.length > 0) {
      const outlierSheet = workbook.addWorksheet('Outliers');
      const headers = Object.keys(results.analysis.outliers[0]);
      outlierSheet.addRow(headers);
      results.analysis.outliers.forEach(row => {
        outlierSheet.addRow(headers.map(h => row[h]));
      });
    }

    await workbook.xlsx.writeFile(outputPath);
    console.log(`Report exported to ${outputPath}`);
  }
}

module.exports = {
  AuditConfig,
  AuditOrchestrator,
  DatabaseManager,
  ParserAgent,
  AnalyzerAgent,
  OrganizerAgent
};