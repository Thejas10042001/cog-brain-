
import React from 'react';
import { ICONS } from '../constants';
import { logoutUser, User } from '../services/firebaseService';

interface HeaderProps {
  user?: User | null;
}

export const Header: React.FC<HeaderProps> = ({ user }) => {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 glass-effect border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
        <div className="flex flex-col items-start leading-none">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-red-600 text-white rounded flex items-center justify-center font-black text-xl shadow-md">
              !
            </div>
            <span className="font-black text-2xl tracking-tighter text-slate-900">
              SPIKED<span className="text-red-600">AI</span>
            </span>
          </div>
          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1 ml-1 hidden md:block">
            Cognitive Intelligence Brain Simulation
          </span>
        </div>

        <div className="flex items-center gap-4">
          {user && (
            <div className="flex items-center gap-4 bg-slate-50 px-4 py-1.5 rounded-full border border-slate-100">
              <div className="flex flex-col items-end">
                <span className="text-[8px] font-black uppercase text-slate-400 tracking-widest">Active Link</span>
                <span className="text-[10px] font-bold text-slate-700 truncate max-w-[120px]">{user.email}</span>
              </div>
              <button 
                onClick={() => logoutUser()}
                className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all"
                title="Disconnect Neural Link"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              </button>
            </div>
          )}
          <div className="w-8 h-8 bg-slate-200 rounded-full flex items-center justify-center text-slate-600">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
        </div>
      </div>
    </header>
  );
};
