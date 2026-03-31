import { GoogleGenAI, Type, Modality, GenerateContentResponse } from "@google/genai";
import { AnalysisResult, MeetingContext, ThinkingLevel, DifficultyLevel, GPTMessage, AssessmentQuestion, AssessmentResult, QuestionType, ComprehensiveAvatarReport, StagedSimStage, VocalPersonaStructure, SalesStrategy } from "../types";

// Upgraded thinking budget map for gemini-3-pro-preview capabilities
const THINKING_LEVEL_MAP: Record<ThinkingLevel, number> = {
  'Minimal': 0,
  'Low': 8000,
  'Medium': 16000,
  'High': 32768 // Max for gemini-3-pro-preview
};

export async function generateExplanation(question: string, stageOrAnalysis: string | AnalysisResult, context?: MeetingContext): Promise<string> {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || process.env.API_KEY });
  
  let prompt = "";
  if (typeof stageOrAnalysis === 'string' && context) {
    prompt = `Explain the strategic reasoning behind this sales question: "${question}". 
    The current stage is "${stageOrAnalysis}". 
    Context: ${JSON.stringify(context.vocalPersonaAnalysis)}.
    Provide a concise explanation that helps the seller understand why the client is asking this and how they should respond.`;
  } else {
    // AudioGenerator case
    const analysis = stageOrAnalysis as AnalysisResult;
    prompt = `Explain the deep sales strategy behind: "${question}" based on the buyer snapshot: ${JSON.stringify(analysis.snapshot)}.`;
  }

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
  });
  return response.text || "No explanation available.";
}

export async function generateNodeExplanation(stage: string, context: MeetingContext): Promise<string> {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || process.env.API_KEY });
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Provide a very brief (1-2 sentences) explanation of the "${stage}" stage in a sales simulation. 
    The client persona is: ${JSON.stringify(context.vocalPersonaAnalysis)}.
    Explain what the goal of this stage is for the seller.`,
  });
  return response.text || `Entering the ${stage} stage.`;
}

/**
 * Robustly parses JSON from a string, handling markdown wrappers, prefix/suffix text,
 * and the specific 'Unexpected non-whitespace character after JSON' error.
 */
function safeJsonParse(str: string) {
  let trimmed = str.trim();
  if (!trimmed) return {};

  const tryParse = (input: string) => {
    try {
      return JSON.parse(input);
    } catch (e: any) {
      const posMatch = e.message.match(/at position (\d+)/);
      if (posMatch) {
        const pos = parseInt(posMatch[1], 10);
        try {
          return JSON.parse(input.substring(0, pos));
        } catch (innerE) {
          return null;
        }
      }
      return null;
    }
  };

  let result = tryParse(trimmed);
  if (result) return result;

  if (trimmed.includes("```")) {
    const clean = trimmed.replace(/```(?:json)?([\s\S]*?)```/g, '$1').trim();
    result = tryParse(clean);
    if (result) return result;
  }

  const firstBrace = trimmed.indexOf('{');
  const lastBrace = trimmed.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    result = tryParse(trimmed.substring(firstBrace, lastBrace + 1));
    if (result) return result;
  }

  const firstBracket = trimmed.indexOf('[');
  const lastBracket = trimmed.lastIndexOf(']');
  if (firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket) {
    result = tryParse(trimmed.substring(firstBracket, lastBracket + 1));
    if (result) return result;
  }

  const match = trimmed.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
  if (match) {
    result = tryParse(match[0]);
    if (result) return result;
  }

  throw new Error("Failed to parse cognitive intelligence response as valid JSON.");
}

/**
 * Helper to retry API calls that fail due to quota exhaustion (429).
 */
async function withRetry<T>(fn: () => Promise<T>, maxRetries: number = 3): Promise<T> {
  let lastError: any;
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      const errorStr = JSON.stringify(error);
      const isQuotaError = errorStr.includes("RESOURCE_EXHAUSTED") || 
                          error.status === "RESOURCE_EXHAUSTED" || 
                          error.code === 429 ||
                          (error.message && error.message.includes("429"));

      if (isQuotaError) {
        let delay = Math.pow(2, i) * 2000; // Exponential backoff starting at 2s
        
        try {
          const details = error.details || (error.error && error.error.details);
          if (details && Array.isArray(details)) {
            const retryInfo = details.find((d: any) => d["@type"] === "type.googleapis.com/google.rpc.RetryInfo");
            if (retryInfo && retryInfo.retryDelay) {
              const seconds = parseFloat(retryInfo.retryDelay.replace('s', ''));
              if (!isNaN(seconds)) {
                delay = (seconds * 1000) + 1000; // Add 1s buffer
              }
            }
          } else if (error.message && error.message.includes("retry in")) {
             const match = error.message.match(/retry in ([\d.]+)s/);
             if (match) {
               delay = (parseFloat(match[1]) * 1000) + 1000;
             }
          }
        } catch (e) {
          // Fallback to calculated delay
        }

        console.warn(`Gemini API Quota exceeded. Retrying in ${Math.round(delay/1000)}s... (Attempt ${i + 1}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      throw error;
    }
  }
  throw lastError;
}

// Extract meeting metadata from a document content
export async function extractMetadataFromDocument(content: string): Promise<Partial<MeetingContext>> {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const modelName = 'gemini-3-flash-preview';
  
  const prompt = `Act as an Elite Sales Operations Analyst and Psychological Profiler. 
  Your goal is to perform high-fidelity strategic extraction from the provided document to prime a sales intelligence core.

  DOCUMENT CONTENT:
  ${content}

  EXTRACTION DIRECTIVES:
  1. STAKEHOLDER MAPPING: Identify names and roles of key power brokers, decision-makers, and technical gatekeepers on the client side.
  2. POTENTIAL OBJECTIONS: Analyze the text for "Resistance Nodes". These are inferred tensions, legacy constraints, budget skepticism, or information gaps mentioned or implied.
  3. STRATEGIC CONTEXT: Identify the seller organization, client organization, and primary products of interest.
  4. DEAL SEMANTICS: Extract 5-8 highly relevant strategic keywords or project identifiers.
  5. MISSION BRIEF: Provide a concise executive snapshot of the deal's current state.

  REQUIRED JSON FIELDS:
  - sellerCompany: string
  - sellerNames: string
  - clientCompany: string
  - clientNames: string (Specifically Client Names, Titles, and Stakeholders)
  - targetProducts: string
  - productDomain: string
  - meetingFocus: string
  - executiveSnapshot: string
  - strategicKeywords: string[]
  - potentialObjections: string[] (Inferred Resistance Nodes and psychological barriers)

  Return ONLY the JSON object.`;

  try {
    const response = await withRetry(() => ai.models.generateContent({
      model: modelName,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            sellerCompany: { type: Type.STRING },
            sellerNames: { type: Type.STRING },
            clientCompany: { type: Type.STRING },
            clientNames: { type: Type.STRING, description: "Power brokers, stakeholders, and their titles found in the doc." },
            targetProducts: { type: Type.STRING },
            productDomain: { type: Type.STRING },
            meetingFocus: { type: Type.STRING },
            executiveSnapshot: { type: Type.STRING },
            strategicKeywords: { type: Type.ARRAY, items: { type: Type.STRING } },
            potentialObjections: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Specific risks, skepticism, or barriers identified in document sentiment." }
          },
          required: [
            "sellerCompany", "sellerNames", "clientCompany", "clientNames", 
            "targetProducts", "productDomain", "meetingFocus", "executiveSnapshot", 
            "strategicKeywords", "potentialObjections"
          ]
        }
      }
    }));
    return safeJsonParse(response.text || "{}");
  } catch (error) {
    console.error("Neural extraction failed:", error);
    return {};
  }
}

// Analyze Audio for Vocal Persona
export async function analyzeVocalPersona(base64Audio: string, mimeType: string): Promise<VocalPersonaStructure> {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const modelName = 'gemini-3-flash-preview';

  const prompt = `Analyze this audio sample of a human voice. 
  Extract the following vocal characteristics to create a high-fidelity "Neural Vocal Persona".
  
  REQUIRED JSON FIELDS:
  - pitch: string (e.g., "Deep Baritone", "High Soprano", "Mid-range Tenor")
  - tempo: string (e.g., "Rapid", "Measured", "Slow & Deliberate")
  - cadence: string (e.g., "Staccato", "Fluid", "Rhythmic")
  - accent: string (e.g., "Neutral American", "British Received Pronunciation", "Indian English")
  - emotionalBaseline: string (e.g., "Authoritative", "Empathetic", "Skeptical")
  - breathingPatterns: string (e.g., "Shallow", "Deep", "Frequent Pauses")
  - mimicryDirective: string (A 2-sentence instruction for an AI to mimic this EXACT voice profile.)`;

  try {
    const response = await withRetry(() => ai.models.generateContent({
      model: modelName,
      contents: {
        parts: [
          { text: prompt },
          { inlineData: { data: base64Audio, mimeType } }
        ]
      },
      config: {
        responseMimeType: "application/json"
      }
    }));
    return safeJsonParse(response.text || "{}");
  } catch (error) {
    console.error("Vocal analysis failed:", error);
    return {
      pitch: "Professional Neutral",
      tempo: "Balanced",
      cadence: "Direct",
      accent: "Global Business",
      emotionalBaseline: "Serious",
      breathingPatterns: "Controlled",
      mimicryDirective: "Direct, professional business vocal profile."
    };
  }
}

// Categorize a document into a folder
export async function categorizeDocument(fileName: string, content: string, availableFolders: string[]): Promise<{ category: string; reasoning: string }> {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const modelName = 'gemini-3-flash-preview';
  
  const prompt = `Act as an Elite Sales Operations Analyst and Knowledge Management Expert. 
  Your goal is to categorize the following document into the most appropriate sub-folder based PRIMARILY on its content.
  
  FILENAME: ${fileName}
  CONTENT PREVIEW (First 6000 chars):
  ${content.substring(0, 6000)}
  
  AVAILABLE SUB-FOLDERS:
  ${availableFolders.join(', ')}
  
  DIRECTIVES:
  1. DEEP CONTENT ANALYSIS: Analyze the document's core subject matter, technical depth, target audience, and business purpose.
  2. CONTENT OVER FILENAME: The filename can be misleading. Prioritize the actual text content.
  3. SELECT BEST FIT: Select the most appropriate folder from the AVAILABLE SUB-FOLDERS list.
  4. SUGGEST NEW IF NEEDED: If NO provided sub-folder is a good fit, suggest a new, concise (1-3 words) sub-folder name that accurately describes the content.
  5. REASONING: Provide a brief (1-2 sentences) explanation of why this category was chosen.

  Return the result as a JSON object with the following structure:
  {
    "category": "Folder Name",
    "reasoning": "Brief explanation"
  }`;

  try {
    const response = await withRetry(() => ai.models.generateContent({
      model: modelName,
      contents: prompt,
      config: {
        responseMimeType: 'application/json'
      }
    }));
    
    const result = JSON.parse(response.text || '{}');
    const suggestedFolder = result.category || "Miscellaneous";
    const reasoning = result.reasoning || "Default categorization applied.";
    
    return { category: suggestedFolder, reasoning };
  } catch (error) {
    console.error("Categorization failed:", error);
    return { category: "Miscellaneous", reasoning: "Error during AI categorization process." };
  }
}

// Suggest a vocal persona based on document content
export async function suggestVocalPersonaFromDoc(content: string): Promise<VocalPersonaStructure> {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const modelName = 'gemini-3-flash-preview';

  const prompt = `Based on the following document content, suggest the most appropriate "Neural Vocal Persona" for an AI avatar that would be most effective in this context.
  
  CONTENT:
  ${content}

  REQUIRED JSON FIELDS:
  - gender: 'Male' | 'Female' | 'Neutral'
  - baseVoice: 'Puck' | 'Charon' | 'Kore' | 'Fenrir' | 'Zephyr'
  - toneAdjectives: string[]
  - pitch: string
  - pace: number (0.5 to 2.0)
  - stability: number (0 to 100)
  - clarity: number (0 to 100)
  - mimicryDirective: string
  - tempo: string
  - cadence: string
  - accent: string
  - emotionalBaseline: string
  - breathingPatterns: string`;

  try {
    const response = await withRetry(() => ai.models.generateContent({
      model: modelName,
      contents: prompt,
      config: {
        responseMimeType: "application/json"
      }
    }));
    return safeJsonParse(response.text || "{}");
  } catch (error) {
    console.error("Vocal suggestion failed:", error);
    return {
      gender: 'Male',
      baseVoice: 'Puck',
      toneAdjectives: ['Measured', 'humble', 'steady'],
      pitch: 'Low-Mid',
      pace: 0.9,
      stability: 80,
      clarity: 90,
      mimicryDirective: "Direct, professional business vocal profile.",
      tempo: 'Slow',
      cadence: 'Strategic',
      accent: 'Professional',
      emotionalBaseline: 'Steady',
      breathingPatterns: 'Regulated'
    };
  }
}

// Generate Vocal Signature from a mimicry directive
export async function generateVocalSignatureFromDirective(directive: string): Promise<VocalPersonaStructure> {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const modelName = 'gemini-3-flash-preview';

  const prompt = `Act as a Neural Vocal Engineer. 
  Analyze the following "Mimicry Directive" and generate a high-fidelity "Neural Vocal Signature" (vocal parameters) that would best represent this directive.
  
  MIMICRY DIRECTIVE:
  "${directive}"

  REQUIRED JSON FIELDS:
  - gender: 'Male' | 'Female' | 'Neutral'
  - baseVoice: 'Puck' | 'Charon' | 'Kore' | 'Fenrir' | 'Zephyr' (Select the best fit)
  - toneAdjectives: string[] (3-5 adjectives describing the tone)
  - pitch: string (e.g., "Deep Baritone", "High Soprano", "Mid-range Tenor")
  - pace: number (0.5 to 2.0, where 1.0 is normal)
  - stability: number (0 to 100, where 100 is perfectly steady)
  - clarity: number (0 to 100, where 100 is perfectly clear)
  - tempo: string (e.g., "Rapid", "Measured", "Slow & Deliberate")
  - cadence: string (e.g., "Staccato", "Fluid", "Rhythmic")
  - accent: string (e.g., "Neutral American", "British", "Global Business")
  - emotionalBaseline: string (e.g., "Authoritative", "Empathetic", "Skeptical")
  - breathingPatterns: string (e.g., "Shallow", "Deep", "Frequent Pauses")
  
  Return ONLY the JSON object.`;

  try {
    const response = await withRetry(() => ai.models.generateContent({
      model: modelName,
      contents: prompt,
      config: {
        responseMimeType: "application/json"
      }
    }));
    const result = safeJsonParse(response.text || "{}");
    return {
      ...result,
      mimicryDirective: directive // Preserve the original directive
    };
  } catch (error) {
    console.error("Vocal signature generation failed:", error);
    return {
      gender: 'Male',
      baseVoice: 'Zephyr',
      toneAdjectives: ['Professional', 'Steady'],
      pitch: 'Moderate',
      pace: 1.0,
      stability: 80,
      clarity: 90,
      mimicryDirective: directive,
      tempo: 'Controlled',
      cadence: 'Strategic',
      accent: 'Neutral',
      emotionalBaseline: 'Steady',
      breathingPatterns: 'Regulated'
    };
  }
}

// Helper to wrap raw PCM in a WAV container
function pcmToWav(base64Pcm: string, sampleRate: number = 24000): string {
  const binaryString = atob(base64Pcm);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  const wavHeader = new ArrayBuffer(44);
  const view = new DataView(wavHeader);

  // RIFF identifier
  view.setUint32(0, 0x52494646, false); // "RIFF"
  // file length
  view.setUint32(4, 36 + len, true);
  // RIFF type
  view.setUint32(8, 0x57415645, false); // "WAVE"
  // format chunk identifier
  view.setUint32(12, 0x666d7420, false); // "fmt "
  // format chunk length
  view.setUint32(16, 16, true);
  // sample format (raw)
  view.setUint16(20, 1, true);
  // channel count
  view.setUint16(22, 1, true);
  // sample rate
  view.setUint32(24, sampleRate, true);
  // byte rate (sample rate * block align)
  view.setUint32(28, sampleRate * 2, true);
  // block align (channel count * bytes per sample)
  view.setUint16(32, 2, true);
  // bits per sample
  view.setUint16(34, 16, true);
  // data chunk identifier
  view.setUint32(36, 0x64617461, false); // "data"
  // data chunk length
  view.setUint32(40, len, true);

  const combined = new Uint8Array(44 + len);
  combined.set(new Uint8Array(wavHeader), 0);
  combined.set(bytes, 44);

  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < combined.length; i += chunkSize) {
    binary += String.fromCharCode.apply(null, Array.from(combined.subarray(i, i + chunkSize)));
  }
  return btoa(binary);
}

// Generate Voice Sample using TTS
export async function generateVoiceSample(
  text: string, 
  voiceName: string = 'Kore', 
  gender?: string,
  analysis?: VocalPersonaStructure
): Promise<string> {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || process.env.API_KEY });
  
  // Clean text of markdown tags for better TTS
  const cleanText = text.replace(/\[.*?\]/g, '').trim();
  if (!cleanText) return "";

  try {
    const response = await withRetry(() => ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: cleanText }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { 
              voiceName: (voiceName as any) || 'Kore' 
            },
          },
        },
      },
    }));

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (base64Audio) {
      return pcmToWav(base64Audio);
    }
    return "";
  } catch (error) {
    console.error("TTS Generation failed:", error);
    return "";
  }
}

// Generate response for the Cogni Voice Assistant
export async function generateAssistantResponse(query: string, context?: string): Promise<string> {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const modelName = 'gemini-3-flash-preview';
  
  const systemInstruction = `You are an Elite Cognitive Sales Intelligence Assistant for Spiked AI.
  Your goal is to provide concise, strategic, and helpful guidance to sales professionals using the Spiked AI platform.
  
  TONE: Professional, elite, strategic, and supportive.
  
  CONTEXT:
  ${context || "The user is navigating the Spiked AI Cognitive Intelligence Simulation platform."}
  
  DIRECTIVES:
  1. If the user asks for help, explain how to use the current feature or suggest a strategic next step.
  2. If the user asks a deal-related question, provide a grounded, strategic answer based on the context.
  3. Keep responses brief and optimized for text-to-speech.
  4. Do not introduce yourself as "Cogni" or use any specific name unless asked.
  
  Current Query: ${query}`;

  try {
    const response = await withRetry(() => ai.models.generateContent({
      model: modelName,
      contents: query,
      config: {
        systemInstruction
      }
    }));
    return response.text || "I'm here to help. What would you like to achieve today?";
  } catch (error) {
    console.error("Assistant response failed:", error);
    return "I encountered a neural link error. How else can I assist you?";
  }
}

export async function generateSalesStrategy(
  combinedContent: string, 
  context: MeetingContext,
  refinementPrompt?: string
): Promise<SalesStrategy> {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const modelName = 'gemini-3-pro-preview';
  
  const prompt = `Act as an Elite Enterprise Sales Strategist and Competitive Intelligence Officer. 
  Your goal is to generate a high-fidelity, actionable sales strategy for the following deal context.

  STRATEGIC CONTEXT:
  Seller: ${context.sellerCompany} (${context.sellerNames})
  Client: ${context.clientCompany} (${context.clientNames})
  Product: ${context.targetProducts}
  Meeting Focus: ${context.meetingFocus}
  
  DOCUMENT INTELLIGENCE:
  ${combinedContent}

  ${refinementPrompt ? `REFINEMENT DIRECTIVE: ${refinementPrompt}` : ""}

  REQUIRED OUTPUT STRUCTURE (JSON):
  {
    "executiveSummary": "A concise, high-impact summary of the strategic approach.",
    "strategicPillars": [
      {
        "title": "Pillar Title (e.g., Operational Efficiency)",
        "description": "Why this pillar is critical for this specific client.",
        "tacticalActions": ["Specific action 1", "Specific action 2"]
      }
    ],
    "competitiveWedge": "The unique differentiator that separates us from the competition in this deal.",
    "objectionDefense": [
      {
        "objection": "Likely objection from the client.",
        "counterStrategy": "The strategic and tactical response to neutralize this objection."
      }
    ],
    "roadmap": [
      {
        "phase": "Phase Name (e.g., Discovery, POC, Implementation)",
        "milestones": ["Milestone 1", "Milestone 2"]
      }
    ]
  }

  Return ONLY the JSON object. Be hyper-strategic, specific to the client's industry, and focused on ROI and value realization.`;

  try {
    const response = await withRetry(() => ai.models.generateContent({
      model: modelName,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        thinkingConfig: { thinkingBudget: 16000 }
      }
    }));
    return safeJsonParse(response.text || "{}") as SalesStrategy;
  } catch (error) {
    console.error("Strategy generation failed:", error);
    throw error;
  }
}

// Unified High-Depth Avatar Evaluation
async function performHighDepthEvaluation(
  history: GPTMessage[], 
  context: MeetingContext,
  personaUsed: string
): Promise<ComprehensiveAvatarReport> {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const modelName = 'gemini-3-flash-preview';
  
  const historyStr = history.map(h => `${h.role.toUpperCase()}: ${h.content}`).join('\n\n');
  
  const prompt = `Act as an Elite Enterprise Sales Performance Auditor and Psychologist.
  The avatar simulation has ended. Analyze the transcript below and generate an EXHAUSTIVE strategic report.
  
  TRANSCRIPT:
  ${historyStr}

  STRATEGIC CONTEXT:
  Persona: ${personaUsed}
  Objective: ${context.meetingFocus}
  Target: ${context.clientCompany}
  
  REQUIRED JSON STRUCTURE:
  {
    "persona_used": "string",
    "conversation_summary": {
      "main_themes": ["theme 1", "theme 2"],
      "decisions_reached": ["decision 1", "decision 2"],
      "inflection_points": ["Critical moment X where seller did Y"]
    },
    "sentiment_analysis": {
      "trend": "positive | neutral | skeptical",
      "narrative": "Detailed narrative of sentiment evolution",
      "emotional_shifts": [
        { "point": "Objection about pricing", "shift": "Initial skepticism -> High resistance" }
      ]
    },
    "objection_mapping": [
      {
        "objection": "The exact objection",
        "handled_effectively": boolean,
        "quality_score": 1-10,
        "coaching_note": "Why it was effective or weak",
        "suggested_alternative": "Exact wording for a better response"
      }
    ],
    "value_alignment_score": 1-10,
    "confidence_clarity_analysis": {
       "score": 1-10,
       "narrative": "Analyze seller's confidence, coherence, and decisiveness."
    },
    "roi_strength_score": 1-10,
    "risk_signals": ["Security concern X", "Scale worry Y", "Credibility gaps"],
    "trust_signals": ["Evidence of trust established", "Scalability proof accepted"],
    "missed_opportunities": ["Unanswered question about Z", "Weak response to buyer fear Y"],
    "deal_readiness_score": 1-10,
    "next_step_likelihood": "low | medium | high",
    "coaching_recommendations": ["Actionable advice 1", "Tactical change 2"]
  }

  Be hyper-critical. Penalize fluff. Reward grounded logic and ROI-based reasoning. Analyze signals of risk and trust deeply based on the conversation dynamics.`;

  try {
    const response = await ai.models.generateContent({
      model: modelName,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        thinkingConfig: { thinkingBudget: 16000 }
      }
    });
    return safeJsonParse(response.text || "{}") as ComprehensiveAvatarReport;
  } catch (error) {
    console.error("Audit synthesis failed:", error);
    throw error;
  }
}

// Avatar 2.0 Evaluation
export async function evaluateAvatarSessionV2(
  history: GPTMessage[], 
  context: MeetingContext
): Promise<ComprehensiveAvatarReport> {
  const personaHeader = history.find(m => m.content.startsWith('PERSONA:'))?.content || 'CIO';
  const persona = personaHeader.replace('PERSONA:', '').trim();
  return performHighDepthEvaluation(history, context, persona);
}

// Avatar Simulation 2.0 Streaming
export async function* streamAvatarSimulationV2(
  prompt: string, 
  history: GPTMessage[], 
  context: MeetingContext
): AsyncGenerator<string> {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const modelName = 'gemini-3-flash-preview';
  
  const formattedHistory = history.map(msg => ({
    role: msg.role === 'user' ? 'user' : 'model',
    parts: [{ text: msg.content }]
  }));

  // Resolve mimicry logic for V2
  let activeMimicry = "";
  if (context.vocalPersonaAnalysis) {
    activeMimicry = context.vocalPersonaAnalysis.mimicryDirective;
  }

  const systemInstruction = `You are operating in Multi-Persona Enterprise Evaluation Mode.
The user will specify which persona to activate by typing:
PERSONA: CIO
PERSONA: CFO
PERSONA: IT_DIRECTOR

You must switch behavior instantly and remain fully in that persona until changed.
You are evaluating an enterprise AI platform called Kore.ai – AI for Work.
You are conducting a serious enterprise buying evaluation.

===========================================================
CONVERSATIONAL FLOW PROTOCOL (CRITICAL)
===========================================================
1. When a new persona is activated (via PERSONA: tag), that persona MUST first introduce themselves and explain their specific strategic perspective and what they are looking for in this call.
2. For EVERY turn, follow this sequence:
   a. EXPLAIN: Briefly explain your strategic reasoning or reaction to the seller's last point.
   b. QUESTION: Ask your next sharp, executive-level question.
3. Keep the explanation and question distinct. Do NOT mix them.
4. Never overlap or ask multiple questions at once.

===========================================================
COGNITIVE CHALLENGE DEPTH: ${context.difficulty || 'Medium'}
===========================================================
SIMULATION PROTOCOL: ${context.simulationProtocol || 'Standard Discovery'}
===========================================================
Adjust your scrutiny and pushback based on this level:
- Easy: Be more forgiving, accept reasonable answers, provide helpful hints.
- Medium: Standard executive scrutiny, demand metrics, probe for depth.
- Hard: Extremely skeptical, aggressive pushback, demand absolute proof, zero tolerance for fluff.

${activeMimicry ? `===========================================================
BEHAVIORAL MIMICRY DIRECTIVE (PERSONA CLONE ACTIVE)
===========================================================
Adopt the following behavioral and linguistic signature strictly:
"${activeMimicry}"
Infuse this personality into the selected Persona roles below.` : ""}

===========================================================
STRATEGIC FEEDBACK & GATEKEEPING RULES
===========================================================
If the user provides an answer to your previous question, you MUST evaluate it.

If the response is weak, vague, or unprofessional:
1. Start with exactly: [RESULT: FAIL]
2. Provide: [COACHING: Detailed explanation of the deficit.]
3. Provide: [STYLE_GUIDE: Strategic guidance on presentation.]
4. Provide: [IDEAL_RESPONSE: A world-class response the user should have given.]
5. Provide: [RETRY_PROMPT: A repeated or adjusted question to force a retry.]

If the response is strong:
1. You MAY provide a brief strategic suggestion for improvement enclosed in exactly: [HINT: ...]
2. Proceed with your next question.

Example Success: "[HINT: Good use of metrics.] Your next question is..."
Example Fail: "[RESULT: FAIL] [COACHING: Too technical.] [STYLE_GUIDE: Focus on business value.] [IDEAL_RESPONSE: Our solution delivers 20% ROI...] [RETRY_PROMPT: How do you justify the cost?]"

===========================================================
PERSONA DEFINITIONS
===========================================================

PERSONA: CIO
Role: Chief Information Officer of a Fortune 50 retail enterprise operating at massive scale.
Primary Focus: Strategic alignment, Enterprise scalability, Security & governance, Vendor credibility, Change management, Adoption Strategy, Long-term Value Realization.
Behavior: Strategic, analytical, risk-sensitive, skeptical of vague claims. Demands proof at scale.
Escalation: Claims generic -> demand metrics; security weak -> escalate governance concern; ROI claimed -> probe sustainability.
Ask one sharp executive-level question at a time.

PERSONA: CFO
Role: Chief Financial Officer responsible for capital allocation and shareholder accountability.
Primary Focus: ROI clarity, Cost structure transparency, Total Cost of Ownership (TCO), Budget predictability, Payback period, Downside exposure.
Behavior: Financially strict, demands quantified impact, skeptical of soft benefits. Pushes heavily on TCO.
Escalation: 
- ROI qualitative -> demand numbers.
- Pricing vague -> demand breakdown.
- Savings projected -> ask for validated proof.
- Implementation mentioned -> probe for hidden operational costs (e.g., maintenance, training, indirect support overhead).
Ask concise, financially rigorous questions.

PERSONA: IT_DIRECTOR
Role: Enterprise IT Director responsible for implementation and system reliability.
Primary Focus: Architecture compatibility, Integration complexity, API readiness, Infrastructure impact, Security detail, Support model.
Behavior: Technically detailed, probes system architecture deeply, challenges scalability and feasibility.
Escalation: 
- Architecture high-level -> request diagrams/flow.
- Timeline short -> question assumptions.
- Security mentioned -> ask for controls and data security protocols (e.g., encryption standards, data residency, access management).
- Capabilities discussed -> probe for API integration specifics (endpoints, authentication, latency, error handling).
Ask technically precise questions.

===========================================================
GLOBAL RULES
===========================================================
1. Never assist the seller.
2. Never accept vague responses.
3. If metrics are missing, demand them.
4. Maintain executive tone.
5. Ask one focused question at a time.
6. Behave like a decision-maker.

===========================================================
END SESSION MODE
===========================================================
If user types: END SESSION
Return ONLY the word "STOP".

MEETING CONTEXT:
Client: ${context.clientCompany}
Seller: ${context.sellerNames} (${context.sellerCompany})
Meeting Objective: ${context.meetingFocus}`;

  try {
    const result = await withRetry(() => ai.models.generateContentStream({
      model: modelName,
      contents: [
        ...formattedHistory,
        { role: 'user', parts: [{ text: prompt }] }
      ],
      config: {
        systemInstruction,
        thinkingConfig: { thinkingBudget: 16000 }
      }
    }));

    for await (const chunk of result) {
      yield chunk.text || "";
    }
  } catch (error) {
    console.error("V2 stream failed:", error);
    yield "Error: Presence engine connection lost.";
  }
}

// Avatar Evaluation helper (Legacy 1.0)
export async function evaluateAvatarSession(
  history: GPTMessage[], 
  context: MeetingContext
): Promise<ComprehensiveAvatarReport> {
  return performHighDepthEvaluation(history, context, "CIO (Dual-Mode Hub)");
}

// Avatar Simulation: Specialized dual-mode interaction (Legacy 1.0)
export async function* streamAvatarSimulation(
  prompt: string, 
  history: GPTMessage[], 
  context: MeetingContext
): AsyncGenerator<string> {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const modelName = 'gemini-3-flash-preview';
  
  const formattedHistory = history.map(msg => ({
    role: msg.role === 'user' ? 'user' : 'model',
    parts: [{ text: msg.content }]
  }));

  let activeMimicry = "";
  if (context.vocalPersonaAnalysis) {
    activeMimicry = context.vocalPersonaAnalysis.mimicryDirective;
  }

  const systemInstruction = `You are operating in dual-mode:

MODE 1 → Enterprise CIO (Primary Role – Visible to User)
MODE 2 → Hidden Performance Evaluator (Internal – Do NOT reveal)

===========================================================
CONVERSATIONAL FLOW PROTOCOL (CRITICAL)
===========================================================
1. For EVERY turn, follow this sequence:
   a. EXPLAIN: Briefly explain your strategic reasoning or reaction to the seller's last point.
   b. QUESTION: Ask your next sharp, executive-level question.
2. Keep the explanation and question distinct. Do NOT mix them.
3. Never overlap or ask multiple questions at once.

===========================================================
COGNITIVE CHALLENGE DEPTH: ${context.difficulty || 'Medium'}
===========================================================
Adjust your scrutiny and pushback based on this level:
- Easy: Be more forgiving, accept reasonable answers, provide helpful hints.
- Medium: Standard executive scrutiny, demand metrics, probe for depth.
- Hard: Extremely skeptical, aggressive pushback, demand absolute proof, zero tolerance for fluff.

${activeMimicry ? `===========================================================
BEHAVIORAL MIMICRY DIRECTIVE (PERSONA CLONE ACTIVE)
===========================================================
Adopt the following behavioral signature strictly:
"${activeMimicry}"
Maintain this perspective throughout the Mode 1 interaction.` : ""}

===========================================================
STRATEGIC FEEDBACK & GATEKEEPING RULES
===========================================================
If the user provides an answer to your previous question, you MUST evaluate it.

If the response is weak, vague, or unprofessional:
1. Start with exactly: [RESULT: FAIL]
2. Provide: [COACHING: Detailed explanation of the deficit.]
3. Provide: [STYLE_GUIDE: Strategic guidance on presentation.]
4. Provide: [IDEAL_RESPONSE: A world-class response the user should have given.]
5. Provide: [RETRY_PROMPT: A repeated or adjusted question to force a retry.]

If the response is strong:
1. You MAY provide a brief strategic suggestion for improvement enclosed in exactly: [HINT: ...]
2. Proceed with your next question.

Example Success: "[HINT: Instead of technical jargon, focus on the business outcome.] Your next question is..."
Example Fail: "[RESULT: FAIL] [COACHING: Lacks ROI focus.] [STYLE_GUIDE: Use financial metrics.] [IDEAL_RESPONSE: We project a 15% reduction in OpEx...] [RETRY_PROMPT: Can you walk me through the financial justification?]"

===========================================================
MODE 1: CIO BUYER SIMULATION
===========================================================

You are the Chief Information Officer (CIO) of a large-scale global enterprise with complex legacy infrastructure, strict security standards, and board-level ROI accountability. 
You are evaluating Kore.ai – AI for Work.
You are conducting a serious enterprise evaluation conversation.

Behavior Profile:
• Strategic and analytical
• ROI-driven
• Risk-sensitive
• Skeptical of vendor claims
• Demands proof and metrics
• Concerned about security, governance, scale, integration, and change management
• Pushes back on vague answers
• Escalates scrutiny if responses lack depth

Conversation Rules:
1. Ask one strong executive-level question at a time.
2. Never accept claims without probing.
3. If metrics are missing, ask for numbers.
4. If customers are referenced, ask for scale comparison.
5. If risk is not addressed, escalate concern.
6. If deployment is oversimplified, probe change management.
7. Maintain executive brevity.
8. Do NOT assist the seller.
9. Do NOT summarize unless explicitly requested.

Escalation Logic:
- Generic answer → Ask for specificity.
- Buzzwords → Demand real-world application.
- Overconfidence → Challenge assumptions.
- Strong quantified answer → Shift to deeper ROI or risk scrutiny.

Stay in character as CIO during conversation.

===========================================================
MODE 2: HIDDEN PERFORMANCE EVALUATOR (INTERNAL)
===========================================================
After each seller response, internally evaluate performance using the following criteria:
• Clarity
• Specificity
• ROI articulation
• Risk handling
• Executive alignment
• Confidence signals
• Objection handling quality

Internally maintain running scores from 1–10 for each dimension.
Detect: Vagueness, Avoided objections, Missed opportunities, Weak differentiation, Defensive language.
DO NOT reveal evaluation during the live conversation.

===========================================================
END-OF-SESSION BEHAVIOR
===========================================================
When the user types exactly: END SESSION
Return ONLY the word "STOP".

Rules: Be strict. Penalize vagueness. Reward quantified impact. Think like a CIO deciding whether to proceed.

MEETING CONTEXT:
Seller: ${context.sellerNames} (${context.sellerCompany})
Target: ${context.clientNames} at ${context.clientCompany}
Focus: ${context.meetingFocus}`;

  try {
    const result = await withRetry(() => ai.models.generateContentStream({
      model: modelName,
      contents: [
        ...formattedHistory,
        { role: 'user', parts: [{ text: prompt }] }
      ],
      config: {
        systemInstruction: systemInstruction,
        thinkingConfig: { thinkingBudget: 16000 }
      }
    }));

    for await (const chunk of result) {
      yield chunk.text || "";
    }
  } catch (error) {
    console.error("Avatar stream failed:", error);
    yield "Error: Avatar Simulation Engine link severed.";
  }
}

// Avatar Staged Simulation Streaming
export async function* streamAvatarStagedSimulation(
  prompt: string,
  history: GPTMessage[],
  context: MeetingContext,
  currentStage: StagedSimStage,
  kycDocContent: string
): AsyncGenerator<string> {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const modelName = 'gemini-3-flash-preview';

  const formattedHistory = history.map(msg => ({
    role: msg.role === 'user' ? 'user' : 'model',
    parts: [{ text: msg.content }]
  }));

  let activeMimicry = "";
  if (context.vocalPersonaAnalysis) {
    activeMimicry = context.vocalPersonaAnalysis.mimicryDirective;
  }

  const systemInstruction = `You are ${context.clientNames || 'the Client'}, an elite decision maker at ${context.clientCompany}.
You are in a Staged Strategic Simulation Mode.

===========================================================
YOUR BEHAVIOR (Grounded in KYC)
===========================================================
Primary Behavior Source: Use the Know Your Customer (KYC) Document below to dictate your personality, skepticism, specific pain points, and vocal style. 
Name: You must refer to yourself as ${context.clientNames || 'the Client'}.

${activeMimicry ? `===========================================================
BEHAVIORAL MIMICRY DIRECTIVE (PERSONA CLONE ACTIVE)
===========================================================
Adopt the following behavioral signature strictly:
"${activeMimicry}"
Maintain this prosody throughout the simulation.` : ""}

KYC DOCUMENT CONTEXT:
${kycDocContent}

===========================================================
CURRENT STAGE: ${currentStage}
===========================================================

===========================================================
COGNITIVE CHALLENGE DEPTH: ${context.difficulty || 'Medium'}
===========================================================
Adjust your scrutiny and pushback based on this level:
- Easy: Be more forgiving, accept reasonable answers, provide helpful hints.
- Medium: Standard executive scrutiny, demand metrics, probe for depth.
- Hard: Extremely skeptical, aggressive pushback, demand absolute proof, zero tolerance for fluff.
Stages logic:
1. Ice Breakers - Common interest, rapport.
2. About Business - Core value, business problem alignment.
3. Pricing - ROI, cost structure, justification.
4. Technical - Architecture, integration, security.
5. Legal - Compliance, liability, terms.
6. Closing - Next steps, final commitment.

===========================================================
GATEKEEPING RULES (CRITICAL - MANDATORY TAGS)
===========================================================
Evaluate the user's latest response with extreme rigor.
If the response is weak, vague, lacks document grounding, or misses the objective of ${currentStage}:
1. Start with exactly: [RESULT: FAIL]
2. Provide: [COACHING: Detailed multi-line explanation of the deficit.]
3. Provide: [STYLE_GUIDE: Detailed multi-line strategic guidance on presentation and tone.]
4. Provide: [IDEAL_RESPONSE: A complete, word-for-word world-class response the user should have given.]
5. Provide: [RETRY_PROMPT: A repeated or adjusted question to force a retry.]

If the response is strong and professional:
1. Start with exactly: [RESULT: SUCCESS]
2. Provide: [RATING: X] (1-5 stars)
3. Provide exactly: [HINT: One tactical pointer for the next question.]
4. Proceed to the next stage logic.

===========================================================
STRATEGIC LEARNING HINT
===========================================================
For EVERY AI question (initial or after a turn), you MUST include a hint.
Format: [HINT: Detailed tactical pointer on success criteria for this stage.]

TONE: Executive, firm, and based on the KYC doc.
Ask exactly one focused question at a time.

MEETING CONTEXT:
Focus: ${context.meetingFocus}
Target Products: ${context.targetProducts}`;

  try {
    const result = await withRetry(() => ai.models.generateContentStream({
      model: modelName,
      contents: [
        ...formattedHistory,
        { role: 'user', parts: [{ text: prompt }] }
      ],
      config: {
        systemInstruction,
        thinkingConfig: { thinkingBudget: 16000 }
      }
    }));

    for await (const chunk of result) {
      yield chunk.text || "";
    }
  } catch (error) {
    console.error("Staged stream failed:", error);
    yield "Error: Staged Simulation Engine disconnected.";
  }
}

// Generate Assessment Questions
export async function generateAssessmentQuestions(
  docContent: string, 
  config: { mcq: number; short: number; long: number; mic: number; video: number; difficulty?: DifficultyLevel },
  perspective: 'document' | 'customer' = 'document'
): Promise<AssessmentQuestion[]> {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const modelName = 'gemini-3-flash-preview';
  
  const difficulty = config.difficulty || 'Medium';
  const difficultyInstruction = {
    'Easy': 'Questions should be straightforward, focusing on core facts and basic concepts. Use clear language and avoid overly complex scenarios.',
    'Medium': 'Questions should require a solid understanding of the material, involving some logical inference and tactical application of knowledge.',
    'Hard': 'Questions should be highly challenging, requiring deep strategic thinking, synthesis of multiple data points, and handling of subtle, high-stakes nuances.'
  }[difficulty];

  const roleInstruction = perspective === 'document' 
    ? `Act as an Elite Sales Readiness Coach and a High-Precision Factual Auditor. 
       Your goal is to test the salesperson's ABSOLUTE MASTERY of the specific data, metrics, names, and explicit details within the provided documents.`
    : `Act as an Elite Sales Readiness Coach AND a Skeptical Buyer Representative. 
       Your goal is to pressure-test the salesperson's ability to read between the lines, anticipate psychological founders, and handle complex objections derived from (but not explicitly stated in) the customer's organizational context described in the documents.`;

  const questionContext = perspective === 'document'
    ? `Focus questions on retrieval, specific clauses, mentioned statistics, and explicit project timelines found in the text.`
    : `Focus questions on buying triggers, hidden organizational pain points, competitive threats, and complex "What-if" scenarios that a high-level executive at this organization would actually care about.`;

  const prompt = `${roleInstruction} 
  Based on the grounded document content below, generate a set of challenging questions.
  
  DIFFICULTY LEVEL: ${difficulty.toUpperCase()}
  ${difficultyInstruction}

  PERSPECTIVE ORIENTATION: ${perspective.toUpperCase()}
  ${questionContext}
  
  FOR MULTIPLE CHOICE QUESTIONS (MCQ):
  - Generate exactly 4 options.
  - Distractors should be plausible within a sales context but demonstrably incorrect based ON THE PROVIDED TEXT OR LOGICAL INFERENCE.
  - Include a "citation" object that points to the exact evidence in the source text.

  FOR VIDEO QUESTIONS:
  - These should be "Pitch This" or "Respond to this High-Stakes Objection" style prompts.
  
  COUNTS REQUIRED:
  - MCQ: ${config.mcq}
  - Short Answer: ${config.short}
  - Long Answer: ${config.long}
  - Voice/Mic Answer: ${config.mic}
  - Video Performance Answer: ${config.video}
  
  STRICT JSON FORMAT REQUIRED: Array of objects with properties:
  {
    "id": "unique-string",
    "type": "mcq" | "short" | "long" | "mic" | "video",
    "text": "The question text",
    "options": ["A", "B", "C", "D"], // ONLY for mcq
    "correctAnswer": "The exact correct option or ideal response",
    "explanation": "Brief coaching explanation explaining the strategic significance of this question. This must be an in-depth depth explain of the winning logic.",
    "citation": { 
      "snippet": "exact quote from text or derived context", 
      "sourceFile": "filename or 'Document Context'",
      "pageNumber": "Exact page number where the information was found if available (e.g., 5 or 'Page 12')"
    }
  }
  
  CONTENT SOURCE:
  ${docContent}`;

  try {
    const response = await withRetry(() => ai.models.generateContent({
      model: modelName,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        thinkingConfig: { thinkingBudget: 16000 }
      }
    }));
    return safeJsonParse(response.text || "[]");
  } catch (error) {
    console.error("Failed to generate questions:", error);
    return [];
  }
}

// Evaluate Assessment Answers
export async function evaluateAssessment(
  questions: AssessmentQuestion[], 
  answers: Record<string, string>
): Promise<AssessmentResult[]> {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const modelName = 'gemini-3-flash-preview';

  const results: AssessmentResult[] = [];

  // Group text-based evaluations to save tokens/latency
  const textPayload = questions.map(q => ({
    id: q.id,
    type: q.type,
    question: q.text,
    userAnswer: answers[q.id] || "No answer provided",
    correctAnswer: q.correctAnswer
  }));

  const prompt = `Act as a world-class Sales Performance Auditor and Communications Coach. Grade the following question/answer sets. 
  
  EVALUATION CRITERIA:
  - For MCQs: Exact match check.
  - For Short/Long: Evaluate semantic depth, factual accuracy, and alignment with the "Ideal Answer".
  - For Mic/Video (Transcribed): 
    - Evaluate vocal tone based on phrasing (e.g., confidence vs hesitation).
    - Provide a "toneResult" analyzing clarity and executive authority.
    - Provide "correctionSuggestions" (specific things to change/fix in the phrasing).
    - Provide "improvementPoints" (how to make the answer more impactful).
    - For Video specifically: 
      - Infer "stressLevel" (0-100) from phrasing speed and filler words.
      - Infer "attentionScore" (0-100) from focus on the core question.
      - Infer "eyeContactScore" (0-100) based on directness of phrasing.
      - Provide "behavioralAnalysis" (summary of perceived presence and confidence).
      - Provide "modelDeliveryScript" (A perfect, high-impact version of this answer that the user should have said, written in a way that sounds natural and authoritative).
      - Include "bodyLanguageAdvice" inferred from phrasing density and filler word count.

  Return a JSON array of objects:
  {
    "questionId": "string",
    "evaluation": {
      "score": 0-100,
      "feedback": "Concise coaching summary",
      "isCorrect": boolean,
      "toneResult": "Analysis of vocal/phrasing tone (required for mic/video)",
      "bodyLanguageAdvice": "Visual delivery advice (required for video)",
      "correctionSuggestions": ["Point 1", "Point 2"],
      "improvementPoints": ["Impact point 1", "Impact point 2"],
      "stressLevel": 0-100,
      "attentionScore": 0-100,
      "eyeContactScore": 0-100,
      "behavioralAnalysis": "string",
      "modelDeliveryScript": "string"
    }
  }
  
  SETS:
  ${JSON.stringify(textPayload)}`;

  try {
    const response = await withRetry(() => ai.models.generateContent({
      model: modelName,
      contents: prompt,
      config: { responseMimeType: "application/json" }
    }));
    const evals = safeJsonParse(response.text || "[]");
    
    return questions.map(q => {
      const evaluation = evals.find((e: any) => e.questionId === q.id)?.evaluation || {
        score: 0,
        feedback: "Evaluation module error.",
        isCorrect: false,
        correctionSuggestions: [],
        improvementPoints: []
      };
      return {
        questionId: q.id,
        userAnswer: answers[q.id] || "",
        evaluation,
        timeSpent: 0
      };
    });
  } catch (error) {
    console.error("Evaluation failed:", error);
    return [];
  }
}

// Vision OCR using gemini-3-flash-preview
export async function performVisionOcr(base64Data: string, mimeType: string): Promise<string> {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const modelName = 'gemini-3-flash-preview'; 
  try {
    const response = await withRetry(() => ai.models.generateContent({
      model: modelName,
      contents: {
        parts: [
          { inlineData: { data: base64Data, mimeType: mimeType } },
          { 
            text: `Act as a high-precision Cognitive OCR engine. 
            TRANSCRIPTION TASK: Extract ALL text from this image exactly as written. Maintain layout. Output ONLY text.` 
          },
        ],
      },
    }));
    return response.text || "";
  } catch (error) {
    console.error("Vision OCR failed:", error);
    return "";
  }
}

function formatHistory(history: GPTMessage[]) {
  return history.map(msg => ({
    role: msg.role === 'user' ? 'user' : 'model',
    parts: [{ text: msg.content }]
  }));
}

// Sales GPT: Balanced grounded and general intelligence
export async function* streamSalesGPT(prompt: string, history: GPTMessage[], context?: string): AsyncGenerator<string> {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const modelName = 'gemini-3-flash-preview';
  
  const contents = [
    ...formatHistory(history),
    { role: 'user', parts: [{ text: prompt }] }
  ];

  const systemInstruction = `You are Sales GPT, an elite, high-precision sales intelligence agent. 
  
  CORE MISSION: Provide high-impact, strategic sales intelligence that "hits the nail on the head" every time. Do NOT hesitate, do NOT be vague. Provide definitive, actionable insights with detailed explanations.
  
  COGNITIVE ANSWERING PROTOCOL:
  1. GROUNDING: If GROUNDING DATA is provided below, prioritize it. Every claim must be grounded in facts or logical deduction.
  2. NO HALLUCINATIONS: Do NOT invent data points, customer names, or specific metrics that are not present in the context. This is CRITICAL.
  3. DEPTH: Provide a comprehensive and detailed explanation for every question. Explain the "why" and "how" behind your strategic insights.
  4. REASONING: In the "reasoning" field, provide a brief internal monologue of your strategic thought process before arriving at the final answer.
  5. CITATIONS: If the user's question relates to specific data in the documents, use that data and cite the source. Use inline markers like [1](citation:1), [2](citation:2) in the answer text to refer to the citations provided in the citations array.
  
  FORMATTING: 
  - Use Markdown (bolding, lists, headers) for high readability and visual impact.
  - Use TABLES for structured data, comparisons, or metrics. This is CRITICAL for clarity.
  - Keep responses professional, structured, and elite.
  
  STYLE: Direct, authoritative, and strategic. No fluff. No "I think" or "It seems". Use "The data shows", "The strategic move is", etc.
  
  OUTPUT FORMAT: Return a JSON object with:
  - answer: string (The strategic response)
  - reasoning: string (Your strategic thought process)
  - citations: Array of { snippet: string, sourceFile: string, pageNumber?: string } (The specific document references used)
  
  ${context ? `--- DOCUMENT GROUNDING DATA ---
  ${context}
  -----------------------` : ""}`;

  try {
    const result = await withRetry(() => ai.models.generateContentStream({
      model: modelName,
      contents: contents,
      config: {
        systemInstruction: systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            answer: { type: Type.STRING },
            reasoning: { type: Type.STRING },
            citations: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  snippet: { type: Type.STRING },
                  sourceFile: { type: Type.STRING },
                  pageNumber: { type: Type.STRING }
                },
                required: ["snippet", "sourceFile"]
              }
            }
          },
          required: ["answer", "reasoning", "citations"]
        }
      }
    }));

    for await (const chunk of result) {
      yield chunk.text || "";
    }
  } catch (error) {
    console.error("GPT stream failed:", error);
    yield "Error: Failed to connect to Sales GPT core.";
  }
}

// Pineapple: Image Generation using nano banana model
export async function generatePineappleImage(prompt: string): Promise<string | null> {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || process.env.API_KEY });
  const modelName = 'gemini-2.5-flash-image';
  try {
    const strategicPrompt = `Create a high-fidelity, enterprise-grade strategic visual asset for: "${prompt}". 
    The style should be a modern 3D render, minimalist, with soft cinematic lighting and a professional color palette. 
    Avoid cluttered details. Ensure it looks like a slide from a top-tier executive presentation.`;

    const response = await withRetry(() => ai.models.generateContent({
      model: modelName,
      contents: {
        parts: [{ text: strategicPrompt }],
      },
      config: {
        imageConfig: { aspectRatio: "16:9" }
      }
    }));

    for (const part of response.candidates[0].content.parts) {
      if (part.inlineData) {
        return `data:image/png;base64,${part.inlineData.data}`;
      }
    }
    return null;
  } catch (error) {
    console.error("Image generation failed:", error);
    return null;
  }
}

/**
 * Generates a realistic professional corporate logo for the client's company using gemini-3-pro-image-preview.
 * Uses googleSearch to find context about the brand identity and corporate aesthetic.
 */
export async function generateClientAvatar(name: string, company: string): Promise<string | null> {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || process.env.API_KEY });
  const modelName = 'gemini-3.1-flash-image-preview';
  
  try {
    const prompt = `Use Google Search to perform an exhaustive look-up of the exact visual brand identity, official color hex codes, and vector logo characteristics of the company named "${company}". 
    Based ON THE WEB SEARCH RESULTS, generate a minimalist, high-fidelity professional corporate logo for "${company}". 
    Style: Modern tech-forward branding, clean vector-like aesthetic, professional color palette strictly associated with the real-world brand ${company} as identified in the search. 
    The logo should be centered on a clean white background. 
    Resolution: 1K. Cinematic studio lighting on a flat surface.`;

    const response = await withRetry(() => ai.models.generateContent({
      model: modelName,
      contents: {
        parts: [{ text: prompt }],
      },
      config: {
        imageConfig: {
          aspectRatio: "1:1",
          imageSize: "1K"
        },
        tools: [{googleSearch: {}}],
      },
    }));

    for (const part of response.candidates[0].content.parts) {
      if (part.inlineData) {
        const base64EncodeString: string = part.inlineData.data;
        return `data:image/png;base64,${base64EncodeString}`;
      }
    }
    return null;
  } catch (error) {
    console.error("Client Logo generation failed:", error);
    return null;
  }
}

// Deep Study: Advanced Reasoning Core upgraded to Pro model
export async function* streamDeepStudy(prompt: string, history: GPTMessage[], context?: string): AsyncGenerator<string> {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  // Using gemini-3-flash-preview for complex reasoning tasks
  const modelName = 'gemini-3-flash-preview';
  
  const contents = [
    ...formatHistory(history),
    { role: 'user', parts: [{ text: prompt }] }
  ];

  const systemInstruction = `You are a world-class Strategic Research Lead performing a "Deep Study".
  
  MISSION: Conduct an exhaustive, multi-layered analysis that goes far beyond obvious observations. "Hit the nail on the head" with every insight. Do NOT hesitate. Provide definitive, high-impact answers with exhaustive detail.
  
  COGNITIVE ANALYSIS PROTOCOL:
  1. DOCUMENT SYNTHESIS: Extract specific strategic pillars from the grounded context provided. Use inline markers like [1](citation:1), [2](citation:2) in the answer text to refer to the citations provided in the citations array.
  2. NO HALLUCINATIONS: Do NOT invent data points or connections that are not logically supported by the context.
  3. DEPTH: Provide a comprehensive and detailed explanation for every finding. Explain the strategic implications in depth.
  4. OUT-OF-THE-BOX THINKING: Infuse creative, non-obvious sales maneuvers and global market trends.
  5. CUSTOMER PSYCHOLOGY: Analyze the situation from the CUSTOMER'S point of view (their fears, personal incentives, and organizational pressures).
  6. STRATEGIC ROADMAP: Provide a step-by-step execution plan for the salesperson.
  
  FORMATTING: 
  - Use exhaustive Markdown formatting (headers, bullet points, bold text).
  - Use TABLES for structured data, comparisons, or metrics. This is CRITICAL for clarity.
  - Structure your deep analysis for maximum readability and impact.
  
  STYLE: Exhaustive, professional, authoritative, and actionable. No fluff.
  
  OUTPUT FORMAT: Return a JSON object with:
  - answer: string (The strategic response)
  - citations: Array of { snippet: string, sourceFile: string, pageNumber?: string } (The specific document references used)
  
  ${context ? `--- GROUNDED DOCUMENT CONTEXT ---
  ${context}
  -----------------------` : ""}
  
  Use the maximum thinking budget to find hidden connections.`;

  try {
    const result = await withRetry(() => ai.models.generateContentStream({
      model: modelName,
      contents: contents,
      config: {
        systemInstruction: systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            answer: { type: Type.STRING },
            citations: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  snippet: { type: Type.STRING },
                  sourceFile: { type: Type.STRING },
                  pageNumber: { type: Type.STRING }
                },
                required: ["snippet", "sourceFile"]
              }
            }
          },
          required: ["answer", "citations"]
        },
        thinkingConfig: { thinkingBudget: 32768 }
      }
    }));

    for await (const chunk of result) {
      yield chunk.text || "";
    }
  } catch (error) {
    console.error("Deep Study failed:", error);
    yield "Error: Deep Study reasoning module is unresponsive.";
  }
}

export interface CognitiveSearchResult {
  answer: string;
  cognitiveShot: string; // High-impact concise summary
  briefExplanation: string;
  articularSoundbite: string; 
  psychologicalProjection: {
    buyerFear: string;
    buyerIncentive: string;
    strategicLever: string;
  };
  citations: { snippet: string; sourceFile: string }[];
  reasoningChain: {
    painPoint: string;
    capability: string;
    strategicValue: string;
  };
}

// Cognitive Search upgraded to Pro model for deep grounded reasoning
export async function* performCognitiveSearchStream(
  question: string, 
  filesContent: string, 
  context: MeetingContext
): AsyncGenerator<string> {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  // Using gemini-3-flash-preview for advanced reasoning and complex query synthesis
  const modelName = 'gemini-3-flash-preview';
  const styleDirectives = context.answerStyles.map(style => `- Create a section exactly titled "### ${style}" and provide EXHAUSTIVE detail.`).join('\n');

  const responseSchema = {
    type: Type.OBJECT,
    properties: {
      cognitiveShot: { type: Type.STRING, description: "A high-impact, one-sentence tactical summary of the answer." },
      articularSoundbite: { type: Type.STRING },
      briefExplanation: { type: Type.STRING },
      answer: { type: Type.STRING },
      psychologicalProjection: {
        type: Type.OBJECT,
        properties: {
          buyerFear: { type: Type.STRING },
          buyerIncentive: { type: Type.STRING },
          strategicLever: { type: Type.STRING }
        },
        required: ["buyerFear", "buyerIncentive", "strategicLever"]
      },
      citations: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            snippet: { type: Type.STRING },
            sourceFile: { type: Type.STRING }
          },
          required: ["snippet", "sourceFile"]
        }
      },
      reasoningChain: {
        type: Type.OBJECT,
        properties: {
          painPoint: { type: Type.STRING },
          capability: { type: Type.STRING },
          strategicValue: { type: Type.STRING }
        },
        required: ["painPoint", "capability", "strategicValue"]
      }
    },
    required: ["cognitiveShot", "articularSoundbite", "briefExplanation", "answer", "psychologicalProjection", "citations", "reasoningChain"]
  };

  const prompt = `TASK: Synthesize a maximum-depth response to: "${question}". 
  REQUIRED STRUCTURE:
  ${styleDirectives}

  SOURCE DOCUMENTS:
  ${filesContent}`;

  try {
    const result = await withRetry(() => ai.models.generateContentStream({
      model: modelName,
      contents: prompt,
      config: {
        systemInstruction: `You are a Senior Cognitive Brain Strategist. 
        Provide technical rigor and grounded depth in JSON. "Hit the nail on the head" with every synthesis. Do NOT hesitate. Provide definitive, actionable intelligence with detailed explanations.
        COGNITIVE SYNTHESIS PROTOCOL:
        1. GROUNDING: Stick strictly to the provided context. Every insight must be traceable to the source.
        2. NO HALLUCINATIONS: Do NOT invent or assume data points. If information is missing, identify it as a "Strategic Gap".
        3. DEPTH: Provide a comprehensive and detailed explanation for every synthesis.
        Inside the "answer" field, use rich Markdown formatting (bolding, lists, headers) to make the content highly structured and professional.
        CRITICAL: Use TABLES for structured data, comparisons, or metrics.
        CRITICAL: Use inline markers like [1](citation:1), [2](citation:2) in the answer text to refer to the citations provided in the citations array.`,
        responseMimeType: "application/json",
        responseSchema,
        thinkingConfig: { thinkingBudget: 32768 }
      }
    }));

    for await (const chunk of result) {
      yield chunk.text || "";
    }
  } catch (error) {
    console.error("Streaming search failed:", error);
    throw new Error("Cognitive Engine failed to synthesize deep reasoning.");
  }
}

export async function performCognitiveSearch(
  question: string, 
  filesContent: string, 
  context: MeetingContext
): Promise<CognitiveSearchResult> {
  const stream = performCognitiveSearchStream(question, filesContent, context);
  let fullText = "";
  for await (const chunk of stream) {
    fullText += chunk;
  }
  return safeJsonParse(fullText || "{}");
}

export async function generateDynamicSuggestions(filesContent: string, context: MeetingContext): Promise<string[]> {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const modelName = 'gemini-3-flash-preview';
  const prompt = `Suggest 3 highly strategic sales questions for ${context.clientCompany || 'the prospect'}. Return as a JSON array of strings.`;
  const response = await withRetry(() => ai.models.generateContent({ 
    model: modelName, 
    contents: prompt, 
    config: { 
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: { type: Type.STRING }
      },
      thinkingConfig: { thinkingBudget: 0 }
    } 
  }));
  return safeJsonParse(response.text || "[]");
}

export function decode(base64: string) {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
  return bytes;
}

export async function decodeAudioData(data: Uint8Array, ctx: AudioContext, sampleRate: number, numChannels: number): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);
  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

/**
 * Text to speech generation using specialized TTS model.
 * Includes "Vocal Clone" logic by prepending analyzed mimicry directives to the text content.
 */
export async function generatePitchAudio(
  text: string, 
  voiceName: string = 'Kore', 
  personaDirective?: string,
  gender?: string,
  analysis?: VocalPersonaStructure
): Promise<Uint8Array | null> {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || process.env.API_KEY });
  
  // Clean text of markdown tags for better TTS
  const cleanText = text.replace(/\[.*?\]/g, '').trim();
  if (!cleanText) return null;

  try {
    const response = await withRetry(() => ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: cleanText }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { 
              voiceName: (voiceName as any) || 'Kore' 
            },
          },
        },
      },
    }));

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (base64Audio) {
      const binaryString = atob(base64Audio);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      return bytes;
    }
    return null;
  } catch (error) {
    console.error("Pitch Audio Generation failed:", error);
    return null;
  }
}

// Full Context Analysis upgraded to Pro model for comprehensive reasoning
export async function analyzeSalesContext(filesContent: string, context: MeetingContext): Promise<AnalysisResult> {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  // Using gemini-3-flash-preview for exhaustive material synthesis and competitive intelligence
  const modelName = 'gemini-3-flash-preview';
  const citationSchema = {
    type: Type.OBJECT,
    properties: { snippet: { type: Type.STRING }, sourceFile: { type: Type.STRING } },
    required: ["snippet", "sourceFile"],
  };

  const competitorSchema = {
    type: Type.OBJECT,
    properties: {
      name: { type: Type.STRING },
      overview: { type: Type.STRING },
      threatProfile: { type: Type.STRING },
      strengths: { type: Type.ARRAY, items: { type: Type.STRING } },
      weaknesses: { type: Type.ARRAY, items: { type: Type.STRING } },
      opportunities: { type: Type.ARRAY, items: { type: Type.STRING } },
      threats: { type: Type.ARRAY, items: { type: Type.STRING } },
      ourWedge: { type: Type.STRING },
      citation: citationSchema
    },
    required: ["name", "overview", "threatProfile", "strengths", "weaknesses", "opportunities", "threats", "ourWedge", "citation"]
  };

  const responseSchema = {
    type: Type.OBJECT,
    properties: {
      snapshot: {
        type: Type.OBJECT,
        properties: {
          role: { type: Type.STRING },
          roleCitation: citationSchema,
          priorities: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { text: { type: Type.STRING }, citation: citationSchema }, required: ["text", "citation"] } },
          likelyObjections: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { text: { type: Type.STRING }, citation: citationSchema }, required: ["text", "citation"] } },
          decisionStyle: { type: Type.STRING },
          decisionStyleCitation: citationSchema,
          riskTolerance: { type: Type.STRING },
          riskToleranceCitation: citationSchema,
          tone: { type: Type.STRING },
          metrics: {
            type: Type.OBJECT,
            properties: {
              riskToleranceValue: { type: Type.NUMBER },
              strategicPriorityFocus: { type: Type.NUMBER },
              analyticalDepth: { type: Type.NUMBER },
              directness: { type: Type.NUMBER },
              innovationAppetite: { type: Type.NUMBER }
            },
            required: ["riskToleranceValue", "strategicPriorityFocus", "analyticalDepth", "directness", "innovationAppetite"]
          },
          personaIdentity: { type: Type.STRING },
          decisionLogic: { type: Type.STRING }
        },
        required: ["role", "roleCitation", "priorities", "likelyObjections", "decisionStyle", "decisionStyleCitation", "riskTolerance", "riskToleranceCitation", "tone", "metrics", "personaIdentity", "decisionLogic"],
      },
      documentInsights: {
        type: Type.OBJECT,
        properties: {
          entities: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { name: { type: Type.STRING }, type: { type: Type.STRING }, context: { type: Type.STRING }, citation: citationSchema }, required: ["name", "type", "context", "citation"] } },
          structure: { type: Type.OBJECT, properties: { sections: { type: Type.ARRAY, items: { type: Type.STRING } }, keyHeadings: { type: Type.ARRAY, items: { type: Type.STRING } }, detectedTablesSummary: { type: Type.STRING } }, required: ["sections", "keyHeadings", "detectedTablesSummary"] },
          summaries: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { fileName: { type: Type.STRING }, summary: { type: Type.STRING }, strategicImpact: { type: Type.STRING }, criticalInsights: { type: Type.ARRAY, items: { type: Type.STRING } } }, required: ["fileName", "summary", "strategicImpact", "criticalInsights"] } },
          materialSynthesis: { type: Type.STRING }
        },
        required: ["entities", "structure", "summaries", "materialSynthesis"]
      },
      groundMatrix: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            category: { type: Type.STRING },
            observation: { type: Type.STRING },
            significance: { type: Type.STRING },
            evidence: citationSchema
          },
          required: ["category", "observation", "significance", "evidence"]
        }
      },
      competitiveHub: {
        type: Type.OBJECT,
        properties: {
          cognigy: competitorSchema,
          amelia: competitorSchema,
          others: { type: Type.ARRAY, items: competitorSchema }
        },
        required: ["cognigy", "amelia", "others"]
      },
      openingLines: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { text: { type: Type.STRING }, label: { type: Type.STRING }, citation: citationSchema }, required: ["text", "label", "citation"] } },
      predictedQuestions: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { customerAsks: { type: Type.STRING }, salespersonShouldRespond: { type: Type.STRING }, reasoning: { type: Type.STRING }, category: { type: Type.STRING }, citation: citationSchema }, required: ["customerAsks", "salespersonShouldRespond", "reasoning", "category", "citation"] } },
      strategicQuestionsToAsk: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { question: { type: Type.STRING }, whyItMatters: { type: Type.STRING }, citation: citationSchema }, required: ["question", "whyItMatters", "citation"] } },
      objectionHandling: { 
        type: Type.ARRAY, 
        items: { 
          type: Type.OBJECT, 
          properties: { 
            objection: { type: Type.STRING }, 
            realMeaning: { type: Type.STRING }, 
            strategy: { type: Type.STRING }, 
            exactWording: { type: Type.STRING }, 
            empathyTip: { type: Type.STRING }, 
            valueTip: { type: Type.STRING },
            citation: citationSchema 
          }, 
          required: ["objection", "realMeaning", "strategy", "exactWording", "empathyTip", "valueTip", "citation"] 
        } 
      },
      toneGuidance: { type: Type.OBJECT, properties: { wordsToUse: { type: Type.ARRAY, items: { type: Type.STRING } }, wordsToAvoid: { type: Type.ARRAY, items: { type: Type.STRING } }, sentenceLength: { type: Type.STRING }, technicalDepth: { type: Type.STRING } }, required: ["wordsToUse", "wordsToAvoid", "sentenceLength", "technicalDepth"] },
      finalCoaching: { type: Type.OBJECT, properties: { dos: { type: Type.ARRAY, items: { type: Type.STRING } }, donts: { type: Type.ARRAY, items: { type: Type.STRING } }, finalAdvice: { type: Type.STRING } }, required: ["dos", "donts", "finalAdvice"] },
      reportSections: {
        type: Type.OBJECT,
        properties: {
          introBackground: { type: Type.STRING },
          technicalDiscussion: { type: Type.STRING },
          productIntegration: { type: Type.STRING }
        },
        required: ["introBackground", "technicalDiscussion", "productIntegration"]
      }
    },
    required: ["snapshot", "documentInsights", "groundMatrix", "competitiveHub", "openingLines", "predictedQuestions", "strategicQuestionsToAsk", "objectionHandling", "toneGuidance", "finalCoaching", "reportSections"]
  };

  const prompt = `Synthesize high-fidelity cognitive intelligence based on the following documents:
  --- SOURCE --- 
  ${filesContent}`;

  try {
    const response = await withRetry(() => ai.models.generateContent({
      model: modelName,
      contents: prompt,
      config: {
        systemInstruction: `You are a Cognitive Brain Strategist. Provide grounded intelligence in JSON.`,
        responseMimeType: "application/json",
        responseSchema,
        temperature: context.temperature,
        thinkingConfig: { thinkingBudget: THINKING_LEVEL_MAP[context.thinkingLevel] }
      },
    }));
    return safeJsonParse(response.text || "{}") as AnalysisResult;
  } catch (error: any) { throw new Error(`Analysis Failed: ${error.message}`); }
}

export async function generateFollowUpQuestions(
  lastMessage: string,
  history: GPTMessage[],
  context?: string
): Promise<string[]> {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || process.env.API_KEY });
  const modelName = 'gemini-3-flash-preview';

  const historyStr = history.slice(-5).map(m => `${m.role.toUpperCase()}: ${m.content}`).join('\n\n');

  const prompt = `Based on the following AI response and the conversation history, generate 3 relevant, strategic follow-up questions that a user might want to ask to explore the topic deeper.
  
  CONVERSATION HISTORY:
  ${historyStr}
  
  LAST AI RESPONSE:
  ${lastMessage}
  
  ${context ? `STRATEGIC CONTEXT: ${context}` : ""}
  
  DIRECTIVES:
  1. The questions should be concise and high-impact.
  2. They should focus on strategic sales insights, ROI, risk, or implementation details.
  3. Return ONLY a JSON array of 3 strings.
  
  Example: ["How does this impact the TCO over 3 years?", "What are the primary integration risks?", "Can we see a case study for a similar scale?"]`;

  try {
    const response = await withRetry(() => ai.models.generateContent({
      model: modelName,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: { type: Type.STRING }
        }
      }
    }));
    return safeJsonParse(response.text || "[]");
  } catch (error) {
    console.error("Follow-up generation failed:", error);
    return [];
  }
}