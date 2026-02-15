
import React from 'react';
import { logoutUser, User } from '../services/firebaseService';
import { ICONS } from '../constants';

interface HeaderProps {
  user?: User | null;
}

export const Header: React.FC<HeaderProps> = ({ user }) => {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-xl border-b border-slate-100">
      <div className="max-w-7xl mx-auto px-8 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-red-600 text-white rounded-[0.8rem] flex items-center justify-center font-black text-xl shadow-lg shadow-red-200">
            !
          </div>
          <div>
            <span className="font-black text-xl tracking-tighter text-slate-900 uppercase">
              Spiked<span className="text-red-600">AI</span>
            </span>
          </div>
        </div>

        <div className="flex items-center gap-6">
          {user && (
            <div className="flex items-center gap-4 group">
              <div className="text-right">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Architect Node</p>
                <p className="text-[11px] font-bold text-slate-900">{user.email}</p>
              </div>
              <div className="h-10 w-10 bg-slate-100 rounded-2xl flex items-center justify-center text-slate-500 group-hover:bg-red-50 group-hover:text-red-600 transition-colors">
                 <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <button 
                onClick={() => logoutUser()}
                className="p-2.5 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all"
                title="Disconnect Neural Link"
              >
                <ICONS.X className="w-5 h-5" />
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
