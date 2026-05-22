import * as React from 'react';
import { useEffect, useState } from 'react';
import { motion, AnimatePresence, PanInfo } from 'framer-motion';
import { 
    LayoutDashboard, Radio, Repeat, Flame, MessageSquare, 
    Settings, ArrowLeft, Bell, Search, LogOut, 
    Play, Heart, Share2, Eye, TrendingUp, Activity,
    MoreHorizontal, Wifi, Globe, Zap, Brain, MonitorPlay, Users,
    ChevronRight, Mic, Clock
} from 'lucide-react';
import { UserProfile } from '../../types';

interface Props {
    currentUser: UserProfile;
    onBack: () => void;
}

// Mock Data for the Cascade Carousel (Best Performing Videos)
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

const EcosystemView: React.FC<Props> = ({ currentUser, onBack }) => {
    const [activeTab, setActiveTab] = useState('Overview');
    const [activeSignalIndex, setActiveSignalIndex] = useState(2); // Start with Interface_01
    const [socialCockpit, setSocialCockpit] = useState<any>(null);
    const [axisProfile, setAxisProfile] = useState<any>(null);
    
    // Hook to simulate live signal status. Set to true to simulate an active broadcast.
    const [isSignalLive, setIsSignalLive] = useState(false); 

    useEffect(() => {
        let cancelled = false;
        Promise.all([
            fetch('/api/social/cockpit').then(r => r.ok ? r.json() : null).catch(() => null),
            fetch('/api/studio/axis').then(r => r.ok ? r.json() : null).catch(() => null),
        ]).then(([social, axis]) => {
            if (cancelled) return;
            setSocialCockpit(social);
            setAxisProfile(axis?.axis || null);
        });
        return () => { cancelled = true; };
    }, []);

    const APPS = [
        { id: 'overview', label: 'Overview', icon: LayoutDashboard },
        { id: 'brainrot', label: 'Brainrot', icon: Brain, color: 'text-pink-500' },
        { id: 'signal', label: 'Signal', icon: MonitorPlay, color: 'text-emerald-500' },
        { id: 'flux', label: 'Flux', icon: Eye, color: 'text-blue-500' },
        { id: 'directs', label: 'Directs', icon: MessageSquare },
        { id: 'analytics', label: 'System', icon: Activity },
    ];

    const BRAINROT_CLIPS = [
        { id: 1, views: '1.2M', title: 'Neural Glitch', author: '@kaito', color: 'bg-pink-500' },
        { id: 2, views: '840K', title: 'POV: You exist', author: '@void', color: 'bg-purple-500' },
        { id: 3, views: '2.1M', title: 'Entropy', author: '@entropy', color: 'bg-indigo-500' },
        { id: 4, views: '500K', title: 'Static', author: '@noise', color: 'bg-blue-500' },
    ];

    const FLUX_TRENDS = [
        { topic: '#Cybernetics', posts: '42K' },
        { topic: 'New Tokyo', posts: '12K' },
        { topic: '#SystemUpdate', posts: '8.5K' },
        { topic: 'Neural Link', posts: '5K' },
    ];

    const STAGE_CAPABILITIES = [
        {
            name: 'SOMA Social Queue',
            status: 'connected',
            detail: `${socialCockpit?.queue?.pending || 0} pending / ${socialCockpit?.queue?.posted || 0} posted`,
            action: 'Queue and monitor autonomous posts',
            icon: Radio,
        },
        {
            name: 'Axis Identity',
            status: 'connected',
            detail: `${axisProfile?.friends?.length || 0} contacts / ${axisProfile?.chats?.length || 0} Directs`,
            action: 'Use Studio, Axis, and future apps as one Directs hub',
            icon: MessageSquare,
        },
        {
            name: 'Featured Image Pathway',
            status: 'connected',
            detail: 'SOMA/social-media/images',
            action: 'Attach managed images to social posts',
            icon: Share2,
        },
        {
            name: 'Gray Matter Network',
            status: 'coming soon',
            detail: '10-10k SOMA instances as federated social servers',
            action: 'Instance discovery, trust routing, shared graph propagation',
            icon: Brain,
        },
        {
            name: 'Stage Home Feed',
            status: 'coming soon',
            detail: 'Social home for SOMA operators',
            action: 'Posts, replies, signal rooms, creator pages',
            icon: Globe,
        },
        {
            name: 'Flux Trend Engine',
            status: 'coming soon',
            detail: 'Cross-instance trend sensing',
            action: 'Detect narratives before platforms surface them',
            icon: Eye,
        },
        {
            name: 'Signal Broadcast',
            status: 'coming soon',
            detail: 'Live rooms and replay surface',
            action: 'Operator streams, debates, public updates',
            icon: MonitorPlay,
        },
        {
            name: 'Brainrot Studio',
            status: 'coming soon',
            detail: 'Short-form creative experiments',
            action: 'Clip generation, remix tracking, meme intelligence',
            icon: Flame,
        },
    ];

    const handleSignalClick = (index: number) => {
        setActiveSignalIndex(index);
    };

    const handleDragEnd = (event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
        const threshold = 50; // Minimum distance to be considered a swipe
        
        if (info.offset.x < -threshold) {
            // Swipe Left -> Show Next (Next Index)
            setActiveSignalIndex(prev => (prev + 1) % TOP_SIGNALS.length);
        } else if (info.offset.x > threshold) {
            // Swipe Right -> Show Previous (Prev Index)
            setActiveSignalIndex(prev => (prev - 1 + TOP_SIGNALS.length) % TOP_SIGNALS.length);
        }
    };

    return (
        <div className="h-full w-full bg-[#030303] text-white font-sans flex overflow-hidden selection:bg-purple-500/30">
            
            {/* Sidebar - Glassmorphism */}
            <aside className="hidden lg:flex flex-col w-20 hover:w-64 transition-all duration-300 group bg-[#080808] border-r border-white/5 h-full fixed left-0 top-0 z-50">
                {/* Logo Area */}
                <div className="p-6 flex items-center gap-4 overflow-hidden">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center shrink-0 shadow-lg shadow-cyan-500/20">
                        <Globe size={16} className="text-white" />
                    </div>
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-300 whitespace-nowrap">
                        <h1 className="text-lg font-bold font-display tracking-tight">THE STAGE</h1>
                    </div>
                </div>

                {/* Navigation */}
                <nav className="flex-1 px-3 space-y-2 mt-4 overflow-y-auto no-scrollbar">
                    {APPS.map((item) => (
                        <button 
                            key={item.id}
                            onClick={() => setActiveTab(item.label)}
                            className={`
                                w-full flex items-center gap-4 px-3 py-3 rounded-xl transition-all duration-200 overflow-hidden relative
                                ${activeTab === item.label 
                                    ? 'bg-white/10 text-white' 
                                    : 'text-white/40 hover:text-white hover:bg-white/5'
                                }
                            `}
                        >
                            <item.icon size={20} className={`shrink-0 ${activeTab === item.label ? item.color : ''}`} />
                            <span className="text-sm font-medium whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                                {item.label}
                            </span>
                            {activeTab === item.label && (
                                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-white rounded-r-full" />
                            )}
                        </button>
                    ))}
                </nav>

                {/* Bottom Actions */}
                <div className="p-4 border-t border-white/5 space-y-2">
                    <button onClick={onBack} className="w-full flex items-center gap-4 px-3 py-3 rounded-xl text-white/40 hover:text-red-400 hover:bg-red-500/10 transition-colors">
                        <LogOut size={20} className="shrink-0" />
                        <span className="text-sm font-medium whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-300">Exit Cockpit</span>
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 flex flex-col h-full overflow-y-auto bg-[#030303] relative scrollbar-thin scrollbar-thumb-white/10 lg:ml-20">
                
                {/* Header */}
                <header className="sticky top-0 z-40 bg-[#030303]/80 backdrop-blur-xl border-b border-white/5 px-8 py-5 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button onClick={onBack} className="lg:hidden p-2 -ml-2 text-white/50 hover:text-white">
                            <ArrowLeft size={24} />
                        </button>
                        <div>
                            <h2 className="text-xl font-bold font-display tracking-tight flex items-center gap-2">
                                {activeTab} 
                                <span className={`text-[10px] ${isSignalLive ? 'bg-red-500 text-white' : 'bg-white/10 text-white/50'} px-2 py-0.5 rounded-full font-mono uppercase tracking-wider transition-colors`}>
                                    {isSignalLive ? 'Live' : 'Offline'}
                                </span>
                            </h2>
                        </div>
                    </div>

                    <div className="flex items-center gap-6">
                        <div className="hidden md:flex items-center gap-2 bg-white/5 rounded-full px-4 py-2 border border-white/5">
                            <Wifi size={14} className="text-emerald-500 animate-pulse" />
                            <span className="text-xs font-mono text-white/60">SYSTEM OPTIMAL</span>
                        </div>
                        <div className="h-8 w-px bg-white/10 mx-2" />
                        <div className="flex items-center gap-4">
                            <Bell size={20} className="text-white/50 hover:text-white transition-colors cursor-pointer" />
                            <img src={currentUser.avatar} className="w-9 h-9 rounded-full object-cover border border-white/10 ring-2 ring-transparent hover:ring-white/20 transition-all cursor-pointer" />
                        </div>
                    </div>
                </header>

                <div className="p-6 lg:p-10 max-w-[1800px] mx-auto w-full space-y-8 pb-20">
                    <section className="rounded-3xl border border-white/10 bg-[#0A0A0A] p-6">
                        <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                            <div>
                                <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-cyan-200">
                                    <Globe size={12} /> Stage Command Bridge
                                </div>
                                <h3 className="text-2xl font-bold text-white">Social command layer for SOMA operators</h3>
                                <p className="mt-2 max-w-3xl text-sm leading-relaxed text-white/50">
                                    Stage is the future social home inside SOMA. Today it can use SOMA's real social queue, Axis identity, and managed image pathway. Gray Matter networking stays marked as coming soon until multiple SOMA instances can federate safely.
                                </p>
                            </div>
                            <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-right">
                                <div className="text-2xl font-bold text-white">{STAGE_CAPABILITIES.filter(item => item.status === 'connected').length}/{STAGE_CAPABILITIES.length}</div>
                                <div className="text-[10px] font-bold uppercase tracking-widest text-white/35">Connected</div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
                            {STAGE_CAPABILITIES.map((capability) => (
                                <div
                                    key={capability.name}
                                    className={`rounded-2xl border p-4 ${capability.status === 'connected' ? 'border-emerald-400/20 bg-emerald-400/[0.06]' : 'border-white/10 bg-white/[0.025] opacity-70'}`}
                                >
                                    <div className="mb-4 flex items-start justify-between gap-3">
                                        <div className={`rounded-xl p-2 ${capability.status === 'connected' ? 'bg-emerald-400/10 text-emerald-300' : 'bg-white/5 text-white/35'}`}>
                                            <capability.icon size={18} />
                                        </div>
                                        <span className={`rounded-full border px-2 py-1 text-[9px] font-bold uppercase ${capability.status === 'connected' ? 'border-emerald-400/25 text-emerald-300' : 'border-white/10 text-white/35'}`}>
                                            {capability.status}
                                        </span>
                                    </div>
                                    <h4 className="text-sm font-bold text-white">{capability.name}</h4>
                                    <p className="mt-1 text-xs text-white/45">{capability.detail}</p>
                                    <p className="mt-3 text-[11px] leading-relaxed text-white/35">{capability.action}</p>
                                </div>
                            ))}
                        </div>
                    </section>
                    
                    {/* Top Stats Row */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <StatWidget label="Followers" value="1.2M" change="+12.5%" icon={Users} color="text-white" />
                        <StatWidget label="Following" value="842" change="+2" icon={Users} color="text-white/70" />
                        <StatWidget label="Total Reach" value="2.4M" change="+18%" icon={Globe} color="text-cyan-400" />
                        <StatWidget label="Engagement" value="8.9%" change="+0.5%" icon={Activity} color="text-purple-400" />
                    </div>

                    {/* Main Dashboard Grid */}
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:h-[600px]">
                        
                        {/* Signal Monitor (Large Video Area) */}
                        <div className="lg:col-span-8 h-[400px] lg:h-full bg-[#0A0A0A] rounded-3xl border border-white/5 overflow-hidden relative group">
                            <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent z-10" />
                            
                            {/* Dynamic Image based on Live Status */}
                            <img 
                                src={isSignalLive 
                                    ? "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=1600&q=80" 
                                    : "https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=1600&q=80"}
                                className="w-full h-full object-cover opacity-60 group-hover:opacity-80 transition-opacity duration-500" 
                            />
                            
                            <div className="absolute top-6 left-6 z-20 flex gap-3">
                                {isSignalLive ? (
                                    <>
                                        <div className="bg-red-500 text-white text-xs font-bold px-3 py-1 rounded-full flex items-center gap-2 animate-pulse">
                                            <MonitorPlay size={12} /> LIVE SIGNAL
                                        </div>
                                        <div className="bg-black/50 backdrop-blur-md text-white/70 text-xs font-mono px-3 py-1 rounded-full border border-white/10">
                                            12,402 WATCHING
                                        </div>
                                    </>
                                ) : (
                                    <div className="bg-white/10 backdrop-blur-md text-white/90 text-xs font-bold px-3 py-1 rounded-full flex items-center gap-2 border border-white/10 shadow-lg">
                                        <Radio size={12} className="text-blue-400" /> SUGGESTED STREAM
                                    </div>
                                )}
                            </div>

                            <div className="absolute bottom-0 left-0 right-0 p-8 z-20">
                                <h3 className="text-3xl font-bold text-white mb-2">
                                    {isSignalLive ? "The Future of Interface Design" : "System Architecture: Deep Dive"}
                                </h3>
                                <p className="text-white/60 max-w-2xl text-sm mb-6">
                                    {isSignalLive 
                                        ? "Live discussion on neural links, spatial computing, and the death of the screen."
                                        : "A masterclass on building scalable, decentralized interface systems. Broadcast 2h ago."}
                                </p>
                                
                                <div className="flex items-center gap-4">
                                    <button className="px-6 py-3 bg-white text-black rounded-xl font-bold text-sm hover:scale-105 transition-transform flex items-center gap-2">
                                        <Play size={16} fill="currentColor" /> 
                                        {isSignalLive ? "Watch Stream" : "Watch Replay"}
                                    </button>
                                    
                                    {isSignalLive ? (
                                        <button className="px-6 py-3 bg-white/10 text-white rounded-xl font-bold text-sm hover:bg-white/20 transition-colors backdrop-blur-md">
                                            Chat
                                        </button>
                                    ) : (
                                        <button className="px-6 py-3 bg-white/10 text-white rounded-xl font-bold text-sm hover:bg-white/20 transition-colors backdrop-blur-md flex items-center gap-2">
                                            <Heart size={16} /> Save for Later
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Flux Feed (Side Panel) */}
                        <div className="lg:col-span-4 h-full bg-[#0A0A0A] rounded-3xl border border-white/5 flex flex-col overflow-hidden">
                            <div className="p-6 border-b border-white/5 flex justify-between items-center">
                                <div className="flex items-center gap-2">
                                    <Eye size={18} className="text-blue-500" />
                                    <span className="font-bold">Flux Trends</span>
                                </div>
                                <button className="text-white/30 hover:text-white"><Settings size={16}/></button>
                            </div>
                            
                            <div className="flex-1 overflow-y-auto p-2 scrollbar-thin scrollbar-thumb-white/10">
                                {FLUX_TRENDS.map((trend, i) => (
                                    <div key={i} className="p-4 hover:bg-white/5 rounded-2xl transition-colors cursor-pointer group">
                                        <div className="flex justify-between items-start mb-1">
                                            <span className="text-xs text-white/40 font-mono">Trending in Tech</span>
                                            <MoreHorizontal size={14} className="text-white/20 group-hover:text-white/60" />
                                        </div>
                                        <h4 className="font-bold text-white mb-1">{trend.topic}</h4>
                                        <span className="text-xs text-blue-400">{trend.posts} posts</span>
                                    </div>
                                ))}
                                
                                <div className="p-4 border-t border-white/5 mt-2">
                                    <h5 className="text-xs font-bold text-white/50 mb-4 uppercase tracking-wider">Latest Updates</h5>
                                    {[1, 2].map(i => (
                                        <div key={i} className="flex gap-3 mb-4">
                                            <div className="w-8 h-8 rounded-full bg-white/10 flex-shrink-0" />
                                            <div>
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className="text-sm font-bold">System_Core</span>
                                                    <span className="text-[10px] text-white/40">2m</span>
                                                </div>
                                                <p className="text-xs text-white/70 leading-relaxed">
                                                    Deployment complete. Node alignment at 99.9%.
                                                </p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* NEW: Cascade Carousel (Top Performing Signals) */}
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
                                        <div 
                                            key={i} 
                                            className={`w-1 h-1 rounded-full transition-colors ${i === activeSignalIndex ? 'bg-emerald-500' : 'bg-white/10'}`} 
                                        />
                                    ))}
                                </div>
                            </div>
                        </div>
                        
                        <div className="relative h-[280px] w-full flex items-center justify-center overflow-hidden py-4 cursor-grab active:cursor-grabbing">
                            <div className="relative w-full max-w-4xl h-full flex items-center justify-center">
                                <AnimatePresence initial={false}>
                                    {TOP_SIGNALS.map((signal, index) => {
                                        const length = TOP_SIGNALS.length;
                                        // Calculate wrapped offset for infinite loop feel
                                        let offset = (index - activeSignalIndex) % length;
                                        if (offset < 0) offset += length;
                                        // Center the active item (0), allow negative offsets for items to the left
                                        if (offset > length / 2) offset -= length;

                                        const isActive = offset === 0;
                                        
                                        // Only render items within a certain range to keep DOM light and prevents "flying" from far edges
                                        if (Math.abs(offset) > 3) return null;

                                        return (
                                            <motion.div
                                                key={signal.id}
                                                drag="x"
                                                dragConstraints={{ left: 0, right: 0 }}
                                                onDragEnd={handleDragEnd}
                                                onClick={() => handleSignalClick(index)}
                                                initial={{ x: offset * 140, scale: 0.8, opacity: 0 }}
                                                animate={{ 
                                                    x: offset * 140, // Spacing
                                                    y: 0,
                                                    scale: isActive ? 1.1 : 0.85, 
                                                    opacity: isActive ? 1 : Math.max(0.3, 1 - Math.abs(offset) * 0.3),
                                                    zIndex: 10 - Math.abs(offset),
                                                }}
                                                transition={{ type: "spring", stiffness: 300, damping: 30 }}
                                                className={`
                                                    absolute w-48 h-64 rounded-xl shadow-2xl overflow-hidden
                                                    border border-white/10 transition-shadow duration-300
                                                    ${isActive ? 'shadow-emerald-500/20 ring-1 ring-white/20 bg-[#111]' : 'bg-[#050505] hover:border-white/20'}
                                                `}
                                                style={{
                                                    transformOrigin: "center center"
                                                }}
                                            >
                                                {/* Image Layer */}
                                                <div className={`absolute inset-0 transition-opacity duration-500 ${isActive ? 'opacity-50' : 'opacity-30 grayscale'}`}>
                                                    <img src={signal.image} className="w-full h-full object-cover" draggable={false} />
                                                    <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent" />
                                                </div>

                                                {/* Active Content (Center) */}
                                                {isActive && (
                                                    <motion.div 
                                                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}
                                                        className="absolute inset-0 flex flex-col justify-end p-5"
                                                    >
                                                        <div className="w-10 h-10 rounded-full bg-white text-black flex items-center justify-center mb-4 shadow-lg scale-90 hover:scale-100 transition-transform">
                                                            <Play size={16} fill="currentColor" className="ml-0.5" />
                                                        </div>
                                                        <h3 className="text-2xl font-black font-display tracking-tighter text-white leading-none mb-2">{signal.title}</h3>
                                                        <div className="flex items-center gap-2 text-[10px] font-mono text-emerald-400 uppercase tracking-widest">
                                                            <span>{signal.views} VIEWS</span>
                                                            <span className="w-1 h-1 bg-emerald-500 rounded-full"></span>
                                                            <span className="flex items-center gap-1"><Clock size={10} /> {signal.duration}</span>
                                                        </div>
                                                    </motion.div>
                                                )}

                                                {/* Inactive Content (Sides - Vertical Text) */}
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

                    {/* Brainrot Grid (Bottom) */}
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
                                    <div className={`absolute inset-0 bg-gradient-to-br ${clip.color} opacity-10 group-hover:opacity-20 transition-opacity`} />
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

                </div>
            </main>
        </div>
    );
};

// Simple Stat Widget Component
const StatWidget = ({ label, value, change, icon: Icon, color }: any) => (
    <div className="bg-[#0A0A0A] p-6 rounded-2xl border border-white/5 hover:border-white/10 transition-colors group">
        <div className="flex justify-between items-start mb-4">
            <div className={`p-3 rounded-xl bg-white/5 ${color} bg-opacity-10`}>
                <Icon size={20} className={color} />
            </div>
            <span className={`text-xs font-bold ${change.startsWith('+') ? 'text-emerald-400' : 'text-red-400'} bg-white/5 px-2 py-1 rounded-lg`}>
                {change}
            </span>
        </div>
        <h3 className="text-3xl font-bold text-white mb-1 tracking-tight">{value}</h3>
        <p className="text-white/40 text-xs font-medium uppercase tracking-wider">{label}</p>
    </div>
);

export default EcosystemView;
