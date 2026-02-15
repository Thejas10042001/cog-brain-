
import React, { useState, useRef, useEffect, FC } from 'react';
import { ICONS } from '../constants';
import { 
  streamAvatarStagedSimulation, 
  generatePitchAudio, 
  decodeAudioData,
  evaluateAvatarSession 
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
  const [coachingFeedback, setCoachingFeedback] = useState<{ failReason?: string; styleGuide?: string; nextTry?: string } | null>(null);
  const [report, setReport] = useState<ComprehensiveAvatarReport | null>(null);

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
    setSessionActive(true);
    setIsProcessing(true);
    setMessages([]);
    setCurrentCaption("");
    setCoachingFeedback(null);
    setCurrentStage(startStageChoice);

    const kycDoc = documents.find(d => d.id === meetingContext.kycDocId);
    const kycContent = kycDoc ? kycDoc.content : "No KYC data provided.";

    try {
      const stream = streamAvatarStagedSimulation(`START AT STAGE: ${startStageChoice}`, [], meetingContext, startStageChoice, kycContent);
      let firstMsg = "";
      for await (const chunk of stream) firstMsg += chunk;
      
      const cleaned = firstMsg.replace(/\[RESULT: SUCCESS\]|\[RESULT: FAIL\]/, "").trim();
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

      if (isSuccess) {
        const nextIdx = STAGES.indexOf(currentStage) + 1;
        if (nextIdx < STAGES.length) {
          setCurrentStage(STAGES[nextIdx]);
        }
        const cleaned = response.replace(/\[RESULT: SUCCESS\]/, "").trim();
        const aiMsg: GPTMessage = { id: (Date.now() + 1).toString(), role: 'assistant', content: cleaned, mode: 'standard' };
        setMessages([...updatedHistory, aiMsg]);
        setCurrentCaption("");
        playAIQuestion(cleaned);
      } else if (isFail) {
        const coachMatch = response.match(/\[COACHING: (.*?)\]/);
        const styleMatch = response.match(/\[STYLE_GUIDE: (.*?)\]/);
        const retryMatch = response.match(/\[RETRY_PROMPT: (.*?)\]/);

        setCoachingFeedback({
          failReason: coachMatch?.[1],
          styleGuide: styleMatch?.[1],
          nextTry: retryMatch?.[1]
        });

        const retryText = retryMatch?.[1] || "Please try again with a better approach.";
        const aiMsg: GPTMessage = { id: (Date.now() + 1).toString(), role: 'assistant', content: retryText, mode: 'standard' };
        setMessages([...updatedHistory, aiMsg]);
        setCurrentCaption("");
        playAIQuestion(retryText);
      } else {
        const aiMsg: GPTMessage = { id: (Date.now() + 1).toString(), role: 'assistant', content: response, mode: 'standard' };
        setMessages([...updatedHistory, aiMsg]);
        playAIQuestion(response);
      }
    } catch (e) { console.error(e); } finally { setIsProcessing(false); }
  };

  const handleSkip = async () => {
    const currentIndex = STAGES.indexOf(currentStage);
    if (currentIndex >= STAGES.length - 1) return;

    stopListening();
    setIsProcessing(true);
    setCoachingFeedback(null);
    setCurrentCaption("");

    const nextStage = STAGES[currentIndex + 1];
    setCurrentStage(nextStage);

    const kycDoc = documents.find(d => d.id === meetingContext.kycDocId);
    const kycContent = kycDoc ? kycDoc.content : "No KYC data provided.";

    try {
      const stream = streamAvatarStagedSimulation(`Manual Override: Advance to Stage ${nextStage}`, messages, meetingContext, nextStage, kycContent);
      let response = "";
      for await (const chunk of stream) response += chunk;

      const cleaned = response.replace(/\[RESULT: SUCCESS\]|\[RESULT: FAIL\]/, "").trim();
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

  return (
    <div className="bg-slate-950 shadow-2xl overflow-hidden relative min-h-[calc(100vh-64px)] flex flex-col text-white animate-in zoom-in-95 duration-500">
      {!sessionActive ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center space-y-12 max-w-5xl mx-auto px-12 py-12">
           <div className="p-8 bg-slate-900 rounded-[4rem] border border-white/5 shadow-2xl">
              <ICONS.Brain className="w-32 h-32 text-indigo-600 animate-pulse" />
           </div>
           <div className="space-y-6">
              <h2 className="text-6xl font-black tracking-tight">Staged Simulation Node</h2>
              <p className="text-slate-400 text-2xl font-medium leading-relaxed max-w-3xl mx-auto">
                Advance through 6 tactical stages. Select your starting point below to begin the challenge.
              </p>
           </div>
           
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 w-full">
              {STAGES.map((s, i) => {
                const isSelected = startStageChoice === s;
                return (
                  <button 
                    key={s} 
                    onClick={() => setStartStageChoice(s)}
                    className={`p-6 border-2 rounded-[2rem] text-left transition-all group flex flex-col gap-3 h-full ${isSelected ? 'bg-indigo-600 border-indigo-500 shadow-2xl scale-[1.03]' : 'bg-white/5 border-white/10 hover:border-indigo-400'}`}
                  >
                    <div className="flex items-center justify-between">
                       <span className={`text-[10px] font-black uppercase tracking-widest ${isSelected ? 'text-indigo-200' : 'text-slate-500'}`}>Node 0{i+1}</span>
                       {isSelected && <div className="w-2 h-2 rounded-full bg-white animate-pulse"></div>}
                    </div>
                    <h4 className={`text-xl font-black ${isSelected ? 'text-white' : 'text-slate-200'}`}>{s}</h4>
                    <p className={`text-xs font-medium leading-relaxed ${isSelected ? 'text-indigo-100' : 'text-slate-500'}`}>
                      {STAGE_DESCRIPTIONS[s]}
                    </p>
                  </button>
                );
              })}
           </div>

           <div className="pt-6">
              <button onClick={handleInitiate} className="px-20 py-8 bg-indigo-600 text-white rounded-full font-black text-2xl uppercase tracking-widest shadow-2xl hover:scale-105 active:scale-95 transition-all">Start Simulation @ {startStageChoice}</button>
              <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-600 mt-6">Neural Presence Engine: V3.1 Primed</p>
           </div>
        </div>
      ) : report ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center space-y-8 animate-in fade-in">
           <h3 className="text-4xl font-black">Simulation Conclusion</h3>
           <p className="text-slate-400">Total Deal Readiness: {report.deal_readiness_score}/10</p>
           <button onClick={() => setReport(null)} className="px-10 py-4 bg-indigo-600 rounded-full font-black uppercase tracking-widest">Close Audit</button>
        </div>
      ) : (
        <div className="flex-1 flex flex-col max-w-5xl mx-auto w-full py-16 px-12 gap-12 justify-center">
             {/* Stage Progress Tracker */}
             <div className="grid grid-cols-6 gap-6">
                {STAGES.map((s, i) => {
                  const isActive = currentStage === s;
                  const isDone = STAGES.indexOf(currentStage) > i;
                  return (
                    <div key={s} className="flex flex-col items-center gap-3 group transition-all">
                       <div className={`h-2.5 w-full rounded-full transition-all duration-700 ${isDone ? 'bg-emerald-500' : isActive ? 'bg-indigo-500 shadow-[0_0_20px_rgba(79,70,229,0.6)]' : 'bg-slate-800'}`}></div>
                       <span className={`text-[10px] font-black uppercase tracking-[0.2em] ${isActive ? 'text-indigo-400' : isDone ? 'text-emerald-400' : 'text-slate-600'}`}>{s}</span>
                    </div>
                  );
                })}
             </div>

             {/* Focus Header */}
             <div className="text-center space-y-4">
                <span className="px-6 py-2 bg-indigo-600/20 text-indigo-400 text-xs font-black uppercase tracking-[0.4em] rounded-full border border-indigo-500/20">
                   Stage: {currentStage.toUpperCase()}
                </span>
                <h3 className="text-5xl font-black tracking-tight leading-tight">
                   Presence: {meetingContext.clientNames || 'Executive Client'}
                </h3>
             </div>

             {/* Main Visual Core */}
             <div className="relative flex flex-col items-center">
                <div className="relative z-20">
                   <ICONS.Brain className={`w-64 h-64 transition-all duration-700 ${isAISpeaking ? 'text-indigo-500 drop-shadow-[0_0_40px_rgba(79,70,229,0.5)] scale-110' : 'text-slate-800'}`} />
                </div>
                
                {meetingContext.clonedVoiceBase64 && (
                   <div className="mt-8 flex items-center gap-3 px-5 py-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-full shadow-lg">
                      <div className="w-2 h-2 bg-emerald-400 rounded-full animate-ping"></div>
                      <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">Neural Vocal Mimicry Active</span>
                   </div>
                )}
             </div>

             {/* Cinematic Narrative Display */}
             <div className="bg-white/5 backdrop-blur-3xl border border-white/10 p-12 rounded-[4rem] space-y-6 shadow-2xl animate-in fade-in zoom-in-95 duration-700">
                <div className="flex items-center justify-between mb-2">
                   <h5 className="text-[10px] font-black uppercase tracking-[0.4em] text-indigo-400">{meetingContext.clientNames || 'Executive'} Inquiry</h5>
                   <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${isAISpeaking ? 'bg-indigo-500 animate-pulse' : 'bg-slate-700'}`}></div>
                      <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">{isAISpeaking ? 'Speaking' : 'Waiting'}</span>
                   </div>
                </div>
                <p className="text-4xl font-bold italic leading-[1.4] text-white tracking-tight">
                   {messages[messages.length - 1]?.content || "Initializing behavioral synchronization..."}
                </p>
             </div>

             {/* Coaching Feedback Overlay */}
             {coachingFeedback && (
               <div className="p-10 bg-rose-950/30 border border-rose-500/30 rounded-[3rem] space-y-6 animate-in slide-in-from-top-4 duration-500">
                  <div className="flex items-center gap-4">
                     <span className="px-4 py-1.5 bg-rose-600 text-white text-[10px] font-black uppercase rounded-full">Protocol Blocked</span>
                     <h4 className="text-2xl font-black text-rose-200">Neural Performance Deficit</h4>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                     <div className="space-y-3">
                        <h5 className="text-[10px] font-black uppercase text-rose-400 tracking-widest">Deficit Rationale</h5>
                        <p className="text-lg font-medium text-rose-100 italic leading-relaxed">{coachingFeedback.failReason}</p>
                     </div>
                     <div className="space-y-3">
                        <h5 className="text-[10px] font-black uppercase text-indigo-400 tracking-widest">Master Protocol Required</h5>
                        <p className="text-lg font-medium text-indigo-100 italic leading-relaxed">{coachingFeedback.styleGuide}</p>
                     </div>
                  </div>
               </div>
             )}

             {/* User Interaction Layer */}
             <div className="space-y-8">
                <div className="relative group">
                   <textarea 
                     value={currentCaption} 
                     onChange={(e) => setCurrentCaption(e.target.value)} 
                     className="w-full bg-slate-900 border-2 border-slate-800 rounded-[3rem] px-12 py-10 text-2xl outline-none focus:border-indigo-500 transition-all font-medium italic text-slate-200 shadow-inner h-48 resize-none placeholder:text-slate-800 leading-relaxed" 
                     placeholder={`Provide strategic response for ${meetingContext.clientNames || 'the client'}...`}
                   />
                   <button onClick={() => startListening()} className={`absolute right-10 top-1/2 -translate-y-1/2 p-6 rounded-3xl transition-all border ${isUserListening ? 'bg-emerald-600 border-emerald-500 text-white animate-pulse' : 'bg-white/5 border-white/10 text-indigo-400 hover:bg-white/10'}`}><ICONS.Ear className="w-8 h-8" /></button>
                </div>
                <div className="flex items-center gap-6">
                   <div className="flex-1 flex items-center gap-4">
                      <button onClick={handleCommit} disabled={isProcessing || !currentCaption.trim()} className="flex-1 py-8 bg-indigo-600 text-white rounded-[2.5rem] font-black text-xl uppercase tracking-[0.2em] shadow-2xl hover:bg-indigo-700 disabled:opacity-50 transition-all active:scale-95">Commit Strategy</button>
                      
                      {currentStage !== 'Closing' && (
                        <button 
                          onClick={handleSkip} 
                          disabled={isProcessing} 
                          className="px-12 py-8 bg-slate-800 text-slate-300 border border-slate-700 rounded-[2.5rem] font-black text-sm uppercase tracking-widest hover:bg-slate-700 transition-all active:scale-95 disabled:opacity-50"
                        >
                          Skip Node
                        </button>
                      )}
                   </div>
                   
                   <button onClick={handleEndSession} disabled={isProcessing} className="px-12 py-8 bg-rose-600 text-white rounded-[2.5rem] font-black text-sm uppercase tracking-widest hover:bg-rose-700 transition-all active:scale-95">End Early</button>
                </div>
             </div>
        </div>
      )}
    </div>
  );
};
