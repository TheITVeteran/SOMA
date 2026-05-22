/**
 * server/core/CostLedger.js
 *
 * Tracks API token spend per actor/action with daily/monthly budget caps.
 * Graceful degradation: when budget is exhausted, returns { blocked: true }
 * so callers can fall back to local models rather than surprise $10K bills.
 *
 * Pricing (per 1M tokens, approximate):
 *   DeepSeek-chat:     $0.14 in / $0.28 out
 *   DeepSeek-reasoner: $0.55 in / $2.19 out
 *   Ollama (local):    $0
 */

import fs from 'fs';
import path from 'path';

const DATA_PATH = path.join(process.cwd(), 'data', 'cost-ledger.json');

const PRICE_PER_1M = {
    'deepseek-chat':     { in: 0.14, out: 0.28 },
    'deepseek-reasoner': { in: 0.55, out: 2.19 },
    'ollama':            { in: 0,    out: 0 },
    'local':             { in: 0,    out: 0 },
    'default':           { in: 0.14, out: 0.28 },
};

function todayKey() {
    return new Date().toISOString().slice(0, 10);
}
function monthKey() {
    return new Date().toISOString().slice(0, 7);
}

class CostLedger {
    constructor() {
        this.data = this._load();
        // Default caps — override via SOMA_DAILY_BUDGET_USD / SOMA_MONTHLY_BUDGET_USD
        this.dailyCap   = parseFloat(process.env.SOMA_DAILY_BUDGET_USD   || '5.00');
        this.monthlyCap = parseFloat(process.env.SOMA_MONTHLY_BUDGET_USD || '50.00');
    }

    _load() {
        try {
            if (fs.existsSync(DATA_PATH)) return JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));
        } catch {}
        return { daily: {}, monthly: {}, entries: [] };
    }

    _save() {
        try {
            fs.mkdirSync(path.dirname(DATA_PATH), { recursive: true });
            // Keep last 1000 entries to prevent unbounded growth
            this.data.entries = (this.data.entries || []).slice(-1000);
            fs.writeFileSync(DATA_PATH, JSON.stringify(this.data, null, 2));
        } catch {}
    }

    /**
     * Record a model call and return cost info.
     * @param {object} opts
     * @param {string} opts.model        — model name (deepseek-chat, deepseek-reasoner, ollama, etc.)
     * @param {number} opts.inputTokens
     * @param {number} opts.outputTokens
     * @param {string} opts.actor        — who triggered this call (sessionId, arbiter name, etc.)
     * @param {string} opts.action       — what it was for (chat, backtest_analysis, goal_execution, etc.)
     * @returns {{ cost: number, dailyTotal: number, monthlyTotal: number, blocked: false }}
     */
    record({ model = 'default', inputTokens = 0, outputTokens = 0, actor = 'SOMA', action = 'unknown' } = {}) {
        const pricing = PRICE_PER_1M[model] || PRICE_PER_1M.default;
        const cost = (inputTokens / 1_000_000) * pricing.in + (outputTokens / 1_000_000) * pricing.out;

        const today = todayKey();
        const month = monthKey();

        this.data.daily[today]   = (this.data.daily[today]   || 0) + cost;
        this.data.monthly[month] = (this.data.monthly[month] || 0) + cost;

        this.data.entries.push({
            ts: new Date().toISOString(),
            model, actor, action,
            inputTokens, outputTokens,
            cost: parseFloat(cost.toFixed(6))
        });

        this._save();

        return {
            cost: parseFloat(cost.toFixed(6)),
            dailyTotal:   parseFloat(this.data.daily[today].toFixed(4)),
            monthlyTotal: parseFloat(this.data.monthly[month].toFixed(4)),
            blocked: false
        };
    }

    /**
     * Check if a call should be blocked before making it.
     * Returns true if daily or monthly budget is exhausted.
     */
    isBlocked(model = 'default') {
        const pricing = PRICE_PER_1M[model] || PRICE_PER_1M.default;
        if (pricing.in === 0 && pricing.out === 0) return false; // Local model — always free
        const today = todayKey();
        const month = monthKey();
        const daily   = this.data.daily[today]   || 0;
        const monthly = this.data.monthly[month] || 0;
        return daily >= this.dailyCap || monthly >= this.monthlyCap;
    }

    getStatus() {
        const today = todayKey();
        const month = monthKey();
        const dailySpent   = parseFloat((this.data.daily[today]   || 0).toFixed(4));
        const monthlySpent = parseFloat((this.data.monthly[month] || 0).toFixed(4));
        return {
            dailySpent,
            monthlySpent,
            dailyCap:    this.dailyCap,
            monthlyCap:  this.monthlyCap,
            dailyPct:    Math.round((dailySpent   / this.dailyCap)   * 100),
            monthlyPct:  Math.round((monthlySpent / this.monthlyCap) * 100),
            blocked:     dailySpent >= this.dailyCap || monthlySpent >= this.monthlyCap,
            recentCalls: (this.data.entries || []).slice(-20).reverse()
        };
    }

    // Aggregate by actor for cost attribution dashboards
    getByActor(since = null) {
        const cutoff = since ? new Date(since).getTime() : 0;
        const entries = (this.data.entries || []).filter(e => new Date(e.ts).getTime() >= cutoff);
        return entries.reduce((acc, e) => {
            acc[e.actor] = (acc[e.actor] || 0) + e.cost;
            return acc;
        }, {});
    }
}

export const costLedger = new CostLedger();
export default costLedger;
