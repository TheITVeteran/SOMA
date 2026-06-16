import * as React from 'react';
import { useEffect, useState } from 'react';
import { motion, AnimatePresence, PanInfo } from 'framer-motion';
import {
    LayoutDashboard, Radio, MessageSquare,
    Settings, ArrowLeft, Bell, LogOut,
    Play, Heart, Eye, TrendingUp,
    Globe, Brain, MonitorPlay, Users,
    Clock, Smartphone, Hash
} from 'lucide-react';
import { UserProfile } from '../../types';

interface Props {
    currentUser: UserProfile;
    onBack: () => void;
}

// Cascade carousel content — the "Top Performing Signals" media wall.
// (Still a curated set until a real signals media source is wired; the rest
//  of the cockpit below is live from the same /api/studio store the phone uses.)
const TOP_SIGNALS = [
    { id: 0, title: 'NEURAL_ARCH', views: '1.2M', duration: '12:04', image: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=400&q=80' },
    { id: 1, title: 'VOID_STATE', views: '890K', duration: '45:00', image: 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=400&q=80' },
    { id: 2, title: 'INTERFACE_01', views: '2.4M', duration: '08:20', image: 'https://images.unsplash.com/photo-1511447333015-45b65e60f6d5?w=400&q=80' },
    { id: 3, title: 'ECHO_CHAMBER', views: '500K', duration: '22:15', image: 'https://images.unsplash.com/photo-1515630278258-407f66498911?w=400&q=80' },
    { id: 4, title: 'DATASTREAM', views: '320K', duration: '15:30', image: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&q=80' },
    { id: 5, title: 'SYNTH_WAVE', views: '1.1M', duration: '1:00:00', image: 'https://images.unsplash.com/photo-1550684848-fac1c5b4e853?w=400&q=80' },
    { id: 6, title: 'DEEP_DIVE', views: '950K', duration: '34:10', image: 'https://images.unsplash.com/photo-1519638399535-1b036603ac77?w=400&q=80' },
    { id: 7, title: 'GLITCH_CORE', views: '2.1M', duration: '04:20', image: 'https://images.unsplash.com/photo-1605647540924-852290f6b0d5?w=400&q=80' },
    { id: 8, title: 'SYSTEM_RESET', views: '800K', duration: '11:45', image: 'https://images.unsplash.com/photo-1480796927426-f609979314bd?w=400&q=80' },
    { id: 9, title: 'GHOST_MODE', views: '1.5M', duration: '20:00', image: 'https://images.unsplash.com/photo-1528459801416-a9e53bbf4e17?w=400&q=80' },
];

const BRAINROT_CLIPS = [
    { id: 1, views: '1.2M', title: 'Neural Glitch', author: '@kaito', color: 'from-pink-500' },
    { id: 2, views: '840K', title: 'POV: You exist', author: '@void', color: 'from-purple-500' },
    { id: 3, views: '2.1M', title: 'Entropy', author: '@entropy', color: 'from-indigo-500' },
    { id: 4, views: '500K', title: 'Static', author: '@noise', color: 'from-blue-500' },
];

function ago(ts?: number) {
    if (!ts) return '';
    const s = Math.max(0, (Date.now() - ts) / 1000);
    if (s < 60) return Math.round(s) + 's';
    if (s < 3600) return Math.round(s / 60) + 'm';
    if (s < 86400) return Math.round(s / 3600) + 'h';
    return Math.round(s / 86400) + 'd';
}

const EcosystemView: React.FC<Props> = ({ currentUser, onBack }) => {
    const [activeTab, setActiveTab] = useState('Overview');
    const [activeSignalIndex, setActiveSignalIndex] = useState(2);

    // Live, shared with the phone Studio app — same /api/studio store.
    const [axis, setAxis] = useState<any>(null);
    const [communities, setCommunities] = useState<any[]>([]);
    const [cockpit, setCockpit] = useState<any>(null);
    const [synced, setSynced] = useState(false);

    useEffect(() => {
        let cancelled = false;
        Promise.all([
            fetch('/api/studio/axis').then(r => r.ok ? r.json() : null).catch(() => null),
            fetch('/api/studio/communities').then(r => r.ok ? r.json() : null).catch(() => null),
            fetch('/api/social/cockpit').then(r => r.ok ? r.json() : null).catch(() => null),
        ]).then(([a, c, s]) => {
            if (cancelled) return;
            const ax = a?.axis || null;
            setAxis(ax);
            setCommunities(Array.isArray(c?.communities) ? c.communities : []);
            setCockpit(s);
            setSynced(!!ax);
        });
        return () => { cancelled = true; };
    }, []);

    const chats: any[] = Array.isArray(axis?.chats) ? axis.chats : [];
    const friends: any[] = Array.isArray(axis?.friends) ? axis.friends : [];
    const directs = chats.slice().sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    const joinedCommunities = communities.filter(c => c.isJoined);

    const APPS = [
        { id: 'overview', label: 'Overview', icon: LayoutDashboard, color: 'text-white' },
        { id: 'brainrot', label: 'Brainrot', icon: Brain, color: 'text-pink-500' },
        { id: 'signal', label: 'Signal', icon: MonitorPlay, color: 'text-emerald-500' },
        { id: 'flux', label: 'Flux', icon: Eye, color: 'text-blue-500' },
        { id: 'directs', label: 'Directs', icon: MessageSquare, color: 'text-cyan-400' },
        { id: 'communities', label: 'Communities', icon: Users, color: 'text-purple-400' },
    ];

    const STATS = [
        { label: 'Contacts', value: String(friends.length), icon: Users, color: 'text-white' },
        { label: 'Directs', value: String(chats.length), icon: MessageSquare, color: 'text-cyan-400' },
        { label: 'Communities', value: String(joinedCommunities.length || communities.length), icon: Hash, color: 'text-purple-400' },
        { label: 'Social Queue', value: `${cockpit?.queue?.pending || 0}/${cockpit?.queue?.posted || 0}`, icon: Radio, color: 'text-emerald-400' },
    ];

    const handleDragEnd = (_e: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
        const threshold = 50;
        if (info.offset.x < -threshold) setActiveSignalIndex(prev => (prev + 1) % TOP_SIGNALS.length);
        else if (info.offset.x > threshold) setActiveSignalIndex(prev => (prev - 1 + TOP_SIGNALS.length) % TOP_SIGNALS.length);
    };

    const spotlight = TOP_SIGNALS[activeSignalIndex] || TOP_SIGNALS[0];

    return (
        <div className="h-full w-full bg-[#030303] text-white font-sans flex overflow-hidden selection:bg-purple-500/30">

            {/* Sidebar */}
            <aside className="hidden lg:flex flex-col w-20 hover:w-64 transition-all duration-300 group bg-[#080808] border-r border-white/5 h-full fixed left-0 top-0 z-50">
                <div className="p-6 flex items-center gap-4 overflow-hidden">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-cyan-500 to-purple-600 flex items-center justify-center shrink-0 shadow-lg shadow-cyan-500/20">
                        <Globe size={16} className="text-white" />
                    </div>
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-300 whitespace-nowrap">
                        <h1 className="text-lg font-bold font-display tracking-tight">THE STAGE</h1>
                    </div>
                </div>

                <nav className="flex-1 px-3 space-y-2 mt-4 overflow-y-auto no-scrollbar">
                    {APPS.map((item) => (
                        <button
                            key={item.id}
                            onClick={() => setActiveTab(item.label)}
                            className={`w-full flex items-center gap-4 px-3 py-3 rounded-xl transition-all duration-200 overflow-hidden relative ${activeTab === item.label ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white hover:bg-white/5'}`}
                        >
                            <item.icon size={20} className={`shrink-0 ${activeTab === item.label ? item.color : ''}`} />
                            <span className="text-sm font-medium whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-300">{item.label}</span>
                            {activeTab === item.label && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-white rounded-r-full" />}
                        </button>
                    ))}
                </nav>

                <div className="p-4 border-t border-white/5 space-y-2">
                    <button onClick={onBack} className="w-full flex items-center gap-4 px-3 py-3 rounded-xl text-white/40 hover:text-red-400 hover:bg-red-500/10 transition-colors">
                        <LogOut size={20} className="shrink-0" />
                        <span className="text-sm font-medium whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-300">Exit Cockpit</span>
                    </button>
                </div>
            </aside>

            {/* Main */}
            <main className="flex-1 flex flex-col h-full overflow-y-auto bg-[#030303] relative scrollbar-thin scrollbar-thumb-white/10 lg:ml-20">

                {/* Header */}
                <header className="sticky top-0 z-40 bg-[#030303]/80 backdrop-blur-xl border-b border-white/5 px-8 py-5 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button onClick={onBack} className="lg:hidden p-2 -ml-2 text-white/50 hover:text-white">
                            <ArrowLeft size={24} />
                        </button>
                        <div>
                            <h2 className="text-xl font-bold font-display tracking-tight">{activeTab}</h2>
                            <p className="text-xs text-white/40 font-mono">Your media, all in one place</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-6">
                        <div className={`hidden md:flex items-center gap-2 rounded-full px-4 py-2 border ${synced ? 'bg-emerald-400/5 border-emerald-400/20' : 'bg-white/5 border-white/5'}`}>
                            <Smartphone size={14} className={synced ? 'text-emerald-400' : 'text-white/40'} />
                            <span className="text-xs font-mono text-white/60">{synced ? 'SYNCED WITH STUDIO APP' : 'STUDIO OFFLINE'}</span>
                        </div>
                        <div className="h-8 w-px bg-white/10 mx-2" />
                        <div className="flex items-center gap-4">
                            <Bell size={20} className="text-white/50 hover:text-white transition-colors cursor-pointer" />
                            <img src={currentUser.avatar} className="w-9 h-9 rounded-full object-cover border border-white/10 ring-2 ring-transparent hover:ring-white/20 transition-all cursor-pointer" />
                        </div>
                    </div>
                </header>

                <div className="p-6 lg:p-10 max-w-[1800px] mx-auto w-full space-y-8 pb-20">

                    {/* Live stat strip — real, from the shared store */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        {STATS.map((s) => (
                            <div key={s.label} className="bg-[#0A0A0A] p-6 rounded-2xl border border-white/5 hover:border-white/10 transition-colors">
                                <div className="flex justify-between items-start mb-4">
                                    <div className={`p-3 rounded-xl bg-white/5 ${s.color}`}><s.icon size={20} className={s.color} /></div>
                                </div>
                                <h3 className="text-3xl font-bold text-white mb-1 tracking-tight">{s.value}</h3>
                                <p className="text-white/40 text-xs font-medium uppercase tracking-wider">{s.label}</p>
                            </div>
                        ))}
                    </div>

                    {/* Spotlight + live Directs rail */}
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:h-[600px]">

                        {/* Spotlight = currently selected Top Signal */}
                        <div className="lg:col-span-8 h-[400px] lg:h-full bg-[#0A0A0A] rounded-3xl border border-white/5 overflow-hidden relative group">
                            <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent z-10" />
                            <img src={spotlight.image.replace('w=400', 'w=1600')} className="w-full h-full object-cover opacity-60 group-hover:opacity-80 transition-opacity duration-500" />
                            <div className="absolute top-6 left-6 z-20 flex gap-3">
                                <div className="bg-white/10 backdrop-blur-md text-white/90 text-xs font-bold px-3 py-1 rounded-full flex items-center gap-2 border border-white/10 shadow-lg">
                                    <TrendingUp size={12} className="text-emerald-400" /> NOW SPOTLIGHTING
                                </div>
                            </div>
                            <div className="absolute bottom-0 left-0 right-0 p-8 z-20">
                                <h3 className="text-3xl font-bold text-white mb-2 font-display tracking-tight">{spotlight.title}</h3>
                                <div className="flex items-center gap-2 text-[11px] font-mono text-emerald-400 uppercase tracking-widest mb-6">
                                    <span>{spotlight.views} VIEWS</span>
                                    <span className="w-1 h-1 bg-emerald-500 rounded-full" />
                                    <span className="flex items-center gap-1"><Clock size={11} /> {spotlight.duration}</span>
                                </div>
                                <div className="flex items-center gap-4">
                                    <button className="px-6 py-3 bg-white text-black rounded-xl font-bold text-sm hover:scale-105 transition-transform flex items-center gap-2">
                                        <Play size={16} fill="currentColor" /> Watch
                                    </button>
                                    <button className="px-6 py-3 bg-white/10 text-white rounded-xl font-bold text-sm hover:bg-white/20 transition-colors backdrop-blur-md flex items-center gap-2">
                                        <Heart size={16} /> Save for Later
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Directs — live from the phone Studio app */}
                        <div className="lg:col-span-4 h-full bg-[#0A0A0A] rounded-3xl border border-white/5 flex flex-col overflow-hidden">
                            <div className="p-6 border-b border-white/5 flex justify-between items-center">
                                <div className="flex items-center gap-2">
                                    <MessageSquare size={18} className="text-cyan-400" />
                                    <span className="font-bold">Directs</span>
                                    {synced && <span className="text-[9px] font-mono uppercase tracking-widest text-emerald-400 bg-emerald-400/10 border border-emerald-400/20 px-2 py-0.5 rounded-full">live</span>}
                                </div>
                                <button className="text-white/30 hover:text-white"><Settings size={16} /></button>
                            </div>
                            <div className="flex-1 overflow-y-auto p-2 scrollbar-thin scrollbar-thumb-white/10">
                                {directs.length === 0 && (
                                    <div className="p-6 text-center text-sm text-white/30 font-mono">
                                        {synced ? 'No directs yet.' : 'Connect SOMA to see your Studio directs.'}
                                    </div>
                                )}
                                {directs.map((c) => (
                                    <div key={c.id} className="p-3 hover:bg-white/5 rounded-2xl transition-colors cursor-pointer group flex items-center gap-3">
                                        <div className="relative shrink-0">
                                            <img src={c.image} className="w-10 h-10 rounded-full object-cover border border-white/10" />
                                            {c.online && <span className="absolute -right-0.5 -bottom-0.5 w-3 h-3 rounded-full bg-emerald-500 border-2 border-[#0A0A0A]" />}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center justify-between gap-2">
                                                <h4 className="font-bold text-white text-sm truncate">{c.title}</h4>
                                                <span className="text-[10px] text-white/30 font-mono shrink-0">{ago(c.updatedAt)}</span>
                                            </div>
                                            <p className="text-xs text-white/45 truncate">{c.lastMessage || '—'}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Top Performing Signals — the cascade carousel (kept) */}
                    <div className="w-full">
                        <div className="flex items-center justify-between mb-6">
                            <div className="flex items-center gap-3">
                                <TrendingUp size={20} className="text-emerald-500" />
                                <h3 className="text-lg font-bold">Top Performing Signals</h3>
                            </div>
                            <div className="text-[10px] font-mono text-white/30 uppercase tracking-widest flex items-center gap-2">
                                <span>Swipe to nav</span>
                                <div className="flex gap-1">
                                    {TOP_SIGNALS.map((_, i) => (
                                        <div key={i} className={`w-1 h-1 rounded-full transition-colors ${i === activeSignalIndex ? 'bg-emerald-500' : 'bg-white/10'}`} />
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="relative h-[280px] w-full flex items-center justify-center overflow-hidden py-4 cursor-grab active:cursor-grabbing">
                            <div className="relative w-full max-w-4xl h-full flex items-center justify-center">
                                <AnimatePresence initial={false}>
                                    {TOP_SIGNALS.map((signal, index) => {
                                        const length = TOP_SIGNALS.length;
                                        let offset = (index - activeSignalIndex) % length;
                                        if (offset < 0) offset += length;
                                        if (offset > length / 2) offset -= length;
                                        const isActive = offset === 0;
                                        if (Math.abs(offset) > 3) return null;

                                        return (
                                            <motion.div
                                                key={signal.id}
                                                drag="x"
                                                dragConstraints={{ left: 0, right: 0 }}
                                                onDragEnd={handleDragEnd}
                                                onClick={() => setActiveSignalIndex(index)}
                                                initial={{ x: offset * 140, scale: 0.8, opacity: 0 }}
                                                animate={{
                                                    x: offset * 140,
                                                    y: 0,
                                                    scale: isActive ? 1.1 : 0.85,
                                                    opacity: isActive ? 1 : Math.max(0.3, 1 - Math.abs(offset) * 0.3),
                                                    zIndex: 10 - Math.abs(offset),
                                                }}
                                                transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                                                className={`absolute w-48 h-64 rounded-xl shadow-2xl overflow-hidden border border-white/10 transition-shadow duration-300 ${isActive ? 'shadow-emerald-500/20 ring-1 ring-white/20 bg-[#111]' : 'bg-[#050505] hover:border-white/20'}`}
                                                style={{ transformOrigin: 'center center' }}
                                            >
                                                <div className={`absolute inset-0 transition-opacity duration-500 ${isActive ? 'opacity-50' : 'opacity-30 grayscale'}`}>
                                                    <img src={signal.image} className="w-full h-full object-cover" draggable={false} />
                                                    <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent" />
                                                </div>
                                                {isActive && (
                                                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }} className="absolute inset-0 flex flex-col justify-end p-5">
                                                        <div className="w-10 h-10 rounded-full bg-white text-black flex items-center justify-center mb-4 shadow-lg scale-90 hover:scale-100 transition-transform">
                                                            <Play size={16} fill="currentColor" className="ml-0.5" />
                                                        </div>
                                                        <h3 className="text-2xl font-black font-display tracking-tighter text-white leading-none mb-2">{signal.title}</h3>
                                                        <div className="flex items-center gap-2 text-[10px] font-mono text-emerald-400 uppercase tracking-widest">
                                                            <span>{signal.views} VIEWS</span>
                                                            <span className="w-1 h-1 bg-emerald-500 rounded-full" />
                                                            <span className="flex items-center gap-1"><Clock size={10} /> {signal.duration}</span>
                                                        </div>
                                                    </motion.div>
                                                )}
                                                {!isActive && (
                                                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                                        <div className="rotate-[-90deg] whitespace-nowrap">
                                                            <h3 className="text-3xl font-black font-display tracking-widest text-white/40 uppercase max-w-[200px] truncate">{signal.title}</h3>
                                                        </div>
                                                    </div>
                                                )}
                                            </motion.div>
                                        );
                                    })}
                                </AnimatePresence>
                            </div>
                        </div>
                    </div>

                    {/* Brainrot Viral grid (kept) */}
                    <div>
                        <div className="flex items-center justify-between mb-6">
                            <div className="flex items-center gap-2">
                                <Brain size={20} className="text-pink-500" />
                                <h3 className="text-lg font-bold">Brainrot Viral</h3>
                            </div>
                            <button className="text-sm text-white/50 hover:text-white transition-colors">View All</button>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            {BRAINROT_CLIPS.map((clip) => (
                                <div key={clip.id} className="aspect-[9/16] bg-[#0A0A0A] rounded-2xl overflow-hidden relative group cursor-pointer border border-white/5 hover:border-pink-500/50 transition-colors">
                                    <div className={`absolute inset-0 bg-gradient-to-br ${clip.color} to-transparent opacity-10 group-hover:opacity-20 transition-opacity`} />
                                    <img src={`https://picsum.photos/400/800?random=${clip.id}`} className="w-full h-full object-cover opacity-60 group-hover:scale-105 transition-transform duration-700" />
                                    <div className="absolute top-3 right-3 bg-black/60 backdrop-blur-md px-2 py-1 rounded-md text-[10px] font-bold border border-white/10 flex items-center gap-1">
                                        <Eye size={10} /> {clip.views}
                                    </div>
                                    <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black to-transparent">
                                        <h4 className="text-sm font-bold text-white mb-1">{clip.title}</h4>
                                        <span className="text-xs text-white/60">{clip.author}</span>
                                    </div>
                                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                                        <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center">
                                            <Play size={20} fill="white" />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Communities — live from the shared store */}
                    {communities.length > 0 && (
                        <div>
                            <div className="flex items-center justify-between mb-6">
                                <div className="flex items-center gap-2">
                                    <Users size={20} className="text-purple-400" />
                                    <h3 className="text-lg font-bold">Communities</h3>
                                </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                                {communities.slice(0, 6).map((c: any) => (
                                    <div key={c.id} className="bg-[#0A0A0A] rounded-2xl border border-white/5 hover:border-purple-400/40 transition-colors p-4 flex items-center gap-4 cursor-pointer">
                                        <div className="w-12 h-12 rounded-xl bg-purple-500/10 flex items-center justify-center text-2xl shrink-0">{c.icon || '💬'}</div>
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-2">
                                                <h4 className="font-bold text-white text-sm truncate">{c.name}</h4>
                                                {c.isJoined && <span className="text-[9px] font-mono uppercase text-emerald-400 bg-emerald-400/10 px-1.5 py-0.5 rounded">joined</span>}
                                            </div>
                                            <p className="text-xs text-white/40 truncate">{c.description}</p>
                                        </div>
                                        <span className="text-xs text-white/40 font-mono shrink-0">{c.membersCount}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                </div>
            </main>
        </div>
    );
};

export default EcosystemView;
