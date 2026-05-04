
import React from 'react';
import { Icons } from '../constants';

interface BottomNavProps {
  activeView: string;
  setActiveView: (view: string) => void;
  toggleChat: () => void;
  unreadCount: number;
}

const BottomNav: React.FC<BottomNavProps> = ({ activeView, setActiveView, toggleChat, unreadCount }) => {
  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-slate-950/95 backdrop-blur-xl border-t border-slate-800 px-6 py-3 flex items-center justify-between z-50">
      <button 
        onClick={() => setActiveView('dashboard')}
        className={`flex flex-col items-center gap-1 ${activeView === 'dashboard' ? 'text-blue-500' : 'text-slate-500'}`}
      >
        <Icons.FileText size={20} />
        <span className="text-[10px] font-bold uppercase tracking-tighter">Ops</span>
      </button>
      
      <button 
        onClick={() => setActiveView('team')}
        className={`flex flex-col items-center gap-1 ${activeView === 'team' ? 'text-blue-500' : 'text-slate-500'}`}
      >
        <Icons.Users size={20} />
        <span className="text-[10px] font-bold uppercase tracking-tighter">Force</span>
      </button>

      <button 
        onClick={toggleChat}
        className="relative flex flex-col items-center gap-1 text-slate-500"
      >
        <Icons.Send size={20} />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-rose-500 text-white text-[8px] font-black rounded-full flex items-center justify-center border-2 border-slate-950">
            {unreadCount}
          </span>
        )}
        <span className="text-[10px] font-bold uppercase tracking-tighter">Comms</span>
      </button>

      <button className="flex flex-col items-center gap-1 text-slate-500">
        <Icons.Zap size={20} />
        <span className="text-[10px] font-bold uppercase tracking-tighter">AI</span>
      </button>
    </nav>
  );
};

export default BottomNav;
