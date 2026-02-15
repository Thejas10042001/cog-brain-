
import React, { useState, useEffect, useRef } from 'react';
import { MeetingContext, CustomerPersonaType, ThinkingLevel, StoredDocument } from '../types';
import { ICONS, FAMOUS_PERSONALITIES } from '../constants';
import { extractMetadataFromDocument, analyzeVocalPersona } from '../services/geminiService';

interface MeetingContextConfigProps {
  context: MeetingContext;
  onContextChange: (context: MeetingContext) => void;
  documents?: StoredDocument[];
}

const PERSONAS: { type: CustomerPersonaType; label: string; desc: string; icon: React.ReactNode; strategicGuidance: string }[] = [
  { 
    type: 'Balanced', 
    label: 'Balanced', 
    desc: 'Versatile profile for general business users in B2B settings', 
    icon: <ICONS.Document />,
    strategicGuidance: "Adopt a consultative 'Trusted Advisor' stance. Balance operational ease-of-use with tangible business outcomes."
  },
  { 
    type: 'Technical', 
    label: 'Technical', 
    desc: 'Deep technical, jargon-friendly (CTO, VP Engineering, Tech Lead)', 
    icon: <ICONS.Brain />,
    strategicGuidance: "Engage in 'Verification' mode. Prioritize architectural integrity and security."
  },
  { 
    type: 'Financial', 
    label: 'Financial', 
    desc: 'ROI-driven, cost-benefit analysis (CFO, Financial Controller)', 
    icon: <ICONS.ROI />,
    strategicGuidance: "Execute in 'Fiscal Optimization' mode. Focus exclusively on TCO vs ROI."
  },
  { 
    type: 'Business Executives', 
    label: 'Executives', 
    desc: 'Strategic impact, operational clarity (CEO, Founder, MD)', 
    icon: <ICONS.Trophy />,
    strategicGuidance: "Operate in 'Strategic Growth' mode. Prioritize market share and long-term vision."
  },
];

export const MeetingContextConfig: React.FC<MeetingContextConfigProps> = ({ context, onContextChange, documents = [] }) => {
  const [keywordInput, setKeywordInput] = useState("");
  const [objectionInput, setObjectionInput] = useState("");
  const [localPrompt, setLocalPrompt] = useState(context.baseSystemPrompt);
  const [isSaved, setIsSaved] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [isAnalyzingVoice, setIsAnalyzingVoice] = useState(false);
  const [isPlayingVoice, setIsPlayingVoice] = useState(false);
  const voiceInputRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    generateBasePrompt();
  }, [context.persona, context.answerStyles, context.meetingFocus, context.vocalPersonaAnalysis, context.famousPersonaId]);

  const generateBasePrompt = () => {
    const selectedPersona = PERSONAS.find(p => p.type === context.persona);
    const personaGuidance = selectedPersona?.strategicGuidance || "";
    const personality = FAMOUS_PERSONALITIES.find(p => p.id === context.famousPersonaId);

    let prompt = `Act as an Elite Cognitive Sales Intelligence Architect. 
Your target is ${personality ? personality.name : context.persona}.

${personality ? `IDENTITY DIRECTIVE: Use the word framing, idiosyncratic speech patterns, and cognitive biases of ${personality.name} (${personality.company}).` : `PERSONA STRATEGY: ${personaGuidance}`}

${context.meetingFocus ? `MEETING FOCUS: "${context.meetingFocus}"` : ''}

${context.vocalPersonaAnalysis ? `TONAL MIMICRY: Mirror the following analyzed customer signature in pacing and emotional timbre: "${context.vocalPersonaAnalysis}"` : ''}`;

    if (prompt !== context.baseSystemPrompt) {
      setLocalPrompt(prompt);
      onContextChange({ ...context, baseSystemPrompt: prompt });
    }
  };

  const handleChange = (field: keyof MeetingContext, value: any) => {
    onContextChange({ ...context, [field]: value });
  };

  const handleVoiceUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsAnalyzingVoice(true);
    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const base64 = (event.target?.result as string).split(',')[1];
        const analysis = await analyzeVocalPersona(base64, file.type);
        onContextChange({ ...context, clonedVoiceBase64: base64, clonedVoiceMimeType: file.type, vocalPersonaAnalysis: analysis, famousPersonaId: undefined });
        setIsAnalyzingVoice(false);
      };
      reader.readAsDataURL(file);
    } catch (err) { setIsAnalyzingVoice(false); }
  };

  return (
    <div className="space-y-12 animate-in fade-in duration-500">
      <div className="bg-white rounded-[2.5rem] p-10 shadow-2xl border border-slate-200 overflow-hidden">
        <div className="flex items-center gap-3 mb-10">
          <div className="p-3 bg-indigo-600 text-white rounded-2xl shadow-lg"><ICONS.Document /></div>
          <div>
            <h3 className="text-2xl font-bold text-slate-800 tracking-tight">Identity Forge</h3>
            <p className="text-sm text-slate-400 font-bold uppercase tracking-widest">Select the behavioral source for simulations</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
          {/* Famous Personality Dropdown */}
          <div className="p-8 bg-slate-50 border border-slate-200 rounded-[2rem] space-y-4">
             <div className="flex items-center gap-3 mb-2">
                <ICONS.Trophy className="text-indigo-600" />
                <label className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-900">Famous Identity</label>
             </div>
             <select 
               value={context.famousPersonaId || ""} 
               onChange={(e) => handleChange('famousPersonaId', e.target.value)}
               className="w-full bg-white border-2 border-slate-200 rounded-2xl px-6 py-4 text-sm font-bold text-slate-700 outline-none focus:border-indigo-500 transition-all"
             >
               <option value="">None (Generic Persona)</option>
               {FAMOUS_PERSONALITIES.map(p => (
                 <option key={p.id} value={p.id}>{p.name} - {p.company}</option>
               ))}
             </select>
             <p className="text-[9px] text-slate-500 font-medium">Adopt the vocabulary, framing, and quirks of world-class leaders.</p>
          </div>

          {/* Voice Clone Section */}
          <div className="p-8 bg-slate-900 border border-slate-800 rounded-[2rem] text-white flex flex-col justify-center gap-4 relative overflow-hidden">
             {isAnalyzingVoice && <div className="absolute inset-0 bg-indigo-600/20 backdrop-blur-sm flex items-center justify-center z-10 animate-pulse text-[10px] font-black uppercase tracking-widest">Neural Fingerprinting...</div>}
             <div className="flex justify-between items-center">
                <label className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-300">Clone Customer Voice</label>
                {context.clonedVoiceBase64 && <button onClick={() => handleChange('clonedVoiceBase64', undefined)} className="text-[8px] uppercase text-rose-400">Clear</button>}
             </div>
             <div onClick={() => voiceInputRef.current?.click()} className="w-full bg-slate-800 border-2 border-dashed border-slate-700 rounded-2xl p-6 cursor-pointer flex items-center gap-4 hover:border-indigo-500 transition-all">
                <input type="file" ref={voiceInputRef} className="hidden" accept=".mp3,.wav,.m4a" onChange={handleVoiceUpload} />
                <div className={`p-3 rounded-full ${context.clonedVoiceBase64 ? 'bg-emerald-600' : 'bg-slate-700'} text-white`}><ICONS.Play className="w-4 h-4" /></div>
                <span className="text-xs font-bold text-slate-400">{context.clonedVoiceBase64 ? 'Identity Synchronized' : 'Upload voice sample (MP3)...'}</span>
             </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12 border-b border-slate-100 pb-12 mb-12">
          {/* (Input blocks for Seller, Prospect, Solution context remain the same) */}
          <div className="space-y-5"><Input label="Seller Company" value={context.sellerCompany} onChange={v => handleChange('sellerCompany', v)} placeholder="Organization Name" /></div>
          <div className="space-y-5"><Input label="Client Company" value={context.clientCompany} onChange={v => handleChange('clientCompany', v)} placeholder="Prospect Name" /></div>
          <div className="space-y-5"><Input label="Meeting Focus" value={context.meetingFocus} onChange={v => handleChange('meetingFocus', v)} placeholder="Objective" isLarge /></div>
        </div>
      </div>

      <div className="space-y-6">
        <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2"><ICONS.Brain /> Baseline Persona Architecture</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {PERSONAS.map(p => (
            <button key={p.type} onClick={() => handleChange('persona', p.type)} className={`p-8 rounded-[2.5rem] border-2 text-left transition-all ${context.persona === p.type ? 'bg-indigo-600 border-indigo-600 text-white shadow-2xl scale-[1.02]' : 'bg-white border-slate-100 hover:border-indigo-300'}`}>
              <div className={`p-4 rounded-2xl mb-6 inline-block ${context.persona === p.type ? 'bg-white/20' : 'bg-indigo-50 text-indigo-500'}`}>{p.icon}</div>
              <p className="font-black text-base uppercase mb-3">{p.label}</p>
              <p className="text-[11px] font-medium opacity-80">{p.desc}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

const Input = ({ label, value, onChange, placeholder, isLarge }: { label: string; value: string; onChange: (v: string) => void; placeholder: string, isLarge?: boolean }) => (
  <div className="space-y-2">
    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</label>
    <input type="text" value={value} onChange={e => onChange(e.target.value)} className={`w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-6 py-4 text-sm focus:border-indigo-500 outline-none font-semibold ${isLarge ? 'text-lg py-6' : ''}`} placeholder={placeholder} />
  </div>
);
