import React from 'react';
import { FileText, MoreVertical, Trash2, Move, Download } from 'lucide-react';
import { StoredDocument } from '../../types';
import { cn } from '../lib/utils';

interface FileGridProps {
  documents: StoredDocument[];
  selectedIds: string[];
  onToggleSelect: (id: string) => void;
  onDelete: (docId: string) => void;
  onMove: (doc: StoredDocument) => void;
  onView: (doc: StoredDocument) => void;
}

export const FileGrid: React.FC<FileGridProps> = ({ 
  documents, 
  selectedIds, 
  onToggleSelect, 
  onDelete, 
  onMove,
  onView
}) => {
  if (documents.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-gray-400">
        <FileText className="w-12 h-12 mb-4 opacity-20" />
        <p className="text-sm">No documents found in this folder.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {documents.map((doc) => (
        <div 
          key={doc.id} 
          onClick={() => onView(doc)}
          className={cn(
            "group relative bg-slate-800/50 border border-slate-700/50 rounded-2xl p-5 hover:bg-slate-800 hover:border-indigo-500/50 transition-all duration-300 cursor-pointer shadow-lg hover:shadow-indigo-500/10",
            selectedIds.includes(doc.id) && "ring-2 ring-indigo-500 bg-slate-800 border-indigo-500/50"
          )}
        >
          <div className="flex items-start justify-between mb-5">
            <div className="flex items-center gap-3">
              <div 
                onClick={(e) => { e.stopPropagation(); onToggleSelect(doc.id); }}
                className={cn(
                  "w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all",
                  selectedIds.includes(doc.id) 
                    ? "bg-indigo-600 border-indigo-600" 
                    : "border-slate-600 group-hover:border-slate-500"
                )}
              >
                {selectedIds.includes(doc.id) && <div className="w-2 h-2 bg-white rounded-sm" />}
              </div>
              <div className="p-2.5 bg-indigo-900/30 text-indigo-400 rounded-xl">
                <FileText className="w-5 h-5" />
              </div>
            </div>
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all transform translate-y-1 group-hover:translate-y-0">
              <button 
                onClick={(e) => { e.stopPropagation(); onMove(doc); }}
                className="p-2 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-indigo-400 transition-colors"
                title="Move to Folder"
              >
                <Move className="w-4 h-4" />
              </button>
              <button 
                onClick={(e) => { e.stopPropagation(); onDelete(doc.id); }}
                className="p-2 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-rose-400 transition-colors"
                title="Delete"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
          
          <div className="space-y-1.5">
            <h4 className="text-sm font-black text-white truncate uppercase tracking-tight" title={doc.name}>
              {doc.name}
            </h4>
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
              {new Date(doc.timestamp).toLocaleDateString()}
            </p>
          </div>

          {doc.metadata?.category && (
            <div className="mt-4">
              <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-[9px] font-black bg-slate-900 text-indigo-400 border border-slate-700 uppercase tracking-widest">
                {doc.metadata.category}
              </span>
            </div>
          )}
        </div>
      ))}
    </div>
  );
};
