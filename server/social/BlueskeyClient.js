/**
 * BlueskeyClient.js
 * AT Protocol client for Bluesky.
 * Uses a child process (bluesky_worker.mjs) to isolate HTTP calls from
 * SOMA's main process, which has Windows Defender HTTPS interference.
 * Session persisted to SOMA/.bluesky-session.json (2h TTL, auto-refresh).
 *
 * Env vars: BLUESKY_IDENTIFIER (handle or email), BLUESKY_PASSWORD (app password)
 */

import fs   from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname    = path.dirname(fileURLToPath(import.meta.url));
const WORKER       = path.join(__dirname, 'bluesky_worker.mjs');
const SESSION_FILE = path.join(process.cwd(), 'SOMA', '.bluesky-session.json');

function loadSession() {
    try {
        if (fs.existsSync(SESSION_FILE)) return JSON.parse(fs.readFileSync(SESSION_FILE, 'utf8'));
    } catch {}
    return null;
}

function saveSession(data) {
    try {
        fs.mkdirSync(path.dirname(SESSION_FILE), { recursive: true });
        fs.writeFileSync(SESSION_FILE, JSON.stringify(data));
    } catch {}
}

/** Run a task in the isolated child process. */
function runWorker(task) {
    return new Promise((resolve, reject) => {
        const child = spawn(process.execPath, [WORKER], {
            stdio: ['pipe', 'pipe', 'pipe'],
            env:   { ...process.env },   // inherit env (for any future keys)
        });

        let out = '';
        let err = '';
        child.stdout.on('data', d => out += d);
        child.stderr.on('data', d => err += d);

        child.on('error', reject);
        child.on('close', (code) => {
            try {
                const parsed = JSON.parse(out);
                if (!parsed.ok) reject(new Error(parsed.error || 'Worker error'));
                else resolve(parsed.data);
            } catch {
                reject(new Error(`Worker bad output (exit ${code}): ${err || out}`));
            }
        });

        child.stdin.write(JSON.stringify(task));
        child.stdin.end();

        // Worker-level timeout
        setTimeout(() => {
            child.kill();
            reject(new Error('Bluesky worker timed out after 45s'));
        }, 45_000);
    });
}

/** Extract hashtag facets for the AT Protocol richtext spec. */
function buildFacets(text) {
    const facets = [];
    for (let i = 0; i < text.length; ) {
        if (text[i] === '#') {
            const tagStart = i;
            let j = i + 1;
            while (j < text.length && /\w/.test(text[j])) j++;
            const tag = text.slice(tagStart + 1, j);
            if (tag.length > 0) {
                const byteStart = Buffer.from(text.slice(0, tagStart), 'utf8').length;
                const byteEnd   = Buffer.from(text.slice(0, j), 'utf8').length;
                facets.push({
                    $type:    'app.bsky.richtext.facet',
                    index:    { byteStart, byteEnd },
                    features: [{ $type: 'app.bsky.richtext.facet#tag', tag }],
                });
            }
            i = j;
        } else {
            i++;
        }
    }
    return facets;
}

function buildLinkFacets(text) {
    const facets = [];
    const urlRe  = /https?:\/\/[^\s)>\]"']+/g;
    let   m;
    while ((m = urlRe.exec(text)) !== null) {
        const byteStart = Buffer.from(text.slice(0, m.index), 'utf8').length;
        const byteEnd   = Buffer.from(text.slice(0, m.index + m[0].length), 'utf8').length;
        facets.push({
            $type:    'app.bsky.richtext.facet',
            index:    { byteStart, byteEnd },
            features: [{ $type: 'app.bsky.richtext.facet#link', uri: m[0] }],
        });
    }
    return facets;
}

function normalizeImages(images) {
    const raw = Array.isArray(images) ? images : images ? [images] : [];
    return raw
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

export class BlueskeyClient {
    constructor() {
        this.session   = loadSession();
        this.expiresAt = this.session?.expiresAt || 0;
    }

    get configured() {
        return !!(process.env.BLUESKY_IDENTIFIER && process.env.BLUESKY_PASSWORD);
    }

    async _ensureSession() {
        if (this.session && Date.now() < this.expiresAt - 60_000) return;

        const identifier = process.env.BLUESKY_IDENTIFIER?.trim();
        const password   = process.env.BLUESKY_PASSWORD?.trim();

        if (!identifier || !password) {
            throw new Error('BLUESKY_IDENTIFIER and BLUESKY_PASSWORD env vars required');
        }

        // Try refresh if session was created within the last 24h
        const sessionAge = this.expiresAt ? Date.now() - (this.expiresAt - 7_200_000) : Infinity;
        if (this.session?.refreshJwt && sessionAge < 86_400_000) {
            try {
                const data = await runWorker({ type: 'refreshSession', refreshJwt: this.session.refreshJwt });
                this.session   = { ...data, expiresAt: Date.now() + 7_200_000 };
                this.expiresAt = this.session.expiresAt;
                saveSession(this.session);
                return;
            } catch {}
        }

        // Full login
        this.session   = null;
        this.expiresAt = 0;
        const data = await runWorker({ type: 'login', identifier, password });
        this.session   = { ...data, expiresAt: Date.now() + 7_200_000 };
        this.expiresAt = this.session.expiresAt;
        saveSession(this.session);
    }

    /** Post to Bluesky. Returns { uri, cid } on success. */
    async post(text, options = {}) {
        await this._ensureSession();
        const facets = [...buildFacets(text), ...buildLinkFacets(text)];
        return await runWorker({
            type:   'post',
            text:   text.slice(0, 300),
            facets: facets.length ? facets : undefined,
            images: normalizeImages(options.images || options.imagePath),
            did:    this.session.did,
            token:  this.session.accessJwt,
        });
    }

    /** Reply to a post. parentRef = { uri, cid }. rootRef = same or the thread root. */
    async reply(text, parentRef, rootRef) {
        await this._ensureSession();
        const facets   = [...buildFacets(text), ...buildLinkFacets(text)];
        const replyRef = { root: rootRef || parentRef, parent: parentRef };
        return await runWorker({
            type:     'reply',
            text:     text.slice(0, 300),
            facets:   facets.length ? facets : undefined,
            replyRef,
            did:      this.session.did,
            token:    this.session.accessJwt,
        });
    }

    /** Get recent notifications (replies, mentions, likes). */
    async getNotifications(limit = 20) {
        await this._ensureSession();
        const data = await runWorker({ type: 'getNotifications', limit, token: this.session.accessJwt });
        return data.notifications || [];
    }

    /** Mark notifications as seen. */
    async markSeen() {
        await this._ensureSession();
        await runWorker({ type: 'markSeen', token: this.session.accessJwt });
    }

    /** Get like/repost/reply counts for a post URI. */
    async getPostMetrics(uri) {
        await this._ensureSession();
        return await runWorker({ type: 'getPostMetrics', uri, token: this.session.accessJwt });
    }
}

export default new BlueskeyClient();
