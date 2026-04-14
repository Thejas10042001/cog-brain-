import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ICONS } from '../constants';

interface AnimatedGuideProps {
  type: 'getting-started' | 'strategy-lab' | 'simulations' | 'intelligence-tools' | 'privacy-policy' | 'terms-of-service' | 'security-audit';
}

export const AnimatedGuide: React.FC<AnimatedGuideProps> = ({ type }) => {
  switch (type) {
    case 'getting-started':
      return (
        <div className="relative w-full h-48 bg-slate-900/50 rounded-2xl overflow-hidden border border-slate-800 flex items-center justify-center">
          <motion.div 
            initial={{ y: -100, opacity: 0 }}
            animate={{ 
              y: [ -100, 0, 0, 0 ],
              opacity: [ 0, 1, 1, 0 ],
              scale: [ 1, 1, 0.8, 0.8 ]
            }}
            transition={{ duration: 4, repeat: Infinity, times: [0, 0.2, 0.8, 1] }}
            className="flex flex-col items-center gap-2"
          >
            <div className="w-16 h-20 bg-indigo-600/20 border-2 border-dashed border-indigo-500 rounded-lg flex items-center justify-center">
              <ICONS.Document className="w-8 h-8 text-indigo-400" />
            </div>
            <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Deal_Context.pdf</span>
          </motion.div>

          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ 
              scale: [ 0.8, 1, 1, 0.8 ],
              opacity: [ 0, 0, 1, 0 ]
            }}
            transition={{ duration: 4, repeat: Infinity, times: [0, 0.3, 0.5, 1] }}
            className="absolute inset-0 flex items-center justify-center"
          >
            <div className="w-32 h-32 rounded-full border-2 border-indigo-500/30 animate-ping" />
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0, 1, 0] }}
            transition={{ duration: 4, repeat: Infinity, times: [0, 0.6, 0.7, 1] }}
            className="absolute bottom-4 left-4 right-4 h-1 bg-slate-800 rounded-full overflow-hidden"
          >
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: '100%' }}
              transition={{ duration: 1, repeat: Infinity, repeatDelay: 3, ease: "linear" }}
              className="h-full bg-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.5)]"
            />
          </motion.div>
          
          <div className="absolute top-2 left-2 flex gap-1">
            <div className="w-2 h-2 rounded-full bg-red-500/50" />
            <div className="w-2 h-2 rounded-full bg-yellow-500/50" />
            <div className="w-2 h-2 rounded-full bg-green-500/50" />
          </div>
        </div>
      );

    case 'strategy-lab':
      return (
        <div className="relative w-full h-48 bg-slate-900/50 rounded-2xl overflow-hidden border border-slate-800 flex items-center justify-center">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
            className="absolute w-32 h-32 border border-indigo-500/20 rounded-full"
          />
          <motion.div
            animate={{ rotate: -360 }}
            transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
            className="absolute w-40 h-40 border border-slate-700/30 rounded-full border-dashed"
          />
          
          <div className="relative flex gap-2 items-end h-24">
            {[0.6, 0.9, 0.4, 0.75].map((h, i) => (
              <motion.div
                key={`bar-${i}`}
                initial={{ height: 0 }}
                animate={{ height: `${h * 100}%` }}
                transition={{ duration: 1, delay: i * 0.2, repeat: Infinity, repeatType: 'reverse' }}
                className="w-6 bg-gradient-to-t from-indigo-600 to-indigo-400 rounded-t-lg shadow-lg shadow-indigo-500/20"
              />
            ))}
          </div>

          <motion.div
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: 1 }}
            className="absolute top-4 right-4 bg-slate-800 px-3 py-1 rounded-full border border-slate-700"
          >
            <span className="text-[8px] font-black text-indigo-400 uppercase tracking-widest">Strategy Optimized</span>
          </motion.div>
        </div>
      );

    case 'simulations':
      return (
        <div className="relative w-full h-48 bg-slate-900/50 rounded-2xl overflow-hidden border border-slate-800 p-4 flex flex-col gap-3">
          <motion.div
            initial={{ x: -20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ duration: 0.5, repeat: Infinity, repeatDelay: 3 }}
            className="self-start max-w-[70%] bg-slate-800 p-2 rounded-2xl rounded-tl-none border border-slate-700"
          >
            <div className="flex items-center gap-2 mb-1">
              <div className="w-4 h-4 rounded-full bg-red-600 flex items-center justify-center text-[8px] font-bold text-white">!</div>
              <span className="text-[8px] font-black text-slate-400 uppercase">Skeptical CIO</span>
            </div>
            <div className="h-2 w-24 bg-slate-700 rounded-full" />
          </motion.div>

          <motion.div
            initial={{ x: 20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ duration: 0.5, delay: 1.5, repeat: Infinity, repeatDelay: 2 }}
            className="self-end max-w-[70%] bg-indigo-600 p-2 rounded-2xl rounded-tr-none shadow-lg shadow-indigo-600/20"
          >
            <div className="flex items-center gap-2 mb-1 justify-end">
              <span className="text-[8px] font-black text-indigo-200 uppercase">You</span>
              <div className="w-4 h-4 rounded-full bg-white flex items-center justify-center text-[8px] font-bold text-indigo-600">Y</div>
            </div>
            <div className="h-2 w-32 bg-indigo-400 rounded-full" />
          </motion.div>

          <motion.div 
            animate={{ opacity: [0, 1, 0] }}
            transition={{ duration: 1, delay: 2.5, repeat: Infinity, repeatDelay: 2 }}
            className="absolute bottom-4 right-4 flex items-center gap-2"
          >
            <span className="text-[8px] font-black text-green-400 uppercase tracking-widest">Sentiment: Positive</span>
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          </motion.div>
        </div>
      );

    case 'intelligence-tools':
      return (
        <div className="relative w-full h-48 bg-slate-900/50 rounded-2xl overflow-hidden border border-slate-800 flex items-center justify-center">
          <motion.div
            animate={{ 
              scale: [1, 1.1, 1],
              rotate: [0, 5, -5, 0]
            }}
            transition={{ duration: 4, repeat: Infinity }}
            className="relative"
          >
            <ICONS.SpikedGPT className="w-20 h-20 text-indigo-500 drop-shadow-[0_0_20px_rgba(99,102,241,0.5)]" />
            <motion.div
              animate={{ 
                opacity: [0, 1, 0],
                scale: [0.5, 1.5, 0.5]
              }}
              transition={{ duration: 2, repeat: Infinity }}
              className="absolute inset-0 bg-indigo-500/20 blur-2xl rounded-full"
            />
          </motion.div>

          <div className="absolute inset-0 pointer-events-none">
            {[...Array(6)].map((_, i) => (
              <motion.div
                key={`particle-${i}`}
                initial={{ opacity: 0, scale: 0 }}
                animate={{ 
                  opacity: [0, 1, 0],
                  scale: [0, 1, 0],
                  x: (Math.random() - 0.5) * 200,
                  y: (Math.random() - 0.5) * 200
                }}
                transition={{ duration: 2, delay: i * 0.3, repeat: Infinity }}
                className="absolute top-1/2 left-1/2 w-1 h-1 bg-indigo-400 rounded-full"
              />
            ))}
          </div>
        </div>
      );

    case 'privacy-policy':
      return (
        <div className="relative w-full h-48 bg-slate-900/50 rounded-2xl overflow-hidden border border-slate-800 flex items-center justify-center">
          <div className="absolute inset-0 flex items-center justify-center">
            <motion.div
              animate={{ 
                scale: [1, 1.2, 1],
                opacity: [0.1, 0.2, 0.1]
              }}
              transition={{ duration: 4, repeat: Infinity }}
              className="w-40 h-40 bg-green-500 rounded-full blur-3xl"
            />
          </div>
          
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="relative z-10 bg-slate-800/80 backdrop-blur-md p-6 rounded-2xl border border-green-500/30 shadow-2xl flex flex-col items-center gap-4"
          >
            <div className="w-12 h-12 bg-green-500/20 rounded-full flex items-center justify-center">
              <ICONS.Lock className="w-6 h-6 text-green-500" />
            </div>
            <div className="space-y-2 text-center">
              <div className="h-2 w-24 bg-green-500/20 rounded-full mx-auto" />
              <div className="h-1.5 w-32 bg-slate-700/50 rounded-full mx-auto" />
            </div>
            <div className="flex gap-2">
              <div className="px-2 py-1 bg-green-500/10 rounded border border-green-500/20 text-[8px] font-black text-green-500 uppercase">Encrypted</div>
              <div className="px-2 py-1 bg-green-500/10 rounded border border-green-500/20 text-[8px] font-black text-green-500 uppercase">Isolated</div>
            </div>
          </motion.div>
        </div>
      );

    case 'terms-of-service':
      return (
        <div className="relative w-full h-48 bg-slate-900/50 rounded-2xl overflow-hidden border border-slate-800 flex items-center justify-center">
          <div className="absolute inset-0 grid grid-cols-12 gap-1 p-2 opacity-5">
            {Array.from({ length: 144 }).map((_, i) => (
              <div key={`line-${i}`} className="h-1 bg-white rounded-full" />
            ))}
          </div>
          
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="relative z-10 bg-slate-800 p-5 rounded-xl border border-slate-700 shadow-2xl w-40 space-y-3"
          >
            <div className="flex justify-between items-center">
              <div className="w-8 h-1 bg-indigo-500 rounded-full" />
              <div className="w-3 h-3 bg-indigo-500/20 rounded-full" />
            </div>
            <div className="space-y-2">
              <div className="h-1 w-full bg-slate-700 rounded-full" />
              <div className="h-1 w-full bg-slate-700 rounded-full" />
              <div className="h-1 w-2/3 bg-slate-700 rounded-full" />
            </div>
            <div className="pt-2 border-t border-slate-700 flex justify-end">
              <div className="w-12 h-4 bg-indigo-600 rounded flex items-center justify-center">
                <span className="text-[6px] font-black text-white uppercase">Accept</span>
              </div>
            </div>
          </motion.div>
        </div>
      );

    case 'security-audit':
      return (
        <div className="relative w-full h-48 bg-slate-900/50 rounded-2xl overflow-hidden border border-slate-800 flex items-center justify-center">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
            className="absolute inset-0 flex items-center justify-center"
          >
            <div className="w-40 h-40 border border-red-600/10 rounded-full border-dashed" />
          </motion.div>
          
          <div className="relative z-10 flex flex-col items-center gap-3">
            <motion.div
              animate={{ 
                scale: [1, 1.1, 1],
                boxShadow: [
                  "0 0 0px rgba(220, 38, 38, 0)",
                  "0 0 20px rgba(220, 38, 38, 0.3)",
                  "0 0 0px rgba(220, 38, 38, 0)"
                ]
              }}
              transition={{ duration: 2, repeat: Infinity }}
              className="w-16 h-16 bg-red-600/20 rounded-2xl border border-red-600/50 flex items-center justify-center"
            >
              <ICONS.Shield className="w-8 h-8 text-red-600" />
            </motion.div>
            <div className="text-center">
              <div className="text-[10px] font-black text-white uppercase tracking-widest">System Audit</div>
              <div className="text-[8px] font-bold text-red-500 uppercase tracking-[0.2em] mt-1">Status: Secure</div>
            </div>
            <div className="flex gap-1">
              {[0, 1, 2].map(i => (
                <motion.div
                  key={`dot-${i}`}
                  animate={{ opacity: [0.3, 1, 0.3] }}
                  transition={{ duration: 1, delay: i * 0.2, repeat: Infinity }}
                  className="w-1 h-1 rounded-full bg-red-600"
                />
              ))}
            </div>
          </div>
        </div>
      );

    default:
      return null;
  }
};
