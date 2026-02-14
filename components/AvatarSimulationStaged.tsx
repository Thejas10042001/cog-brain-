
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

export const AvatarSimulationStaged: FC<AvatarSimulationStagedProps> = ({ meetingContext, documents }) => {
  const [currentStage, setCurrentStage] = useState<StagedSimStage>('Ice Breakers');
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
      
      const bytes = await generatePitchAudio(text, 'Charon', meetingContext.clonedVoiceBase64);
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
    setCurrentStage('Ice Breakers');

    const kycDoc = documents.find(d => d.id === meetingContext.kycDocId);
    const kycContent = kycDoc ? kycDoc.content : "No KYC data provided.";

    try {
      const stream = streamAvatarStagedSimulation("START", [], meetingContext, 'Ice Breakers', kycContent);
      let firstMsg = "";
      for await (const chunk of stream) firstMsg += chunk;
      
      const cleaned = firstMsg.replace(/\[RESULT: SUCCESS\]/, "").trim();
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
        // Fallback
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
      // Signal manual override to the model to begin the next phase immediately
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
    <div className="bg-slate-950 border border-slate-800 rounded-[4rem] p-12 shadow-2xl overflow-hidden relative min-h-[850px] flex flex-col text-white animate-in zoom-in-95 duration-500">
      {!sessionActive ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center space-y-12">
           <div className="p-8 bg-slate-900 rounded-[4rem] border border-white/5 shadow-2xl">
              <ICONS.Brain className="w-32 h-32 text-indigo-600 animate-pulse" />
           </div>
           <div className="max-w-2xl space-y-6">
              <h2 className="text-5xl font-black tracking-tight">Staged Simulation Node</h2>
              <p className="text-slate-400 text-lg font-medium leading-relaxed">
                Advance through 6 tactical stages. You will only proceed if the {meetingContext.clientNames || 'Client'} validates your response.
              </p>
           </div>
           <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 w-full">
              {STAGES.map((s, i) => (
                <div key={s} className="px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-[9px] font-black uppercase tracking-widest text-slate-500">
                  {i+1}. {s}
                </div>
              ))}
           </div>
           <button onClick={handleInitiate} className="px-16 py-7 bg-indigo-600 text-white rounded-full font-black text-2xl uppercase tracking-widest shadow-2xl hover:scale-105 active:scale-95 transition-all">Start Simulation</button>
        </div>
      ) : report ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center space-y-8 animate-in fade-in">
           <h3 className="text-4xl font-black">Simulation Conclusion</h3>
           <p className="text-slate-400">Total Deal Readiness: {report.deal_readiness_score}/10</p>
           <button onClick={() => setReport(null)} className="px-10 py-4 bg-indigo-600 rounded-full font-black uppercase tracking-widest">Close Audit</button>
        </div>
      ) : (
        <div className="flex-1 flex flex-col gap-10">
          <div className="flex flex-col gap-12 flex-1">
             {/* Stage Progress Tracker */}
             <div className="grid grid-cols-6 gap-4">
                {STAGES.map((s, i) => {
                  const isActive = currentStage === s;
                  const isDone = STAGES.indexOf(currentStage) > i;
                  return (
                    <div key={s} className={`flex flex-col items-center gap-2 group transition-all`}>
                       <div className={`h-2 w-full rounded-full transition-all duration-700 ${isDone ? 'bg-emerald-500' : isActive ? 'bg-indigo-500 shadow-[0_0_15px_rgba(79,70,229,0.5)]' : 'bg-slate-800'}`}></div>
                       <span className={`text-[8px] font-black uppercase tracking-widest ${isActive ? 'text-indigo-400' : isDone ? 'text-emerald-400' : 'text-slate-600'}`}>{s}</span>
                    </div>
                  );
                })}
             </div>

             <div className="relative w-full flex flex-col items-center">
                <div className="w-full aspect-video bg-slate-900 rounded-[3.5rem] border-8 border-slate-800 shadow-[0_40px_80px_-15px_rgba(0,0,0,0.8)] overflow-hidden flex items-center justify-center group relative">
                   <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent opacity-80 z-10"></div>
                   <div className="relative z-20">
                      <ICONS.Brain className={`w-64 h-64 transition-all duration-700 ${isAISpeaking ? 'text-indigo-500 drop-shadow-[0_0_40px_rgba(79,70,229,0.5)] scale-110' : 'text-slate-800'}`} />
                   </div>
                   <div className="absolute top-10 left-10 z-30 flex items-center gap-4 px-6 py-3 bg-black/40 backdrop-blur-md rounded-full border border-white/10">
                      <div className={`w-3 h-3 rounded-full ${isAISpeaking ? 'bg-indigo-500 animate-pulse' : 'bg-slate-600'}`}></div>
                      <span className="text-[12px] font-black uppercase tracking-widest">{meetingContext.clientNames || 'Client'} Online</span>
                      {meetingContext.clonedVoiceBase64 && (
                        <div className="flex items-center gap-2 px-3 py-1 bg-emerald-500/20 border border-emerald-500/30 rounded-full">
                           <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse"></div>
                           <span className="text-[9px] font-black text-emerald-400 uppercase tracking-widest">Cloned Voice Identity</span>
                        </div>
                      )}
                   </div>

                   {/* Audio Controls Overlay */}
                   {isAISpeaking && (
                     <div className="absolute bottom-10 right-10 z-40 flex items-center gap-3 p-2 bg-black/40 backdrop-blur-xl rounded-2xl border border-white/10">
                        <button onClick={handlePauseResume} className="p-3 bg-white/10 hover:bg-white/20 rounded-xl transition-all">
                           {isPaused ? <ICONS.Play className="w-5 h-5 text-emerald-400" /> : <div className="w-5 h-5 flex gap-1 items-center justify-center"><div className="w-1.5 h-4 bg-white rounded-full"></div><div className="w-1.5 h-4 bg-white rounded-full"></div></div>}
                        </button>
                        <button onClick={handleRepeat} className="p-3 bg-white/10 hover:bg-white/20 rounded-xl transition-all">
                           <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                             <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                           </svg>
                        </button>
                     </div>
                   )}
                </div>

                {/* Info Nodes */}
                <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
                   <div className="p-10 bg-indigo-600/10 border border-indigo-500/20 rounded-[3rem] space-y-4">
                      <h5 className="text-[11px] font-black uppercase tracking-widest text-indigo-400">Current Inquiry</h5>
                      <p className="text-xl font-bold italic leading-relaxed text-white">{messages[messages.length - 1]?.content || "Initializing..."}</p>
                   </div>
                   <div className={`border border-white/5 rounded-[3rem] p-10 flex flex-col items-center justify-center text-center space-y-6 transition-all duration-500 ${isUserListening ? 'bg-emerald-600/10 border-emerald-500/20' : 'bg-slate-900'}`}>
                      <div className={`w-16 h-16 rounded-full flex items-center justify-center transition-all ${isUserListening ? 'bg-emerald-600 shadow-[0_0_40px_rgba(16,185,129,0.4)] scale-110' : 'bg-slate-800'}`}><ICONS.Speaker className={`w-6 h-6 ${isUserListening ? 'text-white' : 'text-slate-500'}`} /></div>
                      <p className={`text-xs font-black uppercase tracking-[0.3em] ${isUserListening ? 'text-emerald-400 animate-pulse' : 'text-slate-500'}`}>{isUserListening ? "Listening..." : "Waiting for Answer"}</p>
                   </div>
                </div>
             </div>

             {/* Coaching Feedback (Fail/Success UI) */}
             {coachingFeedback && (
               <div className="p-8 bg-rose-950/40 border border-rose-500/30 rounded-[3rem] space-y-6 animate-in slide-in-from-top-4">
                  <div className="flex items-center gap-3">
                     <span className="px-3 py-1 bg-rose-600 text-white text-[9px] font-black uppercase rounded-full">Stage Blocked</span>
                     <h4 className="text-xl font-black text-rose-200">Neural Performance Deficit</h4>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                     <div className="space-y-3">
                        <h5 className="text-[9px] font-black uppercase text-rose-400">Why it failed</h5>
                        <p className="text-sm font-medium text-rose-100 italic leading-relaxed">{coachingFeedback.failReason}</p>
                     </div>
                     <div className="space-y-3">
                        <h5 className="text-[9px] font-black uppercase text-indigo-400">Required Style</h5>
                        <p className="text-sm font-medium text-indigo-100 italic leading-relaxed">{coachingFeedback.styleGuide}</p>
                     </div>
                  </div>
               </div>
             )}

             {/* Input Area */}
             <div className="space-y-6">
                <div className="relative group">
                   <textarea 
                     value={currentCaption} 
                     onChange={(e) => setCurrentCaption(e.target.value)} 
                     className="w-full bg-slate-900 border-2 border-slate-800 rounded-[3rem] px-10 py-8 text-xl outline-none focus:border-indigo-500 transition-all font-medium italic text-slate-200 shadow-inner h-36 resize-none" 
                     placeholder={`Answer for ${currentStage}...`}
                   />
                   <button onClick={() => startListening()} className={`absolute right-8 top-1/2 -translate-y-1/2 p-4 rounded-2xl transition-all border ${isUserListening ? 'bg-emerald-600 border-emerald-500 text-white animate-pulse' : 'bg-white/5 border-white/10 text-indigo-400 hover:bg-white/10'}`}><ICONS.Speaker className="w-5 h-5" /></button>
                </div>
                <div className="flex items-center justify-between gap-4">
                   <div className="flex items-center gap-4">
                      <button onClick={handleCommit} disabled={isProcessing || !currentCaption.trim()} className="px-16 py-6 bg-indigo-600 text-white rounded-[2.5rem] font-black text-base uppercase tracking-widest shadow-2xl hover:bg-indigo-700 disabled:opacity-50 transition-all active:scale-95">Commit Strategy & Next Stage</button>
                      
                      {currentStage !== 'Closing' && (
                        <button 
                          onClick={handleSkip} 
                          disabled={isProcessing} 
                          className="px-10 py-6 bg-slate-800 text-slate-300 border border-slate-700 rounded-[2.5rem] font-black text-base uppercase tracking-widest hover:bg-slate-700 transition-all active:scale-95 disabled:opacity-50"
                        >
                          Skip & Advance Node
                        </button>
                      )}
                   </div>
                   
                   <button onClick={handleEndSession} disabled={isProcessing} className="px-10 py-6 bg-rose-600 text-white rounded-[2.5rem] font-black text-base uppercase tracking-widest hover:bg-rose-700 transition-all active:scale-95">End Early</button>
                </div>
             </div>
          </div>
        </div>
      )}
    </div>
  );
};
