import React, { useState, useRef, useEffect, FC } from 'react';
import { ICONS } from '../constants';
import { 
  streamAvatarSimulation, 
  generatePitchAudio, 
  decodeAudioData,
  evaluateAvatarSession
} from '../services/geminiService';
import { GPTMessage, MeetingContext, ComprehensiveAvatarReport, CustomerPersonaType } from '../types';

interface AvatarSimulationProps {
  meetingContext: MeetingContext;
  onContextChange: (ctx: MeetingContext) => void;
}

const MEETING_FOCUS_PRESETS = [
  { 
    label: 'Introductory Call', 
    value: 'Initial discovery call to understand business pain points and organizational structure.',
    persona: 'Balanced' as CustomerPersonaType,
    icon: <ICONS.Document className="w-5 h-5" />
  },
  { 
    label: 'Demo Follow-up', 
    value: 'Post-demo technical deep-dive and addressing specific feature-alignment questions.',
    persona: 'Technical' as CustomerPersonaType,
    icon: <ICONS.Brain className="w-5 h-5" />
  },
  { 
    label: 'Objection Handling', 
    value: 'Addressing critical resistance nodes regarding pricing, security, or competitive displacement.',
    persona: 'Financial' as CustomerPersonaType,
    icon: <ICONS.Security className="w-5 h-5" />
  },
  { 
    label: 'Closing', 
    value: 'Final contract negotiation, implementation timeline alignment, and executive sign-off.',
    persona: 'Business Executives' as CustomerPersonaType,
    icon: <ICONS.Trophy className="w-5 h-5" />
  },
  { 
    label: 'ROI Deep Dive', 
    value: 'Detailed financial modeling and business value realization presentation for CFO/Economic Buyer.',
    persona: 'Financial' as CustomerPersonaType,
    icon: <ICONS.ROI className="w-5 h-5" />
  },
  { 
    label: 'Technical Review', 
    value: 'In-depth architectural review, security compliance verification, and API integration mapping.',
    persona: 'Technical' as CustomerPersonaType,
    icon: <ICONS.Efficiency className="w-5 h-5" />
  },
];

export const AvatarSimulation: FC<AvatarSimulationProps> = ({ meetingContext, onContextChange }) => {
  const [messages, setMessages] = useState<GPTMessage[]>([]);
  const [currentCaption, setCurrentCaption] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [isAISpeaking, setIsAISpeaking] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isUserListening, setIsUserListening] = useState(false);
  const [sessionActive, setSessionActive] = useState(false);
  const [report, setReport] = useState<ComprehensiveAvatarReport | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [status, setStatus] = useState("");
  const [currentHint, setCurrentHint] = useState<string | null>(null);
  const [coachingFeedback, setCoachingFeedback] = useState<{ failReason?: string; styleGuide?: string; nextTry?: string; idealResponse?: string } | null>(null);
  const [showCoachingDetails, setShowCoachingDetails] = useState(false);

  // Resizable Logic for Sidebar
  const [historyWidth, setHistoryWidth] = useState(400);
  const [isResizing, setIsResizing] = useState(false);

  const audioContextRef = useRef<AudioContext | null>(null);
  const recognitionRef = useRef<any>(null);
  const activeAudioSource = useRef<AudioBufferSourceNode | null>(null);
  const lastAudioBytes = useRef<Uint8Array | null>(null);

  const startResizing = () => setIsResizing(true);
  const stopResizing = () => setIsResizing(false);
  
  const resize = (e: MouseEvent) => {
    if (isResizing) {
      const newWidth = window.innerWidth - e.clientX;
      if (newWidth > 150 && newWidth < 800) {
        setHistoryWidth(newWidth);
      }
    }
  };

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
  }, [isResizing]);

  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';
      recognition.onresult = (event: any) => {
        let finalTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          }
        }
        if (finalTranscript) {
          setCurrentCaption(prev => {
            const trimmedPrev = prev.trim();
            const trimmedNew = finalTranscript.trim();
            if (trimmedPrev.endsWith(trimmedNew)) return prev;
            return trimmedPrev + (trimmedPrev ? " " : "") + trimmedNew;
          });
        }
        setIsUserListening(true);
      };
      recognition.onend = () => setIsUserListening(false);
      recognitionRef.current = recognition;
    }
  }, []);

  const playAIQuestion = async (text: string) => {
    setIsAISpeaking(true);
    setIsPaused(false);
    try {
      if (!audioContextRef.current) audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      if (audioContextRef.current.state === 'suspended') await audioContextRef.current.resume();
      
      const analysis = meetingContext.vocalPersonaAnalysis;
      const bytes = await generatePitchAudio(
        text, 
        analysis?.baseVoice || 'Charon', 
        analysis?.mimicryDirective || "",
        analysis?.gender || 'Male',
        analysis || undefined
      );
      if (bytes) {
        lastAudioBytes.current = bytes;
        const buffer = await decodeAudioData(bytes, audioContextRef.current, 24000, 1);
        const source = audioContextRef.current.createBufferSource();
        source.buffer = buffer;
        source.connect(audioContextRef.current.destination);
        source.onended = () => {
          setIsAISpeaking(false);
          startListening();
        };
        activeAudioSource.current = source;
        source.start();
      }
    } catch (e) {
      setIsAISpeaking(false);
    }
  };

  const handlePauseResume = async () => {
    if (!audioContextRef.current) return;
    if (isPaused) {
      await audioContextRef.current.resume();
      setIsPaused(false);
    } else {
      await audioContextRef.current.suspend();
      setIsPaused(true);
    }
  };

  const handleRepeat = async () => {
    if (!lastAudioBytes.current || !audioContextRef.current) return;
    if (activeAudioSource.current) {
      activeAudioSource.current.stop();
    }
    const buffer = await decodeAudioData(lastAudioBytes.current, audioContextRef.current, 24000, 1);
    const source = audioContextRef.current.createBufferSource();
    source.buffer = buffer;
    source.connect(audioContextRef.current.destination);
    source.onended = () => {
      setIsAISpeaking(false);
      startListening();
    };
    activeAudioSource.current = source;
    setIsAISpeaking(true);
    setIsPaused(false);
    source.start();
  };

  const startListening = () => {
    if (recognitionRef.current && !isAISpeaking) {
      try {
        recognitionRef.current.start();
        setIsUserListening(true);
      } catch (e) {}
    }
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      setIsUserListening(false);
    }
  };

  const handleInitiate = async () => {
    setSessionActive(true);
    setIsProcessing(true);
    setMessages([]);
    setCurrentCaption("");
    setReport(null);
    setStatus("");
    setCurrentHint(null);
    setCoachingFeedback(null);
    setShowCoachingDetails(false);
    try {
      const stream = streamAvatarSimulation("START SIMULATION", [], meetingContext);
      let firstQuestion = "";
      for await (const chunk of stream) firstQuestion += chunk;
      
      const hintMatch = firstQuestion.match(/\[HINT: (.*?)\]/);
      if (hintMatch) setCurrentHint(hintMatch[1]);

      const cleaned = firstQuestion.replace(/\[HINT: .*?\]/, "").trim();
      const assistantMsg: GPTMessage = { id: Date.now().toString(), role: 'assistant', content: cleaned, mode: 'standard' };
      setMessages([assistantMsg]);
      playAIQuestion(cleaned);
    } catch (e) { console.error(e); } finally { setIsProcessing(false); }
  };

  const handleNextNode = async () => {
    if (isProcessing || !currentCaption.trim()) return;
    stopListening();
    setIsProcessing(true);
    setCoachingFeedback(null);
    setShowCoachingDetails(false);
    setCurrentHint(null);

    const userMsg: GPTMessage = { id: Date.now().toString(), role: 'user', content: currentCaption, mode: 'standard' };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    try {
      const stream = streamAvatarSimulation(currentCaption, messages, meetingContext);
      let nextContent = "";
      for await (const chunk of stream) nextContent += chunk;
      
      const isFail = nextContent.includes('[RESULT: FAIL]');
      
      const hintMatch = nextContent.match(/\[HINT: (.*?)\]/);
      if (hintMatch) setCurrentHint(hintMatch[1]);

      if (isFail) {
        const coachMatch = nextContent.match(/\[COACHING: (.*?)\]/);
        const styleMatch = nextContent.match(/\[STYLE_GUIDE: (.*?)\]/);
        const retryMatch = nextContent.match(/\[RETRY_PROMPT: (.*?)\]/);
        const idealMatch = nextContent.match(/\[IDEAL_RESPONSE: (.*?)\]/);

        setCoachingFeedback({
          failReason: coachMatch?.[1]?.trim(),
          styleGuide: styleMatch?.[1]?.trim(),
          nextTry: retryMatch?.[1]?.trim(),
          idealResponse: idealMatch?.[1]?.trim()
        });

        const retryText = retryMatch?.[1]?.trim() || "Protocol performance deficit detected. Please refine your logic and try again.";
        const assistantMsg: GPTMessage = { id: (Date.now() + 1).toString(), role: 'assistant', content: retryText, mode: 'standard' };
        setMessages([...updatedMessages, assistantMsg]);
        setCurrentCaption("");
        playAIQuestion(retryText);
      } else {
        const cleaned = nextContent.replace(/\[HINT: .*?\]/, "").trim();
        const assistantMsg: GPTMessage = { id: (Date.now() + 1).toString(), role: 'assistant', content: cleaned, mode: 'standard' };
        setMessages([...updatedMessages, assistantMsg]);
        setCurrentCaption("");
        playAIQuestion(cleaned);
      }
    } catch (e) { console.error(e); } finally { setIsProcessing(false); }
  };

  const handleTryAgain = () => {
    if (messages.length < 3) return;
    const originalQuestionMsg = messages[messages.length - 3];
    setMessages(prev => prev.slice(0, -2));
    setCoachingFeedback(null);
    setShowCoachingDetails(false);
    setCurrentCaption("");
    playAIQuestion(originalQuestionMsg.content);
  };

  const handleEndSession = async () => {
    stopListening();
    setIsProcessing(true);
    setStatus("Synthesizing Strategic Audit...");
    let finalHistory = [...messages];
    if (currentCaption.trim()) {
      finalHistory.push({ id: Date.now().toString(), role: 'user', content: currentCaption, mode: 'standard' });
    }
    try {
      const reportJson = await evaluateAvatarSession(finalHistory, meetingContext);
      setReport(reportJson);
    } catch (e) { console.error(e); } finally { setIsProcessing(false); setStatus(""); }
  };

  const exportPDF = async () => {
    if (!report) return;
    setIsExporting(true);
    try {
      const { jsPDF } = (window as any).jspdf;
      const doc = new jsPDF();
      let y = 20;
      const margin = 20;

      const addH = (t: string, size = 16) => {
        if (y > 260) { doc.addPage(); y = 20; }
        doc.setFont("helvetica", "bold");
        doc.setFontSize(size);
        doc.text(t, margin, y);
        y += size / 2 + 2;
      };

      const addP = (t: string, size = 10, color = [60, 60, 60]) => {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(size);
        doc.setTextColor(color[0], color[1], color[2]);
        const split = doc.splitTextToSize(t, 170);
        if (y + (split.length * (size / 2)) > 20) { doc.addPage(); y = 20; }
        doc.text(split, margin, y);
        y += (split.length * (size / 2)) + 4;
        doc.setTextColor(0, 0, 0);
      };

      addH("Avatar Performance Audit Report");
      addP(`Target Client: ${meetingContext.clientCompany}`);
      addP(`Persona Audited: ${report.persona_used}`);
      addP(`Overall Readiness Score: ${report.deal_readiness_score}/10`);
      addP(`Next Step Likelihood: ${report.next_step_likelihood.toUpperCase()}`);
      
      addH("Conversation Summary", 12);
      addP("Themes: " + report.conversation_summary.main_themes.join(", "));
      addP("Decisions: " + report.conversation_summary.decisions_reached.join(", "));
      
      addH("Inflection Points", 12);
      report.conversation_summary.inflection_points.forEach(p => addP(`• ${p}`));

      addH("Sentiment Evolution", 12);
      addP(`General Trend: ${report.sentiment_analysis.trend.toUpperCase()}`);
      addP(report.sentiment_analysis.narrative);
      addP("Emotional Shifts:");
      report.sentiment_analysis.emotional_shifts.forEach(s => addP(`- ${s.point}: ${s.shift}`, 9));

      addH("Confidence & Clarity Analysis", 12);
      addP(`Score: ${report.confidence_clarity_analysis.score}/10`);
      addP(report.confidence_clarity_analysis.narrative);

      addH("Objection Mapping", 12);
      report.objection_mapping.forEach(o => {
        addP(`- Objection: "${o.objection}"`);
        addP(`  Effectiveness: ${o.handled_effectively ? 'YES' : 'NO'} | Score: ${o.quality_score}/10`);
        addP(`  Note: ${o.coaching_note}`, 9);
        addP(`  Recommended Alternative: "${o.suggested_alternative}"`, 9, [79, 70, 229]);
      });

      addH("Risk & Trust Signals", 12);
      addP("Risk Signals: " + report.risk_signals.join(", "), 10, [225, 29, 72]);
      addP("Trust Signals: " + report.trust_signals.join(", "), 10, [16, 185, 129]);

      addH("Missed Opportunities", 12);
      report.missed_opportunities.forEach(o => addP(`• ${o}`));

      addH("Coaching Recommendations", 12);
      report.coaching_recommendations.forEach(r => addP(`• ${r}`, 10, [79, 70, 229]));

      doc.save(`Performance-Audit-${meetingContext.clientCompany}.pdf`);
    } catch (e) {
      console.error(e);
    } finally {
      setIsExporting(false);
    }
  };

  const AIAnimatedBotCIO = () => (
    <svg viewBox="0 0 200 240" className={`w-80 h-80 md:w-96 md:h-96 transition-all duration-700 ${isAISpeaking ? 'drop-shadow-[0_0_60px_rgba(79,70,229,0.5)]' : 'drop-shadow-2xl'}`}>
      <defs>
        <linearGradient id="faceGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#f8fafc" />
          <stop offset="100%" stopColor="#e2e8f0" />
        </linearGradient>
        <linearGradient id="suitGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#0f172a" />
          <stop offset="100%" stopColor="#020617" />
        </linearGradient>
        <filter id="eyeGlow">
          <feGaussianBlur stdDeviation="1" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>
      <g className="animate-breathe">
        <path d="M10 240 C 10 180, 40 170, 100 170 C 160 170, 190 180, 190 240" fill="url(#suitGrad)" />
        <path d="M85 170 L 100 185 L 115 170" fill="white" opacity="0.8" />
        <path d="M96 170 L 100 210 L 104 170" fill="#4f46e5" opacity="0.6" />
      </g>
      <g className={`${isUserListening ? 'animate-listen-tilt' : 'animate-breathe'}`}>
        <rect x="88" y="150" width="24" height="25" rx="12" fill="#e2e8f0" />
        <path d="M100 15 C 55 15, 50 55, 50 95 C 50 145, 70 165, 100 165 C 130 165, 150 145, 150 95 C 150 55, 145 15, 100 15" fill="url(#faceGrad)" stroke="#1e1b4b" strokeWidth="0.5" />
        <g className="animate-blink">
          <circle cx="78" cy="82" r="4.5" fill="#0f172a" />
          <circle cx="122" cy="82" r="4.5" fill="#0f172a" />
          <circle cx="78" cy="82" r="1.5" fill="#4f46e5" filter="url(#eyeGlow)" />
          <circle cx="122" cy="82" r="1.5" fill="#4f46e5" filter="url(#eyeGlow)" />
        </g>
        <g transform="translate(100, 132)">
          {isAISpeaking ? (
            <path d="M-12 0 Q 0 12, 12 0 Q 0 -2, -12 0" fill="#0f172a" className="animate-lip-morph" />
          ) : (
            <path d="M-10 0 Q 0 2, 10 0" stroke="#0f172a" strokeWidth="2.5" fill="none" strokeLinecap="round" className={isUserListening ? "animate-listen-mouth" : ""} />
          )}
        </g>
      </g>
      <style>{`
        @keyframes breathe { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-3px); } }
        .animate-breathe { animation: breathe 4s ease-in-out infinite; }
        @keyframes blink { 0%, 92%, 100% { transform: scaleY(1); } 96% { transform: scaleY(0.05); } }
        .animate-blink { transform-origin: center 82px; animation: blink 5s infinite; }
        @keyframes lip-morph { 0%, 100% { d: path("M-12 0 Q 0 12, 12 0 Q 0 -2, -12 0"); } 25% { d: path("M-8 0 Q 0 16, 8 0 Q 0 -4, -8 0"); } 50% { d: path("M-14 0 Q 0 8, 14 0 Q 0 -1, -14 0"); } 75% { d: path("M-10 0 Q 0 14, 10 0 Q 0 -3, -10 0"); } }
        .animate-lip-morph { animation: lip-morph 0.15s linear infinite; }
        @keyframes listen-tilt { 0%, 100% { transform: rotate(0deg) translateX(0px); } 50% { transform: rotate(1.5deg) translateX(1px); } }
        .animate-listen-tilt { animation: listen-tilt 3s ease-in-out infinite; transform-origin: center bottom; }
        @keyframes listen-mouth { 0%, 100% { transform: scaleX(1); } 50% { transform: scaleX(1.1); } }
        .animate-listen-mouth { animation: listen-mouth 0.5s ease-in-out infinite; transform-origin: center; }
      `}</style>
    </svg>
  );

  const historyFontScale = Math.max(0.8, Math.min(1.4, historyWidth / 400));

  return (
    <div className="bg-white shadow-2xl overflow-hidden relative min-h-[calc(100vh-64px)] flex flex-col text-slate-900 animate-in zoom-in-95 duration-500">
      {!sessionActive ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center space-y-12 max-w-4xl mx-auto px-12">
           <div className="w-80 h-80 bg-slate-50 rounded-[4rem] border border-slate-200 flex items-center justify-center group shadow-[0_0_60px_rgba(79,70,229,0.1)] hover:shadow-[0_0_80px_rgba(79,70,229,0.2)] transition-all duration-700 overflow-hidden">
              <AIAnimatedBotCIO />
           </div>
           <div className="space-y-6">
              <h2 className="text-6xl font-black tracking-tight bg-gradient-to-r from-slate-900 to-slate-600 bg-clip-text text-transparent">Initiate Presence: {meetingContext.clientNames || 'Executive CIO'}</h2>
              <p className="text-slate-500 text-2xl font-medium leading-relaxed">Connect with an animated AI Human Bot mapped to {meetingContext.clientNames || 'your target client'}. Internal neural audits active.</p>
              
              <div className="pt-4 space-y-6 w-full">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Select Simulation Protocol Preset</p>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                   {MEETING_FOCUS_PRESETS.map(preset => (
                     <button
                       key={preset.label}
                       onClick={() => onContextChange({ 
                         ...meetingContext, 
                         meetingFocus: preset.value,
                         persona: preset.persona
                       })}
                       className={`flex items-center gap-4 p-6 rounded-[2rem] text-left transition-all border-2 ${meetingContext.meetingFocus === preset.value ? 'bg-indigo-600 border-indigo-600 text-white shadow-xl scale-[1.02]' : 'bg-white border-slate-100 text-slate-600 hover:border-indigo-300 hover:bg-slate-50'}`}
                     >
                       <div className={`p-3 rounded-xl ${meetingContext.meetingFocus === preset.value ? 'bg-white/20 text-white' : 'bg-indigo-50 text-indigo-500'}`}>
                         {preset.icon}
                       </div>
                       <div>
                         <h4 className="font-black uppercase tracking-widest text-[10px] mb-1">{preset.label}</h4>
                         <p className={`text-[9px] font-bold opacity-70 line-clamp-1`}>{preset.value}</p>
                       </div>
                     </button>
                   ))}
                </div>
              </div>
           </div>
           <button onClick={handleInitiate} className="px-16 py-8 bg-indigo-600 text-white rounded-full font-black text-2xl uppercase tracking-widest shadow-2xl hover:scale-105 active:scale-95 transition-all">Activate Simulation</button>
        </div>
      ) : (
        <div className="flex-1 flex overflow-hidden">
          <div className="flex-1 flex flex-col overflow-y-auto custom-scrollbar py-16 px-12 gap-12 justify-center">
               {/* Unified Single Focus Header */}
               <div className="text-center space-y-4">
                  <span className="px-5 py-2 bg-indigo-50 text-indigo-600 text-xs font-black uppercase tracking-[0.3em] rounded-full border border-indigo-100">
                     Identity: {meetingContext.clientNames || 'Executive Client'}
                  </span>
                  <h3 className="text-5xl font-black tracking-tight leading-tight">
                     {isAISpeaking ? 'Client is Speaking...' : isUserListening ? 'Listening to Architect...' : 'Dialogue Protocol Active'}
                  </h3>
               </div>

               {/* Main Visual Core */}
               <div className="relative flex flex-col items-center">
                  <div className="relative z-20 transition-all duration-700 transform hover:scale-[1.02]">
                     <AIAnimatedBotCIO />
                  </div>
                  
                  {/* Minimalized Voice Protocol Badge */}
                  {meetingContext.vocalPersonaAnalysis && (
                     <div className="mt-8 flex items-center gap-3 px-5 py-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-full shadow-lg">
                        <div className="w-2 h-2 bg-emerald-400 rounded-full animate-ping"></div>
                        <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">
                          Neural Vocal Mimicry Active
                        </span>
                     </div>
                  )}
               </div>

               {/* Cinematic Narrative Display */}
               <div className="bg-slate-50 border border-slate-200 p-12 rounded-[4rem] space-y-6 shadow-2xl animate-in fade-in zoom-in-95 duration-700">
                  <div className="flex items-center justify-between mb-2">
                     <h5 className="text-[10px] font-black uppercase tracking-[0.4em] text-indigo-500">Dialogue Node</h5>
                     <div className="flex gap-1">
                        <div className={`w-1 h-1 rounded-full ${isAISpeaking ? 'bg-indigo-500 animate-pulse' : 'bg-slate-300'}`}></div>
                        <div className={`w-1 h-1 rounded-full ${isAISpeaking ? 'bg-indigo-500 animate-pulse delay-75' : 'bg-slate-300'}`}></div>
                        <div className={`w-1 h-1 rounded-full ${isAISpeaking ? 'bg-indigo-500 animate-pulse delay-150' : 'bg-slate-300'}`}></div>
                     </div>
                  </div>
                  <p className="text-4xl font-bold italic leading-[1.4] text-slate-900 tracking-tight">
                     {messages[messages.length - 1]?.content || "Initializing behavioral synchronization..."}
                  </p>
               </div>

               {/* Neural Strategic Hint */}
               {currentHint && (
                 <div className="w-full bg-indigo-50 border border-indigo-200 p-8 rounded-[2.5rem] shadow-xl flex items-center gap-6 animate-in slide-in-from-top-4">
                     <div className="w-12 h-12 rounded-full bg-indigo-600 flex items-center justify-center shrink-0">
                         <ICONS.Sparkles className="w-6 h-6 text-indigo-100" />
                     </div>
                     <div className="text-left flex-1">
                       <h5 className="text-[9px] font-black uppercase tracking-[0.3em] text-indigo-600 mb-1">Neural Strategic Hint</h5>
                       <p className="text-lg font-bold text-slate-900 italic leading-snug">{currentHint}</p>
                     </div>
                 </div>
               )}

               {/* Protocol Blocked Overlay */}
               {coachingFeedback && (
                 <div className="p-12 bg-rose-50 backdrop-blur-2xl border-2 border-rose-200 rounded-[3.5rem] space-y-8 animate-in slide-in-from-bottom-4 duration-500 w-full shadow-[0_40px_100px_rgba(0,0,0,0.1)]">
                     <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                           <div className="w-12 h-12 rounded-full bg-rose-600 flex items-center justify-center text-white shadow-lg"><ICONS.Security className="w-6 h-6" /></div>
                           <span className="px-6 py-2.5 bg-rose-600 text-white text-[12px] font-black uppercase rounded-full tracking-[0.2em] shadow-xl">Protocol Blocked: Neural Performance Deficit</span>
                        </div>
                     </div>

                     <button 
                       onClick={() => setShowCoachingDetails(!showCoachingDetails)}
                       className="w-full group flex items-center justify-between p-10 bg-white hover:bg-slate-50 border-2 border-slate-200 hover:border-indigo-500/40 rounded-[2.5rem] transition-all shadow-inner"
                     >
                        <span className="text-xl font-black text-indigo-600 italic group-hover:text-indigo-700 text-left pr-6">
                          Initialize Neural Alignment: Access Strategic Correction & Master Logic Node
                        </span>
                        <div className={`w-12 h-12 rounded-full bg-indigo-600/10 border border-indigo-500/40 flex items-center justify-center transition-transform duration-500 ${showCoachingDetails ? 'rotate-180' : ''}`}>
                           <svg className="w-8 h-8 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" />
                           </svg>
                        </div>
                     </button>

                     {showCoachingDetails && (
                       <div className="space-y-10 animate-in fade-in slide-in-from-top-4 duration-500 pt-4">
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                           <div className="space-y-4">
                               <h5 className="text-[11px] font-black uppercase text-rose-600 tracking-[0.3em]">Deficit Rationale</h5>
                               <div className="text-lg font-bold text-rose-900 leading-relaxed italic border-l-4 border-rose-300 pl-8 py-2">
                                 {coachingFeedback.failReason || "Incongruent logic detected in current stage response."}
                               </div>
                           </div>
                           <div className="space-y-4">
                               <h5 className="text-[11px] font-black uppercase text-indigo-600 tracking-[0.3em]">Strategic Guidance</h5>
                               <div className="text-lg font-bold text-indigo-900 leading-relaxed italic border-l-4 border-indigo-300 pl-8 py-2">
                                 {coachingFeedback.styleGuide || "Adopt a higher-authority executive stance with grounded metrics."}
                               </div>
                           </div>
                         </div>

                         {coachingFeedback.idealResponse && (
                           <div className="p-12 bg-indigo-50 border-2 border-indigo-100 rounded-[3rem] space-y-6 shadow-inner">
                               <h5 className="text-[12px] font-black uppercase text-indigo-500 tracking-[0.4em]">Master Logic Protocol</h5>
                               <p className="text-3xl font-black text-slate-900 leading-[1.5] tracking-tight italic">“{coachingFeedback.idealResponse}”</p>
                           </div>
                         )}

                         <div className="flex items-center gap-6 pt-8 border-t border-slate-200">
                           <button onClick={handleTryAgain} className="flex-1 py-7 bg-indigo-600 text-white rounded-[2.5rem] font-black text-xl uppercase tracking-[0.2em] shadow-2xl hover:bg-indigo-500 transition-all active:scale-95 flex items-center justify-center gap-4">
                               <ICONS.Efficiency className="w-8 h-8" /> Try Again (Revert Turn)
                           </button>
                           <button onClick={() => setCoachingFeedback(null)} className="px-12 py-7 bg-slate-100 text-slate-600 border border-slate-200 rounded-[2.5rem] font-black text-[12px] uppercase tracking-[0.2em] hover:bg-slate-200 active:scale-95 transition-all">Proceed with Feedback</button>
                         </div>
                       </div>
                     )}
                 </div>
               )}

               {/* User Interaction Layer */}
               <div className="space-y-8">
                  <div className="relative group">
                     <textarea 
                       value={currentCaption} 
                       onChange={(e) => setCurrentCaption(e.target.value)} 
                       className="w-full bg-slate-50 border-2 border-slate-200 rounded-[3rem] px-12 py-10 text-2xl outline-none focus:border-indigo-500 transition-all font-medium italic text-slate-900 shadow-inner h-48 resize-none placeholder:text-slate-400 leading-relaxed" 
                       placeholder={`${meetingContext.clientNames || 'The Executive'} is awaiting your strategic response...`} 
                     />
                     <button 
                       onClick={() => startListening()} 
                       className={`absolute right-10 top-1/2 -translate-y-1/2 p-6 rounded-3xl transition-all border ${isUserListening ? 'bg-emerald-600 border-emerald-500 text-white animate-pulse' : 'bg-slate-100 border-slate-200 text-indigo-600 hover:bg-slate-200'}`}
                     >
                       <ICONS.Ear className="w-8 h-8" />
                     </button>
                  </div>

                  <div className="flex items-center gap-6">
                     <button 
                       onClick={handleNextNode} 
                       disabled={isProcessing || !currentCaption.trim()} 
                       className="flex-1 py-8 bg-indigo-600 text-white rounded-[2.5rem] font-black text-xl uppercase tracking-[0.2em] shadow-2xl hover:bg-indigo-700 disabled:opacity-50 transition-all active:scale-95"
                     >
                       Commit Logic
                     </button>
                     <button 
                       onClick={handleEndSession} 
                       disabled={isProcessing} 
                       className="px-12 py-8 bg-rose-600 text-white rounded-[2.5rem] font-black text-sm uppercase tracking-widest shadow-2xl hover:bg-rose-700 transition-all disabled:opacity-50"
                     >
                       End & Audit
                     </button>
                  </div>
               </div>
          </div>

          {/* Draggable Partition Handle */}
          <div 
            onMouseDown={startResizing}
            className="w-1.5 h-full cursor-col-resize hover:bg-indigo-500 active:bg-indigo-700 z-40 transition-colors relative"
          >
             <div className="absolute inset-y-0 -left-1 -right-1"></div>
          </div>

          {/* Right Sidebar: Neural Audit Log */}
          <aside 
            style={{ 
              width: historyWidth, 
              fontSize: `${historyFontScale}rem`,
              transition: isResizing ? 'none' : 'all 0.3s ease'
            }}
            className="border-l border-slate-100 bg-slate-50/50 backdrop-blur-xl flex flex-col shrink-0 overflow-hidden"
          >
             <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-indigo-50">
                <div className="flex items-center gap-3">
                   <div className="p-2 bg-indigo-600 rounded-lg text-white" style={{ transform: `scale(${historyFontScale})` }}><ICONS.Research className="w-4 h-4" /></div>
                   {historyWidth > 180 && (
                     <div className="overflow-hidden">
                        <h4 className="text-[12px] font-black uppercase tracking-[0.2em] text-slate-900 truncate" style={{ fontSize: `${historyFontScale * 0.75}rem` }}>Simulation History</h4>
                        <p className="text-[8px] font-bold text-slate-500 uppercase tracking-widest truncate" style={{ fontSize: `${historyFontScale * 0.5}rem` }}>Mastery Trace Log</p>
                     </div>
                   )}
                </div>
                {historyWidth > 120 && (
                  <button 
                    onClick={exportPDF}
                    disabled={isExporting}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-[9px] font-black uppercase tracking-widest transition-all shadow-lg hover:bg-indigo-700 border border-indigo-500/30"
                    style={{ transform: `scale(${historyFontScale})`, transformOrigin: 'right center' }}
                  >
                    {isExporting ? <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : <ICONS.Document className="w-3.5 h-3.5" />}
                    {historyWidth > 200 && <span style={{ fontSize: '0.6rem' }}>Export Doc</span>}
                  </button>
                )}
             </div>

             <div className="flex-1 overflow-y-auto p-4 custom-scrollbar space-y-4">
                {messages.map((msg, idx) => (
                  <div key={msg.id} className={`p-4 rounded-2xl border ${msg.role === 'assistant' ? 'bg-white border-slate-200' : 'bg-indigo-50 border-indigo-100'}`}>
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${msg.role === 'assistant' ? 'bg-slate-900 text-white' : 'bg-indigo-600 text-white'}`}>
                        {msg.role === 'assistant' ? 'Client' : 'Seller'}
                      </span>
                    </div>
                    <p className="text-[10px] font-bold text-slate-700 leading-relaxed" style={{ fontSize: `${historyFontScale * 0.65}rem` }}>
                      {msg.content}
                    </p>
                  </div>
                ))}
             </div>

             {historyWidth > 150 && (
               <div className="p-6 bg-white border-t border-slate-100">
                  <button 
                    onClick={handleEndSession}
                    className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl hover:bg-indigo-700 transition-all"
                    style={{ fontSize: `${historyFontScale * 0.65}rem`, transform: `scale(${historyFontScale > 1.2 ? 1.1 : 1})` }}
                  >
                     Final Session Audit Review
                  </button>
               </div>
             )}
          </aside>
        </div>
      )}
    </div>
  );
};
