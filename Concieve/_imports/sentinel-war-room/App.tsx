
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Icons, INITIAL_AUDIT, MOCK_MESSAGES, PARTICIPANTS, MOCK_DECISIONS, MOCK_FILES } from './constants';
import { Message, Participant, DecisionNode, ActorType, UUID, IntelligenceBrief, ProjectSnapshot, ProjectFile } from './types';
import { collaborateInWarRoom } from './services/gemini';

// Declaration for the AI Studio key selection utility
declare global {
  interface AIStudio {
    hasSelectedApiKey: () => Promise<boolean>;
    openSelectKey: () => Promise<void>;
  }

  interface Window {
    // Removed readonly modifier to fix 'All declarations of aistudio must have identical modifiers' error.
    aistudio: AIStudio;
  }
}

// --- Tactical Spectrum Utility ---
function getSpectrumClass(percent: number) {
  if (percent >= 90) return 'text-emerald-500'; 
  if (percent >= 75) return 'text-lime-400';    
  if (percent >= 50) return 'text-yellow-400';  
  if (percent >= 25) return 'text-orange-500';  
  return 'text-rose-600';                       
}

function getSpectrumBgClass(percent: number) {
  if (percent >= 90) return 'bg-emerald-500';
  if (percent >= 75) return 'bg-lime-400';
  if (percent >= 50) return 'bg-yellow-400';
  if (percent >= 25) return 'bg-orange-500';
  return 'bg-rose-600';
}

// --- Tactical Calculations ---
interface ProjectBaseline {
  avgDecisionCount: number;
  avgOverrides: number;
  avgConfidence: number;
  avgAuditVisibility: number;
  avgGravity: number;
}

const BASELINE: ProjectBaseline = {
  avgDecisionCount: 15,
  avgOverrides: 2,
  avgConfidence: 0.88,
  avgAuditVisibility: 0.35,
  avgGravity: 18,
};

function computeSignalScore(current: ProjectSnapshot) {
  let score = 0;
  score += Math.abs(current.decisionCount - BASELINE.avgDecisionCount) / Math.max(1, BASELINE.avgDecisionCount);
  score += current.overrides - BASELINE.avgOverrides > 0 ? 0.2 : 0;
  if (current.confidenceTrend === "DECAYING") score += 0.3;
  if (current.auditVisibility - BASELINE.avgAuditVisibility > 0.1) score += 0.25;
  if (current.assumptionWeakness > 0.4) score += 0.25;
  return Math.min(1, score);
}

export default function App() {
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [focusApp, setFocusApp] = useState<string | null>(null);
  const [focusDecision, setFocusDecision] = useState<DecisionNode | null>(null);
  const [focusFile, setFocusFile] = useState<ProjectFile | null>(null);
  const [showExplorer, setShowExplorer] = useState(false);
  const [messages, setMessages] = useState<Message[]>(MOCK_MESSAGES);
  const [inputText, setInputText] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [decisions, setDecisions] = useState<DecisionNode[]>(MOCK_DECISIONS);
  const [vaultFiles, setVaultFiles] = useState<ProjectFile[]>(MOCK_FILES);
  
  const [hasApiKey, setHasApiKey] = useState<boolean | null>(null);
  const [ingestionStage, setIngestionStage] = useState<'idle' | 'ingesting' | 'hashing' | 'classifying'>('idle');
  const [isStabilizing, setIsStabilizing] = useState(false);
  const [stabilizeStep, setStabilizeStep] = useState<'idle' | 'simulation' | 'confirm'>('idle');

  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const checkKey = async () => {
      try {
        const hasKey = await window.aistudio.hasSelectedApiKey();
        setHasApiKey(hasKey);
      } catch (e) {
        setHasApiKey(false);
      }
    };
    checkKey();
  }, []);

  useEffect(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), [messages]);

  const handleOpenKey = async () => {
    await window.aistudio.openSelectKey();
    setHasApiKey(true);
  };

  const currentSnapshot: ProjectSnapshot = useMemo(() => {
    const totalConfidence = decisions.reduce((acc, d) => acc + d.confidence, 0) / Math.max(1, decisions.length);
    return {
      projectId: 'curr' as UUID,
      companyId: 'c1' as UUID,
      startedAt: Date.now(),
      decisionCount: decisions.length,
      overrides: decisions.filter(d => d.userNote).length,
      avgConfidence: totalConfidence,
      confidenceTrend: totalConfidence < 0.8 ? 'DECAYING' : 'STABLE',
      auditVisibility: 0.65,
      assumptionWeakness: 0.45,
      gravityScore: decisions.reduce((acc, d) => acc + (d.gravity?.riskAmplification || 0), 0) / Math.max(1, decisions.length) + 20
    };
  }, [decisions]);

  const intelData = useMemo(() => {
    const score = computeSignalScore(currentSnapshot);
    const integrity = Math.max(0, Math.round((1 - score) * 100));
    return {
      score,
      integrity,
      situationSummary: `Project reflects standard EMEA patterns, however decision frequency is ${currentSnapshot.decisionCount > BASELINE.avgDecisionCount ? "elevated" : "sub-nominal"}.`,
      patternComparison: `Signal Integrity at ${integrity}% — ${integrity < 70 ? 'Recalibration Advised' : 'Within Operating Bounds'}.`,
      whatsDifferent: [
        { label: "Manual Override Spike", detail: `${currentSnapshot.overrides} total overrides vs ${BASELINE.avgOverrides} baseline. Elevated risk of single-point logic failure.`, intensity: 'high' },
        { label: "Visibility Drift", detail: `Audit transparency is 30% above projected norm. High visibility increases external audit friction risk.`, intensity: 'med' },
      ],
      quietRisks: [
        { label: "Assumption Decay", detail: `Logic nodes (A1, A2) have not been verified for 48h+. Reliability of downstream forecasts is degrading.`, severity: 'high' },
        { label: "Context Friction", detail: `High gravity (${currentSnapshot.gravityScore.toFixed(1)}) with decaying confidence. Pivot recommended to stabilize output.`, severity: 'med' }
      ],
      recommendation: "Stabilize current classifications. Reduce audit visibility drift to align with historical baselines."
    };
  }, [currentSnapshot]);

  const handleSendMessage = async () => {
    if (!inputText.trim()) return;
    const userMsg: Message = { id: Date.now(), senderId: 'p5', message: inputText, timestamp: "12:00", type: 'message' };
    setMessages(prev => [...prev, userMsg]);
    setInputText('');
    setIsAnalyzing(true);
    try {
      const soma = await collaborateInWarRoom(INITIAL_AUDIT.objective, [...messages, userMsg], decisions);
      if (soma.interventionRequired) {
        setMessages(prev => [...prev, { id: Date.now()+1, senderId: 'soma', message: soma.analysis, timestamp: "12:01", type: 'soma' }]);
      }
    } catch (e: any) {
      if (e.message && e.message.includes("Requested entity was not found.")) {
        setHasApiKey(false);
      }
    } finally { setIsAnalyzing(false); }
  };

  const handleIngestFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIngestionStage('ingesting');
    setTimeout(() => {
      setIngestionStage('hashing');
      setTimeout(() => {
        setIngestionStage('classifying');
        setTimeout(() => {
          const newFile: ProjectFile = {
            id: `f-${Date.now()}`,
            name: file.name,
            type: file.type || 'Document',
            size: `${(file.size / (1024 * 1024)).toFixed(1)}MB`,
            ownerId: 'p5',
            updatedAt: 'Just now',
            isVerified: true,
            version: '1.0',
            hash: `0x${Math.random().toString(16).substring(2, 12)}...`,
            source: 'MANUAL',
            ingestionStatus: 'READY',
            somaIntel: {
              summary: `Manually ingested artifact: ${file.name}. Initial SOMA scan indicates valid content stream. Content type: ${file.type}`,
              extractedFigures: [{ label: "Detected Figures", value: "Scanning..." }],
              riskSignals: [],
              relevanceScore: 0.75,
              linkedNodes: []
            }
          };
          setVaultFiles([newFile, ...vaultFiles]);
          setIngestionStage('idle');
        }, 1500);
      }, 1000);
    }, 800);
  };

  const handleUpdateNodeNote = (nodeId: string, note: string) => {
    setDecisions(prev => prev.map(d => d.id === nodeId ? { ...d, userNote: note } : d));
    if (focusDecision?.id === nodeId) {
      setFocusDecision(prev => prev ? { ...prev, userNote: note } : null);
    }
  };

  const handleCommitStabilization = () => {
    const newNode: DecisionNode = {
      id: `d-stab-${Date.now()}` as UUID,
      title: 'Tactical Stabilization',
      rationale: 'System-wide recalibration executed. Resolved EMEA Tax Recognition conflicts and locked regional baseline.',
      confidence: 0.99,
      actor: 'SYSTEM',
      changeType: 'REVISION',
      timestamp: Date.now(),
      previousHash: decisions[0]?.hash || null,
      hash: Math.random().toString(36).substring(2, 15),
      contextSnapshot: currentSnapshot,
      optionsConsidered: [],
      decisionTaken: 'Recalibrate',
      riskAcknowledged: true,
      assumptionsUsed: [],
      evidence: [],
      userNote: `Sentinel pivot successful. Logic reconciled across all nodes.`
    };
    const reconciledDecisions = decisions.map(d => ({ ...d, isConflict: false }));
    setDecisions([newNode, ...reconciledDecisions]);
    setStabilizeStep('idle');
    setIsStabilizing(false);
  };

  const themeClasses = {
    bg: theme === 'dark' ? 'bg-[#0a0c10] text-slate-200' : 'bg-[#f8fafc] text-slate-900',
    panel: theme === 'dark' ? 'bg-white/5 border-white/10 shadow-2xl' : 'bg-white border-slate-200 shadow-xl shadow-slate-200/50',
    input: theme === 'dark' ? 'bg-white/5 border-white/10 text-white' : 'bg-slate-100 border-slate-200 text-slate-900',
    textMain: theme === 'dark' ? 'text-slate-100' : 'text-slate-900',
    textSub: theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
  };

  if (hasApiKey === false) {
    return (
      <div className={`h-screen w-full flex flex-col items-center justify-center p-6 transition-colors duration-500 ${themeClasses.bg}`}>
        <div className={`max-w-md w-full p-10 rounded-[3rem] border text-center space-y-8 ${themeClasses.panel}`}>
          <div className="w-20 h-20 bg-[#FF6B35] rounded-3xl flex items-center justify-center text-4xl font-black italic mx-auto shadow-2xl shadow-orange-500/20">S</div>
          <div className="space-y-2">
            <h1 className={`text-3xl font-black uppercase tracking-tighter ${themeClasses.textMain}`}>Sentinel Access</h1>
            <p className={`text-sm leading-relaxed ${themeClasses.textSub}`}>To utilize Gemini 3 Pro intelligence, a paid project API key is required.</p>
          </div>
          <button onClick={handleOpenKey} className="w-full py-5 bg-[#FF6B35] text-white font-black uppercase tracking-[0.2em] rounded-2xl shadow-xl shadow-orange-500/20 hover:scale-[1.02] active:scale-95 transition-all">
            Authenticate Mission
          </button>
        </div>
      </div>
    );
  }

  if (hasApiKey === null) return null;

  return (
    <div className={`h-screen w-full flex flex-col p-6 overflow-hidden transition-colors duration-500 selection:bg-[#FF6B35]/30 ${themeClasses.bg}`}>
      
      {/* HUD HEADER */}
      <div className={`flex items-center justify-between px-8 py-5 rounded-[2.5rem] border backdrop-blur-2xl mb-6 shrink-0 ${themeClasses.panel}`}>
        <div className="flex items-center gap-5">
          <div className="w-12 h-12 bg-[#FF6B35] rounded-2xl flex items-center justify-center text-white font-black italic shadow-lg shadow-orange-500/20">S</div>
          <div>
            <h1 className={`text-xl font-black uppercase tracking-tighter ${themeClasses.textMain}`}>Sentinel</h1>
            <span className="text-[9px] font-black text-[#FF6B35] uppercase tracking-[0.3em]">Operational Surface</span>
          </div>
        </div>
        <div className="hidden xl:flex items-center gap-10">
          <HudMetric label="Mission" value="EMEA Nexus" color="orange" theme={theme} />
          <HudMetric label="Progress" value="68.4%" color="azure" theme={theme} />
          <HudMetric label="Security" value="Defensive" color="emerald" theme={theme} />
        </div>
        <div className="flex items-center gap-4">
           <div className="flex -space-x-3">
             {PARTICIPANTS.slice(0, 4).map(p => (
               <div key={p.id} className="w-10 h-10 rounded-full border-2 border-slate-900 overflow-hidden">
                 <img src={p.avatar} alt={p.name} className="w-full h-full object-cover" />
               </div>
             ))}
           </div>
           <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} className={`w-10 h-10 rounded-full border flex items-center justify-center transition-colors ${theme === 'dark' ? 'bg-white/5 border-white/5 text-slate-400 hover:text-white' : 'bg-slate-100 border-slate-200 text-slate-600 hover:text-slate-900'}`}>
              <Icons.Zap size={18} />
           </button>
        </div>
      </div>

      {/* CORE GRID */}
      <div className="flex-1 grid grid-cols-12 gap-6 min-h-0">
        <div className="col-span-12 lg:col-span-8 grid grid-cols-2 grid-rows-2 gap-6 min-h-0 relative">
          
          <ConsoleTile id="ledger" focusId={focusApp} onFocus={setFocusApp} title="Forensic Ledger" tag="Chain Sequence" icon={<Icons.Ledger size={24} />} color="orange" theme={theme}>
            {showExplorer ? <TemporalExplorer onBack={() => setShowExplorer(false)} theme={theme} decisions={decisions} /> 
            : focusDecision ? <DecisionForensicView node={focusDecision} onBack={() => setFocusDecision(null)} onAddNote={handleUpdateNodeNote} theme={theme} />
            : focusApp === 'ledger' ? (
              <div className="w-full h-full flex flex-col items-center">
                 <div onClick={() => setShowExplorer(true)} className="w-full max-w-2xl p-6 bg-orange-500/5 border border-orange-500/20 rounded-2xl mb-6 cursor-pointer hover:bg-orange-500/10 transition-all flex justify-between items-center shrink-0">
                    <div>
                      <p className="text-[10px] font-black text-orange-500 uppercase mb-1">Audit Sequence</p>
                      <p className={`text-xs font-bold ${themeClasses.textSub}`}>Status: <span className="text-emerald-500 font-black tracking-widest uppercase">Chain Log</span></p>
                    </div>
                    <div className="flex items-center gap-3">
                       <span className="text-[10px] font-mono text-slate-500">HEAD: {decisions[0]?.hash.substring(0, 8)}</span>
                       <Icons.Shield size={20} className="text-orange-500" />
                    </div>
                 </div>
                 
                 <div className="relative w-full max-w-2xl space-y-4 overflow-y-auto custom-scrollbar pl-10 pr-4 pb-12">
                   <div className="absolute left-4 top-0 bottom-0 w-[2px] bg-gradient-to-b from-orange-500 via-slate-800 to-transparent opacity-30" />
                   {decisions.map((d, i) => (
                      <div key={d.id} onClick={() => setFocusDecision(d)} className={`group p-6 border rounded-3xl cursor-pointer transition-all relative ${
                        d.isConflict ? 'border-rose-500/50 bg-rose-500/5 ring-2 ring-rose-500/20' 
                          : theme === 'dark' ? 'bg-white/5 border-white/5 hover:border-orange-500/30' : 'bg-white border-slate-200 hover:border-orange-500/30 shadow-sm'
                      }`}>
                         <div className={`absolute -left-[2.1rem] top-8 w-7 h-7 rounded-full border-2 flex items-center justify-center text-[8px] font-black ${
                           d.isConflict ? 'bg-rose-500 border-rose-900 text-white animate-pulse' : `${getSpectrumBgClass(d.confidence * 100)} border-slate-900 text-slate-950`
                         } z-10 shadow-lg`}>
                            {Math.round(d.confidence * 100)}
                         </div>
                         <div className="flex justify-between items-start mb-3">
                            <h4 className={`text-sm font-black uppercase tracking-tight truncate mr-4 ${themeClasses.textMain}`}>{d.title}</h4>
                            <span className="text-[9px] font-mono text-slate-500 shrink-0">{new Date(d.timestamp).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>
                         </div>
                         <p className={`text-[11px] leading-relaxed line-clamp-2 ${themeClasses.textSub}`}>{d.rationale}</p>
                      </div>
                   ))}
                 </div>
              </div>
            ) : <LedgerHUD decisions={decisions} theme={theme} />}
          </ConsoleTile>

          <ConsoleTile id="intel" focusId={focusApp} onFocus={setFocusApp} title="Awareness" tag="Intelligence" icon={<Icons.Zap size={24} />} color="azure" theme={theme}>
            {focusApp === 'intel' ? (
              <AwarenessBrief brief={intelData} isStabilizing={isStabilizing} step={stabilizeStep} onStartStabilize={() => { setIsStabilizing(true); setStabilizeStep('simulation'); }} onCommit={handleCommitStabilization} onCancel={() => { setIsStabilizing(false); setStabilizeStep('idle'); }} theme={theme} />
            ) : <AwarenessHUD brief={intelData} theme={theme} />}
          </ConsoleTile>

          <ConsoleTile id="vault" focusId={focusApp} onFocus={setFocusApp} title="Evidence Vault" tag="Forensic Extraction" icon={<Icons.Folder size={24} />} color="emerald" theme={theme}>
            {focusApp === 'vault' ? (
              <EvidenceVaultView files={vaultFiles} onFocusFile={setFocusFile} theme={theme} onIngest={handleIngestFile} ingestionStage={ingestionStage} />
            ) : <VaultHUD files={vaultFiles} theme={theme} />}
          </ConsoleTile>

          <ConsoleTile id="timeline" focusId={focusApp} onFocus={setFocusApp} title="Timeline" tag="Gate" icon={<Icons.Calendar size={24} />} color="purple" theme={theme}>
             <div className="space-y-4 w-full max-w-sm">
                {['Dublin Ledger Sync', 'EMEA Review', 'Regulatory Filing'].map((step, i) => (
                  <div key={step} className={`flex items-center gap-6 p-4 border rounded-2xl ${theme === 'dark' ? 'bg-white/5 border-white/5' : 'bg-slate-50 border-slate-100'}`}>
                     <div className={`w-3 h-3 rounded-full shrink-0 ${i === 0 ? 'bg-[#FF6B35]' : 'bg-slate-700'}`} />
                     <div className="flex-1 min-w-0">
                        <h5 className={`text-[11px] font-black uppercase truncate ${themeClasses.textMain}`}>{step}</h5>
                        <p className={`text-[9px] font-bold uppercase tracking-widest ${themeClasses.textSub}`}>{14 + i * 4} JAN</p>
                     </div>
                  </div>
                ))}
             </div>
          </ConsoleTile>
        </div>

        {/* CHAT STREAM */}
        <div className="col-span-12 lg:col-span-4 flex flex-col gap-6 min-h-0">
          <div className={`flex-1 rounded-[2.5rem] border flex flex-col overflow-hidden ${themeClasses.panel}`}>
            <div className="p-8 border-b border-white/5 flex items-center justify-between">
               <span className={`text-[10px] font-black uppercase tracking-widest ${themeClasses.textSub}`}>Command Channel</span>
               <Icons.Messages size={18} className="text-slate-500" />
            </div>
            <div className="flex-1 overflow-y-auto p-8 space-y-8 custom-scrollbar">
              {messages.map(m => (
                <div key={m.id} className={`flex gap-4 ${m.senderId === 'p5' ? 'flex-row-reverse' : ''}`}>
                   <div className={`w-10 h-10 rounded-2xl flex items-center justify-center font-black italic shrink-0 ${m.senderId === 'soma' ? 'bg-white text-black shadow-lg shadow-white/10' : 'bg-slate-800 text-white'}`}>
                     {m.senderId === 'soma' ? 'S' : m.senderId[1]}
                   </div>
                   <div className={`p-5 rounded-[2rem] text-[13px] leading-relaxed max-w-[85%] ${
                     m.senderId === 'soma' ? 'bg-white text-black rounded-tl-none shadow-xl border border-slate-100' : m.senderId === 'p5' ? 'bg-[#FF6B35] text-white rounded-tr-none' : theme === 'dark' ? 'bg-white/5 border border-white/5 text-slate-300 rounded-tl-none' : 'bg-slate-100 border-slate-200 text-slate-800 rounded-tl-none'}`}>
                      {m.message}
                   </div>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>
            <div className={`p-8 border-t border-white/5 ${theme === 'dark' ? 'bg-[#0a0c10]/40' : 'bg-slate-50'}`}>
               <div className="relative">
                 <input type="text" value={inputText} onChange={e => setInputText(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSendMessage()} placeholder="INITIATE COMMAND..." className={`w-full pl-6 pr-14 py-5 border rounded-full text-xs font-black tracking-widest uppercase outline-none transition-all focus:border-orange-500/50 ${themeClasses.input}`} />
                 <button onClick={handleSendMessage} disabled={isAnalyzing} className="absolute right-3 top-1/2 -translate-y-1/2 w-11 h-11 bg-[#FF6B35] rounded-full flex items-center justify-center text-white shadow-xl hover:scale-105 active:scale-95 transition-all">
                    {isAnalyzing ? <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" /> : <Icons.Send size={18} />}
                 </button>
               </div>
            </div>
          </div>
        </div>
      </div>

      {/* POP OUT INTEL WINDOW */}
      {focusFile && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 md:p-10 bg-slate-950/90 backdrop-blur-xl animate-in fade-in duration-300" onClick={() => setFocusFile(null)}>
           <div className={`w-full max-w-6xl h-full max-h-[92vh] rounded-[3rem] overflow-hidden flex flex-col border transition-all pointer-events-auto ${theme === 'dark' ? 'bg-[#0a0c10] border-white/10 shadow-emerald-500/20 shadow-2xl' : 'bg-white border-slate-200 shadow-2xl'}`} onClick={e => e.stopPropagation()}>
              <div className={`p-8 md:p-10 border-b flex items-center justify-between shrink-0 ${theme === 'dark' ? 'border-white/5' : 'border-slate-100'}`}>
                 <div className="flex items-center gap-8 min-w-0">
                    <div className="w-14 h-14 bg-emerald-500 rounded-2xl flex items-center justify-center text-white shadow-xl shrink-0">
                       <Icons.FileText size={28} />
                    </div>
                    <div className="min-w-0">
                       <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest block mb-1">Intelligence // ver {focusFile.version}</span>
                       <h2 className={`text-xl font-black uppercase tracking-tighter leading-none truncate ${themeClasses.textMain}`}>{focusFile.name}</h2>
                    </div>
                 </div>
                 <button onClick={() => setFocusFile(null)} className="w-12 h-12 rounded-full flex items-center justify-center text-slate-500 hover:text-white transition-all shrink-0">
                    <Icons.X size={24} />
                 </button>
              </div>

              <div className="flex-1 overflow-hidden flex flex-col lg:flex-row">
                 <div className="flex-1 overflow-y-auto p-8 md:p-10 space-y-12 custom-scrollbar border-r border-white/5">
                    <div className="space-y-4">
                       <span className={`text-[11px] font-black uppercase tracking-widest block ${themeClasses.textSub}`}>Extracted Abstract</span>
                       <p className={`text-lg leading-relaxed font-bold italic border-l-4 border-emerald-500 pl-8 ${theme === 'dark' ? 'text-slate-200' : 'text-slate-800'}`}>
                          "{focusFile.somaIntel?.summary}"
                       </p>
                    </div>
                    <div className="space-y-6">
                       <span className={`text-[11px] font-black uppercase tracking-widest block ${themeClasses.textSub}`}>Extracted Figures</span>
                       <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          {focusFile.somaIntel?.extractedFigures.map((fig, i) => (
                            <div key={i} className={`p-6 rounded-2xl border ${theme === 'dark' ? 'bg-white/5 border-white/5' : 'bg-white border-slate-200'}`}>
                               <span className={`text-[9px] font-black uppercase mb-1 ${themeClasses.textSub}`}>{fig.label}</span>
                               <span className={`text-lg font-black ${themeClasses.textMain}`}>{fig.value}</span>
                            </div>
                          ))}
                       </div>
                    </div>
                 </div>
                 <div className={`w-full lg:w-[45%] flex flex-col overflow-hidden ${theme === 'dark' ? 'bg-slate-950/50' : 'bg-slate-100'}`}>
                    <div className="p-6 border-b border-white/5 flex items-center justify-between">
                       <span className="text-[10px] font-black uppercase text-slate-500">Forensic View</span>
                    </div>
                    <div className="flex-1 overflow-y-auto p-8 font-mono text-[11px] leading-relaxed custom-scrollbar">
                       <div className="space-y-6 opacity-80">
                          <div className={`p-6 rounded-2xl border ${theme === 'dark' ? 'bg-black/40 border-white/5' : 'bg-white border-slate-200'}`}>
                             {focusFile.type.includes('spreadsheet') ? (
                                <table className="w-full text-left">
                                   <thead>
                                      <tr className="border-b border-white/5"><th className="pb-2 text-emerald-500">REGION</th><th className="pb-2 text-emerald-500">VALUATION</th></tr>
                                   </thead>
                                   <tbody>
                                      <tr><td className="py-2">FR_PARIS_01</td><td className="py-2">$4,202,100</td></tr>
                                      <tr><td className="py-2">IE_DUBLIN_04</td><td className="py-2">$802,000</td></tr>
                                   </tbody>
                                </table>
                             ) : <pre>{`{ "protocol": "Forensic_Audit_V4", "id": "XF22", "checksum": "8f2c3a...e1d4" }`}</pre>}
                          </div>
                       </div>
                    </div>
                 </div>
              </div>
              <div className="p-8 md:p-10 border-t border-white/5 flex justify-between items-center shrink-0">
                 <button className="px-8 py-3 rounded-full text-[10px] font-black uppercase tracking-[0.2em] border border-white/10 hover:bg-white/10 transition-all">Download Native Artifact</button>
                 <button className="px-12 py-3 bg-emerald-600 text-white text-[11px] font-black uppercase tracking-[0.3em] rounded-full shadow-2xl hover:scale-105 transition-all">Verify Node Integrity</button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
}

// --- SUBCOMPONENTS ---

function LedgerHUD({ decisions, theme }: { decisions: DecisionNode[], theme: 'dark' | 'light' }) {
  const stats = useMemo(() => {
    const total = decisions.length;
    const avgConfidence = decisions.reduce((acc, d) => acc + d.confidence, 0) / Math.max(1, total);
    return { total, integrity: Math.round(avgConfidence * 100) };
  }, [decisions]);

  return (
    <div className="flex items-center justify-center gap-x-12">
      <div className="flex flex-col items-center">
        <span className={`text-4xl md:text-5xl font-black italic italic transition-colors ${getSpectrumClass(stats.integrity)}`}>{stats.integrity}%</span>
        <span className={`text-[10px] font-black uppercase tracking-[0.4em] mt-3 ${theme === 'dark' ? 'text-slate-500' : 'text-slate-600'}`}>Integrity</span>
      </div>
      <div className="h-16 w-px bg-current opacity-20" />
      <div className="flex flex-col items-center">
        <span className={`text-4xl md:text-5xl font-black italic italic ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{stats.total}</span>
        <span className={`text-[10px] font-black uppercase tracking-[0.4em] mt-3 ${theme === 'dark' ? 'text-slate-500' : 'text-slate-600'}`}>Nodes</span>
      </div>
    </div>
  );
}

function AwarenessHUD({ brief, theme }: { brief: any, theme: 'dark' | 'light' }) {
  return (
    <div className="flex items-center justify-center gap-x-12">
      <div className="flex flex-col items-center">
        <span className={`text-4xl md:text-5xl font-black italic italic transition-colors ${getSpectrumClass(brief.integrity)}`}>{brief.integrity}%</span>
        <span className={`text-[10px] font-black uppercase tracking-[0.4em] mt-3 ${theme === 'dark' ? 'text-slate-500' : 'text-slate-600'}`}>Health</span>
      </div>
      <div className="h-16 w-px bg-current opacity-20" />
      <div className="flex flex-col items-center">
        <span className={`text-4xl md:text-5xl font-black italic italic ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{Math.round(brief.score * 100)}</span>
        <span className={`text-[10px] font-black uppercase tracking-[0.4em] mt-3 ${theme === 'dark' ? 'text-slate-500' : 'text-slate-600'}`}>Drift</span>
      </div>
    </div>
  );
}

function VaultHUD({ files, theme }: { files: ProjectFile[], theme: 'dark' | 'light' }) {
  const readyCount = files.filter(f => f.ingestionStatus === 'READY').length;
  return (
    <div className="flex items-center justify-center gap-x-12">
      <div className="flex flex-col items-center">
        <span className={`text-4xl md:text-5xl font-black italic italic transition-colors ${getSpectrumClass(readyCount / Math.max(1, files.length) * 100)}`}>{readyCount}</span>
        <span className={`text-[10px] font-black uppercase tracking-[0.4em] mt-3 ${theme === 'dark' ? 'text-slate-500' : 'text-slate-600'}`}>Verified</span>
      </div>
      <div className="h-16 w-px bg-current opacity-20" />
      <div className="flex flex-col items-center">
        <span className={`text-4xl md:text-5xl font-black italic italic ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{files.length}</span>
        <span className={`text-[10px] font-black uppercase tracking-[0.4em] mt-3 ${theme === 'dark' ? 'text-slate-500' : 'text-slate-600'}`}>Assets</span>
      </div>
    </div>
  );
}

function HudMetric({ label, value, color, theme }: { label: string, value: string, color: string, theme: 'dark' | 'light' }) {
  const colorMap: any = { orange: 'text-[#FF6B35]', azure: 'text-[#4D7CFE]', emerald: 'text-emerald-500' };
  return (
    <div className="flex flex-col shrink-0">
      <span className={`text-[8px] font-black uppercase tracking-[0.2em] mb-1 ${theme === 'dark' ? 'text-slate-500' : 'text-slate-600'}`}>{label}</span>
      <span className={`text-sm font-black uppercase ${colorMap[color]}`}>{value}</span>
    </div>
  );
}

function ConsoleTile({ id, focusId, onFocus, title, tag, icon, color, children, theme }: any) {
  const isFocused = focusId === id;
  const isHidden = focusId !== null && focusId !== id;
  if (isHidden) return null;
  const textMain = theme === 'dark' ? 'text-slate-100' : 'text-slate-900';
  const textSub = theme === 'dark' ? 'text-slate-500' : 'text-slate-600';

  return (
    <div className={`flex flex-col rounded-[2.5rem] border overflow-hidden transition-all duration-500 ${isFocused ? 'col-span-2 row-span-2 z-20' : 'hover:translate-y-[-2px] cursor-pointer shadow-sm'} ${theme === 'dark' ? 'bg-white/5 border-white/10' : 'bg-white border-slate-200 shadow-xl'}`} onClick={() => !isFocused && onFocus(id)}>
      <div className={`p-8 border-b ${theme === 'dark' ? 'border-white/5' : 'border-slate-100'}`}>
        <div className="max-w-6xl mx-auto w-full flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4 min-w-0">
            <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${theme === 'dark' ? 'bg-white/5 text-white' : 'bg-slate-50 text-slate-800'}`}>{icon}</div>
            <div className="min-w-0">
              <span className={`text-[8px] font-black uppercase tracking-[0.3em] truncate block ${textSub}`}>{tag}</span>
              <h3 className={`text-sm font-black uppercase tracking-tight truncate ${textMain}`}>{title}</h3>
            </div>
          </div>
          {isFocused && <button onClick={(e) => { e.stopPropagation(); onFocus(null); }} className="text-[10px] font-black uppercase text-[#FF6B35] hover:underline shrink-0">Minimize</button>}
        </div>
      </div>
      <div className={`flex-1 p-8 flex flex-col justify-center items-center ${isFocused ? 'overflow-y-auto custom-scrollbar' : 'overflow-hidden'}`}>
        <div className={`${isFocused ? 'w-full max-w-5xl h-full flex flex-col' : 'w-full flex flex-col items-center'}`}>
          {children}
        </div>
      </div>
    </div>
  );
}

function TemporalExplorer({ onBack, decisions, theme }: any) {
  const textMain = theme === 'dark' ? 'text-slate-100' : 'text-slate-900';
  const textSub = theme === 'dark' ? 'text-slate-500' : 'text-slate-600';
  return (
    <div className="w-full flex flex-col animate-in fade-in duration-300">
       <button onClick={onBack} className="text-[#FF6B35] text-[10px] font-black uppercase mb-8 self-start flex items-center gap-2 hover:translate-x-[-2px] transition-transform"><Icons.Home size={12}/> Exit Explorer</button>
       <div className="flex-1 space-y-4 pr-2 pb-12">
          {decisions.map((d: any) => (
            <div key={d.id} className={`p-6 border rounded-2xl flex justify-between items-center transition-all ${theme === 'dark' ? 'bg-white/5 border-white/5' : 'bg-slate-50 border-slate-200 shadow-sm'}`}>
               <div className="min-w-0 flex-1 mr-4">
                  <h4 className={`text-xs font-black uppercase truncate ${textMain}`}>{d.title}</h4>
                  <p className={`text-[10px] font-mono mt-1 uppercase truncate ${textSub}`}>HASH: {d.hash.substring(0,16)}</p>
               </div>
               <div className="flex flex-col items-end gap-1 shrink-0">
                 <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded ${d.changeType === 'REVISION' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-current opacity-10'}`}>{d.changeType}</span>
                 <span className={`text-[8px] font-mono ${textSub}`}>CONF: {Math.round(d.confidence * 100)}%</span>
               </div>
            </div>
          ))}
       </div>
    </div>
  );
}

function DecisionForensicView({ node, onBack, onAddNote, theme }: any) {
  const [noteInput, setNoteInput] = useState(node.userNote || '');
  const textMain = theme === 'dark' ? 'text-slate-100' : 'text-slate-900';
  const textSub = theme === 'dark' ? 'text-slate-500' : 'text-slate-600';

  return (
    <div className="w-full flex flex-col animate-in slide-in-from-right-5 duration-300">
       <button onClick={onBack} className="text-[#FF6B35] text-[10px] font-black uppercase mb-8 self-start flex items-center gap-2 shrink-0"><Icons.Home size={12}/> Back to Ledger</button>
       <div className={`p-8 border rounded-3xl space-y-6 ${theme === 'dark' ? 'bg-white/5 border-white/10' : 'bg-white border-slate-200'}`}>
          <div className="flex justify-between items-start gap-4">
            <div className="min-w-0 flex-1">
              <span className="text-[10px] font-black text-orange-500 uppercase tracking-widest block mb-2">Forensic Detail</span>
              <h2 className={`text-xl font-black uppercase tracking-tight truncate ${textMain}`}>{node.title}</h2>
            </div>
            <div className="text-right shrink-0">
              <span className={`text-[10px] font-mono block ${textSub}`}>NODE_HASH</span>
              <span className={`text-[10px] font-mono font-black ${textMain}`}>{node.hash.substring(0, 16)}...</span>
            </div>
          </div>
          <p className={`text-sm leading-relaxed font-medium ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>{node.rationale}</p>
          <div className="space-y-3">
            <span className={`text-[10px] font-black uppercase tracking-widest block ${textSub}`}>Forensic Annotation</span>
            <div className="relative">
               <textarea value={noteInput} onChange={(e) => setNoteInput(e.target.value)} placeholder="ADD COMMENT..." className={`w-full p-4 rounded-xl text-[11px] font-mono outline-none border min-h-[80px] ${theme === 'dark' ? 'bg-white/5 border-white/5 text-blue-200 focus:border-blue-500/50' : 'bg-blue-50/50 border-blue-100 text-blue-900 focus:border-blue-500'}`} />
               <button onClick={() => onAddNote(node.id, noteInput)} className="absolute bottom-3 right-3 px-4 py-1.5 bg-blue-600 text-white text-[9px] font-black uppercase tracking-widest rounded-lg shadow-lg hover:bg-blue-700 transition-colors">Commit Note</button>
            </div>
          </div>
          <div className={`pt-6 border-t grid grid-cols-2 gap-4 ${theme === 'dark' ? 'border-white/5' : 'border-slate-100'}`}>
             <div className={`p-4 border rounded-xl ${theme === 'dark' ? 'bg-white/5 border-white/5' : 'bg-slate-50 border-slate-100'}`}>
                <span className={`text-[8px] font-black uppercase block mb-1 ${textSub}`}>Actor</span>
                <span className={`text-xs font-black uppercase ${textMain}`}>{node.actor}</span>
             </div>
             <div className={`p-4 border rounded-xl ${theme === 'dark' ? 'bg-white/5 border-white/5' : 'bg-slate-50 border-slate-100'}`}>
                <span className={`text-[8px] font-black uppercase block mb-1 ${textSub}`}>Confidence</span>
                <span className={`text-xs font-black ${getSpectrumClass(node.confidence * 100)}`}>{Math.round(node.confidence * 100)}%</span>
             </div>
          </div>
       </div>
    </div>
  );
}

function AwarenessBrief({ brief, isStabilizing, step, onStartStabilize, onCommit, onCancel, theme }: any) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const textMain = theme === 'dark' ? 'text-slate-100' : 'text-slate-900';
  const textSub = theme === 'dark' ? 'text-slate-500' : 'text-slate-600';

  if (isStabilizing) {
    return (
      <div className="w-full flex flex-col animate-in slide-in-from-bottom-5 duration-300">
         <div className="flex items-center justify-between mb-8 shrink-0">
            <h4 className="text-[11px] font-black uppercase tracking-widest text-emerald-500 flex items-center gap-2"><Icons.Shield size={14} /> Protocol: Stabilization</h4>
            <button onClick={onCancel} className={`text-[10px] font-black uppercase hover:text-[#FF6B35] transition-colors shrink-0 ${textSub}`}>Abort</button>
         </div>
         <div className="flex-1 space-y-6">
            <div className={`p-6 border rounded-3xl space-y-4 ${theme === 'dark' ? 'bg-white/5 border-white/10' : 'bg-slate-50 border-slate-100'}`}>
               <div className="flex items-center justify-between">
                  <span className={`text-[10px] font-black uppercase tracking-widest ${textSub}`}>Projected Integrity</span>
                  <span className="text-emerald-500 font-black text-xs">96%</span>
               </div>
               <div className="h-1 bg-current opacity-10 rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500 w-[96%] animate-pulse" />
               </div>
            </div>
            <div className="space-y-3">
               <p className={`text-[10px] font-black uppercase tracking-widest mb-2 ${textSub}`}>Actions</p>
               {["Flush Forensic Conflicts", "Lock Regional Baseline"].map((sim, i) => (
                 <div key={i} className={`p-4 border rounded-xl ${theme === 'dark' ? 'bg-emerald-500/5 border-emerald-500/10' : 'bg-emerald-50 border-emerald-100 shadow-sm'}`}>
                    <span className={`text-[11px] font-black uppercase ${textMain}`}>{sim}</span>
                 </div>
               ))}
            </div>
         </div>
         <div className="pt-8 border-t border-white/5 shrink-0 pb-12 mt-8">
            <button onClick={onCommit} className="w-full py-4 bg-emerald-600 text-white text-[10px] font-black uppercase tracking-[0.2em] rounded-2xl shadow-xl shadow-emerald-600/20 hover:scale-[1.02] transition-all">Execute Chain Recalibration</button>
         </div>
      </div>
    );
  }

  return (
    <div className="w-full flex flex-col items-center animate-in fade-in duration-500">
      <div className="w-full flex-1 space-y-8 pb-12">
        <div className={`p-8 border rounded-3xl ${theme === 'dark' ? 'bg-white/5 border-white/10' : 'bg-slate-50 border-slate-200'}`}>
           <p className={`text-xl font-black tracking-tight leading-tight mb-2 ${textMain}`}>{brief.situationSummary}</p>
           <p className={`text-[11px] font-mono uppercase tracking-widest ${textSub}`}>{brief.patternComparison}</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
           <div className="space-y-4">
              <h4 className={`text-[10px] font-black uppercase tracking-widest flex items-center gap-2 ${textSub}`}><Icons.Activity size={12}/> Signal Deltas</h4>
              {brief.whatsDifferent.map((s: any, i: number) => (
                <div key={i} onClick={() => setExpandedId(expandedId === s.label ? null : s.label)} className={`p-5 border rounded-2xl cursor-pointer transition-all ${expandedId === s.label ? 'bg-blue-500/10 border-blue-500/40 shadow-blue-500/5' : theme === 'dark' ? 'bg-white/5 border-white/5 hover:border-white/10' : 'bg-white border-slate-200 shadow-sm'}`}>
                   <div className="flex justify-between items-center"><p className={`text-[11px] font-black uppercase ${textMain}`}>{s.label}</p><Icons.Plus size={10} className={`${expandedId === s.label ? 'rotate-45 text-blue-500' : ''}`} /></div>
                   {expandedId === s.label && <p className={`text-[10px] font-mono mt-3 leading-relaxed animate-in slide-in-from-top-2 duration-300 ${textSub}`}>{s.detail}</p>}
                </div>
              ))}
           </div>
           <div className="space-y-4">
              <h4 className="text-[10px] font-black uppercase tracking-widest text-rose-500 flex items-center gap-2"><Icons.AlertCircle size={12}/> Threat Vectors</h4>
              {brief.quietRisks.map((r: any, i: number) => (
                <div key={i} onClick={() => setExpandedId(expandedId === r.label ? null : r.label)} className={`p-5 border rounded-2xl cursor-pointer transition-all ${expandedId === r.label ? 'bg-rose-500/10 border-rose-500/40 shadow-rose-500/5' : theme === 'dark' ? 'bg-rose-500/5 border-rose-500/10 hover:border-rose-500/20' : 'bg-white border-rose-100 shadow-sm'}`}>
                   <div className="flex justify-between items-center"><p className="text-[11px] font-black uppercase text-rose-500">{r.label}</p><Icons.Plus size={10} className={`${expandedId === r.label ? 'rotate-45' : ''}`} /></div>
                   {expandedId === r.label && <p className={`text-[10px] font-mono mt-3 leading-relaxed animate-in slide-in-from-top-2 duration-300 ${textSub}`}>{r.detail}</p>}
                </div>
              ))}
           </div>
        </div>
        <div className={`p-8 rounded-[2.5rem] border ${theme === 'dark' ? 'bg-blue-500/10 border-blue-500/20' : 'bg-blue-50 border-blue-200 shadow-xl shadow-blue-500/5'}`}>
           <span className="text-[10px] font-black uppercase tracking-widest text-blue-500 mb-3 block">Strategy Recommendation</span>
           <p className={`text-sm font-bold leading-relaxed italic mb-6 ${theme === 'dark' ? 'text-blue-100' : 'text-blue-900'}`}>"{brief.recommendation}"</p>
           <button onClick={onStartStabilize} className="px-6 py-2.5 bg-blue-500 text-white text-[10px] font-black uppercase tracking-widest rounded-full hover:scale-105 transition-transform shadow-lg shadow-blue-500/20">Stabilize Signal</button>
        </div>
      </div>
    </div>
  );
}

function EvidenceVaultView({ files, onFocusFile, theme, onIngest, ingestionStage }: any) {
  const textMain = theme === 'dark' ? 'text-slate-100' : 'text-slate-900';
  const textSub = theme === 'dark' ? 'text-slate-400' : 'text-slate-600';
  const panelBg = theme === 'dark' ? 'bg-white/5' : 'bg-slate-50';
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="w-full h-full flex flex-col items-center animate-in fade-in duration-500">
       <div className="w-full flex items-center justify-between mb-5 shrink-0">
          <div className="flex items-center gap-3">
            <button className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${panelBg}`}><Icons.Filter size={16} /></button>
            <div className={`px-4 py-2 rounded-xl flex items-center gap-2 border transition-all ${theme === 'dark' ? 'border-white/5 bg-white/5 focus-within:border-emerald-500/50' : 'border-slate-100 bg-white focus-within:border-emerald-500 shadow-sm'}`}>
               <Icons.Search size={14} className="text-slate-500" />
               <input type="text" placeholder="FILTER..." className="bg-transparent outline-none text-[9px] font-black tracking-widest uppercase w-32" />
            </div>
          </div>
          <div className="flex items-center gap-3 shrink-0">
             <input type="file" ref={fileInputRef} onChange={onIngest} className="hidden" />
             <button onClick={() => fileInputRef.current?.click()} className={`w-11 h-11 rounded-xl border flex items-center justify-center transition-all ${theme === 'dark' ? 'bg-white/5 border-white/5 hover:bg-white/10' : 'bg-white border-slate-100 hover:bg-slate-50 shadow-sm'}`} title="Ingest Tactical Evidence"><Icons.Upload size={20} /></button>
          </div>
       </div>
       {ingestionStage !== 'idle' && (
         <div className={`w-full p-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/5 mb-5 flex items-center justify-between animate-in slide-in-from-top-4 duration-300 shrink-0`}>
            <div className="flex items-center gap-4"><div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" /><span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">Pipeline Engaged</span></div>
         </div>
       )}
       <div className="w-full flex-1 overflow-y-auto space-y-3 custom-scrollbar pr-2 pb-12">
          {files.map((f: any) => (
            <div key={f.id} onClick={() => onFocusFile(f)} className={`p-5 border rounded-3xl cursor-pointer transition-all hover:scale-[1.01] ${theme === 'dark' ? 'bg-white/5 border-white/5 hover:border-emerald-500/30 shadow-sm' : 'bg-white border-slate-100 hover:border-emerald-500/30 shadow-sm'}`}>
               <div className="flex justify-between items-start gap-4">
                  <div className="flex items-center gap-4 min-w-0 flex-1">
                     <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${theme === 'dark' ? 'bg-white/5' : 'bg-slate-50 shadow-inner'}`}>
                        {f.source === 'EMAIL' ? <Icons.Mail size={22} className="text-blue-500" /> : f.source === 'CLOUD' ? <Icons.Cloud size={22} className="text-azure-500" /> : f.source === 'MANUAL' ? <Icons.Upload size={22} className="text-[#FF6B35]" /> : <Icons.Database size={22} className="text-emerald-500" />}
                     </div>
                     <div className="min-w-0">
                        <h4 className={`text-sm font-black uppercase tracking-tight truncate ${textMain}`}>{f.name}</h4>
                        <span className="text-[9px] font-mono text-slate-500 uppercase tracking-widest font-bold whitespace-nowrap">{f.source} // {f.size}</span>
                     </div>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                     <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-md ${f.ingestionStatus === 'READY' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-orange-500/10 text-orange-500 animate-pulse'}`}>{f.ingestionStatus}</span>
                     <span className={`text-[8px] font-black ${textSub} opacity-50 uppercase tracking-[0.1em]`}>{f.updatedAt}</span>
                  </div>
               </div>
            </div>
          ))}
       </div>
    </div>
  );
}
