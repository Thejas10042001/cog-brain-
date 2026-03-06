import React, { useState, useEffect, useRef, useMemo } from 'react';
import { ICONS } from '../constants';
import { generateAssessmentQuestions, evaluateAssessment, generatePitchAudio, decodeAudioData } from '../services/geminiService';
import { AssessmentQuestion, AssessmentResult, QuestionType, DifficultyLevel } from '../types';

const MetricScale = ({ label, value, colorClass = "bg-indigo-600" }: { label: string, value: number, colorClass?: string }) => (
  <div className="space-y-2">
    <div className="flex justify-between items-center">
      <div className="flex items-center gap-2">
        <div className={`w-1.5 h-1.5 rounded-full ${colorClass}`} />
        <span className="text-[9px] font-black uppercase text-slate-400 tracking-widest">{label}</span>
      </div>
      <span className="text-[10px] font-black text-white">{value}%</span>
    </div>
    <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
      <div 
        className={`h-full ${colorClass} transition-all duration-1000 ease-out`} 
        style={{ width: `${value}%` }}
      />
    </div>
  </div>
);

const ModelDeliveryPlayer = ({ script }: { script: string }) => {
  const [isPlaying, setIsPlaying] = useState(false);

  const playScript = async () => {
    if (isPlaying) return;
    setIsPlaying(true);
    try {
      const audioUrl = await generatePitchAudio(script, 'Zephyr');
      if (audioUrl) {
        const audio = new Audio(URL.createObjectURL(new Blob([audioUrl], { type: 'audio/wav' })));
        audio.onended = () => setIsPlaying(false);
        audio.play();
      }
    } catch (error) {
      console.error("Model delivery failed:", error);
      setIsPlaying(false);
    }
  };

  return (
    <div className="p-8 bg-slate-900 text-white rounded-[2.5rem] shadow-2xl relative overflow-hidden group">
      <div className="absolute top-0 right-0 p-6 opacity-10">
        <ICONS.Sparkles className="w-16 h-16" />
      </div>
      
      <div className="relative z-10 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-slate-700 rounded-2xl flex items-center justify-center shadow-lg">
              <ICONS.Brain className="w-6 h-6" />
            </div>
            <div>
              <h5 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Master Model Delivery</h5>
              <p className="text-[8px] font-bold text-emerald-500 uppercase tracking-widest mt-1">Neural Coach Active</p>
            </div>
          </div>
          <button 
            onClick={playScript}
            disabled={isPlaying}
            className={`flex items-center gap-2 px-6 py-2 rounded-full text-[9px] font-black uppercase tracking-widest transition-all ${isPlaying ? 'bg-indigo-600 text-white animate-pulse' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}
          >
            <ICONS.Speaker className="w-3 h-3" />
            {isPlaying ? 'Delivering...' : 'Play Model Delivery'}
          </button>
        </div>
        <p className="text-xl font-medium leading-relaxed italic text-slate-300">
          “{script}”
        </p>
        <div className="flex items-center gap-3 pt-4 border-t border-white/10">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-[8px] font-black uppercase text-slate-500 tracking-widest">
            Coach Active (Neural Vocal Profile: Zephyr)
          </span>
        </div>
      </div>
    </div>
  );
};

interface AssessmentLabProps {
  activeDocuments: { name: string; content: string }[];
  onStartSimulation?: () => void;
}

type Perspective = 'document' | 'customer';

export const AssessmentLab: React.FC<AssessmentLabProps> = ({ activeDocuments, onStartSimulation }) => {
  const [stage, setStage] = useState<'config' | 'running' | 'results'>('config');
  const [config, setConfig] = useState<{
    mcq: number;
    short: number;
    long: number;
    mic: number;
    video: number;
    timer: number;
    difficulty: DifficultyLevel;
  }>({ mcq: 5, short: 0, long: 0, mic: 0, video: 0, timer: 10, difficulty: 'Medium' });
  const [perspective, setPerspective] = useState<Perspective>('document');
  const [questions, setQuestions] = useState<AssessmentQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [timeByQuestion, setTimeByQuestion] = useState<Record<string, number>>({});
  const [results, setResults] = useState<AssessmentResult[]>([]);
  const [timeLeft, setTimeLeft] = useState(0);
  const [totalSessionTime, setTotalSessionTime] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [micPermissionError, setMicPermissionError] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const timerRef = useRef<any>(null);
  const lastTimeRef = useRef<number>(0);
  const recognitionRef = useRef<any>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      // We'll initialize on demand in toggleRecording for better reliability
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, []);

  useEffect(() => {
    const currentQ = questions[currentIdx];
    if (stage === 'running' && currentQ?.type === 'video') {
      startCamera();
    } else {
      stopCamera();
    }
    return () => stopCamera();
  }, [stage, currentIdx, questions]);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (e) {
      console.error("Camera access denied:", e);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  };

  const toggleRecording = async () => {
    if (isRecording) {
      if (recognitionRef.current) recognitionRef.current.stop();
      setIsRecording(false);
    } else {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (!SpeechRecognition) return;

      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onresult = (event: any) => {
        let interimTranscript = '';
        let finalTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          } else {
            interimTranscript += event.results[i][0].transcript;
          }
        }

        const currentQId = questions[currentIdx]?.id;
        if (currentQId) {
          setAnswers(prev => ({
            ...prev,
            [currentQId]: (prev[currentQId] || '') + finalTranscript
          }));
        }
      };

      recognition.onerror = (event: any) => {
        if (event.error === 'not-allowed') setMicPermissionError(true);
        setIsRecording(false);
      };

      recognition.onend = () => {
        if (isRecording) recognition.start();
      };

      recognitionRef.current = recognition;
      try {
        await navigator.mediaDevices.getUserMedia({ audio: true });
        recognition.start();
        setIsRecording(true);
      } catch (e) {
        console.error("Failed to start recognition:", e);
        setMicPermissionError(true);
        setIsRecording(false);
      }
    }
  };

  const handleStart = async (customConfig?: typeof config) => {
    if (onStartSimulation) onStartSimulation();
    setIsGenerating(true);
    const activeConfig = customConfig || config;
    try {
      const combined = activeDocuments.map(d => `SOURCE PDF: ${d.name}\n${d.content}`).join('\n');
      const qSet = await generateAssessmentQuestions(combined, activeConfig, perspective);
      setQuestions(qSet);
      
      const seconds = activeConfig.timer * 60;
      setTimeLeft(seconds);
      setTotalSessionTime(seconds);
      setStage('running');
      setAnswers({});
      setTimeByQuestion({});
      setCurrentIdx(0);
      lastTimeRef.current = seconds;
      
      timerRef.current = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            handleSubmit();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } catch (e) {
      console.error(e);
    } finally {
      setIsGenerating(false);
    }
  };

  const recordCurrentQuestionTime = () => {
    const qId = questions[currentIdx]?.id;
    if (qId) {
      const timeElapsedSinceLastMark = lastTimeRef.current - timeLeft;
      setTimeByQuestion(prev => ({
        ...prev,
        [qId]: (prev[qId] || 0) + timeElapsedSinceLastMark
      }));
      lastTimeRef.current = timeLeft;
    }
  };

  const handleNext = () => {
    recordCurrentQuestionTime();
    if (isRecording) toggleRecording();
    setCurrentIdx(prev => prev + 1);
  };

  const handlePrevious = () => {
    recordCurrentQuestionTime();
    setCurrentIdx(prev => Math.max(0, prev - 1));
  };

  const handleSubmit = async () => {
    recordCurrentQuestionTime();
    if (timerRef.current) clearInterval(timerRef.current);
    if (recognitionRef.current) recognitionRef.current.stop();
    stopCamera();
    setIsEvaluating(true);
    try {
      const evals = await evaluateAssessment(questions, answers);
      const mappedResults = evals.map(e => ({
        ...e,
        timeSpent: timeByQuestion[e.questionId] || 0
      }));
      setResults(mappedResults);
      setStage('results');
    } catch (e) {
      console.error(e);
    } finally {
      setIsEvaluating(false);
    }
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const exportPDF = async () => {
    setIsExporting(true);
    try {
      const { jsPDF } = (window as any).jspdf;
      const doc = new jsPDF();
      let y = 20;

      doc.setFontSize(22);
      doc.text("Assignment Readiness Report", 20, y);
      y += 15;

      doc.setFontSize(10);
      doc.text(`Completed on: ${new Date().toLocaleString()}`, 20, y);
      y += 10;

      questions.forEach((q, idx) => {
        const res = results.find(r => r.questionId === q.id);
        if (y > 250) { doc.addPage(); y = 20; }
        
        doc.setFont("helvetica", "bold");
        doc.text(`${idx + 1}. [${q.type.toUpperCase()}] ${q.text}`, 20, y, { maxWidth: 170 });
        y += 10;

        doc.setFont("helvetica", "normal");
        doc.text(`Your Answer: ${res?.userAnswer || "N/A"}`, 25, y, { maxWidth: 165 });
        y += 10;

        doc.setTextColor(79, 70, 229);
        doc.text(`Correct Logic: ${q.correctAnswer} (${res?.timeSpent}s spent)`, 25, y, { maxWidth: 165 });
        doc.setTextColor(0);
        y += 10;

        doc.setFont("helvetica", "italic");
        doc.text(`Coaching: ${res?.evaluation.feedback || ""}`, 25, y, { maxWidth: 165 });
        y += 15;
      });

      doc.save("Cognitive-Assignment-Report.pdf");
    } catch (e) {
      console.error(e);
    } finally {
      setIsExporting(false);
    }
  };

  if (stage === 'config') {
    return (
      <div className="bg-slate-950 p-12 border-y border-slate-800 animate-in fade-in zoom-in-95 duration-500 min-h-[calc(100vh-64px)]">
        {micPermissionError && (
          <div className="mb-8 bg-rose-900/10 border border-rose-900/30 p-6 rounded-[2.5rem] flex items-center justify-between animate-in slide-in-from-top-4">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-rose-600 text-white rounded-xl shadow-lg">
                <ICONS.Security className="w-6 h-6" />
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-black uppercase tracking-widest text-rose-100">Microphone Access Denied</span>
                <span className="text-xs font-bold text-rose-300 opacity-90">Enable microphone permissions in your browser to use voice-based assignments.</span>
              </div>
            </div>
            <button 
              onClick={() => setMicPermissionError(false)}
              className="px-6 py-2 bg-rose-600 text-white rounded-full text-xs font-black uppercase tracking-widest hover:bg-rose-700 transition-all"
            >
              Dismiss
            </button>
          </div>
        )}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12">
          <div className="flex items-center gap-6">
            <div className="p-5 bg-indigo-600 text-white rounded-[1.5rem] shadow-2xl shadow-indigo-900/40">
              <ICONS.Trophy className="w-10 h-10" />
            </div>
            <div>
              <h2 className="text-4xl font-black text-white tracking-tighter uppercase">Assignment Lab Configuration</h2>
              <p className="text-slate-400 font-black uppercase text-[11px] tracking-[0.4em] mt-2">Pressure-test your document mastery</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 mb-12">
            <div className="space-y-6">
              <h4 className="text-[11px] font-black uppercase tracking-[0.4em] text-indigo-400 border-b-2 border-indigo-900/30 pb-3">Question Parameters</h4>
              <ConfigRow label="MCQ (Logic Gates)" val={config.mcq} set={(v) => setConfig({ ...config, mcq: v })} icon={<ICONS.Document className="w-5 h-5" />} />
              <ConfigRow label="Short Answer (Tactical)" val={config.short} set={(v) => setConfig({ ...config, short: v })} icon={<ICONS.Efficiency className="w-5 h-5" />} />
              <ConfigRow label="Long Answer (Strategic)" val={config.long} set={(v) => setConfig({ ...config, long: v })} icon={<ICONS.Research className="w-5 h-5" />} />
              <ConfigRow label="Microphone (Verbal Delivery)" val={config.mic} set={(v) => setConfig({ ...config, mic: v })} icon={<ICONS.Speaker className="w-5 h-5" />} />
              <ConfigRow label="Video Performance (Visual/Verbal)" val={config.video} set={(v) => setConfig({ ...config, video: v })} icon={<ICONS.Play className="w-5 h-5" />} />
            </div>

          <div className="space-y-12">
            <div className="space-y-6">
              <h4 className="text-[11px] font-black uppercase tracking-[0.4em] text-rose-400 border-b-2 border-rose-900/30 pb-3">Environment Controls</h4>
              <div className="p-10 bg-slate-800/50 rounded-[3rem] space-y-6 shadow-inner border border-slate-800">
                <div className="flex justify-between items-center">
                  <span className="text-[11px] font-black uppercase text-slate-400 tracking-widest">Session Timer</span>
                  <span className="text-3xl font-black text-indigo-400 tracking-tighter">{config.timer}m</span>
                </div>
                <input 
                  type="range" min="1" max="60" 
                  value={config.timer} 
                  onChange={(e) => setConfig({ ...config, timer: parseInt(e.target.value) })}
                  className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                />
              </div>
            </div>

            <div className="space-y-6">
              <h4 className="text-[11px] font-black uppercase tracking-[0.4em] text-amber-400 border-b-2 border-amber-900/30 pb-3">Cognitive Challenge Depth</h4>
              <div className="grid grid-cols-3 gap-4">
                {(['Easy', 'Medium', 'Hard'] as DifficultyLevel[]).map((level) => (
                  <button
                    key={level}
                    onClick={() => setConfig({ ...config, difficulty: level })}
                    className={`py-5 rounded-[1.5rem] text-[11px] font-black uppercase tracking-[0.2em] border-2 transition-all ${config.difficulty === level ? 'bg-amber-500 border-amber-500 text-white shadow-2xl scale-[1.05]' : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-amber-800'}`}
                  >
                    {level}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-6">
              <h4 className="text-[11px] font-black uppercase tracking-[0.4em] text-indigo-400 border-b-2 border-indigo-900/30 pb-3">Synthesis Perspective</h4>
              <div className="grid grid-cols-2 gap-6">
                <button 
                  onClick={() => setPerspective('document')}
                  className={`flex flex-col items-center gap-4 p-8 rounded-[2.5rem] border-2 transition-all group ${perspective === 'document' ? 'bg-indigo-600 border-indigo-600 text-white shadow-2xl scale-[1.05]' : 'bg-slate-800 border-slate-700 hover:border-indigo-300 text-slate-500'}`}
                >
                  <ICONS.Document className={`w-8 h-8 ${perspective === 'document' ? 'text-white' : 'text-indigo-500 group-hover:scale-110 transition-transform'}`} />
                  <div className="text-center">
                    <p className="text-[11px] font-black uppercase tracking-[0.2em]">Document Focused</p>
                  </div>
                </button>

                <button 
                  onClick={() => setPerspective('customer')}
                  className={`flex flex-col items-center gap-4 p-8 rounded-[2.5rem] border-2 transition-all group ${perspective === 'customer' ? 'bg-indigo-600 border-indigo-600 text-white shadow-2xl scale-[1.05]' : 'bg-slate-800 border-slate-700 hover:border-indigo-300 text-slate-500'}`}
                >
                  <ICONS.Brain className={`w-8 h-8 ${perspective === 'customer' ? 'text-white' : 'text-rose-500 group-hover:scale-110 transition-transform'}`} />
                  <div className="text-center">
                    <p className="text-[11px] font-black uppercase tracking-[0.2em]">Buyer Centric</p>
                  </div>
                </button>
              </div>
            </div>
          </div>
        </div>

        <button 
          onClick={() => handleStart()}
          disabled={isGenerating || activeDocuments.length === 0}
          className={`w-full py-10 rounded-[3rem] font-black text-2xl uppercase tracking-[0.3em] transition-all shadow-2xl flex items-center justify-center gap-6 ${isGenerating ? 'bg-slate-800 text-slate-400' : 'bg-indigo-600 text-white hover:bg-indigo-700 hover:scale-[1.01] active:scale-95 shadow-indigo-500/20'}`}
        >
          {isGenerating ? (
            <>
              <div className="w-6 h-6 border-4 border-white/30 border-t-white rounded-full animate-spin"></div>
              Synthesizing...
            </>
          ) : (
            <>
              <ICONS.Brain className="w-8 h-8" />
              Initiate Neural Assignment
            </>
          )}
        </button>
      </div>
    );
  }

  if (stage === 'running') {
    const currentQ = questions[currentIdx];
    const progressPercent = totalSessionTime > 0 ? (timeLeft / totalSessionTime) * 100 : 100;

    return (
      <div className="animate-in fade-in duration-500 min-h-[calc(100vh-64px)] flex flex-col bg-slate-950">
        <div className="bg-slate-900 border-b border-slate-800 overflow-hidden">
          <div className="h-1 w-full bg-slate-800">
             <div className="h-full bg-indigo-500" style={{ width: `${progressPercent}%` }}></div>
          </div>
          <div className="flex items-center justify-between px-10 py-6">
            <div className="flex items-center gap-6">
                <div className="px-4 py-1.5 bg-indigo-600 text-white rounded-full text-[10px] font-black uppercase tracking-widest">
                  Question {currentIdx + 1} / {questions.length}
                </div>
                <div className="text-lg font-black text-white">
                   {formatTime(timeLeft)}
                </div>
            </div>
            <button onClick={handleSubmit} className="px-8 py-2.5 bg-emerald-600 text-white rounded-full text-[10px] font-black uppercase tracking-widest hover:bg-emerald-700 transition-colors">
                Submit Assignment
            </button>
          </div>
        </div>

        <div className="flex-1 bg-slate-950 p-16 relative overflow-hidden flex flex-col">
           <div className="relative z-10 space-y-12 flex-1 flex flex-col justify-center">
              <div className="space-y-4 text-center">
                 <span className="px-4 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest bg-slate-900 text-slate-300">
                    {currentQ.type.toUpperCase()} MODE
                 </span>
                 <h3 className="text-4xl font-black text-white tracking-tight max-w-4xl mx-auto leading-tight">
                   {currentQ.text}
                 </h3>
              </div>

              <div className="min-h-[300px] flex items-center justify-center">
                {currentQ.type === 'mcq' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-5xl">
                    {currentQ.options?.map((opt, i) => (
                      <button
                        key={i}
                        onClick={() => setAnswers(prev => ({ ...prev, [currentQ.id]: opt }))}
                        className={`p-8 rounded-[2rem] border-2 text-left transition-all flex items-center gap-6 ${answers[currentQ.id] === opt ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-slate-900 border-slate-800 text-slate-100 hover:border-indigo-500/50'}`}
                      >
                         <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black ${answers[currentQ.id] === opt ? 'bg-white/20 text-white' : 'bg-slate-800 text-indigo-300'}`}>
                           {String.fromCharCode(65 + i)}
                         </div>
                         <span className="text-lg font-bold">{opt}</span>
                      </button>
                    ))}
                  </div>
                )}

                {(currentQ.type === 'short' || currentQ.type === 'long') && (
                  <div className="w-full max-w-5xl">
                    <textarea 
                      value={answers[currentQ.id] || ""}
                      onChange={(e) => setAnswers(prev => ({ ...prev, [currentQ.id]: e.target.value }))}
                      className="w-full bg-slate-800 border-2 border-slate-700 rounded-[2.5rem] p-10 text-2xl outline-none transition-all h-80 text-white"
                      placeholder="Response..."
                    />
                  </div>
                )}

                {(currentQ.type === 'mic' || currentQ.type === 'video') && (
                  <div className="flex flex-col items-center justify-center gap-10 w-full max-w-5xl">
                     {currentQ.type === 'video' ? (
                       <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 w-full">
                         <div className="relative rounded-[3rem] overflow-hidden bg-slate-800 aspect-video flex items-center justify-center">
                            <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover" />
                         </div>
                         <div className="flex flex-col justify-center gap-6">
                            <textarea 
                              value={answers[currentQ.id] || ""}
                              onChange={(e) => setAnswers(prev => ({ ...prev, [currentQ.id]: e.target.value }))}
                              className="w-full bg-slate-800/50 border-2 border-slate-800 rounded-[2.5rem] p-10 text-lg h-60 text-white"
                              placeholder="Transcribed performance..."
                            />
                            <button 
                              onClick={toggleRecording} 
                              className={`py-5 rounded-full font-black text-lg transition-all border ${isRecording ? 'bg-emerald-600 border-emerald-500 text-white animate-pulse shadow-[0_0_20px_rgba(16,185,129,0.4)]' : 'bg-slate-800 border-slate-700 text-indigo-400 hover:bg-slate-700'}`}
                            >
                               <ICONS.Ear className={`w-6 h-6 inline-block mr-2 ${isRecording ? 'animate-bounce' : ''}`} />
                               {isRecording ? 'Listening...' : 'Activate Microphone'}
                            </button>
                         </div>
                       </div>
                     ) : (
                       <div className="space-y-10 flex flex-col items-center w-full">
                          <button 
                            onClick={() => {}} 
                            className="w-32 h-32 rounded-full flex items-center justify-center bg-slate-800 text-slate-500 cursor-not-allowed opacity-50"
                            title="Voice disabled"
                          >
                             <ICONS.Speaker className="w-12 h-12" />
                          </button>
                          <textarea 
                             value={answers[currentQ.id] || ""}
                             onChange={(e) => setAnswers(prev => ({ ...prev, [currentQ.id]: e.target.value }))}
                             className="w-full p-10 bg-slate-800 rounded-[3rem] border-2 border-slate-700 text-lg h-48 text-white"
                             placeholder="Voice trace..."
                          />
                       </div>
                     )}
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between pt-12">
                <button onClick={handlePrevious} disabled={currentIdx === 0} className="px-8 py-4 bg-slate-800 text-slate-500 rounded-2xl text-[10px] font-black uppercase tracking-widest disabled:opacity-30">
                  Previous Node
                </button>
                {currentIdx < questions.length - 1 ? (
                  <button onClick={handleNext} className="px-10 py-4 bg-indigo-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest">
                    Next Node
                  </button>
                ) : (
                  <button onClick={handleSubmit} className="px-12 py-4 bg-emerald-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest">
                    Final Assignment Submission
                  </button>
                )}
              </div>
           </div>
        </div>
      </div>
    );
  }

  if (stage === 'results') {
    const totalScore = Math.round(results.reduce((acc, r) => acc + r.evaluation.score, 0) / (results.length || 1));
    return (
      <div className="animate-in slide-in-from-bottom-8 duration-700 min-h-[calc(100vh-64px)] flex flex-col bg-slate-950 text-white">
        <div className="p-16 flex flex-col md:flex-row items-center justify-between gap-12 text-left">
           <div className="space-y-8 flex-1">
              <h2 className="text-5xl font-black tracking-tight">Assignment Audit Result</h2>
              <div className="flex items-center gap-4">
                 <div className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest ${config.difficulty === 'Easy' ? 'bg-emerald-100 text-emerald-600' : config.difficulty === 'Medium' ? 'bg-amber-100 text-amber-600' : 'bg-rose-100 text-rose-600'}`}>
                    {config.difficulty} Mode Active
                 </div>
                 <div className="px-4 py-1.5 bg-indigo-900/30 text-indigo-400 rounded-full text-[10px] font-black uppercase tracking-widest">
                    {perspective === 'document' ? 'Document Focused' : 'Buyer Centric'}
                 </div>
              </div>
              <p className="text-slate-500 font-medium text-xl max-w-xl">
                 Neural logic benchmark completed. Your answers have been cross-referenced with the grounded document core.
              </p>
              <div className="flex gap-4">
                 <button onClick={exportPDF} className="px-8 py-3.5 bg-indigo-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl">
                   Export Strategy Report
                 </button>
                 <button onClick={() => setStage('config')} className="px-8 py-3.5 bg-slate-100 text-slate-600 border border-slate-200 rounded-2xl text-[10px] font-black uppercase tracking-widest">
                   Restart Lab
                 </button>
              </div>
           </div>
           <div className="w-64 h-64 bg-indigo-600 rounded-full flex flex-col items-center justify-center border-[12px] border-indigo-50 shadow-2xl">
              <span className="text-[12px] font-black uppercase text-indigo-100 mb-2 tracking-widest">Audit Score</span>
              <span className="text-7xl font-black text-white">{totalScore}%</span>
           </div>
        </div>
        <div className="bg-slate-950 p-12 space-y-12">
           {questions.map((q, idx) => {
             const res = results.find(r => r.questionId === q.id);
             return (
               <div key={q.id} className="bg-slate-900 p-12 border border-slate-800 rounded-[3.5rem] text-white flex flex-col gap-10 shadow-sm relative overflow-hidden group">
                  {/* Source Attribution Badge */}
                  <div className="flex items-center gap-3 px-6 py-2 bg-indigo-900/20 border border-indigo-800 rounded-full w-fit">
                     <ICONS.Document className="w-3.5 h-3.5 text-indigo-400" />
                     <span className="text-[9px] font-black text-indigo-400 uppercase tracking-widest">
                       Source Node: {q.citation?.sourceFile || 'Grounded Core'} 
                       {q.citation?.pageNumber ? ` • Page ${q.citation.pageNumber}` : ''}
                     </span>
                  </div>

                  <div className="space-y-4">
                     <div className="flex justify-between items-start">
                        <h4 className="text-3xl font-black tracking-tight text-white max-w-4xl">{idx + 1}. {q.text}</h4>
                        <div className={`px-6 py-2 rounded-full font-black text-xs uppercase tracking-widest ${res?.evaluation.isCorrect ? 'bg-emerald-900/30 text-emerald-400' : 'bg-rose-900/30 text-rose-400'}`}>
                           {res?.evaluation.isCorrect ? 'Logic Match' : 'Logic Deficit'} • {res?.evaluation.score}%
                        </div>
                     </div>
                  </div>

                   <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                      {/* User Answer Column */}
                      <div className="space-y-6">
                         <div className="flex items-center gap-2 mb-2">
                            <ICONS.Chat className="w-4 h-4 text-slate-400" />
                            <h5 className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Your Protocol Delivery</h5>
                         </div>
                         <div className="p-8 bg-slate-800 rounded-[2.5rem] border border-slate-700 italic text-slate-100 leading-relaxed font-medium">
                            “{res?.userAnswer || "System encountered a null response node."}”
                         </div>

                         {/* Performance Metrics for Video/Mic */}
                         {(q.type === 'video' || q.type === 'mic') && res?.evaluation && (
                           <div className="p-8 bg-slate-900 border border-slate-800 rounded-[2.5rem] space-y-6 shadow-sm">
                              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                                 <h6 className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Biometric & Cognitive Trace</h6>
                                 <div className="flex items-center gap-3">
                                    <div className="flex items-center gap-1">
                                       <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                       <span className="text-[7px] font-bold text-slate-400 uppercase">Optimal</span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                       <div className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                                       <span className="text-[7px] font-bold text-slate-400 uppercase">Critical</span>
                                    </div>
                                 </div>
                              </div>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                 <MetricScale label="Stress Level" value={res.evaluation.stressLevel || 0} colorClass={res.evaluation.stressLevel && res.evaluation.stressLevel > 60 ? "bg-rose-500" : "bg-emerald-500"} />
                                 <MetricScale label="Attention Focus" value={res.evaluation.attentionScore || 0} colorClass="bg-indigo-600" />
                                 <MetricScale label="Eye Contact" value={res.evaluation.eyeContactScore || 0} colorClass="bg-blue-500" />
                                 <MetricScale label="Clarity Score" value={res.evaluation.score} colorClass="bg-indigo-600" />
                              </div>
                              {res.evaluation.behavioralAnalysis && (
                                <div className="pt-4 border-t border-slate-800">
                                   <p className="text-[10px] font-bold text-slate-400 leading-relaxed italic">
                                      <span className="text-indigo-400 not-italic mr-1">Behavioral Audit:</span>
                                      {res.evaluation.behavioralAnalysis}
                                   </p>
                                </div>
                              )}
                           </div>
                         )}
                      </div>

                      {/* Correct Answer Column */}
                      <div className="space-y-6">
                         <div className="flex items-center gap-2 mb-2">
                            <ICONS.Shield className="w-4 h-4 text-indigo-300" />
                            <h5 className="text-[10px] font-black uppercase text-indigo-300 tracking-widest">Master Logic Node</h5>
                         </div>
                         
                         {res?.evaluation.modelDeliveryScript ? (
                           <ModelDeliveryPlayer script={res.evaluation.modelDeliveryScript} />
                         ) : (
                           <div className="p-8 bg-indigo-900/20 text-white rounded-[2.5rem] border border-indigo-900/30 shadow-sm leading-relaxed">
                              <p className="text-[11px] font-black uppercase tracking-widest text-indigo-300 mb-3">Protocol Blocked: That was not the target answer. The master logic is as follows:</p>
                              <p className="text-xl font-bold">“{q.correctAnswer}”</p>
                           </div>
                         )}
                      </div>
                   </div>

                  {/* Strategic Insight Full Width */}
                  <div className="p-10 bg-emerald-900/10 rounded-[3rem] border border-emerald-900/30 space-y-4">
                     <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-emerald-600 text-white rounded-xl shadow-lg"><ICONS.Brain className="w-4 h-4" /></div>
                        <h5 className="text-[11px] font-black uppercase text-emerald-400 tracking-[0.2em]">Cognitive Strategic Insight</h5>
                     </div>
                     <p className="text-md font-bold text-emerald-100 leading-relaxed italic">
                        {q.explanation}
                     </p>
                     <div className="pt-4 border-t border-emerald-900/30 flex items-center gap-3">
                        <span className="text-[9px] font-black uppercase text-emerald-400 tracking-widest">Coach Assignment:</span>
                        <p className="text-sm font-medium text-emerald-300">{res?.evaluation.feedback}</p>
                     </div>
                  </div>
               </div>
             );
           })}
        </div>
      </div>
    );
  }

  return null;
};

const ConfigRow = ({ label, val, set, icon }: { label: string; val: number; set: (v: number) => void; icon: React.ReactNode }) => (
  <div className="flex items-center justify-between p-8 bg-slate-900 rounded-[2rem] border border-slate-800 hover:border-indigo-900/30 group transition-all">
    <div className="flex items-center gap-5">
      <div className="text-slate-400 group-hover:text-indigo-400 transition-colors transform group-hover:scale-110 duration-300">{icon}</div>
      <span className="text-[12px] font-black uppercase text-slate-300 tracking-widest">{label}</span>
    </div>
    <div className="flex items-center gap-6">
       <button 
        onClick={() => set(Math.max(0, val - 1))} 
        className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center hover:bg-rose-900/30 hover:text-rose-400 transition-all font-black text-slate-300 shadow-sm active:scale-90"
       >
        -
       </button>
       <span className="w-10 text-center font-black text-xl text-indigo-400 tabular-nums">{val}</span>
       <button 
        onClick={() => set(val + 1)} 
        className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center hover:bg-emerald-900/30 hover:text-emerald-400 transition-all font-black text-slate-300 shadow-sm active:scale-90"
       >
        +
       </button>
    </div>
  </div>
);