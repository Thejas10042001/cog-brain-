
import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ICONS } from '../constants';
import { logoutUser, User } from '../services/firebaseService';

interface HeaderProps {
  user?: User | null;
}

export const Header: React.FC<HeaderProps> = ({ 
  user, 
}) => {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 glass border-b border-slate-800/50 h-20 transition-all duration-500">
      <div className="w-full px-12 h-full flex items-center justify-between max-w-[1800px] mx-auto">
        <div className="flex flex-col items-start leading-none group cursor-pointer">
          <div className="flex items-center gap-4">
            <motion.div 
              whileHover={{ rotate: 180, scale: 1.1 }}
              className="w-10 h-10 bg-red-600 text-white rounded-[1.25rem] flex items-center justify-center font-black text-2xl shadow-[0_10px_30px_rgba(220,38,38,0.4)]"
            >
              !
            </motion.div>
            <span className="font-black text-3xl tracking-tighter text-white uppercase">
              SPIKED<span className="text-red-600 drop-shadow-[0_0_15px_rgba(220,38,38,0.4)]">AI</span>
            </span>
          </div>
          <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.5em] mt-2 ml-1 hidden md:block">
            Neural Sales Intelligence Protocol
          </span>
        </div>

        <div className="flex items-center gap-6">
          {user && (
            <div className="hidden lg:flex items-center gap-4 bg-slate-800/50 backdrop-blur-sm px-5 py-2 rounded-2xl border border-slate-700/50 transition-all shadow-sm hover:shadow-md">
              <div className="flex flex-col items-end">
                <span className="text-[8px] font-black uppercase text-indigo-400 tracking-widest">Neural Link Active</span>
                <span className="text-[11px] font-black text-slate-200 truncate max-w-[150px]">{user.email}</span>
              </div>
              <div className="w-px h-6 bg-slate-700 mx-1"></div>
              <button 
                onClick={() => logoutUser()}
                className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-900/30 rounded-xl transition-all active:scale-90"
                title="Disconnect Neural Link"
              >
                <ICONS.X className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
