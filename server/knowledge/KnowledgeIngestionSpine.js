import fs from 'fs';
import path from 'path';

const DOMAIN_TARGETS = {
  medical: { workbook: 'SOMA Research', segment: 'Medical Literature' },
  finance: { workbook: 'Mission Control Research', segment: 'Market Evidence' },
  code: { workbook: 'Code Lab Research', segment: 'Repository Evidence' },
  creative: { workbook: 'Creative Studio', segment: 'Story Notes' },
  social: { workbook: 'Social Presence', segment: 'Audience Learning' },
  system: { workbook: 'SOMA Operating Memory', segment: 'Decisions And Lessons' },
  general: { workbook: 'SOMA Knowledge', segment: 'Inbox' }
};

const slugValue = (value = 'untitled') => String(value)
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')
  .slice(0, 90) || 'untitled';

const compact = (value = '') => String(value || '').replace(/\s+/g, ' ').trim();

const frontmatterValue = (value) => JSON.stringify(String(value || ''));

function readJson(filePath, fallback) {
  try {
    if (!fs.existsSync(filePath)) return fallback;
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return fallback;
  }
}

function keywordSet(text = '') {
  const stop = new Set(['about', 'after', 'again', 'against', 'because', 'before', 'between', 'could', 'every', 'found', 'from', 'have', 'into', 'more', 'only', 'other', 'paper', 'papers', 'research', 'should', 'their', 'there', 'these', 'this', 'those', 'through', 'using', 'where', 'which', 'while', 'with', 'would']);
  return new Set((String(text).toLowerCase().match(/\b[a-z][a-z0-9-]{3,}\b/g) || [])
    .filter(word => !stop.has(word))
    .slice(0, 80));
}

function overlapScore(a, b) {
  const left = keywordSet(a);
  const right = keywordSet(b);
  if (!left.size || !right.size) return 0;
  let shared = 0;
  for (const word of left) if (right.has(word)) shared += 1;
  return shared / Math.min(left.size, right.size);
}

function tone(text = '') {
  const value = String(text).toLowerCase();
  if (/\b(no|not|failed|fails|weak|negative|non-significant|contradict|against|unlikely|risk|limitation|blocked)\b/.test(value)) return 'negative';
  if (/\b(support|supports|positive|significant|improved|useful|passed|promoted|validated|proves?|proven|signal)\b/.test(value)) return 'positive';
  return 'neutral';
}

export class KnowledgeIngestionSpine {
  constructor(config = {}) {
    this.root = config.root || process.cwd();
    this.system = config.system || null;
    this.dataDir = config.dataDir || path.join(this.root, 'data', 'knowledge-spine');
    this.reflectionsPath = config.reflectionsPath || path.join(this.root, 'data', 'vault', 'reflections');
    this.corpusPath = path.join(this.dataDir, 'corpus.json');
    this.auditPath = path.join(this.dataDir, 'events.jsonl');
  }

  _readCorpus() {
    const corpus = readJson(this.corpusPath, { version: 1, entries: [], units: [], updatedAt: null });
    return {
      version: 1,
      entries: Array.isArray(corpus.entries) ? corpus.entries : [],
      units: Array.isArray(corpus.units) ? corpus.units : [],
      updatedAt: corpus.updatedAt || null
    };
  }

  _writeCorpus(corpus) {
    fs.mkdirSync(path.dirname(this.corpusPath), { recursive: true });
    const next = { ...corpus, updatedAt: new Date().toISOString() };
    fs.writeFileSync(this.corpusPath, JSON.stringify(next, null, 2), 'utf8');
    return next;
  }

  _audit(event) {
    try {
      fs.mkdirSync(path.dirname(this.auditPath), { recursive: true });
      fs.appendFileSync(this.auditPath, `${JSON.stringify({ ...event, at: new Date().toISOString() })}\n`, 'utf8');
    } catch {}
  }

  _targetFor(payload = {}) {
    const domain = String(payload.domain || 'general').toLowerCase();
    const defaults = DOMAIN_TARGETS[domain] || DOMAIN_TARGETS.general;
    return {
      domain,
      workbook: payload.targetWorkbook || defaults.workbook,
      segment: payload.targetSegment || defaults.segment
    };
  }

  _ensureScaffold(workbook, segment, domain) {
    fs.mkdirSync(this.reflectionsPath, { recursive: true });
    const now = new Date().toISOString();
    const workbookFile = path.join(this.reflectionsPath, `workbook.${slugValue(workbook)}.md`);
    if (!fs.existsSync(workbookFile)) {
      fs.writeFileSync(workbookFile, [
        '---',
        `title: ${frontmatterValue(workbook)}`,
        'type: workbook',
        'status: active',
        `createdAt: ${now}`,
        `domain: ${frontmatterValue(domain)}`,
        'tags: [reflections, knowledge-spine]',
        '---',
        '',
        `# ${workbook}`,
        '',
        'Reusable SOMA knowledge workspace populated by the ingestion spine.'
      ].join('\n'), 'utf8');
    }

    const segmentFile = path.join(this.reflectionsPath, `segment.${slugValue(workbook)}.${slugValue(segment)}.md`);
    if (!fs.existsSync(segmentFile)) {
      fs.writeFileSync(segmentFile, [
        '---',
        `title: ${frontmatterValue(segment)}`,
        'type: segment',
        `workbook: ${frontmatterValue(workbook)}`,
        `parent: ${frontmatterValue(workbook)}`,
        'status: active',
        `createdAt: ${now}`,
        `domain: ${frontmatterValue(domain)}`,
        'tags: [reflections, knowledge-spine]',
        '---',
        '',
        `# ${segment}`,
        '',
        'Structured notes, evidence units, contradictions, and reusable lessons.'
      ].join('\n'), 'utf8');
    }
  }

  extractUnits(payload = {}) {
    const content = String(payload.content || payload.summary || '').trim();
    const metadata = payload.metadata || {};
    const explicit = Array.isArray(payload.units) ? payload.units : [];
    const sentences = content
      .split(/(?<=[.!?])\s+|\n+/)
      .map(compact)
      .filter(sentence => sentence.length >= 35 && sentence.length <= 600);

    const claimRe = /\b(is|are|was|were|shows?|suggests?|indicates?|supports?|reduces?|increases?|improves?|fails?|failed|correlates?|predicts?|outperforms?|underperforms?)\b/i;
    const riskRe = /\b(risk|limitation|caution|unsafe|failed|weak|uncertain|overfit|stale|bias|blocked|veto|drawdown|loss)\b/i;
    const questionRe = /\?$/;
    const signalRe = /\b(signal|pattern|edge|lesson|finding|result|evidence|opportunity|contradiction)\b/i;

    const units = [];
    for (const unit of explicit) {
      if (!unit?.text) continue;
      units.push({
        id: `unit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        kind: unit.kind || 'claim',
        text: compact(unit.text),
        confidence: unit.confidence ?? metadata.confidence ?? null,
        sourceId: payload.id || null,
        tone: unit.tone || tone(unit.text)
      });
    }

    for (const sentence of sentences.slice(0, 40)) {
      let kind = null;
      if (questionRe.test(sentence)) kind = 'question';
      else if (riskRe.test(sentence)) kind = 'risk';
      else if (signalRe.test(sentence)) kind = 'signal';
      else if (claimRe.test(sentence)) kind = 'claim';
      if (!kind) continue;
      units.push({
        id: `unit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        kind,
        text: sentence,
        confidence: metadata.confidence ?? null,
        sourceId: payload.id || null,
        tone: tone(sentence)
      });
      if (units.length >= 18) break;
    }

    return units;
  }

  compareUnits(units, priorUnits) {
    const duplicates = [];
    const contradictions = [];
    const related = [];

    for (const unit of units) {
      for (const prior of priorUnits.slice(0, 600)) {
        const score = overlapScore(unit.text, prior.text);
        if (score >= 0.92) {
          duplicates.push({ incoming: unit.text, prior: prior.text, priorEntryId: prior.entryId, score: Number(score.toFixed(2)) });
        } else if (score >= 0.42 && unit.tone !== 'neutral' && prior.tone !== 'neutral' && unit.tone !== prior.tone) {
          contradictions.push({ incoming: unit.text, prior: prior.text, priorEntryId: prior.entryId, score: Number(score.toFixed(2)) });
        } else if (score >= 0.48) {
          related.push({ incoming: unit.text, prior: prior.text, priorEntryId: prior.entryId, score: Number(score.toFixed(2)) });
        }
      }
    }

    return {
      duplicateCount: duplicates.length,
      contradictionCount: contradictions.length,
      relatedCount: related.length,
      duplicates: duplicates.slice(0, 8),
      contradictions: contradictions.slice(0, 8),
      related: related.slice(0, 8)
    };
  }

  publishToReflections(entry, units, comparison, target) {
    this._ensureScaffold(target.workbook, target.segment, target.domain);
    const now = new Date().toISOString();
    const title = entry.title || 'Knowledge Ingestion';
    const filename = `folio.${slugValue(target.workbook)}.${slugValue(target.segment)}.${slugValue(title)}.${Date.now()}.md`;
    const filePath = path.join(this.reflectionsPath, filename);
    const sourceLines = [
      `- Domain: ${target.domain}`,
      `- Source type: ${entry.sourceType || 'unknown'}`,
      `- Source URL: ${entry.sourceUrl || 'N/A'}`,
      `- Confidence: ${entry.confidence ?? 'N/A'}`,
      `- Created: ${now}`
    ];
    const unitLines = units.length
      ? units.map(unit => `- [${unit.kind}] (${unit.tone}) ${unit.text}`)
      : ['- No structured units extracted.'];
    const contradictionLines = comparison.contradictions.length
      ? comparison.contradictions.map(item => `- Incoming: ${item.incoming}\n  Prior: ${item.prior}`)
      : ['- None detected.'];
    const relatedLines = comparison.related.length
      ? comparison.related.map(item => `- ${item.incoming}`)
      : ['- None detected.'];

    const body = [
      '---',
      `title: ${frontmatterValue(title)}`,
      'type: folio',
      'status: inbox',
      `workbook: ${frontmatterValue(target.workbook)}`,
      `segment: ${frontmatterValue(target.segment)}`,
      `parent: ${frontmatterValue(target.segment)}`,
      `createdAt: ${now}`,
      `domain: ${frontmatterValue(target.domain)}`,
      `sourceType: ${frontmatterValue(entry.sourceType || 'unknown')}`,
      'tags: [reflections, knowledge-spine]',
      '---',
      '',
      `# ${title}`,
      '',
      '## Ingestion Receipt',
      '',
      ...sourceLines,
      '',
      '## Extracted Units',
      '',
      ...unitLines,
      '',
      '## Contradictions Or Tensions',
      '',
      ...contradictionLines,
      '',
      '## Related Prior Signals',
      '',
      ...relatedLines,
      '',
      '## Source Content',
      '',
      entry.content || entry.summary || ''
    ].join('\n');

    fs.writeFileSync(filePath, body, 'utf8');
    return { filename, path: filePath };
  }

  async ingest(payload = {}) {
    const target = this._targetFor(payload);
    const now = new Date().toISOString();
    const id = payload.id || `kg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const entry = {
      id,
      title: payload.title || `${target.domain} knowledge entry`,
      domain: target.domain,
      sourceType: payload.sourceType || 'event',
      sourceUrl: payload.sourceUrl || null,
      confidence: payload.confidence ?? payload.metadata?.confidence ?? null,
      content: String(payload.content || payload.summary || '').slice(0, 120_000),
      metadata: payload.metadata || {},
      createdAt: now
    };
    const corpus = this._readCorpus();
    const units = this.extractUnits({ ...payload, id });
    const comparison = this.compareUnits(units, corpus.units || []);
    const reflection = payload.publishToReflections === false
      ? null
      : this.publishToReflections(entry, units, comparison, target);

    const unitsWithEntry = units.map(unit => ({
      ...unit,
      entryId: id,
      domain: target.domain,
      sourceType: entry.sourceType,
      createdAt: now
    }));
    const nextCorpus = this._writeCorpus({
      ...corpus,
      entries: [{ ...entry, reflection, unitCount: units.length }, ...(corpus.entries || [])].slice(0, 1000),
      units: [...unitsWithEntry, ...(corpus.units || [])].slice(0, 5000)
    });

    const result = {
      success: true,
      entry: { ...entry, reflection, unitCount: units.length },
      target,
      units: unitsWithEntry,
      comparison,
      corpus: this.status(nextCorpus)
    };

    this._audit({ type: 'knowledge.ingested', id, domain: target.domain, sourceType: entry.sourceType, unitCount: units.length, comparison, reflection });
    await this.system?.messageBroker?.publish?.('knowledge.ingested', result).catch?.(() => {});
    await this.system?.messageBroker?.publish?.('vault_entry_added', {
      type: 'knowledge_spine',
      title: entry.title,
      filename: reflection?.filename,
      timestamp: Date.now()
    }).catch?.(() => {});

    if (this.system?.mnemonicArbiter?.remember && units.length) {
      await this.system.mnemonicArbiter.remember(`[KNOWLEDGE SPINE] ${entry.title}\n${units.slice(0, 5).map(unit => `- ${unit.text}`).join('\n')}`, {
        importance: 0.65,
        sector: target.domain,
        category: 'knowledge_spine',
        sourceType: entry.sourceType
      }).catch(() => {});
    }

    return result;
  }

  suggest(payload = {}) {
    const content = String(payload.content || payload.summary || '');
    const units = this.extractUnits(payload);
    const score = Math.min(1, (
      (units.length >= 3 ? 0.35 : units.length * 0.08) +
      (/\b(decision|lesson|result|evidence|contradiction|failed|passed|risk|signal)\b/i.test(content) ? 0.25 : 0) +
      (content.length > 800 ? 0.15 : 0) +
      (payload.confidence ? Number(payload.confidence) * 0.25 : 0.10)
    ));
    return {
      suggested: score >= 0.55,
      confidence: Number(score.toFixed(2)),
      unitCount: units.length,
      reason: score >= 0.55
        ? 'Content contains reusable claims, risks, decisions, or evidence signals.'
        : 'Content does not yet look worth permanent filing.'
    };
  }

  status(corpus = this._readCorpus()) {
    const byDomain = {};
    const bySourceType = {};
    for (const entry of corpus.entries || []) {
      byDomain[entry.domain || 'general'] = (byDomain[entry.domain || 'general'] || 0) + 1;
      bySourceType[entry.sourceType || 'event'] = (bySourceType[entry.sourceType || 'event'] || 0) + 1;
    }
    return {
      entryCount: corpus.entries?.length || 0,
      unitCount: corpus.units?.length || 0,
      updatedAt: corpus.updatedAt || null,
      byDomain,
      bySourceType,
      recentEntries: (corpus.entries || []).slice(0, 10)
    };
  }
}

export default KnowledgeIngestionSpine;
