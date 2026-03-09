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

  const handleOptionClick = (option: string) => {
    addUserMessage(option);
    
    if (option === "Other Query") {
      addBotMessage("Please describe your query in detail so I can assist you better.", [], true);
    } else if (option === "Strategic Configuration") {
      addBotMessage("To configure your strategy, ensure you have uploaded documents in the Settings node. Have you done this?", ["Yes", "No"]);
    } else if (option === "Document Parsing") {
      addBotMessage("Document parsing requires high-fidelity PDFs. If you are seeing errors, try re-uploading the file. Does this help?", ["Yes", "No"]);
    } else if (option === "Avatar Simulation") {
      addBotMessage("Avatar simulations require a synthesized neural core. Ensure you have clicked 'Synthesize' in the Settings. Is your core synthesized?", ["Yes", "No"]);
    } else if (option === "Yes") {
      addBotMessage("Excellent. Do you have any other doubts?", ["Yes, I have more questions", "No, I'm all set"]);
    } else if (option === "No") {
      addBotMessage("I understand. Would you like to enter a specific question or contact our sales team?", ["Enter Question", "Contact Sales Team"]);
    } else if (option === "Yes, I have more questions" || option === "Enter Question") {
      addBotMessage("Please enter your question below.", [], true);
    } else if (option === "No, I'm all set") {
      addBotMessage("Glad I could help! If you need anything else, feel free to ask.", ["Start Over", "Contact Sales Team"]);
    } else if (option === "Contact Sales Team") {
      addBotMessage("I'll help you connect with our sales team at contact-sales@spiked.ai. Before that, please rate your experience with me today.");
      setShowRating(true);
    } else if (option === "Start Over") {
      addBotMessage("How else can I assist you?", [
        "Strategic Configuration",
        "Document Parsing",
        "Avatar Simulation",
        "Other Query"
      ]);
    }
  };

  const handleSendMessage = () => {
    if (!inputValue.trim()) return;
    const text = inputValue.trim();
    addUserMessage(text);
    setInputValue('');
    
    // Simple logic to handle user questions
    addBotMessage("I've analyzed your query. Based on our protocol, I recommend checking the Documentation section for specific technical details. Did this solve your issue?", ["Yes", "No", "Contact Sales Team"]);
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
          {messages.map((message) => (
            <motion.div
              key={message.id}
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
                    {message.options.map((opt) => (
                      <button
                        key={opt}
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
