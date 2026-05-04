const nodemailer = require('nodemailer');
const imaps = require('imap-simple');
const simpleParser = require('mailparser').simpleParser;
const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const { logActivity, createNotification } = require('../routes/dashboard');

class EmailIntegrationService {
  constructor() {
    this.dbPath = path.join(__dirname, '../data/users.db');
    this.db = new sqlite3.Database(this.dbPath);
    this.uploadsDir = path.join(__dirname, '../uploads');
    this.emailConfig = null;
    this.isMonitoring = false;
    
    this.initializeTables();
  }

  initializeTables() {
    this.db.serialize(() => {
      // Email configurations table
      this.db.run(`CREATE TABLE IF NOT EXISTS email_configs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_email TEXT NOT NULL,
        email_address TEXT NOT NULL,
        imap_host TEXT NOT NULL,
        imap_port INTEGER DEFAULT 993,
        imap_secure INTEGER DEFAULT 1,
        email_password TEXT NOT NULL,
        project_id TEXT,
        auto_process INTEGER DEFAULT 1,
        keywords TEXT DEFAULT '[]',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        is_active INTEGER DEFAULT 1
      )`);
      
      // Email processing log
      this.db.run(`CREATE TABLE IF NOT EXISTS email_processing_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        message_id TEXT NOT NULL,
        sender_email TEXT NOT NULL,
        subject TEXT,
        processed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        files_extracted INTEGER DEFAULT 0,
        project_id TEXT,
        pbc_matches INTEGER DEFAULT 0,
        status TEXT DEFAULT 'processed'
      )`);
      
      // Client email mappings
      this.db.run(`CREATE TABLE IF NOT EXISTS client_email_mappings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        client_email TEXT NOT NULL,
        project_id TEXT NOT NULL,
        user_email TEXT NOT NULL,
        auto_approve INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`);
    });
  }

  // Configure email monitoring for a project
  async configureEmail(config) {
    const {
      userEmail,
      emailAddress,
      imapHost,
      imapPort = 993,
      emailPassword,
      projectId,
      keywords = []
    } = config;

    return new Promise((resolve, reject) => {
      this.db.run(
        `INSERT OR REPLACE INTO email_configs 
         (user_email, email_address, imap_host, imap_port, email_password, project_id, keywords)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [userEmail, emailAddress, imapHost, imapPort, emailPassword, projectId, JSON.stringify(keywords)],
        function(err) {
          if (err) {
            reject(err);
          } else {
            resolve({ id: this.lastID, message: 'Email configuration saved' });
          }
        }
      );
    });
  }

  // Start monitoring emails for a specific configuration
  async startMonitoring(configId) {
    return new Promise((resolve, reject) => {
      this.db.get(
        'SELECT * FROM email_configs WHERE id = ? AND is_active = 1',
        [configId],
        async (err, config) => {
          if (err || !config) {
            return reject(new Error('Email configuration not found'));
          }

          try {
            const imapConfig = {
              imap: {
                user: config.email_address,
                password: config.email_password,
                host: config.imap_host,
                port: config.imap_port,
                tls: config.imap_secure === 1,
                authTimeout: 3000
              }
            };

            this.emailConfig = config;
            this.isMonitoring = true;

            // Start monitoring
            this.monitorInbox(imapConfig);
            
            resolve({ message: 'Email monitoring started', config: config.email_address });
          } catch (error) {
            reject(error);
          }
        }
      );
    });
  }

  async monitorInbox(imapConfig) {
    try {
      console.log(`📧 Starting email monitoring for: ${this.emailConfig.email_address}`);
      
      const connection = await imaps.connect(imapConfig);
      await connection.openBox('INBOX');

      // Check for new emails every 30 seconds
      const checkInterval = setInterval(async () => {
        if (!this.isMonitoring) {
          clearInterval(checkInterval);
          return;
        }

        try {
          await this.processNewEmails(connection);
        } catch (error) {
          console.error('Error processing emails:', error);
        }
      }, 30000);

      // Process existing unread emails on startup
      await this.processNewEmails(connection);

    } catch (error) {
      console.error('IMAP connection error:', error);
      
      // Retry connection after 5 minutes
      if (this.isMonitoring) {
        setTimeout(() => {
          this.monitorInbox(imapConfig);
        }, 300000);
      }
    }
  }

  async processNewEmails(connection) {
    try {
      // Search for unread emails
      const searchCriteria = ['UNSEEN'];
      const fetchOptions = {
        bodies: '',
        markSeen: false,
        struct: true
      };

      const messages = await connection.search(searchCriteria, fetchOptions);
      
      if (messages.length === 0) return;

      console.log(`📬 Found ${messages.length} new emails to process`);

      for (const message of messages) {
        await this.processEmail(connection, message);
      }

    } catch (error) {
      console.error('Error processing new emails:', error);
    }
  }

  async processEmail(connection, message) {
    try {
      const parsed = await simpleParser(message.body);
      const messageId = parsed.messageId || `${Date.now()}-${Math.random()}`;
      const senderEmail = parsed.from?.value[0]?.address || 'unknown';
      const subject = parsed.subject || 'No Subject';

      console.log(`📨 Processing email from: ${senderEmail} - Subject: ${subject}`);

      // Check if this sender is mapped to a project
      const clientMapping = await this.getClientMapping(senderEmail);
      const projectId = clientMapping?.project_id || this.emailConfig.project_id;

      // Extract and process attachments
      let filesExtracted = 0;
      let pbcMatches = 0;

      if (parsed.attachments && parsed.attachments.length > 0) {
        console.log(`📎 Found ${parsed.attachments.length} attachments`);

        for (const attachment of parsed.attachments) {
          try {
            const result = await this.processAttachment(attachment, {
              senderEmail,
              subject,
              projectId,
              messageId
            });
            
            if (result.success) {
              filesExtracted++;
              pbcMatches += result.pbcMatches || 0;
            }
          } catch (attachmentError) {
            console.error('Error processing attachment:', attachmentError);
          }
        }
      }

      // Log the processing
      await this.logEmailProcessing({
        messageId,
        senderEmail,
        subject,
        filesExtracted,
        projectId,
        pbcMatches
      });

      // Mark email as seen
      await connection.addFlags(message.attributes.uid, '\\Seen');

      // Send notification if files were processed
      if (filesExtracted > 0) {
        createNotification(
          this.emailConfig.user_email,
          'Files Received via Email',
          `${filesExtracted} files from ${senderEmail} processed automatically`,
          'success',
          '📧'
        );
      }

    } catch (error) {
      console.error('Error processing email:', error);
    }
  }

  async processAttachment(attachment, emailContext) {
    try {
      const { filename, content } = attachment;
      const { senderEmail, projectId } = emailContext;

      // Generate unique filename
      const ext = path.extname(filename);
      const uniqueName = `email-${Date.now()}-${Math.round(Math.random() * 1E9)}${ext}`;
      const filePath = path.join(this.uploadsDir, uniqueName);

      // Save file to disk
      fs.writeFileSync(filePath, content);
      const fileSize = content.length;

      // Determine MIME type based on extension
      const mimeType = this.getMimeType(ext);

      // Save to database
      const fileId = await this.saveFileToDatabase({
        userEmail: this.emailConfig.user_email,
        filename: uniqueName,
        originalName: filename,
        filePath,
        fileSize,
        mimeType,
        description: `Received via email from ${senderEmail}`,
        tags: ['email', 'client-upload', projectId].filter(Boolean)
      });

      // Try to match with PBC items if project is specified
      let pbcMatches = 0;
      if (projectId) {
        pbcMatches = await this.autoMatchPBCItems(fileId, filename, projectId);
      }

      logActivity(this.emailConfig.user_email, 'email_file_received', {
        filename,
        sender: senderEmail,
        project: projectId,
        pbcMatches
      });

      console.log(`✅ Processed attachment: ${filename} (${pbcMatches} PBC matches)`);

      return { success: true, fileId, pbcMatches };

    } catch (error) {
      console.error('Error processing attachment:', error);
      return { success: false, error: error.message };
    }
  }

  async saveFileToDatabase(fileData) {
    return new Promise((resolve, reject) => {
      this.db.run(
        `INSERT INTO user_files 
         (user_email, filename, original_name, file_path, file_size, mime_type, description, tags)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          fileData.userEmail,
          fileData.filename,
          fileData.originalName,
          fileData.filePath,
          fileData.fileSize,
          fileData.mimeType,
          fileData.description,
          JSON.stringify(fileData.tags)
        ],
        function(err) {
          if (err) {
            reject(err);
          } else {
            resolve(this.lastID);
          }
        }
      );
    });
  }

  async autoMatchPBCItems(fileId, filename, projectId) {
    return new Promise((resolve) => {
      // Get active PBC lists for this project
      this.db.all(
        'SELECT id FROM project_pbc_lists WHERE project_id = ? AND status = "active"',
        [projectId],
        (err, lists) => {
          if (err || !lists.length) {
            return resolve(0);
          }

          let totalMatches = 0;
          const listIds = lists.map(list => list.id);

          // Get PBC items that aren't completed
          this.db.all(
            `SELECT * FROM pbc_items WHERE pbc_list_id IN (${listIds.map(() => '?').join(',')}) AND status != 'completed'`,
            listIds,
            (err, pbcItems) => {
              if (err || !pbcItems.length) {
                return resolve(0);
              }

              pbcItems.forEach(item => {
                const keywords = JSON.parse(item.ai_keywords || '[]');
                const fileName = filename.toLowerCase();
                
                const matchScore = keywords.reduce((score, keyword) => {
                  return fileName.includes(keyword.toLowerCase()) ? score + 1 : score;
                }, 0);

                if (matchScore > 0) {
                  // Auto-attach file to PBC item
                  let fileIds = JSON.parse(item.file_ids || '[]');
                  if (!fileIds.includes(fileId)) {
                    fileIds.push(fileId);
                    
                    const newStatus = item.status === 'requested' ? 'received' : item.status;
                    
                    this.db.run(
                      'UPDATE pbc_items SET file_ids = ?, status = ? WHERE id = ?',
                      [JSON.stringify(fileIds), newStatus, item.id]
                    );
                    
                    totalMatches++;
                    
                    console.log(`🎯 Auto-matched "${filename}" to PBC item: ${item.title}`);
                  }
                }
              });

              resolve(totalMatches);
            }
          );
        }
      );
    });
  }

  async getClientMapping(clientEmail) {
    return new Promise((resolve) => {
      this.db.get(
        'SELECT * FROM client_email_mappings WHERE client_email = ?',
        [clientEmail],
        (err, mapping) => {
          resolve(err ? null : mapping);
        }
      );
    });
  }

  async logEmailProcessing(data) {
    return new Promise((resolve) => {
      this.db.run(
        `INSERT INTO email_processing_log 
         (message_id, sender_email, subject, files_extracted, project_id, pbc_matches)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [data.messageId, data.senderEmail, data.subject, data.filesExtracted, data.projectId, data.pbcMatches],
        () => resolve()
      );
    });
  }

  getMimeType(extension) {
    const mimeTypes = {
      '.pdf': 'application/pdf',
      '.doc': 'application/msword',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.xls': 'application/vnd.ms-excel',
      '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      '.txt': 'text/plain',
      '.csv': 'text/csv',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif'
    };
    
    return mimeTypes[extension.toLowerCase()] || 'application/octet-stream';
  }

  // Add client email mapping
  async addClientMapping(clientEmail, projectId, userEmail, autoApprove = false) {
    return new Promise((resolve, reject) => {
      this.db.run(
        'INSERT OR REPLACE INTO client_email_mappings (client_email, project_id, user_email, auto_approve) VALUES (?, ?, ?, ?)',
        [clientEmail, projectId, userEmail, autoApprove ? 1 : 0],
        function(err) {
          if (err) {
            reject(err);
          } else {
            resolve(this.lastID);
          }
        }
      );
    });
  }

  // Stop monitoring
  stopMonitoring() {
    this.isMonitoring = false;
    console.log('📧 Email monitoring stopped');
  }

  // Get email processing statistics
  async getEmailStats() {
    return new Promise((resolve) => {
      Promise.all([
        // Total emails processed
        new Promise((res) => {
          this.db.get('SELECT COUNT(*) as count FROM email_processing_log', [], (err, row) => {
            res(err ? 0 : row.count);
          });
        }),
        
        // Files extracted this week
        new Promise((res) => {
          this.db.get(
            'SELECT SUM(files_extracted) as count FROM email_processing_log WHERE processed_at >= date("now", "-7 days")',
            [],
            (err, row) => res(err ? 0 : row.count || 0)
          );
        }),
        
        // PBC matches this week
        new Promise((res) => {
          this.db.get(
            'SELECT SUM(pbc_matches) as count FROM email_processing_log WHERE processed_at >= date("now", "-7 days")',
            [],
            (err, row) => res(err ? 0 : row.count || 0)
          );
        })
      ]).then(([totalEmails, weeklyFiles, weeklyMatches]) => {
        resolve({
          totalEmailsProcessed: totalEmails,
          filesExtractedThisWeek: weeklyFiles,
          pbcMatchesThisWeek: weeklyMatches,
          isMonitoring: this.isMonitoring,
          currentConfig: this.emailConfig?.email_address || null
        });
      });
    });
  }
}

module.exports = EmailIntegrationService;