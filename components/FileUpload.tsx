import React, { useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { UploadedFile } from '../types';
import { ICONS } from '../constants';
import { parseDocument } from '../services/fileService';
import { saveDocumentToFirebase, deleteDocumentFromFirebase, fetchFoldersFromFirebase } from '../services/firebaseService';
import { categorizeDocument } from '../services/geminiService';
import { PREDEFINED_CATEGORIES } from '../constants';
import { googleService } from '../services/googleService';

interface FileUploadProps {
  onFilesChange: React.Dispatch<React.SetStateAction<UploadedFile[]>>;
  files: UploadedFile[];
  onUploadSuccess?: () => void;
  activeFolderId: string;
}

export const FileUpload: React.FC<FileUploadProps> = ({ onFilesChange, files, onUploadSuccess, activeFolderId }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [ocrProgress, setOcrProgress] = useState<number>(0);
  const [isCognitiveOcr, setIsCognitiveOcr] = useState<boolean>(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  const processFile = async (file: File | { name: string, type: string, blob: Blob }) => {
    const fileName = file.name;
    const fileType = file.type;
    
    onFilesChange(prev => [...prev, { 
      name: fileName, 
      content: '', 
      type: fileType, 
      status: 'processing' 
    }]);

    try {
      const blob = 'blob' in file ? file.blob : file;
      const text = await parseDocument(blob as File, {
        onProgress: (p) => setOcrProgress(p),
        onStatusChange: (isOcr) => setIsCognitiveOcr(isOcr)
      });

      // 1. Fetch all folders to understand the structure
      const allFolders = await fetchFoldersFromFirebase();
      
      // 2. Identify the target main folder and its subfolders
      let targetMainFolderId = activeFolderId;
      const activeFolder = allFolders.find(f => f.id === activeFolderId);
      
      if (activeFolder && activeFolder.parentId) {
        targetMainFolderId = activeFolder.parentId;
      }

      const subFoldersForMain = allFolders.filter(f => f.parentId === targetMainFolderId);
      const subFolderNames = [
        ...PREDEFINED_CATEGORIES, 
        ...subFoldersForMain.map(f => f.name)
      ];

      const { category: categoryName, reasoning } = await categorizeDocument(fileName, text, subFolderNames);
      
      let finalFolderId: string | null = null;
      const realSub = subFoldersForMain.find(f => f.name.toLowerCase() === categoryName.toLowerCase());
      if (realSub) {
        finalFolderId = realSub.id;
      } else if (PREDEFINED_CATEGORIES.some(cat => cat.toLowerCase() === categoryName.toLowerCase())) {
        const matchedCat = PREDEFINED_CATEGORIES.find(cat => cat.toLowerCase() === categoryName.toLowerCase()) || categoryName;
        finalFolderId = `virtual-${targetMainFolderId}-${matchedCat.replace(/\s+/g, '-')}`;
      } else {
        if (targetMainFolderId !== "Global Library") {
          const { saveFolderToFirebase } = await import('../services/firebaseService');
          const newFolderId = await saveFolderToFirebase(categoryName, true, 'sub', targetMainFolderId);
          finalFolderId = newFolderId;
        } else {
          finalFolderId = `virtual-Global Library-${categoryName.replace(/\s+/g, '-')}`;
        }
      }

      if (!finalFolderId) {
        finalFolderId = activeFolderId !== "Global Library" ? activeFolderId : "Miscellaneous";
      }

      const docId = await saveDocumentToFirebase(
        fileName, 
        text, 
        fileType, 
        finalFolderId || undefined,
        categoryName,
        reasoning
      );

      onFilesChange(prev => prev.map(f => 
        f.name === fileName ? { 
          ...f, 
          id: docId || undefined, 
          content: text, 
          status: 'ready',
          category: categoryName,
          reasoning: reasoning
        } : f
      ));
      
      onUploadSuccess?.();
    } catch (err) {
      console.error(`Error parsing ${fileName}:`, err);
      onFilesChange(prev => prev.map(f => 
        f.name === fileName ? { ...f, status: 'error' } : f
      ));
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement> | React.DragEvent) => {
    let filesToProcess: FileList | null = null;
    
    if ('files' in e.target && e.target.files) {
      filesToProcess = e.target.files;
    } else if ('dataTransfer' in e && e.dataTransfer.files) {
      filesToProcess = e.dataTransfer.files;
    }

    if (!filesToProcess) return;
    const fileList: File[] = Array.from(filesToProcess);
    
    for (const file of fileList) {
      await processFile(file);
    }
    
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleGoogleDriveClick = async () => {
    setIsGoogleLoading(true);
    try {
      const isConnected = await googleService.getAuthStatus();
      if (!isConnected) {
        const url = await googleService.getAuthUrl();
        const width = 600;
        const height = 700;
        const left = window.screenX + (window.outerWidth - width) / 2;
        const top = window.screenY + (window.outerHeight - height) / 2;
        
        const authWindow = window.open(
          url,
          'google_oauth',
          `width=${width},height=${height},left=${left},top=${top}`
        );

        if (!authWindow) {
          alert('Please allow popups to connect your Google account');
          setIsGoogleLoading(false);
          return;
        }

        const handleMessage = async (event: MessageEvent) => {
          if (event.data?.type === 'OAUTH_AUTH_SUCCESS') {
            window.removeEventListener('message', handleMessage);
            await openPicker();
          }
        };

        window.addEventListener('message', handleMessage);
      } else {
        await openPicker();
      }
    } catch (err) {
      console.error("Google Drive connection failed:", err);
      let errorMessage = "Failed to connect to Google Drive. ";
      if (err instanceof Error) {
        if (err.message.includes('Unexpected token') || err.message.includes('JSON')) {
          errorMessage += "The server returned an invalid response. This often happens if the backend API is not correctly configured on your hosting provider (e.g., Vercel).";
        } else {
          errorMessage += err.message;
        }
      }
      alert(errorMessage + "\n\nPlease check your environment variables and server configuration.");
    } finally {
      setIsGoogleLoading(false);
    }
  };

  const openPicker = async () => {
    const accessToken = await googleService.getAccessToken();
    const apiKey = (import.meta as any).env.VITE_GOOGLE_DRIVE_API_KEY;

    if (!apiKey) {
      alert("Google Drive API Key is not configured. Please add VITE_GOOGLE_DRIVE_API_KEY to your environment variables.");
      return;
    }

    // @ts-ignore
    const gapi = window.gapi;
    // @ts-ignore
    const google = window.google;

    if (!gapi || !google) {
      alert("Google API libraries not loaded. Please refresh the page.");
      return;
    }

    gapi.load('picker', {
      callback: () => {
        const picker = new google.picker.PickerBuilder()
          .addView(google.picker.ViewId.DOCS)
          .setOAuthToken(accessToken)
          .setDeveloperKey(apiKey)
          .setCallback(async (data: any) => {
            if (data[google.picker.Response.ACTION] === google.picker.Action.PICKED) {
              const doc = data[google.picker.Response.DOCUMENTS][0];
              const fileId = doc[google.picker.Document.ID];
              const fileName = doc[google.picker.Document.NAME];
              const mimeType = doc[google.picker.Document.MIME_TYPE];

              try {
                const blob = await googleService.downloadDriveFile(fileId);
                await processFile({ name: fileName, type: mimeType, blob });
              } catch (err) {
                console.error("Failed to download from Drive:", err);
                alert("Failed to download file from Google Drive.");
              }
            }
          })
          .build();
        picker.setVisible(true);
      }
    });
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const onDragLeave = () => {
    setIsDragging(false);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFileChange(e);
  };

  return (
    <div className="space-y-6" id="tour-upload-zone">
      <motion.div 
        whileHover={{ scale: 1.01 }}
        whileTap={{ scale: 0.99 }}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        className={`relative border-2 border-dashed rounded-[3rem] p-8 text-center cursor-pointer transition-all duration-500 group overflow-hidden ${isDragging ? 'border-indigo-500 bg-indigo-900/40 shadow-2xl shadow-indigo-500/20' : 'border-slate-800 bg-slate-900/50 hover:border-indigo-500 hover:shadow-none'}`} 
        onClick={() => fileInputRef.current?.click()}
      >
        <input 
          type="file" 
          multiple 
          className="hidden" 
          ref={fileInputRef} 
          onChange={handleFileChange} 
          accept=".pdf,.docx,.txt,.csv,.xlsx,.xls,.pptx" 
        />
        
        {/* Animated Background Element */}
        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none">
          <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-indigo-500/10 via-transparent to-transparent"></div>
          <div className="absolute -bottom-24 -right-24 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl"></div>
        </div>

        <div className="flex flex-col items-center relative z-10">
          <motion.div 
            animate={isDragging ? { y: [0, -15, 0], scale: [1, 1.1, 1] } : {}}
            transition={{ repeat: Infinity, duration: 2 }}
            className={`w-20 h-20 rounded-[1.5rem] flex items-center justify-center mb-6 transition-all shadow-2xl ${isDragging ? 'bg-indigo-600 text-white shadow-none' : 'bg-indigo-900/30 text-indigo-400 group-hover:bg-indigo-600 group-hover:text-white group-hover:shadow-none'}`}
          >
            <ICONS.Document className="w-10 h-10" />
          </motion.div>
          <h4 className="text-2xl font-black text-white uppercase tracking-tighter">Cognitive Intake Hub</h4>
          <p className="text-slate-500 text-[11px] font-black uppercase tracking-[0.4em] mt-3">Drag & Drop or Click to Ingest Intelligence</p>
          
          <div className="mt-8 flex gap-4">
            <button 
              onClick={(e) => {
                e.stopPropagation();
                handleGoogleDriveClick();
              }}
              disabled={isGoogleLoading}
              className="flex items-center gap-3 px-6 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-2xl border border-slate-700 transition-all shadow-lg active:scale-95 disabled:opacity-50"
            >
              {isGoogleLoading ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <img 
                  src="https://upload.wikimedia.org/wikipedia/commons/1/12/Google_Drive_icon_%282020%29.svg" 
                  alt="Google Drive" 
                  className="w-5 h-5"
                  referrerPolicy="no-referrer"
                />
              )}
              <span className="text-[10px] font-black uppercase tracking-widest">Google Drive</span>
            </button>
          </div>

          <div className="mt-8 flex gap-3 flex-wrap justify-center">
            {['PDF', 'DOCX', 'TXT', 'PPTX', 'XLSX', 'CSV'].map(ext => (
              <span key={ext} className="px-4 py-1.5 bg-slate-800 text-[9px] font-black text-slate-400 rounded-xl border border-slate-700 shadow-sm">{ext}</span>
            ))}
          </div>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <AnimatePresence mode="popLayout">
          {files.map((file, idx) => (
            <motion.div 
              key={`${file.name}-${idx}`}
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: -20 }}
              layout
              className="p-5 bg-slate-900 border border-slate-800 rounded-[1.8rem] shadow-sm hover:shadow-2xl hover:border-indigo-800 transition-all group"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-4 overflow-hidden">
                  <div className={`shrink-0 w-10 h-10 rounded-xl flex items-center justify-center shadow-inner ${file.status === 'ready' ? 'bg-emerald-900/20 text-emerald-500' : file.status === 'error' ? 'bg-rose-900/20 text-rose-500' : 'bg-indigo-900/20 text-indigo-500'}`}>
                    <ICONS.Document className="w-5 h-5" />
                  </div>
                  <div className="flex flex-col overflow-hidden">
                    <span className="text-[12px] font-black text-white truncate leading-tight uppercase tracking-tight">{file.name}</span>
                    <span className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em]">{(file.type.split('/')[1] || 'DOC').toUpperCase()}</span>
                  </div>
                </div>
                <button 
                  onClick={async (e) => {
                    e.stopPropagation();
                    if (file.id) {
                      await deleteDocumentFromFirebase(file.id);
                    }
                    onFilesChange(prev => prev.filter((_, i) => i !== idx));
                    onUploadSuccess?.();
                  }} 
                  className="p-1.5 text-slate-700 hover:text-rose-500 hover:bg-rose-900/30 rounded-lg transition-all"
                >
                  <ICONS.X className="w-4 h-4" />
                </button>
              </div>
              
              {file.status === 'processing' && (
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-[9px] font-black text-indigo-400 uppercase tracking-widest animate-pulse">
                      {isCognitiveOcr ? `Neural Scan` : 'Grounded Parsing...'}
                    </span>
                    <span className="text-[9px] font-black text-indigo-400">{ocrProgress}%</span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${ocrProgress}%` }}
                      className="h-full bg-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.5)]"
                    ></motion.div>
                  </div>
                </div>
              )}
              
              {file.status === 'ready' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] font-black text-emerald-500 uppercase tracking-widest flex items-center gap-1.5">
                      <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></div>
                      Context Synced
                    </span>
                    <ICONS.Shield className="w-3 h-3 text-emerald-500 opacity-50" />
                  </div>
                  
                  {file.category && (
                    <div className="pt-3 border-t border-slate-800/50 flex flex-col gap-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Categorization</span>
                        <span className="px-2 py-0.5 bg-indigo-900/40 text-indigo-400 text-[7px] font-black rounded-md border border-indigo-500/20 uppercase tracking-widest">
                          {file.category}
                        </span>
                      </div>
                      {file.reasoning && (
                        <p className="text-[8px] text-slate-500 italic leading-relaxed line-clamp-2">
                          "{file.reasoning}"
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}
              
              {file.status === 'error' && (
                <span className="text-[9px] font-black text-rose-500 uppercase tracking-widest flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 bg-rose-500 rounded-full"></div>
                  Parsing Failed
                </span>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
};