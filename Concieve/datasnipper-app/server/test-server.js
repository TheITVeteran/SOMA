console.log('Starting server test...');

try {
  // Test basic requirements
  console.log('Testing express...');
  const express = require('express');
  console.log('✓ Express loaded');
  
  console.log('Testing cors...');
  const cors = require('cors');
  console.log('✓ CORS loaded');
  
  console.log('Testing environment...');
  require('dotenv').config();
  console.log('✓ Dotenv loaded');
  
  // Test routes
  console.log('Testing auth routes...');
  const authRoutes = require('./routes/auth');
  console.log('✓ Auth routes loaded');
  
  console.log('Testing agents routes...');
  const agentsRoutes = require('./routes/agents');
  console.log('✓ Agents routes loaded');
  
  // Test services
  console.log('Testing Ollama service...');
  const ollamaService = require('./services/ollamaService');
  console.log('✓ Ollama service loaded');
  
  console.log('Testing audit system...');
  const auditSystem = require('./services/auditSystem');
  console.log('✓ Audit system loaded');
  
  // Try to start a simple server
  const app = express();
  app.use(cors());
  app.use(express.json());
  
  app.get('/test', (req, res) => {
    res.json({ status: 'ok' });
  });
  
  const PORT = 5000;
  app.listen(PORT, () => {
    console.log(`✓ Test server running on port ${PORT}`);
    console.log('Visit http://localhost:5000/test');
  });
  
} catch (error) {
  console.error('ERROR:', error.message);
  console.error('Stack:', error.stack);
  process.exit(1);
}