
import React, { useRef, useState } from 'react';
import { UploadedFile } from '../types';
import { ICONS } from '../constants';
import { parseDocument } from '../services/fileService';
import { saveDocumentToFirebase } from '../services/firebaseService';

interface FileUploadProps {
  onFilesChange: React.Dispatch<React.SetStateAction<UploadedFile[]>>;
  files: UploadedFile[];
  onUploadSuccess?: () => void;
}

export const FileUpload: React.FC<FileUploadProps> = ({ onFilesChange, files, onUploadSuccess }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [ocrProgress, setOcrProgress] = useState<number>(0);
  const [isCognitiveOcr, setIsCognitiveOcr] = useState<boolean>(false);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const fileList: File[] = Array.from(e.target.files);
    const placeholders: UploadedFile[] = fileList.map((f: File) => ({ 
      name: f.name, content: '', type: f.type, status: 'processing' 
    }));
    onFilesChange(prev => [...prev, ...placeholders]);

    for (const file of fileList) {
      try {
        const text = await parseDocument(file, {
          onProgress: (p) => setOcrProgress(p),
          onStatusChange: (isOcr) => setIsCognitiveOcr(isOcr)
        });
        await saveDocumentToFirebase(file.name, text, file.type);
        onFilesChange(prev => prev.map(f => f.name === file.name ? { ...f, content: text, status: 'ready' } : f));
        onUploadSuccess?.();
      } catch (err) {
        onFilesChange(prev => prev.map(f => f.name === file.name ? { ...f, status: 'error' } : f));
      }
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div className="space-y-4">
      <div 
        className="border-2 border-dashed border-slate-200 rounded-3xl p-10 text-center hover:border-red-400 cursor-pointer bg-slate-50 transition-all group" 
        onClick={() => fileInputRef.current?.click()}
      >
        <input type="file" multiple className="hidden" ref={fileInputRef} onChange={handleFileChange} accept=".pdf,.docx,.txt,.csv,.md,image/*" />
        <div className="flex flex-col items-center">
          <div className="w-16 h-16 bg-red-50 text-red-600 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform shadow-sm">
            <ICONS.Document className="w-8 h-8" />
          </div>
          <p className="text-slate-900 font-black uppercase text-[10px] tracking-widest">Cognitive Intake Hub</p>
          <p className="text-slate-400 text-xs mt-1">High-Precision OCR & Auto-Sync</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {files.map((file, idx) => (
          <div key={idx} className="p-4 bg-white border border-slate-100 rounded-2xl shadow-sm animate-in slide-in-from-bottom-2">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3 overflow-hidden">
                <div className={`shrink-0 ${file.status === 'ready' ? 'text-red-500' : 'text-slate-400'}`}>
                  <ICONS.Document className="w-5 h-5" />
                </div>
                <span className="text-xs font-bold text-slate-800 truncate">{file.name}</span>
              </div>
              <button onClick={(e) => { e.stopPropagation(); onFilesChange(prev => prev.filter((_, i) => i !== idx)); }} className="text-slate-300 hover:text-red-500"><ICONS.X /></button>
            </div>
            {file.status === 'processing' && (
              <div className="space-y-2">
                <span className="text-[8px] font-black text-red-600 uppercase tracking-widest animate-pulse">
                  {isCognitiveOcr ? `Neural Scan (${ocrProgress}%)` : 'Grounded Parsing...'}
                </span>
                <div className="w-full h-1 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-red-600 animate-[progress_1s_infinite] w-full origin-left" />
                </div>
              </div>
            )}
            {file.status === 'ready' && (
              <span className="text-[8px] font-black text-emerald-500 uppercase tracking-widest flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full" /> Ready for Analysis
              </span>
            )}
          </div>
        ))}
      </div>
      <style>{`@keyframes progress { 0% { transform: scaleX(0); } 100% { transform: scaleX(1); } }`}</style>
    </div>
  );
};
