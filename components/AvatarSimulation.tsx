
import React, { useState, useRef, useEffect, FC } from 'react';
import { ICONS } from '../constants';
import { 
  streamAvatarSimulation, 
  generatePitchAudio, 
  decodeAudioData,
  evaluateAvatarSession 
} from '../services/geminiService';
import { GPTMessage, MeetingContext, ComprehensiveAvatarReport } from '../types';

interface AvatarSimulationProps {
  meetingContext: MeetingContext;
}

export const AvatarSimulation: FC<AvatarSimulationProps> = ({ meetingContext }) => {
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
  const [lastSuggestion, setLastSuggestion] = useState("");

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
    setLastSuggestion("");
    try {
      const stream = streamAvatarSimulation("START SIMULATION", [], meetingContext);
      let firstQuestion = "";
      for await (const chunk of stream) firstQuestion += chunk;
      
      const assistantMsg: GPTMessage = { id: Date.now().toString(), role: 'assistant', content: firstQuestion, mode: 'standard' };
      setMessages([assistantMsg]);
      playAIQuestion(firstQuestion);
    } catch (e) { console.error(e); } finally { setIsProcessing(false); }
  };

  const handleNextNode = async () => {
    if (isProcessing || !currentCaption.trim()) return;
    stopListening();
    setIsProcessing(true);
    const userMsg: GPTMessage = { id: Date.now().toString(), role: 'user', content: currentCaption, mode: 'standard' };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    try {
      const stream = streamAvatarSimulation(currentCaption, messages, meetingContext);
      let nextContent = "";
      for await (const chunk of stream) nextContent += chunk;
      
      let displayQuestion = nextContent;
      const suggestionMatch = nextContent.match(/\[SUGGESTION: (.*?)\]/);
      if (suggestionMatch) {
        setLastSuggestion(suggestionMatch[1]);
        displayQuestion = nextContent.replace(/\[SUGGESTION: .*?\]/, "").trim();
      }

      const assistantMsg: GPTMessage = { id: (Date.now() + 1).toString(), role: 'assistant', content: displayQuestion, mode: 'standard' };
      setMessages([...updatedMessages, assistantMsg]);
      setCurrentCaption("");
      playAIQuestion(displayQuestion);
    } catch (e) { console.error(e); } finally { setIsProcessing(false); }
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

  const AIAnimatedBotCIO = () => (
    <svg viewBox="0 0 200 240" className={`w-64 h-64 md:w-72 md:h-72 transition-all duration-700 ${isAISpeaking ? 'drop-shadow-[0_0_30px_rgba(79,70,229,0.3)]' : 'drop-shadow-xl'}`}>
      <defs>
        <linearGradient id="faceGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="100%" stopColor="#f1f5f9" />
        </linearGradient>
        <linearGradient id="suitGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#1e293b" />
          <stop offset="100%" stopColor="#0f172a" />
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
        @keyframes breathe { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-2px); } }
        .animate-breathe { animation: breathe 4s ease-in-out infinite; }
        @keyframes blink { 0%, 92%, 100% { transform: scaleY(1); } 96% { transform: scaleY(0.05); } }
        .animate-blink { transform-origin: center 82px; animation: blink 5s infinite; }
        @keyframes lip-morph { 0%, 100% { d: path("M-12 0 Q 0 12, 12 0 Q 0 -2, -12 0"); } 25% { d: path("M-8 0 Q 0 16, 8 0 Q 0 -4, -8 0"); } 50% { d: path("M-14 0 Q 0 8, 14 0 Q 0 -1, -14 0"); } }
        .animate-lip-morph { animation: lip-morph 0.15s linear infinite; }
      `}</style>
    </svg>
  );

  return (
    <div className="bg-slate-900 shadow-2xl overflow-hidden relative min-h-[calc(100vh-64px)] flex flex-col text-white animate-in zoom-in-95 duration-500">
      {!sessionActive ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center space-y-8 max-w-4xl mx-auto px-6">
           <div className="w-64 h-64 bg-slate-800 rounded-3xl border border-white/5 flex items-center justify-center group shadow-2xl transition-all duration-700 overflow-hidden">
              <AIAnimatedBotCIO />
           </div>
           <div className="space-y-4">
              <h2 className="text-5xl font-black tracking-tight">Presence: {meetingContext.clientNames || 'Executive'}</h2>
              <p className="text-slate-400 text-lg font-medium leading-relaxed">Behavioral neural link primed.</p>
           </div>
           <button onClick={handleInitiate} className="px-12 py-5 bg-indigo-600 text-white rounded-full font-black text-xl uppercase tracking-widest shadow-xl hover:scale-105 active:scale-95 transition-all">Activate</button>
        </div>
      ) : (
        <div className="flex-1 flex flex-col max-w-5xl mx-auto w-full py-10 px-8 gap-8 justify-center">
             <div className="text-center space-y-2">
                <span className="px-4 py-1.5 bg-indigo-600/20 text-indigo-400 text-[10px] font-black uppercase tracking-widest rounded-full border border-indigo-500/20">
                   Identity: {meetingContext.clientNames || 'Executive Client'}
                </span>
                <h3 className="text-3xl font-black tracking-tight">
                   {isAISpeaking ? 'Client is Speaking' : 'Listening...'}
                </h3>
             </div>

             <div className="flex flex-col items-center">
                <AIAnimatedBotCIO />
             </div>

             <div className="bg-white/5 backdrop-blur-xl border border-white/10 p-8 rounded-3xl space-y-4 shadow-xl">
                <p className="text-2xl font-bold italic leading-relaxed text-white text-center">
                   {messages[messages.length - 1]?.content || "Synchronizing..."}
                </p>
             </div>

             <div className="space-y-6">
                <div className="relative group">
                   <textarea 
                     value={currentCaption} 
                     onChange={(e) => setCurrentCaption(e.target.value)} 
                     className="w-full bg-slate-800/50 border-2 border-slate-700 rounded-2xl px-8 py-6 text-xl outline-none focus:border-indigo-500 transition-all font-medium italic text-slate-100 shadow-inner h-36 resize-none" 
                     placeholder="Respond..." 
                   />
                   <button 
                     onClick={() => startListening()} 
                     className={`absolute right-6 top-1/2 -translate-y-1/2 p-4 rounded-2xl transition-all ${isUserListening ? 'bg-emerald-600 animate-pulse' : 'bg-white/5 text-indigo-400'}`}
                   >
                     <ICONS.Ear className="w-6 h-6" />
                   </button>
                </div>
                
                {lastSuggestion && (
                  <div className="p-4 bg-indigo-600/10 border border-indigo-500/20 rounded-xl text-center">
                     <p className="text-[11px] font-bold text-indigo-300 italic">"Coach: {lastSuggestion}"</p>
                  </div>
                )}

                <div className="flex items-center gap-4">
                   <button onClick={handleNextNode} disabled={isProcessing || !currentCaption.trim()} className="flex-1 py-5 bg-indigo-600 text-white rounded-2xl font-black text-lg uppercase tracking-widest shadow-lg hover:bg-indigo-700 transition-all active:scale-95">Commit</button>
                   <button onClick={handleEndSession} className="px-10 py-5 bg-slate-800 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg">Audit</button>
                </div>
             </div>
        </div>
      )}
    </div>
  );
};
