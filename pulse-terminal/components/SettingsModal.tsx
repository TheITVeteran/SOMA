
import React, { useEffect } from 'react';
import { X, Settings, Shield, Cpu, Zap, Globe, Save } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  projectName: string;
}

const SettingsModal: React.FC<Props> = ({ isOpen, onClose, projectName }) => {
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-2xl bg-zinc-900 border border-zinc-800 rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
        {/* Header */}
        <div className="px-6 py-5 border-b border-zinc-800 flex items-center justify-between bg-zinc-950/50">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-500/10 rounded-xl border border-blue-500/20">
              <Settings className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white tracking-tight">System Settings</h2>
              <p className="text-[10px] text-zinc-500 uppercase font-bold tracking-widest">Pulse Cluster Configuration</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-zinc-800 rounded-full text-zinc-500 hover:text-white transition-all group"
          >
            <X className="w-5 h-5 group-hover:rotate-90 transition-transform duration-300" />
          </button>
        </div>

        {/* Content */}
        <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-8 max-h-[70vh] overflow-y-auto">
          <div className="space-y-6">
            <section className="space-y-4">
              <h3 className="text-[10px] font-black text-zinc-600 uppercase tracking-[0.2em] flex items-center space-x-2">
                <Globe className="w-3 h-3" />
                <span>General Workspace</span>
              </h3>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-zinc-400 uppercase ml-1">Project Identifier</label>
                  <input 
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-2.5 px-4 text-xs text-zinc-300 outline-none focus:border-blue-500/50 transition-all"
                    defaultValue={projectName}
                  />
                </div>
                <div className="flex items-center justify-between p-3 bg-zinc-950 rounded-xl border border-zinc-800">
                  <div className="flex flex-col">
                    <span className="text-[11px] font-bold text-zinc-300">Authority Lock</span>
                    <span className="text-[9px] text-zinc-600">Only Prime can assign tasks</span>
                  </div>
                  <div className="w-10 h-5 bg-blue-600 rounded-full relative cursor-pointer">
                    <div className="absolute right-1 top-1 w-3 h-3 bg-white rounded-full" />
                  </div>
                </div>
              </div>
            </section>

            <section className="space-y-4">
              <h3 className="text-[10px] font-black text-zinc-600 uppercase tracking-[0.2em] flex items-center space-x-2">
                <Shield className="w-3 h-3" />
                <span>Security Engine</span>
              </h3>
              <div className="p-4 bg-rose-500/5 border border-rose-500/10 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                   <span className="text-[10px] font-bold text-rose-400 uppercase">Shadow Code Audits</span>
                   <span className="text-[9px] font-mono text-zinc-500">ENABLED</span>
                </div>
                <div className="w-full bg-zinc-900 h-1.5 rounded-full overflow-hidden">
                   <div className="w-4/5 h-full bg-rose-500/50" />
                </div>
              </div>
            </section>
          </div>

          <div className="space-y-6">
            <section className="space-y-4">
              <h3 className="text-[10px] font-black text-zinc-600 uppercase tracking-[0.2em] flex items-center space-x-2">
                <Zap className="w-3 h-3 text-amber-500" />
                <span>Fleet Lane Management</span>
              </h3>
              <div className="space-y-3">
                <div className="p-3 bg-zinc-950 rounded-xl border border-zinc-800 flex items-center space-x-4">
                   <div className="p-2 bg-blue-500/10 rounded-lg"><Cpu className="w-4 h-4 text-blue-400" /></div>
                   <div className="flex-1">
                      <div className="text-[11px] font-bold text-zinc-300">Execution TTL</div>
                      <div className="text-[9px] text-zinc-600">Workers auto-kill after 12h</div>
                   </div>
                </div>
                <div className="p-3 bg-zinc-950 rounded-xl border border-zinc-800 flex items-center space-x-4">
                   <div className="p-2 bg-emerald-500/10 rounded-lg"><Zap className="w-4 h-4 text-emerald-400" /></div>
                   <div className="flex-1">
                      <div className="text-[11px] font-bold text-zinc-300">Dynamic Scaling</div>
                      <div className="text-[9px] text-zinc-600">Scale execution lane based on intent</div>
                   </div>
                </div>
              </div>
            </section>
          </div>
        </div>

        {/* Footer */}
        <div className="px-8 py-5 bg-zinc-950 border-t border-zinc-800 flex items-center justify-end space-x-3">
          <button 
            onClick={onClose}
            className="px-6 py-2.5 text-[10px] font-bold uppercase tracking-widest text-zinc-500 hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button 
            onClick={onClose}
            className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-500 text-white px-6 py-2.5 rounded-xl shadow-lg shadow-blue-500/20 transition-all text-[10px] font-bold uppercase tracking-widest"
          >
            <Save className="w-3.5 h-3.5" />
            <span>Apply Changes</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
