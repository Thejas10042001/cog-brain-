import React, { useState, useEffect, useRef } from 'react';
import { MeetingContext, CustomerPersonaType, VoiceMode, StoredDocument, VocalPersonaStructure } from '../types';
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

const AI_VOICE_PERSONAS = [
  { id: 'pro-male', label: 'Pro Male', desc: 'Direct, authoritative, business-first.', baseVoice: 'Kore', directive: 'Adopt a professional male resonance. Pacing should be steady and deliberate. Articulation must be crisp. Project absolute authority and business-first logic.' },
  { id: 'high-energy', label: 'High Energy', desc: 'Enthusiastic, engaging, persuasive.', baseVoice: 'Puck', directive: 'Adopt a high-energy, upward-inflecting tone. Rapid tempo but controlled. Infuse every sentence with enthusiasm and persuasive conviction.' },
  { id: 'deep-authority', label: 'Deep Authority', desc: 'Serious, steady, risk-conscious.', baseVoice: 'Charon', directive: 'A deep, heavy baritone. Pacing is slow and weight-bearing. This voice should project risk-consciousness and the gravity of board-level decisions.' },
  { id: 'calm-strategist', label: 'Calm Strategist', desc: 'Consultative, soft, trusted advisor.', baseVoice: 'Zephyr', directive: 'Soft-spoken, melodic, and consultative. Use thoughtful pauses. This voice is designed to project the calm of a trusted strategic advisor.' },
];

const PUBLIC_PERSONALITIES = [
  { id: 'jobs', label: 'The Visionary', desc: 'Steve Jobs style', baseVoice: 'Kore', directive: 'Minimalist, rhythmic pacing. Uses dramatic pauses and hyperbole. High visionary energy that demands the future.' },
  { id: 'altman', label: 'The AI Architect', desc: 'Sam Altman style', baseVoice: 'Zephyr', directive: 'Neutral, fast-paced, highly articulate and logic-dense. Calm but intense intellectual speed.' },
  { id: 'huang', label: 'The Growth Titan', desc: 'Jensen Huang style', baseVoice: 'Charon', directive: 'High confidence, enthusiastic storytelling about architectural scale and the compounding of technology.' },
  { id: 'musk', label: 'The Disruptor', desc: 'Elon Musk style', baseVoice: 'Kore', directive: 'Abrupt pacing, thoughtful mid-sentence pauses, focusing on first-principles and mission urgency.' },
  { id: 'perkins', label: 'The Unicorn Founder', desc: 'Melanie Perkins style', baseVoice: 'Puck', directive: 'Highly energetic, design-focused, optimistic, and articulate with a focus on creative empowerment.' },
  { id: 'benioff', label: 'The SaaS Pioneer', desc: 'Marc Benioff style', baseVoice: 'Charon', directive: 'Deep baritone, booming executive presence, high warmth, focusing on customer success and values.' },
];

export const MeetingContextConfig: React.FC<MeetingContextConfigProps> = ({ context, onContextChange, documents = [] }) => {
  const [keywordInput, setKeywordInput] = useState("");
  const [objectionInput, setObjectionInput] = useState("");
  const [localPrompt, setLocalPrompt] = useState(context.baseSystemPrompt);
  const [showHelp, setShowHelp] = useState(true);
  const [isExtracting, setIsExtracting] = useState(false);
  const [isAnalyzingVoice, setIsAnalyzingVoice] = useState(false);
  const [isPlayingVoice, setIsPlayingVoice] = useState(false);
  const [showVocalDirective, setShowVocalDirective] = useState(false);
  const isCustomizedRef = useRef(false);
  const voiceInputRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (!isCustomizedRef.current) {
      generateBasePrompt();
    }
  }, [context.persona, context.answerStyles, context.meetingFocus, context.vocalPersonaAnalysis, context.potentialObjections, context.voiceMode]);

  useEffect(() => {
    setLocalPrompt(context.baseSystemPrompt);
  }, [context.baseSystemPrompt]);

  const generateBasePrompt = () => {
    const selectedPersona = PERSONAS.find(p => p.type === context.persona);
    const personaGuidance = selectedPersona?.strategicGuidance || "";

    let activeMimicry = "";
    if (context.vocalPersonaAnalysis) {
        activeMimicry = context.vocalPersonaAnalysis.mimicryDirective;
    }

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

${activeMimicry ? `BEHAVIORAL IDENTITY MIMICRY ACTIVE (PROTOCOL: ${context.voiceMode.toUpperCase()}):
You must mirror the following signature in your behavioral logic, emotional subtext, and linguistic pacing:
"${activeMimicry}"` : ''}

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
          voiceMode: 'upload',
          clonedVoiceBase64: base64,
          clonedVoiceMimeType: file.type,
          vocalPersonaAnalysis: {
            ...analysis,
            baseVoice: 'Charon' // Default base for user clones
          }
        });
        setIsAnalyzingVoice(false);
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error("Voice analysis error:", err);
      setIsAnalyzingVoice(false);
    }
  };

  const selectAIPersona = (p: typeof AI_VOICE_PERSONAS[0]) => {
    onContextChange({
      ...context,
      voiceMode: 'persona',
      selectedPersonaId: p.id,
      selectedPersonalityId: undefined,
      clonedVoiceBase64: undefined,
      vocalPersonaAnalysis: {
        pitch: p.id === 'pro-male' || p.id === 'deep-authority' ? 'Lower' : 'Moderate',
        tempo: p.id === 'high-energy' ? 'Fast' : 'Controlled',
        cadence: 'Strategic',
        accent: 'Neutral',
        emotionalBaseline: 'Steady',
        breathingPatterns: 'Regulated',
        mimicryDirective: p.directive,
        baseVoice: p.baseVoice
      }
    });
  };

  const selectPersonality = (p: typeof PUBLIC_PERSONALITIES[0]) => {
    onContextChange({
      ...context,
      voiceMode: 'personality',
      selectedPersonalityId: p.id,
      selectedPersonaId: undefined,
      clonedVoiceBase64: undefined,
      vocalPersonaAnalysis: {
        pitch: 'Characteristic',
        tempo: 'Signature',
        cadence: 'Characteristic',
        accent: 'Characteristic',
        emotionalBaseline: 'Characteristic',
        breathingPatterns: 'Signature',
        mimicryDirective: p.directive,
        baseVoice: p.baseVoice
      }
    });
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
          className={`flex items-center gap-2 px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-all border ${showHelp ? 'bg-indigo-600 text-white border-indigo-700 shadow-lg' : 'bg-white text-slate-400 border-slate-200'}`}
        >
          <ICONS.Sparkles className="w-3.5 h-3.5" />
          {showHelp ? "Hide Intelligence Guidance" : "Show Intelligence Guidance"}
        </button>
      </div>

      <div className="bg-white rounded-[2.5rem] p-10 shadow-2xl border border-slate-200 overflow-hidden relative">
        <div className="flex items-center gap-3 mb-10">
          <div className="p-3 bg-indigo-600 text-white rounded-2xl shadow-lg"><ICONS.Document /></div>
          <div>
            <h3 className="text-2xl font-bold text-slate-800 tracking-tight">Meeting Intel Configuration</h3>
            <p className="text-sm text-slate-400 font-bold uppercase tracking-widest">Define the strategic landscape</p>
          </div>
        </div>

        {showHelp && (
          <div className="mb-10 p-6 bg-indigo-50/50 border border-indigo-100 rounded-[2rem] animate-in slide-in-from-top-4">
             <div className="flex items-center gap-3 mb-3">
                <ICONS.Research className="text-indigo-600 w-4 h-4" />
                <h4 className="text-[10px] font-black uppercase tracking-widest text-indigo-700">Strategic Orientation Guide</h4>
             </div>
             <p className="text-xs text-indigo-900 font-medium leading-relaxed">
               Accurate configuration allows the AI to prioritize "Winning Arguments" specifically tailored to your role, the client's industry, and the specific phase of the sales cycle.
             </p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
          <div className="p-8 bg-indigo-50 border border-indigo-100 rounded-[2rem] flex flex-col md:flex-row md:items-center gap-8 shadow-inner relative overflow-hidden h-full">
             {isExtracting && (
               <div className="absolute inset-0 bg-indigo-600/5 backdrop-blur-[2px] flex items-center justify-center z-10 animate-in fade-in">
                 <div className="flex items-center gap-3 px-6 py-3 bg-white border border-indigo-100 rounded-full shadow-xl">
                   <div className="w-4 h-4 border-2 border-indigo-100 border-t-indigo-600 rounded-full animate-spin"></div>
                   <span className="text-[10px] font-black uppercase text-indigo-600 tracking-widest animate-pulse">Neural Extraction Active...</span>
                 </div>
               </div>
             )}
             
             <div className="shrink-0 flex flex-col items-center gap-2">
                <div className="p-4 bg-indigo-600 text-white rounded-2xl shadow-lg">
                   <ICONS.Shield />
                </div>
                <span className="text-[8px] font-black uppercase text-indigo-500 tracking-widest">Neural Anchor</span>
             </div>
             <div className="flex-1 space-y-3">
                <label className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-900 ml-1">Know Your Customer (KYC) Document</label>
                <select 
                  value={context.kycDocId || ""} 
                  onChange={(e) => handleKycChange(e.target.value)}
                  className="w-full bg-white border-2 border-slate-200 rounded-2xl px-6 py-4 text-sm font-bold text-slate-700 outline-none focus:border-indigo-500 transition-all shadow-sm"
                >
                  <option value="">Select behavior grounding source...</option>
                  {documents.map(d => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
                <p className="text-[9px] text-slate-500 font-medium italic">Auto-populates Power Brokers and Predicted Resistance Nodes.</p>
             </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-[2rem] flex flex-col shadow-2xl relative overflow-hidden h-full text-white transition-all duration-500">
             {/* Voice Mode Selector Header */}
             <div className="flex border-b border-white/5 p-1">
                <button 
                  onClick={() => handleChange('voiceMode', 'upload')}
                  className={`flex-1 flex flex-col items-center py-3 rounded-t-xl transition-all ${context.voiceMode === 'upload' ? 'bg-white/10 text-indigo-400' : 'text-slate-500 hover:text-slate-300'}`}
                >
                   <ICONS.Document className="w-3 h-3 mb-1" />
                   <span className="text-[7px] font-black uppercase tracking-[0.2em]">Biological Trace</span>
                </button>
                <button 
                  onClick={() => handleChange('voiceMode', 'persona')}
                  className={`flex-1 flex flex-col items-center py-3 rounded-t-xl transition-all ${context.voiceMode === 'persona' ? 'bg-white/10 text-indigo-400' : 'text-slate-500 hover:text-slate-300'}`}
                >
                   <ICONS.Brain className="w-3 h-3 mb-1" />
                   <span className="text-[7px] font-black uppercase tracking-[0.2em]">Neural Presets</span>
                </button>
                <button 
                  onClick={() => handleChange('voiceMode', 'personality')}
                  className={`flex-1 flex flex-col items-center py-3 rounded-t-xl transition-all ${context.voiceMode === 'personality' ? 'bg-white/10 text-indigo-400' : 'text-slate-500 hover:text-slate-300'}`}
                >
                   <ICONS.Trophy className="w-3 h-3 mb-1" />
                   <span className="text-[7px] font-black uppercase tracking-[0.2em]">Elite Icons</span>
                </button>
             </div>

             <div className="p-6 relative flex-1">
                 {isAnalyzingVoice && (
                     <div className="absolute inset-0 bg-indigo-600/10 backdrop-blur-sm flex items-center justify-center z-20">
                         <div className="flex flex-col items-center gap-3">
                             <div className="flex gap-1.5 items-end h-8">
                                 {[...Array(6)].map((_, i) => (
                                 <div key={i} className="w-1 bg-indigo-500 rounded-full animate-waveform-sm" style={{ animationDelay: `${i*0.1}s`, height: `${40 + Math.random() * 60}%` }}></div>
                                 ))}
                             </div>
                             <span className="text-[9px] font-black uppercase tracking-[0.3em] text-indigo-400 animate-pulse">Fingerprinting Voice Signature...</span>
                         </div>
                     </div>
                 )}

                 {/* UPLOAD MODE CONTENT */}
                 {context.voiceMode === 'upload' && (
                    <div className="space-y-4 animate-in fade-in duration-300">
                        {!context.clonedVoiceBase64 ? (
                        <div 
                            onClick={() => voiceInputRef.current?.click()}
                            className="w-full bg-slate-800/50 border-2 border-dashed border-slate-700 hover:border-indigo-500 rounded-2xl px-6 py-8 cursor-pointer transition-all flex flex-col items-center gap-4 group"
                        >
                            <input type="file" ref={voiceInputRef} className="hidden" accept=".mp3,.wav,.m4a" onChange={handleVoiceUpload} />
                            <div className="w-12 h-12 rounded-full bg-slate-700 text-indigo-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                                <ICONS.Speaker className="w-5 h-5" />
                            </div>
                            <div className="text-center">
                               <p className="text-[10px] font-black uppercase text-slate-300 tracking-widest">Biological Trace Upload</p>
                               <p className="text-[8px] font-bold text-slate-500 group-hover:text-slate-400 mt-1">Accepts MP3/WAV/M4A (Max 10MB)</p>
                            </div>
                        </div>
                        ) : (
                        <div className="space-y-4">
                            <div className="flex justify-between items-center bg-white/5 p-3 rounded-xl border border-white/5">
                                <div className="flex items-center gap-3">
                                   <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                                   <span className="text-[9px] font-black uppercase text-slate-300 tracking-widest">Trace Synced</span>
                                </div>
                                <div className="flex gap-2">
                                    <button onClick={playVoiceSample} className={`px-4 py-1.5 rounded-lg text-[8px] font-black uppercase tracking-widest transition-all ${isPlayingVoice ? 'bg-rose-500' : 'bg-emerald-600 hover:bg-emerald-500'}`}>
                                        {isPlayingVoice ? 'Stop' : 'Play'}
                                    </button>
                                    <button onClick={() => onContextChange({...context, clonedVoiceBase64: undefined, vocalPersonaAnalysis: undefined})} className="p-1.5 text-slate-500 hover:text-rose-400 transition-colors"><ICONS.Trash className="w-3.5 h-3.5" /></button>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <VocalTrait label="Pitch" val={context.vocalPersonaAnalysis?.pitch || '...'} color="indigo" />
                                <VocalTrait label="Tempo" val={context.vocalPersonaAnalysis?.tempo || '...'} color="indigo" />
                            </div>
                        </div>
                        )}
                    </div>
                 )}

                 {/* PERSONA MODE CONTENT */}
                 {context.voiceMode === 'persona' && (
                    <div className="grid grid-cols-2 gap-3 animate-in fade-in duration-300 h-full overflow-y-auto no-scrollbar pb-4">
                        {AI_VOICE_PERSONAS.map(p => (
                            <button 
                                key={p.id}
                                onClick={() => selectAIPersona(p)}
                                className={`p-4 rounded-2xl border-2 text-left transition-all ${context.selectedPersonaId === p.id ? 'bg-indigo-600 border-indigo-500 shadow-lg' : 'bg-slate-800/50 border-white/5 hover:border-indigo-400/50'}`}
                            >
                                <h5 className={`text-[10px] font-black uppercase tracking-widest mb-1 ${context.selectedPersonaId === p.id ? 'text-white' : 'text-indigo-400'}`}>{p.label}</h5>
                                <p className={`text-[8px] font-bold leading-relaxed ${context.selectedPersonaId === p.id ? 'text-indigo-100' : 'text-slate-500'}`}>{p.desc}</p>
                            </button>
                        ))}
                    </div>
                 )}

                 {/* PERSONALITY MODE CONTENT */}
                 {context.voiceMode === 'personality' && (
                    <div className="grid grid-cols-2 gap-3 animate-in fade-in duration-300 h-full overflow-y-auto no-scrollbar pb-4 pr-1">
                        {PUBLIC_PERSONALITIES.map(p => (
                            <button 
                                key={p.id}
                                onClick={() => selectPersonality(p)}
                                className={`p-4 rounded-xl border-2 text-left transition-all flex flex-col justify-between ${context.selectedPersonalityId === p.id ? 'bg-emerald-600 border-emerald-500 shadow-lg' : 'bg-slate-800/50 border-white/5 hover:border-emerald-400/50'}`}
                            >
                                <div className="flex justify-between items-start mb-2">
                                    <h5 className={`text-[10px] font-black uppercase tracking-widest ${context.selectedPersonalityId === p.id ? 'text-white' : 'text-emerald-400'}`}>{p.label}</h5>
                                    {context.selectedPersonalityId === p.id && <div className="w-1.5 h-1.5 bg-white rounded-full animate-ping"></div>}
                                </div>
                                <p className={`text-[8px] font-bold leading-tight ${context.selectedPersonalityId === p.id ? 'text-emerald-100' : 'text-slate-500'}`}>{p.desc}</p>
                            </button>
                        ))}
                    </div>
                 )}
             </div>

             {/* Footer Info */}
             <div className="px-6 py-3 bg-white/5 border-t border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                   <div className={`w-1.5 h-1.5 rounded-full ${context.vocalPersonaAnalysis ? 'bg-emerald-500' : 'bg-slate-600'}`}></div>
                   <span className="text-[7px] font-black uppercase text-slate-500 tracking-widest">
                     {context.vocalPersonaAnalysis ? 'Neural Link Grounded' : 'Neural Link Required'}
                   </span>
                </div>
                <button onClick={() => setShowVocalDirective(!showVocalDirective)} className="text-[7px] font-black uppercase text-indigo-400 hover:text-indigo-300 tracking-widest transition-colors">
                  Directive Logic
                </button>
             </div>
             {showVocalDirective && context.vocalPersonaAnalysis && (
                 <div className="p-4 bg-slate-950 border-t border-white/10 text-[9px] text-indigo-300 italic leading-relaxed animate-in slide-in-from-top-2">
                     "{context.vocalPersonaAnalysis.mimicryDirective}"
                 </div>
             )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12 border-b border-slate-100 pb-12 mb-12">
          <div className="space-y-6">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
               <div className="text-indigo-500"><ICONS.Trophy /></div>
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
              className={`p-8 rounded-[2.5rem] border-2 text-left transition-all relative overflow-hidden group flex flex-col h-full ${context.persona === p.type ? 'bg-indigo-600 border-indigo-600 shadow-2xl scale-[1.02]' : 'bg-white border-slate-100 hover:border-indigo-300 shadow-sm'}`}
            >
              <div className={`p-4 rounded-2xl mb-6 inline-block ${context.persona === p.type ? 'bg-white/20 text-white' : 'bg-indigo-50 text-indigo-500'}`}>{p.icon}</div>
              <p className={`font-black text-base uppercase tracking-widest mb-3 ${context.persona === p.type ? 'text-white' : 'text-slate-800'}`}>{p.label}</p>
              <p className={`text-[11px] leading-relaxed font-medium mb-6 ${context.persona === p.type ? 'text-indigo-100' : 'text-slate-500'}`}>{p.desc}</p>
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
            className="w-full bg-slate-50 border-2 border-slate-100 rounded-3xl p-8 text-sm focus:border-indigo-500 focus:bg-white outline-none transition-all h-40 resize-none shadow-inner leading-relaxed"
            placeholder="e.g. Q3 renewal discussion..."
          />
        </div>

        <div className="bg-white rounded-[2.5rem] p-10 shadow-xl border border-slate-100 space-y-6 flex flex-col h-full">
           <div className="flex items-center justify-between">
              <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                 <ICONS.Security className="text-rose-500" /> Potential Objections
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
              className="flex-1 bg-slate-50 border-2 border-slate-100 rounded-2xl px-6 py-3 text-sm focus:border-indigo-500 focus:bg-white outline-none transition-all shadow-inner"
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

const VocalTrait = ({ label, val, color }: { label: string, val: string, color: string }) => (
  <div className={`p-3 rounded-xl bg-white/5 border border-white/10 flex flex-col gap-1 hover:border-${color}-500/50 transition-all w-full`}>
    <span className="text-[7px] font-black uppercase text-slate-500 tracking-widest">{label}</span>
    <span className="text-[10px] font-bold text-white truncate">{val}</span>
  </div>
);

const Input = ({ label, value, onChange, placeholder, isLarge }: { label: string; value: string; onChange: (v: string) => void; placeholder: string, isLarge?: boolean }) => (
  <div className="space-y-2">
    {label && <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em] ml-1">{label}</label>}
    <input
      type="text"
      value={value}
      onChange={e => onChange(e.target.value)}
      className={`w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-6 py-4 text-sm focus:border-indigo-500 focus:bg-white outline-none transition-all font-semibold text-slate-800 placeholder:text-slate-300 shadow-inner ${isLarge ? 'text-lg py-6' : ''}`}
      placeholder={placeholder}
    />
  </div>
);