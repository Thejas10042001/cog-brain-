import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import Markdown from 'react-markdown';
import { ICONS } from '../constants';

interface LegalModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  content: string;
  onAccept?: () => void;
}

export const LegalModal: React.FC<LegalModalProps> = ({ 
  isOpen, 
  onClose, 
  title, 
  content,
  onAccept 
}) => {
  const [scrollProgress, setScrollProgress] = useState(0);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.body.style.overflow = 'unset';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  const handleScroll = () => {
    if (!scrollContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
    const progress = (scrollTop / (scrollHeight - clientHeight)) * 100;
    setScrollProgress(progress);
    setShowScrollTop(scrollTop > 400);
  };

  const scrollToTop = () => {
    scrollContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 lg:p-8">
          {/* Overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm"
          />

          {/* Modal Container */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="relative w-full max-w-4xl h-[85vh] bg-slate-900 border border-slate-800 rounded-2xl sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden"
          >
            {/* Scroll Progress Bar */}
            <div className="absolute top-0 left-0 right-0 h-1 z-50 bg-slate-800">
              <motion.div 
                className="h-full bg-indigo-500"
                style={{ width: `${scrollProgress}%` }}
              />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between p-6 bg-slate-900/50 backdrop-blur-xl border-b border-slate-800 sticky top-0 z-40">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center">
                  <ICONS.Shield className="w-5 h-5 text-indigo-400" />
                </div>
                <h2 className="text-xl font-black text-white uppercase tracking-tight">{title}</h2>
              </div>
              <button 
                onClick={onClose}
                className="p-2 hover:bg-slate-800 text-slate-500 hover:text-white rounded-xl transition-all"
              >
                <ICONS.X className="w-6 h-6" />
              </button>
            </div>

            {/* Body */}
            <div 
              ref={scrollContainerRef}
              onScroll={handleScroll}
              className="flex-1 overflow-y-auto p-8 sm:p-12 scroll-smooth"
            >
              <div className="max-w-3xl mx-auto prose prose-invert prose-indigo prose-sm sm:prose-base prose-headings:font-black prose-headings:uppercase prose-headings:tracking-tight prose-headings:text-white prose-p:text-slate-400 prose-li:text-slate-400 prose-strong:text-white prose-a:text-indigo-400">
                <Markdown>{content}</Markdown>
              </div>
            </div>

            {/* Footer */}
            <div className="p-6 bg-slate-900 border-t border-slate-800 flex items-center justify-between gap-4">
              <p className="text-[10px] font-medium text-slate-500 uppercase tracking-widest hidden sm:block">
                Please read carefully before proceeding
              </p>
              <div className="flex items-center gap-3 ml-auto w-full sm:w-auto">
                <button 
                  onClick={onClose}
                  className="flex-1 sm:flex-none px-6 py-2.5 rounded-xl border border-slate-800 text-slate-400 font-bold text-sm hover:bg-slate-800 transition-all uppercase tracking-tight"
                >
                  Close
                </button>
                {onAccept && (
                  <button 
                    onClick={() => {
                      onAccept();
                      onClose();
                    }}
                    className="flex-1 sm:flex-none px-8 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm shadow-lg shadow-indigo-600/20 transition-all uppercase tracking-tight"
                  >
                    Accept Neural Protocol
                  </button>
                )}
              </div>
            </div>

            {/* Scroll to Top Button */}
            <AnimatePresence>
              {showScrollTop && (
                <motion.button
                  initial={{ opacity: 0, scale: 0.5 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.5 }}
                  onClick={scrollToTop}
                  className="absolute bottom-24 right-8 p-3 bg-indigo-600 text-white rounded-full shadow-xl hover:bg-indigo-500 transition-all z-50 border border-indigo-400/20"
                >
                  <ICONS.ArrowDown className="w-5 h-5 rotate-180" />
                </motion.button>
              )}
            </AnimatePresence>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
