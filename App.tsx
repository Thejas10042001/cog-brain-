
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
import { fetchDocumentsFromFirebase, isFirebaseActive, getFirebasePermissionError, subscribeToAuth, User } from './services/firebaseService';
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
  const [statusMessage, setStatusMessage] = useState("");
  const [activeTab, setActiveTab] = useState<'context' | 'practice' | 'audio' | 'gpt' | 'qa' | 'avatar' | 'avatar2' | 'avatar-staged'>('context');

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
    kycDocId: ""
  });

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
  const readyFilesCount = useMemo(() => files.filter(f => f.status === 'ready').length, [files]);

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
    setStatusMessage("Synthesizing Intelligence Core...");

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
    } finally {
      setStatusMessage("");
    }
  }, [activeDocuments, meetingContext, analysis, generateStateHash]);

  const loadingStatusText = useMemo(() => {
    if (loadingProgress < 20) return "Neural Ingestion: Parsing Documentary Nodes...";
    if (loadingProgress < 40) return "Context Alignment: Mapping Seller/Prospect Domains...";
    if (loadingProgress < 60) return "Psychological Synthesis: Inferring Buyer Resistance...";
    if (loadingProgress < 80) return "Strategy Extraction: Modeling Competitive Wedge...";
    if (loadingProgress < 95) return "Refining Intelligence: Calibrating Master Playbook...";
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
        <div className="w-12 h-12 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin"></div>
        <p className="mt-6 text-[10px] font-black uppercase text-slate-400 tracking-widest animate-pulse">Establishing Secure Neural Link...</p>
      </div>
    );
  }

  if (!user) {
    return <Auth />;
  }

  const hasPermissionError = getFirebasePermissionError();

  return (
    <div className="min-h-screen bg-slate-50 overflow-x-hidden flex flex-col">
      <Header user={user} />
      
      <div className="pt-16 flex flex-1">
        {analysis && !isAnalyzing && (
          <aside className="w-64 bg-white/80 backdrop-blur-xl border-r border-slate-200 flex flex-col fixed h-[calc(100vh-64px)] overflow-y-auto no-scrollbar z-30">
            <div className="p-4 space-y-6 flex flex-col h-full">
              <div className="space-y-1">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3 ml-2">Intelligence Nodes</p>
                <div className="flex flex-col gap-0.5">
                  <SidebarBtn active={activeTab === 'avatar-staged'} onClick={() => setActiveTab('avatar-staged')} icon={<ICONS.Trophy />} label="Staged Sim" />
                  <SidebarBtn active={activeTab === 'avatar2'} onClick={() => setActiveTab('avatar2')} icon={<ICONS.Sparkles />} label="Avatar 2.0" />
                  <SidebarBtn active={activeTab === 'avatar'} onClick={() => setActiveTab('avatar')} icon={<ICONS.Brain />} label="Avatar 1.0" />
                  <SidebarBtn active={activeTab === 'qa'} onClick={() => setActiveTab('qa')} icon={<ICONS.Document />} label="Assignment" />
                  <SidebarBtn active={activeTab === 'practice'} onClick={() => setActiveTab('practice')} icon={<ICONS.Chat />} label="Simulation" />
                  <SidebarBtn active={activeTab === 'audio'} onClick={() => setActiveTab('audio')} icon={<ICONS.Speaker />} label="Coaching" />
                  <SidebarBtn active={activeTab === 'gpt'} onClick={() => setActiveTab('gpt')} icon={<ICONS.Sparkles />} label="Answering" />
                  <SidebarBtn active={activeTab === 'context'} onClick={() => setActiveTab('context')} icon={<ICONS.Efficiency />} label="Config" />
                </div>
              </div>

              <div className="mt-auto pt-4 border-t border-slate-100 space-y-3">
                <div className="bg-emerald-50/50 border border-emerald-100 p-3 rounded-xl">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></div>
                    <span className="text-[9px] font-black uppercase text-emerald-700 tracking-widest">Active Sync</span>
                  </div>
                  <p className="text-[9px] font-bold text-emerald-600/80 leading-tight truncate">
                    {meetingContext.clientCompany || 'Prospect'}
                  </p>
                </div>
                
                <button 
                  onClick={reset} 
                  className="w-full flex items-center justify-center gap-2 py-2 px-3 bg-slate-50 text-slate-400 text-[9px] font-black uppercase tracking-widest rounded-lg hover:bg-rose-50 hover:text-rose-600 transition-all border border-slate-100"
                >
                  <ICONS.X className="w-2.5 h-2.5" /> Wipe context
                </button>
              </div>
            </div>
          </aside>
        )}

        <main className={`flex-1 transition-all duration-300 ${analysis && !isAnalyzing ? 'ml-64' : ''}`}>
          <div className="w-full h-full">
            {!analysis && !isAnalyzing ? (
              <div className="p-6 md:p-10 space-y-10 animate-in fade-in slide-in-from-top-4 duration-500 max-w-6xl mx-auto">
                <div className="text-center space-y-3">
                  <h1 className="text-5xl font-black text-slate-900 tracking-tighter">
                    SPIKED<span className="text-red-600">AI</span>
                  </h1>
                  <p className="text-sm text-slate-400 font-bold uppercase tracking-[0.3em] max-w-2xl mx-auto">
                    Cognitive Brain Simulation
                  </p>
                </div>

                <div className="bg-white rounded-3xl shadow-xl p-8 border border-slate-200">
                   <div className="flex items-center justify-between mb-6">
                      <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                        <ICONS.Research /> Cognitive Library
                      </h3>
                      {(!isFirebaseActive() || hasPermissionError) && (
                        <span className={`px-2 py-0.5 text-[8px] font-black uppercase tracking-widest rounded-md border ${hasPermissionError ? 'bg-rose-50 text-rose-600 border-rose-100' : 'bg-amber-50 text-amber-600 border-amber-100'}`}>
                          {hasPermissionError ? 'Rule Error' : 'Offline'}
                        </span>
                      )}
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

                <div className="bg-white rounded-3xl shadow-xl p-8 border border-slate-200">
                  <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2 mb-6">
                    <ICONS.Document /> Intake Hub
                  </h3>
                  <FileUpload files={files} onFilesChange={setFiles} onUploadSuccess={loadHistory} />
                  
                  <div className="mt-10 flex flex-col items-center gap-4">
                    {error && (
                      <div className="bg-rose-50 border border-rose-100 rounded-xl p-4 mb-6 max-w-md text-center">
                        <p className="text-rose-600 font-bold text-xs">⚠️ Analysis Interrupted</p>
                        <p className="text-rose-500 text-[11px] mt-1">{error}</p>
                      </div>
                    )}
                    <button
                      onClick={runAnalysis}
                      disabled={activeDocuments.length === 0 || isAnyFileProcessing}
                      className={`
                        flex items-center gap-3 px-12 py-4 rounded-full font-black text-lg shadow-xl transition-all
                        ${(activeDocuments.length > 0 && !isAnyFileProcessing)
                          ? 'bg-indigo-600 text-white hover:bg-indigo-700 hover:scale-105 active:scale-95 shadow-indigo-200' 
                          : 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'}
                      `}
                    >
                      <ICONS.Brain />
                      {isAnyFileProcessing ? 'Retaining...' : 'Synthesize Strategy'}
                    </button>
                  </div>
                </div>
              </div>
            ) : isAnalyzing ? (
              <div className="flex flex-col items-center justify-center space-y-10 h-[calc(100vh-64px)]">
                <div className="relative">
                  <div className="absolute inset-0 bg-indigo-500/10 blur-[40px] rounded-full"></div>
                  <div className="relative w-24 h-24 border-4 border-indigo-50 border-t-indigo-600 rounded-full animate-spin"></div>
                  <div className="absolute inset-0 flex items-center justify-center text-indigo-600">
                    <ICONS.Brain className="w-8 h-8" />
                  </div>
                  <div className="absolute -bottom-8 left-1/2 -translate-x-1/2">
                    <span className="text-2xl font-black text-slate-800 tracking-tighter">
                      {Math.floor(loadingProgress)}<span className="text-indigo-500 text-xs ml-0.5">%</span>
                    </span>
                  </div>
                </div>

                <div className="text-center space-y-4 max-w-xs">
                  <p className="text-xl font-black text-slate-800 tracking-tight">{loadingStatusText}</p>
                  <div className="w-48 h-1 bg-slate-100 rounded-full mx-auto overflow-hidden">
                    <div className="h-full bg-indigo-600 transition-all duration-500 ease-out" style={{ width: `${loadingProgress}%` }}></div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="animate-in fade-in duration-500 h-full flex flex-col">
                {activeTab === 'context' && (
                  <div className="p-6 md:p-8 space-y-8 max-w-6xl mx-auto">
                    <div className="bg-white rounded-3xl shadow-lg p-8 border border-slate-200">
                      <DocumentGallery 
                        documents={history} 
                        onRefresh={loadHistory} 
                        selectedIds={selectedLibraryDocIds}
                        onToggleSelect={toggleLibraryDoc}
                        onSynthesize={runAnalysis}
                        isAnalyzing={isAnalyzing}
                      />
                      <div className="mt-8 pt-6 border-t border-slate-100">
                         <FileUpload files={files} onFilesChange={setFiles} onUploadSuccess={loadHistory} />
                      </div>
                    </div>
                    <MeetingContextConfig 
                      context={meetingContext} 
                      onContextChange={setMeetingContext} 
                      documents={history}
                    />
                    <div className="flex justify-center pb-8">
                      <button 
                        onClick={runAnalysis}
                        className="px-10 py-4 bg-indigo-600 text-white rounded-full font-black text-base shadow-lg hover:bg-indigo-700 transition-all flex items-center gap-2"
                      >
                        <ICONS.Brain /> Update Strategy
                      </button>
                    </div>
                  </div>
                )}
                {activeTab === 'avatar-staged' && <AvatarSimulationStaged meetingContext={meetingContext} documents={history} />}
                {activeTab === 'avatar2' && <AvatarSimulationV2 meetingContext={meetingContext} />}
                {activeTab === 'avatar' && <AvatarSimulation meetingContext={meetingContext} />}
                {activeTab === 'gpt' && <SalesGPT activeDocuments={activeDocuments} meetingContext={meetingContext} />}
                {activeTab === 'audio' && <div className="p-6 md:p-8 max-w-6xl mx-auto flex-1 overflow-y-auto no-scrollbar"><AudioGenerator analysis={analysis!} /></div>}
                {activeTab === 'practice' && <PracticeSession analysis={analysis!} />}
                {activeTab === 'qa' && <AssessmentLab activeDocuments={activeDocuments} />}
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
};

const SidebarBtn = ({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) => (
  <button 
    onClick={onClick}
    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-all text-sm group ${
      active 
      ? 'bg-indigo-600 text-white shadow-md' 
      : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'
    }`}
  >
    <div className={`${active ? 'text-white' : 'text-slate-400 group-hover:text-indigo-500'} transition-colors`}>
      {icon}
    </div>
    <span className="tracking-tight text-[13px]">{label}</span>
  </button>
);

export default App;
