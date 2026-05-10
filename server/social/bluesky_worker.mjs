#!/usr/bin/env node
/**
 * bluesky_worker.mjs
 * Standalone child process for Bluesky AT Protocol calls.
 * Reads a JSON task from stdin, writes a JSON result to stdout.
 * Runs in a clean process, unaffected by SOMA's main process state.
 *
 * Task types: login, post, reply, getNotifications, markSeen, refreshSession, getTimeline, searchPosts
 */

import https from 'https';
import fs from 'fs';
import path from 'path';

const PDS = 'bsky.social';

const IMAGE_MIME = {
    '.png':  'image/png',
    '.jpg':  'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.gif':  'image/gif',
};

function xrpc(method, endpoint, body, token, contentType = 'application/json') {
    return new Promise((resolve, reject) => {
        const data    = Buffer.isBuffer(body) ? body : body ? JSON.stringify(body) : null;
        const headers = { 'Content-Type': contentType };
        if (token) headers.Authorization = `Bearer ${token}`;
        if (data)  headers['Content-Length'] = Buffer.isBuffer(data) ? data.length : Buffer.byteLength(data);

        const options = {
            hostname: PDS,
            port:     443,
            path:     `/xrpc/${endpoint}`,
            method,
            headers,
            timeout:  20000,
        };

        const req = https.request(options, (res) => {
            let raw = '';
            res.on('data', d => raw += d);
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(raw);
                    if (res.statusCode >= 400) reject(new Error(`HTTP ${res.statusCode}: ${parsed.message || raw.slice(0, 200)}`));
                    else resolve(parsed);
                } catch {
                    if (res.statusCode >= 400) reject(new Error(`HTTP ${res.statusCode}: ${raw.slice(0, 200)}`));
                    else resolve({ raw });
                }
            });
        });

        req.on('error',   reject);
        req.on('timeout', () => { req.destroy(); reject(new Error('Request timed out')); });
        if (data) req.write(data);
        req.end();
    });
}

function resolveImagePath(inputPath) {
    if (!inputPath || /^https?:\/\//i.test(inputPath)) {
        throw new Error('Bluesky image posts require a local image path');
    }
    return path.isAbsolute(inputPath) ? inputPath : path.resolve(process.cwd(), inputPath);
}

async function uploadImages(images = [], token) {
    const uploads = [];
    for (const item of images.slice(0, 4)) {
        const fullPath = resolveImagePath(item.path);
        if (!fs.existsSync(fullPath)) throw new Error(`Image not found: ${item.path}`);

        const ext = path.extname(fullPath).toLowerCase();
        const mime = IMAGE_MIME[ext];
        if (!mime) throw new Error(`Unsupported Bluesky image type: ${ext || 'unknown'}`);

        const data = fs.readFileSync(fullPath);
        if (data.length > 1_000_000) {
            throw new Error(`Bluesky image is too large (${Math.round(data.length / 1024)}KB). Keep images under 1MB.`);
        }

        const uploaded = await xrpc('POST', 'com.atproto.repo.uploadBlob', data, token, mime);
        uploads.push({
            alt: String(item.alt || '').slice(0, 1000),
            image: uploaded.blob,
        });
    }
    return uploads;
}

async function run() {
    let raw = '';
    for await (const chunk of process.stdin) raw += chunk;
    const task = JSON.parse(raw);

    let result;
    switch (task.type) {
        case 'login':
            result = await xrpc('POST', 'com.atproto.server.createSession',
                { identifier: task.identifier, password: task.password });
            break;

        case 'refreshSession':
            result = await xrpc('POST', 'com.atproto.server.refreshSession',
                null, task.refreshJwt);
            break;

        case 'post':
        case 'reply': {
            const record = {
                $type:     'app.bsky.feed.post',
                text:      task.text.slice(0, 300),
                createdAt: new Date().toISOString(),
            };
            if (task.facets?.length)  record.facets = task.facets;
            if (task.replyRef)        record.reply  = task.replyRef;
            if (task.images?.length) {
                const images = await uploadImages(task.images, task.token);
                if (images.length) {
                    record.embed = {
                        $type: 'app.bsky.embed.images',
                        images,
                    };
                }
            }
            result = await xrpc('POST', 'com.atproto.repo.createRecord', {
                repo: task.did, collection: 'app.bsky.feed.post', record
            }, task.token);
            break;
        }

        case 'getNotifications':
            result = await xrpc('GET', `app.bsky.notification.listNotifications?limit=${task.limit || 20}`,
                null, task.token);
            break;

        case 'markSeen':
            result = await xrpc('POST', 'app.bsky.notification.updateSeen',
                { seenAt: new Date().toISOString() }, task.token);
            break;

        case 'getPostMetrics': {
            const encoded = encodeURIComponent(task.uri);
            result = await xrpc('GET', `app.bsky.feed.getPosts?uris=${encoded}`, null, task.token);
            const p = result?.posts?.[0];
            result = {
                uri:          task.uri,
                likeCount:    p?.likeCount    || 0,
                repostCount:  p?.repostCount  || 0,
                replyCount:   p?.replyCount   || 0,
                quoteCount:   p?.quoteCount   || 0,
            };
            break;
        }

        case 'getTimeline':
            result = await xrpc('GET', `app.bsky.feed.getTimeline?limit=${task.limit || 20}`, null, task.token);
            break;

        case 'searchPosts': {
            const q = encodeURIComponent(task.query || '');
            result = await xrpc('GET', `app.bsky.feed.searchPosts?q=${q}&limit=${task.limit || 15}`, null, task.token);
            break;
        }

        default:
            throw new Error(`Unknown task type: ${task.type}`);
    }

    process.stdout.write(JSON.stringify({ ok: true, data: result }));
}

run().catch(e => {
    process.stdout.write(JSON.stringify({ ok: false, error: e.message }));
    process.exit(1);
});
