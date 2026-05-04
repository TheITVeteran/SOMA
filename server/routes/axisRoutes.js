import express from 'express';
import axisStore from '../axis/AxisStore.js';

export default function createAxisRoutes(system) {
    const router = express.Router();

    const getUser = (req) => ({
        userId:    req.headers['x-axis-user-id']    || 'anon',
        userName:  req.headers['x-axis-user-name']  || 'Anonymous',
        userColor: req.headers['x-axis-user-color'] || 'blue',
    });

    const bcast = (type, payload) => system.broadcast?.(type, payload);

    // ── Workspaces ───────────────────────────────────────────────────────────
    router.get('/workspaces', (_req, res) => {
        res.json({ ok: true, workspaces: axisStore.getWorkspaces() });
    });

    router.post('/workspaces', (req, res) => {
        const { name, icon, color } = req.body;
        if (!name?.trim()) return res.status(400).json({ ok: false, error: 'name required' });
        try {
            const ws = axisStore.createWorkspace({ name: name.trim(), icon, color, createdBy: getUser(req).userId });
            bcast('axis.workspace_created', ws);
            res.json({ ok: true, workspace: ws });
        } catch (e) {
            console.error('[Axis] createWorkspace error:', e);
            res.status(500).json({ ok: false, error: e.message });
        }
    });

    router.delete('/workspaces/:id', (req, res) => {
        axisStore.deleteWorkspace(req.params.id);
        bcast('axis.workspace_deleted', { id: req.params.id });
        res.json({ ok: true });
    });

    // ── Channels ─────────────────────────────────────────────────────────────
    router.get('/channels', (req, res) => {
        const { workspaceId } = req.query;
        if (!workspaceId) return res.status(400).json({ ok: false, error: 'workspaceId required' });
        res.json({ ok: true, channels: axisStore.getChannels(workspaceId) });
    });

    router.post('/channels', (req, res) => {
        const { workspaceId, name, type, description, isPrivate } = req.body;
        if (!workspaceId || !name?.trim()) return res.status(400).json({ ok: false, error: 'workspaceId + name required' });
        try {
            const ch = axisStore.createChannel({ workspaceId, name: name.trim(), type, description, isPrivate, createdBy: getUser(req).userId });
            bcast('axis.channel_created', ch);
            res.json({ ok: true, channel: ch });
        } catch (e) {
            console.error('[Axis] createChannel error:', e);
            res.status(500).json({ ok: false, error: e.message });
        }
    });

    router.delete('/channels/:id', (req, res) => {
        axisStore.deleteChannel(req.params.id);
        bcast('axis.channel_deleted', { id: req.params.id });
        res.json({ ok: true });
    });

    // ── Invite ────────────────────────────────────────────────────────────────
    router.get('/channels/:id/invite', (req, res) => {
        const ch = axisStore.getChannel(req.params.id);
        if (!ch) return res.status(404).json({ ok: false, error: 'not found' });
        res.json({ ok: true, inviteCode: ch.invite_code, channelName: ch.name });
    });

    router.post('/channels/:id/invite/refresh', (req, res) => {
        const code = axisStore.refreshInvite(req.params.id);
        res.json({ ok: true, inviteCode: code });
    });

    router.post('/join', (req, res) => {
        const { inviteCode } = req.body;
        if (!inviteCode) return res.status(400).json({ ok: false, error: 'inviteCode required' });
        const ch = axisStore.findByInvite(inviteCode);
        if (!ch) return res.status(404).json({ ok: false, error: 'invalid invite code' });
        const u = getUser(req);
        axisStore.addMember(ch.id, { userId: u.userId, userName: u.userName, userColor: u.userColor });
        bcast('axis.member_joined', { channelId: ch.id, workspaceId: ch.workspace_id, user: u });
        res.json({ ok: true, channel: ch });
    });

    // ── Members ───────────────────────────────────────────────────────────────
    router.get('/channels/:id/members', (req, res) => {
        res.json({ ok: true, members: axisStore.getMembers(req.params.id) });
    });

    router.delete('/channels/:channelId/members/:userId', (req, res) => {
        axisStore.removeMember(req.params.channelId, req.params.userId);
        bcast('axis.member_removed', { channelId: req.params.channelId, userId: req.params.userId });
        res.json({ ok: true });
    });

    // ── Messages ──────────────────────────────────────────────────────────────
    router.get('/messages', (req, res) => {
        const { channelId, limit, before } = req.query;
        if (!channelId) return res.status(400).json({ ok: false, error: 'channelId required' });
        const msgs = axisStore.getMessages(channelId, {
            limit:  parseInt(limit)  || 100,
            before: before ? parseInt(before) : null,
        });
        res.json({ ok: true, messages: msgs });
    });

    router.post('/messages', async (req, res) => {
        const { channelId, content, mode, replyTo, gossipMs } = req.body;
        if (!channelId || !content?.trim()) return res.status(400).json({ ok: false, error: 'channelId + content required' });

        const ch = axisStore.getChannel(channelId);
        if (!ch) return res.status(404).json({ ok: false, error: 'channel not found' });

        const u = getUser(req);
        let msg;

        if (mode === 'whisper') {
            // Whisper: broadcast only, never persisted
            msg = {
                id:          `wh-${Date.now()}`,
                channel_id:  channelId,
                workspace_id: ch.workspace_id,
                sender_id:   u.userId,
                sender_name: u.userName,
                sender_color: u.userColor,
                content:     content.trim(),
                mode:        'whisper',
                is_soma:     0,
                created_at:  Date.now(),
                reactions:   {},
            };
        } else {
            const expiresAt = mode === 'gossip' && gossipMs ? Date.now() + gossipMs : null;
            msg = axisStore.addMessage({
                channelId, workspaceId: ch.workspace_id,
                senderId: u.userId, senderName: u.userName, senderColor: u.userColor,
                content: content.trim(), mode: mode || 'archive', expiresAt, replyTo,
            });
        }

        bcast('axis.message', msg);
        res.json({ ok: true, message: msg });

        // SOMA response (async after res, non-blocking)
        const wantsSoma = /@soma/i.test(content) || ch.name === 'soma';
        if (wantsSoma && mode !== 'whisper') {
            setTimeout(async () => {
                try {
                    const brain = system.quadBrain || system.brain;
                    if (!brain?.reason) return;
                    const result   = await brain.reason(content.trim(), { quickResponse: false, context: `axis:${ch.name}` });
                    const text     = result?.text || result?.message || '';
                    if (!text) return;
                    const somaMsg  = axisStore.addMessage({ channelId, workspaceId: ch.workspace_id, senderId: 'soma', senderName: 'SOMA', senderColor: 'violet', content: text, mode: 'archive', isSoma: true });
                    bcast('axis.message', somaMsg);
                } catch (e) { console.warn('[Axis] SOMA response error:', e.message); }
            }, 0);
        }
    });

    router.delete('/messages/:id', (req, res) => {
        axisStore.deleteMessage(req.params.id);
        bcast('axis.message_deleted', { id: req.params.id });
        res.json({ ok: true });
    });

    router.post('/messages/:id/react', (req, res) => {
        const { emoji, remove } = req.body;
        const u = getUser(req);
        const reactions = remove
            ? axisStore.removeReaction(req.params.id, emoji, u.userId)
            : axisStore.addReaction(req.params.id, emoji, u.userId);
        bcast('axis.reaction', { messageId: req.params.id, reactions });
        res.json({ ok: true, reactions });
    });

    // ── Message editing ───────────────────────────────────────────────────────
    router.put('/messages/:id', (req, res) => {
        const { content } = req.body;
        if (!content?.trim()) return res.status(400).json({ ok: false, error: 'content required' });
        const u   = getUser(req);
        const msg = axisStore.editMessage(req.params.id, content.trim(), u.userId);
        if (!msg) return res.status(403).json({ ok: false, error: 'not found or not your message' });
        bcast('axis.message_edited', msg);
        res.json({ ok: true, message: msg });
    });

    // ── Unread tracking ───────────────────────────────────────────────────────
    router.post('/read/:channelId', (req, res) => {
        const u = getUser(req);
        axisStore.markRead(req.params.channelId, u.userId);
        res.json({ ok: true });
    });

    router.get('/unread/:workspaceId', (req, res) => {
        const u      = getUser(req);
        const counts = axisStore.getUnreadCounts(req.params.workspaceId, u.userId);
        res.json({ ok: true, counts });
    });

    // ── Search ────────────────────────────────────────────────────────────────
    router.get('/search', (req, res) => {
        const { q, workspaceId, channelId, limit } = req.query;
        if (!q?.trim()) return res.status(400).json({ ok: false, error: 'q required' });
        const results = axisStore.searchMessages(q.trim(), {
            workspaceId, channelId, limit: parseInt(limit) || 40,
        });
        res.json({ ok: true, results });
    });

    router.get('/stats', (_req, res) => res.json({ ok: true, ...axisStore.stats() }));

    return router;
}
