
import React, { useState, useRef, useEffect, FC } from 'react';
import { ICONS, FAMOUS_PERSONALITIES } from '../constants';
import { 
  streamAvatarSimulation, 
  generatePitchAudio, 
  decodeAudioData,
  evaluateAvatarSession 
} from '../services/geminiService';
import { GPTMessage, MeetingContext, ComprehensiveAvatarReport } from '../types';

interface AvatarSimulationProps {
  meetingContext: MeetingContext;
}

export const AvatarSimulation: FC<AvatarSimulationProps> = ({ meetingContext }) => {
  const [messages, setMessages] = useState<GPTMessage[]>([]);
  const [currentCaption, setCurrentCaption] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [isAISpeaking, setIsAISpeaking] = useState(false);
  const [sessionActive, setSessionActive] = useState(false);
  const [report, setReport] = useState<ComprehensiveAvatarReport | null>(null);
  const [lastSuggestion, setLastSuggestion] = useState("");

  const audioContextRef = useRef<AudioContext | null>(null);
  const recognitionRef = useRef<any>(null);
  const activeAudioSource = useRef<AudioBufferSourceNode | null>(null);

  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.onresult = (event: any) => {
        let final = "";
        for (let i = event.resultIndex; i < event.results.length; i++) if (event.results[i].isFinal) final += event.results[i][0].transcript;
        if (final) setCurrentCaption(prev => prev + (prev ? " " : "") + final);
      };
      recognitionRef.current = recognition;
    }
  }, []);

  const playAIQuestion = async (text: string) => {
    setIsAISpeaking(true);
    try {
      if (!audioContextRef.current) audioContextRef.current = new AudioContext({ sampleRate: 24000 });
      const personality = FAMOUS_PERSONALITIES.find(p => p.id === meetingContext.famousPersonaId);
      const voice = personality?.voice || 'Charon';
      const bytes = await generatePitchAudio(text, voice);
      if (bytes) {
        const buffer = await decodeAudioData(bytes, audioContextRef.current, 24000, 1);
        const source = audioContextRef.current.createBufferSource();
        source.buffer = buffer; source.connect(audioContextRef.current.destination);
        source.onended = () => { setIsAISpeaking(false); startListening(); };
        activeAudioSource.current = source; source.start();
      }
    } catch (e) { setIsAISpeaking(false); }
  };

  const startListening = () => { if (recognitionRef.current && !isAISpeaking) try { recognitionRef.current.start(); } catch (e) {} };
  const stopListening = () => recognitionRef.current?.stop();

  const handleInitiate = async () => {
    setSessionActive(true); setIsProcessing(true); setMessages([]); setCurrentCaption("");
    try {
      const stream = streamAvatarSimulation("START SIMULATION", [], meetingContext);
      let first = ""; for await (const chunk of stream) first += chunk;
      const assistantMsg: GPTMessage = { id: Date.now().toString(), role: 'assistant', content: first, mode: 'standard' };
      setMessages([assistantMsg]); playAIQuestion(first);
    } catch (e) { console.error(e); } finally { setIsProcessing(false); }
  };

  const handleNextNode = async () => {
    if (isProcessing || !currentCaption.trim()) return;
    stopListening(); setIsProcessing(true);
    const userMsg: GPTMessage = { id: Date.now().toString(), role: 'user', content: currentCaption, mode: 'standard' };
    const updated = [...messages, userMsg]; setMessages(updated);
    try {
      const stream = streamAvatarSimulation(currentCaption, messages, meetingContext);
      let next = ""; for await (const chunk of stream) next += chunk;
      let display = next;
      const suggestionMatch = next.match(/\[SUGGESTION: (.*?)\]/);
      if (suggestionMatch) { setLastSuggestion(suggestionMatch[1]); display = next.replace(/\[SUGGESTION: .*?\]/, "").trim(); }
      const assistantMsg: GPTMessage = { id: (Date.now() + 1).toString(), role: 'assistant', content: display, mode: 'standard' };
      setMessages([...updated, assistantMsg]); setCurrentCaption(""); playAIQuestion(display);
    } catch (e) { } finally { setIsProcessing(false); }
  };

  return (
    <div className="bg-slate-950 min-h-[calc(100vh-64px)] flex flex-col text-white p-12">
      {!sessionActive ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center space-y-12">
           <ICONS.Brain className="w-32 h-32 text-indigo-500 animate-pulse" />
           <h2 className="text-6xl font-black">Initiate Presence Engine</h2>
           <button onClick={handleInitiate} className="px-16 py-8 bg-indigo-600 rounded-full font-black text-2xl uppercase shadow-2xl hover:scale-105 transition-all">Start Simulation</button>
        </div>
      ) : (
        <div className="max-w-5xl mx-auto w-full space-y-12">
           <div className="text-center">
              <span className="px-6 py-2 bg-indigo-600/20 text-indigo-400 text-xs font-black uppercase tracking-widest rounded-full border border-indigo-500/20">
                 Identity: {FAMOUS_PERSONALITIES.find(p => p.id === meetingContext.famousPersonaId)?.name || meetingContext.clientNames || 'Executive Client'}
              </span>
           </div>
           <div className="bg-white/5 backdrop-blur-xl p-12 rounded-[4rem] border border-white/10 shadow-2xl">
              <p className="text-4xl font-bold italic text-white tracking-tight">{messages[messages.length - 1]?.content || "Connecting..."}</p>
           </div>
           <div className="space-y-8">
              <textarea value={currentCaption} onChange={(e) => setCurrentCaption(e.target.value)} className="w-full bg-slate-900 border-2 border-slate-800 rounded-[3rem] px-12 py-10 text-2xl outline-none focus:border-indigo-500 transition-all font-medium italic text-white h-48 resize-none placeholder:text-slate-800" placeholder="Awaiting your response..." />
              {lastSuggestion && <div className="p-8 bg-indigo-600/10 border border-indigo-500/20 rounded-[2.5rem] text-center"><p className="text-sm font-bold text-indigo-300 italic">"Coach Directive: {lastSuggestion}"</p></div>}
              <button onClick={handleNextNode} disabled={isProcessing || !currentCaption.trim()} className="w-full py-8 bg-indigo-600 text-white rounded-[2.5rem] font-black text-xl uppercase shadow-2xl hover:bg-indigo-700 disabled:opacity-50">Commit Logic</button>
           </div>
        </div>
      )}
    </div>
  );
};
