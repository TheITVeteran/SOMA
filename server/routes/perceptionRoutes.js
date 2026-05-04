/**
 * server/routes/perceptionRoutes.js
 *
 * Exposes SOMA's Perception Layer to the frontend:
 *   GET    /api/perception/health    — capability map + web watch list + attention state
 *   POST   /api/perception/watch     — add a URL to the web watchdog
 *   DELETE /api/perception/watch     — remove a URL from the web watchdog
 *   POST   /api/perception/focus     — manually shift AttentionArbiter focus
 */

import express from 'express';

import path from 'path';
import fs from 'fs';

const router = express.Router();
const VISION_TEMP_DIR = path.join(process.cwd(), '.soma', 'vision_temp');

/**
 * GET /api/perception/vision/frame?path=<encoded_path>
 * Serves a captured image frame for frontend preview
 */
router.get('/vision/frame', (req, res) => {
    try {
        const framePath = req.query.path;
        if (!framePath) return res.status(400).json({ success: false, error: 'Path required' });

        // Security: ensure path is within vision_temp
        const resolved = path.resolve(framePath);
        if (!resolved.startsWith(VISION_TEMP_DIR)) {
            return res.status(403).json({ success: false, error: 'Access denied outside vision_temp' });
        }

        if (!fs.existsSync(resolved)) {
            return res.status(404).json({ success: false, error: 'Frame not found' });
        }

        res.sendFile(resolved);
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// 10s cache on /health — capability probes run every 60s so sub-10s staleness is fine
let _healthCache = null;
let _healthCacheTs = 0;
const HEALTH_TTL = 10000;

/**
 * GET /api/perception/health
 * Returns: full perception layer snapshot — daemons, arbiters, attention, signals, memory
 */
router.get('/health', (req, res) => {
    try {
        // --- FORCE CACHE CLEAR FOR DIAGNOSTICS ---
        _healthCache = null;

        const now = Date.now();
        if (_healthCache && (now - _healthCacheTs) < HEALTH_TTL) {
            return res.json(_healthCache);
        }

        const capDaemon = global.SOMA_COS?.capabilityDaemon;
        const webDaemon = global.SOMA_COS?.webPerceptionDaemon;
        const vision    = global.SOMA_COS?.visionDaemon;
        const attention = global.SOMA_COS?.attentionArbiter;

        // Pull from system object (set as global by bootstrap)
        const sys           = global.__SOMA_SYSTEM || {};
        const daemonManager = sys.daemonManager;
        const broker        = sys.messageBroker;
        const attArbiter    = sys.attentionArbiter || attention;

        // ── Daemon layer ────────────────────────────────────────────────────
        let daemonList = [];
        try {
            const raw = daemonManager?.health?.() || [];
            daemonList = raw.map(d => ({
                name:     d.name     || 'unknown',
                status:   d.active   ? 'active' : (d.shouldBeRunning ? 'crashed' : 'stopped'),
                restarts: d.restartCount ?? 0,
                lastSeen: d.lastSeen ?? null,
            }));
        } catch { /* non-fatal */ }

        const daemonActive  = daemonList.filter(d => d.status === 'active').length;
        const daemonCrashed = daemonList.filter(d => d.status === 'crashed').length;

        // ── Arbiter layer ───────────────────────────────────────────────────
        let arbiterTotal = 0;
        const lobes = { LOGOS: 0, AURORA: 0, THALAMUS: 0, PROMETHEUS: 0, unlobed: 0 };
        try {
            arbiterTotal = broker?.arbiters?.size ?? 0;
            for (const lobe of ['LOGOS', 'AURORA', 'THALAMUS', 'PROMETHEUS']) {
                const s = broker?.lobeIndex?.get?.(lobe);
                lobes[lobe] = s ? s.size : 0;
            }
            const lobed = lobes.LOGOS + lobes.AURORA + lobes.THALAMUS + lobes.PROMETHEUS;
            lobes.unlobed = Math.max(0, arbiterTotal - lobed);
        } catch { /* non-fatal */ }

        // ── Attention layer ─────────────────────────────────────────────────
        const attentionFocus = attArbiter?.currentFocus ?? attArbiter?.focusTopic ?? null;

        // ── Signal / broker stats ───────────────────────────────────────────
        let brokerStats = {};
        let recentCount = 0;
        try {
            brokerStats = broker?.getMetrics?.() ?? {};
            recentCount = brokerStats.historySize ?? broker?.messageHistory?.length ?? 0;
        } catch { /* non-fatal */ }

        // ── Memory ──────────────────────────────────────────────────────────
        const mem = process.memoryUsage();
        const heapMB    = Math.round(mem.heapUsed  / 1024 / 1024);
        const heapMaxMB = Math.round(mem.heapTotal  / 1024 / 1024);

        const body = {
            success: true,
            // ── New structured perception snapshot ──
            daemons: {
                total:   daemonList.length,
                active:  daemonActive,
                crashed: daemonCrashed,
                list:    daemonList,
            },
            arbiters: {
                total: arbiterTotal,
                lobes,
            },
            attention: {
                focus:  attentionFocus,
                engine: attArbiter ? 'active' : 'missing',
            },
            signals: {
                recentCount,
                brokerStats,
            },
            memory: {
                heapMB,
                heapMaxMB,
            },
            // ── Legacy fields (kept for backward compat) ──
            capabilities: capDaemon?.getCapabilityMap?.() ?? { note: 'CapabilityDiscoveryDaemon not loaded yet' },
            watchlist:    webDaemon?.getWatchList?.()    ?? {},
            vision: {
                active:        !!vision?.active,
                channel:       vision?.channel || 'desktop',
                lastPerception: vision?.lastPerception || null,
                metrics:       vision?.metrics || {}
            },
            timestamp: now
        };

        _healthCache   = body;
        _healthCacheTs = now;
        res.json(body);
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

/**
 * POST /api/perception/watch
 * Body: { url, label?, selector? }
 * Adds a URL to the WebPerceptionDaemon watch list
 */
router.post('/watch', (req, res) => {
    try {
        const { url, label, selector } = req.body;
        if (!url) return res.status(400).json({ success: false, error: 'url is required' });

        const webDaemon = global.SOMA_COS?.webPerceptionDaemon;
        if (!webDaemon) {
            return res.status(503).json({ success: false, error: 'WebPerceptionDaemon not loaded' });
        }

        webDaemon.addWatch(url, { label, selector });
        _healthCache = null; // flush perception cache

        res.json({
            success: true,
            message: `Now watching: ${label || url}`,
            watchlist: webDaemon.getWatchList()
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

/**
 * DELETE /api/perception/watch
 * Body: { url }
 * Removes a URL from the WebPerceptionDaemon watch list
 */
router.delete('/watch', (req, res) => {
    try {
        const { url } = req.body;
        if (!url) return res.status(400).json({ success: false, error: 'url is required' });

        const webDaemon = global.SOMA_COS?.webPerceptionDaemon;
        if (!webDaemon) {
            return res.status(503).json({ success: false, error: 'WebPerceptionDaemon not loaded' });
        }

        webDaemon.removeWatch(url);
        _healthCache = null;

        res.json({ success: true, message: `Stopped watching: ${url}` });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

/**
 * POST /api/perception/focus
 * Body: { topic, durationMs? }
 * Manually shift AttentionArbiter focus
 */
router.post('/focus', (req, res) => {
    try {
        const { topic, durationMs = 300000 } = req.body;
        if (!topic) return res.status(400).json({ success: false, error: 'topic is required' });

        const attention = global.SOMA_COS?.attentionArbiter;
        if (!attention) {
            return res.status(503).json({ success: false, error: 'AttentionArbiter not loaded' });
        }

        attention.setFocus(topic, durationMs);
        _healthCache = null;

        res.json({
            success: true,
            message: `Focus shifted to: ${topic} for ${Math.round(durationMs / 1000)}s`
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

/**
 * POST /api/perception/vision/channel
 * Body: { channel } - 'desktop' | 'webcam'
 */
router.post('/vision/channel', (req, res) => {
    try {
        const { channel } = req.body;
        if (!['desktop', 'webcam'].includes(channel)) {
            return res.status(400).json({ success: false, error: 'Invalid channel' });
        }

        const vision = global.SOMA_COS?.visionDaemon;
        if (!vision) return res.status(503).json({ success: false, error: 'VisionDaemon not loaded' });

        vision.setChannel(channel);
        res.json({ success: true, channel });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

/**
 * GET /api/perception/vision/last
 * Returns the latest frame and analysis from the VisionDaemon
 */
router.get('/vision/last', (req, res) => {
    try {
        const vision = global.SOMA_COS?.visionDaemon;
        if (!vision) return res.status(503).json({ success: false, error: 'VisionDaemon not loaded' });

        res.json({
            success: true,
            channel: vision.channel,
            lastPerception: vision.lastPerception,
            // imagePath at top level for easy access (also lives inside lastPerception after fix)
            imagePath: vision.lastPerception?.imagePath || null,
            ghostCursor: vision.ghostCursor,
            timestamp: Date.now()
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

/**
 * POST /api/perception/garden/sprout
 * Trigger the Sprout Loop (SelfReflectionArbiter)
 */
router.post('/garden/sprout', async (req, res) => {
    try {
        const reflection = global.SOMA_COS?.reflectionArbiter;
        if (!reflection || !reflection.sprout) {
            return res.status(503).json({ success: false, error: 'SelfReflectionArbiter not loaded or missing sprout method' });
        }
        await reflection.sprout();
        res.json({ success: true, message: 'Sprout initiated' });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

/**
 * POST /api/perception/garden/audit
 * Trigger Nutrient Check (SelfEvolvingGoalEngine)
 */
router.post('/garden/audit', async (req, res) => {
    try {
        const sys = global.__SOMA_SYSTEM || {};
        console.log('[Debug] System Keys:', Object.keys(sys));
        
        const engine = sys.selfEvolvingGoalEngine;
        if (!engine || !engine.checkLibraryNutrients) {
            return res.status(503).json({ 
                success: false, 
                error: 'SelfEvolvingGoalEngine not loaded or missing checkLibraryNutrients',
                available: Object.keys(sys)
            });
        }
        await engine.checkLibraryNutrients();
        res.json({ success: true, message: 'Nutrient audit initiated' });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

export default router;
