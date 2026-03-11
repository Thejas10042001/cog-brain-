import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ICONS } from '../constants';

interface AnimatedGuideProps {
  type: 'getting-started' | 'strategy-lab' | 'simulations' | 'intelligence-tools';
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
                key={i}
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
                key={i}
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

    default:
      return null;
  }
};
