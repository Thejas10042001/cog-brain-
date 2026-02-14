
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
      
      const bytes = await generatePitchAudio(text, 'Charon');
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
        doc.setFont("helvetica", "bold");
        doc.setFontSize(size);
        doc.text(t, margin, y);
        y += size / 2 + 2;
      };

      const addP = (t: string, size = 10, color = [60, 60, 60]) => {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(size);
        doc.setTextColor(color[0], color[1], color[2]);
        const split = doc.splitTextToSize(t, 170);
        if (y + (split.length * (size / 2)) > 20) { doc.addPage(); y = 20; }
        doc.text(split, margin, y);
        y += (split.length * (size / 2)) + 4;
        doc.setTextColor(0, 0, 0);
      };

      addH("Avatar Performance Audit Report");
      addP(`Target Client: ${meetingContext.clientCompany}`);
      addP(`Persona Audited: ${report.persona_used}`);
      addP(`Overall Readiness Score: ${report.deal_readiness_score}/10`);
      addP(`Next Step Likelihood: ${report.next_step_likelihood.toUpperCase()}`);
      
      addH("Conversation Summary", 12);
      addP("Themes: " + report.conversation_summary.main_themes.join(", "));
      addP("Decisions: " + report.conversation_summary.decisions_reached.join(", "));
      
      addH("Inflection Points", 12);
      report.conversation_summary.inflection_points.forEach(p => addP(`• ${p}`));

      addH("Sentiment Evolution", 12);
      addP(`General Trend: ${report.sentiment_analysis.trend.toUpperCase()}`);
      addP(report.sentiment_analysis.narrative);
      addP("Emotional Shifts:");
      report.sentiment_analysis.emotional_shifts.forEach(s => addP(`- ${s.point}: ${s.shift}`, 9));

      addH("Confidence & Clarity Analysis", 12);
      addP(`Score: ${report.confidence_clarity_analysis.score}/10`);
      addP(report.confidence_clarity_analysis.narrative);

      addH("Objection Mapping", 12);
      report.objection_mapping.forEach(o => {
        addP(`- Objection: "${o.objection}"`);
        addP(`  Effectiveness: ${o.handled_effectively ? 'YES' : 'NO'} | Score: ${o.quality_score}/10`);
        addP(`  Note: ${o.coaching_note}`, 9);
        addP(`  Recommended Alternative: "${o.suggested_alternative}"`, 9, [79, 70, 229]);
      });

      addH("Risk & Trust Signals", 12);
      addP("Risk Signals: " + report.risk_signals.join(", "), 10, [225, 29, 72]);
      addP("Trust Signals: " + report.trust_signals.join(", "), 10, [16, 185, 129]);

      addH("Missed Opportunities", 12);
      report.missed_opportunities.forEach(o => addP(`• ${o}`));

      addH("Coaching Recommendations", 12);
      report.coaching_recommendations.forEach(r => addP(`• ${r}`, 10, [79, 70, 229]));

      doc.save(`Performance-Audit-${meetingContext.clientCompany}.pdf`);
    } catch (e) {
      console.error(e);
    } finally {
      setIsExporting(false);
    }
  };

  const AIAnimatedBotCIO = () => (
    <svg viewBox="0 0 200 240" className={`w-80 h-80 md:w-96 md:h-96 transition-all duration-700 ${isAISpeaking ? 'drop-shadow-[0_0_60px_rgba(79,70,229,0.5)]' : 'drop-shadow-2xl'}`}>
      <defs>
        <linearGradient id="faceGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#f8fafc" />
          <stop offset="100%" stopColor="#e2e8f0" />
        </linearGradient>
        <linearGradient id="suitGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#0f172a" />
          <stop offset="100%" stopColor="#020617" />
        </linearGradient>
        <filter id="eyeGlow">
          <feGaussianBlur stdDeviation="1" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>
      <g className="animate-breathe">
        <path d="M10 240 C 10 180, 40 170, 100 170 C 160 170, 190 180, 190 240" fill="url(#suitGrad)" />
        <path d="M85 170 L 100 185 L 115 170" fill="white" opacity="0.8" />
        <path d="M96 170 L 100 210 L 104 170" fill="#4f46e5" opacity="0.6" />
      </g>
      <g className={`${isUserListening ? 'animate-listen-tilt' : 'animate-breathe'}`}>
        <rect x="88" y="150" width="24" height="25" rx="12" fill="#e2e8f0" />
        <path d="M100 15 C 55 15, 50 55, 50 95 C 50 145, 70 165, 100 165 C 130 165, 150 145, 150 95 C 150 55, 145 15, 100 15" fill="url(#faceGrad)" stroke="#1e1b4b" strokeWidth="0.5" />
        <g className="animate-blink">
          <circle cx="78" cy="82" r="4.5" fill="#0f172a" />
          <circle cx="122" cy="82" r="4.5" fill="#0f172a" />
          <circle cx="78" cy="82" r="1.5" fill="#4f46e5" filter="url(#eyeGlow)" />
          <circle cx="122" cy="82" r="1.5" fill="#4f46e5" filter="url(#eyeGlow)" />
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
        @keyframes breathe { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-3px); } }
        .animate-breathe { animation: breathe 4s ease-in-out infinite; }
        @keyframes blink { 0%, 92%, 100% { transform: scaleY(1); } 96% { transform: scaleY(0.05); } }
        .animate-blink { transform-origin: center 82px; animation: blink 5s infinite; }
        @keyframes lip-morph { 0%, 100% { d: path("M-12 0 Q 0 12, 12 0 Q 0 -2, -12 0"); } 25% { d: path("M-8 0 Q 0 16, 8 0 Q 0 -4, -8 0"); } 50% { d: path("M-14 0 Q 0 8, 14 0 Q 0 -1, -14 0"); } 75% { d: path("M-10 0 Q 0 14, 10 0 Q 0 -3, -10 0"); } }
        .animate-lip-morph { animation: lip-morph 0.15s linear infinite; }
        @keyframes listen-tilt { 0%, 100% { transform: rotate(0deg) translateX(0px); } 50% { transform: rotate(1.5deg) translateX(1px); } }
        .animate-listen-tilt { animation: listen-tilt 3s ease-in-out infinite; transform-origin: center bottom; }
        @keyframes listen-mouth { 0%, 100% { transform: scaleX(1); } 50% { transform: scaleX(1.1); } }
        .animate-listen-mouth { animation: listen-mouth 0.5s ease-in-out infinite; transform-origin: center; }
      `}</style>
    </svg>
  );

  if (report) {
    return (
      <div className="animate-in fade-in slide-in-from-bottom-8 duration-700 min-h-[calc(100vh-64px)] bg-slate-900 text-white">
        <div className="p-16 shadow-2xl relative overflow-hidden flex flex-col items-start gap-12 text-left">
          <div className="absolute top-0 right-0 p-16 opacity-5"><ICONS.Trophy className="w-96 h-96" /></div>
          
          <div className="w-full flex justify-between items-center relative z-10">
             <div className="space-y-2">
                <h2 className="text-4xl font-black tracking-tight">Cognitive Performance Synthesis</h2>
                <p className="text-indigo-400 font-bold uppercase tracking-widest text-xs">Audited Persona: {report.persona_used}</p>
             </div>
             <div className="flex gap-4">
                <button onClick={exportPDF} disabled={isExporting} className="px-6 py-3 bg-white text-slate-950 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 hover:bg-indigo-50 shadow-xl">
                  {isExporting ? 'Synthesizing...' : <><ICONS.Document className="w-4 h-4" /> Download Branded Audit PDF</>}
                </button>
                <button onClick={handleInitiate} className="px-6 py-3 bg-indigo-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest">Restart Simulation</button>
             </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 w-full relative z-10">
             <div className="p-8 bg-white/5 border border-white/10 rounded-[2.5rem] text-center">
                <span className="text-6xl font-black text-white">{report.deal_readiness_score}<span className="text-xl text-slate-500">/10</span></span>
                <span className="block text-[10px] font-black uppercase text-indigo-400 tracking-widest mt-2">Deal Readiness</span>
             </div>
             <div className="p-8 bg-white/5 border border-white/10 rounded-[2.5rem] text-center">
                <span className="text-4xl font-black text-emerald-400 uppercase">{report.next_step_likelihood}</span>
                <span className="block text-[10px] font-black uppercase text-slate-400 tracking-widest mt-2">Next Step Odds</span>
             </div>
             <div className="p-8 bg-white/5 border border-white/10 rounded-[2.5rem] text-center">
                <span className="text-4xl font-black text-indigo-300">{report.value_alignment_score}/10</span>
                <span className="block text-[10px] font-black uppercase text-slate-400 tracking-widest mt-2">Value Align</span>
             </div>
             <div className="p-8 bg-white/5 border border-white/10 rounded-[2.5rem] text-center">
                <span className="text-4xl font-black text-rose-300">{report.confidence_clarity_analysis.score}/10</span>
                <span className="block text-[10px] font-black uppercase text-slate-400 tracking-widest mt-2">Confidence</span>
             </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 w-full relative z-10">
             <div className="space-y-8">
                <div className="p-10 bg-indigo-600/10 border border-indigo-500/20 rounded-[3rem]">
                   <h4 className="text-[10px] font-black uppercase text-indigo-400 tracking-widest mb-4">Sentiment Mapping & Emotional Shifts</h4>
                   <p className="text-lg font-medium italic text-indigo-50 leading-relaxed mb-6">"{report.sentiment_analysis.narrative}"</p>
                   <div className="space-y-3">
                      {report.sentiment_analysis.emotional_shifts.map((s, i) => (
                        <div key={i} className="flex items-center gap-3 text-xs font-bold text-slate-400">
                           <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full"></div>
                           <span>{s.point}:</span> <span className="text-indigo-200">{s.shift}</span>
                        </div>
                      ))}
                   </div>
                </div>

                <div className="p-10 bg-slate-800/40 border border-white/5 rounded-[3rem]">
                   <h4 className="text-[10px] font-black uppercase text-indigo-400 tracking-widest mb-4">Confidence & Clarity Analysis</h4>
                   <p className="text-sm font-medium text-slate-300 leading-relaxed">{report.confidence_clarity_analysis.narrative}</p>
                </div>

                <div className="space-y-4">
                   <h4 className="text-[10px] font-black uppercase text-rose-400 tracking-widest">Risk & Trust Indicators</h4>
                   <div className="grid grid-cols-2 gap-4">
                      {report.risk_signals.map((f, i) => (
                        <div key={i} className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-[11px] font-bold text-rose-200">⚠️ {f}</div>
                      ))}
                      {report.trust_signals.map((s, i) => (
                        <div key={i} className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl text-[11px] font-bold text-emerald-200">🛡️ {s}</div>
                      ))}
                   </div>
                </div>
             </div>

             <div className="space-y-8">
                <div className="p-10 bg-indigo-950 border border-indigo-500/30 rounded-[3rem]">
                   <h4 className="text-[10px] font-black uppercase text-indigo-400 tracking-widest mb-4">Themes & Inflection Points</h4>
                   <ul className="space-y-4">
                      {report.conversation_summary.inflection_points.map((p, i) => (
                        <li key={i} className="flex gap-4 text-sm font-medium text-slate-300 leading-relaxed">
                           <span className="text-indigo-500 font-black">NODE 0{i+1}</span>
                           {p}
                        </li>
                      ))}
                   </ul>
                </div>

                <div className="p-10 bg-rose-950/20 border border-rose-500/20 rounded-[3rem]">
                   <h4 className="text-[10px] font-black uppercase text-rose-400 tracking-widest mb-4">Missed Strategic Opportunities</h4>
                   <ul className="space-y-3">
                      {report.missed_opportunities.map((o, i) => (
                        <li key={i} className="flex items-center gap-3 text-xs font-bold text-rose-200">
                           <div className="w-1.5 h-1.5 bg-rose-500 rounded-full"></div> {o}
                        </li>
                      ))}
                   </ul>
                </div>

                <div className="p-10 bg-indigo-950 border border-indigo-500/30 rounded-[3rem]">
                   <h4 className="text-[10px] font-black uppercase text-indigo-400 tracking-widest mb-4">Tactical Performance Directives</h4>
                   <ul className="space-y-3">
                      {report.coaching_recommendations.map((r, i) => (
                        <li key={i} className="flex items-center gap-3 text-sm font-bold text-white">
                           <ICONS.Sparkles className="w-4 h-4 text-indigo-400" /> {r}
                        </li>
                      ))}
                   </ul>
                </div>
             </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-950 shadow-2xl overflow-hidden relative min-h-[calc(100vh-64px)] flex flex-col text-white animate-in zoom-in-95 duration-500">
      {!sessionActive ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center space-y-12 max-w-4xl mx-auto px-12">
           <div className="w-80 h-80 bg-slate-900 rounded-[4rem] border border-white/5 flex items-center justify-center group shadow-[0_0_60px_rgba(79,70,229,0.1)] hover:shadow-[0_0_80px_rgba(79,70,229,0.2)] transition-all duration-700 overflow-hidden">
              <AIAnimatedBotCIO />
           </div>
           <div className="space-y-6">
              <h2 className="text-6xl font-black tracking-tight bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">Initiate Presence: {meetingContext.clientNames || 'Executive CIO'}</h2>
              <p className="text-slate-400 text-2xl font-medium leading-relaxed">Connect with an animated AI Human Bot mapped to {meetingContext.clientNames || 'your target client'}. Internal neural audits active.</p>
           </div>
           <button onClick={handleInitiate} className="px-16 py-8 bg-indigo-600 text-white rounded-full font-black text-2xl uppercase tracking-widest shadow-2xl hover:scale-105 active:scale-95 transition-all">Activate Simulation</button>
        </div>
      ) : (
        <div className="flex-1 flex flex-col max-w-5xl mx-auto w-full py-16 px-12 gap-12 justify-center">
             {/* Unified Single Focus Header */}
             <div className="text-center space-y-4">
                <span className="px-5 py-2 bg-indigo-600/20 text-indigo-400 text-xs font-black uppercase tracking-[0.3em] rounded-full border border-indigo-500/20">
                   Identity: {meetingContext.clientNames || 'Executive Client'}
                </span>
                <h3 className="text-5xl font-black tracking-tight leading-tight">
                   {isAISpeaking ? 'Client is Speaking...' : isUserListening ? 'Listening to Architect...' : 'Dialogue Protocol Active'}
                </h3>
             </div>

             {/* Main Visual Core */}
             <div className="relative flex flex-col items-center">
                <div className="relative z-20 transition-all duration-700 transform hover:scale-[1.02]">
                   <AIAnimatedBotCIO />
                </div>
                
                {/* Minimalized Voice Protocol Badge */}
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
                   <h5 className="text-[10px] font-black uppercase tracking-[0.4em] text-indigo-500">Dialogue Node</h5>
                   <div className="flex gap-1">
                      <div className={`w-1 h-1 rounded-full ${isAISpeaking ? 'bg-indigo-500 animate-pulse' : 'bg-slate-700'}`}></div>
                      <div className={`w-1 h-1 rounded-full ${isAISpeaking ? 'bg-indigo-500 animate-pulse delay-75' : 'bg-slate-700'}`}></div>
                      <div className={`w-1 h-1 rounded-full ${isAISpeaking ? 'bg-indigo-500 animate-pulse delay-150' : 'bg-slate-700'}`}></div>
                   </div>
                </div>
                <p className="text-4xl font-bold italic leading-[1.4] text-white tracking-tight">
                   {messages[messages.length - 1]?.content || "Initializing behavioral synchronization..."}
                </p>
             </div>

             {/* User Interaction Layer */}
             <div className="space-y-8">
                <div className="relative group">
                   <textarea 
                     value={currentCaption} 
                     onChange={(e) => setCurrentCaption(e.target.value)} 
                     className="w-full bg-slate-900/50 border-2 border-slate-800 rounded-[3rem] px-12 py-10 text-2xl outline-none focus:border-indigo-500 transition-all font-medium italic text-slate-100 shadow-inner h-48 resize-none placeholder:text-slate-700 leading-relaxed" 
                     placeholder={`${meetingContext.clientNames || 'The Executive'} is awaiting your strategic response...`} 
                   />
                   <button 
                     onClick={() => startListening()} 
                     className={`absolute right-10 top-1/2 -translate-y-1/2 p-6 rounded-3xl transition-all border ${isUserListening ? 'bg-emerald-600 border-emerald-500 text-white animate-pulse' : 'bg-white/5 border-white/10 text-indigo-400 hover:bg-white/10'}`}
                   >
                     <ICONS.Ear className="w-8 h-8" />
                   </button>
                </div>
                
                {lastSuggestion && (
                  <div className="p-8 bg-indigo-600/10 border border-indigo-500/20 rounded-[2.5rem] animate-in slide-in-from-top-4 duration-500 text-center">
                     <p className="text-sm font-bold text-indigo-300 italic">"Strategic Adjustment: {lastSuggestion}"</p>
                  </div>
                )}

                <div className="flex items-center gap-6">
                   <button 
                     onClick={handleNextNode} 
                     disabled={isProcessing || !currentCaption.trim()} 
                     className="flex-1 py-8 bg-indigo-600 text-white rounded-[2.5rem] font-black text-xl uppercase tracking-[0.2em] shadow-2xl hover:bg-indigo-700 disabled:opacity-50 transition-all active:scale-95"
                   >
                     Commit Logic
                   </button>
                   <button 
                     onClick={handleEndSession} 
                     disabled={isProcessing} 
                     className="px-12 py-8 bg-rose-600 text-white rounded-[2.5rem] font-black text-sm uppercase tracking-widest shadow-2xl hover:bg-rose-700 transition-all disabled:opacity-50"
                   >
                     End & Audit
                   </button>
                </div>
             </div>
        </div>
      )}
    </div>
  );
};
