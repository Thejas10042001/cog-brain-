
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
import { AvatarSimulationV2 } from './components/AvatarSimulationV2';
import { AvatarSimulationStaged } from './components/AvatarSimulationStaged';
import { analyzeSalesContext } from './services/geminiService';
import { fetchDocumentsFromFirebase, subscribeToAuth, User } from './services/firebaseService';
import { AnalysisResult, UploadedFile, MeetingContext, StoredDocument } from './types';
import { ICONS } from './constants';

const ALL_ANSWER_STYLES = ["Executive Summary", "ROI Forecast", "SWOT Analysis", "Value Proposition"];

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
  const [activeTab, setActiveTab] = useState<'context' | 'practice' | 'audio' | 'gpt' | 'qa' | 'avatar2' | 'avatar-staged'>('context');

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
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (user) loadHistory();
  }, [user, loadHistory]);

  const toggleLibraryDoc = (id: string) => {
    setSelectedLibraryDocIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const activeDocuments = useMemo(() => {
    const sessionDocs = files.filter(f => f.status === 'ready').map(f => ({ name: f.name, content: f.content }));
    const libDocs = history.filter(d => selectedLibraryDocIds.includes(d.id)).map(d => ({ name: d.name, content: d.content }));
    return [...sessionDocs, ...libDocs];
  }, [files, history, selectedLibraryDocIds]);

  const runAnalysis = useCallback(async () => {
    if (activeDocuments.length === 0) {
      setError("Please select or upload document nodes to begin synthesis.");
      return;
    }
    setIsAnalyzing(true);
    setLoadingProgress(0);
    setError(null);

    const progressInterval = setInterval(() => {
      setLoadingProgress(prev => (prev < 95 ? prev + Math.random() * 5 : prev));
    }, 400);

    try {
      const combinedContent = activeDocuments.map(d => `DOC: ${d.name}\n${d.content}`).join('\n\n');
      const result = await analyzeSalesContext(combinedContent, meetingContext);
      clearInterval(progressInterval);
      setLoadingProgress(100);
      setTimeout(() => {
        setAnalysis(result);
        setIsAnalyzing(false);
        setActiveTab('qa');
      }, 500);
    } catch (err: any) {
      clearInterval(progressInterval);
      setError(err.message || "Synthesis failed.");
      setIsAnalyzing(false);
    }
  }, [activeDocuments, meetingContext]);

  if (authLoading) return <div className="min-h-screen flex items-center justify-center bg-slate-50"><div className="w-12 h-12 border-4 border-red-600/20 border-t-red-600 rounded-full animate-spin" /></div>;
  if (!user) return <Auth />;

  return (
    <div className="min-h-screen bg-[#FDFDFD] flex flex-col text-slate-900">
      <Header user={user} />
      
      <div className="flex flex-1 pt-16 h-screen">
        <aside className="w-80 bg-white border-r border-slate-100 flex flex-col p-6 space-y-8 z-40 fixed h-[calc(100vh-64px)]">
          <div className="space-y-1">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-3 mb-4">Strategic Core</p>
            <nav className="flex flex-col gap-1.5">
              <SidebarItem active={activeTab === 'context'} onClick={() => setActiveTab('context')} icon={<ICONS.Efficiency />} label="Intel Config" />
              <SidebarItem active={activeTab === 'gpt'} onClick={() => setActiveTab('gpt')} icon={<ICONS.Chat />} label="Intelligence Studio" />
              <SidebarItem active={activeTab === 'avatar-staged'} onClick={() => setActiveTab('avatar-staged')} icon={<ICONS.Trophy />} label="Staged Sim" />
              <SidebarItem active={activeTab === 'avatar2'} onClick={() => setActiveTab('avatar2')} icon={<ICONS.Brain />} label="Avatar Simulation" />
              <SidebarItem active={activeTab === 'practice'} onClick={() => setActiveTab('practice')} icon={<ICONS.Speaker />} label="Verbal Mastery" />
              <SidebarItem active={activeTab === 'qa'} onClick={() => setActiveTab('qa')} icon={<ICONS.Document />} label="Assessment Lab" />
              <SidebarItem active={activeTab === 'audio'} onClick={() => setActiveTab('audio')} icon={<ICONS.Play />} label="Coaching Audio" />
            </nav>
          </div>
          <div className="mt-auto space-y-4">
            <div className="bg-red-50 p-6 rounded-[2rem] border border-red-100 shadow-sm">
               <div className="flex items-center gap-2 mb-3">
                  <div className="w-2 h-2 bg-red-600 rounded-full animate-pulse" />
                  <span className="text-[10px] font-black text-red-600 uppercase tracking-widest">Active Analysis</span>
               </div>
               <p className="text-[11px] font-bold text-red-900 leading-relaxed">
                 {analysis ? `Synced with ${meetingContext.clientCompany || 'Prospect'}` : 'Awaiting Ingestion'}
               </p>
            </div>
            <button onClick={() => window.location.reload()} className="w-full py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-red-600 transition-colors">Wipe Context</button>
          </div>
        </aside>

        <main className="flex-1 ml-80 overflow-y-auto no-scrollbar bg-[#FDFDFD] p-12">
          <div className="max-w-6xl mx-auto">
            {isAnalyzing ? (
              <div className="h-[70vh] flex flex-col items-center justify-center space-y-10 animate-in fade-in zoom-in-95">
                <div className="relative">
                  <div className="w-32 h-32 border-4 border-red-50 border-t-red-600 rounded-full animate-spin" />
                  <div className="absolute inset-0 flex items-center justify-center text-red-600 scale-150"><ICONS.Brain /></div>
                </div>
                <div className="text-center space-y-4">
                  <h3 className="text-3xl font-black tracking-tight">Synthesizing Strategy</h3>
                  <div className="w-64 h-1.5 bg-slate-100 rounded-full mx-auto overflow-hidden">
                    <div className="h-full bg-red-600 transition-all duration-300 ease-out" style={{ width: `${loadingProgress}%` }} />
                  </div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em] animate-pulse">Node Alignment: {Math.round(loadingProgress)}%</p>
                </div>
              </div>
            ) : (
              <div className="animate-in fade-in duration-700">
                {activeTab === 'context' && (
                  <div className="space-y-12">
                    <section className="bg-white p-10 rounded-[3rem] shadow-2xl border border-slate-100">
                      <div className="flex items-center gap-3 mb-8">
                         <div className="p-2 bg-red-600 text-white rounded-xl"><ICONS.Research /></div>
                         <h3 className="text-xl font-bold">Cognitive Library Hub</h3>
                      </div>
                      <DocumentGallery documents={history} onRefresh={loadHistory} selectedIds={selectedLibraryDocIds} onToggleSelect={toggleLibraryDoc} onSynthesize={runAnalysis} isAnalyzing={isAnalyzing} />
                    </section>
                    <MeetingContextConfig context={meetingContext} onContextChange={setMeetingContext} documents={history} />
                    <div className="flex justify-center pt-8">
                       <button onClick={runAnalysis} disabled={activeDocuments.length === 0} className="px-16 py-6 bg-red-600 text-white rounded-full font-black text-xl shadow-2xl shadow-red-200 hover:bg-red-700 hover:scale-105 active:scale-95 transition-all flex items-center gap-4">
                         <ICONS.Brain /> Synthesize Intelligence
                       </button>
                    </div>
                  </div>
                )}
                {activeTab === 'gpt' && <SalesGPT activeDocuments={activeDocuments} meetingContext={meetingContext} />}
                {activeTab === 'avatar2' && <AvatarSimulationV2 meetingContext={meetingContext} />}
                {activeTab === 'avatar-staged' && <AvatarSimulationStaged meetingContext={meetingContext} documents={history} />}
                {activeTab === 'practice' && analysis && <PracticeSession analysis={analysis} />}
                {activeTab === 'qa' && <AssessmentLab activeDocuments={activeDocuments} />}
                {activeTab === 'audio' && analysis && <AudioGenerator analysis={analysis} />}
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
};

const SidebarItem = ({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) => (
  <button onClick={onClick} className={`w-full flex items-center gap-4 px-6 py-4 rounded-2xl font-bold text-sm transition-all group ${active ? 'bg-red-600 text-white shadow-xl shadow-red-200' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'}`}>
    <div className={active ? 'text-white' : 'text-slate-400 group-hover:text-red-500'}>{icon}</div>
    <span>{label}</span>
  </button>
);

export default App;
