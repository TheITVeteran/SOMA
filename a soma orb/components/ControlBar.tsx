import React from 'react';
import { Mic, Power, Camera, CameraOff } from 'lucide-react';

interface ControlBarProps {
  isConnected: boolean;
  onToggle: () => void;
  inputVolume: number; // 0 to 1, based on user mic input
  webcamActive: boolean;
  onToggleWebcam: () => void;
}

export const ControlBar: React.FC<ControlBarProps> = ({ isConnected, onToggle, inputVolume, webcamActive, onToggleWebcam }) => {
  // Input visualization
  const glowIntensity = isConnected ? Math.max(0.1, inputVolume) : 0;
  const ringScale = 1 + (glowIntensity * 0.5);
  
  // Color changes based on audio detection
  // Low audio (< 0.2) = Purple (listening)
  // Medium audio (0.2-0.5) = Blue (detecting speech)
  // High audio (> 0.5) = Green (strong signal)
  const getMicColors = () => {
    if (!isConnected) {
      return {
        border: 'border-gray-800',
        text: 'text-gray-500',
        glow: 'shadow-none',
        ringBorder: 'border-gray-800/50',
        ringBg: 'bg-gray-800/20'
      };
    }
    
    if (inputVolume > 0.5) {
      return {
        border: 'border-green-400',
        text: 'text-green-200',
        glow: 'shadow-[0_0_20px_rgba(74,222,128,0.5)]',
        ringBorder: 'border-green-500/50',
        ringBg: 'bg-green-500/20'
      };
    } else if (inputVolume > 0.2) {
      return {
        border: 'border-blue-400',
        text: 'text-blue-200',
        glow: 'shadow-[0_0_20px_rgba(96,165,250,0.5)]',
        ringBorder: 'border-blue-500/50',
        ringBg: 'bg-blue-500/20'
      };
    } else {
      return {
        border: 'border-purple-400',
        text: 'text-purple-200',
        glow: 'shadow-[0_0_20px_rgba(192,132,252,0.5)]',
        ringBorder: 'border-purple-500/50',
        ringBg: 'bg-purple-500/20'
      };
    }
  };
  
  const colors = getMicColors();

  return (
    <div className="flex flex-row items-center gap-6">
      {/* Mic / Power Button */}
      <div className="relative">
        {/* Reverb Ring - Dynamic Color */}
        <div 
            className={`absolute inset-0 rounded-full border ${colors.ringBorder} ${colors.ringBg} blur-sm transition-all duration-75 ease-out`}
            style={{
                transform: `scale(${ringScale})`,
                opacity: glowIntensity
            }}
        />
        
        <button
          onClick={onToggle}
          className={`
            relative flex items-center justify-center w-16 h-16 rounded-full transition-all duration-100 z-20 border bg-black
            ${colors.border} ${colors.text} ${colors.glow}
            ${!isConnected && 'hover:border-gray-600 hover:text-gray-300'}
          `}
        >
          {isConnected ? (
            <Power className="w-6 h-6" />
          ) : (
            <Mic className="w-6 h-6" />
          )}
        </button>
      </div>

      {/* Webcam Toggle Button */}
      {isConnected && (
        <button
          onClick={onToggleWebcam}
          className={`
            flex items-center justify-center w-12 h-12 rounded-full border transition-all duration-100 bg-black hover:bg-zinc-900
            ${webcamActive ? 'border-cyan-400 text-cyan-200 shadow-[0_0_15px_rgba(34,211,238,0.4)]' : 'border-zinc-800 text-zinc-500 hover:border-zinc-700 hover:text-zinc-400'}
          `}
          title={webcamActive ? "Pause Webcam" : "Enable Webcam"}
        >
          {webcamActive ? (
            <Camera className="w-5 h-5 animate-pulse" />
          ) : (
            <CameraOff className="w-5 h-5" />
          )}
        </button>
      )}
    </div>
  );
};