import React, { useState, useRef } from 'react';
import { motion } from 'motion/react';
import { Upload, FileText, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { categorizeDocument } from '../services/aiService';
import { uploadDocument } from '../services/libraryService';
import { Folder } from '../../types';
import { cn } from '../lib/utils';

interface UploadZoneProps {
  userId: string;
  folders: Folder[];
  onUploadComplete: () => void;
}

export const UploadZone: React.FC<UploadZoneProps> = ({ userId, folders, onUploadComplete }) => {
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    setIsUploading(true);
    setError(null);
    const totalFiles = files.length;
    let completedFiles = 0;

    try {
      for (let i = 0; i < totalFiles; i++) {
        const file = files[i];
        setUploadStatus(`Processing ${i + 1}/${totalFiles}: ${file.name}`);
        setProgress(Math.round((i / totalFiles) * 100));

        const content = await file.text();
        
        // AI Categorization
        const folderId = await categorizeDocument(content, folders);
        
        const fileUrl = `https://picsum.photos/seed/${file.name}/200/300`; 
        
        await uploadDocument(userId, {
          name: file.name,
          fileUrl,
          folderId,
          content,
          type: file.type,
          metadata: {
            size: file.size,
            type: file.type,
            category: folders.find(f => f.id === folderId)?.name || "Miscellaneous"
          }
        });
        
        completedFiles++;
        setProgress(Math.round((completedFiles / totalFiles) * 100));
      }

      setUploadStatus("Batch integration complete!");
      setTimeout(() => {
        setUploadStatus(null);
        setProgress(0);
      }, 3000);
      onUploadComplete();
    } catch (err) {
      console.error("Upload error:", err);
      setError("Failed to complete batch upload. Some files may have been skipped.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    processFiles(e.target.files);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (!isUploading) setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (!isUploading) {
      processFiles(e.dataTransfer.files);
    }
  };

  return (
    <div className="w-full">
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileSelect}
        className="hidden"
        accept=".txt,.pdf,.doc,.docx"
        multiple
      />
      
      <div 
        onClick={() => !isUploading && fileInputRef.current?.click()}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={cn(
          "relative border-2 border-dashed rounded-[2.5rem] p-12 transition-all duration-500 cursor-pointer group overflow-hidden",
          isUploading 
            ? "bg-indigo-950/20 border-indigo-500/50" 
            : isDragging
              ? "bg-indigo-900/40 border-indigo-400 scale-[1.02] shadow-2xl shadow-indigo-500/20"
              : "bg-slate-900/50 border-slate-800 hover:border-indigo-500/50 hover:bg-slate-800/50"
        )}
      >
        {/* Animated Background Gradient */}
        <div className={cn(
          "absolute inset-0 bg-gradient-to-br from-indigo-600/10 via-transparent to-rose-600/10 transition-opacity duration-700",
          isDragging || isUploading ? "opacity-100" : "opacity-0 group-hover:opacity-100"
        )} />

        <div className="relative flex flex-col items-center justify-center text-center">
          {isUploading ? (
            <>
              <div className="relative mb-6">
                <div className="w-16 h-16 rounded-full border-4 border-slate-800 border-t-indigo-500 animate-spin" />
                <div className="absolute inset-0 flex items-center justify-center text-[10px] font-black text-indigo-400">
                  {progress}%
                </div>
              </div>
              <p className="text-sm font-black text-white uppercase tracking-widest max-w-[250px] truncate">{uploadStatus}</p>
              
              <div className="w-48 h-1 bg-slate-800 rounded-full mt-4 overflow-hidden">
                <motion.div 
                  className="h-full bg-indigo-500"
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                  transition={{ type: "spring", stiffness: 50, damping: 20 }}
                />
              </div>
              
              <p className="text-[10px] text-slate-500 uppercase tracking-widest mt-4">AI Intelligence is processing batch data...</p>
            </>
          ) : uploadStatus === "Batch integration complete!" ? (
            <>
              <div className="p-4 bg-emerald-900/30 text-emerald-400 rounded-2xl mb-6">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <p className="text-sm font-black text-white uppercase tracking-widest">Nodes Integrated</p>
              <p className="text-[10px] text-slate-500 uppercase tracking-widest mt-2">All documents have been auto-categorized.</p>
            </>
          ) : error ? (
            <>
              <div className="p-4 bg-rose-900/30 text-rose-400 rounded-2xl mb-6">
                <AlertCircle className="w-8 h-8" />
              </div>
              <p className="text-sm font-black text-white uppercase tracking-widest">{error}</p>
              <p className="text-[10px] text-slate-500 uppercase tracking-widest mt-2">Click or drop to retry initialization.</p>
            </>
          ) : (
            <>
              <div className={cn(
                "p-5 rounded-3xl mb-6 transition-all duration-500 shadow-xl",
                isDragging 
                  ? "bg-indigo-500 text-white scale-110 rotate-12"
                  : "bg-indigo-900/30 text-indigo-400 group-hover:scale-110 group-hover:bg-indigo-600 group-hover:text-white shadow-indigo-500/10"
              )}>
                <Upload className={cn("w-8 h-8", isDragging && "animate-bounce")} />
              </div>
              <p className="text-sm font-black text-white uppercase tracking-widest group-hover:text-indigo-400 transition-colors">
                {isDragging ? "Drop to Integrate" : "Initialize Data Stream"}
              </p>
              <p className="text-[10px] text-slate-500 uppercase tracking-widest mt-2">
                {isDragging ? "Ready for batch processing" : "PDF • DOCX • TXT (MULTIPLE FILES)"}
              </p>
              
              <div className="mt-8 flex gap-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="w-1 h-1 rounded-full bg-slate-800 group-hover:bg-indigo-500/50 transition-colors" style={{ transitionDelay: `${i * 100}ms` }} />
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
