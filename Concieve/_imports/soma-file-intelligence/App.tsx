
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { readDirectory, flattenNodes, processFileList } from './services/fileSystem';
import { createMockFileSystem } from './services/mockData';
import { queryKnowledgeBase, generateFileSummary, getAiClient } from './services/geminiService';
import IngestionPanel from './components/IngestionPanel';
import ChatInterface from './components/ChatInterface';
import CommandConsole from './components/CommandConsole';
import KnowledgeGraph from './components/KnowledgeGraph';
import FileViewer from './components/FileViewer';
import { FileSystemNode, AppState, LogEntry, ChatMessage, GraphViewMode, SmartFolder, ContextMenuState, Chunk } from './types';

const App: React.FC = () => {
  const [rootNode, setRootNode] = useState<FileSystemNode | null>(null);
  const [allNodes, setAllNodes] = useState<FileSystemNode[]>([]);
  const [appState, setAppState] = useState<AppState>(AppState.IDLE);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [ingestionProgress, setIngestionProgress] = useState(0);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [relevantNodeIds, setRelevantNodeIds] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<'graph' | 'tree'>('tree');
  const [graphViewMode, setGraphViewMode] = useState<GraphViewMode>('standard');
  const [currentUniverse, setCurrentUniverse] = useState('UNI-ALPHA');
  const [smartFolders, setSmartFolders] = useState<SmartFolder[]>([]);
  const [timeSliderValue, setTimeSliderValue] = useState(100);
  const [contextMenu, setContextMenu] = useState<ContextMenuState>({ visible: false, x: 0, y: 0, nodeId: null });
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedNode, setSelectedNode] = useState<FileSystemNode | null>(null);
  const [highlightedChunk, setHighlightedChunk] = useState<Chunk | undefined>(undefined);

  const log = useCallback((message: string, type: LogEntry['type'] = 'info') => {
    setLogs(prev => [...prev, { timestamp: Date.now(), message, type }]);
  }, []);

  // Autonomous Optimization Loop
  useEffect(() => {
    if (appState === AppState.READY && allNodes.length > 0) {
      const timer = setTimeout(() => {
          const deadCount = allNodes.filter(n => n.lifecycleStatus === 'dead').length;
          if (deadCount > 0) log(`SOMA: ${deadCount} dead nodes isolated in mesh.`, 'warning');
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [appState, allNodes, log]);

  const runIndexing = async (nodes: FileSystemNode[]) => {
    setAppState(AppState.INDEXING);
    const filesToIndex = nodes.filter(n => n.kind === 'file' && n.content);
    const dirsToIndex = nodes.filter(n => n.kind === 'directory');
    let processed = 0;
    const total = filesToIndex.length + dirsToIndex.length;

    for (const node of filesToIndex) {
        processed++;
        setIngestionProgress((processed / total) * 100);
        if (!node.metadata?.summary) {
            const analysis = await generateFileSummary(node.name, node.content!);
            if (node.metadata) {
                node.metadata.keywords = analysis.keywords;
                node.metadata.summary = analysis.summary;
            }
        }
        node.isIndexed = true;
    }

    for (const dir of dirsToIndex) {
        processed++;
        setIngestionProgress((processed / total) * 100);
        const childNames = (dir.children || []).map(c => c.name).join(', ');
        dir.metadata = dir.metadata || { size: 0, lastModified: Date.now(), type: 'directory', extension: '', keywords: [] };
        dir.metadata.summary = `Cluster: ${childNames.substring(0, 100)}`;
        dir.isIndexed = true;
    }
    setAppState(AppState.READY);
    log('Neural bridge established.', 'success');
  };

  const handleLoadDemo = async () => {
      setAppState(AppState.SCANNING);
      const demoRoot = createMockFileSystem();
      const flat = flattenNodes(demoRoot.children || []);
      flat.forEach(n => n.lifecycleStatus = Math.random() > 0.8 ? 'dead' : 'active');
      setRootNode(demoRoot);
      setAllNodes(flat);
      await runIndexing(flat);
  };

  const handleSelectDirectory = async () => {
    if (typeof (window as any).showDirectoryPicker === 'function') {
        try {
            const dirHandle = await (window as any).showDirectoryPicker();
            setAppState(AppState.SCANNING);
            const nodes = await readDirectory(dirHandle);
            const root = { id: 'root', name: dirHandle.name, kind: 'directory', path: dirHandle.name, children: nodes, isIndexed: false };
            setRootNode(root as any);
            const flat = flattenNodes(nodes);
            setAllNodes(flat);
            await runIndexing(flat);
        } catch (err) { log('Mount aborted.', 'error'); setAppState(AppState.IDLE); }
    }
  };

  const handleFileUpload = async (files: File[]) => {
      setAppState(AppState.SCANNING);
      const newNodes = await processFileList(files);
      const flat = flattenNodes(newNodes);
      setAllNodes(prev => [...prev, ...flat]);
      await runIndexing(flat);
  };

  const handleQuery = async (query: string) => {
    if (isProcessing) return;
    setIsProcessing(true);
    setChatHistory(prev => [...prev, { type: 'user', content: query }]);
    setChatHistory(prev => [...prev, { type: 'agent', content: '', isStreaming: true, retrievalStatus: { state: 'searching' } }]);
    
    try {
        const result = await queryKnowledgeBase(query, allNodes, {
            onRetrievalUpdate: (ids) => {
                setRelevantNodeIds(ids);
                if (query.toLowerCase().includes('open')) {
                    const found = allNodes.find(n => n.id === ids[0]);
                    if (found) setSelectedNode(found);
                }
            },
            onToken: (text) => setChatHistory(prev => {
                const h = [...prev];
                const last = h[h.length-1];
                if (last && last.type === 'agent') last.content = text;
                return h;
            })
        });
        setChatHistory(prev => {
            const h = [...prev];
            const last = h[h.length-1];
            if (last && last.type === 'agent') {
                last.content = result.answer;
                last.citations = result.citations;
                last.isStreaming = false;
                last.retrievalStatus = { state: 'complete' };
            }
            return h;
        });
    } catch (e) { log('Retrieval error.', 'error'); } finally { setIsProcessing(false); }
  };

  const handleAutoCategorize = async () => {
      if (allNodes.length === 0 || isProcessing) return;
      setIsProcessing(true);
      log('SOMA: Synthesizing semantic clusters...', 'info');
      
      try {
          const ai = getAiClient();
          const context = allNodes
              .filter(n => n.kind === 'file' && n.isIndexed)
              .map(n => n.name)
              .slice(0, 50)
              .join(', ');

          const prompt = `Analyze these files and suggest 3 high-level semantic categories to group them (e.g., "Logic Components", "Asset Configs"). Return ONLY a JSON array of 3 strings. Context: ${context}`;
          
          const response = await ai.models.generateContent({
              model: "gemini-3-flash-preview",
              contents: prompt,
              config: { responseMimeType: "application/json" }
          });

          const categories: string[] = JSON.parse(response.text || "[]");
          const newFolders = categories.map((cat, i) => ({
              id: `auto_${Date.now()}_${i}`,
              name: cat,
              query: `Find all files related to ${cat}`,
              color: '#a855f7' // Nuance Purple
          }));

          setSmartFolders(prev => [...prev, ...newFolders]);
          log(`SOMA: Generated ${categories.length} new semantic clusters.`, 'success');
      } catch (e) {
          log('Clustering failed.', 'error');
      } finally {
          setIsProcessing(false);
      }
  };

  return (
    <div className={`flex h-screen w-screen bg-background text-text-primary font-sans overflow-hidden ${currentUniverse === 'UNI-BETA' ? 'beta-theme' : ''}`}>
      <IngestionPanel logs={logs} appState={appState} progress={ingestionProgress} />
      
      <div className="flex-1 flex flex-col relative min-w-0">
        <header className="h-14 border-b border-border bg-background/50 backdrop-blur-xl flex items-center justify-between px-6 shrink-0 z-50">
            <div className="flex items-center gap-4">
                 {/* Header Left Area - Blank */}
            </div>
            
            <div className="flex items-center gap-4">
                <div className="flex bg-surfaceHighlight/50 p-1 rounded-lg border border-white/5">
                    <button onClick={() => setCurrentUniverse('UNI-ALPHA')} className={`px-3 py-1 text-[9px] uppercase font-bold rounded-md transition-all ${currentUniverse === 'UNI-ALPHA' ? 'bg-accent/20 text-accent shadow-inner' : 'text-text-muted hover:text-text-secondary'}`}>Alpha</button>
                    <button onClick={() => setCurrentUniverse('UNI-BETA')} className={`px-3 py-1 text-[9px] uppercase font-bold rounded-md transition-all ${currentUniverse === 'UNI-BETA' ? 'bg-purple-500/20 text-purple-400 shadow-inner' : 'text-text-muted hover:text-text-secondary'}`}>Beta</button>
                </div>
                {appState === AppState.IDLE ? (
                    <button onClick={handleLoadDemo} className="px-4 py-2 bg-accent/10 text-accent border border-accent/20 rounded-lg text-[10px] font-bold uppercase hover:bg-accent/20 transition-all">Init Neural Drive</button>
                ) : (
                    <button onClick={() => window.location.reload()} className="p-2 text-text-muted hover:text-red-400 transition-colors">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                    </button>
                )}
            </div>
        </header>

        <div className="flex-1 flex flex-col overflow-hidden relative">
            <div className="flex-1 min-h-0 relative flex flex-col bg-background">
                {appState === AppState.IDLE && chatHistory.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center p-8 text-center animate-fade-in relative">
                        <div className="absolute inset-0 bg-accent/5 blur-[120px] rounded-full pointer-events-none"></div>
                        <div className="w-16 h-16 rounded-2xl border border-border bg-surfaceHighlight flex items-center justify-center mb-8 shadow-2xl relative group cursor-pointer" onClick={handleSelectDirectory}>
                             <svg className="w-8 h-8 text-accent group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
                        </div>
                        <h1 className="text-lg font-bold tracking-widest text-text-primary mb-2 uppercase font-mono">Autonomous Memory Mesh</h1>
                        <p className="text-xs text-text-muted max-w-xs leading-relaxed opacity-60 font-mono">Synthesize a semantic database of your entire filesystem.</p>
                    </div>
                ) : (
                    <ChatInterface history={chatHistory} appState={appState} onCitationClick={(c) => {
                        const n = allNodes.find(node => node.id === c.fileId);
                        if (n) setSelectedNode(n);
                    }} />
                )}
            </div>

            <div className="h-[42%] shrink-0 border-t border-border bg-surface flex flex-col relative z-20 shadow-[0_-8px_40px_rgba(0,0,0,0.4)]">
                <div className="flex items-center px-6 h-12 border-b border-border bg-black/20 justify-between shrink-0">
                    <div className="flex bg-surfaceHighlight/30 p-1 rounded-lg">
                        <button onClick={() => setActiveTab('tree')} className={`p-2 rounded-md transition-all ${activeTab === 'tree' ? 'bg-white/5 text-accent shadow-sm' : 'text-text-muted hover:text-text-secondary'}`} title="FileSystem Tree">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" /></svg>
                        </button>
                        <button onClick={() => setActiveTab('graph')} className={`p-2 rounded-md transition-all ${activeTab === 'graph' ? 'bg-white/5 text-accent shadow-sm' : 'text-text-muted hover:text-text-secondary'}`} title="Neural Knowledge Map">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                        </button>
                    </div>

                    <div className="flex items-center gap-6">
                        {activeTab === 'graph' && (
                             <div className="flex items-center gap-4">
                                 <div className="flex bg-black/40 rounded p-1 border border-white/5">
                                    {['standard', 'lifecycle', 'heatmap'].map(m => (
                                        <button key={m} onClick={() => setGraphViewMode(m as any)} className={`px-2 py-0.5 rounded text-[8px] uppercase font-mono ${graphViewMode === m ? 'bg-accent/20 text-accent' : 'text-text-muted'}`}>{m}</button>
                                    ))}
                                 </div>
                                 <input type="range" value={timeSliderValue} onChange={e => setTimeSliderValue(parseInt(e.target.value))} className="w-20 h-1 accent-accent" />
                             </div>
                        )}
                        <div className="text-[10px] text-text-muted font-mono uppercase tracking-widest">{allNodes.length} NODES MAPPED</div>
                    </div>
                </div>

                <div className="flex-1 overflow-hidden relative">
                    {activeTab === 'tree' ? (
                        <div className="p-6 overflow-y-auto h-full custom-scrollbar animate-fade-in">
                             <div className="mb-6">
                                <div className="flex items-center justify-between mb-4">
                                    <h4 className="text-[10px] font-bold text-text-muted uppercase tracking-[0.2em]">Semantic Clusters</h4>
                                    <button 
                                        onClick={handleAutoCategorize} 
                                        className="text-[10px] font-bold text-purple-400 hover:text-white transition-colors uppercase tracking-widest border border-purple-500/30 rounded-md px-2 py-1 bg-purple-500/5 shadow-[0_0_15px_rgba(168,85,247,0.1)]"
                                        title="SOMA AI Auto-categorization"
                                    >
                                        Auto-Group
                                    </button>
                                </div>
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                    {smartFolders.map(f => (
                                        <div key={f.id} onClick={() => handleQuery(f.query)} className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/5 cursor-pointer hover:border-purple-500/40 hover:bg-purple-500/5 transition-all group">
                                            <div className="w-2 h-2 rounded-full bg-purple-500 animate-pulse shadow-[0_0_8px_rgba(168,85,247,0.6)]"></div>
                                            <span className="text-[10px] truncate font-mono text-text-secondary group-hover:text-text-primary uppercase tracking-wider">{f.name}</span>
                                        </div>
                                    ))}
                                    {smartFolders.length === 0 && (
                                        <div className="col-span-full py-6 text-center border border-dashed border-border rounded-xl">
                                            <p className="text-[10px] text-text-muted uppercase tracking-widest italic opacity-40">No active semantic groups</p>
                                        </div>
                                    )}
                                </div>
                             </div>
                             
                             <div className="h-px bg-border/40 mb-6"></div>

                             {rootNode && <div className="px-1 pb-12"><FileTree node={rootNode} relevantIds={relevantNodeIds} onSelect={n => setSelectedNode(n)} /></div>}
                        </div>
                    ) : (
                        <KnowledgeGraph nodes={allNodes} relevantNodeIds={relevantNodeIds} onNodeClick={n => setSelectedNode(n)} viewMode={graphViewMode} timeSliderValue={timeSliderValue} />
                    )}

                    {selectedNode && <FileViewer node={selectedNode} highlightedChunk={highlightedChunk} onClose={() => setSelectedNode(null)} />}
                </div>
            </div>

            <CommandConsole onQuery={handleQuery} onFileUpload={handleFileUpload} isProcessing={isProcessing} appState={appState} />
        </div>
      </div>
    </div>
  );
};

const FileTree: React.FC<{ node: FileSystemNode, relevantIds: string[], onSelect: (n: FileSystemNode) => void }> = ({ node, relevantIds, onSelect }) => {
    const [isOpen, setIsOpen] = useState(true);
    const isRelevant = relevantIds.includes(node.id);
    const isDir = node.kind === 'directory';

    // Randomized deterministic highlighting colors for tree items
    const getHighlightColor = () => {
        if (!isRelevant) return '';
        const hash = node.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
        return hash % 2 === 0 ? 'accent' : 'purple-500';
    };

    const highlightColor = getHighlightColor();

    const getIcon = () => {
        if (isDir) {
            return { 
                icon: (
                    <svg className={`w-3.5 h-3.5 ${isOpen ? 'text-accent' : 'text-blue-500'} shrink-0`} fill="currentColor" viewBox="0 0 24 24">
                        <path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/>
                    </svg>
                ),
                indicator: isOpen ? '▼' : '▶'
            };
        }
        
        const ext = node.name.split('.').pop()?.toLowerCase();
        let color = "text-text-muted";
        let iconPath = <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zM13 3.5L18.5 9H13V3.5zM6 20V4h6v6h6v10H6z"/>;

        switch(ext) {
            case 'ts': case 'tsx': 
                color = "text-blue-400";
                iconPath = <path d="M15.8 5.4c-.6-.4-1.3-.6-2-.6-2.1 0-3.8 1.7-3.8 3.8 0 2.1 1.7 3.8 3.8 3.8.7 0 1.4-.2 2-.6v2c-.6.4-1.3.6-2 .6-3.2 0-5.8-2.6-5.8-5.8s2.6-5.8 5.8-5.8c.7 0 1.4.2 2 .6v2zM17 18.5h-2v-1h2v1zM20 18.5h-2v-1h2v1z"/>;
                break;
            case 'js': case 'jsx': 
                color = "text-yellow-400";
                iconPath = <path d="M3 3h18v18H3V3zm14.5 13.5c0-.8-.4-1.2-1.2-1.5-.4-.2-.8-.3-1.1-.4-.3-.1-.5-.2-.5-.4 0-.2.2-.3.5-.3s.5.1.7.3l.8-.8c-.3-.3-.8-.5-1.5-.5-.8 0-1.3.4-1.3 1.2 0 .8.4 1.2 1.2 1.5.4.2.8.3 1.1.4.3.1.5.2.5.4 0 .2-.2.3-.5.3s-.5-.1-.7-.3l-.8.8c.3.3.8.5 1.5.5.9.1 1.3-.5 1.3-1.2zM12.4 12v4.8c0 .8-.4 1.2-1.1 1.2-.7 0-1.1-.4-1.1-1.2v-.8l-.9.8c.2.8.8 1.2 1.8 1.2 1.3 0 2.1-.8 2.1-2.2V12h-.8z"/>;
                break;
            case 'py': 
                color = "text-green-500";
                iconPath = <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9v-2h2v2zm0-4H9V7h2v5z"/>;
                break;
            case 'json': 
                color = "text-orange-400";
                iconPath = <path d="M5 3h2v2H5V3zm4 0h10v2H9V3zM5 7h2v2H5V7zm4 0h10v2H9V7zm-4 4h2v2H5v-2zm4 0h10v2H9v-2zm-4 4h2v2H5v-2zm4 0h10v2H9v-2z"/>;
                break;
            case 'md': 
                color = "text-teal-400";
                iconPath = <path d="M20.5 3h-17C2.67 3 2 3.67 2 4.5v15c0 .83.67 1.5 1.5 1.5h17c.83 0 1.5-.67 1.5-1.5v-15c0-.83-.67-1.5-1.5-1.5zM7 17H5v-6l2 2 2-2v6H7zm9-6h-2v3h-2v-3h-2l3-3 3 3z"/>;
                break;
            case 'css': 
                color = "text-blue-600";
                iconPath = <path d="M5 2l.9 16.5L12 22l6.1-3.5L19 2H5zm11 6h-3.3l-.1.9H16l-.3 3.1H12.4l-.1.9h3.3l-.3 3.1-3.3 1-3.3-1L8.5 9h5.4l.1-.9H8.7l.1-.9h7.1l.1.9z"/>;
                break;
        }

        return {
            icon: (
                <svg className={`w-3.5 h-3.5 ${color} shrink-0`} fill="currentColor" viewBox="0 0 24 24">
                    {iconPath}
                </svg>
            ),
            indicator: null
        };
    };

    const iconData = getIcon();

    return (
        <div className="ml-4 border-l border-white/5 pl-2 my-1 font-mono">
            <div onClick={() => isDir ? setIsOpen(!isOpen) : onSelect(node)} 
                 className={`group flex items-center gap-3 py-1.5 px-3 rounded-lg cursor-pointer transition-all duration-200 
                 ${isRelevant 
                    ? highlightColor === 'accent' 
                        ? 'bg-accent/10 text-accent font-bold ring-1 ring-accent/30 scale-[1.02]' 
                        : 'bg-purple-500/10 text-purple-400 font-bold ring-1 ring-purple-500/30 scale-[1.02]' 
                    : 'text-text-secondary hover:bg-white/5 hover:text-text-primary'}`}>
                {iconData.indicator && <span className="text-[8px] w-2 text-text-muted opacity-50">{iconData.indicator}</span>}
                {iconData.icon}
                <span className="truncate text-[11px] flex-1 tracking-tight">{node.name}</span>
                {isRelevant && <div className={`w-1.5 h-1.5 rounded-full ${highlightColor === 'accent' ? 'bg-accent shadow-[0_0_8px_#facc15]' : 'bg-purple-500 shadow-[0_0_8px_#a855f7]'}`}></div>}
                {node.isVirtual && <div className="w-1.5 h-1.5 rounded-full bg-purple-500 shadow-[0_0_8px_#a855f7]"></div>}
            </div>
            {isOpen && isDir && node.children && (
                <div className="mt-1">
                    {node.children.map(c => <FileTree key={c.id} node={c} relevantIds={relevantIds} onSelect={onSelect} />)}
                </div>
            )}
        </div>
    );
};

export default App;
