
import React, { useState, useRef, useEffect, FC } from 'react';
import { ICONS } from '../constants';
import { 
  streamAvatarStagedSimulation, 
  generatePitchAudio, 
  decodeAudioData,
  evaluateAvatarSession,
  generateClientAvatar
} from '../services/geminiService';
import { GPTMessage, MeetingContext, StagedSimStage, StoredDocument, ComprehensiveAvatarReport } from '../types';

interface AvatarSimulationStagedProps {
  meetingContext: MeetingContext;
  documents: StoredDocument[];
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

export const AvatarSimulationStaged: FC<AvatarSimulationStagedProps> = ({ meetingContext, documents }) => {
  const [currentStage, setCurrentStage] = useState<StagedSimStage>('Ice Breakers');
  const [startStageChoice, setStartStageChoice] = useState<StagedSimStage>('Ice Breakers');
  const [messages, setMessages] = useState<GPTMessage[]>([]);
  const [currentCaption, setCurrentCaption] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [isAISpeaking, setIsAISpeaking] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isUserListening, setIsUserListening] = useState(false);
  const [sessionActive, setSessionActive] = useState(false);
  const [coachingFeedback, setCoachingFeedback] = useState<{ failReason?: string; styleGuide?: string; nextTry?: string; idealResponse?: string } | null>(null);
  const [report, setReport] = useState<ComprehensiveAvatarReport | null>(null);
  const [currentHint, setCurrentHint] = useState<string | null>(null);
  
  // Avatar state
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [isGeneratingAvatar, setIsGeneratingAvatar] = useState(false);

  // Track ratings for each stage
  const [stageRatings, setStageRatings] = useState<Record<string, number | 'skipped'>>({});
  const [showCelebration, setShowCelebration] = useState(false);

  const audioContextRef = useRef<AudioContext | null>(null);
  const recognitionRef = useRef<any>(null);
  const activeAudioSource = useRef<AudioBufferSourceNode | null>(null);
  const lastAudioBytes = useRef<Uint8Array | null>(null);

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
      recognition.onend = () => {
        if (sessionActive && !isAISpeaking) {
            try { recognitionRef.current.start(); } catch(e) {}
        }
        setIsUserListening(false);
      };
      recognitionRef.current = recognition;
    }
  }, [sessionActive, isAISpeaking]);

  const playAIQuestion = async (text: string) => {
    setIsAISpeaking(true);
    setIsPaused(false);
    try {
      if (!audioContextRef.current) audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      if (audioContextRef.current.state === 'suspended') await audioContextRef.current.resume();
      
      const bytes = await generatePitchAudio(text, 'Charon', meetingContext.vocalPersonaAnalysis?.mimicryDirective);
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

  const startListening = () => {
    if (recognitionRef.current && !isAISpeaking) {
      try { recognitionRef.current.start(); setIsUserListening(true); } catch (e) {}
    }
  };

  const stopListening = () => {
    if (recognitionRef.current) { recognitionRef.current.stop(); setIsUserListening(false); }
  };

  const handleInitiate = async () => {
    if (!meetingContext.kycDocId) {
      alert("Please select a KYC Document in Configuration first.");
      return;
    }

    // High quality generation requires an API key selection
    if (!(await window.aistudio.hasSelectedApiKey())) {
      await window.aistudio.openSelectKey();
    }

    setSessionActive(true);
    setIsProcessing(true);
    setIsGeneratingAvatar(true);
    setMessages([]);
    setCurrentCaption("");
    setCoachingFeedback(null);
    setCurrentHint(null);
    setStageRatings({});
    setCurrentStage(startStageChoice);

    const kycDoc = documents.find(d => d.id === meetingContext.kycDocId);
    const kycContent = kycDoc ? kycDoc.content : "No KYC data provided.";

    // Parallelize Avatar Generation and Simulation Initiation
    const avatarPromise = generateClientAvatar(
      meetingContext.clientNames || "Executive", 
      meetingContext.clientCompany || "Enterprise"
    ).then(url => {
      setAvatarUrl(url);
      setIsGeneratingAvatar(false);
    }).catch(() => setIsGeneratingAvatar(false));

    try {
      const stream = streamAvatarStagedSimulation(`START AT STAGE: ${startStageChoice}`, [], meetingContext, startStageChoice, kycContent);
      let firstMsg = "";
      for await (const chunk of stream) firstMsg += chunk;
      
      const hintMatch = firstMsg.match(/\[HINT: (.*?)\]/);
      if (hintMatch) setCurrentHint(hintMatch[1]);

      const cleaned = firstMsg.replace(/\[RESULT: SUCCESS\]|\[RESULT: FAIL\]|\[RATING: \d+\]|\[HINT: .*?\]/, "").trim();
      const assistantMsg: GPTMessage = { id: Date.now().toString(), role: 'assistant', content: cleaned, mode: 'standard' };
      setMessages([assistantMsg]);
      playAIQuestion(cleaned);
    } catch (e) { console.error(e); } finally { setIsProcessing(false); }
  };

  const handleCommit = async () => {
    if (isProcessing || !currentCaption.trim()) return;
    stopListening();
    setIsProcessing(true);
    setCoachingFeedback(null);
    setCurrentHint(null);

    const userMsg: GPTMessage = { id: Date.now().toString(), role: 'user', content: currentCaption, mode: 'standard' };
    const updatedHistory = [...messages, userMsg];
    setMessages(updatedHistory);

    const kycDoc = documents.find(d => d.id === meetingContext.kycDocId);
    const kycContent = kycDoc ? kycDoc.content : "No KYC data provided.";

    try {
      const stream = streamAvatarStagedSimulation(currentCaption, updatedHistory, meetingContext, currentStage, kycContent);
      let response = "";
      for await (const chunk of stream) response += chunk;

      const isSuccess = response.includes('[RESULT: SUCCESS]');
      const isFail = response.includes('[RESULT: FAIL]');

      const hintMatch = response.match(/\[HINT: (.*?)\]/);
      if (hintMatch) setCurrentHint(hintMatch[1]);

      if (isSuccess) {
        // Extract Rating
        const ratingMatch = response.match(/\[RATING: (\d+)\]/);
        const rating = ratingMatch ? parseInt(ratingMatch[1]) : 5;
        
        setStageRatings(prev => ({ ...prev, [currentStage]: rating }));
        setShowCelebration(true);
        
        // Hide celebration after 3.5 seconds
        setTimeout(() => setShowCelebration(false), 3500);

        const nextIdx = STAGES.indexOf(currentStage) + 1;
        if (nextIdx < STAGES.length) {
          setCurrentStage(STAGES[nextIdx]);
        }
        const cleaned = response.replace(/\[RESULT: SUCCESS\]|\[RATING: \d+\]|\[HINT: .*?\]/, "").trim();
        const aiMsg: GPTMessage = { id: (Date.now() + 1).toString(), role: 'assistant', content: cleaned, mode: 'standard' };
        setMessages([...updatedHistory, aiMsg]);
        setCurrentCaption("");
        playAIQuestion(cleaned);
      } else if (isFail) {
        const coachMatch = response.match(/\[COACHING: (.*?)\]/);
        const styleMatch = response.match(/\[STYLE_GUIDE: (.*?)\]/);
        const retryMatch = response.match(/\[RETRY_PROMPT: (.*?)\]/);
        const idealMatch = response.match(/\[IDEAL_RESPONSE: (.*?)\]/);

        setCoachingFeedback({
          failReason: coachMatch?.[1],
          styleGuide: styleMatch?.[1],
          nextTry: retryMatch?.[1],
          idealResponse: idealMatch?.[1]
        });

        const retryText = retryMatch?.[1] || "Please try again with a better approach.";
        const aiMsg: GPTMessage = { id: (Date.now() + 1).toString(), role: 'assistant', content: retryText, mode: 'standard' };
        setMessages([...updatedHistory, aiMsg]);
        setCurrentCaption("");
        playAIQuestion(retryText);
      } else {
        const cleaned = response.replace(/\[HINT: .*?\]/, "").trim();
        const aiMsg: GPTMessage = { id: (Date.now() + 1).toString(), role: 'assistant', content: cleaned, mode: 'standard' };
        setMessages([...updatedHistory, aiMsg]);
        playAIQuestion(cleaned);
      }
    } catch (e) { console.error(e); } finally { setIsProcessing(false); }
  };

  const handleSkip = async () => {
    const currentIndex = STAGES.indexOf(currentStage);
    if (currentIndex >= STAGES.length - 1) return;

    stopListening();
    setIsProcessing(true);
    setCoachingFeedback(null);
    setCurrentHint(null);
    setCurrentCaption("");
    
    // Mark as skipped in ratings
    setStageRatings(prev => ({ ...prev, [currentStage]: 'skipped' }));

    const nextStage = STAGES[currentIndex + 1];
    setCurrentStage(nextStage);

    const kycDoc = documents.find(d => d.id === meetingContext.kycDocId);
    const kycContent = kycDoc ? kycDoc.content : "No KYC data provided.";

    try {
      const stream = streamAvatarStagedSimulation(`Manual Override: Advance to Stage ${nextStage}`, messages, meetingContext, nextStage, kycContent);
      let response = "";
      for await (const chunk of stream) response += chunk;

      const hintMatch = response.match(/\[HINT: (.*?)\]/);
      if (hintMatch) setCurrentHint(hintMatch[1]);

      const cleaned = response.replace(/\[RESULT: SUCCESS\]|\[RESULT: FAIL\]|\[RATING: \d+\]|\[HINT: .*?\]/, "").trim();
      const aiMsg: GPTMessage = { id: Date.now().toString(), role: 'assistant', content: cleaned, mode: 'standard' };
      setMessages(prev => [...prev, aiMsg]);
      playAIQuestion(cleaned);
    } catch (e) {
      console.error(e);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleEndSession = async () => {
    stopListening();
    setIsProcessing(true);
    try {
      const reportJson = await evaluateAvatarSession(messages, meetingContext);
      setReport(reportJson);
    } catch (e) { console.error(e); } finally { setIsProcessing(false); }
  };

  const handleTryAgain = () => {
    setCoachingFeedback(null);
    setCurrentCaption("");
    startListening();
  };

  const handleProceedDespiteFailure = async () => {
    if (isProcessing) return;
    setCoachingFeedback(null);
    setIsProcessing(true);
    setCurrentHint(null);

    const kycDoc = documents.find(d => d.id === meetingContext.kycDocId);
    const kycContent = kycDoc ? kycDoc.content : "No KYC data provided.";

    try {
      const stream = streamAvatarStagedSimulation(`Ignore previous failure. Ask me a new specific question for the ${currentStage} stage to move the conversation forward.`, messages, meetingContext, currentStage, kycContent);
      let response = "";
      for await (const chunk of stream) response += chunk;

      const hintMatch = response.match(/\[HINT: (.*?)\]/);
      if (hintMatch) setCurrentHint(hintMatch[1]);

      const cleaned = response.replace(/\[RESULT: SUCCESS\]|\[RESULT: FAIL\]|\[RATING: \d+\]|\[HINT: .*?\]/, "").trim();
      const aiMsg: GPTMessage = { id: Date.now().toString(), role: 'assistant', content: cleaned, mode: 'standard' };
      setMessages(prev => [...prev, aiMsg]);
      playAIQuestion(cleaned);
    } catch (e) {
      console.error(e);
    } finally {
      setIsProcessing(false);
    }
  };

  const StarRating = ({ rating }: { rating: number | 'skipped' }) => {
    if (rating === 'skipped') return <span className="text-[10px] font-black uppercase text-slate-600">Skipped</span>;
    return (
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map(star => (
          <svg key={star} className={`w-3.5 h-3.5 ${star <= rating ? 'text-amber-400 fill-current' : 'text-slate-800'}`} viewBox="0 0 24 24">
            <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
          </svg>
        ))}
      </div>
    );
  };

  return (
    <div className="bg-slate-950 shadow-2xl overflow-hidden relative min-h-[calc(100vh-64px)] flex flex-col text-white animate-in zoom-in-95 duration-500">
      {/* Celebration Overlay */}
      {showCelebration && (
        <div className="fixed inset-0 z-[100] pointer-events-none flex items-center justify-center bg-indigo-600/20 backdrop-blur-[2px] animate-celebrate-bg">
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
              <h2 className="text-8xl font-black text-white drop-shadow-[0_0_40px_rgba(255,255,255,0.5)] uppercase">CONGRATULATIONS!</h2>
              <p className="text-3xl font-black text-indigo-200 mt-4 uppercase tracking-[0.4em]">Stage Mastery Achieved</p>
           </div>
        </div>
      )}

      {!sessionActive ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center space-y-12 w-full mx-auto px-12 py-12">
           <div className="p-10 bg-slate-900 rounded-[4rem] border border-white/5 shadow-2xl relative overflow-hidden group">
              <div className="absolute inset-0 bg-indigo-600/10 scale-0 group-hover:scale-100 transition-transform duration-1000 rounded-full blur-3xl opacity-50"></div>
              <ICONS.Efficiency className="w-32 h-32 text-indigo-600 relative z-10" />
           </div>
           <div className="space-y-6">
              <h2 className="text-6xl font-black tracking-tight">Staged Simulation Node</h2>
              <p className="text-slate-400 text-2xl font-medium leading-relaxed max-w-5xl mx-auto">
                Advance through 6 tactical stages. Select your starting point below to begin the challenge.
              </p>
           </div>
           
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 w-full px-8">
              {STAGES.map((s, i) => {
                const isSelected = startStageChoice === s;
                return (
                  <button 
                    key={s} 
                    onClick={() => setStartStageChoice(s)}
                    className={`p-10 border-2 rounded-[2.5rem] text-left transition-all group flex flex-col gap-4 h-full ${isSelected ? 'bg-indigo-600 border-indigo-500 shadow-2xl scale-[1.03]' : 'bg-white/5 border-white/10 hover:border-indigo-400'}`}
                  >
                    <div className="flex items-center justify-between">
                       <span className={`text-[12px] font-black uppercase tracking-widest ${isSelected ? 'text-indigo-200' : 'text-slate-500'}`}>Node 0{i+1}</span>
                       {isSelected && <div className="w-3 h-3 rounded-full bg-white animate-pulse"></div>}
                    </div>
                    <h4 className={`text-2xl font-black ${isSelected ? 'text-white' : 'text-slate-200'}`}>{s}</h4>
                    <p className={`text-sm font-medium leading-relaxed ${isSelected ? 'text-indigo-100' : 'text-slate-500'}`}>
                      {STAGE_DESCRIPTIONS[s]}
                    </p>
                  </button>
                );
              })}
           </div>

           <div className="pt-6">
              <button onClick={handleInitiate} className="px-24 py-10 bg-indigo-600 text-white rounded-full font-black text-2xl uppercase tracking-widest shadow-2xl hover:scale-105 active:scale-95 transition-all">Start Full Simulation @ {startStageChoice}</button>
              <p className="text-[12px] font-black uppercase tracking-[0.3em] text-slate-600 mt-8">Neural Presence Engine: V3.1 Primed for Full-Scale Engagement</p>
           </div>
        </div>
      ) : report ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center space-y-8 animate-in fade-in px-12">
           <h3 className="text-5xl font-black">Simulation Conclusion</h3>
           <p className="text-slate-400 text-xl">Total Deal Readiness: {report.deal_readiness_score}/10</p>
           <button onClick={() => setReport(null)} className="px-12 py-5 bg-indigo-600 rounded-full font-black uppercase tracking-widest text-lg">Close Audit</button>
        </div>
      ) : (
        <div className="flex-1 flex flex-col w-full py-16 px-16 gap-12 justify-center">
             {/* Stage Progress Tracker */}
             <div className="grid grid-cols-6 gap-8 w-full">
                {STAGES.map((s, i) => {
                  const isActive = currentStage === s;
                  const isDone = STAGES.indexOf(currentStage) > i;
                  const rating = stageRatings[s];
                  
                  return (
                    <div key={s} className="flex flex-col items-center gap-2 group transition-all">
                       <div className="h-6 flex items-center justify-center">
                          {rating !== undefined && <StarRating rating={rating} />}
                       </div>
                       <div className={`h-3 w-full rounded-full transition-all duration-700 ${isDone ? 'bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.4)]' : isActive ? 'bg-indigo-500 shadow-[0_0_25px_rgba(79,70,229,0.7)]' : 'bg-slate-800'}`}></div>
                       <span className={`text-[12px] font-black uppercase tracking-[0.2em] ${isActive ? 'text-indigo-400' : isDone ? 'text-emerald-400' : 'text-slate-600'}`}>{s}</span>
                    </div>
                  );
                })}
             </div>

             {/* Focus Header */}
             <div className="text-center space-y-4">
                <span className="px-8 py-3 bg-indigo-600/20 text-indigo-400 text-sm font-black uppercase tracking-[0.4em] rounded-full border border-indigo-500/20">
                   Strategic Stage: {currentStage.toUpperCase()}
                </span>
                <h3 className="text-6xl font-black tracking-tight leading-tight">
                   Presence: {meetingContext.clientNames || 'Executive Client'}
                </h3>
             </div>

             {/* Main Visual Core - Replaced Brain with Client Avatar */}
             <div className="relative flex flex-col items-center">
                <div className="relative z-20">
                   {isGeneratingAvatar ? (
                     <div className="w-80 h-80 rounded-full border-4 border-indigo-500/30 flex flex-col items-center justify-center bg-slate-900 animate-pulse">
                        <ICONS.Search className="w-16 h-16 text-indigo-500 mb-4" />
                        <span className="text-[10px] font-black uppercase tracking-[0.3em] text-indigo-300">Searching LinkedIn/Google...</span>
                     </div>
                   ) : avatarUrl ? (
                     <div className="relative">
                        <img 
                          src={avatarUrl} 
                          alt="Client Avatar" 
                          className={`w-80 h-80 rounded-full object-cover border-4 transition-all duration-700 ${isAISpeaking ? 'border-indigo-500 shadow-[0_0_80px_rgba(79,70,229,0.7)] scale-110' : 'border-slate-800'}`} 
                        />
                        {isAISpeaking && (
                           <div className="absolute inset-0 rounded-full border-4 border-indigo-400 animate-ping opacity-30"></div>
                        )}
                        <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 px-6 py-2 bg-indigo-600 text-white rounded-full text-[10px] font-black uppercase tracking-widest border border-indigo-400 shadow-xl whitespace-nowrap">
                           {meetingContext.clientNames || 'Executive'}
                        </div>
                     </div>
                   ) : (
                     <div className="w-80 h-80 rounded-full bg-slate-900 border-4 border-slate-800 flex items-center justify-center text-slate-700">
                        <ICONS.Document className="w-24 h-24" />
                     </div>
                   )}
                </div>
                
                {meetingContext.clonedVoiceBase64 && (
                   <div className="mt-12 flex items-center gap-4 px-8 py-4 bg-emerald-500/10 border border-emerald-500/20 rounded-full shadow-lg">
                      <div className="w-3 h-3 bg-emerald-400 rounded-full animate-ping"></div>
                      <span className="text-[12px] font-black text-emerald-400 uppercase tracking-widest">
                        Neural Vocal Mimicry Active
                      </span>
                   </div>
                )}
             </div>

             {/* Vertical Stack: Cinematic Narrative & Hint Display */}
             <div className="flex flex-col gap-6 w-full items-center">
                <div className="w-full bg-white/5 backdrop-blur-3xl border border-white/10 p-16 rounded-[4rem] space-y-8 shadow-2xl animate-in fade-in zoom-in-95 duration-700">
                   <div className="flex items-center justify-between mb-4">
                      <h5 className="text-[12px] font-black uppercase tracking-[0.4em] text-indigo-400">{meetingContext.clientNames || 'Executive'} Inquiry Node</h5>
                      <div className="flex items-center gap-3">
                         <div className={`w-3 h-3 rounded-full ${isAISpeaking ? 'bg-indigo-500 animate-pulse' : 'bg-slate-700'}`}></div>
                         <span className="text-[12px] font-black uppercase tracking-widest text-slate-500">{isAISpeaking ? 'Transmitting' : 'Awaiting Logic'}</span>
                      </div>
                   </div>
                   <p className="text-5xl font-bold italic leading-[1.4] text-white tracking-tight text-center">
                      {messages[messages.length - 1]?.content || "Initializing behavioral synchronization..."}
                   </p>
                </div>

                {/* Tactical Clue Card - Stacked Directly Beneath */}
                {currentHint && (
                  <div className="w-full max-w-4xl bg-indigo-900/40 border border-indigo-500/30 p-10 rounded-[3.5rem] shadow-2xl flex flex-col justify-center items-center text-center transition-all duration-1000 animate-in slide-in-from-top-4">
                    <div className="flex items-center gap-6">
                      <div className="w-12 h-12 rounded-full bg-indigo-600 flex items-center justify-center shadow-xl shadow-indigo-900/50">
                          <ICONS.Sparkles className="w-6 h-6 text-indigo-200" />
                      </div>
                      <div className="text-left flex-1">
                        <h5 className="text-[11px] font-black uppercase tracking-[0.3em] text-indigo-300 mb-1">Strategic Clue</h5>
                        <p className="text-xl font-bold text-white italic leading-snug">
                            {currentHint}
                        </p>
                      </div>
                      <div className="hidden md:block pl-6 border-l border-indigo-500/20">
                          <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Protocol Tip</p>
                      </div>
                    </div>
                  </div>
                )}
             </div>

             {/* Coaching Feedback Overlay */}
             {coachingFeedback && (
               <div className="p-12 bg-rose-950/40 border-2 border-rose-500/30 rounded-[4rem] space-y-10 animate-in slide-in-from-top-4 duration-500 w-full shadow-[0_40px_100px_-20px_rgba(244,63,94,0.3)]">
                  <div className="flex items-center justify-between">
                     <div className="flex items-center gap-6">
                        <span className="px-6 py-2 bg-rose-600 text-white text-[12px] font-black uppercase rounded-full shadow-lg">Strategic Deficit Detected</span>
                        <h4 className="text-3xl font-black text-rose-100">Neural Performance Correction Protocol</h4>
                     </div>
                     <div className="flex items-center gap-4">
                        <button 
                          onClick={handleProceedDespiteFailure}
                          className="px-6 py-3 bg-white/10 hover:bg-white/20 border border-white/20 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all shadow-xl"
                        >
                          Proceed Despite Deficit
                        </button>
                        <button 
                          onClick={handleTryAgain}
                          className="px-8 py-3 bg-white text-slate-900 rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-rose-100 transition-all active:scale-95 shadow-xl"
                        >
                          Try Again
                        </button>
                     </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                     <div className="space-y-4 p-8 bg-black/20 rounded-[2.5rem] border border-white/5">
                        <h5 className="text-[11px] font-black uppercase text-rose-400 tracking-widest flex items-center gap-2">
                           <div className="w-1.5 h-1.5 rounded-full bg-rose-500"></div> Deficit Rationale
                        </h5>
                        <p className="text-xl font-medium text-rose-50/80 italic leading-relaxed">{coachingFeedback.failReason}</p>
                     </div>
                     <div className="space-y-4 p-8 bg-black/20 rounded-[2.5rem] border border-white/5">
                        <h5 className="text-[11px] font-black uppercase text-indigo-400 tracking-widest flex items-center gap-2">
                           <div className="w-1.5 h-1.5 rounded-full bg-indigo-500"></div> Master Protocol Required
                        </h5>
                        <p className="text-xl font-medium text-indigo-50/80 italic leading-relaxed">{coachingFeedback.styleGuide}</p>
                     </div>
                  </div>

                  {coachingFeedback.idealResponse && (
                    <div className="p-10 bg-indigo-600/10 border-2 border-indigo-500/20 rounded-[3rem] space-y-6">
                       <div className="flex items-center gap-3">
                          <ICONS.Sparkles className="w-6 h-6 text-indigo-400" />
                          <h5 className="text-[12px] font-black uppercase text-indigo-300 tracking-[0.3em]">Correct Answer (Strategic Response for Client)</h5>
                       </div>
                       <p className="text-2xl font-bold text-white leading-relaxed italic">
                          “{coachingFeedback.idealResponse}”
                       </p>
                       <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest">Grounded in verified document context and psychological buyer alignment. Replicate this logic to advance.</p>
                    </div>
                  )}
               </div>
             )}

             {/* User Interaction Layer */}
             <div className="space-y-10 w-full">
                <div className="relative group">
                   <textarea 
                     value={currentCaption} 
                     onChange={(e) => setCurrentCaption(e.target.value)} 
                     className="w-full bg-slate-900 border-2 border-slate-800 rounded-[3.5rem] px-16 py-12 text-3xl outline-none focus:border-indigo-500 transition-all font-medium italic text-slate-200 shadow-inner h-60 resize-none placeholder:text-slate-700 leading-relaxed" 
                     placeholder={`Deploy strategic response for the ${currentStage} stage...`}
                   />
                   <button onClick={() => startListening()} className={`absolute right-12 top-1/2 -translate-y-1/2 p-8 rounded-[2rem] transition-all border ${isUserListening ? 'bg-emerald-600 border-emerald-500 text-white animate-pulse shadow-[0_0_30px_rgba(16,185,129,0.5)]' : 'bg-white/5 border-white/10 text-indigo-400 hover:bg-white/10'}`}><ICONS.Ear className="w-10 h-10" /></button>
                </div>
                <div className="flex items-center gap-8">
                   <div className="flex-1 flex items-center gap-6">
                      <button onClick={handleCommit} disabled={isProcessing || !currentCaption.trim()} className="flex-1 py-10 bg-indigo-600 text-white rounded-[3rem] font-black text-2xl uppercase tracking-[0.2em] shadow-2xl hover:bg-indigo-700 disabled:opacity-50 transition-all active:scale-95">Commit Answer</button>
                      
                      {currentStage !== 'Closing' && (
                        <button 
                          onClick={handleSkip} 
                          disabled={isProcessing} 
                          className="px-16 py-10 bg-slate-800 text-slate-300 border border-slate-700 rounded-[3rem] font-black text-sm uppercase tracking-widest hover:bg-slate-700 transition-all active:scale-95 disabled:opacity-50"
                        >
                          Skip Stage
                        </button>
                      )}
                   </div>
                   
                   <button onClick={handleEndSession} disabled={isProcessing} className="px-16 py-10 bg-rose-600 text-white rounded-[3rem] font-black text-sm uppercase tracking-widest shadow-2xl hover:bg-rose-700 transition-all active:scale-95">Terminate & Audit</button>
                </div>
             </div>
        </div>
      )}

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
