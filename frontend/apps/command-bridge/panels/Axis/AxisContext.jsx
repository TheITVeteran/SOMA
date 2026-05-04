import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import somaBackend from '../../somaBackend';

const AxisContext = createContext(null);

export const AXIS_COLORS = ['blue', 'emerald', 'violet', 'amber', 'rose', 'cyan', 'orange', 'fuchsia'];

const USER_KEY = 'axis_user_v2';

function apiHeaders(user) {
    return {
        'Content-Type': 'application/json',
        'x-axis-user-id':    user?.id    || 'anon',
        'x-axis-user-name':  user?.name  || 'Anonymous',
        'x-axis-user-color': user?.color || 'blue',
    };
}

function parseReactions(raw) {
    if (!raw || typeof raw === 'object') return raw || {};
    try { return JSON.parse(raw); } catch { return {}; }
}

export const AxisProvider = ({ children }) => {
    // ── Identity ──────────────────────────────────────────────────────────────
    const [user, setUser] = useState(() => {
        try { return JSON.parse(localStorage.getItem(USER_KEY)); } catch { return null; }
    });

    const setupUser = useCallback((name, color) => {
        const u = { id: `usr-${crypto.randomUUID()}`, name, color };
        localStorage.setItem(USER_KEY, JSON.stringify(u));
        setUser(u);
        return u;
    }, []);

    const hdrs = useCallback(() => apiHeaders(user), [user]);

    // ── Workspaces ────────────────────────────────────────────────────────────
    const [workspaces, setWorkspaces]        = useState([]);
    const [activeWorkspaceId, setActiveWsId] = useState(() => localStorage.getItem('axis_active_ws') || null);

    const setActiveWorkspaceId = useCallback((id) => {
        localStorage.setItem('axis_active_ws', id);
        setActiveWsId(id);
    }, []);

    const loadWorkspaces = useCallback(async () => {
        try {
            const d = await fetch('/api/axis/workspaces').then(r => r.json());
            if (d.ok) { setWorkspaces(d.workspaces); return d.workspaces; }
        } catch {}
        return [];
    }, []);

    const createWorkspace = useCallback(async ({ name, icon, color }) => {
        try {
            const d = await fetch('/api/axis/workspaces', { method: 'POST', headers: hdrs(), body: JSON.stringify({ name, icon, color }) }).then(r => r.json());
            if (d.ok) loadWorkspaces();
            return d;
        } catch (e) {
            console.error('[Axis] createWorkspace error:', e);
            return { ok: false, error: e.message };
        }
    }, [hdrs, loadWorkspaces]);

    const deleteWorkspace = useCallback(async (id) => {
        await fetch(`/api/axis/workspaces/${id}`, { method: 'DELETE', headers: hdrs() });
    }, [hdrs]);

    // ── Channels ──────────────────────────────────────────────────────────────
    const [channels, setChannels]           = useState([]);
    const [activeChannelId, setActiveChId]  = useState(() => localStorage.getItem('axis_active_ch') || null);

    const setActiveChannelId = useCallback((id) => {
        localStorage.setItem('axis_active_ch', id);
        setActiveChId(id);
    }, []);

    const loadChannels = useCallback(async (wsId) => {
        if (!wsId) return [];
        try {
            const d = await fetch(`/api/axis/channels?workspaceId=${wsId}`).then(r => r.json());
            if (d.ok) { setChannels(d.channels); return d.channels; }
        } catch {}
        return [];
    }, []);

    const createChannel = useCallback(async ({ workspaceId, name, type, description, isPrivate }) => {
        try {
            const d = await fetch('/api/axis/channels', { method: 'POST', headers: hdrs(), body: JSON.stringify({ workspaceId, name, type, description, isPrivate }) }).then(r => r.json());
            if (d.ok) loadChannels(workspaceId || activeWorkspaceId);
            return d;
        } catch (e) {
            console.error('[Axis] createChannel error:', e);
            return { ok: false, error: e.message };
        }
    }, [hdrs, loadChannels, activeWorkspaceId]);

    const deleteChannel = useCallback(async (id) => {
        await fetch(`/api/axis/channels/${id}`, { method: 'DELETE', headers: hdrs() });
    }, [hdrs]);

    // ── Invite ────────────────────────────────────────────────────────────────
    const getInvite = useCallback(async (channelId) => {
        return fetch(`/api/axis/channels/${channelId}/invite`).then(r => r.json());
    }, []);

    const joinByInvite = useCallback(async (inviteCode) => {
        const d = await fetch('/api/axis/join', { method: 'POST', headers: hdrs(), body: JSON.stringify({ inviteCode }) }).then(r => r.json());
        if (d.ok) {
            const ch  = d.channel;
            const wss = await loadWorkspaces();
            setActiveWorkspaceId(ch.workspace_id);
            await loadChannels(ch.workspace_id);
            setActiveChannelId(ch.id);
        }
        return d;
    }, [hdrs, loadWorkspaces, loadChannels, setActiveWorkspaceId, setActiveChannelId]);

    // ── Members ───────────────────────────────────────────────────────────────
    const [members, setMembers] = useState([]);

    const loadMembers = useCallback(async (channelId) => {
        if (!channelId) return;
        try {
            const d = await fetch(`/api/axis/channels/${channelId}/members`).then(r => r.json());
            if (d.ok) setMembers(d.members);
        } catch {}
    }, []);

    const removeMember = useCallback(async (channelId, userId) => {
        await fetch(`/api/axis/channels/${channelId}/members/${userId}`, { method: 'DELETE', headers: hdrs() });
    }, [hdrs]);

    // ── Messages ──────────────────────────────────────────────────────────────
    const [messages, setMessages]   = useState([]);
    const [somaTyping, setSomaTyping] = useState(false);
    const [loading, setLoading]     = useState(true);

    const loadMessages = useCallback(async (channelId, opts = {}) => {
        if (!channelId) return;
        try {
            const params = new URLSearchParams({ channelId, limit: opts.limit || 100, ...(opts.before ? { before: opts.before } : {}) });
            const d = await fetch(`/api/axis/messages?${params}`).then(r => r.json());
            if (d.ok) setMessages(d.messages.map(m => ({ ...m, reactions: parseReactions(m.reactions) })));
        } catch {}
    }, []);

    const sendMessage = useCallback(async (content, opts = {}) => {
        if (!activeChannelId || !content?.trim()) return;
        const { mode = 'archive', replyTo = null, gossipMs = null } = opts;
        try {
            await fetch('/api/axis/messages', {
                method: 'POST', headers: hdrs(),
                body: JSON.stringify({ channelId: activeChannelId, content: content.trim(), mode, replyTo, gossipMs })
            });
            const ch = channels.find(c => c.id === activeChannelId);
            if (/@soma/i.test(content) || ch?.name === 'soma') setSomaTyping(true);
        } catch (e) { console.error('[Axis] send failed:', e); }
    }, [activeChannelId, hdrs, channels]);

    const deleteMessage = useCallback(async (id) => {
        await fetch(`/api/axis/messages/${id}`, { method: 'DELETE', headers: hdrs() });
    }, [hdrs]);

    const editMessage = useCallback(async (id, newContent) => {
        if (!newContent?.trim()) return;
        try {
            await fetch(`/api/axis/messages/${id}`, {
                method: 'PUT', headers: hdrs(),
                body: JSON.stringify({ content: newContent.trim() })
            });
        } catch (e) { console.error('[Axis] edit failed:', e); }
    }, [hdrs]);

    const reactToMessage = useCallback(async (messageId, emoji, remove = false) => {
        await fetch(`/api/axis/messages/${messageId}/react`, {
            method: 'POST', headers: hdrs(),
            body: JSON.stringify({ emoji, remove })
        });
    }, [hdrs]);

    // ── Unread counts + @mention tracking ────────────────────────────────────
    const [unreadCounts, setUnreadCounts]           = useState({});
    const [mentionedChannels, setMentionedChannels] = useState(new Set());

    const loadUnreadCounts = useCallback(async (wsId) => {
        if (!wsId) return;
        try {
            const d = await fetch(`/api/axis/unread/${wsId}`, { headers: hdrs() }).then(r => r.json());
            if (d.ok) setUnreadCounts(d.counts);
        } catch {}
    }, [hdrs]);

    const markChannelRead = useCallback(async (channelId) => {
        if (!channelId) return;
        setUnreadCounts(prev => ({ ...prev, [channelId]: 0 }));
        setMentionedChannels(prev => { const s = new Set(prev); s.delete(channelId); return s; });
        try {
            await fetch(`/api/axis/read/${channelId}`, { method: 'POST', headers: hdrs() });
        } catch {}
    }, [hdrs]);

    const searchMessages = useCallback(async (query, opts = {}) => {
        if (!query?.trim()) return [];
        try {
            const params = new URLSearchParams({ q: query.trim() });
            if (opts.workspaceId) params.set('workspaceId', opts.workspaceId);
            if (opts.channelId)   params.set('channelId',   opts.channelId);
            if (opts.limit)       params.set('limit',       String(opts.limit));
            const d = await fetch(`/api/axis/search?${params}`).then(r => r.json());
            return d.ok ? d.results : [];
        } catch { return []; }
    }, []);

    // ── WebSocket real-time updates ───────────────────────────────────────────
    useEffect(() => {
        const onMsg = (payload) => {
            if (!payload) return;
            const msg          = { ...payload, reactions: parseReactions(payload.reactions) };
            const msgChannelId = msg.channel_id || msg.channelId;
            const msgSenderId  = msg.sender_id  || msg.senderId;

            setMessages(prev => {
                if (msgChannelId !== activeChannelId) return prev;
                if (prev.some(m => m.id === msg.id)) return prev;
                return [...prev, msg];
            });
            if (msg.is_soma || msgSenderId === 'soma') setSomaTyping(false);

            // Unread + mention tracking for non-active channels
            if (msgChannelId !== activeChannelId && msgSenderId !== user?.id) {
                setUnreadCounts(prev => ({ ...prev, [msgChannelId]: (prev[msgChannelId] || 0) + 1 }));
                if (user?.name && new RegExp(`@${user.name}`, 'i').test(msg.content)) {
                    setMentionedChannels(prev => new Set([...prev, msgChannelId]));
                }
            }
        };

        const onEdited = (payload) => {
            const msg = { ...payload, reactions: parseReactions(payload.reactions) };
            setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, ...msg } : m));
        };

        const onReaction  = ({ messageId, reactions }) => setMessages(prev => prev.map(m => m.id === messageId ? { ...m, reactions } : m));
        const onDeleted   = ({ id })        => setMessages(prev => prev.filter(m => m.id !== id));
        const onMemberEvt = ({ channelId }) => { if (channelId === activeChannelId) loadMembers(channelId); };
        const onChCreated = (ch)            => { if (ch.workspace_id === activeWorkspaceId) setChannels(prev => [...prev, ch]); };
        const onChDeleted = ({ id })        => { setChannels(prev => prev.filter(c => c.id !== id)); if (activeChannelId === id) setActiveChannelId(null); };
        const onWsCreated = (ws)            => setWorkspaces(prev => [...prev, ws]);
        const onWsDeleted = ({ id })        => { setWorkspaces(prev => prev.filter(w => w.id !== id)); if (activeWorkspaceId === id) setActiveWorkspaceId(null); };

        somaBackend.on('axis.message',           onMsg);
        somaBackend.on('axis.message_edited',    onEdited);
        somaBackend.on('axis.reaction',          onReaction);
        somaBackend.on('axis.message_deleted',   onDeleted);
        somaBackend.on('axis.member_joined',     onMemberEvt);
        somaBackend.on('axis.member_removed',    onMemberEvt);
        somaBackend.on('axis.channel_created',   onChCreated);
        somaBackend.on('axis.channel_deleted',   onChDeleted);
        somaBackend.on('axis.workspace_created', onWsCreated);
        somaBackend.on('axis.workspace_deleted', onWsDeleted);

        return () => {
            somaBackend.off('axis.message',           onMsg);
            somaBackend.off('axis.message_edited',    onEdited);
            somaBackend.off('axis.reaction',          onReaction);
            somaBackend.off('axis.message_deleted',   onDeleted);
            somaBackend.off('axis.member_joined',     onMemberEvt);
            somaBackend.off('axis.member_removed',    onMemberEvt);
            somaBackend.off('axis.channel_created',   onChCreated);
            somaBackend.off('axis.channel_deleted',   onChDeleted);
            somaBackend.off('axis.workspace_created', onWsCreated);
            somaBackend.off('axis.workspace_deleted', onWsDeleted);
        };
    }, [activeChannelId, activeWorkspaceId, loadMembers, setActiveChannelId, setActiveWorkspaceId, user?.id, user?.name]); // eslint-disable-line react-hooks/exhaustive-deps

    // ── Bootstrap ─────────────────────────────────────────────────────────────
    useEffect(() => {
        loadWorkspaces().then(async (wss) => {
            let wsId = activeWorkspaceId;
            if (!wsId && wss.length) { wsId = wss[0].id; setActiveWorkspaceId(wsId); }
            if (wsId) {
                const chs = await loadChannels(wsId);
                let chId  = activeChannelId;
                if (!chId && chs.length) { chId = chs[0].id; setActiveChannelId(chId); }
            }
            setLoading(false);
        });
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        if (activeWorkspaceId) {
            loadChannels(activeWorkspaceId);
            loadUnreadCounts(activeWorkspaceId);
        }
    }, [activeWorkspaceId]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        if (!activeChannelId) return;
        setMessages([]);
        setSomaTyping(false);
        loadMessages(activeChannelId);
        loadMembers(activeChannelId);
        markChannelRead(activeChannelId);
    }, [activeChannelId]); // eslint-disable-line react-hooks/exhaustive-deps

    const activeChannel   = channels.find(c => c.id === activeChannelId)   || null;
    const activeWorkspace = workspaces.find(w => w.id === activeWorkspaceId) || null;

    return (
        <AxisContext.Provider value={{
            user, setupUser, AXIS_COLORS,
            workspaces, activeWorkspaceId, setActiveWorkspaceId, activeWorkspace,
            createWorkspace, deleteWorkspace,
            channels, activeChannelId, setActiveChannelId, activeChannel,
            createChannel, deleteChannel,
            members, loadMembers, removeMember,
            messages, somaTyping, loading,
            sendMessage, deleteMessage, editMessage, reactToMessage,
            unreadCounts, mentionedChannels, markChannelRead,
            searchMessages,
            getInvite, joinByInvite,
            hdrs,
        }}>
            {children}
        </AxisContext.Provider>
    );
};

export const useAxis = () => {
    const ctx = useContext(AxisContext);
    if (!ctx) throw new Error('useAxis must be inside AxisProvider');
    return ctx;
};
