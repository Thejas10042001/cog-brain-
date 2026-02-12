
import React, { useState, useRef, useEffect, FC } from 'react';
import { ICONS } from '../constants';
import { 
  streamAvatarSimulationV2, 
  generatePitchAudio, 
  decodeAudioData,
  evaluateAvatarSessionV2 
} from '../services/geminiService';
import { GPTMessage, MeetingContext, SimPersonaV2, AvatarReportV2 } from '../types';

interface AvatarSimulationV2Props {
  meetingContext: MeetingContext;
}

export const AvatarSimulationV2: FC<AvatarSimulationV2Props> = ({ meetingContext }) => {
  const [persona, setPersona] = useState<SimPersonaV2 | null>(null);
  const [messages, setMessages] = useState<GPTMessage[]>([]);
  const [currentCaption, setCurrentCaption] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [isAISpeaking, setIsAISpeaking] = useState(false);
  const [isUserListening, setIsUserListening] = useState(false);
  const [sessionActive, setSessionActive] = useState(false);
  const [report, setReport] = useState<AvatarReportV2 | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [status, setStatus] = useState("");

  const audioContextRef = useRef<AudioContext | null>(null);
  const recognitionRef = useRef<any>(null);
  const activeAudioSource = useRef<AudioBufferSourceNode | null>(null);

  // Initialize Speech Recognition
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
      };

      recognition.onend = () => {
        setIsUserListening(false);
      };

      recognitionRef.current = recognition;
    }
  }, []);

  const playAIQuestion = async (text: string) => {
    setIsAISpeaking(true);
    try {
      if (!audioContextRef.current) audioContextRef.current = new AudioContext({ sampleRate: 24000 });
      // Voice mapping per persona
      const voice = persona === 'CFO' ? 'Charon' : persona === 'IT_DIRECTOR' ? 'Fenrir' : 'Kore';
      const bytes = await generatePitchAudio(text, voice);
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

  const handleInitiate = async (selected: SimPersonaV2) => {
    setPersona(selected);
    setSessionActive(true);
    setIsProcessing(true);
    setMessages([]);
    setCurrentCaption("");
    setStatus("Activating Neural Persona...");
    
    try {
      const trigger = `PERSONA: ${selected}`;
      const stream = streamAvatarSimulationV2(trigger, [], meetingContext);
      let firstQuestion = "";
      for await (const chunk of stream) {
        firstQuestion += chunk;
      }
      
      const assistantMsg: GPTMessage = { id: Date.now().toString(), role: 'assistant', content: firstQuestion, mode: 'standard' };
      setMessages([assistantMsg]);
      playAIQuestion(firstQuestion);
    } catch (e) {
      console.error(e);
    } finally {
      setIsProcessing(false);
      setStatus("");
    }
  };

  const handleNextNode = async () => {
    if (isProcessing || !currentCaption.trim()) return;
    
    stopListening();
    setIsProcessing(true);
    setStatus("Analyzing Logic...");
    
    const userMsg: GPTMessage = { id: Date.now().toString(), role: 'user', content: currentCaption, mode: 'standard' };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    
    try {
      const stream = streamAvatarSimulationV2(currentCaption, messages, meetingContext);
      let nextQuestion = "";
      for await (const chunk of stream) {
        nextQuestion += chunk;
      }
      
      const assistantMsg: GPTMessage = { id: (Date.now() + 1).toString(), role: 'assistant', content: nextQuestion, mode: 'standard' };
      setMessages([...updatedMessages, assistantMsg]);
      setCurrentCaption("");
      playAIQuestion(nextQuestion);
    } catch (e) {
      console.error(e);
    } finally {
      setIsProcessing(false);
      setStatus("");
    }
  };

  const handleEndSession = async () => {
    stopListening();
    setIsProcessing(true);
    setStatus("Generating 2.0 Audit...");

    let finalHistory = [...messages];
    if (currentCaption.trim()) {
      finalHistory.push({ id: Date.now().toString(), role: 'user', content: currentCaption, mode: 'standard' });
    }

    try {
      const reportJson = await evaluateAvatarSessionV2(finalHistory, meetingContext);
      setReport(reportJson);
    } catch (e) {
      console.error(e);
    } finally {
      setIsProcessing(false);
      setStatus("");
    }
  };

  const exportPDF = async () => {
    if (!report) return;
    setIsExporting(true);
    try {
      const { jsPDF } = (window as any).jspdf;
      const doc = new jsPDF();
      let y = 20;

      const addLine = (text: string, size = 10, style = "normal", color = [0, 0, 0]) => {
        doc.setFontSize(size);
        doc.setFont("helvetica", style);
        doc.setTextColor(color[0], color[1], color[2]);
        const split = doc.splitTextToSize(text, 170);
        if (y + split.length * (size/2) > 280) { doc.addPage(); y = 20; }
        doc.text(split, 20, y);
        y += split.length * (size/2) + 5;
      };

      doc.setFillColor(15, 23, 42);
      doc.rect(0, 0, 210, 45, 'F');
      doc.setTextColor(255);
      doc.setFontSize(24);
      doc.setFont("helvetica", "bold");
      doc.text("SIMULATION 2.0 AUDIT", 20, 28);
      doc.setFontSize(10);
      doc.text(`Persona Evaluated: ${report.persona_used}`, 20, 38);
      y = 60;

      addLine("EXECUTIVE CONVERSATION SUMMARY", 14, "bold", [79, 70, 229]);
      addLine(report.conversation_summary);
      y += 10;

      addLine(`READINESS SCORE: ${report.deal_readiness_score}/10`, 16, "bold", [5, 150, 105]);
      addLine(`Value Alignment: ${report.value_alignment_score}/10 | Credibility: ${report.credibility_score}/10`, 10, "italic");
      y += 10;

      addLine("PRIMARY CONCERNS DETECTED", 14, "bold", [225, 29, 72]);
      report.primary_concerns.forEach(c => addLine(`• ${c}`, 10));
      y += 5;

      addLine("CRITICAL GAPS IN LOGIC", 14, "bold", [150, 150, 0]);
      report.critical_gaps.forEach(g => addLine(`• ${g}`, 10));
      y += 5;

      addLine("TACTICAL COACHING RECOMMENDATIONS", 14, "bold", [79, 70, 229]);
      report.coaching_recommendations.forEach(r => addLine(`• ${r}`, 10));

      doc.save(`Simulation-2.0-Audit-${persona}-${meetingContext.clientCompany}.pdf`);
    } catch (e) {
      console.error(e);
    } finally {
      setIsExporting(false);
    }
  };

  const AIHumanAvatar = () => (
    <svg viewBox="0 0 200 200" className="w-72 h-72 drop-shadow-2xl">
      <defs>
        <linearGradient id="avatarGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#1e1b4b" />
          <stop offset="100%" stopColor="#0f172a" />
        </linearGradient>
      </defs>
      {/* Head Silhouette */}
      <path d="M100 20 C 50 20, 30 60, 30 110 C 30 160, 60 190, 100 190 C 140 190, 170 160, 170 110 C 170 60, 150 20, 100 20" fill="url(#avatarGrad)" stroke="#4f46e5" strokeWidth="2" />
      {/* Dynamic Eyes */}
      <g className={isAISpeaking ? "animate-pulse" : ""}>
        <circle cx="75" cy="85" r="5" fill="#6366f1" />
        <circle cx="125" cy="85" r="5" fill="#6366f1" />
      </g>
      {/* Advanced Animated Mouth (Lip Sync) */}
      <path 
        d={isAISpeaking ? "M80 130 Q 100 160, 120 130" : "M85 140 Q 100 140, 115 140"} 
        stroke="#818cf8" 
        strokeWidth="6" 
        fill="none" 
        strokeLinecap="round"
        className={isAISpeaking ? "animate-lip-sync" : ""}
      />
      {/* Shoulders */}
      <path d="M50 190 C 50 190, 0 190, 0 200 L 200 200 C 200 190, 150 190, 150 190" fill="#1e1b4b" />
    </svg>
  );

  if (report) {
    return (
      <div className="space-y-12 animate-in fade-in slide-in-from-bottom-8 duration-700 pb-24">
        <div className="bg-slate-900 rounded-[4rem] p-16 text-white shadow-2xl relative overflow-hidden flex flex-col md:flex-row items-center justify-between gap-12">
          <div className="absolute top-0 right-0 p-16 opacity-5"><ICONS.Trophy className="w-96 h-96" /></div>
          <div className="relative z-10 space-y-8 flex-1 text-left">
            <div>
              <h2 className="text-4xl font-black tracking-tight">Simulation 2.0 Strategic Audit</h2>
              <div className="flex gap-3 mt-4">
                 <span className="px-4 py-1.5 bg-indigo-600 rounded-full text-[10px] font-black uppercase tracking-widest">Persona: {report.persona_used}</span>
                 <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border ${report.next_step_likelihood === 'high' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-amber-500/20 text-amber-400 border-amber-500/30'}`}>Next Step: {report.next_step_likelihood}</span>
              </div>
              <p className="text-indigo-200/70 font-medium text-lg max-w-2xl mt-6 italic">
                "{report.conversation_summary}"
              </p>
            </div>
            <div className="flex gap-4">
              <button onClick={exportPDF} disabled={isExporting} className="px-8 py-4 bg-indigo-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 transition-all flex items-center gap-3">
                {isExporting ? <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : <><ICONS.Document className="w-4 h-4" /> Generate Branded PDF</>}
              </button>
              <button onClick={() => { setReport(null); setSessionActive(false); setPersona(null); }} className="px-8 py-4 bg-white/10 text-white border border-white/20 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-white/20 transition-all">
                New Scenario
              </button>
            </div>
          </div>
          <div className="relative z-10 w-64 h-64 bg-indigo-600 rounded-full flex flex-col items-center justify-center border-[12px] border-white/10 shadow-[0_0_100px_rgba(79,70,229,0.5)]">
            <span className="text-[12px] font-black uppercase tracking-widest text-indigo-200 mb-2">Deal Readiness</span>
            <span className="text-7xl font-black">{report.deal_readiness_score}<span className="text-2xl opacity-40">/10</span></span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <ScoreCardV2 label="Value Alignment" score={report.value_alignment_score} color="indigo" />
          <ScoreCardV2 label="Risk Assessment" score={report.risk_assessment_score} color="rose" />
          <ScoreCardV2 label="Vendor Credibility" score={report.credibility_score} color="emerald" />
          <ScoreCardV2 label="Readiness" score={report.deal_readiness_score} color="amber" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
           <div className="bg-white rounded-[3rem] p-12 shadow-xl border border-slate-200">
              <h3 className="text-xl font-black text-slate-900 mb-8 flex items-center gap-3"><ICONS.Search className="text-indigo-600" /> Primary Concerns</h3>
              <div className="space-y-4">
                 {report.primary_concerns.map((c, i) => (
                   <div key={i} className="p-6 bg-slate-50 rounded-2xl border border-slate-100 font-bold text-slate-700 italic">“{c}”</div>
                 ))}
              </div>
           </div>
           <div className="bg-white rounded-[3rem] p-12 shadow-xl border border-slate-200">
              <h3 className="text-xl font-black text-slate-900 mb-8 flex items-center gap-3"><ICONS.Brain className="text-rose-600" /> Coaching Protocols</h3>
              <div className="space-y-4">
                 {report.coaching_recommendations.map((r, i) => (
                   <div key={i} className="flex gap-4 p-6 bg-indigo-50/50 rounded-2xl border border-indigo-100 text-sm font-bold text-indigo-900 italic">
                      <span className="text-indigo-400">#{i+1}</span>
                      {r}
                   </div>
                 ))}
              </div>
           </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-950 border border-slate-800 rounded-[4rem] p-12 shadow-2xl overflow-hidden relative min-h-[850px] flex flex-col text-white animate-in zoom-in-95 duration-500">
      
      {!sessionActive ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center space-y-12">
           <div className="w-48 h-48 bg-slate-900 rounded-[3rem] flex items-center justify-center shadow-2xl shadow-indigo-500/10 border border-white/5 group">
              <AIHumanAvatar />
           </div>
           <div className="max-w-2xl space-y-6">
              <h2 className="text-6xl font-black tracking-tight bg-gradient-to-r from-white via-indigo-200 to-slate-400 bg-clip-text text-transparent">Simulation 2.0</h2>
              <p className="text-slate-400 text-xl font-medium leading-relaxed">
                Connect with an animated persona to stress-test your strategy. Select your target persona to begin.
              </p>
           </div>
           
           <div className="grid grid-cols-1 md:grid-cols-3 gap-8 w-full max-w-4xl">
              <PersonaCardV2 type="CIO" icon={<ICONS.Brain />} desc="Strategic, Scalable, Secure" onClick={() => handleInitiate('CIO')} />
              <PersonaCardV2 type="CFO" icon={<ICONS.ROI />} desc="Financial ROI, TCO, Downside" onClick={() => handleInitiate('CFO')} />
              <PersonaCardV2 type="IT_DIRECTOR" icon={<ICONS.Efficiency />} desc="API, Integration, Reliability" onClick={() => handleInitiate('IT_DIRECTOR')} />
           </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col gap-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 flex-1">
             <div className="lg:col-span-8 relative">
                <div className="aspect-video bg-slate-900 rounded-[3.5rem] border-8 border-slate-800 shadow-[0_40px_80px_-15px_rgba(0,0,0,0.8)] overflow-hidden flex items-center justify-center group relative">
                   <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent z-10"></div>
                   
                   <div className={`relative z-20 transition-all duration-1000 ${isAISpeaking ? 'scale-110' : 'scale-100'}`}>
                      <AIHumanAvatar />
                   </div>
                   
                   {isAISpeaking && (
                     <div className="absolute bottom-16 left-0 right-0 h-16 flex items-end justify-center gap-1 z-20">
                        {[...Array(40)].map((_, i) => (
                           <div key={i} className="w-1.5 bg-indigo-500 rounded-full animate-waveform-v2" style={{ height: `${20 + Math.random() * 80}%`, animationDelay: `${i * 0.03}s` }}></div>
                        ))}
                     </div>
                   )}

                   <div className="absolute top-10 left-10 z-20 flex items-center gap-4 px-6 py-3 bg-black/40 backdrop-blur-md rounded-full border border-white/10">
                      <div className={`w-3 h-3 rounded-full ${isAISpeaking ? 'bg-emerald-500 animate-pulse shadow-[0_0_10px_rgba(16,185,129,0.8)]' : 'bg-slate-400'}`}></div>
                      <span className="text-[12px] font-black uppercase tracking-widest">{persona} Presence Online</span>
                   </div>
                </div>
             </div>

             <div className="lg:col-span-4 flex flex-col gap-6">
                <div className="p-10 bg-indigo-600/10 border border-indigo-500/20 rounded-[3rem] space-y-6">
                   <h5 className="text-[11px] font-black uppercase tracking-widest text-indigo-400 flex items-center gap-2">
                     <ICONS.Shield className="w-4 h-4" /> Current Inquiry Node
                   </h5>
                   <p className="text-2xl font-black italic leading-tight text-white">
                     {messages[messages.length - 1]?.content || (status || "Calibrating Neural Sync...")}
                   </p>
                </div>
                
                <div className="flex-1 bg-slate-900 border border-white/5 rounded-[3rem] p-12 flex flex-col items-center justify-center text-center space-y-8">
                   <div className={`w-24 h-24 rounded-full flex items-center justify-center transition-all duration-500 ${isUserListening ? 'bg-rose-600 shadow-[0_0_60px_rgba(225,29,72,0.6)] animate-pulse' : 'bg-slate-800'}`}>
                      <ICONS.Speaker className="w-10 h-10" />
                   </div>
                   <p className="text-sm font-black uppercase tracking-[0.4em] text-slate-500 animate-pulse">
                     {isUserListening ? "Capturing Strategic Reasoning" : "Neural Microphone Ready"}
                   </p>
                </div>
             </div>
          </div>

          <div className="space-y-6">
             <div className="relative group">
                <label className="absolute -top-3 left-12 px-5 py-1.5 bg-indigo-600 text-white text-[10px] font-black uppercase tracking-widest rounded-full z-10 shadow-lg border border-indigo-500">
                  Neural Captioning Hub (Editable)
                </label>
                <textarea 
                  value={currentCaption}
                  onChange={(e) => setCurrentCaption(e.target.value)}
                  className="w-full bg-slate-900/60 border-2 border-slate-800 rounded-[3rem] px-12 py-10 text-2xl outline-none focus:border-indigo-500 transition-all font-bold italic text-indigo-50 shadow-inner h-40 resize-none placeholder:text-slate-700"
                  placeholder="The persona is awaiting your strategic justification..."
                />
                <button 
                  onClick={() => startListening()}
                  className={`absolute right-8 top-1/2 -translate-y-1/2 p-6 rounded-[2rem] transition-all border ${isUserListening ? 'bg-rose-600 border-rose-500 text-white animate-pulse' : 'bg-white/5 border-white/10 text-indigo-400 hover:bg-white/10'}`}
                >
                  <ICONS.Speaker className="w-6 h-6" />
                </button>
             </div>

             <div className="flex items-center justify-between gap-6">
                <div className="flex gap-6 flex-1">
                   <button 
                     onClick={handleNextNode}
                     disabled={isProcessing || !currentCaption.trim()}
                     className="flex-1 px-12 py-7 bg-indigo-600 text-white rounded-[2.5rem] font-black text-base uppercase tracking-widest shadow-2xl hover:bg-indigo-700 disabled:opacity-50 transition-all flex items-center justify-center gap-4 active:scale-95"
                   >
                     {isProcessing ? <div className="w-6 h-6 border-4 border-white/30 border-t-white rounded-full animate-spin"></div> : <ICONS.Play className="w-6 h-6" />}
                     Commit Logic & Next Node
                   </button>
                   <button 
                     onClick={() => setCurrentCaption("")}
                     className="px-10 py-7 bg-white/5 border border-white/10 rounded-[2.5rem] text-[11px] font-black uppercase tracking-widest hover:bg-white/10 transition-all"
                   >
                     Reset Transcription
                   </button>
                </div>

                <button 
                  onClick={handleEndSession}
                  disabled={isProcessing}
                  className="px-12 py-7 bg-rose-600 text-white rounded-[2.5rem] font-black text-base uppercase tracking-widest shadow-2xl hover:bg-rose-700 transition-all disabled:opacity-50 flex items-center justify-center gap-4"
                >
                   {isProcessing && status.includes('Audit') ? (
                    <>
                      <div className="w-6 h-6 border-4 border-white/30 border-t-white rounded-full animate-spin"></div>
                      <span className="animate-pulse">Analyzing...</span>
                    </>
                  ) : "Terminate & Audit"}
                </button>
             </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes lip-sync {
          0%, 100% { transform: scaleY(0.5); }
          50% { transform: scaleY(1.5); }
        }
        .animate-lip-sync {
          animation: lip-sync 0.15s ease-in-out infinite;
          transform-origin: 100px 140px;
        }
        @keyframes waveform-v2 {
          0%, 100% { transform: scaleY(0.4); opacity: 0.3; }
          50% { transform: scaleY(1); opacity: 1; }
        }
        .animate-waveform-v2 {
          animation: waveform-v2 0.4s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
};

const PersonaCardV2 = ({ type, icon, desc, onClick }: { type: string; icon: React.ReactNode; desc: string; onClick: () => void }) => (
  <button 
    onClick={onClick}
    className="group p-10 bg-slate-900/50 border-2 border-slate-800 rounded-[3rem] hover:border-indigo-500 hover:bg-slate-900 transition-all text-left flex flex-col h-full shadow-xl hover:shadow-indigo-500/10 active:scale-95 duration-300"
  >
    <div className="w-16 h-16 bg-indigo-600/20 text-indigo-400 rounded-2xl flex items-center justify-center mb-8 group-hover:scale-110 transition-transform group-hover:bg-indigo-600 group-hover:text-white shadow-inner">
       {icon}
    </div>
    <h4 className="text-3xl font-black mb-3 tracking-tight group-hover:text-indigo-400 transition-colors">{type}</h4>
    <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-6">{desc}</p>
    <div className="mt-auto pt-6 border-t border-white/5 flex items-center gap-2 text-slate-500 group-hover:text-indigo-300 transition-colors">
       <span className="text-[10px] font-black uppercase tracking-widest">Connect Link</span>
       <ICONS.Play className="w-3 h-3" />
    </div>
  </button>
);

const ScoreCardV2 = ({ label, score, color }: { label: string; score: number; color: string }) => (
  <div className={`p-8 bg-white border border-slate-200 rounded-[3rem] shadow-xl border-t-8 border-t-${color}-500 flex flex-col items-center text-center group hover:-translate-y-2 transition-all duration-500`}>
    <h4 className={`text-[10px] font-black uppercase tracking-widest text-${color}-600 mb-6`}>{label}</h4>
    <div className="relative mb-4">
       <svg className="w-24 h-24">
          <circle cx="48" cy="48" r="42" fill="none" stroke="#f1f5f9" strokeWidth="10" />
          <circle cx="48" cy="48" r="42" fill="none" stroke={`var(--tw-stroke-${color}-500)`} strokeWidth="10" 
             strokeDasharray={`${(score / 10) * 264} 264`} strokeLinecap="round" transform="rotate(-90 48 48)"
             className={`stroke-${color}-500 transition-all duration-1000`}
          />
       </svg>
       <span className="absolute inset-0 flex items-center justify-center text-3xl font-black text-slate-800">{score}</span>
    </div>
    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Weighted Pulse</p>
  </div>
);
