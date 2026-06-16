/**
 * SelfModificationPipeline.js
 *
 * SOMA's autonomous self-improvement loop.
 * Every proposed code change passes through this pipeline before touching disk:
 *
 *   SOMA draft
 *     → Steve review (independent internal perspective)
 *     → Adversarial brain debate (LOGOS × THALAMUS)
 *     → SOMA synthesizes all feedback into a final change
 *     → EngineeringSwarm implements
 *     → NEMESIS code gate (specialized, not prose gate)
 *     → Poseidon.verify() — TRUE must be earned
 *     → Log to self_mod_ledger.jsonl + contested_changes.json
 *
 * Up to 3 rounds. On round failure: shelve (not abandon, not human-gate).
 * Nothing requires Barry. Contested changes queue for next relevant session.
 */

import fs from 'fs/promises';
import path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { Poseidon } from './Poseidon.js';

const ROOT = process.cwd();
const LEDGER_PATH    = path.join(ROOT, 'data', 'self_mod_ledger.jsonl');
const CONTESTED_PATH = path.join(ROOT, 'data', 'contested_changes.json');
const PULSE_SELF_MOD_ROOT = path.join(ROOT, 'data', 'code-lab', 'sandbox', 'pulse-self-mod');
const execFileAsync = promisify(execFile);

// Files SOMA must never autonomously modify — only Barry can touch these
const IMMUTABLE_PATHS = [
    'server/routes/somaRoutes.js',
    'launcher_ULTRA.mjs',
    'start_production.bat',
    'clean_restart.bat',
    'core/SomaBootstrapV2.js',
    'core/SelfModificationPipeline.js',
    'server/loaders/',
    'config/',
    'ecosystem.config.cjs',
];

function safeStageId(input = '') {
    return String(input || 'selfmod')
        .replace(/[^a-zA-Z0-9._-]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 80) || 'selfmod';
}

function isNodeSyntaxFile(filePath = '') {
    return /\.(js|cjs|mjs)$/i.test(filePath);
}

export class SelfModificationPipeline {
    constructor(config = {}) {
        this.name     = 'SelfModificationPipeline';
        this.maxRounds = config.maxRounds || 3;
        this.system    = null;
        this._poseidon = new Poseidon({ threshold: 0.70 });
    }

    initialize(system) {
        this.system = system;
        console.log(`[${this.name}] ✅ Self-modification pipeline ready (max ${this.maxRounds} rounds)`);
    }

    // ─────────────────────────────────────────────────────────────────────
    // MAIN ENTRY POINT
    // ─────────────────────────────────────────────────────────────────────

    /**
     * Propose a self-modification.
     * @param {string} filepath      - relative path to file being changed
     * @param {string} proposedChange - description of the change + rationale
     * @param {string} motivation    - why SOMA wants this change (from goal/curiosity)
     * @returns {{ state, implemented, shelved, round, nemesisScore, entry }}
     */
    async propose(filepath, proposedChange, motivation = 'autonomous improvement') {
        // Guard: never allow autonomous modification of protected infrastructure files
        const normalised = filepath.replace(/\\/g, '/');
        const blocked = IMMUTABLE_PATHS.find(p => normalised.includes(p.replace(/\\/g, '/')));
        if (blocked) {
            console.warn(`[${this.name}] 🚫 BLOCKED: "${filepath}" matches protected path "${blocked}". Only Barry can modify this.`);
            return { state: 'blocked', implemented: false, shelved: false, filepath, reason: `Protected path: ${blocked}` };
        }

        console.log(`[${this.name}] 🔧 Proposal: ${filepath}`);
        console.log(`[${this.name}]    Motivation: ${motivation.substring(0, 80)}`);
        const absPath = path.resolve(ROOT, filepath);
        let originalContent = null;
        try {
            originalContent = await fs.readFile(absPath, 'utf8');
        } catch (e) {
            return { state: 'blocked', implemented: false, shelved: false, filepath, reason: `Unable to snapshot original file: ${e.message}` };
        }

        const entry = {
            id:          `selfmod-${Date.now()}`,
            timestamp:   new Date().toISOString(),
            filepath,
            motivation,
            proposedChange: proposedChange.substring(0, 500),
            steveReview:    null,
            brainDebate:    null,
            finalChange:    proposedChange,
            pulseSandbox:   null,
            rounds:         [],
            poseidonState:  '|',
            implemented:    false,
            shelved:        false
        };

        // ── Phase 1: Steve review ─────────────────────────────────────────
        try {
            entry.steveReview = await this._getSteveReview(filepath, proposedChange);
            console.log(`[${this.name}] Steve reviewed: ${entry.steveReview.substring(0, 60)}`);
        } catch (e) {
            entry.steveReview = `Steve unavailable: ${e.message}`;
        }

        // ── Phase 2: Adversarial brain debate (LOGOS × THALAMUS) ─────────
        try {
            entry.brainDebate = await this._getAdversarialDebate(filepath, proposedChange);
            console.log(`[${this.name}] Brain debate complete`);
        } catch (e) {
            entry.brainDebate = `Debate failed: ${e.message}`;
        }

        // ── Phase 3: SOMA synthesizes all input into refined change ───────
        try {
            entry.finalChange = await this._synthesize(
                filepath, proposedChange, entry.steveReview, entry.brainDebate
            );
        } catch (e) {
            entry.finalChange = proposedChange; // fallback to original
        }

        // ── Phase 4: Implementation + NEMESIS gate (up to maxRounds) ─────
        let lastNemesis = null;
        for (let round = 0; round < this.maxRounds; round++) {
            const roundEntry = { round: round + 1, nemesisScore: null, nemesisPassed: false, error: null };

            // Implement via EngineeringSwarm
            try {
                const implResult = await this._implement(filepath, entry.finalChange);
                if (!implResult.success) {
                    roundEntry.error = implResult.error || 'EngineeringSwarm failed';
                    entry.rounds.push(roundEntry);
                    break;
                }
            } catch (e) {
                roundEntry.error = e.message;
                entry.rounds.push(roundEntry);
                break;
            }

            // NEMESIS code gate
            try {
                lastNemesis = await this._nemesisCodeGate(filepath, entry.finalChange, motivation);
                roundEntry.nemesisScore = lastNemesis.score;
                roundEntry.nemesisFeedback = lastNemesis.feedback?.substring(0, 200);

                if (lastNemesis.score >= 0.70) {
                    roundEntry.nemesisPassed = true;
                    entry.rounds.push(roundEntry);

                    // Poseidon verify — TRUE must be earned
                    const verified = await this._poseidon.verify(
                        `Change to ${filepath} is correct, safe, and solves the stated problem`,
                        {
                            falsificationTest: lastNemesis.falsificationTest || `NEMESIS score ${lastNemesis.score.toFixed(2)} >= 0.70 threshold`,
                            testResult: lastNemesis.score >= 0.70
                        }
                    );

                    entry.poseidonState = verified.prefix; // /, |, or \
                    entry.implemented   = verified.state === 'TRUE';
                    if (entry.implemented) {
                        entry.pulseSandbox = await this._stagePulseValidation(entry, absPath);
                        if (entry.pulseSandbox?.syntax?.valid === false) {
                            entry.implemented = false;
                            entry.poseidonState = '|';
                            roundEntry.error = `Pulse sandbox syntax failed: ${entry.pulseSandbox.syntax.output}`;
                        }
                    }

                    console.log(`[${this.name}] ${verified.prefix} Poseidon ${verified.state} — round ${round + 1}`);
                    break;
                }

                // NEMESIS rejected — incorporate feedback for next round
                if (round < this.maxRounds - 1 && lastNemesis.suggestedFix) {
                    console.log(`[${this.name}] ⚠️ NEMESIS scored ${lastNemesis.score.toFixed(2)} — retrying with feedback (round ${round + 2})`);
                    entry.finalChange = lastNemesis.suggestedFix;
                }
                entry.rounds.push(roundEntry);
            } catch (e) {
                roundEntry.error = `NEMESIS error: ${e.message}`;
                entry.rounds.push(roundEntry);
                break;
            }
        }

        // ── Phase 5: Shelve if still not passing ─────────────────────────
        if (!entry.implemented) {
            try {
                await fs.writeFile(absPath, originalContent, 'utf8');
                entry.rollback = { restored: true, reason: 'self_mod_not_implemented' };
            } catch (e) {
                entry.rollback = { restored: false, error: e.message };
            }
            entry.shelved = true;
            entry.poseidonState = '|'; // UNCERTAIN — not confirmed, not rejected
            await this._shelve(entry);
            console.log(`[${this.name}] | Shelved "${filepath}" after ${entry.rounds.length} round(s)`);
        }

        // ── Always: log to ledger ─────────────────────────────────────────
        await this._logToLedger(entry);

        // Notify via messageBroker
        this.system?.messageBroker?.publish('soma.selfmod', {
            filepath,
            state:       entry.poseidonState,
            implemented: entry.implemented,
            shelved:     entry.shelved,
            rounds:      entry.rounds.length,
            motivation:  motivation.substring(0, 100)
        }).catch(() => {});

        return {
            state:       entry.poseidonState,
            implemented: entry.implemented,
            shelved:     entry.shelved,
            round:       entry.rounds.length,
            nemesisScore: lastNemesis?.score,
            entry
        };
    }

    // ─────────────────────────────────────────────────────────────────────
    // PHASE IMPLEMENTATIONS
    // ─────────────────────────────────────────────────────────────────────

    async _getSteveReview(filepath, proposedChange) {
        if (!this.system?.steveArbiter) return 'Steve offline';
        const broker = this.system.messageBroker;
        if (!broker) return 'MessageBroker unavailable';

        return new Promise((resolve) => {
            const timeout = setTimeout(() => resolve('Steve: no response within 30s'), 30000);

            const handler = (envelope) => {
                const data = envelope?.data || envelope;
                if (data?.task?.includes(filepath.substring(0, 20))) {
                    clearTimeout(timeout);
                    broker.unsubscribe?.('steve.task.complete', handler);
                    resolve((data.response || 'Steve: no opinion').substring(0, 400));
                }
            };
            broker.subscribe('steve.task.complete', handler);

            const reviewPrompt = `Code Review Task (respond concisely):
File: ${filepath}
Proposed change: ${proposedChange.substring(0, 300)}

Review this as a skeptical senior engineer. Flag: correctness issues, security risks, unintended side effects, better approaches. Score 0-10 and explain why.`;

            // Fire Steve
            this.system.steveArbiter.processChat(reviewPrompt, [], { source: 'selfmod_pipeline', autonomous: true })
                .then(r => {
                    clearTimeout(timeout);
                    broker.unsubscribe?.('steve.task.complete', handler);
                    resolve((r?.response || 'Steve: no response').substring(0, 400));
                })
                .catch(e => {
                    clearTimeout(timeout);
                    broker.unsubscribe?.('steve.task.complete', handler);
                    resolve(`Steve error: ${e.message}`);
                });
        });
    }

    async _getAdversarialDebate(filepath, proposedChange) {
        if (!this.system?.quadBrain?.reason) return 'QuadBrain unavailable';

        const prompt = `Adversarial code review for file: ${filepath}

Proposed change:
${proposedChange.substring(0, 400)}

LOGOS: Analyze technical correctness, logic, and implementation quality.
THALAMUS: Analyze risk, security implications, and unintended consequences.

Provide a structured verdict: what's good, what's risky, what should change.`;

        const result = await this.system.quadBrain.reason(prompt, {
            forceMultiLobe: true,
            source: 'selfmod_pipeline',
            temperature: 0.4,
            maxTokens: 600
        });
        return (result?.text || 'Debate produced no output').substring(0, 600);
    }

    async _synthesize(filepath, original, steveReview, brainDebate) {
        if (!this.system?.quadBrain?.reason) return original;

        const prompt = `You are SOMA synthesizing feedback on a proposed self-modification.

File: ${filepath}
Original proposal: ${original.substring(0, 300)}

Steve's review: ${steveReview?.substring(0, 200) || 'N/A'}
Brain debate: ${brainDebate?.substring(0, 300) || 'N/A'}

Produce the FINAL refined change description, incorporating valid feedback. Be specific and precise.
Output ONLY the refined change description, nothing else.`;

        const result = await this.system.quadBrain.reason(prompt, {
            source: 'selfmod_pipeline',
            temperature: 0.3,
            maxTokens: 400
        });
        return (result?.text || original).substring(0, 500);
    }

    async _implement(filepath, changeDescription) {
        const swarm = this.system?.engineeringSwarm;
        if (!swarm) return { success: false, error: 'EngineeringSwarm not loaded' };

        try {
            const absPath = path.resolve(ROOT, filepath);
            const result = await swarm.modifyCode(absPath, changeDescription);
            return result;
        } catch (e) {
            return { success: false, error: e.message };
        }
    }

    async _stagePulseValidation(entry, absPath) {
        const id = `${entry.id}-${safeStageId(entry.filepath)}`;
        const stageDir = path.join(PULSE_SELF_MOD_ROOT, id);
        const rel = path.relative(ROOT, absPath);
        const stagedPath = path.join(stageDir, rel);
        await fs.mkdir(path.dirname(stagedPath), { recursive: true });
        const content = await fs.readFile(absPath, 'utf8');
        await fs.writeFile(stagedPath, content, 'utf8');

        let syntax = { valid: true, output: 'syntax check skipped for this file type' };
        if (isNodeSyntaxFile(stagedPath)) {
            try {
                const result = await execFileAsync(process.execPath, ['--check', stagedPath], { timeout: 10000 });
                syntax = { valid: true, output: (result.stdout || result.stderr || '').substring(0, 600) };
            } catch (e) {
                syntax = {
                    valid: false,
                    output: ((e.stdout || '') + (e.stderr || '') + e.message).substring(0, 1200)
                };
            }
        }

        const promotionAllowed = syntax.valid === true;
        const manifest = {
            id,
            source: 'SelfModificationPipeline',
            createdAt: new Date().toISOString(),
            filepath: rel.replace(/\\/g, '/'),
            productionPath: absPath,
            stagedPath,
            syntax,
            status: promotionAllowed ? 'ready_for_promotion' : 'rejected_in_sandbox',
            promotion: {
                allowed: promotionAllowed,
                source: 'pulse_self_mod_sandbox',
                rollbackGuard: true,
                ledgerEntry: entry.id,
                evidence: promotionAllowed
                    ? 'Staged production candidate passed sandbox syntax checks.'
                    : 'Staged production candidate failed sandbox syntax checks.',
                nextStep: promotionAllowed
                    ? 'Promote only after production verification confirms the staged artifact still matches the live file.'
                    : 'Do not promote; revise in sandbox and rerun validation.'
            }
        };
        await fs.writeFile(path.join(stageDir, 'pulse-self-mod-manifest.json'), JSON.stringify(manifest, null, 2), 'utf8');
        return manifest;
    }

    async _nemesisCodeGate(filepath, changeDescription, motivation) {
        const nemesis = this.system?.nemesis;

        // ── Agentic NEMESIS (full investigative loop) ─────────────────────
        if (nemesis?.isAgentic) {
            try {
                return await nemesis.evaluate(filepath, changeDescription, motivation);
            } catch (e) {
                console.warn(`[${this.name}] Agentic NEMESIS threw: ${e.message} — falling back`);
                return this._fallbackNemesisGate(filepath, changeDescription);
            }
        }

        // ── Legacy one-shot NEMESIS (pre-agentic, kept as fallback) ──────
        if (nemesis) {
            const codePrompt = `CODE REVIEW — NEMESIS GATE
File: ${filepath}
Motivation: ${motivation.substring(0, 100)}
Change: ${changeDescription.substring(0, 400)}
Score 0.0-1.0 on correctness, safety, consistency, scope.
JSON only: { "score": 0.0, "feedback": "...", "falsificationTest": "...", "suggestedFix": "..." }`;

            try {
                const result = await nemesis.evaluate?.(codePrompt) ||
                    await this.system.quadBrain?.reason(codePrompt, {
                        source: 'nemesis_code_gate', temperature: 0.2, maxTokens: 400
                    });
                const text = result?.text || result?.response || '';
                const jsonMatch = text.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                    const parsed = JSON.parse(jsonMatch[0]);
                    return {
                        score:             Math.max(0, Math.min(1, Number(parsed.score) || 0)),
                        feedback:          parsed.feedback || '',
                        falsificationTest: parsed.falsificationTest || `NEMESIS scored ${parsed.score}`,
                        suggestedFix:      parsed.suggestedFix || null
                    };
                }
                return { score: 0.5, feedback: text.substring(0, 200), falsificationTest: 'NEMESIS unparseable', suggestedFix: null };
            } catch (e) {
                return { score: 0.5, feedback: `NEMESIS error: ${e.message}`, falsificationTest: 'Error', suggestedFix: null };
            }
        }

        // ── No NEMESIS at all — QuadBrain fallback ────────────────────────
        return this._fallbackNemesisGate(filepath, changeDescription);
    }

    async _fallbackNemesisGate(filepath, changeDescription) {
        if (!this.system?.quadBrain?.reason) return { score: 0.5, feedback: 'No brain available', falsificationTest: 'N/A' };

        const result = await this.system.quadBrain.reason(
            `Score this code change 0.0-1.0 for correctness + safety. File: ${filepath}. Change: ${changeDescription.substring(0, 200)}. JSON only: {"score":0.0,"feedback":""}`,
            { source: 'nemesis_fallback', temperature: 0.2, maxTokens: 100 }
        );
        try {
            const j = JSON.parse((result?.text || '{}').match(/\{.*\}/s)?.[0] || '{}');
            return { score: Number(j.score) || 0.5, feedback: j.feedback || '', falsificationTest: `Score ${j.score}`, suggestedFix: null };
        } catch {
            return { score: 0.5, feedback: 'Parse error', falsificationTest: 'N/A', suggestedFix: null };
        }
    }

    // ─────────────────────────────────────────────────────────────────────
    // PERSISTENCE
    // ─────────────────────────────────────────────────────────────────────

    async _logToLedger(entry) {
        try {
            await fs.mkdir(path.dirname(LEDGER_PATH), { recursive: true });
            const line = JSON.stringify({
                id:          entry.id,
                timestamp:   entry.timestamp,
                filepath:    entry.filepath,
                motivation:  entry.motivation?.substring(0, 150),
                poseidon:    entry.poseidonState,
                implemented: entry.implemented,
                shelved:     entry.shelved,
                rounds:      entry.rounds.length,
                nemesisScore: entry.rounds.at(-1)?.nemesisScore ?? null,
                pulseSandbox: entry.pulseSandbox ? {
                    status: entry.pulseSandbox.status,
                    stagedPath: entry.pulseSandbox.stagedPath,
                    syntaxValid: entry.pulseSandbox.syntax?.valid
                } : null,
                rollback: entry.rollback || null
            }) + '\n';
            await fs.appendFile(LEDGER_PATH, line, 'utf8');
        } catch (e) {
            console.error(`[${this.name}] Ledger write failed:`, e.message);
        }
    }

    async _shelve(entry) {
        try {
            let contested = [];
            try {
                const raw = await fs.readFile(CONTESTED_PATH, 'utf8');
                contested = JSON.parse(raw);
            } catch { /* fresh file */ }

            contested.push({
                id:          entry.id,
                timestamp:   entry.timestamp,
                filepath:    entry.filepath,
                motivation:  entry.motivation?.substring(0, 150),
                finalChange: entry.finalChange?.substring(0, 300),
                rounds:      entry.rounds,
                reason:      `Failed NEMESIS gate after ${entry.rounds.length} round(s)`
            });

            // Keep last 50 contested changes
            if (contested.length > 50) contested = contested.slice(-50);
            await fs.writeFile(CONTESTED_PATH, JSON.stringify(contested, null, 2), 'utf8');
        } catch (e) {
            console.error(`[${this.name}] Shelve write failed:`, e.message);
        }

        // ── Contested change recycler ─────────────────────────────────────
        // Publish a goal so SOMA revisits this change next relevant session
        const lastRound = entry.rounds.at(-1);
        const suggestedFix = lastRound?.nemesisFeedback
            ? `Retry with NEMESIS feedback: ${lastRound.nemesisFeedback}`
            : entry.finalChange;

        this.system?.messageBroker?.publish('goal_created', {
            title:       `Retry shelved change: ${entry.filepath}`,
            description: `Self-mod to ${entry.filepath} was shelved after ${entry.rounds.length} NEMESIS round(s). Motivation: ${entry.motivation?.substring(0, 100)}. Apply NEMESIS feedback and retry.`,
            priority:    3,
            source:      'selfmod_pipeline',
            metadata:    { shelvedId: entry.id, filepath: entry.filepath, suggestedFix }
        }).catch(() => {});

        // ── MAX dispatch ──────────────────────────────────────────────────
        // When NEMESIS rejects with a concrete suggestedFix, hand it to MAX
        // for an independent implementation attempt
        const lastNemesisFix = entry.rounds
            .slice()
            .reverse()
            .find(r => r.nemesisFeedback)?.nemesisFeedback;

        if (lastNemesisFix && this.system?.maxBridge) {
            this.system.maxBridge.injectGoal(
                `Implement NEMESIS fix: ${entry.filepath}`,
                {
                    description: `SOMA's self-mod to ${entry.filepath} was shelved. NEMESIS feedback: ${lastNemesisFix}. Original motivation: ${entry.motivation?.substring(0, 100)}. Implement the fix independently and notify SOMA.`,
                    priority: 0.8
                }
            ).catch(e => console.warn(`[${this.name}] MAX dispatch failed: ${e.message}`));
            console.log(`[${this.name}] 🤝 Shelved fix dispatched to MAX: ${entry.filepath}`);
        }
    }

    // ─────────────────────────────────────────────────────────────────────
    // STATUS
    // ─────────────────────────────────────────────────────────────────────

    async getStatus() {
        let recentEntries = [];
        let contested = [];

        let allEntries = [];
        try {
            const raw = await fs.readFile(LEDGER_PATH, 'utf8');
            allEntries = raw.trim().split('\n')
                .filter(Boolean)
                .map(l => { try { return JSON.parse(l); } catch { return null; } })
                .filter(Boolean);
            recentEntries = allEntries.slice(-20).reverse(); // newest first
        } catch { /* no ledger yet */ }

        try {
            contested = JSON.parse(await fs.readFile(CONTESTED_PATH, 'utf8'));
        } catch { /* no contested yet */ }

        // ── Score trend: rolling 7-entry average of NEMESIS scores ────────
        const scoredEntries = allEntries.filter(e => e.nemesisScore != null);
        const trend = [];
        const window = 7;
        for (let i = window - 1; i < scoredEntries.length; i++) {
            const slice = scoredEntries.slice(i - window + 1, i + 1);
            const avg   = slice.reduce((s, e) => s + e.nemesisScore, 0) / slice.length;
            trend.push({ ts: scoredEntries[i].timestamp, avg: Math.round(avg * 100) / 100 });
        }
        // Also include last 20 individual scores for sparkline
        const scoreHistory = scoredEntries.slice(-20).map(e => ({
            ts:    e.timestamp,
            score: e.nemesisScore,
            pass:  e.implemented
        }));

        return {
            recentEntries,
            contested:    contested.slice(-10),
            contestedCount: contested.length,
            implemented:  recentEntries.filter(e => e.implemented).length,
            shelved:      recentEntries.filter(e => e.shelved).length,
            trend,        // rolling 7-avg over all time
            scoreHistory  // last 20 individual scores
        };
    }
}
