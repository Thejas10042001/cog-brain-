
import React, { useEffect, useState, useRef, useCallback } from 'react';
import { generateVoiceSample, generateAssistantResponse } from '../services/geminiService';
import { ICONS } from '../constants';

import { MeetingContext, VocalPersonaStructure } from '../types';

declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

interface VoiceAssistantProps {
  activeTab?: string;
  user?: any;
  onCommand?: (command: string) => void;
  context?: MeetingContext;
  onContextChange?: (context: MeetingContext) => void;
}

export const VoiceAssistant: React.FC<VoiceAssistantProps> = ({ activeTab, user, onCommand, context, onContextChange }) => {
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [quotaExceeded, setQuotaExceeded] = useState<{ exceeded: boolean; retryAfter?: string }>({ exceeded: false });
  const [mode, setMode] = useState<'idle' | 'query'>('idle');
  const recognitionRef = useRef<any>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const mountedRef = useRef(true);
  const generationIdRef = useRef(0);

  const speak = useCallback(async (text: string) => {
    if (!mountedRef.current) return;
    const currentGenId = ++generationIdRef.current;
    
    try {
      // Stop any existing audio immediately
      if (audioRef.current) {
        try {
          audioRef.current.pause();
        } catch (e) {
          // Ignore pause errors
        }
        audioRef.current = null;
      }

      setIsProcessing(true);
      setQuotaExceeded({ exceeded: false });
      
      const voice = context?.vocalPersonaAnalysis?.baseVoice || 'Zephyr';
      const gender = context?.vocalPersonaAnalysis?.gender || 'Male';
      const analysis = context?.vocalPersonaAnalysis;
      
      const base64 = await generateVoiceSample(text, voice, gender, analysis);
      setIsProcessing(false);
      
      // If a new generation started while we were waiting, abort this one
      if (currentGenId !== generationIdRef.current || !mountedRef.current) return;

      setIsSpeaking(true);
      const audio = new Audio(`data:audio/wav;base64,${base64}`);
      audioRef.current = audio;
      
      return new Promise<void>((resolve) => {
        audio.onended = () => {
          if (currentGenId === generationIdRef.current) {
            setIsSpeaking(false);
            audioRef.current = null;
          }
          resolve();
        };
        audio.onerror = () => {
          if (currentGenId === generationIdRef.current) {
            setIsSpeaking(false);
            audioRef.current = null;
          }
          resolve();
        };
        audio.play().catch(err => {
          // The play() request was interrupted by a call to pause() is usually an AbortError
          // Autoplay block is NotAllowedError
          const isInterrupted = err.name === 'AbortError' || 
                               err.name === 'NotAllowedError' ||
                               (err.message && err.message.includes('interrupted by a call to pause')) ||
                               (err.message && err.message.includes('interact with the document first'));
          
          if (!isInterrupted) {
            console.error("Audio play failed:", err);
          }
          if (currentGenId === generationIdRef.current) {
            setIsSpeaking(false);
            audioRef.current = null;
          }
          resolve();
        });
      });
    } catch (err: any) {
      if (currentGenId === generationIdRef.current) {
        console.error("Voice Assistant speak failed:", err);
        setIsSpeaking(false);
        setIsProcessing(false);
        
        const errorStr = JSON.stringify(err);
        if (errorStr.includes("RESOURCE_EXHAUSTED") || err.code === 429) {
          let retryAfter = "later";
          const match = errorStr.match(/retry in ([\d.]+)s/);
          if (match) {
            retryAfter = `in ${Math.round(parseFloat(match[1]))}s`;
          }
          setQuotaExceeded({ exceeded: true, retryAfter });
          
          // Reset quota error after 10 seconds
          setTimeout(() => setQuotaExceeded({ exceeded: false }), 10000);
        }
      }
    }
  }, []);

  const startListening = useCallback(() => {
    if (!SpeechRecognition || !mountedRef.current) return;

    // Don't start if already speaking or processing
    if (isSpeaking || isProcessing) return;

    // Don't start if in a simulation tab that needs the microphone
    const simulationTabs = ['avatar', 'avatar2', 'avatar-staged', 'practice', 'qa'];
    if (simulationTabs.includes(activeTab)) {
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch (e) {}
        recognitionRef.current = null;
      }
      setIsListening(false);
      return;
    }

    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {}
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = mode === 'idle'; // Continuous in idle to wait for manual trigger or just stay alive
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onresult = async (event: any) => {
      if (mode === 'idle') return; // Ignore results in idle mode

      let transcript = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        transcript += event.results[i][0].transcript;
      }
      transcript = transcript.toLowerCase().trim();
      
      const isFinal = event.results[event.results.length - 1].isFinal;
      
      console.log("Assistant Heard:", transcript, isFinal ? "(Final)" : "(Interim)");

      if (isFinal && transcript) {
        recognition.stop();
        setIsProcessing(true);
        const response = await generateAssistantResponse(transcript, `User is currently on the ${activeTab} tab. User: ${user?.email || 'Anonymous'}`);
        setIsProcessing(false);
        await speak(response);
        setMode('idle');
      }
    };

    recognition.onerror = (event: any) => {
      if (event.error === 'not-allowed') {
        console.error("Speech recognition error: Permission denied (not-allowed)");
        setPermissionDenied(true);
        setIsListening(false);
        return; // Stop retrying if permission is denied
      }
      
      if (event.error !== 'no-speech' && event.error !== 'aborted') {
        console.error("Speech recognition error:", event.error);
      }
      if (mountedRef.current && !isSpeaking) {
        setTimeout(startListening, 300);
      }
    };

    recognition.onend = () => {
      if (mountedRef.current && !isSpeaking) {
        startListening();
      }
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
      setIsListening(true);
    } catch (e) {
      // Ignore if already started
    }
  }, [isSpeaking, speak, mode, activeTab, user]);

  useEffect(() => {
    mountedRef.current = true;
    startListening();
    return () => {
      mountedRef.current = false;
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {}
      }
      if (audioRef.current) audioRef.current.pause();
    };
  }, [startListening]);

  // Handle external speak requests via custom events
  useEffect(() => {
    const handleExternalSpeak = async (e: any) => {
      if (e.detail && typeof e.detail.text === 'string') {
        // Stop recognition while speaking
        if (recognitionRef.current) {
          try {
            recognitionRef.current.stop();
          } catch (err) {}
        }
        
        // If it's an interrupt request, we should stop current audio first
        if (audioRef.current) {
          audioRef.current.pause();
          audioRef.current = null;
        }

        await speak(e.detail.text);
      }
    };
    window.addEventListener('assistant-speak', handleExternalSpeak);
    return () => window.removeEventListener('assistant-speak', handleExternalSpeak);
  }, [speak]);

  const handleRetry = () => {
    setPermissionDenied(false);
    startListening();
  };

  const toggleListening = () => {
    if (isSpeaking) {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      setIsSpeaking(false);
      return;
    }

    if (mode === 'idle') {
      setMode('query');
      setShowSettings(false);
    } else {
      setMode('idle');
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {}
      }
    }
  };

  const updateVocalAnalysis = (updates: Partial<VocalPersonaStructure>) => {
    if (!context || !onContextChange) return;
    const current = context.vocalPersonaAnalysis || {
      pitch: 'Moderate',
      tempo: 'Controlled',
      cadence: 'Strategic',
      accent: 'Neutral',
      emotionalBaseline: 'Steady',
      breathingPatterns: 'Regulated',
      mimicryDirective: '',
      baseVoice: 'Zephyr',
      gender: 'Male',
      pace: 1.0,
      stability: 80,
      clarity: 90,
      pitchValue: 1.0,
      toneAdjectives: []
    };
    onContextChange({
      ...context,
      vocalPersonaAnalysis: { ...current, ...updates }
    });
  };

  if (!SpeechRecognition) return null;

  return (
    <div className="fixed bottom-6 right-6 z-[100] flex flex-col items-end gap-4">
      {showSettings && context && (
        <div className="bg-white/95 backdrop-blur-xl border-2 border-indigo-100 p-6 rounded-[2rem] shadow-2xl w-72 animate-in slide-in-from-bottom-4 duration-300 space-y-6 mb-2">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <h4 className="text-xs font-black uppercase tracking-widest text-slate-900">Voice Synthesis</h4>
            <button onClick={() => setShowSettings(false)} className="text-slate-400 hover:text-rose-500 transition-colors">
              <ICONS.X className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Voice Model</label>
              <select 
                value={context.vocalPersonaAnalysis?.baseVoice || 'Zephyr'}
                onChange={(e) => updateVocalAnalysis({ baseVoice: e.target.value })}
                className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl px-4 py-3 text-xs font-bold text-slate-700 outline-none focus:border-indigo-500 transition-all"
              >
                <option value="Zephyr">Zephyr (Calm)</option>
                <option value="Puck">Puck (Persuasive)</option>
                <option value="Charon">Charon (Serious)</option>
                <option value="Kore">Kore (Professional)</option>
                <option value="Fenrir">Fenrir (Authoritative)</option>
              </select>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center ml-1">
                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Speaking Rate</label>
                <span className="text-[10px] font-black text-indigo-600">{context.vocalPersonaAnalysis?.pace || 1.0}x</span>
              </div>
              <input 
                type="range" min="0.5" max="2.0" step="0.1"
                value={context.vocalPersonaAnalysis?.pace || 1.0}
                onChange={(e) => updateVocalAnalysis({ pace: parseFloat(e.target.value) })}
                className="w-full h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-indigo-600"
              />
              <div className="flex justify-between text-[8px] font-bold text-slate-300 uppercase tracking-tighter px-1">
                <span>Slower</span>
                <span>Faster</span>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center ml-1">
                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Pitch</label>
                <span className="text-[10px] font-black text-indigo-600">{context.vocalPersonaAnalysis?.pitchValue || 1.0}x</span>
              </div>
              <input 
                type="range" min="0.5" max="2.0" step="0.1"
                value={context.vocalPersonaAnalysis?.pitchValue || 1.0}
                onChange={(e) => updateVocalAnalysis({ pitchValue: parseFloat(e.target.value) })}
                className="w-full h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-indigo-600"
              />
            </div>
          </div>

          <button 
            onClick={() => setShowSettings(false)}
            className="w-full py-3 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg hover:bg-indigo-700 transition-all"
          >
            Apply Settings
          </button>
        </div>
      )}

      <div className="flex items-center gap-4">
        {quotaExceeded.exceeded && (
        <div className="bg-amber-50 border border-amber-200 px-4 py-2 rounded-2xl shadow-xl flex items-center gap-3 animate-in slide-in-from-right-4">
          <ICONS.Shield className="w-4 h-4 text-amber-500" />
          <div className="flex flex-col">
            <span className="text-[10px] font-black text-amber-600 uppercase tracking-widest">API Quota Exceeded</span>
            <span className="text-[8px] font-bold text-amber-400 uppercase tracking-tighter">
              Please retry {quotaExceeded.retryAfter}
            </span>
          </div>
        </div>
      )}
      {permissionDenied && (
        <div className="bg-rose-50 border border-rose-200 px-4 py-2 rounded-2xl shadow-xl flex items-center gap-3 animate-in slide-in-from-right-4">
          <ICONS.Security className="w-4 h-4 text-rose-500" />
          <div className="flex flex-col">
            <span className="text-[10px] font-black text-rose-600 uppercase tracking-widest">Mic Access Denied</span>
            <button 
              onClick={handleRetry}
              className="text-[8px] font-bold text-rose-400 hover:text-rose-600 underline text-left uppercase tracking-tighter"
            >
              Click to retry permission
            </button>
          </div>
        </div>
      )}
      {isProcessing && (
        <div className="bg-white/90 backdrop-blur-md px-4 py-2 rounded-2xl shadow-xl border border-indigo-100 animate-pulse flex items-center gap-2">
          <div className="w-2 h-2 bg-indigo-600 rounded-full animate-bounce"></div>
          <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">Processing...</span>
        </div>
      )}
      <div className="flex items-center gap-3">
        <button 
          onClick={() => setShowSettings(!showSettings)}
          className={`w-10 h-10 rounded-full flex items-center justify-center shadow-xl transition-all ${showSettings ? 'bg-indigo-600 text-white' : 'bg-white text-slate-400 hover:text-indigo-600 border border-slate-100'}`}
        >
          <ICONS.Settings className={`w-5 h-5 ${showSettings ? 'animate-spin-slow' : ''}`} />
        </button>
        <button 
          onClick={toggleListening}
          className={`w-14 h-14 rounded-full flex items-center justify-center shadow-2xl transition-all duration-500 ${
            isSpeaking ? 'bg-indigo-600 scale-110' : 
            mode === 'query' ? 'bg-emerald-500 scale-110 animate-pulse' : 
            'bg-white hover:scale-105'
          } border-2 ${isSpeaking ? 'border-indigo-400' : 'border-indigo-100'}`}
        >
          {isSpeaking ? (
            <div className="flex gap-1 items-center">
              <div className="w-1 h-4 bg-white rounded-full animate-[bounce_0.6s_infinite]"></div>
              <div className="w-1 h-6 bg-white rounded-full animate-[bounce_0.8s_infinite]"></div>
              <div className="w-1 h-4 bg-white rounded-full animate-[bounce_0.6s_infinite]"></div>
            </div>
          ) : mode === 'query' ? (
            <ICONS.Ear className="w-6 h-6 text-white" />
          ) : (
            <div className="relative">
              <div className={`absolute -inset-2 bg-indigo-500/20 rounded-full animate-ping ${isListening ? 'block' : 'hidden'}`}></div>
              <ICONS.Brain className="w-6 h-6 text-indigo-600" />
            </div>
          )}
        </button>
      </div>
    </div>
  </div>
  );
};
