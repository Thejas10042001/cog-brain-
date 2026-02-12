
import React, { useState, useRef, useEffect, FC } from 'react';
import { ICONS } from '../constants';
import { 
  streamAvatarSimulation, 
  generatePitchAudio, 
  decodeAudioData,
  evaluateAvatarSession 
} from '../services/geminiService';
import { GPTMessage, MeetingContext } from '../types';

interface AvatarSimulationProps {
  meetingContext: MeetingContext;
}

interface AvatarReport {
  conversation_summary: string;
  key_inflection_points: string[];
  objection_mapping: Array<{
    objection: string;
    handled_effectively: boolean;
    quality_score: number;
  }>;
  value_alignment_score: number;
  roi_strength_score: number;
  risk_and_security_handling_score: number;
  confidence_and_clarity_score: number;
  missed_opportunities: string[];
  trust_signals_detected: string[];
  risk_flags: string[];
  deal_readiness_score: number;
  next_step_likelihood: 'low' | 'medium' | 'high';
  coaching_recommendations: string[];
}

export const AvatarSimulation: FC<AvatarSimulationProps> = ({ meetingContext }) => {
  const [messages, setMessages] = useState<GPTMessage[]>([]);
  const [currentCaption, setCurrentCaption] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [isAISpeaking, setIsAISpeaking] = useState(false);
  const [isUserListening, setIsUserListening] = useState(false);
  const [sessionActive, setSessionActive] = useState(false);
  const [report, setReport] = useState<AvatarReport | null>(null);
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
    }
  };

  const handleNextNode = async () => {
    if (isProcessing || !currentCaption.trim()) return;
    
    stopListening();
    setIsProcessing(true);
    setStatus("");
    
    const userMsg: GPTMessage = { id: Date.now().toString(), role: 'user', content: currentCaption, mode: 'standard' };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    
    try {
      const stream = streamAvatarSimulation(currentCaption, messages, meetingContext);
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
    }
  };

  const handleEndSession = async () => {
    stopListening();
    setIsProcessing(true);
    setStatus("Generating Performance Audit...");

    let finalHistory = [...messages];
    if (currentCaption.trim()) {
      finalHistory.push({ id: Date.now().toString(), role: 'user', content: currentCaption, mode: 'standard' });
    }

    try {
      const reportJson = await evaluateAvatarSession(finalHistory, meetingContext);
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

      doc.setFillColor(30, 27, 75);
      doc.rect(0, 0, 210, 40, 'F');
      doc.setTextColor(255);
      doc.setFontSize(22);
      doc.setFont("helvetica", "bold");
      doc.text("AI HUMAN PERFORMANCE AUDIT", 20, 25);
      y = 50;

      addLine(`Project: Strategic Simulation for ${meetingContext.clientCompany}`, 12, "bold", [79, 70, 229]);
      y += 10;

      addLine("EXECUTIVE SUMMARY", 14, "bold");
      addLine(report.conversation_summary);
      y += 5;

      addLine(`READINESS SCORE: ${report.deal_readiness_score}/10`, 16, "bold", [5, 150, 105]);
      y += 10;

      addLine("OBJECTION DEFENSE MAPPING", 14, "bold");
      report.objection_mapping.forEach(obj => {
        addLine(`• Objection: "${obj.objection}"`, 10, "bold");
        addLine(`  Quality: ${obj.quality_score}/10 | ${obj.handled_effectively ? 'Validated' : 'Weak Point'}`, 9, "italic");
      });
      y += 10;

      addLine("COACHING RECOMMENDATIONS", 14, "bold");
      report.coaching_recommendations.forEach(rec => addLine(`• ${rec}`, 10));

      doc.save(`Performance-Audit-${meetingContext.clientCompany}.pdf`);
    } catch (e) {
      console.error(e);
    } finally {
      setIsExporting(false);
    }
  };

  const AIHumanAvatar = () => (
    <svg viewBox="0 0 200 200" className="w-64 h-64 drop-shadow-2xl">
      {/* Head */}
      <path d="M100 30 C 60 30, 40 60, 40 100 C 40 140, 60 170, 100 170 C 140 170, 160 140, 160 100 C 160 60, 140 30, 100 30" fill="#1e1b4b" stroke="#4f46e5" strokeWidth="2" />
      {/* Eyes */}
      <circle cx="75" cy="85" r="4" fill="#4f46e5" className={isAISpeaking ? "animate-pulse" : ""} />
      <circle cx="125" cy="85" r="4" fill="#4f46e5" className={isAISpeaking ? "animate-pulse" : ""} />
      {/* Animated Mouth (Lip Sync) */}
      <path 
        d={isAISpeaking ? "M80 120 Q 100 140, 120 120" : "M85 125 Q 100 125, 115 125"} 
        stroke="#4f46e5" 
        strokeWidth="4" 
        fill="none" 
        strokeLinecap="round"
        className={isAISpeaking ? "animate-mouth" : ""}
      />
      {/* Neck & Shoulders */}
      <path d="M70 170 C 70 190, 30 190, 10 200 L 190 200 C 170 190, 130 190, 130 170" fill="#1e1b4b" stroke="#4f46e5" strokeWidth="2" />
    </svg>
  );

  if (report) {
    return (
      <div className="space-y-12 animate-in fade-in slide-in-from-bottom-8 duration-700 pb-24">
        <div className="bg-slate-900 rounded-[4rem] p-16 text-white shadow-2xl relative overflow-hidden flex flex-col md:flex-row items-center justify-between gap-12">
          <div className="absolute top-0 right-0 p-16 opacity-5"><ICONS.Trophy className="w-96 h-96" /></div>
          <div className="relative z-10 space-y-8 flex-1 text-left">
            <div>
              <h2 className="text-4xl font-black tracking-tight">Performance Synthesis Audit</h2>
              <p className="text-indigo-200/70 font-medium text-lg max-w-2xl mt-6 italic">
                "{report.conversation_summary}"
              </p>
            </div>
            <div className="flex gap-4">
              <button onClick={exportPDF} disabled={isExporting} className="px-8 py-3.5 bg-indigo-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 transition-all flex items-center gap-2">
                {isExporting ? "Compiling Logic..." : <><ICONS.Document className="w-4 h-4" /> Export Performance PDF</>}
              </button>
              <button onClick={() => { setReport(null); handleInitiate(); }} className="px-8 py-3.5 bg-white/10 text-white border border-white/20 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-white/20 transition-all">
                Reset Simulation
              </button>
            </div>
          </div>
          <div className="relative z-10 w-64 h-64 bg-indigo-600 rounded-full flex flex-col items-center justify-center border-[12px] border-white/10 shadow-[0_0_100px_rgba(79,70,229,0.5)]">
            <span className="text-[12px] font-black uppercase tracking-widest text-indigo-200 mb-2">Readiness Score</span>
            <span className="text-7xl font-black">{report.deal_readiness_score}<span className="text-2xl opacity-40">/10</span></span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <ScoreCard label="Value Alignment" score={report.value_alignment_score} color="indigo" />
          <ScoreCard label="ROI Strength" score={report.roi_strength_score} color="emerald" />
          <ScoreCard label="Risk Handling" score={report.risk_and_security_handling_score} color="rose" />
          <ScoreCard label="Confidence & Clarity" score={report.confidence_and_clarity_score} color="amber" />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-950 border border-slate-800 rounded-[4rem] p-12 shadow-2xl overflow-hidden relative min-h-[850px] flex flex-col text-white animate-in zoom-in-95 duration-500">
      
      {!sessionActive ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center space-y-12">
           <div className="w-40 h-40 bg-indigo-600 rounded-full flex items-center justify-center shadow-2xl shadow-indigo-500/20 border-4 border-white/10">
              <AIHumanAvatar />
           </div>
           <div className="max-w-2xl space-y-6">
              <h2 className="text-5xl font-black tracking-tight">Initiate Presence Hub</h2>
              <p className="text-slate-400 text-lg font-medium leading-relaxed">
                Connect with the AI Human for a high-stakes verbal scenario. Performance metrics are tracked internally.
              </p>
           </div>
           <button 
             onClick={handleInitiate}
             className="px-16 py-7 bg-indigo-600 text-white rounded-full font-black text-2xl uppercase tracking-widest shadow-2xl hover:scale-105 active:scale-95 transition-all"
           >
             Connect Neural Interface
           </button>
        </div>
      ) : (
        <div className="flex-1 flex flex-col gap-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 flex-1">
             <div className="lg:col-span-8 relative">
                <div className="aspect-video bg-slate-900 rounded-[3.5rem] border-8 border-slate-800 shadow-[0_40px_80px_-15px_rgba(0,0,0,0.8)] overflow-hidden flex items-center justify-center group relative">
                   <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent z-10"></div>
                   
                   <div className={`relative z-20 transition-all duration-1000 ${isAISpeaking ? 'scale-105' : 'scale-100'}`}>
                      <AIHumanAvatar />
                   </div>
                   
                   {isAISpeaking && (
                     <div className="absolute bottom-12 left-0 right-0 h-16 flex items-end justify-center gap-1 z-20">
                        {[...Array(30)].map((_, i) => (
                           <div key={i} className="w-1.5 bg-indigo-500 rounded-full animate-waveform-sm" style={{ height: `${20 + Math.random() * 80}%`, animationDelay: `${i * 0.05}s` }}></div>
                        ))}
                     </div>
                   )}

                   <div className="absolute top-10 left-10 z-20 flex items-center gap-3 px-5 py-2 bg-black/40 backdrop-blur-md rounded-full border border-white/10">
                      <div className={`w-2 h-2 rounded-full ${isAISpeaking ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`}></div>
                      <span className="text-[10px] font-black uppercase tracking-widest">Active Presence Link</span>
                   </div>
                </div>
             </div>

             <div className="lg:col-span-4 flex flex-col gap-6">
                <div className="p-10 bg-indigo-600/10 border border-indigo-500/20 rounded-[3rem] space-y-4">
                   <h5 className="text-[10px] font-black uppercase tracking-widest text-indigo-400">Current Intelligence Probe</h5>
                   <p className="text-xl font-bold italic leading-relaxed text-indigo-50">
                     {messages[messages.length - 1]?.content || "Syncing logic..."}
                   </p>
                </div>
                
                <div className="flex-1 bg-slate-900 border border-white/5 rounded-[3rem] p-10 flex flex-col items-center justify-center text-center space-y-6">
                   <div className={`w-20 h-20 rounded-full flex items-center justify-center transition-all ${isUserListening ? 'bg-rose-600 shadow-[0_0_40px_rgba(225,29,72,0.4)] animate-ping' : 'bg-slate-800'}`}>
                      <ICONS.Speaker className="w-8 h-8" />
                   </div>
                   <p className="text-xs font-black uppercase tracking-[0.3em] text-slate-500">
                     {isUserListening ? "Capturing Strategic Logic..." : "Neural Capturing Primed"}
                   </p>
                </div>
             </div>
          </div>

          <div className="space-y-6">
             <div className="relative group">
                <label className="absolute -top-3 left-10 px-4 py-1 bg-indigo-600 text-white text-[9px] font-black uppercase tracking-widest rounded-full z-10 shadow-lg">
                  Neural Auto-Captioning (Editable)
                </label>
                <textarea 
                  value={currentCaption}
                  onChange={(e) => setCurrentCaption(e.target.value)}
                  className="w-full bg-slate-900/50 border-2 border-slate-800 rounded-[2.5rem] px-10 py-8 text-xl outline-none focus:border-indigo-500 transition-all font-medium italic text-slate-200 shadow-inner h-32 resize-none"
                  placeholder="The AI human is waiting for your strategic response..."
                />
                <button 
                  onClick={() => startListening()}
                  className="absolute right-6 top-1/2 -translate-y-1/2 p-4 bg-white/5 hover:bg-white/10 rounded-2xl transition-all"
                >
                  <ICONS.Speaker className="text-indigo-400" />
                </button>
             </div>

             <div className="flex items-center justify-between">
                <div className="flex gap-4">
                   <button 
                     onClick={handleNextNode}
                     disabled={isProcessing || !currentCaption.trim()}
                     className="px-12 py-5 bg-indigo-600 text-white rounded-[2rem] font-black text-sm uppercase tracking-widest shadow-2xl hover:bg-indigo-700 disabled:opacity-50 transition-all flex items-center gap-3"
                   >
                     {isProcessing ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : <ICONS.Play className="w-4 h-4" />}
                     Commit Answer & Next Question
                   </button>
                   <button 
                     onClick={() => setCurrentCaption("")}
                     className="px-8 py-5 bg-white/5 border border-white/10 rounded-[2rem] text-[10px] font-black uppercase tracking-widest hover:bg-white/10"
                   >
                     Clear Logic
                   </button>
                </div>

                <button 
                  onClick={handleEndSession}
                  disabled={isProcessing}
                  className="px-12 py-5 bg-rose-600 text-white rounded-[2rem] font-black text-sm uppercase tracking-widest shadow-2xl hover:bg-rose-700 transition-all disabled:opacity-50 flex items-center justify-center gap-3"
                >
                  {isProcessing && status ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      <span className="animate-pulse">{status}</span>
                    </>
                  ) : "End Session & Audit"}
                </button>
             </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes mouth {
          0%, 100% { transform: scaleY(0.4); }
          50% { transform: scaleY(1.2); }
        }
        .animate-mouth {
          animation: mouth 0.2s ease-in-out infinite;
          transform-origin: 100px 125px;
        }
        @keyframes waveform-sm {
          0%, 100% { transform: scaleY(0.4); opacity: 0.4; }
          50% { transform: scaleY(1); opacity: 1; }
        }
        .animate-waveform-sm {
          animation: waveform-sm 0.5s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
};

const ScoreCard = ({ label, score, color }: { label: string; score: number; color: string }) => (
  <div className={`p-8 bg-white border border-slate-200 rounded-[2.5rem] shadow-xl border-t-8 border-t-${color}-500 flex flex-col items-center text-center group hover:-translate-y-2 transition-all duration-500`}>
    <h4 className={`text-[10px] font-black uppercase tracking-widest text-${color}-600 mb-6`}>{label}</h4>
    <div className="relative mb-4">
       <svg className="w-20 h-20">
          <circle cx="40" cy="40" r="36" fill="none" stroke="#f1f5f9" strokeWidth="8" />
          <circle cx="40" cy="40" r="36" fill="none" stroke={`#4f46e5`} strokeWidth="8" 
             strokeDasharray={`${(score / 10) * 226} 226`} strokeLinecap="round" transform="rotate(-90 40 40)"
          />
       </svg>
       <span className="absolute inset-0 flex items-center justify-center text-2xl font-black text-slate-800">{score}</span>
    </div>
    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Weighted Score</p>
  </div>
);
