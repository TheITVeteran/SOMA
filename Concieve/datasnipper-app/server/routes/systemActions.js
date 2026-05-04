const express = require('express');
const router = express.Router();
const { exec, spawn } = require('child_process');
const fs = require('fs').promises;
const path = require('path');
const { promisify } = require('util');
const execAsync = promisify(exec);

// Security whitelist for allowed operations
const ALLOWED_PROGRAMS = [
  'notepad', 'excel', 'word', 'powershell', 'explorer', 
  'chrome', 'firefox', 'edge', 'calculator', 'cmd'
];

const ALLOWED_EXTENSIONS = [
  '.txt', '.xlsx', '.xls', '.docx', '.doc', '.pdf', 
  '.csv', '.json', '.xml', '.jpg', '.png'
];

const MAX_SEARCH_DEPTH = 5;
const MAX_RESULTS = 100;
const TIMEOUT_MS = 30000;

// Audit log for all system actions
const auditLog = [];
function logAction(action, user, details, success, error = null) {
  const entry = {
    timestamp: new Date().toISOString(),
    action,
    user: user || 'anonymous',
    details,
    success,
    error,
    ip: details.ip || 'unknown'
  };
  auditLog.push(entry);
  console.log('[AUDIT]', JSON.stringify(entry));
}

// Middleware to validate and sanitize inputs
function validateInput(req, res, next) {
  // Add IP to request for audit logging
  req.clientIp = req.ip || req.connection.remoteAddress;
  next();
}

/**
 * Search for files on the system
 * POST /api/system/search-files
 */
router.post('/search-files', validateInput, async (req, res) => {
  try {
    const { query, path: searchPath } = req.body;
    
    if (!query || typeof query !== 'string' || query.length < 2) {
      return res.status(400).json({ error: 'Invalid search query' });
    }

    // Sanitize path to prevent directory traversal
    const basePath = searchPath || 'C:\\Users';
    const sanitizedPath = path.normalize(basePath);
    
    // Prevent searching system directories
    const forbiddenPaths = ['C:\\Windows', 'C:\\Program Files\\WindowsApps'];
    if (forbiddenPaths.some(fp => sanitizedPath.startsWith(fp))) {
      return res.status(403).json({ error: 'Access to system directories is restricted' });
    }

    console.log(`Searching for "${query}" in ${sanitizedPath}`);

    // Use PowerShell for robust file search on Windows
    const psCommand = `Get-ChildItem -Path '${sanitizedPath}' -Recurse -ErrorAction SilentlyContinue -Depth ${MAX_SEARCH_DEPTH} | Where-Object { \$_.Name -like '*${query}*' } | Select-Object -First ${MAX_RESULTS} FullName, Name, Length, LastWriteTime | ConvertTo-Json`;

    console.log('Executing PS command:', psCommand);

    const { stdout, stderr } = await execAsync(`powershell -Command "${psCommand}"`, {
      timeout: TIMEOUT_MS,
      maxBuffer: 1024 * 1024 * 10 // 10MB buffer
    });
    
    if (stderr) {
      console.error('PowerShell stderr:', stderr);
    }

    let results = [];
    if (stdout) {
      try {
        const parsed = JSON.parse(stdout);
        results = Array.isArray(parsed) ? parsed : [parsed];
      } catch (e) {
        console.error('Failed to parse search results:', e);
      }
    }

    logAction('search_files', req.user?.id, { query, path: sanitizedPath, resultCount: results.length, ip: req.clientIp }, true);

    res.json({
      query,
      path: sanitizedPath,
      results: results.map(r => ({
        path: r.FullName,
        name: r.Name,
        size: r.Length,
        modified: r.LastWriteTime
      })),
      count: results.length
    });

  } catch (error) {
    console.error('File search error:', error);
    logAction('search_files', req.user?.id, { query: req.body.query, ip: req.clientIp }, false, error.message);
    res.status(500).json({ error: 'File search failed', details: error.message });
  }
});

/**
 * Search for content within files
 * POST /api/system/search-content
 */
router.post('/search-content', validateInput, async (req, res) => {
  try {
    const { query, fileTypes, path: searchPath } = req.body;
    
    if (!query || typeof query !== 'string') {
      return res.status(400).json({ error: 'Invalid search query' });
    }

    const basePath = searchPath || 'C:\\Users';
    const sanitizedPath = path.normalize(basePath);
    
    // Build file type filter
    const types = fileTypes || ['txt', 'log', 'csv'];
    const typeFilter = types.map(t => `*.${ t}`).join(',');

    console.log(`Searching content for "${query}" in ${sanitizedPath}`);

    // Use PowerShell Select-String for content search
    const psCommand = `
      Get-ChildItem -Path "${sanitizedPath}" -Include ${typeFilter} -Recurse -ErrorAction SilentlyContinue -Depth ${MAX_SEARCH_DEPTH} |
      Select-String -Pattern "${query}" -SimpleMatch -ErrorAction SilentlyContinue |
      Select-Object -First ${MAX_RESULTS} Path, LineNumber, Line |
      ConvertTo-Json
    `;

    const { stdout } = await execAsync(`powershell -Command "${psCommand}"`, {
      timeout: TIMEOUT_MS,
      maxBuffer: 1024 * 1024 * 10
    });

    let results = [];
    if (stdout) {
      try {
        const parsed = JSON.parse(stdout);
        results = Array.isArray(parsed) ? parsed : [parsed];
      } catch (e) {
        console.error('Failed to parse content search results:', e);
      }
    }

    logAction('search_content', req.user?.id, { query, resultCount: results.length, ip: req.clientIp }, true);

    res.json({
      query,
      results: results.map(r => ({
        file: r.Path,
        line: r.LineNumber,
        content: r.Line?.trim(),
        match: query
      })),
      count: results.length
    });

  } catch (error) {
    console.error('Content search error:', error);
    logAction('search_content', req.user?.id, { query: req.body.query, ip: req.clientIp }, false, error.message);
    res.status(500).json({ error: 'Content search failed', details: error.message });
  }
});

/**
 * Open a file with default application
 * POST /api/system/open-file
 */
router.post('/open-file', validateInput, async (req, res) => {
  try {
    const { path: filePath, highlight } = req.body;
    
    if (!filePath || typeof filePath !== 'string') {
      return res.status(400).json({ error: 'Invalid file path' });
    }

    const normalizedPath = path.normalize(filePath);
    
    // Security checks
    const ext = path.extname(normalizedPath).toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      return res.status(403).json({ error: 'File type not allowed' });
    }

    // Check if file exists
    try {
      await fs.access(normalizedPath);
    } catch {
      return res.status(404).json({ error: 'File not found' });
    }

    console.log(`Opening file: ${normalizedPath}`);

    // Use Windows start command to open with default app
    await execAsync(`start "" "${normalizedPath}"`, { timeout: 5000 });

    logAction('open_file', req.user?.id, { path: normalizedPath, ip: req.clientIp }, true);

    res.json({
      success: true,
      path: normalizedPath,
      opened: true
    });

  } catch (error) {
    console.error('File open error:', error);
    logAction('open_file', req.user?.id, { path: req.body.path, ip: req.clientIp }, false, error.message);
    res.status(500).json({ error: 'Failed to open file', details: error.message });
  }
});

/**
 * Open a program/application
 * POST /api/system/open-program
 */
router.post('/open-program', validateInput, async (req, res) => {
  try {
    const { name, args } = req.body;
    
    if (!name || typeof name !== 'string') {
      return res.status(400).json({ error: 'Invalid program name' });
    }

    const programName = name.toLowerCase();
    
    // Security: only allow whitelisted programs
    if (!ALLOWED_PROGRAMS.includes(programName)) {
      return res.status(403).json({ error: 'Program not in allowed list' });
    }

    console.log(`Opening program: ${programName}`);

    const programArgs = Array.isArray(args) ? args.join(' ') : '';
    await execAsync(`start ${programName} ${programArgs}`, { timeout: 5000 });

    logAction('open_program', req.user?.id, { program: programName, args: programArgs, ip: req.clientIp }, true);

    res.json({
      success: true,
      program: programName,
      opened: true
    });

  } catch (error) {
    console.error('Program open error:', error);
    logAction('open_program', req.user?.id, { program: req.body.name, ip: req.clientIp }, false, error.message);
    res.status(500).json({ error: 'Failed to open program', details: error.message });
  }
});

/**
 * Execute a system command (highly restricted)
 * POST /api/system/execute
 */
router.post('/execute', validateInput, async (req, res) => {
  try {
    const { command } = req.body;
    
    if (!command || typeof command !== 'string') {
      return res.status(400).json({ error: 'Invalid command' });
    }

    // SECURITY: Very strict whitelist - only allow safe read-only commands
    const safeCommands = ['dir', 'type', 'findstr', 'echo', 'where'];
    const cmdStart = command.split(' ')[0].toLowerCase();
    
    if (!safeCommands.includes(cmdStart)) {
      logAction('execute_command', req.user?.id, { command, ip: req.clientIp }, false, 'Command not allowed');
      return res.status(403).json({ error: 'Command not allowed for security reasons' });
    }

    console.log(`Executing command: ${command}`);

    const { stdout, stderr } = await execAsync(command, {
      timeout: 10000,
      maxBuffer: 1024 * 1024 // 1MB buffer
    });

    logAction('execute_command', req.user?.id, { command, ip: req.clientIp }, true);

    res.json({
      success: true,
      output: stdout,
      error: stderr || null
    });

  } catch (error) {
    console.error('Command execution error:', error);
    logAction('execute_command', req.user?.id, { command: req.body.command, ip: req.clientIp }, false, error.message);
    res.status(500).json({ error: 'Command execution failed', details: error.message });
  }
});

/**
 * Get audit log (admin only)
 * GET /api/system/audit-log
 */
router.get('/audit-log', validateInput, (req, res) => {
  // In production, add proper authentication/authorization
  const limit = parseInt(req.query.limit) || 100;
  res.json({
    logs: auditLog.slice(-limit).reverse(),
    total: auditLog.length
  });
});

/**
 * Health check
 * GET /api/system/health
 */
router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    platform: process.platform,
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

module.exports = router;
