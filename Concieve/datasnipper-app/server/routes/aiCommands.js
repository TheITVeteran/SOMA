const express = require('express');
const router = express.Router();
const axios = require('axios');

// Optional AI services - customers can configure their own
let ollamaService = null;
try {
  ollamaService = require('../services/ollamaService');
} catch (e) {
  console.log('Ollama service not available - using pattern matching');
}

/**
 * Process natural language command and generate executable actions
 * POST /api/ai/process-command
 */
router.post('/process-command', async (req, res) => {
  try {
    const { command, context } = req.body;
    
    if (!command || typeof command !== 'string') {
      return res.status(400).json({ error: 'Invalid command' });
    }

    console.log(`Processing AI command: "${command}"`);

    // Check for configured AI service (customer's optional API key)
    const aiProvider = context?.aiProvider || process.env.AI_PROVIDER;
    const apiKey = context?.apiKey || process.env.AI_API_KEY;

    let actionPlan;

    // Priority 1: SOMA Intelligence (The "Powered By" Add-on)
    // Checks if SOMA service is reachable locally
    const somaService = require('../services/somaService');
    const isSomaActive = await somaService.checkHealth();

    if (isSomaActive && (!aiProvider || aiProvider === 'soma')) {
       try {
         console.log('Using SOMA Intelligence (Local Add-on)');
         // We ask SOMA to act as a command parser
         const response = await somaService.assistWithQuery(
           `Convert this command to action JSON: "${command}". Return only valid JSON with an "actions" array.`,
           { userId: 'system', context: 'command_parsing' }
         );
         
         // Try to parse SOMA's response as JSON
         const jsonMatch = response.match(/\{[\s\S]*\}/);
         if (jsonMatch) {
            actionPlan = { ...JSON.parse(jsonMatch[0]), mode: 'soma' };
         } else {
            throw new Error('SOMA returned text, not JSON');
         }
       } catch (error) {
         console.log('SOMA parsing failed, falling back to standard AI:', error.message);
         // Fall through to next providers
       }
    }

    // Priority 2: Customer's premium AI service (if configured)
    if (!actionPlan && apiKey && aiProvider === 'openai') {
      try {
        actionPlan = await processWithOpenAI(command, apiKey);
        console.log('Using OpenAI');
      } catch (error) {
        console.log('OpenAI failed, falling back to Tinyllama:', error.message);
        actionPlan = await processWithTinyllama(command);
      }
    } else if (apiKey && aiProvider === 'claude') {
      try {
        actionPlan = await processWithClaude(command, apiKey);
        console.log('Using Claude');
      } catch (error) {
        console.log('Claude failed, falling back to Tinyllama:', error.message);
        actionPlan = await processWithTinyllama(command);
      }
    } else {
      // Default: Use Tinyllama (embedded AI, always available)
      actionPlan = await processWithTinyllama(command);
    }

    // Validate and sanitize
    if (!actionPlan.actions || !Array.isArray(actionPlan.actions)) {
      actionPlan.actions = [];
    }

    // Add metadata
    actionPlan.actions = actionPlan.actions.map(action => ({
      ...action,
      status: 'pending',
      timestamp: new Date().toISOString()
    }));

    actionPlan.summary = actionPlan.summary || `${actionPlan.actions.length} action(s) to execute`;
    actionPlan.intent = actionPlan.intent || command;

    console.log('Action plan:', JSON.stringify(actionPlan, null, 2));

    res.json(actionPlan);

  } catch (error) {
    console.error('Command processing error:', error);
    const fallback = fallbackParser(req.body.command);
    res.json(fallback);
  }
});

/**
 * Process with Tinyllama (embedded AI - always works)
 */
async function processWithTinyllama(command) {
  if (!ollamaService) {
    console.log('Tinyllama not available, using pattern matching');
    return smartPatternParser(command);
  }

  try {
    // Try pattern matching first - it's more reliable for simple commands
    const patternResult = smartPatternParser(command);
    if (patternResult.actions.length > 0) {
      console.log('Using pattern matching (reliable)');
      return patternResult;
    }

    // Only use Tinyllama for complex queries
    const prompt = `Extract the search query from this command: "${command}"
If it's a search, return JSON: {"actions":[{"type":"search_files","description":"Search for X","params":{"query":"X"}}]}
JSON only:`;

    const aiResponse = await Promise.race([
      ollamaService.generate(prompt),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 3000))
    ]);

    const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return { ...parsed, mode: 'tinyllama' };
    }
    throw new Error('No JSON in AI response');
  } catch (error) {
    console.log('AI failed, using pattern matching:', error.message);
    return smartPatternParser(command);
  }
}

/**
 * Smart pattern parser - ultimate fallback, always works
 */
function smartPatternParser(command) {
  const actions = [];
  
  if (!command || command.trim().length < 2) {
    return {
      intent: 'No action detected',
      actions: [],
      summary: 'Query too short',
      mode: 'pattern-matching'
    };
  }
  const lower = command.toLowerCase();

  // File search patterns
  if (/find|search|locate|looking for|where is|show me/i.test(command)) {
    // Check for file with extension
    const fileMatch = command.match(/(\w+\.\w+)|["']([^"']+)["']/);
    if (fileMatch) {
      const query = fileMatch[1] || fileMatch[2];
      actions.push({
        type: 'search_files',
        description: `Search for file: ${query}`,
        params: { query },
        status: 'pending'
      });
    } 
    // Check for numbers (account numbers, amounts, etc)
    else if (/\d{3,}/.test(command)) {
      const numberMatch = command.match(/\d+(?:[.,]\d+)?/);
      if (numberMatch) {
        actions.push({
          type: 'search_content',
          description: `Search for number: ${numberMatch[0]}`,
          params: { query: numberMatch[0], fileTypes: ['xlsx', 'xls', 'txt', 'csv', 'pdf'] },
          status: 'pending'
        });
      }
    }
    // General search - extract meaningful words
    else {
      // Remove command words and extract the actual search query
      let searchTerms = command
        .toLowerCase()
        .replace(/^(find|search|locate|looking for|where is|show me|can you|please|get me|i need|i want)\s+/gi, '')
        .replace(/\b(the|a|an|for|me|my|some|any)\b/gi, '')
        .trim();
      
      // If query still has words, use it
      if (searchTerms.length > 2) {
        actions.push({
          type: 'search_files',
          description: `Search for: ${searchTerms}`,
          params: { query: searchTerms },
          status: 'pending'
        });
      }
    }
  }

  // Open program
  if (/open|launch|start|run/i.test(command) && !/file/i.test(command)) {
    const programs = {
      excel: ['excel', 'spreadsheet', 'xlsx'],
      word: ['word', 'document', 'docx'],
      notepad: ['notepad', 'text editor'],
      explorer: ['explorer', 'file explorer', 'files'],
      calculator: ['calculator', 'calc'],
      chrome: ['chrome', 'browser'],
      edge: ['edge']
    };

    for (const [prog, keywords] of Object.entries(programs)) {
      if (keywords.some(kw => lower.includes(kw))) {
        actions.push({
          type: 'open_program',
          description: `Open ${prog}`,
          params: { name: prog },
          status: 'pending'
        });
        break;
      }
    }
  }

  // Open specific file
  if (/open.*file|show.*file/i.test(command)) {
    const pathMatch = command.match(/["']([^"']+)["']/) || command.match(/(\w+\.\w+)/);
    if (pathMatch) {
      actions.push({
        type: 'open_file',
        description: `Open file: ${pathMatch[1]}`,
        params: { path: pathMatch[1] },
        status: 'pending'
      });
    }
  }

  return {
    intent: `${actions.length} action(s) detected`,
    actions,
    summary: actions.length > 0 
      ? `Executing ${actions.length} action(s)` 
      : 'No actions identified',
    mode: 'pattern-matching'
  };
}

/**
 * Process with OpenAI (customer's API key)
 */
async function processWithOpenAI(command, apiKey) {
  const response = await axios.post('https://api.openai.com/v1/chat/completions', {
    model: 'gpt-3.5-turbo',
    messages: [
      {
        role: 'system',
        content: 'Convert user commands to action JSON. Return only valid JSON with an "actions" array. Each action has: type (search_files|open_file|open_program|search_content), description, params.'
      },
      {
        role: 'user',
        content: command
      }
    ],
    temperature: 0.3,
    max_tokens: 200
  }, {
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    timeout: 10000
  });

  const content = response.data.choices[0].message.content;
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    return { ...JSON.parse(jsonMatch[0]), mode: 'openai' };
  }
  throw new Error('No JSON in response');
}

/**
 * Process with Claude (customer's API key)
 */
async function processWithClaude(command, apiKey) {
  const response = await axios.post('https://api.anthropic.com/v1/messages', {
    model: 'claude-3-haiku-20240307',
    max_tokens: 200,
    messages: [
      {
        role: 'user',
        content: `Convert this command to action JSON: "${command}". Return only valid JSON with an "actions" array.`
      }
    ]
  }, {
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json'
    },
    timeout: 10000
  });

  const content = response.data.content[0].text;
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    return { ...JSON.parse(jsonMatch[0]), mode: 'claude' };
  }
  throw new Error('No JSON in response');
}

module.exports = router;
