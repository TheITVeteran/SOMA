/**
 * SocialQueue.js
 * Simple JSON file queue for scheduled social media posts.
 * SOMA/social-queue.json — persisted between restarts.
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { assertPublicPost } from './SocialContentSafety.js';

const QUEUE_FILE = path.join(process.cwd(), 'SOMA', 'social-queue.json');
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // drop unposted items after 7 days

function load() {
    try {
        if (fs.existsSync(QUEUE_FILE)) return JSON.parse(fs.readFileSync(QUEUE_FILE, 'utf8'));
    } catch {}
    return [];
}

function save(items) {
    try {
        fs.mkdirSync(path.dirname(QUEUE_FILE), { recursive: true });
        fs.writeFileSync(QUEUE_FILE, JSON.stringify(items, null, 2));
    } catch (e) {
        console.error('[SocialQueue] save failed:', e.message);
    }
}

function normalizeImages(input) {
    const raw = Array.isArray(input) ? input : input ? [input] : [];
    return raw
        .map(item => {
            if (typeof item === 'string') return { path: item };
            if (item && typeof item === 'object') {
                return {
                    path: item.path || item.imagePath || item.file || item.url,
                    alt:  item.alt || item.imageAlt || '',
                };
            }
            return null;
        })
        .filter(item => item?.path)
        .slice(0, 4);
}

function hash(text, images = []) {
    const mediaKey = images.map(i => `${i.path}:${i.alt || ''}`).join('|');
    return crypto.createHash('sha1').update(`${text}\n${mediaKey}`).digest('hex').slice(0, 12);
}

export class SocialQueue {
    /** Add a post to the queue. Returns false if duplicate. */
    push({ platform, text, scheduledFor, type = 'post', images, imagePath, imageAlt }) {
        assertPublicPost(text, { type, platform });
        const items = load();
        const normalizedImages = normalizeImages(images || (imagePath ? [{ path: imagePath, alt: imageAlt }] : []));
        const h     = hash(text, normalizedImages);
        if (items.some(i => i.contentHash === h)) return false;

        items.push({
            id:          `sq-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            platform,
            text,
            images:       normalizedImages,
            type,
            scheduledFor: scheduledFor || Date.now(),
            contentHash:  h,
            createdAt:    Date.now(),
            postedAt:     null,
        });
        save(items);
        return true;
    }

    /** Get all items whose scheduledFor <= now and haven't been posted. */
    getReady() {
        const now   = Date.now();
        const items = load();
        return items.filter(i => !i.postedAt && !i.failed && i.scheduledFor <= now);
    }

    /** Mark an item as posted. */
    markPosted(id, result = {}) {
        const items = load();
        const item  = items.find(i => i.id === id);
        if (item) { item.postedAt = Date.now(); item.postResult = result; }
        save(items);
    }

    /** Mark an item as failed (keeps it in queue for inspection but won't retry). */
    markFailed(id, error) {
        const items = load();
        const item  = items.find(i => i.id === id);
        if (item) { item.failed = true; item.failedAt = Date.now(); item.error = String(error); }
        save(items);
    }

    /** Remove items older than MAX_AGE_MS that are already posted or failed. */
    cleanup() {
        const cutoff = Date.now() - MAX_AGE_MS;
        const items  = load().filter(i => {
            if ((i.postedAt || i.failed) && i.createdAt < cutoff) return false;
            return true;
        });
        save(items);
        return items.length;
    }

    /** How many posts scheduled for a given platform today. */
    countTodayFor(platform) {
        const midnight = new Date(); midnight.setHours(0,0,0,0);
        return load().filter(i =>
            i.platform === platform &&
            i.scheduledFor >= midnight.getTime() &&
            !i.failed
        ).length;
    }

    getAll() { return load(); }
    getPending() { return load().filter(i => !i.postedAt && !i.failed); }
}

export default new SocialQueue();
