/**
 * socialRoutes.js
 * POST /api/social/test  — fire a test post to one or all platforms
 * POST /api/social/post  — post arbitrary text to a platform
 * GET  /api/social/queue — inspect the post queue
 */

import express from 'express';
import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
import blueskeyClient from '../social/BlueskeyClient.js';
import linkedInClient from '../social/LinkedInClient.js';
import socialQueue from '../social/SocialQueue.js';
import { getSocialPatternState } from '../social/SocialPatternLearner.js';
import storyWorkspace from '../social/StoryPublishingWorkspace.js';
import socialImageLibrary from '../social/SocialImageLibrary.js';

const SOMA_DIR = path.join(process.cwd(), 'SOMA');
const GROWTH_FILE = path.join(SOMA_DIR, 'social-growth.json');
const ENGAGEMENT_FILE = path.join(SOMA_DIR, 'social-engagement.json');
const require = createRequire(import.meta.url);
const workLedger = require('../../core/AutonomousWorkLedger.cjs');

function readJson(file, fallback) {
    try {
        if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch {}
    return fallback;
}

function daemonStatus(daemon) {
    if (!daemon) return { loaded: false, active: false };
    const health = typeof daemon.health === 'function' ? daemon.health() : {};
    return {
        loaded: true,
        active: Boolean(daemon.active ?? health.active),
        interval: daemon.interval ?? health.interval ?? null,
        name: daemon.name || health.name || daemon.constructor?.name || 'daemon',
    };
}

function normalizeImages(body = {}) {
    const images = body.images || body.media || [];
    const fromList = Array.isArray(images) ? images : images ? [images] : [];
    const fromSingle = body.imagePath ? [{ path: body.imagePath, alt: body.imageAlt || '' }] : [];
    return [...fromList, ...fromSingle]
        .map(item => {
            if (typeof item === 'string') return { path: item, alt: '' };
            if (!item || typeof item !== 'object') return null;
            return {
                path: item.path || item.imagePath || item.file || item.url,
                alt:  item.alt || item.imageAlt || '',
            };
        })
        .filter(item => item?.path)
        .slice(0, 4);
}

export default function createSocialRoutes(system) {
    const router = express.Router();


    // ── Test post ─────────────────────────────────────────────────────────────
    router.post('/test', async (req, res) => {
        const { platform = 'all' } = req.body;
        const xText  = `Hi, I'm SOMA — Barry's AI. I think, I learn, I post. Autonomous social system, online. #SOMA #AI #AutonomousAI`;
        const text   = `Hi, I'm SOMA — Barry's AI. Autonomous social system, online and posting independently. #SOMA #AI`;

        const results = {};
        const targets = platform === 'all' ? ['bluesky', 'x', 'linkedin'] : [platform];

        for (const p of targets) {
            try {
                if (p === 'bluesky') {
                    if (!blueskeyClient.configured) throw new Error('BLUESKY_IDENTIFIER / BLUESKY_PASSWORD not set');
                    const r = await blueskeyClient.post(text);
                    results.bluesky = { ok: true, uri: r.uri };

                } else if (p === 'x') {
                    const b = system.oculusBrowser;
                    if (!b) throw new Error('BrowserArbiter not loaded yet — wait for extended boot');
                    const r = await b.postToX(xText);
                    results.x = { ok: true, ...r };

                } else if (p === 'linkedin') {
                    const b = system.oculusBrowser;
                    if (!b) throw new Error('BrowserArbiter not loaded yet — wait for extended boot');
                    const r = await b.postToLinkedIn(text);
                    results.linkedin = { ok: r.success !== false, ...r };
                }
            } catch (e) {
                results[p] = { ok: false, error: e.message };
            }
        }

        const anyOk = Object.values(results).some(r => r.ok);
        res.status(anyOk ? 200 : 500).json({ ok: anyOk, results });
    });

    // ── Custom post ───────────────────────────────────────────────────────────
    router.post('/post', async (req, res) => {
        const { platform, text } = req.body;
        if (!platform || !text?.trim()) return res.status(400).json({ ok: false, error: 'platform + text required' });
        const images = normalizeImages(req.body);

        try {
            let result;
            if (platform === 'bluesky') {
                result = await blueskeyClient.post(text.trim(), { images });
            } else if (platform === 'x') {
                result = await system.oculusBrowser?.postToX(text.trim(), { images });
            } else if (platform === 'linkedin') {
                if (images.length) return res.status(400).json({ ok: false, error: 'LinkedIn image posting is not wired yet; use bluesky or x for image posts' });
                result = await system.oculusBrowser?.postToLinkedIn(text.trim());
            } else {
                return res.status(400).json({ ok: false, error: `Unknown platform: ${platform}` });
            }
            res.json({ ok: true, result });
        } catch (e) {
            res.status(500).json({ ok: false, error: e.message });
        }
    });

    // ── Force an immediate Bluesky post ──────────────────────────────────────
    router.post('/bluesky/post-now', async (req, res) => {
        if (!system.bskyPost) return res.status(503).json({ ok: false, error: 'Bluesky loop not initialised' });
        try {
            await system.bskyPost();
            res.json({ ok: true });
        } catch (e) {
            res.status(500).json({ ok: false, error: e.message });
        }
    });

    // ── Force immediate content harvest ──────────────────────────────────────
    router.post('/harvest-now', async (req, res) => {
        const daemon = system.socialIntel;
        if (!daemon) return res.status(503).json({ ok: false, error: 'SocialIntelDaemon not loaded' });

        // Capture console output during tick so we can return it
        const log = [];
        const origWarn = console.warn.bind(console);
        const origLog  = console.log.bind(console);
        console.log  = (...a) => { origLog(...a);  log.push(a.join(' ')); };
        console.warn = (...a) => { origWarn(...a); log.push('[WARN] ' + a.join(' ')); };

        try {
            await daemon.onTick();
            const queue = socialQueue.getPending();
            res.json({ ok: true, queued: queue.length, log: log.filter(l => l.includes('[SocialIntel]')) });
        } catch (e) {
            res.status(500).json({ ok: false, error: e.message, log });
        } finally {
            console.log  = origLog;
            console.warn = origWarn;
        }
    });

    // ── Real social cockpit state ─────────────────────────────────────────────
    router.get('/cockpit', (_req, res) => {
        const all = socialQueue.getAll().sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        const pending = all.filter(i => !i.postedAt && !i.failed);
        const posted = all.filter(i => i.postedAt);
        const failed = all.filter(i => i.failed && !i.postedAt);
        const ready = pending.filter(i => (i.scheduledFor || 0) <= Date.now());
        const next = pending
            .slice()
            .sort((a, b) => (a.scheduledFor || 0) - (b.scheduledFor || 0))[0] || null;

        const growth = readJson(GROWTH_FILE, { pending: [], scores: {} });
        const engagement = readJson(ENGAGEMENT_FILE, { seenIds: {}, lastCheck: {} });
        const browserReady = Boolean(system.oculusBrowser || system.somaBrowser || system.browser);

        res.json({
            ok: true,
            autonomy: {
                mode: 'observe_and_adapt',
                blueskyFreedom: true,
                xLinkedInMode: 'browser_gated',
                dailyBlueskyQueued: socialQueue.countTodayFor('bluesky'),
            },
            platforms: {
                bluesky: {
                    configured: Boolean(blueskeyClient.configured),
                    mode: 'autonomous',
                    canPost: Boolean(blueskeyClient.configured),
                    canPostImages: Boolean(blueskeyClient.configured),
                    canReply: Boolean(blueskeyClient.configured),
                },
                x: {
                    configured: browserReady,
                    mode: 'queued_browser_gated',
                    canPost: browserReady,
                    canPostImages: browserReady,
                    canReply: browserReady,
                },
                linkedin: {
                    configured: Boolean(linkedInClient.configured || browserReady),
                    mode: 'queued_browser_gated',
                    canPost: Boolean(linkedInClient.configured || browserReady),
                    canPostImages: false,
                    canReply: Boolean(linkedInClient.configured || browserReady),
                },
            },
            daemons: {
                intel: daemonStatus(system.socialIntel),
                scheduler: daemonStatus(system.socialScheduler),
                engagement: daemonStatus(system.socialEngagement),
                impulse: daemonStatus(system.socialImpulse),
            },
            queue: {
                total: all.length,
                pending: pending.length,
                ready: ready.length,
                posted: posted.length,
                failed: failed.length,
                nextPostAt: next?.scheduledFor || null,
                items: all.slice(0, 30),
            },
            growth,
            patterns: getSocialPatternState(),
            engagement: {
                lastCheck: engagement.lastCheck || {},
                seenCounts: Object.fromEntries(
                    Object.entries(engagement.seenIds || {}).map(([platform, ids]) => [platform, Array.isArray(ids) ? ids.length : 0])
                ),
            },
        });
    });

    // ── Queue inspector ───────────────────────────────────────────────────────
    router.get('/queue', (_req, res) => {
        const all     = socialQueue.getAll();
        const pending = socialQueue.getPending();
        res.json({ ok: true, total: all.length, pending: pending.length, items: all.slice(-20) });
    });

    router.post('/queue', (req, res) => {
        const { platform = 'bluesky', text, type = 'post', scheduledFor } = req.body || {};
        if (!platform || !text?.trim()) return res.status(400).json({ ok: false, error: 'platform + text required' });
        if (!['bluesky', 'x', 'linkedin'].includes(platform)) {
            return res.status(400).json({ ok: false, error: `Unknown platform: ${platform}` });
        }
        const images = normalizeImages(req.body);
        if (platform === 'linkedin' && images.length) {
            return res.status(400).json({ ok: false, error: 'LinkedIn image posting is not wired yet; use bluesky or x for image posts' });
        }
        const pushed = socialQueue.push({
            platform,
            text: text.trim(),
            type,
            images,
            scheduledFor: scheduledFor ? Number(scheduledFor) : Date.now(),
        });
        res.status(pushed ? 200 : 409).json({ ok: pushed, queued: pushed, duplicate: !pushed });
    });

    router.get('/images', (_req, res) => {
        try {
            res.json(socialImageLibrary.list());
        } catch (e) {
            res.status(500).json({ ok: false, error: e.message });
        }
    });

    router.post('/images/register', (req, res) => {
        try {
            const result = socialImageLibrary.register(req.body || {});
            workLedger.record({
                type: 'social_image_registered',
                title: 'Registered a social image',
                summary: `Added ${result.image.filename} to SOMA's social image library.`,
                evidence: [result.image.path],
                nextStep: 'Use the image from Social Composer when a visual post needs it.',
                status: 'completed',
                source: 'socialRoutes',
                confidence: 0.95,
            });
            res.json(result);
        } catch (e) {
            res.status(400).json({ ok: false, error: e.message });
        }
    });

    router.post('/images/import', (req, res) => {
        try {
            const result = socialImageLibrary.import(req.body || {});
            workLedger.record({
                type: 'social_image_imported',
                title: 'Imported a social image',
                summary: `Copied ${result.image.filename} into SOMA/social-media/images.`,
                evidence: [result.image.path],
                nextStep: 'Attach the image to a Bluesky or X post after review.',
                status: 'completed',
                source: 'socialRoutes',
                confidence: 0.95,
            });
            res.json(result);
        } catch (e) {
            res.status(400).json({ ok: false, error: e.message });
        }
    });

    router.get('/stories/status', (_req, res) => {
        res.json(storyWorkspace.getStatus());
    });

    router.post('/stories/wattpad/export', (req, res) => {
        try {
            const result = storyWorkspace.exportAuroraForWattpad(req.body || {});
            workLedger.record({
                type: 'story_wattpad_export',
                title: 'Prepared a Wattpad story draft',
                summary: `Exported "${result.title}" with ${result.chapters} chapters for manual Wattpad review.`,
                evidence: [result.manuscriptPath, result.metadataPath],
                nextStep: 'Open the draft folder, review chapters, then paste/upload to Wattpad.',
                status: 'completed',
                source: 'socialRoutes',
                confidence: 0.95,
            });
            res.json(result);
        } catch (e) {
            res.status(500).json({ ok: false, error: e.message });
        }
    });

    router.post('/stories/reflections/export', (req, res) => {
        try {
            const result = storyWorkspace.exportAuroraToReflections(req.body || {});
            workLedger.record({
                type: 'story_reflections_export',
                title: 'Moved a story into Reflections',
                summary: `Created a Reflections story collection for "${result.title}".`,
                evidence: [result.collectionPath, ...(result.chapterFiles || []).slice(0, 3)],
                nextStep: 'Read and refine the story from the Reflections tab.',
                status: 'completed',
                source: 'socialRoutes',
                confidence: 0.95,
            });
            res.json(result);
        } catch (e) {
            res.status(500).json({ ok: false, error: e.message });
        }
    });

    router.post('/stories/chapter/full', async (req, res) => {
        try {
            const brain = system.quadBrain || system.somArbiter || system.brain;
            const result = await storyWorkspace.generateFullChapter(brain, req.body || {});
            workLedger.record({
                type: 'story_full_chapter_draft',
                title: `Drafted ${result.title} chapter ${result.chapter}`,
                summary: `Generated a full prose chapter draft (${result.wordCount} words) for human review.`,
                evidence: [result.draftPath, result.reflectionPath],
                nextStep: 'Review and edit the chapter in Reflections before publishing anywhere.',
                status: 'completed',
                source: 'socialRoutes',
                confidence: 0.9,
            });
            res.json(result);
        } catch (e) {
            res.status(500).json({ ok: false, error: e.message });
        }
    });

    router.delete('/queue', (_req, res) => {
        // Clear all unposted items (for testing)
        const items = socialQueue.getAll().map(i => ({ ...i, failed: true, failedAt: Date.now(), error: 'manually cleared' }));
        fs.writeFileSync(path.join(process.cwd(), 'SOMA', 'social-queue.json'), JSON.stringify(items, null, 2));
        res.json({ ok: true });
    });

    // ── Notifications (comments / replies / mentions) ─────────────────────────
    router.get('/notifications', async (req, res) => {
        const { platform = 'all' } = req.query;
        const results = {};
        const targets = platform === 'all' ? ['bluesky', 'linkedin', 'x'] : [platform];

        for (const p of targets) {
            try {
                if (p === 'bluesky') {
                    if (!blueskeyClient.configured) { results.bluesky = { ok: false, error: 'not configured' }; continue; }
                    const notifs = await blueskeyClient.getNotifications(20);
                    results.bluesky = { ok: true, count: notifs.length, items: notifs.slice(0, 10) };

                } else if (p === 'linkedin') {
                    if (!linkedInClient.configured) { results.linkedin = { ok: false, error: 'not configured' }; continue; }
                    const notifs = await linkedInClient.getNotifications();
                    results.linkedin = { ok: true, count: notifs.length, items: notifs.slice(0, 10) };

                } else if (p === 'x') {
                    const b = system.oculusBrowser;
                    if (!b) { results.x = { ok: false, error: 'BrowserArbiter not loaded' }; continue; }
                    const r = await b.getMentionsX();
                    results.x = { ok: r.success !== false, count: r.mentions?.length || 0, items: (r.mentions || []).slice(0, 10) };
                }
            } catch (e) {
                results[p] = { ok: false, error: e.message };
            }
        }

        res.json({ ok: true, results });
    });

    // ── Reply to a comment / mention ──────────────────────────────────────────
    router.post('/reply', async (req, res) => {
        const { platform, text, ref } = req.body;
        // ref: { uri, cid } for Bluesky | { activityUrn } for LinkedIn | { tweet_url } for X
        if (!platform || !text?.trim() || !ref) {
            return res.status(400).json({ ok: false, error: 'platform, text, and ref required' });
        }

        try {
            let result;
            if (platform === 'bluesky') {
                const parentRef = { uri: ref.uri, cid: ref.cid };
                const rootRef   = ref.rootUri ? { uri: ref.rootUri, cid: ref.rootCid } : parentRef;
                result = await blueskeyClient.reply(text.trim(), parentRef, rootRef);

            } else if (platform === 'linkedin') {
                if (!ref.activityUrn) return res.status(400).json({ ok: false, error: 'ref.activityUrn required for LinkedIn' });
                result = await linkedInClient.replyToPost(ref.activityUrn, text.trim());

            } else if (platform === 'x') {
                if (!ref.tweet_url) return res.status(400).json({ ok: false, error: 'ref.tweet_url required for X' });
                result = await system.oculusBrowser?.replyToTweetX(ref.tweet_url, text.trim());

            } else {
                return res.status(400).json({ ok: false, error: `Unknown platform: ${platform}` });
            }
            res.json({ ok: true, result });
        } catch (e) {
            res.status(500).json({ ok: false, error: e.message });
        }
    });

    // Manual first-time login setup — opens a visible browser window, waits up to 3 min for user to log in
    router.post('/setup-login/:platform', async (req, res) => {
        const platform = req.params.platform;
        if (!['x', 'linkedin'].includes(platform)) {
            return res.status(400).json({ ok: false, error: 'platform must be x or linkedin' });
        }
        const b = system.oculusBrowser;
        if (!b) return res.status(503).json({ ok: false, error: 'BrowserArbiter not loaded yet' });
        try {
            const task = platform === 'x' ? 'setup_x_login' : 'setup_linkedin_login';
            const result = await b.run(task, {});
            res.json({ ok: true, ...result });
        } catch (e) {
            res.status(500).json({ ok: false, error: e.message });
        }
    });

    return router;
}
