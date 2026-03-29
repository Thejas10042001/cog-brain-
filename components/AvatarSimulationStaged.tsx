import React, { useState, useRef, useEffect, FC, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ICONS } from '../constants';
import { 
  streamAvatarStagedSimulation, 
  generatePitchAudio, 
  generateVoiceSample,
  decodeAudioData,
  evaluateAvatarSession,
  generateClientAvatar,
  generateExplanation,
  generateNodeExplanation
} from '../services/geminiService';
import { saveSimulationHistory } from '../services/firebaseService';
import { GPTMessage, MeetingContext, StagedSimStage, StoredDocument, ComprehensiveAvatarReport, BiometricTrace } from '../types';

interface StageAttempt {
  question: string;
  userAnswer: string;
  result: 'SUCCESS' | 'FAIL' | 'SKIPPED' | 'INITIAL';
  rating?: number;
  feedback?: {
    failReason?: string;
    styleGuide?: string;
    idealResponse?: string;
  };
}

const STAGES: StagedSimStage[] = ['Ice Breakers', 'About Business', 'Pricing', 'Technical', 'Legal', 'Closing'];

const STAGE_DESCRIPTIONS: Record<StagedSimStage, string> = {
  'Ice Breakers': 'Establish rapport and mirror the client behavior.',
  'About Business': 'Align solution value with organizational pain points.',
  'Pricing': 'Justify cost through ROI and fiscal logic.',
  'Technical': 'Validate architecture, security, and integration.',
  'Legal': 'Navigate compliance, terms, and liability risks.',
  'Closing': 'Secure final commitment and define next tactical steps.'
};

export const AvatarSimulationStaged: FC<{ 
  meetingContext: MeetingContext; 
  documents: StoredDocument[];
  onContextChange: (ctx: MeetingContext) => void;
  onStartSimulation?: () => void;
}> = ({ meetingContext, documents, onContextChange, onStartSimulation }) => {
  const [currentStage, setCurrentStage] = useState<StagedSimStage>('Ice Breakers');
  const [startStageChoice, setStartStageChoice] = useState<StagedSimStage>('Ice Breakers');
  const [messages, setMessages] = useState<GPTMessage[]>([]);
  const [currentCaption, setCurrentCaption] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isAISpeaking, setIsAISpeaking] = useState(false);
  const [isUserListening, setIsUserListening] = useState(false);
  const [micPermissionError, setMicPermissionError] = useState(false);
  const [sessionActive, setSessionActive] = useState(false);
  const [coachingFeedback, setCoachingFeedback] = useState<{ failReason?: string; styleGuide?: string; nextTry?: string; idealResponse?: string } | null>(null);
  const [showCoachingDetails, setShowCoachingDetails] = useState(false);
  const [quotaExceeded, setQuotaExceeded] = useState<{ exceeded: boolean; retryAfter?: string }>({ exceeded: false });
  const [report, setReport] = useState<ComprehensiveAvatarReport | null>(null);
  const [status, setStatus] = useState("");
  const [currentHint, setCurrentHint] = useState<string | null>(null);
  const [biometrics, setBiometrics] = useState<BiometricTrace>({
    stressLevel: 12,
    attentionFocus: 98,
    eyeContact: 90,
    clarityScore: 95,
    behavioralAudit: "Highly focused, authoritative, and clear."
  });
  
  // Transition Flow State
  const [showTransitionModal, setShowTransitionModal] = useState(false);
  const [transitionChoice, setTransitionChoice] = useState<'same' | 'next'>('next');
  const [questionCount, setQuestionCount] = useState(1);
  const [difficulty, setDifficulty] = useState<'Easy' | 'Medium' | 'Hard'>('Medium');
  const [remainingQuestionsInLoop, setRemainingQuestionsInLoop] = useState(0);

  // Resizable Logic for Sidebar
  const [historyWidth, setHistoryWidth] = useState(400);
  const [isResizing, setIsResizing] = useState(false);

  // Staged History Logic
  const [stageHistory, setStageHistory] = useState<Record<string, StageAttempt[]>>({});
  const [expandedStages, setExpandedStages] = useState<Set<string>>(new Set(['Ice Breakers']));

  // Avatar state
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [isGeneratingAvatar, setIsGeneratingAvatar] = useState(false);

  // Track ratings for each stage
  const [stageRatings, setStageRatings] = useState<Record<string, number | 'skipped'>>({});
  const [showCelebration, setShowCelebration] = useState(false);
  const [showExplanation, setShowExplanation] = useState(false);
  const showExplanationRef = useRef(false);
  useEffect(() => {
    showExplanationRef.current = showExplanation;
  }, [showExplanation]);
  const [explanationContent, setExplanationContent] = useState("");
  const [isExplaining, setIsExplaining] = useState(false);

  const audioContextRef = useRef<AudioContext | null>(null);
  const recognitionRef = useRef<any>(null);
  const activeAudioSource = useRef<AudioBufferSourceNode | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const lastAudioBytes = useRef<Uint8Array | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const startResizing = useCallback(() => setIsResizing(true), []);
  const stopResizing = useCallback(() => setIsResizing(false), []);
  
  const resize = useCallback((e: MouseEvent) => {
    if (isResizing) {
      const newWidth = window.innerWidth - e.clientX;
      if (newWidth > 150 && newWidth < 800) {
        setHistoryWidth(newWidth);
      }
    }
  }, [isResizing]);

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
            const difficultyMultiplier = difficulty === 'Hard' ? 1.5 : difficulty === 'Medium' ? 1.0 : 0.7;
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

  const toggleStageExpand = (s: string) => {
    const next = new Set(expandedStages);
    if (next.has(s)) next.delete(s);
    else next.add(s);
    setExpandedStages(next);
  };

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
      try { activeAudioSource.current.stop(); } catch (e) {}
    }
    setIsAISpeaking(false);

    setExplanationContent("");
    setShowExplanation(true);
    setIsExplaining(true);
    try {
      const explanation = await generateExplanation(lastAI.content, currentStage, meetingContext);
      
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

  const explainNode = async (stage: string): Promise<void> => {
    try {
      const explanation = await generateNodeExplanation(stage, meetingContext);
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

  const handleRehear = () => {
    const lastAI = messages.filter(m => m.role === 'assistant').pop();
    if (lastAI) {
      if (activeAudioSource.current) {
        try { activeAudioSource.current.stop(); } catch(e) {}
      }
      playAIQuestion(lastAI.content);
    }
  };

  const handleInitiate = async (stage?: StagedSimStage) => {
    if (onStartSimulation) onStartSimulation();
    if (!meetingContext.kycDocId) {
      alert("Please select a KYC Document in Configuration first.");
      return;
    }

    if (window.aistudio) {
      const hasKey = await window.aistudio.hasSelectedApiKey();
      if (!hasKey) {
        await window.aistudio.openSelectKey();
      }
    }

    const targetStage = stage || startStageChoice;

    setSessionActive(true);
    setIsProcessing(true);
    setIsGeneratingAvatar(true);
    setMessages([]);
    setStageHistory({});
    setCurrentCaption("");
    setCoachingFeedback(null);
    setShowCoachingDetails(false);
    setCurrentHint(null);
    setStageRatings({});
    setCurrentStage(targetStage);
    setExpandedStages(new Set([targetStage]));

    const kycDoc = documents.find(d => d.id === meetingContext.kycDocId);
    const kycContent = kycDoc ? kycDoc.content : "No KYC data provided.";

    generateClientAvatar(
      meetingContext.clientNames || "Executive", 
      meetingContext.clientCompany || "Enterprise"
    ).then(url => {
      setAvatarUrl(url);
      setIsGeneratingAvatar(false);
    }).catch((err) => {
      console.error("Avatar Gen Failed:", err);
      setIsGeneratingAvatar(false);
    });

    try {
      setQuotaExceeded({ exceeded: false });
      const stream = streamAvatarStagedSimulation(`START AT STAGE: ${targetStage}`, [], meetingContext, targetStage, kycContent);
      let firstMsg = "";
      for await (const chunk of stream) firstMsg += chunk;
      
      if (!firstMsg.trim()) throw new Error("Neural core empty.");

      // Robust extraction for hint
      const hintMatch = firstMsg.match(/\[HINT: ([\s\S]*?)\]/);
      if (hintMatch) setCurrentHint(hintMatch[1]);

      const cleaned = firstMsg.replace(/\[RESULT: SUCCESS\]|\[RESULT: FAIL\]|\[RATING: \d+\]|\[HINT: [\s\S]*?\]/, "").trim();
      const assistantMsg: GPTMessage = { id: Date.now().toString(), role: 'assistant', content: cleaned, mode: 'standard' };
      
      // Zero latency: play immediately
      await explainNode(targetStage);
      await playAIQuestion(cleaned);
      
      setMessages([assistantMsg]);
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
      if (e.message?.includes("Requested entity was not found") && window.aistudio) {
        window.aistudio.openSelectKey();
      }
    } finally { 
      setIsProcessing(false); 
    }
  };

  const jumpToStage = async (stage: StagedSimStage) => {
    if (isProcessing || stage === currentStage) return;
    
    stopListening();
    setIsProcessing(true);
    setCoachingFeedback(null);
    setShowCoachingDetails(false);
    setCurrentHint(null);
    setCurrentCaption("");
    
    setCurrentStage(stage);
    setExpandedStages(prev => new Set(prev).add(stage));

    const kycDoc = documents.find(d => d.id === meetingContext.kycDocId);
    const kycContent = kycDoc ? kycDoc.content : "No KYC data provided.";

    try {
      setQuotaExceeded({ exceeded: false });
      const stream = streamAvatarStagedSimulation(`Manual Override: Jump to Stage ${stage}`, messages, meetingContext, stage, kycContent);
      let response = "";
      for await (const chunk of stream) response += chunk;

      const hintMatch = response.match(/\[HINT: ([\s\S]*?)\]/);
      if (hintMatch) setCurrentHint(hintMatch[1]);

      const cleaned = response.replace(/\[RESULT: SUCCESS\]|\[RESULT: FAIL\]|\[RATING: \d+\]|\[HINT: [\s\S]*?\]/, "").trim();
      const aiMsg: GPTMessage = { id: Date.now().toString(), role: 'assistant', content: cleaned, mode: 'standard' };
      
      // Zero latency: play immediately
      await explainNode(stage);
      await playAIQuestion(cleaned);
      
      setMessages(prev => [...prev, aiMsg]);
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
      if (e.message?.includes("Requested entity was not found") && window.aistudio) {
        window.aistudio.openSelectKey();
      }
    } finally { setIsProcessing(false); }
  };

  const handleCommit = async () => {
    if (isProcessing || !currentCaption.trim()) return;
    const currentQuestion = messages[messages.length - 1]?.content || "";
    const userResponseText = currentCaption;

    stopListening();
    setIsProcessing(true);
    setCoachingFeedback(null);
    setShowCoachingDetails(false);
    setCurrentHint(null);

    const userMsg: GPTMessage = { id: Date.now().toString(), role: 'user', content: currentCaption, mode: 'standard' };
    const updatedHistory = [...messages, userMsg];
    setMessages(updatedHistory);

    const kycDoc = documents.find(d => d.id === meetingContext.kycDocId);
    const kycContent = kycDoc ? kycDoc.content : "No KYC data provided.";

    try {
      setQuotaExceeded({ exceeded: false });
      const stream = streamAvatarStagedSimulation(currentCaption, updatedHistory, meetingContext, currentStage, kycContent);
      let response = "";
      for await (const chunk of stream) response += chunk;

      const isSuccess = response.includes('[RESULT: SUCCESS]');
      const isFail = response.includes('[RESULT: FAIL]');

      // Robust extraction for hint
      const hintMatch = response.match(/\[HINT: ([\s\S]*?)\]/);
      if (hintMatch) setCurrentHint(hintMatch[1]);

      if (isSuccess) {
        const ratingMatch = response.match(/\[RATING: (\d+)\]/);
        const rating = ratingMatch ? parseInt(ratingMatch[1]) : 5;
        setStageRatings(prev => ({ ...prev, [currentStage]: rating }));
        
        const attempt: StageAttempt = {
          question: currentQuestion,
          userAnswer: userResponseText,
          result: 'SUCCESS',
          rating
        };
        setStageHistory(prev => ({
          ...prev,
          [currentStage]: [...(prev[currentStage] || []), attempt]
        }));

        setShowCelebration(true);
        
        if (remainingQuestionsInLoop > 1) {
            setRemainingQuestionsInLoop(prev => prev - 1);
            const cleaned = response.replace(/\[RESULT: SUCCESS\]|\[RATING: \d+\]|\[HINT: [\s\S]*?\]/, "").trim();
            const aiMsg: GPTMessage = { id: (Date.now() + 1).toString(), role: 'assistant', content: cleaned, mode: 'standard' };
            setMessages([...updatedHistory, aiMsg]);
            setCurrentCaption("");
            playAIQuestion(cleaned);
            setTimeout(() => setShowCelebration(false), 2000);
        } else {
            setRemainingQuestionsInLoop(0);
            setTimeout(() => {
                setShowCelebration(false);
                setShowTransitionModal(true);
            }, 3000);
        }

      } else if (isFail) {
        // High-precision multi-line extraction for feedback fields
        const coachMatch = response.match(/\[COACHING: ([\s\S]*?)\]/);
        const styleMatch = response.match(/\[STYLE_GUIDE: ([\s\S]*?)\]/);
        const retryMatch = response.match(/\[RETRY_PROMPT: ([\s\S]*?)\]/);
        const idealMatch = response.match(/\[IDEAL_RESPONSE: ([\s\S]*?)\]/);

        const feedback = {
          failReason: coachMatch?.[1]?.trim(),
          styleGuide: styleMatch?.[1]?.trim(),
          idealResponse: idealMatch?.[1]?.trim()
        };

        setCoachingFeedback({ ...feedback, nextTry: retryMatch?.[1]?.trim() });
        setShowCoachingDetails(false);

        const attempt: StageAttempt = {
          question: currentQuestion,
          userAnswer: userResponseText,
          result: 'FAIL',
          feedback
        };
        setStageHistory(prev => ({
          ...prev,
          [currentStage]: [...(prev[currentStage] || []), attempt]
        }));

        const retryText = retryMatch?.[1]?.trim() || "Protocol performance deficit detected. Please refine your logic and try again.";
        const aiMsg: GPTMessage = { id: (Date.now() + 1).toString(), role: 'assistant', content: retryText, mode: 'standard' };
        setMessages([...updatedHistory, aiMsg]);
        setCurrentCaption("");
        playAIQuestion(retryText);
      } else {
        const cleaned = response.replace(/\[HINT: [\s\S]*?\]/, "").trim();
        const aiMsg: GPTMessage = { id: (Date.now() + 1).toString(), role: 'assistant', content: cleaned, mode: 'standard' };
        setMessages([...updatedHistory, aiMsg]);
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
      if (e.message?.includes("Requested entity was not found") && window.aistudio) {
        window.aistudio.openSelectKey();
      }
    } finally { setIsProcessing(false); }
  };

  const handleTransitionProceed = async () => {
    setShowTransitionModal(false);
    if (transitionChoice === 'next') {
      await handleEndSession();
      return;
    }
    setIsProcessing(true);

    let nextS = currentStage;
    setRemainingQuestionsInLoop(questionCount);

    const kycDoc = documents.find(d => d.id === meetingContext.kycDocId);
    const kycContent = kycDoc ? kycDoc.content : "No KYC data provided.";

    const directive = `System Directive: User has opted to stay in ${currentStage} for a sequence of ${questionCount} questions. 
    Set the cognitive difficulty to: ${difficulty}. 
    Difficulty definitions:
    - Easy: Surface level, common business questions.
    - Medium: Probing deeper into integration and ROI.
    - Hard: High-pressure skepticism, complex objections, challenging the seller's authority.
    Ask the first question now.`;

    try {
      const stream = streamAvatarStagedSimulation(directive, messages, meetingContext, nextS, kycContent);
      let response = "";
      for await (const chunk of stream) response += chunk;

      const hintMatch = response.match(/\[HINT: ([\s\S]*?)\]/);
      if (hintMatch) setCurrentHint(hintMatch[1]);

      const cleaned = response.replace(/\[RESULT: SUCCESS\]|\[RESULT: FAIL\]|\[RATING: \d+\]|\[HINT: [\s\S]*?\]/, "").trim();
      const aiMsg: GPTMessage = { id: Date.now().toString(), role: 'assistant', content: cleaned, mode: 'standard' };
      setMessages(prev => [...prev, aiMsg]);
      playAIQuestion(cleaned);
    } catch (e) {
      console.error(e);
    } finally {
      setIsProcessing(false);
    }
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

  const handleProceedWithFeedback = () => {
    setCoachingFeedback(null);
    setShowCoachingDetails(false);
  };

  const handleSkip = async () => {
    await handleEndSession();
  };

  const handleEndSession = async () => {
    stopListening();
    setIsProcessing(true);
    try {
      const reportJson = await evaluateAvatarSession(messages, meetingContext);
      setReport(reportJson);
      
      // Save to Firebase History
      await saveSimulationHistory({
        type: 'staged',
        meetingContext,
        messages,
        report: reportJson,
        biometrics,
        score: reportJson.deal_readiness_score
      });
    } catch (e) { console.error(e); } finally { setIsProcessing(false); }
  };

  const exportPDF = async () => {
    setIsExporting(true);
    try {
      const { jsPDF } = (window as any).jspdf;
      const doc = new jsPDF();
      let y = 20;
      const margin = 20;
      const width = 170;

      const addHeader = (txt: string, size = 16) => {
        if (y > 270) { doc.addPage(); y = 20; }
        doc.setFont("helvetica", "bold");
        doc.setFontSize(size);
        doc.text(txt, margin, y);
        y += 10;
      };

      const addLine = (txt: string, size = 10, font = "normal", color = [0, 0, 0]) => {
        if (y > 275) { doc.addPage(); y = 20; }
        doc.setFont("helvetica", font);
        doc.setFontSize(size);
        doc.setTextColor(color[0], color[1], color[2]);
        const split = doc.splitTextToSize(txt, width);
        doc.text(split, margin, y);
        y += (split.length * (size / 2)) + 4;
        doc.setTextColor(0, 0, 0); 
      };

      addHeader("Staged Simulation Master Transcript");
      addLine(`Prospect: ${meetingContext.clientNames} (${meetingContext.clientCompany})`);
      addLine(`Seller: ${meetingContext.sellerNames} (${meetingContext.sellerCompany})`);
      addLine(`Date: ${new Date().toLocaleString()}`);
      y += 5;

      STAGES.forEach(s => {
        const attempts = stageHistory[s];
        if (!attempts || attempts.length === 0) return;

        addHeader(`Stage: ${s.toUpperCase()}`, 12);
        attempts.forEach((at, i) => {
          addLine(`Attempt ${i + 1} - Result: ${at.result}`, 10, "bold");
          addLine(`Agent Question: "${at.question}"`, 9, "italic");
          addLine(`User Answer: "${at.userAnswer}"`, 9);
          if (at.feedback) {
            addLine(`Deficit Rationale: ${at.feedback.failReason}`, 8, "italic", [220, 38, 38]);
            addLine(`Strategic Guidance: ${at.feedback.styleGuide}`, 8, "italic");
            if (at.feedback.idealResponse) {
                addLine(`Master Logic: "${at.feedback.idealResponse}"`, 8, "bold", [79, 70, 229]);
            }
          }
          if (at.rating) addLine(`Stage Rating: ${at.rating}/5 Stars`, 9, "bold", [245, 158, 11]);
          y += 2;
        });
        y += 5;
      });

      if (report) {
         addHeader("Final Performance Audit");
         addLine(`Deal Readiness Score: ${report.deal_readiness_score}/10`);
         addLine(`Main Themes: ${report.conversation_summary.main_themes.join(', ')}`);
         addLine(`Executive Summary: ${report.sentiment_analysis.narrative}`);
      }

      doc.save(`Simulation-History-${meetingContext.clientCompany.replace(/\s+/g, '-')}.pdf`);
    } catch (e) {
      console.error(e);
      alert("PDF generation failed.");
    } finally {
      setIsExporting(false);
    }
  };

  const StarRating = ({ rating }: { rating: number | 'skipped' }) => {
    if (rating === 'skipped') return <span className="text-[10px] font-black uppercase text-slate-400">Skipped</span>;
    return (
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map(star => (
          <svg key={star} className={`w-3.5 h-3.5 ${star <= rating ? 'text-amber-400 fill-current' : 'text-slate-200'}`} viewBox="0 0 24 24">
            <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
          </svg>
        ))}
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

  return (
    <div className="bg-slate-950 shadow-2xl overflow-hidden relative min-h-[calc(100vh-64px)] flex flex-col text-white animate-in zoom-in-95 duration-500">
      {quotaExceeded.exceeded && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[120] bg-amber-600 text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-3 animate-in slide-in-from-top-4">
          <ICONS.Shield className="w-5 h-5" />
          <div className="flex flex-col">
            <span className="text-xs font-black uppercase tracking-widest">API Quota Exceeded</span>
            <span className="text-[10px] font-bold opacity-80">Please retry {quotaExceeded.retryAfter}. The neural link is currently saturated.</span>
          </div>
        </div>
      )}
      {showCelebration && (
        <div className="fixed inset-0 z-[100] pointer-events-none flex items-center justify-center bg-indigo-900/90 backdrop-blur-md animate-celebrate-bg">
           <div className="text-center animate-celebrate-text">
              <div className="flex justify-center mb-6 gap-2">
                 {[...Array(20)].map((_, i) => (
                   <div key={i} className="confetti" style={{ 
                     backgroundColor: ['#4f46e5', '#10b981', '#fbbf24', '#f43f5e'][i % 4],
                     left: `${Math.random() * 100}%`,
                     animationDelay: `${Math.random() * 2}s`
                   }}></div>
                 ))}
              </div>
              <h2 className="text-8xl font-black text-white drop-shadow-[0_0_40px_rgba(255,255,255,0.3)] uppercase">CONGRATULATIONS!</h2>
              <p className="text-3xl font-black text-indigo-200 mt-4 uppercase tracking-[0.4em]">Stage Mastery Achieved</p>
           </div>
        </div>
      )}

      {showTransitionModal && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-6 bg-slate-900/80 backdrop-blur-xl animate-in fade-in duration-500">
              <div className="bg-slate-900 border border-slate-800 rounded-[3rem] p-12 max-w-2xl w-full shadow-2xl space-y-10 animate-in zoom-in-95 duration-300">
                  <div className="text-center space-y-4">
                      <div className="w-20 h-20 bg-indigo-600 text-white rounded-3xl flex items-center justify-center mx-auto shadow-xl">
                          <ICONS.Sparkles className="w-10 h-10" />
                      </div>
                      <h3 className="text-3xl font-black tracking-tight text-slate-900">Neural Transition Control</h3>
                      <p className="text-slate-500 font-medium">Stage Mastery confirmed. Configure the next tactical sequence.</p>
                  </div>

                  <div className="grid grid-cols-2 gap-6">
                      <button 
                        onClick={() => setTransitionChoice('same')}
                        className={`p-8 rounded-[2rem] border-2 text-left transition-all ${transitionChoice === 'same' ? 'bg-indigo-600 border-indigo-500 shadow-xl' : 'bg-slate-50 border-slate-200 hover:border-slate-300'}`}
                      >
                          <h5 className="font-black uppercase tracking-widest text-[11px] mb-2 text-indigo-600">Option A</h5>
                          <p className="text-lg font-bold text-slate-900">Reinforce Current Stage</p>
                          <p className="text-[10px] text-slate-500 mt-2">Deeper inquiry into {currentStage} specifics.</p>
                      </button>
                      <button 
                        onClick={() => setTransitionChoice('next')}
                        className={`p-8 rounded-[2rem] border-2 text-left transition-all ${transitionChoice === 'next' ? 'bg-emerald-600 border-emerald-500 shadow-xl' : 'bg-slate-50 border-slate-200 hover:border-slate-300'}`}
                      >
                          <h5 className="font-black uppercase tracking-widest text-[11px] mb-2 text-emerald-600">Option B</h5>
                          <p className="text-lg font-bold text-slate-900">Advance Protocol</p>
                          <p className="text-[10px] text-slate-500 mt-2">Move to the next tactical stage.</p>
                      </button>
                  </div>

                  <div className="space-y-8 p-8 bg-slate-50 rounded-[2.5rem]">
                      <div className="flex items-center justify-between">
                          <div className="space-y-1">
                              <h5 className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Inquiry Density</h5>
                              <p className="text-xs font-bold text-slate-900">{questionCount} questions to ask</p>
                          </div>
                          <div className="flex items-center gap-4">
                              <button onClick={() => setQuestionCount(Math.max(1, questionCount - 1))} className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center font-black text-slate-900 hover:bg-slate-300">-</button>
                              <span className="text-2xl font-black text-indigo-600">{questionCount}</span>
                              <button onClick={() => setQuestionCount(Math.min(5, questionCount + 1))} className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center font-black text-slate-900 hover:bg-slate-300">+</button>
                          </div>
                      </div>

                      <div className="space-y-3">
                          <h5 className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Cognitive Difficulty</h5>
                          <div className="grid grid-cols-3 gap-3">
                              {(['Easy', 'Medium', 'Hard'] as const).map((lvl) => (
                                  <button 
                                    key={lvl}
                                    onClick={() => setDifficulty(lvl)}
                                    className={`py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${difficulty === lvl ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-500 hover:text-slate-700'}`}
                                  >
                                      {lvl}
                                  </button>
                              ))}
                          </div>
                      </div>
                  </div>

                  <button 
                    onClick={handleTransitionProceed}
                    className="w-full py-6 bg-indigo-600 text-white rounded-[2rem] font-black text-xl uppercase tracking-widest shadow-2xl hover:bg-indigo-700 active:scale-[0.98] transition-all"
                  >
                      Initiate Re-engagement
                  </button>
              </div>
          </div>
      )}

      {!sessionActive ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center space-y-12 w-full mx-auto px-12 py-12">
           <div className="space-y-6 w-full">
              <h2 className="text-6xl font-black tracking-tight text-white">Staged Simulation Hub</h2>
              <p className="text-slate-400 text-2xl font-medium leading-relaxed w-full">
                Advance through 6 tactical stages. Select your starting point below to begin the challenge.
              </p>
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
           
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 w-full px-8">
              {STAGES.map((s, i) => {
                const isSelected = startStageChoice === s;
                return (
                  <button 
                    key={s} 
                    onClick={() => handleInitiate(s)}
                    className={`p-10 border-2 rounded-[2.5rem] text-left transition-all group flex flex-col gap-4 h-full ${isSelected ? 'bg-indigo-600 border-indigo-500 shadow-2xl scale-[1.03]' : 'bg-slate-900 border-slate-800 hover:border-indigo-400'}`}
                  >
                    <div className="flex items-center justify-between">
                       <span className={`text-[12px] font-black uppercase tracking-widest ${isSelected ? 'text-indigo-200' : 'text-slate-500'}`}>Stage 0{i+1}</span>
                       {isSelected && <div className="w-3 h-3 rounded-full bg-white animate-pulse"></div>}
                    </div>
                    <h4 className={`text-2xl font-black ${isSelected ? 'text-white' : 'text-slate-100'}`}>{s}</h4>
                    <p className={`text-sm font-medium leading-relaxed ${isSelected ? 'text-indigo-100' : 'text-slate-400'}`}>
                      {STAGE_DESCRIPTIONS[s]}
                    </p>
                  </button>
                );
              })}
           </div>

           <div className="pt-6">
              <button 
                onClick={() => handleInitiate()} 
                disabled={isProcessing}
                className="px-24 py-10 bg-indigo-600 text-white rounded-full font-black text-2xl uppercase tracking-widest shadow-2xl hover:scale-105 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isProcessing ? 'Synchronizing...' : 'Start Full Simulation'}
              </button>
              <p className="text-[12px] font-black uppercase tracking-[0.3em] text-slate-600 mt-8">Neural Presence Engine: V3.1 Primed</p>
           </div>
        </div>
      ) : (
        <div className="flex-1 flex overflow-hidden">
          {/* Main Dashboard Panel - EDGE TO EDGE */}
          <div className="flex-1 flex flex-col bg-slate-950 overflow-hidden">
             
             {/* Header Layer (Fixed) */}
             <div className="p-8 border-b border-slate-800 bg-slate-900/50 backdrop-blur-md">
                {/* Stage Progress Tracker */}
                <div className="grid grid-cols-6 gap-4 w-full mb-8">
                   {STAGES.map((s, i) => {
                     const isActive = currentStage === s;
                     const isDone = STAGES.indexOf(currentStage) > i;
                     const rating = stageRatings[s];
                     
                     return (
                       <button 
                         key={s} 
                         onClick={() => jumpToStage(s)}
                         disabled={isProcessing}
                         className="flex flex-col items-center gap-2 group transition-all disabled:opacity-50"
                       >
                          <div className="h-5 flex items-center justify-center">
                             {rating !== undefined && <StarRating rating={rating} />}
                          </div>
                          <div className={`h-2.5 w-full rounded-full transition-all duration-700 ${isDone ? 'bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.4)]' : isActive ? 'bg-indigo-500 shadow-[0_0_25px_rgba(79,70,229,0.7)]' : 'bg-slate-200'}`}></div>
                          <span className={`text-[9px] font-black uppercase tracking-[0.2em] ${isActive ? 'text-indigo-600' : isDone ? 'text-emerald-600' : 'text-slate-400'}`}>{s}</span>
                       </button>
                     );
                   })}
                </div>

                <div className="flex items-center justify-between">
                   <div className="flex items-center gap-6">
                      <div className="p-3 bg-slate-900 border border-slate-800 rounded-2xl">
                         {isGeneratingAvatar ? (
                           <div className="w-10 h-10 rounded-lg bg-indigo-50 flex items-center justify-center animate-pulse">
                               <ICONS.Efficiency className="w-5 h-5 text-indigo-500" />
                           </div>
                         ) : avatarUrl ? (
                           <img src={avatarUrl} alt="Client" className="w-10 h-10 rounded-lg object-cover" />
                         ) : (
                           <ICONS.Brain className="w-10 h-10 text-slate-400" />
                         )}
                      </div>
                      <div className="space-y-1">
                         <div className="flex items-center gap-4">
                            <div className="px-3 py-1 bg-indigo-50 text-indigo-600 text-[8px] font-black uppercase tracking-[0.4em] rounded-full border border-indigo-100">
                              {currentStage} Stage Active
                            </div>
                            <h3 className="text-2xl font-black tracking-tight text-slate-900">Presence: {meetingContext.clientNames || 'Executive Client'}</h3>
                         </div>
                         <div className="flex items-center gap-3">
                            <div className={`w-1.5 h-1.5 rounded-full ${isAISpeaking ? 'bg-indigo-500 animate-pulse shadow-[0_0_10px_rgba(79,70,229,0.8)]' : 'bg-slate-300'}`}></div>
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{isAISpeaking ? 'Synchronizing Neural Link' : 'Awaiting Input'}</span>
                         </div>
                      </div>
                   </div>
                </div>
             </div>

                 {/* Main Visual Core - Meeting Environment */}
                 <div className="flex-1 flex flex-col overflow-y-auto custom-scrollbar p-12 gap-12">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-6xl mx-auto">
                        <div className="relative aspect-video rounded-[3rem] overflow-hidden border-2 border-slate-200 shadow-2xl group transition-all hover:scale-[1.02] bg-slate-900 flex items-center justify-center">
                           {isGeneratingAvatar ? (
                             <div className="text-center space-y-4">
                                <div className="w-12 h-12 border-4 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin mx-auto"></div>
                                <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Generating Presence...</p>
                             </div>
                           ) : avatarUrl ? (
                             <img src={avatarUrl} alt="Client" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                           ) : (
                             <div className="text-center space-y-4">
                                <ICONS.Efficiency className="w-12 h-12 text-slate-600 mx-auto" />
                                <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Neural Presence Offline</p>
                             </div>
                           )}
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

                           {/* Real-time Cognitive Notifications Removed per user request */}
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
                    <div className="w-full max-w-6xl mx-auto bg-slate-50 border border-slate-200 p-12 rounded-[4rem] space-y-6 shadow-2xl animate-in fade-in zoom-in-95 duration-700">
                        <div className="flex items-center justify-between mb-2">
                           <h5 className="text-[10px] font-black uppercase tracking-[0.4em] text-indigo-400">{currentStage} Strategic Inquiry</h5>
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
                              <div className="flex gap-1.5 ml-2">
                                <div className={`w-1.5 h-1.5 rounded-full ${isAISpeaking ? 'bg-indigo-500 animate-pulse' : 'bg-indigo-500/20'}`}></div>
                                <div className={`w-1.5 h-1.5 rounded-full ${isAISpeaking ? 'bg-indigo-500 animate-pulse delay-75' : 'bg-indigo-500/40'}`}></div>
                                <div className={`w-1.5 h-1.5 rounded-full ${isAISpeaking ? 'bg-indigo-500 animate-pulse delay-150' : 'bg-indigo-500'}`}></div>
                              </div>
                           </div>
                        </div>
                        <div className="flex flex-col md:flex-row gap-8 items-start">
                          <p className="flex-1 text-4xl font-black italic leading-[1.4] text-slate-900 tracking-tight">
                             {messages[messages.length - 1]?.content || "Synchronizing Strategic Core..."}
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
                      <div className="w-full max-w-6xl mx-auto p-12 bg-rose-50 backdrop-blur-2xl border-2 border-rose-200 rounded-[3.5rem] space-y-8 animate-in slide-in-from-bottom-4 duration-500 shadow-[0_40px_100px_rgba(0,0,0,0.1)]">
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
                                <button onClick={handleProceedWithFeedback} className="px-12 py-7 bg-slate-100 text-slate-600 border border-slate-200 rounded-[2.5rem] font-black text-[12px] uppercase tracking-[0.2em] hover:bg-slate-200 active:scale-95 transition-all">Proceed with Feedback</button>
                              </div>
                            </div>
                          )}
                      </div>
                    )}

                    {/* User Interaction Layer */}
                    <div className="w-full max-w-6xl mx-auto space-y-8 pb-24">
                       <div className="relative group">
                          <textarea value={currentCaption} onChange={(e) => setCurrentCaption(e.target.value)} className="w-full bg-slate-900 border-2 border-slate-800 rounded-[3rem] px-12 py-10 text-2xl outline-none focus:border-indigo-500 transition-all font-bold italic text-white shadow-inner h-48 resize-none placeholder:text-slate-500 leading-relaxed" placeholder={`Respond to ${meetingContext.clientNames || "Client"}...`} />
                          <button 
                          onClick={() => isUserListening ? stopListening() : startListening()} 
                          className={`absolute right-10 top-1/2 -translate-y-1/2 p-6 rounded-3xl transition-all border ${isUserListening ? 'bg-emerald-600 border-emerald-500 text-white animate-pulse' : 'bg-slate-100 border-slate-200 text-indigo-600 hover:bg-slate-200'}`}
                          title={isUserListening ? "Stop Listening" : "Start Listening"}
                        >
                          <ICONS.Ear className="w-8 h-8" />
                        </button>
                       </div>

                       <div className="flex items-center gap-6">
                          <button onClick={handleCommit} disabled={isProcessing || !currentCaption.trim()} className="flex-1 py-8 bg-indigo-600 text-white rounded-[2.5rem] font-black text-xl uppercase tracking-[0.2em] shadow-2xl hover:bg-indigo-700 disabled:opacity-50 transition-all active:scale-95">Commit Strategy</button>
                          <button onClick={handleSkip} disabled={isProcessing} className="px-12 py-8 bg-slate-100 text-slate-600 border border-slate-200 rounded-[2.5rem] font-black text-sm uppercase tracking-widest hover:bg-slate-200 transition-all disabled:opacity-50">Skip Stage</button>
                       </div>
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

          {/* Right Sidebar: Neural Audit Log (Stage History) */}
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
                {STAGES.map((s, idx) => {
                   const attempts = stageHistory[s] || [];
                   const isExpanded = expandedStages.has(s);
                   const isLocked = !isExpanded && attempts.length === 0 && STAGES.indexOf(currentStage) < idx;
                   const isSuccess = attempts.some(a => a.result === 'SUCCESS');
                   const isSkipped = attempts.some(a => a.result === 'SKIPPED');

                   return (
                     <div key={s} className={`rounded-3xl border transition-all duration-500 ${isExpanded ? 'bg-slate-900 border-slate-800 shadow-sm' : 'bg-transparent border-slate-800 opacity-60'}`}>
                        <button 
                          onClick={() => !isLocked && toggleStageExpand(s)}
                          disabled={isLocked}
                          className="w-full p-5 flex items-center justify-between group"
                        >
                           <div className="flex items-center gap-4">
                              <div 
                                className={`w-8 h-8 rounded-xl flex items-center justify-center font-black text-[10px] ${isSuccess ? 'bg-emerald-500 text-white' : isSkipped ? 'bg-slate-200 text-slate-500' : isExpanded ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-400'}`}
                                style={{ transform: `scale(${historyFontScale})` }}
                              >
                                 0{idx + 1}
                              </div>
                              {historyWidth > 180 && (
                                <div className="text-left">
                                  <h5 className={`text-[11px] font-black uppercase tracking-widest ${isSuccess ? 'text-emerald-600' : isExpanded ? 'text-slate-900' : 'text-slate-400'}`} style={{ fontSize: `${historyFontScale * 0.7}rem` }}>{s}</h5>
                                  <p className="text-[8px] font-bold text-slate-500 uppercase" style={{ fontSize: `${historyFontScale * 0.5}rem` }}>{attempts.length} interactions</p>
                                </div>
                              )}
                           </div>
                           <svg className={`w-4 h-4 text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M19 9l-7 7-7-7" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" /></svg>
                        </button>

                        {isExpanded && historyWidth > 150 && (
                           <div className="px-5 pb-6 space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                              {attempts.length === 0 ? (
                                 <p className="text-[9px] font-bold text-slate-400 italic border-l-2 border-slate-200 pl-4 py-1" style={{ fontSize: `${historyFontScale * 0.6}rem` }}>Awaiting interaction node...</p>
                              ) : (
                                 attempts.map((at, i) => (
                                    <div key={i} className={`p-4 rounded-2xl border ${at.result === 'SUCCESS' ? 'bg-emerald-50 border-emerald-100' : at.result === 'SKIPPED' ? 'bg-slate-50 border-slate-100' : 'bg-rose-50 border-rose-100'}`}>
                                       <div className="flex justify-between items-center mb-3">
                                          <span className={`text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${at.result === 'SUCCESS' ? 'bg-emerald-500 text-white' : at.result === 'SKIPPED' ? 'bg-slate-400 text-white' : 'bg-rose-600 text-white'}`} style={{ fontSize: `${historyFontScale * 0.5}rem` }}>
                                             {at.result === 'FAIL' ? 'Deficit' : at.result}
                                          </span>
                                          {at.rating && <div style={{ transform: `scale(${historyFontScale * 0.8})`, transformOrigin: 'right center' }}><StarRating rating={at.rating} /></div>}
                                       </div>
                                       <div className="space-y-4">
                                          <div className="flex items-start gap-3">
                                             {avatarUrl ? (
                                                <img src={avatarUrl} alt="Client" className="w-8 h-8 rounded-full object-cover border border-indigo-100 shrink-0 mt-1" style={{ width: `${historyFontScale * 2}rem`, height: `${historyFontScale * 2}rem` }} />
                                             ) : (
                                                <div className="w-8 h-8 rounded-full bg-indigo-50 flex items-center justify-center shrink-0 mt-1" style={{ width: `${historyFontScale * 2}rem`, height: `${historyFontScale * 2}rem` }}><ICONS.Brain className="w-4 h-4 text-indigo-400" /></div>
                                             )}
                                             <div className="space-y-1 overflow-hidden">
                                                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest" style={{ fontSize: `${historyFontScale * 0.5}rem` }}>Inquiry:</p>
                                                <p className="text-[10px] font-bold text-slate-700 leading-snug truncate" style={{ fontSize: `${historyFontScale * 0.65}rem` }}>"{at.question}"</p>
                                             </div>
                                          </div>
                                          <div className="space-y-1 border-l-2 border-indigo-100 pl-3">
                                             <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest" style={{ fontSize: `${historyFontScale * 0.5}rem` }}>Protocol Delivery:</p>
                                             <p className="text-[10px] font-bold text-slate-900 leading-relaxed line-clamp-3" style={{ fontSize: `${historyFontScale * 0.65}rem` }}>"{at.userAnswer}"</p>
                                          </div>
                                          {at.feedback && historyWidth > 250 && (
                                             <div className="pt-3 mt-3 border-t border-slate-100 space-y-2">
                                                <p className="text-[8px] font-black text-rose-500 uppercase tracking-widest" style={{ fontSize: `${historyFontScale * 0.5}rem` }}>Deficit Rationale:</p>
                                                <p className="text-[9px] font-medium text-slate-500 italic leading-snug" style={{ fontSize: `${historyFontScale * 0.6}rem` }}>{at.feedback.failReason}</p>
                                             </div>
                                          )}
                                       </div>
                                    </div>
                                 ))
                              )}
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

      <style>{`
        @keyframes celebrate-bg { 
          0% { opacity: 0; } 
          10%, 90% { opacity: 1; } 
          100% { opacity: 0; } 
        }
        @keyframes celebrate-text { 
          0% { transform: scale(0.5); opacity: 0; } 
          15%, 85% { transform: scale(1); opacity: 1; } 
          100% { transform: scale(1.2); opacity: 0; } 
        }
        .animate-celebrate-bg { animation: celebrate-bg 3.5s forwards ease-in-out; }
        .animate-celebrate-text { animation: celebrate-text 3.5s forwards cubic-bezier(0.175, 0.885, 0.32, 1.275); }
        
        .confetti { 
          position: absolute; 
          width: 10px; 
          height: 10px; 
          border-radius: 2px; 
          animation: confetti-fall 3s linear forwards; 
          z-index: 101; 
        }
        @keyframes confetti-fall { 
          0% { transform: translateY(-100vh) rotate(0deg); opacity: 1; } 
          100% { transform: translateY(100vh) rotate(720deg); opacity: 0; } 
        }
      `}</style>
    </div>
  );
};