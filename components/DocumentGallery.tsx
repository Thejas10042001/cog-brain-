
import React, { useState } from 'react';
import { StoredDocument } from '../types';
import { ICONS } from '../constants';
import { deleteDocumentFromFirebase, updateDocumentInFirebase } from '../services/firebaseService';

interface DocumentGalleryProps {
  documents: StoredDocument[];
  onRefresh: () => void;
  selectedIds: string[];
  onToggleSelect: (id: string) => void;
  onSynthesize: () => void;
  isAnalyzing: boolean;
}

export const DocumentGallery: React.FC<DocumentGalleryProps> = ({ 
  documents, onRefresh, selectedIds, onToggleSelect, onSynthesize, isAnalyzing 
}) => {
  const [viewingDoc, setViewingDoc] = useState<StoredDocument | null>(null);

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (confirm("Permanently erase this document node?")) {
      await deleteDocumentFromFirebase(id);
      onRefresh();
    }
  };

  return (
    <div className="space-y-8">
      {documents.length === 0 ? (
        <div className="py-20 border-2 border-dashed border-slate-100 rounded-[2.5rem] text-center bg-slate-50/50">
          <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">Cloud Repository Empty</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {documents.map((doc) => {
            const isSelected = selectedIds.includes(doc.id);
            return (
              <div 
                key={doc.id}
                onClick={() => onToggleSelect(doc.id)}
                className={`
                  p-6 rounded-[2rem] border transition-all cursor-pointer group relative flex flex-col h-full
                  ${isSelected 
                    ? 'bg-red-600 border-red-600 shadow-xl shadow-red-200' 
                    : 'bg-white border-slate-100 hover:border-red-200 hover:shadow-lg'}
                `}
              >
                <div className="flex items-start justify-between mb-6">
                  <div className={`p-3 rounded-xl ${isSelected ? 'bg-white/20 text-white' : 'bg-red-50 text-red-600'}`}>
                    <ICONS.Document className="w-5 h-5" />
                  </div>
                  <button 
                    onClick={(e) => handleDelete(e, doc.id)}
                    className={`opacity-0 group-hover:opacity-100 transition-opacity p-2 rounded-lg ${isSelected ? 'text-white/60 hover:text-white' : 'text-slate-300 hover:text-rose-500'}`}
                  >
                    <ICONS.Trash className="w-4 h-4" />
                  </button>
                </div>

                <h5 className={`text-sm font-black leading-tight mb-2 line-clamp-2 ${isSelected ? 'text-white' : 'text-slate-900'}`}>
                  {doc.name}
                </h5>
                <p className={`text-[9px] font-bold uppercase tracking-widest ${isSelected ? 'text-red-100' : 'text-slate-400'}`}>
                  Stored: {new Date(doc.timestamp).toLocaleDateString()}
                </p>

                <div className="mt-auto pt-6 flex items-center justify-between">
                   <div className={`px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest border ${isSelected ? 'bg-white/10 border-white/20 text-white' : 'bg-slate-50 border-slate-100 text-slate-500'}`}>
                     {doc.type.split('/')[1] || 'DOC'}
                   </div>
                   {isSelected && <div className="w-2 h-2 bg-white rounded-full animate-pulse shadow-[0_0_8px_white]" />}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
