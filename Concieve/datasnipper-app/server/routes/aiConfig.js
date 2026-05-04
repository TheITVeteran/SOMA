const express = require('express');
const router = express.Router();
const aiService = require('../services/aiService');

/**
 * AI Configuration Routes
 * Manage API keys and AI provider settings
 */

// Get current AI configuration (without exposing keys)
router.get('/config', async (req, res) => {
  try {
    const provider = aiService.getProvider();
    const hasOpenAI = !!aiService.config.openai_key;
    const hasClaude = !!aiService.config.claude_key;
    
    res.json({
      provider,
      available_providers: {
        openai: hasOpenAI,
        claude: hasClaude,
        ollama: aiService.config.use_local_ollama,
        none: !hasOpenAI && !hasClaude
      },
      ai_enabled: aiService.isAIAvailable()
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update AI configuration
router.post('/config', async (req, res) => {
  try {
    const { provider, api_key } = req.body;
    
    if (!provider || !['openai', 'claude', 'none'].includes(provider)) {
      return res.status(400).json({ error: 'Invalid provider' });
    }
    
    const newConfig = {};
    
    if (provider === 'openai') {
      newConfig.openai_key = api_key;
    } else if (provider === 'claude') {
      newConfig.claude_key = api_key;
    } else if (provider === 'none') {
      newConfig.openai_key = null;
      newConfig.claude_key = null;
    }
    
    await aiService.saveConfig(newConfig);
    
    res.json({
      success: true,
      provider: aiService.getProvider(),
      message: `AI provider set to ${provider}`
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Test API key connection
router.post('/test', async (req, res) => {
  try {
    const { provider, api_key } = req.body;
    
    if (!provider || !api_key) {
      return res.status(400).json({ error: 'Provider and API key required' });
    }
    
    const result = await aiService.testConnection(provider, api_key);
    res.json(result);
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Analyze screenshot endpoint (for testing)
router.post('/analyze-screen', async (req, res) => {
  try {
    const { base64_image, question } = req.body;
    
    if (!base64_image) {
      return res.status(400).json({ error: 'Screenshot required' });
    }
    
    const result = await aiService.analyzeScreenshot(base64_image, question);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
