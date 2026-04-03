import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Header } from './components/Header';
import { Auth } from './components/Auth';
import { FileUpload } from './components/FileUpload';
import { AudioGenerator } from './components/AudioGenerator';
import { PracticeSession } from './components/PracticeSession';
import { SalesGPT } from './components/SalesGPT';
import { MeetingContextConfig } from './components/MeetingContextConfig';
import { DocumentGallery } from './components/DocumentGallery';
import { AssessmentLab } from './components/AssessmentLab';
import { StrategyLab } from './components/StrategyLab';
import { AvatarSimulation } from './components/AvatarSimulation';
import { AvatarSimulationV2 } from './components/AvatarSimulationV2';
import { AvatarSimulationStaged } from './components/AvatarSimulationStaged';
import { HelpCenter } from './components/HelpCenter';
import { SupportChatbot } from './components/SupportChatbot';
import { analyzeSalesContext, generateVoiceSample } from './services/geminiService';
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
  const [activeFolderId, setActiveFolderId] = useState<string>('Global Library');
  const [history, setHistory] = useState<StoredDocument[]>([]);
  const [selectedLibraryDocIds, setSelectedLibraryDocIds] = useState<string[]>([]);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'context' | 'strategy' | 'practice' | 'audio' | 'gpt' | 'qa' | 'avatar' | 'avatar2' | 'avatar-staged' | 'help'>('context');
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const [isSupportPage, setIsSupportPage] = useState(false);
  const [darkMode] = useState(true);

  const [confirmModal, setConfirmModal] = useState<{
    show: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    isLoading?: boolean;
  }>({
    show: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('page') === 'support') {
      setIsSupportPage(true);
    }
  }, []);

  const NODE_DETAILS: Record<string, { label: string; feature: string; purpose: string; howItHelps: string; audioText: string; guideText: string; stepNumber: string }> = {
    'context': {
      stepNumber: '01',
      label: 'Settings',
      feature: 'Strategic Priming & Context Configuration',
      purpose: 'Define the seller/client landscape, upload documents, and set simulation parameters.',
      howItHelps: 'Ensures the AI models are grounded in your specific deal reality for maximum relevance.',
      audioText: 'Welcome to the Intelligence Node Settings. All strategic parameters are now accessible on this single-page interface for holistic synthesis. Define the seller and client landscape, upload documents, and set simulation parameters to ground the AI in your deal reality.',
      guideText: 'Ingest and categorize documentary intelligence to establish a high-fidelity knowledge base for neural synthesis. Anchor the cognitive simulation by selecting a primary KYC node to calibrate seller, client, and solution parameters.'
    },
    'strategy': {
      stepNumber: '02',
      label: 'Strategy Lab',
      feature: 'Enterprise Strategy Synthesis',
      purpose: 'Generate and refine high-fidelity sales strategies based on deal context.',
      howItHelps: 'Provides an actionable roadmap and competitive wedge to win the deal.',
      audioText: 'Welcome to the Strategy Lab. This module synthesizes high-fidelity sales strategies from your deal context. It provides an actionable roadmap and competitive wedge to win the deal.',
      guideText: 'Synthesize and refine your enterprise sales strategy. Leverage the competitive wedge and objection defense nodes to build a winning roadmap.'
    },
    'qa': {
      stepNumber: '03',
      label: 'Hands-on Assignment',
      feature: 'Cognitive Assessment Lab',
      purpose: 'Test your knowledge of the deal and product through structured assignments.',
      howItHelps: 'Validates your readiness and identifies information gaps before you face the customer.',
      audioText: 'This is the Hands-on Assignment lab. Its purpose is to test your knowledge of the deal and product through structured assignments. This helps by validating your readiness and identifying information gaps before you face the customer.',
      guideText: 'Calibrate the assessment parameters and challenge depth to align with your current strategic readiness. Initiate the neural assignment to pressure-test your document mastery and identify logic deficits.'
    },
    'avatar-staged': {
      stepNumber: '04',
      label: 'Stage Simulation',
      feature: 'Progressive Deal Stages',
      purpose: 'Roleplay through specific meeting phases like Ice Breakers, Pricing, and Legal.',
      howItHelps: 'Allows you to master the nuances of each stage of the sales cycle.',
      audioText: 'Welcome to Stage Simulation. The purpose is to roleplay through specific meeting phases like Ice Breakers, Pricing, and Legal. It helps by allowing you to master the nuances of each stage of the sales cycle.',
      guideText: 'Navigate through the progressive deal stages to master the nuances of each phase of the sales cycle. Select a tactical node and commence the stage simulation to refine your situational reflexes.'
    },
    'avatar': {
      stepNumber: '05',
      label: 'Avatar 1.0',
      feature: 'Dual-Mode Buyer Simulation',
      purpose: 'Real-time dialogue with a skeptical CIO persona.',
      howItHelps: 'Sharpens your strategic reflexes and objection-handling skills in a low-stakes environment.',
      audioText: 'Avatar 1.0 is your dual-mode buyer simulation. The purpose is to engage in real-time dialogue with a skeptical CIO persona. It helps by sharpening your strategic reflexes and objection-handling skills in a low-stakes environment.',
      guideText: 'Engage in high-fidelity, real-time dialogue with a skeptical CIO persona to sharpen your strategic reflexes. Activate the simulation and maintain vocal authority to neutralize predicted resistance.'
    },
    'avatar2': {
      stepNumber: '06',
      label: 'Avatar 2.0',
      feature: 'Multi-Persona Enterprise Evaluation',
      purpose: 'Switch between CIO, CFO, and IT Director roles for comprehensive testing.',
      howItHelps: 'Prepares you for the diverse perspectives and scrutiny of a full buying committee.',
      audioText: 'Avatar 2.0 offers multi-persona evaluation. The purpose is to switch between CIO, CFO, and IT Director roles for comprehensive testing. It helps by preparing you for the diverse perspectives and scrutiny of a full buying committee.',
      guideText: 'Evaluate your performance across a multi-persona enterprise committee. Switch between CIO, CFO, and IT Director roles to test the resilience of your strategy against diverse stakeholder scrutiny.'
    },
    'gpt': {
      stepNumber: '07',
      label: 'Spiked GPT',
      feature: 'Strategic Knowledge Retrieval',
      purpose: 'Fast, grounded answering engine for any deal-related question.',
      howItHelps: 'Provides instant access to winning strategies and data points from your uploaded context.',
      audioText: 'This is Spiked GPT, your strategic knowledge engine. The purpose is to provide a fast, grounded answering engine for any deal-related question. It helps by providing instant access to winning strategies and data points from your uploaded context.',
      guideText: 'Access the strategic knowledge retrieval engine for instantaneous, grounded responses to complex deal inquiries. Query the cognitive core to extract winning strategies and precise data points.'
    },
    'practice': {
      stepNumber: '08',
      label: 'Grooming Lab',
      feature: 'Verbal Architecture & Pacing Audit',
      purpose: 'Practice your delivery and receive an elite audit on tone, grammar, and pacing.',
      howItHelps: 'Refines your vocal presence and ensures your delivery is as strong as your strategy.',
      audioText: 'Welcome to the Grooming Lab. The purpose is to practice your delivery and receive an elite audit on tone, grammar, and pacing. It helps by refining your vocal presence and ensuring your delivery is as strong as your strategy.',
      guideText: 'Audit your verbal architecture and pacing to ensure your delivery matches the strength of your strategy. Initiate the grooming protocol to receive an elite analysis of your vocal energy and authority.'
    },
    'audio': {
      stepNumber: '09',
      label: 'Studio',
      feature: 'High-Fidelity Audio Generation',
      purpose: 'Generate professional-grade audio samples of your winning pitches.',
      howItHelps: 'Allows you to hear the ideal delivery and use it for rehearsal or internal alignment.',
      audioText: 'This is the Studio. The purpose is to generate professional-grade audio samples of your winning pitches. It helps by allowing you to hear the ideal delivery and use it for rehearsal or internal alignment.',
      guideText: 'Synthesize high-fidelity audio samples of your winning pitches to establish a baseline for elite delivery. Generate professional-grade vocal signatures for rehearsal and strategic alignment.'
    },
    'help': {
      stepNumber: '10',
      label: 'Help Center',
      feature: 'Operational Documentation & Support',
      purpose: 'Access comprehensive guides and strategic frameworks for the SPIKED AI protocol.',
      howItHelps: 'Ensures you are maximizing the neural intelligence capabilities of the platform.',
      audioText: 'Welcome to the Help Center. This node provides comprehensive guides and strategic frameworks for the SPIKED AI protocol. It ensures you are maximizing the neural intelligence capabilities of the platform.',
      guideText: 'Review the operational documentation to master the neural sales intelligence protocol. Access strategic frameworks and support nodes for complex configurations.'
    }
  };

  const lastAnalyzedHash = useRef<string | null>(null);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  const audioRequestRef = useRef<number>(0);

  const stopNarration = () => {
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current.currentTime = 0;
      currentAudioRef.current = null;
    }
    audioRequestRef.current++;
  };

  const playNodeAudio = async (text: string) => {
    if (!text) return;
    
    // Increment request ID to invalidate any pending async calls
    const requestId = ++audioRequestRef.current;

    // Immediately stop any currently playing audio
    stopNarration();
    // Reset request ID after stopNarration incremented it
    audioRequestRef.current = requestId;

    try {
      const voiceSample = await generateVoiceSample(text, 'Zephyr');
      
      // If a newer request has started while we were waiting, ignore this one
      if (requestId !== audioRequestRef.current) return;

      if (voiceSample) {
        const audio = new Audio(`data:audio/wav;base64,${voiceSample}`);
        currentAudioRef.current = audio;
        audio.play();
        
        audio.onended = () => {
          if (currentAudioRef.current === audio) {
            currentAudioRef.current = null;
          }
        };
      }
    } catch (error) {
      console.error("Node audio failed:", error);
    }
  };

  const handleNodeClick = (tab: any) => {
    if (activeTab === tab) return;
    setActiveTab(tab as any);
    // Redundant call removed - useEffect handles narration on activeTab change
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

  // Auto-narrate re-enabled
  useEffect(() => {
    if (hasInteracted && analysis && activeTab) {
      const details = NODE_DETAILS[activeTab];
      if (details) {
        const fullText = `${details.label}. ${details.feature}. Purpose: ${details.purpose}. How it helps: ${details.howItHelps}. Operational Guide: ${details.guideText}`;
        playNodeAudio(fullText);
      }
    }
    
    // Cleanup: stop audio when tab changes or component unmounts
    return () => {
      if (currentAudioRef.current) {
        currentAudioRef.current.pause();
        currentAudioRef.current = null;
      }
      // Invalidate pending requests on cleanup
      audioRequestRef.current++;
    };
  }, [activeTab, !!analysis, hasInteracted]);

  // Whole Screen Magnifier State
  const [zoom, setZoom] = useState(100);
  // Text-Only Magnifier State
  const [textZoom, setTextZoom] = useState(100);

  // Partition Resizer State
  const [sidebarWidth, setSidebarWidth] = useState(280);
  const [isResizing, setIsResizing] = useState(false);

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
    difficulty: 'Medium',
    vocalPersonaAnalysis: {
      pitch: 'Moderate',
      tempo: 'Controlled',
      cadence: 'Strategic',
      accent: 'Neutral',
      emotionalBaseline: 'Steady',
      breathingPatterns: 'Regulated',
      mimicryDirective: '',
      baseVoice: 'Zephyr',
      gender: 'Male',
      pace: 1.0,
      stability: 80,
      clarity: 90,
      pitchValue: 1.0,
      toneAdjectives: []
    }
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

      // Always restore the meeting context if it exists
      if (savedContext) {
        setMeetingContext(prev => ({ ...prev, ...savedContext }));
      }
      
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
        } else {
          // If we have documents but no analysis, we can trigger analysis
          setShouldAutoAnalyze(true);
        }
        setActiveTab('context');
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
        runAnalysis(undefined, true);
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

  const clearLibrarySelection = () => {
    setSelectedLibraryDocIds([]);
  };

  const isAnyFileProcessing = useMemo(() => files.some(f => f.status === 'processing'), [files]);
  
  const activeDocuments = useMemo(() => {
    const sessionDocs = files.filter(f => f.status === 'ready').map(f => ({ name: f.name, content: f.content }));
    
    // Filter history by active folder if not 'Global Library'
    const filteredHistory = activeFolderId === 'Global Library' 
      ? history 
      : history.filter(d => d.folderId === activeFolderId);

    const libDocs = filteredHistory
      .filter(d => selectedLibraryDocIds.includes(d.id))
      .map(d => ({ name: d.name, content: d.content }));
      
    return [...sessionDocs, ...libDocs];
  }, [files, history, selectedLibraryDocIds, activeFolderId]);

  const generateStateHash = useCallback(() => {
    const fileIds = files.map(f => `${f.name}-${f.content.length}`).join('|');
    const libIds = selectedLibraryDocIds.sort().join('|');
    const ctxString = JSON.stringify(meetingContext);
    return `${fileIds}-${libIds}-${ctxString}`;
  }, [files, selectedLibraryDocIds, meetingContext]);

  const runAnalysis = useCallback(async (currentContext?: MeetingContext, isAuto = false) => {
    const effectiveContext = currentContext || meetingContext;
    
    if (activeDocuments.length === 0) {
      if (!isAuto) setError("Please ensure at least one document (from library or upload) is ready for analysis.");
      return;
    }

    const currentHash = generateStateHash();
    
    if (analysis && currentHash === lastAnalyzedHash.current) {
      setActiveTab('context');
      return;
    }

    setIsAnalyzing(true);
    setAnalysis(null); // Clear old analysis as requested
    setLoadingProgress(0);
    setError(null);

    // Save current context as a draft before starting analysis
    if (!isAuto) {
      await saveMeetingContext({ meetingContext: effectiveContext, selectedLibraryDocIds, analysis: null });
    }

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
      const result = await analyzeSalesContext(combinedContent, effectiveContext);
      
      clearInterval(progressInterval);
      setLoadingProgress(100);
      
      setTimeout(async () => {
        setAnalysis(result);
        lastAnalyzedHash.current = currentHash;
        setIsAnalyzing(false);
        setActiveTab('context');
        
        // Save context and analysis to Firebase
        if (!isAuto) {
          await saveMeetingContext({ meetingContext: effectiveContext, selectedLibraryDocIds, analysis: result });
        }
      }, 800);

    } catch (err: any) {
      clearInterval(progressInterval);
      console.error(err);
      setError(err.message || "An unexpected error occurred during analysis.");
      setIsAnalyzing(false);
    }
  }, [activeDocuments, meetingContext, analysis, generateStateHash, selectedLibraryDocIds]);

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
    setConfirmModal({
      show: true,
      title: 'Wipe Strategy Context',
      message: 'Are you sure you want to wipe current strategy context? This action cannot be undone.',
      onConfirm: async () => {
        setConfirmModal(prev => ({ ...prev, isLoading: true }));
        try {
          setFiles([]);
          setSelectedLibraryDocIds([]);
          setAnalysis(null);
          lastAnalyzedHash.current = null;
          setError(null);
          setActiveTab('context');
          
          // Delete from Firebase
          await deleteMeetingContext();
        } finally {
          setConfirmModal({ show: false, title: '', message: '', onConfirm: () => {} });
        }
      }
    });
  };

  const handleSaveContext = async () => {
    await saveMeetingContext({ meetingContext, selectedLibraryDocIds, analysis });
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-950">
        <div className="w-16 h-16 border-4 border-slate-800 border-t-indigo-600 rounded-full animate-spin"></div>
        <p className="mt-6 text-[10px] font-black uppercase text-slate-500 tracking-widest animate-pulse">Establishing Secure Neural Link...</p>
      </div>
    );
  }

  if (isSupportPage) {
    return <SupportChatbot />;
  }

  if (!user) {
    return <Auth />;
  }

  // Calculate dynamic font scale for the sidebar based on its width
  const sidebarFontScale = Math.max(0.75, Math.min(1.5, sidebarWidth / 280));

  return (
    <div 
      className="min-h-screen bg-slate-950 flex flex-col transition-all duration-300 ease-in-out origin-top-left bg-mesh"
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
      />
      
      <div className="pt-20 flex flex-1 overflow-hidden text-magnifier relative z-10">
        
        <div className="flex flex-1 overflow-hidden relative">
          {analysis && !isAnalyzing && (
            <>
              <aside 
                style={{ width: sidebarWidth, fontSize: `${sidebarFontScale}rem` }}
                className="bg-slate-900/90 backdrop-blur-3xl border-r border-slate-800/50 flex flex-col sticky top-0 h-full overflow-y-auto no-scrollbar z-30 transition-all shadow-none"
              >
                <div className={`p-4 ${sidebarWidth > 120 ? 'lg:p-8' : 'p-4'} space-y-12 flex flex-col h-full`}>
                  <div className="space-y-2">
                    {sidebarWidth > 180 && (
                      <motion.p 
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.4em] mb-8 ml-4"
                      >
                        Neural Nodes
                      </motion.p>
                    )}
                    <div className="flex flex-col gap-3">
                      <SidebarBtn active={activeTab === 'context'} onClick={() => handleNodeClick('context')} icon={<ICONS.Efficiency />} label={sidebarWidth > 180 ? "01 Settings" : ""} scale={sidebarFontScale} step="01" />
                      <SidebarBtn active={activeTab === 'strategy'} onClick={() => handleNodeClick('strategy')} icon={<ICONS.Brain />} label={sidebarWidth > 180 ? "02 Strategy" : ""} scale={sidebarFontScale} step="02" />
                      <SidebarBtn active={activeTab === 'qa'} onClick={() => handleNodeClick('qa')} icon={<ICONS.QuestionAnswer />} label={sidebarWidth > 180 ? "03 Assignment" : ""} scale={sidebarFontScale} step="03" />
                      <SidebarBtn active={activeTab === 'avatar-staged'} onClick={() => handleNodeClick('avatar-staged')} icon={<ICONS.Map />} label={sidebarWidth > 180 ? "04 Simulation" : ""} scale={sidebarFontScale} step="04" />
                      <SidebarBtn active={activeTab === 'avatar'} onClick={() => handleNodeClick('avatar')} icon={<ICONS.Brain />} label={sidebarWidth > 180 ? "05 Avatar 1.0" : ""} scale={sidebarFontScale} step="05" />
                      <SidebarBtn active={activeTab === 'avatar2'} onClick={() => handleNodeClick('avatar2')} icon={<ICONS.Sparkles />} label={sidebarWidth > 180 ? "06 Avatar 2.0" : ""} scale={sidebarFontScale} step="06" />
                      <SidebarBtn active={activeTab === 'gpt'} onClick={() => handleNodeClick('gpt')} icon={<ICONS.SpikedGPT />} label={sidebarWidth > 180 ? "07 Spiked GPT" : ""} scale={sidebarFontScale} step="07" />
                      <SidebarBtn active={activeTab === 'practice'} onClick={() => handleNodeClick('practice')} icon={<ICONS.Chat />} label={sidebarWidth > 180 ? "08 Grooming" : ""} scale={sidebarFontScale} step="08" />
                      <SidebarBtn active={activeTab === 'audio'} onClick={() => handleNodeClick('audio')} icon={<ICONS.Speaker />} label={sidebarWidth > 180 ? "09 Studio" : ""} scale={sidebarFontScale} step="09" />
                      <SidebarBtn active={activeTab === 'help'} onClick={() => handleNodeClick('help')} icon={<ICONS.Help />} label={sidebarWidth > 180 ? "10 Help" : ""} scale={sidebarFontScale} step="10" />
                    </div>
                  </div>

                  {sidebarWidth > 180 && (
                    <motion.div 
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="mt-auto pt-6 border-t border-slate-100 dark:border-slate-800 space-y-4"
                    >
                      <button onClick={reset} className="w-full flex items-center justify-center gap-2 py-4 px-4 bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 text-[10px] font-black uppercase tracking-widest rounded-2xl hover:bg-rose-50 dark:hover:bg-rose-900/20 hover:text-rose-600 transition-all border border-slate-200 dark:border-slate-700 active:scale-95">
                        <ICONS.X className="w-3 h-3" /> Wipe Strategy
                      </button>
                    </motion.div>
                  )}
                </div>
              </aside>
              
              <div 
                onMouseDown={startResizing}
                className="w-1 h-full cursor-col-resize hover:bg-indigo-400 active:bg-indigo-600 z-40 relative group transition-colors"
                title="Drag to adjust node partition"
              >
                <div className="absolute inset-y-0 -left-1 -right-1 group-hover:bg-indigo-400/20"></div>
              </div>
            </>
          )}

          <main className="flex-1 transition-all duration-300 overflow-y-auto custom-scrollbar relative">
            <div className="w-full min-h-full flex flex-col">
              {!analysis && !isAnalyzing && !isRestoring ? (
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="px-4 md:px-8 py-12 md:py-20 space-y-16 w-full max-w-7xl mx-auto"
                >
                  <div className="text-center space-y-8">
                    <motion.div
                      initial={{ scale: 0.9, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ delay: 0.2 }}
                      className="space-y-4"
                    >
                      <h1 className="text-8xl md:text-9xl font-black text-slate-900 dark:text-white tracking-tighter leading-none uppercase">
                        SPIKED<span className="text-red-600 drop-shadow-[0_0_20px_rgba(220,38,38,0.5)]">AI</span>
                      </h1>
                      <motion.p 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.4 }}
                        className="text-2xl text-slate-400 dark:text-slate-500 font-black uppercase tracking-[0.6em] max-w-3xl mx-auto"
                      >
                        Neural Sales Intelligence Protocol
                      </motion.p>
                    </motion.div>
                  </div>

                  <div className="glass dark:glass-dark rounded-[3rem] p-1 md:p-2 shadow-2xl shadow-indigo-500/5">
                    <MeetingContextConfig 
                      context={meetingContext} 
                      onContextChange={setMeetingContext} 
                      documents={history}
                      files={files}
                      onFilesChange={setFiles}
                      onUploadSuccess={loadHistory}
                      selectedLibraryDocIds={selectedLibraryDocIds}
                      onToggleLibraryDoc={toggleLibraryDoc}
                      onClearLibrarySelection={clearLibrarySelection}
                      onSynthesize={runAnalysis}
                      onSave={handleSaveContext}
                      isAnalyzing={isAnalyzing}
                      hasAnalysis={!!analysis}
                      activeFolderId={activeFolderId}
                      onActiveFolderChange={setActiveFolderId}
                    />
                  </div>
                </motion.div>
              ) : (isAnalyzing || isRestoring) ? (
                <div className="flex flex-col items-center justify-center space-y-12 h-full min-h-[600px] flex-1">
                  <div className="relative">
                    <motion.div 
                      animate={{ 
                        scale: [1, 1.2, 1],
                        opacity: [0.1, 0.3, 0.1]
                      }}
                      transition={{ duration: 4, repeat: Infinity }}
                      className="absolute inset-0 bg-indigo-500/20 blur-[80px] rounded-full"
                    ></motion.div>
                    <div className="relative w-40 h-40 border-4 border-indigo-50 dark:border-slate-800 border-t-indigo-600 rounded-full animate-spin"></div>
                    <motion.div 
                      animate={{ rotate: 360 }}
                      transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                      className="absolute inset-0 flex items-center justify-center text-indigo-600"
                    >
                      <ICONS.Brain className="w-12 h-12" />
                    </motion.div>
                    <div className="absolute -bottom-12 left-1/2 -translate-x-1/2">
                      <span className="text-4xl font-black text-slate-800 dark:text-white tracking-tighter">
                        {Math.floor(loadingProgress)}
                        <span className="text-indigo-500 text-sm ml-1 font-bold">%</span>
                      </span>
                    </div>
                  </div>
                  <div className="text-center space-y-8 max-w-md px-6">
                    <motion.p 
                      key={loadingStatusText}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="text-2xl font-black text-slate-800 dark:text-white tracking-tight leading-tight"
                    >
                      {loadingStatusText}
                    </motion.p>
                    <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden shadow-inner">
                      <motion.div 
                        className="h-full bg-indigo-600 rounded-full shadow-[0_0_10px_rgba(79,70,229,0.5)]" 
                        animate={{ width: `${loadingProgress}%` }}
                        transition={{ type: "spring", stiffness: 50 }}
                      ></motion.div>
                    </div>
                  </div>
                </div>
              ) : (
                <AnimatePresence mode="wait">
                  <motion.div 
                    key={activeTab}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.4, ease: "easeOut" }}
                    className="h-full flex flex-col"
                  >
                    {/* Fixed Node Header */}
                    <div className="px-8 py-10 bg-slate-900/50 backdrop-blur-md border-b border-slate-800 sticky top-0 z-20">
                      <div className="max-w-7xl mx-auto flex flex-col lg:flex-row lg:items-center justify-between gap-8">
                        <div className="space-y-3">
                          <div className="flex items-center gap-4">
                            <motion.div 
                              whileHover={{ scale: 1.05, rotate: 5 }}
                              className="w-12 h-12 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-2xl flex items-center justify-center font-black text-xl shadow-2xl"
                            >
                              {NODE_DETAILS[activeTab].stepNumber}
                            </motion.div>
                            <div>
                              <h2 className="text-3xl font-black text-slate-900 dark:text-white tracking-tighter uppercase leading-none">{NODE_DETAILS[activeTab].label}</h2>
                              <div className="flex items-center gap-2 mt-1">
                                <span className="px-2 py-0.5 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 text-[9px] font-black rounded-md uppercase tracking-wider">Neural Node Active</span>
                                <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></div>
                              </div>
                            </div>
                          </div>
                          <p className="text-indigo-600 dark:text-indigo-400 font-black text-[10px] uppercase tracking-[0.2em]">{NODE_DETAILS[activeTab].feature}</p>
                        </div>
                        <div className="flex-1 max-w-4xl grid grid-cols-1 md:grid-cols-3 gap-8">
                          <div className="space-y-2">
                            <h4 className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Strategic Purpose</h4>
                            <p className="text-xs font-semibold text-slate-600 dark:text-slate-400 leading-relaxed">{NODE_DETAILS[activeTab].purpose}</p>
                          </div>
                          <div className="space-y-2">
                            <h4 className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Competitive Edge</h4>
                            <p className="text-xs font-semibold text-slate-600 dark:text-slate-400 leading-relaxed">{NODE_DETAILS[activeTab].howItHelps}</p>
                          </div>
                          <div className="space-y-2">
                            <h4 className="text-[9px] font-black text-indigo-400 uppercase tracking-widest">Operational Protocol</h4>
                            <p className="text-xs font-bold text-indigo-600 dark:text-indigo-400 leading-relaxed italic">{NODE_DETAILS[activeTab].guideText}</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex-1 overflow-y-auto custom-scrollbar">
                      {activeTab === 'context' && (
                        <div className="px-4 md:px-8 py-12 space-y-12 w-full max-w-7xl mx-auto">
                          <motion.div 
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="glass dark:glass-dark rounded-[3rem] p-1 shadow-2xl"
                          >
                            <MeetingContextConfig 
                              context={meetingContext} 
                              onContextChange={setMeetingContext} 
                              documents={history}
                              files={files}
                              onFilesChange={setFiles}
                              onUploadSuccess={loadHistory}
                              selectedLibraryDocIds={selectedLibraryDocIds}
                              onToggleLibraryDoc={toggleLibraryDoc}
                              onClearLibrarySelection={clearLibrarySelection}
                              onSynthesize={runAnalysis}
                              onSave={handleSaveContext}
                              isAnalyzing={isAnalyzing}
                              hasAnalysis={!!analysis}
                              activeFolderId={activeFolderId}
                              onActiveFolderChange={setActiveFolderId}
                            />
                          </motion.div>
                        </div>
                      )}
                      {activeTab === 'strategy' && <StrategyLab activeDocuments={activeDocuments} meetingContext={meetingContext} />}
                      {activeTab === 'avatar-staged' && <AvatarSimulationStaged meetingContext={meetingContext} documents={history} onContextChange={setMeetingContext} onStartSimulation={stopNarration} />}
                      {activeTab === 'avatar2' && <AvatarSimulationV2 meetingContext={meetingContext} onContextChange={setMeetingContext} onStartSimulation={stopNarration} />}
                      {activeTab === 'avatar' && <AvatarSimulation meetingContext={meetingContext} onContextChange={setMeetingContext} onStartSimulation={stopNarration} />}
                      {activeTab === 'gpt' && <SalesGPT activeDocuments={activeDocuments} meetingContext={meetingContext} />}
                      {activeTab === 'audio' && <div className="p-8 md:p-12 w-full flex-1"><AudioGenerator analysis={analysis!} /></div>}
                      {activeTab === 'practice' && <PracticeSession analysis={analysis!} meetingContext={meetingContext} onStartSimulation={stopNarration} />}
                      {activeTab === 'qa' && <AssessmentLab activeDocuments={activeDocuments} onStartSimulation={stopNarration} />}
                      {activeTab === 'help' && <HelpCenter />}
                    </div>
                  </motion.div>
                </AnimatePresence>
              )}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
};

const SidebarBtn = ({ active, onClick, icon, label, scale = 1, step }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string, scale?: number, step?: string }) => (
  <motion.button 
    whileHover={{ x: 8, backgroundColor: active ? '' : 'rgba(79, 70, 229, 0.1)' }}
    whileTap={{ scale: 0.96 }}
    onClick={onClick}
    className={`w-full flex items-center gap-4 px-5 py-4 rounded-2xl font-black transition-all text-sm group relative overflow-hidden ${
      active 
      ? 'bg-indigo-600 text-white shadow-[0_20px_50px_rgba(79,70,229,0.3)]' 
      : 'text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400'
    }`}
  >
    {active && (
      <motion.div 
        layoutId="sidebar-active"
        className="absolute inset-0 bg-gradient-to-r from-indigo-600 to-indigo-500 -z-10"
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
      />
    )}
    <div 
      className={`relative ${active ? 'text-white' : 'text-slate-400 group-hover:text-indigo-500'} transition-colors shrink-0`}
      style={{ transform: `scale(${scale * 1.1})` }}
    >
      {icon}
      {!active && step && (
        <span className="absolute -top-1 -right-1 w-3 h-3 bg-slate-200 dark:bg-slate-700 rounded-full flex items-center justify-center text-[6px] font-black text-slate-500 dark:text-slate-400 border border-white dark:border-slate-900">
          {step}
        </span>
      )}
    </div>
    {label && (
      <span 
        className="tracking-tighter truncate uppercase"
        style={{ fontSize: `${scale * 0.75}rem` }}
      >
        {label.replace(/^\d+\s/, '')}
      </span>
    )}
    {active && (
      <motion.div 
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        className="ml-auto w-1.5 h-1.5 bg-white rounded-full shadow-[0_0_10px_rgba(255,255,255,0.8)]"
      />
    )}
  </motion.button>
);

export default App;