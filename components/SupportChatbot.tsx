import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ICONS } from '../constants';

interface Message {
  id: string;
  type: 'bot' | 'user';
  text: string;
  options?: string[];
  showInput?: boolean;
}

export const SupportChatbot: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [showRating, setShowRating] = useState(false);
  const [rating, setRating] = useState(3);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  useEffect(() => {
    // Initial welcome
    addBotMessage("Welcome to SPIKED AI Support. I am your neural assistant. How can I help you today?", [
      "Strategic Configuration",
      "Document Parsing",
      "Avatar Simulation",
      "Other Query"
    ]);
  }, []);

  const addBotMessage = (text: string, options?: string[], showInput?: boolean) => {
    setIsTyping(true);
    setTimeout(() => {
      const newMessage: Message = {
        id: Math.random().toString(36).substr(2, 9),
        type: 'bot',
        text,
        options,
        showInput
      };
      setMessages(prev => [...prev, newMessage]);
      setIsTyping(false);
    }, 1000);
  };

  const addUserMessage = (text: string) => {
    const newMessage: Message = {
      id: Math.random().toString(36).substr(2, 9),
      type: 'user',
      text
    };
    setMessages(prev => [...prev, newMessage]);
  };

  const handleSendMessage = () => {
    if (!inputValue.trim()) return;
    const text = inputValue.trim();
    addUserMessage(text);
    setInputValue('');
    
    setIsTyping(true);
    
    // Advanced Neural Logic Engine
    const processQuery = () => {
      const lowerText = text.toLowerCase();
      let response = "";
      let options: string[] = ["Strategic Configuration", "Document Parsing", "Avatar Simulation", "Other Query"];

      // Keyword scoring system
      const scores = {
        privacy: (lowerText.match(/privacy|data|storage|encrypt|secure|safe/g) || []).length,
        security: (lowerText.match(/security|audit|hack|penetration|vulnerability|mfa/g) || []).length,
        legal: (lowerText.match(/terms|legal|agreement|contract|rights|quota/g) || []).length,
        technical: (lowerText.match(/how|method|explain|rag|synthesis|engine|logic/g) || []).length,
        onboarding: (lowerText.match(/tour|start|help|guide|onboarding|welcome/g) || []).length,
      };

      const maxScore = Math.max(...Object.values(scores));
      const primaryCategory = Object.keys(scores).find(key => scores[key as keyof typeof scores] === maxScore && maxScore > 0);

      switch (primaryCategory) {
        case 'privacy':
          response = "Neural Data Sovereignty is our core protocol. All sales intelligence is isolated via AES-256 encryption. We utilize a zero-retention policy for proprietary training data. Your intelligence remains yours, exclusively. Would you like to deep-dive into our encryption standards or data residency?";
          options = ["Encryption Standards", "Data Residency", "Privacy Policy", "Start Over"];
          break;
        case 'security':
          response = "The SPIKED AI defensive perimeter is verified through continuous architectural scanning and quarterly third-party penetration testing. We operate on a Zero-Trust framework. Shall I provide the latest security audit summary or guide you through MFA activation?";
          options = ["Security Audit Summary", "MFA Activation", "Defensive Roadmap", "Start Over"];
          break;
        case 'legal':
          response = "Our Operational Framework (ToS) defines the cognitive compute quotas and ethical boundaries of the neural partnership. It ensures clear governance over usage rights and confidentiality. Do you need to review compute quotas or standard legal clauses?";
          options = ["Compute Quotas", "Legal Clauses", "Terms of Service", "Start Over"];
          break;
        case 'technical':
          response = "Our synthesis engine utilizes a high-fidelity RAG (Retrieval-Augmented Generation) pipeline. It parses documents into vector-space, applies persona-based filtering, and synthesizes grounded narratives. Which part of the cognitive pipeline would you like to optimize?";
          options = ["Vector Ingestion", "Persona Filtering", "Narrative Synthesis", "Start Over"];
          break;
        case 'onboarding':
          response = "The SPIKED AI onboarding protocol is designed to achieve protocol mastery in under 10 minutes. It covers all core nodes from Strategic Settings to Spiked GPT. Would you like to restart the automated tour or access the Protocol Manual?";
          options = ["Restart Tour", "Protocol Manual", "Help Center", "Start Over"];
          break;
        default:
          response = "I have processed your query through our neural logic engine. While the parameters are broad, I recommend focusing on one of our core operational nodes: Strategic Configuration, Document Ingestion, or Security Verification. How shall we proceed?";
          options = ["Strategic Configuration", "Document Parsing", "Security Verification", "Other Query"];
      }

      addBotMessage(response, options);
    };

    if (text.length > 30) {
      setTimeout(() => {
        const newMessage: Message = {
          id: Math.random().toString(36).substr(2, 9),
          type: 'bot',
          text: "Analyzing neural parameters and cross-referencing protocol manuals for high-fidelity response...",
        };
        setMessages(prev => [...prev, newMessage]);
        setTimeout(processQuery, 1500);
      }, 800);
    } else {
      setTimeout(processQuery, 1000);
    }
  };

  const handleOptionClick = (option: string) => {
    addUserMessage(option);
    
    const responses: Record<string, { text: string, options?: string[], showInput?: boolean }> = {
      "Other Query": { text: "Please describe your query in detail. Our neural nodes will analyze the specific parameters of your request.", options: [], showInput: true },
      "Enter Question": { text: "Please describe your query in detail. Our neural nodes will analyze the specific parameters of your request.", options: [], showInput: true },
      "Strategic Configuration": { text: "Strategic configuration involves three critical nodes: Seller Profiling, Client Landscape Mapping, and Goal Alignment. Have you initialized these parameters in the Settings node?", options: ["Yes", "No"] },
      "Document Parsing": { text: "Our ingestion engine supports PDF, DOCX, and TXT. For optimal synthesis, ensure documents are high-fidelity and text-searchable. Are you encountering specific parsing anomalies?", options: ["Yes", "No"] },
      "Avatar Simulation": { text: "Simulations utilize behavioral identity mimicry. This requires a fully synthesized neural core grounded in at least three strategic documents. Is your core currently active?", options: ["Yes", "No"] },
      "Security Verification": { text: "Security is our baseline. We recommend enabling MFA and monitoring your Neural Feed for real-time audit logs. Shall I connect you with a security specialist for a deep-dive?", options: ["Contact Sales Team", "Start Over"] },
      "Encryption Standards": { text: "We use AES-256 for data at rest and TLS 1.3 for data in transit. Each user has a unique encryption key managed through our secure vault. Do you have more questions on this?", options: ["Yes, I have more questions", "No, I'm all set"] },
      "Data Residency": { text: "Data is stored in regional clusters to ensure low latency and compliance with local sovereignty laws. Currently, we support US, EU, and Asia-Pacific regions. Need more details?", options: ["Yes, I have more questions", "No, I'm all set"] },
      "Privacy Policy": { text: "You can access the full Privacy & Data Sovereignty breakdown in the Protocol Manual. Would you like me to highlight the 'Dos and Don'ts' of data handling?", options: ["Yes, show Dos/Don'ts", "No, I'll check the manual"] },
      "Security Audit Summary": { text: "Our last audit was completed on Q1 2024 with zero critical vulnerabilities found. We maintain a SOC2 Type II compliance posture. Shall I facilitate a full report download?", options: ["Contact Sales Team", "Start Over"] },
      "MFA Activation": { text: "MFA can be activated in your Profile Settings. We support TOTP apps like Google Authenticator and hardware keys. Need a step-by-step guide?", options: ["Yes", "No"] },
      "Compute Quotas": { text: "Your current plan allows for 500 neural syntheses per month. You can monitor usage in the 'Usage Metrics' section of your dashboard. Need an upgrade?", options: ["Contact Sales Team", "Start Over"] },
      "Restart Tour": { text: "To restart the onboarding tour, please navigate back to the main console and select 'Restart Tour' from your profile dropdown. Shall I guide you there?", options: ["Yes, take me back", "No, stay here"] },
      "Yes": { text: "Acknowledged. I recommend reviewing the 'Protocol Dos and Don'ts' in the Help Center to maintain peak operational integrity. Do you have further inquiries?", options: ["Yes, I have more questions", "No, I'm all set"] },
      "No": { text: "Understood. If you require manual intervention, I can facilitate a connection with our strategic support team.", options: ["Enter Question", "Contact Sales Team"] },
      "Yes, show Dos/Don'ts": { text: "DO: Use high-fidelity documents. DON'T: Share your neural link credentials. DO: Calibrate personas before synthesis. Do you have further inquiries?", options: ["Yes, I have more questions", "No, I'm all set"] },
      "No, I'll check the manual": { text: "Understood. If you require manual intervention, I can facilitate a connection with our strategic support team.", options: ["Enter Question", "Contact Sales Team"] },
      "Yes, I have more questions": { text: "Neural input active. Please enter your question below.", options: [], showInput: true },
      "No, I'm all set": { text: "Protocol complete. Glad I could assist in optimizing your sales intelligence. If you need further calibration, I am always online.", options: ["Start Over", "Contact Sales Team"] },
      "Contact Sales Team": { text: "Initiating secure link to our strategic support team at contact-sales@spiked.ai. Please provide a brief rating of our neural interaction before we proceed.", options: [] },
      "Start Over": { text: "Neural session reset. How can I assist in your strategic mission today?", options: ["Strategic Configuration", "Document Parsing", "Avatar Simulation", "Other Query"] },
      "Yes, take me back": { text: "Redirecting to main console... (Note: In this preview, please manually close this tab or navigate back).", options: ["Start Over"] }
    };

    const response = responses[option];
    if (response) {
      addBotMessage(response.text, response.options, response.showInput);
      if (option === "Contact Sales Team") {
        setShowRating(true);
      }
    }
  };

  const handleContactSales = () => {
    const chatHistory = messages.map(m => `${m.type.toUpperCase()}: ${m.text}`).join('\n\n');
    const emailBody = `Support Chat History:\n\n${chatHistory}\n\nUser Rating: ${rating}/5`;
    const subject = "Support Request - SPIKED AI";
    const mailtoUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=contact-sales@spiked.ai&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(emailBody)}`;
    window.open(mailtoUrl, '_blank');
  };

  return (
    <div className="fixed inset-0 bg-slate-950 flex flex-col">
      {/* Header */}
      <div className="p-6 border-b border-slate-800 bg-slate-900/50 backdrop-blur-xl flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-600/20">
            <ICONS.Brain className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-black text-white uppercase tracking-tight">Neural Support</h1>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">System Online</span>
            </div>
          </div>
        </div>
        <button 
          onClick={() => window.close()}
          className="p-2 hover:bg-slate-800 rounded-full transition-colors"
        >
          <ICONS.X className="w-6 h-6 text-slate-400" />
        </button>
      </div>

      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
        <AnimatePresence initial={false}>
          {messages.map((message, i) => (
            <motion.div
              key={`${message.id}-${i}`}
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div className={`max-w-[80%] space-y-4 ${message.type === 'user' ? 'items-end' : 'items-start'}`}>
                <div className={`p-4 rounded-2xl text-sm font-medium leading-relaxed ${
                  message.type === 'user' 
                    ? 'bg-indigo-600 text-white rounded-tr-none' 
                    : 'bg-slate-800 text-slate-200 rounded-tl-none border border-slate-700'
                }`}>
                  {message.text}
                </div>
                
                {message.options && message.options.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {message.options.map((opt, idx) => (
                      <button
                        key={`${opt}-${idx}`}
                        onClick={() => handleOptionClick(opt)}
                        className="px-4 py-2 bg-slate-900 border border-slate-700 text-indigo-400 text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-indigo-600 hover:text-white hover:border-indigo-600 transition-all active:scale-95"
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
        
        {isTyping && (
          <div className="flex justify-start">
            <div className="bg-slate-800 p-4 rounded-2xl rounded-tl-none border border-slate-700 flex gap-1">
              <div className="w-1.5 h-1.5 bg-slate-500 rounded-full animate-bounce" />
              <div className="w-1.5 h-1.5 bg-slate-500 rounded-full animate-bounce [animation-delay:0.2s]" />
              <div className="w-1.5 h-1.5 bg-slate-500 rounded-full animate-bounce [animation-delay:0.4s]" />
            </div>
          </div>
        )}

        {showRating && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-slate-900 border border-indigo-500/30 p-8 rounded-[2rem] space-y-8 max-w-md mx-auto"
          >
            <div className="text-center space-y-2">
              <h3 className="text-lg font-black text-white uppercase tracking-tight">Rate your experience</h3>
              <p className="text-slate-400 text-xs font-medium">Your feedback helps us calibrate our neural responses.</p>
            </div>

            <div className="space-y-4">
              <div className="flex justify-between text-2xl font-black text-indigo-400">
                <span>0</span>
                <span className="text-4xl">{rating}</span>
                <span>5</span>
              </div>
              <input 
                type="range" 
                min="0" 
                max="5" 
                step="1"
                value={rating}
                onChange={(e) => setRating(parseInt(e.target.value))}
                className="w-full h-2 bg-slate-800 rounded-full appearance-none cursor-pointer accent-indigo-600"
              />
            </div>

            <button 
              onClick={handleContactSales}
              className="w-full py-4 bg-indigo-600 text-white text-[10px] font-black uppercase tracking-widest rounded-2xl hover:bg-indigo-500 transition-all shadow-xl shadow-indigo-600/20"
            >
              Connect with Sales via Gmail
            </button>
          </motion.div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-6 border-t border-slate-800 bg-slate-900/50">
        <div className="max-w-4xl mx-auto flex gap-4">
          <input 
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
            placeholder="Type your query here..."
            className="flex-1 bg-slate-800 border border-slate-700 rounded-2xl px-6 py-4 text-sm font-medium text-white outline-none focus:border-indigo-500 transition-all"
          />
          <button 
            onClick={handleSendMessage}
            className="p-4 bg-indigo-600 text-white rounded-2xl hover:bg-indigo-500 transition-all active:scale-95 shadow-lg shadow-indigo-600/20"
          >
            <ICONS.ArrowRight className="w-6 h-6" />
          </button>
        </div>
      </div>
    </div>
  );
};
