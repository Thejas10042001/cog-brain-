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
  const [facialEmotion, setFacialEmotion] = useState<'neutral' | 'happy' | 'critical' | 'thinking' | 'surprised'>('neutral');
  const [isExplainingProtocol, setIsExplainingProtocol] = useState(false);
  const [isAnalyzingPerformance, setIsAnalyzingPerformance] = useState(false);
  const [coachingFeedback, setCoachingFeedback] = useState<{ failReason?: string; styleGuide?: string; nextTry?: string; idealResponse?: string; logicDeficit?: string } | null> (null);
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
  const [sidebarLeftWidth, setSidebarLeftWidth] = useState(380);
  const [activeResizer, setActiveResizer] = useState<'left' | 'right' | null>(null);
  const [isResizing, setIsResizing] = useState(false);

  const audioContextRef = useRef<AudioContext | null>(null);
  const recognitionRef = useRef<any>(null);
  const activeAudioSource = useRef<AudioBufferSourceNode | null>(null);
  const lastAudioBytes = useRef<Uint8Array | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const startResizing = (dir: 'left' | 'right') => {
    setActiveResizer(dir);
    setIsResizing(true);
  };
  const stopResizing = () => {
    setActiveResizer(null);
    setIsResizing(false);
  };
  
  const resize = (e: MouseEvent) => {
    if (isResizing && activeResizer) {
      if (activeResizer === 'right') {
         const newWidth = window.innerWidth - e.clientX;
         if (newWidth > 150 && newWidth < 800) {
           setHistoryWidth(newWidth);
         }
      } else {
         const newWidth = e.clientX;
         if (newWidth > 150 && newWidth < 800) {
            setSidebarLeftWidth(newWidth);
         }
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
  }, [isResizing, activeResizer]);

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

  const [webcamError, setWebcamError] = useState<string | null>(null);

  const startWebcam = async () => {
    setWebcamError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error("Error accessing webcam:", err);
      if (err instanceof Error) {
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          setWebcamError("Camera permission denied. Please enable camera access in your browser settings.");
        } else {
          setWebcamError(`Error accessing webcam: ${err.message}`);
        }
      } else {
        setWebcamError("Failed to access webcam. Please check your hardware and permissions.");
      }
    }
  };

  useEffect(() => {
    if (sessionActive) {
      startWebcam();
    }
  }, [sessionActive]);

  // Biometric Trace Live Modulation
  useEffect(() => {
    if (!sessionActive) return;
    
    const interval = setInterval(() => {
      setBiometrics(prev => {
        // Base values slightly fluctuate
        const flux = () => (Math.random() - 0.5) * 4;
        
        // Context-aware modulation
        let targetStress = prev.stressLevel;
        let targetFocus = prev.attentionFocus;
        
        if (isAISpeaking) {
          targetStress = Math.max(10, Math.min(30, prev.stressLevel + flux()));
          targetFocus = Math.max(95, Math.min(100, prev.attentionFocus + flux()));
        } else if (isUserListening) {
          targetFocus = Math.max(90, Math.min(98, prev.attentionFocus + flux()));
        } else if (isAnalyzingPerformance) {
          targetStress = Math.max(40, Math.min(60, prev.stressLevel + 2)); 
        }

        let audit = prev.behavioralAudit;
        let suggestion = "";
        
        if (targetStress > 80) {
          audit = "CRITICAL: Autonomic overwhelm detected.";
          suggestion = "Stop speaking immediately. Take a deep 4-second breath. Lower your vocal pitch to regain authority.";
        } else if (targetStress > 60) {
          audit = "WARNING: Elevated stress response.";
          suggestion = "Slow your pacing. Your heart rate is rising, which may lead to defensive communication.";
        } else if (isAISpeaking) {
          audit = "Active listening protocol engaged.";
          suggestion = "Nod slightly to show understanding. Prepare your strategic follow-up node.";
        } else {
          audit = "Neural baseline synchronized.";
          suggestion = "Optimal performance state achieved. Proceed with contextual inquiry.";
        }

        return {
          stressLevel: Math.max(5, Math.min(95, targetStress + flux())),
          attentionFocus: Math.max(60, Math.min(100, targetFocus + flux())),
          eyeContact: Math.max(80, Math.min(100, (isAISpeaking ? 98 : 92) + flux())),
          clarityScore: Math.max(85, Math.min(100, 95 + flux())),
          behavioralAudit: `${audit} | RECOMMENDATION: ${suggestion}`
        };
      });
    }, 1500);

    return () => clearInterval(interval);
  }, [sessionActive, isAISpeaking, isUserListening, isAnalyzingPerformance]);

  const stopAllAudio = () => {
    if (activeAudioSource.current) {
      try { activeAudioSource.current.stop(); activeAudioSource.current = null; } catch (e) {}
    }
    if (audioContextRef.current) {
      audioContextRef.current.resume();
    }
    setIsAISpeaking(false);
  };

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
      try { 
        activeAudioSource.current.stop(); 
        activeAudioSource.current = null;
      } catch (e) {}
    }
    setIsAISpeaking(false);
    setIsUserListening(false); // Stop listening while explaining

    setExplanationContent("");
    setShowExplanation(true);
    setIsExplaining(true);
    try {
      const explanation = await generateExplanation(lastAI.content, "Initial Discovery", meetingContext);
      
      // Only proceed if the popup is still open
      if (showExplanationRef.current) {
        setExplanationContent(explanation);
        
        // Small delay to ensure UI renders the explanation text
        await new Promise(resolve => setTimeout(resolve, 50));
        await playAIQuestion(explanation);
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
    stopAllAudio();
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
    setIsExplainingProtocol(true);
    try {
      // Parallelize Protocol Explanation and Stream Initiation for Zero Latency
      const streamPromise = (async () => {
        const stream = streamAvatarSimulation("START SIMULATION", [], meetingContext);
        let content = "";
        for await (const chunk of stream) content += chunk;
        return content;
      })();

      const explanationPromise = (async () => {
        const explanation = await generateNodeExplanation("Initial Discovery", meetingContext);
        await playAIQuestion(explanation);
      })();

      await explanationPromise;
      setIsExplainingProtocol(false);

      const firstQuestion = await streamPromise;
      const hintMatch = firstQuestion.match(/\[HINT: (.*?)\]/);
      if (hintMatch) setCurrentHint(hintMatch[1]);

      const cleaned = firstQuestion.replace(/\[HINT: .*?\]/, "").trim();
      const assistantMsg: GPTMessage = { id: Date.now().toString(), role: 'assistant', content: cleaned, mode: 'standard' };
      
      setMessages([assistantMsg]);

      // Step 2: Narrate Question
      await playAIQuestion(cleaned);
    } catch (e) { console.error(e); } finally { setIsProcessing(false); setIsExplainingProtocol(false); }
  };

  const handleNextNode = async () => {
    if (isProcessing || !currentCaption.trim()) return;
    
    stopAllAudio();
    stopListening();
    setIsProcessing(true);
    setIsAnalyzingPerformance(true);
    setCoachingFeedback(null);
    setShowCoachingDetails(false);
    setCurrentHint(null);
    setFacialEmotion('thinking');

    const userMsg: GPTMessage = { id: Date.now().toString(), role: 'user', content: currentCaption, mode: 'standard' };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setCurrentCaption("");

    try {
      const stream = streamAvatarSimulation(userMsg.content, messages, meetingContext);
      let nextContent = "";
      for await (const chunk of stream) nextContent += chunk;
      
      const isFail = nextContent.includes('[RESULT: FAIL]');
      const isSuccess = nextContent.includes('[RESULT: SUCCESS]');

      const hintMatch = nextContent.match(/\[HINT: (.*?)\]/);
      if (hintMatch) setCurrentHint(hintMatch[1]);

      // Extract rationale if available
      const deficitMatch = nextContent.match(/\[DEFICIT: (.*?)\]/);
      const coachMatch = nextContent.match(/\[COACHING: ([\s\S]*?)\]/);
      
      setIsAnalyzingPerformance(false);

      if (coachMatch?.[1] || deficitMatch?.[1]) {
        const rationale = (coachMatch?.[1] || deficitMatch?.[1] || "").trim();
        if (rationale) {
          setFacialEmotion(isFail ? 'critical' : 'happy');
          // Start rationale narration with a shorter block and reduced subsequent pause
          await playAIQuestion(rationale);
          await new Promise(resolve => setTimeout(resolve, 300));
        }
      }

      if (isFail) {
        const styleMatch = nextContent.match(/\[STYLE_GUIDE: ([\s\S]*?)\]/);
        const retryMatch = nextContent.match(/\[RETRY_PROMPT: ([\s\S]*?)\]/);
        const idealMatch = nextContent.match(/\[IDEAL_RESPONSE: ([\s\S]*?)\]/);

        const evaluation = {
          logicDeficit: deficitMatch?.[1]?.trim(),
          failReason: coachMatch?.[1]?.trim(),
          idealResponse: idealMatch?.[1]?.trim()
        };

        setCoachingFeedback({
          failReason: evaluation.failReason,
          styleGuide: styleMatch?.[1]?.trim(),
          nextTry: retryMatch?.[1]?.trim(),
          idealResponse: evaluation.idealResponse
        });

        const retryText = retryMatch?.[1]?.trim() || "Protocol performance deficit detected. Please refine your logic and try again.";
        const assistantMsg: GPTMessage = { 
          id: (Date.now() + 1).toString(), 
          role: 'assistant', 
          content: retryText, 
          mode: 'standard',
          evaluation
        };
        
        setMessages([...updatedMessages, assistantMsg]);
        setFacialEmotion('thinking');

        await playAIQuestion(retryText);
      } else {
        const cleaned = nextContent.replace(/\[HINT: .*?\]|\[RESULT: SUCCESS\]|\[COACHING: .*?\]|\[IDEAL_RESPONSE: .*?\]/g, "").trim();
        const assistantMsg: GPTMessage = { id: (Date.now() + 1).toString(), role: 'assistant', content: cleaned, mode: 'standard' };
        
        setMessages([...updatedMessages, assistantMsg]);
        setFacialEmotion('neutral');

        await playAIQuestion(cleaned);
      }
    } catch (e) { console.error(e); } finally { setIsProcessing(false); setIsAnalyzingPerformance(false); }
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

  const AIAnimatedBotCIO = ({ emotion = 'neutral' }: { emotion?: 'neutral' | 'happy' | 'critical' | 'thinking' | 'surprised' }) => (
    <div className="relative w-full h-full bg-slate-900 overflow-hidden flex items-center justify-center">
      <div className={`absolute inset-0 bg-gradient-to-b from-indigo-900/20 to-black/40 transition-opacity duration-1000 ${isAISpeaking ? 'opacity-100' : 'opacity-40'}`}></div>
      <svg viewBox="0 0 200 240" className={`w-full h-full max-w-[280px] transition-all duration-700 ${isAISpeaking ? 'drop-shadow-[0_0_40px_rgba(79,70,229,0.4)] scale-105' : 'drop-shadow-2xl'} ${emotion === 'critical' ? 'brightness-90' : ''}`}>
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
        <motion.g 
          animate={{ 
            rotate: isUserListening ? [0, -1, 1, 0] : 0,
            y: isAISpeaking ? [0, -2, 0] : 0
          }}
          transition={{ repeat: Infinity, duration: 4 }}
        >
          <rect x="88" y="150" width="24" height="25" rx="12" fill="#e2e8f0" />
          <path d="M100 15 C 55 15, 50 55, 50 95 C 50 145, 70 165, 100 165 C 130 165, 150 145, 150 95 C 150 55, 145 15, 100 15" fill="url(#faceGrad)" stroke="#1e1b4b" strokeWidth="0.5" />
          
          {/* Eyebrows */}
          <motion.path 
            d={emotion === 'critical' ? "M65 72 Q 78 68, 90 72" : "M65 70 Q 78 70, 90 70"} 
            stroke="#0f172a" strokeWidth="2" fill="none"
            animate={emotion === 'surprised' ? { y: -5 } : { y: 0 }}
          />
          <motion.path 
            d={emotion === 'critical' ? "M110 72 Q 122 68, 135 72" : "M110 70 Q 122 70, 135 70"} 
            stroke="#0f172a" strokeWidth="2" fill="none"
            animate={emotion === 'surprised' ? { y: -5 } : { y: 0 }}
          />

          <g className="animate-blink">
            <circle cx="78" cy="82" r="4.5" fill="#0f172a" />
            <circle cx="122" cy="82" r="4.5" fill="#0f172a" />
            <motion.circle 
              cx="78" cy="82" r="1.5" fill="#4f46e5" 
              animate={isAISpeaking ? { scale: [1, 1.2, 1] } : {}}
            />
            <motion.circle 
              cx="122" cy="82" r="1.5" fill="#4f46e5" 
              animate={isAISpeaking ? { scale: [1, 1.2, 1] } : {}}
            />
          </g>
          <g transform="translate(100, 132)">
            {isAISpeaking ? (
              <motion.path 
                d="M-12 0 Q 0 12, 12 0 Q 0 -2, -12 0" fill="#0f172a" 
                animate={{ scaleY: [1, 1.5, 0.8, 1.2, 1] }}
                transition={{ repeat: Infinity, duration: 0.2 }}
              />
            ) : (
              <path 
                d={emotion === 'happy' ? "M-10 0 Q 0 10, 10 0" : emotion === 'surprised' ? "M-8 0 Q 0 8, 8 0" : "M-10 0 Q 0 2, 10 0"} 
                stroke="#0f172a" strokeWidth="2.5" fill="none" strokeLinecap="round" 
              />
            )}
          </g>
        </motion.g>
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
              <AIAnimatedBotCIO emotion={facialEmotion} />
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
          {/* NEURAL THREE-COLUMN CORE */}
          <div className="flex-1 flex overflow-hidden">
             {/* Left Sidebar: Cameras & Metrics */}
             <aside 
               style={{ 
                 width: sidebarLeftWidth,
                 transition: isResizing ? 'none' : 'all 0.3s ease'
               }}
               className="border-r border-slate-800 bg-slate-900/50 backdrop-blur-xl flex flex-col shrink-0 overflow-y-auto no-scrollbar"
             >
                <div className="p-8 space-y-10">
                   {/* Sensors */}
                   <div className="space-y-6">
                      <h5 className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-500">Neural Presence Node</h5>
                      <div className="space-y-4">
                        <div className="relative aspect-video rounded-[2rem] overflow-hidden border-2 border-slate-800 shadow-2xl group transition-all hover:scale-[1.02]">
                           <AIAnimatedBotCIO emotion={facialEmotion} />
                           
                           {/* Protocol Explanation Overlay */}
                           <AnimatePresence>
                             {isExplainingProtocol && (
                               <motion.div 
                                 initial={{ opacity: 0, scale: 0.9 }}
                                 animate={{ opacity: 1, scale: 1 }}
                                 exit={{ opacity: 0, scale: 0.9 }}
                                 className="absolute inset-0 bg-indigo-600/60 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center z-10"
                               >
                                 <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center animate-pulse mb-4">
                                   <ICONS.Info className="w-6 h-6 text-white" />
                                 </div>
                                 <h4 className="text-sm font-black uppercase tracking-widest text-white mb-2">Protocol Briefing</h4>
                                 <p className="text-[10px] text-indigo-50 font-bold max-w-[120px]">Agent is outlining the simulation context and boundaries.</p>
                               </motion.div>
                             )}
                           </AnimatePresence>

                           {/* Analysis Overlay */}
                           <AnimatePresence>
                             {isAnalyzingPerformance && (
                                <motion.div 
                                  initial={{ opacity: 0 }}
                                  animate={{ opacity: 1 }}
                                  exit={{ opacity: 0 }}
                                  className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm flex flex-col items-center justify-center gap-4 z-20 text-center p-6"
                                >
                                  <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                                  <div>
                                    <div className="text-xs font-black tracking-tight text-white uppercase mb-1">Synthesizing Feedback</div>
                                    <div className="text-[8px] text-slate-400 max-w-[150px] mx-auto uppercase tracking-widest font-black">Evaluating Response...</div>
                                  </div>
                                </motion.div>
                             )}
                           </AnimatePresence>
                        </div>
                        
                        <div className="relative aspect-video rounded-[2rem] overflow-hidden border-2 border-slate-800 shadow-2xl bg-slate-100 group transition-all hover:scale-[1.02]">
                           <video 
                             ref={videoRef} 
                             autoPlay 
                             playsInline 
                             muted 
                             className="w-full h-full object-cover mirror"
                           />
                           <div className="absolute top-4 left-4 px-3 py-1 bg-black/40 backdrop-blur-md rounded-full border border-white/10">
                              <span className="text-[8px] font-black text-white uppercase tracking-widest">User Profile</span>
                           </div>

                           {(!streamRef.current || webcamError) && (
                             <div className="absolute inset-0 flex items-center justify-center bg-slate-900/80 backdrop-blur-sm px-6">
                                <div className="text-center space-y-4">
                                   {webcamError ? (
                                      <ICONS.X className="w-8 h-8 text-rose-500 mx-auto" />
                                   ) : (
                                      <ICONS.Security className="w-8 h-8 text-slate-400 mx-auto animate-pulse" />
                                   )}
                                   <p className={`text-[8px] font-black uppercase tracking-widest ${webcamError ? 'text-rose-400' : 'text-slate-400'}`}>
                                      {webcamError || 'Protocol Error'}
                                   </p>
                                </div>
                             </div>
                           )}
                        </div>
                      </div>
                   </div>

                   {/* Cognitive Metrics */}
                   <div className="space-y-6">
                      <h5 className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-500">Biometric Trace</h5>
                      <div className="grid grid-cols-1 gap-3">
                        {[
                          { label: 'Stress', value: biometrics.stressLevel, inverse: true },
                          { label: 'Focus', value: biometrics.attentionFocus },
                          { label: 'Eye Contact', value: biometrics.eyeContact },
                          { label: 'Clarity', value: biometrics.clarityScore },
                        ].map(metric => {
                          const isHighStress = metric.label === 'Stress' && metric.value > 70;
                          const isMedStress = metric.label === 'Stress' && metric.value > 40 && metric.value <= 70;
                          
                          const isLowPerf = metric.label !== 'Stress' && metric.value < 65;
                          const isMedPerf = metric.label !== 'Stress' && metric.value >= 65 && metric.value < 85;

                          let colors = "bg-emerald-500/10 border-emerald-500/30 text-emerald-400";
                          if (isHighStress || isLowPerf) colors = "bg-rose-500/10 border-rose-500/30 text-rose-400 animate-pulse";
                          else if (isMedStress || isMedPerf) colors = "bg-amber-500/10 border-amber-500/30 text-amber-400";

                          return (
                            <div key={metric.label} className={`p-4 rounded-2xl border flex items-center justify-between transition-all duration-500 ${colors}`}>
                              <span className="text-[8px] font-black uppercase tracking-widest opacity-80">{metric.label}</span>
                              <div className="flex items-center gap-3">
                                <div className="w-16 h-1.5 bg-black/20 rounded-full overflow-hidden">
                                   <div 
                                     className="h-full bg-current transition-all duration-1000" 
                                     style={{ width: `${metric.value}%` }}
                                   ></div>
                                </div>
                                <span className="text-xs font-black w-8 text-right">{Math.round(metric.value)}%</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                   </div>

                   {/* Behavioral Audit */}
                   <div className="pt-6 border-t border-slate-800 space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                           <div className="w-8 h-8 rounded-xl bg-indigo-600 flex items-center justify-center">
                              <ICONS.Research className="w-4 h-4 text-white" />
                           </div>
                           <h6 className="text-[10px] font-black uppercase tracking-widest text-indigo-400">Behavioral Audit</h6>
                        </div>
                        <div className="flex gap-1">
                           <div className={`w-1.5 h-1.5 rounded-full ${biometrics.stressLevel > 70 ? 'bg-rose-500 animate-ping' : 'bg-emerald-500'}`}></div>
                           <div className="w-1.5 h-1.5 rounded-full bg-indigo-500/30"></div>
                           <div className="w-1.5 h-1.5 rounded-full bg-indigo-500/30"></div>
                        </div>
                      </div>
                      <div className="space-y-3">
                        <div className="p-4 bg-slate-900/80 rounded-2xl border border-slate-800 shadow-inner">
                           <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-1">Observation</p>
                           <p className="text-[10px] font-bold text-slate-100 leading-relaxed italic">{biometrics.behavioralAudit.split(' | RECOMMENDATION: ')[0]}</p>
                        </div>
                        {biometrics.behavioralAudit.includes(' | RECOMMENDATION: ') && (
                          <div className="p-4 bg-indigo-600/10 rounded-2xl border border-indigo-600/30 border-dashed">
                             <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-1 flex items-center gap-2">
                               <ICONS.Efficiency className="w-3 h-3" /> Actionable Logic
                             </p>
                             <p className="text-[10px] font-bold text-indigo-200 leading-relaxed italic">{biometrics.behavioralAudit.split(' | RECOMMENDATION: ')[1]}</p>
                          </div>
                        )}
                      </div>
                   </div>
                </div>
             </aside>

             {/* Draggable Partition Handle */}
             <div 
               onMouseDown={() => startResizing('left')}
               className="w-1.5 h-full cursor-col-resize hover:bg-indigo-500 active:bg-indigo-700 z-40 transition-colors relative"
             >
                <div className="absolute inset-y-0 -left-1 -right-1"></div>
             </div>

             <main className="flex-1 flex flex-col overflow-y-auto custom-scrollbar items-center py-20 px-12 gap-12 justify-center bg-slate-950">
               {/* Unified Single Focus Header */}
               <div className="text-center space-y-4">
                  <span className="px-5 py-2 bg-indigo-900/40 text-indigo-300 text-[10px] font-black uppercase tracking-[0.4em] rounded-full border border-indigo-800/50">
                     Dialogue Node Active
                  </span>
                  <h3 className="text-5xl font-black tracking-tight leading-tight uppercase text-white">
                     {meetingContext.clientNames || 'Executive Client'} Protocol
                  </h3>
               </div>
               {/* Dialogue Protocol Node */}
               {/* Cinematic Narrative Display - Question Node */}
               <div className="bg-slate-900 border border-slate-800 p-12 rounded-[4rem] space-y-6 shadow-2xl animate-in fade-in zoom-in-95 duration-700">
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
                    <p className="flex-1 text-4xl font-bold italic leading-[1.4] text-white tracking-tight">
                       {isExplainingProtocol 
                         ? "Commencing Protocol Briefing..." 
                         : (messages[messages.length - 1]?.content || "Initializing behavioral synchronization...")
                       }
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
                           <div className="flex flex-wrap gap-3">
                             <span className="px-6 py-2.5 bg-rose-600 text-white text-[12px] font-black uppercase rounded-full tracking-[0.2em] shadow-xl">Protocol Blocked: Neural Performance Deficit</span>
                             {coachingFeedback.logicDeficit && (
                               <span className="px-6 py-2.5 bg-rose-100 text-rose-600 text-[12px] font-black uppercase rounded-full tracking-[0.2em] shadow-xl border border-rose-200">
                                 Logic Deficit: {coachingFeedback.logicDeficit}
                               </span>
                             )}
                           </div>
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
               <div className="w-full max-w-4xl space-y-8 pb-20">
                  <div className="relative group">
                     <textarea 
                       value={currentCaption} 
                       onChange={(e) => setCurrentCaption(e.target.value)} 
                       className="w-full bg-slate-900 border-2 border-slate-800 rounded-[3rem] px-12 py-10 text-2xl outline-none focus:border-indigo-500 transition-all font-medium italic text-white shadow-2xl h-48 resize-none placeholder:text-slate-700 leading-relaxed" 
                       placeholder={`${meetingContext.clientNames || 'The Executive'} is awaiting your strategic response...`} 
                     />
                     <button 
                       onClick={() => isUserListening ? stopListening() : startListening()} 
                       className={`absolute right-10 top-1/2 -translate-y-1/2 p-6 rounded-3xl transition-all border ${isUserListening ? 'bg-emerald-600 border-emerald-500 text-white animate-pulse shadow-[0_0_20px_rgba(16,185,129,0.4)]' : 'bg-slate-800 border-slate-700 text-indigo-500'}`}
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
                       className="px-12 py-8 bg-rose-600/10 text-rose-500 border border-rose-900/30 rounded-[2.5rem] font-black text-xs uppercase tracking-widest hover:bg-rose-900/20 transition-all disabled:opacity-50"
                     >
                       End Simulation
                     </button>
                  </div>
               </div>
          </main>

          {/* Right Resizer */}
          <div 
            onMouseDown={() => startResizing('right')}
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

             <div className="flex-1 overflow-y-auto p-4 custom-scrollbar space-y-4" style={{ backgroundColor: '#111117' }}>
                {messages.map((msg, idx) => {
                  if (msg.role === 'assistant' && idx === messages.length - 1 && isExplainingProtocol) return null;
                  return (
                  <div key={msg.id} className={`p-4 rounded-2xl border ${msg.role === 'assistant' ? 'bg-slate-900 border-slate-800' : 'bg-indigo-900/20 border-indigo-900/30'}`}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className={`text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${msg.role === 'assistant' ? 'bg-slate-900 text-white' : 'bg-indigo-600 text-white'}`}>
                          {msg.role === 'assistant' ? 'Client' : 'Seller'}
                        </span>
                        {msg.evaluation?.logicDeficit && (
                          <span className="text-[8px] font-black text-rose-400 uppercase tracking-widest bg-rose-900/30 px-2 py-0.5 rounded-full">
                            Logic Deficit: {msg.evaluation.logicDeficit}
                          </span>
                        )}
                      </div>
                    </div>
                    <p className="text-[10px] font-bold text-slate-400 leading-relaxed" style={{ fontSize: `${historyFontScale * 0.65}rem` }}>
                      {msg.content}
                    </p>
                    {msg.evaluation?.idealResponse && historyWidth > 250 && (
                      <div className="mt-4 pt-4 border-t border-slate-800 space-y-3">
                         <div className="space-y-1">
                           <p className="text-[8px] font-black text-rose-500 uppercase tracking-widest" style={{ fontSize: `${historyFontScale * 0.5}rem` }}>Deficit Rationale:</p>
                           <p className="text-[9px] font-medium text-slate-500 italic leading-snug" style={{ fontSize: `${historyFontScale * 0.6}rem` }}>{msg.evaluation.failReason}</p>
                         </div>
                         <button 
                           onClick={() => {
                             setExplanationContent(`EXPECTED STRATEGIC ANSWER:\n\n${msg.evaluation?.idealResponse}\n\nCOGNITIVE GAP ANALYSIS:\n${msg.evaluation?.failReason}`);
                             setShowExplanation(true);
                           }}
                           className="w-full py-2 bg-indigo-900/30 text-indigo-400 border border-indigo-900/50 rounded-xl text-[8px] font-black uppercase tracking-widest hover:bg-indigo-900/50 transition-all"
                           style={{ fontSize: `${historyFontScale * 0.5}rem` }}
                         >
                           View Expected Answer & Gap Analysis
                         </button>
                      </div>
                    )}
                  </div>
                );
              })}
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
