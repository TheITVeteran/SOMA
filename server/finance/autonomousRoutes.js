/**
 * Autonomous Trading API Routes
 * Supports running multiple symbols concurrently via a per-symbol instance registry.
 * Each symbol gets its own AutonomousTrader instance with independent state.
 */

import express from 'express';
import { AutonomousTrader, _setPerformanceCacheFlush } from './autonomousTrader.js';

const router = express.Router();

// Registry: symbol (uppercased) → AutonomousTrader instance
const _registry = new Map();

// Cache per symbol + aggregate
const _cache = new Map();
const CACHE_TTL = 2000;

function cached(key, ttlMs, compute) {
    const now = Date.now();
    const hit = _cache.get(key);
    if (hit && (now - hit.ts) < ttlMs) return hit.body;
    const body = compute();
    _cache.set(key, { body, ts: now });
    return body;
}

function flushCache(symbol) {
    if (symbol) {
        _cache.delete(`status_${symbol}`);
        _cache.delete(`decisions_${symbol}`);
    }
    _cache.delete('status_all');
    _cache.delete('decisions_all');
}

/** Called by routes.js after performance routes load — wires all instances to the same flush */
export function flushStatusCache() {
    flushCache();
}

function getOrCreateInstance(symbol) {
    const key = symbol.toUpperCase();
    if (!_registry.has(key)) {
        _registry.set(key, new AutonomousTrader());
    }
    return _registry.get(key);
}

/**
 * POST /api/autonomous/start
 * Start autonomous trading for a symbol. Multiple symbols can run concurrently.
 * Body: { symbol, preset?, config? }
 */
router.post('/start', async (req, res) => {
    try {
        const { symbol, preset, config } = req.body;
        if (!symbol) return res.status(400).json({ success: false, error: 'symbol is required' });

        const sym = symbol.toUpperCase();
        const existing = _registry.get(sym);
        if (existing?.isRunning) {
            return res.status(400).json({ success: false, error: `${sym} is already trading. Stop it first.` });
        }

        const instance = getOrCreateInstance(sym);
        const result = await instance.start(sym, preset, config || {});

        if (!result.success) return res.status(400).json(result);
        flushCache(sym);
        res.json({ ...result, symbol: sym, runningSymbols: [..._registry.keys()].filter(k => _registry.get(k).isRunning) });
    } catch (error) {
        console.error('[Autonomous API] Start error:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * POST /api/autonomous/stop
 * Stop autonomous trading for a symbol (or all symbols if no symbol given).
 * Body: { symbol? }
 */
router.post('/stop', (req, res) => {
    try {
        const { symbol } = req.body || {};

        if (symbol) {
            const sym = symbol.toUpperCase();
            const instance = _registry.get(sym);
            if (!instance) return res.status(404).json({ success: false, error: `${sym} not found in registry` });
            const result = instance.stop();
            _registry.delete(sym);
            flushCache(sym);
            return res.json({ ...result, symbol: sym, runningSymbols: [..._registry.keys()].filter(k => _registry.get(k).isRunning) });
        }

        // Stop all
        const stopped = [];
        for (const [sym, instance] of _registry) {
            instance.stop();
            stopped.push(sym);
        }
        _registry.clear();
        flushCache();
        res.json({ success: true, stopped, message: `Stopped ${stopped.length} trader(s)` });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * GET /api/autonomous/status
 * Get status of all running traders (or a specific one via ?symbol=SPY)
 */
router.get('/status', (req, res) => {
    try {
        const sym = req.query.symbol?.toUpperCase();

        if (sym) {
            const instance = _registry.get(sym);
            if (!instance) return res.json({ success: true, isRunning: false, symbol: sym });
            const body = cached(`status_${sym}`, CACHE_TTL, () => ({ success: true, symbol: sym, ...instance.getStatus() }));
            return res.json(body);
        }

        // Aggregate all
        const body = cached('status_all', CACHE_TTL, () => {
            const instances = [..._registry.entries()].map(([sym, inst]) => ({
                symbol: sym,
                ...inst.getStatus()
            }));
            const anyRunning = instances.some(i => i.isRunning);
            const primaryInstance = instances.find(i => i.isRunning) || instances[0];
            return {
                success: true,
                // Legacy single-trader fields (first running instance) for backward compat
                ...(primaryInstance || { isRunning: false }),
                // Multi-symbol extension
                instances,
                runningCount: instances.filter(i => i.isRunning).length,
                runningSymbols: instances.filter(i => i.isRunning).map(i => i.symbol),
            };
        });
        res.json(body);
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * GET /api/autonomous/decisions
 * Decision log — all instances merged and sorted by time, or ?symbol=SPY for one.
 * Query: ?limit=50&symbol=SPY
 */
router.get('/decisions', (req, res) => {
    try {
        const limit = parseInt(req.query.limit || 50);
        const sym = req.query.symbol?.toUpperCase();

        if (sym) {
            const instance = _registry.get(sym);
            if (!instance) return res.json({ success: true, decisions: [], count: 0, symbol: sym });
            const body = cached(`decisions_${sym}_${limit}`, CACHE_TTL, () => {
                const decisions = instance.getDecisions(limit).map(d => ({ ...d, symbol: sym }));
                return { success: true, decisions, count: decisions.length, symbol: sym };
            });
            return res.json(body);
        }

        // Merge from all instances
        const body = cached(`decisions_all_${limit}`, CACHE_TTL, () => {
            const all = [];
            for (const [sym, instance] of _registry) {
                const decisions = instance.getDecisions(limit);
                decisions.forEach(d => all.push({ ...d, symbol: sym }));
            }
            // Sort by timestamp descending, take top limit
            all.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
            const decisions = all.slice(0, limit);
            return { success: true, decisions, count: decisions.length };
        });
        res.json(body);
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * PUT /api/autonomous/config
 * Update config for a running symbol (or all if no symbol)
 * Body: { symbol?, ...configFields }
 */
router.put('/config', (req, res) => {
    try {
        const { symbol, ...config } = req.body || {};
        if (symbol) {
            const instance = _registry.get(symbol.toUpperCase());
            if (!instance) return res.status(404).json({ success: false, error: `${symbol} not in registry` });
            return res.json({ success: true, config: instance.updateConfig(config) });
        }
        // Apply to all
        const results = {};
        for (const [sym, instance] of _registry) {
            results[sym] = instance.updateConfig(config);
        }
        res.json({ success: true, configs: results });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * POST /api/autonomous/start-portfolio
 * Start multiple symbols concurrently with capital split evenly across them.
 * Body: { symbols: ['BTC/USD','ETH/USD','SPY'], preset?, totalCapital?, config? }
 * Already-running symbols are skipped (not restarted).
 */
router.post('/start-portfolio', async (req, res) => {
    try {
        const { symbols, preset, totalCapital = 100000, config = {} } = req.body;
        if (!Array.isArray(symbols) || symbols.length === 0) {
            return res.status(400).json({ success: false, error: 'symbols array is required' });
        }

        const perSymbolCapital = Math.floor(totalCapital / symbols.length);
        const results = [];
        const errors = [];

        for (const raw of symbols) {
            const sym = raw.toUpperCase();
            const existing = _registry.get(sym);
            if (existing?.isRunning) {
                results.push({ symbol: sym, status: 'skipped', reason: 'already running' });
                continue;
            }
            try {
                const instance = getOrCreateInstance(sym);
                const result = await instance.start(sym, preset, {
                    ...config,
                    initialBalance: perSymbolCapital,
                    // Tighten position size so each symbol can't blow the whole allocation
                    maxPositionPct: Math.min(config.maxPositionPct || 0.10, 0.10),
                });
                flushCache(sym);
                results.push({ symbol: sym, status: result.success ? 'started' : 'error', ...result });
                if (!result.success) errors.push(sym);
            } catch (err) {
                results.push({ symbol: sym, status: 'error', error: err.message });
                errors.push(sym);
            }
        }

        const runningSymbols = [..._registry.keys()].filter(k => _registry.get(k).isRunning);
        res.json({
            success: errors.length < symbols.length,
            perSymbolCapital,
            totalCapital,
            results,
            runningSymbols,
            errors: errors.length > 0 ? errors : undefined,
        });
    } catch (error) {
        console.error('[Autonomous API] start-portfolio error:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * GET /api/autonomous/registry
 * List all registered symbols and their running state
 */
router.get('/registry', (req, res) => {
    try {
        const entries = [..._registry.entries()].map(([sym, inst]) => ({
            symbol: sym,
            isRunning: inst.isRunning,
            preset: inst.preset,
            paperMode: inst.paperMode,
            startedAt: inst._stats?.sessionStartTime || null,
        }));
        res.json({ success: true, count: entries.length, traders: entries });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

export default router;
