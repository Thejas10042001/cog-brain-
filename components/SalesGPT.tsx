
import React, { useState, useRef, useEffect, FC, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ICONS } from '../constants';
import { 
  streamSalesGPT, 
  generatePineappleImage, 
  streamDeepStudy, 
  performCognitiveSearchStream, 
  generateFollowUpQuestions 
} from '../services/geminiService';
import { saveSalesGPTSession, fetchSalesGPTSessions, deleteSalesGPTSession } from '../services/firebaseService';
import { GPTMessage, GPTToolMode, MeetingContext, Citation, SalesGPTSession } from '../types';
import { FileText, ExternalLink, X, MessageSquare, Plus, Trash2, Bell, History } from 'lucide-react';

interface SalesGPTProps {
  activeDocuments: { name: string; content: string }[];
  meetingContext: MeetingContext;
}

const TypingIndicator = () => (
  <div className="flex gap-4 items-center py-3 px-6 bg-slate-800/30 rounded-2xl border border-slate-700/50 w-fit">
    <div className="flex gap-2">
      <motion.div
        animate={{ scale: [1, 1.5, 1], opacity: [0.3, 1, 0.3] }}
        transition={{ repeat: Infinity, duration: 1.2, ease: "easeInOut" }}
        className="w-2 h-2 bg-indigo-500 rounded-full"
      />
      <motion.div
        animate={{ scale: [1, 1.5, 1], opacity: [0.3, 1, 0.3] }}
        transition={{ repeat: Infinity, duration: 1.2, ease: "easeInOut", delay: 0.2 }}
        className="w-2 h-2 bg-indigo-500 rounded-full"
      />
      <motion.div
        animate={{ scale: [1, 1.5, 1], opacity: [0.3, 1, 0.3] }}
        transition={{ repeat: Infinity, duration: 1.2, ease: "easeInOut", delay: 0.4 }}
        className="w-2 h-2 bg-indigo-500 rounded-full"
      />
    </div>
    <span className="text-[10px] font-black uppercase tracking-[0.3em] text-indigo-400 animate-pulse">Cognitive Analysis Active</span>
  </div>
);

export const SalesGPT: FC<SalesGPTProps> = ({ activeDocuments, meetingContext }) => {
  const [messages, setMessages] = useState<GPTMessage[]>([]);
  const [input, setInput] = useState("");
  const [mode, setMode] = useState<GPTToolMode>('standard');
  const [isProcessing, setIsProcessing] = useState(false);
  const [includeContext, setIncludeContext] = useState(true);
  const [selectedCitation, setSelectedCitation] = useState<Citation | null>(null);
  const [sessions, setSessions] = useState<SalesGPTSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [shouldAutoScroll, setShouldAutoScroll] = useState(true);
  const [showNotification, setShowNotification] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const playPing = useCallback(() => {
    try {
      const context = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(880, context.currentTime);
      gain.gain.setValueAtTime(0.1, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, context.currentTime + 0.5);
      oscillator.start();
      oscillator.stop(context.currentTime + 0.5);
    } catch (e) {
      console.warn("Audio feedback failed:", e);
    }
  }, []);

  const loadSessions = useCallback(async () => {
    const data = await fetchSalesGPTSessions();
    setSessions(data);
  }, []);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  const scrollToBottom = useCallback(() => {
    if (shouldAutoScroll) {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [shouldAutoScroll]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const handleScroll = () => {
    if (!scrollContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 50;
    setShouldAutoScroll(isAtBottom);
  };

  const createNewSession = () => {
    setMessages([]);
    setCurrentSessionId(null);
    setShouldAutoScroll(true);
  };

  const selectSession = (session: SalesGPTSession) => {
    setMessages(session.messages);
    setCurrentSessionId(session.id);
    setShouldAutoScroll(true);
  };

  const handleDeleteSession = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const success = await deleteSalesGPTSession(id);
    if (success) {
      if (currentSessionId === id) createNewSession();
      loadSessions();
    }
  };

  const autoSaveSession = async (updatedMessages: GPTMessage[]) => {
    if (updatedMessages.length === 0) return;
    
    const title = updatedMessages[0].content.slice(0, 30) + (updatedMessages[0].content.length > 30 ? "..." : "");
    const sessionId = await saveSalesGPTSession({
      id: currentSessionId || undefined,
      title,
      messages: updatedMessages
    });
    
    if (sessionId && !currentSessionId) {
      setCurrentSessionId(sessionId);
    }
    loadSessions();
  };

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

      // Handle object or array fields (very basic extraction)
      const objMarker = `"${field}": {`;
      const arrMarker = `"${field}": [`;
      const objStartIdx = json.indexOf(objMarker);
      const arrStartIdx = json.indexOf(arrMarker);
      
      const complexStartIdx = objStartIdx !== -1 ? objStartIdx : arrStartIdx;
      const marker = objStartIdx !== -1 ? objMarker : arrMarker;
      const openChar = objStartIdx !== -1 ? '{' : '[';
      const closeChar = objStartIdx !== -1 ? '}' : ']';

      if (complexStartIdx !== -1) {
        const contentStart = complexStartIdx + marker.length - 1; // include the { or [
        let balance = 0;
        let content = "";
        let inString = false;
        for (let i = contentStart; i < json.length; i++) {
          if (json[i] === '"' && (i === 0 || json[i-1] !== '\\')) inString = !inString;
          if (!inString) {
            if (json[i] === openChar) balance++;
            if (json[i] === closeChar) balance--;
          }
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

  const handleSend = async (overrideInput?: string) => {
    const messageText = overrideInput || input;
    if (!messageText.trim() || isProcessing) return;

    const currentHistory = [...messages];
    const userMessage: GPTMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: messageText,
      mode: mode,
    };

    setMessages(prev => [...prev, userMessage]);
    if (!overrideInput) setInput("");
    setIsProcessing(true);
    setShouldAutoScroll(true);

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

        // Notify user
        playPing();
        setShowNotification(true);
        setTimeout(() => setShowNotification(false), 3000);

        // Generate follow-up questions for pineapple mode
        const followUps = await generateFollowUpQuestions(imageUrl ? "Asset synthesized." : "Failed to synthesize asset.", currentHistory, contextStr);
        setMessages(prev => {
          const updated = prev.map(m => 
            m.id === assistantId ? { ...m, followUpQuestions: followUps } : m
          );
          autoSaveSession(updated);
          return updated;
        });
      } else if (mode === 'deep-study') {
        const stream = streamDeepStudy(input, currentHistory, contextStr);
        let fullBuffer = "";
        for await (const chunk of stream) {
          fullBuffer += chunk;
          const partialAnswer = extractFieldFromPartialJson(fullBuffer, "answer");
          const partialCitations = extractFieldFromPartialJson(fullBuffer, "citations");
          
          setMessages(prev => prev.map(m => 
            m.id === assistantId ? { 
              ...m, 
              content: partialAnswer || (fullBuffer.startsWith('{') ? "" : fullBuffer),
              citations: partialCitations || undefined
            } : m
          ));
        }
        setMessages(prev => prev.map(m => m.id === assistantId ? { ...m, isStreaming: false } : m));
        
        // Notify user
        playPing();
        setShowNotification(true);
        setTimeout(() => setShowNotification(false), 3000);

        // Generate follow-up questions
        const finalContent = extractFieldFromPartialJson(fullBuffer, "answer") || fullBuffer;
        const followUps = await generateFollowUpQuestions(finalContent, currentHistory, contextStr);
        setMessages(prev => {
          const updated = prev.map(m => 
            m.id === assistantId ? { ...m, followUpQuestions: followUps } : m
          );
          autoSaveSession(updated);
          return updated;
        });
      } else if (mode === 'cognitive') {
        const stream = performCognitiveSearchStream(input, docContext, meetingContext);
        let fullBuffer = "";
        for await (const chunk of stream) {
          fullBuffer += chunk;
          const partialAnswer = extractFieldFromPartialJson(fullBuffer, "answer");
          const partialShot = extractFieldFromPartialJson(fullBuffer, "cognitiveShot");
          const partialProjection = extractFieldFromPartialJson(fullBuffer, "psychologicalProjection");
          const partialChain = extractFieldFromPartialJson(fullBuffer, "reasoningChain");
          const partialCitations = extractFieldFromPartialJson(fullBuffer, "citations");
          
          if (partialAnswer || partialShot || partialProjection || partialChain || partialCitations) {
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
              m.id === assistantId ? { 
                ...m, 
                content: displayContent,
                citations: partialCitations || undefined
              } : m
            ));
          }
        }
        setMessages(prev => prev.map(m => m.id === assistantId ? { ...m, isStreaming: false } : m));

        // Notify user
        playPing();
        setShowNotification(true);
        setTimeout(() => setShowNotification(false), 3000);

        // Generate follow-up questions for cognitive mode
        // We need to reconstruct the final display content or use fullBuffer
        const finalAnswer = extractFieldFromPartialJson(fullBuffer, "answer");
        const finalShot = extractFieldFromPartialJson(fullBuffer, "cognitiveShot");
        const finalProjection = extractFieldFromPartialJson(fullBuffer, "psychologicalProjection");
        const finalChain = extractFieldFromPartialJson(fullBuffer, "reasoningChain");
        const finalCitations = extractFieldFromPartialJson(fullBuffer, "citations");
        
        let finalDisplayContent = "";
        if (finalShot) finalDisplayContent += `> **STRATEGIC SHOT:** ${finalShot}\n\n`;
        if (finalProjection) {
          finalDisplayContent += `### 🧠 Psychological Projection\n`;
          if (finalProjection.buyerFear) finalDisplayContent += `- **Buyer Fear:** ${finalProjection.buyerFear}\n`;
          if (finalProjection.buyerIncentive) finalDisplayContent += `- **Incentive:** ${finalProjection.buyerIncentive}\n`;
          if (finalProjection.strategicLever) finalDisplayContent += `- **Strategic Lever:** ${finalProjection.strategicLever}\n`;
          finalDisplayContent += `\n`;
        }
        if (finalAnswer) finalDisplayContent += `### 🎯 Intelligence Synthesis\n${finalAnswer}\n\n`;
        if (finalChain) {
          finalDisplayContent += `### ⛓️ Reasoning Chain\n`;
          if (finalChain.painPoint) finalDisplayContent += `- **Pain Point:** ${finalChain.painPoint}\n`;
          if (finalChain.capability) finalDisplayContent += `- **Capability:** ${finalChain.capability}\n`;
          if (finalChain.strategicValue) finalDisplayContent += `- **Strategic Value:** ${finalChain.strategicValue}\n`;
        }

        const followUps = await generateFollowUpQuestions(finalDisplayContent, currentHistory, contextStr);
        setMessages(prev => {
          const updated = prev.map(m => 
            m.id === assistantId ? { 
              ...m, 
              followUpQuestions: followUps,
              citations: finalCitations || undefined
            } : m
          );
          autoSaveSession(updated);
          return updated;
        });
      } else {
        const stream = streamSalesGPT(input, currentHistory, contextStr);
        let fullBuffer = "";
        for await (const chunk of stream) {
          fullBuffer += chunk;
          const partialAnswer = extractFieldFromPartialJson(fullBuffer, "answer");
          const partialReasoning = extractFieldFromPartialJson(fullBuffer, "reasoning");
          const partialCitations = extractFieldFromPartialJson(fullBuffer, "citations");

          let displayContent = "";
          if (partialReasoning) displayContent += `> **STRATEGIC REASONING:** ${partialReasoning}\n\n`;
          if (partialAnswer) displayContent += partialAnswer;

          setMessages(prev => prev.map(m => 
            m.id === assistantId ? { 
              ...m, 
              content: displayContent || (fullBuffer.startsWith('{') ? "" : fullBuffer),
              citations: partialCitations || undefined
            } : m
          ));
        }
        setMessages(prev => prev.map(m => m.id === assistantId ? { ...m, isStreaming: false } : m));
        
        // Notify user
        playPing();
        setShowNotification(true);
        setTimeout(() => setShowNotification(false), 3000);

        // Generate follow-up questions for standard mode
        const finalAnswer = extractFieldFromPartialJson(fullBuffer, "answer");
        const finalReasoning = extractFieldFromPartialJson(fullBuffer, "reasoning");
        const finalContent = finalReasoning ? `> **STRATEGIC REASONING:** ${finalReasoning}\n\n${finalAnswer || ""}` : (finalAnswer || fullBuffer);
        const followUps = await generateFollowUpQuestions(finalContent, currentHistory, contextStr);
        setMessages(prev => {
          const updated = prev.map(m => 
            m.id === assistantId ? { ...m, followUpQuestions: followUps } : m
          );
          autoSaveSession(updated);
          return updated;
        });
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
    setCurrentSessionId(null);
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
    <div className="flex h-full bg-slate-950 relative overflow-hidden">
      {/* Sidebar */}
      <aside className="w-80 border-r border-slate-800/50 bg-slate-900/30 flex flex-col z-30">
        <div className="p-6 border-b border-slate-800/50">
          <button 
            onClick={createNewSession}
            className="w-full py-4 px-6 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-3 transition-all shadow-lg shadow-indigo-900/20 active:scale-95"
          >
            <Plus className="w-4 h-4" /> New Strategic Session
          </button>
        </div>
        <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-2">
          <p className="text-[9px] font-black text-slate-500 uppercase tracking-[0.4em] mb-4 ml-2">Recent Intelligence (15d)</p>
          {sessions.map((session) => (
            <div 
              key={session.id}
              onClick={() => selectSession(session)}
              className={`group p-4 rounded-2xl cursor-pointer transition-all border flex items-start justify-between gap-3 ${
                currentSessionId === session.id 
                ? 'bg-indigo-500/10 border-indigo-500/30 text-indigo-400' 
                : 'bg-transparent border-transparent hover:bg-slate-800/50 text-slate-400'
              }`}
            >
              <div className="flex items-start gap-3 flex-1 min-w-0">
                <MessageSquare className={`w-4 h-4 mt-1 flex-shrink-0 ${currentSessionId === session.id ? 'text-indigo-400' : 'text-slate-600'}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate leading-tight">{session.title}</p>
                  <p className="text-[9px] font-black uppercase tracking-widest mt-1 opacity-50">
                    {new Date(session.timestamp).toLocaleDateString()}
                  </p>
                </div>
              </div>
              <button 
                onClick={(e) => handleDeleteSession(e, session.id)}
                className="opacity-0 group-hover:opacity-100 p-2 hover:text-rose-400 transition-all"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
          {sessions.length === 0 && (
            <div className="py-12 text-center space-y-4">
              <div className="w-12 h-12 bg-slate-800/50 rounded-full flex items-center justify-center mx-auto">
                <History className="w-6 h-6 text-slate-600" />
              </div>
              <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest">No Recent Sessions</p>
            </div>
          )}
        </div>
      </aside>

      <div className="flex-1 flex flex-col relative overflow-hidden">
        {/* Notification Toast */}
        <AnimatePresence>
          {showNotification && (
            <motion.div 
              initial={{ opacity: 0, y: -20, x: '-50%' }}
              animate={{ opacity: 1, y: 0, x: '-50%' }}
              exit={{ opacity: 0, y: -20, x: '-50%' }}
              className="fixed top-24 left-1/2 z-50 px-6 py-3 bg-indigo-600 text-white rounded-2xl shadow-2xl flex items-center gap-3 border border-indigo-500"
            >
              <Bell className="w-4 h-4 animate-bounce" />
              <span className="text-[10px] font-black uppercase tracking-widest">Strategic Analysis Complete</span>
            </motion.div>
          )}
        </AnimatePresence>

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
        <div 
          ref={scrollContainerRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto custom-scrollbar relative"
        >
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
                    <div className="flex items-center gap-3">
                      <span className={`text-[11px] font-black uppercase tracking-[0.4em] ${msg.role === 'user' ? 'text-indigo-500' : 'text-slate-400 dark:text-slate-500'}`}>
                        {msg.role === 'user' ? 'Strategic Architect' : 'Cognitive Core'}
                      </span>
                      {msg.role === 'assistant' && (
                        <div className={`flex items-center gap-2 px-3 py-1 rounded-full border text-[9px] font-black uppercase tracking-widest ${
                          msg.mode === 'standard' ? 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400' :
                          msg.mode === 'cognitive' ? 'bg-blue-500/10 border-blue-500/20 text-blue-400' :
                          msg.mode === 'deep-study' ? 'bg-amber-500/10 border-amber-500/20 text-amber-400' :
                          'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                        }`}>
                          {msg.mode === 'standard' && <ICONS.Chat className="w-3 h-3" />}
                          {msg.mode === 'cognitive' && <ICONS.Search className="w-3 h-3" />}
                          {msg.mode === 'deep-study' && <ICONS.Research className="w-3 h-3" />}
                          {msg.mode === 'pineapple' && <ICONS.Pineapple className="w-3 h-3" />}
                          <span>
                            {msg.mode === 'standard' ? 'Fast Pulse' : 
                             msg.mode === 'cognitive' ? 'Cognitive' : 
                             msg.mode === 'deep-study' ? 'Deep Study' : 
                             'Visual Logic'}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className={`
                    max-w-[90%] p-8 rounded-[2.5rem] text-lg font-medium leading-relaxed shadow-lg
                    ${msg.role === 'user' 
                      ? 'bg-indigo-600 text-white rounded-tr-none border border-indigo-500 shadow-indigo-900/20' 
                      : 'bg-slate-900 text-slate-200 rounded-tl-none border border-slate-800 shadow-black/40'}
                  `}>
                    <div className="markdown-content">
                      {msg.content ? (
                        <ReactMarkdown 
                          remarkPlugins={[remarkGfm]}
                          components={{
                            a: ({ node, ...props }) => {
                              if (props.href?.startsWith('citation:')) {
                                const index = parseInt(props.href.split(':')[1]) - 1;
                                return (
                                  <sup 
                                    className="cursor-pointer text-indigo-400 hover:text-indigo-300 font-black px-1.5 py-0.5 bg-indigo-500/10 rounded-md border border-indigo-500/20 mx-0.5 transition-all hover:scale-110 inline-block align-top text-[10px]"
                                    onClick={(e) => {
                                      e.preventDefault();
                                      const citation = msg.citations?.[index];
                                      if (citation) setSelectedCitation(citation);
                                    }}
                                  >
                                    {index + 1}
                                  </sup>
                                );
                              }
                              return <a {...props} className="text-indigo-400 hover:underline" target="_blank" rel="noopener noreferrer" />;
                            }
                          }}
                        >
                          {msg.content}
                        </ReactMarkdown>
                      ) : msg.isStreaming ? (
                        <TypingIndicator />
                      ) : null}
                    </div>
                    {msg.imageUrl && (
                      <motion.div 
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="mt-8 rounded-3xl overflow-hidden border-4 border-slate-800 shadow-2xl group/img relative"
                      >
                        <img src={msg.imageUrl} alt="Strategic Asset" className="w-full h-auto object-cover" />
                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover/img:opacity-100 transition-all flex items-center justify-center backdrop-blur-md">
                           <motion.button 
                             whileHover={{ scale: 1.1 }}
                             whileTap={{ scale: 0.9 }}
                             onClick={() => downloadImage(msg.imageUrl!, 'StrategicAsset')}
                             className="px-8 py-4 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-2xl hover:bg-indigo-600 transition-all flex items-center gap-3"
                           >
                             <ICONS.Efficiency className="w-5 h-5" /> Download Master
                           </motion.button>
                        </div>
                      </motion.div>
                    )}
                    
                    {msg.citations && msg.citations.length > 0 && (
                      <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="mt-8 pt-8 border-t border-white/10"
                      >
                        <div className="flex items-center gap-3 mb-4 text-[10px] uppercase tracking-[0.3em] text-slate-500 font-black">
                          <FileText className="w-4 h-4" />
                          <span>Referenced Intelligence</span>
                        </div>
                        <div className="flex flex-wrap gap-3">
                          {msg.citations.map((citation, idx) => (
                            <button
                              key={idx}
                              onClick={() => setSelectedCitation(citation)}
                              className="flex items-center gap-3 px-4 py-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all text-sm text-slate-300 group"
                            >
                              <div className="w-6 h-6 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-400 font-black text-[10px]">
                                {idx + 1}
                              </div>
                              <span className="truncate max-w-[150px]">{citation.sourceFile}</span>
                              {citation.pageNumber && <span className="text-slate-600 font-black text-[10px]">p.{citation.pageNumber}</span>}
                              <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-all" />
                            </button>
                          ))}
                        </div>
                      </motion.div>
                    )}
                    
                    {msg.followUpQuestions && msg.followUpQuestions.length > 0 && (
                      <motion.div 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mt-8 pt-8 border-t border-white/10"
                      >
                        <div className="flex items-center gap-3 mb-4 text-[10px] uppercase tracking-[0.3em] text-indigo-500 font-black">
                          <ICONS.Research className="w-4 h-4" />
                          <span>Strategic Explorations</span>
                        </div>
                        <div className="flex flex-col gap-2">
                          {msg.followUpQuestions.map((q, idx) => (
                            <motion.button
                              key={idx}
                              whileHover={{ x: 5, backgroundColor: 'rgba(79, 70, 229, 0.1)' }}
                              whileTap={{ scale: 0.99 }}
                              onClick={() => handleSend(q)}
                              className="px-6 py-4 bg-slate-800/30 border border-slate-700/50 rounded-2xl text-base text-slate-300 hover:text-indigo-300 transition-all text-left flex items-center justify-between group"
                            >
                              <span>{q}</span>
                              <ICONS.Chat className="w-5 h-5 opacity-0 group-hover:opacity-100 transition-all text-indigo-500" />
                            </motion.button>
                          ))}
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
        <div className="max-w-5xl mx-auto px-12 py-8 space-y-6">
          <div className="flex flex-wrap gap-3 justify-center">
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
              className="w-full bg-slate-900 border-2 border-slate-800 rounded-3xl px-10 py-6 text-xl outline-none transition-all pr-48 font-medium shadow-2xl focus:border-indigo-500 placeholder:text-slate-700 text-white"
            />
            <motion.button 
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => handleSend()}
              disabled={!input.trim() || isProcessing}
              className={`absolute right-4 top-4 bottom-4 px-10 rounded-2xl font-black uppercase tracking-[0.2em] text-[10px] shadow-2xl flex items-center gap-3 transition-all ${isProcessing ? 'bg-slate-800 text-slate-600' : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-900/40'}`}
            >
              {isProcessing ? 'Synthesizing' : 'Synthesize'}
            </motion.button>
          </div>
          
          <div className="flex items-center justify-between px-4">
             <motion.button 
               whileHover={{ x: 5 }}
               onClick={() => setIncludeContext(!includeContext)}
               className={`flex items-center gap-3 text-[10px] font-black uppercase tracking-[0.3em] transition-colors ${includeContext ? 'text-emerald-500' : 'text-slate-400 dark:text-slate-600'}`}
             >
                <div className={`w-2 h-2 rounded-full ${includeContext ? 'bg-emerald-500 animate-pulse shadow-[0_0_10px_rgba(16,185,129,0.6)]' : 'bg-slate-300 dark:bg-slate-700'}`}></div>
                Strategic Context Sync: {includeContext ? 'Active' : 'Offline'}
             </motion.button>
             <p className="text-[10px] font-black text-slate-300 dark:text-slate-700 uppercase tracking-[0.4em]">Intelligence Node v3.1 Grounded</p>
          </div>
        </div>
      </div>
      {/* Citation Modal */}
      <AnimatePresence>
        {selectedCitation && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
            onClick={() => setSelectedCitation(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="bg-[#141414] border border-white/10 rounded-xl w-full max-w-2xl overflow-hidden shadow-2xl"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between p-4 border-b border-white/10 bg-white/5">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded bg-white/10 flex items-center justify-center">
                    <FileText className="w-4 h-4 text-white/70" />
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-white">{selectedCitation.sourceFile}</h3>
                    {selectedCitation.pageNumber && (
                      <p className="text-[10px] text-white/40 uppercase tracking-tighter">Page {selectedCitation.pageNumber}</p>
                    )}
                  </div>
                </div>
                <button 
                  onClick={() => setSelectedCitation(null)}
                  className="p-2 hover:bg-white/10 rounded-full transition-colors"
                >
                  <X className="w-5 h-5 text-white/40" />
                </button>
              </div>
              <div className="p-6 max-h-[60vh] overflow-y-auto">
                <div className="text-[10px] uppercase tracking-widest text-white/30 mb-3 font-mono">Contextual Snippet</div>
                <div className="text-sm text-white/80 leading-relaxed italic border-l-2 border-white/20 pl-4 py-1">
                  "{selectedCitation.snippet}"
                </div>
              </div>
              <div className="p-4 border-t border-white/10 bg-white/5 flex justify-end">
                <button
                  onClick={() => setSelectedCitation(null)}
                  className="px-4 py-2 bg-white text-black text-xs font-bold rounded hover:bg-white/90 transition-colors uppercase tracking-widest"
                >
                  Close Intelligence
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
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
