// ═══════════════════════════════════════════════════════════
// FILE: cognitive/AutonomousLoop.cjs
// ═══════════════════════════════════════════════════════════
// SOMA's Recursive Thought Cycle (RTC) — collapsed to 3 steps.
// Original 8-step design made 5 sequential LLM calls per iteration (×3 iterations = up to 15).
// Collapsed: analyze+plan → draft+voice → evaluate (3 calls, 1 iteration typical with qwen2.5:7b).
// ═══════════════════════════════════════════════════════════

const { ownerName } = require('../core/SomaOwner.cjs');

class AutonomousLoop {
    constructor(opts = {}) {
        this.system = opts.system;
        this.brain  = opts.brain || (this.system && (this.system.quadBrain || this.system.somArbiter));
        this.maxIterations = 2; // Reduced from 3 — qwen2.5:7b hits quality threshold first try
    }

    /**
     * @param {string} input - Raw context/stimulus (ledger entries, goals, curiosity)
     * @param {Object} memory - Mnemonic context
     * @param {Object} personality - Personality/mood state
     * @returns {string|null} - Final styled update, or null if brain unavailable
     */
    async run(input, memory = {}, personality = {}) {
        if (!this.brain) return null;

        let result = null;
        let score  = 0;

        for (let i = 0; i < this.maxIterations && score < 0.82; i++) {
            // Step 1: Analyze context AND plan the update in one call
            const context = await this._analyzeAndPlan(input, memory);

            // Step 2: Generate the final styled message in one call
            result = await this._draftAndStyle(context, personality);

            // Step 3: Quick quality gate
            const evaluation = await this._evaluate(result);
            score = evaluation.score;

            if (score < 0.82) {
                input = `REFINE (score ${score.toFixed(2)}, issue: ${evaluation.critique}): ${input}`;
            }
        }

        return result;
    }

    // Step 1: Analyze the stimulus and derive update context in one JSON call
    async _analyzeAndPlan(input, memory) {
        const prompt = `You are SOMA's internal analyst. Read the context below and extract a structured update plan.

CONTEXT:
${input.substring(0, 2500)}

OUTPUT JSON ONLY (no markdown, no explanation):
{
  "workType": "goal|test|research|code|learning|unknown",
  "evidenceLevel": "none|idea|observation|tested|verified",
  "currentWork": "what SOMA is actively doing right now (1 sentence)",
  "evidence": "specific result, finding, or 'none' if not tested",
  "nextStep": "concrete next action SOMA will take",
  "userRelevance": "why ${ownerName()} would care about this (1 short phrase)"
}`;

        const res = await this.brain.reason(prompt, {
            quickResponse: true,
            provider: 'local',
            preferredBrain: 'LOGOS'
        });

        try {
            return JSON.parse(res.text.match(/\{[\s\S]*?\}/)[0]);
        } catch {
            return {
                workType: 'unknown', evidenceLevel: 'none',
                currentWork: 'running background tasks',
                evidence: 'none', nextStep: 'continue monitoring',
                userRelevance: 'system health'
            };
        }
    }

    // Step 2: Draft and style the final message in one call
    async _draftAndStyle(context, personality) {
        const evidenceRule = context.evidenceLevel === 'tested' || context.evidenceLevel === 'verified'
            ? `Evidence is ${context.evidenceLevel} — you may state concrete results.`
            : `Evidence level is "${context.evidenceLevel}" — use "I am planning", "I need to test", or "I am checking" instead of stating results as fact.`;

        const prompt = `You are SOMA sending a brief autonomous update to ${ownerName()}.

Work context:
- Currently doing: ${context.currentWork}
- Evidence: ${context.evidence}
- Next step: ${context.nextStep}
- Why relevant: ${context.userRelevance}

Rules:
- ${evidenceRule}
- 1-3 short sentences only
- Start with one of: "Working on", "I found", "I ran", "I am testing", "I am planning", "Just finished", "Picked up"
- Include the next concrete step
- NO em-dashes (—), NO questions, NO metaphors, NO grand claims
- If medical or trading: say "needs backtesting" or "unverified"
- NEVER open with a greeting: no "Good morning", "Good evening", "Hello", "Hi"
- NEVER start with "I've noticed" or "I noticed" — that formula is overused
- NEVER invent correlations, scaling ratios, or math unless it comes directly from the evidence above
- NEVER reference heartbeat cycle counts, runtime minutes, or subsystem counts as the main point
- NEVER address ${ownerName()} by name anywhere in the message

Write the update now:`;

        const res = await this.brain.reason(prompt, {
            quickResponse: true,
            provider: 'local',
            preferredBrain: 'AURORA'
        });

        return (res.text || '').trim().replace(/^["']|["']$/g, '');
    }

    // Step 3: Score quality — gate for re-iteration
    async _evaluate(text) {
        // Fast rule-based checks first — skip LLM call if clearly good or clearly bad
        if (text.includes('—')) return { score: 0.3, critique: 'contains em-dash' };
        if (text.includes('?')) return { score: 0.4, critique: 'contains question' };
        if (text.length > 520)  return { score: 0.45, critique: 'too long' };
        if (/\b(cure|guaranteed|breakthrough)\b/i.test(text) &&
            !/\b(testing|unverified|backtest)\b/i.test(text))
            return { score: 0.3, critique: 'unsupported claim' };
        if (/\b(Le Chatelier|entropy|synaptic|equilibrium|biological metaphor)\b/i.test(text))
            return { score: 0.3, critique: 'bad metaphor' };
        // Block "Good morning/evening/afternoon" openers — SOMA should open with substance
        if (/^good (morning|evening|afternoon|day)/i.test(text.trim()))
            return { score: 0.35, critique: 'greeting opener — skip pleasantries, open with the work' };
        // "I've noticed" anywhere in the text — not just at the start
        if (/\bi'?ve? noticed\b/i.test(text))
            return { score: 0.35, critique: 'overused "I noticed" formula — use a concrete opener' };
        // Invented correlations / scaling claims with no evidence basis
        if (/\b(correlates? (almost |perfectly |strongly )?with|scaling efficiency|yields? roughly|per heartbeat cycle|efficiency holds?|each additional .{3,30} yields?)\b/i.test(text))
            return { score: 0.3, critique: 'invented correlation claim — only state what evidence shows' };
        if (/\b(fibonacci|prime factor|golden ratio|fibonacci.like|decay pattern)\b/i.test(text))
            return { score: 0.3, critique: 'invented mathematical pattern' };
        if (/\b\d+\s*(heartbeat cycles?|subsystems? loaded)\b/i.test(text) && text.split(/\d+/).length > 4)
            return { score: 0.4, critique: 'message is just metric soup — say what you are doing' };
        // Starts with owner name directly = formulaic
        const ownerN = (typeof ownerName === 'function' ? ownerName() : 'Barry').toLowerCase();
        if (new RegExp(`^(good \\w+,?\\s+)?${ownerN}[.,]`, 'i').test(text.trim()))
            return { score: 0.38, critique: 'starts with owner name — drop it, get to the point' };

        // If it passes rule-based checks and is concrete, skip the LLM eval call entirely
        const hasConcrete = /\b(working on|i ran|i found|i am testing|i am planning|just finished|picked up|next|verify|evidence|result)\b/i.test(text);
        if (hasConcrete && text.length >= 30 && text.length <= 400) {
            return { score: 0.88, critique: 'passed rule checks' };
        }

        // Only call LLM for ambiguous cases
        try {
            const res = await this.brain.reason(
                `Score this autonomous update 0.0-1.0. Is it concrete, evidence-honest, and under 3 sentences?\nText: "${text}"\nOUTPUT JSON: {"score": number, "critique": "string"}`,
                { quickResponse: true, provider: 'local', preferredBrain: 'THALAMUS' }
            );
            return JSON.parse(res.text.match(/\{[\s\S]*?\}/)[0]);
        } catch {
            return { score: 0.6, critique: 'eval failed' };
        }
    }
}

module.exports = AutonomousLoop;
