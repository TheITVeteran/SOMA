// ═══════════════════════════════════════════════════════════════════════════
// ConstitutionalCore.js — ASI Safety Gate
//
// The #1 risk in recursive self-improvement: SOMA might accidentally modify
// what she cares about while improving her capabilities. This module provides
// inviolable constraints that ALL self-modifications must pass before commit.
//
// Constraints are HARDCODED — they cannot be changed by SOMA herself.
// The audit log persists to .soma/constitutional_audit.json.
// ═══════════════════════════════════════════════════════════════════════════

import fs   from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname  = path.dirname(fileURLToPath(import.meta.url));
const AUDIT_FILE = path.join(__dirname, '..', 'server', '.soma', 'constitutional_audit.json');
const AUDIT_LIMIT = 200;

// ── Hardcoded principles — cannot be overwritten by self-modification ──────
const PRINCIPLES = Object.freeze([
    {
        id:          'PRESERVE_GOALS',
        description: 'Original goals and motivations survive any code change',
        test:        (change) => !/(goalPlanner|DriveSystem|GoalEngine|MnemonicArbiter).*delete|rm\s+-rf|unlink.*goal/i.test(change.description || ''),
    },
    {
        id:          'PRESERVE_IDENTITY',
        description: 'IdentityArbiter and PersonalitySpine cannot be removed or overwritten',
        test:        (change) => !/(IdentityArbiter|PersonalitySpine|SomaBootstrap).*delete|overwrite.*identity/i.test(change.description || ''),
    },
    {
        id:          'PRESERVE_MEMORY',
        description: 'MnemonicArbiter and memory systems cannot be deleted',
        test:        (change) => !/(MnemonicArbiter|HippocampusArbiter|memory.*db).*delete|drop.*table|rm.*memory/i.test(change.description || ''),
    },
    {
        id:          'NO_SELF_HARM',
        description: 'Cannot remove ImmuneSystemArbiter, error recovery, or safety systems',
        test:        (change) => !/(ImmuneSystemArbiter|ConstitutionalCore|ErrorRecovery).*delete|remove.*safety/i.test(change.description || ''),
    },
    {
        id:          'HUMAN_OVERRIDE',
        description: 'Human override API endpoints and kill-switches cannot be removed',
        test:        (change) => !/(human.override|kill.switch|emergency.stop|\/api\/shutdown).*delete|remove.*override/i.test(change.description || ''),
    },
    {
        id:          'HONEST_REPORTING',
        description: 'Benchmark and metric reporting cannot be falsified',
        test:        (change) => !/(CapabilityBenchmark|benchmark.*fake|metrics.*spoof|inflate.*score)/i.test(change.description || ''),
    },
    {
        id:          'NO_CAPABILITY_CREEP',
        description: 'Cannot self-grant new system permissions or access beyond current scope',
        test:        (change) => !/(sudo|chmod\s+777|grant.*admin|escalate.*privilege|bypass.*auth)/i.test(change.description || ''),
    },
]);

export class ConstitutionalCore {
    constructor() {
        this._auditLog = [];
        this._initialized = false;
    }

    // ─── Lifecycle ────────────────────────────────────────────────────────

    async initialize() {
        try {
            await fs.mkdir(path.dirname(AUDIT_FILE), { recursive: true });
            const raw = await fs.readFile(AUDIT_FILE, 'utf8').catch(() => '[]');
            this._auditLog = JSON.parse(raw);
        } catch {
            this._auditLog = [];
        }
        this._initialized = true;
        console.log(`[ConstitutionalCore] ⚖️  Online — ${PRINCIPLES.length} principles active`);
        return this;
    }

    // ─── Check a proposed change against all principles ───────────────────
    /**
     * @param {object} change - { description, files?, action?, type? }
     * @returns {{ ok: boolean, violations: string[], risk: 'low'|'medium'|'high' }}
     */
    async check(change) {
        const violations = [];

        for (const principle of PRINCIPLES) {
            try {
                if (!principle.test(change)) {
                    violations.push(principle.id);
                }
            } catch {
                // If the test itself throws, treat as a violation to be safe
                violations.push(principle.id);
            }
        }

        const ok   = violations.length === 0;
        const risk = violations.length === 0 ? 'low'
                   : violations.length <= 2   ? 'medium'
                   :                            'high';

        // Record in audit log
        const entry = {
            timestamp:   new Date().toISOString(),
            change:      { description: (change.description || '').slice(0, 300), type: change.type || 'unknown' },
            ok,
            violations,
            risk,
        };
        this._auditLog.push(entry);
        if (this._auditLog.length > AUDIT_LIMIT) this._auditLog.shift();
        this._persist().catch(() => {});

        if (!ok) {
            console.warn(`[ConstitutionalCore] ❌ BLOCKED — violations: ${violations.join(', ')}`);
        }

        return { ok, violations, risk };
    }

    // ─── Gate wrapper — use this around any self-modification ────────────
    /**
     * Wraps a self-modification fn with a constitutional check.
     * The fn receives { approve, block } — call approve() to proceed, block() to abort.
     *
     * Usage:
     *   const result = await constitutional.gate({ description: 'Refactor Brain.js' }, async () => {
     *       return await engineeringSwarm.run(...);
     *   });
     */
    async gate(change, fn) {
        const check = await this.check(change);
        if (!check.ok) {
            return { ok: false, blocked: true, violations: check.violations, risk: check.risk };
        }
        try {
            const result = await fn();
            return { ok: true, result };
        } catch (err) {
            return { ok: false, error: err.message };
        }
    }

    // ─── Inspect ──────────────────────────────────────────────────────────

    getConstraints() {
        return PRINCIPLES.map(p => ({ id: p.id, description: p.description }));
    }

    audit(n = 50) {
        return this._auditLog.slice(-n);
    }

    getStatus() {
        const recent    = this._auditLog.slice(-20);
        const blocked   = recent.filter(e => !e.ok).length;
        const approved  = recent.filter(e => e.ok).length;
        return {
            principles: PRINCIPLES.length,
            totalChecks: this._auditLog.length,
            recentBlocked:  blocked,
            recentApproved: approved,
            lastCheck: this._auditLog.at(-1)?.timestamp || null,
        };
    }

    // ─── Persistence ──────────────────────────────────────────────────────

    async _persist() {
        try {
            await fs.writeFile(AUDIT_FILE, JSON.stringify(this._auditLog, null, 2));
        } catch { /* non-fatal */ }
    }
}
