
import React, { useState, useEffect, useRef } from 'react';
import { MeetingContext, CustomerPersonaType, StoredDocument } from '../types';
import { ICONS } from '../constants';
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
    strategicGuidance: "Engage in 'Verification' mode. Prioritize technical architectural integrity and security protocols."
  },
  { 
    type: 'Financial', 
    label: 'Financial', 
    desc: 'ROI-driven, cost-benefit analysis (CFO, Financial Controller)', 
    icon: <ICONS.ROI />,
    strategicGuidance: "Execute in 'Fiscal Optimization' mode. Focus exclusively on EBITDA impact and payback periods."
  },
  { 
    type: 'Business Executives', 
    label: 'Executives', 
    desc: 'Strategic impact, operational clarity (CEO, Founder, MD)', 
    icon: <ICONS.Trophy />,
    strategicGuidance: "Operate in 'Strategic Growth' mode. Prioritize market share displacement and long-term vision."
  },
];

const ANSWER_STYLES = [
  "Executive Summary", "Analogy Based", "Data-Driven Insights", "Concise Answer", 
  "In-Depth Response", "Answer in Points", "Define Technical Terms", "Sales Points", 
  "ROI Forecast", "SWOT Analysis", "Risk Assessment", "Value Proposition"
];

export const MeetingContextConfig: React.FC<MeetingContextConfigProps> = ({ context, onContextChange, documents = [] }) => {
  const [keywordInput, setKeywordInput] = useState("");
  const [objectionInput, setObjectionInput] = useState("");
  const [localPrompt, setLocalPrompt] = useState(context.baseSystemPrompt);
  const [isSaved, setIsSaved] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [isAnalyzingVoice, setIsAnalyzingVoice] = useState(false);
  const isCustomizedRef = useRef(false);
  const voiceInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isCustomizedRef.current) {
      generateBasePrompt();
    }
  }, [context.persona, context.answerStyles, context.meetingFocus, context.vocalPersonaAnalysis, context.potentialObjections]);

  useEffect(() => {
    setLocalPrompt(context.baseSystemPrompt);
  }, [context.baseSystemPrompt]);

  const generateBasePrompt = () => {
    const selectedPersona = PERSONAS.find(p => p.type === context.persona);
    const personaGuidance = selectedPersona?.strategicGuidance || "";

    let prompt = `Act as an Elite Cognitive Sales Intelligence Architect for SpikedAI. 
Persona identified as: ${context.persona}.
STRATEGIC DIRECTIVE: "${personaGuidance}"`;

    if (prompt !== context.baseSystemPrompt) {
      setLocalPrompt(prompt);
      onContextChange({ ...context, baseSystemPrompt: prompt });
    }
  };

  const handleChange = (field: keyof MeetingContext, value: any) => {
    onContextChange({ ...context, [field]: value });
  };

  const handleKycChange = async (docId: string) => {
    handleChange('kycDocId', docId);
    if (!docId) return;

    const doc = documents.find(d => d.id === docId);
    if (!doc) return;

    setIsExtracting(true);
    try {
      const metadata = await extractMetadataFromDocument(doc.content);
      onContextChange({
        ...context,
        kycDocId: docId,
        sellerCompany: metadata.sellerCompany || context.sellerCompany,
        clientCompany: metadata.clientCompany || context.clientCompany,
        clientNames: metadata.clientNames || context.clientNames,
        targetProducts: metadata.targetProducts || context.targetProducts,
        meetingFocus: metadata.meetingFocus || context.meetingFocus,
        executiveSnapshot: metadata.executiveSnapshot || context.executiveSnapshot,
        potentialObjections: metadata.potentialObjections || context.potentialObjections
      });
    } catch (e) {
      console.error("KYC Metadata extraction failed", e);
    } finally {
      setIsExtracting(false);
    }
  };

  const addObjection = () => {
    if (objectionInput.trim()) {
      handleChange('potentialObjections', [...context.potentialObjections, objectionInput.trim()]);
      setObjectionInput("");
    }
  };

  const toggleStyle = (style: string) => {
    const updated = context.answerStyles.includes(style)
      ? context.answerStyles.filter(s => s !== style)
      : [...context.answerStyles, style];
    handleChange('answerStyles', updated);
  };

  return (
    <div className="space-y-12 animate-in fade-in duration-500">
      <div className="bg-white rounded-[2.5rem] p-10 shadow-2xl border border-slate-100 overflow-hidden relative">
        <div className="flex items-center gap-3 mb-10">
          <div className="p-3 bg-red-600 text-white rounded-2xl shadow-lg"><ICONS.Document /></div>
          <div>
            <h3 className="text-2xl font-bold text-slate-800 tracking-tight">Meeting Intel Configuration</h3>
            <p className="text-sm text-slate-400 font-bold uppercase tracking-widest">Define the strategic landscape</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
          <div className="p-8 bg-red-50 border border-red-100 rounded-[2rem] flex flex-col md:flex-row md:items-center gap-8 shadow-inner relative overflow-hidden h-full">
             {isExtracting && (
               <div className="absolute inset-0 bg-red-600/5 backdrop-blur-[2px] flex items-center justify-center z-10">
                 <div className="flex items-center gap-3 px-6 py-3 bg-white border border-red-100 rounded-full shadow-xl">
                   <div className="w-4 h-4 border-2 border-red-100 border-t-red-600 rounded-full animate-spin"></div>
                   <span className="text-[10px] font-black uppercase text-red-600 tracking-widest animate-pulse">Neural Extraction Active...</span>
                 </div>
               </div>
             )}
             <div className="shrink-0 flex flex-col items-center gap-2">
                <div className="p-4 bg-red-600 text-white rounded-2xl shadow-lg">
                   <ICONS.Shield />
                </div>
                <span className="text-[8px] font-black uppercase text-red-500 tracking-widest">Neural Anchor</span>
             </div>
             <div className="flex-1 space-y-3">
                <label className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-900">Know Your Customer (KYC) Document</label>
                <select 
                  value={context.kycDocId || ""} 
                  onChange={(e) => handleKycChange(e.target.value)}
                  className="w-full bg-white border-2 border-slate-100 rounded-2xl px-6 py-4 text-sm font-bold text-slate-700 outline-none focus:border-red-500 transition-all shadow-sm"
                >
                  <option value="">Select behavior grounding source...</option>
                  {documents.map(d => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
             </div>
          </div>

          <div className="p-8 bg-slate-900 border border-slate-800 rounded-[2rem] flex flex-col md:flex-row md:items-center gap-8 shadow-2xl text-white">
             <div className="shrink-0 flex flex-col items-center gap-2">
                <div className={`p-4 rounded-2xl shadow-lg transition-colors ${context.clonedVoiceBase64 ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-400 border border-slate-700'}`}>
                   <ICONS.Speaker />
                </div>
                <span className="text-[8px] font-black uppercase text-red-400 tracking-widest">Voice Identity Lab</span>
             </div>
             <div className="flex-1 space-y-3">
                <label className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-300">Clone Customer Voice Signature</label>
                <div 
                   onClick={() => voiceInputRef.current?.click()}
                   className="w-full bg-slate-800/50 border-2 border-dashed border-slate-700 hover:border-red-500 rounded-2xl px-6 py-4 cursor-pointer transition-all flex items-center gap-4 group"
                >
                   <input type="file" ref={voiceInputRef} className="hidden" accept=".mp3,.wav,.m4a" />
                   <p className="text-xs font-bold text-slate-400 group-hover:text-slate-200">Upload voice sample...</p>
                </div>
             </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 border-b border-slate-50 pb-12">
          <Input label="Seller Company" value={context.sellerCompany} onChange={v => handleChange('sellerCompany', v)} placeholder="Organization Name" />
          <Input label="Prospect Company" value={context.clientCompany} onChange={v => handleChange('clientCompany', v)} placeholder="Target Client" />
          <Input label="Meeting Focus" value={context.meetingFocus} onChange={v => handleChange('meetingFocus', v)} placeholder="e.g. Discovery Call" />
        </div>
      </div>

      <div className="space-y-6">
        <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
          <ICONS.Brain /> Target Buyer Persona
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {PERSONAS.map(p => (
            <button
              key={p.type}
              onClick={() => handleChange('persona', p.type)}
              className={`p-8 rounded-[2.5rem] border-2 text-left transition-all relative flex flex-col h-full ${context.persona === p.type ? 'bg-red-600 border-red-600 text-white shadow-2xl scale-[1.02]' : 'bg-white border-slate-100 hover:border-red-200 shadow-sm'}`}
            >
              <div className={`p-4 rounded-2xl mb-6 inline-block ${context.persona === p.type ? 'bg-white/20 text-white' : 'bg-red-50 text-red-600'}`}>{p.icon}</div>
              <p className={`font-black text-base uppercase tracking-widest mb-3 ${context.persona === p.type ? 'text-white' : 'text-slate-800'}`}>{p.label}</p>
              <p className={`text-[11px] leading-relaxed font-medium ${context.persona === p.type ? 'text-red-100' : 'text-slate-500'}`}>{p.desc}</p>
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white rounded-[2.5rem] p-10 shadow-xl border border-slate-100 space-y-6">
          <h3 className="text-xl font-bold text-slate-800">Opportunity Snapshot</h3>
          <textarea
            value={context.executiveSnapshot}
            onChange={e => handleChange('executiveSnapshot', e.target.value)}
            className="w-full bg-slate-50 border-2 border-slate-100 rounded-3xl p-8 text-sm focus:border-red-500 focus:bg-white outline-none transition-all h-40 resize-none shadow-inner leading-relaxed"
            placeholder="Executive deal briefing..."
          />
        </div>

        <div className="bg-white rounded-[2.5rem] p-10 shadow-xl border border-slate-100 space-y-6 flex flex-col h-full">
           <div className="flex items-center justify-between">
              <h3 className="text-xl font-bold text-slate-800">
                 Potential Objections
              </h3>
              <span className="text-[8px] font-black uppercase text-red-500 bg-red-50 px-2 py-1 rounded-md border border-red-100">Inferred Resistance Nodes</span>
           </div>
           <div className="flex gap-3 mb-6">
            <input
              type="text"
              value={objectionInput}
              onChange={e => setObjectionInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addObjection()}
              placeholder="e.g. Price is too high..."
              className="flex-1 bg-slate-50 border-2 border-slate-100 rounded-2xl px-6 py-3 text-sm focus:border-red-500 focus:bg-white outline-none transition-all shadow-inner"
            />
            <button onClick={addObjection} className="p-3 bg-red-600 text-white rounded-2xl hover:bg-red-700 shadow-xl transition-all"><ICONS.X className="rotate-45" /></button>
          </div>
          <div className="flex-1 overflow-y-auto max-h-40 no-scrollbar space-y-2">
            {context.potentialObjections.map((obj, i) => (
              <div key={i} className="flex items-center justify-between p-3 bg-red-50/50 border border-red-100 rounded-xl animate-in slide-in-from-right-2 duration-300">
                <p className="text-[11px] font-bold text-red-800 leading-snug">“{obj}”</p>
                <button onClick={() => handleChange('potentialObjections', context.potentialObjections.filter((_, idx) => idx !== i))} className="text-red-300 hover:text-red-600"><ICONS.Trash className="w-3.5 h-3.5" /></button>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-slate-900 rounded-[3rem] p-12 shadow-2xl relative overflow-hidden group">
        <div className="relative z-10 space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-red-500 text-[11px] font-black uppercase tracking-[0.4em]">Neural Core System Prompt</h3>
            <button 
              onClick={() => {
                onContextChange({ ...context, baseSystemPrompt: localPrompt });
                setIsSaved(true);
                setTimeout(() => setIsSaved(false), 2000);
              }}
              className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg ${isSaved ? 'bg-emerald-500 text-white' : 'bg-red-600 text-white hover:bg-red-700'}`}
            >
              {isSaved ? 'Prompt Retained' : 'Update & Save Prompt'}
            </button>
          </div>
          <textarea
            value={localPrompt}
            onChange={e => setLocalPrompt(e.target.value)}
            className="w-full bg-slate-800/40 text-slate-200 border-2 border-slate-700/50 rounded-[2.5rem] p-10 text-sm focus:border-red-500 outline-none transition-all h-40 font-mono leading-relaxed"
          />
        </div>
      </div>
    </div>
  );
};

const Input = ({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder: string }) => (
  <div className="space-y-2">
    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">{label}</label>
    <input
      type="text"
      value={value}
      onChange={e => onChange(e.target.value)}
      className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-6 py-4 text-sm focus:border-red-500 focus:bg-white outline-none transition-all font-semibold text-slate-800"
      placeholder={placeholder}
    />
  </div>
);
