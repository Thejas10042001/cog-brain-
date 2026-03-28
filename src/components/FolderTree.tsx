import React from 'react';
import { Folder as FolderIcon, ChevronRight, ChevronDown, Plus } from 'lucide-react';
import { Folder, StoredDocument } from '../../types';
import { cn } from '../lib/utils';

interface FolderTreeProps {
  folders: Folder[];
  documents: StoredDocument[];
  selectedFolderId: string | null;
  onSelectFolder: (folderId: string | null) => void;
  onAddFolder: () => void;
}

export const FolderTree: React.FC<FolderTreeProps> = ({ 
  folders, 
  documents,
  selectedFolderId, 
  onSelectFolder, 
  onAddFolder
}) => {
  const topLevelFolders = folders.filter(f => !f.parentId);

  const getDocCount = (folderId: string | null) => {
    if (folderId === null) return documents.length;
    
    // Recursive count for folder and all its subfolders
    const getAllSubFolderIds = (id: string): string[] => {
      const subs = folders.filter(f => f.parentId === id);
      return [id, ...subs.flatMap(s => getAllSubFolderIds(s.id))];
    };

    const folderIds = getAllSubFolderIds(folderId);
    return documents.filter(d => d.folderId && folderIds.includes(d.folderId)).length;
  };

  const renderFolder = (folder: Folder, depth: number = 0) => {
    const isSelected = selectedFolderId === folder.id;
    const subFolders = folders.filter(f => f.parentId === folder.id);
    const count = getDocCount(folder.id);

    return (
      <div key={folder.id} className="w-full">
        <button
          onClick={() => onSelectFolder(folder.id)}
          className={cn(
            "w-full flex items-center gap-3 px-4 py-3 text-[11px] font-black uppercase tracking-widest rounded-xl transition-all group relative overflow-hidden",
            isSelected 
              ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/20" 
              : "hover:bg-slate-800 text-slate-400 hover:text-slate-200"
          )}
          style={{ paddingLeft: `${depth * 1.5 + 1}rem` }}
        >
          <FolderIcon className={cn("w-4 h-4", isSelected ? "text-white" : "text-slate-500 group-hover:text-indigo-400")} />
          <span className="flex-1 text-left truncate">{folder.name}</span>
          <span className={cn(
            "text-[9px] font-black px-2 py-0.5 rounded-md",
            isSelected ? "bg-indigo-500 text-white" : "bg-slate-800 text-slate-500"
          )}>
            {count}
          </span>
        </button>
        {subFolders.length > 0 && (
          <div className="mt-1 space-y-1">
            {subFolders.map(sf => renderFolder(sf, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-2">
      <button
        onClick={() => onSelectFolder(null)}
        className={cn(
          "w-full flex items-center gap-3 px-4 py-3 text-[11px] font-black uppercase tracking-widest rounded-xl transition-all group",
          selectedFolderId === null 
            ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/20" 
            : "hover:bg-slate-800 text-slate-400 hover:text-slate-200"
        )}
      >
        <FolderIcon className={cn("w-4 h-4", selectedFolderId === null ? "text-white" : "text-slate-500 group-hover:text-indigo-400")} />
        <span className="flex-1 text-left">All Intelligence</span>
        <span className={cn(
          "text-[9px] font-black px-2 py-0.5 rounded-md",
          selectedFolderId === null ? "bg-indigo-500 text-white" : "bg-slate-800 text-slate-500"
        )}>
          {getDocCount(null)}
        </span>
      </button>

      <div className="h-px bg-slate-800 my-2 mx-2" />

      <div className="space-y-1">
        {topLevelFolders.map(f => renderFolder(f))}
      </div>
    </div>
  );
};
