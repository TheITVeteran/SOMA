import React from 'react';

const App: React.FC = () => {
  return (
    <div className="flex flex-col h-full w-full bg-[#0a0a0d] overflow-hidden">
      <iframe
        src="/pulse_standalone.html"
        className="flex-1 w-full h-full border-none"
        title="SOMA Pulse IDE"
      />
    </div>
  );
};

export default App;
