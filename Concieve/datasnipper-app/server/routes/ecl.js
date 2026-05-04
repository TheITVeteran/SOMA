const express = require('express');
const router = express.Router();
const ollamaService = require('../services/ollamaService');
const somaService = require('../services/somaService'); // Import SOMA

// Import all capabilities
const systemActions = require('./systemActions');

/**
 * Expandable Command Line (ECL) - Production Orchestrator
 * 
 * This is the main entry point for the AI-powered command system.
 * It intelligently routes commands to the appropriate agents, arbiters, and system actions.
 */

// Session memory for context
const sessionMemory = new Map();

// Agent registry - extensible
const agentRegistry = {
  // File operations
  'file_search': { handler: 'system', endpoint: '/system/search-files', capability: 'Search for files by name' },
  'content_search': { handler: 'system', endpoint: '/system/search-content', capability: 'Search within file contents' },
  'file_open': { handler: 'system', endpoint: '/system/open-file', capability: 'Open files with default application' },
  
  // Program control
  'program_open': { handler: 'system', endpoint: '/system/open-program', capability: 'Launch applications' },
  
  // AI analysis (Powered by SOMA)
  'document_parse': { handler: 'soma', method: 'parse', capability: 'Extract information from documents' },
  'data_analyze': { handler: 'soma', method: 'analyze', capability: 'Analyze data patterns and insights' },
  'document_crosslink': { handler: 'soma', method: 'crosslink', capability: 'Find connections between documents' },
  'project_summarize': { handler: 'soma', method: 'summarize', capability: 'Summarize project status' },
  'compliance_review': { handler: 'soma', method: 'review', capability: 'Review compliance requirements' },
  
  // Financial arbiters (Powered by SOMA)
  'ledger_reconcile': { handler: 'arbiter', service: 'reconcile', capability: 'Reconcile financial ledgers' },
  'fraud_detect': { handler: 'arbiter', service: 'fraud-check', capability: 'Detect fraudulent transactions' },
  'audit_analyze': { handler: 'arbiter', service: 'audit', capability: 'Perform audit analysis' },
  
  // Computer control (Local Python Service)
  'computer_control': { handler: 'external', url: 'http://127.0.0.1:8001/execute', capability: 'Control mouse, keyboard, and GUI automation' }
};

/**
 * Main ECL endpoint - processes natural language commands
 * POST /api/ecl/command
 */
router.post('/command', async (req, res) => {
  try {
    const { command, sessionId } = req.body;
    
    if (!command || typeof command !== 'string') {
      return res.status(400).json({ error: 'Command is required' });
    }

    console.log(`[ECL] Processing: "${command}"`);

    // Get session context
    const session = sessionId ? sessionMemory.get(sessionId) || {} : {};
    const context = session.lastResults || [];

    // Parse command and determine intent
    const intent = await parseIntent(command, context);
    console.log('[ECL] Intent:', intent);

    // Execute appropriate agents - Passing UserId for Belief Context
    const userId = req.user?.id || req.body.userId || 'anonymous';
    const results = await executeIntent(intent, command, userId);

    // Store in session memory for follow-up commands
    if (sessionId) {
      sessionMemory.set(sessionId, {
        lastCommand: command,
        lastResults: results,
        timestamp: new Date().toISOString()
      });
    }

    // Format response
    const response = formatResponse(results, command);

    res.json({
      success: true,
      command,
      intent: intent.type,
      agents_used: results.agents,
      response: response.text,
      data: results.data,
      session_id: sessionId || generateSessionId()
    });

  } catch (error) {
    console.error('[ECL] Error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      fallback: 'I encountered an error processing your command. Please try rephrasing it.'
    });
  }
});

/**
 * Parse user intent from natural language
 * Uses pattern matching FIRST, AI only as last resort
 */
async function parseIntent(command, context = []) {
  const lower = command.toLowerCase();

  // Explicit AI Invocation (@thinker, @Concieve - TEST.html)
  if (/^@thinker|^@concieve - test\.html/i.test(command)) {
    const cleanCommand = command.replace(/^@thinker|^@concieve - test\.html/i, '').trim();
    if (!cleanCommand) {
       return { type: 'greeting', params: { greeting: 'hello' } };
    }
    
    // If command follows, treat as explicit computer control or AI query
    // Re-run parsing on the clean command to catch "find file" etc.
    const subIntent = await parseIntent(cleanCommand, context);
    if (subIntent.type !== 'unknown') {
        return subIntent;
    }
    // Default to computer control/AI if no other pattern matches
    return { type: 'computer_control', params: { query: cleanCommand } };
  }

  // Simple greetings - instant response
  if (/^(hi|hello|hey|thanks|thank you|ok|okay)$/i.test(command.trim())) {
    return { type: 'greeting', params: { greeting: command.trim().toLowerCase() } };
  }

  // Autonomous multi-step tasks - CHECK FIRST before file search!
  if (/find.*(picture|image|photo|wallpaper|background)|search.*google|search.*web|find.*on.*google|look.*up/i.test(command)) {
    return { type: 'computer_control', params: { query: command, autonomous: true } };
  }

  if (/find.*wallpaper|search.*for.*and|download.*from|navigate.*to.*and|browse.*for/i.test(command)) {
    return { type: 'computer_control', params: { query: command, autonomous: true } };
  }

  // File operations - extract search term more intelligently
  if (/find|locate|where/i.test(command) && !/search.*for|search.*in/i.test(command)) {
    let query = command
      .replace(/^(find|locate|where is|where's|can you find|please find)/gi, '')
      .replace(/\b(the|a|an|for|me|my|file|files)\b/gi, '')
      .trim();
    if (query.length > 0) {
      return { type: 'file_search', params: { query } };
    }
  }

  // Content search
  if (/search.*for|search.*in|find.*in.*file/i.test(command)) {
    let query = command
      .replace(/search.*for|search.*in|find.*in.*file/gi, '')
      .replace(/\b(the|a|an)\b/gi, '')
      .trim();
    if (query.length > 0) {
      return { type: 'content_search', params: { query } };
    }
  }

  // Windows navigation shortcuts
  if (/open.*start.*menu|show.*start/i.test(command)) {
    return { type: 'computer_control', params: { query: 'press windows key' } };
  }

  if (/open.*file.*explorer|open.*explorer|show.*files/i.test(command)) {
    return { type: 'computer_control', params: { query: 'press windows+e' } };
  }

  if (/open.*task.*manager|show.*processes/i.test(command)) {
    return { type: 'computer_control', params: { query: 'press ctrl+shift+esc' } };
  }

  if (/open.*settings|show.*settings/i.test(command)) {
    return { type: 'computer_control', params: { query: 'press windows+i' } };
  }

  if (/take.*screenshot|capture.*screen/i.test(command)) {
    return { type: 'computer_control', params: { query: 'press windows+shift+s' } };
  }

  if (/minimize.*window|minimize.*all/i.test(command)) {
    return { type: 'computer_control', params: { query: 'press windows+d' } };
  }


  // GUI control commands - route to computer control service
  if (/click|press|type.*into|scroll.*to|drag|move.*mouse/i.test(command)) {
    return { type: 'computer_control', params: { query: command } };
  }

  // Open program
  if (/open|launch|start|run/i.test(command)) {
    const match = command.match(/(notepad|excel|word|calculator|chrome|edge|explorer|firefox|cmd|powershell)/i);
    if (match) {
      return { type: 'program_open', params: { name: match[1].toLowerCase() } };
    }
  }

  // Open file
  if (/open/i.test(command)) {
    const pathMatch = command.match(/["']([^"']+)["']/) || command.match(/(\w+\.\w+)/);
    if (pathMatch) {
      return { type: 'file_open', params: { path: pathMatch[1] } };
    }
  }

  // Financial operations
  if (/reconcile|match.*ledger|compare.*transactions/i.test(command)) {
    return { type: 'ledger_reconcile', params: {} };
  }

  if (/fraud|suspicious|anomal/i.test(command)) {
    return { type: 'fraud_detect', params: {} };
  }

  if (/audit|review.*transaction|compliance/i.test(command)) {
    return { type: 'audit_analyze', params: {} };
  }

  // Contextual follow-ups
  if (/graph|chart|visualize|plot/i.test(command) && context.length > 0) {
    return { type: 'data_visualize', params: { data: context }, contextual: true };
  }

  // If pattern matching didn't find anything, return unknown
  // Don't use AI - it hallucinates too much
  return { 
    type: 'unknown', 
    params: { original: command },
    suggestions: [
      'find [filename]',
      'search for [text]',
      'open [program]'
    ]
  };
}

/**
 * Execute the determined intent
 */
async function executeIntent(intent, originalCommand, userId = 'anonymous') {
  const results = { agents: [], data: null, raw: [] };

  try {
    // Handle greetings instantly
    if (intent.type === 'greeting') {
      const greetings = {
        'hi': 'Hi! What can I help you with?',
        'hello': 'Hello! How can I assist you?',
        'hey': 'Hey! Need help with something?',
        'thanks': 'You\'re welcome!',
        'thank you': 'Happy to help!',
        'ok': 'Great!',
        'okay': 'Sounds good!'
      };
      results.agents.push('Quick Response');
      results.data = { response: greetings[intent.params.greeting] || 'Hi there!' };
      return results;
    }

    // Handle unknown commands
    if (intent.type === 'unknown') {
      results.agents.push('Help');
      results.data = { 
        response: `I'm not sure how to help with "${originalCommand}".\n\nTry these commands:\n• ${intent.suggestions.join('\n• ')}` 
      };
      return results;
    }
    
    const agentInfo = agentRegistry[intent.type];

    if (!agentInfo) {
      results.agents.push('Pattern Match');
      results.data = { response: 'Command not recognized. Try "find [filename]" or "open [program]".' };
      return results;
    }

    results.agents.push(intent.type);

    // Route to appropriate handler
    if (agentRegistry[intent.type].handler === 'system') {
      const axios = require('axios');
      const response = await axios.post(`http://localhost:5000/api${agentInfo.endpoint}`, { ...intent.params, userId }, { timeout: 15000 });
      results.data = response.data;
    } 
    else if (agentInfo.handler === 'soma' || agentInfo.handler === 'arbiter') {
      // Use the new SOMA-powered logic with UserId for Belief Memory
      const response = await somaService.assistWithQuery(
          `Execute capability [${intent.type}] for command: "${originalCommand}".`,
          { ...intent.params, userId }
      );
      results.data = { response };
    }
    else if (agentInfo.handler === 'external') {
      // Computer control (Port 8001)
      const axios = require('axios');
      try {
        const response = await axios.post(agentInfo.url, {
          query: intent.params.query || originalCommand,
          context: intent.params
        }, { timeout: 30000 });
        results.data = response.data;
      } catch (error) {
        results.data = { error: 'Computer control service is offline (Port 8001).' };
      }
    }

  } catch (error) {
    console.error('[ECL] Execution error:', error);
    results.error = error.message;
  }

  return results;
}

/**
 * Format results into natural language response
 */
function formatResponse(results, command) {
  if (!results.data) {
    return { text: 'I encountered an issue processing your request.' };
  }

  const data = results.data;

  // File search results
  if (data.results && Array.isArray(data.results)) {
    const count = data.count || 0;
    if (count === 0) {
      return { text: `No files found matching your search.` };
    }
    
    let text = `Found ${count} file(s):\n\n`;
    data.results.slice(0, 10).forEach((file, idx) => {
      text += `${idx + 1}. ${file.name}\n   📁 ${file.path}\n\n`;
    });
    if (count > 10) {
      text += `... and ${count - 10} more files`;
    }
    return { text };
  }

  // Content search results
  if (data.query && data.results) {
    const count = data.count || 0;
    if (count === 0) {
      return { text: `No matches found for "${data.query}"` };
    }
    
    let text = `Found "${data.query}" in ${count} location(s):\n\n`;
    data.results.slice(0, 5).forEach((match, idx) => {
      text += `${idx + 1}. ${match.file}\n   Line ${match.line}: "${match.content}"\n\n`;
    });
    return { text };
  }

  // Program/file open success
  if (data.success === true || data.opened === true) {
    return { text: `✅ Successfully completed: ${command}` };
  }

  // Computer control autonomous mode results
  if (data.autonomous === true) {
    const log = data.execution_log || [];
    let text = `🤖 Autonomous Mode Executed\n\n`;
    text += `Steps: ${data.steps_executed}/${data.total_planned}\n\n`;
    log.forEach((step) => {
      const icon = step.success ? '✅' : '❌';
      text += `${icon} ${step.description}\n`;
    });
    return { text };
  }

  // Computer control regular results
  if (data.executed_actions && Array.isArray(data.executed_actions)) {
    let text = `✅ Executed ${data.executed_actions.length} action(s):\n\n`;
    data.executed_actions.forEach((action, idx) => {
      text += `${idx + 1}. ${action.action || 'Action'} - ${action.status || 'completed'}\n`;
    });
    return { text };
  }

  // Computer control autonomous mode results
  if (data.autonomous === true) {
    const log = data.execution_log || [];
    let text = `🤖 Autonomous Mode Executed\n\n`;
    text += `Steps: ${data.steps_executed}/${data.total_planned}\n\n`;
    log.forEach((step) => {
      const icon = step.success ? '✅' : '❌';
      text += `${icon} ${step.description}\n`;
    });
    return { text };
  }

  // Computer control regular results
  if (data.executed_actions && Array.isArray(data.executed_actions)) {
    let text = `✅ Executed ${data.executed_actions.length} action(s):\n\n`;
    data.executed_actions.forEach((action, idx) => {
      text += `${idx + 1}. ${action.action || 'Action'} - ${action.status || 'completed'}\n`;
    });
    return { text };
  }

  // AI response
  if (data.response && typeof data.response === 'string') {
    return { text: data.response };
  }

  // Arbiter results
  if (data.message) {
    return { text: data.message };
  }

  return { text: 'Command executed successfully.' };
}

/**
 * Generate unique session ID
 */
function generateSessionId() {
  return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Get available capabilities
 * GET /api/ecl/capabilities
 */
router.get('/capabilities', (req, res) => {
  const capabilities = Object.entries(agentRegistry).map(([key, agent]) => ({
    name: key,
    capability: agent.capability,
    handler: agent.handler
  }));

  res.json({
    total_agents: capabilities.length,
    agents: capabilities,
    description: 'Expandable Command Line (ECL) - AI-powered computer assistant with multi-agent orchestration'
  });
});

/**
 * Clear session memory
 * DELETE /api/ecl/session/:sessionId
 */
router.delete('/session/:sessionId', (req, res) => {
  const { sessionId } = req.params;
  sessionMemory.delete(sessionId);
  res.json({ success: true, message: 'Session cleared' });
});

module.exports = router;
