import React from 'react';

interface AppProps {
  onClose?: () => void;
}

const App: React.FC<AppProps> = ({ onClose }) => {
  return (
    <div className="flex flex-col h-full w-full bg-[#0a0a0d] overflow-hidden relative">
      {onClose && (
        <button 
          onClick={onClose}
          className="absolute top-3 right-4 z-[300] p-1.5 rounded-lg border border-red-500/20 text-red-400 hover:bg-red-500/10 transition-colors bg-[#0f0f14]"
          title="Close Pulse"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        </button>
      )}
      
      <iframe 
        src="/pulse_standalone.html" 
        className="flex-1 w-full h-full border-none"
        title="SOMA Pulse IDE"
      />
    </div>
  );
};

export default App;
