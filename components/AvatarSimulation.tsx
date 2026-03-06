import React, { useState, useRef, useEffect, FC } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ICONS } from '../constants';
import { 
  streamAvatarSimulation, 
  generatePitchAudio, 
  generateVoiceSample,
  decodeAudioData,
  evaluateAvatarSession,
  generateExplanation,
  generateNodeExplanation
} from '../services/geminiService';
import { saveSimulationHistory } from '../services/firebaseService';
import { GPTMessage, MeetingContext, ComprehensiveAvatarReport, CustomerPersonaType, BiometricTrace } from '../types';

interface AvatarSimulationProps {
  meetingContext: MeetingContext;
  onContextChange: (ctx: MeetingContext) => void;
  onStartSimulation?: () => void;
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

export const AvatarSimulation: FC<AvatarSimulationProps> = ({ meetingContext, onContextChange, onStartSimulation }) => {
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
    stressLevel: 15,
    attentionFocus: 95,
    eyeContact: 88,
    clarityScore: 92,
    behavioralAudit: "Professional, steady, and direct."
  });
  const [coachingFeedback, setCoachingFeedback] = useState<{ failReason?: string; styleGuide?: string; nextTry?: string; idealResponse?: string } | null>(null);
  const [showCoachingDetails, setShowCoachingDetails] = useState(false);
  const [showExplanation, setShowExplanation] = useState(false);
  const showExplanationRef = useRef(false);
  useEffect(() => {
    showExplanationRef.current = showExplanation;
  }, [showExplanation]);
  const [explanationContent, setExplanationContent] = useState("");
  const [isExplaining, setIsExplaining] = useState(false);

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
          // Enhanced dynamic biometric simulation logic
          // AI Speaking = User Listening | !AI Speaking & User Listening = User Speaking/Thinking
          
          let stressDelta = 0;
          let attentionDelta = 0;
          let eyeDelta = 0;
          
          if (isAISpeaking) {
            // User is listening: Stress decreases, Focus increases, Eye contact stabilizes
            stressDelta = prev.stressLevel > 20 ? -1.2 : (Math.random() * 0.5 - 0.25);
            attentionDelta = prev.attentionFocus < 95 ? 0.8 : (Math.random() * 0.4 - 0.2);
            eyeDelta = prev.eyeContact < 92 ? 0.6 : (Math.random() * 0.4 - 0.2);
          } else if (isUserListening) {
            // User is speaking/thinking: Stress increases with cognitive load, Focus fluctuates, Eye contact drops (thinking)
            const difficultyMultiplier = meetingContext.difficulty === 'Hard' ? 1.5 : meetingContext.difficulty === 'Medium' ? 1.0 : 0.7;
            stressDelta = (Math.random() * 2.5) * difficultyMultiplier;
            attentionDelta = (Math.random() * 4 - 2.5);
            eyeDelta = (Math.random() * 6 - 4.5); // People look away more when speaking
          } else {
            // Idle state
            stressDelta = prev.stressLevel > 15 ? -0.5 : 0.2;
            attentionDelta = prev.attentionFocus > 85 ? -0.3 : 0.3;
            eyeDelta = prev.eyeContact > 80 ? -0.3 : 0.3;
          }

          const newStress = Math.max(10, Math.min(95, prev.stressLevel + stressDelta));
          const newAttention = Math.max(65, Math.min(100, prev.attentionFocus + attentionDelta));
          const newEye = Math.max(55, Math.min(98, prev.eyeContact + eyeDelta));
          const newClarity = Math.max(80, Math.min(100, 92 + (Math.random() * 8 - 4)));

          let audit = prev.behavioralAudit;
          if (newStress > 75) audit = "CRITICAL: High autonomic arousal. Pause and reset breathing.";
          else if (newStress > 55) audit = "Elevated cognitive load. Simplify your current logic.";
          else if (newAttention < 75) audit = "Focus drift detected. Re-center on the prospect's last cue.";
          else if (newEye < 65) audit = "Eye contact deficit. Re-establish visual connection to build trust.";
          else if (isAISpeaking) audit = "Active listening protocol engaged. Mirroring prospect sentiment.";
          else if (isUserListening) audit = "Strategic delivery active. Maintaining high-authority presence.";
          else audit = "Neural baseline established. Ready for next tactical node.";

          return {
            stressLevel: newStress,
            attentionFocus: newAttention,
            eyeContact: newEye,
            clarityScore: newClarity,
            behavioralAudit: audit
          };
        });
      }, 1000); // Increased frequency for "real-time" feel
      return () => clearInterval(interval);
    }
  }, [sessionActive, isAISpeaking, isUserListening]);

  useEffect(() => {
    return () => {
      if (activeAudioSource.current) {
        try { activeAudioSource.current.stop(); } catch (e) {}
      }
      stopListening();
    };
  }, []);

  const playAIQuestion = (text: string): Promise<void> => {
    return new Promise(async (resolve) => {
      if (!text) {
        resolve();
        return;
      }
      setIsAISpeaking(true);
      setIsPaused(false);
      
      try {
        if (!audioContextRef.current) {
          const AudioContextClass = (window as any).AudioContext || (window as any).webkitAudioContext;
          audioContextRef.current = new AudioContextClass();
        }
        
        // Ensure context is running (browsers block auto-play)
        if (audioContextRef.current.state === 'suspended') {
          try {
            await audioContextRef.current.resume();
          } catch (e) {
            console.warn("AudioContext resume failed, will retry on next interaction:", e);
          }
        }

        const voiceSample = await generateVoiceSample(text, meetingContext.vocalPersonaAnalysis?.baseVoice || 'Kore');
        if (voiceSample) {
          const audioData = atob(voiceSample);
          const arrayBuffer = new ArrayBuffer(audioData.length);
          const view = new Uint8Array(arrayBuffer);
          for (let i = 0; i < audioData.length; i++) view[i] = audioData.charCodeAt(i);
          
          let audioBuffer: AudioBuffer | null = null;
          try {
            audioBuffer = await audioContextRef.current.decodeAudioData(arrayBuffer);
          } catch (decodeError) {
            console.error("decodeAudioData failed, using fallback:", decodeError);
            const blob = new Blob([arrayBuffer], { type: 'audio/wav' });
            const url = URL.createObjectURL(blob);
            const audio = new Audio(url);
            audio.onended = () => {
              setIsAISpeaking(false);
              startListening();
              resolve();
            };
            audio.play().catch(e => {
              console.error("Fallback audio play failed:", e);
              resolve();
            });
            return;
          }
          
          if (activeAudioSource.current) {
            try { activeAudioSource.current.stop(); } catch (e) {}
          }

          const source = audioContextRef.current.createBufferSource();
          source.buffer = audioBuffer;
          source.connect(audioContextRef.current.destination);
          activeAudioSource.current = source;
          
          source.onended = () => {
            setIsAISpeaking(false);
            // Automatically enable microphone after agent finishes
            startListening();
            resolve();
          };
          
          source.start(0);
        } else {
          setIsAISpeaking(false);
          resolve();
        }
      } catch (error) {
        console.error("Error playing AI question:", error);
        setIsAISpeaking(false);
        resolve();
      }
    });
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
    const lastAssistantMsg = [...messages].reverse().find(m => m.role === 'assistant');
    if (lastAssistantMsg) {
      if (activeAudioSource.current) {
        try { activeAudioSource.current.stop(); } catch(e) {}
      }
      playAIQuestion(lastAssistantMsg.content);
    }
  };

  const handleExplainQuestion = async () => {
    const lastAI = [...messages].reverse().find(m => m.role === 'assistant');
    if (!lastAI) return;

    // Stop current audio immediately
    if (activeAudioSource.current) {
      try { activeAudioSource.current.stop(); } catch (e) {}
    }
    setIsAISpeaking(false);

    setExplanationContent("");
    setShowExplanation(true);
    setIsExplaining(true);
    try {
      const explanation = await generateExplanation(lastAI.content, "Initial Discovery", meetingContext);
      
      // Only proceed if the popup is still open
      if (showExplanationRef.current) {
        setExplanationContent(explanation);
        playAIQuestion(explanation);
      }
    } catch (e) {
      console.error("Explanation failed:", e);
    } finally {
      setIsExplaining(false);
    }
  };

  const explainNode = async (nodeName: string): Promise<void> => {
    try {
      const explanation = await generateNodeExplanation(nodeName, meetingContext);
      await playAIQuestion(explanation);
    } catch (e) {
      console.error("Node explanation failed:", e);
    }
  };

  const startListening = async () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch (e) {}
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    let finalTranscriptForTurn = '';

    recognition.onstart = () => {
      setIsUserListening(true);
      setMicPermissionError(false);
    };

    recognition.onresult = (event: any) => {
      let interimTranscript = '';
      let finalTurn = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalTurn += event.results[i][0].transcript;
        } else {
          interimTranscript += event.results[i][0].transcript;
        }
      }
      
      if (finalTurn) {
        setCurrentCaption(prev => {
          const base = prev.trim();
          return base ? base + ' ' + finalTurn.trim() : finalTurn.trim();
        });
      }
    };

    recognition.onerror = (event: any) => {
      console.error("Speech recognition error:", event.error);
      if (event.error === 'not-allowed') setMicPermissionError(true);
      setIsUserListening(false);
    };

    recognition.onend = () => {
      setIsUserListening(false);
    };

    recognitionRef.current = recognition;
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
      recognition.start();
    } catch (e) {
      console.error("Failed to start recognition:", e);
      setMicPermissionError(true);
    }
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch (e) {}
      setIsUserListening(false);
    }
  };

  const handleInitiate = async () => {
    if (onStartSimulation) onStartSimulation();
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
      
      // Zero latency: play immediately
      await explainNode("Initial Discovery");
      await playAIQuestion(cleaned);
      
      setMessages([assistantMsg]);
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
        
        // Zero latency: play immediately
        playAIQuestion(retryText);
        
        setMessages([...updatedMessages, assistantMsg]);
        setCurrentCaption("");
      } else {
        const cleaned = nextContent.replace(/\[HINT: .*?\]/, "").trim();
        const assistantMsg: GPTMessage = { id: (Date.now() + 1).toString(), role: 'assistant', content: cleaned, mode: 'standard' };
        
        // Zero latency: play immediately
        playAIQuestion(cleaned);
        
        setMessages([...updatedMessages, assistantMsg]);
        setCurrentCaption("");
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
      
      // Save to Firebase History
      await saveSimulationHistory({
        type: 'avatar',
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
    <div className="relative w-full h-full bg-slate-900 overflow-hidden flex items-center justify-center">
      <div className={`absolute inset-0 bg-gradient-to-b from-indigo-900/20 to-black/40 transition-opacity duration-1000 ${isAISpeaking ? 'opacity-100' : 'opacity-40'}`}></div>
      <svg viewBox="0 0 200 240" className={`w-full h-full max-w-[280px] transition-all duration-700 ${isAISpeaking ? 'drop-shadow-[0_0_40px_rgba(79,70,229,0.4)] scale-105' : 'drop-shadow-2xl'}`}>
        <defs>
          <linearGradient id="faceGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#f8fafc" />
            <stop offset="100%" stopColor="#e2e8f0" />
          </linearGradient>
          <linearGradient id="suitGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#0f172a" />
            <stop offset="100%" stopColor="#020617" />
          </linearGradient>
        </defs>
        <g className="animate-breathe">
          <path d="M10 240 C 10 180, 40 170, 100 170 C 160 170, 190 180, 190 240" fill="url(#suitGrad)" />
          <path d="M85 170 L 100 185 L 115 170" fill="white" opacity="0.8" />
        </g>
        <g className={`${isUserListening ? 'animate-listen-tilt' : 'animate-breathe'}`}>
          <rect x="88" y="150" width="24" height="25" rx="12" fill="#e2e8f0" />
          <path d="M100 15 C 55 15, 50 55, 50 95 C 50 145, 70 165, 100 165 C 130 165, 150 145, 150 95 C 150 55, 145 15, 100 15" fill="url(#faceGrad)" stroke="#1e1b4b" strokeWidth="0.5" />
          <g className="animate-blink">
            <circle cx="78" cy="82" r="4.5" fill="#0f172a" />
            <circle cx="122" cy="82" r="4.5" fill="#0f172a" />
            <circle cx="78" cy="82" r="1.5" fill="#4f46e5" />
            <circle cx="122" cy="82" r="1.5" fill="#4f46e5" />
          </g>
          <g transform="translate(100, 132)">
            {isAISpeaking ? (
              <path d="M-12 0 Q 0 12, 12 0 Q 0 -2, -12 0" fill="#0f172a" className="animate-lip-morph" />
            ) : (
              <path d="M-10 0 Q 0 2, 10 0" stroke="#0f172a" strokeWidth="2.5" fill="none" strokeLinecap="round" className={isUserListening ? "animate-listen-mouth" : ""} />
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

  const BiometricDisplay = () => {
    const getStatusColor = (label: string, value: number) => {
      if (label === 'Stress Level') {
        if (value > 70) return 'text-rose-600 bg-rose-100 border-rose-200 shadow-[0_0_15px_rgba(225,29,72,0.2)]';
        if (value > 40) return 'text-amber-600 bg-amber-100 border-amber-200 shadow-[0_0_15px_rgba(245,158,11,0.2)]';
        return 'text-emerald-600 bg-emerald-100 border-emerald-200 shadow-[0_0_15px_rgba(16,185,129,0.2)]';
      }
      if (label === 'Attention Focus' || label === 'Eye Contact' || label === 'Clarity Score') {
        if (value < 60) return 'text-rose-600 bg-rose-100 border-rose-200 shadow-[0_0_15px_rgba(225,29,72,0.2)]';
        if (value < 85) return 'text-amber-600 bg-amber-100 border-amber-200 shadow-[0_0_15px_rgba(245,158,11,0.2)]';
        return 'text-emerald-600 bg-emerald-100 border-emerald-200 shadow-[0_0_15px_rgba(16,185,129,0.2)]';
      }
      return 'text-slate-600 bg-slate-100 border-slate-200';
    };

    const getAlert = (label: string, value: number) => {
      if (label === 'Stress Level' && value > 70) return "High Stress: Calm down, relax.";
      if (label === 'Attention Focus' && value < 75) return "Low Focus: Re-engage now.";
      if (label === 'Clarity Score' && value < 85) return "Low Clarity: Be more precise.";
      return null;
    };

    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 w-full">
        {[
          { label: 'Stress Level', value: biometrics.stressLevel },
          { label: 'Attention Focus', value: biometrics.attentionFocus },
          { label: 'Eye Contact', value: biometrics.eyeContact },
          { label: 'Clarity Score', value: biometrics.clarityScore },
        ].map((stat) => {
          const colorClasses = getStatusColor(stat.label, stat.value);
          const alert = getAlert(stat.label, stat.value);
          
          return (
            <div key={stat.label} className={`${colorClasses} p-4 rounded-3xl border flex flex-col items-center justify-center space-y-1 transition-all duration-500 relative overflow-hidden`}>
              <span className="text-[8px] font-black uppercase tracking-widest opacity-60">{stat.label}</span>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-black">{Math.round(stat.value)}</span>
                <span className="text-[10px] font-bold opacity-60">%</span>
              </div>
              <div className="w-full h-1 bg-black/5 rounded-full mt-2 overflow-hidden">
                <div className="h-full bg-current transition-all duration-1000" style={{ width: `${stat.value}%` }}></div>
              </div>
              {alert && (
                <div className="absolute inset-0 bg-current opacity-5 animate-pulse pointer-events-none"></div>
              )}
              {alert && (
                <div className="mt-2 text-[7px] font-black uppercase tracking-tighter text-center leading-none animate-bounce">
                  {alert}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  const historyFontScale = Math.max(0.8, Math.min(1.4, historyWidth / 400));

  return (
    <div className="bg-slate-950 shadow-2xl overflow-hidden relative min-h-[calc(100vh-64px)] flex flex-col text-white animate-in zoom-in-95 duration-500">
      {!sessionActive ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center space-y-12 max-w-4xl mx-auto px-12">
           <div className="w-80 h-80 bg-slate-900/50 rounded-[4rem] border border-slate-800 flex items-center justify-center group shadow-[0_0_60px_rgba(79,70,229,0.1)] hover:shadow-[0_0_80px_rgba(79,70,229,0.2)] transition-all duration-700 overflow-hidden">
              <AIAnimatedBotCIO />
           </div>
           <div className="space-y-6">
              <h2 className="text-6xl font-black tracking-tight bg-gradient-to-r from-white via-indigo-200 to-slate-400 bg-clip-text text-transparent">Initiate Presence: {meetingContext.clientNames || 'Executive CIO'}</h2>
              <p className="text-slate-400 text-2xl font-medium leading-relaxed">Connect with an animated AI Human Bot mapped to {meetingContext.clientNames || 'your target client'}. Internal neural audits active.</p>
              
              <div className="pt-4 space-y-6 w-full">
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em]">Select Simulation Protocol Preset</p>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                   {MEETING_FOCUS_PRESETS.map(preset => (
                     <button
                       key={preset.label}
                       onClick={() => onContextChange({ 
                         ...meetingContext, 
                         meetingFocus: preset.value,
                         persona: preset.persona
                       })}
                       className={`flex items-center gap-4 p-6 rounded-[2rem] text-left transition-all border-2 ${meetingContext.meetingFocus === preset.value ? 'bg-indigo-600 border-indigo-600 text-white shadow-xl scale-[1.02]' : 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800'}`}
                     >
                       <div className={`p-3 rounded-xl ${meetingContext.meetingFocus === preset.value ? 'bg-white/20 text-white' : 'bg-indigo-900/30 text-indigo-300'}`}>
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

              <div className="pt-8 space-y-6 w-full">
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em]">Cognitive Challenge Depth</p>
                <div className="grid grid-cols-3 gap-4">
                  {['Easy', 'Medium', 'Hard'].map((level) => (
                    <button
                      key={level}
                      onClick={() => onContextChange({ ...meetingContext, difficulty: level as any })}
                    className={`py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest border transition-all ${meetingContext.difficulty === level ? 'bg-amber-500 border-amber-400 text-white shadow-xl scale-[1.02]' : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-amber-200'}`}
                    >
                      {level}
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

               {/* Main Visual Core - Meeting Environment */}
               <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-6xl mx-auto">
                  <div className="relative aspect-video rounded-[3rem] overflow-hidden border-2 border-slate-200 shadow-2xl group transition-all hover:scale-[1.02]">
                     <AIAnimatedBotCIO />
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
                     <h5 className="text-[10px] font-black uppercase tracking-[0.4em] text-indigo-500">Dialogue Node</h5>
                     <div className="flex items-center gap-3">
                        <button 
                          onClick={handlePauseResume} 
                          className="flex items-center gap-1.5 px-4 py-1.5 bg-indigo-100 hover:bg-indigo-200 text-indigo-600 rounded-full text-[10px] font-black uppercase tracking-widest transition-all shadow-sm"
                        >
                          {isPaused ? <><ICONS.Play className="w-3 h-3" /> Play</> : <><ICONS.Speaker className="w-3 h-3" /> Pause</>}
                        </button>
                        <button 
                          onClick={handleRepeat} 
                          className="flex items-center gap-1.5 px-4 py-1.5 bg-amber-100 hover:bg-amber-200 text-amber-600 rounded-full text-[10px] font-black uppercase tracking-widest transition-all shadow-sm"
                        >
                          <ICONS.Research className="w-3 h-3" /> Re-hear
                        </button>
                        <button 
                          onClick={() => handleExplainQuestion()} 
                          className="flex items-center gap-1.5 px-4 py-1.5 bg-indigo-100 hover:bg-indigo-200 text-indigo-600 rounded-full text-[10px] font-black uppercase tracking-widest transition-all shadow-sm"
                        >
                          <ICONS.Research className="w-3 h-3" /> Explain Question
                        </button>
                        <div className="flex gap-1 ml-2">
                          <div className={`w-1 h-1 rounded-full ${isAISpeaking ? 'bg-indigo-500 animate-pulse' : 'bg-slate-300'}`}></div>
                          <div className={`w-1 h-1 rounded-full ${isAISpeaking ? 'bg-indigo-500 animate-pulse delay-75' : 'bg-slate-300'}`}></div>
                          <div className={`w-1 h-1 rounded-full ${isAISpeaking ? 'bg-indigo-500 animate-pulse delay-150' : 'bg-slate-300'}`}></div>
                        </div>
                     </div>
                  </div>
                  <div className="flex flex-col md:flex-row gap-8 items-start">
                    <p className="flex-1 text-4xl font-bold italic leading-[1.4] text-slate-900 tracking-tight">
                       {messages[messages.length - 1]?.content || "Initializing behavioral synchronization..."}
                    </p>

                    {/* Neural Strategic Hint - Integrated */}
                    {currentHint && (
                      <div className="w-full md:w-80 p-6 bg-indigo-50 border border-indigo-100 rounded-3xl flex items-start gap-4 animate-in slide-in-from-right-4 shrink-0 shadow-sm">
                          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center shrink-0 shadow-lg shadow-indigo-200">
                              <ICONS.Sparkles className="w-4 h-4 text-indigo-100" />
                          </div>
                          <div className="text-left flex-1">
                            <h5 className="text-[8px] font-black uppercase tracking-[0.3em] text-indigo-600 mb-1">Neural Strategic Hint</h5>
                            <p className="text-xs font-bold text-slate-600 italic leading-relaxed">{currentHint}</p>
                          </div>
                      </div>
                    )}
                  </div>
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
                       className="w-full group flex items-center justify-between p-10 bg-slate-900 hover:bg-slate-800 border-2 border-slate-800 hover:border-indigo-500/40 rounded-[2.5rem] transition-all shadow-inner"
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
                       onClick={() => isUserListening ? stopListening() : startListening()} 
                       className={`absolute right-10 top-1/2 -translate-y-1/2 p-6 rounded-3xl transition-all border ${isUserListening ? 'bg-emerald-600 border-emerald-500 text-white animate-pulse shadow-[0_0_20px_rgba(16,185,129,0.4)]' : 'bg-slate-100 border-slate-200 text-indigo-600 hover:bg-slate-200'}`}
                     >
                       <ICONS.Ear className={`w-8 h-8 ${isUserListening ? 'animate-bounce' : ''}`} />
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
                  <div key={msg.id} className={`p-4 rounded-2xl border ${msg.role === 'assistant' ? 'bg-slate-900 border-slate-800' : 'bg-indigo-900/20 border-indigo-900/30'}`}>
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
               <div className="p-6 bg-slate-950 border-t border-slate-800">
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

      <AnimatePresence>
        {showExplanation && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-md">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-slate-900 rounded-[3rem] shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto border border-slate-800 custom-scrollbar"
            >
              <div className="p-10 space-y-8">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-200">
                      <ICONS.Sparkles className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h4 className="text-xs font-black uppercase tracking-[0.2em] text-indigo-600">Strategic Explanation</h4>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Neural Logic Node Analysis</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => {
                      setShowExplanation(false);
                      if (activeAudioSource.current) {
                        try { activeAudioSource.current.stop(); } catch(e) {}
                      }
                    }}
                    className="p-3 bg-slate-100 hover:bg-slate-200 text-slate-400 hover:text-slate-600 rounded-2xl transition-all"
                  >
                    <ICONS.Security className="w-6 h-6 rotate-45" />
                  </button>
                </div>

                <div className="p-8 bg-slate-50 border-2 border-slate-100 rounded-[2.5rem] relative">
                  <p className="text-2xl font-bold italic text-slate-900 leading-relaxed">
                    {explanationContent || "Analyzing strategic core..."}
                  </p>
                </div>

                <div className="flex items-center gap-4">
                  <button 
                    onClick={handlePauseResume}
                    className="flex-1 py-6 bg-indigo-600 text-white rounded-[2rem] font-black text-sm uppercase tracking-widest shadow-xl hover:bg-indigo-700 transition-all flex items-center justify-center gap-3"
                  >
                    {isPaused ? <><ICONS.Play className="w-5 h-5" /> Resume Audio</> : <><ICONS.Speaker className="w-5 h-5" /> Pause Audio</>}
                  </button>
                  <button 
                    onClick={() => playAIQuestion(explanationContent)}
                    className="px-10 py-6 bg-amber-100 text-amber-600 rounded-[2rem] font-black text-sm uppercase tracking-widest hover:bg-amber-200 transition-all"
                  >
                    Re-hear
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
