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
import crypto from 'crypto';

const router = express.Router();
const VISION_TEMP_DIR = path.join(process.cwd(), '.soma', 'vision_temp');
const SCENE_LIMIT = 50;
const sceneMemory = [];

function normalizeObjects(objects = []) {
    return (Array.isArray(objects) ? objects : [])
        .map(obj => ({
            label: String(obj?.label || obj?.name || obj?.class || 'unknown').toLowerCase(),
            score: Number.isFinite(obj?.score) ? obj.score : (Number.isFinite(obj?.confidence) ? obj.confidence : null),
            bbox: obj?.bbox || obj?.box || null,
        }))
        .filter(obj => obj.label && obj.label !== 'unknown');
}

function tokenizeText(text = '') {
    return String(text || '')
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter(word => word.length > 2)
        .slice(0, 120);
}

function diffScenes(previous, current) {
    if (!previous) {
        return {
            score: 1,
            summary: 'Initial scene captured.',
            stable: false,
            addedObjects: current.objects.map(obj => obj.label).slice(0, 8),
            removedObjects: [],
            addedText: tokenizeText(current.ocrText).slice(0, 12),
            removedText: [],
        };
    }

    const prevObjects = new Set(previous.objects.map(obj => obj.label));
    const curObjects = new Set(current.objects.map(obj => obj.label));
    const addedObjects = [...curObjects].filter(label => !prevObjects.has(label));
    const removedObjects = [...prevObjects].filter(label => !curObjects.has(label));

    const prevText = new Set(tokenizeText(previous.ocrText));
    const curText = new Set(tokenizeText(current.ocrText));
    const addedText = [...curText].filter(word => !prevText.has(word)).slice(0, 18);
    const removedText = [...prevText].filter(word => !curText.has(word)).slice(0, 18);

    const objectDelta = addedObjects.length + removedObjects.length;
    const textDelta = addedText.length + removedText.length;
    const channelChanged = previous.channel !== current.channel;
    const score = Math.min(1, (objectDelta * 0.18) + (textDelta * 0.035) + (channelChanged ? 0.35 : 0));

    let summary = 'Scene remains stable.';
    if (channelChanged) summary = `Vision channel changed from ${previous.channel} to ${current.channel}.`;
    else if (addedObjects.length) summary = `New visual signal: ${addedObjects.slice(0, 3).join(', ')}.`;
    else if (removedObjects.length) summary = `Visual signal disappeared: ${removedObjects.slice(0, 3).join(', ')}.`;
    else if (addedText.length) summary = `New readable text appeared: ${addedText.slice(0, 5).join(', ')}.`;

    return {
        score,
        summary,
        stable: score < 0.18,
        addedObjects: addedObjects.slice(0, 8),
        removedObjects: removedObjects.slice(0, 8),
        addedText,
        removedText,
    };
}

function addSceneMemory({ imagePath, channel = 'desktop', objects = [], ocrText = null, summary = null, source = 'vision', timestamp = Date.now(), engine = null }) {
    const normalized = {
        id: `scene-${timestamp}-${crypto.randomUUID()}`,
        timestamp,
        channel,
        imagePath,
        frameUrl: imagePath ? `/api/perception/vision/frame?path=${encodeURIComponent(imagePath)}` : null,
        objects: normalizeObjects(objects),
        ocrText: ocrText || '',
        summary: summary || 'Visual frame captured.',
        source,
        engine,
    };
    const previous = sceneMemory[0] || null;
    normalized.diff = diffScenes(previous, normalized);
    normalized.changeScore = normalized.diff.score;

    sceneMemory.unshift(normalized);
    if (sceneMemory.length > SCENE_LIMIT) sceneMemory.length = SCENE_LIMIT;

    global.__SOMA_SYSTEM = global.__SOMA_SYSTEM || {};
    global.__SOMA_SYSTEM.sceneMemory = sceneMemory;
    global.__SOMA_SYSTEM.visionContext = {
        channel: normalized.channel,
        imagePath: normalized.imagePath,
        objects: normalized.objects,
        ocrText: normalized.ocrText,
        summary: normalized.summary,
        lastChange: normalized.diff.summary,
        changeScore: normalized.changeScore,
        timestamp: normalized.timestamp,
    };

    return normalized;
}

function sceneSnapshot() {
    const latest = sceneMemory[0] || null;
    const lastChanged = sceneMemory.find(scene => scene.changeScore >= 0.18) || latest;
    return {
        latest,
        recent: sceneMemory.slice(0, 12),
        count: sceneMemory.length,
        stableForMs: latest && lastChanged ? Math.max(0, latest.timestamp - lastChanged.timestamp) : 0,
        lastChange: latest?.diff || null,
    };
}

function parseImagePayload(body = {}) {
    const raw = body.imageData || body.image || body.frameData || '';
    if (!raw || typeof raw !== 'string') throw new Error('imageData is required');
    const match = raw.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
    const mimeType = body.mimeType || match?.[1] || 'image/png';
    const base64 = match ? match[2] : raw;
    const ext = mimeType.includes('jpeg') || mimeType.includes('jpg') ? '.jpg'
        : mimeType.includes('webp') ? '.webp'
        : '.png';
    return { base64, mimeType, ext };
}

function saveImagePayload(body = {}) {
    const { base64, mimeType, ext } = parseImagePayload(body);
    fs.mkdirSync(VISION_TEMP_DIR, { recursive: true });
    const imagePath = path.join(VISION_TEMP_DIR, `perception-${Date.now()}-${crypto.randomUUID()}${ext}`);
    fs.writeFileSync(imagePath, Buffer.from(base64, 'base64'));
    return { imagePath, base64, mimeType };
}

async function analyzeWithAvailableVision({ imagePath, base64, mimeType, prompt, type }) {
    const sys = global.__SOMA_SYSTEM || {};
    const vision = sys.visionProcessing
        || sys.visionArbiter
        || sys.arbiters?.get?.('VisionProcessingArbiter')?.instance
        || sys.messageBroker?.arbiters?.get?.('VisionProcessingArbiter')?.instance;

    if (vision?.detectObjects) {
        try {
            const detected = await vision.detectObjects(imagePath, 0.35);
            if (detected?.success) {
                return {
                    engine: 'vision-processing',
                    result: detected.ocrText || `Detected ${detected.count || detected.objects?.length || 0} visual signals.`,
                    objects: detected.objects || [],
                    ocrText: detected.ocrText || null,
                    raw: detected,
                };
            }
        } catch {}
    }

    if (vision?.analyzeImage) {
        try {
            const analyzed = await vision.analyzeImage(base64, mimeType, { prompt });
            return {
                engine: 'vision-processing',
                result: analyzed.description || analyzed.result || analyzed.text || 'Image analyzed.',
                objects: analyzed.objects || [],
                ocrText: analyzed.ocrText || null,
                raw: analyzed,
            };
        } catch {
            try {
                const analyzed = await vision.analyzeImage(imagePath);
                return {
                    engine: 'vision-processing',
                    result: analyzed.description || analyzed.result || analyzed.text || 'Image analyzed.',
                    objects: analyzed.objects || [],
                    ocrText: analyzed.ocrText || null,
                    raw: analyzed,
                };
            } catch {}
        }
    }

    const brain = sys.quadBrain || sys.brain;
    if (brain?.reason) {
        const ask = prompt || `Analyze this image for ${type || 'visual reasoning'}. Be concise and useful.`;
        const response = await brain.reason(ask, { images: [imagePath], vision: true, mode: 'fast' });
        const text = response?.text || response?.response || String(response || '');
        return {
            engine: 'quad-brain',
            result: text,
            objects: [],
            ocrText: null,
            raw: response,
        };
    }

    throw new Error('No vision engine available. Set SOMA_LOAD_VISION=true or configure a multimodal provider.');
}

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

/**
 * POST /api/perception/analyze-image
 * Canonical image analysis endpoint for Pulse, Orb, and future Stage media.
 * Body: { imageData | image | frameData, mimeType?, type?, prompt? }
 */
router.post('/analyze-image', async (req, res) => {
    try {
        const { imagePath, base64, mimeType } = saveImagePayload(req.body || {});
        const type = req.body?.type || req.body?.analysisType || 'visual-reasoning';
        const prompt = req.body?.prompt || (
            type === 'ocr' ? 'Extract all visible text exactly. Preserve code, stack traces, and labels.'
            : type === 'ui-to-code' ? 'Analyze this UI screenshot and produce a concise implementation plan plus starter React/Tailwind code if appropriate.'
            : type === 'diagram-analysis' ? 'Analyze this diagram. Identify entities, relationships, and practical implications.'
            : 'Describe the image, important objects, visible text, and anything actionable.'
        );

        const analysis = await analyzeWithAvailableVision({ imagePath, base64, mimeType, prompt, type });
        const scene = addSceneMemory({
            imagePath,
            channel: req.body?.channel || 'upload',
            objects: analysis.objects || [],
            ocrText: analysis.ocrText || '',
            summary: analysis.result,
            source: type,
            engine: analysis.engine,
            timestamp: Date.now(),
        });
        res.json({
            success: true,
            type,
            imagePath,
            frameUrl: `/api/perception/vision/frame?path=${encodeURIComponent(imagePath)}`,
            result: analysis.result,
            analysis: analysis.result,
            objects: analysis.objects,
            ocrText: analysis.ocrText,
            engine: analysis.engine,
            scene,
            sceneMemory: sceneSnapshot(),
            raw: analysis.raw,
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

/**
 * POST /api/perception/vision/ingest-frame
 * Browser webcam ingestion path. Stores the latest browser-provided frame so
 * SOMA can preview/analyze camera input even when server-side capture is absent.
 */
router.post('/vision/ingest-frame', async (req, res) => {
    try {
        const { imagePath } = saveImagePayload(req.body || {});
        const vision = global.SOMA_COS?.visionDaemon;
        const payload = {
            success: true,
            objects: [{ label: 'webcam frame', score: 1, bbox: null }],
            count: 1,
            imagePath,
            channel: 'webcam',
            timestamp: Date.now(),
        };
        const scene = addSceneMemory({
            imagePath,
            channel: 'webcam',
            objects: payload.objects,
            ocrText: '',
            summary: 'Webcam frame captured.',
            source: req.body?.source || 'webcam',
            timestamp: payload.timestamp,
        });
        if (vision) {
            vision.channel = 'webcam';
            vision.lastPerception = { ...payload, scene };
            vision.perceptionCount = (vision.perceptionCount || 0) + 1;
        }
        res.json({ success: true, imagePath, timestamp: payload.timestamp, scene, sceneMemory: sceneSnapshot() });
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
                metrics:       vision?.metrics || {},
                sceneMemory:   sceneSnapshot()
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
        if (!vision && !sceneMemory.length) return res.status(503).json({ success: false, error: 'VisionDaemon not loaded' });
        const latestScene = sceneMemory[0] || null;

        res.json({
            success: true,
            channel: vision?.channel || latestScene?.channel || 'desktop',
            lastPerception: vision?.lastPerception || latestScene,
            // imagePath at top level for easy access (also lives inside lastPerception after fix)
            imagePath: vision?.lastPerception?.imagePath || latestScene?.imagePath || null,
            ghostCursor: vision?.ghostCursor || null,
            sceneMemory: sceneSnapshot(),
            timestamp: Date.now()
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

/**
 * GET /api/perception/vision/scenes
 * Rolling scene memory buffer used by Presence.
 */
router.get('/vision/scenes', (req, res) => {
    res.json({ success: true, sceneMemory: sceneSnapshot() });
});

/**
 * GET /api/perception/vision/what-changed
 * Concise summary of the latest scene transition.
 */
router.get('/vision/what-changed', (req, res) => {
    const snapshot = sceneSnapshot();
    const latest = snapshot.latest;
    if (!latest) {
        return res.json({
            success: true,
            summary: 'No scene memory yet.',
            confidence: 0,
            sceneMemory: snapshot,
        });
    }

    const diff = latest.diff || {};
    const confidence = Math.max(0.25, Math.min(0.95, 0.55 + (latest.changeScore || 0) * 0.4));
    res.json({
        success: true,
        summary: diff.summary || 'Scene remains stable.',
        confidence,
        changeScore: latest.changeScore || 0,
        stableForMs: snapshot.stableForMs,
        addedObjects: diff.addedObjects || [],
        removedObjects: diff.removedObjects || [],
        addedText: diff.addedText || [],
        removedText: diff.removedText || [],
        latest,
        sceneMemory: snapshot,
    });
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
