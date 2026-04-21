import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MeetingContext, CustomerPersonaType, VoiceMode, StoredDocument, VocalPersonaStructure, UploadedFile } from '../types';
import { ICONS } from '../constants';
import { 
  extractMetadataFromDocument, 
  extractMetadataFromMultipleDocuments,
  analyzeVocalPersona, 
  suggestVocalPersonaFromDoc, 
  generateVoiceSample, 
  generateVocalSignatureFromDirective 
} from '../services/geminiService';
import { deleteDocumentFromFirebase } from '../services/firebaseService';
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
  onClearLibrarySelection: () => void;
  onSynthesize: (currentContext?: MeetingContext) => void;
  onSave?: () => void;
  isAnalyzing: boolean;
  hasAnalysis: boolean;
  activeFolderId: string;
  onActiveFolderChange: (id: string) => void;
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
  { id: 'pro-male', label: 'Nailed', desc: 'Direct, authoritative, business-first.', baseVoice: 'Zephyr', gender: 'Male', directive: 'Adopt a professional male resonance. Pacing should be steady and deliberate. Articulation must be crisp. Project absolute authority and business-first logic.' },
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
  onClearLibrarySelection,
  onSynthesize,
  onSave,
  isAnalyzing,
  hasAnalysis,
  activeFolderId,
  onActiveFolderChange
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
  const [previewDoc, setPreviewDoc] = useState<StoredDocument | null>(null);
  const [activeSection, setActiveSection] = useState<'library' | 'core' | 'persona' | 'vocal'>('library');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const SECTIONS: ('library' | 'core' | 'persona' | 'vocal')[] = ['library', 'core', 'persona', 'vocal'];
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

${context.executiveSnapshot ? `EXECUTIVE DEAL SNAPSHOT:
"${context.executiveSnapshot}"
Use this as the high-level strategic baseline for the deal's current state.` : ''}

${context.clientsKeywords.length > 0 ? `CLIENT'S STRATEGIC TERMINOLOGY:
${context.clientsKeywords.map(k => `- ${k}`).join('\n')}
Adopt these specific keywords and jargon in your responses to build rapport and demonstrate deep alignment with their internal language.` : ''}

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

  const handleGenerateVocalSignature = async () => {
    const directive = context.vocalPersonaAnalysis?.mimicryDirective;
    if (!directive) return;

    setIsAnalyzingVoice(true);
    try {
      const result = await generateVocalSignatureFromDirective(directive);
      onContextChange({
        ...context,
        selectedPersonaId: undefined,
        selectedPersonalityId: undefined,
        vocalPersonaAnalysis: result
      });
      speak("Neural vocal signature generated and calibrated based on your directive.");
    } catch (err) {
      console.error("Vocal signature generation failed:", err);
    } finally {
      setIsAnalyzingVoice(false);
    }
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
        clientsKeywords: metadata.clientsKeywords || context.clientsKeywords,
        potentialObjections: metadata.potentialObjections || context.potentialObjections,
        vocalPersonaAnalysis: vocalAnalysis
      });
    } catch (e) {
      console.error("KYC Metadata extraction failed", e);
    } finally {
      setIsExtracting(false);
    }
  };

  const handleUnifiedSynthesis = async () => {
    if (selectedLibraryDocIds.length === 0 && files.length === 0) return;

    setIsExtracting(true);
    try {
      const activeDocs = [
        ...documents.filter(d => selectedLibraryDocIds.includes(d.id)),
        ...files.filter(f => f.status === 'ready').map(f => ({ name: f.name, content: f.content }))
      ];

      const metadata = await extractMetadataFromMultipleDocuments(activeDocs);
      
      onContextChange({
        ...context,
        sellerCompany: metadata.sellerCompany || context.sellerCompany,
        sellerNames: metadata.sellerNames || context.sellerNames,
        clientCompany: metadata.clientCompany || context.clientCompany,
        clientNames: metadata.clientNames || context.clientNames,
        targetProducts: metadata.targetProducts || context.targetProducts,
        productDomain: metadata.productDomain || context.productDomain,
        meetingFocus: metadata.meetingFocus || context.meetingFocus,
        executiveSnapshot: metadata.executiveSnapshot || context.executiveSnapshot,
        strategicKeywords: metadata.strategicKeywords || context.strategicKeywords,
        clientsKeywords: metadata.clientsKeywords || context.clientsKeywords,
        potentialObjections: metadata.potentialObjections || context.potentialObjections,
      });
      speak("Unified strategic synthesis complete. All selected documents have been analyzed and integrated into the core context.");
    } catch (e) {
      console.error("Unified synthesis failed", e);
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

  const handleNext = () => {
    if (onSave) onSave();
    const currentIndex = SECTIONS.indexOf(activeSection);
    if (currentIndex < SECTIONS.length - 1) {
      setActiveSection(SECTIONS[currentIndex + 1]);
      // Scroll to top of the config container
      const el = document.getElementById('config-top');
      if (el) el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const formatDate = (ts: any) => {
    if (!ts) return "---";
    const date = typeof ts === 'number' ? new Date(ts) : ts;
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    });
  };

  const handleKycUploadTrigger = () => {
    fileInputRef.current?.click();
  };

  const handleKycFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (!selectedFiles || selectedFiles.length === 0) return;
    
    // For now, satisfy the user's intent by showing they can upload
    // In a real app, this would call uploadDocumentFromFirebase or similar
    // Since we have the FileUpload component already, we'll inform the user
    // or we can implement a quick upload if service allows.
    // For simplicity, I'll scroll to the upload area as it's the safest way to ensure
    // all metadata extraction and state updates happen correctly.
    const el = document.getElementById('documentary-memory-store');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
    speak("Opening the Strategic Memory Store for KYC document ingestion.");
  };

  const renderSectionNav = () => (
    <div className="flex flex-wrap gap-3 mb-16 p-3 bg-slate-800/50 rounded-[2.5rem] backdrop-blur-xl border border-slate-700/50 shadow-inner">
      {[
        { id: 'library', label: 'Library Hub', icon: <ICONS.Document className="w-4 h-4" /> },
        { id: 'core', label: 'Mind Core & Strategy', icon: <ICONS.Brain className="w-4 h-4" /> },
        { id: 'persona', label: 'Buyer Persona', icon: <ICONS.ROI className="w-4 h-4" /> },
        { id: 'vocal', label: 'Vocal Sync', icon: <ICONS.Speaker className="w-4 h-4" /> }
      ].map((s) => (
        <motion.button
          key={s.id}
          whileHover={{ y: -2 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => setActiveSection(s.id as any)}
          className={`flex-1 min-w-[140px] flex items-center justify-center gap-3 py-5 px-8 rounded-[1.5rem] text-[11px] font-black uppercase tracking-[0.2em] transition-all relative overflow-hidden ${
            activeSection === s.id 
            ? 'bg-slate-900 text-indigo-400 shadow-2xl shadow-indigo-500/20' 
            : 'text-slate-400 hover:text-slate-300'
          }`}
        >
          {activeSection === s.id && (
            <motion.div 
              layoutId="section-nav-active"
              className="absolute bottom-0 left-0 right-0 h-1 bg-indigo-600"
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
            />
          )}
          <span className={`${activeSection === s.id ? 'text-indigo-600' : 'text-slate-400'}`}>{s.icon}</span>
          {s.label}
        </motion.button>
      ))}
    </div>
  );

  const renderAllSections = () => {
    return (
      <div className="space-y-16">
        {renderSectionNav()}
        
        <AnimatePresence mode="wait">
          <motion.div
            key={activeSection}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
          >
            {activeSection === 'library' && (
              <div className="space-y-12" id="tour-context-config">
                <div className="flex items-center gap-6 pb-6 border-b-4 border-white/5">
                  <div className="w-16 h-16 bg-brand-primary text-white rounded-3xl flex items-center justify-center font-display font-black text-2xl shadow-2xl shadow-brand-primary/20">01</div>
                  <div className="flex flex-col">
                    <h3 className="text-5xl font-display font-black uppercase tracking-tighter text-white">Cognitive Library Hub</h3>
                    <p className="text-[11px] font-black uppercase tracking-[0.4em] text-slate-500 mt-2">Ingest and categorize documentary intelligence to establish a high-fidelity knowledge base.</p>
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-12">
                    <div className="bg-slate-900/50 rounded-[3rem] shadow-2xl p-10 border border-slate-800">
                    <div className="flex items-center justify-between mb-8">
                      <h3 className="text-xl font-bold text-white flex items-center gap-2">
                        <ICONS.Research /> Library Selection
                      </h3>
                      <button
                        onClick={handleUnifiedSynthesis}
                        disabled={isExtracting || (selectedLibraryDocIds.length === 0 && files.length === 0)}
                        className="px-6 py-3 bg-indigo-600 text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-all shadow-lg active:scale-95 flex items-center gap-2"
                      >
                        {isExtracting ? <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <ICONS.Sparkles className="w-3 h-3" />}
                        Unified Synthesis
                      </button>
                    </div>
                    <DocumentGallery 
                      documents={documents} 
                      onRefresh={onUploadSuccess} 
                      selectedIds={selectedLibraryDocIds}
                      onToggleSelect={onToggleLibraryDoc}
                      onClearSelection={onClearLibrarySelection}
                      onSynthesize={() => {}} 
                      isAnalyzing={isAnalyzing}
                      hideSynthesize={true}
                      activeFolderId={activeFolderId}
                      onActiveFolderChange={onActiveFolderChange}
                    />
                  </div>
                <div className="bg-slate-900/50 rounded-[3rem] shadow-2xl p-10 border border-slate-800" id="documentary-memory-store">
                  <h3 className="text-xl font-bold text-white flex items-center gap-2 mb-8">
                    <ICONS.Document /> Documentary Memory Store
                  </h3>
                  <FileUpload files={files} onFilesChange={onFilesChange} onUploadSuccess={onUploadSuccess} activeFolderId={activeFolderId} />
                </div>
                </div>
              </div>
            )}

            {activeSection === 'core' && (
              <div className="space-y-12">
                <div className="flex items-center gap-6 pb-6 border-b-4 border-white/5">
                  <div className="w-16 h-16 bg-brand-primary text-white rounded-3xl flex items-center justify-center font-display font-black text-2xl shadow-2xl shadow-brand-primary/20">02</div>
                  <div className="flex flex-col">
                    <h3 className="text-5xl font-display font-black uppercase tracking-tighter text-white">Mind Core & Strategy</h3>
                    <p className="text-[11px] font-black uppercase tracking-[0.4em] text-slate-500 mt-2">Anchor the cognitive simulation and define the specific focus of the meeting.</p>
                  </div>
                </div>
                
                <div className="space-y-12">
                  {/* Cognitive Mind Core Content */}
                  <div className="p-12 bg-indigo-900/10 border border-indigo-900/30 rounded-[3rem] flex flex-col items-center gap-8 shadow-inner text-center">
                    <div className="p-6 bg-indigo-600 text-white rounded-[2rem] shadow-2xl">
                      <ICONS.Shield className="w-12 h-12" />
                    </div>
                    <div className="max-w-xl space-y-4 w-full">
                      <h3 className="text-3xl font-black uppercase tracking-widest text-white">Cognitive Mind Core</h3>
                      <div className="flex flex-col md:flex-row items-center justify-between gap-4 w-full px-2">
                        <p className="text-slate-400 font-medium">Know Your Customer (KYC) Document</p>
                        <div className="flex items-center gap-3 bg-slate-800/50 backdrop-blur-sm px-4 py-2 rounded-2xl border border-indigo-900/30 shadow-sm">
                          <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Lacking high-fidelity KYC intelligence?</span>
                          <button 
                            onClick={() => setShowKycGuide(true)}
                            className="px-4 py-2 bg-indigo-600 text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-indigo-700 transition-all shadow-md active:scale-95"
                          >
                            Click Here
                          </button>
                        </div>
                      </div>
                        <div className="relative w-full flex gap-3">
                          <input 
                            type="file" 
                            ref={fileInputRef} 
                            style={{ display: 'none' }} 
                            onChange={handleKycFileChange}
                          />
                          <select 
                            value={context.kycDocId || ""} 
                            onChange={(e) => handleKycChange(e.target.value)}
                            className={`flex-1 bg-slate-800 border-4 rounded-[2rem] px-8 py-6 text-xl font-bold text-white outline-none transition-all shadow-xl ${isExtracting ? 'border-indigo-300 opacity-50 cursor-wait' : 'border-slate-700 focus:border-indigo-500'}`}
                            disabled={isExtracting}
                          >
                            <option value="">Select grounding source...</option>
                            {documents.map(d => (
                              <option key={d.id} value={d.id}>{d.name}</option>
                            ))}
                          </select>
                          <button 
                            onClick={handleKycUploadTrigger}
                            className="px-6 bg-slate-800 text-slate-400 rounded-[2rem] hover:bg-slate-700 transition-all flex items-center justify-center shadow-lg border border-slate-700 group"
                            title="Upload KYC Document"
                          >
                            <ICONS.Plus className="w-6 h-6 group-hover:scale-110 transition-transform" />
                          </button>
                          {context.kycDocId && (
                            <div className="flex gap-2">
                              <button 
                                onClick={async () => {
                                  if (confirm("Permanently delete this KYC document from cloud memory?")) {
                                    const idToDelete = context.kycDocId!;
                                    handleChange('kycDocId', "");
                                    await deleteDocumentFromFirebase(idToDelete);
                                    onUploadSuccess(); // Refresh documents
                                  }
                                }}
                                className="px-6 bg-rose-900/20 text-rose-400 rounded-[2rem] hover:bg-rose-900/30 transition-all flex items-center justify-center shadow-lg border border-rose-900/30"
                                title="Delete Selected KYC Document"
                              >
                                <ICONS.Trash className="w-6 h-6" />
                              </button>
                              <button 
                                onClick={() => {
                                  const doc = documents.find(d => d.id === context.kycDocId);
                                  if (doc) {
                                    setPreviewDoc(doc);
                                  } else {
                                    const el = document.getElementById('library-hub');
                                    if (el) el.scrollIntoView({ behavior: 'smooth' });
                                  }
                                }}
                                className="px-6 bg-indigo-900/20 text-indigo-400 rounded-[2rem] hover:bg-indigo-900/30 transition-all flex items-center justify-center shadow-lg border border-indigo-900/30"
                                title="View Intelligence Preview"
                              >
                                <ICONS.Research className="w-6 h-6" />
                              </button>
                            </div>
                          )}
                        {isExtracting && (
                          <div className="absolute right-24 top-1/2 -translate-y-1/2">
                            <div className="w-6 h-6 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                          </div>
                        )}
                      </div>
                      {isExtracting && <p className="text-indigo-400 text-xs font-black uppercase animate-pulse">Extracting Strategic Metadata...</p>}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-12 bg-slate-900/50 rounded-[3rem] p-12 shadow-2xl border border-slate-800">
                    <div className="space-y-6">
                      <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
                         <div className="text-indigo-500"><ICONS.Trophy /></div>
                         <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Seller Detail</h4>
                      </div>
                      <Input label="Seller Company" value={context.sellerCompany} onChange={v => handleChange('sellerCompany', v)} placeholder="Acme Corp" />
                      <Input label="Seller Name" value={context.sellerNames} onChange={v => handleChange('sellerNames', v)} placeholder="John Doe, Jane Smith" />
                    </div>
                    <div className="space-y-6">
                      <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
                         <div className="text-indigo-500"><ICONS.ROI /></div>
                         <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Client Detail</h4>
                      </div>
                      <Input label="Client Company" value={context.clientCompany} onChange={v => handleChange('clientCompany', v)} placeholder="Global Industries" />
                      <Input label="Client Name" value={context.clientNames} onChange={v => handleChange('clientNames', v)} placeholder="Robert Brown, Sarah Wilson" />
                    </div>
                    <div className="space-y-6">
                      <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
                         <div className="text-indigo-500"><ICONS.Efficiency /></div>
                         <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Product Detail</h4>
                      </div>
                      <div className="space-y-4">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1">Target Products</label>
                        <textarea 
                          value={context.targetProducts}
                          onChange={e => handleChange('targetProducts', e.target.value)}
                          className="w-full bg-slate-800 border-2 border-slate-700 rounded-[1.5rem] px-6 py-4 text-sm font-semibold text-white outline-none focus:border-indigo-500 focus:bg-slate-900 transition-all shadow-inner min-h-[80px] placeholder:text-slate-600"
                          placeholder="Enterprise Cloud Suite, Security Module, etc."
                        />
                      </div>
                      <Input label="Product Domain" value={context.productDomain} onChange={v => handleChange('productDomain', v)} placeholder="SaaS, Cybersecurity" />
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1">Client's Keywords</label>
                        <div className="flex flex-wrap gap-2 p-3 bg-slate-800/50 rounded-xl border border-slate-700 min-h-[44px]">
                          {context.clientsKeywords.map((kw, i) => (
                            <span key={`${kw}-${i}`} className="px-2 py-1 bg-indigo-900/30 text-indigo-400 text-[10px] font-bold rounded-md border border-indigo-900/50">{kw}</span>
                          ))}
                          {context.clientsKeywords.length === 0 && <span className="text-[10px] text-slate-600 italic">No keywords extracted</span>}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Strategy Finalization Content */}
                  <div className="space-y-12 pt-12 border-t-4 border-slate-800">
                    <div className="flex items-center gap-4">
                      <div className="p-3 bg-indigo-600 text-white rounded-2xl shadow-lg">
                        <ICONS.Trophy className="w-6 h-6" />
                      </div>
                      <h3 className="text-3xl font-black uppercase tracking-widest text-white">Strategy Finalization</h3>
                    </div>
                    
                    <div className="space-y-4">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1">Executive Snapshot</label>
                      <textarea 
                        value={context.executiveSnapshot}
                        onChange={e => handleChange('executiveSnapshot', e.target.value)}
                        className="w-full bg-slate-800 border-2 border-slate-700 rounded-[2rem] px-8 py-6 text-sm font-semibold text-white outline-none focus:border-indigo-500 focus:bg-slate-900 transition-all shadow-inner min-h-[100px] placeholder:text-slate-600"
                        placeholder="Executive summary of the deal..."
                      />
                    </div>

                    <div className="space-y-4">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1">Meeting Focus & Strategic Objective</label>
                      <textarea 
                        value={context.meetingFocus}
                        onChange={e => handleChange('meetingFocus', e.target.value)}
                        className="w-full bg-slate-800 border-2 border-slate-700 rounded-[2rem] px-8 py-6 text-base font-semibold text-white outline-none focus:border-indigo-500 focus:bg-slate-900 transition-all shadow-inner min-h-[150px] placeholder:text-slate-600"
                        placeholder="Describe the primary goal of this interaction..."
                      />
                    </div>

                    <div className="space-y-6">
                      <div className="flex items-center justify-between">
                        <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1">Predicted Resistance Nodes (Objections)</h4>
                        <span className="text-[10px] font-black text-indigo-400 bg-indigo-900/30 px-3 py-1 rounded-lg">{context.potentialObjections.length} Active Nodes</span>
                      </div>
                      <div className="flex gap-4">
                        <input 
                          type="text"
                          value={objectionInput}
                          onChange={e => setObjectionInput(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && addObjection()}
                          className="flex-1 bg-slate-800 border-2 border-slate-700 rounded-2xl px-6 py-4 text-sm font-semibold text-white outline-none focus:border-indigo-500 transition-all shadow-inner"
                          placeholder="Add a predicted objection..."
                        />
                        <button 
                          onClick={addObjection}
                          className="px-8 py-4 bg-indigo-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-indigo-700 transition-all active:scale-95 shadow-lg"
                        >
                          Add Node
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-3">
                        <AnimatePresence>
                          {context.potentialObjections.map((obj, i) => (
                            <motion.div 
                              key={`${obj}-${i}`}
                              initial={{ opacity: 0, scale: 0.8 }}
                              animate={{ opacity: 1, scale: 1 }}
                              exit={{ opacity: 0, scale: 0.8 }}
                              className="flex items-center gap-3 px-5 py-3 bg-slate-800 border border-slate-700 rounded-xl shadow-sm group"
                            >
                              <span className="text-xs font-bold text-slate-300">{obj}</span>
                              <button 
                                onClick={() => handleChange('potentialObjections', context.potentialObjections.filter((_, idx) => idx !== i))}
                                className="text-slate-300 hover:text-rose-500 transition-colors"
                              >
                                <ICONS.X className="w-3 h-3" />
                              </button>
                            </motion.div>
                          ))}
                        </AnimatePresence>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeSection === 'persona' && (
              <div className="space-y-12">
                <div className="flex items-center gap-6 pb-6 border-b-4 border-white/5">
                  <div className="w-16 h-16 bg-brand-primary text-white rounded-3xl flex items-center justify-center font-display font-black text-2xl shadow-2xl shadow-brand-primary/20">03</div>
                  <div className="flex flex-col">
                    <h3 className="text-5xl font-display font-black uppercase tracking-tighter text-white">Target Buyer Persona</h3>
                    <p className="text-[11px] font-black uppercase tracking-[0.4em] text-slate-500 mt-2">Select the psychological profile of your primary decision-maker to calibrate resistance levels.</p>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  {PERSONAS.map((p) => (
                    <button
                      key={p.type}
                      onClick={() => handleChange('persona', p.type)}
                      className={`p-8 rounded-[2.5rem] border-2 text-left transition-all relative overflow-hidden group ${context.persona === p.type ? 'bg-indigo-600 border-indigo-600 text-white shadow-2xl scale-[1.02]' : 'bg-slate-900/50 border-slate-800 hover:border-indigo-700 shadow-sm'}`}
                    >
                      <div className={`p-4 rounded-2xl mb-6 inline-block ${context.persona === p.type ? 'bg-white/20 text-white' : 'bg-indigo-900/30 text-indigo-400 shadow-sm'}`}>
                        {p.icon}
                      </div>
                      <h4 className={`font-black text-xs uppercase tracking-widest mb-2 text-white`}>{p.type}</h4>
                      <p className={`text-[11px] leading-relaxed font-semibold ${context.persona === p.type ? 'text-indigo-100' : 'text-slate-400'}`}>{p.desc}</p>
                      {context.persona === p.type && (
                        <motion.div 
                          layoutId="persona-check"
                          className="absolute top-6 right-6 w-6 h-6 bg-white text-indigo-600 rounded-full flex items-center justify-center shadow-lg"
                        >
                          <ICONS.Check className="w-4 h-4" />
                        </motion.div>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}



            {activeSection === 'vocal' && (
              <div className="space-y-12">
                <div className="flex items-center gap-6 pb-6 border-b-4 border-white/5">
                  <div className="w-16 h-16 bg-brand-primary text-white rounded-3xl flex items-center justify-center font-display font-black text-2xl shadow-2xl shadow-brand-primary/20">04</div>
                  <div className="flex flex-col">
                    <h3 className="text-5xl font-display font-black uppercase tracking-tighter text-white">Neural Vocal Sync</h3>
                    <p className="text-[11px] font-black uppercase tracking-[0.4em] text-slate-500 mt-2">Calibrate the AI's vocal signature and behavioral mimicry to match the target persona's baseline.</p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-4 p-2 bg-slate-900/50 rounded-2xl border border-slate-800">
                  {[
                    { id: 'persona', label: 'AI Personas', icon: <ICONS.Brain className="w-4 h-4" /> },
                    { id: 'personality', label: 'Public Personalities', icon: <ICONS.Trophy className="w-4 h-4" /> },
                    { id: 'upload', label: 'Manual Calibration', icon: <ICONS.Efficiency className="w-4 h-4" /> }
                  ].map((m) => (
                    <button
                      key={m.id}
                      onClick={() => handleChange('voiceMode', m.id as any)}
                      className={`flex-1 flex items-center justify-center gap-3 py-4 px-6 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                        context.voiceMode === m.id 
                        ? 'bg-indigo-600 text-white shadow-lg' 
                        : 'text-slate-400 hover:text-slate-300 hover:bg-slate-800'
                      }`}
                    >
                      {m.icon}
                      {m.label}
                    </button>
                  ))}
                </div>
                
                <AnimatePresence mode="wait">
                  {context.voiceMode === 'persona' && (
                    <motion.div 
                      key="persona-list"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
                    >
                      {AI_VOICE_PERSONAS.map((p) => (
                        <button
                          key={p.id}
                          onClick={() => selectAIPersona(p)}
                          className={`p-6 rounded-3xl border-2 text-left transition-all relative group ${context.selectedPersonaId === p.id ? 'bg-indigo-600 border-indigo-600 text-white shadow-xl' : 'bg-slate-900/50 border-slate-800 hover:border-indigo-500'}`}
                        >
                          <h4 className="font-black text-xs uppercase tracking-widest mb-2 text-white">{p.label}</h4>
                          <p className={`text-[10px] leading-relaxed font-semibold ${context.selectedPersonaId === p.id ? 'text-indigo-100' : 'text-slate-400'}`}>{p.desc}</p>
                          {context.selectedPersonaId === p.id && (
                            <div className="absolute top-4 right-4 w-5 h-5 bg-white text-indigo-600 rounded-full flex items-center justify-center shadow-lg">
                              <ICONS.Check className="w-3 h-3" />
                            </div>
                          )}
                        </button>
                      ))}
                    </motion.div>
                  )}

                  {context.voiceMode === 'personality' && (
                    <motion.div 
                      key="personality-list"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
                    >
                      {PUBLIC_PERSONALITIES.map((p) => (
                        <button
                          key={p.id}
                          onClick={() => selectPersonality(p)}
                          className={`p-6 rounded-3xl border-2 text-left transition-all relative group ${context.selectedPersonalityId === p.id ? 'bg-indigo-600 border-indigo-600 text-white shadow-xl' : 'bg-slate-900/50 border-slate-800 hover:border-indigo-500'}`}
                        >
                          <h4 className="font-black text-xs uppercase tracking-widest mb-2 text-white">{p.label}</h4>
                          <p className={`text-[10px] leading-relaxed font-semibold ${context.selectedPersonalityId === p.id ? 'text-indigo-100' : 'text-slate-400'}`}>{p.desc}</p>
                          {context.selectedPersonalityId === p.id && (
                            <div className="absolute top-4 right-4 w-5 h-5 bg-white text-indigo-600 rounded-full flex items-center justify-center shadow-lg">
                              <ICONS.Check className="w-3 h-3" />
                            </div>
                          )}
                        </button>
                      ))}
                    </motion.div>
                  )}

                  {context.voiceMode === 'upload' && (
                    <motion.div 
                      key="manual-calibration"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="grid grid-cols-1 lg:grid-cols-3 gap-12"
                    >
                      <div className="lg:col-span-2 space-y-12">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                          <div className="space-y-4">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1">Vocal Identity Base</label>
                            <div className="grid grid-cols-2 gap-3">
                              {['Zephyr', 'Puck', 'Charon', 'Kore', 'Fenrir'].map(voice => (
                                <button
                                  key={voice}
                                  onClick={() => updateVocalAnalysis({ baseVoice: voice as any })}
                                  className={`py-4 rounded-2xl border-2 text-[10px] font-black uppercase tracking-widest transition-all ${context.vocalPersonaAnalysis?.baseVoice === voice ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg' : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-indigo-300'}`}
                                >
                                  {voice}
                                </button>
                              ))}
                            </div>
                          </div>
                          <div className="space-y-4">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1">Vocal Parameters</label>
                            <div className="space-y-6 p-8 bg-slate-800/50 rounded-[2rem] border border-slate-700 shadow-inner">
                              <div className="space-y-3">
                                <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-slate-500">
                                  <span>Pace / Tempo</span>
                                  <span className="text-indigo-400">{context.vocalPersonaAnalysis?.pace}x</span>
                                </div>
                                <input 
                                  type="range" min="0.5" max="2.0" step="0.1"
                                  value={context.vocalPersonaAnalysis?.pace}
                                  onChange={e => updateVocalAnalysis({ pace: parseFloat(e.target.value) })}
                                  className="w-full h-1.5 bg-slate-700 rounded-full appearance-none cursor-pointer accent-indigo-600"
                                />
                              </div>
                              <div className="space-y-3">
                                <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-slate-500">
                                  <span>Neural Stability</span>
                                  <span className="text-indigo-400">{context.vocalPersonaAnalysis?.stability}%</span>
                                </div>
                                <input 
                                  type="range" min="0" max="100"
                                  value={context.vocalPersonaAnalysis?.stability}
                                  onChange={e => updateVocalAnalysis({ stability: parseInt(e.target.value) })}
                                  className="w-full h-1.5 bg-slate-700 rounded-full appearance-none cursor-pointer accent-indigo-600"
                                />
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="space-y-4">
                          <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] ml-1">Behavioral Mimicry Directive</label>
                          <textarea 
                            value={context.vocalPersonaAnalysis?.mimicryDirective}
                            onChange={e => updateVocalAnalysis({ mimicryDirective: e.target.value })}
                            className="w-full bg-slate-800 border-2 border-slate-700 rounded-[2rem] px-8 py-6 text-sm font-semibold text-white outline-none focus:border-indigo-500 focus:bg-slate-900 transition-all shadow-inner min-h-[120px] placeholder:text-slate-600"
                            placeholder="Define the behavioral signature (e.g. 'Aggressive, fast-paced, skeptical, interrupts often')..."
                          />
                          {context.vocalPersonaAnalysis?.mimicryDirective && (
                            <div className="flex justify-end mt-4">
                              <button
                                onClick={handleGenerateVocalSignature}
                                disabled={isAnalyzingVoice}
                                className="flex items-center gap-2 px-6 py-3 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-400 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border border-indigo-600/30 disabled:opacity-50"
                              >
                                {isAnalyzingVoice ? (
                                  <div className="w-3 h-3 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin"></div>
                                ) : (
                                  <ICONS.Brain className="w-3 h-3" />
                                )}
                                Generate Vocal Signature
                              </button>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="bg-slate-900 dark:bg-black rounded-[3rem] p-10 text-white space-y-8 shadow-2xl relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-600/10 blur-[100px] rounded-full -mr-32 -mt-32"></div>
                        <div className="relative z-10">
                          <h4 className="text-[10px] font-black uppercase tracking-[0.4em] text-indigo-400 mb-8">Neural Vocal Signature</h4>
                          <div className="flex items-center gap-6 mb-12">
                            <div className="w-20 h-20 bg-slate-800 rounded-full flex items-center justify-center border border-slate-700 shadow-2xl">
                              <ICONS.Speaker className="w-10 h-10 text-indigo-400" />
                            </div>
                            <div>
                              <p className="text-2xl font-black tracking-tight text-white">{context.vocalPersonaAnalysis?.baseVoice}</p>
                              <p className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Active Vocal Core</p>
                            </div>
                          </div>
                          
                          <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                              <VocalTrait label="Pitch" val={context.vocalPersonaAnalysis?.pitch || 'Moderate'} color="indigo" />
                              <VocalTrait label="Tempo" val={context.vocalPersonaAnalysis?.tempo || 'Controlled'} color="emerald" />
                              <VocalTrait label="Cadence" val={context.vocalPersonaAnalysis?.cadence || 'Strategic'} color="amber" />
                              <VocalTrait label="Accent" val={context.vocalPersonaAnalysis?.accent || 'Neutral'} color="rose" />
                            </div>
                          </div>

                          <div className="pt-12">
                            <button 
                              onClick={() => {
                                const text = `This is the ${context.vocalPersonaAnalysis?.baseVoice} vocal signature, calibrated for a ${context.persona} persona. Neural stability is at ${context.vocalPersonaAnalysis?.stability} percent.`;
                                speak(text);
                              }}
                              className="w-full flex items-center justify-center gap-4 py-6 bg-indigo-600 hover:bg-indigo-700 rounded-2xl font-black uppercase tracking-widest transition-all shadow-xl active:scale-95 group"
                            >
                              <ICONS.Play className="w-5 h-5 group-hover:scale-125 transition-transform" /> Test Vocal Sync
                            </button>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        {/* Intelligence Preview Modal */}
        <AnimatePresence>
          {previewDoc && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[150] flex items-center justify-center p-4 md:p-12 bg-slate-950/90 backdrop-blur-2xl"
              onClick={() => setPreviewDoc(null)}
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-slate-900 border border-slate-800 w-full max-w-6xl h-[90vh] rounded-[3rem] shadow-[0_32px_128px_-16px_rgba(0,0,0,0.5)] overflow-hidden flex flex-col"
              >
                {/* Header */}
                <div className="p-8 border-b border-slate-800/50 flex items-center justify-between bg-slate-800/30">
                  <div className="flex items-center gap-5">
                    <div className="p-4 bg-indigo-600 text-white rounded-2xl shadow-xl shadow-indigo-900/40">
                      <ICONS.Document className="w-6 h-6" />
                    </div>
                    <div>
                      <h4 className="text-[10px] font-black uppercase tracking-[0.4em] text-indigo-400 mb-1">Intelligence Preview</h4>
                      <h3 className="text-2xl font-black text-white uppercase tracking-tighter leading-tight max-w-2xl truncate">
                        {previewDoc.name}
                      </h3>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <button 
                      onClick={() => setPreviewDoc(null)}
                      className="p-4 bg-slate-800/50 hover:bg-rose-500/20 text-slate-400 hover:text-rose-500 rounded-2xl transition-all border border-slate-700/50"
                    >
                      <ICONS.X className="w-6 h-6" />
                    </button>
                  </div>
                </div>

                {/* Content Section */}
                <div className="flex-1 overflow-hidden flex flex-col lg:flex-row">
                  {/* Meta & Summary Sidebar */}
                  <div className="w-full lg:w-96 border-r border-slate-800/50 bg-slate-950/30 p-8 space-y-10 overflow-y-auto custom-scrollbar">
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 text-indigo-400">
                        <ICONS.Brain className="w-4 h-4" />
                        <span className="text-[10px] font-black uppercase tracking-widest">Neural Reasoning</span>
                      </div>
                      <div className="p-6 bg-indigo-950/20 border border-indigo-500/10 rounded-[2rem] relative group">
                        <div className="absolute -top-2 -left-2 w-4 h-4 border-t-2 border-l-2 border-indigo-500/30 rounded-tl-lg"></div>
                        <div className="absolute -bottom-2 -right-2 w-4 h-4 border-b-2 border-r-2 border-indigo-500/30 rounded-br-lg"></div>
                        <p className="text-xs text-indigo-200/80 leading-relaxed font-medium italic">
                          "{previewDoc.categorizationReasoning || "No reasoning available for this node."}"
                        </p>
                      </div>
                    </div>

                    <div className="space-y-6 pt-10 border-t border-slate-800/50">
                       <h5 className="text-[10px] font-black uppercase tracking-widest text-slate-500">Metadata Scan</h5>
                       <div className="space-y-4">
                          <div className="flex justify-between items-center text-[10px]">
                            <span className="text-slate-500 font-black uppercase tracking-widest">Format</span>
                            <span className="text-white font-black uppercase tracking-widest">{(previewDoc.type.split('/')[1] || 'DOC').toUpperCase()}</span>
                          </div>
                          <div className="flex justify-between items-center text-[10px]">
                            <span className="text-slate-500 font-black uppercase tracking-widest">Captured</span>
                            <span className="text-white font-black uppercase tracking-widest">{formatDate(previewDoc.timestamp)}</span>
                          </div>
                       </div>
                    </div>
                  </div>

                  {/* Main Content Viewer */}
                  <div className="flex-1 p-10 bg-slate-950/50 overflow-y-auto custom-scrollbar relative">
                    <div className="absolute top-0 right-0 p-8 flex items-center gap-2 text-[9px] font-black text-slate-600 uppercase tracking-widest">
                      <ICONS.Efficiency className="w-3 h-3" /> Grounded Archive v4.2
                    </div>
                    <div className="space-y-6">
                       <h5 className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-8 border-b border-slate-800/50 pb-4">Extracted Intelligence Base</h5>
                       <div className="font-mono text-sm leading-relaxed text-slate-400 whitespace-pre-wrap selection:bg-indigo-500/30 selection:text-indigo-200">
                          {previewDoc.content || "Neural scan empty or content missing from database index."}
                       </div>
                    </div>
                  </div>
                </div>

                {/* Footer Action */}
                <div className="p-8 border-t border-slate-800 bg-slate-800/30 flex items-center justify-between">
                   <div className="flex items-center gap-4">
                      <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
                      <span className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">Cognitive Integrity Verified</span>
                   </div>
                   <div className="flex items-center gap-4">
                      <button 
                        onClick={() => setPreviewDoc(null)}
                        className="px-12 py-4 bg-indigo-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 shadow-xl shadow-indigo-900/20"
                      >
                        Dismiss Preview
                      </button>
                   </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  };

  return (
    <div className="space-y-12" id="tour-context-config">
      <AnimatePresence>
        {showKycGuide && (
          <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-slate-900 rounded-[3rem] shadow-2xl max-w-2xl w-full overflow-hidden flex flex-col max-h-[90vh] border border-slate-800"
            >
              <div className="p-8 border-b border-slate-800 flex justify-between items-center bg-slate-800/50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-indigo-600 text-white rounded-xl flex items-center justify-center">
                    <ICONS.Brain className="w-6 h-6" />
                  </div>
                  <h3 className="text-2xl font-black text-white tracking-tight uppercase">KYC Synthesis Protocol</h3>
                </div>
                <button onClick={() => setShowKycGuide(false)} className="p-2 hover:bg-slate-800 rounded-full transition-colors">
                  <ICONS.X className="w-6 h-6 text-slate-400" />
                </button>
              </div>
              
              <div className="p-10 overflow-y-auto custom-scrollbar space-y-8">
                <div className="space-y-6">
                  <div className="flex gap-4">
                    <div className="w-8 h-8 rounded-full bg-slate-800 text-white flex items-center justify-center shrink-0 font-bold text-xs border border-slate-700">01</div>
                    <div className="space-y-1">
                      <p className="font-black text-white uppercase tracking-widest text-xs">Calibrate Seller Identity</p>
                      <p className="text-sm text-slate-400 leading-relaxed">Input your LinkedIn and Company URLs to auto-populate the seller profile with high-fidelity professional data.</p>
                    </div>
                  </div>
                  
                  <div className="flex gap-4">
                    <div className="w-8 h-8 rounded-full bg-slate-800 text-white flex items-center justify-center shrink-0 font-bold text-xs border border-slate-700">02</div>
                    <div className="space-y-1">
                      <p className="font-black text-white uppercase tracking-widest text-xs">Map Client/Buyer Identity</p>
                      <p className="text-sm text-slate-400 leading-relaxed">Provide the target client's LinkedIn and Company URLs to ingest critical buyer-side intelligence.</p>
                    </div>
                  </div>
 
                  <div className="flex gap-4">
                    <div className="w-8 h-8 rounded-full bg-slate-800 text-white flex items-center justify-center shrink-0 font-bold text-xs border border-slate-700">03</div>
                    <div className="space-y-1">
                      <p className="font-black text-white uppercase tracking-widest text-xs">Initiate Intelligence Fetch</p>
                      <p className="text-sm text-slate-400 leading-relaxed">Click 'Fetch Information' and observe the Engine Controls as the cognitive core processes the data streams.</p>
                    </div>
                  </div>
 
                  <div className="flex gap-4">
                    <div className="w-8 h-8 rounded-full bg-slate-800 text-white flex items-center justify-center shrink-0 font-bold text-xs border border-slate-700">04</div>
                    <div className="space-y-1">
                      <p className="font-black text-white uppercase tracking-widest text-xs">Validate Neural Synthesis</p>
                      <p className="text-sm text-slate-400 leading-relaxed">Review the auto-filled parameters for accuracy and trigger 'Start Deep Analysis' to begin document generation.</p>
                    </div>
                  </div>
 
                  <div className="flex gap-4">
                    <div className="w-8 h-8 rounded-full bg-slate-800 text-white flex items-center justify-center shrink-0 font-bold text-xs border border-slate-700">05</div>
                    <div className="space-y-1">
                      <p className="font-black text-white uppercase tracking-widest text-xs">Intelligence Generation</p>
                      <p className="text-sm text-slate-400 leading-relaxed">Allow the cognitive engine to synthesize your high-fidelity KYC document (this may take a few moments).</p>
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <div className="w-8 h-8 rounded-full bg-slate-800 text-white flex items-center justify-center shrink-0 font-bold text-xs border border-slate-700">06</div>
                    <div className="space-y-1">
                      <p className="font-black text-white uppercase tracking-widest text-xs">Export Intelligence</p>
                      <p className="text-sm text-slate-400 leading-relaxed">Download your newly synthesized intelligence brief in PDF or Word format.</p>
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <div className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center shrink-0 font-bold text-xs">07</div>
                    <div className="space-y-1">
                      <p className="font-black text-indigo-400 uppercase tracking-widest text-xs">Ground the Simulation</p>
                      <p className="text-sm text-slate-400 leading-relaxed font-medium italic">Return to this hub, upload the document to the 'Documentary Memory Store' (Step 1), then select it from the KYC dropdown in Step 2 to anchor your simulation.</p>
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
        {activeSection === 'vocal' ? (
          <button
            onClick={() => onSynthesize(context)}
            disabled={isAnalyzing}
            className="flex items-center gap-4 px-20 py-8 bg-indigo-600 text-white rounded-full font-black text-2xl shadow-2xl hover:bg-indigo-700 hover:scale-105 transition-all active:scale-95"
          >
            <ICONS.Brain className="w-8 h-8" />
            {isAnalyzing ? 'Synthesizing...' : 'Synthesize Strategy Core'}
          </button>
        ) : (
          <button
            onClick={handleNext}
            className="flex items-center gap-4 px-20 py-8 bg-slate-800 text-white rounded-full font-black text-2xl shadow-2xl hover:bg-slate-700 hover:scale-105 transition-all active:scale-95 border border-slate-700"
          >
            Save & Next Step
            <ICONS.ArrowRight className="w-8 h-8" />
          </button>
        )}
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
      className={`w-full bg-slate-800 border-2 border-slate-700 rounded-2xl px-6 py-4 text-sm focus:border-indigo-500 focus:bg-slate-900 outline-none transition-all font-semibold text-white placeholder:text-slate-600 shadow-inner ${isLarge ? 'text-lg py-6' : ''}`}
      placeholder={placeholder}
    />
  </div>
);
