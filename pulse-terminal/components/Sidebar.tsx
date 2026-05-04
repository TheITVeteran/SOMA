
import React, { useState } from 'react';
import { ProjectState, WorkspaceTab, FleetRole } from '../types';
import { 
  Layers, ChevronDown, Activity, 
  Terminal as TerminalIcon, BookOpen, Lock, Cpu, Eye, Archive, Crown, Clock,
  ChevronLeft, ChevronRight, Download, Zap, RefreshCw
} from 'lucide-react';

interface Props {
  state: ProjectState;
  onTabChange: (tab: WorkspaceTab) => void;
  onServiceAction?: (id: string, action: 'start' | 'stop') => void;
  onDownloadZip?: () => void;
}

const PulseLogo = ({ isCollapsed, onDownloadZip, hasBlueprint }: { isCollapsed: boolean, onDownloadZip?: () => void, hasBlueprint: boolean }) => (
  <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'space-x-3'} transition-all duration-300 w-full`}>
    <div className="relative shrink-0 flex items-center justify-center">
      <svg width={isCollapsed ? "32" : "44"} height="28" viewBox="0 0 40 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="pulse-grad" x1="0" y1="0" x2="40" y2="0" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#00d2ff" />
            <stop offset="1" stopColor="#00548b" />
          </linearGradient>
        </defs>
        <path 
          d="M2 12H7L11 8L15 16L19 4L23 20L27 6L31 14L35 12H38" 
          stroke="url(#pulse-grad)" 
          strokeWidth="3.5" 
          strokeLinecap="round" 
          strokeLinejoin="round" 
        />
      </svg>
      <div className="absolute inset-0 bg-blue-500/10 blur-xl rounded-full opacity-50" />
    </div>
    
    {!isCollapsed && (
      <div className="flex items-center justify-between flex-1 animate-in fade-in slide-in-from-left-2 duration-300 min-w-0">
        <span className="text-xl font-black italic tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-[#00d2ff] to-[#00548b] uppercase leading-none truncate pr-2">
          Pulse
        </span>
        {hasBlueprint && (
          <button 
            onClick={(e) => { e.stopPropagation(); onDownloadZip?.(); }}
            className="p-1.5 hover:bg-emerald-500/20 rounded-lg text-zinc-500 hover:text-emerald-400 transition-all group flex items-center border border-transparent hover:border-emerald-500/20 bg-zinc-900/50 shadow-sm"
            title="Download App (.zip)"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="text-[7px] font-black uppercase tracking-widest hidden group-hover:block ml-1">ZIP</span>
          </button>
        )}
      </div>
    )}
  </div>
);

const Sidebar: React.FC<Props> = ({ state, onTabChange, onServiceAction, onDownloadZip }) => {
  const [isCollapsed, setIsCollapsed] = useState(false);

  const groupedServices = state.services.reduce((acc, service) => {
    if (!acc[service.role]) acc[service.role] = [];
    acc[service.role].push(service);
    return acc;
  }, {} as Record<FleetRole, typeof state.services>);

  const roleConfig: Record<FleetRole, { icon: React.ReactNode, color: string, label: string }> = {
    prime: { icon: <Crown className="w-3.5 h-3.5" />, color: 'text-amber-500', label: 'Prime Authority' },
    execution: { icon: <Cpu className="w-3.5 h-3.5" />, color: 'text-blue-400', label: 'Execution Lane' },
    observer: { icon: <Eye className="w-3.5 h-3.5" />, color: 'text-emerald-400', label: 'Observer Lane' },
    archive: { icon: <Archive className="w-3.5 h-3.5" />, color: 'text-purple-400', label: 'Artifact Vault' }
  };

  return (
    <aside className={`${isCollapsed ? 'w-16' : 'w-64'} bg-zinc-950 flex flex-col border-r border-zinc-900/50 transition-all duration-300 ease-in-out relative group/sidebar`}>
      <button 
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="absolute -right-3 top-16 w-6 h-6 bg-zinc-900 border border-zinc-800 rounded-full flex items-center justify-center text-zinc-500 hover:text-blue-400 transition-all z-50 opacity-0 group-hover/sidebar:opacity-100 shadow-xl"
      >
        {isCollapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronLeft className="w-3 h-3" />}
      </button>

      <div className={`p-4 mb-2 overflow-hidden flex items-center ${isCollapsed ? 'justify-center' : ''}`}>
        <PulseLogo 
          isCollapsed={isCollapsed} 
          onDownloadZip={onDownloadZip} 
          hasBlueprint={!!state.activeBlueprint && state.activeBlueprint.length > 0} 
        />
      </div>

      <nav className="flex-1 overflow-y-auto overflow-x-hidden px-2 space-y-6 custom-scrollbar">
        <div>
          {!isCollapsed && (
            <div className="flex items-center justify-between px-3 mb-2 text-[10px] font-bold text-zinc-600 uppercase tracking-widest animate-in fade-in">
              <span>Workspaces</span>
              <Zap className="w-3 h-3" />
            </div>
          )}
          <ul className="space-y-1">
            <SidebarItem isCollapsed={isCollapsed} icon={<Crown className="w-4 h-4" />} label="Prime Control" active={state.activeTab === 'web'} onClick={() => onTabChange('web')} />
            <SidebarItem isCollapsed={isCollapsed} icon={<Layers className="w-4 h-4" />} label="Fleet Mesh" active={state.activeTab === 'fleet'} onClick={() => onTabChange('fleet')} />
            <SidebarItem isCollapsed={isCollapsed} icon={<Lock className="w-4 h-4" />} label="Security Lane" active={state.activeTab === 'security'} onClick={() => onTabChange('security')} />
            <SidebarItem isCollapsed={isCollapsed} icon={<BookOpen className="w-4 h-4" />} label="Artifacts" active={state.activeTab === 'docs'} onClick={() => onTabChange('docs')} />
          </ul>
        </div>

        <div className="pt-2">
          {!isCollapsed && (
            <div className="flex items-center justify-between px-3 mb-2 text-[10px] font-bold text-zinc-600 uppercase tracking-widest border-b border-zinc-900 pb-1 animate-in fade-in">
              <span>Active Fleet</span>
              <Activity className="w-3 h-3" />
            </div>
          )}
          
          <div className={`space-y-4 ${isCollapsed ? 'px-1' : 'px-3'} pt-2`}>
            {(['prime', 'execution', 'observer', 'archive'] as FleetRole[]).map(role => {
              const services = groupedServices[role] || [];
              if (services.length === 0 && role !== 'execution') return null;
              
              return (
                <div key={role} className="space-y-2">
                  <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'space-x-2'} text-[9px] font-black uppercase tracking-widest ${roleConfig[role].color}`}>
                    {roleConfig[role].icon}
                    {!isCollapsed && <span className="animate-in fade-in whitespace-nowrap">{roleConfig[role].label}</span>}
                  </div>
                  {!isCollapsed && services.map(service => {
                    const isTimedOut = service.lastHeartbeat && (Date.now() - service.lastHeartbeat > 10000);
                    return (
                      <div key={service.id} className="group relative pl-3 animate-in fade-in border-l border-zinc-900 ml-1.5 py-1">
                        <div className="flex items-center justify-between text-xs mb-0.5">
                          <div className="flex flex-col min-w-0">
                            <span className={`font-medium truncate transition-colors text-[11px] ${service.status === 'offline' || isTimedOut ? 'text-zinc-600' : 'text-zinc-300'}`}>
                              {service.name}
                            </span>
                            <div className="flex items-center space-x-2">
                              <span className="text-[8px] text-zinc-700 font-mono tracking-tighter">{service.status}</span>
                              <div className="flex space-x-0.5">
                                 {[0,1,2].map(i => (
                                   <div key={i} className={`w-1 h-1 rounded-full ${service.status === 'online' ? 'bg-emerald-500/40' : 'bg-zinc-800'}`} />
                                 ))}
                              </div>
                            </div>
                          </div>
                          {service.status === 'online' && !isTimedOut && (
                            <RefreshCw className="w-2.5 h-2.5 text-emerald-500 animate-spin" style={{ animationDuration: '3s' }} />
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </nav>

      <div className={`p-4 mt-auto border-t border-zinc-900/50 flex items-center ${isCollapsed ? 'justify-center' : 'justify-between'} text-[9px] font-bold text-zinc-700 uppercase tracking-widest overflow-hidden shrink-0`}>
        {!isCollapsed && <span className="animate-in fade-in whitespace-nowrap">Mesh Secure</span>}
        <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.5)] shrink-0" />
      </div>
    </aside>
  );
};

const SidebarItem = ({ icon, label, active = false, onClick, isCollapsed }: { icon: React.ReactNode, label: string, active?: boolean, onClick?: () => void, isCollapsed: boolean }) => (
  <li>
    <button 
      onClick={onClick} 
      className={`w-full flex items-center ${isCollapsed ? 'justify-center px-0' : 'px-3 space-x-3'} py-2 rounded-lg transition-all text-xs font-medium relative group ${active ? 'bg-blue-600/10 text-blue-400 border border-blue-500/20' : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900 border border-transparent'}`}
    >
      <span className={`transition-transform duration-300 shrink-0 ${active ? 'scale-110' : 'group-hover:scale-110'}`}>{icon}</span>
      {!isCollapsed && <span className="truncate animate-in fade-in whitespace-nowrap font-bold tracking-tight">{label}</span>}
      {isCollapsed && active && <div className="absolute left-0 w-1 h-4 bg-blue-500 rounded-r-full" />}
    </button>
  </li>
);

export default Sidebar;
