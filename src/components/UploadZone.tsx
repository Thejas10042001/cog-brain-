import React, { useState, useRef } from 'react';
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
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setUploadStatus("Reading file content...");
    setError(null);

    try {
      const content = await file.text();
      
      setUploadStatus("Analyzing document category...");
      const folderId = await categorizeDocument(content, folders);
      
      setUploadStatus("Uploading to library...");
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

      setUploadStatus("Upload complete!");
      setTimeout(() => setUploadStatus(null), 3000);
      onUploadComplete();
    } catch (err) {
      console.error("Upload error:", err);
      setError("Failed to upload document. Please try again.");
    } finally {
      setIsUploading(false);
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
      />
      
      <div 
        onClick={() => !isUploading && fileInputRef.current?.click()}
        className={cn(
          "relative border-2 border-dashed rounded-[2.5rem] p-12 transition-all duration-500 cursor-pointer group overflow-hidden",
          isUploading 
            ? "bg-indigo-950/20 border-indigo-500/50" 
            : "bg-slate-900/50 border-slate-800 hover:border-indigo-500/50 hover:bg-slate-800/50"
        )}
      >
        {/* Animated Background Gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-600/5 via-transparent to-rose-600/5 opacity-0 group-hover:opacity-100 transition-opacity duration-700" />

        <div className="relative flex flex-col items-center justify-center text-center">
          {isUploading ? (
            <>
              <div className="relative mb-6">
                <Loader2 className="w-12 h-12 text-indigo-500 animate-spin" />
                <div className="absolute inset-0 blur-xl bg-indigo-500/20 animate-pulse" />
              </div>
              <p className="text-sm font-black text-white uppercase tracking-widest">{uploadStatus}</p>
              <p className="text-[10px] text-slate-500 uppercase tracking-widest mt-2">AI Intelligence is processing node data...</p>
            </>
          ) : uploadStatus === "Upload complete!" ? (
            <>
              <div className="p-4 bg-emerald-900/30 text-emerald-400 rounded-2xl mb-6">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <p className="text-sm font-black text-white uppercase tracking-widest">Node Integrated</p>
              <p className="text-[10px] text-slate-500 uppercase tracking-widest mt-2">Document has been auto-categorized.</p>
            </>
          ) : error ? (
            <>
              <div className="p-4 bg-rose-900/30 text-rose-400 rounded-2xl mb-6">
                <AlertCircle className="w-8 h-8" />
              </div>
              <p className="text-sm font-black text-white uppercase tracking-widest">{error}</p>
              <p className="text-[10px] text-slate-500 uppercase tracking-widest mt-2">Click to retry initialization.</p>
            </>
          ) : (
            <>
              <div className="p-5 bg-indigo-900/30 text-indigo-400 rounded-3xl mb-6 group-hover:scale-110 group-hover:bg-indigo-600 group-hover:text-white transition-all duration-500 shadow-xl shadow-indigo-500/10">
                <Upload className="w-8 h-8" />
              </div>
              <p className="text-sm font-black text-white uppercase tracking-widest group-hover:text-indigo-400 transition-colors">Initialize Data Stream</p>
              <p className="text-[10px] text-slate-500 uppercase tracking-widest mt-2">PDF • DOCX • TXT (MAX 10MB)</p>
              
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
