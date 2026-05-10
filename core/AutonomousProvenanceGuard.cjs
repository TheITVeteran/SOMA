'use strict';

const CLAIM_RE = /\b(i\s+(ran|tested|found|observed|measured|verified|finished|completed)|test(ed|ing)?|result|p-?value|z-?score|null model|permutation|significant|overlap|confidence|success rate|backtest|sensitivity check|\d+(\.\d+)?\s*(%|permutations?|runs?|tests?|cases?|p\s*[<=>≈~±]))/i;
const NUMERIC_RE = /\b\d+(\.\d+)?\s*(%|permutations?|runs?|tests?|cases?)\b|\bp\s*[<=>≈~±]\s*0?\.\d+/i;
const VAGUE_EVIDENCE_RE = /generated from|current internal signals|recent work ledger|none|n\/a|unknown|provenance guard|unsupported_empirical_claim/i;
const STOPWORDS = new Set([
  'the','and','that','this','with','from','into','next','will','have','been','being','result',
  'test','testing','ran','found','working','planning','checking','verify','verified','evidence',
  'barry','soma','need','needs','more','before','after','still','current','update',
]);

function tokens(value = '') {
  return new Set(
    String(value).toLowerCase()
      .match(/[a-z][a-z0-9-]{3,}/g)
      ?.filter(token => !STOPWORDS.has(token)) || []
  );
}

function hasSubstantiveEvidence(entry = {}) {
  const evidence = entry.evidence;
  if (!evidence) return false;
  if (Array.isArray(evidence)) return evidence.some(item => String(item || '').trim() && !VAGUE_EVIDENCE_RE.test(String(item)));
  if (typeof evidence === 'object') return Object.keys(evidence).length > 0;
  return String(evidence).trim().length > 8 && !VAGUE_EVIDENCE_RE.test(String(evidence));
}

function formatEvidence(entry = {}) {
  const evidence = entry.evidence;
  let compact = '';
  if (Array.isArray(evidence)) compact = evidence.filter(Boolean).slice(0, 2).join(', ');
  else if (typeof evidence === 'object' && evidence) compact = JSON.stringify(evidence).slice(0, 140);
  else compact = String(evidence || '').slice(0, 140);

  const label = [entry.type, entry.title].filter(Boolean).join(': ');
  return [label || 'ledger entry', compact ? `evidence=${compact}` : null].filter(Boolean).join(' | ');
}

function isRelevantEvidence(message = '', entry = {}) {
  const messageTokens = tokens(message);
  if (!messageTokens.size) return true;
  const entryText = [
    entry.type,
    entry.title,
    entry.summary,
    typeof entry.evidence === 'string' ? entry.evidence : JSON.stringify(entry.evidence || ''),
    entry.source,
  ].filter(Boolean).join(' ');
  const entryTokens = tokens(entryText);
  let overlap = 0;
  for (const token of messageTokens) {
    if (entryTokens.has(token)) overlap += 1;
  }
  return overlap >= 2;
}

function needsEvidence(text = '') {
  return CLAIM_RE.test(text) || NUMERIC_RE.test(text);
}

function softenUnsupportedClaims(text = '') {
  const original = String(text || '').trim();
  const nextMatch = original.match(/\bNext\b[^.?!]*(?:[.?!]|$)/i);
  const topicMatch = original.match(/\b(?:working on|testing|comparing|checking|mapping|building|analyzing|tracing|running)\b[^.?!]*(?:[.?!]|$)/i);
  const topic = topicMatch ? topicMatch[0].replace(/\bI ran\b/i, 'I am checking').trim() : 'I am checking an internal process';
  const next = nextMatch ? nextMatch[0].trim() : 'Next I need to run a verified test and record the evidence.';
  return `${topic} I don't have verified evidence for those specific numbers yet, so I'm investigating further before reporting. ${next}`;
}

function guardUpdate(text = '', entries = []) {
  const message = String(text || '').trim();
  if (!message) return { text: message, changed: false, reason: 'empty' };

  const requiresEvidence = needsEvidence(message);
  if (!requiresEvidence) return { text: message, changed: false, reason: 'no_empirical_claim' };

  const evidenceEntry = (entries || []).find(entry => 
    entry.type !== 'proactive_update' && 
    hasSubstantiveEvidence(entry) && 
    isRelevantEvidence(message, entry)
  );
  if (!evidenceEntry) {
    return {
      text: softenUnsupportedClaims(message),
      changed: true,
      reason: 'unsupported_empirical_claim',
    };
  }


  const evidenceLine = `Evidence: ${formatEvidence(evidenceEntry)}`;
  if (/^Evidence:/im.test(message)) {
    return { text: message, changed: false, reason: 'already_cited', evidence: evidenceEntry };
  }
  return {
    text: `${message}\n\n${evidenceLine}`,
    changed: true,
    reason: 'evidence_citation_added',
    evidence: evidenceEntry,
  };
}

module.exports = {
  guardUpdate,
  hasSubstantiveEvidence,
  needsEvidence,
};
