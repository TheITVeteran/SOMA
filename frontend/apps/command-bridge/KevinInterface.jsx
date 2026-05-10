import React, { useState, useEffect, useRef } from 'react';
import {
  Shield, Activity, Lock, Power, Terminal, AlertTriangle,
  Cpu, Zap, Eye, Database, Network, Server, Unlock, Plus, Mail, Key, X,
  CheckCircle, ChevronRight, Settings, Radio, RefreshCw, Filter, Globe, Map, Target, Send, Bell,
  Info, ExternalLink, Copy, ArrowRight, HelpCircle, Cloud, AtSign, Inbox, MailOpen
} from 'lucide-react';
import { toast } from 'react-toastify';
import { KEVIN_QUOTES } from './data/kevinQuotes';
import KevinSMSSettings from './components/KevinSMSSettings';

const KevinInterface = () => {
  // State
  const [isOnline, setIsOnline] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [usingRealEmail, setUsingRealEmail] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [sensitivity, setSensitivity] = useState(85);
  const [protocols, setProtocols] = useState({
    heuristics: true, zeroTrust: true, toneAnalysis: false, linkDetonation: false,
    autoDraft: true, smartPriority: true, actionExtract: true, styleLearn: false
  });
  const [selectedProvider, setSelectedProvider] = useState(null);
  const [showEmailSetup, setShowEmailSetup] = useState(false);
  const [agentEmail, setAgentEmail] = useState('');
  const [agentPassword, setAgentPassword] = useState('');
  const [notificationStatus, setNotificationStatus] = useState({});
  const [notificationSettings, setNotificationSettings] = useState({
    slackWebhook: '', telegramBotToken: '', telegramChatId: '', discordWebhook: ''
  });

  const [kevinMood, setKevinMood] = useState('idle'); // idle, scanning, threat
  const [quote, setQuote] = useState(KEVIN_QUOTES.idle[0]);

  const emailProviders = {
    gmail: {
      name: 'Gmail / Google Workspace',
      iconType: 'google',
      color: '#EA4335',
      imapServer: 'imap.gmail.com',
      imapPort: 993,
      steps: [
        { title: 'Enable 2FA', desc: 'Go to your Google Account settings and enable 2-Step Verification.' },
        { title: 'Create App Password', desc: 'Search for "App Passwords" in your account settings. Create one for "Mail" on "Windows Computer".', link: 'https://myaccount.google.com/apppasswords', linkText: 'Google App Passwords' },
        { title: 'Copy Password', desc: 'Copy the 16-character code and paste it into the "App Password" field here.' }
      ],
      notes: 'Gmail requires an App Password. Your regular password will not work.'
    },
    outlook: {
      name: 'Outlook / Office 365',
      iconType: 'outlook',
      color: '#0078D4',
      imapServer: 'outlook.office365.com',
      imapPort: 993,
      steps: [
        { title: 'Security Settings', desc: 'Go to Security -> Advanced Security Options.', link: 'https://account.microsoft.com/security', linkText: 'Microsoft Security' },
        { title: 'App Passwords', desc: 'Look for "App passwords" section and click "Create a new app password".' },
        { title: 'Enable IMAP', desc: 'Ensure IMAP is enabled in your Outlook.com settings (Settings -> Mail -> Sync email).' }
      ]
    }
  };

  const renderProviderIcon = (type, size, color) => {
    return <Mail className={`${size === 'lg' ? 'w-6 h-6' : 'w-4 h-4'}`} style={{ color }} />;
  };
  
    // Chat State
    const [chatInput, setChatInput] = useState('');
    const [isKevinThinking, setIsKevinThinking] = useState(false);
    const [messages, setMessages] = useState([]); // { role: 'user' | 'assistant', content: string }
  
    const [scanLog, setScanLog] = useState([]);
    
    const [stats, setStats] = useState({});
    const [accounts, setAccounts] = useState([]);
    const [capabilities, setCapabilities] = useState(null);
    const [cockpit, setCockpit] = useState(null);
    const [approvals, setApprovals] = useState([]);
    const [trustGraph, setTrustGraph] = useState({ nodes: [], edges: [], recentDecisions: [] });
    const [timeline, setTimeline] = useState([]);
    const [localWatch, setLocalWatch] = useState(null);
    const [briefing, setBriefing] = useState(null);
    const [reputation, setReputation] = useState([]);
    const [activeTool, setActiveTool] = useState('link');
    const [linkUrl, setLinkUrl] = useState('');
    const [linkResult, setLinkResult] = useState(null);
    const [rewriteText, setRewriteText] = useState('');
    const [rewriteResult, setRewriteResult] = useState('');
    const [pairingSender, setPairingSender] = useState('');
    const [pairingResult, setPairingResult] = useState(null);

  // Fetch Kevin Data - REAL DATA ONLY
  useEffect(() => {
    const fetchKevinData = async () => {
      try {
        const statusRes = await fetch('/api/kevin/status');
        const logRes = await fetch('/api/kevin/scan-log');
        const capabilitiesRes = await fetch('/api/kevin/capabilities');
        const cockpitRes = await fetch('/api/kevin/cockpit');
        const approvalsRes = await fetch('/api/kevin/approvals');
        const graphRes = await fetch('/api/kevin/trust-graph');
        const timelineRes = await fetch('/api/kevin/verdict-timeline?limit=30');
        const localWatchRes = await fetch('/api/kevin/local-watch');
        const briefingRes = await fetch('/api/kevin/briefing');
        const reputationRes = await fetch('/api/kevin/reputation');

        if (statusRes.ok) {
          const data = await statusRes.json();
          if (data.success) {
            // Update UI state based on Backend state
            setIsOnline(data.status.online);
            setUsingRealEmail(data.status.usingRealEmail || false);
            if (data.status.stats) {
              setStats(data.status.stats);
            }

            // Sync with real config from backend
            if (data.status.config) {
                const cfg = data.status.config;
                setSensitivity(cfg.sensitivity || 85);
                if (cfg.protocols) setProtocols(prev => ({ ...prev, ...cfg.protocols }));
                
                // Map monitored_accounts to our UI list format
                if (cfg.monitored_accounts) {
                    setAccounts(cfg.monitored_accounts.map((email, idx) => ({
                        id: idx + 1,
                        email,
                        status: 'secure',
                        lastScan: 'Active'
                    })));
                }
            }

            if (Math.random() > 0.8 && !isKevinThinking) {
                setKevinMood(data.status.mood);
            }
          }
        }

        if (logRes.ok) {
          const data = await logRes.json();
          if (data.success) {
            setScanLog(data.logs);
          }
        }

        if (capabilitiesRes.ok) {
          const data = await capabilitiesRes.json();
          if (data.success) {
            setCapabilities(data);
          }
        }

        if (cockpitRes.ok) {
          const data = await cockpitRes.json();
          if (data.success) {
            setCockpit(data);
          }
        }

        if (approvalsRes.ok) {
          const data = await approvalsRes.json();
          if (data.success) setApprovals(data.approvals || []);
        }

        if (graphRes.ok) {
          const data = await graphRes.json();
          if (data.success) setTrustGraph({ nodes: data.nodes || [], edges: data.edges || [], recentDecisions: data.recentDecisions || [] });
        }

        if (timelineRes.ok) {
          const data = await timelineRes.json();
          if (data.success) setTimeline(data.events || []);
        }

        if (localWatchRes.ok) {
          const data = await localWatchRes.json();
          if (data.success) setLocalWatch(data);
        }

        if (briefingRes.ok) {
          const data = await briefingRes.json();
          if (data.success) setBriefing(data);
        }

        if (reputationRes.ok) {
          const data = await reputationRes.json();
          if (data.success) setReputation(data.reputation || []);
        }
      } catch (e) {
        console.error("Kevin connection failed", e);
      }
    };

    // Fetch immediately on mount
    fetchKevinData();
    
    // Poll regardless of local isOnline state so we can detect if backend starts/stops
    const interval = setInterval(fetchKevinData, 3000);

    return () => clearInterval(interval);
  }, [isKevinThinking]); // Removed isOnline from dependency so it runs always

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.target?.tagName === 'INPUT' || event.target?.tagName === 'TEXTAREA') return;
      const key = event.key.toLowerCase();
      if (key === 'v') setActiveTool('link');
      if (key === 'a') setActiveTool('approvals');
      if (key === 'r') setActiveTool('timeline');
      if (key === 'b') setActiveTool('pairing');
      if (key === 't') setActiveTool('trust');
      if (key === 'g') setActiveTool('graph');
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  // Handle Kevin Chat
  const handleChatSubmit = async (e) => {
    e.preventDefault();
    if (!chatInput.trim() || !isOnline || isKevinThinking) return;

    const message = chatInput.trim();
    setChatInput('');
    setIsKevinThinking(true);
    setKevinMood('scanning');

    // Add user message
    setMessages(prev => [...prev, { role: 'user', content: message }]);

    try {
      const res = await fetch('/api/kevin/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message })
      });
      const data = await res.json();
      if (data.success) {
        setQuote(data.response);
        setKevinMood('idle');
        // Add Kevin response
        setMessages(prev => [...prev, { role: 'assistant', content: data.response }]);
      }
    } catch (e) {
      toast.error("Communication with Kevin interrupted.");
    } finally {
      setIsKevinThinking(false);
    }
  };

  const togglePower = async () => {
    try {
      const res = await fetch('/api/kevin/toggle', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        const newStatus = data.status === 'started';
        setIsOnline(newStatus);
        if (newStatus) {
          setQuote("I'm awake! Let's protect some emails. 🛡️");
          setKevinMood('idle');
          toast.success('KEVIN Engine Activated');
        } else {
          setQuote("Going to sleep... stay safe! 💤");
          setKevinMood('offline');
          toast.info('KEVIN Engine Disengaged');
        }
      }
    } catch (e) {
      toast.error('Failed to toggle Kevin process');
    }
  };

  const handleAddAccount = async () => {
    if (!newEmail.includes('@')) {
      toast.error('Invalid email format');
      return;
    }
    
    const newId = accounts.length + 1;
    const newAccount = { id: newId, email: newEmail, status: 'pending', lastScan: 'Queued' };
    const updatedAccounts = [...accounts, newAccount];
    
    // Save immediately
    try {
      const res = await fetch('/api/kevin/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          thresholds: {
            spam: (100 - sensitivity) / 100,
            phishing: (100 - (sensitivity * 0.9)) / 100
          },
          monitored_accounts: updatedAccounts.map(a => a.email),
          protocols
        })
      });
      
      if (res.ok) {
        setAccounts(updatedAccounts);
        setNewEmail('');
        toast.success(`${newEmail} added and saved!`);
      } else {
        const errorData = await res.json().catch(() => ({ error: 'Unknown error' }));
        toast.error('Failed to save: ' + errorData.error);
      }
    } catch (e) {
      toast.error('Failed to add account: ' + e.message);
    }
  };

  const handleSaveSettings = async () => {
    console.log('[Kevin Settings] Starting save...');
    try {
      // UX Improvement: If agentEmail is provided, ensure it's in the monitored accounts list
      let finalMonitoredEmails = accounts.map(a => a.email);
      if (agentEmail && !finalMonitoredEmails.includes(agentEmail)) {
          finalMonitoredEmails.push(agentEmail);
          console.log('[Kevin Settings] Auto-adding connection email to monitored list:', agentEmail);
      }

      // 1. Save Kevin Config
      const configRes = await fetch('/api/kevin/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sensitivity,
          monitored_accounts: finalMonitoredEmails,
          protocols
        })
      });

      if (!configRes.ok) {
        throw new Error('Failed to save configuration');
      }

      // 2. Save Credentials (if provided)
      if (agentEmail && agentPassword) {
        console.log('[Kevin Settings] Saving email credentials...');
        const envRes = await fetch('/api/setup/env', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            EMAIL_ADDRESS: agentEmail,
            APP_PASSWORD: agentPassword
          })
        });

        if (!envRes.ok) {
          const errorData = await envRes.json();
          throw new Error('Failed to save credentials: ' + (errorData.error || envRes.statusText));
        }
        console.log('[Kevin Settings] Credentials saved');
        toast.success('Email credentials updated successfully!');
      } else {
        toast.success('Configuration saved successfully!');
      }

      setShowSettings(false);
    } catch (e) {
      console.error('[Kevin Settings] Save failed:', e);
      toast.error('Failed to save configuration: ' + e.message);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'safe': return <span className="px-2 py-1 bg-fuchsia-500/10 text-fuchsia-400 rounded-full text-[10px] font-bold border border-fuchsia-500/20">SAFE</span>;
      case 'threat': return <span className="px-2 py-1 bg-rose-500/10 text-rose-400 rounded-full text-[10px] font-bold border border-rose-500/20 animate-pulse">THREAT</span>;
      case 'spam': return <span className="px-2 py-1 bg-fuchsia-500/10 text-fuchsia-400 rounded-full text-[10px] font-bold border border-fuchsia-500/20">SPAM</span>;
      default: return <span className="px-2 py-1 bg-zinc-800 text-zinc-500 rounded-full text-[10px] font-bold border border-white/5">{status.toUpperCase()}</span>;
    }
  };

  const capabilityBadges = [
    { id: 'guard', label: 'Guard', active: capabilities?.surfaces?.operatorControl },
    { id: 'verdicts', label: 'Verdicts', active: capabilities?.surfaces?.evidenceFirstVerdicts },
    { id: 'approval', label: 'Approval Gate', active: capabilities?.surfaces?.approvalGate },
    { id: 'trust', label: 'Trust Graph', active: capabilities?.surfaces?.trustGraph?.people },
    { id: 'watch', label: 'Local Watch', active: capabilities?.surfaces?.localSystemWatch },
    { id: 'mail', label: 'Mail', active: capabilities?.integrations?.email?.connected },
  ];

  const verdictTone = (verdict) => {
    const v = String(verdict || '').toLowerCase();
    if (v.includes('block') || v.includes('threat') || v.includes('high')) return 'text-rose-400 border-rose-500/20 bg-rose-500/10';
    if (v.includes('caution') || v.includes('warning')) return 'text-amber-400 border-amber-500/20 bg-amber-500/10';
    if (v.includes('allow') || v.includes('safe') || v.includes('trust')) return 'text-emerald-400 border-emerald-500/20 bg-emerald-500/10';
    return 'text-zinc-400 border-white/10 bg-white/5';
  };

  const pendingApprovalCount = approvals.length;
  const blockedCount = Number(stats?.threats) || cockpit?.trustGraph?.people?.blocked || 0;
  const decisionCount = cockpit?.verdictEngine?.decisions || timeline.length || 0;
  const trustNodeCount = trustGraph.nodes.length || ((cockpit?.trustGraph?.people?.safe || 0) + (cockpit?.trustGraph?.people?.blocked || 0));
  const cockpitReadiness = Math.min(100, Math.round(
    (isOnline ? 25 : 0) +
    (usingRealEmail ? 20 : 8) +
    (capabilities?.surfaces?.approvalGate ? 15 : 0) +
    (capabilities?.surfaces?.trustGraph?.people ? 15 : 0) +
    (capabilities?.surfaces?.evidenceFirstVerdicts ? 15 : 0) +
    (localWatch?.status ? 10 : 0)
  ));
  const headerState = kevinMood === 'threat'
    ? { label: 'THREAT REVIEW', tone: 'text-rose-300 border-rose-500/30 bg-rose-500/10' }
    : kevinMood === 'scanning'
      ? { label: 'SCANNING EDGE', tone: 'text-amber-300 border-amber-500/30 bg-amber-500/10' }
      : isOnline
        ? { label: 'GUARD ONLINE', tone: 'text-emerald-300 border-emerald-500/30 bg-emerald-500/10' }
        : { label: 'OFFLINE', tone: 'text-zinc-500 border-white/10 bg-white/5' };
  const topSignals = [
    { label: 'Readiness', value: `${cockpitReadiness}%`, icon: Shield, tone: 'text-emerald-300', detail: usingRealEmail ? 'email edge connected' : 'local mode' },
    { label: 'Approvals', value: pendingApprovalCount, icon: Lock, tone: pendingApprovalCount ? 'text-amber-300' : 'text-zinc-300', detail: pendingApprovalCount ? 'needs operator' : 'clear' },
    { label: 'Trust Nodes', value: trustNodeCount, icon: Network, tone: 'text-cyan-300', detail: `${cockpit?.trustGraph?.people?.safe || 0} safe / ${cockpit?.trustGraph?.people?.blocked || 0} blocked` },
    { label: 'Verdicts', value: decisionCount, icon: Activity, tone: 'text-blue-300', detail: `${blockedCount} blocked` }
  ];

  const inspectLink = async () => {
    if (!linkUrl.trim()) return;
    setIsKevinThinking(true);
    try {
      const res = await fetch('/api/kevin/links/inspect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: linkUrl.trim() })
      });
      const data = await res.json();
      setLinkResult(data);
    } catch (error) {
      setLinkResult({ success: false, error: error.message });
    } finally {
      setIsKevinThinking(false);
    }
  };

  const rewriteAsUser = async () => {
    if (!rewriteText.trim()) return;
    setIsKevinThinking(true);
    try {
      const res = await fetch('/api/kevin/rewrite-user-style', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: rewriteText.trim(), guidance: 'keep it concise and natural' })
      });
      const data = await res.json();
      setRewriteResult(data.rewritten || data.error || '');
    } catch (error) {
      setRewriteResult(error.message);
    } finally {
      setIsKevinThinking(false);
    }
  };

  const createPairing = async () => {
    if (!pairingSender.trim()) return;
    setIsKevinThinking(true);
    try {
      const res = await fetch('/api/kevin/pairing/challenge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sender: pairingSender.trim(), metadata: { source: 'command_bridge' } })
      });
      setPairingResult(await res.json());
    } catch (error) {
      setPairingResult({ success: false, error: error.message });
    } finally {
      setIsKevinThinking(false);
    }
  };

  return (
    <div className="h-full flex flex-col bg-[#09090b] text-zinc-200 font-sans p-5 rounded-xl border border-white/5 relative overflow-hidden">
      <style>{`
        @keyframes slowWobble {
          0%, 100% { transform: rotate(-3deg) translateY(0px); }
          50% { transform: rotate(3deg) translateY(-2px); }
        }
        @keyframes kevinSweep {
          0% { transform: translateX(-120%); opacity: 0; }
          12% { opacity: .45; }
          45% { opacity: .12; }
          100% { transform: translateX(140%); opacity: 0; }
        }
        .kevin-wobble {
          animation: slowWobble 6s ease-in-out infinite;
        }
        .kevin-sweep::after {
          content: "";
          position: absolute;
          inset: 0;
          background: linear-gradient(90deg, transparent, rgba(34,211,238,.14), transparent);
          animation: kevinSweep 4.5s ease-in-out infinite;
          pointer-events: none;
        }
        .kevin-glass {
          background: linear-gradient(145deg, rgba(24,24,27,.86), rgba(9,9,11,.68));
          box-shadow: inset 0 1px 0 rgba(255,255,255,.04), 0 18px 40px rgba(0,0,0,.22);
        }
        .kevin-chip {
          background: rgba(255,255,255,.045);
          border: 1px solid rgba(255,255,255,.075);
        }
      `}</style>
      <div className="absolute inset-0 pointer-events-none opacity-40 bg-[linear-gradient(rgba(255,255,255,.035)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.035)_1px,transparent_1px)] bg-[size:42px_42px]" />
      <div className="absolute inset-x-0 top-0 h-48 pointer-events-none bg-[linear-gradient(180deg,rgba(14,165,233,.10),transparent)]" />

      {showSettings && (
        <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-lg max-h-[90vh] bg-[#151518] border border-white/10 rounded-2xl shadow-2xl flex flex-col">
            <div className="flex justify-between items-center p-6 pb-4 border-b border-white/5">
              <h2 className="text-xl font-bold text-white flex items-center"><Settings className="w-5 h-5 mr-2 text-zinc-400" /> Kevin Settings</h2>
              <button onClick={() => setShowSettings(false)} className="p-2 hover:bg-white/5 rounded-full transition-colors"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-6 overflow-y-auto flex-1 p-6 custom-scrollbar">
              <div>
                <h3 className="text-xs font-bold text-zinc-500 mb-3 uppercase tracking-widest flex items-center justify-between">
                  <span>Active Protocols</span>
                  <span className="text-[9px] text-zinc-600 font-normal normal-case tracking-normal">Security + Productivity</span>
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    // Security Protocols
                    { id: 'heuristics', label: 'Hyper-Heuristics', desc: 'Predictive pattern matching', type: 'security' },
                    { id: 'zeroTrust', label: 'Zero-Trust Auth', desc: 'Verify every header', type: 'security' },
                    { id: 'toneAnalysis', label: 'Tone Analysis', desc: 'Detect social engineering', type: 'security' },
                    { id: 'linkDetonation', label: 'Link Detonation', desc: 'Sandbox URL execution', type: 'security' },
                    // Productivity Protocols
                    { id: 'autoDraft', label: 'Auto-Draft', desc: 'Generate smart replies', type: 'productivity' },
                    { id: 'smartPriority', label: 'Smart Priority', desc: 'AI-based inbox sorting', type: 'productivity' },
                    { id: 'actionExtract', label: 'Action Extraction', desc: 'Find tasks & deadlines', type: 'productivity' },
                    { id: 'styleLearn', label: 'Style Learning', desc: 'Adapt to your tone', type: 'productivity' },
                  ].map(p => {
                    const isActive = protocols[p.id];
                    const isSecurity = p.type === 'security';

                    return (
                      <button
                        key={p.id}
                        onClick={() => setProtocols(prev => ({ ...prev, [p.id]: !prev[p.id] }))}
                        className={`text-left p-3 rounded-lg border transition-all ${isActive
                          ? isSecurity
                            ? 'bg-fuchsia-500/10 border-fuchsia-500/30'
                            : 'bg-emerald-500/10 border-emerald-500/30'
                          : 'bg-zinc-900 border-white/5 opacity-50'
                          }`}
                      >
                        <div className={`text-sm font-bold ${isActive
                          ? isSecurity
                            ? 'text-fuchsia-400'
                            : 'text-emerald-400'
                          : 'text-zinc-400'
                          }`}>
                          {p.label}
                        </div>
                        <div className="text-[10px] text-zinc-500">{p.desc}</div>
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <h3 className="text-xs font-bold text-zinc-500 mb-3 uppercase tracking-widest flex items-center justify-between">
                  <span>Email Connection</span>
                  <div className="flex items-center gap-2">
                    {usingRealEmail && <span className="text-[9px] text-emerald-500 font-bold">CONNECTED</span>}
                    <button
                      onClick={() => setShowEmailSetup(true)}
                      className="text-[9px] text-blue-400 hover:text-blue-300 flex items-center gap-1"
                      title="Setup Help"
                    >
                      <HelpCircle className="w-3 h-3" />
                      Setup Guide
                    </button>
                  </div>
                </h3>
                <div className="space-y-3 bg-black/20 p-3 rounded-lg border border-white/5">
                  {/* Provider Selector */}
                  <div className="space-y-1">
                    <label className="text-[10px] text-zinc-500 font-bold uppercase">Email Provider</label>
                    <div className="grid grid-cols-3 gap-2">
                      {Object.entries(emailProviders).slice(0, 6).map(([key, provider]) => (
                        <button
                          key={key}
                          onClick={() => { setSelectedProvider(key); setShowEmailSetup(true); }}
                          className={`p-2 rounded-lg border text-center transition-all hover:border-white/20 ${
                            selectedProvider === key
                              ? 'border-fuchsia-500/50 bg-fuchsia-500/10'
                              : 'border-white/5 bg-black/20'
                          }`}
                        >
                          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-black/30 border border-white/10">
                            {renderProviderIcon(provider.iconType, 'md', provider.color)}
                          </div>
                          <div className="text-[9px] text-zinc-400 truncate">{provider.name.split('/')[0].trim()}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] text-zinc-500 font-bold uppercase">Email Address</label>
                    <input
                      type="email"
                      value={agentEmail}
                      onChange={(e) => setAgentEmail(e.target.value)}
                      placeholder={usingRealEmail ? "Connected (Enter to update)" : "your-email@provider.com"}
                      className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-fuchsia-500/30 text-zinc-300"
                    />
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] text-zinc-500 font-bold uppercase">App Password</label>
                      <button
                        onClick={() => { if (!selectedProvider) setSelectedProvider('gmail'); setShowEmailSetup(true); }}
                        className="text-[9px] text-blue-400 hover:text-blue-300 flex items-center gap-0.5"
                      >
                        <Info className="w-3 h-3" />
                        How to get this?
                      </button>
                    </div>
                    <input
                      type="password"
                      value={agentPassword}
                      onChange={(e) => setAgentPassword(e.target.value)}
                      placeholder={usingRealEmail ? "••••••••••••" : "xxxx xxxx xxxx xxxx"}
                      className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-fuchsia-500/30 text-zinc-300 font-mono"
                    />
                  </div>
                  
                  {/* Direct Save/Test Button for Credentials */}
                  <div className="pt-2">
                    <button
                      onClick={async () => {
                        if (!agentEmail || !agentPassword) {
                          toast.error('Enter email and app password first');
                          return;
                        }
                        setIsKevinThinking(true);
                        try {
                          // Ensure it's in monitored list
                          let finalMonitoredEmails = accounts.map(a => a.email);
                          if (!finalMonitoredEmails.includes(agentEmail)) {
                              finalMonitoredEmails.push(agentEmail);
                          }

                          // Save credentials
                          const envRes = await fetch('/api/setup/env', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                              EMAIL_ADDRESS: agentEmail,
                              APP_PASSWORD: agentPassword
                            })
                          });

                          const envData = await envRes.json();
                          if (envRes.ok && envData.success) {
                            // Also update monitored list
                            await fetch('/api/kevin/config', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                  sensitivity,
                                  monitored_accounts: finalMonitoredEmails,
                                  protocols
                                })
                            });
                            
                            toast.success('Connection Verified & Saved!');
                            setUsingRealEmail(true);
                            setAgentPassword(''); // Clear from UI state for safety
                          } else {
                            toast.error('Verification failed: ' + (envData.error || 'Check credentials'));
                          }
                        } catch (e) {
                          toast.error('Connection failed: ' + e.message);
                        } finally {
                          setIsKevinThinking(false);
                        }
                      }}
                      disabled={isKevinThinking || !agentEmail || !agentPassword}
                      className="w-full py-2 bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 border border-blue-500/30 rounded-lg text-[10px] font-bold uppercase transition-all flex items-center justify-center gap-2"
                    >
                      {isKevinThinking ? (
                        <>
                          <RefreshCw className="w-3 h-3 animate-spin" />
                          Verifying Link...
                        </>
                      ) : (
                        <>
                          <Zap className="w-3 h-3" />
                          Verify & Save Connection
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
              <div>
                <h3 className="text-xs font-bold text-zinc-500 mb-3 uppercase tracking-widest">Monitored Accounts</h3>
                <div className="space-y-2 max-h-40 overflow-y-auto custom-scrollbar pr-2">
                  {accounts.map(acc => (
                    <div key={acc.id} className="flex justify-between items-center p-2.5 bg-[#09090b]/60 rounded-lg border border-white/5">
                      <div className="flex items-center space-x-3"><Mail className="w-3.5 h-3.5 text-zinc-500" /><span className="text-sm text-zinc-300">{acc.email}</span></div>
                      <button 
                        onClick={async () => {
                          const updatedAccounts = accounts.filter(a => a.id !== acc.id);
                          try {
                            const res = await fetch('/api/kevin/config', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({
                                thresholds: {
                                  spam: (100 - sensitivity) / 100,
                                  phishing: (100 - (sensitivity * 0.9)) / 100
                                },
                                monitored_accounts: updatedAccounts.map(a => a.email),
                                protocols
                              })
                            });
                            if (res.ok) {
                              setAccounts(updatedAccounts);
                              toast.success(`${acc.email} removed and saved!`);
                            } else {
                              toast.error('Failed to remove account');
                            }
                          } catch (e) {
                            toast.error('Failed to remove: ' + e.message);
                          }
                        }}
                        className="text-rose-400 hover:text-rose-300 text-[10px] font-bold uppercase"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
                <div className="mt-3 flex gap-2">
                  <input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="new-email@soma.dev" className="flex-1 bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-fuchsia-500/30" />
                  <button onClick={handleAddAccount} className="px-4 py-2 bg-fuchsia-600/20 text-fuchsia-400 border border-fuchsia-500/30 rounded-lg text-xs font-bold uppercase hover:bg-fuchsia-600/30 transition-all">Add</button>
                </div>
              </div>
              <div>
                <h3 className="text-xs font-bold text-zinc-500 mb-3 uppercase tracking-widest flex items-center justify-between">
                  <span>Alert Notifications</span>
                  <span className="text-[9px] text-zinc-600 font-normal normal-case tracking-normal">Slack / Telegram / Discord</span>
                </h3>
                <div className="space-y-3 bg-black/20 p-3 rounded-lg border border-white/5">
                  {/* Slack */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1">
                        <label className="text-[10px] text-zinc-500 font-bold uppercase">Slack Webhook URL</label>
                        <div className="group relative">
                          <Info className="w-3 h-3 text-zinc-600 hover:text-blue-400 cursor-help" />
                          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-zinc-900 border border-white/10 rounded-lg text-[10px] text-zinc-300 w-56 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 shadow-xl">
                            <div className="font-bold text-white mb-1">How to get this:</div>
                            <ol className="list-decimal list-inside space-y-0.5">
                              <li>Go to your Slack workspace</li>
                              <li>Apps → Incoming Webhooks</li>
                              <li>Add New Webhook to Workspace</li>
                              <li>Choose channel & copy URL</li>
                            </ol>
                            <a href="https://api.slack.com/messaging/webhooks" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline mt-1 inline-block">Slack Docs →</a>
                            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 w-2 h-2 bg-zinc-900 border-r border-b border-white/10 rotate-45"></div>
                          </div>
                        </div>
                      </div>
                      {notificationStatus.slack?.enabled && <span className="text-[9px] text-emerald-500 font-bold">ACTIVE</span>}
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={notificationSettings.slackWebhook}
                        onChange={(e) => setNotificationSettings(prev => ({ ...prev, slackWebhook: e.target.value }))}
                        placeholder="https://hooks.slack.com/services/..."
                        className="flex-1 bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-fuchsia-500/30 text-zinc-300 font-mono text-[11px]"
                      />
                      <button
                        onClick={async () => {
                          if (!notificationSettings.slackWebhook) {
                            toast.error('Enter a Slack webhook URL first');
                            return;
                          }
                          try {
                            const res = await fetch('/api/kevin/notifications/configure', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({
                                channel: 'slack',
                                config: { webhookUrl: notificationSettings.slackWebhook, enabled: true }
                              })
                            });
                            const data = await res.json();
                            if (data.success) {
                              toast.success('Slack webhook saved!');
                              // Refresh status
                              const statusRes = await fetch('/api/kevin/notifications/status');
                              const statusData = await statusRes.json();
                              setNotificationStatus(statusData);
                            } else {
                              toast.error('Failed to save: ' + (data.error || 'Unknown error'));
                            }
                          } catch (e) {
                            toast.error('Save failed: ' + e.message);
                          }
                        }}
                        className="px-4 py-2 bg-fuchsia-600/20 text-fuchsia-400 border border-fuchsia-500/30 rounded-lg text-xs font-bold uppercase hover:bg-fuchsia-600/30 transition-all"
                      >
                        Save
                      </button>
                    </div>
                  </div>
                  {/* Telegram */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1">
                        <label className="text-[10px] text-zinc-500 font-bold uppercase">Telegram Bot</label>
                        <div className="group relative">
                          <Info className="w-3 h-3 text-zinc-600 hover:text-blue-400 cursor-help" />
                          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-zinc-900 border border-white/10 rounded-lg text-[10px] text-zinc-300 w-52 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 shadow-xl">
                            <div className="font-bold text-white mb-1">Setup:</div>
                            <ol className="list-decimal list-inside space-y-0.5">
                              <li>Message @BotFather on Telegram</li>
                              <li>Send /newbot and follow prompts</li>
                              <li>Copy bot token</li>
                              <li>Add bot to your channel/group</li>
                              <li>Get chat ID from getUpdates API</li>
                            </ol>
                            <a href="https://core.telegram.org/bots#botfather" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline mt-1 inline-block">Docs →</a>
                            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 w-2 h-2 bg-zinc-900 border-r border-b border-white/10 rotate-45"></div>
                          </div>
                        </div>
                      </div>
                      {notificationStatus.telegram?.enabled && <span className="text-[9px] text-emerald-500 font-bold">ACTIVE</span>}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        value={notificationSettings.telegramBotToken}
                        onChange={(e) => setNotificationSettings(prev => ({ ...prev, telegramBotToken: e.target.value }))}
                        placeholder="Bot Token: 123456:ABC..."
                        className="bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-fuchsia-500/30 text-zinc-300 font-mono text-[11px]"
                      />
                      <input
                        type="text"
                        value={notificationSettings.telegramChatId}
                        onChange={(e) => setNotificationSettings(prev => ({ ...prev, telegramChatId: e.target.value }))}
                        placeholder="Chat ID: -1001234..."
                        className="bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-fuchsia-500/30 text-zinc-300 font-mono text-[11px]"
                      />
                    </div>
                    <button
                      onClick={async () => {
                        if (!notificationSettings.telegramBotToken || !notificationSettings.telegramChatId) {
                          toast.error('Enter both bot token and chat ID');
                          return;
                        }
                        try {
                          const res = await fetch('/api/kevin/notifications/configure', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                              channel: 'telegram',
                              config: {
                                botToken: notificationSettings.telegramBotToken,
                                chatId: notificationSettings.telegramChatId,
                                enabled: true
                              }
                            })
                          });
                          const data = await res.json();
                          if (data.success) {
                            toast.success('Telegram bot saved!');
                            const statusRes = await fetch('/api/kevin/notifications/status');
                            const statusData = await statusRes.json();
                            setNotificationStatus(statusData);
                          } else {
                            toast.error('Failed to save: ' + (data.error || 'Unknown error'));
                          }
                        } catch (e) {
                          toast.error('Save failed: ' + e.message);
                        }
                      }}
                      className="w-full px-4 py-2 bg-fuchsia-600/20 text-fuchsia-400 border border-fuchsia-500/30 rounded-lg text-xs font-bold uppercase hover:bg-fuchsia-600/30 transition-all"
                    >
                      Save Telegram Bot
                    </button>
                  </div>
                  {/* Discord */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1">
                        <label className="text-[10px] text-zinc-500 font-bold uppercase">Discord Webhook URL</label>
                        <div className="group relative">
                          <Info className="w-3 h-3 text-zinc-600 hover:text-blue-400 cursor-help" />
                          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-zinc-900 border border-white/10 rounded-lg text-[10px] text-zinc-300 w-56 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 shadow-xl">
                            <div className="font-bold text-white mb-1">How to get this:</div>
                            <ol className="list-decimal list-inside space-y-0.5">
                              <li>Open Discord channel settings</li>
                              <li>Integrations → Webhooks</li>
                              <li>New Webhook → Copy URL</li>
                            </ol>
                            <a href="https://support.discord.com/hc/en-us/articles/228383668" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline mt-1 inline-block">Discord Docs →</a>
                            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 w-2 h-2 bg-zinc-900 border-r border-b border-white/10 rotate-45"></div>
                          </div>
                        </div>
                      </div>
                      {notificationStatus.discord?.enabled && <span className="text-[9px] text-emerald-500 font-bold">ACTIVE</span>}
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={notificationSettings.discordWebhook}
                        onChange={(e) => setNotificationSettings(prev => ({ ...prev, discordWebhook: e.target.value }))}
                        placeholder="https://discord.com/api/webhooks/..."
                        className="flex-1 bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-fuchsia-500/30 text-zinc-300 font-mono text-[11px]"
                      />
                      <button
                        onClick={async () => {
                          if (!notificationSettings.discordWebhook) {
                            toast.error('Enter a Discord webhook URL first');
                            return;
                          }
                          try {
                            const res = await fetch('/api/kevin/notifications/configure', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({
                                channel: 'discord',
                                config: { webhookUrl: notificationSettings.discordWebhook, enabled: true }
                              })
                            });
                            const data = await res.json();
                            if (data.success) {
                              toast.success('Discord webhook saved!');
                              const statusRes = await fetch('/api/kevin/notifications/status');
                              const statusData = await statusRes.json();
                              setNotificationStatus(statusData);
                            } else {
                              toast.error('Failed to save: ' + (data.error || 'Unknown error'));
                            }
                          } catch (e) {
                            toast.error('Save failed: ' + e.message);
                          }
                        }}
                        className="px-4 py-2 bg-fuchsia-600/20 text-fuchsia-400 border border-fuchsia-500/30 rounded-lg text-xs font-bold uppercase hover:bg-fuchsia-600/30 transition-all"
                      >
                        Save
                      </button>
                    </div>
                  </div>
                  <div className="flex gap-2 mt-2 pt-2 border-t border-white/5">
                    <button
                      onClick={async () => {
                        const res = await fetch('/api/kevin/notifications/test', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ channel: 'slack' })
                        });
                        const data = await res.json();
                        if (data.success) toast.success('Slack test sent!');
                        else toast.error('Slack test failed: ' + (data.error || 'Not configured'));
                      }}
                      className="flex-1 px-3 py-1.5 bg-[#4A154B]/20 text-[#E01E5A] border border-[#4A154B]/30 rounded text-[10px] font-bold uppercase hover:bg-[#4A154B]/30 transition-all"
                    >
                      Test Slack
                    </button>
                    <button
                      onClick={async () => {
                        const res = await fetch('/api/kevin/notifications/test', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ channel: 'telegram' })
                        });
                        const data = await res.json();
                        if (data.success) toast.success('Telegram test sent!');
                        else toast.error('Telegram test failed: ' + (data.error || 'Not configured'));
                      }}
                      className="flex-1 px-3 py-1.5 bg-[#0088cc]/20 text-[#0088cc] border border-[#0088cc]/30 rounded text-[10px] font-bold uppercase hover:bg-[#0088cc]/30 transition-all"
                    >
                      Test Telegram
                    </button>
                    <button
                      onClick={async () => {
                        const res = await fetch('/api/kevin/notifications/test', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ channel: 'discord' })
                        });
                        const data = await res.json();
                        if (data.success) toast.success('Discord test sent!');
                        else toast.error('Discord test failed: ' + (data.error || 'Not configured'));
                      }}
                      className="flex-1 px-3 py-1.5 bg-[#5865F2]/20 text-[#5865F2] border border-[#5865F2]/30 rounded text-[10px] font-bold uppercase hover:bg-[#5865F2]/30 transition-all"
                    >
                      Test Discord
                    </button>
                  </div>
                  <p className="text-[9px] text-zinc-600 mt-2">Click Save after entering webhook URLs. Kevin will send threat alerts to all configured channels.</p>
                </div>
              </div>

              {/* SMS Settings Section */}
              <div>
                <KevinSMSSettings isConnected={isOnline} />
              </div>

              <div>
                <div className="flex justify-between items-center mb-3">
                  <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Security Sensitivity</h3>
                  <span className="text-fuchsia-400 font-mono text-xs font-bold">{sensitivity}%</span>
                </div>
                <div className="flex items-center space-x-4">
                  <span className="text-[10px] text-zinc-600 font-bold uppercase">Relaxed</span>
                  <input type="range" min="0" max="100" value={sensitivity} onChange={(e) => setSensitivity(parseInt(e.target.value))} className="flex-1 h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-fuchsia-500" />
                  <span className="text-[10px] text-zinc-600 font-bold uppercase">Paranoid</span>
                </div>
              </div>
            </div>
            <div className="p-6 pt-4 border-t border-white/5 flex justify-end">
              <button onClick={handleSaveSettings} className="px-8 py-2.5 bg-fuchsia-600 hover:bg-fuchsia-500 text-white font-bold text-xs uppercase tracking-widest rounded-lg transition-all shadow-lg shadow-fuchsia-900/20">Apply Configuration</button>
            </div>
          </div>
        </div>
      )}

      {/* Email Setup Wizard Modal */}
      {showEmailSetup && (
        <div className="absolute inset-0 z-[60] bg-black/90 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-[#151518] border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="p-4 border-b border-white/10 flex items-center justify-between" style={{ backgroundColor: selectedProvider ? emailProviders[selectedProvider]?.color + '10' : '#1a1a1a' }}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-black/30 border border-white/10 flex items-center justify-center">
                  {selectedProvider ? renderProviderIcon(emailProviders[selectedProvider]?.iconType, 'lg', emailProviders[selectedProvider]?.color) : <Mail className="w-6 h-6 text-zinc-400" />}
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">
                    {selectedProvider ? `${emailProviders[selectedProvider]?.name} Setup` : 'Email Setup Guide'}
                  </h2>
                  <p className="text-xs text-zinc-400">Follow these steps to connect Kevin to your email</p>
                </div>
              </div>
              <button onClick={() => setShowEmailSetup(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                <X className="w-5 h-5 text-zinc-400" />
              </button>
            </div>

            {/* Provider Selection (if none selected) */}
            {!selectedProvider && (
              <div className="p-6">
                <h3 className="text-sm font-bold text-zinc-300 mb-4">Select your email provider:</h3>
                <div className="grid grid-cols-2 gap-3">
                  {Object.entries(emailProviders).map(([key, provider]) => (
                    <button
                      key={key}
                      onClick={() => setSelectedProvider(key)}
                      className="p-4 rounded-xl border border-white/10 bg-black/20 hover:border-white/30 hover:bg-black/40 transition-all flex items-center gap-3 text-left"
                    >
                      <div className="w-10 h-10 rounded-lg bg-black/40 border border-white/10 flex items-center justify-center flex-shrink-0">
                        {renderProviderIcon(provider.iconType, 'lg', provider.color)}
                      </div>
                      <div>
                        <div className="font-bold text-white">{provider.name}</div>
                        <div className="text-[10px] text-zinc-500">IMAP: {provider.imapServer}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Step by Step Guide */}
            {selectedProvider && (
              <div className="p-6 max-h-[60vh] overflow-y-auto custom-scrollbar">
                {/* Steps */}
                <div className="space-y-4">
                  {emailProviders[selectedProvider]?.steps.map((step, idx) => (
                    <div key={idx} className="flex gap-4">
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-fuchsia-500/20 border border-fuchsia-500/30 flex items-center justify-center text-fuchsia-400 font-bold text-sm">
                        {idx + 1}
                      </div>
                      <div className="flex-1 pt-1">
                        <h4 className="font-bold text-white text-sm mb-1">{step.title}</h4>
                        <p className="text-xs text-zinc-400 mb-2">{step.desc}</p>
                        {step.link && (
                          <a
                            href={step.link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-500/10 text-blue-400 border border-blue-500/30 rounded-lg text-xs font-medium hover:bg-blue-500/20 transition-all"
                          >
                            <ExternalLink className="w-3 h-3" />
                            {step.linkText || 'Open Link'}
                            <Copy
                              className="w-3 h-3 ml-1 opacity-50 hover:opacity-100 cursor-pointer"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                navigator.clipboard.writeText(step.link);
                                toast.success('Link copied!');
                              }}
                            />
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Notes Section */}
                {emailProviders[selectedProvider]?.notes && (
                  <div className="mt-6 p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl">
                    <div className="flex items-start gap-2">
                      <Info className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                      <p className="text-xs text-amber-200">{emailProviders[selectedProvider].notes}</p>
                    </div>
                  </div>
                )}

                {/* Technical Details */}
                <div className="mt-6 p-4 bg-black/30 border border-white/5 rounded-xl">
                  <h4 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2">Technical Details</h4>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-zinc-500">IMAP Server:</span>
                      <span className="text-zinc-300 font-mono">{emailProviders[selectedProvider]?.imapServer}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-500">Port:</span>
                      <span className="text-zinc-300 font-mono">{emailProviders[selectedProvider]?.imapPort}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Footer */}
            <div className="p-4 border-t border-white/10 flex items-center justify-between bg-black/20">
              {selectedProvider ? (
                <>
                  <button
                    onClick={() => setSelectedProvider(null)}
                    className="px-4 py-2 text-zinc-400 hover:text-white text-xs font-bold uppercase transition-colors"
                  >
                    ← Back to Providers
                  </button>
                  <button
                    onClick={() => setShowEmailSetup(false)}
                    className="px-6 py-2 bg-fuchsia-600 hover:bg-fuchsia-500 text-white font-bold text-xs uppercase rounded-lg transition-all"
                  >
                    Got it, Close
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setShowEmailSetup(false)}
                  className="ml-auto px-4 py-2 text-zinc-400 hover:text-white text-xs font-bold uppercase transition-colors"
                >
                  Close
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Header Area */}
      <div className="relative z-10 kevin-glass kevin-sweep overflow-hidden rounded-xl border border-white/10 p-4 mb-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-4 min-w-0">
            <div className="relative shrink-0">
              <div className={`w-20 h-20 rounded-xl bg-zinc-900 border overflow-hidden flex items-center justify-center transition-all duration-500 ${isOnline ? (kevinMood === 'threat' ? 'border-rose-500/60 shadow-[0_0_26px_rgba(244,63,94,0.25)]' : 'border-emerald-500/50 shadow-[0_0_26px_rgba(16,185,129,0.16)]') : 'border-zinc-700 opacity-60 grayscale'}`}>
                <img
                  src="/kevin_icon.png"
                  alt="Kevin"
                  className="w-full h-full object-cover kevin-wobble"
                  onError={(e) => { e.target.src = '/kevin_profile.ico'; }}
                />
              </div>
              <div className={`absolute -bottom-1 -right-1 px-2 py-1 rounded-md border text-[8px] font-bold uppercase tracking-widest ${headerState.tone}`}>
                {isOnline ? 'LIVE' : 'IDLE'}
              </div>
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <h2 className="text-2xl font-black text-white tracking-tight leading-none">K.E.V.I.N.</h2>
                <span className={`px-2 py-1 rounded-md border text-[9px] font-bold uppercase tracking-widest ${headerState.tone}`}>{headerState.label}</span>
              </div>
              <div className="text-xs text-zinc-400 mb-2">Operator Guard / Personal Security Cockpit</div>
              <div className="flex flex-wrap gap-1.5 max-w-2xl">
                {capabilityBadges.map(capability => (
                  <span
                    key={capability.id}
                    className={`px-2.5 py-1 rounded-md border text-[9px] font-bold uppercase tracking-wider ${
                      capability.active
                        ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-300'
                        : 'bg-zinc-950/70 border-white/5 text-zinc-600'
                    }`}
                  >
                    {capability.label}
                  </span>
                ))}
              </div>
              {cockpit && (
                <div className="mt-3 flex flex-wrap gap-2 text-[10px] text-zinc-500 font-mono uppercase tracking-wider">
                  <span className="kevin-chip rounded-md px-2 py-1">mode {usingRealEmail ? 'edge email' : 'local watch'}</span>
                  <span className="kevin-chip rounded-md px-2 py-1">autonomy {cockpit.autonomy?.mode || 'guarded'}</span>
                  <span className="kevin-chip rounded-md px-2 py-1">evidence {cockpit.verdictEngine?.evidenceTypes?.length || 0} types</span>
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center space-x-3 shrink-0">
          <button
            onClick={() => setShowSettings(true)}
            className="p-3 bg-white/5 border border-white/10 hover:bg-white/10 rounded-lg transition-colors group"
            title="Kevin settings"
          >
            <Settings className="w-5 h-5 text-zinc-400 group-hover:text-white" />
          </button>
          <button
            onClick={togglePower}
            className={`flex items-center space-x-3 px-5 py-3 rounded-lg font-bold transition-all border ${isOnline
              ? 'bg-zinc-800/50 text-zinc-400 border-white/5 hover:bg-zinc-800'
              : 'bg-emerald-500/10 text-emerald-300 border-emerald-500/25 hover:bg-emerald-500/20'
              }`}
          >
            <Power className="w-5 h-5" />
            <span className="text-xs uppercase tracking-widest">{isOnline ? 'Disengage' : 'Wake Kevin'}</span>
          </button>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-3 mt-4">
          {topSignals.map(signal => {
            const Icon = signal.icon;
            return (
              <div key={signal.label} className="kevin-chip rounded-lg p-3 min-w-0">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest truncate">{signal.label}</span>
                  <Icon className={`w-4 h-4 ${signal.tone}`} />
                </div>
                <div className={`text-2xl font-mono leading-none ${signal.tone}`}>{signal.value}</div>
                <div className="text-[10px] text-zinc-600 mt-1 truncate">{signal.detail}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Message Center (Replaced by Chat Column) */}
      <div className="mb-4">
        {/* Optional: Status ticker or system alerts can go here instead of the chat console */}
      </div>

      {/* Main Content Grid */}
      <div className={`relative z-10 grid grid-cols-12 gap-4 flex-1 min-h-0 transition-opacity duration-500 ${isOnline ? 'opacity-100' : 'opacity-25 pointer-events-none'}`}>

        <div className="col-span-3 flex flex-col gap-4 min-h-0">
          <div className="grid grid-cols-2 gap-3">
            {[
              ['Scanned', (Number(stats?.scanned) || 0).toLocaleString(), 'text-white'],
              ['Blocked', Number(stats?.threats) || 0, 'text-rose-400'],
              ['Approvals', approvals.length, 'text-amber-400'],
              ['Decisions', cockpit?.verdictEngine?.decisions || 0, 'text-emerald-400']
            ].map(([label, value, tone]) => (
              <div key={label} className="kevin-glass p-3 rounded-lg border border-white/10">
                <div className="text-zinc-600 text-[9px] font-bold uppercase tracking-widest mb-1">{label}</div>
                <div className={`text-xl font-mono ${tone}`}>{value}</div>
              </div>
            ))}
          </div>

          <div className="kevin-glass rounded-lg border border-white/10 p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-2"><Bell className="w-4 h-4 text-amber-400" /> Briefing</h3>
              <span className={`px-2 py-0.5 rounded border text-[9px] uppercase ${verdictTone(localWatch?.status)}`}>{localWatch?.status || 'idle'}</span>
            </div>
            <div className="space-y-2">
              {(briefing?.summary || ['Waiting for briefing data']).map((line, idx) => (
                <div key={idx} className="text-[11px] text-zinc-400 bg-black/20 border border-white/5 rounded px-2 py-1">{line}</div>
              ))}
            </div>
          </div>

          <div className="kevin-glass rounded-lg border border-white/10 p-4 flex-1 min-h-0 overflow-hidden">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-2"><CheckCircle className="w-4 h-4 text-amber-400" /> Approvals</h3>
              <button onClick={() => setActiveTool('approvals')} className="text-[9px] text-zinc-500 hover:text-white">A</button>
            </div>
            <div className="space-y-2 overflow-y-auto custom-scrollbar max-h-[220px] pr-1">
              {approvals.map(item => (
                <div key={`${item.type}-${item.id}`} className="p-2 bg-black/30 rounded border border-amber-500/10">
                  <div className="flex justify-between gap-2">
                    <div className="text-[11px] text-zinc-200 font-bold truncate">{item.title}</div>
                    <span className="text-[9px] text-amber-400 uppercase">{item.type}</span>
                  </div>
                  <div className="text-[10px] text-zinc-500 truncate">{item.target}</div>
                  <div className="text-[10px] text-zinc-600 mt-1">{item.recommendedAction}</div>
                </div>
              ))}
              {approvals.length === 0 && <div className="py-8 text-center text-xs text-zinc-700 italic">No gated actions waiting.</div>}
            </div>
          </div>
        </div>

        <div className="col-span-5 grid grid-rows-[1fr_1fr] gap-4 min-h-0">
          <div className="grid grid-cols-2 gap-4 min-h-0">
            <div className="kevin-glass rounded-lg border border-white/10 p-4 min-h-0 overflow-hidden">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-2"><Network className="w-4 h-4 text-emerald-400" /> Trust Graph</h3>
                <button onClick={() => setActiveTool('graph')} className="text-[9px] text-zinc-500 hover:text-white">G</button>
              </div>
              <div className="grid grid-cols-2 gap-2 mb-3">
                <div className="bg-emerald-500/10 border border-emerald-500/20 rounded p-2">
                  <div className="text-[9px] uppercase text-emerald-500">Safe</div>
                  <div className="text-lg font-mono text-emerald-300">{cockpit?.trustGraph?.people?.safe || 0}</div>
                </div>
                <div className="bg-rose-500/10 border border-rose-500/20 rounded p-2">
                  <div className="text-[9px] uppercase text-rose-500">Blocked</div>
                  <div className="text-lg font-mono text-rose-300">{cockpit?.trustGraph?.people?.blocked || 0}</div>
                </div>
              </div>
              <div className="space-y-1 overflow-y-auto custom-scrollbar max-h-[130px]">
                {trustGraph.nodes.filter(n => n.type === 'person' || n.type === 'domain').slice(0, 12).map(node => (
                  <div key={node.id} className="flex items-center justify-between text-[10px] bg-black/20 rounded px-2 py-1 border border-white/5">
                    <span className="truncate text-zinc-300">{node.label}</span>
                    <span className={`uppercase ${node.status === 'blocked' ? 'text-rose-400' : node.status === 'safe' ? 'text-emerald-400' : 'text-zinc-600'}`}>{node.status}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="kevin-glass rounded-lg border border-white/10 p-4 min-h-0 overflow-hidden">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-2"><Activity className="w-4 h-4 text-blue-400" /> Verdict Timeline</h3>
                <button onClick={() => setActiveTool('timeline')} className="text-[9px] text-zinc-500 hover:text-white">R</button>
              </div>
              <div className="space-y-2 overflow-y-auto custom-scrollbar max-h-[210px] pr-1">
                {timeline.slice(0, 10).map(event => (
                  <div key={event.id} className="p-2 bg-black/25 border border-white/5 rounded">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-[11px] text-zinc-300 truncate">{event.title}</div>
                      <span className={`px-1.5 py-0.5 rounded border text-[8px] uppercase ${verdictTone(event.verdict)}`}>{event.verdict}</span>
                    </div>
                    <div className="text-[9px] text-zinc-600 font-mono mt-1">{event.target || event.type}</div>
                  </div>
                ))}
                {timeline.length === 0 && <div className="py-8 text-center text-xs text-zinc-700 italic">No verdicts yet.</div>}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 min-h-0">
            <div className="kevin-glass rounded-lg border border-white/10 p-4 min-h-0">
              <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-2 mb-3"><Eye className="w-4 h-4 text-cyan-400" /> Local Watch</h3>
              <div className="grid grid-cols-2 gap-2 mb-3">
                <div className="bg-black/20 border border-white/5 rounded p-2">
                  <div className="text-[9px] text-zinc-600 uppercase">Memory</div>
                  <div className="text-sm text-zinc-300 font-mono">{localWatch?.process?.memoryMb || 0}MB</div>
                </div>
                <div className="bg-black/20 border border-white/5 rounded p-2">
                  <div className="text-[9px] text-zinc-600 uppercase">Findings</div>
                  <div className="text-sm text-zinc-300 font-mono">{localWatch?.findings?.length || 0}</div>
                </div>
              </div>
              <div className="space-y-2 overflow-y-auto custom-scrollbar max-h-[125px]">
                {(localWatch?.findings || []).map((finding, idx) => (
                  <div key={idx} className="text-[10px] text-zinc-400 bg-black/20 border border-white/5 rounded p-2">
                    <span className="text-amber-400 uppercase">{finding.severity}</span> {finding.detail}
                  </div>
                ))}
                {(!localWatch?.findings || localWatch.findings.length === 0) && <div className="text-xs text-zinc-700 italic text-center py-8">Local perimeter clean.</div>}
              </div>
            </div>

            <div className="kevin-glass rounded-lg border border-white/10 p-4 min-h-0">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-2"><Database className="w-4 h-4 text-fuchsia-400" /> Reputation</h3>
                <button onClick={() => setActiveTool('trust')} className="text-[9px] text-zinc-500 hover:text-white">T</button>
              </div>
              <div className="space-y-2 overflow-y-auto custom-scrollbar max-h-[190px]">
                {reputation.slice(0, 8).map(row => (
                  <div key={row.target} className="flex items-center justify-between text-[10px] bg-black/20 rounded px-2 py-1.5 border border-white/5">
                    <span className="truncate text-zinc-300">{row.target}</span>
                    <span className={row.confidenceTrend === 'blocked' ? 'text-rose-400' : row.confidenceTrend === 'trusted' ? 'text-emerald-400' : 'text-zinc-600'}>{row.confidenceTrend}</span>
                  </div>
                ))}
                {reputation.length === 0 && <div className="text-xs text-zinc-700 italic text-center py-8">No reputation memory yet.</div>}
              </div>
            </div>
          </div>
        </div>

        <div className="col-span-4 bg-[#0c0c0e] rounded-xl border border-white/10 flex flex-col shadow-inner overflow-hidden relative min-h-0">
          <div className="absolute inset-0 bg-[linear-gradient(transparent_50%,rgba(0,0,0,0.2)_50%)] bg-[length:100%_4px] pointer-events-none opacity-20" />

          <div className="p-3 border-b border-white/5 bg-zinc-900/50 flex justify-between items-center">
            <div className="flex items-center space-x-2">
              <Terminal className={`w-4 h-4 ${isOnline ? 'text-fuchsia-400' : 'text-zinc-600'}`} />
              <span className="text-xs font-mono font-bold text-zinc-400">COCKPIT_TOOLS</span>
            </div>
            <div className="flex gap-1 text-[9px] text-zinc-600 font-mono">
              {['v','a','r','b','t','g'].map(k => <span key={k} className="px-1.5 py-0.5 rounded border border-white/5 bg-black/20">{k}</span>)}
            </div>
          </div>

          <div className="p-3 border-b border-white/5 flex gap-1 overflow-x-auto custom-scrollbar">
            {[
              ['link', 'Verdict'],
              ['approvals', 'Approvals'],
              ['timeline', 'Timeline'],
              ['pairing', 'Pairing'],
              ['trust', 'Trust'],
              ['rewrite', 'Rewrite'],
              ['chat', 'Chat']
            ].map(([id, label]) => (
              <button key={id} onClick={() => setActiveTool(id)} className={`px-2 py-1 rounded border text-[10px] font-bold uppercase ${activeTool === id ? 'bg-fuchsia-500/15 text-fuchsia-300 border-fuchsia-500/30' : 'bg-black/20 text-zinc-500 border-white/5 hover:text-zinc-300'}`}>{label}</button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar p-3 relative z-10">
            {activeTool === 'link' && (
              <div className="space-y-3">
                <div className="text-xs text-zinc-400 font-bold uppercase tracking-widest">Link Detonation Lite</div>
                <div className="flex gap-2">
                  <input value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} placeholder="https://example.com" className="flex-1 bg-black/50 border border-white/10 rounded px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-fuchsia-500/40" />
                  <button onClick={inspectLink} className="px-3 py-2 bg-fuchsia-600/20 text-fuchsia-300 border border-fuchsia-500/30 rounded text-xs font-bold">Scan</button>
                </div>
                {linkResult && (
                  <div className="p-3 bg-black/30 border border-white/10 rounded space-y-2">
                    <div className="flex justify-between">
                      <span className="text-xs text-zinc-300 truncate">{linkResult.hostname || linkResult.url || 'Result'}</span>
                      <span className={`px-2 py-0.5 rounded border text-[9px] uppercase ${verdictTone(linkResult.verdict)}`}>{linkResult.verdict || 'error'} {linkResult.score ?? ''}</span>
                    </div>
                    <div className="text-[10px] text-zinc-500">{linkResult.recommendedAction || linkResult.error}</div>
                    {(linkResult.evidence || []).map((e, idx) => <div key={idx} className="text-[10px] text-zinc-400 border border-white/5 rounded px-2 py-1">{e.type}: {e.detail}</div>)}
                  </div>
                )}
              </div>
            )}

            {activeTool === 'approvals' && (
              <div className="space-y-2">
                <div className="text-xs text-zinc-400 font-bold uppercase tracking-widest">Approval Queue</div>
                {approvals.map(item => (
                  <div key={`${item.type}-${item.id}`} className="p-3 bg-black/30 border border-amber-500/10 rounded">
                    <div className="text-sm text-zinc-200 font-bold">{item.title}</div>
                    <div className="text-[10px] text-zinc-500">{item.target}</div>
                    <div className="text-[10px] text-amber-400 mt-2">{item.recommendedAction}</div>
                  </div>
                ))}
                {approvals.length === 0 && <div className="text-xs text-zinc-700 italic text-center py-10">No approvals pending.</div>}
              </div>
            )}

            {activeTool === 'timeline' && (
              <div className="space-y-2">
                <div className="text-xs text-zinc-400 font-bold uppercase tracking-widest">Verdict Timeline</div>
                {timeline.map(event => (
                  <div key={event.id} className="p-2 bg-black/30 border border-white/5 rounded">
                    <div className="flex justify-between gap-2">
                      <span className="text-xs text-zinc-300 truncate">{event.title}</span>
                      <span className={`px-1.5 py-0.5 rounded border text-[8px] uppercase ${verdictTone(event.verdict)}`}>{event.verdict}</span>
                    </div>
                    <div className="text-[9px] text-zinc-600">{event.timestamp}</div>
                  </div>
                ))}
              </div>
            )}

            {activeTool === 'pairing' && (
              <div className="space-y-3">
                <div className="text-xs text-zinc-400 font-bold uppercase tracking-widest">Pairing Challenge</div>
                <input value={pairingSender} onChange={(e) => setPairingSender(e.target.value)} placeholder="unknown@sender.com" className="w-full bg-black/50 border border-white/10 rounded px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-fuchsia-500/40" />
                <button onClick={createPairing} className="w-full px-3 py-2 bg-blue-600/20 text-blue-300 border border-blue-500/30 rounded text-xs font-bold uppercase">Generate Challenge</button>
                {pairingResult && (
                  <div className="p-3 bg-black/30 border border-white/10 rounded">
                    <div className="text-lg text-blue-300 font-mono">{pairingResult.code || 'No Code'}</div>
                    <div className="text-[10px] text-zinc-500">{pairingResult.message || pairingResult.error}</div>
                  </div>
                )}
              </div>
            )}

            {activeTool === 'trust' && (
              <div className="space-y-2">
                <div className="text-xs text-zinc-400 font-bold uppercase tracking-widest">Reputation Memory</div>
                {reputation.map(row => (
                  <div key={row.target} className="p-2 bg-black/30 border border-white/5 rounded">
                    <div className="flex justify-between gap-2">
                      <span className="text-xs text-zinc-300 truncate">{row.target}</span>
                      <span className={row.confidenceTrend === 'blocked' ? 'text-rose-400' : row.confidenceTrend === 'trusted' ? 'text-emerald-400' : 'text-zinc-600'}>{row.confidenceTrend}</span>
                    </div>
                    <div className="text-[9px] text-zinc-600">safe {row.safeInteractions} / suspicious {row.suspiciousInteractions} / reversals {row.reversals}</div>
                  </div>
                ))}
                {reputation.length === 0 && <div className="text-xs text-zinc-700 italic text-center py-10">No reputation memory yet.</div>}
              </div>
            )}

            {activeTool === 'graph' && (
              <div className="space-y-2">
                <div className="text-xs text-zinc-400 font-bold uppercase tracking-widest">Graph Nodes</div>
                {trustGraph.nodes.map(node => (
                  <div key={node.id} className="flex items-center justify-between p-2 bg-black/30 border border-white/5 rounded text-xs">
                    <span className="text-zinc-300 truncate">{node.label}</span>
                    <span className="text-[9px] text-zinc-600 uppercase">{node.type}:{node.status}</span>
                  </div>
                ))}
              </div>
            )}

            {activeTool === 'rewrite' && (
              <div className="space-y-3">
                <div className="text-xs text-zinc-400 font-bold uppercase tracking-widest">Operator Style Rewrite</div>
                <textarea value={rewriteText} onChange={(e) => setRewriteText(e.target.value)} placeholder="Paste draft text..." className="w-full min-h-[110px] bg-black/50 border border-white/10 rounded px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-fuchsia-500/40" />
                <button onClick={rewriteAsUser} className="w-full px-3 py-2 bg-emerald-600/20 text-emerald-300 border border-emerald-500/30 rounded text-xs font-bold uppercase">Rewrite In My Style</button>
                {rewriteResult && <div className="p-3 bg-black/30 border border-white/10 rounded text-xs text-zinc-300 whitespace-pre-wrap">{rewriteResult}</div>}
              </div>
            )}

            {activeTool === 'chat' && (
              <div className="flex flex-col h-full min-h-[360px]">
                <div className="flex-1 overflow-y-auto custom-scrollbar space-y-3">
                  {messages.length === 0 && isOnline && (
                    <div className="flex flex-col items-start animate-in fade-in">
                      <div className="max-w-[90%] rounded-lg p-2.5 text-xs bg-fuchsia-900/10 text-fuchsia-200 border border-fuchsia-500/20">{quote}</div>
                      <span className="text-[9px] text-zinc-700 mt-1 uppercase font-mono">K.E.V.I.N.</span>
                    </div>
                  )}
                  {messages.map((msg, idx) => (
                    <div key={idx} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                      <div className={`max-w-[90%] rounded-lg p-2.5 text-xs ${msg.role === 'user' ? 'bg-zinc-800 text-zinc-200 border border-white/5' : 'bg-fuchsia-900/10 text-fuchsia-200 border border-fuchsia-500/20'}`}>{msg.content}</div>
                      <span className="text-[9px] text-zinc-700 mt-1 uppercase font-mono">{msg.role === 'user' ? 'YOU' : 'K.E.V.I.N.'}</span>
                    </div>
                  ))}
                </div>
                <form onSubmit={handleChatSubmit} className="flex gap-2 mt-3">
                  <input type="text" value={chatInput} onChange={(e) => setChatInput(e.target.value)} placeholder={isOnline ? "Type command..." : "System offline"} disabled={!isOnline} className="flex-1 bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-xs font-mono text-fuchsia-500 placeholder-zinc-700 focus:outline-none focus:border-fuchsia-500/50 disabled:opacity-50" />
                  <button type="submit" disabled={!isOnline || isKevinThinking || !chatInput.trim()} className="p-2 bg-fuchsia-600/20 text-fuchsia-400 border border-fuchsia-500/30 rounded-lg hover:bg-fuchsia-600/30 disabled:opacity-50"><Send className="w-3 h-3" /></button>
                </form>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};

export default KevinInterface;
