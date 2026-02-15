
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
  const [startStageChoice, setStartStageChoice] = useState<StagedSimStage>('Ice Breakers');
  const [messages, setMessages] = useState<GPTMessage[]>([]);
  const [currentCaption, setCurrentCaption] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [isAISpeaking, setIsAISpeaking] = useState(false);
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
      recognition.onend = () => setIsUserListening(false);
      recognitionRef.current = recognition;
    }
  }, []);

  const playAIQuestion = async (text: string) => {
    setIsAISpeaking(true);
    try {
      if (!audioContextRef.current) audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
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
    setSessionActive(true);
    setIsProcessing(true);
    setMessages([]);
    setCurrentCaption("");
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
        if (nextIdx < STAGES.length) setCurrentStage(STAGES[nextIdx]);
        const cleaned = response.replace(/\[RESULT: SUCCESS\]/, "").trim();
        const aiMsg: GPTMessage = { id: (Date.now() + 1).toString(), role: 'assistant', content: cleaned, mode: 'standard' };
        setMessages([...updatedHistory, aiMsg]);
        setCurrentCaption("");
        playAIQuestion(cleaned);
      } else if (isFail) {
        const coachMatch = response.match(/\[COACHING: (.*?)\]/);
        const styleMatch = response.match(/\[STYLE_GUIDE: (.*?)\]/);
        const retryMatch = response.match(/\[RETRY_PROMPT: (.*?)\]/);
        setCoachingFeedback({ failReason: coachMatch?.[1], styleGuide: styleMatch?.[1], nextTry: retryMatch?.[1] });
        const retryText = retryMatch?.[1] || "Retry.";
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

  return (
    <div className="bg-slate-950 min-h-[calc(100vh-64px)] flex flex-col text-white animate-in zoom-in-95 duration-500">
      {!sessionActive ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center space-y-8 max-w-5xl mx-auto px-6">
           <div className="p-6 bg-slate-900 rounded-3xl border border-white/5 shadow-2xl">
              <ICONS.Brain className="w-20 h-20 text-indigo-600 animate-pulse" />
           </div>
           <div className="space-y-2">
              <h2 className="text-4xl font-black tracking-tight">Staged Sim Node</h2>
              <p className="text-slate-400 text-lg">6 tactical stages to mastery.</p>
           </div>
           <div className="grid grid-cols-2 md:grid-cols-3 gap-4 w-full max-w-3xl">
              {STAGES.map((s, i) => (
                <button key={s} onClick={() => setStartStageChoice(s)} className={`p-4 border-2 rounded-2xl text-left transition-all ${startStageChoice === s ? 'bg-indigo-600 border-indigo-500' : 'bg-white/5 border-white/10 hover:border-indigo-400'}`}>
                  <span className="text-[10px] font-black uppercase text-slate-500">Node 0{i+1}</span>
                  <h4 className="text-sm font-black">{s}</h4>
                </button>
              ))}
           </div>
           <button onClick={handleInitiate} className="px-12 py-5 bg-indigo-600 rounded-full font-black text-lg uppercase tracking-widest shadow-xl">Start @ {startStageChoice}</button>
        </div>
      ) : (
        <div className="flex-1 flex flex-col max-w-4xl mx-auto w-full py-8 px-6 gap-6 justify-center">
             <div className="grid grid-cols-6 gap-3">
                {STAGES.map((s, i) => {
                  const isActive = currentStage === s;
                  const isDone = STAGES.indexOf(currentStage) > i;
                  return (
                    <div key={s} className="flex flex-col items-center gap-1.5">
                       <div className={`h-1.5 w-full rounded-full transition-all ${isDone ? 'bg-emerald-500' : isActive ? 'bg-indigo-500 shadow-md' : 'bg-slate-800'}`}></div>
                       <span className={`text-[8px] font-black uppercase ${isActive ? 'text-indigo-400' : 'text-slate-600'}`}>{s}</span>
                    </div>
                  );
                })}
             </div>

             <div className="text-center">
                <h3 className="text-3xl font-black tracking-tight">{currentStage.toUpperCase()}</h3>
             </div>

             <div className="flex flex-col items-center">
                <ICONS.Brain className={`w-48 h-48 transition-all duration-700 ${isAISpeaking ? 'text-indigo-500 drop-shadow-lg scale-105' : 'text-slate-800'}`} />
             </div>

             <div className="bg-white/5 border border-white/10 p-6 rounded-2xl shadow-xl">
                <p className="text-xl font-bold italic text-white text-center">
                   {messages[messages.length - 1]?.content || "Priming..."}
                </p>
             </div>

             {coachingFeedback && (
               <div className="p-5 bg-rose-950/30 border border-rose-500/30 rounded-2xl space-y-3 animate-in slide-in-from-top-4">
                  <h4 className="text-sm font-black text-rose-200">Neural Performance Deficit</h4>
                  <p className="text-xs font-medium text-rose-100 italic">{coachingFeedback.failReason}</p>
               </div>
             )}

             <div className="space-y-4">
                <div className="relative group">
                   <textarea value={currentCaption} onChange={(e) => setCurrentCaption(e.target.value)} className="w-full bg-slate-900 border-2 border-slate-800 rounded-2xl px-8 py-5 text-lg outline-none focus:border-indigo-500 italic text-slate-200 h-28 resize-none" placeholder="Strategic response..." />
                   <button onClick={() => startListening()} className={`absolute right-6 top-1/2 -translate-y-1/2 p-4 rounded-2xl ${isUserListening ? 'bg-emerald-600' : 'bg-white/5 text-indigo-400'}`}><ICONS.Ear className="w-6 h-6" /></button>
                </div>
                <div className="flex gap-4">
                   <button onClick={handleCommit} disabled={isProcessing || !currentCaption.trim()} className="flex-1 py-4 bg-indigo-600 rounded-2xl font-black text-lg uppercase shadow-lg active:scale-95">Commit</button>
                   <button onClick={() => setSessionActive(false)} className="px-8 py-4 bg-rose-600 rounded-2xl font-black text-xs uppercase">Exit</button>
                </div>
             </div>
        </div>
      )}
    </div>
  );
};
