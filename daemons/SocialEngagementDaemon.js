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

const STATE_FILE   = path.join(process.cwd(), 'SOMA', 'social-engagement.json');
const MAX_SEEN_IDS = 500; // per platform, to cap file growth

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
        this.brain          = config.brain;
        this.blueskeyClient = config.blueskeyClient;
        this.linkedInClient = config.linkedInClient;
        this.browserArbiter = config.browserArbiter;
        this.state          = loadState();
    }

    setBrain(brain) { this.brain = brain; }

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

    // ── Bluesky ─────────────────────────────────────────────────────────────

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

        // Check platforms sequentially to avoid hammering all APIs at once
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
