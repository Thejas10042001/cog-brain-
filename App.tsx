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
import { VoiceAssistant } from './components/VoiceAssistant';
import { analyzeSalesContext } from './services/geminiService';
import { fetchDocumentsFromFirebase, subscribeToAuth, User, saveMeetingContext, fetchMeetingContext, deleteMeetingContext } from './services/firebaseService';
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
  const [isRestoring, setIsRestoring] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'context' | 'practice' | 'audio' | 'gpt' | 'qa' | 'avatar' | 'avatar2' | 'avatar-staged'>('context');
  const [showNodeInfo, setShowNodeInfo] = useState<string | null>(null);
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const [darkMode, setDarkMode] = useState(false);

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  const NODE_DETAILS: Record<string, { label: string; feature: string; purpose: string; howItHelps: string; audioText: string; guideText: string }> = {
    'context': {
      label: 'Settings',
      feature: 'Strategic Priming & Context Configuration',
      purpose: 'Define the seller/client landscape, upload documents, and set simulation parameters.',
      howItHelps: 'Ensures the AI models are grounded in your specific deal reality for maximum relevance.',
      audioText: 'Welcome to Settings. The purpose of this feature is to define the seller and client landscape, upload documents, and set simulation parameters. It helps by ensuring the AI models are grounded in your specific deal reality for maximum relevance.',
      guideText: 'To operate Settings, look at the top navigation bar. You will see a Node Dial dropdown to jump between steps. In Step 1, use the Upload area to add documents. In Step 2, use the dropdown to select your Neural Anchor. Once all steps are configured, click the large purple Synthesize Strategy Core button at the bottom to prime the AI.'
    },
    'qa': {
      label: 'Hands-on Assignment',
      feature: 'Cognitive Assessment Lab',
      purpose: 'Test your knowledge of the deal and product through structured assignments.',
      howItHelps: 'Validates your readiness and identifies information gaps before you face the customer.',
      audioText: 'This is the Hands-on Assignment lab. Its purpose is to test your knowledge of the deal and product through structured assignments. This helps by validating your readiness and identifying information gaps before you face the customer.',
      guideText: 'In the Assignment Lab, first look at the top selection area to pick a document from your library. Click the Generate Assignment button to receive your tasks. Answer the questions in the text fields provided and click the Submit button at the bottom for a cognitive evaluation of your deal readiness.'
    },
    'avatar-staged': {
      label: 'Stage Simulation',
      feature: 'Progressive Deal Stages',
      purpose: 'Roleplay through specific meeting phases like Ice Breakers, Pricing, and Legal.',
      howItHelps: 'Allows you to master the nuances of each stage of the sales cycle.',
      audioText: 'Welcome to Stage Simulation. The purpose is to roleplay through specific meeting phases like Ice Breakers, Pricing, and Legal. It helps by allowing you to master the nuances of each stage of the sales cycle.',
      guideText: 'Start by looking at the interactive map in the center. Select a meeting stage, such as Ice Breaker or Pricing. Once selected, click the Commence Stage button to start the roleplay. During the session, use the End Stage button to stop and receive immediate feedback on that specific phase.'
    },
    'avatar': {
      label: 'Avatar 1.0',
      feature: 'Dual-Mode Buyer Simulation',
      purpose: 'Real-time dialogue with a skeptical CIO persona.',
      howItHelps: 'Sharpens your strategic reflexes and objection-handling skills in a low-stakes environment.',
      audioText: 'Avatar 1.0 is your dual-mode buyer simulation. The purpose is to engage in real-time dialogue with a skeptical CIO persona. It helps by sharpening your strategic reflexes and objection-handling skills in a low-stakes environment.',
      guideText: 'Engage with the CIO by clicking the large Start Simulation button in the center. Speak clearly into your microphone when the pulse animation is active. To finish, look at the Mastery Log on the right and click End Session to stop and generate your performance report.'
    },
    'avatar2': {
      label: 'Avatar 2.0',
      feature: 'Multi-Persona Enterprise Evaluation',
      purpose: 'Switch between CIO, CFO, and IT Director roles for comprehensive testing.',
      howItHelps: 'Prepares you for the diverse perspectives and scrutiny of a full buying committee.',
      audioText: 'Avatar 2.0 offers multi-persona evaluation. The purpose is to switch between CIO, CFO, and IT Director roles for comprehensive testing. It helps by preparing you for the diverse perspectives and scrutiny of a full buying committee.',
      guideText: 'First, select your target persona from the cards at the top: CIO, CFO, or IT Director. Click the Activate Persona button to begin. You can switch personas mid-session using the top cards to test different stakeholder perspectives. Use the End Session button to finalize the audit.'
    },
    'gpt': {
      label: 'Spiked GPT',
      feature: 'Strategic Knowledge Retrieval',
      purpose: 'Fast, grounded answering engine for any deal-related question.',
      howItHelps: 'Provides instant access to winning strategies and data points from your uploaded context.',
      audioText: 'This is Spiked GPT, your strategic knowledge engine. The purpose is to provide a fast, grounded answering engine for any deal-related question. It helps by providing instant access to winning strategies and data points from your uploaded context.',
      guideText: 'Type any question about your deal in the input box at the very bottom of the screen. Spiked GPT will retrieve grounded answers from your documents and display them in the chat history above. Use the Clear Chat button in the header if you wish to start a new inquiry.'
    },
    'practice': {
      label: 'Grooming Lab',
      feature: 'Verbal Architecture & Pacing Audit',
      purpose: 'Practice your delivery and receive an elite audit on tone, grammar, and pacing.',
      howItHelps: 'Refines your vocal presence and ensures your delivery is as strong as your strategy.',
      audioText: 'Welcome to the Grooming Lab. The purpose is to practice your delivery and receive an elite audit on tone, grammar, and pacing. It helps by refining your vocal presence and ensuring your delivery is as strong as your strategy.',
      guideText: 'Select your roleplay mode using the toggle at the top: Buyer Roleplay or Seller Roleplay. Click the large Commence Interaction button to start speaking. The lab will audit your tone and pacing in real-time. Use the X button in the Mastery Log header on the right to end the session.'
    },
    'audio': {
      label: 'Studio',
      feature: 'High-Fidelity Audio Generation',
      purpose: 'Generate professional-grade audio samples of your winning pitches.',
      howItHelps: 'Allows you to hear the ideal delivery and use it for rehearsal or internal alignment.',
      audioText: 'This is the Studio. The purpose is to generate professional-grade audio samples of your winning pitches. It helps by allowing you to hear the ideal delivery and use it for rehearsal or internal alignment.',
      guideText: 'Enter the text you want to hear in the large Pitch Script area on the left. Select a voice profile from the options on the right and click the Generate Audio button. Once synthesized, you can play or download the resulting high-fidelity sample for your rehearsal.'
    }
  };

  const playNodeAudio = (text: string) => {
    window.dispatchEvent(new CustomEvent('cogni-speak', { detail: { text } }));
  };

  const handleNodeClick = (tab: any) => {
    if (activeTab === tab) return;
    setShowNodeInfo(tab);
    playNodeAudio(NODE_DETAILS[tab].audioText);
  };

  const confirmNodeStart = () => {
    if (showNodeInfo) {
      const tab = showNodeInfo;
      setActiveTab(tab as any);
      setShowNodeInfo(null);
      // Play detailed guide audio
      playNodeAudio(NODE_DETAILS[tab].guideText);
    }
  };

  const [hasInteracted, setHasInteracted] = useState(false);

  useEffect(() => {
    const handleInteraction = () => setHasInteracted(true);
    window.addEventListener('mousedown', handleInteraction);
    window.addEventListener('keydown', handleInteraction);
    return () => {
      window.removeEventListener('mousedown', handleInteraction);
      window.removeEventListener('keydown', handleInteraction);
    };
  }, []);

  // Auto-narrate on tab change
  useEffect(() => {
    if (analysis && activeTab && hasInteracted) {
      // Small delay to ensure screen is ready
      const timer = setTimeout(() => {
        playNodeAudio(NODE_DETAILS[activeTab].audioText);
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [activeTab, !!analysis, hasInteracted]);

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
    voiceMode: 'upload',
    difficulty: 'Medium'
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
    
    // Fetch saved meeting context
    const savedData = await fetchMeetingContext();
    if (savedData) {
      const { userId, updatedAt, meetingContext: savedContext, selectedLibraryDocIds: savedDocIds, analysis: savedAnalysis } = savedData;
      
      setIsRestoring(true);
      setLoadingProgress(0);

      if (savedContext) setMeetingContext(prev => ({ ...prev, ...savedContext }));
      if (savedDocIds) setSelectedLibraryDocIds(savedDocIds);
      
      // Simulate neural restoration progress
      const interval = setInterval(() => {
        setLoadingProgress(p => {
          if (p >= 100) {
            clearInterval(interval);
            return 100;
          }
          return p + 5;
        });
      }, 100);

      setTimeout(() => {
        if (savedAnalysis) {
          setAnalysis(savedAnalysis);
          setActiveTab('qa');
        } else {
          // If we have documents but no analysis, we can trigger analysis
          setShouldAutoAnalyze(true);
        }
        setIsRestoring(false);
      }, 2500);
    }
  }, [user]);

  const [shouldAutoAnalyze, setShouldAutoAnalyze] = useState(false);

  useEffect(() => {
    if (shouldAutoAnalyze && history.length > 0 && user) {
      // Trigger analysis if we have a saved context and documents are loaded
      const hasDocs = history.some(d => selectedLibraryDocIds.includes(d.id)) || files.length > 0;
      if (hasDocs) {
        runAnalysis(true);
      }
      setShouldAutoAnalyze(false);
    }
  }, [shouldAutoAnalyze, history, user, selectedLibraryDocIds, files]);

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

  const runAnalysis = useCallback(async (isAuto = false) => {
    if (activeDocuments.length === 0) {
      if (!isAuto) setError("Please ensure at least one document (from library or upload) is ready for analysis.");
      return;
    }

    const currentHash = generateStateHash();
    
    if (analysis && currentHash === lastAnalyzedHash.current) {
      setActiveTab(isAuto ? 'qa' : 'context');
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
      
      setTimeout(async () => {
        setAnalysis(result);
        lastAnalyzedHash.current = currentHash;
        setIsAnalyzing(false);
        setActiveTab(isAuto ? 'qa' : 'context');
        
        // Save context and analysis to Firebase
        if (!isAuto) {
          await saveMeetingContext({ meetingContext, selectedLibraryDocIds, analysis: result });
        }
      }, 800);

    } catch (err: any) {
      clearInterval(progressInterval);
      console.error(err);
      setError(err.message || "An unexpected error occurred during analysis.");
      setIsAnalyzing(false);
    }
  }, [activeDocuments, meetingContext, analysis, generateStateHash]);

  const loadingStatusText = useMemo(() => {
    if (isRestoring) {
      if (loadingProgress < 30) return "Neural Link: Establishing Secure Connection...";
      if (loadingProgress < 60) return "Context Sync: Restoring Strategic Parameters...";
      if (loadingProgress < 90) return "Intelligence Core: Re-aligning Cognitive Nodes...";
      return "Finalizing Neural Restoration...";
    }
    if (loadingProgress < 20) return "Neural Ingestion: Parsing Documentary Nodes...";
    if (loadingProgress < 40) return "Context Alignment: Mapping Seller/Prospect Domains...";
    if (loadingProgress < 60) return "Psychological Synthesis: Inferring Buyer Resistance...";
    if (loadingProgress < 80) return "Strategy Extraction: Modeling Competitive Wedge...";
    return "Finalizing Core Strategy Brief...";
  }, [loadingProgress]);

  const reset = async () => {
    if(confirm("Are you sure you want to wipe current strategy context?")) {
      setFiles([]);
      setSelectedLibraryDocIds([]);
      setAnalysis(null);
      lastAnalyzedHash.current = null;
      setError(null);
      setActiveTab('context');
      
      // Delete from Firebase
      await deleteMeetingContext();
    }
  };

  const handleSaveContext = async () => {
    await saveMeetingContext({ meetingContext, selectedLibraryDocIds, analysis });
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
      className="min-h-screen bg-white flex flex-col transition-all duration-300 ease-in-out origin-top-left"
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
        darkMode={darkMode}
        onDarkModeToggle={() => setDarkMode(!darkMode)}
      />

      <VoiceAssistant activeTab={activeTab} user={user} />

      {/* Node Info Overlay */}
      {showNodeInfo && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-4 animate-in fade-in duration-300">
          <div className="bg-white rounded-[3rem] shadow-2xl max-w-2xl w-full overflow-hidden border border-slate-200 animate-in zoom-in-95 duration-300">
            <div className="p-12 space-y-8">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <h2 className="text-4xl font-black text-slate-900 tracking-tighter uppercase">{NODE_DETAILS[showNodeInfo].label}</h2>
                  <p className="text-indigo-600 font-black text-xs uppercase tracking-widest">{NODE_DETAILS[showNodeInfo].feature}</p>
                </div>
                <div className={`w-16 h-16 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600 ${isAudioPlaying ? 'animate-pulse' : ''}`}>
                  <ICONS.Speaker className="w-8 h-8" />
                </div>
              </div>

              <div className="space-y-6">
                <div className="space-y-2">
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">The Purpose</h4>
                  <p className="text-lg font-bold text-slate-700 leading-relaxed">{NODE_DETAILS[showNodeInfo].purpose}</p>
                </div>
                <div className="space-y-2">
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">How it helps</h4>
                  <p className="text-lg font-bold text-slate-700 leading-relaxed">{NODE_DETAILS[showNodeInfo].howItHelps}</p>
                </div>
              </div>

              <div className="flex gap-4 pt-4">
                <button 
                  onClick={() => {
                    setShowNodeInfo(null);
                    // Send empty speak request to stop current audio
                    window.dispatchEvent(new CustomEvent('cogni-speak', { detail: { text: '' } }));
                  }}
                  className="flex-1 py-5 bg-slate-100 text-slate-600 rounded-2xl font-black uppercase tracking-widest hover:bg-slate-200 transition-all"
                >
                  Cancel
                </button>
                <button 
                  onClick={confirmNodeStart}
                  className="flex-2 py-5 bg-indigo-600 text-white rounded-2xl font-black uppercase tracking-widest hover:bg-indigo-700 shadow-xl shadow-indigo-200 transition-all flex items-center justify-center gap-3"
                >
                  Start Using Feature <ICONS.ArrowRight className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      
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
                      <SidebarBtn active={activeTab === 'context' || showNodeInfo === 'context'} onClick={() => handleNodeClick('context')} icon={<ICONS.Efficiency />} label={sidebarWidth > 180 ? "Settings" : ""} scale={sidebarFontScale} />
                      <SidebarBtn active={activeTab === 'qa' || showNodeInfo === 'qa'} onClick={() => handleNodeClick('qa')} icon={<ICONS.QuestionAnswer />} label={sidebarWidth > 180 ? "Hands-on Assignment" : ""} scale={sidebarFontScale} />
                      <SidebarBtn active={activeTab === 'avatar-staged' || showNodeInfo === 'avatar-staged'} onClick={() => handleNodeClick('avatar-staged')} icon={<ICONS.Map />} label={sidebarWidth > 180 ? "Stage Simulation" : ""} scale={sidebarFontScale} />
                      <SidebarBtn active={activeTab === 'avatar' || showNodeInfo === 'avatar'} onClick={() => handleNodeClick('avatar')} icon={<ICONS.Brain />} label={sidebarWidth > 180 ? "Avatar 1.0" : ""} scale={sidebarFontScale} />
                      <SidebarBtn active={activeTab === 'avatar2' || showNodeInfo === 'avatar2'} onClick={() => handleNodeClick('avatar2')} icon={<ICONS.Sparkles />} label={sidebarWidth > 180 ? "Avatar 2.0" : ""} scale={sidebarFontScale} />
                      <SidebarBtn active={activeTab === 'gpt' || showNodeInfo === 'gpt'} onClick={() => handleNodeClick('gpt')} icon={<ICONS.SpikedGPT />} label={sidebarWidth > 180 ? "Spiked GPT" : ""} scale={sidebarFontScale} />
                      <SidebarBtn active={activeTab === 'practice' || showNodeInfo === 'practice'} onClick={() => handleNodeClick('practice')} icon={<ICONS.Chat />} label={sidebarWidth > 180 ? "Grooming Lab" : ""} scale={sidebarFontScale} />
                      <SidebarBtn active={activeTab === 'audio' || showNodeInfo === 'audio'} onClick={() => handleNodeClick('audio')} icon={<ICONS.Speaker />} label={sidebarWidth > 180 ? "Studio" : ""} scale={sidebarFontScale} />
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

          <main className="flex-1 transition-all duration-300 overflow-y-auto custom-scrollbar bg-white relative">
            <div className="w-full min-h-full">
              {!analysis && !isAnalyzing && !isRestoring ? (
                <div className="px-4 md:px-8 py-8 md:py-12 space-y-12 animate-in fade-in slide-in-from-top-4 duration-500 w-full">
                  <div className="text-center space-y-4">
                    <h1 className="text-6xl font-black text-slate-900 tracking-tighter">
                      SPIKED<span className="text-red-600">AI</span> Hub
                    </h1>
                    <p className="text-xl text-slate-400 font-bold uppercase tracking-[0.3em] max-w-2xl mx-auto">
                      Cognitive Intelligence Brain Simulation
                    </p>
                  </div>

                  <MeetingContextConfig 
                    context={meetingContext} 
                    onContextChange={setMeetingContext} 
                    documents={history}
                    files={files}
                    onFilesChange={setFiles}
                    onUploadSuccess={loadHistory}
                    selectedLibraryDocIds={selectedLibraryDocIds}
                    onToggleLibraryDoc={toggleLibraryDoc}
                    onSynthesize={runAnalysis}
                    onSave={handleSaveContext}
                    isAnalyzing={isAnalyzing}
                    hasAnalysis={!!analysis}
                  />
                </div>
              ) : (isAnalyzing || isRestoring) ? (
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
                    <div className="px-4 md:px-8 py-8 md:py-12 space-y-12 w-full">
                      <MeetingContextConfig 
                        context={meetingContext} 
                        onContextChange={setMeetingContext} 
                        documents={history}
                        files={files}
                        onFilesChange={setFiles}
                        onUploadSuccess={loadHistory}
                        selectedLibraryDocIds={selectedLibraryDocIds}
                        onToggleLibraryDoc={toggleLibraryDoc}
                        onSynthesize={runAnalysis}
                        onSave={handleSaveContext}
                        isAnalyzing={isAnalyzing}
                        hasAnalysis={!!analysis}
                      />
                    </div>
                  )}
                  {activeTab === 'avatar-staged' && <AvatarSimulationStaged meetingContext={meetingContext} documents={history} onContextChange={setMeetingContext} />}
                  {activeTab === 'avatar2' && <AvatarSimulationV2 meetingContext={meetingContext} onContextChange={setMeetingContext} />}
                  {activeTab === 'avatar' && <AvatarSimulation meetingContext={meetingContext} onContextChange={setMeetingContext} />}
                  {activeTab === 'gpt' && <SalesGPT activeDocuments={activeDocuments} meetingContext={meetingContext} />}
                  {activeTab === 'audio' && <div className="p-8 md:p-12 w-full flex-1 overflow-y-auto"><AudioGenerator analysis={analysis!} /></div>}
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