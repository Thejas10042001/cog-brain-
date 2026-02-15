
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
    <div className="flex-1 flex flex-col h-[calc(100vh-64px)] relative bg-slate-50">
      {/* Background Ambience (Spans Edge-to-Edge) */}
      <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] bg-fixed opacity-10 pointer-events-none"></div>

      {/* Header (Spans Edge-to-Edge) */}
      <div className="w-full bg-white/80 backdrop-blur-xl border-b border-slate-200 z-20">
        <div className="max-w-5xl mx-auto px-12 py-6 flex items-center justify-between">
          <div className="flex items-center gap-5">
            <div className="p-3 bg-indigo-600 text-white rounded-2xl shadow-xl">
              <ICONS.Sparkles className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-2xl font-black text-slate-900 tracking-tight">Intelligence Studio</h3>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.4em]">Fast Answer Core</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
             <button onClick={clearChat} className="px-5 py-2 text-slate-400 hover:text-rose-500 text-[10px] font-black uppercase tracking-widest transition-colors">
               Clear Memory
             </button>
             <div className="flex items-center gap-2 px-4 py-1.5 bg-emerald-50 text-emerald-600 rounded-full border border-emerald-100 text-[9px] font-black uppercase tracking-widest shadow-sm">
                <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></div>
                Neural Core
             </div>
          </div>
        </div>
      </div>

      {/* Conversation Area (Centered with white margins) */}
      <div className="flex-1 overflow-y-auto no-scrollbar relative">
        <div className="max-w-5xl mx-auto px-12 py-12 space-y-12">
          {messages.length === 0 && (
            <div className="h-[50vh] flex flex-col items-center justify-center text-center space-y-8 animate-in fade-in zoom-in-95 duration-700">
               <div className="p-12 bg-white rounded-[4rem] shadow-2xl border border-slate-100 text-indigo-100 transform -rotate-2">
                  <ICONS.Brain className="w-24 h-24" />
               </div>
               <div className="space-y-3">
                  <h4 className="text-4xl font-black text-slate-900 tracking-tight">Ready for Inquiry</h4>
                  <p className="text-slate-500 text-xl font-medium leading-relaxed max-w-lg mx-auto">
                    The intelligence core is synced with your document nodes. Ask about specific clauses, strategic gaps, or tactical responses.
                  </p>
               </div>
            </div>
          )}

          {messages.map((msg) => (
            <div key={msg.id} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'} animate-in fade-in slide-in-from-bottom-4 duration-500`}>
              <div className="mb-2 px-6 flex items-center gap-3">
                <span className={`text-[10px] font-black uppercase tracking-[0.3em] ${msg.role === 'user' ? 'text-indigo-400' : 'text-slate-400'}`}>
                   {msg.role === 'user' ? 'Strategic Architect' : 'Cognitive Core'}
                </span>
                {msg.isStreaming && <div className="flex gap-1"><div className="w-1 h-1 bg-indigo-500 rounded-full animate-bounce"></div><div className="w-1 h-1 bg-indigo-500 rounded-full animate-bounce delay-75"></div><div className="w-1 h-1 bg-indigo-500 rounded-full animate-bounce delay-150"></div></div>}
              </div>
              <div className={`
                max-w-[100%] md:max-w-[85%] p-10 rounded-[3.5rem] text-2xl font-medium leading-[1.6] shadow-2xl
                ${msg.role === 'user' 
                  ? 'bg-slate-900 text-white rounded-tr-none border-4 border-slate-800' 
                  : 'bg-white text-slate-800 rounded-tl-none border border-slate-200'}
              `}>
                <div className="whitespace-pre-wrap markdown-content">
                  {msg.content}
                </div>
                {msg.imageUrl && (
                  <div className="mt-8 rounded-[2.5rem] overflow-hidden border-8 border-slate-50 shadow-2xl group/img relative">
                    <img src={msg.imageUrl} alt="Strategic Asset" className="w-full h-auto object-cover" />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-sm">
                       <button 
                         onClick={() => downloadImage(msg.imageUrl!, 'StrategicAsset')}
                         className="px-8 py-4 bg-white text-slate-900 rounded-2xl font-black text-xs uppercase tracking-widest shadow-2xl hover:bg-indigo-600 hover:text-white transition-all flex items-center gap-3"
                       >
                         <ICONS.Efficiency className="w-5 h-5" /> Download Master
                       </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
          <div ref={chatEndRef} className="h-24" />
        </div>
      </div>

      {/* Input Area (Centered with white margins) */}
      <div className="w-full bg-white/80 backdrop-blur-xl border-t border-slate-200 z-20">
        <div className="max-w-5xl mx-auto px-12 py-10 space-y-6">
          <div className="flex flex-wrap gap-4 justify-center">
             <ToolToggle active={mode === 'standard'} onClick={() => setMode('standard')} icon={<ICONS.Chat className="w-4 h-4" />} label="Fast Pulse" />
             <ToolToggle active={mode === 'cognitive'} onClick={() => setMode('cognitive')} icon={<ICONS.Search className="w-4 h-4" />} label="Cognitive" />
             <ToolToggle active={mode === 'deep-study'} onClick={() => setMode('deep-study')} icon={<ICONS.Research className="w-4 h-4" />} label="Deep Study" color="amber" />
             <ToolToggle active={mode === 'pineapple'} onClick={() => setMode('pineapple')} icon={<ICONS.Pineapple className="w-4 h-4" />} label="Visual Logic" color="emerald" />
          </div>

          <div className="relative group">
            <input 
              type="text" 
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder="Type your strategic inquiry..."
              className="w-full bg-white border-4 border-slate-200 rounded-[3rem] px-12 py-10 text-3xl outline-none transition-all pr-48 font-bold italic shadow-2xl focus:border-indigo-500 placeholder:text-slate-200"
            />
            <button 
              onClick={handleSend}
              disabled={!input.trim() || isProcessing}
              className={`absolute right-6 top-6 bottom-6 px-12 rounded-[2.5rem] font-black uppercase tracking-[0.2em] text-xs shadow-2xl flex items-center gap-3 transition-all active:scale-95 ${isProcessing ? 'bg-slate-100 text-slate-300' : 'bg-indigo-600 text-white hover:bg-indigo-700'}`}
            >
              {isProcessing ? 'Synthesizing' : 'Synthesize'}
            </button>
          </div>
          
          <div className="flex items-center justify-between px-4">
             <button 
               onClick={() => setIncludeContext(!includeContext)}
               className={`flex items-center gap-3 text-[10px] font-black uppercase tracking-[0.3em] transition-colors ${includeContext ? 'text-emerald-500' : 'text-slate-400'}`}
             >
                <div className={`w-2 h-2 rounded-full ${includeContext ? 'bg-emerald-500 animate-pulse shadow-[0_0_10px_rgba(16,185,129,0.5)]' : 'bg-slate-300'}`}></div>
                Strategic Context Sync: {includeContext ? 'Active' : 'Offline'}
             </button>
             <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.4em]">Intelligence Node v3.1 Grounded</p>
          </div>
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
