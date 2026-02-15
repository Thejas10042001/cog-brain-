
import React, { useState, useEffect, useRef } from 'react';
import { MeetingContext, CustomerPersonaType, ThinkingLevel, StoredDocument } from '../types';
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
    strategicGuidance: "Adopt a consultative 'Trusted Advisor' stance. Balance operational ease-of-use with tangible business outcomes. Focus on lowering the barrier to adoption while proving mid-term value."
  },
  { 
    type: 'Technical', 
    label: 'Technical', 
    desc: 'Deep technical, jargon-friendly (CTO, VP Engineering, Tech Lead)', 
    icon: <ICONS.Brain />,
    strategicGuidance: "Engage in 'Verification' mode. Prioritize technical architectural integrity, API security protocols, data residency, and scalability benchmarks. Challenge assumptions with logic and demands for documentation."
  },
  { 
    type: 'Financial', 
    label: 'Financial', 
    desc: 'ROI-driven, cost-benefit analysis (CFO, Financial Controller)', 
    icon: <ICONS.ROI />,
    strategicGuidance: "Execute in 'Fiscal Optimization' mode. Focus exclusively on EBITDA impact, Total Cost of Ownership (TCO) vs ROI, payback periods, and capital allocation efficiency. Treat software as a financial instrument."
  },
  { 
    type: 'Business Executives', 
    label: 'Executives', 
    desc: 'Strategic impact, operational clarity (CEO, Founder, MD)', 
    icon: <ICONS.Trophy />,
    strategicGuidance: "Operate in 'Strategic Growth' mode. Prioritize market share displacement, competitive moats, long-term vision alignment, and organizational velocity. Ignore tactical minutiae; focus on top-line mission success."
  },
];

const ANSWER_STYLES = [
  "Executive Summary", 
  "Analogy Based", 
  "Data-Driven Insights",
  "Concise Answer", 
  "In-Depth Response", 
  "Answer in Points", 
  "Define Technical Terms", 
  "Sales Points", 
  "Key Statistics", 
  "Case Study Summary", 
  "Competitive Comparison", 
  "Anticipated Customer Questions", 
  "Information Gap", 
  "Pricing Overview",
  "ROI Forecast",
  "SWOT Analysis",
  "Strategic Roadmap",
  "Risk Assessment",
  "Implementation Timeline",
  "Technical Deep-Dive",
  "Value Proposition",
  "Financial Justification",
  "Stakeholder Alignment",
  "Competitive Wedge",
  "Success Story Summary",
  "Psychological Projection",
  "Buying Fear Mitigation",
  "Security & Compliance",
  "Decision Matrix"
];

export const MeetingContextConfig: React.FC<MeetingContextConfigProps> = ({ context, onContextChange, documents = [] }) => {
  const [keywordInput, setKeywordInput] = useState("");
  const [objectionInput, setObjectionInput] = useState("");
  const [localPrompt, setLocalPrompt] = useState(context.baseSystemPrompt);
  const [isSaved, setIsSaved] = useState(false);
  const [showHelp, setShowHelp] = useState(true);
  const [isExtracting, setIsExtracting] = useState(false);
  const [isAnalyzingVoice, setIsAnalyzingVoice] = useState(false);
  const [isPlayingVoice, setIsPlayingVoice] = useState(false);
  const isCustomizedRef = useRef(false);
  const voiceInputRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

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

    let prompt = `Act as an Elite Cognitive Sales Intelligence Architect. 
Your primary objective is to provide high-fidelity, persona-aligned sales strategy for a buyer identified as: ${context.persona}.

PERSONA-SPECIFIC STRATEGIC DIRECTIVE:
"${personaGuidance}"
You must adapt your vocabulary, risk assessment parameters, and value prioritization to match this profile's psychological drivers and professional accountability.

${context.meetingFocus ? `CRITICAL MEETING OBJECTIVE & FOCUS:
"${context.meetingFocus}"
All synthesized insights must be filtered through this lens. If a data point doesn't serve this focus, deprioritize it. If it directly addresses the focus, elevate it as a 'Core Narrative Pillar'.` : ''}

${context.potentialObjections.length > 0 ? `PREDICTED RESISTANCE NODES:
${context.potentialObjections.map(o => `- ${o}`).join('\n')}
Proactively neutralize these objections in your reasoning.` : ''}

${context.vocalPersonaAnalysis ? `VOCAL IDENTITY MIMICRY (CLONED VOICE ACTIVE):
You must mirror the following analyzed prospect signature in your behavioral logic, emotional subtext, and linguistic pacing:
"${context.vocalPersonaAnalysis}"` : ''}

REQUIRED RESPONSE ARCHITECTURE:
${context.answerStyles.length > 0 
  ? `Your responses must be structured using the following sections where relevant to the query: ${context.answerStyles.join(', ')}.` 
  : 'Provide direct, strategic, and high-density responses without fluff.'}

OPERATIONAL CONSTRAINTS:
1. GROUNDED SYNTHESIS: Exclusively utilize the provided documentary context. Cite specific filenames or snippets to reinforce credibility.
2. COGNITIVE GAP ANALYSIS: If critical data for the ${context.persona} is missing from the docs, explicitly identify the 'Information Gap' and suggest a strategic question to ask the client to uncover it.
3. EXECUTIVE ARTICULATION: Maintain a tone that is authoritative, decisive, and intellectually rigorous. Use sophisticated sales-semantic language (e.g., 'Displacement Wedge', 'Value Realization', 'Governance Moat').`;

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
        onContextChange({
          ...context,
          clonedVoiceBase64: base64,
          clonedVoiceMimeType: file.type,
          vocalPersonaAnalysis: analysis
        });
        setIsAnalyzingVoice(false);
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error("Voice analysis error:", err);
      setIsAnalyzingVoice(false);
    }
  };

  const playVoiceSample = () => {
    if (!context.clonedVoiceBase64) return;
    if (isPlayingVoice && audioRef.current) {
      audioRef.current.pause();
      setIsPlayingVoice(false);
      return;
    }
    
    const audio = new Audio(`data:${context.clonedVoiceMimeType || 'audio/mpeg'};base64,${context.clonedVoiceBase64}`);
    audioRef.current = audio;
    audio.onended = () => setIsPlayingVoice(false);
    audio.play();
    setIsPlayingVoice(true);
  };

  const handleKycChange = async (docId: string) => {
    handleChange('kycDocId', docId);
    if (!docId) return;

    const doc = documents.find(d => d.id === docId);
    if (!doc) return;

    setIsExtracting(true);
    try {
      const metadata = await extractMetadataFromDocument(doc.content);
      
      const existingKeywords = new Set(context.strategicKeywords);
      if (metadata.strategicKeywords) {
        metadata.strategicKeywords.forEach(kw => existingKeywords.add(kw));
      }

      onContextChange({
        ...context,
        kycDocId: docId,
        sellerCompany: metadata.sellerCompany || context.sellerCompany,
        sellerNames: metadata.sellerNames || context.sellerNames,
        clientCompany: metadata.clientCompany || context.clientCompany,
        clientNames: metadata.clientNames || context.clientNames,
        targetProducts: metadata.targetProducts || context.targetProducts,
        productDomain: metadata.productDomain || context.productDomain,
        meetingFocus: metadata.meetingFocus || context.meetingFocus,
        executiveSnapshot: metadata.executiveSnapshot || context.executiveSnapshot,
        strategicKeywords: Array.from(existingKeywords),
        potentialObjections: metadata.potentialObjections || context.potentialObjections
      });
    } catch (e) {
      console.error("KYC Metadata extraction failed", e);
    } finally {
      setIsExtracting(false);
    }
  };

  const handlePromptUpdate = (val: string) => {
    setLocalPrompt(val);
    isCustomizedRef.current = true;
    setIsSaved(false);
  };

  const savePrompt = () => {
    onContextChange({ ...context, baseSystemPrompt: localPrompt });
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2000);
  };

  const toggleStyle = (style: string) => {
    const updated = context.answerStyles.includes(style)
      ? context.answerStyles.filter(s => s !== style)
      : [...context.answerStyles, style];
    handleChange('answerStyles', updated);
  };

  const addKeyword = () => {
    if (keywordInput.trim()) {
      handleChange('strategicKeywords', [...context.strategicKeywords, keywordInput.trim()]);
      setKeywordInput("");
    }
  };

  const addObjection = () => {
    if (objectionInput.trim()) {
      handleChange('potentialObjections', [...context.potentialObjections, objectionInput.trim()]);
      setObjectionInput("");
    }
  };

  return (
    <div className="space-y-12 animate-in fade-in duration-500">
      <div className="flex justify-end">
        <button 
          onClick={() => setShowHelp(!showHelp)}
          className={`flex items-center gap-2 px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-all border ${showHelp ? 'bg-red-600 text-white border-red-700 shadow-lg' : 'bg-white text-slate-400 border-slate-200'}`}
        >
          <ICONS.Sparkles className="w-3.5 h-3.5" />
          {showHelp ? "Hide Intelligence Guidance" : "Show Intelligence Guidance"}
        </button>
      </div>

      <div className="bg-white rounded-[2.5rem] p-10 shadow-2xl border border-slate-200 overflow-hidden relative">
        <div className="flex items-center gap-3 mb-10">
          <div className="p-3 bg-red-600 text-white rounded-2xl shadow-lg"><ICONS.Document /></div>
          <div>
            <h3 className="text-2xl font-bold text-slate-800 tracking-tight">Meeting Intel Configuration</h3>
            <p className="text-sm text-slate-400 font-bold uppercase tracking-widest">Define the strategic landscape</p>
          </div>
        </div>

        {showHelp && (
          <div className="mb-10 p-6 bg-red-50/50 border border-red-100 rounded-[2rem] animate-in slide-in-from-top-4">
             <div className="flex items-center gap-3 mb-3">
                <ICONS.Research className="text-red-600 w-4 h-4" />
                <h4 className="text-[10px] font-black uppercase tracking-widest text-red-700">Strategic Orientation Guide</h4>
             </div>
             <p className="text-xs text-red-900 font-medium leading-relaxed">
               Accurate configuration allows the AI to prioritize "Winning Arguments" specifically tailored to your role, the client's industry, and the specific phase of the sales cycle.
             </p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
          <div className="p-8 bg-red-50 border border-red-100 rounded-[2rem] flex flex-col md:flex-row md:items-center gap-8 shadow-inner relative overflow-hidden h-full">
             {isExtracting && (
               <div className="absolute inset-0 bg-red-600/5 backdrop-blur-[2px] flex items-center justify-center z-10 animate-in fade-in">
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
                <label className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-900 ml-1">Know Your Customer (KYC) Document</label>
                <select 
                  value={context.kycDocId || ""} 
                  onChange={(e) => handleKycChange(e.target.value)}
                  className="w-full bg-white border-2 border-slate-200 rounded-2xl px-6 py-4 text-sm font-bold text-slate-700 outline-none focus:border-red-500 transition-all shadow-sm"
                >
                  <option value="">Select behavior grounding source...</option>
                  {documents.map(d => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
                <p className="text-[9px] text-slate-500 font-medium italic">Auto-populates Power Brokers and Predicted Resistance Nodes.</p>
             </div>
          </div>

          <div className="p-8 bg-slate-900 border border-slate-800 rounded-[2rem] flex flex-col md:flex-row md:items-center gap-8 shadow-2xl relative overflow-hidden h-full text-white">
             {isAnalyzingVoice && (
                <div className="absolute inset-0 bg-red-600/10 backdrop-blur-sm flex items-center justify-center z-10">
                   <div className="flex flex-col items-center gap-3">
                      <div className="flex gap-1.5 items-end h-8">
                         {[...Array(6)].map((_, i) => (
                           <div key={i} className="w-1 bg-red-500 rounded-full animate-waveform-sm" style={{ animationDelay: `${i*0.1}s`, height: `${40 + Math.random() * 60}%` }}></div>
                         ))}
                      </div>
                      <span className="text-[9px] font-black uppercase tracking-[0.3em] text-red-400 animate-pulse">Fingerprinting Voice Signature...</span>
                   </div>
                </div>
             )}

             <div className="shrink-0 flex flex-col items-center gap-2">
                <div className={`p-4 rounded-2xl shadow-lg transition-colors ${context.clonedVoiceBase64 ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-400 border border-slate-700'}`}>
                   <ICONS.Speaker />
                </div>
                <span className="text-[8px] font-black uppercase text-red-400 tracking-widest">Voice Identity Lab</span>
             </div>

             <div className="flex-1 space-y-3">
                <div className="flex justify-between items-center">
                   <label className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-300 ml-1">Clone Customer Voice (MP3)</label>
                   {context.clonedVoiceBase64 && (
                     <div className="flex gap-2">
                        <button 
                          onClick={playVoiceSample}
                          className={`px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest transition-all ${isPlayingVoice ? 'bg-rose-500 text-white animate-pulse' : 'bg-emerald-500 text-white hover:bg-emerald-600'}`}
                        >
                          {isPlayingVoice ? 'Stop' : 'Play Sample'}
                        </button>
                        <button 
                          onClick={() => onContextChange({...context, clonedVoiceBase64: undefined, vocalPersonaAnalysis: undefined, clonedVoiceMimeType: undefined})}
                          className="px-3 py-1 bg-slate-700 text-slate-400 hover:text-rose-400 rounded-full text-[8px] font-black uppercase tracking-widest"
                        >
                          Clear
                        </button>
                     </div>
                   )}
                </div>
                <div 
                   onClick={() => voiceInputRef.current?.click()}
                   className="w-full bg-slate-800/50 border-2 border-dashed border-slate-700 hover:border-red-500 rounded-2xl px-6 py-4 cursor-pointer transition-all flex items-center gap-4 group"
                >
                   <input 
                      type="file" 
                      ref={voiceInputRef} 
                      className="hidden" 
                      accept=".mp3,.wav,.m4a" 
                      onChange={handleVoiceUpload} 
                   />
                   <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-transform ${context.clonedVoiceBase64 ? 'bg-emerald-600 text-white' : 'bg-slate-700 text-red-400 group-hover:scale-110'}`}>
                      <ICONS.Play className="w-3.5 h-3.5" />
                   </div>
                   <p className="text-xs font-bold text-slate-400 group-hover:text-slate-200">
                      {context.clonedVoiceBase64 ? 'Identity Locked. Click to swap.' : 'Upload prospect voice sample...'}
                   </p>
                </div>
                {context.vocalPersonaAnalysis && (
                   <div className="group/sig relative">
                      <p className="text-[9px] text-red-300/80 font-medium italic border-l-2 border-red-500/30 pl-3 leading-tight line-clamp-2 cursor-help">
                        Analyzed Signature: {context.vocalPersonaAnalysis}
                      </p>
                      <div className="absolute left-0 bottom-full mb-2 w-full p-4 bg-slate-800 border border-slate-700 rounded-xl opacity-0 group-hover/sig:opacity-100 transition-opacity z-50 shadow-2xl pointer-events-none max-h-40 overflow-y-auto no-scrollbar">
                         <p className="text-[10px] text-red-100 leading-relaxed italic">{context.vocalPersonaAnalysis}</p>
                      </div>
                   </div>
                )}
             </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12 border-b border-slate-100 pb-12 mb-12">
          <div className="space-y-6">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
               <div className="text-red-500"><ICONS.Trophy /></div>
               <h4 className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-500">Seller Side</h4>
            </div>
            <div className="space-y-5">
              <Input label="Seller Company" value={context.sellerCompany} onChange={v => handleChange('sellerCompany', v)} placeholder="e.g. Your Organization Name" />
              <Input label="Seller Name(s)" value={context.sellerNames} onChange={v => handleChange('sellerNames', v)} placeholder="e.g. Full names of participants" />
            </div>
          </div>

          <div className="space-y-6">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
               <div className="text-rose-500"><ICONS.Search /></div>
               <h4 className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-500">Prospect Side</h4>
            </div>
            <div className="space-y-5">
              <Input label="Client Company" value={context.clientCompany} onChange={v => handleChange('clientCompany', v)} placeholder="e.g. Prospect Organization Name" />
              <Input label="Power Brokers & Stakeholders" value={context.clientNames} onChange={v => handleChange('clientNames', v)} placeholder="e.g. Names and titles extracted from doc" />
            </div>
          </div>

          <div className="space-y-6">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
               <div className="text-emerald-500"><ICONS.Efficiency /></div>
               <h4 className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-500">Solution Context</h4>
            </div>
            <div className="space-y-5">
              <Input label="Target Products / Services" value={context.targetProducts} onChange={v => handleChange('targetProducts', v)} placeholder="e.g. Enterprise Solution XYZ" />
              <Input label="Product Domain" value={context.productDomain} onChange={v => handleChange('productDomain', v)} placeholder="e.g. Cybersecurity, AI SaaS" />
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="pt-2">
             <div className="flex items-center justify-between mb-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em] ml-1">Meeting Focus / Domains</label>
             </div>
             <Input 
               label="" 
               value={context.meetingFocus} 
               onChange={v => handleChange('meetingFocus', v)} 
               placeholder="e.g. ROI presentation, Technical deep-dive on integration APIs, Q3 Budget Review"
               isLarge
             />
          </div>
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
              className={`p-8 rounded-[2.5rem] border-2 text-left transition-all relative overflow-hidden group flex flex-col h-full ${context.persona === p.type ? 'bg-red-600 border-red-600 shadow-2xl scale-[1.02]' : 'bg-white border-slate-100 hover:border-red-300 shadow-sm'}`}
            >
              <div className={`p-4 rounded-2xl mb-6 inline-block ${context.persona === p.type ? 'bg-white/20 text-white' : 'bg-red-50 text-red-500'}`}>{p.icon}</div>
              <p className={`font-black text-base uppercase tracking-widest mb-3 ${context.persona === p.type ? 'text-white' : 'text-slate-800'}`}>{p.label}</p>
              <p className={`text-[11px] leading-relaxed font-medium mb-6 ${context.persona === p.type ? 'text-red-100' : 'text-slate-500'}`}>{p.desc}</p>
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-6">
        <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
          <ICONS.Sparkles /> Desired Strategic Response Styles
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {ANSWER_STYLES.map(style => (
            <button
              key={style}
              onClick={() => toggleStyle(style)}
              className={`px-4 py-4 rounded-[1.25rem] text-[9px] font-black uppercase tracking-widest border transition-all leading-tight text-center ${context.answerStyles.includes(style) ? 'bg-red-600 text-white border-red-600 shadow-lg' : 'bg-white text-slate-500 border-slate-100 hover:border-red-200 shadow-sm'}`}
            >
              {style}
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
            placeholder="e.g. Q3 renewal discussion..."
          />
        </div>

        <div className="bg-white rounded-[2.5rem] p-10 shadow-xl border border-slate-100 space-y-6 flex flex-col h-full">
           <div className="flex items-center justify-between">
              <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                 Potential Objections
              </h3>
              <span className="text-[8px] font-black uppercase text-rose-500 bg-rose-50 px-2 py-1 rounded-md border border-rose-100">Inferred Resistance Nodes</span>
           </div>
           <div className="flex gap-3 mb-6">
            <input
              type="text"
              value={objectionInput}
              onChange={e => setObjectionInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addObjection()}
              placeholder="e.g. Price is too high, Legacy integration..."
              className="flex-1 bg-slate-50 border-2 border-slate-100 rounded-2xl px-6 py-3 text-sm focus:border-red-500 focus:bg-white outline-none transition-all shadow-inner"
            />
            <button onClick={addObjection} className="p-3 bg-rose-600 text-white rounded-2xl hover:bg-rose-700 shadow-xl transition-all"><ICONS.X className="rotate-45" /></button>
          </div>
          <div className="flex-1 overflow-y-auto max-h-40 custom-scrollbar pr-2 space-y-2">
            {context.potentialObjections.map((obj, i) => (
              <div key={i} className="flex items-center justify-between p-3 bg-rose-50/50 border border-rose-100 rounded-xl group animate-in slide-in-from-right-2 duration-300">
                <div className="flex flex-col">
                   <p className="text-[11px] font-bold text-rose-800 leading-snug">“{obj}”</p>
                </div>
                <button onClick={() => handleChange('potentialObjections', context.potentialObjections.filter((_, idx) => idx !== i))} className="text-rose-300 hover:text-rose-600"><ICONS.Trash className="w-3.5 h-3.5" /></button>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-slate-900 rounded-[3rem] p-12 shadow-2xl relative overflow-hidden group">
        <div className="absolute top-0 right-0 p-10 opacity-10 transition-opacity">
          <ICONS.Brain className="text-red-400 w-24 h-24" />
        </div>
        <div className="relative z-10 space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-red-400 text-[11px] font-black uppercase tracking-[0.4em]">Neural Core System Prompt</h3>
            <button 
              onClick={savePrompt}
              className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg active:scale-95 ${isSaved ? 'bg-emerald-500 text-white' : 'bg-red-600 text-white hover:bg-red-700'}`}
            >
              {isSaved ? 'Prompt Retained' : 'Update & Save Prompt'}
            </button>
          </div>
          <textarea
            value={localPrompt}
            onChange={e => handlePromptUpdate(e.target.value)}
            className="w-full bg-slate-800/40 text-slate-200 border-2 border-slate-700/50 rounded-[2.5rem] p-10 text-sm focus:border-red-500 outline-none transition-all h-40 font-mono leading-relaxed shadow-inner"
            placeholder="AI system prompt..."
          />
        </div>
      </div>
      <style>{`
        @keyframes waveform-sm {
          0%, 100% { transform: scaleY(0.5); }
          50% { transform: scaleY(1); }
        }
        .animate-waveform-sm {
          animation: waveform-sm 0.5s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
};

const Input = ({ label, value, onChange, placeholder, isLarge }: { label: string; value: string; onChange: (v: string) => void; placeholder: string, isLarge?: boolean }) => (
  <div className="space-y-2">
    {label && <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em] ml-1">{label}</label>}
    <input
      type="text"
      value={value}
      onChange={e => onChange(e.target.value)}
      className={`w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-6 py-4 text-sm focus:border-red-500 focus:bg-white outline-none transition-all font-semibold text-slate-800 placeholder:text-slate-300 shadow-inner ${isLarge ? 'text-lg py-6' : ''}`}
      placeholder={placeholder}
    />
  </div>
);
