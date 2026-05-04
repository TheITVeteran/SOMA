const express = require('express');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const somaService = require('../services/somaService');

const router = express.Router();

const dbPath = path.join(__dirname, '../data/users.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS chat_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id TEXT NOT NULL,
    sender_id TEXT NOT NULL,
    sender_name TEXT NOT NULL,
    role TEXT NOT NULL,
    message TEXT NOT NULL,
    attachments TEXT DEFAULT '[]',
    meta TEXT DEFAULT '{}',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
});

const MAX_MESSAGE_LEN = 4000;

function normalizeRow(row) {
  return {
    id: row.id,
    projectId: row.project_id,
    senderId: row.sender_id,
    senderName: row.sender_name,
    role: row.role,
    message: row.message,
    attachments: safeJsonParse(row.attachments, []),
    meta: safeJsonParse(row.meta, {}),
    createdAt: row.created_at
  };
}

function safeJsonParse(raw, fallback) {
  try {
    return raw ? JSON.parse(raw) : fallback;
  } catch (e) {
    return fallback;
  }
}

function detectThinkerMention(text) {
  return /@thinker|@conceive|@soma/ig.test(text || '');
}

function extractSearchTerms(text) {
  if (!text) return [];
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length >= 4);
  const unique = Array.from(new Set(words));
  return unique.slice(0, 6);
}

function fetchRecentMessages(projectId, limit = 30) {
  return new Promise((resolve, reject) => {
    db.all(
      'SELECT * FROM chat_messages WHERE project_id = ? ORDER BY id DESC LIMIT ?',
      [projectId, limit],
      (err, rows) => {
        if (err) return reject(err);
        resolve(rows.reverse().map(normalizeRow));
      }
    );
  });
}

function searchFiles(terms) {
  return new Promise((resolve) => {
    if (!terms || terms.length === 0) return resolve([]);

    const likeClauses = terms.map(() => 'original_name LIKE ?').join(' OR ');
    const params = terms.map(t => `%${t}%`);

    db.all(
      `SELECT id, original_name, file_size, mime_type, upload_date FROM user_files WHERE ${likeClauses} ORDER BY upload_date DESC LIMIT 5`,
      params,
      (err, rows) => {
        if (err) return resolve([]);
        resolve(rows || []);
      }
    );
  });
}

async function createMessage({ projectId, senderId, senderName, role, message, attachments = [], meta = {} }) {
  return new Promise((resolve, reject) => {
    db.run(
      `INSERT INTO chat_messages (project_id, sender_id, sender_name, role, message, attachments, meta)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        projectId,
        senderId,
        senderName,
        role,
        message,
        JSON.stringify(attachments || []),
        JSON.stringify(meta || {})
      ],
      function (err) {
        if (err) return reject(err);
        resolve({
          id: this.lastID,
          projectId,
          senderId,
          senderName,
          role,
          message,
          attachments,
          meta,
          createdAt: new Date().toISOString()
        });
      }
    );
  });
}

router.get('/:projectId/messages', async (req, res) => {
  try {
    const { projectId } = req.params;
    const limit = Math.min(parseInt(req.query.limit || '50', 10), 200);
    const rows = await fetchRecentMessages(projectId, limit);
    res.json({ success: true, messages: rows });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/:projectId/messages', async (req, res) => {
  try {
    const { projectId } = req.params;
    const {
      message,
      senderId = 'user',
      senderName = 'User',
      role = 'user',
      attachments = [],
      invokeThinker = false,
      channel = 'landing',
      context = {}
    } = req.body || {};

    const cleaned = (message || '').trim();
    if (!cleaned) return res.status(400).json({ success: false, error: 'message required' });
    if (cleaned.length > MAX_MESSAGE_LEN) {
      return res.status(400).json({ success: false, error: 'message too long' });
    }

    const userMsg = await createMessage({
      projectId,
      senderId,
      senderName,
      role,
      message: cleaned,
      attachments,
      meta: { channel, ...context, sentAt: Date.now() }
    });

    const shouldInvoke = invokeThinker || detectThinkerMention(cleaned);

    if (!shouldInvoke) {
      return res.json({ success: true, messages: [userMsg] });
    }

    const recentMessages = await fetchRecentMessages(projectId, 20);
    const searchTerms = extractSearchTerms(cleaned);
    const fileHints = await searchFiles(searchTerms);

    const thinkerContext = {
      ...context,
      channel,
      projectId,
      recentMessages,
      fileHints,
      auditMode: true
    };

    const thinkerReply = await somaService.assistWithQuery(cleaned, thinkerContext);

    const assistantMsg = await createMessage({
      projectId,
      senderId: 'thinker',
      senderName: 'The Thinker',
      role: 'assistant',
      message: thinkerReply,
      attachments: [],
      meta: { channel, from: 'soma', fileHints }
    });

    res.json({ success: true, messages: [userMsg, assistantMsg], assistant: assistantMsg });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
