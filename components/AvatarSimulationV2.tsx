
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

const PERSONA_CONFIG: Record<SimPersonaV2, { color: string; accent: string; label: string }> = {
  CIO: { color: "#4f46e5", accent: "#818cf8", label: "Enterprise CIO" },
  CFO: { color: "#10b981", accent: "#34d399", label: "Strategic CFO" },
  IT_DIRECTOR: { color: "#f43f5e", accent: "#fb7185", label: "IT Director" }
};

export const AvatarSimulationV2: FC<AvatarSimulationV2Props> = ({ meetingContext }) => {
  const [persona, setPersona] = useState<SimPersonaV2 | null>(null);
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
      if (!audioContextRef.current) audioContextRef.current = new AudioContext({ sampleRate: 24000 });
      if (audioContextRef.current.state === 'suspended') await audioContextRef.current.resume();

      const voice = persona === 'CFO' ? 'Charon' : persona === 'IT_DIRECTOR' ? 'Fenrir' : 'Kore';
      const bytes = await generatePitchAudio(text, voice, meetingContext.clonedVoiceBase64);
      if (bytes) {
        lastAudioBytes.current = bytes;
        const buffer = await decodeAudioData(bytes, audioContextRef.current, 24000, 1);
        const source = audioContextRef.current.createBufferSource();
        source.buffer = buffer;
        source.connect(audioContextRef.current.destination);
        source.onended = () => { setIsAISpeaking(false); startListening(); };
        activeAudioSource.current = source;
        source.start();
      }
    } catch (e) { setIsAISpeaking(false); }
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

  const handleInitiate = async (selected: SimPersonaV2) => {
    setPersona(selected);
    setSessionActive(true);
    setIsProcessing(true);
    setMessages([]);
    setCurrentCaption("");
    setReport(null);
    setLastSuggestion("");
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
      let nextContent = "";
      for await (const chunk of stream) nextContent += chunk;
      
      // Parse suggestion if present
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
        if (y + (split.length * (size / 2)) > 275) { doc.addPage(); y = 20; }
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

  const AnimatedBotV2 = ({ type }: { type: SimPersonaV2 }) => {
    const config = PERSONA_CONFIG[type];
    return (
      <svg viewBox="0 0 200 240" className={`w-80 h-80 transition-all duration-700 ${isAISpeaking ? `drop-shadow-[0_0_40px_${config.color}66]` : 'drop-shadow-2xl'}`}>
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
        <g className={`${isUserListening ? 'animate-listen-tilt' : 'animate-breathe'}`}>
          <rect x="90" y="155" width="20" height="20" rx="10" fill="#f1f5f9" />
          <path d="M100 20 C 60 20, 50 60, 50 100 C 50 150, 70 170, 100 170 C 130 170, 150 150, 150 100 C 150 60, 140 20, 100 20" fill={`url(#faceGrad-${type})`} stroke="#1e293b" strokeWidth="0.5" />
          <circle cx="55" cy="100" r="1.5" fill={config.color} opacity={isAISpeaking ? "1" : "0.2"} className={isAISpeaking ? "animate-pulse" : ""} />
          <circle cx="145" cy="100" r="1.5" fill={config.color} opacity={isAISpeaking ? "1" : "0.2"} className={isAISpeaking ? "animate-pulse" : ""} />
          <g className="animate-blink">
            <circle cx="78" cy="85" r="5" fill="#0f172a" />
            <circle cx="122" cy="85" r="5" fill="#0f172a" />
            <circle cx="78" cy="85" r="2" fill={config.accent} opacity={isAISpeaking ? "1" : "0.6"} />
            <circle cx="122" cy="85" r="2" fill={config.accent} opacity={isAISpeaking ? "1" : "0.6"} />
          </g>
          <g transform="translate(100, 135)">
            {isAISpeaking ? (
              <path d="M-14 0 Q 0 14, 14 0 Q 0 -3, -14 0" fill="#0f172a" className="animate-lip-morph-v2" />
            ) : (
              <path d="M-12 0 Q 0 3, 12 0" stroke="#0f172a" strokeWidth="3" fill="none" strokeLinecap="round" className={isUserListening ? "animate-listen-mouth" : ""} />
            )}
          </g>
        </g>
        <style>{`
          @keyframes breathe { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-3px); } }
          .animate-breathe { animation: breathe 5s ease-in-out infinite; }
          @keyframes blink { 0%, 94%, 100% { transform: scaleY(1); } 97% { transform: scaleY(0.1); } }
          .animate-blink { transform-origin: center 85px; animation: blink 6s infinite; }
          @keyframes lip-morph-v2 { 0%, 100% { d: path("M-14 0 Q 0 14, 14 0 Q 0 -3, -14 0"); } 33% { d: path("M-10 0 Q 0 18, 10 0 Q 0 -5, -10 0"); } 66% { d: path("M-16 0 Q 0 8, 16 0 Q 0 -2, -16 0"); } }
          .animate-lip-morph-v2 { animation: lip-morph-v2 0.12s linear infinite; }
          @keyframes listen-tilt { 0%, 100% { transform: rotate(0); } 50% { transform: rotate(2deg); } }
          .animate-listen-tilt { animation: listen-tilt 4s ease-in-out infinite; transform-origin: center bottom; }
          @keyframes listen-mouth { 0%, 100% { transform: scaleX(1); } 50% { transform: scaleX(1.15); } }
          .animate-listen-mouth { animation: listen-mouth 0.6s ease-in-out infinite; transform-origin: center; }
        `}</style>
      </svg>
    );
  };

  return (
    <div className="bg-slate-950 border-y border-slate-800 p-12 shadow-2xl overflow-hidden relative min-h-[850px] flex flex-col text-white animate-in zoom-in-95 duration-500">
      {!sessionActive ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center space-y-12">
           <div className="max-w-2xl space-y-6">
              <h2 className="text-6xl font-black tracking-tight bg-gradient-to-r from-white via-indigo-200 to-slate-400 bg-clip-text text-transparent">Simulation 2.0</h2>
              <p className="text-slate-400 text-xl font-medium leading-relaxed">Select a target persona to connect with a high-fidelity animated AI Human Bot.</p>
           </div>
           <div className="grid grid-cols-1 md:grid-cols-3 gap-8 w-full max-w-4xl">
              {(Object.keys(PERSONA_CONFIG) as SimPersonaV2[]).map((p) => (
                <PersonaCardV2 key={p} type={p} onClick={() => handleInitiate(p)} />
              ))}
           </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col gap-10">
          {/* Top Section: Avatar Hub */}
          <div className="flex flex-col items-center w-full">
             <div className="w-full aspect-video bg-slate-900 rounded-[3.5rem] border-8 border-slate-800 shadow-[0_40px_80px_-15px_rgba(0,0,0,0.8)] overflow-hidden flex flex-col items-center justify-center group relative">
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent opacity-80 z-10"></div>
                
                {/* Nameplate Overlay */}
                <div className="absolute top-10 left-1/2 -translate-x-1/2 z-40 bg-white/5 backdrop-blur-xl border border-white/10 px-8 py-3 rounded-full shadow-2xl flex items-center gap-3">
                   <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                   <span className="text-sm font-black uppercase tracking-[0.2em] text-white">Digital Persona: {meetingContext.clientNames || persona}</span>
                </div>

                <div className="relative z-20">
                   {persona && <AnimatedBotV2 type={persona} />}
                </div>
                <div className="absolute top-10 left-10 z-30 flex items-center gap-4 px-6 py-3 bg-black/40 backdrop-blur-md rounded-full border border-white/10">
                   <div className={`w-3 h-3 rounded-full ${isAISpeaking ? 'animate-pulse' : ''}`} style={{ backgroundColor: persona ? PERSONA_CONFIG[persona].color : '#4f46e5' }}></div>
                   <span className="text-[12px] font-black uppercase tracking-widest">{persona} Mode Online</span>
                </div>

                {/* Voice Protocol Badge */}
                {meetingContext.clonedVoiceBase64 && (
                   <div className="absolute top-10 right-10 z-30 flex items-center gap-2 px-4 py-2 bg-emerald-500/20 border border-emerald-500/30 rounded-full shadow-[0_0_20px_rgba(16,185,129,0.2)]">
                      <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-ping"></div>
                      <span className="text-[9px] font-black text-emerald-400 uppercase tracking-[0.1em]">Mimicry Protocol: Active</span>
                   </div>
                )}

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

             {/* HUD - Now Below Avatar */}
             <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
                <div className="p-10 bg-indigo-600/10 border border-indigo-500/20 rounded-[3rem] space-y-6 min-h-[120px]">
                   <h5 className="text-[11px] font-black uppercase tracking-widest text-indigo-400">{meetingContext.clientNames || persona} Strategic Inquiry</h5>
                   <p className="text-2xl font-black italic leading-tight text-white">{messages[messages.length - 1]?.content || status || "Synchronizing Neural Core..."}</p>
                </div>
                <div className={`flex-1 border border-white/5 rounded-[3rem] p-12 flex flex-col items-center justify-center text-center space-y-8 transition-all duration-500 ${isUserListening ? 'bg-emerald-600/10 border-emerald-500/20' : 'bg-slate-900'}`}>
                   <div className={`w-24 h-24 rounded-full flex items-center justify-center transition-all duration-500 ${isUserListening ? 'bg-emerald-600 shadow-[0_0_60px_rgba(16,185,129,0.6)] scale-110' : 'bg-slate-800'}`}><ICONS.Speaker className={`w-10 h-10 ${isUserListening ? 'text-white' : 'text-slate-500'}`} /></div>
                   <p className={`text-sm font-black uppercase tracking-[0.4em] ${isUserListening ? 'text-emerald-400 animate-pulse' : 'text-slate-50'}`}>{isUserListening ? "Capturing Strategy" : "Ready for Argument"}</p>
                </div>
             </div>
          </div>

          <div className="space-y-6 px-12">
             <div className="relative group">
                <textarea value={currentCaption} onChange={(e) => setCurrentCaption(e.target.value)} className="w-full bg-slate-900/60 border-2 border-slate-800 rounded-[3rem] px-12 py-10 text-2xl outline-none focus:border-indigo-500 transition-all font-bold italic text-indigo-50 shadow-inner h-40 resize-none placeholder:text-slate-700" placeholder={`Respond to ${meetingContext.clientNames || 'the Executive'}...`} />
                <button onClick={() => startListening()} className={`absolute right-8 top-1/2 -translate-y-1/2 p-6 rounded-2xl transition-all border ${isUserListening ? 'bg-emerald-600 border-emerald-500 text-white animate-pulse' : 'bg-white/5 border-white/10 text-indigo-400 hover:bg-white/10'}`}><ICONS.Speaker className="w-6 h-6" /></button>
             </div>

             {lastSuggestion && (
               <div className="p-8 bg-indigo-600/20 border border-indigo-500/30 rounded-[2.5rem] animate-in slide-in-from-top-4 duration-500">
                  <h6 className="text-[10px] font-black uppercase tracking-widest text-indigo-400 mb-2">Neural Coaching suggestion</h6>
                  <p className="text-sm font-bold text-indigo-100 italic">"Instead of that response, you could have stated: {lastSuggestion}"</p>
               </div>
             )}

             <div className="flex items-center justify-between gap-6 pb-12">
                <button onClick={handleNextNode} disabled={isProcessing || !currentCaption.trim()} className="flex-1 px-12 py-7 bg-indigo-600 text-white rounded-[2.5rem] font-black text-base uppercase tracking-widest hover:bg-indigo-700 disabled:opacity-50 transition-all active:scale-95">Commit Logic & Next Node</button>
                <button onClick={handleEndSession} disabled={isProcessing} className="px-12 py-7 bg-rose-600 text-white rounded-[2.5rem] font-black text-base uppercase tracking-widest shadow-2xl hover:bg-rose-700 transition-all disabled:opacity-50">End Session & Audit</button>
             </div>
          </div>
        </div>
      )}
    </div>
  );
};

const PersonaCardV2: FC<{ type: SimPersonaV2; onClick: () => void | Promise<void> }> = ({ type, onClick }) => {
  const config = PERSONA_CONFIG[type];
  return (
    <button onClick={onClick} className="group p-1 bg-slate-900/50 border-2 border-slate-800 rounded-[3rem] hover:border-indigo-500 transition-all text-left flex flex-col h-full shadow-xl active:scale-95 duration-300">
      <div className="aspect-[4/3] w-full rounded-[2.5rem] overflow-hidden mb-6 relative bg-slate-800 flex items-center justify-center">
         <div className="w-24 h-24 rounded-full bg-slate-700 flex items-center justify-center group-hover:scale-110 transition-transform">
            <ICONS.Brain className="w-12 h-12 text-slate-500 group-hover:text-white transition-colors" />
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
