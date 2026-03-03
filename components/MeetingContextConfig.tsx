import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MeetingContext, CustomerPersonaType, VoiceMode, StoredDocument, VocalPersonaStructure, UploadedFile } from '../types';
import { ICONS } from '../constants';
import { extractMetadataFromDocument, analyzeVocalPersona, suggestVocalPersonaFromDoc, generateVoiceSample } from '../services/geminiService';
import { FileUpload } from './FileUpload';
import { DocumentGallery } from './DocumentGallery';

interface MeetingContextConfigProps {
  context: MeetingContext;
  onContextChange: (context: MeetingContext) => void;
  documents?: StoredDocument[];
  files: UploadedFile[];
  onFilesChange: (files: UploadedFile[]) => void;
  onUploadSuccess: () => void;
  selectedLibraryDocIds: string[];
  onToggleLibraryDoc: (id: string) => void;
  onSynthesize: (currentContext?: MeetingContext) => void;
  onSave?: () => void;
  isAnalyzing: boolean;
  hasAnalysis: boolean;
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
  { id: 'pro-male', label: 'Pro Male', desc: 'Direct, authoritative, business-first.', baseVoice: 'Zephyr', gender: 'Male', directive: 'Adopt a professional male resonance. Pacing should be steady and deliberate. Articulation must be crisp. Project absolute authority and business-first logic.' },
  { id: 'high-energy', label: 'High Energy', desc: 'Enthusiastic, engaging, persuasive.', baseVoice: 'Puck', gender: 'Male', directive: 'Adopt a high-energy, upward-inflecting tone. Rapid tempo but controlled. Infuse every sentence with enthusiasm and persuasive conviction.' },
  { id: 'deep-authority', label: 'Deep Authority', desc: 'Serious, steady, risk-conscious.', baseVoice: 'Charon', gender: 'Male', directive: 'A deep, heavy baritone. Pacing is slow and weight-bearing. This voice should project risk-consciousness and the gravity of board-level decisions.' },
  { id: 'calm-strategist', label: 'Calm Strategist', desc: 'Consultative, soft, trusted advisor.', baseVoice: 'Zephyr', gender: 'Male', directive: 'Soft-spoken, melodic, and consultative. Use thoughtful pauses. This voice is designed to project the calm of a trusted strategic advisor.' },
  { id: 'pro-female', label: 'Pro Female', desc: 'Professional, articulate, steady.', baseVoice: 'Kore', gender: 'Female', directive: 'Adopt a professional female resonance. Pacing is balanced and articulate. Project confidence and strategic clarity.' },
];

const PUBLIC_PERSONALITIES = [
  { id: 'jobs', label: 'The Visionary', desc: 'Steve Jobs style', baseVoice: 'Charon', gender: 'Male', directive: 'Minimalist, rhythmic pacing. Uses dramatic pauses and hyperbole. High visionary energy that demands the future.' },
  { id: 'altman', label: 'The AI Architect', desc: 'Sam Altman style', baseVoice: 'Zephyr', gender: 'Male', directive: 'Neutral, fast-paced, highly articulate and logic-dense. Calm but intense intellectual speed.' },
  { id: 'huang', label: 'The Growth Titan', desc: 'Jensen Huang style', baseVoice: 'Fenrir', gender: 'Male', directive: 'High confidence, enthusiastic storytelling about architectural scale and the compounding of technology.' },
  { id: 'musk', label: 'The Disruptor', desc: 'Elon Musk style', baseVoice: 'Charon', gender: 'Male', directive: 'Abrupt pacing, thoughtful mid-sentence pauses, focusing on first-principles and mission urgency.' },
  { id: 'perkins', label: 'The Unicorn Founder', desc: 'Melanie Perkins style', baseVoice: 'Kore', gender: 'Female', directive: 'Highly energetic, design-focused, optimistic, and articulate with a focus on creative empowerment.' },
  { id: 'benioff', label: 'The SaaS Pioneer', desc: 'Marc Benioff style', baseVoice: 'Fenrir', gender: 'Male', directive: 'Deep baritone, booming executive presence, high warmth, focusing on customer success and values.' },
];

export const MeetingContextConfig: React.FC<MeetingContextConfigProps> = ({ 
  context, 
  onContextChange, 
  documents = [],
  files,
  onFilesChange,
  onUploadSuccess,
  selectedLibraryDocIds,
  onToggleLibraryDoc,
  onSynthesize,
  onSave,
  isAnalyzing,
  hasAnalysis
}) => {
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [keywordInput, setKeywordInput] = useState("");
  const [objectionInput, setObjectionInput] = useState("");
  const [localPrompt, setLocalPrompt] = useState(context.baseSystemPrompt);
  const [showHelp, setShowHelp] = useState(true);
  const [isExtracting, setIsExtracting] = useState(false);
  const [isSavingVoice, setIsSavingVoice] = useState(false);
  const [isAnalyzingVoice, setIsAnalyzingVoice] = useState(false);
  const [isPlayingVoice, setIsPlayingVoice] = useState(false);
  const [showVocalDirective, setShowVocalDirective] = useState(false);
  const [showKycGuide, setShowKycGuide] = useState(false);
  const isCustomizedRef = useRef(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const ttsAudioRef = useRef<HTMLAudioElement | null>(null);

  const speak = (text: string) => {
    if (!audioEnabled) return;
    window.dispatchEvent(new CustomEvent('assistant-speak', { detail: { text } }));
  };

  useEffect(() => {
    if (!audioEnabled) return;
    speak("Welcome to the Intelligence Node Settings. All strategic parameters are now accessible on this single-page interface for holistic synthesis.");
  }, [audioEnabled]);

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

  const selectAIPersona = (p: any) => {
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
        baseVoice: p.baseVoice,
        gender: p.gender || 'Male',
        pace: 1.0,
        stability: 80,
        clarity: 90,
        pitchValue: 1.0,
        toneAdjectives: []
      }
    });
  };

  const selectPersonality = (p: any) => {
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
        baseVoice: p.baseVoice,
        gender: p.gender || 'Male',
        pace: 1.0,
        stability: 80,
        clarity: 90,
        pitchValue: 1.0,
        toneAdjectives: []
      }
    });
  };

  const handleTestVoice = async () => {
    if (isPlayingVoice) {
      audioRef.current?.pause();
      setIsPlayingVoice(false);
      return;
    }
    
    const analysis = context.vocalPersonaAnalysis;
    if (!analysis) return;

    setIsAnalyzingVoice(true);
    try {
      const sampleText = `Hello, this is a preview of my vocal signature. My tone is ${analysis.toneAdjectives?.join(', ') || 'professional'}. I am ready for your cognitive simulation.`;
      const base64 = await generateVoiceSample(sampleText, analysis.baseVoice || 'Kore', analysis.gender, analysis);
      const audio = new Audio(`data:audio/wav;base64,${base64}`);
      audioRef.current = audio;
      audio.onended = () => setIsPlayingVoice(false);
      audio.play().catch(err => {
        const isInterrupted = err.name === 'AbortError' || 
                             err.name === 'NotAllowedError' ||
                             (err.message && err.message.includes('interrupted by a call to pause')) ||
                             (err.message && err.message.includes('interact with the document first'));
        if (!isInterrupted) {
          console.error("Audio play failed:", err);
        }
      });
      setIsPlayingVoice(true);
    } catch (err) {
      console.error(err);
    } finally {
      setIsAnalyzingVoice(false);
    }
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

      // If in Neural Vocal Sync mode, also suggest vocal parameters
      let vocalAnalysis = context.vocalPersonaAnalysis;
      if (context.voiceMode === 'upload') {
        vocalAnalysis = await suggestVocalPersonaFromDoc(doc.content);
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
        potentialObjections: metadata.potentialObjections || context.potentialObjections,
        vocalPersonaAnalysis: vocalAnalysis
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

  const updateVocalAnalysis = (updates: Partial<VocalPersonaStructure>) => {
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
      selectedPersonaId: undefined,
      selectedPersonalityId: undefined,
      vocalPersonaAnalysis: { ...current, ...updates }
    });
  };

  const renderAllSections = () => {
    return (
      <div className="space-y-16 animate-in fade-in duration-700">
        {/* Section 1: Library */}
        <div className="space-y-8">
          <div className="flex items-center gap-4 pb-4 border-b-4 border-slate-900">
            <div className="w-12 h-12 bg-slate-900 text-white rounded-2xl flex items-center justify-center font-black text-xl shadow-xl">01</div>
            <div className="flex flex-col">
              <h3 className="text-4xl font-black uppercase tracking-tighter text-slate-900">Cognitive Library Hub</h3>
              <p className="text-[10px] font-black uppercase tracking-widest text-indigo-600 mt-1">Ingest and categorize documentary intelligence to establish a high-fidelity knowledge base for neural synthesis.</p>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-12">
            <div className="bg-white rounded-[3rem] shadow-2xl p-10 border border-slate-200">
              <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2 mb-8">
                <ICONS.Research /> Library Selection
              </h3>
              <DocumentGallery 
                documents={documents} 
                onRefresh={onUploadSuccess} 
                selectedIds={selectedLibraryDocIds}
                onToggleSelect={onToggleLibraryDoc}
                onSynthesize={() => {}} 
                isAnalyzing={isAnalyzing}
                hideSynthesize={true}
              />
            </div>
            <div className="bg-white rounded-[3rem] shadow-2xl p-10 border border-slate-200">
              <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2 mb-8">
                <ICONS.Document /> Documentary Memory Store
              </h3>
              <FileUpload files={files} onFilesChange={onFilesChange} onUploadSuccess={onUploadSuccess} />
            </div>
          </div>
        </div>

        {/* Section 2: Cognitive Mind Core (Renamed from Neural Anchor) */}
        <div className="space-y-8">
          <div className="flex items-center gap-4 pb-4 border-b-4 border-slate-900">
            <div className="w-12 h-12 bg-slate-900 text-white rounded-2xl flex items-center justify-center font-black text-xl shadow-xl">02</div>
            <div className="flex flex-col">
              <h3 className="text-4xl font-black uppercase tracking-tighter text-slate-900">Cognitive Mind Core</h3>
              <p className="text-[10px] font-black uppercase tracking-widest text-indigo-600 mt-1">Anchor the cognitive simulation by selecting a primary KYC node to calibrate seller, client, and solution parameters.</p>
            </div>
          </div>
          <div className="space-y-12">
            <div className="p-12 bg-indigo-50 border border-indigo-100 rounded-[3rem] flex flex-col items-center gap-8 shadow-inner text-center">
              <div className="p-6 bg-indigo-600 text-white rounded-[2rem] shadow-2xl">
                <ICONS.Shield className="w-12 h-12" />
              </div>
              <div className="max-w-xl space-y-4 w-full">
                <h3 className="text-3xl font-black uppercase tracking-widest text-slate-900">Cognitive Mind Core</h3>
                <div className="flex flex-col md:flex-row items-center justify-between gap-4 w-full px-2">
                  <p className="text-slate-500 font-medium">Know Your Customer (KYC) Document</p>
                  <div className="flex items-center gap-3 bg-white/50 backdrop-blur-sm px-4 py-2 rounded-2xl border border-indigo-100 shadow-sm">
                    <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">Lacking high-fidelity KYC intelligence?</span>
                    <button 
                      onClick={() => setShowKycGuide(true)}
                      className="px-4 py-2 bg-indigo-600 text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-indigo-700 transition-all shadow-md active:scale-95"
                    >
                      Click Here
                    </button>
                  </div>
                </div>
                <div className="relative w-full">
                  <select 
                    value={context.kycDocId || ""} 
                    onChange={(e) => handleKycChange(e.target.value)}
                    className={`w-full bg-white border-4 rounded-[2rem] px-8 py-6 text-xl font-bold text-slate-700 outline-none transition-all shadow-xl ${isExtracting ? 'border-indigo-300 opacity-50 cursor-wait' : 'border-slate-200 focus:border-indigo-500'}`}
                    disabled={isExtracting}
                  >
                    <option value="">Select grounding source...</option>
                    {documents.map(d => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                  {isExtracting && (
                    <div className="absolute right-6 top-1/2 -translate-y-1/2">
                      <div className="w-6 h-6 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                    </div>
                  )}
                </div>
                {isExtracting && <p className="text-indigo-600 text-xs font-black uppercase animate-pulse">Extracting Strategic Metadata...</p>}
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-12 bg-white rounded-[3rem] p-12 shadow-2xl border border-slate-200">
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
                  <Input label="Client Name" value={context.clientNames} onChange={v => handleChange('clientNames', v)} placeholder="e.g. Names and titles extracted from doc" />
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
                  <Input label="Meeting Focus / Domains" value={context.meetingFocus} onChange={v => handleChange('meetingFocus', v)} placeholder="e.g. ROI presentation" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Section 3: Target Buyer Persona (Moved from Step 4) */}
        <div className="space-y-8">
          <div className="flex items-center gap-4 pb-4 border-b-4 border-slate-900">
            <div className="w-12 h-12 bg-slate-900 text-white rounded-2xl flex items-center justify-center font-black text-xl shadow-xl">03</div>
            <div className="flex flex-col">
              <h3 className="text-4xl font-black uppercase tracking-tighter text-slate-900">Target Buyer Persona</h3>
              <p className="text-[10px] font-black uppercase tracking-widest text-indigo-600 mt-1">Calibrate the psychological architecture of the target buyer to ensure behavioral alignment during interaction.</p>
            </div>
          </div>
          <div className="space-y-8">
            <div className="text-center space-y-4">
              <p className="text-slate-500 font-medium">Select the psychological profile of your target buyer.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {PERSONAS.map(p => (
                <button
                  key={p.type}
                  onClick={() => handleChange('persona', p.type)}
                  className={`p-8 rounded-[3rem] border-2 text-left transition-all relative overflow-hidden group flex flex-col h-full ${context.persona === p.type ? 'bg-indigo-600 border-indigo-600 shadow-2xl scale-[1.02]' : 'bg-white border-slate-100 hover:border-indigo-300 shadow-sm'}`}
                >
                  <div className={`p-4 rounded-2xl mb-6 inline-block ${context.persona === p.type ? 'bg-white/20 text-white' : 'bg-indigo-50 text-indigo-500'}`}>{p.icon}</div>
                  <p className={`font-black text-base uppercase tracking-widest mb-3 ${context.persona === p.type ? 'text-white' : 'text-slate-800'}`}>{p.label}</p>
                  <p className={`text-[11px] leading-relaxed font-medium ${context.persona === p.type ? 'text-indigo-100' : 'text-slate-500'}`}>{p.desc}</p>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Section 4: Strategy Finalization (Moved from Step 5) */}
        <div className="space-y-8">
          <div className="flex items-center gap-4 pb-4 border-b-4 border-slate-900">
            <div className="w-12 h-12 bg-slate-900 text-white rounded-2xl flex items-center justify-center font-black text-xl shadow-xl">04</div>
            <div className="flex flex-col">
              <h3 className="text-4xl font-black uppercase tracking-tighter text-slate-900">Strategy Finalization</h3>
              <p className="text-[10px] font-black uppercase tracking-widest text-indigo-600 mt-1">Synthesize the final strategic brief by mapping opportunity snapshots and neutralizing predicted resistance nodes.</p>
            </div>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="bg-white rounded-[3rem] p-10 shadow-2xl border border-slate-200 space-y-6">
              <h3 className="text-xl font-bold text-slate-800">Opportunity Snapshot</h3>
              <textarea
                value={context.executiveSnapshot}
                onChange={e => handleChange('executiveSnapshot', e.target.value)}
                className="w-full bg-slate-50 border-2 border-slate-100 rounded-[2rem] p-8 text-sm focus:border-indigo-500 focus:bg-white outline-none transition-all h-48 resize-none shadow-inner leading-relaxed"
                placeholder="e.g. Q3 renewal discussion..."
              />
            </div>

            <div className="bg-white rounded-[3rem] p-10 shadow-2xl border border-slate-200 space-y-6 flex flex-col h-full">
               <div className="flex items-center justify-between">
                  <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                     <ICONS.Security className="text-rose-500" /> Potential Objections
                  </h3>
               </div>
               <div className="flex gap-3 mb-6">
                <input
                  type="text"
                  value={objectionInput}
                  onChange={e => setObjectionInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addObjection()}
                  placeholder="e.g. Price is too high..."
                  className="flex-1 bg-slate-50 border-2 border-slate-100 rounded-2xl px-6 py-4 text-sm focus:border-indigo-500 focus:bg-white outline-none transition-all shadow-inner"
                />
                <button onClick={addObjection} className="p-4 bg-rose-600 text-white rounded-2xl hover:bg-rose-700 shadow-xl transition-all"><ICONS.X className="rotate-45" /></button>
              </div>
              <div className="flex-1 overflow-y-auto max-h-48 custom-scrollbar pr-2 space-y-2">
                {context.potentialObjections.map((obj, i) => (
                  <div key={i} className="flex items-center justify-between p-4 bg-rose-50/50 border border-rose-100 rounded-xl group animate-in slide-in-from-right-2 duration-300">
                    <p className="text-[11px] font-bold text-rose-800">“{obj}”</p>
                    <button onClick={() => handleChange('potentialObjections', context.potentialObjections.filter((_, idx) => idx !== i))} className="text-rose-300 hover:text-rose-600"><ICONS.Trash className="w-4 h-4" /></button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Section 5: Neural Vocal Sync (Moved from Step 3) */}
        <div className="space-y-8">
          <div className="flex items-center gap-4 pb-4 border-b-4 border-slate-900">
            <div className="w-12 h-12 bg-slate-900 text-white rounded-2xl flex items-center justify-center font-black text-xl shadow-xl">05</div>
            <div className="flex flex-col">
              <h3 className="text-4xl font-black uppercase tracking-tighter text-slate-900">Neural Vocal Sync</h3>
              <p className="text-[10px] font-black uppercase tracking-widest text-indigo-600 mt-1">Synchronize the neural vocal signature to match the intended professional resonance and strategic authority.</p>
            </div>
          </div>
          <div className="bg-white border border-slate-200 rounded-[3rem] flex flex-col shadow-2xl overflow-hidden">
            <div className="flex border-b border-slate-200 p-2 bg-slate-50">
              <button 
                onClick={() => handleChange('voiceMode', 'upload')}
                className={`flex-1 flex flex-col items-center py-6 rounded-3xl transition-all ${context.voiceMode === 'upload' ? 'bg-indigo-600 text-white shadow-xl scale-[1.02]' : 'text-slate-600 hover:bg-white hover:text-indigo-600'}`}
              >
                 <ICONS.Document className="w-6 h-6 mb-2" />
                 <span className="text-[10px] font-black uppercase tracking-widest">Neural Vocal Sync</span>
              </button>
              <button 
                onClick={() => handleChange('voiceMode', 'persona')}
                className={`flex-1 flex flex-col items-center py-6 rounded-3xl transition-all ${context.voiceMode === 'persona' ? 'bg-indigo-600 text-white shadow-xl scale-[1.02]' : 'text-slate-600 hover:bg-white hover:text-indigo-600'}`}
              >
                 <ICONS.Brain className="w-6 h-6 mb-2" />
                 <span className="text-[10px] font-black uppercase tracking-widest">Neural Presets</span>
              </button>
              <button 
                onClick={() => handleChange('voiceMode', 'personality')}
                className={`flex-1 flex flex-col items-center py-6 rounded-3xl transition-all ${context.voiceMode === 'personality' ? 'bg-indigo-600 text-white shadow-xl scale-[1.02]' : 'text-slate-600 hover:bg-white hover:text-indigo-600'}`}
              >
                 <ICONS.Trophy className="w-6 h-6 mb-2" />
                 <span className="text-[10px] font-black uppercase tracking-widest">Elite Icons</span>
              </button>
            </div>

            <div className="p-10 grid grid-cols-1 lg:grid-cols-2 gap-12">
              <div className="space-y-6">
                {context.voiceMode === 'persona' && (
                  <div className="grid grid-cols-2 gap-3 max-h-[400px] overflow-y-auto no-scrollbar pr-2">
                    {AI_VOICE_PERSONAS.map(p => (
                      <button 
                        key={p.id}
                        onClick={() => selectAIPersona(p)}
                        className={`p-4 rounded-2xl border-2 text-left transition-all ${context.selectedPersonaId === p.id ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg' : 'bg-slate-50 border-slate-100 text-slate-600 hover:border-indigo-300'}`}
                      >
                        <h5 className="text-[10px] font-black uppercase tracking-widest mb-1">{p.label}</h5>
                        <p className="text-[8px] font-bold opacity-70">{p.desc}</p>
                      </button>
                    ))}
                  </div>
                )}
                {context.voiceMode === 'personality' && (
                  <div className="grid grid-cols-2 gap-3 max-h-[400px] overflow-y-auto no-scrollbar pr-2">
                    {PUBLIC_PERSONALITIES.map(p => (
                      <button 
                        key={p.id}
                        onClick={() => selectPersonality(p)}
                        className={`p-4 rounded-2xl border-2 text-left transition-all ${context.selectedPersonalityId === p.id ? 'bg-emerald-600 border-emerald-500 text-white shadow-lg' : 'bg-slate-50 border-slate-100 text-slate-600 hover:border-emerald-300'}`}
                      >
                        <h5 className="text-[10px] font-black uppercase tracking-widest mb-1">{p.label}</h5>
                        <p className="text-[8px] font-bold opacity-70">{p.desc}</p>
                      </button>
                    ))}
                  </div>
                )}
                {context.voiceMode === 'upload' && (
                  <div className="p-8 bg-indigo-50 rounded-3xl border border-indigo-100 text-center space-y-4">
                    <ICONS.Document className="w-12 h-12 mx-auto text-indigo-600" />
                    <p className="text-sm font-bold text-indigo-900">Neural Vocal Sync Active</p>
                    <p className="text-xs text-indigo-600">Parameters suggested from Cognitive Mind Core.</p>
                  </div>
                )}
              </div>

              <div className="space-y-8 bg-slate-50 p-8 rounded-[2.5rem] border border-slate-200 shadow-inner">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-black uppercase tracking-widest text-slate-900">Vocal Parameters</h4>
                  <button 
                    onClick={handleTestVoice}
                    disabled={isAnalyzingVoice}
                    className={`px-6 py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${isPlayingVoice ? 'bg-rose-500 text-white' : 'bg-indigo-600 text-white hover:bg-indigo-500'} disabled:opacity-50`}
                  >
                    {isAnalyzingVoice ? (
                      <>
                        <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        <span>Analyzing...</span>
                      </>
                    ) : isPlayingVoice ? 'Stop' : 'Test Sample'}
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Gender</label>
                    <select 
                      value={context.vocalPersonaAnalysis?.gender || 'Male'}
                      onChange={(e) => updateVocalAnalysis({ gender: e.target.value })}
                      className="w-full bg-white border-2 border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 outline-none focus:border-indigo-500"
                    >
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Base Voice</label>
                    <select 
                      value={context.vocalPersonaAnalysis?.baseVoice || 'Puck'}
                      onChange={(e) => updateVocalAnalysis({ baseVoice: e.target.value })}
                      className="w-full bg-white border-2 border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 outline-none focus:border-indigo-500"
                    >
                      <option value="Puck">Puck (High Energy)</option>
                      <option value="Charon">Charon (Deep Authority)</option>
                      <option value="Zephyr">Zephyr (Calm Strategist)</option>
                      <option value="Kore">Kore (Professional)</option>
                      <option value="Fenrir">Fenrir (Authoritative)</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Pitch</label>
                    <input 
                      type="range" min="0.5" max="2.0" step="0.1"
                      value={context.vocalPersonaAnalysis?.pitchValue || 1.0}
                      onChange={(e) => updateVocalAnalysis({ pitchValue: parseFloat(e.target.value) })}
                      className="w-full accent-indigo-600"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Pace</label>
                    <input 
                      type="range" min="0.5" max="2.0" step="0.1"
                      value={context.vocalPersonaAnalysis?.pace || 1.0}
                      onChange={(e) => updateVocalAnalysis({ pace: parseFloat(e.target.value) })}
                      className="w-full accent-indigo-600"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Stability (%)</label>
                    <input 
                      type="number"
                      value={context.vocalPersonaAnalysis?.stability || 80}
                      onChange={(e) => updateVocalAnalysis({ stability: parseInt(e.target.value) })}
                      className="w-full bg-white border-2 border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Clarity (%)</label>
                    <input 
                      type="number"
                      value={context.vocalPersonaAnalysis?.clarity || 90}
                      onChange={(e) => updateVocalAnalysis({ clarity: parseInt(e.target.value) })}
                      className="w-full bg-white border-2 border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Tone Adjectives</label>
                  <input 
                    type="text"
                    value={context.vocalPersonaAnalysis?.toneAdjectives?.join(', ') || ''}
                    onChange={(e) => updateVocalAnalysis({ toneAdjectives: e.target.value.split(',').map(s => s.trim()) })}
                    className="w-full bg-white border-2 border-slate-200 rounded-xl px-6 py-4 text-sm font-bold text-slate-700 outline-none focus:border-indigo-500"
                    placeholder="e.g. Measured, humble, steady"
                  />
                </div>
                <button 
                  onClick={async () => {
                    setIsSavingVoice(true);
                    await new Promise(r => setTimeout(r, 1200));
                    await speak("Vocal parameters saved successfully.");
                    setIsSavingVoice(false);
                  }}
                  disabled={isSavingVoice}
                  className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-black uppercase tracking-widest shadow-xl hover:bg-emerald-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isSavingVoice ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>Saving...</span>
                    </>
                  ) : 'Save Changes'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-12">
      <AnimatePresence>
        {showKycGuide && (
          <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white rounded-[3rem] shadow-2xl max-w-2xl w-full overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-indigo-50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-indigo-600 text-white rounded-xl flex items-center justify-center">
                    <ICONS.Brain className="w-6 h-6" />
                  </div>
                  <h3 className="text-2xl font-black text-slate-900 tracking-tight uppercase">KYC Synthesis Protocol</h3>
                </div>
                <button onClick={() => setShowKycGuide(false)} className="p-2 hover:bg-white rounded-full transition-colors">
                  <ICONS.X className="w-6 h-6 text-slate-400" />
                </button>
              </div>
              
              <div className="p-10 overflow-y-auto custom-scrollbar space-y-8">
                <div className="space-y-6">
                  <div className="flex gap-4">
                    <div className="w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center shrink-0 font-bold text-xs">01</div>
                    <div className="space-y-1">
                      <p className="font-black text-slate-900 uppercase tracking-widest text-xs">Calibrate Seller Identity</p>
                      <p className="text-sm text-slate-500 leading-relaxed">Input your LinkedIn and Company URLs to auto-populate the seller profile with high-fidelity professional data.</p>
                    </div>
                  </div>
                  
                  <div className="flex gap-4">
                    <div className="w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center shrink-0 font-bold text-xs">02</div>
                    <div className="space-y-1">
                      <p className="font-black text-slate-900 uppercase tracking-widest text-xs">Map Client/Buyer Identity</p>
                      <p className="text-sm text-slate-500 leading-relaxed">Provide the target client's LinkedIn and Company URLs to ingest critical buyer-side intelligence.</p>
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <div className="w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center shrink-0 font-bold text-xs">03</div>
                    <div className="space-y-1">
                      <p className="font-black text-slate-900 uppercase tracking-widest text-xs">Initiate Intelligence Fetch</p>
                      <p className="text-sm text-slate-500 leading-relaxed">Click 'Fetch Information' and observe the Engine Controls as the cognitive core processes the data streams.</p>
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <div className="w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center shrink-0 font-bold text-xs">04</div>
                    <div className="space-y-1">
                      <p className="font-black text-slate-900 uppercase tracking-widest text-xs">Validate Neural Synthesis</p>
                      <p className="text-sm text-slate-500 leading-relaxed">Review the auto-filled parameters for accuracy and trigger 'Start Deep Analysis' to begin document generation.</p>
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <div className="w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center shrink-0 font-bold text-xs">05</div>
                    <div className="space-y-1">
                      <p className="font-black text-slate-900 uppercase tracking-widest text-xs">Intelligence Generation</p>
                      <p className="text-sm text-slate-500 leading-relaxed">Allow the cognitive engine to synthesize your high-fidelity KYC document (this may take a few moments).</p>
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <div className="w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center shrink-0 font-bold text-xs">06</div>
                    <div className="space-y-1">
                      <p className="font-black text-slate-900 uppercase tracking-widest text-xs">Export Intelligence</p>
                      <p className="text-sm text-slate-500 leading-relaxed">Download your newly synthesized intelligence brief in PDF or Word format.</p>
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <div className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center shrink-0 font-bold text-xs">07</div>
                    <div className="space-y-1">
                      <p className="font-black text-indigo-600 uppercase tracking-widest text-xs">Ground the Simulation</p>
                      <p className="text-sm text-slate-500 leading-relaxed font-medium italic">Return to this hub, upload the document to the 'Documentary Memory Store' (Step 1), then select it from the KYC dropdown in Step 2 to anchor your simulation.</p>
                    </div>
                  </div>
                </div>

                <div className="pt-6">
                  <a 
                    href="https://method-2.vercel.app/" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="w-full flex items-center justify-center gap-3 py-6 bg-indigo-600 text-white rounded-2xl font-black uppercase tracking-widest shadow-xl hover:bg-indigo-700 transition-all"
                    onClick={() => setShowKycGuide(false)}
                  >
                    Access KYC Generator <ICONS.ExternalLink className="w-5 h-5" />
                  </a>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <div className="min-h-[600px]">
        {renderAllSections()}
      </div>

      <div className="flex justify-center pb-12">
        <button
          onClick={() => onSynthesize(context)}
          disabled={isAnalyzing}
          className="flex items-center gap-4 px-20 py-8 bg-indigo-600 text-white rounded-full font-black text-2xl shadow-2xl hover:bg-indigo-700 hover:scale-105 transition-all active:scale-95"
        >
          <ICONS.Brain className="w-8 h-8" />
          {isAnalyzing ? 'Synthesizing...' : 'Synthesize Strategy Core'}
        </button>
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
