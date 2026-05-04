const winston = require('winston');
const path = require('path');

const logDir = 'logs';

// Define log format
const logFormat = winston.format.combine(
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss'
  }),
  winston.format.errors({ stack: true }),
  winston.format.printf(({ level, message, timestamp, stack, ...metadata }) => {
    let log = `${timestamp} [${level.toUpperCase()}]: ${message}`;
    
    // Add metadata if present
    if (Object.keys(metadata).length > 0) {
      log += ` ${JSON.stringify(metadata)}`;
    }
    
    // Add stack trace for errors
    if (stack) {
      log += `\n${stack}`;
    }
    
    return log;
  })
);

// Create logger instance
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: logFormat,
  transports: [
    // Application logs
    new winston.transports.File({
      filename: path.join(logDir, 'error.log'),
      level: 'error',
      maxsize: 10485760, // 10MB
      maxFiles: 5,
      tailable: true
    }),
    new winston.transports.File({
      filename: path.join(logDir, 'combined.log'),
      maxsize: 10485760, // 10MB
      maxFiles: 10,
      tailable: true
    }),
    
    // Audit trail logs (for compliance)
    new winston.transports.File({
      filename: path.join(logDir, 'audit.log'),
      level: 'info',
      maxsize: 52428800, // 50MB
      maxFiles: 50, // Keep more audit logs for compliance
      tailable: true,
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json() // JSON format for audit logs
      )
    })
  ],
  
  // Handle uncaught exceptions
  exceptionHandlers: [
    new winston.transports.File({
      filename: path.join(logDir, 'exceptions.log'),
      maxsize: 10485760,
      maxFiles: 5,
      tailable: true
    })
  ],
  
  // Handle unhandled promise rejections
  rejectionHandlers: [
    new winston.transports.File({
      filename: path.join(logDir, 'rejections.log'),
      maxsize: 10485760,
      maxFiles: 5,
      tailable: true
    })
  ]
});

// Add console logging in development
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
    )
  }));
}

// Audit logging functions for compliance
const auditLogger = {
  // User actions
  login(userId, ip, userAgent, success = true) {
    logger.info('User login attempt', {
      type: 'AUTH',
      action: 'LOGIN',
      userId,
      ip,
      userAgent,
      success,
      timestamp: new Date().toISOString()
    });
  },
  
  logout(userId, ip) {
    logger.info('User logout', {
      type: 'AUTH',
      action: 'LOGOUT',
      userId,
      ip,
      timestamp: new Date().toISOString()
    });
  },
  
  // Project actions
  projectCreated(userId, projectId, projectName) {
    logger.info('Project created', {
      type: 'PROJECT',
      action: 'CREATE',
      userId,
      projectId,
      projectName,
      timestamp: new Date().toISOString()
    });
  },
  
  projectAccessed(userId, projectId, action = 'VIEW') {
    logger.info('Project accessed', {
      type: 'PROJECT',
      action,
      userId,
      projectId,
      timestamp: new Date().toISOString()
    });
  },
  
  projectModified(userId, projectId, changes) {
    logger.info('Project modified', {
      type: 'PROJECT',
      action: 'MODIFY',
      userId,
      projectId,
      changes,
      timestamp: new Date().toISOString()
    });
  },
  
  teamMemberAdded(userId, projectId, addedUserId, role) {
    logger.info('Team member added', {
      type: 'PROJECT',
      action: 'ADD_MEMBER',
      userId,
      projectId,
      addedUserId,
      role,
      timestamp: new Date().toISOString()
    });
  },
  
  teamMemberRemoved(userId, projectId, removedUserId) {
    logger.info('Team member removed', {
      type: 'PROJECT',
      action: 'REMOVE_MEMBER',
      userId,
      projectId,
      removedUserId,
      timestamp: new Date().toISOString()
    });
  },
  
  // File actions
  fileUploaded(userId, projectId, fileId, fileName, fileSize) {
    logger.info('File uploaded', {
      type: 'FILE',
      action: 'UPLOAD',
      userId,
      projectId,
      fileId,
      fileName,
      fileSize,
      timestamp: new Date().toISOString()
    });
  },
  
  fileDownloaded(userId, projectId, fileId, fileName) {
    logger.info('File downloaded', {
      type: 'FILE',
      action: 'DOWNLOAD',
      userId,
      projectId,
      fileId,
      fileName,
      timestamp: new Date().toISOString()
    });
  },
  
  fileDeleted(userId, projectId, fileId, fileName) {
    logger.info('File deleted', {
      type: 'FILE',
      action: 'DELETE',
      userId,
      projectId,
      fileId,
      fileName,
      timestamp: new Date().toISOString()
    });
  },
  
  fileShared(userId, projectId, fileId, fileName, sharedWith) {
    logger.info('File shared', {
      type: 'FILE',
      action: 'SHARE',
      userId,
      projectId,
      fileId,
      fileName,
      sharedWith,
      timestamp: new Date().toISOString()
    });
  },
  
  // Audit procedure actions
  procedureCompleted(userId, projectId, procedureId, procedureName) {
    logger.info('Audit procedure completed', {
      type: 'AUDIT',
      action: 'PROCEDURE_COMPLETE',
      userId,
      projectId,
      procedureId,
      procedureName,
      timestamp: new Date().toISOString()
    });
  },
  
  exceptionIdentified(userId, projectId, fileId, exceptionType, description) {
    logger.info('Exception identified', {
      type: 'AUDIT',
      action: 'EXCEPTION_FOUND',
      userId,
      projectId,
      fileId,
      exceptionType,
      description,
      timestamp: new Date().toISOString()
    });
  },
  
  tickMarkApplied(userId, projectId, fileId, tickMarkType, location) {
    logger.info('Tick mark applied', {
      type: 'AUDIT',
      action: 'TICK_MARK',
      userId,
      projectId,
      fileId,
      tickMarkType,
      location,
      timestamp: new Date().toISOString()
    });
  },
  
  // Data export/import actions
  dataExported(userId, projectId, exportType, recordCount) {
    logger.info('Data exported', {
      type: 'DATA',
      action: 'EXPORT',
      userId,
      projectId,
      exportType,
      recordCount,
      timestamp: new Date().toISOString()
    });
  },
  
  dataImported(userId, projectId, importType, recordCount) {
    logger.info('Data imported', {
      type: 'DATA',
      action: 'IMPORT',
      userId,
      projectId,
      importType,
      recordCount,
      timestamp: new Date().toISOString()
    });
  },
  
  // AI interactions
  aiQuery(userId, projectId, query, responseType) {
    logger.info('AI query processed', {
      type: 'AI',
      action: 'QUERY',
      userId,
      projectId,
      query: query.substring(0, 200), // Truncate for privacy
      responseType,
      timestamp: new Date().toISOString()
    });
  },
  
  // Security events
  securityEvent(userId, eventType, details, severity = 'medium') {
    logger.warn('Security event', {
      type: 'SECURITY',
      action: eventType,
      userId,
      details,
      severity,
      timestamp: new Date().toISOString()
    });
  },
  
  // General activity
  activity(userId, type, action, details = {}) {
    logger.info('User activity', {
      type: type.toUpperCase(),
      action: action.toUpperCase(),
      userId,
      ...details,
      timestamp: new Date().toISOString()
    });
  }
};

// Attach audit logger and export the logger instance
logger.audit = auditLogger;
module.exports = logger;
