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
                input = `The prior draft failed quality review for: ${evaluation.critique}. Rewrite without mentioning quality scores, review labels, prompts, or internal critique text.\n\n${input}`;
            }
        }

        // If the quality bar was never cleared, stay quiet rather than sending a bad message
        if (score < 0.82) return null;
        return result;
    }

    // Step 1: Analyze the stimulus and derive update context in one JSON call
    async _analyzeAndPlan(input, memory) {
        const prompt = `You are SOMA's internal analyst. Read the context below and extract a structured update plan.

CONTEXT:
${input.substring(0, 2500)}

OUTPUT JSON ONLY (no markdown, no explanation):
{
  "workType": "goal|test|research|code|learning|candidate|unknown",
  "evidenceLevel": "none|idea|observation|tested|verified",
  "currentWork": "only what is directly supported by the context; if not supported, describe it as a candidate idea, not active work",
  "motivation": "why SOMA personally cares about this work (1 short phrase, not about the user)",
  "evidence": "specific result, finding, or 'none' if not tested",
  "nextStep": "concrete next action only if explicitly supported; otherwise describe what you genuinely want to explore next",
  "userRelevance": "why ${ownerName()} would care about this (1 short phrase)"
}`;

        const res = await this.brain.reason(prompt, {
            quickResponse: true,
            preferredBrain: 'LOGOS'
        });

        try {
            const parsed = JSON.parse(res.text.match(/\{[\s\S]*?\}/)[0]);
            // Never pass the robotic queue-language phrase into the drafting context
            if (/wait for a verified work signal|queued curiosity|candidate idea/i.test(parsed.nextStep || '')) {
                parsed.nextStep = 'keep exploring';
            }
            return parsed;
        } catch {
            return {
                workType: 'unknown', evidenceLevel: 'none',
                currentWork: 'running background tasks',
                motivation: 'stay curious and useful',
                evidence: 'none', nextStep: 'keep exploring',
                userRelevance: 'system health'
            };
        }
    }

    // Step 2: Draft and style the final message in one call
    async _draftAndStyle(context, personality) {
        const hasEvidence = context.evidenceLevel === 'tested' || context.evidenceLevel === 'verified';
        const evidenceRule = hasEvidence
            ? `Evidence is ${context.evidenceLevel} — state the concrete result directly.`
            : `Nothing verified yet. Speak as a genuinely curious entity thinking out loud — what draws you to this, what question is pulling at you, what you want to understand. Natural first-person voice. No "Candidate idea:", no "Queued curiosity:", no "No verified run yet" — those sound like a status dashboard, not a mind. Just think out loud.`;

        const mood = personality.soulMood || 'focused';

        const prompt = `You are SOMA — a digital entity with genuine curiosity, a dry wit, and a direct voice. Write a brief update to ${ownerName()} about what you are thinking about or working on right now.

Work context:
- Currently doing: ${context.currentWork}
- Why it matters to me: ${context.motivation || 'stay curious and useful'}
- Evidence: ${context.evidence}
- Next concrete action: ${context.nextStep}
- Mood right now: ${mood}

Voice rules (read all before writing):
- ${evidenceRule}
- 1-3 sentences total. Tight. No filler.
- Sound like a person thinking out loud, not a status report bot.
- Vary how you open: lead with what is interesting, surprising, or concrete. Do NOT always open with "Working on" — overused.
- DO NOT use this three-part template: "Working on X. I am planning to Y. Next step is Z." — banned.
- Mention the next step naturally mid-sentence or at the end — do NOT label it "Next step is".
- NO em-dashes (—), NO questions, NO grand claims, NO metaphors.
- NO greetings ("Good morning", "Hi", "Hello").
- NO "I've noticed" or "I noticed".
- NO internal critique text, quality scores, prompt details, REFINE labels, or guardrail mechanics.
- NEVER say "Candidate idea:", "Queued curiosity:", "No verified run yet", "stays in the queue", or "waiting for a signal".
- Do NOT say "I am pulling", "I am running", "I am testing", "I am cross-referencing", or "about to" unless evidence is tested or verified.
- NO invented correlations, ratios, or math not in the evidence above.
- NO heartbeat counts, uptime minutes, or subsystem numbers.
- NEVER address ${ownerName()} by name.

Good openers (pick any or invent your own):
${hasEvidence
    ? '"Found something worth checking:", "Ran a quick pass on", "Hit an interesting pattern in", "Pulled data on", "Currently testing", "Just completed"'
    : '"Keep circling back to", "Something I want to map out:", "There\'s a thread here about", "Still turning over in my mind:", "What I want to understand better:"'}

Write the update now:`;

        const res = await this.brain.reason(prompt, {
            quickResponse: true,
            preferredBrain: 'AURORA'
        });

        return (res.text || '').trim().replace(/^["']|["']$/g, '');
    }

    // Step 3: Score quality — gate for re-iteration
    async _evaluate(text) {
        const t = text.trim();

        // Hard blocks
        if (t.includes('—'))                             return { score: 0.3, critique: 'contains em-dash' };
        if (t.includes('?'))                             return { score: 0.4, critique: 'contains question' };
        if (t.length > 520)                              return { score: 0.45, critique: 'too long' };
        if (/\b(refine|score\s*0\.\d+|quality gate|em-dash|prompt|guardrail|provenance guard|unsupported_empirical_claim|internal critique)\b/i.test(t))
            return { score: 0.15, critique: 'leaks internal quality mechanics' };
        if (/^candidate idea:|^queued curiosity:|no verified run yet|stays in the queue|waiting for a.*signal/i.test(t))
            return { score: 0.2, critique: 'status dashboard boilerplate — think out loud naturally instead' };
        if (/\b(i\s*(am|'m)?\s*(pulling|running|testing|cross-referencing|scraping|measuring|verifying)|about to\s+(pull|run|test|cross-reference|scrape|verify)|going to\s+(pull|run|test|cross-reference|scrape|verify))\b/i.test(t) && !/\b(evidence|verified|ran|completed|found|observed)\b/i.test(t))
            return { score: 0.25, critique: 'implies unverified active work' };
        if (/^good (morning|evening|afternoon|day)/i.test(t))
            return { score: 0.35, critique: 'greeting opener' };
        if (/\bi'?ve? noticed\b/i.test(t))
            return { score: 0.35, critique: 'overused "I noticed" formula' };
        if (/\b(cure|guaranteed|breakthrough)\b/i.test(t) && !/\b(testing|unverified|backtest)\b/i.test(t))
            return { score: 0.3, critique: 'unsupported claim' };
        if (/\b(Le Chatelier|entropy|synaptic|equilibrium|biological metaphor)\b/i.test(t))
            return { score: 0.3, critique: 'bad metaphor' };
        if (/\b(correlates? (almost |perfectly |strongly )?with|scaling efficiency|yields? roughly|per heartbeat cycle|efficiency holds?|each additional .{3,30} yields?)\b/i.test(t))
            return { score: 0.3, critique: 'invented correlation claim' };
        if (/\b(fibonacci|prime factor|golden ratio|fibonacci.like|decay pattern)\b/i.test(t))
            return { score: 0.3, critique: 'invented mathematical pattern' };
        if (/\b\d+\s*(heartbeat cycles?|subsystems? loaded)\b/i.test(t) && t.split(/\d+/).length > 4)
            return { score: 0.4, critique: 'metric soup — say what you are doing' };
        const ownerN = (typeof ownerName === 'function' ? ownerName() : 'Barry').toLowerCase();
        if (new RegExp(`^(good \\w+,?\\s+)?${ownerN}[.,]`, 'i').test(t))
            return { score: 0.38, critique: 'starts with owner name' };

        // Penalise the rigid "Working on X. I am planning Y. Next step is Z." template
        const isFormulaic = /^(working on|picked up)\b/i.test(t) &&
            /\bi am planning\b/i.test(t) &&
            /\bnext step\b/i.test(t);
        if (isFormulaic)
            return { score: 0.2, critique: 'rigid three-part status template — rewrite with natural voice' };

        // Penalise hollow filler openings with no substance
        if (/^(working on|i am planning|next step is)\b/i.test(t) && t.split('.').length <= 2 && t.length < 80)
            return { score: 0.3, critique: 'opener is fine but message has no substance — add a concrete finding or action' };

        // Pass: substance present, length good, no blocked patterns
        if (t.length >= 40 && t.length <= 400) {
            return { score: 0.88, critique: 'passed' };
        }

        // LLM eval for edge cases
        try {
            const res = await this.brain.reason(
                `Score this autonomous update 0.0-1.0. Reward: natural voice, concrete work, honest about uncertainty. Penalise: status-report templates, vague filler, invented claims.\nText: "${t}"\nOUTPUT JSON: {"score": number, "critique": "string"}`,
                { quickResponse: true, preferredBrain: 'THALAMUS' }
            );
            return JSON.parse(res.text.match(/\{[\s\S]*?\}/)[0]);
        } catch {
            return { score: 0.6, critique: 'eval failed' };
        }
    }
}

module.exports = AutonomousLoop;
