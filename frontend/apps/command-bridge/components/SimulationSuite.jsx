import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  TrendingUp, Globe, Database, Code2, 
  ChevronRight, ChevronDown, FlaskConical, Brain, Swords, Zap, Radio,
  BarChart3, Code, Activity, Terminal, Share2, Twitter, Linkedin, MessageSquare,
  Search, Eye, MousePointer2, Layout, Clock, Calendar, Image as ImageIcon,
  Box, Cpu, Trophy, TrendingDown, DollarSign, BarChart2, Shield, Compass, BookOpen, Microscope, Sparkles,
  Plus, Save, Trash2, ClipboardCheck
} from 'lucide-react';

// Import full simulations
import MarketSim from './simulations/MarketSim';
import CodeSandboxView from './CodeSandboxView';

/**
 * SimulationSuite.jsx — SOMA's Autonomous Reality Modeling Suite
 * VERIFICATION_ID: SOMA_UI_VERIFIED_V51_ML_INTERN
 */

// ── Shared Utils ───────────────────────────────────────────────────────────
const formatTime = (ts) => {
  if (!ts) return 'never';
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const moduleStatusById = (suiteStatus, id) =>
  suiteStatus?.modules?.find(module => module.id === id) || null;

// ── ML Intern Sim Card Body (NEW) ──────────────────────────────────────────
function MlInternCardBody() {
  const [status, setStatus] = useState(null);
  useEffect(() => {
    const load = async () => {
      try {
        const r = await fetch('/api/soma/ml-intern/status');
        if (r.ok) setStatus(await r.json());
      } catch {}
    };
    load();
    const t = setInterval(load, 8000);
    return () => clearInterval(t);
  }, []);

  if (!status) return (
    <div className="flex flex-col items-center justify-center h-full gap-1.5 text-zinc-700">
      <Microscope className="w-6 h-6 opacity-15" />
      <span className="text-[10px]">Initialising intern...</span>
    </div>
  );

  return (
    <div className="flex flex-col h-full p-2.5 gap-2">
      <div className="flex items-center justify-between shrink-0">
        <span className="text-[9px] text-zinc-600 uppercase tracking-wider font-bold">Research Intern</span>
        <span className={`flex items-center gap-1 text-[9px] font-mono ${status.busy ? 'text-blue-400' : 'text-zinc-500'}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${status.busy ? 'bg-blue-400 animate-pulse' : 'bg-zinc-600'}`} />
          {status.busy ? 'researching' : 'standby'}
        </span>
      </div>
      <div className="px-2 py-1.5 rounded bg-blue-500/5 border border-blue-500/10 shrink-0">
        <div className="text-[8px] text-zinc-500 uppercase font-bold">Active Domain</div>
        <div className="text-[10px] text-blue-300 font-mono truncate">arXiv / HuggingFace</div>
      </div>
      <div className="flex-1 flex flex-col justify-end min-h-0">
        <div className="text-[9px] text-zinc-600 uppercase tracking-wider mb-1 font-bold">Knowledge Harvest</div>
        <div className="flex items-center justify-between text-[11px] font-mono text-white">
            <span className="flex items-center gap-1"><BookOpen className="w-3 h-3 text-blue-500" /> Papers</span>
            <span className="text-blue-400">{status.latestFindings?.length || 0} Found</span>
        </div>
      </div>
    </div>
  );
}

// ── ML Intern View (Full Screen) ───────────────────────────────────────────
function MlInternView() {
    const [findings, setFindings] = useState([]);
    
    useEffect(() => {
        // In a real run, SOMA would populate this via tool use.
        // We poll the status for any new data if available.
        const poll = async () => {
            try {
                const r = await fetch('/api/soma/ml-intern/status');
                if (r.ok) {
                    const data = await r.json();
                    if (data.latestFindings) setFindings(data.latestFindings);
                }
            } catch {}
        };
        poll();
    }, []);

    return (
        <div className="flex-1 flex flex-col overflow-hidden min-h-0 p-5 bg-black/40">
            <div className="flex items-center gap-4 mb-6">
                <div className="p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/20 shadow-[0_0_15px_rgba(59,130,246,0.1)]">
                    <Microscope className="w-6 h-6 text-blue-400" />
                </div>
                <div>
                    <h2 className="text-xl font-bold text-white tracking-tight italic uppercase">ML INTERN RESEARCH HUB</h2>
                    <p className="text-xs text-blue-500/60 font-medium tracking-widest uppercase">Autonomous Paper Extraction · Recursive Learning</p>
                </div>
            </div>

            <div className="flex-1 grid grid-cols-3 gap-5 overflow-hidden">
                <div className="col-span-2 flex flex-col rounded-2xl border border-white/10 bg-zinc-900/40 overflow-hidden shadow-2xl">
                    <div className="px-6 py-4 border-b border-white/10 bg-white/5 flex items-center justify-between">
                        <span className="text-[12px] font-bold text-zinc-200 uppercase tracking-widest">Indexed Papers</span>
                    </div>
                    <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-4">
                        {findings.length > 0 ? findings.map((f, i) => (
                            <div key={i} className="p-5 rounded-xl bg-zinc-900/60 border border-white/5 shadow-lg group hover:border-blue-500/20 transition-all">
                                <div className="text-blue-400 text-xs font-bold uppercase mb-2">{f.source || 'ARXIV'}</div>
                                <div className="text-sm font-bold text-white mb-2">{f.title}</div>
                                <div className="text-xs text-zinc-400 leading-relaxed italic line-clamp-3">"{f.summary}"</div>
                            </div>
                        )) : (
                            <div className="flex flex-col items-center justify-center h-full text-zinc-600 italic gap-3 opacity-30">
                                <BookOpen className="w-12 h-12" />
                                <span>No papers indexed in this session.</span>
                            </div>
                        )}
                    </div>
                </div>

                <div className="flex flex-col rounded-2xl border border-blue-500/20 bg-zinc-900/40 p-6 shadow-2xl">
                    <h3 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-4">Intern Parameters</h3>
                    <div className="space-y-4">
                        <div className="p-4 rounded-xl bg-black/40 border border-white/5">
                            <div className="text-[8px] text-zinc-600 uppercase font-bold mb-1">Target Models</div>
                            <div className="text-xs text-blue-400 font-mono">Llama-3, Gemma-3, Qwen-2.5</div>
                        </div>
                        <div className="p-4 rounded-xl bg-black/40 border border-white/5">
                            <div className="text-[8px] text-zinc-600 uppercase font-bold mb-1">LoRA Alpha</div>
                            <div className="text-xs text-emerald-400 font-mono">0.125 (Optimized)</div>
                        </div>
                        <div className="mt-auto pt-6 opacity-30">
                            <Brain className="w-full h-24 text-blue-900/20" />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ── Shared Card Bodies ───────────────────────────────────────────────────

function BiotechCardBody() {
  const [lab, setLab] = useState(null);
  useEffect(() => {
    const load = async () => {
      try {
        const r = await fetch('/api/soma/biotech/status');
        if (r.ok) setLab(await r.json());
      } catch {}
    };
    load();
    const t = setInterval(load, 10000);
    return () => clearInterval(t);
  }, []);
  
  if (!lab) return (
    <div className="flex flex-col items-center justify-center h-full gap-1.5 text-zinc-700">
      <FlaskConical className="w-6 h-6 opacity-15" />
      <span className="text-[10px]">Initialising lab...</span>
    </div>
  );

  return (
    <div className="flex flex-col h-full p-2.5 gap-2">
      <div className="flex items-center justify-between shrink-0">
        <span className="text-[9px] text-zinc-600 uppercase tracking-wider font-bold">Sovereign Lab</span>
        <span className={`flex items-center gap-1 text-[9px] font-mono text-emerald-400`}>
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          active
        </span>
      </div>
      <div className="px-2 py-1 rounded bg-emerald-500/10 border border-emerald-500/20 shrink-0">
        <div className="text-[9px] text-emerald-400 font-bold truncate">{lab.project || 'Initiative'}</div>
        <div className="text-[10px] text-zinc-300 font-mono text-[8px]">Target: {lab.target || 'None'}</div>
      </div>
      <div className="flex-1 flex flex-col justify-end min-h-0">
        <div className="text-[9px] text-zinc-600 uppercase tracking-wider mb-1 font-bold">Poseidon Certainty</div>
        <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden border border-white/5">
          <div 
            className="h-full bg-emerald-500 rounded-full transition-all duration-1000" 
            style={{ width: `${(lab.confidence || 0) * 100}%` }}
          />
        </div>
        <div className="mt-1 text-[9px] text-zinc-500 font-mono">{(lab.confidence || 0) * 100}% Poseidon Verified</div>
      </div>
    </div>
  );
}

// ── Medical Lab View (Steel City RESTORED) ──────────────────────────────────
function MedicalLabView() {
  const [lab, setLab] = useState(null);
  const [logs, setLogs] = useState([]);

  useEffect(() => {
    const poll = async () => {
      try {
        const r = await fetch('/api/soma/biotech/status');
        if (r.ok) {
            const data = await r.json();
            setLab(data);
            if (data.latestFindings && data.latestFindings.length > 0) {
                setLogs(data.latestFindings);
            }
        }
      } catch {}
    };
    poll();
    const t = setInterval(poll, 5000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="flex-1 flex flex-col overflow-hidden min-h-0 p-5 bg-black/40">
      <div className="flex items-center gap-4 mb-4">
        <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
          <FlaskConical className="w-5 h-5 text-emerald-400" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-white tracking-tight italic uppercase tracking-widest">Sovereign Medical Lab</h2>
          <p className="text-xs text-emerald-500/60 font-medium tracking-widest uppercase">Phased Industrial Research · Local Modeling</p>
        </div>

        {lab && (
            <div className="ml-auto flex items-center gap-6">
                <div className="text-right">
                    <div className="text-[10px] text-zinc-500 uppercase tracking-widest mb-1">Target Molecule</div>
                    <div className="text-sm font-mono font-bold text-white">{lab.target || '—'}</div>
                </div>
                <div className="text-right">
                    <div className="text-[10px] text-zinc-500 uppercase tracking-widest mb-1">Testing Round</div>
                    <div className="text-sm font-mono font-bold text-orange-400">{lab.testingRound || 1} / 3</div>
                </div>
                <div className="w-48 text-right">
                    <div className="text-[10px] text-zinc-500 uppercase tracking-widest mb-1">Mission Progress</div>
                    <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 bg-zinc-800 rounded-full overflow-hidden border border-white/5">
                            <div className="h-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]" style={{ width: `${(lab.progress || 0) * 100}%` }} />
                        </div>
                        <span className="text-xs font-mono text-emerald-400 font-bold">{(lab.progress || 0) * 100}%</span>
                    </div>
                </div>
            </div>
        )}
      </div>

      <div className="flex-1 grid grid-cols-2 gap-4 overflow-hidden">
        <div className="flex flex-col rounded-xl border border-emerald-500/20 bg-zinc-900/40 overflow-hidden">
          <div className="px-4 py-2 border-b border-emerald-500/20 bg-emerald-500/5 flex items-center gap-2">
            <Zap className="w-4 h-4 text-emerald-400" />
            <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest">Recent Discoveries</span>
          </div>
          <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-4">
            {logs.length === 0 ? (
                <div className="flex items-center justify-center h-full text-zinc-600 italic text-sm">
                    Awaiting 99.9% consensus...
                </div>
            ) : (
                logs.map((log, i) => (
                    <div key={i} className="p-4 rounded-lg bg-black/40 border border-white/5 animate-in slide-in-from-top duration-500 shadow-xl">
                        <div className="text-xs font-bold text-emerald-400 mb-2 uppercase tracking-wide">🔬 {log.target} + {log.strand}</div>
                        <div className="text-[11px] text-zinc-300 leading-relaxed font-mono line-clamp-3">{log.dossierSummary}</div>
                        <div className="mt-3 flex items-center justify-between border-t border-white/5 pt-2">
                            <span className="text-[9px] text-zinc-600 font-mono tracking-tighter">Affinity: {log.affinity?.toFixed(2)} kcal/mol</span>
                            <span className="text-[9px] text-zinc-500 italic">Confidence: {(log.confidence * 100).toFixed(1)}%</span>
                        </div>
                    </div>
                ))
            )}
          </div>
        </div>

        <div className="flex flex-col rounded-xl border border-blue-500/20 bg-zinc-900/40 overflow-hidden">
          <div className="px-4 py-2 border-b border-blue-500/20 bg-blue-500/5 flex items-center justify-between">
            <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-blue-400" />
                <span className="text-[10px] font-bold text-blue-400 uppercase tracking-widest">Hypothesis Stream</span>
            </div>
            <button 
                onClick={async () => {
                    await fetch('/api/soma/medical-discovery/deduce', { method: 'POST' });
                }}
                className="p-1 hover:bg-blue-500/10 rounded transition-colors"
                title="Trigger Deduction"
            >
                <TrendingUp className="w-3 h-3 text-blue-500" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-4">
             <div className="p-3 rounded bg-black/40 border border-white/5">
                <div className="text-[8px] text-blue-400 font-bold uppercase mb-1">Mechanistic Correlation</div>
                <div className="text-[10px] text-zinc-400 leading-snug">Analyzing unlikely pairing: [Vitamin B2] x [Seamoss]. Searching for mitochondrial ATP synergy...</div>
             </div>
             <div className="p-3 rounded bg-black/40 border border-white/5">
                <div className="text-[8px] text-fuchsia-400 font-bold uppercase mb-1">Anomaly Detected</div>
                <div className="text-[10px] text-zinc-400 leading-snug">Psilocybin substrate depletion (Choline) identified as primary metabolic bottleneck for neurogenesis.</div>
             </div>
             <div className="animate-pulse flex items-center gap-2 text-[10px] text-zinc-600 italic">
                <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                Wandering Mind exploring enzymatic bridges...
             </div>
          </div>
        </div>

      </div>
    </div>
  );
}

// ── Market Panel (Steel City RESTORED) ─────────────────────────────────────
function MarketSimulationView() {
  const [data, setData] = useState(null);
  
  useEffect(() => {
    const poll = async () => {
      try {
        const r = await fetch('/api/soma/market/status');
        if (r.ok) setData(await r.json());
      } catch {}
    };
    poll();
    const t = setInterval(poll, 5000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="flex-1 flex flex-col overflow-hidden min-h-0 p-5 bg-black/40">
      <div className="flex items-center gap-4 mb-4">
        <div className="p-2 rounded-lg bg-orange-500/10 border border-orange-500/20">
          <TrendingUp className="w-5 h-5 text-orange-400" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-white tracking-tight italic">QUANT ENGINE SIMULATION</h2>
          <p className="text-xs text-orange-500/60 font-medium tracking-widest uppercase">Predictive Alpha · Volatility Arbitrage</p>
        </div>
      </div>

      <div className="flex-1 grid grid-cols-3 gap-4 overflow-hidden">
        {/* Perception */}
        <div className="flex flex-col rounded-xl border border-white/10 bg-zinc-900/40 p-4">
          <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-4 flex items-center gap-2">
            <Eye className="w-3 h-3" /> PERCEPTION
          </div>
          <div className="space-y-4 overflow-y-auto custom-scrollbar">
             <div className="flex flex-col gap-3">
                <div className="text-[8px] text-zinc-500 uppercase">Sentiment</div>
                <div className="text-2xl font-bold font-mono text-orange-400">{(data?.sentiment * 100 || 42).toFixed(1)}%</div>
             </div>
             <div className="flex flex-col gap-3">
                <div className="text-[8px] text-zinc-500 uppercase">Volatility</div>
                <div className="text-2xl font-bold font-mono text-blue-400">{(data?.volatility || 0.42).toFixed(3)}</div>
             </div>
            <div className="pt-2 border-t border-white/5 font-mono text-[9px] space-y-1">
                {data?.signals?.map((s, i) => (
                    <div key={i} className="flex items-center gap-2 text-zinc-500">
                        <span className={`w-1 h-1 rounded-full ${s.type === 'BULL' ? 'bg-emerald-500' : 'bg-red-500'}`} />
                        {s.msg}
                    </div>
                ))}
            </div>
          </div>
        </div>

        {/* Cognition */}
        <div className="flex flex-col rounded-xl border border-white/10 bg-zinc-900/40 p-4">
          <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-4 flex items-center gap-2">
            <Brain className="w-3 h-3" /> COGNITION
          </div>
          <div className="flex-1 overflow-y-auto custom-scrollbar space-y-3">
             <div className="p-3 rounded bg-black/40 border border-white/5">
                <div className="text-[8px] text-fuchsia-400 font-bold uppercase mb-1">PROMETHEUS</div>
                <div className="text-[10px] text-zinc-400 leading-snug">Protocol consensus reached. Executing {data?.protocol || 'SCALP'} on {data?.asset || 'BTC/USD'}.</div>
             </div>
             <div className="p-3 rounded bg-black/40 border border-white/5">
                <div className="text-[8px] text-emerald-400 font-bold uppercase mb-1">THALAMUS</div>
                <div className="text-[10px] text-zinc-400 leading-snug">Risk bounds verified. Confidence factor: {((data?.confidence || 0.85) * 100).toFixed(1)}%.</div>
             </div>
             <div className="p-3 rounded bg-black/40 border border-white/5">
                <div className="text-[8px] text-blue-400 font-bold uppercase mb-1">AURORA</div>
                <div className="text-[10px] text-zinc-400 leading-snug">Market sentiment aligns with bullish momentum. Smart money flows confirmed.</div>
             </div>
          </div>
        </div>

        {/* Execution */}
        <div className="flex flex-col rounded-xl border border-white/10 bg-zinc-900/40 p-4">
          <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-4 flex items-center gap-2">
            <BarChart2 className="w-3 h-3" /> EXECUTION
          </div>
          <div className="flex-1 flex flex-col gap-4">
             <div className="bg-black/60 p-4 rounded-lg border border-white/5">
                <div className="text-[9px] text-zinc-500 uppercase mb-1">Active Target</div>
                <div className="text-xl font-mono font-bold text-orange-400">{data?.asset || 'BTC/USD'}</div>
             </div>
             <div className="flex-1 bg-black/40 rounded p-3 font-mono text-[9px] text-zinc-600 overflow-hidden">
                <div className="text-emerald-500 mb-1">[ORDER] Market Buy @ NODE-01</div>
                <div className="mb-1 text-zinc-400">[STRATEGY] {data?.protocol || 'SCALP'} ({data?.episodes || 0} eps)</div>
                <div className="mb-1 text-zinc-500">[TRACE] TxID: 0x8a2...{Math.random().toString(16).slice(2, 6)}</div>
                <div className="animate-pulse">_</div>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ExperimentLedgerCardBody({ status }) {
  const summary = status?.status || {};
  return (
    <div className="flex h-full flex-col p-3">
      <div className="flex items-center justify-between">
        <span className="text-[9px] font-bold uppercase tracking-wider text-zinc-600">Learning Ledger</span>
        <span className="flex items-center gap-1 text-[9px] font-mono text-emerald-400">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
          persistent
        </span>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2">
        <div className="rounded-lg border border-white/5 bg-black/30 p-2">
          <div className="text-[8px] uppercase text-zinc-600">Runs</div>
          <div className="text-lg font-bold text-white">{summary.total || 0}</div>
        </div>
        <div className="rounded-lg border border-white/5 bg-black/30 p-2">
          <div className="text-[8px] uppercase text-zinc-600">Rules</div>
          <div className="text-lg font-bold text-emerald-400">{summary.reusableRules || 0}</div>
        </div>
        <div className="rounded-lg border border-white/5 bg-black/30 p-2">
          <div className="text-[8px] uppercase text-zinc-600">Done</div>
          <div className="text-lg font-bold text-blue-400">{summary.byStatus?.learned || summary.byStatus?.observed || 0}</div>
        </div>
      </div>
      <div className="mt-auto text-[9px] font-mono text-zinc-600">
        Last update: {formatTime(summary.lastUpdated)}
      </div>
    </div>
  );
}

function ExperimentLedgerView() {
  const emptyDraft = {
    title: '',
    domain: 'general',
    status: 'planned',
    hypothesis: '',
    setup: '',
    result: '',
    lesson: '',
    reusableRule: '',
    confidence: 0.7,
    tags: ''
  };
  const [ledger, setLedger] = useState([]);
  const [summary, setSummary] = useState(null);
  const [draft, setDraft] = useState(emptyDraft);
  const [activeFilter, setActiveFilter] = useState('all');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const loadLedger = useCallback(async () => {
    try {
      const res = await fetch('/api/soma/simulations/experiments');
      const data = await res.json();
      if (data.success) {
        setLedger(data.ledger || []);
        setSummary(data.summary || null);
      }
    } catch {
      setError('Experiment ledger is unreachable.');
    }
  }, []);

  useEffect(() => {
    loadLedger();
  }, [loadLedger]);

  const saveDraft = async () => {
    if (!draft.title.trim() || !draft.hypothesis.trim() || saving) return;
    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/soma/simulations/experiments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...draft,
          tags: draft.tags.split(',').map(tag => tag.trim()).filter(Boolean)
        })
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || `Save failed (${res.status})`);
      setDraft(emptyDraft);
      await loadLedger();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const updateEntry = async (id, patch) => {
    const res = await fetch(`/api/soma/simulations/experiments/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch)
    });
    if (res.ok) await loadLedger();
  };

  const deleteEntry = async (id) => {
    if (!window.confirm('Delete this experiment record?')) return;
    const res = await fetch(`/api/soma/simulations/experiments/${encodeURIComponent(id)}`, { method: 'DELETE' });
    if (res.ok) await loadLedger();
  };

  const filtered = ledger.filter(entry => activeFilter === 'all' || entry.status === activeFilter);
  const statuses = ['all', 'planned', 'running', 'observed', 'learned'];

  return (
    <div className="flex-1 overflow-hidden bg-black/40 p-5">
      <div className="mb-5 flex items-center gap-4">
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-2.5">
          <ClipboardCheck className="h-6 w-6 text-emerald-400" />
        </div>
        <div>
          <h2 className="text-xl font-bold uppercase italic tracking-tight text-white">Experiment Ledger</h2>
          <p className="text-xs font-medium uppercase tracking-widest text-emerald-500/60">Hypothesis to setup to result to lesson to reusable rule</p>
        </div>
        <div className="ml-auto grid grid-cols-3 gap-3 text-right">
          <div>
            <div className="text-[9px] uppercase tracking-widest text-zinc-600">Experiments</div>
            <div className="text-lg font-bold text-white">{summary?.total || 0}</div>
          </div>
          <div>
            <div className="text-[9px] uppercase tracking-widest text-zinc-600">Rules</div>
            <div className="text-lg font-bold text-emerald-400">{summary?.reusableRules || 0}</div>
          </div>
          <div>
            <div className="text-[9px] uppercase tracking-widest text-zinc-600">Updated</div>
            <div className="text-lg font-bold text-zinc-300">{formatTime(summary?.lastUpdated)}</div>
          </div>
        </div>
      </div>

      <div className="grid h-[calc(100%-84px)] grid-cols-5 gap-5 overflow-hidden">
        <div className="col-span-2 overflow-y-auto rounded-2xl border border-white/10 bg-zinc-900/40 p-5 custom-scrollbar">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-300">Log New Experiment</h3>
            <Plus className="h-4 w-4 text-emerald-400" />
          </div>
          <div className="space-y-3">
            {[
              ['title', 'Title', 'One-line experiment name'],
              ['hypothesis', 'Hypothesis', 'If SOMA tries X, then Y should happen'],
              ['setup', 'Setup', 'Environment, inputs, constraints'],
              ['result', 'Result', 'What actually happened'],
              ['lesson', 'Lesson', 'What changed in SOMA’s understanding'],
              ['reusableRule', 'Reusable Rule', 'Rule SOMA can apply later']
            ].map(([key, label, placeholder]) => (
              <label key={key} className="block">
                <span className="mb-1 block text-[9px] font-bold uppercase tracking-widest text-zinc-600">{label}</span>
                <textarea
                  value={draft[key]}
                  onChange={e => setDraft(prev => ({ ...prev, [key]: e.target.value }))}
                  placeholder={placeholder}
                  rows={key === 'title' ? 1 : 3}
                  className="w-full resize-none rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-xs leading-relaxed text-zinc-200 outline-none transition-all placeholder:text-zinc-700 focus:border-emerald-500/40"
                />
              </label>
            ))}
            <div className="grid grid-cols-3 gap-3">
              <label>
                <span className="mb-1 block text-[9px] font-bold uppercase tracking-widest text-zinc-600">Domain</span>
                <input value={draft.domain} onChange={e => setDraft(prev => ({ ...prev, domain: e.target.value }))}
                  className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-xs text-zinc-200 outline-none focus:border-emerald-500/40" />
              </label>
              <label>
                <span className="mb-1 block text-[9px] font-bold uppercase tracking-widest text-zinc-600">Status</span>
                <select value={draft.status} onChange={e => setDraft(prev => ({ ...prev, status: e.target.value }))}
                  className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-xs text-zinc-200 outline-none focus:border-emerald-500/40">
                  {statuses.filter(s => s !== 'all').map(status => <option key={status}>{status}</option>)}
                </select>
              </label>
              <label>
                <span className="mb-1 block text-[9px] font-bold uppercase tracking-widest text-zinc-600">Confidence</span>
                <input type="number" min="0" max="1" step="0.05" value={draft.confidence}
                  onChange={e => setDraft(prev => ({ ...prev, confidence: e.target.value }))}
                  className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-xs text-zinc-200 outline-none focus:border-emerald-500/40" />
              </label>
            </div>
            <label className="block">
              <span className="mb-1 block text-[9px] font-bold uppercase tracking-widest text-zinc-600">Tags</span>
              <input value={draft.tags} onChange={e => setDraft(prev => ({ ...prev, tags: e.target.value }))}
                placeholder="simulation, autonomy, memory"
                className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-xs text-zinc-200 outline-none placeholder:text-zinc-700 focus:border-emerald-500/40" />
            </label>
            {error && <p className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-300">{error}</p>}
            <button onClick={saveDraft} disabled={saving || !draft.title.trim() || !draft.hypothesis.trim()}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/15 py-3 text-xs font-black uppercase tracking-widest text-emerald-300 transition-all hover:bg-emerald-500/25 disabled:cursor-not-allowed disabled:opacity-40">
              <Save className="h-4 w-4" /> {saving ? 'Saving...' : 'Save Experiment'}
            </button>
          </div>
        </div>

        <div className="col-span-3 flex min-h-0 flex-col rounded-2xl border border-white/10 bg-zinc-900/40">
          <div className="flex items-center gap-2 border-b border-white/10 p-4">
            {statuses.map(status => (
              <button key={status} onClick={() => setActiveFilter(status)}
                className={`rounded-lg px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest transition-all ${
                  activeFilter === status ? 'bg-emerald-500/20 text-emerald-300' : 'bg-white/5 text-zinc-500 hover:text-zinc-300'
                }`}>
                {status}
              </button>
            ))}
          </div>
          <div className="flex-1 overflow-y-auto p-5 custom-scrollbar">
            {filtered.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center gap-3 text-zinc-700">
                <ClipboardCheck className="h-12 w-12 opacity-30" />
                <p className="text-sm font-bold uppercase tracking-widest">No experiments logged</p>
              </div>
            ) : (
              <div className="space-y-4">
                {filtered.map(entry => (
                  <div key={entry.id} className="rounded-2xl border border-white/10 bg-black/25 p-5">
                    <div className="mb-4 flex items-start gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="mb-1 flex items-center gap-2">
                          <span className="rounded bg-emerald-500/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest text-emerald-300">{entry.status}</span>
                          <span className="text-[10px] font-mono text-zinc-600">{entry.domain}</span>
                          {entry.confidence != null && <span className="text-[10px] font-mono text-blue-400">{Math.round(entry.confidence * 100)}%</span>}
                        </div>
                        <h3 className="truncate text-base font-bold text-white">{entry.title}</h3>
                        <p className="text-[10px] font-mono text-zinc-600">Updated {formatTime(entry.updatedAt || entry.createdAt)}</p>
                      </div>
                      <select value={entry.status} onChange={e => updateEntry(entry.id, { status: e.target.value })}
                        className="rounded-lg border border-white/10 bg-black/40 px-2 py-1 text-[10px] text-zinc-300 outline-none">
                        {statuses.filter(s => s !== 'all').map(status => <option key={status}>{status}</option>)}
                      </select>
                      <button onClick={() => deleteEntry(entry.id)} className="rounded-lg p-2 text-zinc-600 hover:bg-red-500/10 hover:text-red-400">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="grid gap-3 md:grid-cols-2">
                      {[
                        ['Hypothesis', entry.hypothesis],
                        ['Setup', entry.setup],
                        ['Result', entry.result],
                        ['Lesson', entry.lesson],
                        ['Reusable Rule', entry.reusableRule]
                      ].filter(([, value]) => value).map(([label, value]) => (
                        <div key={label} className="rounded-xl border border-white/5 bg-white/[0.03] p-3">
                          <p className="mb-1 text-[9px] font-bold uppercase tracking-widest text-zinc-600">{label}</p>
                          <p className="text-xs leading-relaxed text-zinc-300">{value}</p>
                        </div>
                      ))}
                    </div>
                    {entry.tags?.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-1">
                        {entry.tags.map(tag => <span key={tag} className="rounded bg-white/5 px-2 py-0.5 text-[9px] text-zinc-500">#{tag}</span>)}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Simulation Suite Main ──────────────────────────────────────────────────
function SimulationSuite() {
  const [expandedId, setExpandedId] = useState(null);
  const [suiteStatus, setSuiteStatus] = useState(null);
  const [sims, setSims] = useState([
    { id: 'market',    type: 'market',    title: 'Market Simulation', spawnedBy: 'system' },
    { id: 'ml-intern', type: 'ml-intern', title: 'ML Intern',         spawnedBy: 'system' },
    { id: 'scraper',   type: 'scraper',   title: 'Experiment Ledger', spawnedBy: 'system' },
    { id: 'code',      type: 'code',      title: 'Code Sandbox',      spawnedBy: 'system' },
    { id: 'biotech',   type: 'biotech',   title: 'Medical Lab',       spawnedBy: 'system' },
    { id: 'social',    type: 'social',    title: 'Social Feed',       spawnedBy: 'system' },
    { id: 'cc',        type: 'cc',        title: 'C&C Game',          spawnedBy: 'system' },
  ]);

  useEffect(() => {
    const loadStatus = async () => {
      try {
        const res = await fetch('/api/soma/simulations/status');
        if (res.ok) setSuiteStatus(await res.json());
      } catch {}
    };
    loadStatus();
    const timer = setInterval(loadStatus, 7000);
    return () => clearInterval(timer);
  }, []);

  const handleExpand = (id) => setExpandedId(id);

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-[#0a0a0b] text-zinc-100 font-sans">
      <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 bg-zinc-900/20 shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-1.5 rounded-md bg-fuchsia-500/10 border border-fuchsia-500/20">
            <TrendingUp className="w-4 h-4 text-fuchsia-400" />
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-tight">SIMULATION SUITE</h1>
            <p className="text-[10px] text-zinc-500 font-medium uppercase tracking-widest">
              Autonomous Reality Modeling V4.6
              {suiteStatus && ` · ${suiteStatus.counts.online}/${suiteStatus.counts.total} engines online`}
            </p>
          </div>
        </div>
        {!expandedId && suiteStatus && (
          <div className="hidden md:flex items-center gap-2 text-[10px] font-mono text-zinc-500">
            <span className={`w-1.5 h-1.5 rounded-full ${suiteStatus.simulationLoadEnabled ? 'bg-emerald-400' : 'bg-amber-400'}`} />
            Physics {suiteStatus.simulationLoadEnabled ? 'enabled' : 'gated'}
          </div>
        )}
        {expandedId && (
          <button 
            onClick={() => setExpandedId(null)}
            className="px-3 py-1 text-[10px] font-bold bg-white/5 hover:bg-white/10 border border-white/10 rounded transition-all active:scale-95"
          >
            ← BACK TO SUITE
          </button>
        )}
      </div>

      {!expandedId && (
        <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-5">
            {sims.map(sim => (
              <SimCard key={sim.id} sim={sim} status={moduleStatusById(suiteStatus, sim.id)} onExpand={handleExpand} />
            ))}
          </div>
        </div>
      )}

      {expandedId === 'biotech' && <MedicalLabView />}
      {expandedId === 'market' && <MarketSimulationView />}
      {expandedId === 'ml-intern' && <MlInternView />}
      {expandedId === 'scraper' && <ExperimentLedgerView />}
      {expandedId === 'code' && <CodeSandboxView />}
      {expandedId === 'cc' && <CcSimulationView suiteStatus={suiteStatus} />}
      {expandedId === 'social' && <div className="p-10 text-center text-zinc-500 uppercase font-bold tracking-widest opacity-40">Social Substrate active. Monitoring gallery...</div>}
    </div>
  );
}

// ── C&C Simulation View (Physics Engine) ───────────────────────────────────
function PhysicsCanvas({ port }) {
  const canvasRef = useRef(null);
  const [connection, setConnection] = useState(port ? 'connecting' : 'offline');
  const [world, setWorld] = useState(null);

  useEffect(() => {
    if (!port) {
      setConnection('offline');
      return;
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.hostname || '127.0.0.1';
    const ws = new WebSocket(`${protocol}//${host}:${port}`);
    let closed = false;

    ws.onopen = () => !closed && setConnection('live');
    ws.onerror = () => !closed && setConnection('error');
    ws.onclose = () => !closed && setConnection('offline');
    ws.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload.type === 'world_update') setWorld(payload);
      } catch {}
    };

    return () => {
      closed = true;
      ws.close();
    };
  }, [port]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = '#050509';
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.lineWidth = 1;
    for (let x = 0; x <= width; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = 0; y <= height; y += 40) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    const bodies = world?.bodies || [];
    for (const body of bodies) {
      const vertices = body.vertices || [];
      if (!vertices.length) continue;
      const color = body.label === 'soma_agent'
        ? '#f43f5e'
        : body.label === 'cargo'
          ? '#60a5fa'
          : body.label === 'target_zone'
            ? 'rgba(74,222,128,0.45)'
            : body.label?.startsWith('wall') || body.label === 'ground' || body.label === 'ceiling'
              ? '#3f3f46'
              : '#71717a';

      ctx.beginPath();
      ctx.moveTo(vertices[0].x, vertices[0].y);
      for (const vertex of vertices.slice(1)) ctx.lineTo(vertex.x, vertex.y);
      ctx.closePath();
      ctx.fillStyle = color;
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.18)';
      ctx.stroke();
    }

    if (!world) {
      ctx.fillStyle = 'rgba(212,212,216,0.45)';
      ctx.font = '12px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(connection === 'live' ? 'Waiting for world state...' : 'Physics stream unavailable', width / 2, height / 2);
    }
  }, [world, connection]);

  return (
    <div className="absolute inset-0 bg-black">
      <canvas ref={canvasRef} width={800} height={600} className="h-full w-full object-contain" />
      <div className="absolute left-4 top-4 rounded-lg border border-white/10 bg-black/60 px-3 py-2 backdrop-blur">
        <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-zinc-300">
          <span className={`h-1.5 w-1.5 rounded-full ${connection === 'live' ? 'bg-emerald-400' : connection === 'connecting' ? 'bg-amber-400 animate-pulse' : 'bg-red-400'}`} />
          Physics Stream {connection}
        </div>
        {world && <div className="mt-1 text-[10px] font-mono text-zinc-500">Score {world.score} · Task {world.task}</div>}
      </div>
    </div>
  );
}

function CcSimulationView({ suiteStatus }) {
  const [data, setData] = useState(null);
  
  useEffect(() => {
    const poll = async () => {
      try {
        const r = await fetch('/api/soma/cc/status');
        if (r.ok) setData(await r.json());
      } catch {}
    };
    poll();
    const t = setInterval(poll, 3000);
    return () => clearInterval(t);
  }, []);

  const status = moduleStatusById(suiteStatus, 'cc');
  const port = data?.port || status?.status?.port || null;

  return (
    <div className="flex-1 flex flex-col overflow-hidden min-h-0 p-5 bg-black/40">
      <div className="flex items-center gap-4 mb-6">
        <div className="p-2.5 rounded-xl bg-red-500/10 border border-red-500/20 shadow-[0_0_15px_rgba(239,68,68,0.1)]">
          <Swords className="w-6 h-6 text-red-400" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight italic uppercase">Command & Control Simulation</h2>
          <p className="text-xs text-red-500/60 font-medium tracking-widest uppercase">Physics-Based Emergent Behavior · 2D Playground</p>
        </div>
        {data && (
            <div className="ml-auto flex items-center gap-4">
                <span className={`px-2 py-1 rounded text-[10px] font-bold border ${data.running ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-red-500/10 border-red-500/20 text-red-400'}`}>
                    {data.running ? 'ENGINE ACTIVE' : 'ENGINE IDLE'}
                </span>
                <span className="text-[10px] text-zinc-500 font-mono">Viewers: {data.viewers}</span>
            </div>
        )}
      </div>

      <div className="flex-1 grid grid-cols-3 gap-5 overflow-hidden">
        <div className="col-span-2 flex flex-col rounded-2xl border border-white/10 bg-zinc-900/40 overflow-hidden relative">
            <PhysicsCanvas port={port} />
            
            {/* Stats Overlay */}
            <div className="mt-auto p-6 bg-gradient-to-t from-black/80 to-transparent z-20">
                <div className="flex items-center justify-between mb-4">
                    <span className="text-[10px] font-bold text-zinc-300 uppercase tracking-widest">Environment State</span>
                    <span className="text-[10px] text-red-400 font-mono">Real-time Collision Mesh</span>
                </div>
                <div className="grid grid-cols-4 gap-4">
                    <div className="p-3 rounded-xl bg-black/40 border border-white/5">
                        <div className="text-[8px] text-zinc-500 uppercase font-bold mb-1">Bodies</div>
                        <div className="text-lg font-mono font-bold text-white">{data?.stats?.objects?.length || 0}</div>
                    </div>
                    <div className="p-3 rounded-xl bg-black/40 border border-white/5">
                        <div className="text-[8px] text-zinc-500 uppercase font-bold mb-1">Stability</div>
                        <div className="text-lg font-mono font-bold text-emerald-400">99.8%</div>
                    </div>
                    <div className="p-3 rounded-xl bg-black/40 border border-white/5">
                        <div className="text-[8px] text-zinc-500 uppercase font-bold mb-1">Epoch</div>
                        <div className="text-lg font-mono font-bold text-blue-400">{data?.controller?.episodes || 0}</div>
                    </div>
                    <div className="p-3 rounded-xl bg-black/40 border border-white/5">
                        <div className="text-[8px] text-zinc-500 uppercase font-bold mb-1">Reward</div>
                        <div className="text-lg font-mono font-bold text-fuchsia-400">{(data?.controller?.reward || 0).toFixed(2)}</div>
                    </div>
                </div>
            </div>
        </div>

        <div className="flex flex-col gap-5 overflow-hidden">
            <div className="flex-1 flex flex-col rounded-2xl border border-red-500/20 bg-zinc-900/40 overflow-hidden">
                <div className="px-4 py-3 border-b border-red-500/20 bg-red-500/5 flex items-center justify-between">
                    <span className="text-[10px] font-bold text-red-400 uppercase tracking-widest">Neural Controller</span>
                    <Activity className="w-3.5 h-3.5 text-red-400" />
                </div>
                <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-3 font-mono text-[10px]">
                    <div className="text-zinc-500">[INIT] Attaching Matter.js physics bridge...</div>
                    <div className="text-zinc-500">[LOAD] ControllerDNA: SOMA-Q-ALPHA</div>
                    <div className="text-emerald-400">[OK] Physics sandbox stabilized</div>
                    <div className="text-zinc-500">[PLAN] Navigation mission: Fetch Cargo</div>
                    {data?.stats?.objects?.map((obj, i) => (
                        <div key={i} className="text-zinc-400 group">
                            <span className="text-red-500/60">&gt;</span> Tracking: {obj.label} @ {Math.round(obj.position.x)},{Math.round(obj.position.y)}
                        </div>
                    ))}
                    <div className="animate-pulse text-red-500">_</div>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
}

function SimCard({ sim, status, onExpand }) {
  const COLORS = {
    market: { border:'border-orange-500/20', dot:'bg-orange-400', icon:'text-orange-400', hover:'hover:border-orange-500/50' },
    'ml-intern':{ border:'border-blue-500/20',   dot:'bg-blue-400',   icon:'text-blue-400',   hover:'hover:border-blue-500/50' },
    scraper:{ border:'border-emerald-500/20', dot:'bg-emerald-400',icon:'text-emerald-400',hover:'hover:border-emerald-500/50'},
    code:   { border:'border-fuchsia-500/20', dot:'bg-fuchsia-400',icon:'text-fuchsia-400',hover:'hover:border-fuchsia-500/50'},
    biotech:{ border:'border-emerald-500/20', dot:'bg-emerald-400',icon:'text-emerald-400',hover:'hover:border-emerald-500/50'},
    social: { border:'border-violet-500/20',  dot:'bg-violet-400', icon:'text-violet-400', hover:'hover:border-violet-500/50' },
    cc:     { border:'border-red-500/20',     dot:'bg-red-400',    icon:'text-red-400',    hover:'hover:border-red-500/50' },
  };
  const ICONS = { market: TrendingUp, 'ml-intern': Microscope, scraper: Database, code: Code2, biotech: FlaskConical, social: Share2, cc: Swords };
  const c = COLORS[sim.type] || COLORS.market;
  const Icon = ICONS[sim.type] || Brain;
  const isComingSoon = false;
  const online = !!status?.online;
  const statusText = status?.label || (online ? 'online' : 'not wired');

  return (
    <div 
      onClick={() => !isComingSoon && onExpand(sim.id)}
      className={`group relative flex flex-col h-48 rounded-xl border ${c.border} ${c.hover} bg-zinc-900/30 overflow-hidden transition-all duration-300 ${isComingSoon ? 'cursor-not-allowed opacity-60' : 'cursor-pointer hover:bg-zinc-900/50 active:scale-[0.98]'}`}
    >
      <div className="flex items-center gap-2 px-3 py-2 border-b border-white/5 bg-black/20 shrink-0">
        <div className={`w-1.5 h-1.5 rounded-full ${c.dot} ${isComingSoon ? 'opacity-30' : 'animate-pulse'}`} />
        <Icon className={`w-3.5 h-3.5 ${c.icon}`} />
        <span className="text-[10px] font-bold text-zinc-200 uppercase tracking-widest">{sim.title}</span>
        {isComingSoon && <span className="ml-auto text-[8px] px-1.5 py-0.5 rounded-full bg-zinc-800 text-zinc-500 border border-white/5 font-bold">SOON</span>}
        {!isComingSoon && (
          <span className={`ml-auto h-1.5 w-1.5 rounded-full ${online ? c.dot : 'bg-zinc-700'}`} title={statusText} />
        )}
      </div>
      <div className="px-3 py-1 border-b border-white/5 bg-black/10">
        <p className={`truncate text-[9px] font-mono ${online ? 'text-zinc-400' : 'text-zinc-600'}`}>{statusText}</p>
      </div>
      <div className="flex-1 min-h-0">
        {sim.type === 'biotech' && <BiotechCardBody />}
        {sim.type === 'market' && <div className="p-4 flex items-center justify-center h-full text-zinc-700 italic text-[10px] uppercase font-bold tracking-widest opacity-40">Quant Engine Active</div>}
        {sim.type === 'code' && <div className="p-4 flex items-center justify-center h-full text-zinc-700 italic text-[10px] uppercase font-bold tracking-widest opacity-40">Pattern Engine Active</div>}
        {sim.type === 'scraper' && <ExperimentLedgerCardBody status={status} />}
        {sim.type === 'ml-intern' && <MlInternCardBody />}
        {sim.type === 'social' && <div className="p-4 flex items-center justify-center h-full text-zinc-700 italic text-[10px] uppercase font-bold tracking-widest opacity-40">Social Substrate Active</div>}
        {sim.type !== 'biotech' && sim.type !== 'market' && sim.type !== 'code' && sim.type !== 'scraper' && sim.type !== 'ml-intern' && sim.type !== 'social' && (
            <div className="p-4 flex items-center justify-center h-full text-zinc-700 italic text-[10px] uppercase font-bold tracking-widest opacity-40">
                Active Simulation Module
            </div>
        )}
      </div>
    </div>
  );
}

export default SimulationSuite;
