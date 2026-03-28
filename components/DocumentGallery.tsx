import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { auth } from '../src/lib/firebase';
import { ICONS } from '../constants';
import { 
  getFolders, 
  getAllDocuments, 
  initializeDefaultFolders,
  deleteDocument,
  moveDocument,
  deleteFolder
} from '../src/services/libraryService';
import { updateDocumentInFirebase } from '../services/firebaseService';
import { StoredDocument, Folder } from '../types';
import { FolderTree } from '../src/components/FolderTree';
import { FileGrid } from '../src/components/FileGrid';
import { UploadZone } from '../src/components/UploadZone';
import { CreateFolderDialog } from '../src/components/CreateFolderDialog';
import { MoveDialog } from '../src/components/MoveDialog';
import { DeleteConfirmDialog } from '../src/components/DeleteConfirmDialog';

interface DocumentGalleryProps {
  onRefresh: () => void;
  selectedIds: string[];
  onToggleSelect: (id: string) => void;
  onClearSelection: () => void;
  onSynthesize: () => void;
  isAnalyzing: boolean;
  hideSynthesize?: boolean;
}

export const DocumentGallery: React.FC<DocumentGalleryProps> = ({ 
  onRefresh, 
  selectedIds, 
  onToggleSelect,
  onClearSelection,
  onSynthesize,
  isAnalyzing,
  hideSynthesize = false
}) => {
  const [folders, setFolders] = useState<Folder[]>([]);
  const [documents, setDocuments] = useState<StoredDocument[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [isCreateFolderOpen, setIsCreateFolderOpen] = useState(false);
  const [deleteDocId, setDeleteDocId] = useState<string | null>(null);
  const [movingDoc, setMovingDoc] = useState<StoredDocument | null>(null);
  const [viewingDoc, setViewingDoc] = useState<StoredDocument | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const userId = auth.currentUser?.uid;

  useEffect(() => {
    if (!userId) return;

    // Initialize default folders if they don't exist
    initializeDefaultFolders(userId);

    const unsubscribeFolders = getFolders(userId, (updatedFolders) => {
      setFolders(updatedFolders);
      setIsLoading(false);
    });

    const unsubscribeDocs = getAllDocuments(userId, (updatedDocs) => {
      setDocuments(updatedDocs);
    });

    return () => {
      unsubscribeFolders();
      unsubscribeDocs();
    };
  }, [userId]);

  useEffect(() => {
    if (viewingDoc) {
      setEditContent(viewingDoc.content);
    } else {
      setIsEditing(false);
      setEditContent("");
    }
  }, [viewingDoc]);

  const handleDelete = (id: string) => {
    setDeleteDocId(id);
  };

  const confirmDelete = async () => {
    if (deleteDocId && userId) {
      await deleteDocument(userId, deleteDocId);
      onRefresh();
      setDeleteDocId(null);
    }
  };

  const handleMove = async (folderId: string | null) => {
    if (movingDoc && userId) {
      await moveDocument(userId, movingDoc.id, folderId);
      setMovingDoc(null);
      onRefresh();
    }
  };

  const handleSaveEdit = async () => {
    if (!viewingDoc || !userId) return;
    setIsSaving(true);
    try {
      await updateDocumentInFirebase(viewingDoc.id, editContent);
      setIsEditing(false);
      onRefresh();
      const updatedDoc = { ...viewingDoc, content: editContent, updatedAt: Date.now() };
      setViewingDoc(updatedDoc);
    } catch (err) {
      console.error("Failed to save document:", err);
    } finally {
      setIsSaving(false);
    }
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

  // Filter documents based on selected folder
  const filteredDocuments = selectedFolderId 
    ? documents.filter(doc => doc.folderId === selectedFolderId)
    : documents;

  if (isLoading) {
    return (
      <div className="h-[600px] flex items-center justify-center bg-slate-900 rounded-[2.5rem] border border-slate-800">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-500">Initializing Library Hub...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-[700px] bg-slate-900 rounded-[2.5rem] overflow-hidden border border-slate-800 shadow-2xl">
      {/* Left Sidebar: Folder Tree */}
      <div className="w-72 border-r border-slate-800 flex flex-col bg-slate-900/50">
        <div className="p-6 border-b border-slate-800 flex items-center justify-between">
          <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">Folders</h3>
          <button 
            onClick={() => setIsCreateFolderOpen(true)}
            className="p-2 hover:bg-slate-800 rounded-lg text-indigo-400 transition-colors"
            title="Create Folder"
          >
            <ICONS.Plus className="w-4 h-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
          <FolderTree 
            folders={folders}
            documents={documents}
            selectedFolderId={selectedFolderId}
            onSelectFolder={setSelectedFolderId}
            onAddFolder={() => setIsCreateFolderOpen(true)}
          />
        </div>
      </div>

      {/* Main Content: File Grid & Upload */}
      <div className="flex-1 flex flex-col bg-slate-900">
        <div className="p-6 border-b border-slate-800 flex items-center justify-between bg-slate-900/80 backdrop-blur-md sticky top-0 z-10">
          <div className="flex items-center gap-4">
            <h2 className="text-xl font-black text-white uppercase tracking-tight">
              {selectedFolderId ? folders.find(f => f.id === selectedFolderId)?.name : 'All Intelligence Nodes'}
            </h2>
            <span className="text-[10px] font-black bg-slate-800 text-slate-500 px-3 py-1 rounded-full uppercase tracking-widest">
              {filteredDocuments.length} Items
            </span>
          </div>
          
          <div className="flex items-center gap-3">
             {selectedIds.length > 0 && !hideSynthesize && (
                <button 
                  onClick={onSynthesize}
                  disabled={isAnalyzing}
                  className="px-6 py-2.5 bg-indigo-600 text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-indigo-700 shadow-xl shadow-indigo-500/20 transition-all active:scale-95 disabled:opacity-50"
                >
                  {isAnalyzing ? "Analyzing..." : `Synthesize ${selectedIds.length}`}
                </button>
             )}
             <button 
               onClick={onClearSelection}
               className={`p-2.5 rounded-xl transition-all ${selectedIds.length > 0 ? 'bg-rose-900/20 text-rose-400 border border-rose-900/30' : 'text-slate-600 cursor-not-allowed'}`}
               disabled={selectedIds.length === 0}
               title="Clear Selection"
             >
               <ICONS.X className="w-4 h-4" />
             </button>
             <button 
               onClick={onRefresh}
               className="p-2.5 hover:bg-slate-800 rounded-xl transition-colors text-slate-500 border border-slate-800"
               title="Refresh Hub"
             >
               <ICONS.Efficiency className="w-4 h-4" />
             </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
          <div className="space-y-12">
            <UploadZone 
              userId={userId!} 
              folders={folders} 
              onUploadComplete={onRefresh} 
            />

            <FileGrid 
              documents={filteredDocuments}
              selectedIds={selectedIds}
              onToggleSelect={onToggleSelect}
              onDelete={handleDelete}
              onMove={setMovingDoc}
              onView={(doc) => setViewingDoc(doc)}
            />
          </div>
        </div>
      </div>

      {/* Dialogs */}
      <CreateFolderDialog 
        isOpen={isCreateFolderOpen}
        onClose={() => setIsCreateFolderOpen(false)}
        userId={userId!}
        parentId={selectedFolderId}
      />

      {movingDoc && (
        <MoveDialog 
          isOpen={!!movingDoc}
          onClose={() => setMovingDoc(null)}
          folders={folders}
          onMove={handleMove}
          currentFolderId={movingDoc.folderId || null}
        />
      )}

      <DeleteConfirmDialog 
        isOpen={!!deleteDocId}
        onClose={() => setDeleteDocId(null)}
        onConfirm={confirmDelete}
        title="Delete Document"
        message="Are you sure you want to delete this document from the cognitive library? This action cannot be undone."
      />

      {/* Document Viewer Modal */}
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
