import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
    Hash, Eye, Archive, Lock, Plus, Settings, Send, Search,
    Users, UserPlus, Copy, Check, X, Trash2,
    LogOut, Smile, RefreshCw, Shield, Pencil,
} from 'lucide-react';
import { AxisProvider, useAxis, AXIS_COLORS } from './AxisContext';

// ── Color utilities ──────────────────────────────────────────────────────────
const COLOR = {
    blue:    { text: 'text-blue-400',    bg: 'bg-blue-500/15',    ring: 'ring-blue-500/40',    dot: 'bg-blue-400'    },
    emerald: { text: 'text-emerald-400', bg: 'bg-emerald-500/15', ring: 'ring-emerald-500/40', dot: 'bg-emerald-400' },
    violet:  { text: 'text-violet-400',  bg: 'bg-violet-500/15',  ring: 'ring-violet-500/40',  dot: 'bg-violet-400'  },
    amber:   { text: 'text-amber-400',   bg: 'bg-amber-500/15',   ring: 'ring-amber-500/40',   dot: 'bg-amber-400'   },
    rose:    { text: 'text-rose-400',    bg: 'bg-rose-500/15',    ring: 'ring-rose-500/40',    dot: 'bg-rose-400'    },
    cyan:    { text: 'text-cyan-400',    bg: 'bg-cyan-500/15',    ring: 'ring-cyan-500/40',    dot: 'bg-cyan-400'    },
    orange:  { text: 'text-orange-400',  bg: 'bg-orange-500/15',  ring: 'ring-orange-500/40',  dot: 'bg-orange-400'  },
    fuchsia: { text: 'text-fuchsia-400', bg: 'bg-fuchsia-500/15', ring: 'ring-fuchsia-500/40', dot: 'bg-fuchsia-400' },
};
const c = (color, key) => COLOR[color]?.[key] || COLOR.blue[key];

const CHANNEL_TYPE_ICON = { text: Hash, ephemeral: Eye, archive: Archive, system: Shield };
const QUICK_EMOJIS     = ['👍','❤️','😂','🔥','👀','✅'];
const GOSSIP_STEPS     = [0, 60_000, 300_000, 1_800_000];
const GOSSIP_LABELS    = ['', '1m', '5m', '30m'];

// ── Avatar ────────────────────────────────────────────────────────────────────
function Avatar({ name, color, size = 'md', isSoma = false }) {
    const s = size === 'sm' ? 'w-7 h-7 text-[11px]' : size === 'lg' ? 'w-10 h-10 text-sm' : 'w-8 h-8 text-xs';
    const initial = isSoma ? '⬡' : (name || '?')[0].toUpperCase();
    return (
        <div className={`${s} rounded-xl flex items-center justify-center font-bold shrink-0 ring-1 ${c(color, 'bg')} ${c(color, 'ring')} ${c(color, 'text')}`}>
            {initial}
        </div>
    );
}

// ── Modal shell ───────────────────────────────────────────────────────────────
function Modal({ onClose, children, width = 'max-w-md' }) {
    useEffect(() => {
        const h = (e) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', h);
        return () => window.removeEventListener('keydown', h);
    }, [onClose]);
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={e => e.target === e.currentTarget && onClose()}>
            <div className={`${width} w-full bg-[#111113] border border-white/10 rounded-2xl shadow-2xl overflow-hidden`}>
                {children}
            </div>
        </div>
    );
}

// ── Content renderers ─────────────────────────────────────────────────────────
function renderContent(content, myName = '') {
    const parts = content.split(/(\*\*[^*]+\*\*|`[^`]+`|\n|@\w+)/g);
    return parts.map((part, i) => {
        if (!part) return null;
        if (part.startsWith('**') && part.endsWith('**'))
            return <strong key={i} className="font-semibold text-zinc-100">{part.slice(2, -2)}</strong>;
        if (part.startsWith('`') && part.endsWith('`'))
            return <code key={i} className="px-1.5 py-0.5 rounded bg-white/8 text-cyan-300 font-mono text-[0.85em]">{part.slice(1, -1)}</code>;
        if (part === '\n') return <br key={i} />;
        if (/^@\w+/.test(part)) {
            const isMe = myName && part.slice(1).toLowerCase() === myName.toLowerCase();
            return <span key={i} className={isMe
                ? 'bg-amber-500/20 text-amber-300 rounded px-0.5 font-semibold'
                : 'text-blue-400 font-medium'}>{part}</span>;
        }
        return part;
    });
}

function renderSnippet(text) {
    if (!text) return null;
    const parts = text.split(/(\[\[.*?\]\])/g);
    return parts.map((part, i) => {
        if (part.startsWith('[[') && part.endsWith(']]'))
            return <mark key={i} className="bg-amber-500/30 text-amber-200 not-italic rounded">{part.slice(2, -2)}</mark>;
        return <span key={i} className="text-zinc-400">{part}</span>;
    });
}

// ── Identity Setup Modal ──────────────────────────────────────────────────────
function IdentityModal({ onDone }) {
    const { setupUser, AXIS_COLORS } = useAxis();
    const [name, setName]   = useState('');
    const [color, setColor] = useState('blue');
    const inputRef = useRef(null);
    useEffect(() => { inputRef.current?.focus(); }, []);

    const submit = () => {
        if (!name.trim()) return;
        setupUser(name.trim(), color);
        onDone();
    };

    return (
        <Modal onClose={() => {}} width="max-w-sm">
            <div className="p-8 flex flex-col items-center gap-6">
                <div className="text-center">
                    <div className="text-3xl mb-2">⬡</div>
                    <h1 className="text-lg font-bold text-zinc-100 tracking-wide">Welcome to AXIS</h1>
                    <p className="text-xs text-zinc-500 mt-1">Set your identity to start messaging</p>
                </div>
                <div className="w-full space-y-4">
                    <div>
                        <label className="text-[10px] text-zinc-500 uppercase tracking-widest font-medium mb-1.5 block">Your name</label>
                        <input
                            ref={inputRef}
                            value={name}
                            onChange={e => setName(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && submit()}
                            placeholder="Enter your name..."
                            className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-white/25 transition-colors"
                        />
                    </div>
                    <div>
                        <label className="text-[10px] text-zinc-500 uppercase tracking-widest font-medium mb-2 block">Your color</label>
                        <div className="flex gap-2 flex-wrap">
                            {AXIS_COLORS.map(col => (
                                <button key={col} onClick={() => setColor(col)} className={`w-7 h-7 rounded-lg ${c(col, 'dot')} transition-all ${color === col ? 'ring-2 ring-white ring-offset-2 ring-offset-[#111113] scale-110' : 'opacity-50 hover:opacity-100'}`} />
                            ))}
                        </div>
                    </div>
                </div>
                <button onClick={submit} disabled={!name.trim()} className="w-full py-2.5 rounded-xl bg-white text-black text-sm font-bold tracking-wide hover:bg-zinc-100 transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
                    Join AXIS
                </button>
            </div>
        </Modal>
    );
}

// ── Create Workspace Modal ────────────────────────────────────────────────────
function CreateWorkspaceModal({ onClose }) {
    const { createWorkspace, setActiveWorkspaceId } = useAxis();
    const [name, setName]   = useState('');
    const [icon, setIcon]   = useState('💬');
    const [color, setColor] = useState('blue');
    const [busy, setBusy]   = useState(false);
    const icons = ['💬','🚀','⚡','🔬','🎯','🌍','🔐','🛠️','📊','🎨','🤝','🌱'];

    const submit = async () => {
        if (!name.trim() || busy) return;
        setBusy(true);
        try {
            const d = await createWorkspace({ name: name.trim(), icon, color });
            if (d?.ok) { setActiveWorkspaceId(d.workspace.id); onClose(); }
        } catch (e) { console.error('[Axis] createWorkspace failed:', e); }
        setBusy(false);
    };

    return (
        <Modal onClose={onClose}>
            <div className="p-6 space-y-5">
                <div>
                    <h2 className="text-sm font-bold text-zinc-100 tracking-wide">New Workspace</h2>
                    <p className="text-xs text-zinc-500 mt-0.5">A workspace groups related channels</p>
                </div>
                <div className="space-y-3">
                    <div>
                        <label className="text-[10px] text-zinc-500 uppercase tracking-widest mb-1 block">Name</label>
                        <input value={name} onChange={e => setName(e.target.value)} onKeyDown={e => e.key === 'Enter' && submit()} placeholder="e.g. Design Team" className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-white/25" />
                    </div>
                    <div>
                        <label className="text-[10px] text-zinc-500 uppercase tracking-widest mb-1.5 block">Icon</label>
                        <div className="flex flex-wrap gap-2">
                            {icons.map(i => <button key={i} onClick={() => setIcon(i)} className={`w-9 h-9 rounded-lg text-lg flex items-center justify-center transition-all ${icon === i ? 'bg-white/15 ring-1 ring-white/30' : 'bg-white/5 hover:bg-white/10'}`}>{i}</button>)}
                        </div>
                    </div>
                    <div>
                        <label className="text-[10px] text-zinc-500 uppercase tracking-widest mb-1.5 block">Color</label>
                        <div className="flex gap-2">
                            {AXIS_COLORS.map(col => <button key={col} onClick={() => setColor(col)} className={`w-6 h-6 rounded-md ${c(col, 'dot')} transition-all ${color === col ? 'ring-2 ring-white ring-offset-1 ring-offset-[#111113]' : 'opacity-50 hover:opacity-80'}`} />)}
                        </div>
                    </div>
                </div>
                <div className="flex gap-2 justify-end">
                    <button onClick={onClose} className="px-4 py-1.5 text-xs text-zinc-400 hover:text-zinc-200 transition-colors">Cancel</button>
                    <button onClick={submit} disabled={!name.trim() || busy} className="px-4 py-1.5 text-xs font-bold bg-white text-black rounded-lg hover:bg-zinc-100 disabled:opacity-30 transition-all">{busy ? '…' : 'Create'}</button>
                </div>
            </div>
        </Modal>
    );
}

// ── Create Channel Modal ──────────────────────────────────────────────────────
function CreateChannelModal({ onClose }) {
    const { createChannel, activeWorkspaceId, setActiveChannelId } = useAxis();
    const [name, setName]         = useState('');
    const [type, setType]         = useState('text');
    const [desc, setDesc]         = useState('');
    const [isPrivate, setPrivate] = useState(false);
    const [busy, setBusy]         = useState(false);

    const TYPES = [
        { id: 'text',      label: 'Text',     icon: Hash, desc: 'Standard persistent chat' },
        { id: 'ephemeral', label: 'Ephemeral', icon: Eye,  desc: 'Messages can self-destruct' },
    ];

    const [error, setError] = useState('');

    const submit = async () => {
        if (!name.trim() || busy) return;
        setBusy(true);
        setError('');
        try {
            const d = await createChannel({ workspaceId: activeWorkspaceId, name: name.trim(), type, description: desc, isPrivate });
            if (d?.ok) { setActiveChannelId(d.channel.id); onClose(); }
            else setError(d?.error || 'Failed to create channel');
        } catch (e) {
            console.error('[Axis] createChannel failed:', e);
            setError('Server error — check console');
        }
        setBusy(false);
    };

    return (
        <Modal onClose={onClose}>
            <div className="p-6 space-y-4">
                <div>
                    <h2 className="text-sm font-bold text-zinc-100 tracking-wide">New Channel</h2>
                    <p className="text-xs text-zinc-500 mt-0.5">Channels are where conversations happen</p>
                </div>
                <div className="flex gap-2">
                    {TYPES.map(t => (
                        <button key={t.id} onClick={() => setType(t.id)} className={`flex-1 flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-all ${type === t.id ? 'border-white/25 bg-white/8' : 'border-white/5 bg-white/3 hover:border-white/15'}`}>
                            <t.icon className={`w-4 h-4 ${type === t.id ? 'text-zinc-100' : 'text-zinc-500'}`} />
                            <span className={`text-[11px] font-semibold ${type === t.id ? 'text-zinc-100' : 'text-zinc-500'}`}>{t.label}</span>
                            <span className="text-[9px] text-zinc-600 text-center leading-tight">{t.desc}</span>
                        </button>
                    ))}
                </div>
                <div>
                    <label className="text-[10px] text-zinc-500 uppercase tracking-widest mb-1 block">Channel name</label>
                    <input value={name} onChange={e => setName(e.target.value)} onKeyDown={e => e.key === 'Enter' && submit()} placeholder="e.g. strategy" className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-white/25" />
                </div>
                <div>
                    <label className="text-[10px] text-zinc-500 uppercase tracking-widest mb-1 block">Description (optional)</label>
                    <input value={desc} onChange={e => setDesc(e.target.value)} placeholder="What's this channel about?" className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-white/25" />
                </div>
                <label className="flex items-center gap-2 cursor-pointer select-none">
                    <div onClick={() => setPrivate(v => !v)} className={`w-9 h-5 rounded-full transition-colors flex items-center ${isPrivate ? 'bg-white/40' : 'bg-white/10'}`}>
                        <div className={`w-4 h-4 rounded-full bg-white shadow transition-transform mx-0.5 ${isPrivate ? 'translate-x-4' : 'translate-x-0'}`} />
                    </div>
                    <span className="text-xs text-zinc-400">Private channel <span className="text-zinc-600">(invite only)</span></span>
                </label>
                {error && <p className="text-xs text-red-400">{error}</p>}
                <div className="flex gap-2 justify-end">
                    <button onClick={onClose} className="px-4 py-1.5 text-xs text-zinc-400 hover:text-zinc-200 transition-colors">Cancel</button>
                    <button onClick={submit} disabled={!name.trim() || busy} className="px-4 py-1.5 text-xs font-bold bg-white text-black rounded-lg hover:bg-zinc-100 disabled:opacity-30 transition-all">{busy ? '…' : 'Create'}</button>
                </div>
            </div>
        </Modal>
    );
}

// ── Invite Modal ──────────────────────────────────────────────────────────────
function InviteModal({ channelId, onClose }) {
    const { getInvite } = useAxis();
    const [data, setData]     = useState(null);
    const [copied, setCopied] = useState(false);
    const [busy, setBusy]     = useState(false);

    useEffect(() => { getInvite(channelId).then(d => d.ok && setData(d)); }, [channelId, getInvite]);

    const copy = () => {
        navigator.clipboard.writeText(data.inviteCode);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const refresh = async () => {
        setBusy(true);
        const r = await fetch(`/api/axis/channels/${channelId}/invite/refresh`, { method: 'POST' }).then(r => r.json());
        if (r.ok) setData(d => ({ ...d, inviteCode: r.inviteCode }));
        setBusy(false);
    };

    return (
        <Modal onClose={onClose} width="max-w-sm">
            <div className="p-6 space-y-5">
                <div>
                    <h2 className="text-sm font-bold text-zinc-100 tracking-wide">Invite to #{data?.channelName || '…'}</h2>
                    <p className="text-xs text-zinc-500 mt-0.5">Share this code with anyone you want in this channel</p>
                </div>
                {data ? (
                    <>
                        <div className="bg-black/40 border border-white/10 rounded-xl p-5 flex items-center justify-between gap-4">
                            <span className="font-mono text-3xl font-bold text-zinc-100 tracking-[0.25em]">{data.inviteCode}</span>
                            <button onClick={copy} className={`p-2 rounded-lg transition-all ${copied ? 'bg-emerald-500/20 text-emerald-400' : 'bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-zinc-200'}`}>
                                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                            </button>
                        </div>
                        <p className="text-[10px] text-zinc-600 text-center">Others open AXIS → Join Channel → enter this code</p>
                        <div className="flex justify-between items-center">
                            <button onClick={refresh} disabled={busy} className="flex items-center gap-1.5 text-[11px] text-zinc-500 hover:text-zinc-300 transition-colors disabled:opacity-40">
                                <RefreshCw className="w-3 h-3" /> {busy ? 'Refreshing…' : 'Generate new code'}
                            </button>
                            <button onClick={onClose} className="px-4 py-1.5 text-xs font-bold bg-white text-black rounded-lg hover:bg-zinc-100 transition-all">Done</button>
                        </div>
                    </>
                ) : (
                    <div className="h-24 flex items-center justify-center text-zinc-600 text-sm">Loading…</div>
                )}
            </div>
        </Modal>
    );
}

// ── Join Modal ────────────────────────────────────────────────────────────────
function JoinModal({ onClose }) {
    const { joinByInvite } = useAxis();
    const [code, setCode]   = useState('');
    const [error, setError] = useState('');
    const [busy, setBusy]   = useState(false);

    const submit = async () => {
        if (code.length < 6 || busy) return;
        setBusy(true); setError('');
        const d = await joinByInvite(code.trim().toUpperCase());
        if (d.ok) { onClose(); } else { setError(d.error || 'Invalid code'); setBusy(false); }
    };

    return (
        <Modal onClose={onClose} width="max-w-xs">
            <div className="p-6 space-y-4">
                <div>
                    <h2 className="text-sm font-bold text-zinc-100 tracking-wide">Join a Channel</h2>
                    <p className="text-xs text-zinc-500 mt-0.5">Enter the invite code you received</p>
                </div>
                <input
                    value={code}
                    onChange={e => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))}
                    onKeyDown={e => e.key === 'Enter' && submit()}
                    placeholder="XXXXXX"
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl font-mono text-xl text-center text-zinc-100 placeholder:text-zinc-700 focus:outline-none focus:border-white/25 tracking-[0.3em]"
                />
                {error && <p className="text-xs text-red-400">{error}</p>}
                <div className="flex gap-2 justify-end">
                    <button onClick={onClose} className="px-4 py-1.5 text-xs text-zinc-400 hover:text-zinc-200 transition-colors">Cancel</button>
                    <button onClick={submit} disabled={code.length < 6 || busy} className="px-4 py-1.5 text-xs font-bold bg-white text-black rounded-lg hover:bg-zinc-100 disabled:opacity-30 transition-all">{busy ? '…' : 'Join'}</button>
                </div>
            </div>
        </Modal>
    );
}

// ── Search Modal ──────────────────────────────────────────────────────────────
function SearchModal({ onClose, workspaceId }) {
    const { searchMessages, setActiveChannelId, channels } = useAxis();
    const [query, setQuery]     = useState('');
    const [results, setResults] = useState([]);
    const [busy, setBusy]       = useState(false);
    const inputRef              = useRef(null);
    const debounceRef           = useRef(null);

    useEffect(() => { inputRef.current?.focus(); }, []);

    const doSearch = useCallback(async (q) => {
        if (!q.trim()) { setResults([]); return; }
        setBusy(true);
        const res = await searchMessages(q, { workspaceId });
        setResults(res);
        setBusy(false);
    }, [searchMessages, workspaceId]);

    const handleChange = (val) => {
        setQuery(val);
        clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => doSearch(val), 280);
    };

    const goToMessage = (result) => {
        setActiveChannelId(result.channel_id);
        onClose();
    };

    const getChannelName = (id) => channels.find(ch => ch.id === id)?.name || id;

    return (
        <Modal onClose={onClose} width="max-w-xl">
            <div className="flex flex-col" style={{ maxHeight: '70vh' }}>
                <div className="flex items-center gap-3 px-4 py-3 border-b border-white/8">
                    <Search className="w-4 h-4 text-zinc-500 shrink-0" />
                    <input
                        ref={inputRef}
                        value={query}
                        onChange={e => handleChange(e.target.value)}
                        placeholder="Search messages…"
                        className="flex-1 bg-transparent text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none"
                    />
                    {busy && <div className="w-3.5 h-3.5 rounded-full border-2 border-zinc-600 border-t-zinc-300 animate-spin shrink-0" />}
                    <button onClick={onClose} className="text-zinc-600 hover:text-zinc-300 transition-colors shrink-0">
                        <X className="w-4 h-4" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-2 space-y-1">
                    {!query && (
                        <div className="py-10 text-center text-zinc-700 text-sm">Type to search across all messages</div>
                    )}
                    {query && !busy && results.length === 0 && (
                        <div className="py-10 text-center text-zinc-600 text-sm">No results for "<span className="text-zinc-400">{query}</span>"</div>
                    )}
                    {results.map(r => (
                        <button key={r.id} onClick={() => goToMessage(r)}
                            className="w-full text-left p-3 rounded-xl hover:bg-white/5 transition-colors">
                            <div className="flex items-center gap-2 mb-1">
                                <span className="text-[10px] text-zinc-600 font-mono">#{getChannelName(r.channel_id)}</span>
                                <span className="text-[11px] font-semibold text-zinc-400">{r.sender_name}</span>
                                <span className="text-[10px] text-zinc-700 ml-auto">
                                    {new Date(r.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                                </span>
                            </div>
                            <p className="text-[12.5px] leading-relaxed">
                                {renderSnippet(r.snippet || r.content)}
                            </p>
                        </button>
                    ))}
                </div>
            </div>
        </Modal>
    );
}

// ── Workspace Rail ────────────────────────────────────────────────────────────
function WorkspaceRail({ onAdd }) {
    const { workspaces, activeWorkspaceId, setActiveWorkspaceId } = useAxis();
    return (
        <div className="w-[60px] shrink-0 bg-[#080809] border-r border-white/5 flex flex-col items-center py-3 gap-2 overflow-y-auto">
            {workspaces.map(ws => (
                <button
                    key={ws.id}
                    onClick={() => setActiveWorkspaceId(ws.id)}
                    title={ws.name}
                    className={`relative w-11 h-11 rounded-2xl flex items-center justify-center text-lg transition-all duration-200 shrink-0
                        ${activeWorkspaceId === ws.id
                            ? 'bg-zinc-100 rounded-xl shadow-[0_0_20px_rgba(255,255,255,0.08)]'
                            : 'bg-zinc-900 hover:bg-zinc-800 hover:rounded-xl'}`}
                >
                    {ws.icon}
                    {activeWorkspaceId === ws.id && (
                        <div className="absolute -left-3 w-1 h-6 bg-white rounded-r-full" />
                    )}
                </button>
            ))}
            <div className="flex-1" />
            <button onClick={onAdd} title="New Workspace" className="w-11 h-11 rounded-2xl bg-zinc-900 border border-dashed border-white/10 flex items-center justify-center text-zinc-500 hover:bg-zinc-800 hover:border-white/20 hover:text-zinc-300 hover:rounded-xl transition-all shrink-0">
                <Plus className="w-4 h-4" />
            </button>
        </div>
    );
}

// ── Channel Sidebar ───────────────────────────────────────────────────────────
function ChannelSidebar({ onCreateCh, onJoin }) {
    const { channels, activeChannelId, setActiveChannelId, activeWorkspace, unreadCounts, mentionedChannels } = useAxis();
    const textChs      = channels.filter(ch => ch.type === 'text' || ch.type === 'system');
    const ephemeralChs = channels.filter(ch => ch.type === 'ephemeral' || ch.type === 'archive');

    const Section = ({ label, items }) => items.length === 0 ? null : (
        <div className="mb-2">
            <div className="px-3 mb-0.5">
                <span className="text-[10px] text-zinc-600 uppercase tracking-widest font-semibold">{label}</span>
            </div>
            {items.map(ch => {
                const Icon       = CHANNEL_TYPE_ICON[ch.type] || Hash;
                const isActive   = ch.id === activeChannelId;
                const unread     = !isActive ? (unreadCounts[ch.id] || 0) : 0;
                const isMentioned = mentionedChannels.has(ch.id);
                const hasUnread  = unread > 0;

                return (
                    <button key={ch.id} onClick={() => setActiveChannelId(ch.id)}
                        className={`w-full flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all text-left
                            ${isActive  ? 'bg-white/8 text-zinc-100'
                            : hasUnread ? 'text-zinc-200 hover:bg-white/5'
                            :             'text-zinc-500 hover:bg-white/5 hover:text-zinc-300'}`}
                    >
                        <Icon className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-zinc-300' : hasUnread ? 'text-zinc-400' : 'text-zinc-600'}`} />
                        <span className={`text-[13px] truncate flex-1 ${hasUnread ? 'font-semibold' : 'font-medium'}`}>{ch.name}</span>
                        {ch.is_private && !hasUnread && <Lock className="w-2.5 h-2.5 ml-auto text-zinc-700 shrink-0" />}
                        {hasUnread && (
                            <span className={`ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0 min-w-[18px] text-center leading-none
                                ${isMentioned ? 'bg-amber-500/30 text-amber-300' : 'bg-white/15 text-zinc-300'}`}>
                                {unread > 99 ? '99+' : unread}
                            </span>
                        )}
                    </button>
                );
            })}
        </div>
    );

    return (
        <div className="w-[220px] shrink-0 bg-[#0e0e10] border-r border-white/5 flex flex-col">
            <div className="px-4 py-3.5 border-b border-white/5 flex items-center justify-between shrink-0">
                <div className="min-w-0 flex items-center gap-1.5">
                    <span className="text-sm">{activeWorkspace?.icon || '🌐'}</span>
                    <h3 className="text-[13px] font-bold text-zinc-100 truncate">{activeWorkspace?.name || 'Loading…'}</h3>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto py-2 px-1">
                <Section label="Channels"  items={textChs} />
                <Section label="Ephemeral" items={ephemeralChs} />
            </div>

            <div className="px-2 py-2 border-t border-white/5 space-y-0.5 shrink-0">
                <button onClick={onCreateCh} className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-white/5 transition-all text-left">
                    <Plus className="w-3.5 h-3.5" />
                    <span className="text-[12px]">New channel</span>
                </button>
                <button onClick={onJoin} className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-white/5 transition-all text-left">
                    <LogOut className="w-3.5 h-3.5 rotate-180" />
                    <span className="text-[12px]">Join by code</span>
                </button>
            </div>
        </div>
    );
}

// ── Message Group ─────────────────────────────────────────────────────────────
function MessageGroup({ group, onReact, onDelete, currentUserId, currentUserName, replySource }) {
    const [hovering, setHovering]   = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [editText, setEditText]   = useState('');
    const editRef                   = useRef(null);
    const { editMessage }           = useAxis();

    const hasMention = currentUserName && group.messages.some(m =>
        new RegExp(`@${currentUserName}`, 'i').test(m.content)
    );

    const startEdit = (msg) => {
        setEditingId(msg.id);
        setEditText(msg.content);
        setTimeout(() => { editRef.current?.focus(); editRef.current?.select(); }, 40);
    };

    const saveEdit = async () => {
        if (!editText.trim() || !editingId) return;
        await editMessage(editingId, editText.trim());
        setEditingId(null);
    };

    const cancelEdit = () => setEditingId(null);

    const MODE_BADGE = {
        whisper: { label: 'WHISPER', cls: 'text-red-400   bg-red-500/10   border-red-500/20'   },
        gossip:  { label: 'FADING',  cls: 'text-amber-400 bg-amber-500/10 border-amber-500/20' },
    };

    return (
        <div
            className={`flex gap-3 px-5 py-0.5 hover:bg-white/[0.015] rounded-xl mx-1 transition-colors group
                ${hasMention ? 'border-l-2 border-amber-500/50 bg-amber-500/[0.025] pl-[18px]' : ''}`}
            onMouseEnter={() => setHovering(true)}
            onMouseLeave={() => { setHovering(false); }}
        >
            {/* Avatar column */}
            <div className="w-8 shrink-0 pt-0.5">
                {group.showHeader && (
                    <Avatar name={group.senderName} color={group.senderColor} isSoma={group.isSoma} />
                )}
            </div>

            {/* Content column */}
            <div className="flex-1 min-w-0">
                {group.showHeader && (
                    <div className="flex items-baseline gap-2 mb-0.5">
                        <span className={`text-[13px] font-semibold ${c(group.senderColor, 'text')}`}>{group.senderName}</span>
                        <span className="text-[10px] text-zinc-600 font-mono">
                            {new Date(group.messages[0].created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                    </div>
                )}

                {group.messages.map((msg) => {
                    const isOwn = msg.sender_id === currentUserId || msg.senderId === currentUserId;

                    return (
                        <div key={msg.id} className="relative">
                            {/* Reply context */}
                            {msg.reply_to && replySource?.[msg.reply_to] && (
                                <div className="flex items-center gap-1.5 mb-0.5 pl-3 border-l-2 border-white/10">
                                    <span className={`text-[10px] font-semibold ${c(replySource[msg.reply_to].sender_color, 'text')}`}>{replySource[msg.reply_to].sender_name}</span>
                                    <span className="text-[10px] text-zinc-600 truncate max-w-[200px]">{replySource[msg.reply_to].content}</span>
                                </div>
                            )}

                            {/* Edit mode */}
                            {editingId === msg.id ? (
                                <div className="flex flex-col gap-1.5 py-0.5 pr-4">
                                    <textarea
                                        ref={editRef}
                                        value={editText}
                                        onChange={e => setEditText(e.target.value)}
                                        onKeyDown={e => {
                                            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); saveEdit(); }
                                            if (e.key === 'Escape') cancelEdit();
                                        }}
                                        rows={2}
                                        className="w-full bg-white/5 border border-white/15 focus:border-white/30 rounded-lg px-3 py-2 text-[13.5px] text-zinc-200 resize-none focus:outline-none"
                                    />
                                    <div className="flex items-center gap-2">
                                        <button onClick={saveEdit} className="px-3 py-1 bg-white text-black text-[11px] font-bold rounded-lg hover:bg-zinc-100 transition-colors">Save</button>
                                        <button onClick={cancelEdit} className="px-3 py-1 text-[11px] text-zinc-500 hover:text-zinc-300 transition-colors">Cancel</button>
                                        <span className="text-[10px] text-zinc-700">Enter to save · Esc to cancel</span>
                                    </div>
                                </div>
                            ) : (
                                <div className={`text-[13.5px] text-zinc-300 leading-relaxed pr-2
                                    ${msg.mode === 'whisper' ? 'italic opacity-80' : ''}
                                    ${msg.mode === 'gossip'  ? 'opacity-70'        : ''}`}>
                                    {renderContent(msg.content, currentUserName)}
                                    {msg.edited_at && (
                                        <span className="text-[9px] text-zinc-600 ml-1.5">(edited)</span>
                                    )}
                                    {MODE_BADGE[msg.mode] && (
                                        <span className={`ml-2 text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded border align-middle ${MODE_BADGE[msg.mode].cls}`}>
                                            {MODE_BADGE[msg.mode].label}
                                        </span>
                                    )}
                                </div>
                            )}

                            {/* Reactions */}
                            {Object.keys(msg.reactions || {}).length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-1">
                                    {Object.entries(msg.reactions).map(([emoji, users]) => (
                                        <button key={emoji} onClick={() => onReact(msg.id, emoji, users.includes(currentUserId))}
                                            className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] border transition-all
                                                ${users.includes(currentUserId) ? 'bg-white/10 border-white/20 text-zinc-200' : 'bg-white/4 border-white/8 text-zinc-400 hover:bg-white/8'}`}>
                                            {emoji} <span className="font-semibold text-[10px]">{users.length}</span>
                                        </button>
                                    ))}
                                </div>
                            )}

                            {/* Hover toolbar */}
                            {hovering && editingId !== msg.id && (
                                <div className="absolute right-0 -top-1 flex items-center gap-0.5 bg-[#1c1c1f] border border-white/10 rounded-lg p-0.5 shadow-xl z-10">
                                    {QUICK_EMOJIS.map(em => (
                                        <button key={em} onClick={() => onReact(msg.id, em, (msg.reactions?.[em] || []).includes(currentUserId))}
                                            className="w-6 h-6 flex items-center justify-center rounded text-sm hover:bg-white/10 transition-colors">
                                            {em}
                                        </button>
                                    ))}
                                    <div className="w-px h-4 bg-white/10 mx-0.5" />
                                    {isOwn && (
                                        <button onClick={() => startEdit(msg)} className="w-6 h-6 flex items-center justify-center rounded hover:bg-white/10 text-zinc-500 hover:text-zinc-200 transition-colors" title="Edit">
                                            <Pencil className="w-3 h-3" />
                                        </button>
                                    )}
                                    {isOwn && (
                                        <button onClick={() => onDelete(msg.id)} className="w-6 h-6 flex items-center justify-center rounded hover:bg-red-500/20 text-zinc-500 hover:text-red-400 transition-colors" title="Delete">
                                            <Trash2 className="w-3 h-3" />
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

// ── SOMA typing indicator ─────────────────────────────────────────────────────
function SomaTyping() {
    return (
        <div className="flex gap-3 px-5 py-2 mx-1">
            <Avatar name="SOMA" color="violet" isSoma />
            <div className="flex items-center gap-1 mt-1">
                {[0, 1, 2].map(i => (
                    <div key={i} className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: `${i * 0.15}s`, animationDuration: '0.8s' }} />
                ))}
                <span className="text-[11px] text-zinc-600 ml-2">SOMA is thinking…</span>
            </div>
        </div>
    );
}

// ── Chat Area ─────────────────────────────────────────────────────────────────
function ChatArea({ onInvite, showMembers, onToggleMembers, onSearch }) {
    const { messages, somaTyping, sendMessage, deleteMessage, reactToMessage, activeChannel, user, members } = useAxis();
    const [input, setInput]           = useState('');
    const [mode, setMode]             = useState('archive');
    const [gossipIdx, setGossipIdx]   = useState(0);
    const [replyTo, setReplyTo]       = useState(null);
    const [cmdHint, setCmdHint]       = useState(null);
    const [mentionSearch, setMentionSearch] = useState(null); // { query, start }
    const [mentionIdx, setMentionIdx]   = useState(0);
    const scrollRef                   = useRef(null);
    const textareaRef                 = useRef(null);

    const gossipMs    = GOSSIP_STEPS[gossipIdx];
    const gossipLabel = GOSSIP_LABELS[gossipIdx];
    const cycleGossip = () => setGossipIdx(i => (i + 1) % GOSSIP_STEPS.length);

    // @mention autocomplete
    const filteredMembers = useMemo(() => {
        if (!mentionSearch) return [];
        const q = mentionSearch.query.toLowerCase();
        // Include SOMA + real members
        const all = [{ user_name: 'soma', user_color: 'violet' }, ...members.filter(m => m.user_id !== user?.id)];
        return all.filter(m => m.user_name.toLowerCase().includes(q)).slice(0, 6);
    }, [mentionSearch, members, user?.id]);

    const completeMention = useCallback((memberName) => {
        if (!mentionSearch || !textareaRef.current) return;
        const before = input.slice(0, mentionSearch.start);
        const after  = input.slice(textareaRef.current.selectionStart);
        const newVal = before + '@' + memberName + ' ' + after;
        setInput(newVal);
        setMentionSearch(null);
        setTimeout(() => {
            const pos = before.length + memberName.length + 2;
            textareaRef.current?.setSelectionRange(pos, pos);
            textareaRef.current?.focus();
        }, 0);
    }, [input, mentionSearch]);

    // Message grouping
    const groups = useMemo(() => {
        const result = [];
        let cur = null;
        for (const msg of messages) {
            const sameUser = cur && (cur.senderId === (msg.sender_id || msg.senderId));
            const recent   = cur && ((msg.created_at - cur.lastAt) < 5 * 60 * 1000);
            const sameMode = cur && cur.mode === msg.mode;
            if (sameUser && recent && sameMode) {
                cur.messages.push(msg); cur.lastAt = msg.created_at;
            } else {
                cur = {
                    senderId:    msg.sender_id   || msg.senderId,
                    senderName:  msg.sender_name || msg.senderName,
                    senderColor: msg.sender_color || msg.senderColor || 'blue',
                    isSoma:      !!(msg.is_soma),
                    mode:        msg.mode,
                    lastAt:      msg.created_at,
                    messages:    [msg],
                    showHeader:  true,
                };
                result.push(cur);
            }
        }
        return result;
    }, [messages]);

    const replySource = useMemo(() => {
        const map = {};
        messages.forEach(m => { map[m.id] = m; });
        return map;
    }, [messages]);

    // Auto-scroll
    useEffect(() => {
        if (scrollRef.current) {
            const el   = scrollRef.current;
            const near = el.scrollHeight - el.scrollTop - el.clientHeight < 200;
            if (near) el.scrollTop = el.scrollHeight;
        }
    }, [messages, somaTyping]);

    // Slash command hint
    useEffect(() => {
        if (input.startsWith('/')) {
            const q = input.slice(1).toLowerCase();
            const CMDS = [
                { cmd: '/ask',       hint: '/ask [question] — ask SOMA directly' },
                { cmd: '/whisper',   hint: '/whisper [text] — send an ephemeral whisper' },
                { cmd: '/invite',    hint: '/invite — show invite code' },
                { cmd: '/summarize', hint: '/summarize — ask SOMA to summarize recent chat' },
            ];
            setCmdHint(CMDS.find(cmd => cmd.cmd.includes(q)) || null);
        } else {
            setCmdHint(null);
        }
    }, [input]);

    const handleInputChange = (e) => {
        const val = e.target.value;
        setInput(val);
        e.target.style.height = 'auto';
        e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';

        // @mention autocomplete detection
        const cursor = e.target.selectionStart;
        const before = val.slice(0, cursor);
        const match  = before.match(/@(\w*)$/);
        if (match) {
            setMentionSearch({ query: match[1], start: cursor - match[0].length });
            setMentionIdx(0);
        } else {
            setMentionSearch(null);
        }
    };

    const handleSend = useCallback(() => {
        const text = input.trim();
        if (!text) return;

        if (text.startsWith('/whisper ')) {
            sendMessage(text.slice(9).trim(), { mode: 'whisper' });
        } else if (text === '/invite') {
            onInvite();
        } else if (text.startsWith('/ask ')) {
            sendMessage('@soma ' + text.slice(5).trim(), { mode: 'archive', replyTo: replyTo?.id });
        } else if (text === '/summarize') {
            sendMessage('@soma Please summarize the recent conversation in this channel.', { mode: 'archive' });
        } else {
            const msgMode = mode === 'whisper' ? 'whisper' : gossipMs > 0 ? 'gossip' : 'archive';
            sendMessage(text, { mode: msgMode, replyTo: replyTo?.id, gossipMs: gossipMs || null });
        }

        setInput('');
        setReplyTo(null);
        setMentionSearch(null);
        if (textareaRef.current) { textareaRef.current.style.height = '36px'; }
        if (mode === 'whisper') setMode('archive');
    }, [input, mode, gossipMs, replyTo, sendMessage, onInvite]);

    const handleKeyDown = (e) => {
        // @mention dropdown navigation
        if (mentionSearch && filteredMembers.length > 0) {
            if (e.key === 'ArrowDown') { e.preventDefault(); setMentionIdx(i => (i + 1) % filteredMembers.length); return; }
            if (e.key === 'ArrowUp')   { e.preventDefault(); setMentionIdx(i => (i - 1 + filteredMembers.length) % filteredMembers.length); return; }
            if (e.key === 'Tab' || (e.key === 'Enter' && filteredMembers[mentionIdx])) {
                e.preventDefault();
                completeMention(filteredMembers[mentionIdx].user_name);
                return;
            }
            if (e.key === 'Escape') { setMentionSearch(null); return; }
        }
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
    };

    const ChannelIcon = CHANNEL_TYPE_ICON[activeChannel?.type] || Hash;

    if (!activeChannel) return (
        <div className="flex-1 flex items-center justify-center bg-[#09090b] text-zinc-600 text-sm">
            Select a channel to start
        </div>
    );

    const isWhisper = mode === 'whisper';

    return (
        <div className="flex-1 flex flex-col bg-[#09090b] min-w-0 relative">
            {/* Header */}
            <div className="h-[52px] shrink-0 border-b border-white/5 flex items-center px-4 gap-3 bg-[#0c0c0e]/80 backdrop-blur-sm">
                <ChannelIcon className="w-4 h-4 text-zinc-500 shrink-0" />
                <h2 className="text-sm font-bold text-zinc-100 truncate">{activeChannel.name}</h2>
                {activeChannel.description && <span className="text-xs text-zinc-600 hidden md:block truncate">— {activeChannel.description}</span>}
                <div className="ml-auto flex items-center gap-1">
                    <button onClick={onSearch} title="Search (Ctrl+F)" className="p-1.5 rounded-lg text-zinc-500 hover:bg-white/5 hover:text-zinc-300 transition-all">
                        <Search className="w-4 h-4" />
                    </button>
                    <button onClick={onInvite} className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] text-zinc-400 hover:text-zinc-200 hover:bg-white/5 transition-all border border-transparent hover:border-white/8">
                        <UserPlus className="w-3.5 h-3.5" /> Invite
                    </button>
                    <button onClick={onToggleMembers} className={`p-1.5 rounded-lg transition-all ${showMembers ? 'bg-white/8 text-zinc-200' : 'text-zinc-500 hover:bg-white/5 hover:text-zinc-300'}`}>
                        <Users className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* Messages */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto py-4 space-y-0.5 scroll-smooth">
                {messages.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-48 text-zinc-700 gap-2">
                        <ChannelIcon className="w-10 h-10 opacity-20" />
                        <p className="text-sm">No messages yet</p>
                        <p className="text-xs">Be the first to say something — or type <code className="px-1 py-0.5 bg-white/5 rounded text-zinc-500">@soma</code> to bring SOMA in</p>
                    </div>
                )}
                {groups.map((group, gi) => (
                    <MessageGroup
                        key={`g-${gi}`}
                        group={group}
                        onReact={reactToMessage}
                        onDelete={deleteMessage}
                        currentUserId={user?.id}
                        currentUserName={user?.name}
                        replySource={replySource}
                    />
                ))}
                {somaTyping && <SomaTyping />}
            </div>

            {/* @mention autocomplete dropdown */}
            {mentionSearch && filteredMembers.length > 0 && (
                <div className="absolute bottom-[80px] left-4 right-4 bg-[#1a1a1d] border border-white/10 rounded-xl shadow-2xl overflow-hidden z-20 max-w-xs">
                    {filteredMembers.map((m, i) => (
                        <button
                            key={m.user_name}
                            onClick={() => completeMention(m.user_name)}
                            className={`w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors ${i === mentionIdx ? 'bg-white/8' : 'hover:bg-white/5'}`}
                        >
                            <Avatar name={m.user_name} color={m.user_color} size="sm" isSoma={m.user_name === 'soma'} />
                            <span className={`text-[13px] font-medium ${c(m.user_color, 'text')}`}>{m.user_name}</span>
                        </button>
                    ))}
                </div>
            )}

            {/* Reply banner */}
            {replyTo && (
                <div className="mx-4 mb-2 flex items-center gap-2 px-3 py-1.5 bg-white/4 border border-white/8 rounded-lg">
                    <span className="text-[11px] text-zinc-400">Replying to <span className={`font-semibold ${c(replyTo.sender_color, 'text')}`}>{replyTo.sender_name}</span></span>
                    <span className="text-[11px] text-zinc-600 truncate flex-1">{replyTo.content?.slice(0, 60)}</span>
                    <button onClick={() => setReplyTo(null)} className="text-zinc-600 hover:text-zinc-300"><X className="w-3.5 h-3.5" /></button>
                </div>
            )}

            {/* Slash command hint */}
            {cmdHint && (
                <div className="mx-4 mb-1 px-3 py-1.5 bg-white/4 border border-white/8 rounded-lg">
                    <span className="text-[11px] text-zinc-400 font-mono">{cmdHint.hint}</span>
                </div>
            )}

            {/* Input bar */}
            <div className="px-4 pb-4 shrink-0">
                <div className={`flex items-end gap-2 rounded-2xl border transition-all p-2 ${isWhisper ? 'bg-red-500/5 border-red-500/20' : 'bg-white/[0.04] border-white/8 focus-within:border-white/15'}`}>
                    <button onClick={() => setMode(m => m === 'whisper' ? 'archive' : 'whisper')}
                        title="Whisper mode — never stored"
                        className={`p-2 rounded-xl transition-all shrink-0 ${isWhisper ? 'bg-red-500/20 text-red-400' : 'text-zinc-600 hover:bg-white/5 hover:text-zinc-300'}`}>
                        <Lock className="w-4 h-4" />
                    </button>

                    <textarea
                        ref={textareaRef}
                        value={input}
                        onChange={handleInputChange}
                        onKeyDown={handleKeyDown}
                        placeholder={isWhisper ? 'Whisper (never stored, never logged)…' : `Message #${activeChannel.name}`}
                        rows={1}
                        className="flex-1 bg-transparent text-[13.5px] text-zinc-200 placeholder:text-zinc-600 focus:outline-none resize-none py-1.5 px-1 leading-relaxed"
                        style={{ minHeight: '36px', maxHeight: '120px' }}
                    />

                    {!isWhisper && (
                        <button onClick={cycleGossip} title="Gossip mode — message auto-deletes"
                            className={`flex items-center gap-1 px-2 py-1.5 rounded-xl text-[11px] font-bold transition-all shrink-0 ${gossipIdx > 0 ? 'bg-amber-500/20 text-amber-400 border border-amber-500/20' : 'text-zinc-600 hover:bg-white/5 hover:text-zinc-400'}`}>
                            <Eye className="w-3.5 h-3.5" />
                            {gossipLabel && <span>{gossipLabel}</span>}
                        </button>
                    )}

                    <button onClick={handleSend} disabled={!input.trim()}
                        className="p-2 bg-zinc-100 text-zinc-900 rounded-xl hover:bg-white active:scale-95 disabled:opacity-25 disabled:cursor-not-allowed transition-all shrink-0">
                        <Send className="w-4 h-4" />
                    </button>
                </div>

                <div className="flex items-center gap-3 mt-1.5 px-1">
                    {isWhisper && <span className="text-[10px] text-red-400/70">🔴 Whisper — only broadcast, never stored</span>}
                    {gossipIdx > 0 && !isWhisper && <span className="text-[10px] text-amber-400/70">🟡 Gossip — auto-deletes in {gossipLabel}</span>}
                    {!isWhisper && gossipIdx === 0 && <span className="text-[10px] text-zinc-700">Enter to send · Shift+Enter for new line · @soma to summon · Ctrl+F to search</span>}
                </div>
            </div>
        </div>
    );
}

// ── Members Pane ──────────────────────────────────────────────────────────────
function MembersPane({ channelId, onInvite }) {
    const { members, user, removeMember, loadMembers } = useAxis();

    useEffect(() => { if (channelId) loadMembers(channelId); }, [channelId, loadMembers]);

    const realMembers = members.filter(m => m.user_id !== 'soma' && m.user_id !== 'system');

    return (
        <div className="w-[240px] shrink-0 bg-[#0a0a0c] border-l border-white/5 flex flex-col">
            <div className="px-4 py-3.5 border-b border-white/5 shrink-0">
                <h3 className="text-[11px] font-bold text-zinc-500 uppercase tracking-widest">Members — {realMembers.length + 1}</h3>
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
                {/* SOMA always first */}
                <div className="flex items-center gap-2.5 px-2 py-2 rounded-lg">
                    <div className="relative shrink-0">
                        <Avatar name="SOMA" color="violet" isSoma size="sm" />
                        <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-violet-400 border-2 border-[#0a0a0c]" />
                    </div>
                    <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                            <span className="text-[13px] font-semibold text-violet-400 truncate">SOMA</span>
                            <span className="text-[9px] bg-violet-500/20 text-violet-400 px-1.5 rounded-full border border-violet-500/20 font-bold uppercase tracking-wider">AI</span>
                        </div>
                        <span className="text-[10px] text-zinc-600">Always present</span>
                    </div>
                </div>

                {realMembers.length > 0 && <div className="w-full h-px bg-white/4 my-1" />}

                {realMembers.map(m => {
                    const isMe = m.user_id === user?.id;
                    return (
                        <div key={m.user_id} className="flex items-center gap-2.5 px-2 py-2 rounded-lg hover:bg-white/4 group transition-colors">
                            <div className="relative shrink-0">
                                <Avatar name={m.user_name} color={m.user_color} size="sm" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1">
                                    <span className={`text-[13px] font-medium truncate ${c(m.user_color, 'text')}`}>{m.user_name}</span>
                                    {isMe && <span className="text-[9px] text-zinc-600 font-medium">(you)</span>}
                                    {m.role === 'admin' && <span className="text-[9px] text-amber-400/70">★</span>}
                                </div>
                            </div>
                            {!isMe && (
                                <button onClick={() => removeMember(channelId, m.user_id)} className="opacity-0 group-hover:opacity-100 p-1 rounded text-zinc-600 hover:text-red-400 hover:bg-red-500/10 transition-all shrink-0">
                                    <X className="w-3 h-3" />
                                </button>
                            )}
                        </div>
                    );
                })}

                {realMembers.length === 0 && (
                    <div className="px-2 py-4 text-center">
                        <p className="text-[11px] text-zinc-600">Just you and SOMA</p>
                    </div>
                )}
            </div>

            <div className="p-3 border-t border-white/5 shrink-0">
                <button onClick={onInvite} className="w-full flex items-center justify-center gap-2 py-2 rounded-xl bg-white/5 border border-white/8 hover:bg-white/8 hover:border-white/15 text-zinc-400 hover:text-zinc-200 transition-all text-xs font-semibold">
                    <UserPlus className="w-3.5 h-3.5" /> Invite People
                </button>
            </div>
        </div>
    );
}

// ── User badge ────────────────────────────────────────────────────────────────
function UserBadge() {
    const { user } = useAxis();
    if (!user) return null;
    return (
        <div className="px-3 py-2.5 border-t border-white/5 flex items-center gap-2.5 bg-[#0e0e10] shrink-0">
            <Avatar name={user.name} color={user.color} size="sm" />
            <div className="flex-1 min-w-0">
                <p className={`text-[12px] font-semibold truncate ${c(user.color, 'text')}`}>{user.name}</p>
                <p className="text-[10px] text-zinc-600">Online</p>
            </div>
            <div className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
        </div>
    );
}

// ── Root ──────────────────────────────────────────────────────────────────────
function AxisContent() {
    const { user, activeChannelId, activeWorkspaceId, loading } = useAxis();
    const [showIdentity,  setShowIdentity]  = useState(!user);
    const [showCreateWs,  setShowCreateWs]  = useState(false);
    const [showCreateCh,  setShowCreateCh]  = useState(false);
    const [showInvite,    setShowInvite]    = useState(false);
    const [showJoin,      setShowJoin]      = useState(false);
    const [showMembers,   setShowMembers]   = useState(true);
    const [showSearch,    setShowSearch]    = useState(false);

    // Global Ctrl+F → search
    useEffect(() => {
        const h = (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
                e.preventDefault();
                setShowSearch(v => !v);
            }
        };
        window.addEventListener('keydown', h);
        return () => window.removeEventListener('keydown', h);
    }, []);

    if (loading && !user) return (
        <div className="flex h-full w-full items-center justify-center bg-[#09090b]">
            <div className="flex flex-col items-center gap-3 text-zinc-700">
                <div className="text-3xl">⬡</div>
                <p className="text-sm">Connecting to AXIS…</p>
            </div>
        </div>
    );

    return (
        <div className="flex h-full w-full overflow-hidden bg-[#09090b]">
            <WorkspaceRail onAdd={() => setShowCreateWs(true)} />

            <div className="flex flex-col border-r border-white/5 shrink-0" style={{ width: 220 }}>
                <ChannelSidebar onCreateCh={() => setShowCreateCh(true)} onJoin={() => setShowJoin(true)} />
                <UserBadge />
            </div>

            <ChatArea
                onInvite={() => setShowInvite(true)}
                showMembers={showMembers}
                onToggleMembers={() => setShowMembers(v => !v)}
                onSearch={() => setShowSearch(true)}
            />

            {showMembers && activeChannelId && (
                <MembersPane channelId={activeChannelId} onInvite={() => setShowInvite(true)} />
            )}

            {showIdentity  && <IdentityModal onDone={() => setShowIdentity(false)} />}
            {showCreateWs  && <CreateWorkspaceModal onClose={() => setShowCreateWs(false)} />}
            {showCreateCh  && <CreateChannelModal   onClose={() => setShowCreateCh(false)} />}
            {showInvite && activeChannelId && <InviteModal channelId={activeChannelId} onClose={() => setShowInvite(false)} />}
            {showJoin      && <JoinModal   onClose={() => setShowJoin(false)} />}
            {showSearch    && <SearchModal onClose={() => setShowSearch(false)} workspaceId={activeWorkspaceId} />}
        </div>
    );
}

export default function AxisApp() {
    return (
        <AxisProvider>
            <AxisContent />
        </AxisProvider>
    );
}
