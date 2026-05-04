
import React from 'react';
import { Audit, Priority, AuditStatus } from '../types';
import { Icons } from '../constants';

interface AuditCardProps {
  audit: Audit;
  isSelected: boolean;
  onClick: () => void;
}

const AuditCard: React.FC<AuditCardProps> = ({ audit, isSelected, onClick }) => {
  const getPriorityClasses = (priority: Priority) => {
    switch(priority) {
      case 'critical': return 'bg-rose-500 text-white shadow-rose-500/20';
      case 'high': return 'bg-amber-500 text-white shadow-amber-500/20';
      case 'medium': return 'bg-sky-500 text-white shadow-sky-500/20';
      default: return 'bg-slate-500 text-white shadow-slate-500/20';
    }
  };

  const getStatusClasses = (status: AuditStatus) => {
    switch(status) {
      case 'active': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      case 'review': return 'bg-indigo-100 text-indigo-700 border-indigo-200';
      case 'blocked': return 'bg-rose-100 text-rose-700 border-rose-200';
      default: return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  return (
    <div 
      onClick={onClick}
      className={`group relative overflow-hidden bg-white rounded-xl md:rounded-2xl border-2 transition-all cursor-pointer hover:shadow-2xl ${
        isSelected 
          ? 'border-blue-500 shadow-xl shadow-blue-500/10 lg:scale-[1.01]' 
          : 'border-slate-200 hover:border-blue-200 shadow-sm'
      }`}
    >
      <div className="p-4 md:p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-1.5 md:gap-2 mb-2">
              <h3 className="text-base md:text-lg font-bold text-slate-900 tracking-tight truncate mr-2">{audit.title}</h3>
              <div className="flex gap-1.5">
                <span className={`px-1.5 py-0.5 text-[8px] md:text-[10px] uppercase font-black tracking-widest rounded shadow-lg ${getPriorityClasses(audit.priority)}`}>
                  {audit.priority}
                </span>
                <span className={`px-1.5 py-0.5 text-[8px] md:text-[10px] uppercase font-black tracking-widest rounded border ${getStatusClasses(audit.status)}`}>
                  {audit.status}
                </span>
              </div>
            </div>
            <p className="text-slate-500 text-xs md:text-sm font-medium flex items-center truncate">
              <span className="w-1.5 h-1.5 bg-blue-500 rounded-full mr-2 shrink-0"></span>
              {audit.client}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3 mb-5 md:mb-6">
          {[
            { label: 'ETA', val: new Date(audit.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) },
            { label: 'Progress', val: `${audit.progress}%` },
            { label: 'Status', val: `${audit.tasks.completed}/${audit.tasks.total}` },
            { label: 'Intel', val: `${audit.unreadMessages} msg` }
          ].map((item, idx) => (
            <div key={idx} className="bg-slate-50 rounded-lg md:rounded-xl p-2 md:p-3 border border-slate-100">
              <div className="text-[8px] md:text-[10px] uppercase font-black text-slate-400 mb-0.5 tracking-wider truncate">{item.label}</div>
              <div className="text-xs md:text-sm font-bold text-slate-800">{item.val}</div>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2 md:space-x-3">
            <div className="flex -space-x-1.5 md:-space-x-2">
              {audit.team.slice(0, 3).map((member, idx) => (
                <div 
                  key={idx}
                  className="w-7 h-7 md:w-9 md:h-9 bg-gradient-to-br from-slate-700 to-slate-900 rounded-full border-2 border-white flex items-center justify-center text-white text-[8px] md:text-[10px] font-black uppercase ring-1 ring-slate-100 shadow-sm"
                  title={member}
                >
                  {member.split(' ').map(n => n[0]).join('')}
                </div>
              ))}
              {audit.team.length > 3 && (
                <div className="w-7 h-7 md:w-9 md:h-9 bg-slate-100 rounded-full border-2 border-white flex items-center justify-center text-slate-500 text-[8px] md:text-[10px] font-black">
                  +{audit.team.length - 3}
                </div>
              )}
            </div>
          </div>
          
          <div className="flex items-center space-x-1.5 text-[10px] md:text-xs font-bold text-slate-400 bg-slate-50 px-2 md:px-3 py-1 md:py-1.5 rounded-full border border-slate-100">
            <Icons.Clock size={10} className="text-blue-500" />
            <span className="truncate">{audit.lastActivity}</span>
          </div>
        </div>

        <div className="mt-4 md:mt-5 relative h-1.5 md:h-2.5 bg-slate-100 rounded-full overflow-hidden">
          <div 
            className="absolute top-0 left-0 h-full bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 transition-all duration-1000 ease-out rounded-full"
            style={{ width: `${audit.progress}%` }}
          />
        </div>
      </div>
    </div>
  );
};

export default AuditCard;
