
import React, { useState, useEffect, useRef } from 'react';
import { MeetingContext, CustomerPersonaType, ThinkingLevel, StoredDocument, VocalPersonaStructure } from '../types';
import { ICONS } from '../constants';
import { extractMetadataFromDocument, analyzeVocalPersona } from '../services/geminiService';

interface MeetingContextConfigProps {
  context: MeetingContext;
  onContextChange: (context: MeetingContext) => void;
  documents?: StoredDocument[];
}

const PERSONAS: { type: CustomerPersonaType; label: string; desc: string; icon: React.ReactNode; strategicGuidance: string }[] = [
  { type: 'Balanced', label: 'Balanced', desc: 'Standard business profile.', icon: <ICONS.Document />, strategicGuidance: "Adopt a consultative 'Trusted Advisor' stance." },
  { type: 'Technical', label: 'Technical', icon: <ICONS.Brain />, desc: 'Deep technical, spec-driven.', strategicGuidance: "Prioritize architectural integrity." },
  { type: 'Financial', label: 'Financial', icon: <ICONS.ROI />, desc: 'ROI and cost-benefit.', strategicGuidance: "Execute in 'Fiscal Optimization' mode." },
  { type: 'Business Executives', label: 'Executives', icon: <ICONS.Trophy />, desc: 'Strategy and operational clarity.', strategicGuidance: "Operate in 'Strategic Growth' mode." },
];

const ANSWER_STYLES = ["Executive Summary", "Data-Driven Insights", "Concise Answer", "Sales Points", "Competitive Comparison", "Pricing Overview", "ROI Forecast", "Risk Assessment", "Value Proposition", "Decision Matrix"];

export const MeetingContextConfig: React.FC<MeetingContextConfigProps> = ({ context, onContextChange, documents = [] }) => {
  const [keywordInput, setKeywordInput] = useState("");
  const [objectionInput, setObjectionInput] = useState("");
  const [localPrompt, setLocalPrompt] = useState(context.baseSystemPrompt);
  const [isExtracting, setIsExtracting] = useState(false);
  const [isAnalyzingVoice, setIsAnalyzingVoice] = useState(false);
  const voiceInputRef = useRef<HTMLInputElement>(null);

  const handleChange = (field: keyof MeetingContext, value: any) => onContextChange({ ...context, [field]: value });

  const handleVoiceUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsAnalyzingVoice(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64 = (event.target?.result as string).split(',')[1];
      const analysis = await analyzeVocalPersona(base64, file.type);
      onContextChange({ ...context, clonedVoiceBase64: base64, clonedVoiceMimeType: file.type, vocalPersonaAnalysis: analysis });
      setIsAnalyzingVoice(false);
    };
    reader.readAsDataURL(file);
  };

  const handleKycChange = async (docId: string) => {
    handleChange('kycDocId', docId);
    if (!docId) return;
    const doc = documents.find(d => d.id === docId);
    if (!doc) return;
    setIsExtracting(true);
    try {
      const metadata = await extractMetadataFromDocument(doc.content);
      onContextChange({ ...context, kycDocId: docId, ...metadata });
    } catch (e) { console.error(e); } finally { setIsExtracting(false); }
  };

  const addObjection = () => {
    if (objectionInput.trim()) {
      handleChange('potentialObjections', [...context.potentialObjections, objectionInput.trim()]);
      setObjectionInput("");
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="bg-white rounded-3xl p-8 shadow-xl border border-slate-200">
        <div className="flex items-center gap-3 mb-8">
          <div className="p-2.5 bg-indigo-600 text-white rounded-xl shadow-md"><ICONS.Document /></div>
          <h3 className="text-xl font-bold text-slate-800 tracking-tight">Configuration</h3>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <div className="p-6 bg-slate-50 border border-slate-200 rounded-2xl flex items-center gap-4 relative">
             {isExtracting && <div className="absolute inset-0 bg-white/60 backdrop-blur-sm flex items-center justify-center z-10 rounded-2xl"><div className="w-5 h-5 border-2 border-indigo-600 border-t-transparent animate-spin"></div></div>}
             <div className="p-3 bg-indigo-600 text-white rounded-xl shadow-sm"><ICONS.Shield className="w-5 h-5" /></div>
             <div className="flex-1">
                <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest mb-1 block">KYC Grounding Source</label>
                <select value={context.kycDocId || ""} onChange={(e) => handleKycChange(e.target.value)} className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2 text-sm font-bold outline-none focus:border-indigo-500">
                  <option value="">Select source...</option>
                  {documents.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
             </div>
          </div>

          <div className="p-6 bg-slate-900 border border-slate-800 rounded-2xl flex items-center gap-4 text-white relative">
             {isAnalyzingVoice && <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center z-10 rounded-2xl"><div className="w-5 h-5 border-2 border-indigo-400 border-t-transparent animate-spin"></div></div>}
             <div className={`p-3 rounded-xl shadow-sm ${context.clonedVoiceBase64 ? 'bg-emerald-600' : 'bg-slate-800'}`}><ICONS.Speaker className="w-5 h-5" /></div>
             <div className="flex-1">
                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1 block">Vocal Fingerprint</label>
                <button onClick={() => voiceInputRef.current?.click()} className="w-full bg-slate-800 border border-slate-700 hover:border-indigo-500 px-4 py-2 rounded-xl text-xs font-bold text-slate-300 truncate text-left">
                  {context.clonedVoiceBase64 ? 'Voice Retained' : 'Upload Sample...'}
                </button>
                <input type="file" ref={voiceInputRef} className="hidden" accept=".mp3,.wav" onChange={handleVoiceUpload} />
             </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          <Input label="Seller Company" value={context.sellerCompany} onChange={v => handleChange('sellerCompany', v)} placeholder="Organization" />
          <Input label="Client Company" value={context.clientCompany} onChange={v => handleChange('clientCompany', v)} placeholder="Prospect" />
          <Input label="Focus Area" value={context.meetingFocus} onChange={v => handleChange('meetingFocus', v)} placeholder="Objective" />
        </div>

        <div className="space-y-4">
          <h4 className="text-sm font-bold text-slate-700">Target Persona</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {PERSONAS.map(p => (
              <button key={p.type} onClick={() => handleChange('persona', p.type)} className={`p-4 rounded-2xl border-2 text-left transition-all ${context.persona === p.type ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-slate-100 hover:border-indigo-200'}`}>
                <div className={`p-2 rounded-lg mb-2 inline-block ${context.persona === p.type ? 'bg-white/20' : 'bg-indigo-50 text-indigo-500'}`}>{p.icon}</div>
                <p className="font-black text-xs uppercase truncate">{p.label}</p>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white rounded-3xl p-8 shadow-xl border border-slate-200 h-fit">
          <h3 className="text-lg font-bold text-slate-800 mb-4">Response Styles</h3>
          <div className="flex flex-wrap gap-2">
            {ANSWER_STYLES.map(style => (
              <button key={style} onClick={() => {
                const updated = context.answerStyles.includes(style) ? context.answerStyles.filter(s => s !== style) : [...context.answerStyles, style];
                handleChange('answerStyles', updated);
              }} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all ${context.answerStyles.includes(style) ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-500 border-slate-100 hover:border-indigo-200'}`}>{style}</button>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-3xl p-8 shadow-xl border border-slate-200 flex flex-col h-full">
           <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2 mb-4">
              <ICONS.Security className="text-rose-500" /> Objections
           </h3>
           <div className="flex gap-2 mb-4">
            <input type="text" value={objectionInput} onChange={e => setObjectionInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && addObjection()} placeholder="New objection..." className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-sm outline-none focus:border-indigo-500" />
            <button onClick={addObjection} className="p-2.5 bg-rose-600 text-white rounded-xl shadow-md"><ICONS.X className="rotate-45" /></button>
          </div>
          <div className="max-h-32 overflow-y-auto custom-scrollbar pr-2 space-y-2">
            {context.potentialObjections.map((obj, i) => (
              <div key={i} className="flex items-center justify-between p-2.5 bg-rose-50/50 border border-rose-100 rounded-xl">
                <p className="text-[11px] font-bold text-rose-800 truncate pr-4">“{obj}”</p>
                <button onClick={() => handleChange('potentialObjections', context.potentialObjections.filter((_, idx) => idx !== i))} className="text-rose-300 hover:text-rose-600"><ICONS.Trash className="w-3.5 h-3.5" /></button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

const Input = ({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder: string }) => (
  <div className="space-y-1.5">
    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">{label}</label>
    <input type="text" value={value} onChange={e => onChange(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:border-indigo-500 focus:bg-white outline-none transition-all font-semibold" placeholder={placeholder} />
  </div>
);
