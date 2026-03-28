import React, { useState } from 'react';
import { X, FolderPlus } from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';

import { createFolder } from '../services/libraryService';

interface CreateFolderDialogProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  parentId: string | null;
}

export const CreateFolderDialog: React.FC<CreateFolderDialogProps> = ({ isOpen, onClose, userId, parentId }) => {
  const [name, setName] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim() && userId) {
      setIsCreating(true);
      try {
        await createFolder(userId, name.trim(), parentId);
        setName('');
        onClose();
      } catch (err) {
        console.error("Failed to create folder:", err);
      } finally {
        setIsCreating(false);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="bg-slate-900 border border-slate-800 rounded-[2.5rem] shadow-2xl w-full max-w-md overflow-hidden"
      >
        <div className="flex items-center justify-between p-8 border-b border-slate-800">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-indigo-900/30 text-indigo-400 rounded-2xl">
              <FolderPlus className="w-5 h-5" />
            </div>
            <h3 className="text-xl font-black text-white uppercase tracking-tight">New Node Folder</h3>
          </div>
          <button onClick={onClose} className="p-3 hover:bg-slate-800 rounded-2xl text-slate-500 hover:text-rose-500 transition-all">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-6">
          <div className="space-y-3">
            <label htmlFor="folder-name" className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">
              Designation
            </label>
            <input
              id="folder-name"
              type="text"
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Strategic Intelligence"
              className="w-full px-6 py-4 bg-slate-800/50 border border-slate-700/50 rounded-2xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all placeholder:text-slate-600"
            />
          </div>

          <div className="flex items-center justify-end gap-4 pt-4">
            <button 
              type="button"
              onClick={onClose}
              className="px-6 py-3 text-[10px] font-black text-slate-500 uppercase tracking-widest hover:text-white transition-colors"
            >
              Abort
            </button>
            <button 
              type="submit"
              disabled={!name.trim() || isCreating}
              className="px-10 py-4 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-[10px] font-black uppercase tracking-widest rounded-2xl transition-all shadow-xl shadow-indigo-500/20 active:scale-95 flex items-center gap-3"
            >
              {isCreating && <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>}
              Initialize Folder
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};
