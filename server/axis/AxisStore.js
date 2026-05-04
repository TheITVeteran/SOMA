import { createRequire } from 'module';
import path from 'path';
import { fileURLToPath } from 'url';
import { mkdirSync } from 'fs';

const require   = createRequire(import.meta.url);
const Database  = require('better-sqlite3');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR  = path.join(__dirname, '..', '..', 'SOMA');
const DB_PATH   = path.join(DATA_DIR, 'axis.db');

const COLORS     = ['blue', 'emerald', 'violet', 'amber', 'rose', 'cyan', 'orange', 'fuchsia'];
const uid        = () => crypto.randomUUID();
const inviteCode = () => Math.random().toString(36).substring(2, 8).toUpperCase();
const colorFor   = (id) => { let h = 0; for (const c of (id || 'x')) h = (h * 31 + c.charCodeAt(0)) & 0xffffffff; return COLORS[Math.abs(h) % COLORS.length]; };

class AxisStore {
    constructor() {
        mkdirSync(DATA_DIR, { recursive: true });
        this.db = new Database(DB_PATH);
        this.db.pragma('journal_mode = WAL');
        this.db.pragma('foreign_keys = ON');
        this._init();
    }

    _init() {
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS workspaces (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                icon TEXT DEFAULT '💬',
                color TEXT DEFAULT 'blue',
                created_by TEXT,
                created_at INTEGER
            );
            CREATE TABLE IF NOT EXISTS channels (
                id TEXT PRIMARY KEY,
                workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
                name TEXT NOT NULL,
                type TEXT DEFAULT 'text',
                description TEXT DEFAULT '',
                invite_code TEXT UNIQUE,
                is_private INTEGER DEFAULT 0,
                created_by TEXT,
                created_at INTEGER
            );
            CREATE TABLE IF NOT EXISTS members (
                channel_id TEXT NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
                user_id TEXT NOT NULL,
                user_name TEXT NOT NULL,
                user_color TEXT DEFAULT 'blue',
                role TEXT DEFAULT 'member',
                joined_at INTEGER,
                PRIMARY KEY (channel_id, user_id)
            );
            CREATE TABLE IF NOT EXISTS messages (
                id TEXT PRIMARY KEY,
                channel_id TEXT NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
                workspace_id TEXT NOT NULL,
                sender_id TEXT NOT NULL,
                sender_name TEXT NOT NULL,
                sender_color TEXT DEFAULT 'blue',
                content TEXT NOT NULL,
                mode TEXT DEFAULT 'archive',
                expires_at INTEGER,
                is_soma INTEGER DEFAULT 0,
                reply_to TEXT,
                reactions TEXT DEFAULT '{}',
                created_at INTEGER NOT NULL
            );
            CREATE TABLE IF NOT EXISTS last_read (
                channel_id TEXT NOT NULL,
                user_id TEXT NOT NULL,
                last_read_at INTEGER NOT NULL,
                PRIMARY KEY (channel_id, user_id)
            );
            CREATE INDEX IF NOT EXISTS idx_messages_channel ON messages(channel_id, created_at);
            CREATE INDEX IF NOT EXISTS idx_channels_workspace ON channels(workspace_id);
            CREATE INDEX IF NOT EXISTS idx_members_channel ON members(channel_id);
            CREATE INDEX IF NOT EXISTS idx_last_read ON last_read(user_id);
        `);

        // Safe migrations for existing DBs
        try { this.db.prepare('ALTER TABLE messages ADD COLUMN edited_at INTEGER').run(); } catch {}

        // FTS5 search index — wrapped so a bad SQLite FTS5 build doesn't crash the store
        try {
            this.db.exec(`
                CREATE VIRTUAL TABLE IF NOT EXISTS messages_fts USING fts5(
                    msg_id UNINDEXED,
                    content,
                    sender_name,
                    channel_id UNINDEXED,
                    workspace_id UNINDEXED,
                    created_at UNINDEXED,
                    tokenize = 'porter unicode61'
                );
            `);
            this.ftsReady = true;
        } catch (e) {
            console.warn('[AxisStore] FTS5 unavailable — search disabled:', e.message);
            this.ftsReady = false;
        }

        // Backfill FTS for existing messages (safe no-op after first run)
        if (this.ftsReady) {
            try {
                const ftsCount = this.db.prepare('SELECT COUNT(*) as n FROM messages_fts').get().n;
                const msgCount = this.db.prepare('SELECT COUNT(*) as n FROM messages').get().n;
                if (ftsCount === 0 && msgCount > 0) {
                    const rows = this.db.prepare('SELECT id, content, sender_name, channel_id, workspace_id, created_at FROM messages').all();
                    const ins  = this.db.prepare('INSERT OR IGNORE INTO messages_fts (msg_id,content,sender_name,channel_id,workspace_id,created_at) VALUES (?,?,?,?,?,?)');
                    this.db.transaction(() => rows.forEach(r => ins.run(r.id, r.content, r.sender_name, r.channel_id, r.workspace_id, r.created_at)))();
                }
            } catch (e) {
                console.warn('[AxisStore] FTS backfill failed:', e.message);
            }
        }

        if (this.db.prepare('SELECT COUNT(*) as n FROM workspaces').get().n === 0) this._seed();
    }

    _seed() {
        const wsId = 'ws-main', now = Date.now();
        this.db.prepare('INSERT INTO workspaces (id,name,icon,color,created_by,created_at) VALUES (?,?,?,?,?,?)').run(wsId, 'Main', '🌐', 'blue', 'system', now);
        for (const ch of [
            { id: 'ch-general',  name: 'general',  type: 'text',      desc: 'General discussion' },
            { id: 'ch-soma',     name: 'soma',      type: 'text',      desc: 'Direct line to SOMA' },
            { id: 'ch-whispers', name: 'whispers',  type: 'ephemeral', desc: 'Messages fade after read' },
        ]) {
            this.db.prepare('INSERT INTO channels (id,workspace_id,name,type,description,invite_code,created_by,created_at) VALUES (?,?,?,?,?,?,?,?)').run(ch.id, wsId, ch.name, ch.type, ch.desc, inviteCode(), 'system', now);
        }
    }

    // ── Workspaces ───────────────────────────────────────────────────────────
    getWorkspaces()  { return this.db.prepare('SELECT * FROM workspaces ORDER BY created_at ASC').all(); }
    deleteWorkspace(id) { this.db.prepare('DELETE FROM workspaces WHERE id = ?').run(id); }
    createWorkspace({ name, icon = '💬', color = 'blue', createdBy }) {
        const id = `ws-${uid()}`, now = Date.now();
        this.db.prepare('INSERT INTO workspaces (id,name,icon,color,created_by,created_at) VALUES (?,?,?,?,?,?)').run(id, name, icon, color, createdBy, now);
        const chId = `ch-${uid()}`;
        this.db.prepare('INSERT INTO channels (id,workspace_id,name,type,description,invite_code,created_by,created_at) VALUES (?,?,?,?,?,?,?,?)').run(chId, id, 'general', 'text', `Main channel for ${name}`, inviteCode(), createdBy, now);
        return this.db.prepare('SELECT * FROM workspaces WHERE id = ?').get(id);
    }

    // ── Channels ─────────────────────────────────────────────────────────────
    getChannels(workspaceId) { return this.db.prepare('SELECT * FROM channels WHERE workspace_id = ? ORDER BY created_at ASC').all(workspaceId); }
    getChannel(id)           { return this.db.prepare('SELECT * FROM channels WHERE id = ?').get(id); }
    deleteChannel(id)        { this.db.prepare('DELETE FROM channels WHERE id = ?').run(id); }
    refreshInvite(channelId) { const code = inviteCode(); this.db.prepare('UPDATE channels SET invite_code = ? WHERE id = ?').run(code, channelId); return code; }
    findByInvite(code)       { return this.db.prepare('SELECT * FROM channels WHERE invite_code = ?').get((code || '').toUpperCase().trim()); }
    createChannel({ workspaceId, name, type = 'text', description = '', isPrivate = false, createdBy }) {
        const id   = `ch-${uid()}`, now = Date.now();
        const slug = (name || 'channel').toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
        this.db.prepare('INSERT INTO channels (id,workspace_id,name,type,description,invite_code,is_private,created_by,created_at) VALUES (?,?,?,?,?,?,?,?,?)').run(id, workspaceId, slug, type, description, inviteCode(), isPrivate ? 1 : 0, createdBy, now);
        if (createdBy) this.addMember(id, { userId: createdBy, userName: createdBy, role: 'admin' });
        return this.db.prepare('SELECT * FROM channels WHERE id = ?').get(id);
    }

    // ── Members ──────────────────────────────────────────────────────────────
    getMembers(channelId)             { return this.db.prepare('SELECT * FROM members WHERE channel_id = ? ORDER BY joined_at ASC').all(channelId); }
    removeMember(channelId, userId)   { this.db.prepare('DELETE FROM members WHERE channel_id = ? AND user_id = ?').run(channelId, userId); }
    addMember(channelId, { userId, userName, userColor, role = 'member' }) {
        if (!userColor) userColor = colorFor(userId);
        this.db.prepare('INSERT OR IGNORE INTO members (channel_id,user_id,user_name,user_color,role,joined_at) VALUES (?,?,?,?,?,?)').run(channelId, userId, userName, userColor, role, Date.now());
    }

    // ── Messages ─────────────────────────────────────────────────────────────
    getMessages(channelId, { limit = 100, before = null } = {}) {
        this.db.prepare('DELETE FROM messages WHERE expires_at IS NOT NULL AND expires_at < ?').run(Date.now());
        const params = [channelId];
        let sql = 'SELECT * FROM messages WHERE channel_id = ?';
        if (before) { sql += ' AND created_at < ?'; params.push(before); }
        sql += ' ORDER BY created_at DESC LIMIT ?';
        params.push(Math.min(limit, 500));
        return this.db.prepare(sql).all(...params).reverse();
    }

    addMessage({ channelId, workspaceId, senderId, senderName, senderColor, content, mode = 'archive', expiresAt = null, isSoma = false, replyTo = null }) {
        const id  = `msg-${uid()}`, now = Date.now();
        if (!senderColor) senderColor = colorFor(senderId);
        this.db.prepare('INSERT INTO messages (id,channel_id,workspace_id,sender_id,sender_name,sender_color,content,mode,expires_at,is_soma,reply_to,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)').run(id, channelId, workspaceId, senderId, senderName, senderColor, content, mode, expiresAt, isSoma ? 1 : 0, replyTo, now);
        if (this.ftsReady) {
            try { this.db.prepare('INSERT INTO messages_fts (msg_id,content,sender_name,channel_id,workspace_id,created_at) VALUES (?,?,?,?,?,?)').run(id, content, senderName, channelId, workspaceId, now); } catch {}
        }
        return { ...this.db.prepare('SELECT * FROM messages WHERE id = ?').get(id), reactions: {} };
    }

    editMessage(id, newContent, requesterId) {
        const row = this.db.prepare('SELECT * FROM messages WHERE id = ?').get(id);
        if (!row || row.sender_id !== requesterId) return null;
        const now = Date.now();
        this.db.prepare('UPDATE messages SET content = ?, edited_at = ? WHERE id = ?').run(newContent, now, id);
        if (this.ftsReady) {
            try { this.db.prepare('UPDATE messages_fts SET content = ? WHERE msg_id = ?').run(newContent, id); } catch {}
        }
        return { ...this.db.prepare('SELECT * FROM messages WHERE id = ?').get(id), reactions: JSON.parse(row.reactions || '{}') };
    }

    deleteMessage(id) {
        this.db.prepare('DELETE FROM messages WHERE id = ?').run(id);
        if (this.ftsReady) {
            try { this.db.prepare('DELETE FROM messages_fts WHERE msg_id = ?').run(id); } catch {}
        }
    }

    addReaction(msgId, emoji, userId) {
        const row = this.db.prepare('SELECT reactions FROM messages WHERE id = ?').get(msgId);
        if (!row) return {};
        const r = JSON.parse(row.reactions || '{}');
        if (!r[emoji]) r[emoji] = [];
        if (!r[emoji].includes(userId)) r[emoji].push(userId);
        this.db.prepare('UPDATE messages SET reactions = ? WHERE id = ?').run(JSON.stringify(r), msgId);
        return r;
    }

    removeReaction(msgId, emoji, userId) {
        const row = this.db.prepare('SELECT reactions FROM messages WHERE id = ?').get(msgId);
        if (!row) return {};
        const r = JSON.parse(row.reactions || '{}');
        if (r[emoji]) { r[emoji] = r[emoji].filter(u => u !== userId); if (!r[emoji].length) delete r[emoji]; }
        this.db.prepare('UPDATE messages SET reactions = ? WHERE id = ?').run(JSON.stringify(r), msgId);
        return r;
    }

    // ── Search (FTS5) ─────────────────────────────────────────────────────────
    searchMessages(query, { workspaceId, channelId, limit = 40 } = {}) {
        if (!this.ftsReady) return [];
        // Sanitize: keep only word chars + spaces, append * for prefix match
        const safe = (query || '').replace(/[^\w\s]/g, ' ').trim();
        if (!safe) return [];
        const ftsQ = safe.split(/\s+/).filter(Boolean).map(w => `${w}*`).join(' ');
        try {
            let sql = `
                SELECT m.*, snippet(messages_fts, 1, '[[', ']]', '…', 32) AS snippet
                FROM messages_fts
                JOIN messages m ON m.id = messages_fts.msg_id
                WHERE messages_fts MATCH ?
            `;
            const params = [ftsQ];
            if (channelId)        { sql += ' AND m.channel_id = ?';    params.push(channelId); }
            else if (workspaceId) { sql += ' AND m.workspace_id = ?';  params.push(workspaceId); }
            sql += ' ORDER BY rank LIMIT ?';
            params.push(Math.min(limit, 100));
            return this.db.prepare(sql).all(...params).map(r => ({ ...r, reactions: JSON.parse(r.reactions || '{}') }));
        } catch (e) {
            console.warn('[AxisStore] FTS search error:', e.message);
            return [];
        }
    }

    // ── Last-read / unread counts ─────────────────────────────────────────────
    markRead(channelId, userId) {
        this.db.prepare('INSERT OR REPLACE INTO last_read (channel_id, user_id, last_read_at) VALUES (?,?,?)').run(channelId, userId, Date.now());
    }

    getUnreadCounts(workspaceId, userId) {
        const channels = this.db.prepare('SELECT id FROM channels WHERE workspace_id = ?').all(workspaceId);
        const result   = {};
        const stmt     = this.db.prepare('SELECT COUNT(*) as n FROM messages WHERE channel_id = ? AND created_at > ? AND sender_id != ? AND (expires_at IS NULL OR expires_at > ?)');
        for (const ch of channels) {
            const lr    = this.db.prepare('SELECT last_read_at FROM last_read WHERE channel_id = ? AND user_id = ?').get(ch.id, userId);
            const since = lr?.last_read_at || 0;
            result[ch.id] = stmt.get(ch.id, since, userId, Date.now()).n;
        }
        return result;
    }

    stats() {
        const now = Date.now();
        return {
            workspaces: this.db.prepare('SELECT COUNT(*) as n FROM workspaces').get().n,
            channels:   this.db.prepare('SELECT COUNT(*) as n FROM channels').get().n,
            messages:   this.db.prepare('SELECT COUNT(*) as n FROM messages WHERE expires_at IS NULL OR expires_at > ?').get(now).n,
            members:    this.db.prepare('SELECT COUNT(DISTINCT user_id) as n FROM members').get().n,
        };
    }
}

export default new AxisStore();
