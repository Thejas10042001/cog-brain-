
import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { StoredDocument, Folder } from '../types';
import { ICONS, PREDEFINED_CATEGORIES } from '../constants';
import { 
  deleteDocumentFromFirebase, 
  getFirebasePermissionError, 
  updateDocumentInFirebase,
  fetchFoldersFromFirebase,
  saveFolderToFirebase,
  deleteFolderFromFirebase,
  moveDocumentToFolder,
  renameFolderInFirebase,
  saveDocumentToFirebase
} from '../services/firebaseService';

interface DocumentGalleryProps {
  documents: StoredDocument[];
  onRefresh: () => void;
  selectedIds: string[];
  onToggleSelect: (id: string) => void;
  onClearSelection: () => void;
  onSynthesize: () => void;
  isAnalyzing: boolean;
  hideSynthesize?: boolean;
  activeFolderId: string;
  onActiveFolderChange: (id: string) => void;
}

export const DocumentGallery: React.FC<DocumentGalleryProps> = ({ 
  documents, 
  onRefresh, 
  selectedIds, 
  onToggleSelect,
  onClearSelection,
  onSynthesize,
  isAnalyzing,
  hideSynthesize = false,
  activeFolderId,
  onActiveFolderChange
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [viewingDoc, setViewingDoc] = useState<StoredDocument | null>(null);
  const [previewDoc, setPreviewDoc] = useState<StoredDocument | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [isAddingFolder, setIsAddingFolder] = useState(false);
  const [showFolderOptions, setShowFolderOptions] = useState(false);
  const [folderType, setFolderType] = useState<'main' | 'sub' | null>(null);
  const [selectedParentId, setSelectedParentId] = useState<string | null>(null);
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({});
  const [newFolderName, setNewFolderName] = useState("");
  const [renamingFolderId, setRenamingFolderId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [movingDocId, setMovingDocId] = useState<string | null>(null);
  const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null);
  const [confirmModal, setConfirmModal] = useState<{
    title: string;
    message: string;
    onConfirm: () => void;
    isLoading?: boolean;
  } | null>(null);
  
  const [showReasoningId, setShowReasoningId] = useState<string | null>(null);
  
  const hasError = getFirebasePermissionError();

  useEffect(() => {
    loadFolders();
    
    const handleGlobalClick = () => setShowReasoningId(null);
    window.addEventListener('click', handleGlobalClick);
    return () => window.removeEventListener('click', handleGlobalClick);
  }, []);

  const loadFolders = async () => {
    const fetchedFolders = await fetchFoldersFromFirebase();
    setFolders(fetchedFolders);
  };

  const handleAddFolder = async () => {
    if (!newFolderName.trim() || !folderType) return;
    
    const folderId = await saveFolderToFirebase(
      newFolderName.trim(), 
      true, 
      folderType, 
      folderType === 'sub' ? selectedParentId : null
    );

    if (folderId) {
      // Automatically select the new folder
      onActiveFolderChange(folderId);
      
      // If it's a main folder, automatically create sub-folders from predefined categories
      if (folderType === 'main') {
        const subCategories = PREDEFINED_CATEGORIES;
        // Skip "All Files" and "Miscellaneous" if they are already handled or redundant
        // Actually, the user asked for them, so we include them.
        await Promise.all(subCategories.map(cat => 
          saveFolderToFirebase(cat, true, 'sub', folderId)
        ));
        
        // Auto-expand the new folder
        setExpandedFolders(prev => ({ ...prev, [folderId]: true }));
      }

      setNewFolderName("");
      setIsAddingFolder(false);
      setShowFolderOptions(false);
      setFolderType(null);
      setSelectedParentId(null);
      loadFolders();
    }
  };

  const toggleFolderExpansion = (e: React.MouseEvent | React.KeyboardEvent, id: string) => {
    e.stopPropagation();
    setExpandedFolders(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const getFolderIcon = (folder: Folder, isActive: boolean) => {
    const iconClass = `w-4 h-4 shrink-0 transition-all ${isActive ? 'text-white' : 'text-slate-500 group-hover:text-indigo-400'}`;
    
    if (folder.id === "Global Library") return <ICONS.Sparkles className={iconClass} />;
    
    const name = folder.name.toLowerCase();
    if (name.includes('sales')) return <ICONS.Growth className={iconClass} />;
    if (name.includes('product')) return <ICONS.Innovation className={iconClass} />;
    if (name.includes('security') || name.includes('legal') || name.includes('compliance')) return <ICONS.Security className={iconClass} />;
    if (name.includes('financial') || name.includes('company')) return <ICONS.ROI className={iconClass} />;
    if (name.includes('procurement') || name.includes('onboarding')) return <ICONS.Check className={iconClass} />;
    if (name.includes('partnership') || name.includes('ecosystem')) return <ICONS.Map className={iconClass} />;
    if (name.includes('event') || name.includes('community')) return <ICONS.Speaker className={iconClass} />;
    if (name.includes('customer')) return <ICONS.User className={iconClass} />;
    if (name.includes('research') || name.includes('leadership')) return <ICONS.Research className={iconClass} />;
    if (name.includes('meeting')) return <ICONS.Calendar className={iconClass} />;
    
    return <ICONS.Folder className={iconClass} />;
  };

  const getSubFolderIcon = (folder: Folder, isActive: boolean) => {
    const iconClass = `w-3 h-3 shrink-0 transition-all ${isActive ? 'text-white' : 'text-slate-600 group-hover:text-indigo-400 opacity-70'}`;
    
    const name = folder.name.toLowerCase();
    if (name.includes('notes') || name.includes('transcript')) return <ICONS.Document className={iconClass} />;
    if (name.includes('deck') || name.includes('presentation')) return <ICONS.Play className={iconClass} />;
    if (name.includes('data') || name.includes('sheet')) return <ICONS.Efficiency className={iconClass} />;
    
    return <ICONS.Folder className={iconClass} />;
  };

  const handleDeleteFolder = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setConfirmModal({
      title: "Delete Folder",
      message: "Are you sure you want to delete this folder? All documents inside will be moved to the Miscellaneous folder.",
      onConfirm: async () => {
        setConfirmModal(prev => prev ? { ...prev, isLoading: true } : null);
        try {
          console.log("Starting folder deletion for ID:", id);
          // 1. Identify all folders to delete (the folder itself + its sub-folders)
          const subFoldersToDelete = folders.filter(f => f.parentId === id);
          const allIdsToDelete = [id, ...subFoldersToDelete.map(sf => sf.id)];

          // 2. Move docs from all these folders to Miscellaneous
          const docsToMove = documents.filter(d => d.folderId && allIdsToDelete.includes(d.folderId));
          console.log(`Moving ${docsToMove.length} documents to Miscellaneous`);
          await Promise.all(docsToMove.map(d => moveDocumentToFolder(d.id, "Miscellaneous")));
          
          // 3. Delete all folders from Firebase
          console.log(`Deleting ${allIdsToDelete.length} folders from Firebase`);
          const results = await Promise.all(allIdsToDelete.map(fid => deleteFolderFromFirebase(fid)));
          
          // Refresh even if some failed, but log it
          const failedCount = results.filter(r => !r).length;
          if (failedCount > 0) {
            console.warn(`${failedCount} folder deletions failed, but refreshing UI anyway.`);
          }

          if (allIdsToDelete.includes(activeFolderId)) {
            onActiveFolderChange("Global Library");
          }
          
          await loadFolders();
          onRefresh();
        } catch (err) {
          console.error("Error deleting folder:", err);
        } finally {
          setConfirmModal(null);
        }
      }
    });
  };

  const handleMoveDoc = async (docId: string, folderId: string) => {
    const success = await moveDocumentToFolder(docId, folderId === "Global Library" ? null : folderId);
    if (success) {
      setMovingDocId(null);
      setDragOverFolderId(null);
      onRefresh();
    }
  };

  const handleRenameFolder = async (id: string) => {
    if (!renameValue.trim()) {
      setRenamingFolderId(null);
      setRenameValue("");
      return;
    }
    const success = await renameFolderInFirebase(id, renameValue.trim());
    if (success) {
      setRenamingFolderId(null);
      setRenameValue("");
      loadFolders();
    }
  };

  const onDragStart = (e: React.DragEvent, docId: string) => {
    e.dataTransfer.setData("docId", docId);
    e.dataTransfer.effectAllowed = "move";
  };

  const onDragOver = (e: React.DragEvent, folderId: string) => {
    e.preventDefault();
    setDragOverFolderId(folderId);
  };

  const onDragLeave = () => {
    setDragOverFolderId(null);
  };

  const onDrop = async (e: React.DragEvent, folderId: string) => {
    e.preventDefault();
    const docId = e.dataTransfer.getData("docId");
    if (docId) {
      await handleMoveDoc(docId, folderId);
    }
    setDragOverFolderId(null);
  };

  const allFolders = useMemo(() => {
    const predefinedMain: Folder[] = [{
      id: "Global Library",
      name: "Global Library",
      isCustom: false,
      userId: 'system',
      type: 'main' as const,
      parentId: null,
      timestamp: 0
    }];

    // Identify all main folders from DB
    const mainFoldersFromDb = folders.filter(f => (f.type === 'main' || !f.type) && (!f.parentId || f.parentId === null));
    const currentMainFolders = [...predefinedMain, ...mainFoldersFromDb];
    
    const virtualSubs: Folder[] = [];
    
    // For EVERY main folder (predefined + custom), ensure it has the predefined categories as sub-folders
    currentMainFolders.forEach(main => {
      PREDEFINED_CATEGORIES.forEach(catName => {
        // Check if this subfolder already exists in Firebase for this main folder
        const exists = folders.some(f => f.parentId === main.id && f.name === catName);
        if (!exists) {
          virtualSubs.push({
            id: `virtual-${main.id}-${catName.replace(/\s+/g, '-')}`,
            name: catName,
            isCustom: false,
            userId: 'system',
            type: 'sub',
            parentId: main.id,
            timestamp: 0
          });
        }
      });
    });

    // Filter out folders from Firebase that are at the top level but have names matching predefined categories
    // These are likely "stray" folders that should be sub-folders or are redundant
    const filteredDbFolders = folders.filter(f => {
      const isPredefinedName = PREDEFINED_CATEGORIES.includes(f.name);
      const isTopLevel = !f.parentId || f.parentId === null;
      
      // 1. Hide predefined names at top level (they should be sub-folders)
      if (isPredefinedName && isTopLevel) return false;
      
      // 2. Hide subfolders that are NOT children of an existing main folder (orphans)
      if (f.parentId && !currentMainFolders.some(m => m.id === f.parentId)) return false;

      // 3. Hide subfolders that have NO parentId but are marked as type 'sub'
      if (f.type === 'sub' && isTopLevel) return false;

      return true;
    });

    // Combine: Predefined Main + Virtual Subs + All valid DB folders (both main and sub)
    return [...predefinedMain, ...virtualSubs, ...filteredDbFolders];
  }, [folders]);

  const subFolders = useMemo(() => {
    const base = allFolders.filter(f => f.type === 'sub' || (f.parentId !== null && f.parentId !== undefined));
    if (!searchQuery.trim()) return base;
    const query = searchQuery.toLowerCase().trim();
    return base.filter(f => f.name.toLowerCase().includes(query));
  }, [allFolders, searchQuery]);

  const mainFolders = useMemo(() => {
    const base = allFolders.filter(f => (f.type === 'main' || !f.type) && !f.parentId);
    if (!searchQuery.trim()) return base;
    const query = searchQuery.toLowerCase().trim();
    
    // Include main folders that match OR have a subfolder that matches
    return base.filter(f => {
      const matches = f.name.toLowerCase().includes(query);
      const hasMatchingSub = subFolders.some(sf => sf.parentId === f.id);
      return matches || hasMatchingSub;
    });
  }, [allFolders, searchQuery, subFolders]);

  useEffect(() => {
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      const newExpanded: Record<string, boolean> = { ...expandedFolders };
      mainFolders.forEach(f => {
        const hasMatchingSub = subFolders.some(sf => sf.parentId === f.id);
        if (hasMatchingSub) {
          newExpanded[f.id] = true;
        }
      });
      setExpandedFolders(newExpanded);
    }
  }, [searchQuery, mainFolders, subFolders]);

  const filteredDocuments = useMemo(() => {
    try {
      let baseDocs = documents;

      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        return documents.filter(doc => 
          doc.name.toLowerCase().includes(query) || 
          doc.content.toLowerCase().includes(query) ||
          (doc.category && doc.category.toLowerCase().includes(query))
        );
      }

      if (!activeFolderId || activeFolderId === "Global Library") {
        return baseDocs;
      }

      const activeFolder = allFolders.find(f => f.id === activeFolderId);
      if (!activeFolder) return documents;

      return documents.filter(doc => {
        // If it's a sub-folder, check for exact ID match or name match if it's a predefined/virtual one
        if (activeFolder.type === 'sub') {
          // Special case for "All Files" sub-folder: show everything in the parent
          if (activeFolder.name === "All Files") {
            const parent = allFolders.find(f => f.id === activeFolder.parentId);
            if (parent) {
              if (parent.id === "Global Library") return true;
              const subIds = allFolders.filter(sf => sf.parentId === parent.id).map(sf => sf.id);
              return doc.folderId === parent.id || (doc.folderId && subIds.includes(doc.folderId));
            }
          }

          if (activeFolder.id.startsWith('global-') || activeFolder.id.startsWith('virtual-')) {
            // Match by folderId OR by category if it's in the same parent scope
            const isInParent = !doc.folderId || doc.folderId === activeFolder.parentId;
            return doc.folderId === activeFolder.id || (isInParent && doc.category === activeFolder.name) || doc.category === activeFolder.name;
          }
          return doc.folderId === activeFolder.id;
        }

        // If it's a main folder, show its own docs and docs in its subfolders
        if (activeFolder.name === "Miscellaneous") {
          return !doc.folderId || doc.folderId === "Miscellaneous" || doc.folderId.endsWith("Miscellaneous");
        }

        const subIds = allFolders.filter(sf => sf.parentId === activeFolder.id).map(sf => sf.id);
        return doc.folderId === activeFolder.id || (doc.folderId && subIds.includes(doc.folderId));
      });
    } catch (err) {
      console.error("Error filtering documents:", err);
      return documents;
    }
  }, [documents, activeFolderId, allFolders]);

  const folderCounts = useMemo(() => {
    const baseDocs = searchQuery.trim() 
      ? documents.filter(doc => {
          const query = searchQuery.toLowerCase().trim();
          return doc.name.toLowerCase().includes(query) || 
                 doc.content.toLowerCase().includes(query) ||
                 (doc.category && doc.category.toLowerCase().includes(query));
        })
      : documents;

    const counts: Record<string, number> = { "Global Library": baseDocs.length };
    
    allFolders.forEach(f => {
      if (f.id === "Global Library") return;
      
      if (f.type === 'sub') {
        if (f.id.startsWith('global-') || f.id.startsWith('virtual-')) {
          counts[f.id] = baseDocs.filter(d => d.folderId === f.id || d.category === f.name).length;
        } else {
          counts[f.id] = baseDocs.filter(d => d.folderId === f.id).length;
        }
      } else {
        // Main folder: count documents directly in it + documents in its subfolders
        const subIds = allFolders.filter(sf => sf.parentId === f.id).map(sf => sf.id);
        counts[f.id] = baseDocs.filter(d => d.folderId === f.id || (d.folderId && subIds.includes(d.folderId))).length;
      }
    });
    
    return counts;
  }, [documents, allFolders, searchQuery]);

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
    setConfirmModal({
      title: "Delete Document",
      message: "Are you sure you want to delete this intelligence node from the cognitive library?",
      onConfirm: async () => {
        setConfirmModal(prev => prev ? { ...prev, isLoading: true } : null);
        try {
          const success = await deleteDocumentFromFirebase(id);
          if (success) {
            if (previewDoc?.id === id) setPreviewDoc(null);
            onRefresh();
          }
        } finally {
          setConfirmModal(null);
        }
      }
    });
  };

  const handleDeleteSelected = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (selectedIds.length === 0) return;
    
    setConfirmModal({
      title: "Bulk Delete",
      message: `Are you sure you want to permanently delete the ${selectedIds.length} selected document(s) from cloud memory?`,
      onConfirm: async () => {
        setConfirmModal(prev => prev ? { ...prev, isLoading: true } : null);
        setIsDeleting(true);
        try {
          await Promise.all(selectedIds.map(id => deleteDocumentFromFirebase(id)));
          if (previewDoc && selectedIds.includes(previewDoc.id)) setPreviewDoc(null);
          onClearSelection();
          onRefresh();
        } catch (err) {
          console.error("Bulk delete failed:", err);
        } finally {
          setIsDeleting(false);
          setConfirmModal(null);
        }
      }
    });
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
      if (previewDoc?.id === viewingDoc.id) {
        setPreviewDoc(updatedDoc);
      }
    }
    setIsSaving(false);
  };

  const handleDuplicateDocument = async (e: React.MouseEvent, doc: StoredDocument) => {
    e.stopPropagation();
    setIsSaving(true);
    try {
      const newName = `${doc.name} (Copy)`;
      const newId = await saveDocumentToFirebase(
        newName,
        doc.content,
        doc.type,
        doc.folderId || undefined,
        doc.category || undefined,
        doc.categorizationReasoning || undefined
      );
      if (newId) {
        onRefresh();
      }
    } catch (err) {
      console.error("Duplication failed:", err);
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
        <div className="bg-slate-900 text-indigo-400 p-4 rounded-2xl font-mono text-[10px] shadow-inner overflow-x-auto border border-slate-800">
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
    <div className="flex flex-col lg:flex-row gap-8">
      {/* Folder Sidebar */}
      <div className="w-full lg:w-72 shrink-0 space-y-6">
        <div className="bg-slate-900 border border-slate-800 rounded-[2.5rem] p-6 shadow-xl">
          <div className="flex items-center justify-between mb-6 px-2">
            <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">Knowledge Hub</h4>
            <div className="relative">
              <button 
                onClick={() => setShowFolderOptions(!showFolderOptions)}
                className="p-2 hover:bg-slate-800 rounded-xl text-indigo-400 transition-colors"
                title="Folder Options"
              >
                <ICONS.Plus className="w-4 h-4" />
              </button>

              <AnimatePresence>
                {showFolderOptions && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 10 }}
                    className="absolute right-0 top-full mt-2 w-48 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl z-50 overflow-hidden"
                  >
                    <button
                      onClick={() => {
                        setFolderType('main');
                        setIsAddingFolder(true);
                        setShowFolderOptions(false);
                      }}
                      className="w-full px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-slate-400 hover:bg-slate-800 hover:text-white transition-colors border-b border-slate-800"
                    >
                      Create Main Folder
                    </button>
                    <button
                      onClick={() => {
                        setFolderType('sub');
                        setIsAddingFolder(true);
                        setShowFolderOptions(false);
                      }}
                      className="w-full px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
                    >
                      Create Sub-folder
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          <div className="space-y-1">
            {mainFolders.map((folder) => {
              const isActive = activeFolderId === folder.id;
              const isExpanded = expandedFolders[folder.id];
              const isDragOver = dragOverFolderId === folder.id;
              const isRenaming = renamingFolderId === folder.id;
              const count = folderCounts[folder.id] || 0;
              const children = subFolders.filter(sf => sf.parentId === folder.id);
              
              return (
                <div key={folder.id} className="space-y-1">
                  <div 
                    className="group relative flex items-center gap-1"
                    onDragOver={(e) => onDragOver(e, folder.id)}
                    onDragLeave={onDragLeave}
                    onDrop={(e) => onDrop(e, folder.id)}
                  >
                    <button 
                      onClick={(e) => toggleFolderExpansion(e, folder.id)}
                      className={`p-2 hover:bg-slate-800 rounded-xl text-slate-500 transition-all ${children.length === 0 ? 'opacity-0 cursor-default' : ''} ${isExpanded ? 'rotate-0' : '-rotate-90'}`}
                    >
                      <ICONS.ChevronDown className="w-3 h-3" />
                    </button>
                    
                    <div
                      onClick={() => {
                        onActiveFolderChange(folder.id);
                        if (children.length > 0 && !isExpanded) {
                          setExpandedFolders(prev => ({ ...prev, [folder.id]: true }));
                        }
                      }}
                      className={`
                        flex-1 flex items-center justify-between px-4 py-3 rounded-2xl text-left transition-all cursor-pointer
                        ${isActive 
                          ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/20' 
                          : isDragOver
                            ? 'bg-indigo-900/40 border border-indigo-500/50 text-indigo-200'
                            : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'}
                      `}
                    >
                      <div className="flex items-center gap-3 w-full">
                        {getFolderIcon(folder, isActive)}
                        {isRenaming ? (
                          <input
                            autoFocus
                            type="text"
                            value={renameValue}
                            onChange={(e) => setRenameValue(e.target.value)}
                            onBlur={() => handleRenameFolder(folder.id)}
                            onKeyDown={(e) => e.key === 'Enter' && handleRenameFolder(folder.id)}
                            onClick={(e) => e.stopPropagation()}
                            className="bg-slate-800 border border-indigo-500 rounded px-2 py-0.5 text-[11px] font-black uppercase tracking-wider text-white outline-none w-full"
                          />
                        ) : (
                          <span className="text-[11px] font-black uppercase tracking-wider truncate max-w-[140px]">
                            {folder.name}
                          </span>
                        )}
                      </div>
                      {!isRenaming && (
                        <div className={`flex items-center justify-center min-w-[24px] h-6 px-2 rounded-full text-[9px] font-black tracking-tighter transition-all ${isActive ? 'bg-white/20 text-white' : 'bg-slate-800 text-slate-500 group-hover:bg-indigo-900/40 group-hover:text-indigo-400'}`}>
                          {count}
                        </div>
                      )}
                    </div>
                    
                    {folder.isCustom && !isRenaming && (
                      <div className="absolute right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setRenamingFolderId(folder.id);
                            setRenameValue(folder.name);
                          }}
                          className="p-2 text-slate-500 hover:text-indigo-400 transition-all"
                          title="Rename Folder"
                        >
                          <ICONS.Edit className="w-3 h-3" />
                        </button>
                        <button
                          onClick={(e) => handleDeleteFolder(e, folder.id)}
                          className="p-2 text-slate-500 hover:text-rose-400 transition-all"
                          title="Delete Folder"
                        >
                          <ICONS.Trash className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Render Sub-folders */}
                  {children.length > 0 && isExpanded && (
                    <div className="ml-8 pl-2 border-l border-slate-800 space-y-1">
                      {children.map(sub => {
                        const isSubActive = activeFolderId === sub.id;
                        const isSubDragOver = dragOverFolderId === sub.id;
                        const isSubRenaming = renamingFolderId === sub.id;
                        const subCount = folderCounts[sub.id] || 0;
                        return (
                          <div 
                            key={sub.id} 
                            className="group relative flex items-center"
                            onDragOver={(e) => onDragOver(e, sub.id)}
                            onDragLeave={onDragLeave}
                            onDrop={(e) => onDrop(e, sub.id)}
                          >
                            <div
                              onClick={() => onActiveFolderChange(sub.id)}
                              className={`
                                flex-1 flex items-center justify-between px-3 py-2 rounded-xl text-left transition-all cursor-pointer
                                ${isSubActive 
                                  ? 'bg-slate-700 text-white' 
                                  : isSubDragOver
                                    ? 'bg-indigo-900/40 border border-indigo-500/50 text-indigo-200'
                                    : 'text-slate-500 hover:bg-slate-800 hover:text-slate-300'}
                              `}
                            >
                              <div className="flex items-center gap-2 w-full">
                                {getSubFolderIcon(sub, isSubActive)}
                                {isSubRenaming ? (
                                  <input
                                    autoFocus
                                    type="text"
                                    value={renameValue}
                                    onChange={(e) => setRenameValue(e.target.value)}
                                    onBlur={() => handleRenameFolder(sub.id)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleRenameFolder(sub.id)}
                                    onClick={(e) => e.stopPropagation()}
                                    className="bg-slate-800 border border-indigo-500 rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white outline-none w-full"
                                  />
                                ) : (
                                  <span className="text-[10px] font-bold uppercase tracking-wider truncate max-w-[120px]">
                                    {sub.name}
                                  </span>
                                )}
                              </div>
                                {!isSubRenaming && (
                                  <span className={`text-[8px] font-black transition-all ${isSubActive ? 'text-white/70' : 'text-slate-600 group-hover:text-indigo-400'}`}>
                                    {subCount}
                                  </span>
                                )}
                            </div>
                            {sub.isCustom && !isSubRenaming && (
                              <div className="absolute right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setRenamingFolderId(sub.id);
                                    setRenameValue(sub.name);
                                  }}
                                  className="p-1.5 text-slate-600 hover:text-indigo-400 transition-all"
                                  title="Rename Sub-folder"
                                >
                                  <ICONS.Edit className="w-2.5 h-2.5" />
                                </button>
                                <button
                                  onClick={(e) => handleDeleteFolder(e, sub.id)}
                                  className="p-1.5 text-slate-600 hover:text-rose-400 transition-all"
                                  title="Delete Sub-folder"
                                >
                                  <ICONS.Trash className="w-2.5 h-2.5" />
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <AnimatePresence>
            {isAddingFolder && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="mt-4 p-4 bg-slate-800/50 rounded-2xl border border-slate-700 space-y-3"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[8px] font-black uppercase tracking-widest text-indigo-400">
                    {folderType === 'main' ? 'New Main Folder' : 'New Sub-folder'}
                  </span>
                </div>

                {folderType === 'sub' && (
                  <select
                    value={selectedParentId || ""}
                    onChange={(e) => setSelectedParentId(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-[9px] font-black uppercase tracking-widest text-white outline-none focus:border-indigo-500"
                  >
                    <option value="" disabled>Select Parent Folder</option>
                    {mainFolders.map(f => (
                      <option key={f.id} value={f.id}>{f.name}</option>
                    ))}
                  </select>
                )}

                <input 
                  autoFocus
                  type="text"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddFolder()}
                  placeholder="Folder Name..."
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-[10px] font-black uppercase tracking-widest text-white outline-none focus:border-indigo-500"
                />
                <div className="flex items-center gap-2">
                  <button 
                    onClick={handleAddFolder}
                    disabled={folderType === 'sub' && !selectedParentId}
                    className="flex-1 py-2 bg-indigo-600 text-white text-[9px] font-black uppercase tracking-widest rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Create
                  </button>
                  <button 
                    onClick={() => {
                      setIsAddingFolder(false);
                      setFolderType(null);
                      setSelectedParentId(null);
                    }}
                    className="px-3 py-2 text-slate-400 hover:text-white text-[9px] font-black uppercase tracking-widest"
                  >
                    Cancel
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="bg-indigo-900/10 border border-indigo-900/20 rounded-[2.5rem] p-6">
          <div className="flex items-center gap-3 mb-4">
            <ICONS.Efficiency className="w-4 h-4 text-indigo-400" />
            <h5 className="text-[10px] font-black uppercase tracking-widest text-indigo-300">Auto-Categorization</h5>
          </div>
          <p className="text-[10px] text-indigo-400/60 leading-relaxed font-medium">
            Our Neural Engine automatically sorts your uploads based on content intelligence.
          </p>
        </div>
      </div>

      {/* Main Gallery Area */}
      <div className="flex-1 space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex flex-col">
              <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 dark:text-slate-500">
                {searchQuery.trim() 
                  ? `Search Results for "${searchQuery}"`
                  : activeFolderId === "Global Library" 
                    ? "Global Library" 
                    : `Folder: ${allFolders.find(f => f.id === activeFolderId)?.name || activeFolderId}`}
              </h4>
              <p className="text-[9px] font-black text-indigo-500 uppercase tracking-widest mt-1">
                {filteredDocuments.length} Intelligence Nodes
              </p>
            </div>
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
            <div className="relative group">
              <ICONS.Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500 group-focus-within:text-indigo-400 transition-colors" />
              <input 
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search name or content..."
                className="bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-[10px] font-black uppercase tracking-widest text-white outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 w-48 lg:w-64 transition-all"
              />
              {searchQuery && (
                <button 
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-500 hover:text-white transition-colors"
                >
                  <ICONS.X className="w-3 h-3" />
                </button>
              )}
            </div>
            <button 
              onClick={onRefresh}
              className="p-2.5 hover:bg-slate-800 rounded-xl transition-colors text-slate-500 border border-slate-800"
              title="Refresh Library"
            >
              <ICONS.Efficiency className="w-4 h-4" />
            </button>
          </div>
        </div>

          <div className="flex gap-6 items-start">
            <div className="flex-1">
              {filteredDocuments.length === 0 ? (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="py-20 border-2 border-dashed border-slate-800 rounded-[3rem] text-center bg-slate-900/30"
                >
                  <ICONS.Document className="w-12 h-12 mx-auto text-slate-800 mb-4" />
                  <p className="text-slate-600 text-xs font-black uppercase tracking-widest">No intelligence nodes found in this folder.</p>
                </motion.div>
              ) : (
                <motion.div 
                  layout
                  className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5"
                >
                  <AnimatePresence mode="popLayout">
                    {filteredDocuments.map((doc) => {
                      const isSelected = selectedIds.includes(doc.id);
                      const isMoving = movingDocId === doc.id;
                      const isPreviewing = previewDoc?.id === doc.id;
                      
                      return (
                        <motion.div 
                          layout
                          key={doc.id}
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.9 }}
                          whileHover={{ y: -5 }}
                          draggable
                          onDragStart={(e: any) => onDragStart(e, doc.id)}
                          onClick={() => {
                            onToggleSelect(doc.id);
                            setPreviewDoc(doc);
                          }}
                          className={`
                            bg-slate-900 border p-6 rounded-[2.5rem] transition-all cursor-pointer group relative h-full flex flex-col
                            ${isSelected ? 'border-indigo-600 ring-8 ring-indigo-900/20 shadow-2xl scale-[1.02]' : 'border-slate-800 hover:border-indigo-700 shadow-sm'}
                            ${isPreviewing ? 'border-indigo-400 bg-slate-800/50' : ''}
                          `}
                        >
                    <div className="flex items-start justify-between mb-5 gap-2">
                      <div className={`p-4 rounded-2xl transition-all ${isSelected ? 'bg-indigo-600 text-white shadow-xl shadow-none' : 'bg-indigo-900/30 text-indigo-400 group-hover:bg-indigo-600 group-hover:text-white group-hover:shadow-xl group-hover:shadow-none'}`}>
                        <ICONS.Document className="w-5 h-5" />
                      </div>
                      
                      <div className="flex items-center gap-1.5 transition-opacity flex-wrap justify-end">
                        <div className="relative">
                          <button 
                            onClick={(e) => { e.stopPropagation(); setMovingDocId(isMoving ? null : doc.id); }}
                            className={`p-2.5 rounded-xl transition-all ${isMoving ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-indigo-400 hover:bg-indigo-900/30'}`}
                            title="Move to Folder"
                          >
                            <ICONS.Folder className="w-4 h-4" />
                          </button>
                          
                          <AnimatePresence>
                            {isMoving && (
                              <motion.div 
                                initial={{ opacity: 0, scale: 0.9, y: 10 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.9, y: 10 }}
                                className="absolute right-0 top-full mt-2 w-56 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl z-50 p-2 overflow-hidden"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <div className="max-h-60 overflow-y-auto custom-scrollbar">
                                  {allFolders.map(f => (
                                    <button
                                      key={f.id}
                                      onClick={() => handleMoveDoc(doc.id, f.id)}
                                      className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-slate-800 rounded-xl text-left transition-colors"
                                    >
                                      <ICONS.Folder className="w-3 h-3 text-slate-500" />
                                      <span className="text-[10px] font-black uppercase tracking-widest text-slate-300">{f.name}</span>
                                    </button>
                                  ))}
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>

                        <button 
                          onClick={(e) => { e.stopPropagation(); setViewingDoc(doc); }}
                          className="p-2.5 text-slate-400 hover:text-indigo-400 hover:bg-indigo-900/30 rounded-xl transition-all"
                          title="View & Edit Content"
                        >
                          <ICONS.Search className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={(e) => handleDuplicateDocument(e, doc)}
                          disabled={isSaving}
                          className="p-2.5 text-slate-400 hover:text-indigo-400 hover:bg-indigo-900/30 rounded-xl transition-all disabled:opacity-50"
                          title="Duplicate Intelligence Node"
                        >
                          <ICONS.Copy className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={(e) => handleDelete(e, doc.id)}
                          className="p-2.5 text-slate-400 hover:text-rose-400 hover:bg-rose-900/30 rounded-xl transition-all"
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

                    <div className="mt-6 pt-5 border-t border-slate-800 flex items-center justify-between relative">
                      <div className="flex flex-col gap-1">
                         <div className="flex items-center gap-2">
                           <span className="text-[8px] font-black uppercase text-slate-500 px-3 py-1 bg-slate-800 rounded-lg flex items-center gap-2">
                             <ICONS.Folder className="w-2 h-2" />
                             {allFolders.find(f => f.id === doc.folderId)?.name || doc.category || "Miscellaneous"}
                           </span>
                           {doc.categorizationReasoning && (
                             <button 
                               onClick={(e) => { e.stopPropagation(); setShowReasoningId(showReasoningId === doc.id ? null : doc.id); }}
                               className="p-1 text-indigo-400 hover:text-indigo-300 transition-colors"
                               title="View AI Categorization Reasoning"
                             >
                               <ICONS.Help className="w-3 h-3" />
                             </button>
                           )}
                         </div>
                         {doc.updatedAt && doc.updatedAt !== doc.timestamp && (
                           <span className="text-[7px] font-black text-indigo-500 px-1">Modified: {formatDate(doc.updatedAt)}</span>
                         )}
                      </div>
                      <span className="text-[9px] font-black text-slate-700 uppercase tracking-widest truncate max-w-[80px] text-right shrink-0" title={(doc.type.split('/')[1] || 'DOC').toUpperCase()}>
                        {(doc.type.split('/')[1] || 'DOC').toUpperCase()}
                      </span>

                      <AnimatePresence>
                        {showReasoningId === doc.id && doc.categorizationReasoning && (
                          <motion.div 
                            initial={{ opacity: 0, scale: 0.9, y: 10 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9, y: 10 }}
                            className="absolute bottom-full left-0 mb-2 w-64 bg-slate-800 border border-indigo-500/30 p-4 rounded-2xl shadow-2xl z-[60] backdrop-blur-xl"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div className="flex items-center gap-2 mb-2">
                              <ICONS.Brain className="w-3 h-3 text-indigo-400" />
                              <span className="text-[9px] font-black uppercase tracking-widest text-indigo-300">AI Reasoning</span>
                            </div>
                            <p className="text-[10px] text-slate-300 leading-relaxed font-medium italic">
                              "{doc.categorizationReasoning}"
                            </p>
                            <div className="absolute -bottom-2 left-4 w-4 h-4 bg-slate-800 border-r border-b border-indigo-500/30 rotate-45"></div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>

                    {/* Selection Indicator */}
                    <div className={`
                      absolute top-4 left-4 w-6 h-6 rounded-full border-2 transition-all flex items-center justify-center z-[20]
                      ${isSelected ? 'bg-indigo-600 border-indigo-600 scale-110' : 'border-slate-800 bg-slate-900 group-hover:border-indigo-400'}
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
            </div>

            {/* Preview Pane - Modal Transformation */}
            <AnimatePresence>
              {previewDoc && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 z-[150] flex items-center justify-center p-4 md:p-12 bg-slate-950/90 backdrop-blur-2xl"
                  onClick={() => setPreviewDoc(null)}
                >
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 20 }}
                    onClick={(e) => e.stopPropagation()}
                    className="bg-slate-900 border border-slate-800 w-full max-w-6xl h-[90vh] rounded-[3rem] shadow-[0_32px_128px_-16px_rgba(0,0,0,0.5)] overflow-hidden flex flex-col"
                  >
                    {/* Header */}
                    <div className="p-8 border-b border-slate-800/50 flex items-center justify-between bg-slate-800/30">
                      <div className="flex items-center gap-5">
                        <div className="p-4 bg-indigo-600 text-white rounded-2xl shadow-xl shadow-indigo-900/40">
                          <ICONS.Document className="w-6 h-6" />
                        </div>
                        <div>
                          <h4 className="text-[10px] font-black uppercase tracking-[0.4em] text-indigo-400 mb-1">Intelligence Preview</h4>
                          <h3 className="text-2xl font-black text-white uppercase tracking-tighter leading-tight max-w-2xl truncate">
                            {previewDoc.name}
                          </h3>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <button 
                          onClick={() => setViewingDoc(previewDoc)}
                          className="px-6 py-3 bg-slate-800 text-slate-300 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-700 hover:text-white transition-all border border-slate-700 flex items-center gap-2"
                        >
                          <ICONS.Edit className="w-3.5 h-3.5" /> Full Editor
                        </button>
                        <button 
                          onClick={() => setPreviewDoc(null)}
                          className="p-4 bg-slate-800/50 hover:bg-rose-500/20 text-slate-400 hover:text-rose-500 rounded-2xl transition-all border border-slate-700/50"
                        >
                          <ICONS.X className="w-6 h-6" />
                        </button>
                      </div>
                    </div>

                    {/* Content Section */}
                    <div className="flex-1 overflow-hidden flex flex-col lg:flex-row">
                      {/* Meta & Summary Sidebar */}
                      <div className="w-full lg:w-96 border-r border-slate-800/50 bg-slate-950/30 p-8 space-y-10 overflow-y-auto custom-scrollbar">
                        <div className="space-y-4">
                          <div className="flex items-center gap-2 text-indigo-400">
                            <ICONS.Brain className="w-4 h-4" />
                            <span className="text-[10px] font-black uppercase tracking-widest">Neural Reasoning</span>
                          </div>
                          <div className="p-6 bg-indigo-950/20 border border-indigo-500/10 rounded-[2rem] relative group">
                            <div className="absolute -top-2 -left-2 w-4 h-4 border-t-2 border-l-2 border-indigo-500/30 rounded-tl-lg"></div>
                            <div className="absolute -bottom-2 -right-2 w-4 h-4 border-b-2 border-r-2 border-indigo-500/30 rounded-br-lg"></div>
                            <p className="text-xs text-indigo-200/80 leading-relaxed font-medium italic">
                              "{previewDoc.categorizationReasoning || "No reasoning available for this node."}"
                            </p>
                          </div>
                        </div>

                        <div className="space-y-6 pt-10 border-t border-slate-800/50">
                           <h5 className="text-[10px] font-black uppercase tracking-widest text-slate-500">Metadata Scan</h5>
                           <div className="space-y-4">
                              <div className="flex justify-between items-center text-[10px]">
                                <span className="text-slate-500 font-black uppercase tracking-widest">Format</span>
                                <span className="text-white font-black uppercase tracking-widest">{(previewDoc.type.split('/')[1] || 'DOC').toUpperCase()}</span>
                              </div>
                              <div className="flex justify-between items-center text-[10px]">
                                <span className="text-slate-500 font-black uppercase tracking-widest">Captured</span>
                                <span className="text-white font-black uppercase tracking-widest">{formatDate(previewDoc.timestamp)}</span>
                              </div>
                              <div className="flex justify-between items-center text-[10px]">
                                <span className="text-slate-500 font-black uppercase tracking-widest">Folder</span>
                                <span className="text-indigo-400 font-black uppercase tracking-widest">{allFolders.find(f => f.id === previewDoc.folderId)?.name || 'Default'}</span>
                              </div>
                           </div>
                        </div>
                      </div>

                      {/* Main Content Viewer */}
                      <div className="flex-1 p-10 bg-slate-950/50 overflow-y-auto custom-scrollbar relative">
                        <div className="absolute top-0 right-0 p-8 flex items-center gap-2 text-[9px] font-black text-slate-600 uppercase tracking-widest">
                          <ICONS.Efficiency className="w-3 h-3" /> Grounded Archive v4.2
                        </div>
                        <div className="space-y-6">
                           <h5 className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-8 border-b border-slate-800/50 pb-4">Extracted Intelligence Base</h5>
                           <div className="font-mono text-sm leading-relaxed text-slate-400 whitespace-pre-wrap selection:bg-indigo-500/30 selection:text-indigo-200">
                              {previewDoc.content || "Neural scan empty or content missing from database index."}
                           </div>
                        </div>
                      </div>
                    </div>

                    {/* Footer Action */}
                    <div className="p-8 border-t border-slate-800 bg-slate-800/30 flex items-center justify-between">
                       <div className="flex items-center gap-4">
                          <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
                          <span className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">Cognitive Integrity Verified</span>
                       </div>
                       <div className="flex items-center gap-4">
                          <button 
                            onClick={() => setPreviewDoc(null)}
                            className="px-8 py-4 text-slate-400 hover:text-white text-[10px] font-black uppercase tracking-widest transition-colors"
                          >
                            Dismiss Preview
                          </button>
                          <button 
                            onClick={() => {
                              onToggleSelect(previewDoc.id);
                              setPreviewDoc(null);
                            }}
                            className={`px-12 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${
                              selectedIds.includes(previewDoc.id)
                                ? 'bg-rose-600 text-white hover:bg-rose-700 shadow-xl shadow-rose-900/20'
                                : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-xl shadow-indigo-900/20'
                            }`}
                          >
                            {selectedIds.includes(previewDoc.id) ? 'Remove from Synthesis' : 'Add to Strategic Synthesis'}
                          </button>
                       </div>
                    </div>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

      {/* OCR Result Viewer & Editor Modal */}
      <AnimatePresence>
        {confirmModal && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/90 backdrop-blur-xl">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-[2.5rem] p-8 shadow-2xl space-y-6"
            >
              <div className="flex items-center gap-4 text-rose-500">
                <div className="p-3 bg-rose-500/10 rounded-2xl">
                  <ICONS.Trash className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-black uppercase tracking-tighter">{confirmModal.title}</h3>
              </div>
              
              <p className="text-slate-400 text-sm leading-relaxed font-medium">
                {confirmModal.message}
              </p>

              <div className="flex items-center gap-3 pt-4">
                <button
                  onClick={() => setConfirmModal(null)}
                  disabled={confirmModal.isLoading}
                  className="flex-1 px-6 py-3 text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-white transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmModal.onConfirm}
                  disabled={confirmModal.isLoading}
                  className="flex-1 px-6 py-3 bg-rose-600 text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-rose-700 shadow-xl shadow-rose-900/20 transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {confirmModal.isLoading ? (
                    <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <ICONS.Trash className="w-3 h-3" />
                  )}
                  Confirm Delete
                </button>
              </div>
            </motion.div>
          </div>
        )}

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
                         <div className="text-sm font-black text-emerald-600 dark:text-emerald-400 flex items-center gap-2 uppercase tracking-widest">
                           <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div> Verified
                         </div>
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
