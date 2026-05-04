import { BaseArbiter } from './core/BaseArbiter.js';
import messageBroker from './core/MessageBroker.js';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

export class StorageArbiter extends BaseArbiter {
  static role = 'storage';
  static capabilities = ['store', 'retrieve', 'analyze', 'compress', 'cleanup', 'backup'];

  constructor(config = {}) {
    super({
      name: config.name || 'StorageArbiter',
      role: StorageArbiter.role,
      capabilities: StorageArbiter.capabilities,
      ...config
    });
    
    // Storage paths
    this.uploadsPath = path.join(process.cwd(), 'uploads');
    this.archivePath = path.join(process.cwd(), 'archives');
    this.backupPath = path.join(process.cwd(), 'backups');
    
    // Storage metrics
    this.storageStats = {
      totalFiles: 0,
      totalSize: 0,
      compressionRatio: 0,
      spaceSaved: 0,
      backupCount: 0
    };

    this.ensureDirectories();
    this.logger.info(`[${this.name}] 📦 StorageArbiter initializing...`);
  }

  async ensureDirectories() {
    try {
      await fs.mkdir(this.uploadsPath, { recursive: true });
      await fs.mkdir(this.archivePath, { recursive: true });
      await fs.mkdir(this.backupPath, { recursive: true });
    } catch (error) {
      this.logger.error(`[${this.name}] Directory creation error: ${error.message}`);
    }
  }

  async initialize() {
    await super.initialize();
    
    // Scan existing storage
    await this.scanExistingStorage();
    
    this.registerWithBroker();
    this._subscribeBrokerMessages();

    this.logger.info(`[${this.name}] ✅ Storage systems active`);
  }

  registerWithBroker() {
    try {
      messageBroker.registerArbiter(this.name, this, { 
        type: StorageArbiter.role,
        capabilities: StorageArbiter.capabilities 
      });
      this.logger.info(`[${this.name}] 📝 Registered with MessageBroker`);
    } catch (err) {
      this.logger.error(`[${this.name}] Registration failed: ${err.message}`);
      throw err;
    }
  }

  _subscribeBrokerMessages() {
    messageBroker.subscribe(this.name, 'store');
    messageBroker.subscribe(this.name, 'retrieve');
    messageBroker.subscribe(this.name, 'analyze_storage');
    messageBroker.subscribe(this.name, 'cleanup_storage');
    messageBroker.subscribe(this.name, 'backup_files');
    messageBroker.subscribe(this.name, 'status_check');
  }

  async handleMessage(message = {}) {
    try {
      const { type, payload } = message;
      
      switch (type) {
        case 'store':
          return await this.storeFile(payload);
        
        case 'retrieve':
          return await this.retrieveFile(payload);
        
        case 'analyze_storage':
          return await this.analyzeStorage();
        
        case 'cleanup_storage':
          return await this.cleanupOldFiles(payload);
        
        case 'backup_files':
          return await this.backupFiles(payload);
        
        case 'status_check':
          return this.getStorageStatus();
        
        default:
          return { success: false, error: 'unknown_message_type' };
      }
    } catch (err) {
      this.logger.error(`[${this.name}] handleMessage error: ${err.message}`);
      return { success: false, error: err.message };
    }
  }

  // ═══════════════════════════════════════════════════════════
  // STORAGE OPERATIONS
  // ═══════════════════════════════════════════════════════════

  async storeFile(payload) {
    const { filename, sourceDir = 'uploads', targetDir = 'uploads', metadata = {} } = payload;
    
    try {
      const sourcePath = path.join(process.cwd(), sourceDir, filename);
      const targetPath = path.join(process.cwd(), targetDir, filename);
      
      // Check if source file exists
      try {
        await fs.access(sourcePath);
      } catch {
        return { success: false, error: 'source_file_not_found' };
      }

      // Copy file if different directories
      if (sourceDir !== targetDir) {
        await fs.copyFile(sourcePath, targetPath);
      }

      // Store metadata
      const metadataPath = `${targetPath}.meta`;
      const fileStats = await fs.stat(targetPath);
      
      const fullMetadata = {
        ...metadata,
        filename,
        originalPath: sourcePath,
        storedPath: targetPath,
        size: fileStats.size,
        storedAt: new Date().toISOString(),
        checksum: await this.calculateChecksum(targetPath)
      };

      await fs.writeFile(metadataPath, JSON.stringify(fullMetadata, null, 2));
      
      // Update stats
      this.storageStats.totalFiles++;
      this.storageStats.totalSize += fileStats.size;

      this.logger.info(`[${this.name}] 📄 Stored file: ${filename} (${this.formatBytes(fileStats.size)})`);
      
      return { 
        success: true, 
        filename, 
        path: targetPath, 
        size: fileStats.size,
        metadata: fullMetadata
      };

    } catch (error) {
      this.logger.error(`[${this.name}] Store error: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  async retrieveFile(payload) {
    const { filename, sourceDir = 'uploads' } = payload;
    
    try {
      const filePath = path.join(process.cwd(), sourceDir, filename);
      const metadataPath = `${filePath}.meta`;
      
      // Check if file exists
      try {
        await fs.access(filePath);
      } catch {
        return { success: false, error: 'file_not_found' };
      }

      // Load metadata if available
      let metadata = null;
      try {
        const metadataContent = await fs.readFile(metadataPath, 'utf8');
        metadata = JSON.parse(metadataContent);
      } catch {
        // Metadata not available
      }

      const fileStats = await fs.stat(filePath);

      return {
        success: true,
        filename,
        path: filePath,
        size: fileStats.size,
        modified: fileStats.mtime,
        metadata
      };

    } catch (error) {
      this.logger.error(`[${this.name}] Retrieve error: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  async analyzeStorage() {
    this.logger.info(`[${this.name}] 📊 Analyzing storage...`);
    
    try {
      const analysis = {
        uploads: await this.analyzeDirectory(this.uploadsPath),
        archives: await this.analyzeDirectory(this.archivePath),
        backups: await this.analyzeDirectory(this.backupPath)
      };

      // Calculate totals
      const totals = {
        totalFiles: 0,
        totalSize: 0,
        oldestFile: null,
        newestFile: null,
        averageFileSize: 0
      };

      Object.values(analysis).forEach(dir => {
        totals.totalFiles += dir.fileCount;
        totals.totalSize += dir.totalSize;
        
        if (!totals.oldestFile || (dir.oldestFile && dir.oldestFile < totals.oldestFile)) {
          totals.oldestFile = dir.oldestFile;
        }
        
        if (!totals.newestFile || (dir.newestFile && dir.newestFile > totals.newestFile)) {
          totals.newestFile = dir.newestFile;
        }
      });

      totals.averageFileSize = totals.totalFiles > 0 ? totals.totalSize / totals.totalFiles : 0;

      // Update stats
      this.storageStats.totalFiles = totals.totalFiles;
      this.storageStats.totalSize = totals.totalSize;

      const result = {
        success: true,
        analysis,
        totals,
        recommendations: this.generateStorageRecommendations(analysis, totals)
      };

      this.logger.info(`[${this.name}] 📊 Storage analysis complete: ${totals.totalFiles} files, ${this.formatBytes(totals.totalSize)}`);
      
      return result;

    } catch (error) {
      this.logger.error(`[${this.name}] Storage analysis error: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  async analyzeDirectory(dirPath) {
    try {
      const files = await fs.readdir(dirPath);
      const analysis = {
        path: dirPath,
        fileCount: 0,
        totalSize: 0,
        fileTypes: {},
        oldestFile: null,
        newestFile: null
      };

      for (const file of files) {
        if (file.startsWith('.')) continue; // Skip hidden/metadata files
        
        const filePath = path.join(dirPath, file);
        
        try {
          const stats = await fs.stat(filePath);
          
          if (stats.isFile()) {
            analysis.fileCount++;
            analysis.totalSize += stats.size;
            
            // Track file types
            const ext = path.extname(file).toLowerCase();
            analysis.fileTypes[ext] = (analysis.fileTypes[ext] || 0) + 1;
            
            // Track oldest/newest
            if (!analysis.oldestFile || stats.mtime < analysis.oldestFile) {
              analysis.oldestFile = stats.mtime;
            }
            if (!analysis.newestFile || stats.mtime > analysis.newestFile) {
              analysis.newestFile = stats.mtime;
            }
          }
        } catch (statError) {
          // Skip files we can't stat
        }
      }

      return analysis;
    } catch (error) {
      return {
        path: dirPath,
        error: error.message,
        fileCount: 0,
        totalSize: 0
      };
    }
  }

  generateStorageRecommendations(analysis, totals) {
    const recommendations = [];
    
    // Size-based recommendations
    if (totals.totalSize > 5 * 1024 * 1024 * 1024) { // > 5GB
      recommendations.push({
        type: 'storage_cleanup',
        priority: 'high',
        message: 'Storage usage is high. Consider archiving old files.',
        action: 'archive_old_files'
      });
    }

    // File count recommendations
    if (analysis.uploads && analysis.uploads.fileCount > 1000) {
      recommendations.push({
        type: 'file_management',
        priority: 'medium',
        message: 'Large number of files in uploads. Consider organizing or archiving.',
        action: 'organize_files'
      });
    }

    // Age-based recommendations
    const thirtyDaysAgo = new Date(Date.now() - (30 * 24 * 60 * 60 * 1000));
    if (totals.oldestFile && totals.oldestFile < thirtyDaysAgo) {
      recommendations.push({
        type: 'archival',
        priority: 'medium',
        message: 'Old files detected. Consider moving to archive storage.',
        action: 'archive_old_files'
      });
    }

    return recommendations;
  }

  async cleanupOldFiles(payload = {}) {
    const { ageThresholdDays = 90, dryRun = false } = payload;
    const cutoffDate = new Date(Date.now() - (ageThresholdDays * 24 * 60 * 60 * 1000));
    
    this.logger.info(`[${this.name}] 🧹 Cleaning up files older than ${ageThresholdDays} days ${dryRun ? '(dry run)' : ''}...`);
    
    try {
      const oldFiles = [];
      const files = await fs.readdir(this.uploadsPath);
      
      for (const file of files) {
        if (file.startsWith('.')) continue;
        
        const filePath = path.join(this.uploadsPath, file);
        const stats = await fs.stat(filePath);
        
        if (stats.mtime < cutoffDate) {
          oldFiles.push({
            filename: file,
            path: filePath,
            size: stats.size,
            age: Math.floor((Date.now() - stats.mtime.getTime()) / (1000 * 60 * 60 * 24))
          });
        }
      }

      if (!dryRun) {
        let spaceSaved = 0;
        for (const file of oldFiles) {
          // Move to archive instead of deleting
          const archivePath = path.join(this.archivePath, file.filename);
          await fs.rename(file.path, archivePath);
          spaceSaved += file.size;
        }
        this.storageStats.spaceSaved += spaceSaved;
      }

      return {
        success: true,
        filesFound: oldFiles.length,
        totalSize: oldFiles.reduce((sum, f) => sum + f.size, 0),
        files: oldFiles,
        dryRun
      };

    } catch (error) {
      this.logger.error(`[${this.name}] Cleanup error: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  async backupFiles(payload = {}) {
    const { sourceDir = 'uploads', targetDir = 'backups' } = payload;
    
    this.logger.info(`[${this.name}] 💾 Creating backup from ${sourceDir} to ${targetDir}...`);
    
    try {
      const sourcePath = path.join(process.cwd(), sourceDir);
      const backupDir = path.join(process.cwd(), targetDir, `backup_${Date.now()}`);
      
      await fs.mkdir(backupDir, { recursive: true });
      
      const files = await fs.readdir(sourcePath);
      let backupCount = 0;
      let backupSize = 0;

      for (const file of files) {
        if (file.startsWith('.')) continue;
        
        const sourceFile = path.join(sourcePath, file);
        const backupFile = path.join(backupDir, file);
        
        try {
          await fs.copyFile(sourceFile, backupFile);
          const stats = await fs.stat(backupFile);
          backupSize += stats.size;
          backupCount++;
        } catch (copyError) {
          this.logger.warn(`[${this.name}] Failed to backup ${file}: ${copyError.message}`);
        }
      }

      // Create backup manifest
      const manifest = {
        createdAt: new Date().toISOString(),
        sourceDir,
        targetDir: backupDir,
        fileCount: backupCount,
        totalSize: backupSize,
        files: files.filter(f => !f.startsWith('.'))
      };

      await fs.writeFile(
        path.join(backupDir, 'manifest.json'), 
        JSON.stringify(manifest, null, 2)
      );

      this.storageStats.backupCount++;

      this.logger.info(`[${this.name}] 💾 Backup complete: ${backupCount} files, ${this.formatBytes(backupSize)}`);

      return {
        success: true,
        backupPath: backupDir,
        fileCount: backupCount,
        totalSize: backupSize,
        manifest
      };

    } catch (error) {
      this.logger.error(`[${this.name}] Backup error: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  // ═══════════════════════════════════════════════════════════
  // UTILITY FUNCTIONS
  // ═══════════════════════════════════════════════════════════

  async scanExistingStorage() {
    try {
      const analysis = await this.analyzeStorage();
      if (analysis.success) {
        this.logger.info(`[${this.name}] 📊 Initial storage scan: ${analysis.totals.totalFiles} files, ${this.formatBytes(analysis.totals.totalSize)}`);
      }
    } catch (error) {
      this.logger.warn(`[${this.name}] Initial storage scan failed: ${error.message}`);
    }
  }

  async calculateChecksum(filePath) {
    try {
      const data = await fs.readFile(filePath);
      return crypto.createHash('sha256').update(data).digest('hex');
    } catch (error) {
      return null;
    }
  }

  formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  }

  getStorageStatus() {
    return {
      name: this.name,
      role: StorageArbiter.role,
      capabilities: StorageArbiter.capabilities,
      stats: this.storageStats,
      paths: {
        uploads: this.uploadsPath,
        archives: this.archivePath,
        backups: this.backupPath
      },
      health: 'operational'
    };
  }

  async shutdown() {
    this.logger.info(`[${this.name}] 📦 Shutting down storage systems...`);
    await super.shutdown();
    this.logger.info(`[${this.name}] ✅ Storage shutdown complete`);
  }
}

export default StorageArbiter;