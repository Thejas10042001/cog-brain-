
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
  const [isUserListening, setIsUserListening] = useState(false);
  const [sessionActive, setSessionActive] = useState(false);
  const [report, setReport] = useState<ComprehensiveAvatarReport | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [status, setStatus] = useState("");

  const audioContextRef = useRef<AudioContext | null>(null);
  const recognitionRef = useRef<any>(null);
  const activeAudioSource = useRef<AudioBufferSourceNode | null>(null);

  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';
      recognition.onresult = (event: any) => {
        let transcript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript;
        }
        setCurrentCaption(transcript);
        setIsUserListening(true);
      };
      recognition.onend = () => setIsUserListening(false);
      recognitionRef.current = recognition;
    }
  }, []);

  const playAIQuestion = async (text: string) => {
    setIsAISpeaking(true);
    try {
      if (!audioContextRef.current) audioContextRef.current = new AudioContext({ sampleRate: 24000 });
      const bytes = await generatePitchAudio(text, 'Charon');
      if (bytes) {
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
    setStatus("");
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
      let nextQuestion = "";
      for await (const chunk of stream) nextQuestion += chunk;
      const assistantMsg: GPTMessage = { id: (Date.now() + 1).toString(), role: 'assistant', content: nextQuestion, mode: 'standard' };
      setMessages([...updatedMessages, assistantMsg]);
      setCurrentCaption("");
      playAIQuestion(nextQuestion);
    } catch (e) { console.error(e); } finally { setIsProcessing(false); }
  };

  const handleEndSession = async () => {
    stopListening();
    setIsProcessing(true);
    setStatus("Analyzing Conversation Architecture...");
    let finalHistory = [...messages];
    if (currentCaption.trim()) {
      finalHistory.push({ id: Date.now().toString(), role: 'user', content: currentCaption, mode: 'standard' });
    }
    try {
      const reportJson = await evaluateAvatarSession(finalHistory, meetingContext);
      setReport(reportJson);
    } catch (e) { console.error(e); } finally { setIsProcessing(false); setStatus(""); }
  };

  const RealHumanCIO = () => (
    <div className="relative w-full h-full group overflow-hidden rounded-[2rem]">
      {/* High-End Portrait */}
      <img 
        src="https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&q=80&w=1000" 
        className={`w-full h-full object-cover transition-all duration-3000 ${isAISpeaking ? 'scale-110 brightness-110' : 'scale-100 brightness-90'} animate-gentle-breathe`}
        alt="Enterprise CIO"
      />
      
      {/* Neural Overlays */}
      <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent opacity-60"></div>
      
      {/* Scanning Line */}
      {isUserListening && (
        <div className="absolute inset-0 z-10 pointer-events-none">
          <div className="w-full h-1 bg-indigo-500/50 shadow-[0_0_15px_rgba(79,70,229,0.8)] animate-scan-line"></div>
        </div>
      )}

      {/* Internal Auditor Lens (Glowing eye effect) */}
      <div className="absolute top-[38%] left-[46.5%] w-1.5 h-1.5 bg-rose-500 rounded-full blur-[2px] opacity-0 animate-neural-eye-pulse shadow-[0_0_8px_rgba(225,29,72,1)] z-20"></div>

      {/* Cybernetic HUD Frame */}
      <div className="absolute inset-0 border border-white/10 m-4 rounded-[1.5rem] pointer-events-none">
        <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-indigo-500/40 rounded-tl-xl"></div>
        <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-indigo-500/40 rounded-br-xl"></div>
      </div>

      <style>{`
        @keyframes scan-line {
          0% { top: 10%; opacity: 0; }
          50% { opacity: 1; }
          100% { top: 90%; opacity: 0; }
        }
        .animate-scan-line {
          animation: scan-line 4s linear infinite;
        }
        @keyframes neural-eye-pulse {
          0%, 100% { opacity: 0; transform: scale(1); }
          50% { opacity: 0.8; transform: scale(1.5); }
        }
        .animate-neural-eye-pulse {
          animation: neural-eye-pulse 3s ease-in-out infinite;
        }
        @keyframes gentle-breathe {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.02); }
        }
        .animate-gentle-breathe {
          animation: gentle-breathe 8s ease-in-out infinite;
        }
      `}</style>
    </div>
  );

  if (report) {
    return (
      <div className="space-y-12 animate-in fade-in slide-in-from-bottom-8 duration-700 pb-24">
        <div className="bg-slate-900 rounded-[4rem] p-16 text-white shadow-2xl relative overflow-hidden flex flex-col md:flex-row items-center justify-between gap-12">
          <div className="absolute top-0 right-0 p-16 opacity-5"><ICONS.Trophy className="w-96 h-96" /></div>
          <div className="relative z-10 space-y-8 flex-1 text-left">
            <div>
              <h2 className="text-4xl font-black tracking-tight">Cognitive Performance Synthesis</h2>
              <div className="flex gap-2 mt-4">
                 <span className="px-3 py-1 bg-white/10 rounded-full text-[9px] font-black uppercase tracking-widest border border-white/5">Likelihood: {report.next_step_likelihood}</span>
                 <span className="px-3 py-1 bg-emerald-500/20 text-emerald-400 rounded-full text-[9px] font-black uppercase tracking-widest border border-emerald-500/10">Readiness: {report.deal_readiness_score}/10</span>
              </div>
              <p className="text-indigo-200/70 font-medium text-lg max-w-2xl mt-6 italic leading-relaxed">"{report.conversation_summary}"</p>
            </div>
            <div className="flex gap-4">
              <button onClick={() => { setReport(null); handleInitiate(); }} className="px-8 py-3.5 bg-indigo-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 transition-all">Reset Simulation</button>
            </div>
          </div>
          <div className="relative z-10 w-64 h-64 bg-indigo-600 rounded-full flex flex-col items-center justify-center border-[12px] border-white/10 shadow-[0_0_100px_rgba(79,70,229,0.5)]">
            <span className="text-[12px] font-black uppercase tracking-widest text-indigo-200 mb-2">Readiness Score</span>
            <span className="text-7xl font-black">{report.deal_readiness_score}</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-950 border border-slate-800 rounded-[4rem] p-12 shadow-2xl overflow-hidden relative min-h-[850px] flex flex-col text-white animate-in zoom-in-95 duration-500">
      {!sessionActive ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center space-y-12">
           <div className="w-80 h-80 bg-slate-900 rounded-[3rem] border border-white/5 group shadow-2xl overflow-hidden">
              <img src="https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&q=80&w=1000" className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-700" alt="Executive Portrait" />
           </div>
           <div className="max-w-2xl space-y-6">
              <h2 className="text-5xl font-black tracking-tight">Initiate Dual-Mode Intelligence</h2>
              <p className="text-slate-400 text-lg font-medium leading-relaxed">Connect with a real-human persona in 'Enterprise CIO' mode. Internal neural audits active.</p>
           </div>
           <button onClick={handleInitiate} className="px-16 py-7 bg-indigo-600 text-white rounded-full font-black text-2xl uppercase tracking-widest shadow-2xl hover:scale-105 active:scale-95 transition-all">Activate Simulation</button>
        </div>
      ) : (
        <div className="flex-1 flex flex-col gap-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 flex-1">
             <div className="lg:col-span-8 relative">
                <div className="aspect-video bg-slate-900 rounded-[3.5rem] border-8 border-slate-800 shadow-[0_40px_80px_-15px_rgba(0,0,0,0.8)] overflow-hidden flex items-center justify-center group relative">
                   <RealHumanCIO />
                   {(isAISpeaking || isUserListening) && (
                     <div className="absolute bottom-16 left-0 right-0 h-16 flex items-end justify-center gap-1 z-20">
                        {[...Array(40)].map((_, i) => (
                           <div key={i} className={`w-1.5 rounded-full transition-all duration-300 ${isAISpeaking ? 'bg-indigo-500' : 'bg-emerald-500'}`} style={{ height: isAISpeaking ? `${20 + Math.random() * 80}%` : `${10 + Math.random() * 30}%`, opacity: isAISpeaking ? 1 : 0.4 }}></div>
                        ))}
                     </div>
                   )}
                   <div className="absolute top-10 left-10 z-20 flex items-center gap-3 px-5 py-2 bg-black/40 backdrop-blur-md rounded-full border border-white/10">
                      <div className={`w-2 h-2 rounded-full ${isAISpeaking ? 'bg-indigo-500 animate-pulse' : isUserListening ? 'bg-emerald-500' : 'bg-slate-400'}`}></div>
                      <span className="text-[10px] font-black uppercase tracking-widest">{isAISpeaking ? 'CIO Speaking' : isUserListening ? 'CIO Listening' : 'Presence Online'}</span>
                   </div>
                </div>
             </div>
             <div className="lg:col-span-4 flex flex-col gap-6">
                <div className="p-10 bg-indigo-600/10 border border-indigo-500/20 rounded-[3rem] space-y-4 min-h-[150px]">
                   <h5 className="text-[10px] font-black uppercase tracking-widest text-indigo-400">Buyer Query Hub</h5>
                   <p className="text-xl font-bold italic leading-relaxed text-indigo-50">{messages[messages.length - 1]?.content || "Syncing behaviors..."}</p>
                </div>
                <div className={`flex-1 border border-white/5 rounded-[3rem] p-10 flex flex-col items-center justify-center text-center space-y-6 transition-all duration-500 ${isUserListening ? 'bg-emerald-600/10 border-emerald-500/20' : 'bg-slate-900'}`}>
                   <div className={`w-20 h-20 rounded-full flex items-center justify-center transition-all ${isUserListening ? 'bg-emerald-600 shadow-[0_0_40px_rgba(16,185,129,0.4)] scale-110' : 'bg-slate-800'}`}><ICONS.Speaker className={`w-8 h-8 ${isUserListening ? 'text-white' : 'text-slate-500'}`} /></div>
                   <p className={`text-xs font-black uppercase tracking-[0.3em] ${isUserListening ? 'text-emerald-400 animate-pulse' : 'text-slate-500'}`}>{isUserListening ? "Capturing Strategy..." : "Internal Auditor Ready"}</p>
                </div>
             </div>
          </div>
          <div className="space-y-6">
             <div className="relative group">
                <textarea value={currentCaption} onChange={(e) => setCurrentCaption(e.target.value)} className="w-full bg-slate-900/50 border-2 border-slate-800 rounded-[2.5rem] px-10 py-8 text-xl outline-none focus:border-indigo-500 transition-all font-medium italic text-slate-200 shadow-inner h-32 resize-none" placeholder="The Enterprise CIO is waiting..." />
             </div>
             <div className="flex items-center justify-between">
                <div className="flex gap-4">
                   <button onClick={handleNextNode} disabled={isProcessing || !currentCaption.trim()} className="px-12 py-5 bg-indigo-600 text-white rounded-[2rem] font-black text-sm uppercase tracking-widest shadow-2xl hover:bg-indigo-700 disabled:opacity-50 transition-all flex items-center gap-3 active:scale-95">Commit & Next Question</button>
                </div>
                <button onClick={handleEndSession} disabled={isProcessing} className="px-12 py-5 bg-rose-600 text-white rounded-[2rem] font-black text-sm uppercase tracking-widest shadow-2xl hover:bg-rose-700 transition-all disabled:opacity-50 flex items-center justify-center gap-3">End Session & Audit</button>
             </div>
          </div>
        </div>
      )}
    </div>
  );
};
