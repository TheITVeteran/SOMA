const express = require('express');
const router = express.Router();
const ollamaService = require('../services/ollamaService');
const somaService = require('../services/somaService'); // Import SOMA
const dynamicAgentService = require('../services/dynamicAgentService'); // Dynamic Agents
const { authenticateToken: auth } = require('../middleware/auth');

// Initialize dynamic agents
dynamicAgentService.initialize();

// ... (keep broker bridge init)

// Helper to check SOMA availability
const isSomaAvailable = async () => {
    return await somaService.checkHealth();
};

// Health check with AI connectivity
router.get('/health', async (req, res) => {
  // ... (existing health logic)
    res.json({
      status: 'ok',
      soma_connected: await isSomaAvailable(),
      // ... (other fields)
      active_custom_agents: dynamicAgentService.getAgentList().length, // Add this
      message: 'AI agents system operational',
      timestamp: new Date().toISOString()
    });
  // ...
});

// ==========================================
// DYNAMIC AGENT MANAGEMENT
// ==========================================

// Create a new agent
router.post('/create', auth, async (req, res) => {
    try {
        const { name, description, instructions } = req.body;
        const userId = req.user?.id || 'anonymous'; // Owner context
        
        if (!name || !instructions) return res.status(400).json({ error: "Name and instructions required" });
        
        const agent = await dynamicAgentService.createAgent(name, description, instructions, userId);
        res.json({ success: true, agent });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// List all agents (Visible to User)
router.get('/list', auth, (req, res) => {
    const userId = req.user?.id || 'anonymous';
    res.json(dynamicAgentService.getAgentList(userId));
});

// Rename an agent
router.post('/rename', auth, async (req, res) => {
    try {
        const { oldName, newName } = req.body;
        const userId = req.user?.id || 'anonymous';
        
        const agent = await dynamicAgentService.renameAgent(oldName, newName, userId);
        res.json({ success: true, message: `Renamed to ${newName}`, agent });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Share (or Unshare) an agent
router.post('/share', auth, async (req, res) => {
    try {
        const { name, shared } = req.body; // shared = true/false
        const userId = req.user?.id || 'anonymous';
        
        const agent = await dynamicAgentService.toggleShareAgent(name, userId, shared !== false);
        res.json({ 
            success: true, 
            message: agent.shared ? `Agent '${name}' is now shared and permanent.` : `Agent '${name}' is now private.`, 
            agent 
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Invoke a specific agent
router.post('/invoke/:name', async (req, res) => {
    try {
        const { name } = req.params;
        const { query, context } = req.body;
        // Invocation doesn't strictly need auth (public agents), but could restrict if needed
        
        const result = await dynamicAgentService.invokeAgent(name, query, context);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Save (Persist) an agent forever (Admin/Owner only really, but kept open for prototype)
router.post('/persist/:name', auth, async (req, res) => {
    try {
        const { name } = req.params;
        const agent = await dynamicAgentService.persistAgent(name);
        res.json({ success: true, message: `Agent '${name}' saved forever.`, agent });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Delete an agent manually
router.post('/delete/:name', auth, async (req, res) => {
    try {
        const { name } = req.params;
        const userId = req.user?.id || 'anonymous';
        
        await dynamicAgentService.deleteAgent(name, userId);
        res.json({ success: true, message: `Agent '${name}' deleted.` });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ==========================================
// EXISTING AGENT ROUTES
// ==========================================

// Execute AI agent orchestration
router.post('/orchestrate', async (req, res) => {
  try {
    const { query, projectData } = req.body;
    
    if (!query) {
      return res.status(400).json({ error: 'Query is required' });
    }
    
    // SOMA Orchestration
    if (await isSomaAvailable()) {
        try {
            const result = await somaService.assistWithQuery(
                `Orchestrate a plan for this query: "${query}". Return a JSON object with 'steps' and 'agents' needed.`, 
                { userId: 'orchestrator', context: JSON.stringify(projectData) }
            );
            // Attempt to parse JSON from SOMA's response
            try {
                const parsed = JSON.parse(result.match(/\{[\s\S]*\}/)[0]);
                return res.json(parsed);
            } catch (e) {
                // If SOMA returns text, wrap it
                return res.json({ plan: result, source: 'soma' });
            }
        } catch (e) {
            console.log('SOMA orchestration failed, falling back...');
        }
    }

    const result = await ollamaService.orchestrate(query, projectData || {});
    res.json(result);
  } catch (error) {
    console.error('Orchestration error:', error);
    res.status(500).json({ error: 'Failed to process AI request' });
  }
});

// Parse document
router.post('/parse', async (req, res) => {
  try {
    const { content, type } = req.body;
    
    if (!content) {
      return res.status(400).json({ error: 'Document content is required' });
    }

    if (await isSomaAvailable()) {
        try {
            const result = await somaService.analyzeFile(content, { type: type || 'general', filename: 'parsed_doc' });
            return res.json({ agent: 'Parser (SOMA)', response: result });
        } catch (e) {
            console.log('SOMA parse failed, falling back...');
        }
    }
    
    const result = await ollamaService.parseDocument(content, type || 'general');
    res.json({ agent: 'Parser', response: result });
  } catch (error) {
    console.error('Parse error:', error);
    res.status(500).json({ error: 'Failed to parse document' });
  }
});

// Analyze data
router.post('/analyze', async (req, res) => {
  try {
    const { data, analysisType } = req.body;
    
    if (!data) {
      return res.status(400).json({ error: 'Data is required' });
    }

    if (await isSomaAvailable()) {
        try {
            const result = await somaService.analyzeFile(JSON.stringify(data), { type: analysisType || 'financial', filename: 'analysis_data' });
             return res.json({ agent: 'Analyzer (SOMA)', response: result });
        } catch (e) {
            console.log('SOMA analysis failed, falling back...');
        }
    }
    
    const result = await ollamaService.analyzeData(data, analysisType || 'financial');
    res.json({ agent: 'Analyzer', response: result });
  } catch (error) {
    console.error('Analysis error:', error);
    res.status(500).json({ error: 'Failed to analyze data' });
  }
});

// Cross-link documents
router.post('/crosslink', auth, async (req, res) => {
  try {
    const { doc1, doc2, linkType } = req.body;
    
    if (!doc1 || !doc2) {
      return res.status(400).json({ error: 'Both documents are required' });
    }

    if (await isSomaAvailable()) {
        try {
            const query = `Cross-link these two documents based on ${linkType || 'general'} criteria. Identify common entities, contradictions, and relationships.`;
            const context = `DOC 1:\n${doc1.substring(0, 10000)}\n\nDOC 2:\n${doc2.substring(0, 10000)}`;
            const result = await somaService.assistWithQuery(query, { userId: 'crosslinker', context });
            return res.json({ agent: 'CrossLink (SOMA)', response: result });
        } catch (e) {
             console.log('SOMA crosslink failed, falling back...');
        }
    }
    
    const result = await ollamaService.crossLinkDocuments(doc1, doc2, linkType || 'general');
    res.json({ agent: 'CrossLink', response: result });
  } catch (error) {
    console.error('CrossLink error:', error);
    res.status(500).json({ error: 'Failed to cross-link documents' });
  }
});

// Summarize project
router.post('/summarize', auth, async (req, res) => {
  try {
    const { projectData } = req.body;
    
    if (!projectData) {
      return res.status(400).json({ error: 'Project data is required' });
    }

    if (await isSomaAvailable()) {
        try {
            const result = await somaService.assistWithQuery(
                "Summarize this project status, risks, and next steps.", 
                { userId: 'summarizer', context: JSON.stringify(projectData) }
            );
            return res.json({ agent: 'Summarizer (SOMA)', response: result });
        } catch (e) {
             console.log('SOMA summarize failed, falling back...');
        }
    }
    
    const result = await ollamaService.summarizeProject(projectData);
    res.json({ agent: 'Summarizer', response: result });
  } catch (error) {
    console.error('Summarize error:', error);
    res.status(500).json({ error: 'Failed to summarize project' });
  }
});

// Review compliance
router.post('/review', auth, async (req, res) => {
  try {
    const { data, complianceType } = req.body;
    
    if (!data) {
      return res.status(400).json({ error: 'Data is required' });
    }

    if (await isSomaAvailable()) {
        try {
            const result = await somaService.assistWithQuery(
                `Review this data for compliance with ${complianceType || 'audit'} standards. Flag any violations.`,
                { userId: 'reviewer', context: JSON.stringify(data) }
            );
            return res.json({ agent: 'Reviewer (SOMA)', response: result });
        } catch (e) {
             console.log('SOMA review failed, falling back...');
        }
    }
    
    const result = await ollamaService.reviewCompliance(data, complianceType || 'audit');
    res.json({ agent: 'Reviewer', response: result });
  } catch (error) {
    console.error('Review error:', error);
    res.status(500).json({ error: 'Failed to review compliance' });
  }
});

// General AI assistant with Universal Message Broker support
router.post('/assist', async (req, res) => {
  try {
    const { query, projectContext } = req.body;
    
    if (!query) {
      return res.status(400).json({ error: 'Query is required' });
    }
    
    // Try Universal Message Broker first
    if (brokerBridge && brokerBridge.isConnected) {
      try {
        const aiResult = await brokerBridge.analyzeWithAI(
          `You are The Thinker, an AI assistant for audit and accounting. User query: ${query}. Context: ${JSON.stringify(projectContext)}. Provide a helpful, professional response.`
        );
        
        if (aiResult.success) {
          return res.json({
            agent: 'The Thinker (AI-Enhanced)',
            response: aiResult.response,
            source: 'universal_broker',
            timestamp: new Date().toISOString()
          });
        }
      } catch (brokerError) {
        console.log('[AGENTS] Broker assist failed, trying direct Ollama...');
      }
    }
    
    // Try direct Ollama
    try {
      const result = await ollamaService.assistWithQuery(query, projectContext || {});
      return res.json({
        agent: 'The Thinker',
        response: result,
        source: 'direct_ollama',
        timestamp: new Date().toISOString()
      });
    } catch (ollamaError) {
      console.log('[AGENTS] Direct assist failed, using fallback...');
    }
    
    // Fallback response
    res.json({
      agent: 'The Thinker',
      response: `Hello! I'm The Thinker. I understand you're asking about "${query}". I'm here to help with your audit and analysis tasks. For enhanced AI capabilities, please ensure your local AI system is running.`,
      source: 'fallback',
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Assist error:', error);
    res.status(500).json({ 
      agent: 'The Thinker',
      response: "I'm experiencing technical difficulties. Please try again later.",
      error: error.message,
      source: 'error'
    });
  }
});

// Chat endpoint for real-time conversation
router.post('/chat', async (req, res) => {
  try {
    const { messages } = req.body;
    
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'Messages array is required' });
    }
    
    const result = await ollamaService.chat(messages);
    res.json({ response: result });
  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({ error: 'Failed to process chat' });
  }
});

module.exports = router;