import React from 'react';
import { X, Folder as FolderIcon, Check, Move } from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';

interface MoveDialogProps {
  isOpen: boolean;
  folders: any[];
  onClose: () => void;
  onMove: (folderId: string | null) => void;
  currentFolderId: string | null;
}

export const MoveDialog: React.FC<MoveDialogProps> = ({ isOpen, folders, onClose, onMove, currentFolderId }) => {
  const [selectedId, setSelectedId] = React.useState<string | null>(currentFolderId);

  if (!isOpen) return null;

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
              <Move className="w-5 h-5" />
            </div>
            <h3 className="text-xl font-black text-white uppercase tracking-tight">Relocate Node</h3>
          </div>
          <button onClick={onClose} className="p-3 hover:bg-slate-800 rounded-2xl text-slate-500 hover:text-rose-500 transition-all">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 max-h-[50vh] overflow-y-auto custom-scrollbar">
          <div className="space-y-2">
            <button
              onClick={() => setSelectedId(null)}
              className={cn(
                "w-full flex items-center gap-4 px-5 py-4 text-[11px] font-black uppercase tracking-widest rounded-2xl transition-all border",
                selectedId === null 
                  ? "bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-500/20" 
                  : "bg-slate-800/50 border-slate-700/50 text-slate-400 hover:text-slate-200 hover:bg-slate-800"
              )}
            >
              <FolderIcon className={cn("w-5 h-5", selectedId === null ? "text-white" : "text-slate-500")} />
              <span className="flex-1 text-left">Root Intelligence</span>
              {selectedId === null && <Check className="w-4 h-4" />}
            </button>

            {folders.map((folder) => (
              <button
                key={folder.id}
                onClick={() => setSelectedId(folder.id)}
                className={cn(
                  "w-full flex items-center gap-4 px-5 py-4 text-[11px] font-black uppercase tracking-widest rounded-2xl transition-all border",
                  selectedId === folder.id 
                    ? "bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-500/20" 
                    : "bg-slate-800/50 border-slate-700/50 text-slate-400 hover:text-slate-200 hover:bg-slate-800"
                )}
              >
                <FolderIcon className={cn("w-5 h-5", selectedId === folder.id ? "text-white" : "text-slate-500")} />
                <span className="flex-1 text-left truncate">{folder.name}</span>
                {selectedId === folder.id && <Check className="w-4 h-4" />}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-end gap-4 p-8 bg-slate-900/50 border-t border-slate-800">
          <button 
            onClick={onClose}
            className="px-6 py-3 text-[10px] font-black text-slate-500 uppercase tracking-widest hover:text-white transition-colors"
          >
            Abort
          </button>
          <button 
            onClick={() => onMove(selectedId)}
            className="px-10 py-4 bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-black uppercase tracking-widest rounded-2xl transition-all shadow-xl shadow-indigo-500/20 active:scale-95"
          >
            Confirm Relocation
          </button>
        </div>
      </motion.div>
    </div>
  );
};
