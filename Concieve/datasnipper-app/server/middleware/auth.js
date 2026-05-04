const jwt = require('jsonwebtoken');
const User = require('../models/User');
const logger = require('../utils/logger');

// Middleware to authenticate JWT tokens
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer <token>

    if (!token) {
      return res.status(401).json({ 
        message: 'Access token required',
        code: 'TOKEN_REQUIRED'
      });
    }

    // Verify the token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Get user from database
    const user = await User.findById(decoded.id).select('-password');
    
    if (!user) {
      return res.status(401).json({ 
        message: 'User not found',
        code: 'USER_NOT_FOUND'
      });
    }

    if (!user.isActive) {
      return res.status(401).json({ 
        message: 'Account deactivated',
        code: 'ACCOUNT_DEACTIVATED'
      });
    }

    // Attach user to request object
    req.user = user;
    next();

  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ 
        message: 'Invalid token',
        code: 'INVALID_TOKEN'
      });
    }
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        message: 'Token expired',
        code: 'TOKEN_EXPIRED'
      });
    }

    logger.error('Auth middleware error:', error);
    res.status(500).json({ 
      message: 'Authentication error',
      code: 'AUTH_ERROR'
    });
  }
};

// Middleware to authenticate socket connections
const authenticateSocket = async (socket, next) => {
  try {
    const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.split(' ')[1];
    
    if (!token) {
      return next(new Error('Authentication token required'));
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select('-password');
    
    if (!user || !user.isActive) {
      return next(new Error('User not found or inactive'));
    }

    socket.userId = user._id.toString();
    socket.user = user;
    next();

  } catch (error) {
    logger.error('Socket auth error:', error);
    next(new Error('Invalid authentication token'));
  }
};

// Middleware to check if user has specific permission
const requirePermission = (permission) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ 
        message: 'Authentication required',
        code: 'AUTH_REQUIRED'
      });
    }

    if (!req.user.permissions[permission]) {
      logger.audit.securityEvent(
        req.user._id,
        'PERMISSION_DENIED',
        { permission, route: req.path },
        'medium'
      );
      
      return res.status(403).json({ 
        message: 'Insufficient permissions',
        code: 'PERMISSION_DENIED'
      });
    }

    next();
  };
};

// Middleware to check if user has specific role
const requireRole = (roles) => {
  if (typeof roles === 'string') {
    roles = [roles];
  }

  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ 
        message: 'Authentication required',
        code: 'AUTH_REQUIRED'
      });
    }

    if (!roles.includes(req.user.role)) {
      logger.audit.securityEvent(
        req.user._id,
        'ROLE_ACCESS_DENIED',
        { requiredRoles: roles, userRole: req.user.role, route: req.path },
        'medium'
      );
      
      return res.status(403).json({ 
        message: 'Insufficient role privileges',
        code: 'ROLE_DENIED'
      });
    }

    next();
  };
};

// Middleware to check project access
const requireProjectAccess = (permission = 'read') => {
  return async (req, res, next) => {
    try {
      const projectId = req.params.projectId || req.body.projectId;
      
      if (!projectId) {
        return res.status(400).json({ 
          message: 'Project ID required',
          code: 'PROJECT_ID_REQUIRED'
        });
      }

      const Project = require('../models/Project');
      const project = await Project.findById(projectId);
      
      if (!project) {
        return res.status(404).json({ 
          message: 'Project not found',
          code: 'PROJECT_NOT_FOUND'
        });
      }

      const userId = req.user._id;
      
      // Check if user has access to all projects (admin privilege)
      if (req.user.permissions.canAccessAllProjects) {
        req.project = project;
        return next();
      }

      // Check if user is team member
      if (!project.isTeamMember(userId)) {
        logger.audit.securityEvent(
          userId,
          'PROJECT_ACCESS_DENIED',
          { projectId, permission },
          'high'
        );
        
        return res.status(403).json({ 
          message: 'Project access denied',
          code: 'PROJECT_ACCESS_DENIED'
        });
      }

      // Check specific permissions for the requested action
      const userPermissions = project.getUserPermissions(userId);
      
      let hasPermission = false;
      switch (permission) {
        case 'read':
          hasPermission = true; // Team members can always read
          break;
        case 'write':
        case 'edit':
          hasPermission = userPermissions.canEdit;
          break;
        case 'delete':
          hasPermission = userPermissions.canDelete;
          break;
        case 'invite':
          hasPermission = userPermissions.canInvite;
          break;
        case 'manageFiles':
          hasPermission = userPermissions.canManageFiles;
          break;
        case 'export':
          hasPermission = userPermissions.canExport;
          break;
        default:
          hasPermission = false;
      }

      if (!hasPermission) {
        logger.audit.securityEvent(
          userId,
          'PROJECT_PERMISSION_DENIED',
          { projectId, permission },
          'medium'
        );
        
        return res.status(403).json({ 
          message: `Insufficient project permissions for ${permission}`,
          code: 'PROJECT_PERMISSION_DENIED'
        });
      }

      req.project = project;
      next();

    } catch (error) {
      logger.error('Project access check error:', error);
      res.status(500).json({ 
        message: 'Project access verification failed',
        code: 'PROJECT_ACCESS_ERROR'
      });
    }
  };
};

// Rate limiting middleware for sensitive operations
const rateLimitSensitive = require('express-rate-limit')({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 requests per windowMs for sensitive operations
  message: {
    message: 'Too many attempts, please try again later',
    code: 'RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiting for authentication endpoints
const rateLimitAuth = require('express-rate-limit')({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // limit each IP to 10 login attempts per windowMs
  message: {
    message: 'Too many login attempts, please try again later',
    code: 'AUTH_RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Middleware to log API access for audit trail
const logApiAccess = (req, res, next) => {
  const startTime = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const userId = req.user ? req.user._id : 'anonymous';
    
    logger.audit.activity(userId, 'API', req.method, {
      path: req.path,
      statusCode: res.statusCode,
      duration,
      ip: req.ip || req.connection.remoteAddress,
      userAgent: req.get('User-Agent')
    });
  });
  
  next();
};

module.exports = {
  authenticateToken,
  authenticateSocket,
  requirePermission,
  requireRole,
  requireProjectAccess,
  rateLimitSensitive,
  rateLimitAuth,
  logApiAccess
};