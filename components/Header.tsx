
import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ICONS } from '../constants';
import { logoutUser, User } from '../services/firebaseService';

interface HeaderProps {
  user?: User | null;
  zoom: number;
  onZoomChange: (newZoom: number) => void;
  textZoom: number;
  onTextZoomChange: (newZoom: number) => void;
  darkMode: boolean;
  onDarkModeToggle: () => void;
}

export const Header: React.FC<HeaderProps> = ({ 
  user, 
  zoom, 
  onZoomChange, 
  textZoom, 
  onTextZoomChange,
  darkMode,
  onDarkModeToggle
}) => {
  const [showUtility, setShowUtility] = useState(false);
  const [activeMagnifierTab, setActiveMagnifierTab] = useState<'simulation' | 'typography'>('simulation');
  const utilityRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (utilityRef.current && !utilityRef.current.contains(event.target as Node)) {
        setShowUtility(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header className="fixed top-0 left-0 right-0 z-50 glass border-b border-slate-200/50 dark:border-slate-800/50 h-16 transition-all duration-500">
      <div className="w-full px-8 h-full flex items-center justify-between max-w-[1600px] mx-auto">
        <div className="flex flex-col items-start leading-none group cursor-pointer">
          <div className="flex items-center gap-3">
            <motion.div 
              whileHover={{ rotate: 180, scale: 1.1 }}
              className="w-9 h-9 bg-indigo-600 text-white rounded-xl flex items-center justify-center font-black text-xl shadow-[0_0_20px_rgba(79,70,229,0.4)]"
            >
              <ICONS.Brain className="w-5 h-5" />
            </motion.div>
            <span className="font-black text-2xl tracking-tighter text-slate-900 dark:text-white uppercase">
              STRATEGIC<span className="text-indigo-600 drop-shadow-[0_0_10px_rgba(79,70,229,0.3)]">AI</span>
            </span>
          </div>
          <span className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.3em] mt-1.5 ml-1 hidden md:block">
            Neural Sales Intelligence Protocol
          </span>
        </div>

        <div className="flex items-center gap-6">
          {/* Dark Mode Toggle */}
          <button
            onClick={onDarkModeToggle}
            className="relative w-14 h-7 bg-slate-100 dark:bg-slate-800 rounded-full p-1 transition-colors duration-500 focus:outline-none shadow-inner border border-slate-200 dark:border-slate-700"
            title={darkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
          >
            <div className="absolute inset-0 flex items-center justify-between px-2 pointer-events-none">
              <ICONS.Sun className="w-3 h-3 text-amber-500 opacity-40" />
              <ICONS.Moon className="w-3 h-3 text-indigo-400 opacity-40" />
            </div>
            <motion.div
              className="w-5 h-5 bg-white dark:bg-slate-900 rounded-full shadow-lg z-10 relative flex items-center justify-center border border-slate-200/50 dark:border-slate-700/50"
              animate={{ x: darkMode ? 28 : 0 }}
              transition={{ type: "spring", stiffness: 500, damping: 30 }}
            >
              <AnimatePresence mode="wait" initial={false}>
                {darkMode ? (
                  <motion.div
                    key="moon"
                    initial={{ opacity: 0, rotate: -90, scale: 0.5 }}
                    animate={{ opacity: 1, rotate: 0, scale: 1 }}
                    exit={{ opacity: 0, rotate: 90, scale: 0.5 }}
                  >
                    <ICONS.Moon className="w-3 h-3 text-indigo-400" />
                  </motion.div>
                ) : (
                  <motion.div
                    key="sun"
                    initial={{ opacity: 0, rotate: -90, scale: 0.5 }}
                    animate={{ opacity: 1, rotate: 0, scale: 1 }}
                    exit={{ opacity: 0, rotate: 90, scale: 0.5 }}
                  >
                    <ICONS.Sun className="w-3 h-3 text-amber-500" />
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          </button>

          {user && (
            <div className="hidden lg:flex items-center gap-4 bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm px-5 py-2 rounded-2xl border border-slate-200/50 dark:border-slate-700/50 transition-all shadow-sm hover:shadow-md">
              <div className="flex flex-col items-end">
                <span className="text-[8px] font-black uppercase text-indigo-500 dark:text-indigo-400 tracking-widest">Neural Link Active</span>
                <span className="text-[11px] font-black text-slate-700 dark:text-slate-200 truncate max-w-[150px]">{user.email}</span>
              </div>
              <div className="w-px h-6 bg-slate-200 dark:bg-slate-700 mx-1"></div>
              <button 
                onClick={() => logoutUser()}
                className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded-xl transition-all active:scale-90"
                title="Disconnect Neural Link"
              >
                <ICONS.X className="w-4 h-4" />
              </button>
            </div>
          )}

          <div className="relative" ref={utilityRef}>
            <motion.button 
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setShowUtility(!showUtility)}
              className={`w-11 h-11 rounded-2xl flex items-center justify-center transition-all border shadow-sm ${showUtility ? 'bg-indigo-600 border-indigo-700 text-white shadow-indigo-200 dark:shadow-none' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'}`}
              title="Cognitive Magnifier"
            >
              <ICONS.Efficiency className="w-6 h-6" />
            </motion.button>

            <AnimatePresence>
              {showUtility && (
                <motion.div 
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  className="absolute right-0 mt-4 w-80 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[2.5rem] shadow-2xl overflow-hidden z-50"
                >
                  {/* Tab Switcher */}
                  <div className="flex border-b border-slate-100 dark:border-slate-800 p-2 gap-2 bg-slate-50/50 dark:bg-slate-800/50">
                    <button 
                      onClick={() => setActiveMagnifierTab('simulation')}
                      className={`flex-1 py-3 px-3 rounded-2xl text-[9px] font-black uppercase tracking-widest transition-all ${activeMagnifierTab === 'simulation' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}
                    >
                      Simulation Scale
                    </button>
                    <button 
                      onClick={() => setActiveMagnifierTab('typography')}
                      className={`flex-1 py-3 px-3 rounded-2xl text-[9px] font-black uppercase tracking-widest transition-all ${activeMagnifierTab === 'typography' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}
                    >
                      Text Intelligence
                    </button>
                  </div>

                  <div className="p-8 space-y-8">
                    {activeMagnifierTab === 'simulation' ? (
                      <div className="space-y-5">
                        <div className="flex items-center justify-between">
                           <h5 className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-[0.2em]">Viewport Magnifier</h5>
                           <span className="text-sm font-black text-indigo-600 dark:text-indigo-400">{zoom}%</span>
                        </div>
                        <div className="flex items-center gap-3">
                           <button 
                             onClick={() => onZoomChange(Math.max(50, zoom - 10))}
                             className="flex-1 flex items-center justify-center py-3 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-2xl transition-colors border border-slate-100 dark:border-slate-700"
                           >
                             <ICONS.ZoomOut className="w-4 h-4 text-slate-600 dark:text-slate-400" />
                           </button>
                           <button 
                             onClick={() => onZoomChange(100)}
                             className="px-5 py-3 bg-slate-900 dark:bg-white text-[10px] font-black text-white dark:text-slate-900 rounded-2xl shadow-lg"
                           >
                             RESET
                           </button>
                           <button 
                             onClick={() => onZoomChange(Math.min(200, zoom + 10))}
                             className="flex-1 flex items-center justify-center py-3 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-2xl transition-colors border border-slate-100 dark:border-slate-700"
                           >
                             <ICONS.ZoomIn className="w-4 h-4 text-slate-600 dark:text-slate-400" />
                           </button>
                        </div>
                        <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold italic text-center leading-relaxed">Scales the <strong>entire brain simulation</strong> viewport including layout and assets.</p>
                      </div>
                    ) : (
                      <div className="space-y-5">
                        <div className="flex items-center justify-between">
                           <h5 className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-[0.2em]">Text Intelligence Focus</h5>
                           <span className="text-sm font-black text-indigo-600 dark:text-indigo-400">{textZoom}%</span>
                        </div>
                        <div className="flex items-center gap-3">
                           <button 
                             onClick={() => onTextZoomChange(Math.max(80, textZoom - 10))}
                             className="flex-1 flex items-center justify-center py-3 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-2xl transition-colors border border-slate-100 dark:border-slate-700"
                           >
                             <ICONS.ZoomOut className="w-4 h-4 text-slate-600 dark:text-slate-400" />
                           </button>
                           <button 
                             onClick={() => onTextZoomChange(100)}
                             className="px-5 py-3 bg-slate-900 dark:bg-white text-[10px] font-black text-white dark:text-slate-900 rounded-2xl shadow-lg"
                           >
                             RESET
                           </button>
                           <button 
                             onClick={() => onTextZoomChange(Math.min(250, textZoom + 10))}
                             className="flex-1 flex items-center justify-center py-3 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-2xl transition-colors border border-slate-100 dark:border-slate-700"
                           >
                             <ICONS.ZoomIn className="w-4 h-4 text-slate-600 dark:text-slate-400" />
                           </button>
                        </div>
                        <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold italic text-center leading-relaxed">Increases <strong>typography readability</strong> only. UI containers and layout remain static.</p>
                      </div>
                    )}
                  </div>
                  <div className="p-5 bg-slate-50 dark:bg-slate-800/50 text-center border-t border-slate-100 dark:border-slate-800">
                     <p className="text-[9px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-[0.4em]">Neural Interface v3.1</p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </header>
  );
};
