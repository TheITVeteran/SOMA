const fs = require('fs').promises;
const path = require('path');
const axios = require('axios');

/**
 * AI Service - "Bring Your Own AI"
 * Supports OpenAI, Claude, and fallback to pattern matching
 */

class AIService {
  constructor() {
    this.configPath = path.join(__dirname, '../config/ai-config.json');
    this.config = null;
    this.loadConfig();
  }

  async loadConfig() {
    try {
      const data = await fs.readFile(this.configPath, 'utf8');
      this.config = JSON.parse(data);
    } catch (error) {
      // No config yet - user hasn't added keys
      this.config = {
        provider: 'none',
        openai_key: null,
        claude_key: null,
        use_local_ollama: true
      };
    }
  }

  async saveConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
    
    // Ensure config directory exists
    const configDir = path.dirname(this.configPath);
    await fs.mkdir(configDir, { recursive: true });
    
    await fs.writeFile(this.configPath, JSON.stringify(this.config, null, 2));
    return this.config;
  }

  getProvider() {
    if (this.config.openai_key) return 'openai';
    if (this.config.claude_key) return 'claude';
    if (this.config.use_local_ollama) return 'ollama';
    return 'none';
  }

  isAIAvailable() {
    return this.getProvider() !== 'none';
  }

  /**
   * Analyze screenshot with AI vision
   * Returns description of what's on screen
   */
  async analyzeScreenshot(base64Image, question = "What do you see on this screen?") {
    const provider = this.getProvider();

    if (provider === 'openai') {
      return await this.analyzeWithOpenAI(base64Image, question);
    } else if (provider === 'claude') {
      return await this.analyzeWithClaude(base64Image, question);
    } else {
      // Fallback to basic pattern matching
      return {
        provider: 'pattern_matching',
        description: 'AI vision not available. Using basic pattern matching.',
        confidence: 0.3
      };
    }
  }

  /**
   * OpenAI GPT-4 Vision
   */
  async analyzeWithOpenAI(base64Image, question) {
    try {
      const response = await axios.post(
        'https://api.openai.com/v1/chat/completions',
        {
          model: 'gpt-4o',
          messages: [
            {
              role: 'user',
              content: [
                { type: 'text', text: question },
                {
                  type: 'image_url',
                  image_url: {
                    url: `data:image/png;base64,${base64Image}`
                  }
                }
              ]
            }
          ],
          max_tokens: 500
        },
        {
          headers: {
            'Authorization': `Bearer ${this.config.openai_key}`,
            'Content-Type': 'application/json'
          }
        }
      );

      return {
        provider: 'openai',
        description: response.data.choices[0].message.content,
        confidence: 0.9,
        cost: response.data.usage?.total_tokens * 0.00001 || 0.01
      };
    } catch (error) {
      console.error('[OpenAI] Error:', error.response?.data || error.message);
      throw new Error('OpenAI API error: ' + (error.response?.data?.error?.message || error.message));
    }
  }

  /**
   * Claude Vision (Anthropic)
   */
  async analyzeWithClaude(base64Image, question) {
    try {
      const response = await axios.post(
        'https://api.anthropic.com/v1/messages',
        {
          model: 'claude-3-5-sonnet-20241022',
          max_tokens: 500,
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'image',
                  source: {
                    type: 'base64',
                    media_type: 'image/png',
                    data: base64Image
                  }
                },
                {
                  type: 'text',
                  text: question
                }
              ]
            }
          ]
        },
        {
          headers: {
            'x-api-key': this.config.claude_key,
            'anthropic-version': '2023-06-01',
            'Content-Type': 'application/json'
          }
        }
      );

      return {
        provider: 'claude',
        description: response.data.content[0].text,
        confidence: 0.9,
        cost: 0.01
      };
    } catch (error) {
      console.error('[Claude] Error:', error.response?.data || error.message);
      throw new Error('Claude API error: ' + (error.response?.data?.error?.message || error.message));
    }
  }

  /**
   * Find UI element by description using AI
   */
  async findElement(base64Image, elementDescription) {
    const provider = this.getProvider();
    
    if (provider === 'none') {
      return null; // Fall back to OCR-based search
    }

    const question = `You are analyzing a screenshot to help control a computer. 
Find the "${elementDescription}" on this screen.
Return ONLY a JSON object with this format:
{
  "found": true/false,
  "x": pixel_x_coordinate,
  "y": pixel_y_coordinate,
  "confidence": 0.0-1.0,
  "description": "brief description of what you found"
}`;

    try {
      const result = await this.analyzeScreenshot(base64Image, question);
      const parsed = JSON.parse(result.description);
      return {
        ...parsed,
        provider: result.provider
      };
    } catch (error) {
      console.error('[AI] Element detection error:', error);
      return null;
    }
  }

  /**
   * Decide next action based on current screen
   */
  async decideNextAction(base64Image, goal, currentStep) {
    const provider = this.getProvider();
    
    if (provider === 'none') {
      return { action: 'continue', reasoning: 'No AI available' };
    }

    const question = `You are controlling a computer to achieve this goal: "${goal}"
Current step: ${currentStep}

What should be the next action? Return ONLY a JSON object:
{
  "action": "click"|"type"|"scroll"|"wait"|"done",
  "target": "description or coordinates",
  "text": "text to type if action is type",
  "reasoning": "brief explanation"
}`;

    try {
      const result = await this.analyzeScreenshot(base64Image, question);
      return JSON.parse(result.description);
    } catch (error) {
      console.error('[AI] Decision error:', error);
      return { action: 'continue', reasoning: 'AI error, continuing with plan' };
    }
  }

  /**
   * Test API key validity
   */
  async testConnection(provider, apiKey) {
    try {
      if (provider === 'openai') {
        const response = await axios.get('https://api.openai.com/v1/models', {
          headers: { 'Authorization': `Bearer ${apiKey}` }
        });
        return { success: true, models: response.data.data.length };
      } else if (provider === 'claude') {
        // Claude doesn't have a simple test endpoint, so we just validate format
        if (apiKey.startsWith('sk-ant-')) {
          return { success: true, message: 'Key format valid' };
        }
        return { success: false, error: 'Invalid key format' };
      }
    } catch (error) {
      return { 
        success: false, 
        error: error.response?.data?.error?.message || error.message 
      };
    }
  }
}

module.exports = new AIService();
