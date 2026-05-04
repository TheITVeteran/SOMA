/**
 * SocialSchedulerDaemon.js
 *
 * Polls SocialQueue every 2 minutes and dispatches ready posts.
 * After posting, saves the URI so engagement metrics can be checked 2h later.
 * Scores are stored by topic type — SocialIntelDaemon reads them to weight rotation.
 */

import BaseDaemon   from './BaseDaemon.js';
import socialQueue  from '../server/social/SocialQueue.js';
import bluesky      from '../server/social/BlueskeyClient.js';
import fs           from 'fs';
import path         from 'path';

const GROWTH_FILE = path.join(process.cwd(), 'SOMA', 'social-growth.json');
const SCORE_AGE   = 2 * 3600_000; // check metrics 2h after posting

function loadGrowth() {
    try {
        if (fs.existsSync(GROWTH_FILE)) return JSON.parse(fs.readFileSync(GROWTH_FILE, 'utf8'));
    } catch {}
    return { pending: [], scores: {} };
}

function saveGrowth(data) {
    try {
        fs.mkdirSync(path.dirname(GROWTH_FILE), { recursive: true });
        fs.writeFileSync(GROWTH_FILE, JSON.stringify(data, null, 2));
    } catch {}
}

export class SocialSchedulerDaemon extends BaseDaemon {
    constructor(config = {}) {
        super({ name: 'SocialSchedulerDaemon', intervalMs: config.intervalMs || 2 * 60_000 });
        this.browserArbiter = config.browserArbiter;
    }

    async onTick() {
        await this._dispatchReady();
        await this._scoreMaturedPosts();
    }

    // ── Post dispatcher ───────────────────────────────────────────────────────

    async _dispatchReady() {
        const ready = socialQueue.getReady();
        if (!ready.length) return;

        console.log(`[SocialScheduler] ${ready.length} post(s) ready to fire`);

        for (const item of ready) {
            try {
                let result;
                switch (item.platform) {
                    case 'bluesky':  result = await this._postBluesky(item);  break;
                    case 'x':        result = await this._postX(item);        break;
                    case 'linkedin': result = await this._postLinkedIn(item); break;
                    default:
                        socialQueue.markFailed(item.id, `Unknown platform: ${item.platform}`);
                        continue;
                }

                socialQueue.markPosted(item.id, result);
                console.log(`[SocialScheduler] ✅ ${item.platform}: "${item.text.slice(0, 60)}..."`);

                // Track Bluesky URIs for engagement scoring 2h later
                if (item.platform === 'bluesky' && result?.uri) {
                    const growth = loadGrowth();
                    growth.pending.push({
                        uri:      result.uri,
                        type:     item.type || 'post',
                        text:     item.text.slice(0, 100),
                        postedAt: Date.now(),
                    });
                    // Keep pending list bounded (last 100)
                    if (growth.pending.length > 100) growth.pending.splice(0, growth.pending.length - 100);
                    saveGrowth(growth);
                }
            } catch (e) {
                console.error(`[SocialScheduler] ❌ ${item.platform}: ${e.message}`);
                socialQueue.markFailed(item.id, e.message);
            }

            await new Promise(r => setTimeout(r, 3000));
        }
    }

    // ── Engagement scorer — runs on each tick, checks posts >= 2h old ─────────

    async _scoreMaturedPosts() {
        if (!bluesky.configured) return;

        const growth = loadGrowth();
        const due    = growth.pending.filter(p => Date.now() - p.postedAt >= SCORE_AGE);
        if (!due.length) return;

        console.log(`[SocialScheduler] 📊 Scoring ${due.length} matured post(s)...`);

        for (const entry of due) {
            try {
                const metrics = await bluesky.getPostMetrics(entry.uri);
                const score   = metrics.likeCount * 3 + metrics.repostCount * 5 + metrics.replyCount * 4 + metrics.quoteCount * 4;

                if (!growth.scores[entry.type]) {
                    growth.scores[entry.type] = { posts: 0, totalScore: 0, avgScore: 0, bestScore: 0 };
                }
                const s = growth.scores[entry.type];
                s.posts++;
                s.totalScore += score;
                s.avgScore    = parseFloat((s.totalScore / s.posts).toFixed(2));
                if (score > s.bestScore) s.bestScore = score;

                console.log(`[SocialScheduler] 📈 ${entry.type}: score=${score} (likes=${metrics.likeCount} reposts=${metrics.repostCount} replies=${metrics.replyCount}) — avg now ${s.avgScore}`);
            } catch (e) {
                console.warn(`[SocialScheduler] Metrics fetch failed for ${entry.uri}: ${e.message}`);
            }

            // Remove from pending regardless of success
            growth.pending = growth.pending.filter(p => p.uri !== entry.uri);
            await new Promise(r => setTimeout(r, 1000));
        }

        saveGrowth(growth);

        // Log current leaderboard
        const board = Object.entries(growth.scores)
            .sort((a, b) => b[1].avgScore - a[1].avgScore)
            .map(([t, s]) => `${t}(avg=${s.avgScore},n=${s.posts})`)
            .join(' | ');
        if (board) console.log(`[SocialScheduler] 🏆 Engagement leaderboard: ${board}`);
    }

    async _postBluesky(item) {
        if (!bluesky.configured) throw new Error('Bluesky not configured — set BLUESKY_IDENTIFIER + BLUESKY_PASSWORD');
        return await bluesky.post(item.text);
    }

    async _postX(item) {
        if (!this.browserArbiter) throw new Error('Browser arbiter not available');
        return await this.browserArbiter.postToX(item.text);
    }

    async _postLinkedIn(item) {
        if (!this.browserArbiter) throw new Error('Browser arbiter not available');
        return await this.browserArbiter.postToLinkedIn(item.text);
    }
}

export default SocialSchedulerDaemon;
