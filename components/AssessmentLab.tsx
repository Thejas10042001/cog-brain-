
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { ICONS } from '../constants';
import { generateAssessmentQuestions, evaluateAssessment } from '../services/geminiService';
import { AssessmentQuestion, AssessmentResult, QuestionType } from '../types';

interface AssessmentLabProps {
  activeDocuments: { name: string; content: string }[];
}

type Perspective = 'document' | 'customer';

export const AssessmentLab: React.FC<AssessmentLabProps> = ({ activeDocuments }) => {
  const [stage, setStage] = useState<'config' | 'running' | 'results'>('config');
  const [config, setConfig] = useState({ mcq: 5, short: 0, long: 0, mic: 0, video: 0, timer: 10 });
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
  const [isExporting, setIsExporting] = useState(false);

  const timerRef = useRef<any>(null);
  const lastTimeRef = useRef<number>(0);
  const recognitionRef = useRef<any>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onresult = (event: any) => {
        let transcript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript;
        }
        const qId = questions[currentIdx]?.id;
        if (qId) {
          setAnswers(prev => ({ ...prev, [qId]: transcript }));
        }
      };

      recognition.onend = () => {
        setIsRecording(false);
      };

      recognitionRef.current = recognition;
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, [questions, currentIdx]);

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

  const toggleRecording = () => {
    if (!recognitionRef.current) {
      alert("Speech Recognition is not supported in this browser.");
      return;
    }

    if (isRecording) {
      recognitionRef.current.stop();
      setIsRecording(false);
    } else {
      try {
        recognitionRef.current.start();
        setIsRecording(true);
      } catch (e) {
        console.error("Speech start error:", e);
      }
    }
  };

  const handleStart = async (customConfig?: typeof config) => {
    setIsGenerating(true);
    const activeConfig = customConfig || config;
    try {
      const combined = activeDocuments.map(d => d.content).join('\n');
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
      doc.text("Assessment Readiness Report", 20, y);
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

      doc.save("Cognitive-Assessment-Report.pdf");
    } catch (e) {
      console.error(e);
    } finally {
      setIsExporting(false);
    }
  };

  if (stage === 'config') {
    return (
      <div className="bg-white p-12 border-y border-slate-200 animate-in fade-in zoom-in-95 duration-500 min-h-[calc(100vh-64px)]">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
          <div className="flex items-center gap-4">
            <div className="p-4 bg-indigo-600 text-white rounded-2xl shadow-xl shadow-indigo-100">
              <ICONS.Trophy className="w-8 h-8" />
            </div>
            <div>
              <h2 className="text-3xl font-black text-slate-900 tracking-tight">Assessment Lab Configuration</h2>
              <p className="text-slate-400 font-bold uppercase text-[10px] tracking-widest">Pressure-test your document mastery</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 mb-12">
          <div className="space-y-6">
            <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-indigo-500 border-b border-indigo-50 pb-2">Question Parameters</h4>
            <ConfigRow label="MCQ (Logic Gates)" val={config.mcq} set={(v) => setConfig({ ...config, mcq: v })} icon={<ICONS.Document />} />
            <ConfigRow label="Short Answer (Tactical)" val={config.short} set={(v) => setConfig({ ...config, short: v })} icon={<ICONS.Efficiency />} />
            <ConfigRow label="Long Answer (Strategic)" val={config.long} set={(v) => setConfig({ ...config, long: v })} icon={<ICONS.Research />} />
            <ConfigRow label="Microphone (Verbal Delivery)" val={config.mic} set={(v) => setConfig({ ...config, mic: v })} icon={<ICONS.Speaker />} />
            <ConfigRow label="Video Performance (Visual/Verbal)" val={config.video} set={(v) => setConfig({ ...config, video: v })} icon={<ICONS.Play className="w-4 h-4" />} />
          </div>

          <div className="space-y-10">
            <div className="space-y-6">
              <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-rose-500 border-b border-rose-50 pb-2">Environment Controls</h4>
              <div className="p-8 bg-slate-50 rounded-[2.5rem] space-y-4 shadow-inner">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-black uppercase text-slate-500">Session Timer</span>
                  <span className="text-2xl font-black text-indigo-600">{config.timer}m</span>
                </div>
                <input 
                  type="range" min="1" max="60" 
                  value={config.timer} 
                  onChange={(e) => setConfig({ ...config, timer: parseInt(e.target.value) })}
                  className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                />
              </div>
            </div>

            <div className="space-y-6">
              <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-indigo-600 border-b border-indigo-50 pb-2">Synthesis Perspective</h4>
              <div className="grid grid-cols-2 gap-4">
                <button 
                  onClick={() => setPerspective('document')}
                  className={`flex flex-col items-center gap-3 p-6 rounded-[2rem] border-2 transition-all group ${perspective === 'document' ? 'bg-indigo-600 border-indigo-600 text-white shadow-xl scale-[1.02]' : 'bg-white border-slate-100 hover:border-indigo-300 text-slate-500'}`}
                >
                  <ICONS.Document className={`w-6 h-6 ${perspective === 'document' ? 'text-white' : 'text-indigo-500 group-hover:scale-110 transition-transform'}`} />
                  <div className="text-center">
                    <p className="text-[10px] font-black uppercase tracking-widest">Document Focused</p>
                  </div>
                </button>

                <button 
                  onClick={() => setPerspective('customer')}
                  className={`flex flex-col items-center gap-3 p-6 rounded-[2rem] border-2 transition-all group ${perspective === 'customer' ? 'bg-indigo-600 border-indigo-600 text-white shadow-xl scale-[1.02]' : 'bg-white border-slate-100 hover:border-indigo-300 text-slate-500'}`}
                >
                  <ICONS.Brain className={`w-6 h-6 ${perspective === 'customer' ? 'text-white' : 'text-rose-500 group-hover:scale-110 transition-transform'}`} />
                  <div className="text-center">
                    <p className="text-[10px] font-black uppercase tracking-widest">Buyer Centric</p>
                  </div>
                </button>
              </div>
            </div>
          </div>
        </div>

        <button 
          onClick={() => handleStart()}
          disabled={isGenerating || activeDocuments.length === 0}
          className={`w-full py-8 rounded-[2rem] font-black text-xl uppercase tracking-widest transition-all shadow-2xl flex items-center justify-center gap-4 ${isGenerating ? 'bg-slate-100 text-slate-400' : 'bg-indigo-600 text-white hover:bg-indigo-700 hover:scale-[1.01] active:scale-95 shadow-indigo-200'}`}
        >
          {isGenerating ? "Synthesizing..." : "Initiate Neural Assessment"}
        </button>
      </div>
    );
  }

  if (stage === 'running') {
    const currentQ = questions[currentIdx];
    const progressPercent = totalSessionTime > 0 ? (timeLeft / totalSessionTime) * 100 : 100;

    return (
      <div className="animate-in fade-in duration-500 min-h-[calc(100vh-64px)] flex flex-col">
        <div className="bg-white border-b border-slate-200 overflow-hidden">
          <div className="h-1 w-full bg-slate-100">
             <div className="h-full bg-indigo-500" style={{ width: `${progressPercent}%` }}></div>
          </div>
          <div className="flex items-center justify-between px-10 py-6">
            <div className="flex items-center gap-6">
                <div className="px-4 py-1.5 bg-indigo-600 text-white rounded-full text-[10px] font-black uppercase tracking-widest">
                  Question {currentIdx + 1} / {questions.length}
                </div>
                <div className="text-lg font-black text-slate-800">
                   {formatTime(timeLeft)}
                </div>
            </div>
            <button onClick={handleSubmit} className="px-8 py-2.5 bg-emerald-600 text-white rounded-full text-[10px] font-black uppercase tracking-widest">
                Submit Assessment
            </button>
          </div>
        </div>

        <div className="flex-1 bg-white p-16 relative overflow-hidden flex flex-col">
           <div className="relative z-10 space-y-12 flex-1 flex flex-col justify-center">
              <div className="space-y-4 text-center">
                 <span className="px-4 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest bg-slate-100 text-slate-400">
                    {currentQ.type.toUpperCase()} MODE
                 </span>
                 <h3 className="text-4xl font-black text-slate-900 tracking-tight max-w-4xl mx-auto">
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
                        className={`p-8 rounded-[2rem] border-2 text-left transition-all flex items-center gap-6 ${answers[currentQ.id] === opt ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-slate-50 border-slate-100 hover:border-indigo-300'}`}
                      >
                         <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black ${answers[currentQ.id] === opt ? 'bg-white/20 text-white' : 'bg-white text-indigo-600'}`}>
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
                      className="w-full bg-slate-50 border-2 border-slate-100 rounded-[2.5rem] p-10 text-2xl outline-none transition-all h-80"
                      placeholder="Response..."
                    />
                  </div>
                )}

                {(currentQ.type === 'mic' || currentQ.type === 'video') && (
                  <div className="flex flex-col items-center justify-center gap-10 w-full max-w-5xl">
                     {currentQ.type === 'video' ? (
                       <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 w-full">
                         <div className="relative rounded-[3rem] overflow-hidden bg-slate-900 aspect-video flex items-center justify-center">
                            <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover" />
                         </div>
                         <div className="flex flex-col justify-center gap-6">
                            <textarea 
                              value={answers[currentQ.id] || ""}
                              onChange={(e) => setAnswers(prev => ({ ...prev, [currentQ.id]: e.target.value }))}
                              className="w-full bg-slate-50 border-2 border-slate-100 rounded-[2.5rem] p-10 text-lg h-60"
                              placeholder="Transcribed performance..."
                            />
                            <button onClick={toggleRecording} className={`py-5 rounded-full font-black text-lg transition-all ${isRecording ? 'bg-rose-600 text-white' : 'bg-indigo-600 text-white'}`}>
                               {isRecording ? "End Trace" : "Begin Performance"}
                            </button>
                         </div>
                       </div>
                     ) : (
                       <div className="space-y-10 flex flex-col items-center w-full">
                          <button onClick={toggleRecording} className={`w-32 h-32 rounded-full flex items-center justify-center transition-all ${isRecording ? 'bg-rose-600 scale-110 shadow-2xl' : 'bg-indigo-600'}`}>
                             {isRecording ? <ICONS.X className="w-12 h-12 text-white" /> : <ICONS.Speaker className="w-12 h-12 text-white" />}
                          </button>
                          <textarea 
                             value={answers[currentQ.id] || ""}
                             onChange={(e) => setAnswers(prev => ({ ...prev, [currentQ.id]: e.target.value }))}
                             className="w-full p-10 bg-slate-50 rounded-[3rem] border-2 border-slate-100 text-lg h-48"
                             placeholder="Voice trace..."
                          />
                       </div>
                     )}
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between pt-12">
                <button onClick={handlePrevious} disabled={currentIdx === 0} className="px-8 py-4 bg-slate-100 text-slate-400 rounded-2xl text-[10px] font-black uppercase tracking-widest disabled:opacity-30">
                  Previous Node
                </button>
                {currentIdx < questions.length - 1 ? (
                  <button onClick={handleNext} className="px-10 py-4 bg-indigo-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest">
                    Next Node
                  </button>
                ) : (
                  <button onClick={handleSubmit} className="px-12 py-4 bg-emerald-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest">
                    Final Submission
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
      <div className="animate-in slide-in-from-bottom-8 duration-700 min-h-[calc(100vh-64px)] flex flex-col bg-slate-900 text-white">
        <div className="p-16 flex flex-col md:flex-row items-center justify-between gap-12 text-left flex-1">
           <div className="space-y-8 flex-1">
              <h2 className="text-5xl font-black tracking-tight">Readiness Report</h2>
              <p className="text-indigo-200/70 font-medium text-xl max-w-xl">
                 Logic validated against intelligence core. Master assessment complete.
              </p>
              <div className="flex gap-4">
                 <button onClick={exportPDF} className="px-8 py-3.5 bg-white text-slate-900 rounded-2xl text-[10px] font-black uppercase tracking-widest">
                   Export PDF
                 </button>
                 <button onClick={() => setStage('config')} className="px-8 py-3.5 bg-white/10 text-white border border-white/20 rounded-2xl text-[10px] font-black uppercase tracking-widest">
                   Retake
                 </button>
              </div>
           </div>
           <div className="w-64 h-64 bg-indigo-600 rounded-full flex flex-col items-center justify-center border-[12px] border-white/10">
              <span className="text-[12px] font-black uppercase text-indigo-200 mb-2">Score</span>
              <span className="text-7xl font-black">{totalScore}%</span>
           </div>
        </div>
        <div className="bg-white p-12 space-y-10">
           {questions.map((q, idx) => {
             const res = results.find(r => r.questionId === q.id);
             return (
               <div key={q.id} className="p-10 border border-slate-100 rounded-[3rem] text-slate-900 flex flex-col gap-6">
                  <div className="flex justify-between items-start">
                     <h4 className="text-2xl font-black">{idx + 1}. {q.text}</h4>
                     <span className={`px-6 py-2 rounded-full font-black ${res?.evaluation.isCorrect ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'}`}>{res?.evaluation.score}%</span>
                  </div>
                  <p className="italic text-slate-500">“{res?.userAnswer || "N/A"}”</p>
                  <div className="p-6 bg-slate-50 rounded-2xl">
                     <p className="text-xs font-black text-indigo-600 uppercase mb-2">Strategic Insight</p>
                     <p className="text-sm">{res?.evaluation.feedback}</p>
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
  <div className="flex items-center justify-between p-6 bg-slate-50 rounded-2xl border border-transparent group">
    <div className="flex items-center gap-4">
      <div className="text-slate-400 group-hover:text-indigo-600 transition-colors">{icon}</div>
      <span className="text-[11px] font-black uppercase text-slate-500">{label}</span>
    </div>
    <div className="flex items-center gap-4">
       <button onClick={() => set(Math.max(0, val - 1))} className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center">-</button>
       <span className="w-8 text-center font-black text-indigo-600">{val}</span>
       <button onClick={() => set(val + 1)} className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center">+</button>
    </div>
  </div>
);
