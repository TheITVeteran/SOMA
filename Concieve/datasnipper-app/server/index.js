const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const mongoose = require('mongoose');
const socketIo = require('socket.io');
const http = require('http');
const path = require('path');
require('dotenv').config();

// Route imports
let authRoutes, userRoutes, projectRoutes, fileRoutes, chatRoutes, auditRoutes, agentsRoutes, auditSystemRoutes, ragRoutes, profileRoutes, dashboardRoutes, arbitersRoutes, aiCommandsRoutes, systemActionsRoutes;
let logger, authenticateSocket;

try {
  logger = require('./utils/logger');
} catch (e) {
  console.log('Logger not available, using console');
  logger = {
    info: console.log,
    error: console.error,
    warn: console.warn
  };
}

// Load authentication middleware (REQUIRED - fail if not available)
const auth = require('./middleware/auth');
authenticateSocket = auth.authenticateSocket;

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: process.env.CORS_ORIGIN || "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:"],
      scriptSrc: ["'self'"]
    }
  }
}));

app.use(compression());

// Rate limiting
const limiter = rateLimit({
  windowMs: (process.env.RATE_LIMIT_WINDOW || 15) * 60 * 1000, // 15 minutes
  max: process.env.RATE_LIMIT_MAX || 1000, // Increased from 100 to 1000 for development
  skip: (req) => {
    // Skip rate limiting for localhost during development
    const ip = req.ip || req.connection.remoteAddress;
    return ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1';
  },
  message: 'Too many requests from this IP, please try again later.'
});

app.use(limiter);

// CORS configuration
app.use(cors({
  origin: process.env.CORS_ORIGIN || "http://localhost:3000",
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  exposedHeaders: ['Content-Range', 'X-Content-Range']
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Static file serving
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// API Routes with error handling
try {
  authRoutes = require('./routes/auth');
  app.use('/api/auth', authRoutes);
  console.log('✓ Auth routes loaded');
} catch (e) {
  console.log('✗ Auth routes failed:', e.message);
}

try {
  userRoutes = require('./routes/users');
  app.use('/api/users', userRoutes);
  console.log('✓ User routes loaded');
} catch (e) {
  console.log('✗ User routes failed:', e.message);
}

try {
  projectRoutes = require('./routes/projects');
  app.use('/api/projects', projectRoutes);
  console.log('✓ Project routes loaded');
} catch (e) {
  console.log('✗ Project routes failed:', e.message);
}

try {
  fileRoutes = require('./routes/files');
  app.use('/api/files', fileRoutes);
  console.log('✓ File routes loaded');
} catch (e) {
  console.log('✗ File routes failed:', e.message);
}

try {
  chatRoutes = require('./routes/chat');
  app.use('/api/chat', chatRoutes);
  console.log('✓ Chat routes loaded');
} catch (e) {
  console.log('✗ Chat routes failed:', e.message);
}

try {
  auditRoutes = require('./routes/audit');
  app.use('/api/audit', auditRoutes);
  console.log('✓ Audit routes loaded');
} catch (e) {
  console.log('✗ Audit routes failed:', e.message);
}

try {
  agentsRoutes = require('./routes/agents');
  app.use('/api/agents', agentsRoutes);
  console.log('✓ Agents routes loaded');
} catch (e) {
  console.log('✗ Agents routes failed:', e.message);
}

try {
  auditSystemRoutes = require('./routes/audit-system');
  app.use('/api/audit-system', auditSystemRoutes);
  console.log('✓ Audit system routes loaded');
} catch (e) {
  console.log('✗ Audit system routes failed:', e.message);
}

try {
  ragRoutes = require('./routes/rag');
  app.use('/api/rag', ragRoutes);
  console.log('✓ RAG routes loaded');
} catch (e) {
  console.log('✗ RAG routes failed:', e.message);
}

try {
  profileRoutes = require('./routes/profile');
  app.use('/api/profile', profileRoutes);
  console.log('✓ Profile routes loaded');
} catch (e) {
  console.log('✗ Profile routes failed:', e.message);
}

try {
  dashboardRoutes = require('./routes/dashboard');
  app.use('/api/dashboard', dashboardRoutes);
  console.log('✓ Dashboard routes loaded');
} catch (e) {
  console.log('✗ Dashboard routes failed:', e.message);
}

try {
  arbitersRoutes = require('./routes/arbiters');
  app.use('/api/arbiters', arbitersRoutes);
  console.log('✓ Arbiters routes loaded');
} catch (e) {
  console.log('✗ Arbiters routes failed:', e.message);
}

try {
  aiCommandsRoutes = require('./routes/aiCommands');
  app.use('/api/ai', aiCommandsRoutes);
  console.log('✓ AI Commands routes loaded');
} catch (e) {
  console.log('✗ AI Commands routes failed:', e.message);
}

try {
  systemActionsRoutes = require('./routes/systemActions');
  app.use('/api/system', systemActionsRoutes);
  console.log('✓ System Actions routes loaded');
} catch (e) {
  console.log('✗ System Actions routes failed:', e.message);
}

try {
  const fileIntelRoutes = require('./routes/fileIntel');
  app.use('/api/file-intel', fileIntelRoutes);
  console.log('✓ File Intelligence routes loaded');
} catch (e) {
  console.log('✗ File Intelligence routes failed:', e.message);
}

try {
  const indexerRoutes = require('./routes/indexer');
  app.use('/api/indexer', indexerRoutes);
  console.log('✓ Indexer routes loaded');
} catch (e) {
  console.log('✗ Indexer routes failed:', e.message);
}

try {
  const warroomRoutes = require('./routes/warroom');
  app.use('/api/warroom', warroomRoutes);
  console.log('✓ War Room routes loaded');
} catch (e) {
  console.log('✗ War Room routes failed:', e.message);
}

try {
  const eclRoutes = require('./routes/ecl');
  app.use('/api/ecl', eclRoutes);
  console.log('✓ ECL routes loaded');
} catch (e) {
  console.log('✗ ECL routes failed:', e.message);
}

try {
  const aiConfigRoutes = require('./routes/aiConfig');
  app.use('/api/ai-config', aiConfigRoutes);
  console.log('✓ AI Config routes loaded');
} catch (e) {
  console.log('✗ AI Config routes failed:', e.message);
}

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0'
  });
});

// Socket.io for real-time chat
io.use(authenticateSocket);

io.on('connection', (socket) => {
  logger.info(`User connected: ${socket.userId}`);
  
  // Join project rooms
  socket.on('join-project', (projectId) => {
    socket.join(`project-${projectId}`);
    logger.info(`User ${socket.userId} joined project ${projectId}`);
  });
  
  // Handle chat messages
  socket.on('chat-message', async (data) => {
    try {
      const { projectId, message, type = 'user' } = data;
      
      // Save message to database (implement in chat controller)
      const savedMessage = await saveChatMessage({
        projectId,
        userId: socket.userId,
        message,
        type
      });
      
      // Broadcast to project room
      io.to(`project-${projectId}`).emit('new-message', savedMessage);
      
      // Handle AI mentions (@conceive, @thinker, @ai)
      if (message.includes('@conceive') || message.includes('@thinker') || message.includes('@ai')) {
        // Trigger AI response (implement AI service)
        setTimeout(async () => {
          const aiResponse = await generateAIResponse(message, projectId, socket.userId);
          const aiMessage = await saveChatMessage({
            projectId,
            userId: 'ai-assistant',
            message: aiResponse,
            type: 'ai'
          });
          
          io.to(`project-${projectId}`).emit('new-message', aiMessage);
        }, 1000);
      }
      
    } catch (error) {
      logger.error('Chat message error:', error);
      socket.emit('error', { message: 'Failed to send message' });
    }
  });
  
  socket.on('disconnect', () => {
    logger.info(`User disconnected: ${socket.userId}`);
  });
});

// Database connection
if (process.env.MONGODB_URI && process.env.MONGODB_URI !== 'mongodb://localhost:27017/conceive-audit-platform') {
  mongoose.connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => {
    logger.info('Connected to MongoDB');
  })
  .catch((error) => {
    logger.error('MongoDB connection error:', error);
    logger.info('Running in demo mode without database');
  });
} else {
  logger.info('Running in demo mode without MongoDB - install MongoDB to enable full features');
}

// Error handling middleware
app.use((error, req, res, next) => {
  logger.error(error);
  res.status(error.status || 500).json({
    message: error.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

// Initialize Legacy Arbiters (Python/FinPolymer)
// (Already handled by routes/arbiters.js loading)

// Initialize New Node.js Arbiter System (Timekeeper, Storage, SOMA)
(async () => {
  try {
    const { default: arbiterCoordinator } = await import('./arbiters/ArbiterCoordinator.js');
    console.log('🚀 Node.js Arbiter System (Timekeeper, Storage, SOMA) initialized via dynamic import');
  } catch (error) {
    console.warn('⚠️ Could not initialize Node.js Arbiter System:', error.message);
    console.warn('   (This is expected if using CommonJS without module support, but we are trying anyway)');
  }
})();

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  logger.info(`Conceive server running on port ${PORT}`);
  logger.info(`Environment: ${process.env.NODE_ENV}`);
});

// Placeholder functions (to be implemented)
async function saveChatMessage(messageData) {
  // TODO: Implement chat message saving
  return {
    id: Date.now(),
    ...messageData,
    timestamp: new Date()
  };
}

async function generateAIResponse(message, projectId, userId) {
  try {
    const somaService = require('./services/somaService');
    const projectContext = { id: projectId, message, userId: userId || 'anonymous' };
    // Use SOMA service
    const response = await somaService.assistWithQuery(message, projectContext);
    return response;
  } catch (error) {
    logger.error('SOMA AI response error:', error);
    
    // Fallback to Ollama if SOMA fails
    try {
        const ollamaService = require('./services/ollamaService');
        return await ollamaService.assistWithQuery(message, { id: projectId, userId: userId });
    } catch (e) {
        return "I'm processing your request, but both SOMA and Ollama engines are offline. Please check the backend console.";
    }
  }
}

module.exports = { app, server };
