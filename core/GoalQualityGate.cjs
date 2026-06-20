const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { normalizeGoalContract } = require('./LearningSpine.cjs');

const DEFAULT_STOPWORDS = new Set([
  'the', 'and', 'for', 'with', 'that', 'this', 'from', 'into', 'goal',
  'task', 'soma', 'system', 'review', 'analyze', 'improve'
]);

function normalizeText(value = '') {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

function overlapScore(a = '', b = '') {
  const left = new Set(normalizeText(a).filter(w => !DEFAULT_STOPWORDS.has(w)));
  const right = new Set(normalizeText(b).filter(w => !DEFAULT_STOPWORDS.has(w)));
  if (!left.size || !right.size) return 0;
  let hits = 0;
  for (const word of left) if (right.has(word)) hits++;
  return hits / Math.min(left.size, right.size);
}

function buildQualityReport(goalData = {}, existingGoals = []) {
  const issues = [];
  const warnings = [];
  const contract = normalizeGoalContract(goalData);
  const title = String(goalData.title || '').trim();
  const description = String(goalData.description || '').trim();
  const category = String(goalData.category || '').trim();
  const successCriteria = Array.isArray(goalData.successCriteria)
    ? goalData.successCriteria.filter(Boolean)
    : Array.isArray(goalData.metadata?.successCriteria)
      ? goalData.metadata.successCriteria.filter(Boolean)
      : contract.successCriteria;
  const verification = goalData.verification || goalData.metadata?.verification || contract.verification;

  if (!title) issues.push('Missing title');
  if (!category) issues.push('Missing category');
  if (title && title.length < 12) warnings.push('Title is very short');
  if (!description || description.length < 40) warnings.push('Description should explain why the goal matters');
  if (!successCriteria.length) warnings.push('No success criteria provided');
  if (!verification) warnings.push('No verification method provided');

  const duplicate = existingGoals.find(g => {
    if (!g || ['completed', 'failed', 'deferred', 'cancelled'].includes(g.status)) return false;
    return overlapScore(`${title} ${description}`, `${g.title || ''} ${g.description || ''}`) >= 0.62;
  });
  if (duplicate) issues.push(`Likely duplicate of active goal "${duplicate.title}"`);

  const score = Math.max(0, Math.min(100, 100 - issues.length * 35 - warnings.length * 10));
  return {
    approved: issues.length === 0,
    score,
    issues,
    warnings,
    duplicateGoalId: duplicate?.id || null,
    successCriteria,
    verification,
    contract
  };
}

function safeResolve(repoRoot, target) {
  const resolved = path.resolve(repoRoot, target || '');
  if (!resolved.startsWith(repoRoot)) throw new Error(`Path outside workspace: ${target}`);
  return resolved;
}

function runCommand(command, repoRoot) {
  const [shell, shellFlag] = process.platform === 'win32' ? ['cmd.exe', '/c'] : ['/bin/sh', '-c'];
  try {
    const output = execFileSync(shell, [shellFlag, command], {
      cwd: repoRoot,
      timeout: 120000,
      maxBuffer: 1024 * 1024,
      windowsHide: true,
      encoding: 'utf8'
    });
    return { command, passed: true, output: String(output || '').slice(-2000) };
  } catch (error) {
    return {
      command,
      passed: false,
      output: String((error.stdout || '') + (error.stderr || '') || error.message).slice(-2000)
    };
  }
}

function verifyGoal(goal = {}, result = {}, options = {}) {
  const repoRoot = options.repoRoot || process.cwd();
  const metadata = goal.metadata || {};
  const contract = metadata.goalContract || normalizeGoalContract(goal);
  const verification = result.verification || metadata.verification || goal.verification || contract.verification || null;
  const evidence = result.evidence || metadata.evidence || {};
  const scopedEvidence = evidence.completionEvidence && evidence.completionEvidence.goalId === goal.id
    ? evidence.completionEvidence
    : null;
  const checks = [];

  const criteria = result.successCriteria || metadata.successCriteria || goal.successCriteria || contract.successCriteria || [];
  for (let index = 0; index < criteria.length; index++) {
    const criterion = criteria[index];
    const scopedCriterion = scopedEvidence?.criterionCoverage?.[index];
    const hasExplicitEvidence = Boolean(evidence[String(criterion)]);
    const hasCompletionText = Boolean(result.summary || result.result || result.output || result.message);
    const hasStopReason = Boolean(result.stopReason || result.reason);
    checks.push({
      type: 'success_criterion',
      label: String(criterion),
      passed: Boolean(
        result.force ||
        scopedCriterion?.passed === true ||
        (!scopedEvidence && (hasExplicitEvidence || hasCompletionText || (verification?.allowStopReason && hasStopReason)))
      ),
      receiptIds: scopedCriterion?.requirements?.flatMap(item => item.receiptIds || []) || []
    });
  }

  const requiredEvidence = verification?.evidenceRequired || metadata.evidenceRequired || contract.evidenceRequired || [];
  for (const key of requiredEvidence) {
    const value = result[key] ?? evidence[key] ?? metadata[key];
    const scopedPassed = scopedEvidence?.requiredChecks?.find(check => check.key === key)?.passed === true;
    const passed = Boolean(
      result.force ||
      scopedPassed ||
      value ||
      (key === 'summary' && (result.summary || result.result || result.output || result.message)) ||
      (verification?.allowStopReason && (result.stopReason || result.reason))
    );
    checks.push({
      type: 'evidence_required',
      label: String(key),
      passed,
      output: passed ? 'Evidence present' : `Missing required evidence: ${key}`
    });
  }

  if (verification?.commands && Array.isArray(verification.commands)) {
    for (const command of verification.commands) checks.push({ type: 'command', ...runCommand(command, repoRoot) });
  }

  if (verification?.filesExist && Array.isArray(verification.filesExist)) {
    for (const file of verification.filesExist) {
      let passed = false;
      let output = '';
      try {
        passed = fs.existsSync(safeResolve(repoRoot, file));
      } catch (error) {
        output = error.message;
      }
      checks.push({ type: 'file_exists', file, passed, output });
    }
  }

  if (verification?.contains && Array.isArray(verification.contains)) {
    for (const item of verification.contains) {
      const file = item.file;
      const text = item.text;
      let passed = false;
      let output = '';
      try {
        const content = fs.readFileSync(safeResolve(repoRoot, file), 'utf8');
        passed = content.includes(text);
      } catch (error) {
        output = error.message;
      }
      checks.push({ type: 'contains', file, text, passed, output });
    }
  }

  const toolsUsed = Array.isArray(evidence.toolsUsed) ? evidence.toolsUsed : Array.isArray(result.toolsUsed) ? result.toolsUsed : [];
  const writtenPath = result.file || result.filepath || result.path || evidence.file || evidence.filepath || evidence.path || '';
  const codeTouched = Boolean(
    result.codeTouched === true ||
    evidence.codeTouched === true ||
    toolsUsed.some(tool => ['modify_code', 'pulse_stage_code'].includes(tool)) ||
    (toolsUsed.includes('write_file') && /\.(?:js|cjs|mjs|ts)$/i.test(String(writtenPath)))
  );
  const requiresExecutableProof = Boolean(verification?.requiresExecutableProof || metadata.requiresExecutableProof || codeTouched);
  if (requiresExecutableProof) {
    const commandPassed = checks.some(check => check.type === 'command' && check.passed);
    const syntaxPassed = Boolean(result.verifySyntax || evidence.verifySyntax || checks.some(check => check.type === 'syntax' && check.passed));
    const testsPassed = Boolean(result.runTests || evidence.runTests || evidence.shellVerification || commandPassed);
    checks.push({
      type: 'executable_proof',
      label: 'Executable verification proof',
      passed: Boolean(result.force || testsPassed || (verification?.allowSyntaxOnly && syntaxPassed)),
      output: testsPassed
        ? 'Executable proof present'
        : 'Missing executable proof: run tests, build, syntax check plus explicit allowed syntax-only verification, or configured verification command'
    });
  }

  if (!checks.length) {
    const hasEvidence = Boolean(result.result || result.summary || result.completedBy || result.force);
    checks.push({
      type: 'evidence',
      label: 'Completion evidence supplied',
      passed: hasEvidence,
      output: hasEvidence ? 'Result/evidence present' : 'No verifier or evidence supplied'
    });
  }

  const passed = checks.every(check => check.passed);
  return {
    passed,
    checkedAt: Date.now(),
    checks,
    score: checks.length ? Math.round((checks.filter(c => c.passed).length / checks.length) * 100) : 0
  };
}

module.exports = {
  buildQualityReport,
  verifyGoal,
  overlapScore
};
