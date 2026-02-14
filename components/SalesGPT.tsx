
import React, { useState, useRef, useEffect, FC } from 'react';
import { ICONS } from '../constants';
import { streamSalesGPT, generatePineappleImage, streamDeepStudy, performCognitiveSearchStream } from '../services/geminiService';
import { GPTMessage, GPTToolMode, MeetingContext } from '../types';

interface SalesGPTProps {
  activeDocuments: { name: string; content: string }[];
  meetingContext: MeetingContext;
}

export const SalesGPT: FC<SalesGPTProps> = ({ activeDocuments, meetingContext }) => {
  const [messages, setMessages] = useState<GPTMessage[]>([]);
  const [input, setInput] = useState("");
  const [mode, setMode] = useState<GPTToolMode>('standard');
  const [isProcessing, setIsProcessing] = useState(false);
  const [includeContext, setIncludeContext] = useState(true);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const extractFieldFromPartialJson = (json: string, field: string): string => {
    try {
      const fieldMarker = `"${field}": "`;
      const startIdx = json.indexOf(fieldMarker);
      if (startIdx === -1) return "";
      
      const contentStart = startIdx + fieldMarker.length;
      let content = "";
      
      for (let i = contentStart; i < json.length; i++) {
        if (json[i] === '"' && (i === 0 || json[i-1] !== '\\')) {
          break;
        }
        content += json[i];
      }
      
      return content.replace(/\\n/g, '\n').replace(/\\"/g, '"');
    } catch (e) {
      return "";
    }
  };

  const handleSend = async () => {
    if (!input.trim() || isProcessing) return;

    const currentHistory = [...messages];
    const userMessage: GPTMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      mode: mode,
    };

    setMessages(prev => [...prev, userMessage]);
    setInput("");
    setIsProcessing(true);

    const assistantId = (Date.now() + 1).toString();
    const assistantMessage: GPTMessage = {
      id: assistantId,
      role: 'assistant',
      content: mode === 'pineapple' ? "Neural Creative Engine Primed. Synthesizing visual strategic asset..." : mode === 'deep-study' ? "Initiating Deep Study sequence..." : mode === 'cognitive' ? "Engaging Cognitive Search Core..." : "",
      mode: mode,
      isStreaming: mode !== 'pineapple'
    };

    setMessages(prev => [...prev, assistantMessage]);

    const docContext = activeDocuments.map(d => `FILE [${d.name}]:\n${d.content}`).join('\n\n');
    let contextStr = docContext;
    
    if (includeContext) {
      const meetingDetails = `
--- STRATEGIC MEETING CONTEXT ---
Seller: ${meetingContext.sellerCompany} (${meetingContext.sellerNames})
Prospect: ${meetingContext.clientCompany} (${meetingContext.clientNames})
Product: ${meetingContext.targetProducts} (${meetingContext.productDomain})
Meeting Focus: ${meetingContext.meetingFocus}
Persona Target: ${meetingContext.persona}
Strategic Keywords: ${meetingContext.strategicKeywords.join(', ')}
Executive Snapshot: ${meetingContext.executiveSnapshot}
---------------------------------
`;
      contextStr = meetingDetails + docContext;
    }

    try {
      if (mode === 'pineapple') {
        const imageUrl = await generatePineappleImage(input);
        setMessages(prev => prev.map(m => 
          m.id === assistantId ? { ...m, content: imageUrl ? "Asset synthesized:" : "Failed to synthesize asset.", imageUrl: imageUrl || undefined, isStreaming: false } : m
        ));
      } else if (mode === 'deep-study') {
        const stream = streamDeepStudy(input, currentHistory, contextStr);
        let fullText = "";
        for await (const chunk of stream) {
          fullText += chunk;
          setMessages(prev => prev.map(m => 
            m.id === assistantId ? { ...m, content: fullText } : m
          ));
        }
        setMessages(prev => prev.map(m => m.id === assistantId ? { ...m, isStreaming: false } : m));
      } else if (mode === 'cognitive') {
        const stream = performCognitiveSearchStream(input, docContext, meetingContext);
        let fullBuffer = "";
        for await (const chunk of stream) {
          fullBuffer += chunk;
          const partialAnswer = extractFieldFromPartialJson(fullBuffer, "answer");
          const partialShot = extractFieldFromPartialJson(fullBuffer, "cognitiveShot");
          
          if (partialAnswer || partialShot) {
            let displayContent = "";
            if (partialShot) displayContent += `**Strategic Shot:** ${partialShot}\n\n`;
            displayContent += partialAnswer;
            
            setMessages(prev => prev.map(m => 
              m.id === assistantId ? { ...m, content: displayContent } : m
            ));
          }
        }
        setMessages(prev => prev.map(m => m.id === assistantId ? { ...m, isStreaming: false } : m));
      } else {
        const stream = streamSalesGPT(input, currentHistory, contextStr);
        let fullText = "";
        for await (const chunk of stream) {
          fullText += chunk;
          setMessages(prev => prev.map(m => 
            m.id === assistantId ? { ...m, content: fullText } : m
          ));
        }
        setMessages(prev => prev.map(m => m.id === assistantId ? { ...m, isStreaming: false } : m));
      }
    } catch (error) {
      console.error(error);
      setMessages(prev => prev.map(m => 
        m.id === assistantId ? { ...m, content: "Neural link severed.", isStreaming: false } : m
      ));
    } finally {
      setIsProcessing(false);
    }
  };

  const clearChat = () => {
    setMessages([]);
  };

  const downloadImage = (url: string, filename: string) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = `StrategicAsset-${filename.replace(/\s+/g, '-')}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="bg-white border-x border-slate-200 h-[calc(100vh-64px)] flex flex-col overflow-hidden relative shadow-2xl mx-auto w-full">
      <div className="p-8 md:p-10 border-b border-slate-100 flex flex-col gap-6 bg-slate-50/80 backdrop-blur-md sticky top-0 z-20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-5">
            <div className="p-4 bg-indigo-600 text-white rounded-2xl shadow-xl shadow-indigo-100">
              <ICONS.Sparkles className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-2xl font-black text-slate-900 tracking-tight">Intelligence Fast Answer Studio</h3>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.4em] mt-1">Strategic Cognitive Synthesis Core</p>
            </div>
          </div>
          <div className="flex gap-4">
             <button onClick={clearChat} className="px-6 py-2.5 bg-white text-slate-400 hover:text-rose-500 border border-slate-200 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-sm active:scale-95">
               Clear Memory
             </button>
             <div className="flex items-center gap-3 px-5 py-2.5 bg-emerald-50 text-emerald-600 rounded-full border border-emerald-100 text-[10px] font-black uppercase tracking-widest">
                <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
                Neural Core Online
             </div>
          </div>
        </div>

        <div className="flex items-center gap-6 py-3 px-6 bg-white border border-slate-200 rounded-2xl shadow-inner">
           <div className="flex items-center gap-3 text-indigo-600 shrink-0">
              <ICONS.Shield className="w-4 h-4" />
              <span className="text-[10px] font-black uppercase tracking-widest">Active Memory Nodes</span>
           </div>
           <div className="h-5 w-px bg-slate-200 shrink-0"></div>
           <div className="flex gap-3 overflow-x-auto no-scrollbar py-1 flex-1 items-center">
              {activeDocuments.length > 0 ? activeDocuments.map((doc, i) => (
                <div key={i} className="px-4 py-1.5 bg-indigo-50 text-indigo-600 text-[8px] font-black uppercase tracking-widest rounded-lg border border-indigo-100/60 whitespace-nowrap shadow-sm">
                   {doc.name}
                </div>
              )) : (
                <span className="text-[9px] font-bold text-slate-300 uppercase italic">No grounding document nodes detected.</span>
              )}
           </div>
           <div className="h-5 w-px bg-slate-200 shrink-0"></div>
           <button 
             onClick={() => setIncludeContext(!includeContext)}
             className={`flex items-center gap-3 px-5 py-2 rounded-xl border transition-all active:scale-95 ${includeContext ? 'bg-indigo-600 text-white border-indigo-700 shadow-lg' : 'bg-white text-slate-400 border-slate-200 hover:border-indigo-300'}`}
           >
             <div className={`w-2 h-2 rounded-full ${includeContext ? 'bg-emerald-400 animate-pulse' : 'bg-slate-300'}`}></div>
             <span className="text-[10px] font-black uppercase tracking-widest">Strategy Context Sync</span>
           </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-12 md:p-20 space-y-12 no-scrollbar bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] bg-fixed opacity-100 flex flex-col items-center">
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-center space-y-8 max-w-2xl">
            <div className="p-12 bg-indigo-50 rounded-[4rem] text-indigo-300 shadow-inner">
               <ICONS.Brain className="w-24 h-24" />
            </div>
            <div className="space-y-4">
              <h4 className="text-4xl font-black text-slate-900 tracking-tight leading-tight">Ready for Strategic Inquiry</h4>
              <p className="text-slate-500 text-lg font-medium leading-relaxed">
                 The Neural Core is primed with your {activeDocuments.length} document nodes and {meetingContext.persona} persona parameters.
                 Ask about specific clauses, strategic gaps, or tactical maneuvers.
              </p>
            </div>
          </div>
        )}
        
        <div className="w-full max-w-4xl space-y-12">
          {messages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-6 duration-500`}>
              <div className={`w-full ${msg.role === 'user' ? 'max-w-[70%]' : 'max-w-[100%]'} ${msg.role === 'user' ? 'bg-slate-900 text-white rounded-[2.5rem] rounded-tr-none shadow-2xl' : 'bg-white border border-slate-200 shadow-2xl rounded-[3rem] rounded-tl-none text-slate-800'} p-8 md:p-12 relative group overflow-hidden`}>
                {msg.role === 'assistant' && (
                  <div className="absolute top-0 left-0 w-1.5 h-full bg-indigo-600"></div>
                )}
                
                <div className="flex items-center justify-between mb-6">
                   <div className="flex items-center gap-3">
                     <span className={`text-[10px] font-black uppercase tracking-[0.3em] ${msg.role === 'user' ? 'text-indigo-400' : 'text-indigo-600'}`}>
                        {msg.role === 'user' ? 'Strategy Architect' : msg.mode === 'deep-study' ? 'Exhaustive Research Node' : msg.mode === 'cognitive' ? 'Grounded Cognitive Core' : 'Fast Pulse Logic'}
                     </span>
                   </div>
                   {msg.isStreaming && (
                      <div className="flex gap-1">
                         <div className="w-1 h-1 bg-indigo-600 rounded-full animate-bounce"></div>
                         <div className="w-1 h-1 bg-indigo-600 rounded-full animate-bounce [animation-delay:0.2s]"></div>
                         <div className="w-1 h-1 bg-indigo-600 rounded-full animate-bounce [animation-delay:0.4s]"></div>
                      </div>
                   )}
                </div>
                
                <div className={`text-lg md:text-xl font-medium leading-[1.6] whitespace-pre-wrap markdown-content ${msg.mode === 'deep-study' || msg.mode === 'cognitive' ? 'font-serif text-slate-800' : 'text-slate-700'}`}>
                  {msg.content}
                </div>

                {msg.imageUrl && (
                  <div className="mt-10 rounded-[3rem] overflow-hidden border-8 border-slate-50 shadow-[0_40px_80px_-15px_rgba(0,0,0,0.3)] relative group/img max-w-3xl mx-auto">
                    <img src={msg.imageUrl} alt="Strategic Asset" className="w-full h-auto object-cover" />
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover/img:opacity-100 transition-all flex flex-col items-center justify-center backdrop-blur-md duration-500">
                       <h5 className="text-white font-black text-xs uppercase tracking-[0.4em] mb-6">Strategic Visual Logic Asset</h5>
                       <button 
                         onClick={() => downloadImage(msg.imageUrl!, 'StrategicAsset')}
                         className="px-10 py-5 bg-white text-slate-900 rounded-2xl font-black text-[11px] uppercase tracking-widest shadow-2xl hover:bg-indigo-600 hover:text-white transition-all flex items-center gap-3 active:scale-95"
                       >
                         <ICONS.Efficiency className="w-5 h-5" /> Download Master File
                       </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
        <div ref={chatEndRef} className="h-20" />
      </div>

      <div className="p-10 md:p-16 bg-slate-50/90 backdrop-blur-xl border-t border-slate-200 sticky bottom-0 z-20">
        <div className="max-w-4xl mx-auto space-y-10">
          <div className="flex flex-wrap gap-5 justify-center">
             <ToolToggle active={mode === 'standard'} onClick={() => setMode('standard')} icon={<ICONS.Chat className="w-4 h-4" />} label="Fast Pulse" />
             <ToolToggle active={mode === 'cognitive'} onClick={() => setMode('cognitive')} icon={<ICONS.Search className="w-4 h-4" />} label="Cognitive Answering" />
             <ToolToggle active={mode === 'deep-study'} onClick={() => setMode('deep-study')} icon={<ICONS.Research className="w-4 h-4" />} label="Deep Reasoning Study" color="amber" />
             <ToolToggle active={mode === 'pineapple'} onClick={() => setMode('pineapple')} icon={<ICONS.Pineapple className="w-4 h-4" />} label="Visual Logic Engine" color="emerald" />
          </div>

          <div className="relative group">
            <input 
              type="text" 
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder={`Ask the Intelligence Core about ${meetingContext.clientCompany}...`}
              className="w-full bg-white border-4 border-slate-200 rounded-[3.5rem] px-12 py-8 text-2xl outline-none transition-all pr-48 font-bold italic shadow-[0_30px_60px_-15px_rgba(0,0,0,0.1)] focus:border-indigo-500 placeholder:text-slate-300"
            />
            <button 
              onClick={handleSend}
              disabled={!input.trim() || isProcessing}
              className={`absolute right-5 top-5 bottom-5 px-12 rounded-[2.5rem] font-black uppercase tracking-[0.2em] text-xs shadow-2xl flex items-center gap-3 transition-all active:scale-95 ${isProcessing ? 'bg-slate-100 text-slate-400' : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-200'}`}
            >
              {isProcessing ? (
                 <><div className="w-4 h-4 border-2 border-slate-300 border-t-slate-500 rounded-full animate-spin"></div> Parsing</>
              ) : (
                 <><ICONS.Play className="w-4 h-4" /> Synthesize</>
              )}
            </button>
          </div>
          <p className="text-center text-[9px] font-black text-slate-400 uppercase tracking-[0.5em] animate-pulse">Grounded Logic Gate V3.1 Secure Link Active</p>
        </div>
      </div>
    </div>
  );
};

const ToolToggle = ({ active, onClick, icon, label, color = 'indigo' }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string; color?: string }) => {
  const activeClasses = {
    indigo: 'bg-indigo-600 border-indigo-600 text-white shadow-2xl shadow-indigo-200 scale-105',
    emerald: 'bg-emerald-600 border-emerald-600 text-white shadow-2xl shadow-emerald-200 scale-105',
    amber: 'bg-amber-600 border-amber-600 text-white shadow-2xl shadow-amber-200 scale-105',
  }[color];

  return (
    <button 
      onClick={onClick}
      className={`flex items-center gap-3 px-8 py-3 rounded-2xl border-2 transition-all font-black uppercase tracking-[0.1em] text-[10px] shadow-sm ${active ? activeClasses : 'bg-white border-slate-100 text-slate-400 hover:border-indigo-300 hover:text-slate-600'}`}
    >
      {icon}
      {label}
    </button>
  );
};

export default SalesGPT;
