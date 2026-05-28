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
const REFLECTIONS_DIR = path.join(process.cwd(), 'data', 'vault', 'reflections');
const RETENTION_MANIFEST = path.join(process.cwd(), '.soma', 'vision_retention.json');
const RAW_RETENTION_DAYS = Number(process.env.SOMA_VISION_RAW_RETENTION_DAYS || 7);
const RAW_CACHE_LIMIT_MB = Number(process.env.SOMA_VISION_CACHE_LIMIT_MB || 2048);
let lastRetentionSweep = 0;

const REDACTION_PATTERNS = [
    { type: 'api_key', re: /\b(sk-[A-Za-z0-9_-]{12,}|[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,})\b/g },
    { type: 'secret_assignment', re: /\b(api[_-]?key|token|secret|password|passwd|pwd)\s*[:=]\s*["']?[^"'\s]{6,}/gi },
    { type: 'email', re: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi },
    { type: 'phone', re: /\b(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g },
    { type: 'card_like', re: /\b(?:\d[ -]*?){13,19}\b/g },
];

function slugValue(value = 'scene') {
    return String(value || 'scene').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 64) || 'scene';
}

function redactSensitiveText(text = '') {
    let redacted = String(text || '');
    const hits = {};
    for (const pattern of REDACTION_PATTERNS) {
        redacted = redacted.replace(pattern.re, (match) => {
            hits[pattern.type] = (hits[pattern.type] || 0) + 1;
            return `[REDACTED:${pattern.type}]`;
        });
    }
    return {
        text: redacted,
        redactionCount: Object.values(hits).reduce((sum, value) => sum + value, 0),
        redactionTypes: Object.keys(hits),
    };
}

function sceneLooksImportant(scene) {
    const text = `${scene?.summary || ''}\n${scene?.ocrText || ''}`.toLowerCase();
    if (scene?.diff?.summary === 'Initial scene captured.' && scene?.source !== 'deep-describe') {
        return (scene?.privacy?.redactionCount || 0) > 0 || /\b(error|exception|failed|warning|crash|blocked)\b/i.test(text);
    }
    return (
        (scene?.changeScore || 0) >= 0.55 ||
        /\b(error|exception|failed|warning|crash|blocked|permission|security|password|token|api key|stack trace|traceback)\b/i.test(text) ||
        (scene?.privacy?.redactionCount || 0) > 0 ||
        scene?.source === 'deep-describe'
    );
}

function saveImportantSceneReflection(scene, reason = 'important-scene') {
    try {
        if (!scene || scene.reflectionSaved || !sceneLooksImportant(scene)) return null;
        fs.mkdirSync(REFLECTIONS_DIR, { recursive: true });
        const filename = `folio.presence.scene.${slugValue(reason)}.${Date.now()}.md`;
        const filePath = path.join(REFLECTIONS_DIR, filename);
        const content = [
            '---',
            `title: "Presence Scene: ${reason}"`,
            'type: folio',
            'workbook: "SOMA"',
            'segment: "Presence"',
            'section: "Scene Memory"',
            `source: "${scene.source || 'vision'}"`,
            `channel: "${scene.channel || 'unknown'}"`,
            `change_score: ${Number(scene.changeScore || 0).toFixed(3)}`,
            `privacy_redactions: ${scene.privacy?.redactionCount || 0}`,
            'tags: [reflections, folio, presence, vision, scene-memory]',
            '---',
            '',
            `# Presence Scene: ${reason}`,
            '',
            `Captured: ${new Date(scene.timestamp || Date.now()).toISOString()}`,
            '',
            '## Summary',
            '',
            scene.summary || 'Scene captured.',
            '',
            '## Last Change',
            '',
            scene.diff?.summary || 'No change summary available.',
            '',
            scene.ocrText ? `## Visible Text\n\n${scene.ocrText}` : '',
            '',
            scene.objects?.length ? `## Visual Signals\n\n${scene.objects.map(obj => `- ${obj.label}${obj.score != null ? ` (${Math.round(obj.score * 100)}%)` : ''}`).join('\n')}` : '',
            '',
            scene.privacy?.redactionCount ? `## Privacy\n\nRedacted ${scene.privacy.redactionCount} sensitive value(s): ${scene.privacy.redactionTypes.join(', ')}` : '',
            '',
            '---',
            '*Captured by SOMA Presence scene memory.*',
            ''
        ].filter(Boolean).join('\n');
        fs.writeFileSync(filePath, content, 'utf8');
        scene.reflectionSaved = filename;
        return { filename, path: filePath };
    } catch (err) {
        console.warn('[Perception] Scene reflection save failed:', err.message);
        return null;
    }
}

function readRetentionManifest() {
    try {
        if (!fs.existsSync(RETENTION_MANIFEST)) return { pinned: {} };
        const parsed = JSON.parse(fs.readFileSync(RETENTION_MANIFEST, 'utf8'));
        return { pinned: parsed.pinned || {} };
    } catch {
        return { pinned: {} };
    }
}

function writeRetentionManifest(manifest) {
    fs.mkdirSync(path.dirname(RETENTION_MANIFEST), { recursive: true });
    fs.writeFileSync(RETENTION_MANIFEST, JSON.stringify({ pinned: manifest.pinned || {} }, null, 2), 'utf8');
}

function isPathInsideVisionTemp(filePath) {
    const resolved = path.resolve(filePath);
    return resolved.startsWith(path.resolve(VISION_TEMP_DIR));
}

function listVisionFiles() {
    if (!fs.existsSync(VISION_TEMP_DIR)) return [];
    const files = [];
    for (const name of fs.readdirSync(VISION_TEMP_DIR)) {
        const filePath = path.join(VISION_TEMP_DIR, name);
        try {
            const stat = fs.statSync(filePath);
            if (stat.isFile()) {
                files.push({
                    name,
                    path: filePath,
                    size: stat.size,
                    mtimeMs: stat.mtimeMs,
                    ageMs: Date.now() - stat.mtimeMs,
                });
            }
        } catch {}
    }
    return files;
}

function getRetentionStatus() {
    const manifest = readRetentionManifest();
    const files = listVisionFiles();
    const totalBytes = files.reduce((sum, file) => sum + file.size, 0);
    const pinnedPaths = new Set(Object.keys(manifest.pinned).map(p => path.resolve(p)));
    const pinnedBytes = files.filter(file => pinnedPaths.has(path.resolve(file.path))).reduce((sum, file) => sum + file.size, 0);
    return {
        rawRetentionDays: RAW_RETENTION_DAYS,
        cacheLimitMb: RAW_CACHE_LIMIT_MB,
        fileCount: files.length,
        totalBytes,
        totalMb: +(totalBytes / 1024 / 1024).toFixed(2),
        pinnedCount: Object.keys(manifest.pinned).length,
        pinnedBytes,
        pinnedMb: +(pinnedBytes / 1024 / 1024).toFixed(2),
        oldestAgeDays: files.length ? +((Math.max(...files.map(file => file.ageMs)) / 86400000).toFixed(2)) : 0,
        nextSweepInMs: Math.max(0, 3600000 - (Date.now() - lastRetentionSweep)),
    };
}

function cleanupVisionCache({ dryRun = false, force = false } = {}) {
    const now = Date.now();
    if (!force && !dryRun && now - lastRetentionSweep < 3600000) {
        return { skipped: true, reason: 'recent_sweep', status: getRetentionStatus(), deleted: [] };
    }

    const manifest = readRetentionManifest();
    const pinnedPaths = new Set(Object.keys(manifest.pinned).map(p => path.resolve(p)));
    const files = listVisionFiles();
    const maxAgeMs = RAW_RETENTION_DAYS * 86400000;
    const cacheLimitBytes = RAW_CACHE_LIMIT_MB * 1024 * 1024;
    let totalBytes = files.reduce((sum, file) => sum + file.size, 0);
    const candidates = files
        .filter(file => !pinnedPaths.has(path.resolve(file.path)))
        .sort((a, b) => b.ageMs - a.ageMs);

    const toDelete = [];
    for (const file of candidates) {
        if (file.ageMs > maxAgeMs) {
            toDelete.push({ ...file, reason: 'age' });
            totalBytes -= file.size;
        }
    }

    if (totalBytes > cacheLimitBytes) {
        for (const file of candidates) {
            if (toDelete.some(item => item.path === file.path)) continue;
            if (totalBytes <= cacheLimitBytes) break;
            toDelete.push({ ...file, reason: 'size' });
            totalBytes -= file.size;
        }
    }

    const deleted = [];
    for (const file of toDelete) {
        if (!isPathInsideVisionTemp(file.path)) continue;
        deleted.push({ name: file.name, path: file.path, size: file.size, reason: file.reason });
        if (!dryRun) {
            try { fs.unlinkSync(file.path); } catch {}
        }
    }

    if (!dryRun) lastRetentionSweep = now;
    return {
        skipped: false,
        dryRun,
        deleted,
        deletedCount: deleted.length,
        deletedMb: +(deleted.reduce((sum, file) => sum + file.size, 0) / 1024 / 1024).toFixed(2),
        status: getRetentionStatus(),
    };
}

function pinVisionFrame(filePath, reason = 'manual') {
    if (!filePath || !isPathInsideVisionTemp(filePath) || !fs.existsSync(filePath)) {
        throw new Error('Frame not found or outside vision temp');
    }
    const manifest = readRetentionManifest();
    manifest.pinned[path.resolve(filePath)] = { reason, pinnedAt: Date.now() };
    writeRetentionManifest(manifest);
    return getRetentionStatus();
}

function unpinVisionFrame(filePath) {
    const manifest = readRetentionManifest();
    delete manifest.pinned[path.resolve(filePath)];
    writeRetentionManifest(manifest);
    return getRetentionStatus();
}

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

function addSceneMemory({ imagePath, channel = 'desktop', objects = [], ocrText = null, summary = null, source = 'vision', timestamp = Date.now(), engine = null, privacy = null }) {
    const redactedOcr = redactSensitiveText(ocrText || '');
    const redactedSummary = redactSensitiveText(summary || 'Visual frame captured.');
    const privacyInfo = {
        redactionCount: (privacy?.redactionCount || 0) + redactedOcr.redactionCount + redactedSummary.redactionCount,
        redactionTypes: [...new Set([...(privacy?.redactionTypes || []), ...redactedOcr.redactionTypes, ...redactedSummary.redactionTypes])],
    };
    const normalized = {
        id: `scene-${timestamp}-${crypto.randomUUID()}`,
        timestamp,
        channel,
        imagePath,
        frameUrl: imagePath ? `/api/perception/vision/frame?path=${encodeURIComponent(imagePath)}` : null,
        objects: normalizeObjects(objects),
        ocrText: redactedOcr.text,
        summary: redactedSummary.text,
        source,
        engine,
        privacy: privacyInfo,
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
        privacy: normalized.privacy,
    };

    saveImportantSceneReflection(normalized, normalized.diff?.summary || normalized.source);

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
    cleanupVisionCache({ force: false });
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

async function deepDescribeScene(scene, { prompt = null, saveReflection = true } = {}) {
    if (!scene?.imagePath) throw new Error('No scene image available for deep description');
    const ask = prompt || [
        'Analyze this current SOMA Presence scene.',
        'Return a concise but useful description of what is visible, any readable text, warnings, UI state, and what changed if apparent.',
        'If text appears sensitive, summarize the kind of text without reproducing secrets.',
        'Do not use em dashes.'
    ].join(' ');
    const sys = global.__SOMA_SYSTEM || {};
    const brain = sys.quadBrain || sys.brain;
    let analysis = null;
    if (brain?.reason) {
        const response = await brain.reason(ask, { images: [scene.imagePath], vision: true, mode: 'fast' });
        const text = response?.text || response?.response || String(response || '');
        analysis = { engine: 'quad-brain', result: text, objects: [], ocrText: null, raw: response };
    } else {
        analysis = await analyzeWithAvailableVision({
            imagePath: scene.imagePath,
            base64: null,
            mimeType: 'image/png',
            prompt: ask,
            type: 'deep-describe'
        });
    }
    const redactedOcr = redactSensitiveText(analysis.ocrText || '');
    const redactedSummary = redactSensitiveText(analysis.result || scene.summary || '');
    scene.summary = redactedSummary.text || scene.summary;
    scene.ocrText = redactedOcr.text || scene.ocrText || '';
    scene.objects = normalizeObjects([...(analysis.objects || []), ...(scene.objects || [])]);
    scene.engine = analysis.engine;
    scene.source = 'deep-describe';
    scene.deepDescribedAt = Date.now();
    scene.privacy = {
        redactionCount: (scene.privacy?.redactionCount || 0) + redactedOcr.redactionCount + redactedSummary.redactionCount,
        redactionTypes: [...new Set([...(scene.privacy?.redactionTypes || []), ...redactedOcr.redactionTypes, ...redactedSummary.redactionTypes])],
    };
    scene.diff = diffScenes(sceneMemory[1] || null, scene);
    scene.changeScore = scene.diff.score;
    if (saveReflection) saveImportantSceneReflection(scene, 'deep-describe');
    return { scene, analysis };
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
                sceneMemory:   sceneSnapshot(),
                retention:     getRetentionStatus(),
                v2: {
                    privacyRedaction: true,
                    deepDescribe: true,
                    reflectionCapture: true,
                    autoDeepTrigger: 'manual-or-upload'
                }
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
 * GET /api/perception/vision/retention
 * Reports raw frame cache size, age policy, and pin status.
 */
router.get('/vision/retention', (req, res) => {
    res.json({ success: true, retention: getRetentionStatus() });
});

/**
 * POST /api/perception/vision/retention/cleanup
 * Runs visual cache cleanup. Body: { dryRun?: boolean, force?: boolean }
 */
router.post('/vision/retention/cleanup', (req, res) => {
    try {
        const result = cleanupVisionCache({
            dryRun: !!req.body?.dryRun,
            force: req.body?.force !== false,
        });
        res.json({ success: true, ...result });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

/**
 * POST /api/perception/vision/pin
 * Pins or unpins a raw frame so retention will not delete it.
 */
router.post('/vision/pin', (req, res) => {
    try {
        const { imagePath, pinned = true, reason = 'manual' } = req.body || {};
        if (!imagePath) return res.status(400).json({ success: false, error: 'imagePath is required' });
        const retention = pinned ? pinVisionFrame(imagePath, reason) : unpinVisionFrame(imagePath);
        res.json({ success: true, pinned: !!pinned, retention });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
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
 * POST /api/perception/vision/deep-describe
 * Runs a selective multimodal interpretation pass over the latest scene.
 */
router.post('/vision/deep-describe', async (req, res) => {
    try {
        const { sceneId, prompt, saveReflection = true } = req.body || {};
        const scene = sceneId
            ? sceneMemory.find(item => item.id === sceneId)
            : sceneMemory[0];
        if (!scene) return res.status(404).json({ success: false, error: 'No scene memory available' });

        const result = await deepDescribeScene(scene, { prompt, saveReflection });
        res.json({
            success: true,
            scene: result.scene,
            analysis: result.analysis.result,
            engine: result.analysis.engine,
            sceneMemory: sceneSnapshot(),
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

// Active proposals memory store
let activeProposals = [];

/**
 * GET /api/perception/vision/proposals
 * Returns the currently active proposals for the latest screenshot
 */
router.get('/vision/proposals', (req, res) => {
    res.json({ success: true, proposals: activeProposals });
});

/**
 * POST /api/perception/vision/capture
 * Captures a fresh desktop screenshot and resets proposals
 */
router.post('/vision/capture', async (req, res) => {
    try {
        const sys = global.__SOMA_SYSTEM || {};
        const control = sys.computerControl || sys.arbiters?.get?.('ComputerControlArbiter')?.instance;
        if (!control) {
            return res.status(503).json({ success: false, error: 'ComputerControlArbiter not available' });
        }

        const cap = await control.captureScreen();
        if (!cap.success) {
            return res.status(500).json({ success: false, error: cap.error || 'Failed to capture screen' });
        }

        // Reset proposals
        activeProposals = [];

        // Save scene memory
        const scene = addSceneMemory({
            imagePath: cap.imagePath,
            channel: 'desktop',
            objects: [{ label: 'desktop', score: 1.0, bbox: null }],
            ocrText: '',
            summary: 'Manual desktop snapshot captured.',
            source: 'desktop-snapshot',
            timestamp: Date.now()
        });

        // Try to trigger a fast OCR scan in background using available vision
        try {
            const vision = sys.visionProcessing || sys.visionArbiter;
            if (vision?.detectObjects) {
                vision.detectObjects(cap.imagePath, 0.4).then(detected => {
                    if (detected?.success) {
                        scene.ocrText = detected.ocrText || '';
                        scene.objects = normalizeObjects(detected.objects || []);
                    }
                }).catch(() => {});
            }
        } catch {}

        res.json({
            success: true,
            scene,
            sceneMemory: sceneSnapshot()
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

/**
 * POST /api/perception/vision/propose-actions
 * Asks SOMA's brain to analyze the latest screenshot and return structured UI action proposals
 */
router.post('/vision/propose-actions', async (req, res) => {
    try {
        const sys = global.__SOMA_SYSTEM || {};
        const latestScene = sceneMemory[0];
        if (!latestScene || !latestScene.imagePath) {
            return res.status(400).json({ success: false, error: 'No desktop screenshot available. Capture one first.' });
        }

        const brain = sys.quadBrain || sys.brain;
        if (!brain?.reason) {
            return res.status(503).json({ success: false, error: 'Reasoning brain not available' });
        }

        const prompt = `Analyze this user's desktop screenshot. Identify the active application window, text, visible buttons, input fields, and likely next actions.
Propose 2-4 logical user actions that SOMA could take to assist the user.
Return ONLY a valid JSON array of action proposals, with NO markdown block, NO formatting wrapper, and NO explanation, following this schema:
[
  {
    "id": "prop-1",
    "type": "click" | "type" | "navigate",
    "label": "Click the 'Terminal' window",
    "params": { "x": 450, "y": 620, "text": "", "url": "" }
  }
]
Estimate absolute pixel coordinates x and y for clicks based on a standard 1920x1080 monitor.
`;

        const response = await brain.reason(prompt, { images: [latestScene.imagePath], vision: true, mode: 'fast' });
        const responseText = response?.text || response?.response || String(response || '');

        let proposals = [];
        try {
            const cleanJson = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
            proposals = JSON.parse(cleanJson);
            if (!Array.isArray(proposals)) proposals = [];
        } catch (jsonErr) {
            console.warn('[Perception] Brain did not return valid JSON proposals, using fallback parsing:', jsonErr.message);
            // Simple regex fallback
            const labels = responseText.match(/"label":\s*"([^"]+)"/g) || [];
            proposals = labels.map((l, idx) => {
                const label = l.replace(/"label":\s*"/, '').replace(/"/, '');
                return {
                    id: `prop-${idx + 1}`,
                    type: 'click',
                    label,
                    params: { x: 500 + idx * 50, y: 500 }
                };
            });
        }

        if (proposals.length === 0) {
            // Default fallbacks if both failed
            proposals = [
                { id: 'prop-1', type: 'click', label: 'Click Center of Screen', params: { x: 960, y: 540 } },
                { id: 'prop-2', type: 'click', label: 'Click Start Button', params: { x: 20, y: 1060 } }
            ];
        }

        activeProposals = proposals;
        res.json({ success: true, proposals });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

/**
 * POST /api/perception/vision/execute-action
 * Executes an action (either from proposals or ad-hoc), waits, and triggers a fresh verification screenshot
 */
router.post('/api/perception/vision/execute-action', async (req, res) => {
    try {
        const { type, params } = req.body || {};
        if (!type) return res.status(400).json({ success: false, error: 'action type required' });

        const sys = global.__SOMA_SYSTEM || {};
        const control = sys.computerControl || sys.arbiters?.get?.('ComputerControlArbiter')?.instance;
        if (!control) {
            return res.status(503).json({ success: false, error: 'ComputerControlArbiter not available' });
        }

        // Set ghost cursor on backend to indicate execution position
        if (type === 'click' && params?.x && params?.y) {
            const vision = global.SOMA_COS?.visionDaemon;
            if (vision) {
                vision.ghostCursor = {
                    x: Math.round((params.x / 1920) * 100),
                    y: Math.round((params.y / 1080) * 100),
                    action: 'click'
                };
            }
        }

        // Execute action
        let result;
        if (type === 'browser') {
            result = await control.handleBrowserAction(params);
        } else {
            result = await control.executeAction({ type, ...params });
        }

        if (!result.success) {
            return res.status(500).json({ success: false, error: result.error || 'Execution failed' });
        }

        // Wait 1.5s for screen changes to complete
        await new Promise(r => setTimeout(r, 1500));

        // Take verification capture
        const cap = await control.captureScreen();
        let verificationScene = null;
        if (cap.success) {
            verificationScene = addSceneMemory({
                imagePath: cap.imagePath,
                channel: 'desktop',
                objects: [{ label: 'desktop', score: 1.0, bbox: null }],
                ocrText: '',
                summary: `Verification scan after ${type} action.`,
                source: 'verification',
                timestamp: Date.now()
            });

            // Clear ghost cursor after successful execution
            const vision = global.SOMA_COS?.visionDaemon;
            if (vision) vision.ghostCursor = null;

            // Clear proposals list as the screen has changed
            activeProposals = [];
        }

        // Record to timeline/history via communicationHub if available
        try {
            const hub = sys.communicationHub;
            if (hub) {
                hub.addTimeline({
                    type: 'action',
                    title: `Executed ${type}`,
                    detail: `Action parameters: ${JSON.stringify(params)}`,
                    route: 'orb',
                    agent: 'SOMA',
                    priority: 'normal'
                });
            }
        } catch {}

        res.json({
            success: true,
            result,
            verificationScene,
            sceneMemory: sceneSnapshot()
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

export default router;
