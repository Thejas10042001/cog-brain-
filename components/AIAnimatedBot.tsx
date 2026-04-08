import React from 'react';
import { motion } from 'motion/react';

interface AIAnimatedBotProps {
  isAISpeaking: boolean;
  isUserListening?: boolean;
  accentColor?: string;
  className?: string;
}

export const AIAnimatedBot: React.FC<AIAnimatedBotProps> = ({ 
  isAISpeaking, 
  isUserListening = false, 
  accentColor = "#4f46e5",
  className = ""
}) => {
  return (
    <div className={`relative w-full h-full bg-slate-900 overflow-hidden flex items-center justify-center ${className}`}>
      {/* Background Pulse */}
      <motion.div 
        className="absolute inset-0 bg-indigo-900/20"
        animate={{ 
          opacity: isAISpeaking ? [0.2, 0.4, 0.2] : 0.1,
          scale: isAISpeaking ? [1, 1.05, 1] : 1
        }}
        transition={{ duration: 2, repeat: Infinity }}
      />
      
      {/* Voice Waveform Rings */}
      {isAISpeaking && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          {[...Array(3)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute rounded-full border border-indigo-500/30"
              initial={{ width: 100, height: 100, opacity: 0.5 }}
              animate={{ 
                width: [100, 300], 
                height: [100, 300], 
                opacity: [0.5, 0] 
              }}
              transition={{ 
                duration: 2, 
                repeat: Infinity, 
                delay: i * 0.6,
                ease: "easeOut"
              }}
            />
          ))}
        </div>
      )}

      <svg viewBox="0 0 200 240" className={`w-full h-full max-w-[280px] transition-all duration-700 ${isAISpeaking ? 'drop-shadow-[0_0_40px_rgba(79,70,229,0.4)] scale-105' : 'drop-shadow-2xl'}`}>
        <defs>
          <linearGradient id="faceGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#f8fafc" />
            <stop offset="100%" stopColor="#e2e8f0" />
          </linearGradient>
          <linearGradient id="suitGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#0f172a" />
            <stop offset="100%" stopColor="#020617" />
          </linearGradient>
        </defs>
        
        {/* Body */}
        <g className="animate-breathe">
          <path d="M10 240 C 10 180, 40 170, 100 170 C 160 170, 190 180, 190 240" fill="url(#suitGrad)" />
          <path d="M85 170 L 100 185 L 115 170" fill="white" opacity="0.8" />
        </g>

        {/* Head */}
        <g className={`${isUserListening ? 'animate-listen-tilt' : 'animate-breathe'}`}>
          <rect x="88" y="150" width="24" height="25" rx="12" fill="#e2e8f0" />
          <path d="M100 15 C 55 15, 50 55, 50 95 C 50 145, 70 165, 100 165 C 130 165, 150 145, 150 95 C 150 55, 145 15, 100 15" fill="url(#faceGrad)" stroke="#1e1b4b" strokeWidth="0.5" />
          
          {/* Eyes */}
          <g className="animate-blink">
            <circle cx="78" cy="82" r="4.5" fill="#0f172a" />
            <circle cx="122" cy="82" r="4.5" fill="#0f172a" />
            <motion.circle 
              cx="78" cy="82" r="1.5" fill={accentColor} 
              animate={isAISpeaking ? { x: [0, 1, -1, 0], y: [0, -1, 1, 0] } : {}}
              transition={{ repeat: Infinity, duration: 2 }}
            />
            <motion.circle 
              cx="122" cy="82" r="1.5" fill={accentColor} 
              animate={isAISpeaking ? { x: [0, 1, -1, 0], y: [0, -1, 1, 0] } : {}}
              transition={{ repeat: Infinity, duration: 2 }}
            />
          </g>

          {/* Mouth */}
          <g transform="translate(100, 132)">
            {isAISpeaking ? (
              <path d="M-12 0 Q 0 12, 12 0 Q 0 -2, -12 0" fill="#0f172a" className="animate-lip-morph" />
            ) : (
              <path d="M-10 0 Q 0 2, 10 0" stroke="#0f172a" strokeWidth="2.5" fill="none" strokeLinecap="round" className={isUserListening ? "animate-listen-mouth" : ""} />
            )}
          </g>
        </g>
      </svg>

      {/* Live Indicator */}
      <div className="absolute bottom-4 left-4 flex items-center gap-2">
        <div className={`w-2 h-2 rounded-full animate-pulse ${isAISpeaking ? 'bg-indigo-500' : 'bg-red-500'}`}></div>
        <span className="text-[10px] font-black text-white/60 uppercase tracking-widest">
          {isAISpeaking ? 'AI Transmitting' : 'Live Neural Feed'}
        </span>
      </div>
    </div>
  );
};
