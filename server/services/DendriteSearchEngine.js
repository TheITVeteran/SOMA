import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';

const DEFAULT_DB_PATH = path.resolve(process.cwd(), 'data', 'aperture', 'dendrite-search.db');

function ensureDir(filePath) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function normalizeText(value = '') {
    return String(value || '').replace(/\s+/g, ' ').trim();
}

function searchTerms(value = '') {
    return [...new Set(String(value).toLowerCase().match(/[a-z0-9]{2,}/g) || [])].slice(0, 12);
}

function ftsQuery(value = '') {
    return searchTerms(value).map(term => `"${term.replace(/"/g, '""')}"*`).join(' OR ');
}

function fallbackSnippet(content = '', terms = []) {
    const text = normalizeText(content);
    const lower = text.toLowerCase();
    const location = terms.map(term => lower.indexOf(term)).find(index => index >= 0) ?? 0;
    const start = Math.max(0, location - 60);
    const snippet = text.slice(start, start + 280);
    return start > 0 ? `...${snippet}` : snippet;
}

export class DendriteSearchEngine {
    constructor(options = {}) {
        this.dbPath = options.dbPath || DEFAULT_DB_PATH;
        this.legacyJsonPath = options.legacyJsonPath || null;
        ensureDir(this.dbPath);
        this.db = new Database(this.dbPath);
        this.db.pragma('journal_mode = WAL');
        this.ftsReady = false;
        this.init();
    }

    init() {
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS dendrite_pages (
                id TEXT PRIMARY KEY,
                url TEXT NOT NULL UNIQUE,
                title TEXT NOT NULL,
                content TEXT NOT NULL,
                source TEXT DEFAULT 'unknown',
                hash TEXT DEFAULT '',
                metadata TEXT DEFAULT '{}',
                indexed_at TEXT NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_dendrite_pages_indexed_at ON dendrite_pages(indexed_at DESC);
            CREATE INDEX IF NOT EXISTS idx_dendrite_pages_source ON dendrite_pages(source);
        `);

        try {
            this.db.exec(`
                CREATE VIRTUAL TABLE IF NOT EXISTS dendrite_pages_fts USING fts5(
                    id UNINDEXED,
                    title,
                    url,
                    content,
                    source
                );
            `);
            this.ftsReady = true;
        } catch (error) {
            this.ftsReady = false;
            console.warn('[DendriteSearch] FTS5 unavailable, using LIKE search:', error.message);
        }

        if (this.legacyJsonPath) this.importLegacyJson(this.legacyJsonPath);
    }

    count() {
        return this.db.prepare('SELECT COUNT(*) AS n FROM dendrite_pages').get().n;
    }

    stats() {
        const bySource = this.db.prepare(`
            SELECT source, COUNT(*) AS count
            FROM dendrite_pages
            GROUP BY source
            ORDER BY count DESC
        `).all();
        const latest = this.db.prepare('SELECT MAX(indexed_at) AS latest FROM dendrite_pages').get()?.latest || null;
        return { indexedPages: this.count(), latestIndexedAt: latest, bySource };
    }

    importLegacyJson(jsonPath) {
        if (!fs.existsSync(jsonPath)) return { imported: 0 };
        let value;
        try {
            value = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
        } catch {
            return { imported: 0 };
        }
        const pages = Array.isArray(value.pages) ? value.pages : [];
        let imported = 0;
        const existing = this.db.prepare('SELECT id FROM dendrite_pages WHERE url = ?');
        const tx = this.db.transaction(() => {
            for (const page of pages) {
                if (!page?.url || !page?.content || existing.get(page.url)) continue;
                this.indexPage(page);
                imported++;
            }
        });
        tx();
        return { imported };
    }

    indexPage(page = {}) {
        const id = page.id || Buffer.from(String(page.url || '')).toString('base64url').slice(0, 80);
        const url = String(page.url || '').trim();
        const title = normalizeText(page.title || url).slice(0, 250);
        const content = normalizeText(page.content).slice(0, 120000);
        if (!id || !url || !content) throw new Error('id, url, and content are required');

        const source = String(page.source || 'unknown').slice(0, 80);
        const hash = String(page.hash || '').slice(0, 128);
        const metadata = JSON.stringify(page.metadata || {});
        const indexedAt = page.indexedAt || page.indexed_at || new Date().toISOString();

        this.db.prepare(`
            INSERT INTO dendrite_pages (id, url, title, content, source, hash, metadata, indexed_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(url) DO UPDATE SET
                id = excluded.id,
                title = excluded.title,
                content = excluded.content,
                source = excluded.source,
                hash = excluded.hash,
                metadata = excluded.metadata,
                indexed_at = excluded.indexed_at
        `).run(id, url, title, content, source, hash, metadata, indexedAt);

        if (this.ftsReady) {
            this.db.prepare('DELETE FROM dendrite_pages_fts WHERE id = ?').run(id);
            this.db.prepare(`
                INSERT INTO dendrite_pages_fts (id, title, url, content, source)
                VALUES (?, ?, ?, ?, ?)
            `).run(id, title, url, content, source);
        }

        return this.getPage(id);
    }

    indexPages(pages = []) {
        let indexed = 0;
        const tx = this.db.transaction(() => {
            for (const page of pages) {
                this.indexPage(page);
                indexed++;
            }
        });
        tx();
        return indexed;
    }

    getPage(id) {
        const row = this.db.prepare('SELECT * FROM dendrite_pages WHERE id = ?').get(id);
        return row ? this.rowToPage(row, true) : null;
    }

    listPages(limit = 100) {
        return this.db.prepare(`
            SELECT id, url, title, source, hash, metadata, indexed_at, length(content) AS content_length
            FROM dendrite_pages
            ORDER BY indexed_at DESC
            LIMIT ?
        `).all(Math.min(Number(limit) || 100, 500)).map(row => ({
            id: row.id,
            url: row.url,
            title: row.title,
            source: row.source,
            hash: row.hash,
            metadata: this.parseMetadata(row.metadata),
            indexedAt: row.indexed_at,
            contentLength: row.content_length
        }));
    }

    deletePage(id) {
        const result = this.db.prepare('DELETE FROM dendrite_pages WHERE id = ?').run(id);
        if (this.ftsReady) this.db.prepare('DELETE FROM dendrite_pages_fts WHERE id = ?').run(id);
        return result.changes > 0;
    }

    search(query, limit = 15) {
        const terms = searchTerms(query);
        if (!terms.length) return [];
        const max = Math.min(Number(limit) || 15, 50);

        if (this.ftsReady) {
            const match = ftsQuery(query);
            try {
                const rows = this.db.prepare(`
                    SELECT p.id, p.url, p.title, p.source, p.hash, p.metadata, p.indexed_at,
                           bm25(dendrite_pages_fts, 8.0, 4.0, 1.0, 1.5) AS rank,
                           snippet(dendrite_pages_fts, 3, '', '', '...', 42) AS snippet
                    FROM dendrite_pages_fts
                    JOIN dendrite_pages p ON p.id = dendrite_pages_fts.id
                    WHERE dendrite_pages_fts MATCH ?
                    ORDER BY rank ASC, p.indexed_at DESC
                    LIMIT 100
                `).all(match);
                return rows.map(row => ({
                    id: row.id,
                    url: row.url,
                    title: row.title,
                    source: row.source,
                    hash: row.hash,
                    metadata: this.parseMetadata(row.metadata),
                    indexedAt: row.indexed_at,
                    score: Number(this.rankScore(row, terms, -row.rank).toFixed(4)),
                    snippet: normalizeText(row.snippet)
                }))
                    .sort((a, b) => b.score - a.score || b.indexedAt.localeCompare(a.indexedAt))
                    .slice(0, max);
            } catch (error) {
                console.warn('[DendriteSearch] FTS query failed, falling back:', error.message);
            }
        }

        const rows = this.db.prepare('SELECT * FROM dendrite_pages ORDER BY indexed_at DESC LIMIT 1000').all();
        return rows
            .map(row => {
                const haystack = `${row.title} ${row.url} ${row.content}`.toLowerCase();
                let score = 0;
                for (const term of terms) {
                    if (String(row.title).toLowerCase().includes(term)) score += 8;
                    if (String(row.url).toLowerCase().includes(term)) score += 4;
                    score += Math.min(haystack.split(term).length - 1, 8);
                }
                return { row, score: this.rankScore(row, terms, score) };
            })
            .filter(item => item.score > 0)
            .sort((a, b) => b.score - a.score || b.row.indexed_at.localeCompare(a.row.indexed_at))
            .slice(0, max)
            .map(({ row, score }) => ({
                id: row.id,
                url: row.url,
                title: row.title,
                source: row.source,
                hash: row.hash,
                metadata: this.parseMetadata(row.metadata),
                indexedAt: row.indexed_at,
                score,
                snippet: fallbackSnippet(row.content, terms)
            }));
    }

    rankScore(row, terms = [], baseScore = 0) {
        const title = String(row.title || '').toLowerCase();
        const url = String(row.url || '').toLowerCase();
        const source = String(row.source || '').toLowerCase();
        const indexedAt = Date.parse(row.indexed_at || row.indexedAt || '') || 0;
        let score = Number(baseScore) || 0;
        for (const term of terms) {
            if (title === term) score += 30;
            if (title.includes(term)) score += 12;
            if (url.includes(term)) score += 8;
        }
        if (url.startsWith('gmn://')) score += 9;
        if (source === 'gmn:site') score += 8;
        if (/bookmark|portal-reader|chromium-browser/.test(source)) score += 4;
        if (/crawler|dendrite/.test(source)) score += 2;
        if (indexedAt) {
            const daysOld = Math.max(0, (Date.now() - indexedAt) / 86400000);
            score += Math.max(0, 6 - Math.min(daysOld, 30) * 0.2);
        }
        return score;
    }

    rowToPage(row, includeContent = false) {
        return {
            id: row.id,
            url: row.url,
            title: row.title,
            source: row.source,
            hash: row.hash,
            metadata: this.parseMetadata(row.metadata),
            indexedAt: row.indexed_at,
            ...(includeContent ? { content: row.content } : { contentLength: row.content?.length || row.content_length || 0 })
        };
    }

    parseMetadata(value) {
        try {
            return JSON.parse(value || '{}');
        } catch {
            return {};
        }
    }
}

export default DendriteSearchEngine;
