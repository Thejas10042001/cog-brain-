
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { StoredDocument } from '../types';
import { ICONS } from '../constants';
import { deleteDocumentFromFirebase, getFirebasePermissionError, updateDocumentInFirebase } from '../services/firebaseService';

interface DocumentGalleryProps {
  documents: StoredDocument[];
  onRefresh: () => void;
  selectedIds: string[];
  onToggleSelect: (id: string) => void;
  onClearSelection: () => void;
  onSynthesize: () => void;
  isAnalyzing: boolean;
  hideSynthesize?: boolean;
}

export const DocumentGallery: React.FC<DocumentGalleryProps> = ({ 
  documents, 
  onRefresh, 
  selectedIds, 
  onToggleSelect,
  onClearSelection,
  onSynthesize,
  isAnalyzing,
  hideSynthesize = false
}) => {
  const [viewingDoc, setViewingDoc] = useState<StoredDocument | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  
  const hasError = getFirebasePermissionError();

  useEffect(() => {
    if (viewingDoc) {
      setEditContent(viewingDoc.content);
    } else {
      setIsEditing(false);
      setEditContent("");
    }
  }, [viewingDoc]);

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (confirm("Delete this document from the cognitive library?")) {
      const success = await deleteDocumentFromFirebase(id);
      if (success) onRefresh();
    }
  };

  const handleDeleteSelected = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (selectedIds.length === 0) return;
    
    if (confirm(`Are you sure you want to permanently delete the ${selectedIds.length} selected document(s) from cloud memory?`)) {
      setIsDeleting(true);
      try {
        await Promise.all(selectedIds.map(id => deleteDocumentFromFirebase(id)));
        onClearSelection();
        onRefresh();
      } catch (err) {
        console.error("Bulk delete failed:", err);
      } finally {
        setIsDeleting(false);
      }
    }
  };

  const handleSaveEdit = async () => {
    if (!viewingDoc) return;
    setIsSaving(true);
    const success = await updateDocumentInFirebase(viewingDoc.id, editContent);
    if (success) {
      setIsEditing(false);
      onRefresh();
      const updatedDoc = { ...viewingDoc, content: editContent, updatedAt: Date.now() };
      setViewingDoc(updatedDoc);
    }
    setIsSaving(false);
  };

  const formatDate = (ts: number) => {
    return new Date(ts).toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    });
  };

  const formatTime = (ts: number) => {
    return new Date(ts).toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  if (hasError) {
    return (
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="p-8 bg-rose-50 dark:bg-rose-900/10 border-2 border-rose-100 dark:border-rose-900/30 rounded-[2.5rem] space-y-4"
      >
        <div className="flex items-center gap-3 text-rose-600 dark:text-rose-400">
          <ICONS.Shield className="w-6 h-6" />
          <h4 className="font-black uppercase tracking-widest text-xs">Awaiting Rule Update...</h4>
        </div>
        <p className="text-sm text-rose-700 dark:text-rose-300 leading-relaxed">
          The cloud memory is locked. If you've updated your <strong>Firebase Rules</strong>, click the button below to establish the connection.
        </p>
        <div className="bg-slate-50 dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 p-4 rounded-2xl font-mono text-[10px] shadow-inner overflow-x-auto border border-slate-100 dark:border-slate-800">
          <code>{`match /cognitive_documents/{doc=**} { allow read, write: if true; }`}</code>
        </div>
        <button 
          onClick={onRefresh}
          className="flex items-center gap-2 px-8 py-3 bg-indigo-600 text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-indigo-700 shadow-xl shadow-indigo-100 dark:shadow-none transition-all active:scale-95"
        >
          <ICONS.Efficiency className="w-4 h-4 animate-spin" />
          Re-validate Cloud Memory
        </button>
      </motion.div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 dark:text-slate-500">Cognitive Library History</h4>
          <AnimatePresence>
            {selectedIds.length > 0 && (
              <motion.div 
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="flex items-center gap-2 px-3 py-1 bg-indigo-600 text-white rounded-full shadow-lg shadow-indigo-200 dark:shadow-none"
              >
                <span className="text-[9px] font-black uppercase tracking-widest">{selectedIds.length} Selected</span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          <AnimatePresence>
            {selectedIds.length > 0 && !hideSynthesize && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="flex items-center gap-2"
              >
                <button 
                  onClick={handleDeleteSelected}
                  disabled={isDeleting}
                  className="px-5 py-2.5 bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 border border-rose-100 dark:border-rose-800 text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-rose-100 dark:hover:bg-rose-900/40 shadow-sm transition-all active:scale-95 disabled:opacity-50 flex items-center gap-2"
                >
                  {isDeleting ? (
                    <div className="w-3 h-3 border-2 border-rose-600/30 border-t-rose-600 rounded-full animate-spin"></div>
                  ) : (
                    <ICONS.Trash className="w-3 h-3" />
                  )}
                  Delete Selected
                </button>
                <button 
                  onClick={onSynthesize}
                  disabled={isAnalyzing}
                  className="px-5 py-2.5 bg-indigo-600 text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-indigo-700 shadow-xl shadow-indigo-100 dark:shadow-none transition-all active:scale-95 disabled:opacity-50"
                >
                  {isAnalyzing ? "Analyzing..." : `Synthesize ${selectedIds.length} Docs`}
                </button>
              </motion.div>
            )}
          </AnimatePresence>
          
          <div className="flex items-center gap-1 border border-slate-200 dark:border-slate-800 rounded-2xl p-1 bg-slate-50 dark:bg-slate-900">
            <button 
              onClick={() => documents.forEach(d => !selectedIds.includes(d.id) && onToggleSelect(d.id))}
              className="px-3 py-2 text-[8px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-white dark:hover:bg-slate-800 rounded-xl transition-all"
            >
              Select All
            </button>
            <div className="w-px h-3 bg-slate-200 dark:bg-slate-800"></div>
            <button 
              onClick={handleDeleteSelected}
              disabled={selectedIds.length === 0 || isDeleting}
              className={`px-3 py-2 text-[8px] font-black uppercase tracking-widest rounded-xl transition-all ${selectedIds.length > 0 ? 'text-rose-600 dark:text-rose-400 hover:bg-white dark:hover:bg-slate-800' : 'text-slate-300 dark:text-slate-700 cursor-not-allowed'}`}
            >
              {isDeleting ? 'Deleting...' : 'Delete Selected'}
            </button>
            <div className="w-px h-3 bg-slate-200 dark:bg-slate-800"></div>
            <button 
              onClick={onClearSelection}
              className="px-3 py-2 text-[8px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-white dark:hover:bg-slate-800 rounded-xl transition-all"
            >
              Clear
            </button>
          </div>

          <button 
            onClick={onRefresh}
            className="p-2.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors text-slate-400 dark:text-slate-500 border border-slate-100 dark:border-slate-800"
            title="Refresh Library"
          >
            <ICONS.Efficiency className="w-4 h-4" />
          </button>
        </div>
      </div>

      {documents.length === 0 ? (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="py-20 border-2 border-dashed border-slate-100 dark:border-slate-800 rounded-[3rem] text-center bg-slate-50/30 dark:bg-slate-900/30"
        >
          <ICONS.Document className="w-12 h-12 mx-auto text-slate-200 dark:text-slate-800 mb-4" />
          <p className="text-slate-400 dark:text-slate-600 text-xs font-black uppercase tracking-widest">The global cognitive library is currently empty.</p>
        </motion.div>
      ) : (
        <motion.div 
          layout
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5"
        >
          <AnimatePresence mode="popLayout">
            {documents.map((doc) => {
              const isSelected = selectedIds.includes(doc.id);
              return (
                <motion.div 
                  layout
                  key={doc.id}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  whileHover={{ y: -5 }}
                  onClick={() => onToggleSelect(doc.id)}
                  className={`
                    bg-white dark:bg-slate-900 border p-6 rounded-[2.5rem] transition-all cursor-pointer group relative h-full flex flex-col
                    ${isSelected ? 'border-indigo-600 ring-8 ring-indigo-50 dark:ring-indigo-900/20 shadow-2xl scale-[1.02]' : 'border-slate-100 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-indigo-700 shadow-sm'}
                  `}
                >
                  <div className="flex items-start justify-between mb-5">
                    <div className={`p-4 rounded-2xl transition-all ${isSelected ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-200 dark:shadow-none' : 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-500 dark:text-indigo-400 group-hover:bg-indigo-600 group-hover:text-white group-hover:shadow-xl group-hover:shadow-indigo-200 dark:group-hover:shadow-none'}`}>
                      <ICONS.Document className="w-5 h-5" />
                    </div>
                    
                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={(e) => { e.stopPropagation(); setViewingDoc(doc); }}
                        className="p-2.5 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-xl transition-all"
                        title="View & Edit Content"
                      >
                        <ICONS.Search className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={(e) => handleDelete(e, doc.id)}
                        className="p-2.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded-xl transition-all"
                        title="Delete Intelligence Node"
                      >
                        <ICONS.Trash className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  
                  <div className="flex-1 space-y-2">
                    <h5 className="text-base font-black text-slate-800 dark:text-slate-100 pr-6 leading-tight line-clamp-2 uppercase tracking-tight">{doc.name}</h5>
                    <div className="flex items-center gap-3 text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                      <span>{formatDate(doc.timestamp)}</span>
                      <span className="w-1 h-1 bg-slate-200 dark:bg-slate-800 rounded-full"></span>
                      <span>{formatTime(doc.timestamp)}</span>
                    </div>
                  </div>

                  <div className="mt-6 pt-5 border-t border-slate-50 dark:border-slate-800 flex items-center justify-between">
                    {isSelected ? (
                      <span className="text-[8px] font-black uppercase text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 px-3 py-1.5 rounded-xl border border-emerald-100 dark:border-emerald-800 flex items-center gap-2">
                        <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></div>
                        Ready for Strategy
                      </span>
                    ) : (
                      <div className="flex flex-col gap-1">
                         <span className="text-[8px] font-black uppercase text-slate-400 dark:text-slate-500 px-3 py-1 bg-slate-50 dark:bg-slate-800 rounded-lg">Stored In Cloud</span>
                         {doc.updatedAt && doc.updatedAt !== doc.timestamp && (
                           <span className="text-[7px] font-black text-indigo-400 dark:text-indigo-500 px-1">Modified: {formatDate(doc.updatedAt)}</span>
                         )}
                      </div>
                    )}
                    <span className="text-[9px] font-black text-slate-300 dark:text-slate-700 uppercase tracking-widest">{(doc.type.split('/')[1] || 'DOC').toUpperCase()}</span>
                  </div>

                  {/* Selection Indicator */}
                  <div className={`
                    absolute top-6 right-6 w-6 h-6 rounded-full border-2 transition-all flex items-center justify-center
                    ${isSelected ? 'bg-indigo-600 border-indigo-600 scale-110' : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 group-hover:border-indigo-400'}
                  `}>
                    {isSelected && (
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-white" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </motion.div>
      )}

      {/* OCR Result Viewer & Editor Modal */}
      <AnimatePresence>
        {viewingDoc && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-8 bg-slate-900/80 backdrop-blur-md">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white dark:bg-slate-900 w-full max-w-6xl max-h-[90vh] rounded-[3rem] shadow-2xl flex flex-col overflow-hidden"
            >
              <div className="p-8 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/50 backdrop-blur-xl">
                <div className="flex items-center gap-5">
                  <div className="p-4 bg-indigo-600 text-white rounded-[1.5rem] shadow-2xl shadow-indigo-200 dark:shadow-none">
                    <ICONS.Search className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-3xl font-black text-slate-900 dark:text-white tracking-tighter uppercase">
                      {isEditing ? 'Neural Intelligence Editor' : 'Neural Scan Review'}
                    </h3>
                    <div className="flex items-center gap-3 mt-1.5">
                      <p className="text-[10px] text-slate-400 dark:text-slate-500 font-black uppercase tracking-widest">
                        Captured: {formatDate(viewingDoc.timestamp)} at {formatTime(viewingDoc.timestamp)}
                      </p>
                      {viewingDoc.updatedAt && viewingDoc.updatedAt !== viewingDoc.timestamp && (
                        <>
                          <span className="w-1 h-1 bg-slate-200 dark:bg-slate-700 rounded-full"></span>
                          <p className="text-[10px] text-indigo-400 dark:text-indigo-500 font-black uppercase tracking-widest">
                            Updated: {formatDate(viewingDoc.updatedAt)} at {formatTime(viewingDoc.updatedAt)}
                          </p>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  {!isEditing ? (
                    <button 
                      onClick={() => setIsEditing(true)}
                      className="px-8 py-3 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-800 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-all shadow-sm"
                    >
                      Edit Intelligence
                    </button>
                  ) : (
                    <div className="flex items-center gap-3">
                      <button 
                        onClick={() => { setIsEditing(false); setEditContent(viewingDoc.content); }}
                        className="px-5 py-3 text-slate-400 dark:text-slate-500 text-[10px] font-black uppercase tracking-widest hover:text-rose-500 transition-colors"
                      >
                        Cancel
                      </button>
                      <button 
                        onClick={handleSaveEdit}
                        disabled={isSaving}
                        className="px-10 py-3 bg-indigo-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 shadow-xl shadow-indigo-100 dark:shadow-none flex items-center gap-3 disabled:opacity-50"
                      >
                        {isSaving ? (
                          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                        ) : (
                          <ICONS.Shield className="w-4 h-4" />
                        )}
                        Commit Changes
                      </button>
                    </div>
                  )}
                  <button 
                    onClick={() => setViewingDoc(null)}
                    className="p-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-slate-400 hover:text-rose-500 hover:border-rose-100 transition-all shadow-sm"
                  >
                    <ICONS.X />
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-12 custom-scrollbar bg-white dark:bg-slate-900">
                <div className="mb-12 p-8 bg-indigo-50/50 dark:bg-indigo-900/10 border border-indigo-100 dark:border-indigo-800 rounded-[2rem]">
                   <h4 className="text-[11px] font-black uppercase text-indigo-600 dark:text-indigo-400 tracking-[0.3em] mb-4">Cognitive Source Meta</h4>
                   <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
                      <div>
                         <p className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1.5">File Name</p>
                         <p className="text-sm font-black text-slate-800 dark:text-slate-200 line-clamp-1">{viewingDoc.name}</p>
                      </div>
                      <div>
                         <p className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1.5">Database ID</p>
                         <p className="text-sm font-mono text-slate-500 dark:text-slate-400">#{viewingDoc.id.substring(0, 12)}</p>
                      </div>
                      <div>
                         <p className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1.5">Format</p>
                         <p className="text-sm font-black text-slate-800 dark:text-slate-200 uppercase tracking-widest">{(viewingDoc.type.split('/')[1] || 'DOCUMENT').toUpperCase()}</p>
                      </div>
                      <div>
                         <p className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1.5">Memory Integrity</p>
                         <p className="text-sm font-black text-emerald-600 dark:text-emerald-400 flex items-center gap-2 uppercase tracking-widest">
                           <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div> Verified
                         </p>
                      </div>
                   </div>
                </div>

                <div className="space-y-6">
                   <div className="flex items-center justify-between">
                     <h4 className="text-[11px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-[0.3em]">
                       {isEditing ? 'Editing OCR Extracted Payload' : 'Extracted Intelligence Core'}
                     </h4>
                     {isEditing && (
                       <span className="text-[10px] font-black text-indigo-400 animate-pulse uppercase tracking-widest">Manual Override Active</span>
                     )}
                   </div>
                   
                   {isEditing ? (
                     <textarea
                       value={editContent}
                       onChange={(e) => setEditContent(e.target.value)}
                       className="w-full h-[600px] bg-slate-50 dark:bg-slate-800/50 border-2 border-indigo-100 dark:border-indigo-900/30 rounded-[2.5rem] p-12 font-mono text-sm leading-relaxed text-slate-700 dark:text-slate-300 shadow-inner focus:border-indigo-500 outline-none transition-all resize-none"
                       placeholder="Edit document intelligence content here..."
                     />
                   ) : (
                     <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 rounded-[2.5rem] p-12 font-mono text-sm leading-relaxed text-slate-700 dark:text-slate-300 whitespace-pre-wrap shadow-inner min-h-[600px]">
                        {viewingDoc.content || "Neural scan empty or content missing from database index."}
                     </div>
                   )}
                </div>
              </div>

              <div className="p-8 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col sm:flex-row justify-between items-center gap-4">
                <p className="text-[10px] text-slate-400 dark:text-slate-500 font-black uppercase tracking-[0.4em]">
                  Grounded Knowledge Base v3.1 • Cross-Referencing Active
                </p>
                <button 
                  onClick={() => setViewingDoc(null)}
                  className="w-full sm:w-auto px-12 py-4 bg-indigo-600 text-white rounded-2xl font-black text-[11px] uppercase tracking-widest hover:bg-indigo-700 shadow-xl shadow-indigo-100 dark:shadow-none transition-all active:scale-95"
                >
                  Close Review
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
