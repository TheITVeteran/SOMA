/**
 * War Room API Routes
 * Handles tactical collaboration, decision tracking, and intelligence
 */

const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const messageBroker = require('../arbiters/core/MessageBroker');
const Project = require('../models/Project');
const crypto = require('crypto');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const chatDbPath = path.join(__dirname, '../data/users.db');
const chatDb = new sqlite3.Database(chatDbPath);

// All war room routes require authentication
router.use(authenticateToken);

/**
 * GET /api/warroom/:projectId
 * Aggregate War Room data (decisions, messages, files)
 */
router.get('/:projectId', async (req, res) => {
  try {
    const { projectId } = req.params;
    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ success: false, error: 'Project not found' });
    }

    const decisionLedger = project.warRoomData?.decisionLedger || [];
    const fileVault = project.warRoomData?.fileVault || [];

    chatDb.all(
      'SELECT * FROM chat_messages WHERE project_id = ? ORDER BY id ASC LIMIT 200',
      [projectId],
      (err, rows) => {
        if (err) {
          return res.json({ success: true, decisionLedger, fileVault, messages: [] });
        }
        const messages = (rows || []).map(row => ({
          id: row.id,
          senderId: row.sender_id,
          message: row.message,
          timestamp: row.created_at,
          type: row.role === 'assistant' ? 'soma' : 'message',
          metadata: safeJsonParse(row.meta, {}),
          attachments: safeJsonParse(row.attachments, [])
        }));
        res.json({ success: true, decisionLedger, fileVault, messages });
      }
    );
  } catch (error) {
    console.error('[WAR ROOM] Aggregate fetch error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

function safeJsonParse(raw, fallback) {
  try {
    return raw ? JSON.parse(raw) : fallback;
  } catch (e) {
    return fallback;
  }
}

// ═══════════════════════════════════════════════════════════
// DECISION LEDGER ENDPOINTS
// ═══════════════════════════════════════════════════════════

/**
 * GET /api/warroom/:projectId/decisions
 * Get all decisions for a project
 */
router.get('/:projectId/decisions', async (req, res) => {
  try {
    const { projectId } = req.params;

    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ success: false, error: 'Project not found' });
    }

    // Initialize warRoomData if it doesn't exist
    if (!project.warRoomData) {
      project.warRoomData = { decisionLedger: [] };
    }

    res.json({
      success: true,
      decisions: project.warRoomData.decisionLedger || []
    });
  } catch (error) {
    console.error('[WAR ROOM] Get decisions error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/warroom/:projectId/decisions
 * Add a new decision to the ledger
 */
router.post('/:projectId/decisions', async (req, res) => {
  try {
    const { projectId } = req.params;
    const decisionData = req.body;

    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ success: false, error: 'Project not found' });
    }

    // Initialize warRoomData if needed
    if (!project.warRoomData) {
      project.warRoomData = { decisionLedger: [] };
    }

    // Create decision with blockchain-style hash
    const previousDecision = project.warRoomData.decisionLedger[project.warRoomData.decisionLedger.length - 1];
    const previousHash = previousDecision ? previousDecision.hash : null;

    const decision = {
      id: crypto.randomUUID(),
      previousHash,
      hash: generateDecisionHash(decisionData, previousHash),
      timestamp: Date.now(),
      actor: decisionData.actor || 'USER',
      changeType: decisionData.changeType || 'ADDITION',
      contextSnapshot: decisionData.contextSnapshot || {},
      optionsConsidered: decisionData.optionsConsidered || [],
      decisionTaken: decisionData.decisionTaken,
      title: decisionData.title,
      rationale: decisionData.rationale,
      userNote: decisionData.userNote,
      confidence: decisionData.confidence || 0.8,
      isConflict: decisionData.isConflict || false,
      riskAcknowledged: decisionData.riskAcknowledged || false,
      assumptionsUsed: decisionData.assumptionsUsed || [],
      evidence: decisionData.evidence || [],
      gravity: decisionData.gravity
    };

    project.warRoomData.decisionLedger.push(decision);
    await project.save();

    res.json({
      success: true,
      decision
    });
  } catch (error) {
    console.error('[WAR ROOM] Add decision error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/warroom/:projectId/decisions/:decisionId/impact
 * Get gravity score for a decision
 */
router.get('/:projectId/decisions/:decisionId/impact', async (req, res) => {
  try {
    const { projectId, decisionId } = req.params;

    // Use ConceiveThinker to analyze decision impact
    const result = await messageBroker.sendMessage({
      from: 'API',
      to: 'ConceiveThinker',
      type: 'analyze_decision_impact',
      payload: { projectId, decisionId }
    });

    res.json({
      success: true,
      impact: result.impact || { gravityScore: 0, downstreamCount: 0 }
    });
  } catch (error) {
    console.error('[WAR ROOM] Decision impact error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ═══════════════════════════════════════════════════════════
// INTELLIGENCE BRIEFING ENDPOINTS
// ═══════════════════════════════════════════════════════════

/**
 * POST /api/warroom/:projectId/intelligence/generate
 * Generate new intelligence brief
 */
router.post('/:projectId/intelligence/generate', async (req, res) => {
  try {
    const { projectId } = req.params;

    const project = await Project.findById(projectId).populate('team.user');
    if (!project) {
      return res.status(404).json({ success: false, error: 'Project not found' });
    }

    // Use ConceiveThinker to generate intelligence
    const forecast = await messageBroker.sendMessage({
      from: 'API',
      to: 'ConceiveThinker',
      type: 'forecast_completion',
      payload: {
        projectId,
        projectData: {
          tasks: project.auditAreas?.flatMap(a => a.procedures) || [],
          team: project.team || [],
          decisions: project.warRoomData?.decisionLedger || [],
          auditAreas: project.auditAreas || []
        }
      }
    });

    const brief = {
      generatedAt: Date.now(),
      situationSummary: forecast.forecast?.conceiveAnalysis?.summary || 'Analysis complete',
      patternComparison: `Signal Integrity: ${forecast.forecast?.conceiveAnalysis?.confidence || 0.85 * 100}%`,
      whatsDifferent: forecast.forecast?.conceiveAnalysis?.anomalies || [],
      quietRisks: forecast.forecast?.conceiveAnalysis?.risks || [],
      recommendation: forecast.forecast?.recommendations?.[0]?.action || 'Continue monitoring'
    };

    // Save brief to project
    if (!project.warRoomData) {
      project.warRoomData = {};
    }
    if (!project.warRoomData.intelligenceBriefs) {
      project.warRoomData.intelligenceBriefs = [];
    }
    project.warRoomData.intelligenceBriefs.push(brief);
    await project.save();

    res.json({
      success: true,
      brief
    });
  } catch (error) {
    console.error('[WAR ROOM] Intelligence generation error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/warroom/:projectId/intelligence
 * Get latest intelligence brief
 */
router.get('/:projectId/intelligence', async (req, res) => {
  try {
    const { projectId } = req.params;

    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ success: false, error: 'Project not found' });
    }

    const briefs = project.warRoomData?.intelligenceBriefs || [];
    const latestBrief = briefs[briefs.length - 1];

    res.json({
      success: true,
      brief: latestBrief || null
    });
  } catch (error) {
    console.error('[WAR ROOM] Get intelligence error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ═══════════════════════════════════════════════════════════
// FILE VAULT ENDPOINTS
// ═══════════════════════════════════════════════════════════

/**
 * POST /api/warroom/:projectId/files/classify
 * Classify file using SOMA
 */
router.post('/:projectId/files/classify', async (req, res) => {
  try {
    const { filename, fileType } = req.body;

    // Use ConceiveThinker to classify
    const classification = await messageBroker.sendMessage({
      from: 'API',
      to: 'ConceiveThinker',
      type: 'classify_file',
      payload: { filename, fileType }
    });

    res.json({
      success: true,
      intelligence: classification.intelligence || {
        summary: 'File classification in progress',
        extractedFigures: [],
        riskSignals: [],
        relevanceScore: 0.5,
        linkedNodes: []
      }
    });
  } catch (error) {
    console.error('[WAR ROOM] File classification error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ═══════════════════════════════════════════════════════════
// ASSUMPTIONS ENDPOINTS
// ═══════════════════════════════════════════════════════════

/**
 * GET /api/warroom/:projectId/assumptions
 * Get all assumptions
 */
router.get('/:projectId/assumptions', async (req, res) => {
  try {
    const { projectId } = req.params;

    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ success: false, error: 'Project not found' });
    }

    res.json({
      success: true,
      assumptions: project.warRoomData?.assumptions || []
    });
  } catch (error) {
    console.error('[WAR ROOM] Get assumptions error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/warroom/:projectId/assumptions
 * Add new assumption
 */
router.post('/:projectId/assumptions', async (req, res) => {
  try {
    const { projectId } = req.params;
    const assumptionData = req.body;

    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ success: false, error: 'Project not found' });
    }

    if (!project.warRoomData) {
      project.warRoomData = {};
    }
    if (!project.warRoomData.assumptions) {
      project.warRoomData.assumptions = [];
    }

    const assumption = {
      id: crypto.randomUUID(),
      label: assumptionData.label,
      description: assumptionData.description,
      confidence: assumptionData.confidence || 1.0,
      lastVerifiedAt: Date.now(),
      decayRate: assumptionData.decayRate || 0.01, // 1% per day
      evidence: assumptionData.evidence || []
    };

    project.warRoomData.assumptions.push(assumption);
    await project.save();

    res.json({
      success: true,
      assumption
    });
  } catch (error) {
    console.error('[WAR ROOM] Add assumption error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ═══════════════════════════════════════════════════════════
// TACTICAL METRICS ENDPOINTS
// ═══════════════════════════════════════════════════════════

/**
 * GET /api/warroom/:projectId/metrics
 * Get tactical metrics
 */
router.get('/:projectId/metrics', async (req, res) => {
  try {
    const { projectId } = req.params;

    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ success: false, error: 'Project not found' });
    }

    const decisions = project.warRoomData?.decisionLedger || [];
    const overrides = decisions.filter(d => d.userNote).length;
    const avgConfidence = decisions.reduce((sum, d) => sum + d.confidence, 0) / Math.max(1, decisions.length);

    // Calculate signal integrity
    let integrity = 100;
    integrity -= overrides * 5;
    if (avgConfidence < 0.7) integrity -= 20;
    if (decisions.length > 20) integrity -= 10;
    integrity = Math.max(0, Math.min(100, integrity));

    const metrics = {
      signalIntegrity: integrity,
      confidenceTrend: avgConfidence > 0.8 ? 'IMPROVING' : avgConfidence > 0.6 ? 'STABLE' : 'DECAYING',
      auditVisibility: 0.65, // Would calculate from actual audit data
      assumptionWeakness: calculateAssumptionWeakness(project.warRoomData?.assumptions || []),
      decisionCount: decisions.length,
      overrideCount: overrides,
      avgConfidence
    };

    res.json({
      success: true,
      metrics
    });
  } catch (error) {
    console.error('[WAR ROOM] Get metrics error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ═══════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════

function generateDecisionHash(decision, previousHash) {
  const data = JSON.stringify({
    title: decision.title,
    decisionTaken: decision.decisionTaken,
    timestamp: Date.now(),
    previousHash
  });
  return crypto.createHash('sha256').update(data).digest('hex').substring(0, 16);
}

function calculateAssumptionWeakness(assumptions) {
  if (assumptions.length === 0) return 0;

  const now = Date.now();
  const weakAssumptions = assumptions.filter(a => {
    const daysSinceVerified = (now - a.lastVerifiedAt) / (1000 * 60 * 60 * 24);
    const decayedConfidence = a.confidence - (daysSinceVerified * a.decayRate);
    return decayedConfidence < 0.7;
  });

  return weakAssumptions.length / assumptions.length;
}

module.exports = router;
