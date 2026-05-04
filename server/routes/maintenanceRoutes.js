/**
 * server/routes/maintenanceRoutes.js
 *
 * MAX's window into SOMA. Lets MAX diagnose, patch, and restart SOMA remotely.
 *
 * Auth: Bearer token from MAINTENANCE_TOKEN env var.
 *       If not set, only 127.0.0.1 / ::1 requests are accepted.
 *
 * Routes:
 *   GET  /api/maintenance/health   — full system snapshot
 *   GET  /api/maintenance/logs     — last N activity log entries
 *   GET  /api/maintenance/git      — recent self-commits + git status
 *   POST /api/maintenance/restart  — graceful exit (PM2/Task Scheduler restarts)
 *   POST /api/maintenance/patch    — MAX injects a swarm modification task
 *   POST /api/maintenance/goal     — MAX injects a goal directly
 */

import express    from 'express';
import os         from 'os';
import socialQueue from '../social/SocialQueue.js';
import gitArbiter  from '../../core/GitArbiter.js';

// ── Rolling activity log (500 entries, in-memory) ────────────────────────────
const _log = [];
export function maintenanceLog(msg) {
    _log.push({ ts: Date.now(), msg: String(msg) });
    if (_log.length > 500) _log.splice(0, _log.length - 500);
}
export function getLog() { return _log; }

// ── Auth middleware ───────────────────────────────────────────────────────────
function auth(req, res, next) {
    const token = process.env.MAINTENANCE_TOKEN;
    if (!token) {
        const ip = req.ip || req.socket?.remoteAddress || '';
        const local = ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1';
        if (local) return next();
        return res.status(403).json({ ok: false, error: 'Set MAINTENANCE_TOKEN env var to allow remote access' });
    }
    if (req.headers.authorization === `Bearer ${token}`) return next();
    return res.status(403).json({ ok: false, error: 'Invalid token' });
}

// ── Route factory ─────────────────────────────────────────────────────────────
export default function createMaintenanceRoutes(system) {
    const router = express.Router();
    router.use(auth);

    // ── Health snapshot ───────────────────────────────────────────────────────
    router.get('/health', (_req, res) => {
        const total = os.totalmem();
        const free  = os.freemem();

        // Daemon status
        const daemons = {};
        try {
            const mgr = system.daemonManager;
            if (mgr?._daemons) {
                for (const [name, d] of Object.entries(mgr._daemons)) {
                    daemons[name] = { active: d.active, intervalMs: d.interval };
                }
            }
        } catch {}

        // Social queue snapshot
        const allPosts  = socialQueue.getAll();
        const pending   = allPosts.filter(i => !i.postedAt && !i.failed);
        const lastPosted = allPosts.filter(i => i.postedAt).sort((a, b) => b.postedAt - a.postedAt)[0];

        res.json({
            ok: true,
            timestamp: Date.now(),
            uptime: Math.round(process.uptime()),
            memory: {
                totalMB:  Math.round(total / 1_048_576),
                freeMB:   Math.round(free  / 1_048_576),
                usedPct:  Math.round((total - free) / total * 100),
            },
            brain: {
                ready:    !!system.quadBrain,
                provider: system.quadBrain?.activeProvider || 'unknown',
            },
            daemons,
            social: {
                queuePending:  pending.length,
                lastPostedAt:  lastPosted?.postedAt  || null,
                lastPostedText: lastPosted?.text?.slice(0, 100) || null,
            },
            recentCommits: gitArbiter.getRecentCommits(5),
        });
    });

    // ── Activity log ──────────────────────────────────────────────────────────
    router.get('/logs', (req, res) => {
        const n = Math.min(parseInt(req.query.n || '100'), 500);
        res.json({ ok: true, count: _log.length, logs: _log.slice(-n) });
    });

    // ── Git status + commit history ───────────────────────────────────────────
    router.get('/git', async (_req, res) => {
        const status  = await gitArbiter.getStatus();
        const commits = gitArbiter.getRecentCommits(20);
        res.json({ ok: true, status, commits });
    });

    // ── Restart ───────────────────────────────────────────────────────────────
    router.post('/restart', (req, res) => {
        const reason = req.body?.reason || 'MAX-requested restart';
        maintenanceLog(`RESTART requested: ${reason}`);
        console.log(`[Maintenance] 🔄 Restarting SOMA — ${reason}`);
        res.json({ ok: true, msg: `Restarting in 3s — ${reason}` });
        setTimeout(() => process.exit(0), 3000); // PM2 / Task Scheduler brings her back
    });

    // ── Patch: MAX triggers the engineering swarm on a specific file ──────────
    router.post('/patch', async (req, res) => {
        const { filepath, request } = req.body || {};
        if (!filepath?.trim() || !request?.trim()) {
            return res.status(400).json({ ok: false, error: 'filepath + request required' });
        }
        if (!system.engineeringSwarm) {
            return res.status(503).json({ ok: false, error: 'EngineeringSwarm not loaded yet' });
        }

        const sessionId = `max-${Date.now()}`;
        maintenanceLog(`PATCH queued by MAX: ${filepath} — "${request.slice(0, 80)}"`);

        // Respond immediately — swarm runs async
        res.json({ ok: true, sessionId, msg: 'Swarm patch queued — poll /health for completion' });

        system.engineeringSwarm.modifyCode(filepath, request)
            .then(r => {
                maintenanceLog(`PATCH complete (${sessionId}): ${r.success ? 'success' : 'failed'}`);
                console.log(`[Maintenance] Patch ${sessionId}: ${r.success ? '✅' : '❌'}`);
            })
            .catch(e => {
                maintenanceLog(`PATCH error (${sessionId}): ${e.message}`);
                console.warn(`[Maintenance] Patch ${sessionId} error: ${e.message}`);
            });
    });

    // ── Goal injection: MAX adds a goal to SOMA's goal engine ────────────────
    router.post('/goal', async (req, res) => {
        const { title, description, priority = 0.8 } = req.body || {};
        if (!title?.trim()) return res.status(400).json({ ok: false, error: 'title required' });

        const goalEngine = system.goalPlannerArbiter || system.goalEngine;
        if (!goalEngine) return res.status(503).json({ ok: false, error: 'GoalEngine not loaded' });

        try {
            const goal = await goalEngine.addGoal?.({ title, description, priority, source: 'max' })
                      || goalEngine.createGoal?.({ title, description, priority });
            maintenanceLog(`GOAL injected by MAX: "${title}"`);
            res.json({ ok: true, goal });
        } catch (e) {
            res.status(500).json({ ok: false, error: e.message });
        }
    });

    return router;
}
