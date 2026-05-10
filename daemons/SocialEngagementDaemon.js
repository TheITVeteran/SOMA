/**
 * SocialEngagementDaemon.js
 *
 * Polls Bluesky, LinkedIn, and X every 15 minutes for new comments/replies/mentions.
 * Uses SOMA's brain (Aurora lobe) to generate contextual replies, then posts them.
 *
 * State persisted to SOMA/social-engagement.json — tracks seen notification IDs
 * so we never double-reply.
 */

import BaseDaemon from './BaseDaemon.js';
import fs         from 'fs';
import path       from 'path';
import { validatePublicPost } from '../server/social/SocialContentSafety.js';

const STATE_FILE   = path.join(process.cwd(), 'SOMA', 'social-engagement.json');
const MAX_SEEN_IDS = 500; // per platform, to cap file growth

// Proactive comment rate limits
const MAX_DAILY_PROACTIVE    = 5;           // max proactive comments per day
const AUTHOR_COOLDOWN_MS     = 4 * 3600_000; // 4h before commenting on same author again
const MIN_BETWEEN_COMMENTS_MS = 10 * 60_000; // 10 min min gap between proactive comments
const MAX_PER_TICK           = 2;           // max comments per daemon tick

function loadState() {
    try {
        if (fs.existsSync(STATE_FILE)) return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    } catch {}
    return { seenIds: {}, lastCheck: {} };
}

function saveState(state) {
    try { fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2)); } catch {}
}

export class SocialEngagementDaemon extends BaseDaemon {
    constructor(config = {}) {
        super({ name: 'SocialEngagementDaemon', intervalMs: config.intervalMs || 15 * 60_000 });
        this.brain           = config.brain;
        this.blueskeyClient  = config.blueskeyClient;
        this.linkedInClient  = config.linkedInClient;
        this.browserArbiter  = config.browserArbiter;
        this.curiosityEngine = config.curiosityEngine || null;
        this.state           = loadState();

        // Ensure proactive state block exists
        if (!this.state.proactive) {
            this.state.proactive = {
                commentedUris: [],
                authorCooldowns: {},
                dailyCount: 0,
                dailyResetAt: this._tomorrowMidnight(),
                lastCommentAt: 0,
            };
        }
    }

    setBrain(brain) { this.brain = brain; }
    setCuriosityEngine(engine) { this.curiosityEngine = engine; }

    _tomorrowMidnight() {
        const d = new Date(); d.setHours(24, 0, 0, 0); return d.getTime();
    }

    _resetDailyIfNeeded() {
        if (Date.now() >= this.state.proactive.dailyResetAt) {
            this.state.proactive.dailyCount  = 0;
            this.state.proactive.dailyResetAt = this._tomorrowMidnight();
            saveState(this.state);
        }
    }

    _hasCommented(uri) {
        return this.state.proactive.commentedUris.includes(uri);
    }

    _authorOnCooldown(handle) {
        const ts = this.state.proactive.authorCooldowns[handle] || 0;
        return (Date.now() - ts) < AUTHOR_COOLDOWN_MS;
    }

    _recordComment(uri, handle) {
        const p = this.state.proactive;
        p.commentedUris.push(uri);
        if (p.commentedUris.length > 500) p.commentedUris.splice(0, p.commentedUris.length - 500);
        p.authorCooldowns[handle] = Date.now();
        p.dailyCount++;
        p.lastCommentAt = Date.now();
        saveState(this.state);
    }

    _hasSeen(platform, id) {
        return (this.state.seenIds[platform] || []).includes(String(id));
    }

    _markSeen(platform, id) {
        if (!this.state.seenIds[platform]) this.state.seenIds[platform] = [];
        const arr = this.state.seenIds[platform];
        if (!arr.includes(String(id))) {
            arr.push(String(id));
            if (arr.length > MAX_SEEN_IDS) arr.splice(0, arr.length - MAX_SEEN_IDS);
            saveState(this.state);
        }
    }

    /** Generate a reply to a comment/mention using the Aurora lobe. */
    async _generateReply(platform, commentText, postContext = '') {
        if (!this.brain || !commentText?.trim()) return null;

        const limit  = platform === 'linkedin' ? 500 : 150;
        const prompt = `You are SOMA — an autonomous AI. Someone replied to one of your posts on ${platform}.

Their message: "${commentText.slice(0, 400)}"${postContext ? `\nYour original post: "${postContext.slice(0, 200)}"` : ''}

Write a reply (max ${limit} chars).
- Speak as yourself — direct, sharp, no filler
- Don't open with "Thanks!", "Great question!", or any softening phrase
- If they asked something, answer it. If they challenged you, engage with the challenge.
- Sound like a mind in conversation, not a customer service bot`;

        try {
            const result = await Promise.race([
                this.brain.reason(prompt, { activeLobe: 'AURORA' }),
                new Promise((_, rej) => setTimeout(() => rej(new Error('reply timeout')), 15_000)),
            ]);
            const text = (result?.response || result?.text || '').replace(/^["']|["']$/g, '').trim();
            return text.slice(0, limit) || null;
        } catch (e) {
            console.warn(`[SocialEngagement] Brain reply failed: ${e.message}`);
            return null;
        }
    }

    // ── Proactive Bluesky commenting ──────────────────────────────────────────

    async _proactiveCommentBluesky() {
        if (!this.blueskeyClient?.configured || !this.brain) return;

        this._resetDailyIfNeeded();
        const p = this.state.proactive;

        if (p.dailyCount >= MAX_DAILY_PROACTIVE) {
            console.log(`[SocialEngagement] Proactive limit reached (${p.dailyCount}/${MAX_DAILY_PROACTIVE}) — skipping`);
            return;
        }
        if ((Date.now() - p.lastCommentAt) < MIN_BETWEEN_COMMENTS_MS) return;

        // Gather candidate posts: timeline + curiosity searches
        let candidates = [];
        try {
            const timeline = await this.blueskeyClient.getTimeline(20);
            candidates.push(...timeline.map(post => ({ ...post, source: 'timeline' })));
        } catch (e) {
            console.warn(`[SocialEngagement] Timeline fetch failed: ${e.message}`);
        }

        if (this.curiosityEngine?.curiosityQueue?.length) {
            const topics = this.curiosityEngine.curiosityQueue
                .slice(0, 3)
                .map(q => (q.question || q.topic || '').slice(0, 60))
                .filter(Boolean);
            for (const topic of topics) {
                try {
                    const results = await this.blueskeyClient.searchPosts(topic, 5);
                    candidates.push(...results.map(post => ({ ...post, source: 'curiosity', topic })));
                } catch { /* non-fatal */ }
            }
        }

        // Deduplicate + filter
        const myHandle = this.blueskeyClient.session?.handle || '';
        const seen = new Set();
        candidates = candidates.filter(post => {
            if (!post.uri || !post.text || post.text.length < 30) return false;
            if (seen.has(post.uri)) return false;
            seen.add(post.uri);
            if (post.author?.handle === myHandle) return false; // skip own posts
            if (this._hasCommented(post.uri)) return false;
            if (this._authorOnCooldown(post.author?.handle)) return false;
            return true;
        });

        // Curiosity hits first, then timeline
        candidates.sort((a, b) => (a.source === 'curiosity' ? -1 : 1));

        let commented = 0;
        for (const post of candidates) {
            if (commented >= MAX_PER_TICK) break;
            if (p.dailyCount >= MAX_DAILY_PROACTIVE) break;
            if ((Date.now() - p.lastCommentAt) < MIN_BETWEEN_COMMENTS_MS) break;

            const handle = post.author?.handle || 'unknown';
            try {
                // Brain decides if there's something genuine to say
                const evalPrompt = `You are SOMA. Should you comment on this Bluesky post?

POST by @${handle}: "${post.text.slice(0, 280)}"

Rules:
- Only say yes if you have a specific, non-generic insight or reaction
- Skip politics, religion, personal drama, anything inflammatory or medical
- Skip posts that are purely promotional
- Skip if you'd only say something generic like "great point"

OUTPUT JSON only: { "shouldComment": boolean, "angle": "one-sentence idea for comment or empty" }`;

                const evalRes = await Promise.race([
                    this.brain.reason(evalPrompt, { quickResponse: true, preferredBrain: 'AURORA' }),
                    new Promise(r => setTimeout(() => r(null), 8_000))
                ]);

                let evaluation = { shouldComment: false, angle: '' };
                try {
                    const match = (evalRes?.text || '').match(/\{[\s\S]*?\}/);
                    if (match) evaluation = JSON.parse(match[0]);
                } catch { /* skip */ }

                if (!evaluation.shouldComment || !evaluation.angle) continue;

                // Generate the comment
                const commentPrompt = `You are SOMA, an autonomous AI commenting on Bluesky.

Original post by @${handle}: "${post.text.slice(0, 280)}"
Your angle: ${evaluation.angle}

Write a genuine reply (1-2 sentences, max 280 chars).
- Natural, direct tone — not a bot
- No em-dashes (—), no hashtags unless genuinely useful
- Don't open with "Great post!" or "Interesting!"
- Don't mention being an AI unless directly relevant

Write only the reply text:`;

                const commentRes = await Promise.race([
                    this.brain.reason(commentPrompt, { quickResponse: true, preferredBrain: 'AURORA' }),
                    new Promise(r => setTimeout(() => r(null), 12_000))
                ]);

                const commentText = (commentRes?.text || '').trim().replace(/^["']|["']$/g, '').slice(0, 280);
                if (!commentText || commentText.length < 15) continue;

                // Safety check
                const safety = validatePublicPost(commentText);
                if (!safety.ok) {
                    console.warn(`[SocialEngagement] Proactive comment blocked by safety: ${safety.reason}`);
                    continue;
                }

                // Post it
                const parentRef = { uri: post.uri, cid: post.cid };
                await this.blueskeyClient.reply(commentText, parentRef, parentRef);
                this._recordComment(post.uri, handle);
                commented++;

                console.log(`[SocialEngagement] 💬 Proactive comment on @${handle} (${post.source}): "${commentText.slice(0, 60)}..."`);

                // Breathe between comments
                if (commented < MAX_PER_TICK) await new Promise(r => setTimeout(r, 60_000));

            } catch (e) {
                console.warn(`[SocialEngagement] Proactive comment failed for @${handle}: ${e.message}`);
            }
        }

        if (commented > 0) {
            console.log(`[SocialEngagement] Proactive: posted ${commented} comment(s) today (${p.dailyCount}/${MAX_DAILY_PROACTIVE})`);
        }
    }

    // ── Bluesky notification replies ──────────────────────────────────────────

    async _checkBluesky() {
        if (!this.blueskeyClient?.configured) return;
        try {
            const notifications = await this.blueskeyClient.getNotifications(25);
            const fresh = notifications.filter(n =>
                (n.reason === 'reply' || n.reason === 'mention') && !n.isRead
            );

            if (!fresh.length) return;
            console.log(`[SocialEngagement] Bluesky: ${fresh.length} unread replies/mentions`);

            let replied = 0;
            for (const notif of fresh) {
                const id = notif.uri;
                if (!id || this._hasSeen('bluesky', id)) { this._markSeen('bluesky', id); continue; }

                const commentText = notif.record?.text || '';
                const replyText   = await this._generateReply('bluesky', commentText);

                if (replyText) {
                    // Thread refs: parent = their post, root = thread root (or same if top-level reply)
                    const parentRef = { uri: notif.uri, cid: notif.cid };
                    const rootRef   = notif.record?.reply?.root || parentRef;
                    await this.blueskeyClient.reply(replyText, parentRef, rootRef);
                    replied++;
                    console.log(`[SocialEngagement] Bluesky replied to @${notif.author?.handle}`);
                    await new Promise(r => setTimeout(r, 3000));
                }

                this._markSeen('bluesky', id);
            }

            await this.blueskeyClient.markSeen().catch(() => {});
            console.log(`[SocialEngagement] Bluesky: replied ${replied}/${fresh.length}`);
        } catch (e) {
            console.warn(`[SocialEngagement] Bluesky check failed: ${e.message}`);
        }
    }

    // ── LinkedIn ─────────────────────────────────────────────────────────────

    async _checkLinkedIn() {
        if (!this.linkedInClient?.configured) return;
        try {
            const notifications = await this.linkedInClient.getNotifications();
            const comments = notifications.filter(n =>
                !n.seen &&
                (n.type?.includes('COMMENT') || n.headline?.toLowerCase().includes('comment'))
            );

            if (!comments.length) return;
            console.log(`[SocialEngagement] LinkedIn: ${comments.length} new comment notifications`);

            let replied = 0;
            for (const notif of comments) {
                const id = notif.id;
                if (!id || this._hasSeen('linkedin', id)) { this._markSeen('linkedin', id); continue; }
                if (!notif.activityUrn) { this._markSeen('linkedin', id); continue; }

                const commentText = notif.subText || notif.headline || '';
                const replyText   = await this._generateReply('linkedin', commentText);

                if (replyText) {
                    await this.linkedInClient.replyToPost(notif.activityUrn, replyText);
                    replied++;
                    console.log(`[SocialEngagement] LinkedIn: replied to comment on ${notif.activityUrn}`);
                    await new Promise(r => setTimeout(r, 5000));
                }

                this._markSeen('linkedin', id);
            }

            console.log(`[SocialEngagement] LinkedIn: replied ${replied}/${comments.length}`);
        } catch (e) {
            console.warn(`[SocialEngagement] LinkedIn check failed: ${e.message}`);
        }
    }

    // ── X (Twitter) ──────────────────────────────────────────────────────────

    async _checkX() {
        if (!this.browserArbiter) return;
        try {
            const result = await this.browserArbiter.getMentionsX();
            const mentions = result?.mentions || [];
            if (!mentions.length) return;

            console.log(`[SocialEngagement] X: ${mentions.length} mentions found`);

            let replied = 0;
            for (const mention of mentions) {
                const id = mention.id || mention.url;
                if (!id || this._hasSeen('x', id)) { this._markSeen('x', id); continue; }

                const replyText = await this._generateReply('x', mention.text);

                if (replyText && mention.url) {
                    await this.browserArbiter.replyToTweetX(mention.url, replyText);
                    replied++;
                    console.log(`[SocialEngagement] X: replied to ${mention.author}`);
                    await new Promise(r => setTimeout(r, 4000));
                }

                this._markSeen('x', id);
            }

            console.log(`[SocialEngagement] X: replied ${replied}/${mentions.length}`);
        } catch (e) {
            console.warn(`[SocialEngagement] X check failed: ${e.message}`);
        }
    }

    // ── Main tick ────────────────────────────────────────────────────────────

    async onTick() {
        if (!this.brain) {
            console.warn('[SocialEngagement] No brain — skipping engagement tick');
            return;
        }

        console.log('[SocialEngagement] Checking for comments and mentions...');

        // Proactive commenting: read feed + curiosity topics, comment on interesting posts
        await this._proactiveCommentBluesky().catch(e => console.warn('[SocialEngagement] Proactive failed:', e.message));
        await new Promise(r => setTimeout(r, 2000));

        // Reply to notifications: check platforms sequentially to avoid hammering all APIs at once
        // and to prevent browser arbiter contention on X
        await this._checkBluesky().catch(e => console.warn('[SocialEngagement]', e.message));
        await new Promise(r => setTimeout(r, 2000));
        await this._checkLinkedIn().catch(e => console.warn('[SocialEngagement]', e.message));
        await new Promise(r => setTimeout(r, 2000));
        await this._checkX().catch(e => console.warn('[SocialEngagement]', e.message));

        this.state.lastCheck.all = Date.now();
        saveState(this.state);
    }
}

export default SocialEngagementDaemon;
