
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

type SessionMode = 'roleplay' | 'seller-roleplay' | 'grooming';

const PERSONA_OPTIONS: { type: CustomerPersonaType; label: string; icon: React.ReactNode; desc: string }[] = [
  { type: 'Balanced', label: 'Balanced', icon: <ICONS.Document />, desc: 'Standard business profile, focused on utility.' },
  { type: 'Technical', label: 'Technical', icon: <ICONS.Brain />, desc: 'Focused on specs, architecture, and security.' },
  { type: 'Financial', label: 'Financial', icon: <ICONS.ROI />, desc: 'Hyper-focused on ROI, TCO, and budgets.' },
  { type: 'Business Executives', label: 'Executives', icon: <ICONS.Trophy />, desc: 'Focused on strategy, growth, and vision.' },
];

interface SavedGrooming {
  id: string;
  question: string;
  evaluation: GroomingEvaluation;
  userNotes?: string;
  timestamp: number;
}

export const PracticeSession: React.FC<PracticeSessionProps> = ({ analysis, meetingContext, onStartSimulation }) => {
  const [sessionMode, setSessionMode] = useState<SessionMode>('roleplay');
  const [isActive, setIsActive] = useState(false);
  const [status, setStatus] = useState<'idle' | 'connecting' | 'active' | 'error' | 'analyzing'>('idle');
  const [micPermissionError, setMicPermissionError] = useState(false);
  const [selectedPersona, setSelectedPersona] = useState<CustomerPersonaType>('Balanced');
  const [transcription, setTranscription] = useState<{ user: string; ai: string }[]>([]);
  const [currentTranscription, setCurrentTranscription] = useState({ user: '', ai: '' });
  
  const [groomingTarget, setGroomingTarget] = useState(analysis.objectionHandling[0]?.objection || "How do you define value?");
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

      const personaDirectives = {
        'Technical': "Focus heavily on architecture and security.",
        'Financial': "Focus primarily on ROI and TCO.",
        'Business Executives': "Focus on strategy and growth.",
        'Balanced': "Maintain a mix of technical and business value."
      }[selectedPersona];

      const systemInstruction = sessionMode === 'roleplay' 
        ? `Act as the buyer: ${buyerName}. Persona: ${selectedPersona}. ${personaDirectives}. Objection context: ${analysis.objectionHandling.map(o => o.objection).join(', ')}. 
           
           ===========================================================
           CONVERSATIONAL FLOW PROTOCOL (CRITICAL)
           ===========================================================
           1. For EVERY turn, follow this sequence:
              a. EXPLAIN: Briefly explain your strategic reasoning or reaction to the seller's last point.
              b. QUESTION: Ask your next sharp, executive-level question.
           2. Keep the explanation and question distinct. Do NOT mix them.
           3. Never overlap or ask multiple questions at once.

           Start by saying: "I will act as ${buyerName} and you need to act as ${sellerName} in this roleplay."`
        : sessionMode === 'seller-roleplay'
        ? `Act as the elite salesperson representing your company, acting as ${sellerName}. The user is acting as the buyer: ${buyerName}. Persona: ${selectedPersona}. ${personaDirectives}. Your goal is to handle their questions and objections using the following strategy: ${analysis.finalCoaching.finalAdvice}. Be persuasive, professional, and empathetic.
           
           ===========================================================
           CONVERSATIONAL FLOW PROTOCOL (CRITICAL)
           ===========================================================
           1. For EVERY turn, follow this sequence:
              a. EXPLAIN: Briefly explain your strategic reasoning or reaction to the seller's last point.
              b. QUESTION: Ask your next sharp, executive-level question.
           2. Keep the explanation and question distinct. Do NOT mix them.
           3. Never overlap or ask multiple questions at once.

           Start by saying: "I will act as ${sellerName} and you need to act as ${buyerName} in this roleplay."`
        : `Act as a world-class speech and sales coach. 
           
           ===========================================================
           CONVERSATIONAL FLOW PROTOCOL (CRITICAL)
           ===========================================================
           1. First, state: "I'm going to ask you a critical question. Take a breath, and give me your best structured response."
           2. Then ask exactly this question: "${groomingTarget}". 
           3. Once the user provides a full answer, remain silent until the session is ended manually. 
           4. You are observing their performance for a later audit focusing on voice tone, grammar, and pacing.`;

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
                  aiTranscriptionRef.current += part.text;
                  setCurrentTranscription(prev => ({ ...prev, ai: aiTranscriptionRef.current }));
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
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Charon' } } },
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
        
        QUESTION POSED: "${groomingTarget}"
        SALESPERSON PERFORMANCE: "${finalTranscript}"
        TARGET AUDIENCE PERSONA: ${selectedPersona}
        
        REQUIRED JSON SCHEMA:
        {
          "transcription": "Cleaned up version of their answer.",
          "grammarScore": 0-100,
          "toneAnalysis": "Detailed paragraph about vocal energy and authority.",
          "grammarFeedback": "Detailed bullet points about grammar improvements.",
          "sentenceFormation": "Detailed analysis of sentence structure, variety, and impact.",
          "breathPacingGuide": "The text with [Take Breath] and [Pause - Xs] markers inserted strategically.",
          "strategicAlignment": "Strategic score and rationale.",
          "idealWording": "A 'Master Performance' version of the answer, rewritten for elite delivery.",
          "correctionExplanation": "3-4 paragraphs explaining EXACTLY WHY the user's structure was sub-optimal and why the new version wins."
        }`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              transcription: { type: Type.STRING },
              grammarScore: { type: Type.NUMBER },
              toneAnalysis: { type: Type.STRING },
              grammarFeedback: { type: Type.STRING },
              sentenceFormation: { type: Type.STRING },
              breathPacingGuide: { type: Type.STRING },
              strategicAlignment: { type: Type.STRING },
              idealWording: { type: Type.STRING },
              correctionExplanation: { type: Type.STRING }
            },
            required: ["transcription", "grammarScore", "toneAnalysis", "grammarFeedback", "sentenceFormation", "breathPacingGuide", "strategicAlignment", "idealWording", "correctionExplanation"]
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
      question: groomingTarget,
      evaluation: evaluation,
      timestamp: Date.now()
    };
    setSavedGroomings(prev => [newGrooming, ...prev]);
    alert("Response added to your Self-Grooming Journal for correction and practice.");
  };

  return (
    <div className="bg-white border-y border-slate-200 p-6 md:p-12 shadow-2xl overflow-hidden relative min-h-[calc(100vh-64px)] flex flex-col">
      <div className="flex flex-col md:flex-row items-center justify-between gap-6 mb-12">
        <div className="flex items-center gap-4">
          <div className="p-3.5 bg-rose-600 text-white rounded-2xl shadow-xl shadow-rose-100"><ICONS.Speaker /></div>
          <div>
            <h3 className="text-2xl font-black text-slate-900 tracking-tight">Performance Grooming Lab</h3>
            <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Master Your Verbal Architecture</p>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <button 
            onClick={() => setShowGroomingJournal(!showGroomingJournal)}
            className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all border ${showGroomingJournal ? 'bg-indigo-600 text-white' : 'bg-white text-indigo-600 border-indigo-100'}`}
          >
            {showGroomingJournal ? 'Close Journal' : 'Self-Grooming Journal'}
          </button>
          <div className="flex gap-2 p-1.5 bg-slate-50 border border-slate-200 rounded-2xl">
            <button 
              onClick={() => { stopPractice(); setSessionMode('roleplay'); setEvaluation(null); }}
              className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${sessionMode === 'roleplay' ? 'bg-indigo-600 text-white shadow-xl' : 'text-slate-400 hover:text-slate-600'} ${highlightedButton === 'roleplay' ? 'ring-4 ring-indigo-400 animate-pulse' : ''}`}
            >
              Buyer Roleplay
            </button>
            <button 
              onClick={() => { stopPractice(); setSessionMode('seller-roleplay'); setEvaluation(null); }}
              className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${sessionMode === 'seller-roleplay' ? 'bg-indigo-600 text-white shadow-xl' : 'text-slate-400 hover:text-slate-600'} ${highlightedButton === 'seller-roleplay' ? 'ring-4 ring-indigo-400 animate-pulse' : ''}`}
            >
              Seller Roleplay
            </button>
            <button 
              onClick={() => { stopPractice(); setSessionMode('grooming'); }}
              className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${sessionMode === 'grooming' ? 'bg-indigo-600 text-white shadow-xl' : 'text-slate-400 hover:text-slate-600'} ${highlightedButton === 'grooming' ? 'ring-4 ring-indigo-400 animate-pulse' : ''}`}
            >
              Bot-Led Grooming
            </button>
          </div>
        </div>
      </div>

      {showGroomingJournal ? (
        <div className="flex-1 space-y-8 animate-in fade-in zoom-in-95 duration-500 overflow-y-auto custom-scrollbar pb-12">
           <div className="flex items-center justify-between border-b border-slate-100 pb-6">
              <h4 className="text-xl font-black text-slate-900 tracking-tight">Your Self-Grooming Journal</h4>
              <span className="text-[9px] font-black uppercase text-indigo-500 tracking-widest bg-indigo-50 px-3 py-1 rounded-lg">{savedGroomings.length} Saved Protocols</span>
           </div>
           {savedGroomings.length === 0 ? (
             <div className="flex flex-col items-center justify-center py-24 opacity-30 text-center space-y-4">
                <ICONS.Document className="w-16 h-16" />
                <p className="text-sm font-bold uppercase tracking-widest">Journal Empty. Add your first audit for self-grooming.</p>
             </div>
           ) : (
             <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {savedGroomings.map(saved => (
                  <div key={saved.id} className="p-8 bg-slate-50 border border-slate-100 rounded-[2.5rem] relative group hover:bg-white hover:border-indigo-200 transition-all hover:shadow-2xl">
                     <div className="flex items-center justify-between mb-4">
                        <span className="text-[8px] font-black text-indigo-600 uppercase tracking-widest bg-indigo-50 px-3 py-1 rounded-full">{new Date(saved.timestamp).toLocaleDateString()}</span>
                        <button 
                          onClick={() => setSavedGroomings(prev => prev.filter(p => p.id !== saved.id))}
                          className="text-slate-300 hover:text-rose-500"
                        ><ICONS.X className="w-4 h-4" /></button>
                     </div>
                     <p className="text-sm font-black text-slate-900 mb-2 truncate">Q: {saved.question}</p>
                     <p className="text-[11px] font-bold text-slate-500 italic mb-6 line-clamp-2">"{saved.evaluation.idealWording}"</p>
                     <button 
                       onClick={() => { setEvaluation(saved.evaluation); setShowGroomingJournal(false); }}
                       className="text-[10px] font-black uppercase text-indigo-600 tracking-widest flex items-center gap-2 hover:translate-x-1 transition-transform"
                     >
                       Rehearse & Correct <ICONS.Play className="w-3 h-3" />
                     </button>
                  </div>
                ))}
             </div>
           )}
        </div>
      ) : !isActive && status !== 'analyzing' && !evaluation ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center space-y-12 w-full mx-auto py-12">
          <div className="space-y-4">
            <div className={`w-24 h-24 rounded-[2.5rem] flex items-center justify-center mx-auto mb-8 shadow-2xl transition-transform hover:scale-105 duration-500 ${sessionMode === 'roleplay' ? 'bg-indigo-50 text-indigo-600' : 'bg-rose-50 text-rose-600'}`}>
               {sessionMode === 'roleplay' ? <ICONS.Brain className="w-10 h-10" /> : <ICONS.Trophy className="w-10 h-10" />}
            </div>
            <h4 className="text-4xl font-black text-slate-900 tracking-tight">
              {sessionMode === 'roleplay' ? `Simulate a Live ${buyerName} Meeting` : sessionMode === 'seller-roleplay' ? `Simulate an Elite ${sellerName} Pitch` : 'Initiate Speech Mastery Protocol'}
            </h4>
            <p className="text-slate-500 text-lg leading-relaxed max-w-2xl mx-auto font-medium">
              {sessionMode === 'roleplay' 
                ? `Test your strategic reflexes in a real-time, low-latency dialogue with ${buyerName}.`
                : sessionMode === 'seller-roleplay'
                ? `Observe how an elite salesperson (${sellerName}) handles your questions. You act as ${buyerName}, the AI acts as ${sellerName}.`
                : 'Our Bot-Coach will ask you a high-stakes question. Give your best answer, and receive an elite audit.'}
            </p>
          </div>

          <div className="w-full space-y-10">
             {sessionMode === 'grooming' ? (
               <div className="space-y-4 max-w-2xl mx-auto text-left">
                  <label className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 ml-2">Target Objection / Question</label>
                  <select 
                    value={groomingTarget}
                    onChange={(e) => setGroomingTarget(e.target.value)}
                    className="w-full bg-slate-50 border-2 border-slate-100 rounded-[1.5rem] px-8 py-5 text-base font-bold text-slate-800 outline-none focus:border-indigo-500 focus:bg-white transition-all shadow-inner"
                  >
                    <optgroup label="Critical Objections">
                      {analysis.objectionHandling.map((o, i) => <option key={i} value={o.objection}>{o.objection}</option>)}
                    </optgroup>
                    <optgroup label="Anticipated Questions">
                      {analysis.predictedQuestions.map((q, i) => <option key={i} value={q.customerAsks}>{q.customerAsks}</option>)}
                    </optgroup>
                  </select>
               </div>
             ) : (
               <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 px-12">
                 {PERSONA_OPTIONS.map((option) => (
                   <button
                     key={option.type}
                     onClick={() => setSelectedPersona(option.type)}
                     className={`p-8 rounded-[2.5rem] border-2 text-left transition-all relative overflow-hidden group flex flex-col h-full ${selectedPersona === option.type ? 'bg-indigo-600 border-indigo-600 text-white shadow-xl scale-[1.03]' : 'bg-white border-slate-100 hover:border-indigo-300 shadow-sm'}`}
                   >
                     <div className={`p-4 rounded-2xl mb-6 inline-block w-fit ${selectedPersona === option.type ? 'bg-white/20 text-white' : 'bg-indigo-50 text-indigo-600 shadow-sm'}`}>{option.icon}</div>
                     <h5 className={`font-black text-xs uppercase tracking-widest mb-2 ${selectedPersona === option.type ? 'text-white' : 'text-slate-900'}`}>{option.label}</h5>
                     <p className={`text-[11px] leading-relaxed font-semibold ${selectedPersona === option.type ? 'text-indigo-100' : 'text-slate-500'}`}>{option.desc}</p>
                   </button>
                 ))}
               </div>
             )}
          </div>

          <button 
            onClick={sessionMode === 'grooming' ? startGroomingSession : startPractice} 
            disabled={status === 'connecting'} 
            className={`group relative overflow-hidden inline-flex items-center gap-6 px-20 py-7 rounded-full font-black text-2xl shadow-2xl transition-all hover:scale-105 active:scale-95 ${sessionMode === 'roleplay' || sessionMode === 'seller-roleplay' ? 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-200' : 'bg-rose-600 text-white hover:bg-rose-700 shadow-rose-200'} ${highlightedButton === 'commence' ? 'ring-8 ring-white/50 animate-pulse' : ''}`}
          >
            {status === 'connecting' ? (
              <><div className="w-6 h-6 border-4 border-white/30 border-t-white rounded-full animate-spin"></div> Connecting...</>
            ) : (
              <><ICONS.Play className="w-8 h-8" /> {sessionMode === 'grooming' ? 'Activate Bot-Coach' : 'Commence Interaction'}</>
            )}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
          </button>
        </div>
      ) : status === 'analyzing' ? (
        <div className="flex-1 flex flex-col items-center justify-center space-y-8 animate-in fade-in duration-700">
           <div className="relative">
              <div className="w-24 h-24 border-8 border-indigo-50 border-t-indigo-600 rounded-full animate-spin"></div>
              <div className="absolute inset-0 flex items-center justify-center text-indigo-600 scale-125"><ICONS.Brain /></div>
           </div>
           <div className="text-center">
              <p className="text-3xl font-black text-slate-900 tracking-tight mb-2">Cognitive Mastery Audit In Progress</p>
              <p className="text-[11px] text-slate-400 font-black uppercase tracking-[0.4em] animate-pulse">Analyzing Grammar • Tone • Structure • Pacing</p>
           </div>
        </div>
      ) : evaluation ? (
        <div className="flex-1 space-y-12 animate-in slide-in-from-bottom-8 duration-1000 pb-20 w-full px-12">
          <div className="flex items-center justify-between">
             <button onClick={() => setEvaluation(null)} className="text-[11px] font-black uppercase text-indigo-600 tracking-widest flex items-center gap-2 hover:translate-x-[-4px] transition-transform">
               <ICONS.X /> Close Mastery Review
             </button>
             <div className="flex items-center gap-4">
                <button 
                  onClick={addToGroomingJournal}
                  className="px-6 py-2.5 bg-emerald-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-700 shadow-xl shadow-emerald-100 flex items-center gap-2"
                >
                  <ICONS.Efficiency className="w-4 h-4" /> Add to Journal
                </button>
                <div className="px-6 py-2.5 bg-indigo-50 border border-indigo-100 text-indigo-600 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
                  Grooming Score: {evaluation.grammarScore}%
                </div>
             </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
            <div className="space-y-8">
               <div className="p-10 bg-slate-50 border border-slate-100 rounded-[3rem] shadow-inner relative overflow-hidden group">
                  <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-6">Recorded Performance</h4>
                  <p className="text-lg font-medium leading-relaxed italic text-slate-700">“{evaluation.transcription}”</p>
               </div>

                <div className="p-10 bg-slate-50 border border-slate-200 text-slate-900 rounded-[3rem] shadow-2xl relative overflow-hidden group">
                  <h4 className="text-[10px] font-black uppercase text-indigo-600 tracking-widest mb-6 flex items-center gap-2">
                    <ICONS.Sparkles className="w-4 h-4" /> Tactical Breathing & Pacing Guide
                  </h4>
                  <p className="text-xl font-medium leading-[2.2] text-slate-700 font-serif italic">
                    {evaluation.breathPacingGuide.split(/(\[Take Breath\]|\[Pause - \d+s\]|\[Slow Down\])/g).map((part, i) => (
                      (part.startsWith('[Take Breath]') || part.startsWith('[Pause') || part.startsWith('[Slow'))
                      ? <span key={i} className="bg-indigo-600/10 text-indigo-600 px-3 py-1 rounded-xl mx-1 font-black text-[10px] uppercase tracking-widest not-italic border border-indigo-200 shadow-sm">{part}</span>
                      : part
                    ))}
                  </p>
               </div>

               <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 <div className="p-8 bg-indigo-50 border border-indigo-100 rounded-[2.5rem] space-y-4">
                    <h5 className="text-[9px] font-black uppercase text-indigo-600 tracking-widest">Sentence Formation Audit</h5>
                    <p className="text-[11px] font-bold text-slate-700 leading-relaxed italic">{evaluation.sentenceFormation}</p>
                 </div>
                 <div className="p-8 bg-rose-50 border border-rose-100 rounded-[2.5rem] space-y-4">
                    <h5 className="text-[9px] font-black uppercase text-rose-600 tracking-widest">Vocal Tone & Pace Audit</h5>
                    <p className="text-[11px] font-bold text-slate-700 leading-relaxed italic">{evaluation.toneAnalysis}</p>
                 </div>
               </div>
            </div>

            <div className="space-y-8">
               <div className="p-12 bg-white border-4 border-indigo-50 rounded-[4rem] shadow-2xl relative overflow-hidden group/master">
                  <div className="relative z-10">
                    <div className="flex items-center justify-between mb-12">
                       <h4 className="text-[13px] font-black uppercase text-indigo-600 tracking-[0.4em]">Optimized Ideal wording</h4>
                       <span className="text-[9px] font-black text-emerald-600 bg-emerald-50 px-4 py-1.5 rounded-full uppercase border border-emerald-100">Validated Logic</span>
                    </div>
                    
                    <p className="text-3xl font-black text-slate-900 leading-tight mb-12 tracking-tight">“{evaluation.idealWording}”</p>
                    
                    <div className="p-8 bg-slate-50 border border-slate-100 rounded-[2.5rem] mb-12">
                       <h5 className="text-[10px] font-black uppercase text-slate-500 mb-4">Linguistic Corrections</h5>
                       <p className="text-sm font-bold text-slate-700 leading-relaxed whitespace-pre-wrap">{evaluation.grammarFeedback}</p>
                    </div>

                    <div className="flex flex-col gap-4">
                       <button 
                         onClick={playIdealVersion}
                         disabled={isPlayingIdeal || isPlayingExplanation}
                         className={`w-full flex items-center justify-center gap-5 py-7 rounded-[2rem] font-black text-base uppercase tracking-widest shadow-2xl transition-all active:scale-95 ${isPlayingIdeal ? 'bg-indigo-400 text-white' : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-100'}`}
                       >
                         {isPlayingIdeal ? 'Synthesizing Audio...' : <><ICONS.Speaker className="w-6 h-6" /> Rehearse Ideal wording</>}
                       </button>

                       <button 
                         onClick={playCorrectionExplanation}
                         disabled={isPlayingIdeal || isPlayingExplanation}
                         className={`w-full flex items-center justify-center gap-5 py-7 rounded-[2rem] font-black text-[11px] uppercase tracking-widest border-2 transition-all active:scale-95 ${isPlayingExplanation ? 'text-slate-400' : 'text-slate-700 hover:text-indigo-600 border-slate-200 hover:border-indigo-200 shadow-lg'}`}
                       >
                         {isPlayingExplanation ? 'Coach Explaining...' : <><ICONS.Brain className="w-5 h-5" /> Detailed Improvement rationale</>}
                       </button>
                    </div>
                  </div>
               </div>

               <div className="p-10 bg-emerald-50 border border-emerald-100 rounded-[3.5rem] animate-in fade-in zoom-in-95 duration-1000 shadow-sm">
                  <div className="flex items-center gap-3 mb-6">
                     <div className="p-3 bg-emerald-600 text-white rounded-xl shadow-lg shadow-emerald-100"><ICONS.Brain /></div>
                     <h4 className="text-[11px] font-black uppercase text-emerald-600 tracking-[0.3em]">Self-Grooming Explanation</h4>
                  </div>
                  <p className="text-base font-medium text-emerald-950 leading-relaxed whitespace-pre-wrap italic">
                    {evaluation.correctionExplanation}
                  </p>
               </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-0 overflow-hidden h-full">
          <div className="lg:col-span-2 bg-white p-12 flex flex-col items-center justify-center relative shadow-2xl overflow-hidden">
            <div className={`absolute inset-0 opacity-10 blur-[150px] transition-colors duration-2000 ${selectedPersona === 'Technical' ? 'bg-blue-600' : selectedPersona === 'Financial' ? 'bg-emerald-600' : 'bg-indigo-600'}`}></div>
            
            <div className="relative w-80 h-80 mb-12 flex items-center justify-center">
               <div className={`absolute inset-0 bg-indigo-50 rounded-full ${isActive ? 'animate-ping' : 'animate-pulse'} scale-[1.4]`}></div>
               <div className={`w-40 h-40 bg-indigo-600 rounded-full flex items-center justify-center text-white scale-[1.7] shadow-[0_0_80px_rgba(79,70,229,0.5)] z-10 border-8 border-white transition-transform ${isActive ? 'animate-pulse' : ''}`}>
                  {sessionMode === 'roleplay' ? <ICONS.Brain className="w-16 h-16" /> : <ICONS.Speaker className="w-16 h-16" />}
               </div>
               {isActive && (
                 <div className="absolute -bottom-16 left-1/2 -translate-x-1/2 flex items-center gap-4 px-6 py-2 bg-rose-600 rounded-full shadow-2xl animate-bounce">
                    <div className="w-2.5 h-2.5 bg-white rounded-full animate-pulse"></div>
                    <span className="text-[11px] font-black uppercase text-white tracking-widest">Active Audit Trace</span>
                 </div>
               )}
            </div>
            
            <div className="text-center space-y-6 relative z-10 max-w-xl">
                <span className="px-5 py-2 bg-indigo-50 text-indigo-600 text-[10px] font-black uppercase tracking-[0.3em] rounded-xl border border-indigo-100 mb-4 inline-block">
                  {sessionMode === 'roleplay' ? `Interacting with ${selectedPersona}` : sessionMode === 'seller-roleplay' ? 'Elite Seller Simulation' : 'Bot-Led Grooming Active'}
                </span>
                <h5 className="text-slate-900 text-4xl font-black tracking-tight leading-tight">
                  {sessionMode === 'roleplay' ? buyerName : sessionMode === 'seller-roleplay' ? sellerName : 'Neural Bot-Coach'}
                </h5>
                <p className="text-slate-500 text-lg italic font-medium leading-relaxed">
                  {sessionMode === 'roleplay' 
                    ? `"Speak directly to our business value drivers."` 
                    : sessionMode === 'seller-roleplay'
                    ? `"I am ready to address your concerns and demonstrate our value."`
                    : `Bot Question: "${groomingTarget}"`}
                </p>
            </div>

            {isActive && (
              <div className="absolute bottom-12 right-12 flex gap-4">
                 {sessionMode === 'grooming' && (
                    <button 
                      onClick={runGroomingAudit}
                      className="px-12 py-5 bg-emerald-600 text-white rounded-[2rem] font-black text-sm uppercase tracking-widest shadow-2xl hover:bg-emerald-700 transition-all border border-emerald-500/50"
                    >
                      Audit My Performance
                    </button>
                 )}
                 <button 
                   onClick={stopPractice}
                   className="px-10 py-5 bg-rose-600 text-white rounded-[2rem] font-black text-sm uppercase tracking-widest shadow-2xl hover:bg-rose-700 transition-all active:scale-95 border border-rose-500/50"
                 >
                   End Interaction
                 </button>
              </div>
            )}
          </div>
          
          <div className="bg-slate-50 p-10 flex flex-col border-l border-slate-200 overflow-hidden shadow-inner relative h-full">
            <div className="flex items-center justify-between mb-8">
              <h6 className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-400 flex items-center gap-3">
                 <ICONS.Efficiency className="w-4 h-4" /> Mastery Log
              </h6>
              <div className="flex gap-2">
                {isActive && (
                  <button 
                    onClick={stopPractice}
                    className="p-2 bg-rose-100 text-rose-600 rounded-lg hover:bg-rose-200 transition-colors"
                    title="End Session"
                  >
                    <ICONS.X className="w-4 h-4" />
                  </button>
                )}
                <button 
                  onClick={() => { setTranscription([]); setCurrentTranscription({ user: '', ai: '' }); userTranscriptionRef.current = ''; aiTranscriptionRef.current = ''; }}
                  className="p-2 bg-slate-200 text-slate-600 rounded-lg hover:bg-slate-300 transition-colors"
                  title="Clear Log"
                >
                  <ICONS.Trash className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto space-y-8 custom-scrollbar pr-6">
              {transcription.length === 0 && !currentTranscription.user && !currentTranscription.ai && (
                <div className="py-24 text-center space-y-6 opacity-20">
                   <ICONS.Speaker className="mx-auto w-14 h-14" />
                   <p className="text-[11px] font-black uppercase tracking-[0.4em]">Voice Interaction Disabled</p>
                </div>
              )}
              {transcription.map((turn, i) => (
                <div key={i} className="space-y-3 animate-in slide-in-from-bottom-4 duration-500">
                  <div className="flex flex-col items-end text-right">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Your input</p>
                    <p className="text-sm text-slate-700 bg-white p-6 rounded-[2rem] rounded-tr-none border border-slate-200 shadow-md leading-relaxed font-medium w-full">“{turn.user}”</p>
                  </div>
                  {turn.ai && (
                    <div className="flex flex-col items-start text-left">
                      <p className="text-[9px] font-black text-indigo-500 uppercase tracking-widest mb-1.5">AI Response</p>
                      <p className="text-sm text-indigo-950 bg-indigo-50 p-6 rounded-[2rem] rounded-tl-none border border-indigo-200 font-bold shadow-md leading-relaxed w-full">“{turn.ai}”</p>
                    </div>
                  )}
                </div>
              ))}
              {(currentTranscription.user || currentTranscription.ai) && (
                <div className="space-y-3 animate-pulse">
                  {currentTranscription.user && (
                    <div className="flex flex-col items-end text-right">
                      <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest mb-1.5">Hearing...</p>
                      <p className="text-sm text-slate-400 bg-white/50 p-6 rounded-[2rem] rounded-tr-none border border-dashed border-slate-200 leading-relaxed italic w-full">“{currentTranscription.user}”</p>
                    </div>
                  )}
                  {currentTranscription.ai && (
                    <div className="flex flex-col items-start text-left">
                      <p className="text-[9px] font-black text-indigo-300 uppercase tracking-widest mb-1.5">Responding...</p>
                      <p className="text-sm text-indigo-300 bg-indigo-50/30 p-6 rounded-[2rem] rounded-tl-none border border-dashed border-indigo-100 leading-relaxed italic w-full">“{currentTranscription.ai}”</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
