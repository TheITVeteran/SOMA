const fs = require('fs');
const path = require('path');

const CATEGORY_LOBES = {
  research: 'logos',
  learning: 'logos',
  knowledge: 'logos',
  medical: 'thalamus',
  healthcare: 'thalamus',
  biotech: 'thalamus',
  security: 'thalamus',
  safety: 'thalamus',
  social: 'aurora',
  creative: 'aurora',
  writing: 'aurora',
  story: 'aurora',
  strategy: 'prometheus',
  trading: 'prometheus',
  finance: 'prometheus',
  optimization: 'prometheus',
  self_repair: 'logos',
  engineering: 'logos',
  code: 'logos'
};

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function appendJsonl(filePath, row) {
  ensureDir(path.dirname(filePath));
  fs.appendFileSync(filePath, `${JSON.stringify(row)}\n`, 'utf8');
}

function readJson(filePath, fallback) {
  try {
    if (!fs.existsSync(filePath)) return fallback;
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return fallback;
  }
}

function writeJson(filePath, value) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2), 'utf8');
}

function compactText(value, max = 500) {
  if (value === null || value === undefined) return '';
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  return text.replace(/\s+/g, ' ').trim().slice(0, max);
}

function redactSensitiveText(value) {
  let text = compactText(value, 4000);
  const replacements = [
    /\bsk-[A-Za-z0-9_-]{16,}\b/g,
    /\b(ds|bsky|ghp|github_pat)_[A-Za-z0-9_=-]{16,}\b/gi,
    /\b[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\b/g,
    /\b(api[_-]?key|password|token|secret)\s*[:=]\s*['"]?[^'"\s,}]+/gi
  ];
  for (const pattern of replacements) text = text.replace(pattern, '[REDACTED_SECRET]');
  return text;
}

function inferLobe(category = '') {
  const normalized = String(category || '').toLowerCase();
  for (const [key, lobe] of Object.entries(CATEGORY_LOBES)) {
    if (normalized.includes(key)) return lobe;
  }
  return 'prometheus';
}

function normalizeGoalContract(goalData = {}) {
  const metadata = goalData.metadata || {};
  const title = compactText(goalData.title || metadata.title || 'Untitled goal', 120);
  const category = compactText(goalData.category || metadata.category || 'general', 80) || 'general';
  const description = compactText(goalData.description || metadata.description || title, 500);

  const successCriteria = Array.isArray(goalData.successCriteria) && goalData.successCriteria.length
    ? goalData.successCriteria.filter(Boolean)
    : Array.isArray(metadata.successCriteria) && metadata.successCriteria.length
      ? metadata.successCriteria.filter(Boolean)
      : [
          `Produce a concrete output or decision for "${title}"`,
          'Record evidence: summary, artifact, metric, or stop reason',
          'Record the next step, lesson, or reason to stop'
        ];

  const verification = goalData.verification || metadata.verification || {
    evidenceRequired: ['summary'],
    allowStopReason: true
  };

  const stopCriteria = Array.isArray(goalData.stopCriteria) && goalData.stopCriteria.length
    ? goalData.stopCriteria.filter(Boolean)
    : Array.isArray(metadata.stopCriteria) && metadata.stopCriteria.length
      ? metadata.stopCriteria.filter(Boolean)
      : [
          'Evidence disproves the goal premise',
          'Required tool, data, or permission is unavailable',
          'Risk exceeds expected value'
        ];

  return {
    target: goalData.target || metadata.target || title,
    category,
    ownerLobe: goalData.ownerLobe || metadata.ownerLobe || inferLobe(category),
    successCriteria,
    verification,
    evidenceRequired: verification.evidenceRequired || ['summary'],
    stopCriteria,
    maxAttempts: goalData.maxAttempts || metadata.maxAttempts || 3,
    qualityFloor: goalData.qualityFloor || metadata.qualityFloor || 0.7,
    createdAt: Date.now()
  };
}

function applyGoalContract(goalData = {}) {
  const contract = normalizeGoalContract(goalData);
  return {
    ...goalData,
    successCriteria: contract.successCriteria,
    verification: contract.verification,
    metadata: {
      ...(goalData.metadata || {}),
      goalContract: contract,
      successCriteria: contract.successCriteria,
      verification: contract.verification,
      stopCriteria: contract.stopCriteria,
      ownerLobe: contract.ownerLobe,
      evidenceRequired: contract.evidenceRequired,
      maxAttempts: contract.maxAttempts,
      qualityFloor: contract.qualityFloor
    }
  };
}

function buildLesson(goal = {}, result = {}, verification = {}) {
  const contract = goal.metadata?.goalContract || normalizeGoalContract(goal);
  const passed = verification.passed === true || result.success === true;
  const stopped = Boolean(result.stopReason || result.reason);
  const summary = redactSensitiveText(result.summary || result.result || result.output || result.message || result.stopReason || result.reason || goal.description).slice(0, 700);
  const evidenceText = redactSensitiveText(result.evidence || goal.metadata?.evidence || verification.checks || '').slice(0, 600);
  const lobe = contract.ownerLobe || inferLobe(goal.category);

  return {
    id: `lesson_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    type: 'goal_lesson',
    timestamp: Date.now(),
    recordedAt: new Date().toISOString(),
    goalId: goal.id,
    title: goal.title,
    category: goal.category,
    lobe,
    success: passed,
    stopped,
    verificationScore: verification.score || 0,
    signal: passed
      ? `Goal completed with verified evidence: ${goal.title}`
      : `Goal did not verify: ${goal.title}`,
    lesson: summary || (passed ? 'Verified completion recorded.' : 'Completion was blocked by missing or weak evidence.'),
    evidence: evidenceText,
    checks: verification.checks || [],
    nextStep: redactSensitiveText(result.nextStep || result.next || (passed ? 'Re-use this pattern when similar evidence is available.' : 'Create a stronger contract or collect concrete evidence before retrying.')).slice(0, 300)
  };
}

class LearningSpine {
  constructor(options = {}) {
    this.root = options.root || process.cwd();
    this.learningDir = path.join(this.root, 'data', 'learning');
    this.trainingDir = path.join(this.root, 'data', 'training');
    this.seedDir = path.join(this.root, 'knowledge', 'seeds');
    this.eventsPath = path.join(this.learningDir, 'learning-spine-events.jsonl');
    this.scoreboardPath = path.join(this.learningDir, 'competency-scoreboard.json');
    this.generalTrainingPath = path.join(this.trainingDir, 'soma_knowledge.jsonl');
  }

  applyGoalContract(goalData = {}) {
    return applyGoalContract(goalData);
  }

  recordGoalOutcome(goal = {}, result = {}, verification = {}) {
    const lesson = buildLesson(goal, result, verification);
    appendJsonl(this.eventsPath, lesson);
    this._recordTrainingRow(lesson);
    this._updateScoreboard(lesson);
    return lesson;
  }

  createRetestGoalPayload(goal = {}, options = {}) {
    const contract = goal.metadata?.goalContract || normalizeGoalContract(goal);
    const lastVerification = goal.metadata?.lastVerification || {};
    const failedChecks = Array.isArray(lastVerification.checks)
      ? lastVerification.checks.filter(check => check && check.passed === false)
      : [];
    const attempt = Number(goal.metadata?.retestAttempt || 0) + 1;
    const titleBase = String(goal.title || 'Untitled goal').replace(/^Retest:\s*/i, '').trim();
    return this.applyGoalContract({
      type: goal.type || 'operational',
      category: goal.category || contract.category || 'retest',
      title: `Retest: ${titleBase}`.slice(0, 140),
      description: [
        `Retest a goal that failed verification: ${goal.title || 'Untitled goal'}.`,
        failedChecks.length
          ? `Repair missing evidence/checks: ${failedChecks.map(c => c.label || c.type || c.check || 'unknown').join('; ')}.`
          : 'Repair the evidence contract and rerun with concrete proof.',
        `Original goal id: ${goal.id || 'unknown'}.`
      ].join(' '),
      priority: options.priority || Math.max(70, Number(goal.priority) || 70),
      successCriteria: contract.successCriteria,
      verification: contract.verification,
      metadata: {
        source: 'learning_spine_retest',
        parentGoalId: goal.id || null,
        retestAttempt: attempt,
        previousVerification: lastVerification,
        failureLesson: goal.metadata?.learningLesson || null
      }
    });
  }

  auditTrainingExports(limit = 500) {
    const files = [
      this.generalTrainingPath,
      ...['logos', 'thalamus', 'prometheus', 'aurora'].map(lobe => path.join(this.seedDir, `${lobe}-seed.jsonl`))
    ];
    const secretPattern = /\b(sk-[A-Za-z0-9_-]{16,}|(api[_-]?key|password|token|secret)\s*[:=]|ghp_|github_pat_|bsky_)\b/i;
    const report = {
      checkedAt: new Date().toISOString(),
      files: [],
      totalRows: 0,
      suspectRows: 0,
      invalidRows: 0,
      weakEvidenceRows: 0,
      sourceCounts: {},
      lobeCounts: {},
      issues: []
    };

    for (const filePath of files) {
      const fileReport = {
        path: filePath,
        exists: fs.existsSync(filePath),
        rows: 0,
        suspectRows: 0,
        invalidRows: 0,
        weakEvidenceRows: 0
      };
      if (!fileReport.exists) {
        report.files.push(fileReport);
        continue;
      }
      const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/).filter(Boolean).slice(-limit);
      fileReport.rows = lines.length;
      report.totalRows += lines.length;
      lines.forEach((line, idx) => {
        if (secretPattern.test(line)) {
          fileReport.suspectRows += 1;
          report.suspectRows += 1;
          report.issues.push({ path: filePath, rowFromTail: idx + 1, issue: 'possible_secret' });
        }
        try {
          const row = JSON.parse(line);
          const source = row.source || 'unknown';
          const lobe = row.lobe || 'unrouted';
          report.sourceCounts[source] = (report.sourceCounts[source] || 0) + 1;
          report.lobeCounts[lobe] = (report.lobeCounts[lobe] || 0) + 1;
          if (source === 'learning_spine' && (!row.output || !row.input || !row.goalId)) {
            fileReport.weakEvidenceRows += 1;
            report.weakEvidenceRows += 1;
            report.issues.push({ path: filePath, rowFromTail: idx + 1, issue: 'weak_learning_row' });
          }
        } catch {
          fileReport.invalidRows += 1;
          report.invalidRows += 1;
          report.issues.push({ path: filePath, rowFromTail: idx + 1, issue: 'invalid_jsonl' });
        }
      });
      report.files.push(fileReport);
    }
    return report;
  }

  getStatus(limit = 20) {
    const scoreboard = readJson(this.scoreboardPath, { domains: {}, updatedAt: null });
    let recent = [];
    try {
      if (fs.existsSync(this.eventsPath)) {
        recent = fs.readFileSync(this.eventsPath, 'utf8')
          .split(/\r?\n/)
          .filter(Boolean)
          .slice(-limit)
          .map(line => JSON.parse(line));
      }
    } catch {
      recent = [];
    }
    return { scoreboard, recent };
  }

  _recordTrainingRow(lesson) {
    const output = [
      `CORE SIGNAL: ${lesson.signal}`,
      `LESSON: ${lesson.lesson}`,
      `NEXT STEP: ${lesson.nextStep}`
    ].join('\n');

    const row = {
      instruction: `Distill a verified SOMA goal outcome for the ${lesson.lobe.toUpperCase()} lobe.`,
      input: redactSensitiveText(`Goal: ${lesson.title}\nCategory: ${lesson.category}\nSuccess: ${lesson.success}\nEvidence: ${lesson.evidence}`),
      output: redactSensitiveText(output),
      source: 'learning_spine',
      lobe: lesson.lobe,
      goalId: lesson.goalId,
      timestamp: lesson.recordedAt
    };

    appendJsonl(this.generalTrainingPath, row);
    appendJsonl(path.join(this.seedDir, `${lesson.lobe}-seed.jsonl`), row);
  }

  _updateScoreboard(lesson) {
    const board = readJson(this.scoreboardPath, { version: 1, domains: {}, updatedAt: null });
    const key = lesson.category || 'general';
    const domain = board.domains[key] || {
      category: key,
      lobe: lesson.lobe,
      attempts: 0,
      verified: 0,
      failed: 0,
      averageVerificationScore: 0,
      promotionLevel: 'observe',
      lastLesson: null,
      updatedAt: null
    };

    domain.attempts += 1;
    if (lesson.success) domain.verified += 1;
    else domain.failed += 1;
    domain.averageVerificationScore =
      ((domain.averageVerificationScore * (domain.attempts - 1)) + (lesson.verificationScore || 0)) / domain.attempts;
    domain.lastLesson = lesson.lesson;
    domain.updatedAt = lesson.recordedAt;
    domain.promotionLevel = this._promotionLevel(domain);

    board.domains[key] = domain;
    board.updatedAt = new Date().toISOString();
    writeJson(this.scoreboardPath, board);
  }

  _promotionLevel(domain) {
    const successRate = domain.verified / Math.max(1, domain.attempts);
    if (domain.attempts >= 10 && successRate >= 0.9 && domain.averageVerificationScore >= 90) return 'autonomous';
    if (domain.attempts >= 5 && successRate >= 0.75 && domain.averageVerificationScore >= 75) return 'assisted';
    if (domain.attempts >= 3 && successRate < 0.5) return 'restricted';
    return 'observe';
  }
}

const defaultLearningSpine = new LearningSpine();

module.exports = {
  LearningSpine,
  defaultLearningSpine,
  normalizeGoalContract,
  applyGoalContract,
  buildLesson,
  redactSensitiveText,
  inferLobe
};
