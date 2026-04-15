import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ICONS } from '../constants';
import { LEGAL_CONTENT } from './LegalContent';

interface LegalModalProps {
  isOpen: boolean;
  type: 'tos' | 'privacy';
  onClose: () => void;
  onAccept?: () => void;
  showAcceptance?: boolean;
}

export const LegalModal: React.FC<LegalModalProps> = ({ 
  isOpen, 
  type, 
  onClose, 
  onAccept,
  showAcceptance = false 
}) => {
  const [hasRead, setHasRead] = useState(false);
  const content = LEGAL_CONTENT[type];

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEsc);
    
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }

    return () => {
      window.removeEventListener('keydown', handleEsc);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 md:p-12">
        {/* Overlay */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-slate-950/80 backdrop-blur-md"
        />

        {/* Modal Container */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          className="relative w-full max-w-4xl h-full max-h-[90vh] bg-slate-900 border border-slate-800 rounded-[3rem] shadow-[0_50px_100px_rgba(0,0,0,0.5)] flex flex-col overflow-hidden"
        >
          {/* Sticky Header */}
          <div className="sticky top-0 z-10 px-8 py-6 bg-slate-900/80 backdrop-blur-xl border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-indigo-500/20 text-indigo-400 rounded-2xl">
                <ICONS.Document className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-2xl font-black text-white uppercase tracking-tight">{content.title}</h2>
                <p className="text-[10px] text-slate-500 font-black uppercase tracking-[0.3em]">SpikedAI Legal Protocol v3.1</p>
              </div>
            </div>
            <button 
              onClick={onClose}
              className="p-3 text-slate-500 hover:text-white hover:bg-slate-800 rounded-2xl transition-all"
            >
              <ICONS.X className="w-6 h-6" />
            </button>
          </div>

          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto p-8 sm:p-12 space-y-12 custom-scrollbar">
            {content.sections.map((section, idx) => (
              <section key={idx} className="space-y-4">
                <h3 className="text-lg font-black text-indigo-400 uppercase tracking-widest">{section.heading}</h3>
                <p className="text-slate-300 leading-relaxed font-medium">
                  {section.content}
                </p>
              </section>
            ))}

            {/* Placeholder for more content to ensure scrollability */}
            <div className="pt-12 border-t border-slate-800">
              <p className="text-[10px] text-slate-500 font-bold italic text-center">
                Last Updated: April 15, 2026 • Neural Integrity Verified
              </p>
            </div>
          </div>

          {/* Sticky Footer (Optional Acceptance Flow) */}
          {showAcceptance && (
            <div className="sticky bottom-0 z-10 px-8 py-8 bg-slate-900/80 backdrop-blur-xl border-t border-slate-800 space-y-6">
              <div className="flex items-center gap-4 px-4">
                <div className="relative flex items-center">
                  <input 
                    type="checkbox" 
                    id="legal-accept"
                    checked={hasRead}
                    onChange={(e) => setHasRead(e.target.checked)}
                    className="w-6 h-6 rounded-lg border-2 border-slate-700 bg-slate-800 text-indigo-500 focus:ring-indigo-500 focus:ring-offset-slate-900 transition-all cursor-pointer appearance-none checked:bg-indigo-500 checked:border-indigo-500"
                  />
                  {hasRead && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-white">
                      <ICONS.Check className="w-4 h-4 stroke-[4]" />
                    </div>
                  )}
                </div>
                <label htmlFor="legal-accept" className="text-sm text-slate-400 font-bold cursor-pointer select-none">
                  I have read and agree to the <span className="text-indigo-400">Terms of Service</span> and <span className="text-indigo-400">Privacy Policy</span>.
                </label>
              </div>

              <button 
                disabled={!hasRead}
                onClick={onAccept}
                className="w-full py-5 bg-white disabled:bg-slate-800 text-slate-900 disabled:text-slate-600 rounded-[2rem] font-black text-sm uppercase tracking-[0.3em] shadow-2xl transition-all hover:bg-slate-100 disabled:cursor-not-allowed"
              >
                Accept Legal Protocol
              </button>
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
