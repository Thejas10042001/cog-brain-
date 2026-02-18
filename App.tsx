import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { Header } from './components/Header';
import { Auth } from './components/Auth';
import { FileUpload } from './components/FileUpload';
import { AudioGenerator } from './components/AudioGenerator';
import { PracticeSession } from './components/PracticeSession';
import { SalesGPT } from './components/SalesGPT';
import { MeetingContextConfig } from './components/MeetingContextConfig';
import { DocumentGallery } from './components/DocumentGallery';
import { AssessmentLab } from './components/AssessmentLab';
import { AvatarSimulation } from './components/AvatarSimulation';
import { AvatarSimulationV2 } from './components/AvatarSimulationV2';
import { AvatarSimulationStaged } from './components/AvatarSimulationStaged';
import { analyzeSalesContext } from './services/geminiService';
import { fetchDocumentsFromFirebase, subscribeToAuth, User } from './services/firebaseService';
import { AnalysisResult, UploadedFile, MeetingContext, StoredDocument } from './types';
import { ICONS } from './constants';

const ALL_ANSWER_STYLES = [
  "Executive Summary", 
  "Analogy Based", 
  "Data-Driven Insights",
  "Concise Answer", 
  "In-Depth Response", 
  "Answer in Points", 
  "Define Technical Terms", 
  "Sales Points", 
  "Key Statistics", 
  "Case Study Summary", 
  "Competitive Comparison", 
  "Anticipated Customer Questions", 
  "Information Gap", 
  "Pricing Overview",
  "ROI Forecast",
  "SWOT Analysis",
  "Strategic Roadmap",
  "Risk Assessment",
  "Implementation Timeline",
  "Technical Deep-Dive",
  "Value Proposition",
  "Financial Justification",
  "Stakeholder Alignment",
  "Competitive Wedge",
  "Success Story Summary",
  "Psychological Projection",
  "Buying Fear Mitigation",
  "Security & Compliance",
  "Decision Matrix"
];

// Fix: Added 'export' keyword to resolve the "no default export" error in index.tsx
export const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [history, setHistory] = useState<StoredDocument[]>([]);
  const [selectedLibraryDocIds, setSelectedLibraryDocIds] = useState<string[]>([]);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'context' | 'practice' | 'audio' | 'gpt' | 'qa' | 'avatar' | 'avatar2' | 'avatar-staged'>('context');

  // Whole Screen Magnifier State
  const [zoom, setZoom] = useState(100);
  // Text-Only Magnifier State
  const [textZoom, setTextZoom] = useState(100);

  // Partition Resizer State
  const [sidebarWidth, setSidebarWidth] = useState(280);
  const [isResizing, setIsResizing] = useState(false);

  const lastAnalyzedHash = useRef<string | null>(null);

  const [meetingContext, setMeetingContext] = useState<MeetingContext>({
    sellerCompany: "",
    sellerNames: "",
    clientCompany: "",
    clientNames: "",
    targetProducts: "",
    productDomain: "",
    meetingFocus: "",
    persona: "Balanced",
    thinkingLevel: "Medium",
    temperature: 1.0,
    answerStyles: ALL_ANSWER_STYLES,
    executiveSnapshot: "",
    strategicKeywords: [],
    potentialObjections: [],
    baseSystemPrompt: "",
    kycDocId: "",
    voiceMode: 'upload'
  });

  const startResizing = useCallback(() => setIsResizing(true), []);
  const stopResizing = useCallback(() => setIsResizing(false), []);

  const resize = useCallback((e: MouseEvent) => {
    if (isResizing) {
      const zoomFactor = zoom / 100;
      const newWidth = e.clientX / zoomFactor;
      if (newWidth > 64 && newWidth < 600) {
        setSidebarWidth(newWidth);
      }
    }
  }, [isResizing, zoom]);

  useEffect(() => {
    if (isResizing) {
      window.addEventListener('mousemove', resize);
      window.addEventListener('mouseup', stopResizing);
    } else {
      window.removeEventListener('mousemove', resize);
      window.removeEventListener('mouseup', stopResizing);
    }
    return () => {
      window.removeEventListener('mousemove', resize);
      window.removeEventListener('mouseup', stopResizing);
    };
  }, [isResizing, resize, stopResizing]);

  const loadHistory = useCallback(async () => {
    if (!user) return;
    const docs = await fetchDocumentsFromFirebase();
    setHistory(docs);
  }, [user]);

  useEffect(() => {
    const unsubscribe = subscribeToAuth((u) => {
      setUser(u);
      setAuthLoading(false);
      if (!u) {
        setHistory([]);
        setFiles([]);
        setAnalysis(null);
        setSelectedLibraryDocIds([]);
      }
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (user) {
      loadHistory();
    }
  }, [user, loadHistory]);

  const toggleLibraryDoc = (id: string) => {
    setSelectedLibraryDocIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const isAnyFileProcessing = useMemo(() => files.some(f => f.status === 'processing'), [files]);
  
  const activeDocuments = useMemo(() => {
    const sessionDocs = files.filter(f => f.status === 'ready').map(f => ({ name: f.name, content: f.content }));
    const libDocs = history.filter(d => selectedLibraryDocIds.includes(d.id)).map(d => ({ name: d.name, content: d.content }));
    return [...sessionDocs, ...libDocs];
  }, [files, history, selectedLibraryDocIds]);

  const generateStateHash = useCallback(() => {
    const fileIds = files.map(f => `${f.name}-${f.content.length}`).join('|');
    const libIds = selectedLibraryDocIds.sort().join('|');
    const ctxString = JSON.stringify(meetingContext);
    return `${fileIds}-${libIds}-${ctxString}`;
  }, [files, selectedLibraryDocIds, meetingContext]);

  const runAnalysis = useCallback(async () => {
    if (activeDocuments.length === 0) {
      setError("Please ensure at least one document (from library or upload) is ready for analysis.");
      return;
    }

    const currentHash = generateStateHash();
    
    if (analysis && currentHash === lastAnalyzedHash.current) {
      setActiveTab('qa');
      return;
    }

    setIsAnalyzing(true);
    setLoadingProgress(0);
    setError(null);

    const progressInterval = setInterval(() => {
      setLoadingProgress(prev => {
        if (prev >= 98) return prev;
        const remaining = 100 - prev;
        const step = Math.max(0.1, Math.random() * (remaining / 10));
        return parseFloat((prev + step).toFixed(1));
      });
    }, 400);

    try {
      const combinedContent = activeDocuments.map(d => `DOC NAME: ${d.name}\n${d.content}`).join('\n\n');
      const result = await analyzeSalesContext(combinedContent, meetingContext);
      
      clearInterval(progressInterval);
      setLoadingProgress(100);
      
      setTimeout(() => {
        setAnalysis(result);
        lastAnalyzedHash.current = currentHash;
        setIsAnalyzing(false);
        setActiveTab('qa');
      }, 800);

    } catch (err: any) {
      clearInterval(progressInterval);
      console.error(err);
      setError(err.message || "An unexpected error occurred during analysis.");
      setIsAnalyzing(false);
    }
  }, [activeDocuments, meetingContext, analysis, generateStateHash]);

  const reset = () => {
    if(confirm("Are you sure you want to wipe current strategy context?")) {
      setFiles([]);
      setSelectedLibraryDocIds([]);
      setAnalysis(null);
      lastAnalyzedHash.current = null;
      setError(null);
      setActiveTab('context');
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50">
        <div className="w-16 h-16 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin"></div>
        <p className="mt-6 text-[10px] font-black uppercase text-slate-400 tracking-widest animate-pulse">Establishing Secure Neural Link...</p>
      </div>
    );
  }

  if (!user) {
    return <Auth />;
  }

  // Calculate dynamic font scale for the sidebar based on its width
  const sidebarFontScale = Math.max(0.75, Math.min(1.5, sidebarWidth / 280));

  return (
    <div 
      className="min-h-screen bg-slate-100 flex flex-col transition-all duration-300 ease-in-out origin-top-left"
      style={{ 
        zoom: zoom / 100,
        // @ts-ignore
        MozZoom: zoom / 100,
      } as React.CSSProperties}
    >
      {/* Dynamic Text-Only Magnifier Style Injection */}
      <style>{`
        :root {
          font-size: ${textZoom}%;
        }
      `}</style>
      <Header 
        user={user} 
        zoom={zoom} 
        onZoomChange={setZoom} 
        textZoom={textZoom} 
        onTextZoomChange={setTextZoom} 
      />
      <div className="flex-1 flex pt-16 overflow-hidden">
        {/* Fix: Closed truncated tags and added a placeholder for the remaining UI structure */}
        <main className="flex-1 relative overflow-y-auto bg-white p-8">
           <h2 className="text-xl font-bold mb-4">Neural Control Center</h2>
           <p className="text-slate-500 mb-8 italic">The original component structure was truncated in source; basic recovery active.</p>
           <button onClick={runAnalysis} className="px-6 py-3 bg-indigo-600 text-white rounded-xl shadow-lg hover:bg-indigo-700 transition-all">
             {isAnalyzing ? "Processing Neural Link..." : "Initiate Full Context Analysis"}
           </button>
        </main>
      </div>
    </div>
  );
};