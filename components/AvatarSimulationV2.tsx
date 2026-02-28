import React, { useState, useRef, useEffect, FC } from 'react';
import { ICONS } from '../constants';
import { 
  streamAvatarSimulationV2, 
  generatePitchAudio, 
  decodeAudioData,
  evaluateAvatarSessionV2 
} from '../services/geminiService';
import { saveSimulationHistory } from '../services/firebaseService';
import { GPTMessage, MeetingContext, SimPersonaV2, ComprehensiveAvatarReport, BiometricTrace } from '../types';

interface AvatarSimulationV2Props {
  meetingContext: MeetingContext;
  onContextChange: (ctx: MeetingContext) => void;
}

const PERSONA_CONFIG: Record<SimPersonaV2, { color: string; accent: string; label: string }> = {
  CIO: { color: "#4f46e5", accent: "#818cf8", label: "Enterprise CIO" },
  CFO: { color: "#10b981", accent: "#34d399", label: "Strategic CFO" },
  IT_DIRECTOR: { color: "#f43f5e", accent: "#fb7185", label: "IT Director" }
};

const SIMULATION_PRESETS = [
  {
    id: 'intro',
    label: 'Introductory Call',
    description: 'Initial discovery call to understand business pain points and organizational structure.'
  },
  {
    id: 'demo',
    label: 'Demo Follow-up',
    description: 'Post-demo technical deep-dive and addressing specific feature-alignment questions.'
  },
  {
    id: 'objection',
    label: 'Objection Handling',
    description: 'Addressing critical resistance nodes regarding pricing, security, or competitive displacement.'
  },
  {
    id: 'closing',
    label: 'Closing',
    description: 'Final contract negotiation, implementation timeline alignment, and executive sign-off.'
  },
  {
    id: 'roi',
    label: 'ROI Deep Dive',
    description: 'Detailed financial modeling and business value realization presentation for CFO/Economic Buyer.'
  },
  {
    id: 'technical',
    label: 'Technical Review',
    description: 'In-depth technical evaluation and architecture alignment.'
  }
];

export const AvatarSimulationV2: FC<AvatarSimulationV2Props> = ({ meetingContext, onContextChange }) => {
  const [persona, setPersona] = useState<SimPersonaV2 | null>(null);
  const [messages, setMessages] = useState<GPTMessage[]>([]);
  const [currentCaption, setCurrentCaption] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [isAISpeaking, setIsAISpeaking] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isUserListening, setIsUserListening] = useState(false);
  const [micPermissionError, setMicPermissionError] = useState(false);
  const [sessionActive, setSessionActive] = useState(false);
  const [report, setReport] = useState<ComprehensiveAvatarReport | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [status, setStatus] = useState("");
  const [currentHint, setCurrentHint] = useState<string | null>(null);
  const [biometrics, setBiometrics] = useState<BiometricTrace>({
    stressLevel: 12,
    attentionFocus: 98,
    eyeContact: 90,
    clarityScore: 95,
    behavioralAudit: "Highly focused, authoritative, and clear."
  });
  const [coachingFeedback, setCoachingFeedback] = useState<{ failReason?: string; styleGuide?: string; nextTry?: string; idealResponse?: string } | null>(null);
  const [showCoachingDetails, setShowCoachingDetails] = useState(false);
  const [quotaExceeded, setQuotaExceeded] = useState<{ exceeded: boolean; retryAfter?: string }>({ exceeded: false });

  // Resizable Logic for Sidebar
  const [historyWidth, setHistoryWidth] = useState(400);
  const [isResizing, setIsResizing] = useState(false);

  const audioContextRef = useRef<AudioContext | null>(null);
  const recognitionRef = useRef<any>(null);
  const activeAudioSource = useRef<AudioBufferSourceNode | null>(null);
  const lastAudioBytes = useRef<Uint8Array | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

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
    return () => {
      if (activeAudioSource.current) {
        try { activeAudioSource.current.stop(); } catch (e) {}
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch (e) {}
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const startWebcam = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error("Error accessing webcam:", err);
    }
  };

  useEffect(() => {
    if (sessionActive) {
      startWebcam();
      const interval = setInterval(() => {
        setBiometrics(prev => {
          // More "accurate" simulation logic
          const stressDelta = !isAISpeaking ? (Math.random() * 2) : -(Math.random() * 1.5);
          const newStress = Math.max(10, Math.min(85, prev.stressLevel + stressDelta));
          
          const attentionDelta = isAISpeaking ? (Math.random() * 1) : (Math.random() * 4 - 2.5);
          const newAttention = Math.max(70, Math.min(100, prev.attentionFocus + attentionDelta));
          
          const eyeDelta = isAISpeaking ? (Math.random() * 2) : (Math.random() * 5 - 3);
          const newEye = Math.max(60, Math.min(98, prev.eyeContact + eyeDelta));
          
          const newClarity = Math.max(80, Math.min(100, 90 + (Math.random() * 10 - 5)));

          let audit = prev.behavioralAudit;
          if (newStress > 60) audit = "High cognitive load detected. Maintain steady breathing.";
          else if (newAttention < 80) audit = "Focus deviation detected. Re-engage with the core logic.";
          else if (isAISpeaking) audit = "Active listening protocol engaged. Analyzing prospect cues.";
          else audit = "Strategic delivery in progress. Maintaining executive presence.";

          return {
            stressLevel: newStress,
            attentionFocus: newAttention,
            eyeContact: newEye,
            clarityScore: newClarity,
            behavioralAudit: audit
          };
        });
      }, 1500);
      return () => clearInterval(interval);
    }
  }, [sessionActive, isAISpeaking, isUserListening]);

  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      // We'll initialize on demand in startListening for better reliability
    }
  }, []);

  const playAIQuestion = async (text: string) => {
    // Voice output disabled
  };

  const handlePauseResume = async () => {
    // Audio control disabled
  };

  const handleRepeat = async () => {
    // Audio control disabled
  };

  const startListening = () => {
    if (isProcessing || isAISpeaking) return;
    
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Speech recognition is not supported in this browser.");
      return;
    }

    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch (e) {}
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.interimResults = true;
    recognition.continuous = true;

    recognition.onstart = () => {
      setIsUserListening(true);
      setMicPermissionError(false);
    };

    recognition.onresult = (event: any) => {
      let interimTranscript = '';
      let finalTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        } else {
          interimTranscript += event.results[i][0].transcript;
        }
      }
      
      if (finalTranscript) {
        setCurrentCaption(prev => {
          const base = prev.trim();
          return base ? `${base} ${finalTranscript.trim()}` : finalTranscript.trim();
        });
      }
    };

    recognition.onerror = (event: any) => {
      console.error("Speech recognition error:", event.error);
      if (event.error === 'not-allowed') {
        setMicPermissionError(true);
      }
      setIsUserListening(false);
    };

    recognition.onend = () => {
      setIsUserListening(false);
    };

    recognitionRef.current = recognition;
    recognition.start();
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch (e) {}
      setIsUserListening(false);
    }
  };

  const handleInitiate = async (selected: SimPersonaV2) => {
    setPersona(selected);
    setSessionActive(true);
    setIsProcessing(true);
    setMessages([]);
    setCurrentCaption("");
    setReport(null);
    setCurrentHint(null);
    setCoachingFeedback(null);
    setShowCoachingDetails(false);
    try {
      setQuotaExceeded({ exceeded: false });
      const stream = streamAvatarSimulationV2(`PERSONA: ${selected}`, [], meetingContext);
      let firstQuestion = "";
      for await (const chunk of stream) firstQuestion += chunk;
      
      const hintMatch = firstQuestion.match(/\[HINT: (.*?)\]/);
      if (hintMatch) setCurrentHint(hintMatch[1]);

      const cleaned = firstQuestion.replace(/\[HINT: .*?\]/, "").trim();
      const assistantMsg: GPTMessage = { id: Date.now().toString(), role: 'assistant', content: cleaned, mode: 'standard' };
      setMessages([assistantMsg]);
      playAIQuestion(cleaned);
    } catch (e: any) { 
      console.error(e); 
      const errorStr = JSON.stringify(e);
      if (errorStr.includes("RESOURCE_EXHAUSTED") || e.code === 429) {
        let retryAfter = "later";
        const match = errorStr.match(/retry in ([\d.]+)s/);
        if (match) {
          retryAfter = `in ${Math.round(parseFloat(match[1]))}s`;
        }
        setQuotaExceeded({ exceeded: true, retryAfter });
        setTimeout(() => setQuotaExceeded({ exceeded: false }), 10000);
      }
    } finally { setIsProcessing(false); }
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
      setQuotaExceeded({ exceeded: false });
      const stream = streamAvatarSimulationV2(currentCaption, messages, meetingContext);
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
    } catch (e: any) { 
      console.error(e); 
      const errorStr = JSON.stringify(e);
      if (errorStr.includes("RESOURCE_EXHAUSTED") || e.code === 429) {
        let retryAfter = "later";
        const match = errorStr.match(/retry in ([\d.]+)s/);
        if (match) {
          retryAfter = `in ${Math.round(parseFloat(match[1]))}s`;
        }
        setQuotaExceeded({ exceeded: true, retryAfter });
        setTimeout(() => setQuotaExceeded({ exceeded: false }), 10000);
      }
    } finally { setIsProcessing(false); }
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
    setStatus("Generating Strategic Audit...");
    let finalHistory = [...messages];
    if (currentCaption.trim()) {
      finalHistory.push({ id: Date.now().toString(), role: 'user', content: currentCaption, mode: 'standard' });
    }
    try {
      const reportJson = await evaluateAvatarSessionV2(finalHistory, meetingContext);
      setReport(reportJson);
      
      // Save to Firebase History
      await saveSimulationHistory({
        type: 'avatar2',
        meetingContext,
        messages: finalHistory,
        report: reportJson,
        biometrics,
        score: reportJson.deal_readiness_score
      });
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
        doc.setFont("helvetica", "bold"); doc.setFontSize(size);
        doc.text(t, margin, y); y += size / 2 + 2;
      };

      const addP = (t: string, size = 10, color = [60, 60, 60]) => {
        doc.setFont("helvetica", "normal"); doc.setFontSize(size);
        doc.setTextColor(color[0], color[1], color[2]);
        const split = doc.splitTextToSize(t, 170);
        if (y + (split.length * (size / 2)) > 20) { doc.addPage(); y = 20; }
        doc.text(split, margin, y);
        y += (split.length * (size / 2)) + 4;
        doc.setTextColor(0, 0, 0);
      };

      addH(`Avatar V2 performance Audit: ${persona}`);
      addP(`Target Client: ${meetingContext.clientCompany}`);
      addP(`Deal Readiness Score: ${report.deal_readiness_score}/10`);
      addP(`Confidence Score: ${report.confidence_clarity_analysis.score}/10`);
      
      addH("Conversation Summary", 12);
      addP("Main Themes: " + report.conversation_summary.main_themes.join(", "));
      addH("Critical Inflection Points", 11);
      report.conversation_summary.inflection_points.forEach(p => addP(`• ${p}`));

      addH("Sentiment Trends & Emotional Shifts", 12);
      addP(`General Trend: ${report.sentiment_analysis.trend.toUpperCase()}`);
      addP(report.sentiment_analysis.narrative);
      report.sentiment_analysis.emotional_shifts.forEach(s => addP(`- ${s.point}: ${s.shift}`, 9));

      addH("Confidence & Clarity Narrative", 12);
      addP(report.confidence_clarity_analysis.narrative);

      addH("Objection Mapping", 12);
      report.objection_mapping.forEach(o => {
        addP(`Obj: "${o.objection}"`);
        addP(`Quality: ${o.quality_score}/10 | Handled: ${o.handled_effectively ? 'Yes' : 'No'}`);
        addP(`Coaching: ${o.coaching_note}`, 9);
      });

      addH("Risk & Trust Matrix", 12);
      addP("Identified Risks: " + report.risk_signals.join(", "), 10, [225, 29, 72]);
      addP("Identified Trust Signals: " + report.trust_signals.join(", "), 10, [16, 185, 129]);

      addH("Missed Opportunities", 12);
      report.missed_opportunities.forEach(o => addP(`• ${o}`, 10, [245, 158, 11]));

      addH("Strategic Recommendations", 12);
      report.coaching_recommendations.forEach(r => addP(`• ${r}`, 10, [79, 70, 229]));

      doc.save(`V2-Simulation-Audit-${persona}-${meetingContext.clientCompany}.pdf`);
    } catch (e) { console.error(e); } finally { setIsExporting(false); }
  };

  const AnimatedBotV2 = ({ type }: { type: SimPersonaV2 }) => {
    const config = PERSONA_CONFIG[type];
    return (
      <div className="relative w-full h-full bg-slate-900 overflow-hidden flex items-center justify-center">
        <div className={`absolute inset-0 bg-gradient-to-b from-indigo-900/20 to-black/40 transition-opacity duration-1000 ${isAISpeaking ? 'opacity-100' : 'opacity-40'}`}></div>
        <svg viewBox="0 0 200 240" className={`w-full h-full max-w-[280px] transition-all duration-700 ${isAISpeaking ? `drop-shadow-[0_0_40px_${config.color}88] scale-105` : 'drop-shadow-2xl'}`}>
          <defs>
            <linearGradient id={`faceGrad-${type}`} x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#ffffff" />
              <stop offset="100%" stopColor="#f1f5f9" />
            </linearGradient>
            <linearGradient id={`suitGrad-${type}`} x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#1e293b" />
              <stop offset="100%" stopColor="#020617" />
            </linearGradient>
          </defs>
          <g className="animate-breathe">
            <path d="M10 240 C 10 180, 40 170, 100 170 C 160 170, 190 180, 190 240" fill={`url(#suitGrad-${type})`} />
            <path d="M85 170 L 100 185 L 115 170" fill="white" opacity="0.9" />
            <path d="M97 170 L 100 220 L 103 170" fill={config.color} opacity="0.7" />
          </g>
          <g className={`${isUserListening ? 'animate-listen-tilt' : 'animate-breathe'}`}>
            <rect x="90" y="155" width="20" height="20" rx="10" fill="#f1f5f9" />
            <path d="M100 20 C 60 20, 50 60, 50 100 C 50 150, 70 170, 100 170 C 130 170, 150 150, 150 100 C 150 60, 140 20, 100 20" fill={`url(#faceGrad-${type})`} stroke="#1e293b" strokeWidth="0.5" />
            <g className="animate-blink">
              <circle cx="78" cy="85" r="5" fill="#0f172a" />
              <circle cx="122" cy="85" r="5" fill="#0f172a" />
              <circle cx="78" cy="85" r="2" fill={config.accent} opacity={isAISpeaking ? "1" : "0.6"} />
              <circle cx="122" cy="85" r="2" fill={config.accent} opacity={isAISpeaking ? "1" : "0.6"} />
            </g>
            <g transform="translate(100, 135)">
              {isAISpeaking ? (
                <path d="M-14 0 Q 0 14, 14 0 Q 0 -3, -14 0" fill="#0f172a" className="animate-lip-morph-v2" />
              ) : (
                <path d="M-12 0 Q 0 3, 12 0" stroke="#0f172a" strokeWidth="3" fill="none" strokeLinecap="round" className={isUserListening ? "animate-listen-mouth" : ""} />
              )}
            </g>
          </g>
        </svg>
        {/* Simulation Overlay */}
        <div className="absolute bottom-4 left-4 flex items-center gap-2">
          <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
          <span className="text-[10px] font-black text-white/60 uppercase tracking-widest">Live Neural Feed</span>
        </div>
      </div>
    );
  };

  const BiometricDisplay = () => (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 w-full">
      {[
        { label: 'Stress Level', value: biometrics.stressLevel, color: 'text-rose-500', bg: 'bg-rose-500/10' },
        { label: 'Attention Focus', value: biometrics.attentionFocus, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
        { label: 'Eye Contact', value: biometrics.eyeContact, color: 'text-indigo-500', bg: 'bg-indigo-500/10' },
        { label: 'Clarity Score', value: biometrics.clarityScore, color: 'text-amber-500', bg: 'bg-amber-500/10' },
      ].map((stat) => (
        <div key={stat.label} className={`${stat.bg} p-4 rounded-3xl border border-white/10 flex flex-col items-center justify-center space-y-1`}>
          <span className="text-[8px] font-black uppercase tracking-widest text-slate-400">{stat.label}</span>
          <div className="flex items-baseline gap-1">
            <span className={`text-2xl font-black ${stat.color}`}>{Math.round(stat.value)}</span>
            <span className="text-[10px] font-bold text-slate-400">%</span>
          </div>
          <div className="w-full h-1 bg-slate-200 rounded-full mt-2 overflow-hidden">
            <div className={`h-full transition-all duration-1000 ${stat.color.replace('text-', 'bg-')}`} style={{ width: `${stat.value}%` }}></div>
          </div>
        </div>
      ))}
    </div>
  );

  const historyFontScale = Math.max(0.8, Math.min(1.4, historyWidth / 400));

  return (
    <div className="bg-white shadow-2xl overflow-hidden relative min-h-[calc(100vh-64px)] flex flex-col text-slate-900 animate-in zoom-in-95 duration-500">
      {quotaExceeded.exceeded && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[60] bg-amber-600 text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-3 animate-in slide-in-from-top-4">
          <ICONS.Shield className="w-5 h-5" />
          <div className="flex flex-col">
            <span className="text-xs font-black uppercase tracking-widest">API Quota Exceeded</span>
            <span className="text-[10px] font-bold opacity-80">Please retry {quotaExceeded.retryAfter}. The neural link is currently saturated.</span>
          </div>
        </div>
      )}
      {micPermissionError && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 bg-rose-600 text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-3 animate-in slide-in-from-top-4">
          <ICONS.Security className="w-5 h-5" />
          <div className="flex flex-col">
            <span className="text-xs font-black uppercase tracking-widest">Microphone Access Denied</span>
            <span className="text-[10px] font-bold opacity-80">Please enable microphone permissions in your browser to use voice features.</span>
          </div>
          <button 
            onClick={() => {
              setMicPermissionError(false);
              if (recognitionRef.current) {
                try { recognitionRef.current.start(); } catch(e) {}
              }
            }}
            className="ml-4 bg-white/20 hover:bg-white/30 px-3 py-1 rounded-lg text-[10px] font-black uppercase transition-all"
          >
            Retry
          </button>
        </div>
      )}
      {!sessionActive ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center space-y-12 max-w-5xl mx-auto px-12">
           <div className="space-y-6">
              <h2 className="text-7xl font-black tracking-tight bg-gradient-to-r from-slate-900 via-indigo-900 to-slate-600 bg-clip-text text-transparent">Simulation 2.0</h2>
              <p className="text-slate-500 text-2xl font-medium leading-relaxed">Select a target persona to connect with a high-fidelity animated AI Human Bot.</p>
           </div>

           {/* Simulation Protocol Preset Selection */}
           <div className="w-full max-w-5xl bg-slate-50 p-8 rounded-[3rem] border border-slate-200 space-y-6">
              <div className="flex items-center justify-between">
                <h4 className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-400">Select Simulation Protocol Preset</h4>
                <span className="px-3 py-1 bg-indigo-100 text-indigo-600 text-[8px] font-black uppercase rounded-full">Strategic Context</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {SIMULATION_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    onClick={() => onContextChange({ ...meetingContext, simulationProtocol: preset.label })}
                    className={`p-6 rounded-3xl text-left transition-all border group ${meetingContext.simulationProtocol === preset.label ? 'bg-indigo-600 border-indigo-400 text-white shadow-xl scale-[1.02]' : 'bg-white border-slate-100 text-slate-600 hover:border-indigo-200'}`}
                  >
                    <h5 className={`text-xs font-black uppercase tracking-widest mb-2 ${meetingContext.simulationProtocol === preset.label ? 'text-white' : 'text-slate-900'}`}>{preset.label}</h5>
                    <p className={`text-[10px] font-medium leading-relaxed ${meetingContext.simulationProtocol === preset.label ? 'text-indigo-100' : 'text-slate-400'}`}>{preset.description}</p>
                  </button>
                ))}
              </div>
           </div>

           {/* Cognitive Challenge Depth Selection */}
           <div className="w-full max-w-2xl bg-slate-50 p-8 rounded-[3rem] border border-slate-200 space-y-6">
              <div className="flex items-center justify-between">
                <h4 className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-400">Cognitive Challenge Depth</h4>
                <span className="px-3 py-1 bg-amber-100 text-amber-600 text-[8px] font-black uppercase rounded-full">Adaptive Engine</span>
              </div>
              <div className="grid grid-cols-3 gap-4">
                {['Easy', 'Medium', 'Hard'].map((level) => (
                  <button
                    key={level}
                    onClick={() => onContextChange({ ...meetingContext, difficulty: level as any })}
                    className={`py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest border transition-all ${meetingContext.difficulty === level ? 'bg-amber-500 border-amber-400 text-white shadow-xl scale-[1.02]' : 'bg-white border-slate-100 text-slate-400 hover:border-amber-200'}`}
                  >
                    {level}
                  </button>
                ))}
              </div>
           </div>

           <div className="grid grid-cols-1 md:grid-cols-3 gap-8 w-full">
              {(Object.keys(PERSONA_CONFIG) as SimPersonaV2[]).map((p) => (
                <PersonaCardV2 key={p} type={p} onClick={() => handleInitiate(p)} />
              ))}
           </div>
        </div>
      ) : (
        <div className="flex-1 flex overflow-hidden">
          <div className="flex-1 flex flex-col overflow-y-auto custom-scrollbar py-16 px-12 gap-12 justify-center">
               {/* Unified Focus Header */}
                <div className="text-center space-y-4">
                  <div className="flex flex-col items-center gap-2">
                    <span className="px-6 py-2 rounded-full font-black text-xs uppercase tracking-[0.4em] border border-slate-200 bg-slate-50" style={{ color: persona ? PERSONA_CONFIG[persona].color : '#4f46e5' }}>
                       {persona} PROTOCOL ONLINE
                    </span>
                    {meetingContext.simulationProtocol && (
                      <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">
                        Active Protocol: {meetingContext.simulationProtocol}
                      </span>
                    )}
                  </div>
                  <h3 className="text-5xl font-black tracking-tight leading-tight">
                     Presence: {meetingContext.clientNames || persona}
                  </h3>
               </div>

               {/* Main Visual Core - Meeting Environment */}
               <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-6xl mx-auto">
                  <div className="relative aspect-video rounded-[3rem] overflow-hidden border-2 border-slate-200 shadow-2xl group transition-all hover:scale-[1.02]">
                     {persona && <AnimatedBotV2 type={persona} />}
                  </div>
                  
                  <div className="relative aspect-video rounded-[3rem] overflow-hidden border-2 border-slate-200 shadow-2xl bg-slate-100 group transition-all hover:scale-[1.02]">
                     <video 
                       ref={videoRef} 
                       autoPlay 
                       playsInline 
                       muted 
                       className="w-full h-full object-cover mirror"
                     />
                     <div className="absolute top-6 left-6 px-4 py-2 bg-black/40 backdrop-blur-md rounded-full border border-white/10">
                        <span className="text-[10px] font-black text-white uppercase tracking-widest">You (Seller)</span>
                     </div>

                     {/* Real-time Cognitive Notifications */}
                     <div className="absolute bottom-6 left-6 right-6 pointer-events-none space-y-2">
                       {biometrics.stressLevel > 70 && (
                         <div className="bg-rose-600/90 backdrop-blur-md border border-rose-400/50 p-4 rounded-2xl shadow-2xl animate-in slide-in-from-bottom-2 duration-300">
                           <div className="flex items-center gap-3">
                             <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                               <ICONS.Security className="w-4 h-4 text-white" />
                             </div>
                             <div>
                               <h6 className="text-[8px] font-black text-rose-100 uppercase tracking-widest">Stress Alert</h6>
                               <p className="text-xs font-bold text-white">You are too stressed, calm down. You will be okay, relax.</p>
                             </div>
                           </div>
                         </div>
                       )}
                       {biometrics.attentionFocus < 75 && (
                         <div className="bg-amber-600/90 backdrop-blur-md border border-amber-400/50 p-4 rounded-2xl shadow-2xl animate-in slide-in-from-bottom-2 duration-300">
                           <div className="flex items-center gap-3">
                             <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                               <ICONS.Research className="w-4 h-4 text-white" />
                             </div>
                             <div>
                               <h6 className="text-[8px] font-black text-amber-100 uppercase tracking-widest">Attention Warning</h6>
                               <p className="text-xs font-bold text-white">Focus deviation detected. Re-engage with the core logic.</p>
                             </div>
                           </div>
                         </div>
                       )}
                       {biometrics.clarityScore < 85 && (
                         <div className="bg-indigo-600/90 backdrop-blur-md border border-indigo-400/50 p-4 rounded-2xl shadow-2xl animate-in slide-in-from-bottom-2 duration-300">
                           <div className="flex items-center gap-3">
                             <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                               <ICONS.Efficiency className="w-4 h-4 text-white" />
                             </div>
                             <div>
                               <h6 className="text-[8px] font-black text-indigo-100 uppercase tracking-widest">Clarity Alert</h6>
                               <p className="text-xs font-bold text-white">You are not in clarity in delivery.</p>
                             </div>
                           </div>
                         </div>
                       )}
                     </div>
                     {!streamRef.current && (
                       <div className="absolute inset-0 flex items-center justify-center bg-slate-900/80 backdrop-blur-sm">
                          <div className="text-center space-y-4">
                             <ICONS.Security className="w-12 h-12 text-slate-400 mx-auto animate-pulse" />
                             <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Webcam Protocol Initializing...</p>
                          </div>
                       </div>
                     )}
                  </div>
               </div>

               {/* Biometric & Cognitive Trace Layer */}
               <div className="w-full max-w-6xl mx-auto space-y-6">
                  <div className="flex items-center justify-between">
                     <h5 className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-400">Biometric & Cognitive Trace</h5>
                     <div className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping"></div>
                        <span className="text-[8px] font-black text-emerald-500 uppercase tracking-widest">Live Neural Audit Active</span>
                     </div>
                  </div>
                  <BiometricDisplay />
                  
                  <div className="p-6 bg-slate-50 border border-slate-200 rounded-3xl flex items-start gap-4">
                     <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center shrink-0 shadow-lg">
                        <ICONS.Research className="w-5 h-5 text-white" />
                     </div>
                     <div>
                        <h6 className="text-[10px] font-black uppercase tracking-widest text-indigo-600 mb-1">Behavioral Audit</h6>
                        <p className="text-sm font-bold text-slate-600 italic leading-relaxed">"{biometrics.behavioralAudit}"</p>
                     </div>
                  </div>
               </div>

               {/* Cinematic Narrative Display */}
               <div className="bg-slate-50 border border-slate-200 p-12 rounded-[4rem] space-y-6 shadow-2xl animate-in fade-in zoom-in-95 duration-700">
                  <div className="flex items-center justify-between mb-2">
                     <h5 className="text-[10px] font-black uppercase tracking-[0.4em] text-indigo-400">{persona} Strategic Inquiry</h5>
                     <div className="flex gap-1.5">
                        <div className="w-1.5 h-1.5 rounded-full bg-indigo-500/20"></div>
                        <div className="w-1.5 h-1.5 rounded-full bg-indigo-500/40"></div>
                        <div className="w-1.5 h-1.5 rounded-full bg-indigo-500"></div>
                     </div>
                  </div>
                  <p className="text-4xl font-black italic leading-[1.4] text-slate-900 tracking-tight">
                     {messages[messages.length - 1]?.content || status || "Synchronizing Strategic Core..."}
                  </p>

                  {/* Neural Strategic Hint - Integrated */}
                  {currentHint && (
                    <div className="mt-8 pt-8 border-t border-slate-200/60 flex items-start gap-4 animate-in slide-in-from-top-2">
                        <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center shrink-0 shadow-lg shadow-indigo-200">
                            <ICONS.Sparkles className="w-4 h-4 text-indigo-100" />
                        </div>
                        <div className="text-left flex-1">
                          <h5 className="text-[8px] font-black uppercase tracking-[0.3em] text-indigo-600 mb-1">Neural Strategic Hint</h5>
                          <p className="text-base font-bold text-slate-600 italic leading-relaxed">{currentHint}</p>
                        </div>
                    </div>
                  )}
               </div>

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
                     <textarea value={currentCaption} onChange={(e) => setCurrentCaption(e.target.value)} className="w-full bg-slate-50 border-2 border-slate-200 rounded-[3rem] px-12 py-10 text-2xl outline-none focus:border-indigo-500 transition-all font-bold italic text-slate-900 shadow-inner h-48 resize-none placeholder:text-slate-400 leading-relaxed" placeholder={`Respond to ${meetingContext.clientNames || persona}...`} />
                     <button 
                       onClick={() => isUserListening ? stopListening() : startListening()} 
                       className={`absolute right-10 top-1/2 -translate-y-1/2 p-6 rounded-3xl transition-all border ${isUserListening ? 'bg-emerald-600 border-emerald-500 text-white animate-pulse' : 'bg-slate-100 border-slate-200 text-indigo-600 hover:bg-slate-200'}`}
                       title={isUserListening ? "Stop Listening" : "Start Listening"}
                     >
                       <ICONS.Ear className="w-8 h-8" />
                     </button>
                  </div>

                  <div className="flex items-center gap-6">
                     <button onClick={handleNextNode} disabled={isProcessing || !currentCaption.trim()} className="flex-1 py-8 bg-indigo-600 text-white rounded-[2.5rem] font-black text-xl uppercase tracking-[0.2em] shadow-2xl hover:bg-indigo-700 disabled:opacity-50 transition-all active:scale-95">Commit Strategy</button>
                     <button onClick={handleEndSession} disabled={isProcessing} className="px-12 py-8 bg-rose-600 text-white rounded-[2.5rem] font-black text-sm uppercase tracking-widest shadow-2xl hover:bg-rose-700 transition-all disabled:opacity-50">End Session & Audit</button>
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

const PersonaCardV2: FC<{ type: SimPersonaV2; onClick: () => void | Promise<void> }> = ({ type, onClick }) => {
  const config = PERSONA_CONFIG[type];
  return (
    <button onClick={onClick} className="group p-1 bg-slate-50 border-2 border-slate-200 rounded-[3rem] hover:border-indigo-500 transition-all text-left flex flex-col h-full shadow-xl active:scale-95 duration-300">
      <div className="aspect-[4/3] w-full rounded-[2.5rem] overflow-hidden mb-6 relative bg-slate-100 flex items-center justify-center">
         <div className="w-24 h-24 rounded-full bg-slate-200 flex items-center justify-center group-hover:scale-110 transition-transform">
            <ICONS.Brain className="w-12 h-12 text-slate-500 group-hover:text-slate-900 transition-colors" />
         </div>
         <div className="absolute bottom-4 left-4 flex gap-2">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: config.color }}></div>
            <div className="w-2 h-2 rounded-full opacity-30" style={{ backgroundColor: config.color }}></div>
         </div>
         <div className="absolute inset-0 bg-indigo-600/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
      </div>
      <div className="px-8 pb-8">
        <h4 className="text-3xl font-black mb-2 tracking-tight group-hover:text-indigo-400 transition-colors">{config.label}</h4>
        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Connect Presence Node</p>
      </div>
    </button>
  );
};