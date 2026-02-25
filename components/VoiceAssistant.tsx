
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
  const [mode, setMode] = useState<'wake_word' | 'query'>('wake_word');
  const recognitionRef = useRef<any>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const mountedRef = useRef(true);

  const speak = useCallback(async (text: string) => {
    if (!mountedRef.current) return;
    try {
      // Stop any existing audio immediately
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }

      setIsProcessing(true);
      const base64 = await generateVoiceSample(text, 'Zephyr', 'Male');
      setIsProcessing(false);
      
      if (!mountedRef.current) return;

      setIsSpeaking(true);
      const audio = new Audio(`data:audio/wav;base64,${base64}`);
      audioRef.current = audio;
      
      return new Promise<void>((resolve) => {
        audio.onended = () => {
          setIsSpeaking(false);
          audioRef.current = null;
          resolve();
        };
        audio.onerror = () => {
          setIsSpeaking(false);
          audioRef.current = null;
          resolve();
        };
        audio.play().catch(err => {
          console.error("Audio play failed:", err);
          setIsSpeaking(false);
          audioRef.current = null;
          resolve();
        });
      });
    } catch (err) {
      console.error("Voice Assistant speak failed:", err);
      setIsSpeaking(false);
    }
  }, []);

  const startListening = useCallback(() => {
    if (!SpeechRecognition || !mountedRef.current) return;

    // Don't start if already speaking
    if (isSpeaking) return;

    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {}
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true; // Use interim results for faster wake word detection
    recognition.lang = 'en-US';

    recognition.onresult = async (event: any) => {
      let transcript = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        transcript += event.results[i][0].transcript;
      }
      transcript = transcript.toLowerCase().trim();
      
      // Only process final results or specific wake word patterns in interim
      const isFinal = event.results[event.results.length - 1].isFinal;
      
      console.log("Cogni Heard:", transcript, isFinal ? "(Final)" : "(Interim)");

      const wakeWords = ["hey cogni", "ok cogni", "hey cogney", "ok cogney", "hey cogny", "ok cogny", "hey cockney", "ok cockney"];
      const detectedWakeWord = wakeWords.some(word => transcript.includes(word));

      if (mode === 'wake_word') {
        if (detectedWakeWord) {
          recognition.stop();
          setMode('query');
          await speak("How may I help you?");
        }
      } else if (isFinal) {
        recognition.stop();
        setIsProcessing(true);
        const response = await generateAssistantResponse(transcript, `User is currently on the ${activeTab} tab. User: ${user?.email || 'Anonymous'}`);
        setIsProcessing(false);
        await speak(response);
        setMode('wake_word');
      }
    };

    recognition.onerror = (event: any) => {
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
    window.addEventListener('cogni-speak', handleExternalSpeak);
    return () => window.removeEventListener('cogni-speak', handleExternalSpeak);
  }, [speak]);

  if (!SpeechRecognition) return null;

  return (
    <div className="fixed bottom-6 right-6 z-[100] flex items-center gap-4">
      {isProcessing && (
        <div className="bg-white/90 backdrop-blur-md px-4 py-2 rounded-2xl shadow-xl border border-indigo-100 animate-pulse flex items-center gap-2">
          <div className="w-2 h-2 bg-indigo-600 rounded-full animate-bounce"></div>
          <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">Cogni Processing...</span>
        </div>
      )}
      <div 
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
      </div>
    </div>
  );
};
