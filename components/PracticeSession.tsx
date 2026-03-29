
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AnalysisResult, CustomerPersonaType, GroomingEvaluation, MeetingContext } from '../types';
import { ICONS } from '../constants';
import { GoogleGenAI, Modality, LiveServerMessage, Type } from '@google/genai';
import { generatePitchAudio, decodeAudioData } from '../services/geminiService';

interface PracticeSessionProps {
  analysis: AnalysisResult;
  meetingContext: MeetingContext;
  onStartSimulation?: () => void;
}

type SessionMode = 'roleplay' | 'seller-roleplay' | 'grooming' | 'speech';

const PERSONA_OPTIONS: { type: CustomerPersonaType; label: string; icon: React.ReactNode; desc: string; voice: string }[] = [
  { type: 'Balanced', label: 'General Manager', icon: <ICONS.Document />, desc: 'Pragmatic and balanced. Focuses on operational efficiency and ease of implementation.', voice: 'Kore' },
  { type: 'Technical', label: 'Technical Expert', icon: <ICONS.Brain />, desc: 'Skeptical and precise. Focuses on architecture, security, and technical debt.', voice: 'Fenrir' },
  { type: 'Financial', label: 'CFO', icon: <ICONS.ROI />, desc: 'Hyper-rational and cost-conscious. Focuses on ROI, TCO, and budget constraints.', voice: 'Charon' },
  { type: 'Business Executives', label: 'CIO / CEO', icon: <ICONS.Trophy />, desc: 'Visionary and strategic. Focuses on business growth, competitive advantage, and outcomes.', voice: 'Zephyr' },
];

interface SavedGrooming {
  id: string;
  question: string;
  evaluation: GroomingEvaluation;
  userNotes?: string;
  timestamp: number;
}

const LiveMetric: React.FC<{ label: string; value: string; color: string }> = ({ label, value, color }) => (
  <div className="space-y-1">
    <div className="flex justify-between text-[8px] font-black uppercase tracking-widest text-slate-500">
      <span>{label}</span>
      <span className={`text-${color}-400`}>{value}</span>
    </div>
    <div className="h-1 bg-slate-800 rounded-full overflow-hidden">
      <motion.div 
        initial={{ width: 0 }}
        animate={{ width: value === 'Analyzing...' ? '30%' : '100%' }}
        className={`h-full bg-${color}-500`}
      />
    </div>
  </div>
);

export const PracticeSession: React.FC<PracticeSessionProps> = ({ analysis, meetingContext, onStartSimulation }) => {
  const [sessionMode, setSessionMode] = useState<SessionMode>('roleplay');
  const [isActive, setIsActive] = useState(false);
  const [status, setStatus] = useState<'idle' | 'connecting' | 'active' | 'error' | 'analyzing'>('idle');
  const [micPermissionError, setMicPermissionError] = useState(false);
  const [selectedPersona, setSelectedPersona] = useState<CustomerPersonaType>('Balanced');
  const [transcription, setTranscription] = useState<{ user: string; ai: string }[]>([]);
  const [currentTranscription, setCurrentTranscription] = useState({ user: '', ai: '' });
  const [realTimeFeedback, setRealTimeFeedback] = useState<{
    tone: string;
    clarity: string;
    pacing: string;
    alignment: string;
    score: number;
  }>({
    tone: 'Analyzing...',
    clarity: 'Analyzing...',
    pacing: 'Analyzing...',
    alignment: 'Analyzing...',
    score: 0
  });
  
  const [groomingTarget, setGroomingTarget] = useState(analysis.objectionHandling[0]?.objection || "How do you define value?");
  const [speechTarget, setSpeechTarget] = useState(analysis.finalCoaching.dos[0] || "Our core value proposition.");
  const [evaluation, setEvaluation] = useState<GroomingEvaluation | null>(null);
  const [isPlayingIdeal, setIsPlayingIdeal] = useState(false);
  const [isPlayingExplanation, setIsPlayingExplanation] = useState(false);
  const [savedGroomings, setSavedGroomings] = useState<SavedGrooming[]>([]);
  const [highlightedButton, setHighlightedButton] = useState<string | null>(null);
  const [showGroomingJournal, setShowGroomingJournal] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);

  const playGuidance = async (text: string, buttonToHighlight?: string) => {
    if (!text) return;
    try {
      if (buttonToHighlight) setHighlightedButton(buttonToHighlight);
      const audioUrl = await generatePitchAudio(text, 'Zephyr');
      if (audioUrl) {
        const audio = new Audio(URL.createObjectURL(new Blob([audioUrl], { type: 'audio/wav' })));
        audio.onended = () => setHighlightedButton(null);
        audio.play();
      }
    } catch (error) {
      console.error("Guidance audio failed:", error);
      setHighlightedButton(null);
    }
  };

  useEffect(() => {
    if (sessionMode === 'roleplay') {
      playGuidance(`In Buyer Roleplay, I will act as ${buyerName}, and you will act as ${sellerName}. Use the Commence Interaction button to start the simulation and test your reflexes.`, 'commence');
    } else if (sessionMode === 'seller-roleplay') {
      playGuidance(`In Seller Roleplay, I will act as ${sellerName}, and you will act as ${buyerName}. Observe how an elite salesperson handles your questions.`, 'commence');
    } else if (sessionMode === 'grooming') {
      playGuidance(`In Bot-Led Grooming, I will ask you a high-stakes question. Use the Activate Bot-Coach button to start and receive an elite audit on your performance.`, 'commence');
    } else if (sessionMode === 'speech') {
      playGuidance(`In Speech Practice, you can record your delivery of key sales points. Select a target and receive an elite audit on your tone, grammar, and pacing.`, 'commence');
    }
  }, [sessionMode]);
  const nextStartTimeRef = useRef<number>(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const sessionRef = useRef<any>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const idealSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const explanationSourceRef = useRef<AudioBufferSourceNode | null>(null);

  const userTranscriptionRef = useRef('');
  const aiTranscriptionRef = useRef('');

  const buyerName = meetingContext.clientNames || analysis.snapshot.role || "the Buyer";
  const sellerName = meetingContext.sellerNames || "the Seller";

  const encode = (bytes: Uint8Array) => {
    let binary = '';
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary);
  };

  const decode = (base64: string) => {
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) bytes[i] = binaryString.charCodeAt(i);
    return bytes;
  };

  const stopPractice = useCallback(() => {
    setIsActive(false);
    if (status !== 'analyzing') setStatus('idle');
    if (sessionRef.current) {
      sessionRef.current.close();
      sessionRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    sourcesRef.current.forEach(source => { try { source.stop(); } catch(e) {} });
    sourcesRef.current.clear();
    nextStartTimeRef.current = 0;
  }, [status]);

  const startGroomingSession = async () => {
    setEvaluation(null);
    userTranscriptionRef.current = '';
    aiTranscriptionRef.current = '';
    setTranscription([]);
    setMicPermissionError(false);
    await startPractice();
  };

  const startSpeechSession = async () => {
    setEvaluation(null);
    userTranscriptionRef.current = '';
    aiTranscriptionRef.current = '';
    setTranscription([]);
    setMicPermissionError(false);
    await startPractice();
  };

  const startPractice = async () => {
    if (onStartSimulation) onStartSimulation();
    setStatus('connecting');
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      } catch (err: any) {
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          setMicPermissionError(true);
        }
        throw err;
      }
      streamRef.current = stream;

      const inputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      const outputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      audioContextRef.current = outputCtx;

      const selectedPersonaConfig = PERSONA_OPTIONS.find(p => p.type === selectedPersona) || PERSONA_OPTIONS[0];

      const personaDirectives = {
        'Technical': "Act as a skeptical Technical Expert or CTO. Focus heavily on architecture, security, scalability, and technical debt. Use technical jargon and demand deep-dive explanations.",
        'Financial': "Act as a hyper-rational CFO or Procurement Lead. Focus primarily on ROI, TCO, payback periods, and budget constraints. Be skeptical of 'fluff' and demand hard numbers.",
        'Business Executives': "Act as a visionary CIO or CEO. Focus on high-level strategy, business growth, competitive advantage, and long-term vision. Be impatient with technical details and focus on outcomes.",
        'Balanced': "Act as a pragmatic General Manager. Maintain a mix of technical feasibility and business value. Focus on operational efficiency and ease of implementation."
      }[selectedPersona];

      const systemInstruction = sessionMode === 'roleplay' 
        ? `Act as the buyer: ${buyerName}. Your role is ${selectedPersonaConfig.label}. ${personaDirectives}. Objection context: ${analysis.objectionHandling.map(o => o.objection).join(', ')}. 
           
           ===========================================================
           COMMUNICATION STYLE (CRITICAL)
           ===========================================================
           Adopt the specific tone and vocabulary of a ${selectedPersonaConfig.label}. 
           If you are a Technical Expert, be precise and demanding. 
           If you are a CFO, be cost-conscious and skeptical. 
           If you are a CIO, be strategic and outcome-oriented.
           
           ===========================================================
           REAL-TIME COACHING PROTOCOL (CRITICAL)
           ===========================================================
           In your TEXT output (which the user does NOT hear), you MUST provide a real-time analysis of the user's last response BEFORE your dialogue.
           Format it exactly like this:
           [LIVE_FEEDBACK: {"tone": "...", "clarity": "...", "pacing": "...", "alignment": "...", "score": 0-100}]
           
           Then proceed with your dialogue.
           
           ===========================================================
           CONVERSATIONAL FLOW PROTOCOL (CRITICAL)
           ===========================================================
           1. For EVERY turn, follow this sequence:
              a. EXPLAIN: Briefly explain your strategic reasoning or reaction to the seller's last point.
              b. QUESTION: Ask your next sharp, executive-level question.
           2. Keep the explanation and question distinct. Do NOT mix them.
           3. Never overlap or ask multiple questions at once.

           Start by saying: "I will act as ${buyerName}, your ${selectedPersonaConfig.label}, and you need to act as ${sellerName} in this roleplay."`
        : sessionMode === 'seller-roleplay'
        ? `Act as the elite salesperson representing your company, acting as ${sellerName}. The user is acting as the buyer: ${buyerName}. The buyer's persona is ${selectedPersonaConfig.label}. ${personaDirectives}. Your goal is to handle their questions and objections using the following strategy: ${analysis.finalCoaching.finalAdvice}. Be persuasive, professional, and empathetic.
           
           ===========================================================
           REAL-TIME COACHING PROTOCOL (CRITICAL)
           ===========================================================
           In your TEXT output (which the user does NOT hear), you MUST provide a real-time analysis of the user's last response BEFORE your dialogue.
           Format it exactly like this:
           [LIVE_FEEDBACK: {"tone": "...", "clarity": "...", "pacing": "...", "alignment": "...", "score": 0-100}]
           
           Then proceed with your dialogue.

           ===========================================================
           CONVERSATIONAL FLOW PROTOCOL (CRITICAL)
           ===========================================================
           1. For EVERY turn, follow this sequence:
              a. EXPLAIN: Briefly explain your strategic reasoning or reaction to the seller's last point.
              b. QUESTION: Ask your next sharp, executive-level question.
           2. Keep the explanation and question distinct. Do NOT mix them.
           3. Never overlap or ask multiple questions at once.

           Start by saying: "I will act as ${sellerName} and you need to act as ${buyerName} in this roleplay."`
        : sessionMode === 'grooming'
        ? `Act as a world-class speech and sales coach. 
           
           ===========================================================
           CONVERSATIONAL FLOW PROTOCOL (CRITICAL)
           ===========================================================
           1. First, state: "I'm going to ask you a critical question. Take a breath, and give me your best structured response."
           2. Then ask exactly this question: "${groomingTarget}". 
           3. Once the user provides a full answer, remain silent until the session is ended manually. 
           4. You are observing their performance for a later audit focusing on voice tone, grammar, and pacing.`
        : `Act as a world-class speech and sales coach. 
           
           ===========================================================
           CONVERSATIONAL FLOW PROTOCOL (CRITICAL)
           ===========================================================
           1. First, state: "I'm ready to audit your delivery. Please deliver your pitch for: ${speechTarget}."
           2. Once you have stated that, remain silent while the user delivers their speech. 
           3. You are observing their performance for a later audit focusing on voice tone, grammar, and pacing.`;

      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        callbacks: {
          onopen: () => {
            setStatus('active');
            setIsActive(true);
            // Microphone input re-enabled
            const input = inputCtx.createMediaStreamSource(stream);
            const processor = inputCtx.createScriptProcessor(4096, 1, 1);
            processor.onaudioprocess = (e) => {
              const inputData = e.inputBuffer.getChannelData(0);
              const pcmData = new Int16Array(inputData.length);
              for (let i = 0; i < inputData.length; i++) {
                pcmData[i] = Math.max(-1, Math.min(1, inputData[i])) * 0x7FFF;
              }
              if (sessionRef.current) {
                sessionRef.current.sendRealtimeInput({
                  media: { data: encode(new Uint8Array(pcmData.buffer)), mimeType: 'audio/pcm;rate=16000' }
                });
              }
            };
            input.connect(processor);
            processor.connect(inputCtx.destination);
          },
          onmessage: async (message: LiveServerMessage) => {
            if (message.serverContent?.modelTurn) {
              const parts = message.serverContent.modelTurn.parts;
              for (const part of parts) {
                if (part.inlineData) {
                  const audioData = decode(part.inlineData.data);
                  const buffer = await decodeAudioData(audioData, outputCtx, 24000, 1);
                  const source = outputCtx.createBufferSource();
                  source.buffer = buffer;
                  source.connect(outputCtx.destination);
                  
                  const startTime = Math.max(outputCtx.currentTime, nextStartTimeRef.current);
                  source.start(startTime);
                  nextStartTimeRef.current = startTime + buffer.duration;
                  sourcesRef.current.add(source);
                  source.onended = () => sourcesRef.current.delete(source);
                }
                if (part.text) {
                  // Check for real-time feedback metadata
                  const feedbackMatch = part.text.match(/\[LIVE_FEEDBACK: ({.*?})\]/);
                  if (feedbackMatch) {
                    try {
                      const feedback = JSON.parse(feedbackMatch[1]);
                      setRealTimeFeedback(feedback);
                      // Remove the metadata from the displayed transcription
                      const cleanText = part.text.replace(/\[LIVE_FEEDBACK: {.*?}\]/, '');
                      if (cleanText.trim()) {
                        aiTranscriptionRef.current += cleanText;
                        setCurrentTranscription(prev => ({ ...prev, ai: aiTranscriptionRef.current }));
                      }
                    } catch (e) {
                      console.error("Failed to parse live feedback:", e);
                      aiTranscriptionRef.current += part.text;
                      setCurrentTranscription(prev => ({ ...prev, ai: aiTranscriptionRef.current }));
                    }
                  } else {
                    aiTranscriptionRef.current += part.text;
                    setCurrentTranscription(prev => ({ ...prev, ai: aiTranscriptionRef.current }));
                  }
                }
              }
            }
            if (message.serverContent?.turnComplete) {
              setTranscription(prev => [...prev, { user: userTranscriptionRef.current, ai: aiTranscriptionRef.current }]);
              userTranscriptionRef.current = '';
              aiTranscriptionRef.current = '';
              setCurrentTranscription({ user: '', ai: '' });
            }
            if (message.serverContent?.interrupted) {
              sourcesRef.current.forEach(s => { try { s.stop(); } catch(e) {} });
              sourcesRef.current.clear();
              nextStartTimeRef.current = 0;
            }
          },
          onerror: (e) => { setStatus('error'); stopPractice(); },
          onclose: () => stopPractice(),
        },
        config: {
          responseModalities: [Modality.AUDIO],
          inputAudioTranscription: {},
          outputAudioTranscription: {},
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: selectedPersonaConfig.voice } } },
          systemInstruction
        },
      });
      sessionRef.current = await sessionPromise;
    } catch (e) { setStatus('error'); }
  };

  const runGroomingAudit = async () => {
    setStatus('analyzing');
    const finalTranscript = userTranscriptionRef.current;
    stopPractice();

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Act as a world-class communication, linguistics, and sales coach. 
        Perform a comprehensive "Grooming Audit" for a salesperson.
        
        QUESTION/POINT POSED: "${sessionMode === 'speech' ? speechTarget : groomingTarget}"
        SALESPERSON PERFORMANCE: "${finalTranscript}"
        TARGET AUDIENCE PERSONA: ${selectedPersona}
        
        REQUIRED JSON SCHEMA:
        {
          "transcription": "Cleaned up version of their answer.",
          "grammarScore": 0-100,
          "pacingScore": 0-100,
          "toneAnalysis": "Detailed paragraph about vocal energy and authority.",
          "grammarFeedback": "Detailed bullet points about grammar improvements.",
          "sentenceFormation": "Detailed analysis of sentence structure, variety, and impact.",
          "breathPacingGuide": "The text with [Take Breath] and [Pause - Xs] markers inserted strategically.",
          "strategicAlignment": "Strategic score and rationale.",
          "idealWording": "A 'Master Performance' version of the answer, rewritten for elite delivery.",
          "correctionExplanation": "3-4 paragraphs explaining EXACTLY WHY the user's structure was sub-optimal and why the new version wins.",
          "objectionHandlingSuggestions": "Specific tactical suggestions for better objection handling based on the context."
        }`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              transcription: { type: Type.STRING },
              grammarScore: { type: Type.NUMBER },
              pacingScore: { type: Type.NUMBER },
              toneAnalysis: { type: Type.STRING },
              grammarFeedback: { type: Type.STRING },
              sentenceFormation: { type: Type.STRING },
              breathPacingGuide: { type: Type.STRING },
              strategicAlignment: { type: Type.STRING },
              idealWording: { type: Type.STRING },
              correctionExplanation: { type: Type.STRING },
              objectionHandlingSuggestions: { type: Type.STRING }
            },
            required: ["transcription", "grammarScore", "pacingScore", "toneAnalysis", "grammarFeedback", "sentenceFormation", "breathPacingGuide", "strategicAlignment", "idealWording", "correctionExplanation", "objectionHandlingSuggestions"]
          }
        }
      });
      setEvaluation(JSON.parse(response.text || "{}"));
      setStatus('idle');
    } catch (e) {
      console.error(e);
      setStatus('error');
    }
  };

  const playIdealVersion = async () => {
    if (!evaluation || isPlayingIdeal || isPlayingExplanation) return;
    setIsPlayingIdeal(true);
    try {
      const bytes = await generatePitchAudio(evaluation.idealWording, 'Zephyr');
      if (bytes) {
        if (!audioContextRef.current) audioContextRef.current = new AudioContext();
        const buffer = await decodeAudioData(bytes, audioContextRef.current, 24000, 1);
        const source = audioContextRef.current.createBufferSource();
        source.buffer = buffer;
        source.connect(audioContextRef.current.destination);
        source.onended = () => setIsPlayingIdeal(false);
        idealSourceRef.current = source;
        source.start();
      }
    } catch (e) { setIsPlayingIdeal(false); }
  };

  const playCorrectionExplanation = async () => {
    if (!evaluation || isPlayingExplanation || isPlayingIdeal) return;
    setIsPlayingExplanation(true);
    try {
      const bytes = await generatePitchAudio(evaluation.correctionExplanation, 'Charon');
      if (bytes) {
        if (!audioContextRef.current) audioContextRef.current = new AudioContext();
        const buffer = await decodeAudioData(bytes, audioContextRef.current, 24000, 1);
        const source = audioContextRef.current.createBufferSource();
        source.buffer = buffer;
        source.connect(audioContextRef.current.destination);
        source.onended = () => { setIsPlayingExplanation(false); };
        explanationSourceRef.current = source;
        source.start();
      }
    } catch (e) { setIsPlayingExplanation(false); }
  };

  const addToGroomingJournal = () => {
    if (!evaluation) return;
    const newGrooming: SavedGrooming = {
      id: Date.now().toString(),
      question: sessionMode === 'speech' ? speechTarget : groomingTarget,
      evaluation: evaluation,
      timestamp: Date.now()
    };
    setSavedGroomings(prev => [newGrooming, ...prev]);
    alert("Response added to your Self-Grooming Journal for correction and practice.");
  };

  return (
    <div className="h-full flex flex-col bg-slate-950 rounded-[3rem] shadow-2xl border border-slate-800 overflow-hidden relative">
      <div className="absolute inset-0 bg-mesh opacity-10 pointer-events-none"></div>
      
      <div className="p-8 border-b border-slate-800 flex items-center justify-between bg-slate-900/50 backdrop-blur-xl z-10">
        <div className="flex items-center gap-6">
          <div className="p-4 bg-white text-slate-900 rounded-2xl shadow-xl">
            <ICONS.Brain className="w-8 h-8" />
          </div>
          <div>
            <h2 className="text-3xl font-black text-slate-900 dark:text-white tracking-tighter uppercase">Neural Simulation Lab</h2>
            <p className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-[0.3em] mt-1">High-Fidelity Cognitive Roleplay & Performance Auditing</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <motion.button 
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setShowGroomingJournal(!showGroomingJournal)}
            className={`px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border ${showGroomingJournal ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-slate-800 text-indigo-400 border-indigo-900/30'}`}
          >
            {showGroomingJournal ? 'Close Journal' : 'Self-Grooming Journal'}
          </motion.button>
          <div className="flex gap-2 p-1.5 bg-slate-100 dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700">
            {(['roleplay', 'seller-roleplay', 'grooming', 'speech'] as SessionMode[]).map((m) => (
              <button
                key={m}
                onClick={() => {
                  stopPractice();
                  setSessionMode(m);
                  setEvaluation(null);
                }}
                className={`px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${sessionMode === m ? 'bg-slate-700 text-indigo-400 shadow-lg scale-105' : 'text-slate-400 hover:text-slate-300'}`}
              >
                {m === 'roleplay' ? 'Buyer Roleplay' : m === 'seller-roleplay' ? 'Seller Roleplay' : m === 'grooming' ? 'Bot-Led Grooming' : 'Speech Practice'}
              </button>
            ))}
          </div>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {showGroomingJournal ? (
          <motion.div 
            key="journal"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.05 }}
            className="flex-1 space-y-12 overflow-y-auto custom-scrollbar p-12"
          >
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-8">
              <div>
                <h4 className="text-3xl font-black text-slate-900 dark:text-white tracking-tighter uppercase">Self-Grooming Journal</h4>
                <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-1">Archived Performance Protocols</p>
              </div>
              <div className="px-6 py-3 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 rounded-xl text-[10px] font-black uppercase tracking-widest border border-indigo-100 dark:border-indigo-900/30">
                {savedGroomings.length} Saved Protocols
              </div>
            </div>

            {savedGroomings.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-32 opacity-20 text-center space-y-8">
                <ICONS.Document className="w-24 h-24" />
                <p className="text-sm font-black uppercase tracking-[0.4em]">Journal Empty. Add your first audit for self-grooming.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {savedGroomings.map(saved => (
                  <motion.div 
                    key={saved.id} 
                    whileHover={{ y: -8 }}
                    className="p-8 bg-slate-900 border border-slate-800 rounded-[2.5rem] relative group hover:border-indigo-900/50 transition-all hover:shadow-2xl"
                  >
                    <div className="flex items-center justify-between mb-6">
                      <span className="text-[8px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest bg-indigo-50 dark:bg-indigo-900/20 px-4 py-1.5 rounded-full border border-indigo-100 dark:border-indigo-900/30">
                        {new Date(saved.timestamp).toLocaleDateString()}
                      </span>
                      <button 
                        onClick={() => setSavedGroomings(prev => prev.filter(p => p.id !== saved.id))}
                        className="p-2 text-slate-300 hover:text-rose-500 transition-colors"
                      >
                        <ICONS.X className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="space-y-4 mb-8">
                      <p className="text-sm font-black text-slate-900 dark:text-white line-clamp-1">Q: {saved.question}</p>
                      <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 italic line-clamp-2 leading-relaxed">"{saved.evaluation.idealWording}"</p>
                    </div>
                    <button 
                      onClick={() => { setEvaluation(saved.evaluation); setShowGroomingJournal(false); }}
                      className="w-full py-4 bg-slate-50 dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-3 hover:bg-indigo-600 hover:text-white transition-all group"
                    >
                      Rehearse & Correct <ICONS.Play className="w-3 h-3 group-hover:translate-x-1 transition-transform" />
                    </button>
                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>
        ) : !isActive && status !== 'analyzing' && !evaluation ? (
          <motion.div 
            key="idle"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.05 }}
            className="flex-1 flex flex-col items-center justify-center p-12 space-y-12 relative overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-b from-indigo-50/50 dark:from-indigo-950/20 to-transparent pointer-events-none"></div>
            
            <div className="text-center space-y-6 max-w-3xl relative z-10">
              <motion.div 
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                className={`w-24 h-24 rounded-[2.5rem] flex items-center justify-center mx-auto mb-8 shadow-2xl ${sessionMode === 'roleplay' ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400' : 'bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400'}`}
              >
                 {sessionMode === 'roleplay' ? <ICONS.Brain className="w-10 h-10" /> : <ICONS.Trophy className="w-10 h-10" />}
              </motion.div>
              <h4 className="text-5xl font-black text-slate-900 dark:text-white tracking-tighter uppercase leading-tight">
                {sessionMode === 'roleplay' ? `Simulate a Live ${buyerName} Meeting` : sessionMode === 'seller-roleplay' ? `Simulate an Elite ${sellerName} Pitch` : sessionMode === 'grooming' ? 'Initiate Speech Mastery Protocol' : 'Speech Practice Mode'}
              </h4>
              <p className="text-slate-500 dark:text-slate-400 text-xl leading-relaxed font-medium italic">
                {sessionMode === 'roleplay' 
                  ? `Test your strategic reflexes in a real-time, low-latency dialogue with ${buyerName}.`
                  : sessionMode === 'seller-roleplay'
                  ? `Observe how an elite salesperson (${sellerName}) handles your questions. You act as ${buyerName}, the AI acts as ${sellerName}.`
                  : sessionMode === 'grooming'
                  ? 'Our Bot-Coach will ask you a high-stakes question. Give your best answer, and receive an elite audit.'
                  : 'Record your delivery of key sales points and receive an AI audit on tone, grammar, and pacing.'}
              </p>
            </div>

            <div className="w-full max-w-6xl relative z-10">
               {sessionMode === 'grooming' ? (
                 <div className="space-y-6 max-w-2xl mx-auto">
                    <label className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-400 dark:text-slate-500 ml-4">Target Objection / Question</label>
                    <div className="relative group">
                      <select 
                        value={groomingTarget}
                        onChange={(e) => setGroomingTarget(e.target.value)}
                        className="w-full bg-slate-900 border-4 border-slate-800 rounded-[2rem] px-10 py-6 text-lg font-black text-white outline-none focus:border-indigo-600 transition-all shadow-2xl appearance-none"
                      >
                        <optgroup label="Critical Objections">
                          {analysis.objectionHandling.map((o, i) => <option key={i} value={o.objection}>{o.objection}</option>)}
                        </optgroup>
                        <optgroup label="Anticipated Questions">
                          {analysis.predictedQuestions.map((q, i) => <option key={i} value={q.customerAsks}>{q.customerAsks}</option>)}
                        </optgroup>
                      </select>
                      <div className="absolute right-8 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                        <ICONS.ChevronDown className="w-6 h-6" />
                      </div>
                    </div>
                 </div>
               ) : sessionMode === 'speech' ? (
                <div className="space-y-6 max-w-2xl mx-auto">
                   <label className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-400 dark:text-slate-500 ml-4">Target Sales Point</label>
                   <div className="relative group">
                     <select 
                       value={speechTarget}
                       onChange={(e) => setSpeechTarget(e.target.value)}
                       className="w-full bg-slate-900 border-4 border-slate-800 rounded-[2rem] px-10 py-6 text-lg font-black text-white outline-none focus:border-indigo-600 transition-all shadow-2xl appearance-none"
                     >
                       <optgroup label="Key Strategic Points">
                         {analysis.finalCoaching.dos.map((d, i) => <option key={i} value={d}>{d}</option>)}
                         <option value={analysis.finalCoaching.finalAdvice}>Final Coaching Advice</option>
                       </optgroup>
                       <optgroup label="Opening Lines">
                         {analysis.openingLines.map((o, i) => <option key={i} value={o.text}>{o.text}</option>)}
                       </optgroup>
                     </select>
                     <div className="absolute right-8 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                       <ICONS.ChevronDown className="w-6 h-6" />
                     </div>
                   </div>
                </div>
              ) : (
                 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                   {PERSONA_OPTIONS.map((option) => (
                     <motion.button
                       key={option.type}
                       whileHover={{ y: -8 }}
                       whileTap={{ scale: 0.98 }}
                       onClick={() => setSelectedPersona(option.type)}
                       className={`p-10 rounded-[3rem] border-4 text-left transition-all relative overflow-hidden group flex flex-col h-full ${selectedPersona === option.type ? 'bg-indigo-600 border-indigo-400 text-white shadow-none' : 'bg-slate-900 border-slate-800 hover:border-indigo-900/50 shadow-none'}`}
                     >
                       <div className={`p-5 rounded-2xl mb-8 inline-block w-fit shadow-2xl transition-transform group-hover:scale-110 group-hover:rotate-3 ${selectedPersona === option.type ? 'bg-white text-indigo-600' : 'bg-slate-800 text-slate-400'}`}>{option.icon}</div>
                       <h5 className={`font-black text-sm uppercase tracking-[0.2em] mb-4 ${selectedPersona === option.type ? 'text-white' : 'text-slate-900 dark:text-white'}`}>{option.label}</h5>
                       <p className={`text-[12px] leading-relaxed font-bold italic ${selectedPersona === option.type ? 'text-indigo-100' : 'text-slate-500 dark:text-slate-400'}`}>{option.desc}</p>
                    {selectedPersona === option.type && (
                      <motion.div layoutId="persona-active" className="absolute top-6 right-6 w-3 h-3 bg-white rounded-full shadow-[0_0_15px_rgba(255,255,255,0.8)]"></motion.div>
                    )}
                     </motion.button>
                   ))}
                 </div>
               )}
            </div>

            <motion.button 
              whileHover={{ scale: 1.05, boxShadow: "0 25px 50px -12px rgba(79, 70, 229, 0.5)" }}
              whileTap={{ scale: 0.95 }}
              onClick={sessionMode === 'grooming' ? startGroomingSession : sessionMode === 'speech' ? startSpeechSession : startPractice} 
              disabled={status === 'connecting'} 
              className={`group relative px-20 py-8 rounded-full font-black text-2xl uppercase tracking-widest shadow-2xl transition-all overflow-hidden ${sessionMode === 'grooming' || sessionMode === 'speech' ? 'bg-rose-600 text-white' : 'bg-indigo-600 text-white'} ${highlightedButton === 'commence' ? 'ring-8 ring-indigo-400 animate-pulse' : ''}`}
            >
              <div className="relative z-10 flex items-center gap-4">
                {status === 'connecting' ? (
                  <><div className="w-8 h-8 border-4 border-white/30 border-t-white rounded-full animate-spin"></div> Connecting...</>
                ) : (
                  <><ICONS.Play className="w-10 h-10" /> {sessionMode === 'grooming' ? 'Activate Bot-Coach' : sessionMode === 'speech' ? 'Start Speech Practice' : 'Commence Interaction'}</>
                )}
              </div>
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
            </motion.button>
          </motion.div>
        ) : status === 'analyzing' ? (
          <motion.div 
            key="analyzing"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex-1 flex flex-col items-center justify-center space-y-12"
          >
            <div className="relative">
              <motion.div 
                animate={{ rotate: 360 }}
                transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                className="w-40 h-40 border-8 border-indigo-100 dark:border-indigo-900/30 border-t-indigo-600 rounded-full"
              ></motion.div>
              <div className="absolute inset-0 flex items-center justify-center text-indigo-600 scale-[2.5]"><ICONS.Brain /></div>
            </div>
            <div className="text-center space-y-4">
              <p className="text-5xl font-black text-slate-900 dark:text-white tracking-tighter uppercase">Cognitive Mastery Audit</p>
              <p className="text-[12px] text-slate-400 dark:text-slate-500 font-black uppercase tracking-[0.5em] animate-pulse">Analyzing Grammar • Tone • Structure • Pacing</p>
            </div>
          </motion.div>
        ) : evaluation ? (
          <motion.div 
            key="evaluation"
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -40 }}
            className="flex-1 overflow-y-auto custom-scrollbar p-12 space-y-16"
          >
            <div className="flex items-center justify-between sticky top-0 bg-slate-950/80 backdrop-blur-xl z-20 py-4 -mx-12 px-12 border-b border-slate-800">
              <button onClick={() => setEvaluation(null)} className="text-[12px] font-black uppercase text-indigo-600 dark:text-indigo-400 tracking-widest flex items-center gap-3 group">
                <ICONS.X className="group-hover:rotate-90 transition-transform" /> Close Mastery Review
              </button>
              <div className="flex items-center gap-6">
                <button 
                  onClick={addToGroomingJournal}
                  className="px-8 py-4 bg-emerald-600 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-emerald-700 shadow-xl shadow-emerald-100 dark:shadow-emerald-900/20 flex items-center gap-3 transition-all active:scale-95"
                >
                  <ICONS.Efficiency className="w-5 h-5" /> Add to Journal
                </button>
                <div className="flex gap-2">
                  <div className="px-8 py-4 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-2xl text-[11px] font-black uppercase tracking-widest flex items-center gap-3">
                    <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></span>
                    Grammar: {evaluation.grammarScore}%
                  </div>
                  <div className="px-8 py-4 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-2xl text-[11px] font-black uppercase tracking-widest flex items-center gap-3">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                    Pacing: {evaluation.pacingScore}%
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-start">
              <div className="space-y-12">
                <section className="space-y-6">
                  <h4 className="text-[11px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-[0.3em] ml-2">Recorded Performance</h4>
                  <div className="p-12 bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800 rounded-[3.5rem] shadow-inner">
                    <p className="text-2xl font-medium leading-relaxed italic text-slate-700 dark:text-slate-300">“{evaluation.transcription}”</p>
                  </div>
                </section>

                <section className="space-y-8">
                  <h4 className="text-[11px] font-black uppercase text-indigo-600 dark:text-indigo-400 tracking-[0.4em] ml-4 flex items-center gap-4">
                    <ICONS.Sparkles className="w-6 h-6" /> Tactical Breathing & Pacing Guide
                  </h4>
                  <div className="p-16 bg-slate-900 border-4 border-indigo-900/20 text-white rounded-[4.5rem] shadow-none relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-2 bg-indigo-600/10"></div>
                    <p className="text-3xl font-medium leading-[2.6] text-slate-700 dark:text-slate-300 font-serif italic relative z-10">
                      {evaluation.breathPacingGuide.split(/(\[Take Breath\]|\[Pause - \d+s\]|\[Slow Down\])/g).map((part, i) => (
                        (part.startsWith('[Take Breath]') || part.startsWith('[Pause') || part.startsWith('[Slow'))
                        ? <motion.span 
                            key={i} 
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            transition={{ delay: i * 0.05 }}
                            className="bg-indigo-600 text-white px-6 py-2 rounded-2xl mx-3 font-black text-[12px] uppercase tracking-widest not-italic shadow-xl inline-block align-middle border border-indigo-400/50"
                          >
                            {part}
                          </motion.span>
                        : part
                      ))}
                    </p>
                  </div>
                </section>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="p-10 bg-indigo-50 dark:bg-indigo-900/10 border border-indigo-100 dark:border-indigo-900/30 rounded-[3rem] space-y-4">
                    <h5 className="text-[10px] font-black uppercase text-indigo-600 dark:text-indigo-400 tracking-widest">Sentence Formation Audit</h5>
                    <p className="text-[12px] font-bold text-slate-700 dark:text-slate-400 leading-relaxed italic">{evaluation.sentenceFormation}</p>
                  </div>
                  <div className="p-10 bg-rose-50 dark:bg-rose-900/10 border border-rose-100 dark:border-rose-900/30 rounded-[3rem] space-y-4">
                    <h5 className="text-[10px] font-black uppercase text-rose-600 dark:text-rose-400 tracking-widest">Vocal Tone & Pace Audit</h5>
                    <p className="text-[12px] font-bold text-slate-700 dark:text-slate-400 leading-relaxed italic">{evaluation.toneAnalysis}</p>
                  </div>
                </div>
              </div>

              <div className="space-y-12">
                <section className="space-y-6">
                  <h4 className="text-[11px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-[0.3em] ml-2">Optimized Ideal Wording</h4>
                  <div className="p-16 bg-slate-900 border-4 border-emerald-900/20 rounded-[4.5rem] shadow-2xl relative overflow-hidden group/master">
                    <div className="absolute top-0 right-0 p-8">
                      <span className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 px-6 py-2 rounded-full uppercase border border-emerald-100 dark:border-emerald-900/30">Validated Logic</span>
                    </div>
                    
                    <p className="text-4xl font-black text-slate-900 dark:text-white leading-tight mb-16 tracking-tighter">“{evaluation.idealWording}”</p>
                    
                    <div className="p-10 bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700 rounded-[3rem] mb-16">
                      <h5 className="text-[11px] font-black uppercase text-slate-500 dark:text-slate-400 mb-6">Linguistic Corrections</h5>
                      <p className="text-base font-bold text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">{evaluation.grammarFeedback}</p>
                    </div>

                    <div className="flex flex-col gap-6">
                      <motion.button 
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={playIdealVersion}
                        disabled={isPlayingIdeal || isPlayingExplanation}
                        className={`w-full flex items-center justify-center gap-6 py-8 rounded-[2.5rem] font-black text-lg uppercase tracking-widest shadow-2xl transition-all ${isPlayingIdeal ? 'bg-indigo-400 text-white' : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-100 dark:shadow-indigo-900/20'}`}
                      >
                        {isPlayingIdeal ? 'Synthesizing Audio...' : <><ICONS.Speaker className="w-8 h-8" /> Rehearse Ideal wording</>}
                      </motion.button>

                      <motion.button 
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={playCorrectionExplanation}
                        disabled={isPlayingIdeal || isPlayingExplanation}
                        className={`w-full flex items-center justify-center gap-6 py-8 rounded-[2.5rem] font-black text-[12px] uppercase tracking-widest border-4 transition-all ${isPlayingExplanation ? 'text-slate-400 border-slate-200' : 'text-slate-700 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 border-slate-100 dark:border-slate-800 hover:border-indigo-200 dark:hover:border-indigo-900/50 shadow-xl'}`}
                      >
                        {isPlayingExplanation ? 'Coach Explaining...' : <><ICONS.Brain className="w-6 h-6" /> Detailed Improvement rationale</>}
                      </motion.button>
                    </div>
                  </div>
                </section>

                <section className="space-y-6">
                  <h4 className="text-[11px] font-black uppercase text-emerald-600 dark:text-emerald-400 tracking-[0.3em] ml-2 flex items-center gap-3">
                    <ICONS.Brain className="w-5 h-5" /> Self-Grooming Explanation
                  </h4>
                  <div className="p-12 bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-900/30 rounded-[3.5rem] shadow-sm">
                    <p className="text-lg font-medium text-emerald-950 dark:text-emerald-100 leading-relaxed whitespace-pre-wrap italic">
                      {evaluation.correctionExplanation}
                    </p>
                  </div>
                </section>

                <section className="space-y-6">
                  <h4 className="text-[11px] font-black uppercase text-amber-600 dark:text-amber-400 tracking-[0.3em] ml-2 flex items-center gap-3">
                    <ICONS.Shield className="w-5 h-5" /> Objection Handling Suggestions
                  </h4>
                  <div className="p-12 bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/30 rounded-[3.5rem] shadow-sm">
                    <p className="text-lg font-medium text-amber-950 dark:text-amber-100 leading-relaxed whitespace-pre-wrap italic">
                      {evaluation.objectionHandlingSuggestions}
                    </p>
                  </div>
                </section>
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div 
            key="active"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-0 overflow-hidden h-full"
          >
            <div className="lg:col-span-2 bg-slate-900 p-16 flex flex-col items-center justify-center relative shadow-2xl overflow-hidden">
              <div className={`absolute inset-0 opacity-10 dark:opacity-20 blur-[150px] transition-colors duration-2000 ${selectedPersona === 'Technical' ? 'bg-blue-600' : selectedPersona === 'Financial' ? 'bg-emerald-600' : 'bg-indigo-600'}`}></div>
              
              <div className="relative w-96 h-96 mb-16 flex items-center justify-center">
                <motion.div 
                  animate={{ scale: isActive ? [1.4, 1.6, 1.4] : 1.4 }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="absolute inset-0 bg-indigo-50 dark:bg-indigo-900/20 rounded-full"
                ></motion.div>
                <motion.div 
                  animate={{ scale: isActive ? [1.7, 1.8, 1.7] : 1.7 }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                  className="w-48 h-48 bg-indigo-600 rounded-full flex items-center justify-center text-white shadow-[0_0_100px_rgba(79,70,229,0.6)] z-10 border-[10px] border-white dark:border-slate-800 transition-transform"
                >
                  {sessionMode === 'roleplay' ? <ICONS.Brain className="w-20 h-20" /> : <ICONS.Speaker className="w-20 h-20" />}
                </motion.div>
                {isActive && (
                  <motion.div 
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    className="absolute -bottom-20 left-1/2 -translate-x-1/2 flex items-center gap-6 px-8 py-3 bg-rose-600 rounded-full shadow-2xl"
                  >
                    <div className="w-3 h-3 bg-white rounded-full animate-pulse"></div>
                    <span className="text-[12px] font-black uppercase text-white tracking-[0.2em]">Active Audit Trace</span>
                  </motion.div>
                )}

                {isActive && (
                  <motion.div 
                    initial={{ x: 40, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    className="absolute top-0 right-[-280px] w-64 space-y-4 z-20"
                  >
                    <div className="p-6 bg-slate-900/90 backdrop-blur-xl border border-slate-800 rounded-[2rem] shadow-2xl space-y-4">
                      <div className="flex items-center justify-between">
                        <h6 className="text-[9px] font-black uppercase tracking-widest text-indigo-400">Live Performance</h6>
                        <span className="text-[10px] font-black text-white">{realTimeFeedback.score}%</span>
                      </div>
                      <div className="space-y-3">
                        <LiveMetric label="Tone" value={realTimeFeedback.tone} color="indigo" />
                        <LiveMetric label="Clarity" value={realTimeFeedback.clarity} color="emerald" />
                        <LiveMetric label="Pacing" value={realTimeFeedback.pacing} color="amber" />
                        <LiveMetric label="Alignment" value={realTimeFeedback.alignment} color="rose" />
                      </div>
                    </div>
                  </motion.div>
                )}
              </div>
              
              <div className="text-center space-y-8 relative z-10 max-w-2xl">
                <span className="px-6 py-2.5 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 text-[11px] font-black uppercase tracking-[0.4em] rounded-2xl border border-indigo-100 dark:border-indigo-900/30 mb-6 inline-block">
                  {sessionMode === 'roleplay' ? `Interacting with ${selectedPersona}` : sessionMode === 'seller-roleplay' ? 'Elite Seller Simulation' : sessionMode === 'grooming' ? 'Bot-Led Grooming Active' : 'Speech Practice Active'}
                </span>
                <h5 className="text-slate-900 dark:text-white text-5xl font-black tracking-tighter leading-tight uppercase">
                  {sessionMode === 'roleplay' ? buyerName : sessionMode === 'seller-roleplay' ? sellerName : 'Neural Bot-Coach'}
                </h5>
                <p className="text-slate-500 dark:text-slate-400 text-2xl italic font-medium leading-relaxed max-w-lg mx-auto">
                  {sessionMode === 'roleplay' 
                    ? `"Speak directly to our business value drivers."` 
                    : sessionMode === 'seller-roleplay'
                    ? `"I am ready to address your concerns and demonstrate our value."`
                    : sessionMode === 'grooming'
                    ? `Bot Question: "${groomingTarget}"`
                    : `Practicing: "${speechTarget}"`}
                </p>
              </div>

              {isActive && (
                <div className="absolute bottom-16 right-16 flex gap-6">
                  {(sessionMode === 'grooming' || sessionMode === 'speech') && (
                    <motion.button 
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={runGroomingAudit}
                      className="px-16 py-6 bg-emerald-600 text-white rounded-[2.5rem] font-black text-base uppercase tracking-widest shadow-2xl hover:bg-emerald-700 transition-all border border-emerald-500/50"
                    >
                      Audit My Performance
                    </motion.button>
                  )}
                  <motion.button 
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={stopPractice}
                    className="px-12 py-6 bg-rose-600 text-white rounded-[2.5rem] font-black text-base uppercase tracking-widest shadow-2xl hover:bg-rose-700 transition-all active:scale-95 border border-rose-500/50"
                  >
                    End Interaction
                  </motion.button>
                </div>
              )}
            </div>
            
            <div className="bg-slate-50 dark:bg-slate-950 p-12 flex flex-col border-l border-slate-200 dark:border-slate-800 overflow-hidden shadow-inner relative h-full">
              <div className="flex items-center justify-between mb-12">
                <h6 className="text-[11px] font-black uppercase tracking-[0.5em] text-slate-400 dark:text-slate-500 flex items-center gap-4">
                  <ICONS.Efficiency className="w-5 h-5" /> Mastery Log
                </h6>
                <div className="flex gap-3">
                  {isActive && (
                    <button 
                      onClick={stopPractice}
                      className="p-3 bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 rounded-xl hover:bg-rose-200 dark:hover:bg-rose-900/50 transition-colors"
                      title="End Session"
                    >
                      <ICONS.X className="w-5 h-5" />
                    </button>
                  )}
                  <button 
                    onClick={() => { setTranscription([]); setCurrentTranscription({ user: '', ai: '' }); userTranscriptionRef.current = ''; aiTranscriptionRef.current = ''; }}
                    className="p-3 bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-xl hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors"
                    title="Clear Log"
                  >
                    <ICONS.Trash className="w-5 h-5" />
                  </button>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto space-y-10 custom-scrollbar pr-8">
                {transcription.length === 0 && !currentTranscription.user && !currentTranscription.ai && (
                  <div className="py-32 text-center space-y-8 opacity-20">
                    <ICONS.Speaker className="mx-auto w-20 h-20" />
                    <p className="text-[12px] font-black uppercase tracking-[0.5em]">Voice Interaction Disabled</p>
                  </div>
                )}
                {transcription.map((turn, i) => (
                  <motion.div 
                    key={i} 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-4"
                  >
                    <div className="flex flex-col items-end text-right">
                      <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2">Your input</p>
                      <p className="text-base text-slate-300 bg-slate-900 p-8 rounded-[2.5rem] rounded-tr-none border border-slate-800 shadow-lg leading-relaxed font-medium w-full">“{turn.user}”</p>
                    </div>
                    {turn.ai && (
                      <div className="flex flex-col items-start text-left">
                        <p className="text-[10px] font-black text-indigo-500 dark:text-indigo-400 uppercase tracking-widest mb-2">AI Response</p>
                        <p className="text-base text-indigo-950 dark:text-indigo-100 bg-indigo-50 dark:bg-indigo-900/30 p-8 rounded-[2.5rem] rounded-tl-none border border-indigo-200 dark:border-indigo-900/50 font-bold shadow-lg leading-relaxed w-full">“{turn.ai}”</p>
                      </div>
                    )}
                  </motion.div>
                ))}
                {(currentTranscription.user || currentTranscription.ai) && (
                  <div className="space-y-4">
                    {currentTranscription.user && (
                      <div className="flex flex-col items-end text-right animate-pulse">
                        <p className="text-[10px] font-black text-slate-300 dark:text-slate-600 uppercase tracking-widest mb-2">Hearing...</p>
                        <p className="text-base text-slate-600 bg-slate-900/30 p-8 rounded-[2.5rem] rounded-tr-none border border-dashed border-slate-800 leading-relaxed italic w-full">“{currentTranscription.user}”</p>
                      </div>
                    )}
                    {currentTranscription.ai && (
                      <div className="flex flex-col items-start text-left animate-pulse">
                        <p className="text-[10px] font-black text-indigo-300 dark:text-indigo-600 uppercase tracking-widest mb-2">Responding...</p>
                        <p className="text-base text-indigo-300 dark:text-indigo-600 bg-indigo-50/30 dark:bg-indigo-900/10 p-8 rounded-[2.5rem] rounded-tl-none border border-dashed border-indigo-100 dark:border-indigo-900/30 leading-relaxed italic w-full">“{currentTranscription.ai}”</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
