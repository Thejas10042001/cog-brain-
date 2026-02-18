import React, { useState, useRef, useEffect } from 'react';
import { ICONS } from '../constants';
import { logoutUser, User } from '../services/firebaseService';

interface HeaderProps {
  user?: User | null;
  zoom: number;
  onZoomChange: (newZoom: number) => void;
  textZoom: number;
  onTextZoomChange: (newZoom: number) => void;
  companyName?: string;
}

export const Header: React.FC<HeaderProps> = ({ user, zoom, onZoomChange, textZoom, onTextZoomChange, companyName }) => {
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
    <header className="fixed top-0 left-0 right-0 z-50 glass-effect border-b border-slate-200 h-16">
      <div className="max-w-7xl mx-auto px-4 h-full flex items-center justify-between">
        <div className="flex flex-col items-start leading-none">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-indigo-600 text-white rounded flex items-center justify-center font-black text-xl shadow-md">
              <ICONS.Trophy className="w-5 h-5" />
            </div>
            <span className="font-black text-xl tracking-tight text-slate-900 uppercase">
              {companyName || "COMPANY HUB"}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {user && (
            <div className="hidden lg:flex items-center gap-4 bg-slate-50 px-4 py-1.5 rounded-full border border-slate-100">
              <div className="flex flex-col items-end">
                <span className="text-[8px] font-black uppercase text-slate-400 tracking-widest">Authenticated Link</span>
                <span className="text-[10px] font-bold text-slate-700 truncate max-w-[120px]">{user.email}</span>
              </div>
              <button 
                onClick={() => logoutUser()}
                className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all"
                title="Disconnect Link"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              </button>
            </div>
          )}

          {/* Cognitive Magnifier Utility Hub */}
          <div className="relative" ref={utilityRef}>
            <button 
              onClick={() => setShowUtility(!showUtility)}
              className={`w-10 h-10 rounded-full flex items-center justify-center transition-all border shadow-sm ${showUtility ? 'bg-indigo-600 border-indigo-700 text-white shadow-indigo-200' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}
              title="View Settings"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </button>

            {showUtility && (
              <div className="absolute right-0 mt-3 w-80 bg-white border border-slate-200 rounded-[2.5rem] shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-4 duration-300">
                {/* Tab Switcher */}
                <div className="flex border-b border-slate-100 p-2 gap-2 bg-slate-50/50">
                  <button 
                    onClick={() => setActiveMagnifierTab('simulation')}
                    className={`flex-1 py-2 px-3 rounded-2xl text-[9px] font-black uppercase tracking-widest transition-all ${activeMagnifierTab === 'simulation' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`}
                  >
                    Display Scale
                  </button>
                  <button 
                    onClick={() => setActiveMagnifierTab('typography')}
                    className={`flex-1 py-2 px-3 rounded-2xl text-[9px] font-black uppercase tracking-widest transition-all ${activeMagnifierTab === 'typography' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`}
                  >
                    Reading Focus
                  </button>
                </div>

                <div className="p-6 space-y-6">
                  {activeMagnifierTab === 'simulation' ? (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                         <h5 className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em]">Full Viewport Scale</h5>
                         <span className="text-xs font-black text-indigo-600">{zoom}%</span>
                      </div>
                      <div className="flex items-center gap-3">
                         <button 
                           onClick={() => onZoomChange(Math.max(50, zoom - 10))}
                           className="flex-1 flex items-center justify-center py-2.5 bg-slate-50 hover:bg-slate-100 rounded-xl transition-colors"
                         >
                           <ICONS.ZoomOut className="w-4 h-4 text-slate-600" />
                         </button>
                         <button 
                           onClick={() => onZoomChange(100)}
                           className="px-4 py-2.5 bg-slate-50 hover:bg-slate-100 text-[10px] font-black text-slate-400 rounded-xl"
                         >
                           RESET
                         </button>
                         <button 
                           onClick={() => onZoomChange(Math.min(200, zoom + 10))}
                           className="flex-1 flex items-center justify-center py-2.5 bg-slate-50 hover:bg-slate-100 rounded-xl transition-colors"
                         >
                           <ICONS.ZoomIn className="w-4 h-4 text-slate-600" />
                         </button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                         <h5 className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em]">Typography Density</h5>
                         <span className="text-xs font-black text-indigo-600">{textZoom}%</span>
                      </div>
                      <div className="flex items-center gap-3">
                         <button 
                           onClick={() => onTextZoomChange(Math.max(80, textZoom - 10))}
                           className="flex-1 flex items-center justify-center py-2.5 bg-slate-50 hover:bg-slate-100 rounded-xl transition-colors"
                         >
                           <ICONS.ZoomOut className="w-4 h-4 text-slate-600" />
                         </button>
                         <button 
                           onClick={() => onTextZoomChange(100)}
                           className="px-4 py-2.5 bg-slate-50 hover:bg-slate-100 text-[10px] font-black text-slate-400 rounded-xl"
                         >
                           RESET
                         </button>
                         <button 
                           onClick={() => onTextZoomChange(Math.min(250, textZoom + 10))}
                           className="flex-1 flex items-center justify-center py-2.5 bg-slate-50 hover:bg-slate-100 rounded-xl transition-colors"
                         >
                           <ICONS.ZoomIn className="w-4 h-4 text-slate-600" />
                         </button>
                      </div>
                    </div>
                  )}
                </div>
                <div className="p-4 bg-slate-50 text-center border-t border-slate-100">
                   <p className="text-[8px] font-black uppercase text-slate-400 tracking-[0.3em]">Platform v3.1 Grounded</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};