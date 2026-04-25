import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Play, 
  Send, 
  Mic, 
  MicOff, 
  RefreshCcw, 
  ChevronRight, 
  BarChart2, 
  Zap, 
  Target, 
  Shield, 
  Users, 
  Briefcase,
  AlertCircle,
  CheckCircle2,
  TrendingUp,
  MessageSquare
} from 'lucide-react';
import { RoleplayQuestion, RoleplayEvaluation, GPTMessage, MeetingContext } from '../types';
import { generateRoleplayQuestions, generateRoleplayResponse, evaluateRoleplayAnswer, generateVoiceSample } from '../services/geminiService';

const SCENARIOS = ['Sales Pitch', 'Negotiation', 'Investor Meeting', 'Discovery Call', 'Closing Session', 'Cold Call Simulation'];
const ROLES = ['CEO', 'CFO', 'CTO', 'VP of Engineering', 'Procurement Manager', 'IT Director'];
const PERSONAS = ['Skeptical', 'Friendly', 'Analytical', 'Aggressive', 'Visionary', 'Indifferent'];
const FOCUS_AREAS = ['ROI', 'Risk', 'Growth', 'Security', 'Compliance', 'Technical Fit', 'Scalability'];

interface RoleplaySimulationProps {
  meetingContext?: MeetingContext;
  onStartSimulation?: () => void;
}

export const RoleplaySimulation: React.FC<RoleplaySimulationProps> = ({ meetingContext, onStartSimulation }) => {
  // Config state
  const [scenario, setScenario] = useState(SCENARIOS[0]);
  const [role, setRole] = useState(ROLES[0]);
  const [persona, setPersona] = useState(PERSONAS[0]);
  const [focusArea, setFocusArea] = useState(meetingContext?.meetingFocus || FOCUS_AREAS[0]);
  
  // App state
  const [questions, setQuestions] = useState<RoleplayQuestion[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(-1);
  const [messages, setMessages] = useState<GPTMessage[]>([]);
  const [userInput, setUserInput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [metrics, setMetrics] = useState<RoleplayEvaluation | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  
  // Refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Initialize Camera
  useEffect(() => {
    async function startVideo() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (err) {
        console.error("Error accessing webcam:", err);
      }
    }
    startVideo();
    
    return () => {
      if (videoRef.current?.srcObject) {
        const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
        tracks.forEach(track => track.stop());
      }
    };
  }, []);

  // Scroll to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isThinking]);

  const [isAISpeaking, setIsAISpeaking] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const stopAllAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setIsAISpeaking(false);
    if (onStartSimulation) onStartSimulation();
  };

  const playTTS = async (text: string) => {
    stopAllAudio();
    try {
      setIsAISpeaking(true);
      const voice = await generateVoiceSample(text, 'Kore');
      if (voice) {
        const audio = new Audio(`data:audio/wav;base64,${voice}`);
        audioRef.current = audio;
        audio.play();
        audio.onended = () => {
          setIsAISpeaking(false);
          audioRef.current = null;
        };
      }
    } catch (err) {
      console.error(err);
      setIsAISpeaking(false);
    }
  };

  const handleGenerateQuestions = async () => {
    stopAllAudio();
    setIsGenerating(true);
    try {
      const qResult = await generateRoleplayQuestions(
        scenario, role, persona, focusArea, meetingContext
      );
      setQuestions(qResult);
      setMessages([]);
      setMetrics(null);
      setCurrentQuestionIndex(-1);
    } catch (err) {
      console.error(err);
    } finally {
      setIsGenerating(false);
    }
  };

  const startQuestion = async (index: number) => {
    const question = questions[index];
    setCurrentQuestionIndex(index);
    
    const aiMessage: GPTMessage = {
      id: `ai-${Date.now()}`,
      role: 'assistant',
      content: question.text,
      mode: 'cognitive'
    };
    
    setMessages(prev => [...prev, aiMessage]);
    playTTS(question.text);
  };

  const handleSendResponse = async () => {
    if (!userInput.trim()) return;
    stopAllAudio();
    
    const userMsg: GPTMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: userInput,
      mode: 'cognitive'
    };
    
    setMessages(prev => [...prev, userMsg]);
    const currentInput = userInput;
    setUserInput('');
    setIsThinking(true);
    setIsEvaluating(true);
    
    try {
      // 1. Evaluate
      const evaluation = await evaluateRoleplayAnswer(
        currentInput,
        messages.length > 0 ? messages[messages.length - 1].content : "Initial context",
        messages,
        meetingContext
      );
      setMetrics(evaluation);
      
      // 2. Generate follow-up
      const response = await generateRoleplayResponse(
        [...messages, userMsg],
        role,
        persona,
        meetingContext
      );
      
      const aiFollowUp: GPTMessage = {
        id: `ai-${Date.now()}`,
        role: 'assistant',
        content: response,
        mode: 'cognitive'
      };
      
      setMessages(prev => [...prev, aiFollowUp]);
      playTTS(response);
    } catch (err) {
      console.error(err);
    } finally {
      setIsThinking(false);
      setIsEvaluating(false);
    }
  };

  return (
    <div className="flex flex-col lg:flex-row h-full w-full bg-slate-950 text-slate-100 overflow-hidden">
      
      {/* LEFT PANEL: ENGINE */}
      <div className="w-full lg:w-80 border-r border-slate-800 flex flex-col p-6 space-y-6 overflow-y-auto no-scrollbar">
        <div className="space-y-4">
          <h3 className="text-xs font-black uppercase tracking-[0.2em] text-indigo-400 flex items-center gap-2">
            <Zap className="w-4 h-4" /> Generation Engine
          </h3>

          {meetingContext && (
            <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-xl flex items-center gap-3">
               <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
               <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-black uppercase text-indigo-400 truncate">Cognitive Grounding: Active</p>
                  <p className="text-[8px] font-bold text-slate-500 truncate">{meetingContext.clientCompany || 'Live Document context'}</p>
               </div>
            </div>
          )}
          
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Scenario</label>
              <select 
                value={scenario}
                onChange={(e) => setScenario(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all appearance-none cursor-pointer"
              >
                {SCENARIOS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Target Role</label>
              <select 
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all appearance-none cursor-pointer"
              >
                {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Persona Bias</label>
              <select 
                value={persona}
                onChange={(e) => setPersona(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all appearance-none cursor-pointer"
              >
                {PERSONAS.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Focus Area</label>
              <select 
                value={focusArea}
                onChange={(e) => setFocusArea(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all appearance-none cursor-pointer"
              >
                {FOCUS_AREAS.map(f => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>
          </div>

          <button 
            onClick={handleGenerateQuestions}
            disabled={isGenerating}
            className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 text-white font-black py-4 rounded-2xl flex items-center justify-center gap-2 transition-all active:scale-95 shadow-lg shadow-indigo-500/20"
          >
            {isGenerating ? <RefreshCcw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            GENERATE QUESTIONS
          </button>
        </div>

        <div className="flex-1 space-y-3 pt-4">
          <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-slate-800 pb-2">Generated Logic</h4>
          <div className="space-y-3">
            {questions.map((q, i) => (
              <motion.div 
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                key={q.id}
                onClick={() => startQuestion(i)}
                className={`p-4 rounded-2xl border cursor-pointer transition-all ${
                  currentQuestionIndex === i 
                  ? 'bg-indigo-500/10 border-indigo-500' 
                  : 'bg-slate-900 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex justify-between items-start gap-2 mb-2">
                  <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded ${
                    q.priority === 'High' ? 'bg-rose-500/20 text-rose-500' : 
                    q.priority === 'Medium' ? 'bg-amber-500/20 text-amber-500' : 
                    'bg-emerald-500/20 text-emerald-500'
                  }`}>
                    {q.priority}
                  </span>
                  <span className="text-[8px] font-black text-slate-500 uppercase">{q.category}</span>
                </div>
                <p className="text-xs font-bold leading-relaxed line-clamp-3">{q.text}</p>
              </motion.div>
            ))}
            {!isGenerating && questions.length === 0 && (
              <div className="text-center py-12 space-y-2">
                <AlertCircle className="w-8 h-8 text-slate-700 mx-auto" />
                <p className="text-[10px] font-bold text-slate-500 uppercase">Wait for deployment...</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* CENTER PANEL: INTERACTION */}
      <div className="flex-1 flex flex-col bg-slate-900/50 relative">
        {/* Video Overlay */}
        <div className="w-full aspect-video lg:h-64 bg-slate-950 relative overflow-hidden group">
          <video 
            ref={videoRef}
            autoPlay 
            playsInline 
            muted 
            className="w-full h-full object-cover opacity-60 grayscale hover:grayscale-0 transition-all duration-700"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent"></div>
          
          <div className="absolute top-4 left-4 flex items-center gap-3">
             <div className="w-2 h-2 bg-rose-600 rounded-full animate-pulse shadow-[0_0_10px_rgba(225,29,72,0.8)]"></div>
             <span className="text-[10px] font-black uppercase tracking-widest text-white/50">Neural Link: Active</span>
          </div>

          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-4">
             <div className="px-4 py-2 bg-slate-900/80 backdrop-blur-md rounded-full border border-white/10 flex items-center gap-3">
                <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></div>
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-300">Biometric Sync: Stabilized</span>
             </div>
          </div>
        </div>

        {/* Chat Area */}
        <div className="flex-1 overflow-y-auto p-6 md:p-10 space-y-8 no-scrollbar">
          <AnimatePresence mode="popLayout">
            {messages.map((m, idx) => (
              <motion.div 
                initial={{ opacity: 0, y: 10, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                key={m.id}
                className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`max-w-[80%] rounded-3xl p-6 shadow-2xl relative ${
                  m.role === 'user' 
                  ? 'bg-indigo-600 text-white' 
                  : 'bg-slate-800/80 backdrop-blur-xl border border-white/5 text-slate-100'
                }`}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-[9px] font-black uppercase tracking-widest opacity-50">
                      {m.role === 'user' ? 'Me' : role}
                    </span>
                    <span className="text-[9px] font-bold opacity-30">
                      {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <p className="text-sm md:text-base font-bold leading-relaxed">{m.content}</p>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
          
          {isThinking && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex justify-start"
            >
              <div className="bg-slate-800/50 backdrop-blur-xl px-6 py-4 rounded-3xl border border-white/5 flex items-center gap-3">
                <div className="flex gap-1">
                  <motion.div animate={{ opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 1 }} className="w-1.5 h-1.5 bg-indigo-500 rounded-full"></motion.div>
                  <motion.div animate={{ opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 1, delay: 0.2 }} className="w-1.5 h-1.5 bg-indigo-500 rounded-full"></motion.div>
                  <motion.div animate={{ opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 1, delay: 0.4 }} className="w-1.5 h-1.5 bg-indigo-500 rounded-full"></motion.div>
                </div>
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">AI remains curious...</span>
              </div>
            </motion.div>
          )}
          <div ref={chatEndRef} />
        </div>

        {/* Input Bar */}
        <div className="p-6 md:p-8 bg-slate-900 border-t border-slate-800">
          <div className="max-w-4xl mx-auto flex items-center gap-4">
            <button 
              onMouseDown={() => setIsRecording(true)}
              onMouseUp={() => setIsRecording(false)}
              className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all ${
                isRecording 
                ? 'bg-rose-600 scale-110 shadow-[0_0_30px_rgba(225,29,72,0.4)]' 
                : 'bg-slate-800 hover:bg-slate-700'
              }`}
            >
              {isRecording ? <Mic className="w-6 h-6 text-white" /> : <MicOff className="w-6 h-6 text-slate-500" />}
            </button>
            <div className="flex-1 relative">
              <input 
                type="text"
                value={userInput}
                onChange={(e) => setUserInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSendResponse()}
                placeholder="Type your strategic response..."
                className="w-full bg-slate-800 border border-slate-700 rounded-2xl px-6 py-4 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-bold"
              />
              <button 
                onClick={handleSendResponse}
                disabled={!userInput.trim() || isThinking}
                className={`absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-xl flex items-center justify-center transition-all active:scale-95 shadow-xl ${
                  !userInput.trim() || isThinking 
                  ? 'bg-slate-700 opacity-50 cursor-not-allowed' 
                  : 'bg-indigo-600 hover:bg-indigo-500 shadow-indigo-500/20'
                }`}
              >
                <Send className="w-4 h-4 text-white" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* RIGHT PANEL: METRICS */}
      <div className="w-full lg:w-96 border-l border-slate-800 flex flex-col p-8 space-y-10 overflow-y-auto no-scrollbar bg-slate-950/50">
        
        <div className="space-y-6">
          <h3 className="text-xs font-black uppercase tracking-[0.2em] text-indigo-400 flex items-center gap-2">
            <BarChart2 className="w-4 h-4" /> Live Performance
          </h3>
          
          <div className="grid grid-cols-1 gap-6">
            {metrics ? (
              Object.entries(metrics.score).map(([key, val]) => (
                <div key={key} className="space-y-2">
                  <div className="flex justify-between items-center px-1">
                    <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider capitalize">{key}</span>
                    <span className="text-xs font-black text-indigo-500">{val}%</span>
                  </div>
                  <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden shadow-inner">
                    <motion.div 
                      className="h-full bg-indigo-600 rounded-full shadow-[0_0_10px_rgba(79,70,229,0.5)]"
                      initial={{ width: 0 }}
                      animate={{ width: `${val}%` }}
                      transition={{ type: "spring", stiffness: 50 }}
                    />
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-10 space-y-4">
                <div className="w-16 h-16 border-2 border-slate-800 border-dashed rounded-full mx-auto flex items-center justify-center">
                   <Target className="w-6 h-6 text-slate-700" />
                </div>
                <p className="text-[10px] font-bold text-slate-600 uppercase tracking-widest leading-relaxed">
                  Respond to questions to calibrate<br/>real-time performance metrics
                </p>
              </div>
            )}
          </div>
        </div>

        {metrics && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-8"
          >
            <div className="p-6 bg-indigo-500/10 border border-indigo-500/20 rounded-3xl space-y-3">
              <h4 className="text-[10px] font-black text-indigo-400 uppercase tracking-widest flex items-center gap-2">
                 <Shield className="w-3 h-3" /> Strategic Guidance
              </h4>
              <p className="text-xs font-bold text-slate-300 leading-relaxed italic">
                "{metrics.feedback}"
              </p>
            </div>

            <div className="space-y-4">
              <h4 className="text-[10px] font-black text-emerald-500 uppercase tracking-widest flex items-center gap-2">
                <CheckCircle2 className="w-3 h-3" /> Core Strengths
              </h4>
              <ul className="space-y-3">
                {metrics.strengths.map((s, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs font-bold text-slate-400">
                    <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full mt-1 shrink-0"></div>
                    {s}
                  </li>
                ))}
              </ul>
            </div>

            <div className="space-y-4">
              <h4 className="text-[10px] font-black text-rose-500 uppercase tracking-widest flex items-center gap-2">
                <AlertCircle className="w-3 h-3" /> Improvement Nodes
              </h4>
              <ul className="space-y-3">
                {metrics.improvements.map((im, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs font-bold text-slate-400">
                    <div className="w-1.5 h-1.5 bg-rose-500 rounded-full mt-1 shrink-0"></div>
                    {im}
                  </li>
                ))}
              </ul>
            </div>

            <div className="space-y-4">
              <h4 className="text-[10px] font-black text-indigo-400 uppercase tracking-widest flex items-center gap-2">
                <TrendingUp className="w-3 h-3" /> Next Strategic Steps
              </h4>
              <div className="space-y-2">
                {metrics.suggestedNextSteps.map((step, i) => (
                  <div key={i} className="flex items-center gap-3 p-4 bg-slate-900 rounded-2xl border border-slate-800">
                    <div className="w-6 h-6 bg-indigo-600 rounded-lg flex items-center justify-center text-[10px] font-bold text-white shrink-0">
                      {i + 1}
                    </div>
                    <span className="text-[11px] font-bold text-slate-300">{step}</span>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {!metrics && (
           <div className="mt-auto space-y-4">
              <div className="p-6 bg-slate-900/50 rounded-3xl border border-slate-800 space-y-4">
                <div className="flex items-center gap-3">
                  <Users className="w-5 h-5 text-indigo-400" />
                  <span className="text-[10px] font-black uppercase text-slate-400">Simulation Target</span>
                </div>
                <div className="space-y-3">
                   <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-500">Identity</span>
                      <span className="font-bold text-indigo-400">{role}</span>
                   </div>
                   <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-500">Mindset</span>
                      <span className="font-bold text-indigo-400">{persona}</span>
                   </div>
                </div>
              </div>
           </div>
        )}
      </div>
    </div>
  );
};
