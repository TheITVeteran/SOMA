/**
 * socialRoutes.js
 * POST /api/social/test  — fire a test post to one or all platforms
 * POST /api/social/post  — post arbitrary text to a platform
 * GET  /api/social/queue — inspect the post queue
 */

import express from 'express';
import fs from 'fs';
import path from 'path';
import blueskeyClient from '../social/BlueskeyClient.js';
import linkedInClient from '../social/LinkedInClient.js';
import socialQueue from '../social/SocialQueue.js';

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

        try {
            let result;
            if (platform === 'bluesky') {
                result = await blueskeyClient.post(text.trim());
            } else if (platform === 'x') {
                result = await system.oculusBrowser?.postToX(text.trim());
            } else if (platform === 'linkedin') {
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

    // ── Queue inspector ───────────────────────────────────────────────────────
    router.get('/queue', (_req, res) => {
        const all     = socialQueue.getAll();
        const pending = socialQueue.getPending();
        res.json({ ok: true, total: all.length, pending: pending.length, items: all.slice(-20) });
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
