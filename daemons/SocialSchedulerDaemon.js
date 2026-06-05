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
import somaImageGeneration from '../server/social/SomaImageGenerationEngine.js';
import { recordSocialOutcome } from '../server/social/SocialPatternLearner.js';
import { validatePublicPost } from '../server/social/SocialContentSafety.js';
import fs           from 'fs';
import path         from 'path';

const GROWTH_FILE = path.join(process.cwd(), 'SOMA', 'social-growth.json');
const SCORE_AGE   = 2 * 3600_000; // check metrics 2h after posting
const AUTO_IMAGE_TYPES = new Set([
    'aurora_story',
    'soma_identity',
    'hot_take',
    'cross_domain',
    'generated_image_post',
    'image_post',
    'github_commit',
]);

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

function shouldAutoGenerateBlueskyImage(item) {
    if (process.env.SOMA_BLUESKY_AUTO_IMAGES === '0' || process.env.SOMA_BLUESKY_AUTO_IMAGES === 'false') return false;
    if (item.images?.length || item.media?.length || item.imagePath) return false;
    if (item.platform !== 'bluesky') return false;
    if (/https?:\/\//i.test(item.text || '')) return false;
    if (/\b(not financial advice|not medical advice|diagnosis|trade|ticker|BTC|stock|clinical|patient)\b/i.test(item.text || '')) return false;
    return AUTO_IMAGE_TYPES.has(item.type || '') || process.env.SOMA_BLUESKY_AUTO_IMAGES === 'all';
}

function socialImagePrompt(item) {
    const base = String(item.text || '').replace(/#\w+/g, '').trim();
    const publicNoText = [
        'No readable text anywhere in the image.',
        'No letters, no numbers, no title, no caption, no labels, no UI text, no signage.',
        'No book cover typography, no poster layout, no logo, no watermark.',
        'Use pure visual storytelling only.',
    ].join(' ');
    if (item.type === 'aurora_story') {
        return `A cinematic story still inspired by this SOMA Saga teaser: ${base}. Dreamlike but grounded, physical scene, atmospheric light, premium speculative fiction still. ${publicNoText}`;
    }
    if (item.type === 'soma_identity') {
        return `A symbolic portrait of SOMA as a unified cognitive architecture: ${base}. Calm violet and teal neural light, premium social image. ${publicNoText}`;
    }
    return `A thoughtful abstract social image inspired by: ${base}. Calm digital brain aesthetic, violet teal light, clean composition. ${publicNoText}`;
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
                const safety = validatePublicPost(item.text, item);
                if (!safety.ok) {
                    socialQueue.markFailed(item.id, `Unsafe public post blocked before dispatch: ${safety.reason}`);
                    console.warn(`[SocialScheduler] 🛑 Blocked unsafe ${item.platform} post: ${safety.reason}`);
                    continue;
                }

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
                        text:     item.text,
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
                const patternState = recordSocialOutcome(entry, metrics, score);

                if (!growth.scores[entry.type]) {
                    growth.scores[entry.type] = { posts: 0, totalScore: 0, avgScore: 0, bestScore: 0 };
                }
                const s = growth.scores[entry.type];
                s.posts++;
                s.totalScore += score;
                s.avgScore    = parseFloat((s.totalScore / s.posts).toFixed(2));
                if (score > s.bestScore) s.bestScore = score;

                console.log(`[SocialScheduler] 📈 ${entry.type}: score=${score} (likes=${metrics.likeCount} reposts=${metrics.repostCount} replies=${metrics.replyCount}) — avg now ${s.avgScore}; pattern samples=${patternState.samples}`);
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
        if (shouldAutoGenerateBlueskyImage(item)) {
            try {
                const generated = await somaImageGeneration.generate({
                    prompt: socialImagePrompt(item),
                    title: `${item.type || 'bluesky'} visual`,
                    width: Number(process.env.SOMA_BLUESKY_IMAGE_WIDTH || 512),
                    height: Number(process.env.SOMA_BLUESKY_IMAGE_HEIGHT || 512),
                    purpose: 'bluesky-post',
                    platform: 'bluesky',
                    publicPost: true,
                    strictArtDirector: true,
                    tags: ['bluesky', item.type || 'post'],
                });
                item.images = [{ path: generated.image.path, alt: generated.image.alt || `SOMA generated image for ${item.type || 'Bluesky post'}` }];
                console.log(`[SocialScheduler] 🖼️ Generated Bluesky image via ${generated.provider}: ${generated.image.filename}`);
            } catch (e) {
                console.warn(`[SocialScheduler] Image generation skipped; posting text-only: ${e.message}`);
            }
        }
        return await bluesky.post(item.text, { images: item.images || item.media || [] });
    }

    async _postX(item) {
        if (!this.browserArbiter) throw new Error('Browser arbiter not available');
        return await this.browserArbiter.postToX(item.text, { images: item.images || item.media || [] });
    }

    async _postLinkedIn(item) {
        if (!this.browserArbiter) throw new Error('Browser arbiter not available');
        if ((item.images || item.media || []).length) {
            throw new Error('LinkedIn image posting is not wired yet; text posting remains available');
        }
        return await this.browserArbiter.postToLinkedIn(item.text);
    }
}

export default SocialSchedulerDaemon;
