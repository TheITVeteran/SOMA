#!/usr/bin/env node
/**
 * bluesky_worker.mjs
 * Standalone child process for Bluesky AT Protocol calls.
 * Reads a JSON task from stdin, writes a JSON result to stdout.
 * Runs in a clean process, unaffected by SOMA's main process state.
 *
 * Task types: login, post, reply, getNotifications, markSeen, refreshSession
 */

import https from 'https';

const PDS = 'bsky.social';

function xrpc(method, endpoint, body, token) {
    return new Promise((resolve, reject) => {
        const data    = body ? JSON.stringify(body) : null;
        const headers = { 'Content-Type': 'application/json' };
        if (token) headers.Authorization = `Bearer ${token}`;
        if (data)  headers['Content-Length'] = Buffer.byteLength(data);

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

        default:
            throw new Error(`Unknown task type: ${task.type}`);
    }

    process.stdout.write(JSON.stringify({ ok: true, data: result }));
}

run().catch(e => {
    process.stdout.write(JSON.stringify({ ok: false, error: e.message }));
    process.exit(1);
});
