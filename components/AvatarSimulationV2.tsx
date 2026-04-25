import React, { useState, useRef, useEffect, FC } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ICONS } from '../constants';
import { 
  streamAvatarSimulationV2, 
  generatePitchAudio, 
  generateVoiceSample,
  decodeAudioData,
  evaluateAvatarSessionV2,
  generateExplanation,
  generateNodeExplanation
} from '../services/geminiService';
import { saveSimulationHistory } from '../services/firebaseService';
import { GPTMessage, MeetingContext, SimPersonaV2, ComprehensiveAvatarReport, BiometricTrace } from '../types';

interface AvatarSimulationV2Props {
  meetingContext: MeetingContext;
  onContextChange: (ctx: MeetingContext) => void;
  onStartSimulation?: () => void;
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

export const AvatarSimulationV2: FC<AvatarSimulationV2Props> = ({ meetingContext, onContextChange, onStartSimulation }) => {
  const [persona, setPersona] = useState<SimPersonaV2 | null>(null);
  const [messages, setMessages] = useState<GPTMessage[]>([]);
  const [currentCaption, setCurrentCaption] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [isAISpeaking, setIsAISpeaking] = useState(false);
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
  const [facialEmotion, setFacialEmotion] = useState<'neutral' | 'happy' | 'critical' | 'thinking' | 'surprised'>('neutral');
  const [isExplainingProtocol, setIsExplainingProtocol] = useState(false);
  const [isAnalyzingPerformance, setIsAnalyzingPerformance] = useState(false);
  const [coachingFeedback, setCoachingFeedback] = useState<{ failReason?: string; styleGuide?: string; nextTry?: string; idealResponse?: string; logicDeficit?: string } | null>(null);
  const [showCoachingDetails, setShowCoachingDetails] = useState(false);
  const [quotaExceeded, setQuotaExceeded] = useState<{ exceeded: boolean; retryAfter?: string }>({ exceeded: false });
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
  const [webcamError, setWebcamError] = useState<string | null>(null);

  const audioContextRef = useRef<AudioContext | null>(null);
  const recognitionRef = useRef<any>(null);
  const activeAudioSource = useRef<AudioBufferSourceNode | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const lastAudioBytes = useRef<Uint8Array | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const startResizing = (direction: 'left' | 'right') => {
    setActiveResizer(direction);
    setIsResizing(true);
  };
  const stopResizing = () => {
    setIsResizing(false);
    setActiveResizer(null);
  };
  
  const resize = (e: MouseEvent) => {
    if (!isResizing || !activeResizer) return;
    
    if (activeResizer === 'right') {
      const newWidth = window.innerWidth - e.clientX;
      if (newWidth > 150 && newWidth < 800) {
        setHistoryWidth(newWidth);
      }
    } else {
      const newWidth = e.clientX;
      if (newWidth > 250 && newWidth < 700) {
        setSidebarLeftWidth(newWidth);
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
      const interval = setInterval(() => {
        setBiometrics(prev => {
          let stressDelta = 0;
          let attentionDelta = 0;
          let eyeDelta = 0;
          
          if (isAISpeaking) {
            stressDelta = prev.stressLevel > 20 ? -1.5 : (Math.random() * 0.4 - 0.2);
            attentionDelta = prev.attentionFocus < 96 ? 1.0 : (Math.random() * 0.4 - 0.2);
            eyeDelta = prev.eyeContact < 94 ? 0.8 : (Math.random() * 0.4 - 0.2);
            if (facialEmotion !== 'happy' && facialEmotion !== 'thinking') setFacialEmotion('neutral');
          } else if (isUserListening) {
            const difficultyMultiplier = meetingContext.difficulty === 'Hard' ? 1.8 : meetingContext.difficulty === 'Medium' ? 1.2 : 0.8;
            stressDelta = (Math.random() * 3.0) * difficultyMultiplier;
            attentionDelta = (Math.random() * 4.5 - 2.8);
            eyeDelta = (Math.random() * 7 - 5); 
            setFacialEmotion('critical');
          } else {
            stressDelta = prev.stressLevel > 18 ? -0.8 : 0.3;
            attentionDelta = prev.attentionFocus > 88 ? -0.4 : 0.4;
            eyeDelta = prev.eyeContact > 82 ? -0.4 : 0.4;
            setFacialEmotion('neutral');
          }

          const newStress = Math.max(10, Math.min(98, prev.stressLevel + stressDelta));
          const newAttention = Math.max(60, Math.min(100, prev.attentionFocus + attentionDelta));
          const newEye = Math.max(50, Math.min(100, prev.eyeContact + eyeDelta));
          const newClarity = Math.max(75, Math.min(100, 92 + (Math.random() * 6 - 3)));

          let audit = prev.behavioralAudit;
          let suggestion = "";
          
          if (newStress > 85) {
            audit = "CRITICAL: Autonomic threshold breached.";
            suggestion = "Vagus nerve stimulation required. Pause for 3 seconds. Reset your semantic baseline.";
            setFacialEmotion('surprised');
          } else if (newStress > 65) {
            audit = "WARNING: Signal-to-noise ratio degrading.";
            suggestion = "Semantic saturation detected. Simplify your syntax and lower your volume.";
            setFacialEmotion('thinking');
          } else if (newAttention < 70) {
            audit = "ALERT: Cognitive disengagement.";
            suggestion = "Incorporate a rhetorical hook or direct address to the client's CFO.";
            setFacialEmotion('thinking');
          } else if (newEye < 65) {
            audit = "ALERT: Trust-signal attenuation.";
            suggestion = "Project sincerity through ocular stabilization. Your gaze is too erratic.";
          }
 else if (isAISpeaking) {
            audit = "Active listening protocol engaged.";
            suggestion = "Nod slightly to show understanding. Prepare your strategic follow-up node.";
          } else if (isUserListening) {
            audit = "Strategic delivery under observation.";
            suggestion = "Excellent vocal posture. Maintain this calm, authoritative cadence.";
          } else {
            audit = "Neural baseline synchronized.";
            suggestion = "Optimal performance state achieved. Proceed with contextual inquiry.";
          }

          return {
            stressLevel: newStress,
            attentionFocus: newAttention,
            eyeContact: newEye,
            clarityScore: newClarity,
            behavioralAudit: `${audit} | RECOMMENDATION: ${suggestion}`
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
            console.warn("AudioContext resume failed:", e);
          }
        }

        const voiceSample = await generateVoiceSample(text, meetingContext.vocalPersonaAnalysis?.baseVoice || 'Kore');
        if (voiceSample) {
          const audioData = atob(voiceSample);
          const arrayBuffer = new ArrayBuffer(audioData.length);
          const view = new Uint8Array(arrayBuffer);
          for (let i = 0; i < audioData.length; i++) view[i] = audioData.charCodeAt(i);
          
          let buffer: AudioBuffer | null = null;
          try {
            buffer = await audioContextRef.current.decodeAudioData(arrayBuffer);
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
          source.buffer = buffer;
          source.connect(audioContextRef.current.destination);
          activeAudioSource.current = source;
          
          source.onended = () => {
            setIsAISpeaking(false);
            startListening();
            resolve();
          };
          
          source.start(0);
        } else {
          setIsAISpeaking(false);
          resolve();
        }
      } catch (e) {
        console.error("AI voice failed:", e);
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
    const lastAI = messages.filter(m => m.role === 'assistant').pop();
    if (lastAI) {
      if (activeAudioSource.current) {
        try { activeAudioSource.current.stop(); } catch(e) {}
      }
      playAIQuestion(lastAI.content);
    }
  };

  const handleExplainQuestion = async () => {
    const lastAI = messages.filter(m => m.role === 'assistant').pop();
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
      const explanation = await generateExplanation(lastAI.content, persona || "V2 Simulation", meetingContext);
      
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
      setIsExplainingProtocol(true);
      const explanation = await generateNodeExplanation(nodeName, meetingContext);
      await playAIQuestion(explanation);
    } catch (e) {
      console.error("Node explanation failed:", e);
    } finally {
      setIsExplainingProtocol(false);
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

        return {
          stressLevel: Math.max(5, Math.min(95, targetStress + flux())),
          attentionFocus: Math.max(60, Math.min(100, targetFocus + flux())),
          eyeContact: Math.max(80, Math.min(100, (isAISpeaking ? 98 : 92) + flux())),
          clarityScore: Math.max(85, Math.min(100, 95 + flux())),
          behavioralAudit: prev.behavioralAudit
        };
      });
    }, 1500);

    return () => clearInterval(interval);
  }, [sessionActive, isAISpeaking, isUserListening, isAnalyzingPerformance]);

  const stopAllAudio = () => {
    if (activeAudioSource.current) {
      try { 
        activeAudioSource.current.stop(); 
        activeAudioSource.current = null;
      } catch (e) {}
    }
    if (audioContextRef.current) {
      // In case we were suspended
      audioContextRef.current.resume();
    }
    setIsAISpeaking(false);
  };

  const handleInitiate = async (selected: SimPersonaV2) => {
    stopAllAudio();
    if (onStartSimulation) onStartSimulation();
    setPersona(selected);
    setSessionActive(true);
    setIsProcessing(true);
    setMessages([]);
    setCurrentCaption("");
    setReport(null);
    setCurrentHint(null);
    setCoachingFeedback(null);
    setShowCoachingDetails(false);
    setIsExplainingProtocol(true);
    try {
      // Parallelize Protocol Explanation and Stream Initiation for Zero Latency
      const protocolName = meetingContext.simulationProtocol || "Initial Discovery";
      
      const streamPromise = (async () => {
        const stream = streamAvatarSimulationV2(`PERSONA: ${selected}`, [], meetingContext);
        let content = "";
        for await (const chunk of stream) content += chunk;
        return content;
      })();

      const explanationPromise = (async () => {
        const explanation = await generateNodeExplanation(protocolName, meetingContext);
        await playAIQuestion(explanation);
      })();

      await explanationPromise;
      setIsExplainingProtocol(false);

      const firstQuestion = await streamPromise;
      setQuotaExceeded({ exceeded: false });
      
      const hintMatch = firstQuestion.match(/\[HINT: (.*?)\]/);
      if (hintMatch) setCurrentHint(hintMatch[1]);

      const cleaned = firstQuestion.replace(/\[HINT: .*?\]/, "").trim();
      const assistantMsg: GPTMessage = { id: Date.now().toString(), role: 'assistant', content: cleaned, mode: 'standard' };
      
      setMessages([assistantMsg]);
      
      // Step 2: Narrate Question immediately
      await playAIQuestion(cleaned);
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
    } finally { setIsProcessing(false); setIsExplainingProtocol(false); }
  };

  const handleNextNode = async () => {
    if (isProcessing || !currentCaption.trim()) return;

    // Immediate stop of current narration when commit clicked
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
    setCurrentCaption(""); // Clear input on commit

    try {
      setQuotaExceeded({ exceeded: false });
      const stream = streamAvatarSimulationV2(userMsg.content, messages, meetingContext);
      let nextContent = "";
      for await (const chunk of stream) nextContent += chunk;
      
      const isFail = nextContent.includes('[RESULT: FAIL]');
      
      const hintMatch = nextContent.match(/\[HINT: (.*?)\]/);
      if (hintMatch) setCurrentHint(hintMatch[1]);

      // Extract rationale if available (how the agent feels about the response)
      const deficitMatch = nextContent.match(/\[DEFICIT: (.*?)\]/);
      const coachMatch = nextContent.match(/\[COACHING: ([\s\S]*?)\]/);
      
      setIsAnalyzingPerformance(false);

      if (coachMatch?.[1] || deficitMatch?.[1]) {
        const rationale = (coachMatch?.[1] || deficitMatch?.[1] || "").trim();
        if (rationale) {
          setFacialEmotion(isFail ? 'critical' : 'happy');
          // Narrate the rationale/explanation BEFORE showing the next question
          // Use a shorter timeout and don't block question display as heavily
          await playAIQuestion(rationale);
          // Reduced pause after rationale
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
        setCurrentCaption("");
        setFacialEmotion('thinking');

        // Small delay to ensure UI renders the message first
        await new Promise(resolve => setTimeout(resolve, 50));
        await playAIQuestion(retryText);
      } else {
        const cleaned = nextContent.replace(/\[HINT: .*?\]|\[RESULT: SUCCESS\]|\[COACHING: .*?\]|\[IDEAL_RESPONSE: .*?\]/g, "").trim();
        const assistantMsg: GPTMessage = { id: (Date.now() + 1).toString(), role: 'assistant', content: cleaned, mode: 'standard' };
        
        setMessages([...updatedMessages, assistantMsg]);
        setCurrentCaption("");
        setFacialEmotion('neutral');

        // Small delay to ensure UI renders the message first
        await new Promise(resolve => setTimeout(resolve, 50));
        await playAIQuestion(cleaned);
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
    } finally { setIsProcessing(false); setIsAnalyzingPerformance(false); }
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

  const AnimatedBotV2 = ({ type, emotion = 'neutral' }: { type: SimPersonaV2, emotion?: 'neutral' | 'happy' | 'critical' | 'thinking' | 'surprised' }) => {
    const config = PERSONA_CONFIG[type];
    return (
      <div className="relative w-full h-full bg-slate-900 overflow-hidden flex items-center justify-center">
        <div className={`absolute inset-0 bg-gradient-to-b from-indigo-900/20 to-black/40 transition-opacity duration-1000 ${isAISpeaking ? 'opacity-100' : 'opacity-40'}`}></div>
        <svg viewBox="0 0 200 240" className={`w-full h-full max-w-[280px] transition-all duration-700 ${isAISpeaking ? `drop-shadow-[0_0_40px_${config.color}88] scale-105` : 'drop-shadow-2xl'} ${emotion === 'critical' ? 'brightness-90' : ''}`}>
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
          <motion.g 
            animate={{ 
              rotate: isUserListening ? [0, -1, 1, 0] : 0,
              y: isAISpeaking ? [0, -2, 0] : 0
            }}
            transition={{ repeat: Infinity, duration: 4 }}
          >
            <rect x="90" y="155" width="20" height="20" rx="10" fill="#f1f5f9" />
            <path d="M100 20 C 60 20, 50 60, 50 100 C 50 150, 70 170, 100 170 C 130 170, 150 150, 150 100 C 150 60, 140 20, 100 20" fill={`url(#faceGrad-${type})`} stroke="#1e293b" strokeWidth="0.5" />
            
            {/* Eyebrows for emotions */}
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
              <circle cx="78" cy="85" r="5" fill="#0f172a" />
              <circle cx="122" cy="85" r="5" fill="#0f172a" />
              <motion.circle 
                cx="78" cy="85" r="2" fill={config.accent} 
                animate={isAISpeaking ? { scale: [1, 1.2, 1] } : {}}
              />
              <motion.circle 
                cx="122" cy="85" r="2" fill={config.accent} 
                animate={isAISpeaking ? { scale: [1, 1.2, 1] } : {}}
              />
            </g>
            <g transform="translate(100, 135)">
              {isAISpeaking ? (
                <motion.path 
                  d="M-14 0 Q 0 14, 14 0 Q 0 -3, -14 0" fill="#0f172a" 
                  animate={{ scaleY: [1, 1.5, 0.8, 1.2, 1] }}
                  transition={{ repeat: Infinity, duration: 0.2 }}
                />
              ) : (
                <path 
                  d={emotion === 'happy' ? "M-12 0 Q 0 10, 12 0" : emotion === 'surprised' ? "M-8 0 Q 0 8, 8 0" : "M-10 0 Q 0 3, 12 0"} 
                  stroke="#0f172a" strokeWidth="3" fill="none" strokeLinecap="round" 
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
  };

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
  const leftSidebarFontScale = Math.max(0.8, Math.min(1.4, sidebarLeftWidth / 380));

  return (
    <div className="bg-slate-950 shadow-2xl overflow-hidden relative min-h-[calc(100vh-64px)] flex flex-col text-white animate-in zoom-in-95 duration-500">
      {quotaExceeded.exceeded && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[60] bg-amber-600 text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-3 animate-in slide-in-from-top-4">
          <ICONS.Shield className="w-5 h-5" />
          <div className="flex flex-col">
            <span className="text-xs font-black uppercase tracking-widest">API Quota Exceeded</span>
            <span className="text-[10px] font-bold opacity-80">Please retry {quotaExceeded.retryAfter}. The neural link is currently saturated.</span>
          </div>
        </div>
      )}
      {!sessionActive ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center space-y-12 max-w-5xl mx-auto px-12">
           <div className="space-y-6">
              <h2 className="text-7xl font-black tracking-tight bg-gradient-to-r from-white via-indigo-200 to-slate-400 bg-clip-text text-transparent">Simulation 2.0</h2>
              <p className="text-slate-400 text-2xl font-medium leading-relaxed">Select a target persona to connect with a high-fidelity animated AI Human Bot.</p>
           </div>

           {/* Simulation Protocol Preset Selection */}
           <div className="w-full max-w-5xl bg-slate-900/50 p-8 rounded-[3rem] border border-slate-800 space-y-6">
              <div className="flex items-center justify-between">
                <h4 className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-500">Select Simulation Protocol Preset</h4>
                <span className="px-3 py-1 bg-indigo-900/30 text-indigo-300 text-[8px] font-black uppercase rounded-full border border-indigo-900/50">Strategic Context</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {SIMULATION_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    onClick={() => onContextChange({ ...meetingContext, simulationProtocol: preset.label })}
                    className={`p-6 rounded-3xl text-left transition-all border group ${meetingContext.simulationProtocol === preset.label ? 'bg-indigo-600 border-indigo-400 text-white shadow-xl scale-[1.02]' : 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800'}`}
                  >
                    <h5 className={`text-xs font-black uppercase tracking-widest mb-2 ${meetingContext.simulationProtocol === preset.label ? 'text-white' : 'text-slate-100'}`}>{preset.label}</h5>
                    <p className={`text-[10px] font-medium leading-relaxed ${meetingContext.simulationProtocol === preset.label ? 'text-indigo-100' : 'text-slate-400'}`}>{preset.description}</p>
                  </button>
                ))}
              </div>
           </div>

           {/* Cognitive Challenge Depth Selection */}
           <div className="w-full max-w-2xl bg-slate-900/50 p-8 rounded-[3rem] border border-slate-800 space-y-6">
              <div className="flex items-center justify-between">
                <h4 className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-500">Cognitive Challenge Depth</h4>
                <span className="px-3 py-1 bg-amber-900/30 text-amber-300 text-[8px] font-black uppercase rounded-full border border-amber-900/50">Adaptive Engine</span>
              </div>
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

           <div className="grid grid-cols-1 md:grid-cols-3 gap-8 w-full">
              {(Object.keys(PERSONA_CONFIG) as SimPersonaV2[]).map((p) => (
                <PersonaCardV2 key={p} type={p} onClick={() => handleInitiate(p)} />
              ))}
           </div>
        </div>
      ) : (
        <div className="flex-1 flex overflow-hidden">
          {/* Left Sidebar: Visual Core & Biometrics */}
          <aside 
            style={{ 
              width: sidebarLeftWidth,
              fontSize: `${leftSidebarFontScale}rem`,
              transition: isResizing ? 'none' : 'all 0.3s ease'
            }}
            className="border-r border-slate-800 bg-slate-900/50 backdrop-blur-xl flex flex-col shrink-0 overflow-y-auto no-scrollbar"
          >
             <div className="p-8 space-y-12 h-full flex flex-col">
                <div className="space-y-6">
                   <div className="flex items-center justify-between">
                    <h5 className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-500">Neural Presence Node</h5>
                    <div className="flex items-center gap-2">
                       <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping"></div>
                       <span className="text-[8px] font-black text-emerald-500 uppercase tracking-widest">Active</span>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="relative aspect-square rounded-[2rem] overflow-hidden border-2 border-slate-800 shadow-2xl group transition-all hover:scale-[1.02]">
                       {persona && <AnimatedBotV2 type={persona} emotion={facialEmotion} />}
                       
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
                    
                    <div className="relative aspect-[4/3] rounded-[2rem] overflow-hidden border-2 border-slate-800 shadow-2xl bg-slate-100 group transition-all hover:scale-[1.02]">
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

                {/* Biometric & Cognitive Trace */}
                <div className="space-y-8">
                  <div className="flex items-center justify-between">
                     <h5 className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-500">Biometric & Cognitive Trace</h5>
                  </div>
                  
                 <div className="grid grid-cols-1 gap-4">
                   {[
                     { label: 'Stress Level', value: biometrics.stressLevel, inverse: true },
                     { label: 'Attention Focus', value: biometrics.attentionFocus },
                     { label: 'Eye Contact', value: biometrics.eyeContact },
                     { label: 'Clarity Score', value: biometrics.clarityScore },
                   ].map((stat) => {
                     const isHighStress = stat.label === 'Stress Level' && stat.value > 70;
                     const isMedStress = stat.label === 'Stress Level' && stat.value > 40 && stat.value <= 70;
                     
                     const isLowPerf = stat.label !== 'Stress Level' && stat.value < 65;
                     const isMedPerf = stat.label !== 'Stress Level' && stat.value >= 65 && stat.value < 85;

                     let colorClasses = "bg-emerald-500/10 border-emerald-500/20 text-emerald-400";
                     let progressColor = "bg-emerald-500";
                     
                     if (isHighStress || isLowPerf) {
                       colorClasses = "bg-rose-500/10 border-rose-500/20 text-rose-400 animate-pulse";
                       progressColor = "bg-rose-500";
                     } else if (isMedStress || isMedPerf) {
                       colorClasses = "bg-amber-500/10 border-amber-500/20 text-amber-400";
                       progressColor = "bg-amber-500";
                     }
                     
                     return (
                       <div key={stat.label} className={`${colorClasses} p-5 rounded-2xl border space-y-2 transition-all duration-500`}>
                         <div className="flex justify-between items-center">
                           <span className="text-[8px] font-black uppercase tracking-widest opacity-70">{stat.label}</span>
                           <span className="text-sm font-black">{Math.round(stat.value)}%</span>
                         </div>
                         <div className="w-full h-1 bg-black/20 rounded-full overflow-hidden">
                           <div className={`h-full transition-all duration-1000 ${progressColor}`} style={{ width: `${stat.value}%` }}></div>
                         </div>
                       </div>
                     );
                   })}
                 </div>
                </div>

                {/* Behavioral Audit */}
                <div className="mt-auto pt-8 border-t border-slate-800 space-y-4">
                   <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl bg-indigo-600 flex items-center justify-center shrink-0 shadow-lg shadow-indigo-900/20">
                         <ICONS.Research className="w-4 h-4 text-white" />
                      </div>
                      <h6 className="text-[10px] font-black uppercase tracking-widest text-indigo-400">Behavioral Audit</h6>
                   </div>
                   <div className="p-4 bg-slate-900 rounded-2xl border border-slate-800">
                      <p className="text-[10px] font-bold text-slate-400 italic leading-relaxed">"{biometrics.behavioralAudit}"</p>
                   </div>
                </div>
             </div>
          </aside>

          {/* Left Resizer */}
          <div 
            onMouseDown={() => startResizing('left')}
            className="w-1.5 h-full cursor-col-resize hover:bg-indigo-500 active:bg-indigo-700 z-40 transition-colors relative group"
          >
             <div className="absolute inset-y-0 -left-1 -right-1 group-hover:bg-indigo-500/20"></div>
          </div>

          <main className="flex-1 flex flex-col overflow-y-auto custom-scrollbar py-16 px-12 gap-16 justify-center">
               {/* Unified Focus Header */}
                <div className="text-center space-y-4">
                  <div className="flex flex-col items-center gap-2">
                    <span className="px-6 py-2 rounded-full font-black text-xs uppercase tracking-[0.4em] border border-slate-200 bg-slate-50 text-indigo-600">
                       {persona} PROTOCOL ONLINE
                    </span>
                    {meetingContext.simulationProtocol && (
                      <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">
                        Active Protocol: {meetingContext.simulationProtocol}
                      </span>
                    )}
                  </div>
                  <h3 className="text-5xl font-black tracking-tight leading-tight text-white uppercase">
                     Presence: {meetingContext.clientNames || persona}
                  </h3>
               </div>

               {/* Cinematic Narrative Display - Question Part */}
               <div className="bg-slate-950 border border-slate-800 p-12 rounded-[4rem] space-y-8 shadow-[0_32px_128px_-16px_rgba(0,0,0,0.5)] animate-in fade-in zoom-in-95 duration-700">
                  <div className="flex items-center justify-between">
                     <h5 className="text-[10px] font-black uppercase tracking-[0.4em] text-indigo-400">{persona} Strategic Inquiry</h5>
                     <div className="flex items-center gap-3">
                        <button onClick={handlePauseResume} className="flex items-center gap-1.5 px-4 py-1.5 bg-indigo-900/30 hover:bg-indigo-900/50 text-indigo-300 rounded-full text-[10px] font-black uppercase tracking-widest transition-all shadow-sm border border-indigo-800/50">
                          {isPaused ? <><ICONS.Play className="w-3 h-3" /> Play</> : <><ICONS.Speaker className="w-3 h-3" /> Pause</>}
                        </button>
                        <button onClick={handleRepeat} className="flex items-center gap-1.5 px-4 py-1.5 bg-amber-900/30 hover:bg-amber-900/50 text-amber-300 rounded-full text-[10px] font-black uppercase tracking-widest transition-all shadow-sm border border-amber-800/50">
                          <ICONS.Research className="w-3 h-3" /> Re-hear
                        </button>
                        <button onClick={() => handleExplainQuestion()} className="flex items-center gap-1.5 px-4 py-1.5 bg-indigo-900/30 hover:bg-indigo-900/50 text-indigo-300 rounded-full text-[10px] font-black uppercase tracking-widest transition-all shadow-sm border border-indigo-800/50">
                          <ICONS.Research className="w-3 h-3" /> Explain
                        </button>
                     </div>
                  </div>
                  
                  <div className="flex flex-col lg:flex-row gap-8 items-start">
                    <p className="flex-1 text-3xl font-black italic leading-[1.6] text-white tracking-tight">
                       {isExplainingProtocol 
                         ? "Commencing Protocol Briefing..." 
                         : (messages[messages.length - 1]?.role === 'assistant' ? messages[messages.length - 1].content : status || "Synchronizing Strategic Core...")
                       }
                    </p>

                    {currentHint && (
                      <div className="w-full lg:w-80 p-6 bg-indigo-900/20 border border-indigo-800 rounded-3xl flex items-start gap-4 animate-in slide-in-from-right-4 shrink-0 shadow-sm">
                          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center shrink-0 shadow-lg shadow-indigo-900/20">
                              <ICONS.Sparkles className="w-4 h-4 text-indigo-100" />
                          </div>
                          <div className="text-left flex-1">
                            <h5 className="text-[8px] font-black uppercase tracking-[0.3em] text-indigo-400 mb-1">Strategic Hint</h5>
                            <p className="text-[10px] font-bold text-slate-400 italic leading-relaxed">{currentHint}</p>
                          </div>
                      </div>
                    )}
                  </div>
               </div>

               {/* Protocol Blocked Overlay */}
               {coachingFeedback && (
                 <div className="p-10 bg-rose-950/50 backdrop-blur-2xl border-2 border-rose-900 rounded-[3.5rem] space-y-8 animate-in slide-in-from-bottom-4 duration-500 w-full shadow-2xl">
                     <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                           <div className="w-10 h-10 rounded-full bg-rose-600 flex items-center justify-center text-white shadow-lg"><ICONS.Security className="w-5 h-5" /></div>
                           <h5 className="text-[10px] font-black uppercase text-white tracking-[0.2em]">Neural Performance Deficit</h5>
                        </div>
                        <button onClick={() => setShowCoachingDetails(!showCoachingDetails)} className="text-[10px] font-black uppercase text-rose-400 tracking-widest hover:text-rose-300">
                          {showCoachingDetails ? 'Hide Analysis' : 'Initialize Correction'}
                        </button>
                     </div>

                     {showCoachingDetails && (
                       <div className="space-y-6 pt-4 border-t border-rose-900/30">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                             <div className="space-y-2">
                                <h6 className="text-[9px] font-black uppercase text-rose-400 tracking-widest">Deficit Rationale</h6>
                                <p className="text-sm font-bold text-rose-100 italic leading-relaxed pl-4 border-l-2 border-rose-500">{coachingFeedback.failReason}</p>
                             </div>
                             {coachingFeedback.idealResponse && (
                               <div className="space-y-2">
                                  <h6 className="text-[9px] font-black uppercase text-indigo-400 tracking-widest">Master Logic Node</h6>
                                  <p className="text-sm font-bold text-indigo-100 italic leading-relaxed pl-4 border-l-2 border-indigo-500">{coachingFeedback.idealResponse}</p>
                               </div>
                             )}
                          </div>
                          <div className="flex gap-4 pt-4">
                             <button onClick={handleTryAgain} className="flex-1 py-4 bg-indigo-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl hover:bg-indigo-700 active:scale-95 transition-all">Try Again</button>
                             <button onClick={() => setCoachingFeedback(null)} className="px-8 py-4 bg-slate-800 text-slate-400 rounded-2xl font-black text-[10px] uppercase tracking-widest">Proceed Anyway</button>
                          </div>
                       </div>
                     )}
                 </div>
               )}

               {/* User Interaction Layer - Center Pane Content */}
               <div className="space-y-8 w-full max-w-6xl mx-auto">
                  <div className="relative group">
                     <textarea 
                       value={currentCaption} 
                       onChange={(e) => setCurrentCaption(e.target.value)} 
                       className="w-full bg-slate-900 border-2 border-slate-800 rounded-[3rem] px-12 py-10 text-2xl outline-none focus:border-indigo-500 transition-all font-bold italic text-white shadow-[0_8px_32px_rgba(0,0,0,0.3)] h-48 resize-none placeholder:text-slate-600 leading-relaxed" 
                       placeholder={`Input tactical response to ${meetingContext.clientNames || persona}...`} 
                     />
                     <button 
                       onClick={() => isUserListening ? stopListening() : startListening()} 
                       className={`absolute right-10 top-1/2 -translate-y-1/2 p-6 rounded-3xl transition-all border ${isUserListening ? 'bg-emerald-600 border-emerald-500 text-white animate-pulse' : 'bg-slate-800 border-slate-700 text-indigo-500 hover:bg-slate-700 shadow-xl'}`}
                       title={isUserListening ? "Deactivate Neural Link" : "Activate Neural Link"}
                     >
                       <ICONS.Ear className="w-8 h-8" />
                     </button>
                  </div>

                  <div className="flex items-center gap-6">
                     <button onClick={handleNextNode} disabled={isProcessing || !currentCaption.trim()} className="flex-1 py-8 bg-indigo-600 text-white rounded-[3rem] font-black text-xl uppercase tracking-[0.2em] shadow-[0_20px_50px_rgba(99,102,241,0.3)] hover:bg-indigo-700 disabled:opacity-50 transition-all active:scale-95">Commit Strategy</button>
                     <button onClick={handleEndSession} disabled={isProcessing} className="px-12 py-8 bg-rose-600/10 text-rose-500 border-2 border-rose-900/30 rounded-[3rem] font-black text-sm uppercase tracking-widest hover:bg-rose-900/20 transition-all disabled:opacity-50">End Simulation</button>
                  </div>
               </div>
          </main>

          {/* Right Resizer */}
          <div 
            onMouseDown={() => startResizing('right')}
            className="w-1.5 h-full cursor-col-resize hover:bg-indigo-500 active:bg-indigo-700 z-40 transition-colors relative group"
          >
             <div className="absolute inset-y-0 -left-1 -right-1 group-hover:bg-indigo-500/20"></div>
          </div>

          {/* Right Sidebar: Neural Audit Log */}
          <aside 
            style={{ 
              width: historyWidth, 
              fontSize: `${historyFontScale}rem`,
              transition: isResizing ? 'none' : 'all 0.3s ease'
            }}
            className="border-l border-slate-800 bg-slate-900/50 backdrop-blur-xl flex flex-col shrink-0 overflow-hidden"
          >
             <div className="p-6 border-b border-slate-800 flex items-center justify-between bg-slate-900">
                <div className="flex items-center gap-3">
                   <div className="p-2 bg-indigo-600 rounded-lg text-white" style={{ transform: `scale(${historyFontScale})` }}><ICONS.Research className="w-4 h-4" /></div>
                   {historyWidth > 180 && (
                     <div className="overflow-hidden">
                        <h4 className="text-[12px] font-black uppercase tracking-[0.2em] text-white truncate" style={{ fontSize: `${historyFontScale * 0.75}rem` }}>Simulation History</h4>
                        <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest truncate" style={{ fontSize: `${historyFontScale * 0.5}rem` }}>Mastery Trace Log</p>
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
                {messages.map((msg, idx) => {
                  // Hide the very last assistant message if we are still explaining the protocol
                  if (msg.role === 'assistant' && idx === messages.length - 1 && isExplainingProtocol) {
                    return null;
                  }
                  
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

const PersonaCardV2: FC<{ type: SimPersonaV2; onClick: () => void | Promise<void> }> = ({ type, onClick }) => {
  const config = PERSONA_CONFIG[type];
  return (
    <button onClick={onClick} className="group p-1 bg-slate-900 border-2 border-slate-800 rounded-[3rem] hover:border-indigo-500 transition-all text-left flex flex-col h-full shadow-xl active:scale-95 duration-300">
      <div className="aspect-[4/3] w-full rounded-[2.5rem] overflow-hidden mb-6 relative bg-slate-950 flex items-center justify-center">
         <div className="w-24 h-24 rounded-full bg-slate-900 flex items-center justify-center group-hover:scale-110 transition-transform">
            <ICONS.Brain className="w-12 h-12 text-slate-400 group-hover:text-indigo-400 transition-colors" />
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