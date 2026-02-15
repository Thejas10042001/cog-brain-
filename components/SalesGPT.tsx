
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
  const [isProcessing, setIsProcessing] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  useEffect(() => scrollToBottom(), [messages]);

  const handleSend = async () => {
    if (!input.trim() || isProcessing) return;
    const userMsg: GPTMessage = { id: Date.now().toString(), role: 'user', content: input, mode: 'standard' };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setIsProcessing(true);

    const assistantId = (Date.now() + 1).toString();
    setMessages(prev => [...prev, { id: assistantId, role: 'assistant', content: "", mode: 'standard', isStreaming: true }]);

    try {
      const docContext = activeDocuments.map(d => `FILE [${d.name}]:\n${d.content}`).join('\n\n');
      const stream = streamSalesGPT(input, [...messages, userMsg], docContext);
      let fullText = "";
      for await (const chunk of stream) {
        fullText += chunk;
        setMessages(prev => prev.map(m => m.id === assistantId ? { ...m, content: fullText } : m));
      }
      setMessages(prev => prev.map(m => m.id === assistantId ? { ...m, isStreaming: false } : m));
    } catch (error) {
      setMessages(prev => prev.map(m => m.id === assistantId ? { ...m, content: "Neural synchronization interrupted.", isStreaming: false } : m));
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="flex flex-col h-[75vh] bg-white rounded-[3rem] border border-slate-100 shadow-2xl overflow-hidden">
      <div className="p-8 border-b border-slate-50 flex items-center justify-between bg-slate-50/50">
        <div className="flex items-center gap-4">
          <div className="p-2 bg-red-600 text-white rounded-xl shadow-lg"><ICONS.Sparkles /></div>
          <div>
            <h3 className="text-lg font-black tracking-tight">Intelligence Studio</h3>
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Real-time Strategy Sync</p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-10 space-y-8 no-scrollbar">
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-center opacity-30 space-y-6">
            <ICONS.Brain className="w-16 h-16 text-slate-400" />
            <p className="text-sm font-bold uppercase tracking-[0.2em]">Awaiting Inquiries</p>
          </div>
        )}
        {messages.map((msg) => (
          <div key={msg.id} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
            <span className="text-[9px] font-black uppercase text-slate-400 mb-2 px-4 tracking-widest">
              {msg.role === 'user' ? 'Architect' : 'Cognitive Core'}
            </span>
            <div className={`
              max-w-[85%] p-6 rounded-[2rem] text-sm leading-relaxed shadow-sm
              ${msg.role === 'user' 
                ? 'bg-slate-900 text-white rounded-tr-none' 
                : 'bg-slate-50 text-slate-800 rounded-tl-none border border-slate-100'}
            `}>
              {msg.content || (msg.isStreaming && <div className="flex gap-1.5 py-1"><div className="w-1.5 h-1.5 bg-red-500 rounded-full animate-bounce" /><div className="w-1.5 h-1.5 bg-red-500 rounded-full animate-bounce delay-75" /><div className="w-1.5 h-1.5 bg-red-500 rounded-full animate-bounce delay-150" /></div>)}
            </div>
          </div>
        ))}
        <div ref={chatEndRef} />
      </div>

      <div className="p-8 bg-slate-50/50 border-t border-slate-50">
        <div className="relative group">
          <input 
            type="text" 
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Type your strategic inquiry..."
            className="w-full bg-white border border-slate-200 rounded-[1.5rem] px-8 py-5 text-sm outline-none focus:ring-4 focus:ring-red-500/10 focus:border-red-600 transition-all font-medium pr-32 shadow-inner"
          />
          <button 
            onClick={handleSend}
            disabled={!input.trim() || isProcessing}
            className="absolute right-3 top-3 bottom-3 px-8 bg-red-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg hover:bg-red-700 disabled:opacity-50 transition-all"
          >
            Synthesize
          </button>
        </div>
      </div>
    </div>
  );
};
