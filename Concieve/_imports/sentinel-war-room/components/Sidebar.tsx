
import React from 'react';
import { Icons } from '../constants';

interface SidebarProps {
  activeView: string;
  setActiveView: (view: string) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ activeView, setActiveView }) => {
  return (
    <aside className="hidden md:flex w-20 bg-slate-950 flex-col items-center py-6 space-y-8 z-50">
      <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 via-blue-600 to-purple-600 rounded-2xl flex items-center justify-center text-white font-black text-xl shadow-xl shadow-blue-500/20 rotate-3 transition-transform hover:rotate-0">
        SR
      </div>
      
      <nav className="flex-1 flex flex-col space-y-6">
        <button 
          onClick={() => setActiveView('dashboard')}
          className={`group relative w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-300 ${
            activeView === 'dashboard' 
              ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30 ring-2 ring-blue-400/50' 
              : 'text-slate-500 hover:bg-slate-900 hover:text-white'
          }`}
          title="War Room Dashboard"
        >
          <Icons.FileText size={24} />
          <div className="absolute left-16 px-2 py-1 bg-slate-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap">
            Dashboard
          </div>
        </button>
        
        <button 
          onClick={() => setActiveView('team')}
          className={`group relative w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-300 ${
            activeView === 'team' 
              ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30 ring-2 ring-blue-400/50' 
              : 'text-slate-500 hover:bg-slate-900 hover:text-white'
          }`}
          title="Force Intel"
        >
          <Icons.Users size={24} />
          <div className="absolute left-16 px-2 py-1 bg-slate-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap">
            Personnel
          </div>
        </button>
        
        <button className="group relative w-12 h-12 rounded-xl flex items-center justify-center text-slate-500 hover:bg-slate-900 hover:text-white transition-all duration-300" title="Threat Analysis">
          <Icons.AlertCircle size={24} />
          <div className="absolute left-16 px-2 py-1 bg-slate-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap">
            Alerts
          </div>
        </button>

        <button className="group relative w-12 h-12 rounded-xl flex items-center justify-center text-slate-500 hover:bg-slate-900 hover:text-white transition-all duration-300" title="Tactical AI">
          <Icons.Zap size={24} />
          <div className="absolute left-16 px-2 py-1 bg-slate-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap">
            AI Analyst
          </div>
        </button>
      </nav>

      <div className="flex flex-col space-y-4">
        <div className="w-10 h-10 ring-2 ring-slate-800 rounded-full flex items-center justify-center text-white text-sm font-semibold overflow-hidden cursor-pointer hover:ring-blue-500 transition-all">
          <img src="https://picsum.photos/seed/commander/100/100" alt="Commander" />
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
