
import React, { useState, useRef, useEffect, FC } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
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

  const extractFieldFromPartialJson = (json: string, field: string): any => {
    try {
      // Handle simple string fields
      const fieldMarker = `"${field}": "`;
      const startIdx = json.indexOf(fieldMarker);
      if (startIdx !== -1) {
        const contentStart = startIdx + fieldMarker.length;
        let content = "";
        for (let i = contentStart; i < json.length; i++) {
          if (json[i] === '"' && (i === 0 || json[i-1] !== '\\')) {
            break;
          }
          content += json[i];
        }
        return content.replace(/\\n/g, '\n').replace(/\\"/g, '"');
      }

      // Handle object fields (very basic extraction)
      const objMarker = `"${field}": {`;
      const objStartIdx = json.indexOf(objMarker);
      if (objStartIdx !== -1) {
        const contentStart = objStartIdx + objMarker.length - 1; // include the {
        let balance = 0;
        let content = "";
        for (let i = contentStart; i < json.length; i++) {
          if (json[i] === '{') balance++;
          if (json[i] === '}') balance--;
          content += json[i];
          if (balance === 0) break;
        }
        try {
          return JSON.parse(content);
        } catch (e) {
          return null;
        }
      }
      
      return null;
    } catch (e) {
      return null;
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
          const partialProjection = extractFieldFromPartialJson(fullBuffer, "psychologicalProjection");
          const partialChain = extractFieldFromPartialJson(fullBuffer, "reasoningChain");
          
          if (partialAnswer || partialShot || partialProjection || partialChain) {
            let displayContent = "";
            
            if (partialShot) {
              displayContent += `> **STRATEGIC SHOT:** ${partialShot}\n\n`;
            }

            if (partialProjection) {
              displayContent += `### 🧠 Psychological Projection\n`;
              if (partialProjection.buyerFear) displayContent += `- **Buyer Fear:** ${partialProjection.buyerFear}\n`;
              if (partialProjection.buyerIncentive) displayContent += `- **Incentive:** ${partialProjection.buyerIncentive}\n`;
              if (partialProjection.strategicLever) displayContent += `- **Strategic Lever:** ${partialProjection.strategicLever}\n`;
              displayContent += `\n`;
            }

            if (partialAnswer) {
              displayContent += `### 🎯 Intelligence Synthesis\n${partialAnswer}\n\n`;
            }

            if (partialChain) {
              displayContent += `### ⛓️ Reasoning Chain\n`;
              if (partialChain.painPoint) displayContent += `- **Pain Point:** ${partialChain.painPoint}\n`;
              if (partialChain.capability) displayContent += `- **Capability:** ${partialChain.capability}\n`;
              if (partialChain.strategicValue) displayContent += `- **Strategic Value:** ${partialChain.strategicValue}\n`;
            }
            
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
    <div className="flex flex-col h-full bg-slate-950 relative overflow-hidden">
      {/* Header */}
      <div className="w-full bg-slate-950/80 backdrop-blur-xl border-b border-slate-800 z-20">
        <div className="max-w-5xl mx-auto px-12 py-8 flex items-center justify-between">
          <div className="flex items-center gap-6">
             <div className="p-4 bg-indigo-600 text-white rounded-2xl shadow-2xl">
                <ICONS.Brain className="w-8 h-8" />
             </div>
             <div>
                <h3 className="text-2xl font-black text-white tracking-tighter uppercase">Strategic Intelligence</h3>
                <p className="text-[11px] text-slate-500 font-black uppercase tracking-[0.4em]">Neural Sales Copilot v3.1</p>
             </div>
          </div>
          <div className="flex items-center gap-6">
             <motion.button 
               whileHover={{ scale: 1.05 }}
               whileTap={{ scale: 0.95 }}
               onClick={clearChat} 
               className="px-6 py-3 text-slate-500 hover:text-rose-400 text-[11px] font-black uppercase tracking-widest transition-colors"
             >
               Clear Memory
             </motion.button>
             <div className="flex items-center gap-3 px-6 py-3 bg-emerald-900/20 text-emerald-400 rounded-2xl border border-emerald-900/30 text-[10px] font-black uppercase tracking-widest shadow-sm">
                <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
                Neural Core Active
             </div>
          </div>
        </div>
      </div>

      {/* Conversation Area */}
      <div className="flex-1 overflow-y-auto custom-scrollbar relative">
        <div className="max-w-5xl mx-auto px-12 py-16 space-y-16">
          <AnimatePresence mode="popLayout">
            {messages.length === 0 ? (
              <motion.div 
                key="empty"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="h-[50vh] flex flex-col items-center justify-center text-center space-y-12"
              >
                 <div className="p-20 bg-slate-900 rounded-[6rem] shadow-none border border-slate-800 text-indigo-900 transform -rotate-2 relative">
                    <div className="absolute -top-10 -left-10 w-32 h-32 bg-indigo-600/10 rounded-full blur-3xl"></div>
                    <ICONS.Brain className="w-40 h-40 relative z-10" />
                 </div>
                 <div className="space-y-6">
                    <h4 className="text-7xl font-black text-slate-900 dark:text-white tracking-tighter uppercase leading-none">Neural Core<br/>Standby</h4>
                    <p className="text-slate-500 dark:text-slate-400 text-3xl font-medium leading-relaxed max-w-2xl mx-auto italic">
                      Intelligence core is synced with active document nodes. Awaiting strategic inquiry.
                    </p>
                 </div>
              </motion.div>
            ) : (
              messages.map((msg) => (
                <motion.div 
                  key={msg.id} 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
                >
                  <div className={`mb-4 px-8 flex items-center gap-4 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                    <span className={`text-[11px] font-black uppercase tracking-[0.4em] ${msg.role === 'user' ? 'text-indigo-500' : 'text-slate-400 dark:text-slate-500'}`}>
                       {msg.role === 'user' ? 'Strategic Architect' : 'Cognitive Core'}
                    </span>
                    {msg.isStreaming && (
                      <div className="flex gap-1.5">
                        <motion.div animate={{ scale: [1, 1.5, 1] }} transition={{ repeat: Infinity, duration: 1 }} className="w-1.5 h-1.5 bg-indigo-500 rounded-full"></motion.div>
                        <motion.div animate={{ scale: [1, 1.5, 1] }} transition={{ repeat: Infinity, duration: 1, delay: 0.2 }} className="w-1.5 h-1.5 bg-indigo-500 rounded-full"></motion.div>
                        <motion.div animate={{ scale: [1, 1.5, 1] }} transition={{ repeat: Infinity, duration: 1, delay: 0.4 }} className="w-1.5 h-1.5 bg-indigo-500 rounded-full"></motion.div>
                      </div>
                    )}
                  </div>
                  <div className={`
                    max-w-[85%] p-14 rounded-[4.5rem] text-3xl font-medium leading-relaxed shadow-none
                    ${msg.role === 'user' 
                      ? 'bg-indigo-900/20 text-white rounded-tr-none border-2 border-indigo-900/30' 
                      : 'bg-slate-900 text-slate-200 rounded-tl-none border border-slate-800'}
                  `}>
                    <div className="markdown-content">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {msg.content}
                      </ReactMarkdown>
                    </div>
                    {msg.imageUrl && (
                      <motion.div 
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="mt-12 rounded-[3.5rem] overflow-hidden border-[12px] border-slate-800 shadow-2xl group/img relative"
                      >
                        <img src={msg.imageUrl} alt="Strategic Asset" className="w-full h-auto object-cover" />
                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover/img:opacity-100 transition-all flex items-center justify-center backdrop-blur-md">
                           <motion.button 
                             whileHover={{ scale: 1.1 }}
                             whileTap={{ scale: 0.9 }}
                             onClick={() => downloadImage(msg.imageUrl!, 'StrategicAsset')}
                             className="px-10 py-5 bg-slate-900 text-white rounded-[2rem] font-black text-sm uppercase tracking-widest shadow-2xl hover:bg-indigo-600 transition-all flex items-center gap-4"
                           >
                             <ICONS.Efficiency className="w-6 h-6" /> Download Master
                           </motion.button>
                        </div>
                      </motion.div>
                    )}
                  </div>
                </motion.div>
              ))
            )}
          </AnimatePresence>
          <div ref={chatEndRef} className="h-32" />
        </div>
      </div>

      {/* Input Area */}
      <div className="w-full bg-slate-950/80 backdrop-blur-2xl border-t border-slate-800 z-20">
        <div className="max-w-5xl mx-auto px-12 py-12 space-y-8">
          <div className="flex flex-wrap gap-4 justify-center">
             <ToolToggle active={mode === 'standard'} onClick={() => setMode('standard')} icon={<ICONS.Chat className="w-5 h-5" />} label="Fast Pulse" />
             <ToolToggle active={mode === 'cognitive'} onClick={() => setMode('cognitive')} icon={<ICONS.Search className="w-5 h-5" />} label="Cognitive" />
             <ToolToggle active={mode === 'deep-study'} onClick={() => setMode('deep-study')} icon={<ICONS.Research className="w-5 h-5" />} label="Deep Study" color="amber" />
             <ToolToggle active={mode === 'pineapple'} onClick={() => setMode('pineapple')} icon={<ICONS.Pineapple className="w-5 h-5" />} label="Visual Logic" color="emerald" />
          </div>

          <div className="relative group">
            <input 
              type="text" 
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder="Type your strategic inquiry..."
              className="w-full bg-slate-900 border-4 border-slate-800 rounded-[3.5rem] px-16 py-12 text-3xl outline-none transition-all pr-64 font-bold italic shadow-2xl focus:border-indigo-400 placeholder:text-slate-700 text-white"
            />
            <motion.button 
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleSend}
              disabled={!input.trim() || isProcessing}
              className={`absolute right-8 top-8 bottom-8 px-16 rounded-[2.5rem] font-black uppercase tracking-[0.3em] text-sm shadow-2xl flex items-center gap-4 transition-all ${isProcessing ? 'bg-slate-800 text-slate-600' : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-900/40'}`}
            >
              {isProcessing ? 'Synthesizing' : 'Synthesize'}
            </motion.button>
          </div>
          
          <div className="flex items-center justify-between px-8">
             <motion.button 
               whileHover={{ x: 5 }}
               onClick={() => setIncludeContext(!includeContext)}
               className={`flex items-center gap-4 text-[11px] font-black uppercase tracking-[0.4em] transition-colors ${includeContext ? 'text-emerald-500' : 'text-slate-400 dark:text-slate-600'}`}
             >
                <div className={`w-2.5 h-2.5 rounded-full ${includeContext ? 'bg-emerald-500 animate-pulse shadow-[0_0_15px_rgba(16,185,129,0.6)]' : 'bg-slate-300 dark:bg-slate-700'}`}></div>
                Strategic Context Sync: {includeContext ? 'Active' : 'Offline'}
             </motion.button>
             <p className="text-[11px] font-black text-slate-300 dark:text-slate-700 uppercase tracking-[0.5em]">Intelligence Node v3.1 Grounded</p>
          </div>
        </div>
      </div>
    </div>
  );
};

const ToolToggle = ({ active, onClick, icon, label, color = 'indigo' }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string; color?: string }) => {
  const activeClasses = {
    indigo: 'bg-indigo-600 border-indigo-600 text-white shadow-2xl shadow-indigo-200 dark:shadow-indigo-900/40 scale-110',
    emerald: 'bg-emerald-600 border-emerald-600 text-white shadow-2xl shadow-emerald-200 dark:shadow-emerald-900/40 scale-110',
    amber: 'bg-amber-600 border-amber-600 text-white shadow-2xl shadow-amber-200 dark:shadow-amber-900/40 scale-110',
  }[color];

  return (
    <motion.button 
      whileHover={{ y: -4 }}
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
      className={`flex items-center gap-4 px-10 py-4 rounded-2xl border-2 transition-all font-black uppercase tracking-[0.2em] text-[11px] shadow-sm ${active ? activeClasses : 'bg-slate-900 border-slate-800 text-slate-500 hover:border-indigo-900/50 hover:text-slate-300'}`}
    >
      {icon}
      {label}
    </motion.button>
  );
};

export default SalesGPT;
