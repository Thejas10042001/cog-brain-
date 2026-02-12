
import React, { useState, useRef, useEffect, FC } from 'react';
import { ICONS } from '../constants';
import { 
  streamAvatarSimulationV2, 
  generatePitchAudio, 
  decodeAudioData,
  evaluateAvatarSessionV2 
} from '../services/geminiService';
import { GPTMessage, MeetingContext, SimPersonaV2, ComprehensiveAvatarReport } from '../types';

interface AvatarSimulationV2Props {
  meetingContext: MeetingContext;
}

const PERSONA_ASSETS: Record<SimPersonaV2, { img: string; name: string }> = {
  CIO: { img: "https://images.unsplash.com/photo-1519085185753-b629fd242ad5?auto=format&fit=crop&q=80&w=1000", name: "Strategic CIO" },
  CFO: { img: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=1000", name: "Analytical CFO" },
  IT_DIRECTOR: { img: "https://images.unsplash.com/photo-1552058544-f2b08422138a?auto=format&fit=crop&q=80&w=1000", name: "Technical IT Lead" }
};

export const AvatarSimulationV2: FC<AvatarSimulationV2Props> = ({ meetingContext }) => {
  const [persona, setPersona] = useState<SimPersonaV2 | null>(null);
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

  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';
      recognition.onresult = (event: any) => {
        let transcript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) transcript += event.results[i][0].transcript;
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
      const voice = persona === 'CFO' ? 'Charon' : persona === 'IT_DIRECTOR' ? 'Fenrir' : 'Kore';
      const bytes = await generatePitchAudio(text, voice);
      if (bytes) {
        const buffer = await decodeAudioData(bytes, audioContextRef.current, 24000, 1);
        const source = audioContextRef.current.createBufferSource();
        source.buffer = buffer;
        source.connect(audioContextRef.current.destination);
        source.onended = () => { setIsAISpeaking(false); startListening(); };
        source.start();
      }
    } catch (e) { setIsAISpeaking(false); }
  };

  const startListening = () => {
    if (recognitionRef.current && !isAISpeaking) {
      try { recognitionRef.current.start(); setIsUserListening(true); } catch (e) {}
    }
  };

  const stopListening = () => {
    if (recognitionRef.current) { recognitionRef.current.stop(); setIsUserListening(false); }
  };

  const handleInitiate = async (selected: SimPersonaV2) => {
    setPersona(selected);
    setSessionActive(true);
    setIsProcessing(true);
    setMessages([]);
    setCurrentCaption("");
    try {
      const stream = streamAvatarSimulationV2(`PERSONA: ${selected}`, [], meetingContext);
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
      const stream = streamAvatarSimulationV2(currentCaption, messages, meetingContext);
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
    setStatus("Generating Strategic Audit...");
    let finalHistory = [...messages];
    if (currentCaption.trim()) {
      finalHistory.push({ id: Date.now().toString(), role: 'user', content: currentCaption, mode: 'standard' });
    }
    try {
      const reportJson = await evaluateAvatarSessionV2(finalHistory, meetingContext);
      setReport(reportJson);
    } catch (e) { console.error(e); } finally { setIsProcessing(false); setStatus(""); }
  };

  const PersonaDisplay = ({ type }: { type: SimPersonaV2 }) => (
    <div className="relative w-full h-full overflow-hidden rounded-[3rem]">
      <img 
        src={PERSONA_ASSETS[type].img} 
        className={`w-full h-full object-cover transition-all duration-1000 ${isAISpeaking ? 'scale-110 saturate-150' : 'scale-100 saturate-100'} animate-gentle-breathe`} 
        alt={type} 
      />
      <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent opacity-80"></div>
      
      {/* HUD Layer */}
      <div className="absolute inset-0 z-20 pointer-events-none">
        {/* Dynamic Scan Ring */}
        <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] aspect-square border-[1px] border-indigo-500/20 rounded-full transition-all duration-1000 ${isAISpeaking ? 'scale-75 opacity-100' : 'scale-100 opacity-0'}`}></div>
        
        {/* Active Listening Overlay */}
        {isUserListening && (
          <div className="absolute inset-0 bg-emerald-500/5 animate-pulse flex items-center justify-center">
             <div className="w-full h-0.5 bg-emerald-400/30 animate-scan-v2 shadow-[0_0_15px_rgba(52,211,153,0.5)]"></div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes scan-v2 {
          0% { transform: translateY(-200px); opacity: 0; }
          50% { opacity: 1; }
          100% { transform: translateY(200px); opacity: 0; }
        }
        @keyframes gentle-breathe {
          0%, 100% { transform: scale(1); filter: brightness(1); }
          50% { transform: scale(1.03); filter: brightness(1.1); }
        }
        .animate-gentle-breathe {
          animation: gentle-breathe 10s ease-in-out infinite;
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
              <h2 className="text-4xl font-black tracking-tight">Strategic Performance Audit</h2>
              <div className="flex gap-3 mt-4">
                 <span className="px-4 py-1.5 bg-indigo-600 rounded-full text-[10px] font-black uppercase tracking-widest">Persona: {report.persona_used}</span>
              </div>
              <p className="text-indigo-200/70 font-medium text-lg max-w-2xl mt-6 italic">"{report.conversation_summary}"</p>
            </div>
            <button onClick={() => { setReport(null); setSessionActive(false); setPersona(null); }} className="px-8 py-4 bg-white/10 text-white border border-white/20 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-white/20 transition-all">Restart Session</button>
          </div>
          <div className="relative z-10 w-64 h-64 bg-indigo-600 rounded-full flex flex-col items-center justify-center border-[12px] border-white/10">
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
           <div className="max-w-2xl space-y-6">
              <h2 className="text-6xl font-black tracking-tight bg-gradient-to-r from-white via-indigo-200 to-slate-400 bg-clip-text text-transparent">Simulation 2.0</h2>
              <p className="text-slate-400 text-xl font-medium leading-relaxed">Connect with distinct animated human personas to stress-test your strategy.</p>
           </div>
           <div className="grid grid-cols-1 md:grid-cols-3 gap-8 w-full max-w-4xl">
              <PersonaCardV2 type="CIO" img={PERSONA_ASSETS.CIO.img} onClick={() => handleInitiate('CIO')} />
              <PersonaCardV2 type="CFO" img={PERSONA_ASSETS.CFO.img} onClick={() => handleInitiate('CFO')} />
              <PersonaCardV2 type="IT_DIRECTOR" img={PERSONA_ASSETS.IT_DIRECTOR.img} onClick={() => handleInitiate('IT_DIRECTOR')} />
           </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col gap-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 flex-1">
             <div className="lg:col-span-8 relative">
                <div className="aspect-video bg-slate-900 rounded-[3.5rem] border-8 border-slate-800 shadow-[0_40px_80px_-15px_rgba(0,0,0,0.8)] overflow-hidden flex items-center justify-center group relative">
                   {persona && <PersonaDisplay type={persona} />}
                   <div className="absolute top-10 left-10 z-20 flex items-center gap-4 px-6 py-3 bg-black/40 backdrop-blur-md rounded-full border border-white/10">
                      <div className={`w-3 h-3 rounded-full ${isAISpeaking ? 'bg-indigo-500 animate-pulse' : isUserListening ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.8)]' : 'bg-slate-400'}`}></div>
                      <span className="text-[12px] font-black uppercase tracking-widest">{persona} Presence Online</span>
                   </div>
                </div>
             </div>
             <div className="lg:col-span-4 flex flex-col gap-6">
                <div className="p-10 bg-indigo-600/10 border border-indigo-500/20 rounded-[3rem] space-y-6 min-h-[200px]">
                   <h5 className="text-[11px] font-black uppercase tracking-widest text-indigo-400">Strategic Inquiry</h5>
                   <p className="text-2xl font-black italic leading-tight text-white">{messages[messages.length - 1]?.content || status || "Syncing Data..."}</p>
                </div>
                <div className={`flex-1 border border-white/5 rounded-[3rem] p-12 flex flex-col items-center justify-center text-center space-y-8 transition-all duration-500 ${isUserListening ? 'bg-emerald-600/10 border-emerald-500/20' : 'bg-slate-900'}`}>
                   <div className={`w-24 h-24 rounded-full flex items-center justify-center transition-all duration-500 ${isUserListening ? 'bg-emerald-600 shadow-[0_0_60px_rgba(16,185,129,0.6)] scale-110' : 'bg-slate-800'}`}><ICONS.Speaker className={`w-10 h-10 ${isUserListening ? 'text-white' : 'text-slate-500'}`} /></div>
                   <p className={`text-sm font-black uppercase tracking-[0.4em] ${isUserListening ? 'text-emerald-400 animate-pulse' : 'text-slate-500'}`}>{isUserListening ? "Capturing Strategy" : "Ready for Input"}</p>
                </div>
             </div>
          </div>
          <div className="space-y-6">
             <textarea value={currentCaption} onChange={(e) => setCurrentCaption(e.target.value)} className="w-full bg-slate-900/60 border-2 border-slate-800 rounded-[3rem] px-12 py-10 text-2xl outline-none focus:border-indigo-500 transition-all font-bold italic text-indigo-50 shadow-inner h-40 resize-none placeholder:text-slate-700" placeholder="Awaiting your justification..." />
             <div className="flex items-center justify-between gap-6">
                <button onClick={handleNextNode} disabled={isProcessing || !currentCaption.trim()} className="flex-1 px-12 py-7 bg-indigo-600 text-white rounded-[2.5rem] font-black text-base uppercase tracking-widest hover:bg-indigo-700 disabled:opacity-50 transition-all active:scale-95">Commit Logic & Next Node</button>
                <button onClick={handleEndSession} disabled={isProcessing} className="px-12 py-7 bg-rose-600 text-white rounded-[2.5rem] font-black text-base uppercase tracking-widest shadow-2xl hover:bg-rose-700 transition-all disabled:opacity-50">End Session & Audit</button>
             </div>
          </div>
        </div>
      )}
    </div>
  );
};

const PersonaCardV2 = ({ type, img, onClick }: { type: string; img: string; onClick: () => void }) => (
  <button onClick={onClick} className="group p-2 bg-slate-900/50 border-2 border-slate-800 rounded-[3rem] hover:border-indigo-500 transition-all text-left flex flex-col h-full shadow-xl active:scale-95 duration-300">
    <div className="aspect-square w-full rounded-[2.5rem] overflow-hidden mb-6 relative">
       <img src={img} className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-700" alt={type} />
       <div className="absolute inset-0 bg-indigo-600/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          <ICONS.Play className="w-12 h-12 text-white shadow-2xl" />
       </div>
    </div>
    <div className="px-6 pb-6">
      <h4 className="text-3xl font-black mb-2 tracking-tight group-hover:text-indigo-400 transition-colors uppercase">{type}</h4>
      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Connect Presence Node</p>
    </div>
  </button>
);
