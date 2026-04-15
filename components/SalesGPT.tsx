
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
  generateFollowUpQuestions,
  streamNormalChat,
  streamCognitivePro,
  recommendAndValidateStyles
} from '../services/geminiService';
import { 
  saveSalesGPTSession, 
  fetchSalesGPTSessions, 
  deleteSalesGPTSession,
  fetchSharedGPTSession,
  auth
} from '../services/firebaseService';
import { GPTMessage, GPTToolMode, MeetingContext, Citation, SalesGPTSession } from '../types';
import { FileText, ExternalLink, X, MessageSquare, Plus, Trash2, Bell, History, Share2, Send, LogOut, Check, XCircle } from 'lucide-react';

interface SalesGPTProps {
  activeDocuments: { name: string; content: string }[];
  meetingContext: MeetingContext;
  initialConversationId?: string | null;
  sharedSession?: SalesGPTSession | null;
}

const TypingIndicator = () => (
  <div className="flex gap-4 items-center py-3 px-6 bg-white/5 rounded-2xl border border-white/5 w-fit">
    <div className="flex gap-2">
      <motion.div
        animate={{ scale: [1, 1.5, 1], opacity: [0.3, 1, 0.3] }}
        transition={{ repeat: Infinity, duration: 1.2, ease: "easeInOut" }}
        className="w-2 h-2 bg-brand-primary rounded-full"
      />
      <motion.div
        animate={{ scale: [1, 1.5, 1], opacity: [0.3, 1, 0.3] }}
        transition={{ repeat: Infinity, duration: 1.2, ease: "easeInOut", delay: 0.2 }}
        className="w-2 h-2 bg-brand-primary rounded-full"
      />
      <motion.div
        animate={{ scale: [1, 1.5, 1], opacity: [0.3, 1, 0.3] }}
        transition={{ repeat: Infinity, duration: 1.2, ease: "easeInOut", delay: 0.4 }}
        className="w-2 h-2 bg-brand-primary rounded-full"
      />
    </div>
    <span className="text-[10px] font-black uppercase tracking-[0.3em] text-brand-primary animate-pulse">Cognitive Analysis Active</span>
  </div>
);

const COGNITIVE_PRO_OPTIONS = [
  "Psychological Projection", "Executive Summary", "Analogy Based", "Data-Driven Insights",
  "Concise Answer", "In-Depth Response", "Answer in Points", "Define Technical Terms",
  "Sales Points", "Key Statistics", "Case Study Summary", "Competitive Comparison",
  "Anticipated Customer Questions", "Information Gap", "Pricing Overview", "ROI Forecast",
  "SWOT Analysis", "Strategic Roadmap", "Risk Assessment", "Implementation Timeline",
  "Technical Deep-Dive", "Value Proposition", "Financial Justification", "Stakeholder Alignment",
  "Competitive Wedge", "Success Story Summary", "Buying Fear Mitigation", "Security & Compliance",
  "Decision Matrix", "Reasoning Chain"
];

export const SalesGPT: FC<SalesGPTProps> = ({ activeDocuments, meetingContext, initialConversationId, sharedSession }) => {
  const [messages, setMessages] = useState<GPTMessage[]>([]);
  const [input, setInput] = useState("");
  const [mode, setMode] = useState<GPTToolMode>('standard');
  const [isProcessing, setIsProcessing] = useState(false);
  const [includeContext, setIncludeContext] = useState(true);
  const [selectedCitation, setSelectedCitation] = useState<Citation | null>(null);
  const [sessions, setSessions] = useState<SalesGPTSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(initialConversationId || null);
  const [shouldAutoScroll, setShouldAutoScroll] = useState(true);
  const [showNotification, setShowNotification] = useState(false);
  const [notificationMessage, setNotificationMessage] = useState("Strategic Analysis Complete");
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareLink, setShareLink] = useState("");
  const [showCognitiveProModal, setShowCognitiveProModal] = useState(false);
  const [pendingInput, setPendingInput] = useState<string | null>(null);
  const [selectedStyles, setSelectedStyles] = useState<string[]>([]);
  const [isValidatingStyles, setIsValidatingStyles] = useState(false);
  const [styleValidation, setStyleValidation] = useState<{ [style: string]: { isValid: boolean, reason?: string } }>({});
  const [isConsoleMode, setIsConsoleMode] = useState(false);
  
  const chatEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('console') === 'true' || window.location.pathname === '/salesgpt-console') {
      setIsConsoleMode(true);
    }
  }, []);

  useEffect(() => {
    if (sharedSession) {
      setMessages(sharedSession.messages);
      setCurrentSessionId(sharedSession.id);
    }
  }, [sharedSession]);

  useEffect(() => {
    if (initialConversationId && sessions.length > 0) {
      const session = sessions.find(s => s.id === initialConversationId);
      if (session) {
        setMessages(session.messages);
        setCurrentSessionId(session.id);
      }
    }
  }, [initialConversationId, sessions]);

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

  const toggleStyle = async (option: string) => {
    const isSelected = selectedStyles.includes(option);
    let newStyles: string[];
    if (isSelected) {
      newStyles = selectedStyles.filter(s => s !== option);
    } else {
      newStyles = [...selectedStyles, option];
    }
    setSelectedStyles(newStyles);
    
    // Re-validate
    if (pendingInput) {
      setIsValidatingStyles(true);
      try {
        const result = await recommendAndValidateStyles(pendingInput, messages, newStyles, COGNITIVE_PRO_OPTIONS);
        setStyleValidation(result.validation);
      } catch (err) {
        console.error("Validation failed", err);
      } finally {
        setIsValidatingStyles(false);
      }
    }
  };

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

  const handleRegenerate = async (messageId: string) => {
    const messageIndex = messages.findIndex(m => m.id === messageId);
    if (messageIndex === -1 || messageIndex === 0) return;
    
    const userMessage = messages[messageIndex - 1];
    if (userMessage.role !== 'user') return;

    // Remove the assistant message and everything after it
    const newMessages = messages.slice(0, messageIndex);
    setMessages(newMessages);
    
    // Trigger handleSend with the user's message content and existing styles
    handleSend(userMessage.content, userMessage.selectedStyles);
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setNotificationMessage("Copied to clipboard");
    setShowNotification(true);
    setTimeout(() => setShowNotification(false), 2000);
  };

  const selectSession = (session: SalesGPTSession) => {
    setMessages(session.messages);
    setCurrentSessionId(session.id);
    setShouldAutoScroll(true);
  };

  const handleShareChat = async () => {
    if (!currentSessionId || !auth.currentUser) {
      alert("Please sign in to share this chat.");
      return;
    }
    const session = sessions.find(s => s.id === currentSessionId);
    if (!session) return;

    const shareToken = session.shareToken || Math.random().toString(36).substring(2, 15);
    await saveSalesGPTSession({
      ...session,
      isShared: true,
      shareToken
    });
    
    const url = `${window.location.origin}/share/chat/${currentSessionId}?sharedUserId=${auth.currentUser.uid}`;
    setShareLink(url);
    setShowShareModal(true);
    loadSessions();
  };

  const openInNewTab = () => {
    if (!currentSessionId) return;
    window.open(`${window.location.origin}/salesgpt-console?conversationId=${currentSessionId}`, '_blank');
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

  const handleSend = async (overrideInput?: string, overrideStyles?: string[]) => {
    const messageText = overrideInput || pendingInput || input;
    if (!messageText.trim() || isProcessing) return;

    if (mode === 'cognitive-pro' && !overrideStyles) {
      setPendingInput(messageText);
      setShowCognitiveProModal(true);
      setIsValidatingStyles(true);
      setStyleValidation({});
      
      // Fetch initial recommendations
      recommendAndValidateStyles(messageText, messages, [], COGNITIVE_PRO_OPTIONS)
        .then(result => {
          setSelectedStyles(result.recommendedStyles);
          setStyleValidation(result.validation);
        })
        .catch(err => console.error("Failed to get style recommendations", err))
        .finally(() => setIsValidatingStyles(false));
      return;
    }

    const currentStyles = overrideStyles || selectedStyles;
    const currentHistory = [...messages];
    const userMessage: GPTMessage = {
      id: `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      role: 'user',
      content: messageText,
      mode: mode,
      selectedStyles: mode === 'cognitive-pro' ? currentStyles : undefined,
      timestamp: new Date().toISOString(),
    };

    setMessages(prev => [...prev, userMessage]);
    if (!overrideInput) setInput("");
    setPendingInput(null);
    setIsProcessing(true);
    setShouldAutoScroll(true);

    const assistantId = `asst-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const assistantMessage: GPTMessage = {
      id: assistantId,
      role: 'assistant',
      content: "",
      mode: mode,
      isStreaming: mode !== 'pineapple',
      selectedStyles: mode === 'cognitive-pro' ? currentStyles : undefined,
      timestamp: new Date().toISOString(),
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
        const imageUrl = await generatePineappleImage(messageText);
        if (!imageUrl) throw new Error("Generation failed");
        
        setMessages(prev => prev.map(m => 
          m.id === assistantId ? { ...m, content: "Asset synthesized:", imageUrl: imageUrl, isStreaming: false } : m
        ));

        playPing();
        setNotificationMessage("Strategic Asset Synthesized");
        setShowNotification(true);
        setTimeout(() => setShowNotification(false), 3000);

        const followUps = await generateFollowUpQuestions("Asset synthesized.", currentHistory, contextStr);
        setMessages(prev => {
          const updated = prev.map(m => 
            m.id === assistantId ? { ...m, followUpQuestions: followUps } : m
          );
          autoSaveSession(updated);
          return updated;
        });
      } else if (mode === 'deep-study') {
        const stream = streamDeepStudy(messageText, currentHistory, contextStr);
        let fullBuffer = "";
        let hasContent = false;
        for await (const chunk of stream) {
          fullBuffer += chunk;
          const partialAnswer = extractFieldFromPartialJson(fullBuffer, "answer");
          const partialCitations = extractFieldFromPartialJson(fullBuffer, "citations");
          
          if (partialAnswer) hasContent = true;

          setMessages(prev => prev.map(m => 
            m.id === assistantId ? { 
              ...m, 
              content: partialAnswer || (fullBuffer.startsWith('{') ? "" : fullBuffer),
              citations: partialCitations || undefined
            } : m
          ));
        }

        if (!hasContent && !fullBuffer) throw new Error("Empty response");

        setMessages(prev => prev.map(m => m.id === assistantId ? { ...m, isStreaming: false } : m));
        
        playPing();
        setNotificationMessage("Deep Study Analysis Complete");
        setShowNotification(true);
        setTimeout(() => setShowNotification(false), 3000);

        const finalContent = extractFieldFromPartialJson(fullBuffer, "answer") || fullBuffer;
        const followUps = await generateFollowUpQuestions(finalContent, currentHistory, contextStr);
        setMessages(prev => {
          const updated = prev.map(m => 
            m.id === assistantId ? { ...m, followUpQuestions: followUps } : m
          );
          autoSaveSession(updated);
          return updated;
        });
      } else if (mode === 'cognitive-pro') {
        const stream = streamCognitivePro(messageText, currentHistory, currentStyles, contextStr);
        let fullBuffer = "";
        let hasContent = false;
        for await (const chunk of stream) {
          fullBuffer += chunk;
          const partialAnswer = extractFieldFromPartialJson(fullBuffer, "answer");
          const partialReasoning = extractFieldFromPartialJson(fullBuffer, "reasoning");
          const partialCitations = extractFieldFromPartialJson(fullBuffer, "citations");

          if (partialAnswer) hasContent = true;

          let displayContent = "";
          if (partialReasoning) displayContent += `> **COGNITIVE PRO REASONING:** ${partialReasoning}\n\n`;
          if (partialAnswer) displayContent += partialAnswer;

          setMessages(prev => prev.map(m => 
            m.id === assistantId ? { 
              ...m, 
              content: displayContent || (fullBuffer.startsWith('{') ? "" : fullBuffer),
              citations: partialCitations || undefined
            } : m
          ));
        }

        if (!hasContent && !fullBuffer) throw new Error("Empty response");

        setMessages(prev => prev.map(m => m.id === assistantId ? { ...m, isStreaming: false } : m));
        
        playPing();
        setNotificationMessage("Cognitive Pro Analysis Complete");
        setShowNotification(true);
        setTimeout(() => setShowNotification(false), 3000);

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
        const stream = performCognitiveSearchStream(messageText, docContext, meetingContext);
        let fullBuffer = "";
        let hasContent = false;
        for await (const chunk of stream) {
          fullBuffer += chunk;
          const partialAnswer = extractFieldFromPartialJson(fullBuffer, "answer");
          const partialShot = extractFieldFromPartialJson(fullBuffer, "cognitiveShot");
          const partialProjection = extractFieldFromPartialJson(fullBuffer, "psychologicalProjection");
          const partialChain = extractFieldFromPartialJson(fullBuffer, "reasoningChain");
          const partialCitations = extractFieldFromPartialJson(fullBuffer, "citations");
          
          if (partialAnswer) hasContent = true;

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

        if (!hasContent && !fullBuffer) throw new Error("Empty response");

        setMessages(prev => prev.map(m => m.id === assistantId ? { ...m, isStreaming: false } : m));

        // Notify user
        playPing();
        setNotificationMessage("Cognitive Analysis Complete");
        setShowNotification(true);
        setTimeout(() => setShowNotification(false), 3000);

        // Generate follow-up questions for cognitive mode
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
        const stream = streamSalesGPT(messageText, currentHistory, contextStr);
        let fullBuffer = "";
        let hasContent = false;
        for await (const chunk of stream) {
          fullBuffer += chunk;
          const partialAnswer = extractFieldFromPartialJson(fullBuffer, "answer");
          const partialReasoning = extractFieldFromPartialJson(fullBuffer, "reasoning");
          const partialCitations = extractFieldFromPartialJson(fullBuffer, "citations");

          if (partialAnswer) hasContent = true;

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

        if (!hasContent && !fullBuffer) throw new Error("Empty response");

        setMessages(prev => prev.map(m => m.id === assistantId ? { ...m, isStreaming: false } : m));
        
        // Notify user
        playPing();
        setNotificationMessage("Strategic Analysis Complete");
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
        m.id === assistantId ? { 
          ...m, 
          content: "Neural link severed. Generation failed. Please retry.", 
          isStreaming: false,
          isError: true 
        } : m
      ));
      setNotificationMessage("Generation Failed");
      setShowNotification(true);
      setTimeout(() => setShowNotification(false), 3000);
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

  const preprocessContent = (content: string) => {
    if (!content) return "";
    // Convert [1] to [1](citation:1) if it's not already a link
    // This regex looks for [number] that is NOT followed by an opening parenthesis
    return content.replace(/\[(\d+)\](?!\()/g, '[$1](citation:$1)');
  };

  return (
    <div className="flex h-full bg-slate-950 relative overflow-hidden">
      {/* Sidebar */}
      <aside className="w-80 border-r border-white/5 bg-neural-900/30 flex flex-col z-30">
        <div className="p-6 border-b border-white/5 space-y-3">
          <button 
            onClick={createNewSession}
            className="w-full py-4 px-6 bg-brand-primary hover:bg-indigo-500 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-3 transition-all shadow-lg shadow-brand-primary/20 active:scale-95"
          >
            <Plus className="w-4 h-4" /> New Strategic Session
          </button>
        </div>
        <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-6">
          <div>
            <p className="text-[9px] font-black text-slate-500 uppercase tracking-[0.4em] mb-4 ml-2">Individual Intelligence</p>
            <div className="space-y-2">
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
            </div>
          </div>

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

      <div className="flex-1 flex flex-col relative overflow-hidden h-full bg-slate-950">
        {/* Notification Toast */}
        <AnimatePresence>
          {showNotification && (
            <motion.div 
              initial={{ opacity: 0, y: -20, x: '-50%' }}
              animate={{ opacity: 1, y: 0, x: '-50%' }}
              exit={{ opacity: 0, y: -20, x: '-50%' }}
              className={`fixed top-24 left-1/2 z-[100] px-8 py-4 ${notificationMessage.includes('Failed') ? 'bg-rose-600' : 'bg-indigo-600'} text-white rounded-2xl font-black text-xs uppercase tracking-[0.3em] shadow-2xl flex items-center gap-4 border border-white/10 backdrop-blur-xl`}
            >
              <div className={`w-2 h-2 rounded-full bg-white ${notificationMessage.includes('Complete') || notificationMessage.includes('Synthesized') ? 'animate-ping' : ''}`} />
              {notificationMessage}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Cognitive Pro Modal */}
        <AnimatePresence>
          {showCognitiveProModal && (
            <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/90 backdrop-blur-xl">
              <motion.div 
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                className="bg-slate-900 border border-slate-800 rounded-[3rem] p-12 max-w-4xl w-full max-h-[85vh] overflow-hidden flex flex-col shadow-2xl"
              >
                <div className="flex items-center justify-between mb-8">
                  <div>
                    <h2 className="text-3xl font-display font-black text-white uppercase tracking-tighter mb-2">Cognitive Pro</h2>
                    <p className="text-slate-400 font-medium">Select strategic reasoning frameworks for this inquiry</p>
                  </div>
                  <button 
                    onClick={() => {
                      setShowCognitiveProModal(false);
                      setPendingInput(null);
                    }}
                    className="p-4 hover:bg-slate-800 rounded-2xl transition-colors text-slate-500"
                  >
                    <ICONS.X className="w-6 h-6" />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar pr-4 -mr-4 mb-8">
                  {isValidatingStyles && (
                    <div className="flex items-center gap-3 mb-6 p-4 bg-indigo-600/10 border border-indigo-500/20 rounded-2xl animate-pulse">
                      <div className="w-2 h-2 bg-indigo-500 rounded-full animate-ping" />
                      <span className="text-[10px] font-black uppercase tracking-widest text-indigo-400">AI Analyzing Strategic Fit...</span>
                    </div>
                  )}
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {COGNITIVE_PRO_OPTIONS.map((option, oIdx) => {
                      const isSelected = selectedStyles.includes(option);
                      const validation = styleValidation[option];
                      const isWrong = validation && !validation.isValid;
                      
                      return (
                        <div key={`opt-${option}-${oIdx}`} className="flex flex-col gap-2">
                          <button
                            onClick={() => toggleStyle(option)}
                            className={`px-4 py-4 rounded-2xl border-2 text-left transition-all flex flex-col gap-2 relative ${
                              isSelected 
                                ? isWrong 
                                  ? 'bg-rose-600/20 border-rose-500 text-rose-100 shadow-lg shadow-rose-900/20'
                                  : 'bg-indigo-600/20 border-indigo-500 text-indigo-100 shadow-lg shadow-indigo-900/20' 
                                : 'bg-slate-800/50 border-slate-700 text-slate-400 hover:border-slate-600'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-black uppercase tracking-widest">{option}</span>
                              {isSelected && !isWrong && <Check className="w-3 h-3 text-indigo-400" />}
                              {isWrong && <XCircle className="w-3 h-3 text-rose-400" />}
                            </div>
                          </button>
                          {isWrong && isSelected && (
                            <motion.div 
                              initial={{ opacity: 0, y: -5 }}
                              animate={{ opacity: 1, y: 0 }}
                              className="px-3 py-2 bg-rose-950/30 border border-rose-900/50 rounded-xl"
                            >
                              <p className="text-[10px] font-bold text-rose-400 leading-relaxed">
                                <span className="uppercase tracking-widest block mb-1 opacity-60">Warning:</span>
                                {validation.reason}
                              </p>
                            </motion.div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="flex items-center justify-between pt-8 border-t border-slate-800">
                  <div className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                    {selectedStyles.length} Frameworks Selected
                  </div>
                  <div className="flex gap-4">
                    <button 
                      onClick={() => setSelectedStyles([])}
                      className="px-8 py-4 text-slate-400 font-black text-[10px] uppercase tracking-widest hover:text-white transition-colors"
                    >
                      Clear All
                    </button>
                    <button 
                      onClick={() => {
                        setShowCognitiveProModal(false);
                        handleSend(undefined, selectedStyles);
                      }}
                      disabled={selectedStyles.length === 0}
                      className="px-12 py-4 bg-indigo-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] shadow-2xl hover:bg-indigo-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Initialize Reasoning
                    </button>
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Header */}
        <div className="w-full bg-slate-950/80 backdrop-blur-xl border-b border-slate-800 z-20">
          <div className="max-w-5xl mx-auto px-12 py-4 flex items-center justify-between">
            <div className="flex items-center gap-6">
               <div className="p-3 bg-indigo-600 text-white rounded-2xl shadow-2xl">
                  <ICONS.Brain className="w-6 h-6" />
               </div>
               <div>
                  <h3 className="text-xl font-display font-black text-white tracking-tighter uppercase">
                    Spiked GPT
                  </h3>
                  <p className="text-[9px] text-slate-500 font-black uppercase tracking-[0.4em]">
                    Cognitive Sales Copilot v3.1
                  </p>
               </div>
            </div>
            <div className="flex items-center gap-4">
               {currentSessionId && !sharedSession && (
                 <>
                   <button 
                     onClick={openInNewTab}
                     className="p-3 bg-slate-800 hover:bg-slate-700 text-slate-400 rounded-xl transition-all border border-slate-700"
                     title="Open in New Tab"
                   >
                     <ExternalLink className="w-4 h-4" />
                   </button>
                   <button 
                     onClick={handleShareChat}
                     className="p-3 bg-slate-800 hover:bg-slate-700 text-slate-400 rounded-xl transition-all border border-slate-700"
                     title="Share Chat"
                   >
                     <Share2 className="w-4 h-4" />
                   </button>
                 </>
               )}
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
          className="flex-1 overflow-y-auto custom-scrollbar relative scroll-smooth bg-[radial-gradient(circle_at_50%_50%,rgba(15,23,42,1)_0%,rgba(2,6,23,1)_100%)]"
        >
          <div className="max-w-4xl mx-auto px-6 md:px-12 py-10 space-y-12 min-h-full flex flex-col">
            <AnimatePresence mode="popLayout">
              {messages.length === 0 ? (
                <motion.div 
                  key="empty"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="flex-1 flex flex-col items-center justify-center text-center space-y-12 py-20"
                >
                  <div className="relative">
                    <div className="absolute -top-10 -left-10 w-32 h-32 bg-indigo-600/10 rounded-full blur-3xl"></div>
                    <ICONS.Brain className="w-24 h-24 md:w-40 md:h-40 relative z-10 text-indigo-500/20" />
                  </div>
                  <div className="space-y-6">
                    <h4 className="text-4xl md:text-6xl font-display font-black text-white tracking-tighter uppercase leading-none">Neural Core<br/>Standby</h4>
                    <p className="text-slate-500 text-lg md:text-xl font-medium leading-relaxed max-w-xl mx-auto italic">
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
                    className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'} w-full`}
                  >
                  <div className={`mb-2 px-4 flex items-center gap-4 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                    <div className="flex items-center gap-3">
                      <span className={`text-[10px] font-black uppercase tracking-[0.4em] ${msg.role === 'user' ? 'text-indigo-500' : 'text-slate-400 dark:text-slate-500'}`}>
                        {msg.role === 'user' ? 'Strategic Architect' : 'Cognitive Core'}
                      </span>
                      {msg.timestamp && (
                        <span className="text-[9px] font-bold text-slate-600 uppercase tracking-widest">
                          {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      )}
                      {msg.role === 'assistant' && (
                        <div className={`flex items-center gap-2 px-3 py-1 rounded-full border text-[9px] font-black uppercase tracking-widest ${
                          msg.mode === 'standard' ? 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400' :
                          msg.mode === 'cognitive' ? 'bg-blue-500/10 border-blue-500/20 text-blue-400' :
                          msg.mode === 'cognitive-pro' ? 'bg-purple-500/10 border-purple-500/20 text-purple-400' :
                          msg.mode === 'deep-study' ? 'bg-amber-500/10 border-amber-500/20 text-amber-400' :
                          'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                        }`}>
                          {msg.mode === 'standard' && <ICONS.Chat className="w-3 h-3" />}
                          {msg.mode === 'cognitive' && <ICONS.Search className="w-3 h-3" />}
                          {msg.mode === 'cognitive-pro' && <ICONS.Research className="w-3 h-3" />}
                          {msg.mode === 'deep-study' && <ICONS.Research className="w-3 h-3" />}
                          {msg.mode === 'pineapple' && <ICONS.Pineapple className="w-3 h-3" />}
                          <span>
                            {msg.mode === 'standard' ? 'Fast Pulse' : 
                             msg.mode === 'cognitive' ? 'Cognitive' : 
                             msg.mode === 'cognitive-pro' ? 'Cognitive Pro' :
                             msg.mode === 'deep-study' ? 'Deep Study' : 
                             'Visual Logic'}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {msg.selectedStyles && msg.selectedStyles.length > 0 && (
                    <div className={`flex flex-wrap gap-2 mb-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      {msg.selectedStyles.map((style, sIdx) => (
                        <span key={`style-${style}-${sIdx}`} className="px-3 py-1 bg-slate-800/50 border border-slate-700/50 rounded-full text-[9px] font-black text-indigo-400 uppercase tracking-widest">
                          {style}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className={`
                    max-w-[90%] p-6 md:p-8 rounded-[2rem] md:rounded-[2.5rem] text-base md:text-lg font-medium leading-relaxed shadow-lg relative group
                    ${msg.role === 'user' 
                      ? 'bg-indigo-600 text-white rounded-tr-none border border-indigo-500 shadow-indigo-900/20' 
                      : msg.isError 
                        ? 'bg-rose-900/20 text-rose-200 rounded-tl-none border border-rose-500/50 shadow-black/40'
                        : 'bg-slate-900 text-slate-200 rounded-tl-none border border-slate-800 shadow-black/40'}
                  `}>
                    <div className="markdown-content">
                      {msg.content ? (
                        <ReactMarkdown 
                          remarkPlugins={[remarkGfm]}
                          components={{
                            p: ({ children }) => <p className="mb-4 last:mb-0 leading-relaxed">{children}</p>,
                            h1: ({ children }) => <h1 className="text-2xl font-display font-black uppercase tracking-tighter mb-4 mt-6 text-white">{children}</h1>,
                            h2: ({ children }) => <h2 className="text-xl font-display font-black uppercase tracking-tighter mb-3 mt-5 text-white/90">{children}</h2>,
                            h3: ({ children }) => <h3 className="text-lg font-display font-black uppercase tracking-tighter mb-2 mt-4 text-white/80">{children}</h3>,
                            ul: ({ children }) => <ul className="list-disc pl-6 mb-4 space-y-2">{children}</ul>,
                            ol: ({ children }) => <ol className="list-decimal pl-6 mb-4 space-y-2">{children}</ol>,
                            li: ({ children }) => <li className="pl-1">{children}</li>,
                            blockquote: ({ children }) => <blockquote className="border-l-4 border-brand-primary pl-4 py-1 my-4 bg-brand-primary/5 rounded-r-xl italic text-slate-300">{children}</blockquote>,
                            code: ({ node, inline, className, children, ...props }: any) => {
                              return inline ? (
                                <code className="bg-slate-800 px-1.5 py-0.5 rounded text-brand-primary font-mono text-sm" {...props}>
                                  {children}
                                </code>
                              ) : (
                                <pre className="bg-slate-950 p-4 rounded-xl border border-white/5 overflow-x-auto my-4 font-mono text-sm text-brand-primary">
                                  <code {...props}>{children}</code>
                                </pre>
                              );
                            },
                            a: ({ node, ...props }) => {
                              if (props.href?.startsWith('citation:')) {
                                const index = parseInt(props.href.split(':')[1]) - 1;
                                return (
                                  <sup 
                                    className="cursor-pointer text-indigo-400 hover:text-indigo-300 font-black px-1.5 py-0.5 bg-indigo-500/10 rounded-md border border-indigo-500/20 mx-0.5 transition-all hover:scale-110 inline-block align-top text-[10px]"
                                    title={msg.citations?.[index]?.sourceFile || 'Citation'}
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
                            },
                            table: ({ children }) => (
                              <div className="overflow-x-auto my-6 rounded-xl border border-slate-800">
                                <table className="w-full text-sm text-left border-collapse">
                                  {children}
                                </table>
                              </div>
                            ),
                            th: ({ children }) => (
                              <th className="px-6 py-4 bg-slate-800/50 text-slate-300 font-black uppercase tracking-wider border-b border-slate-700">
                                {children}
                              </th>
                            ),
                            td: ({ children }) => (
                              <td className="px-6 py-4 border-b border-slate-800/50 text-slate-400">
                                {children}
                              </td>
                            )
                          }}
                        >
                          {preprocessContent(msg.content)}
                        </ReactMarkdown>
                      ) : msg.isStreaming ? (
                        <TypingIndicator />
                      ) : null}
                    </div>

                    {/* Action Buttons */}
                    {!msg.isStreaming && msg.role === 'assistant' && (
                      <div className="absolute right-4 top-4 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-all z-10">
                        <button 
                          onClick={() => handleCopy(msg.content)}
                          className="p-2 bg-slate-800/90 hover:bg-indigo-600 rounded-lg border border-slate-700 transition-all text-slate-400 hover:text-white"
                          title="Copy to clipboard"
                        >
                          <ICONS.Efficiency className="w-3.5 h-3.5" />
                        </button>
                        <button 
                          onClick={() => handleRegenerate(msg.id)}
                          className="p-2 bg-slate-800/90 hover:bg-indigo-600 rounded-lg border border-slate-700 transition-all text-slate-400 hover:text-white"
                          title="Regenerate response"
                        >
                          <Plus className="w-3.5 h-3.5 rotate-45" />
                        </button>
                        {msg.isError && (
                          <button 
                            onClick={() => handleRegenerate(msg.id)}
                            className="flex items-center gap-2 px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-[10px] font-black uppercase tracking-widest transition-all"
                          >
                            <ICONS.Research className="w-3 h-3" /> Retry
                          </button>
                        )}
                      </div>
                    )}
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
                              key={`${citation.sourceFile}-${idx}`}
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
                              key={`${q}-${idx}`}
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
          <div ref={chatEndRef} className="h-4" />
        </div>

        {/* Scroll to Bottom Button */}
        <AnimatePresence>
          {!shouldAutoScroll && messages.length > 0 && (
            <motion.button
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              onClick={() => {
                setShouldAutoScroll(true);
                scrollToBottom();
              }}
              className="absolute bottom-40 left-1/2 -translate-x-1/2 p-3 bg-indigo-600 text-white rounded-full shadow-2xl z-30 hover:bg-indigo-700 transition-all border border-indigo-500/50"
            >
              <ICONS.ArrowDown className="w-5 h-5" />
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      {/* Input Area */}
      <div className="w-full bg-gradient-to-t from-slate-950 via-slate-950/95 to-transparent z-20 pt-4 pb-6">
        <div className="max-w-4xl mx-auto px-6 md:px-12 space-y-4">
          <div className="flex flex-wrap gap-2 justify-center">
             <ToolToggle active={mode === 'standard'} onClick={() => setMode('standard')} icon={<ICONS.Chat className="w-3 h-3" />} label="Fast Pulse" />
             <ToolToggle active={mode === 'cognitive'} onClick={() => setMode('cognitive')} icon={<ICONS.Search className="w-3 h-3" />} label="Cognitive" color="blue" />
             <ToolToggle active={mode === 'cognitive-pro'} onClick={() => setMode('cognitive-pro')} icon={<ICONS.Research className="w-3 h-3" />} label="Cognitive Pro" color="purple" />
             <ToolToggle active={mode === 'deep-study'} onClick={() => setMode('deep-study')} icon={<ICONS.Research className="w-3 h-3" />} label="Deep Study" color="amber" />
             <ToolToggle active={mode === 'pineapple'} onClick={() => setMode('pineapple')} icon={<ICONS.Pineapple className="w-3 h-3" />} label="Visual Logic" color="emerald" />
          </div>

          <div className="relative group">
            <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500/20 to-purple-500/20 rounded-[2.5rem] blur opacity-0 group-focus-within:opacity-100 transition duration-1000 group-hover:duration-200"></div>
            <div className="relative bg-slate-900/80 backdrop-blur-xl border border-slate-800 rounded-[2rem] shadow-2xl overflow-hidden focus-within:border-indigo-500/50 transition-all">
              <textarea 
                id="tour-gpt-input"
                rows={1}
                value={input}
                onChange={(e) => {
                  setInput(e.target.value);
                  e.target.style.height = 'auto';
                  e.target.style.height = e.target.scrollHeight + 'px';
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder="Type your strategic inquiry..."
                className="w-full bg-transparent px-6 py-4 text-base outline-none pr-40 font-medium placeholder:text-slate-700 text-white resize-none max-h-48 custom-scrollbar"
              />
              <div className="absolute right-3 bottom-3 flex items-center gap-3">
                <motion.button 
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => handleSend()}
                  disabled={!input.trim() || isProcessing}
                  className={`px-8 py-3 rounded-xl font-black uppercase tracking-[0.2em] text-[10px] shadow-2xl flex items-center gap-3 transition-all ${isProcessing ? 'bg-slate-800 text-slate-600' : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-900/40'}`}
                >
                  {isProcessing ? (
                    <>
                      <div className="w-3 h-3 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                      Synthesizing
                    </>
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5" />
                      Synthesize
                    </>
                  )}
                </motion.button>
              </div>
            </div>
          </div>
          
          <div className="flex items-center justify-between px-6">
             <motion.button 
               whileHover={{ x: 5 }}
               onClick={() => setIncludeContext(!includeContext)}
               className={`flex items-center gap-3 text-[9px] font-black uppercase tracking-[0.3em] transition-colors ${includeContext ? 'text-emerald-500' : 'text-slate-600'}`}
             >
                <div className={`w-1.5 h-1.5 rounded-full ${includeContext ? 'bg-emerald-500 animate-pulse shadow-[0_0_10px_rgba(16,185,129,0.6)]' : 'bg-slate-700'}`}></div>
                Strategic Context Sync: {includeContext ? 'Active' : 'Offline'}
             </motion.button>
             <p className="text-[9px] font-black text-slate-700 uppercase tracking-[0.4em]">Intelligence Node v3.1 Grounded</p>
          </div>
        </div>
      </div>

      {/* Share Modal */}
      <AnimatePresence>
        {showShareModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-slate-900 border border-slate-800 p-10 rounded-[3rem] max-w-lg w-full space-y-8 shadow-2xl"
            >
              <div className="space-y-2">
                <h3 className="text-3xl font-black text-white tracking-tighter uppercase">Share Intelligence</h3>
                <p className="text-slate-400 text-sm">Anyone with an account can view this strategic session.</p>
              </div>
              <div className="flex gap-3">
                <input 
                  readOnly 
                  value={shareLink}
                  className="flex-1 bg-slate-950 border border-slate-800 rounded-2xl px-6 py-4 text-sm text-indigo-400 outline-none"
                />
                <button 
                  onClick={() => {
                    navigator.clipboard.writeText(shareLink);
                    alert("Link copied to clipboard!");
                  }}
                  className="px-6 py-4 bg-indigo-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest"
                >
                  Copy
                </button>
              </div>
              <button 
                onClick={() => setShowShareModal(false)}
                className="w-full py-4 text-slate-500 font-black text-[10px] uppercase tracking-widest hover:text-white transition-colors"
              >
                Close
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

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
    indigo: 'bg-brand-primary border-brand-primary text-white shadow-2xl shadow-brand-primary/20 scale-105',
    emerald: 'bg-emerald-600 border-emerald-600 text-white shadow-2xl shadow-emerald-900/40 scale-105',
    amber: 'bg-amber-600 border-amber-600 text-white shadow-2xl shadow-amber-900/40 scale-105',
    purple: 'bg-purple-600 border-purple-600 text-white shadow-2xl shadow-purple-900/40 scale-105',
    blue: 'bg-blue-600 border-blue-600 text-white shadow-2xl shadow-blue-900/40 scale-105',
  }[color as keyof typeof activeClasses] || 'bg-brand-primary border-brand-primary text-white shadow-2xl shadow-brand-primary/20 scale-105';

  return (
    <motion.button 
      whileHover={{ y: -4 }}
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2 rounded-xl border transition-all font-display font-black uppercase tracking-[0.1em] text-[10px] shadow-sm ${active ? activeClasses : 'bg-slate-900 border-slate-800 text-slate-500 hover:border-brand-primary/50 hover:text-slate-300'}`}
    >
      {icon}
      {label}
    </motion.button>
  );
};

export default SalesGPT;
