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

const App: React.FC = () => {
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

  const loadingStatusText = useMemo(() => {
    if (loadingProgress < 20) return "Neural Ingestion: Parsing Documentary Nodes...";
    if (loadingProgress < 40) return "Context Alignment: Mapping Seller/Prospect Domains...";
    if (loadingProgress < 60) return "Psychological Synthesis: Inferring Buyer Resistance...";
    if (loadingProgress < 80) return "Strategy Extraction: Modeling Competitive Wedge...";
    return "Finalizing Core Strategy Brief...";
  }, [loadingProgress]);

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
          --text-zoom-multiplier: ${textZoom / 100};
        }
        /* Target common text containers to scale only typography */
        .text-magnifier p, 
        .text-magnifier span:not(.no-zoom), 
        .text-magnifier h1, 
        .text-magnifier h2, 
        .text-magnifier h3, 
        .text-magnifier h4, 
        .text-magnifier h5, 
        .text-magnifier h6, 
        .text-magnifier li, 
        .text-magnifier button:not(.no-zoom), 
        .text-magnifier input, 
        .text-magnifier textarea,
        .text-magnifier .text-xs,
        .text-magnifier .text-sm,
        .text-magnifier .text-base,
        .text-magnifier .text-lg,
        .text-magnifier .text-xl,
        .text-magnifier .text-2xl,
        .text-magnifier .text-3xl,
        .text-magnifier .text-4xl,
        .text-magnifier .text-5xl,
        .text-magnifier .text-6xl {
           font-size: calc(1em * var(--text-zoom-multiplier));
        }
        /* Specific override for explicit tailwind font size classes to handle rem behavior */
        .text-magnifier .text-[9px] { font-size: calc(9px * var(--text-zoom-multiplier)); }
        .text-magnifier .text-[10px] { font-size: calc(10px * var(--text-zoom-multiplier)); }
        .text-magnifier .text-[11px] { font-size: calc(11px * var(--text-zoom-multiplier)); }
        .text-magnifier .text-[12px] { font-size: calc(12px * var(--text-zoom-multiplier)); }
      `}</style>

      <Header 
        user={user} 
        zoom={zoom} 
        onZoomChange={setZoom}
        textZoom={textZoom}
        onTextZoomChange={setTextZoom}
      />
      
      <div className="pt-16 flex flex-1 overflow-hidden text-magnifier">
        
        <div className="flex flex-1 overflow-hidden bg-white relative">
          {analysis && !isAnalyzing && (
            <>
              <aside 
                style={{ width: sidebarWidth, fontSize: `${sidebarFontScale}rem` }}
                className="bg-white border-r border-slate-200 flex flex-col sticky top-0 h-full overflow-y-auto no-scrollbar z-30 transition-all"
              >
                <div className={`p-2 ${sidebarWidth > 120 ? 'lg:p-6' : 'p-2'} space-y-8 flex flex-col h-full`}>
                  <div className="space-y-1">
                    {sidebarWidth > 180 && <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4 ml-2">Intelligence Nodes</p>}
                    <div className="flex flex-col gap-1">
                      <SidebarBtn active={activeTab === 'avatar-staged'} onClick={() => setActiveTab('avatar-staged')} icon={<ICONS.Trophy />} label={sidebarWidth > 180 ? "Staged Sim" : ""} scale={sidebarFontScale} />
                      <SidebarBtn active={activeTab === 'avatar2'} onClick={() => setActiveTab('avatar2')} icon={<ICONS.Sparkles />} label={sidebarWidth > 180 ? "Avatar 2.0" : ""} scale={sidebarFontScale} />
                      <SidebarBtn active={activeTab === 'avatar'} onClick={() => setActiveTab('avatar')} icon={<ICONS.Brain />} label={sidebarWidth > 180 ? "Avatar 1.0" : ""} scale={sidebarFontScale} />
                      <SidebarBtn active={activeTab === 'qa'} onClick={() => setActiveTab('qa')} icon={<ICONS.Document />} label={sidebarWidth > 180 ? "Assignment" : ""} scale={sidebarFontScale} />
                      <SidebarBtn active={activeTab === 'practice'} onClick={() => setActiveTab('practice')} icon={<ICONS.Chat />} label={sidebarWidth > 180 ? "Simulation" : ""} scale={sidebarFontScale} />
                      <SidebarBtn active={activeTab === 'audio'} onClick={() => setActiveTab('audio')} icon={<ICONS.Speaker />} label={sidebarWidth > 180 ? "Studio" : ""} scale={sidebarFontScale} />
                      <SidebarBtn active={activeTab === 'gpt'} onClick={() => setActiveTab('gpt')} icon={<ICONS.Sparkles />} label={sidebarWidth > 180 ? "Fast Ans" : ""} scale={sidebarFontScale} />
                      <SidebarBtn active={activeTab === 'context'} onClick={() => setActiveTab('context')} icon={<ICONS.Efficiency />} label={sidebarWidth > 180 ? "Config" : ""} scale={sidebarFontScale} />
                    </div>
                  </div>

                  {sidebarWidth > 180 && (
                    <div className="mt-auto pt-6 border-t border-slate-100 space-y-4">
                      <button onClick={reset} className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-slate-50 text-slate-500 text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-rose-50 hover:text-rose-600 transition-all border border-slate-200">
                        <ICONS.X className="w-3 h-3" /> Wipe Strategy
                      </button>
                    </div>
                  )}
                </div>
              </aside>
              
              <div 
                onMouseDown={startResizing}
                className="w-1.5 h-full cursor-col-resize hover:bg-indigo-400 active:bg-indigo-600 z-40 relative group transition-colors"
                title="Drag to adjust node partition"
              >
                <div className="absolute inset-y-0 -left-1 -right-1 group-hover:bg-indigo-400/10"></div>
              </div>
            </>
          )}

          <main className="flex-1 transition-all duration-300 overflow-y-auto custom-scrollbar bg-slate-50 relative">
            <div className="w-full min-h-full">
              {!analysis && !isAnalyzing ? (
                <div className="p-8 md:p-12 space-y-16 animate-in fade-in slide-in-from-top-4 duration-500 max-w-7xl mx-auto">
                  <div className="text-center space-y-2">
                    <h1 className="text-[120px] leading-[0.8] font-black text-slate-900 tracking-tighter uppercase mb-6">
                      {meetingContext.sellerCompany ? (
                        <>
                          <span className="block text-[40px] font-black text-indigo-600 tracking-[0.2em] mb-4">IDENTITY:</span>
                          {meetingContext.sellerCompany}
                        </>
                      ) : (
                        <>SPIKED<span className="text-red-600">AI</span> HUB</>
                      )}
                    </h1>
                    <p className="text-[11px] text-slate-400 font-black uppercase tracking-[0.5em] max-w-2xl mx-auto border-t border-slate-200 pt-6">
                      Cognitive Intelligence Brain Simulation
                    </p>
                  </div>

                  <div className="bg-white rounded-[3rem] shadow-2xl p-10 border border-slate-200">
                    <div className="flex items-center justify-between mb-8">
                        <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                          <ICONS.Research /> Cognitive Library Hub
                        </h3>
                    </div>
                    <DocumentGallery 
                      documents={history} 
                      onRefresh={loadHistory} 
                      selectedIds={selectedLibraryDocIds}
                      onToggleSelect={toggleLibraryDoc}
                      onSynthesize={runAnalysis}
                      isAnalyzing={isAnalyzing}
                    />
                  </div>

                  <MeetingContextConfig 
                    context={meetingContext} 
                    onContextChange={setMeetingContext} 
                    documents={history}
                  />

                  <div className="bg-white rounded-[3rem] shadow-2xl p-10 border border-slate-200">
                    <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2 mb-8">
                      <ICONS.Document /> Documentary Memory Store
                    </h3>
                    <FileUpload files={files} onFilesChange={setFiles} onUploadSuccess={loadHistory} />
                    
                    <div className="mt-12 flex flex-col items-center gap-6">
                      {error && (
                        <div className="bg-rose-50 border border-rose-100 rounded-2xl p-6 mb-8 max-w-xl text-center">
                          <p className="text-rose-600 font-bold mb-2">⚠️ Analysis Interrupted</p>
                          <p className="text-rose-500 text-sm">{error}</p>
                        </div>
                      )}
                      <button
                        onClick={runAnalysis}
                        disabled={activeDocuments.length === 0 || isAnyFileProcessing}
                        className={`flex items-center gap-3 px-16 py-6 rounded-full font-black text-xl shadow-2xl transition-all ${(activeDocuments.length > 0 && !isAnyFileProcessing) ? 'bg-indigo-600 text-white hover:bg-indigo-700 hover:scale-105 shadow-indigo-200' : 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'}`}
                      >
                        <ICONS.Brain />
                        {isAnyFileProcessing ? 'Retaining Documents...' : 'Synthesize Strategy Core'}
                      </button>
                    </div>
                  </div>
                </div>
              ) : isAnalyzing ? (
                <div className="flex flex-col items-center justify-center space-y-12 h-full min-h-[600px]">
                  <div className="relative">
                    <div className="absolute inset-0 bg-indigo-500/20 blur-[60px] rounded-full transition-all duration-700 ease-out" style={{ transform: `scale(${1 + (loadingProgress / 100)})`, opacity: 0.2 + (loadingProgress / 100) }}></div>
                    <div className="relative w-32 h-32 border-4 border-indigo-50 border-t-indigo-600 rounded-full animate-spin"></div>
                    <div className="absolute inset-0 flex items-center justify-center text-indigo-600 transition-all duration-700" style={{ transform: `scale(${1.2 + (loadingProgress / 200)})`, filter: `drop-shadow(0 0 ${loadingProgress / 5}px rgba(79, 70, 229, ${loadingProgress / 100}))` }}><ICONS.Brain className="w-10 h-10" /></div>
                    <div className="absolute -bottom-10 left-1/2 -translate-x-1/2">
                      <span className="text-3xl font-black text-slate-800 tracking-tighter">{Math.floor(loadingProgress)}<span className="text-indigo-500 text-sm ml-0.5">%</span></span>
                    </div>
                  </div>
                  <div className="text-center space-y-6 max-w-md">
                    <p className="text-2xl font-black text-slate-800 tracking-tight">{loadingStatusText}</p>
                    <div className="w-64 h-1.5 bg-slate-100 rounded-full mx-auto overflow-hidden shadow-inner">
                      <div className="h-full bg-indigo-600 transition-all duration-500 ease-out rounded-full" style={{ width: `${loadingProgress}%` }}></div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="animate-in fade-in duration-500 h-full flex flex-col">
                  {activeTab === 'context' && (
                    <div className="p-8 md:p-12 space-y-12 max-w-7xl mx-auto">
                      <div className="bg-white rounded-[3rem] shadow-2xl p-10 border border-slate-200">
                        <DocumentGallery documents={history} onRefresh={loadHistory} selectedIds={selectedLibraryDocIds} onToggleSelect={toggleLibraryDoc} onSynthesize={runAnalysis} isAnalyzing={isAnalyzing} />
                        <div className="mt-10 pt-8 border-t border-slate-100">
                           <FileUpload files={files} onFilesChange={setFiles} onUploadSuccess={loadHistory} />
                        </div>
                      </div>
                      <MeetingContextConfig context={meetingContext} onContextChange={setMeetingContext} documents={history} />
                      <div className="flex justify-center pb-10">
                        <button onClick={runAnalysis} disabled={isAnalyzing} className="px-12 py-5 bg-indigo-600 text-white rounded-full font-black text-lg shadow-2xl hover:bg-indigo-700 transition-all hover:scale-105 active:scale-95 flex items-center gap-3"><ICONS.Brain />Update Strategy</button>
                      </div>
                    </div>
                  )}
                  {activeTab === 'avatar-staged' && <AvatarSimulationStaged meetingContext={meetingContext} documents={history} />}
                  {activeTab === 'avatar2' && <AvatarSimulationV2 meetingContext={meetingContext} />}
                  {activeTab === 'avatar' && <AvatarSimulation meetingContext={meetingContext} />}
                  {activeTab === 'gpt' && <SalesGPT activeDocuments={activeDocuments} meetingContext={meetingContext} />}
                  {activeTab === 'audio' && <div className="p-8 md:p-12 max-w-7xl mx-auto flex-1 overflow-y-auto"><AudioGenerator analysis={analysis!} /></div>}
                  {activeTab === 'practice' && <PracticeSession analysis={analysis!} />}
                  {activeTab === 'qa' && <AssessmentLab activeDocuments={activeDocuments} />}
                </div>
              )}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
};

const SidebarBtn = ({ active, onClick, icon, label, scale = 1 }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string, scale?: number }) => (
  <button 
    onClick={onClick}
    className={`w-full flex items-center gap-3.5 px-5 py-4 rounded-2xl font-bold transition-all text-sm group ${
      active 
      ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-100 scale-[1.02]' 
      : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
    }`}
    style={{ transform: active ? `scale(${1.02 * (scale > 1 ? 1 : scale)})` : 'none' }}
  >
    <div 
      className={`${active ? 'text-white' : 'text-slate-400 group-hover:text-indigo-500'} transition-colors shrink-0`}
      style={{ transform: `scale(${scale})` }}
    >
      {icon}
    </div>
    {label && (
      <span 
        className="tracking-tight truncate"
        style={{ fontSize: `${scale * 0.875}rem` }}
      >
        {label}
      </span>
    )}
  </button>
);

export default App;
