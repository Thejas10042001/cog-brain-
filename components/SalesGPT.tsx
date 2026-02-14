
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
    <div className="bg-white border-y border-slate-200 rounded-none h-[calc(100vh-64px)] flex flex-col overflow-hidden relative">
      <div className="p-6 md:p-8 border-b border-slate-100 flex flex-col gap-4 bg-slate-50/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-indigo-600 text-white rounded-2xl shadow-lg">
              <ICONS.Sparkles className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-xl font-black text-slate-900 tracking-tight">Intelligence Studio</h3>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Grounded Sales Synthesis Core</p>
            </div>
          </div>
          <div className="flex gap-3">
             <button onClick={clearChat} className="px-4 py-2 bg-white text-slate-400 hover:text-rose-500 border border-slate-200 rounded-xl text-[9px] font-black uppercase tracking-widest transition-colors">
               Clear Memory
             </button>
             <div className="flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-600 rounded-full border border-emerald-100 text-[9px] font-black uppercase tracking-widest">
                Online
             </div>
          </div>
        </div>

        <div className="flex items-center gap-4 py-2 px-4 bg-white/50 border border-slate-100 rounded-2xl">
           <div className="flex items-center gap-2 text-indigo-600 shrink-0">
              <ICONS.Shield className="w-4 h-4" />
              <span className="text-[9px] font-black uppercase tracking-widest">Document Memory</span>
           </div>
           <div className="h-4 w-px bg-slate-200 shrink-0"></div>
           <div className="flex gap-2 overflow-x-auto no-scrollbar py-1 flex-1">
              {activeDocuments.length > 0 ? activeDocuments.map((doc, i) => (
                <div key={i} className="px-3 py-1 bg-indigo-50 text-indigo-600 text-[7px] font-black uppercase tracking-widest rounded-lg border border-indigo-100 whitespace-nowrap">
                   {doc.name}
                </div>
              )) : (
                <span className="text-[8px] font-bold text-slate-300 uppercase italic">No documents currently uploaded.</span>
              )}
           </div>
           <div className="h-4 w-px bg-slate-200 shrink-0"></div>
           <button 
             onClick={() => setIncludeContext(!includeContext)}
             className={`flex items-center gap-2 px-4 py-1.5 rounded-xl border transition-all ${includeContext ? 'bg-indigo-600 text-white border-indigo-700 shadow-lg' : 'bg-white text-slate-400 border-slate-200 hover:border-indigo-300'}`}
           >
             <div className={`w-2 h-2 rounded-full ${includeContext ? 'bg-emerald-400 animate-pulse' : 'bg-slate-300'}`}></div>
             <span className="text-[9px] font-black uppercase tracking-widest">Context Sync</span>
           </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 md:p-10 space-y-8 no-scrollbar bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] bg-fixed opacity-95">
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-center space-y-6">
            <div className="p-10 bg-indigo-50 rounded-[3rem] text-indigo-200">
               <ICONS.Brain className="w-20 h-20" />
            </div>
            <div className="max-w-md">
              <h4 className="text-2xl font-black text-slate-800">Ready for Interaction</h4>
              <p className="text-slate-500 mt-2 font-medium">Ask about your active documents or the strategic landscape.</p>
            </div>
          </div>
        )}
        
        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-4 duration-300`}>
            <div className={`max-w-[85%] ${msg.role === 'user' ? 'bg-slate-900 text-white rounded-[2rem] rounded-tr-none' : 'bg-white border border-slate-100 shadow-xl rounded-[2rem] rounded-tl-none text-slate-800'} p-6 md:p-8 relative group`}>
              <div className="flex items-center justify-between mb-4">
                 <div className="flex items-center gap-3">
                   <span className={`text-[9px] font-black uppercase tracking-widest ${msg.role === 'user' ? 'text-indigo-400' : 'text-indigo-600'}`}>
                      {msg.role === 'user' ? 'Architect' : msg.mode === 'deep-study' ? 'Research Core' : msg.mode === 'cognitive' ? 'Cognitive Core' : 'Fast Pulse Core'}
                   </span>
                 </div>
              </div>
              
              <div className={`text-sm font-medium leading-relaxed whitespace-pre-wrap markdown-content ${msg.mode === 'deep-study' || msg.mode === 'cognitive' ? 'font-serif text-slate-700' : ''}`}>
                {msg.content}
              </div>

              {msg.imageUrl && (
                <div className="mt-6 rounded-3xl overflow-hidden border-4 border-slate-50 shadow-2xl relative group/img">
                  <img src={msg.imageUrl} alt="Generated asset" className="w-full h-auto object-cover" />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-sm">
                     <button 
                       onClick={() => downloadImage(msg.imageUrl!, 'StrategicAsset')}
                       className="px-6 py-3 bg-white text-slate-900 rounded-xl font-black text-[10px] uppercase tracking-widest shadow-2xl hover:bg-indigo-600 hover:text-white transition-all flex items-center gap-2"
                     >
                       <ICONS.Efficiency className="w-4 h-4" /> Download
                     </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
        <div ref={chatEndRef} />
      </div>

      <div className="p-6 md:p-10 bg-slate-50/50 border-t border-slate-100">
        <div className="max-w-4xl mx-auto space-y-6">
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
              placeholder="Ask anything..."
              className="w-full bg-white border-2 border-slate-200 rounded-[2.5rem] px-10 py-6 text-lg outline-none transition-all pr-32 font-medium shadow-2xl focus:border-indigo-500"
            />
            <button 
              onClick={handleSend}
              disabled={!input.trim() || isProcessing}
              className={`absolute right-4 top-4 bottom-4 px-10 rounded-[2rem] font-black uppercase tracking-widest text-[11px] shadow-xl flex items-center gap-2 transition-all active:scale-95 ${isProcessing ? 'bg-slate-200 text-slate-400' : 'bg-indigo-600 text-white hover:bg-indigo-700'}`}
            >
              {isProcessing ? 'Thinking' : 'Execute'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const ToolToggle = ({ active, onClick, icon, label, color = 'indigo' }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string; color?: string }) => {
  const activeClasses = {
    indigo: 'bg-indigo-600 border-indigo-600 text-white shadow-indigo-100',
    emerald: 'bg-emerald-600 border-emerald-600 text-white shadow-emerald-100',
    amber: 'bg-amber-600 border-amber-600 text-white shadow-amber-100',
  }[color];

  return (
    <button 
      onClick={onClick}
      className={`flex items-center gap-2 px-6 py-2 rounded-2xl border-2 transition-all font-black uppercase tracking-widest text-[8px] shadow-sm ${active ? activeClasses : 'bg-white border-slate-100 text-slate-400 hover:border-indigo-200'}`}
    >
      {icon}
      {label}
    </button>
  );
};

export default SalesGPT;
