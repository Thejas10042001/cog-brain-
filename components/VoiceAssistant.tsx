
import React, { useEffect, useState, useRef, useCallback } from 'react';
import { generateVoiceSample, generateAssistantResponse } from '../services/geminiService';
import { ICONS } from '../constants';

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
}

export const VoiceAssistant: React.FC<VoiceAssistantProps> = ({ activeTab, user, onCommand }) => {
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
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
      const base64 = await generateVoiceSample(text, 'Zephyr', 'Male');
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
    } else {
      setMode('idle');
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {}
      }
    }
  };

  if (!SpeechRecognition) return null;

  return (
    <div className="fixed bottom-6 right-6 z-[100] flex items-center gap-4">
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
  );
};
