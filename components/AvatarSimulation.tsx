
import React, { useState, useRef, useEffect, FC } from 'react';
import { ICONS } from '../constants';
import { streamAvatarSimulation } from '../services/geminiService';
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
  const [input, setInput] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [report, setReport] = useState<AvatarReport | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Start the conversation if it's empty
  useEffect(() => {
    if (messages.length === 0) {
      handleInitiate();
    }
  }, []);

  const handleInitiate = async () => {
    setIsProcessing(true);
    const assistantId = Date.now().toString();
    const assistantMessage: GPTMessage = {
      id: assistantId,
      role: 'assistant',
      content: "",
      mode: 'standard',
      isStreaming: true
    };
    setMessages([assistantMessage]);

    try {
      const stream = streamAvatarSimulation("START SIMULATION", [], meetingContext);
      let fullText = "";
      for await (const chunk of stream) {
        fullText += chunk;
        setMessages([{ ...assistantMessage, content: fullText }]);
      }
      setMessages([{ ...assistantMessage, content: fullText, isStreaming: false }]);
    } catch (e) {
      console.error(e);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSend = async (overrideInput?: string) => {
    const textToSend = overrideInput || input;
    if (!textToSend.trim() || isProcessing) return;

    const userMessage: GPTMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: textToSend,
      mode: 'standard',
    };

    setMessages(prev => [...prev, userMessage]);
    setInput("");
    setIsProcessing(true);

    const assistantId = (Date.now() + 1).toString();
    const assistantMessage: GPTMessage = {
      id: assistantId,
      role: 'assistant',
      content: "",
      mode: 'standard',
      isStreaming: true
    };

    setMessages(prev => [...prev, assistantMessage]);

    try {
      const stream = streamAvatarSimulation(textToSend, messages, meetingContext);
      let fullText = "";
      for await (const chunk of stream) {
        fullText += chunk;
        setMessages(prev => prev.map(m => m.id === assistantId ? { ...m, content: fullText } : m));
      }
      
      // Check if this was the "END SESSION" command
      if (textToSend.toUpperCase() === "END SESSION") {
        try {
          const parsedReport = JSON.parse(fullText.trim());
          setReport(parsedReport);
        } catch (err) {
          console.error("Failed to parse end session report:", err);
          // If parsing fails, we still have the raw text but no dashboard
        }
      }

      setMessages(prev => prev.map(m => m.id === assistantId ? { ...m, isStreaming: false } : m));
    } catch (error) {
      console.error(error);
    } finally {
      setIsProcessing(false);
    }
  };

  if (report) {
    return (
      <div className="space-y-12 animate-in fade-in slide-in-from-bottom-8 duration-700 pb-24">
        {/* Report Header */}
        <div className="bg-slate-900 rounded-[4rem] p-16 text-white shadow-2xl relative overflow-hidden flex flex-col md:flex-row items-center justify-between gap-12">
          <div className="absolute top-0 right-0 p-16 opacity-5"><ICONS.Trophy className="w-96 h-96" /></div>
          <div className="relative z-10 space-y-8 flex-1">
            <div>
              <h2 className="text-4xl font-black tracking-tight">CIO Performance Audit</h2>
              <div className="flex items-center gap-3 mt-4">
                <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border ${report.next_step_likelihood === 'high' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-amber-500/20 text-amber-400 border-amber-500/30'}`}>
                  Next Step Likelihood: {report.next_step_likelihood}
                </span>
              </div>
              <p className="text-indigo-200/70 font-medium text-lg max-w-2xl mt-6 italic">
                "{report.conversation_summary}"
              </p>
            </div>
            <div className="flex gap-4">
              <button onClick={() => { setReport(null); setMessages([]); handleInitiate(); }} className="px-8 py-3.5 bg-indigo-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-500/20">
                Restart Simulation
              </button>
            </div>
          </div>
          <div className="relative z-10 w-64 h-64 bg-indigo-600 rounded-full flex flex-col items-center justify-center border-[12px] border-white/10 shadow-[0_0_100px_rgba(79,70,229,0.5)]">
            <span className="text-[12px] font-black uppercase tracking-widest text-indigo-200 mb-2">Readiness</span>
            <span className="text-7xl font-black">{report.deal_readiness_score}<span className="text-2xl opacity-40">/10</span></span>
          </div>
        </div>

        {/* Scoring Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <ScoreCard label="Value Alignment" score={report.value_alignment_score} color="indigo" />
          <ScoreCard label="ROI Strength" score={report.roi_strength_score} color="emerald" />
          <ScoreCard label="Risk Handling" score={report.risk_and_security_handling_score} color="rose" />
          <ScoreCard label="Confidence & Clarity" score={report.confidence_and_clarity_score} color="amber" />
        </div>

        {/* Detailed Audit Columns */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
          <div className="space-y-10">
            <div className="bg-white rounded-[3rem] p-10 shadow-xl border border-slate-200">
              <h3 className="text-xl font-black text-slate-900 mb-8 flex items-center gap-3">
                <ICONS.Shield className="text-rose-500" /> Objection Defense Map
              </h3>
              <div className="space-y-4">
                {report.objection_mapping.map((obj, i) => (
                  <div key={i} className="p-6 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between group hover:border-indigo-300 transition-all">
                    <div className="flex-1 pr-6">
                      <p className="text-sm font-bold text-slate-800 leading-tight">“{obj.objection}”</p>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className={`px-3 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest ${obj.handled_effectively ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                        {obj.handled_effectively ? 'Mastered' : 'Weak Point'}
                      </span>
                      <span className="text-lg font-black text-slate-400">{obj.quality_score}/10</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-[3rem] p-10 shadow-xl border border-slate-200">
               <h3 className="text-xl font-black text-slate-900 mb-8 flex items-center gap-3">
                 <ICONS.Brain className="text-indigo-500" /> Strategic Recommendations
               </h3>
               <div className="space-y-4">
                  {report.coaching_recommendations.map((rec, i) => (
                    <div key={i} className="flex gap-4 p-5 bg-indigo-50 rounded-2xl border border-indigo-100 italic text-indigo-900 text-sm font-medium leading-relaxed">
                       <span className="text-indigo-400 font-black">#0{i+1}</span>
                       {rec}
                    </div>
                  ))}
               </div>
            </div>
          </div>

          <div className="space-y-10">
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white rounded-[3rem] p-8 shadow-xl border border-slate-200">
                   <h4 className="text-[10px] font-black uppercase text-emerald-600 tracking-widest mb-6">Trust Signals Detected</h4>
                   <ul className="space-y-3">
                      {report.trust_signals_detected.map((signal, i) => (
                        <li key={i} className="flex gap-3 text-xs font-bold text-slate-600">
                           <div className="mt-1 w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0"></div>
                           {signal}
                        </li>
                      ))}
                   </ul>
                </div>
                <div className="bg-white rounded-[3rem] p-8 shadow-xl border border-slate-200">
                   <h4 className="text-[10px] font-black uppercase text-rose-600 tracking-widest mb-6">Missed Opportunities</h4>
                   <ul className="space-y-3">
                      {report.missed_opportunities.map((opp, i) => (
                        <li key={i} className="flex gap-3 text-xs font-bold text-slate-600">
                           <div className="mt-1 w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0"></div>
                           {opp}
                        </li>
                      ))}
                   </ul>
                </div>
             </div>

             <div className="bg-slate-950 rounded-[3rem] p-10 text-white shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 p-8 opacity-10"><ICONS.Sparkles className="w-24 h-24" /></div>
                <h3 className="text-xl font-black mb-8">Neural Inflection Points</h3>
                <div className="space-y-6">
                   {report.key_inflection_points.map((point, i) => (
                     <div key={i} className="relative pl-8 pb-6 border-l-2 border-indigo-500/30 last:pb-0">
                        <div className="absolute left-[-9px] top-0 w-4 h-4 rounded-full bg-indigo-500 shadow-[0_0_15px_rgba(79,70,229,0.8)]"></div>
                        <p className="text-sm font-medium text-indigo-100 leading-relaxed italic">“{point}”</p>
                     </div>
                   ))}
                </div>
             </div>

             <div className="bg-amber-50 rounded-[3rem] p-10 border border-amber-100 shadow-sm">
                <h3 className="text-sm font-black text-amber-800 uppercase tracking-widest mb-4">Enterprise Risk flags</h3>
                <div className="flex flex-wrap gap-2">
                   {report.risk_flags.map((flag, i) => (
                     <span key={i} className="px-4 py-2 bg-white border border-amber-200 text-amber-700 rounded-xl text-[10px] font-black uppercase tracking-widest">
                       {flag}
                     </span>
                   ))}
                </div>
             </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-140px)] bg-white border border-slate-200 rounded-[3rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-500">
      {/* Simulation Header */}
      <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-10 opacity-[0.03]"><ICONS.Brain className="w-32 h-32" /></div>
        <div className="flex items-center gap-5 relative z-10">
          <div className="p-4 bg-slate-900 text-white rounded-2xl shadow-xl">
            <ICONS.Brain className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-2xl font-black text-slate-900 tracking-tight">Enterprise Simulation Core</h3>
            <div className="flex items-center gap-3 mt-1">
              <div className="w-2 h-2 bg-indigo-500 rounded-full animate-pulse"></div>
              <p className="text-[10px] text-slate-500 font-black uppercase tracking-[0.2em]">Fahim Sidiqi (CIO Simulation) • Dual-Mode Active</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4 relative z-10">
           <div className="hidden md:flex flex-col items-end mr-4">
              <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Neural Auditor</span>
              <span className="text-[10px] font-bold text-indigo-600 uppercase">Evaluation mode: Internal</span>
           </div>
           <button 
             onClick={() => handleSend("END SESSION")}
             disabled={isProcessing || messages.length < 2}
             className="px-8 py-3.5 bg-rose-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-rose-700 transition-all shadow-xl shadow-rose-200 disabled:opacity-50"
           >
             Terminate & Generate Audit
           </button>
        </div>
      </div>

      {/* Messages Window */}
      <div className="flex-1 overflow-y-auto p-10 space-y-10 custom-scrollbar bg-[url('https://www.transparenttextures.com/patterns/clean-gray-paper.png')] bg-fixed">
        {messages.map((msg, i) => (
          <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-4 duration-300`}>
            <div className={`max-w-[75%] ${msg.role === 'user' ? 'bg-slate-900 text-white rounded-[2rem] rounded-tr-none' : 'bg-white border-2 border-slate-100 shadow-2xl rounded-[2.5rem] rounded-tl-none text-slate-800'} p-10 relative group`}>
               <div className="flex items-center gap-3 mb-4">
                  <span className={`text-[9px] font-black uppercase tracking-widest ${msg.role === 'user' ? 'text-indigo-400' : 'text-indigo-600'}`}>
                    {msg.role === 'user' ? 'Seller Strategy' : 'Fahim Sidiqi (CIO)'}
                  </span>
                  {msg.role === 'assistant' && i === 0 && (
                    <span className="px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded text-[8px] font-black uppercase">Initial Probing</span>
                  )}
               </div>
               <p className={`text-lg font-medium leading-relaxed italic ${msg.role === 'assistant' ? 'font-serif text-slate-700' : ''}`}>
                 {msg.content}
               </p>
               {msg.isStreaming && (
                 <div className="mt-6 flex items-center gap-2">
                    <div className="flex gap-1 text-indigo-600">
                       <div className="w-1.5 h-1.5 bg-current rounded-full animate-bounce"></div>
                       <div className="w-1.5 h-1.5 bg-current rounded-full animate-bounce [animation-delay:0.2s]"></div>
                       <div className="w-1.5 h-1.5 bg-current rounded-full animate-bounce [animation-delay:0.4s]"></div>
                    </div>
                 </div>
               )}
            </div>
          </div>
        ))}
        <div ref={chatEndRef} />
      </div>

      {/* Control Area */}
      <div className="p-10 bg-slate-50 border-t border-slate-200">
        <div className="max-w-5xl mx-auto">
          <div className="relative group">
            <input 
              type="text" 
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder="Speak directly to the CIO... (Type 'END SESSION' to finish)"
              className="w-full bg-white border-2 border-slate-200 rounded-[2.5rem] px-12 py-8 text-xl outline-none transition-all pr-40 font-medium shadow-2xl focus:border-indigo-500 focus:shadow-indigo-100"
            />
            <button 
              onClick={() => handleSend()}
              disabled={!input.trim() || isProcessing}
              className="absolute right-6 top-1/2 -translate-y-1/2 px-10 py-4 rounded-[1.5rem] bg-slate-900 text-white font-black uppercase tracking-widest text-xs hover:bg-indigo-600 transition-all active:scale-95 disabled:opacity-50 flex items-center gap-3"
            >
              {isProcessing ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : <ICONS.Play className="w-4 h-4" />}
              Transmit
            </button>
          </div>
          <div className="mt-6 flex items-center justify-center gap-6">
             <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Persona Grounding Link Active</p>
             </div>
             <div className="w-px h-3 bg-slate-200"></div>
             <p className="text-[10px] font-black uppercase tracking-[0.3em] text-indigo-500">Internal Audit Node Monitoring Output</p>
          </div>
        </div>
      </div>
    </div>
  );
};

const ScoreCard = ({ label, score, color }: { label: string; score: number; color: string }) => (
  <div className={`p-8 bg-white border border-slate-200 rounded-[2.5rem] shadow-xl border-t-8 border-t-${color}-500 flex flex-col items-center text-center group hover:-translate-y-2 transition-all duration-500`}>
    <h4 className={`text-[10px] font-black uppercase tracking-widest text-${color}-600 mb-6`}>{label}</h4>
    <div className="relative mb-4">
       <svg className="w-20 h-20">
          <circle cx="40" cy="40" r="36" fill="none" stroke="#f1f5f9" strokeWidth="8" />
          <circle cx="40" cy="40" r="36" fill="none" stroke={`var(--tw-stroke-${color}-500)`} strokeWidth="8" 
             strokeDasharray={`${(score / 10) * 226} 226`} strokeLinecap="round" transform="rotate(-90 40 40)"
             className={`stroke-${color}-500`}
          />
       </svg>
       <span className="absolute inset-0 flex items-center justify-center text-2xl font-black text-slate-800">{score}</span>
    </div>
    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Engine Weighted</p>
  </div>
);
