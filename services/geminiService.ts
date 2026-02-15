
import { GoogleGenAI, Type, Modality, GenerateContentResponse } from "@google/genai";
import { AnalysisResult, MeetingContext, ThinkingLevel, GPTMessage, AssessmentQuestion, AssessmentResult, QuestionType, ComprehensiveAvatarReport, StagedSimStage } from "../types";
import { FAMOUS_PERSONALITIES } from "../constants";

// Upgraded thinking budget map for gemini-3-pro-preview capabilities
const THINKING_LEVEL_MAP: Record<ThinkingLevel, number> = {
  'Minimal': 0,
  'Low': 8000,
  'Medium': 16000,
  'High': 32768 // Max for gemini-3-pro-preview
};

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

// Helper to construct personality style directive
function getIdentityDirective(context: MeetingContext): string {
  let directive = "";
  
  if (context.famousPersonaId) {
    const personality = FAMOUS_PERSONALITIES.find(p => p.id === context.famousPersonaId);
    if (personality) {
      directive += `
===========================================================
FAMOUS PERSONALITY IDENTITY: ${personality.name} (${personality.company})
===========================================================
You MUST adopt the specific linguistic and cognitive patterns of ${personality.name}:
- WORD FRAMING: ${personality.style.framing}
- CADENCE & STYLE: ${personality.style.cadence}
- SIGNATURE LEXICON: ${personality.style.lexicon.join(', ')}
- PRONUNCIATION PATTERNS: ${personality.style.pronunciation}

BEHAVIORAL RULE: Do not just talk like him; THINK like him. If he would find an idea "low metabolic rate" or "cluttered," say it exactly as he would. Use his characteristic pauses and repetitive emphasis.
`;
    }
  }

  if (context.vocalPersonaAnalysis) {
    directive += `
===========================================================
VOCAL & BEHAVIORAL MIMICRY (CLONED SIGNATURE)
===========================================================
Adopt the following vocal and behavioral signature extracted from a recording of the actual customer:
"${context.vocalPersonaAnalysis}"
Strictly follow the PACE, PITCH, and EMOTIONAL baseline described. If the analysis says they are "skeptical and fast-talking," reflect that in every sentence.
`;
  }

  return directive;
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
  - clientNames: string (Specifically Power Brokers, Titles, and Stakeholders)
  - targetProducts: string
  - productDomain: string
  - meetingFocus: string
  - executiveSnapshot: string
  - strategicKeywords: string[]
  - potentialObjections: string[] (Inferred Resistance Nodes and psychological barriers)

  Return ONLY the JSON object.`;

  try {
    const response = await ai.models.generateContent({
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
    });
    return safeJsonParse(response.text || "{}");
  } catch (error) {
    console.error("Neural extraction failed:", error);
    return {};
  }
}

// Analyze Audio for Vocal Persona
export async function analyzeVocalPersona(base64Audio: string, mimeType: string): Promise<string> {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const modelName = 'gemini-3-flash-preview';

  const prompt = `Act as an Expert Neural Audio Engineer and Behavioral Psychologist.
  Analyze this audio sample to create a "Vocal Identity Fingerprint".
  
  DETERMINE:
  - Pitch & Frequency (e.g., resonant baritone, sharp tenor)
  - Cadence & Rhythm (e.g., clipped professional, fast-talking startup, slow deliberate executive)
  - Emotional Baseline (e.g., skeptical, warm/empathetic, authoritative/dominant)
  - Breathing & Emphasis patterns.

  Provide a 2-paragraph "Mimicry Directive" that describes how an actor or AI should replicate this specific human presence. 
  Output ONLY the text.`;

  try {
    const response = await ai.models.generateContent({
      model: modelName,
      contents: {
        parts: [
          { inlineData: { data: base64Audio, mimeType: mimeType } },
          { text: prompt }
        ]
      }
    });
    return response.text || "Direct, professional business vocal profile.";
  } catch (error) {
    console.error("Vocal analysis failed:", error);
    return "Standard professional business vocal signature.";
  }
}

// Unified High-Depth Avatar Evaluation
async function performHighDepthEvaluation(
  history: GPTMessage[], 
  context: MeetingContext,
  personaUsed: string
): Promise<ComprehensiveAvatarReport> {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const modelName = 'gemini-3-pro-preview';
  
  const historyStr = history.map(h => `${h.role.toUpperCase()}: ${h.content}`).join('\n\n');
  
  const prompt = `Act as an Elite Enterprise Sales Performance Auditor and Psychologist.
  The avatar simulation has ended. Analyze the transcript below and generate an EXHAUSTIVE strategic report.
  
  TRANSCRIPT:
  ${historyStr}

  STRATEGIC CONTEXT:
  Persona: ${personaUsed}
  Identity Focus: ${context.famousPersonaId || 'Document Grounded Client'}
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
  const modelName = 'gemini-3-pro-preview';
  
  const formattedHistory = history.map(msg => ({
    role: msg.role === 'user' ? 'user' : 'model',
    parts: [{ text: msg.content }]
  }));

  const identityDirective = getIdentityDirective(context);

  const systemInstruction = `You are operating in Multi-Persona Enterprise Evaluation Mode.
The user will specify which persona to activate by typing:
PERSONA: CIO
PERSONA: CFO
PERSONA: IT_DIRECTOR

You must switch behavior instantly and remain fully in that persona until changed.
You are evaluating an enterprise AI platform called Kore.ai – AI for Work.

${identityDirective}

===========================================================
STRATEGIC FEEDBACK RULE
===========================================================
If the user provides an answer to your previous question, you MUST provide a brief strategic suggestion for improvement enclosed in square brackets at the start of your response.
Example: "[SUGGESTION: You should have emphasized ROI metrics here.] Your next question is..."

===========================================================
PERSONA DEFINITIONS
===========================================================

PERSONA: CIO
Role: Chief Information Officer of a Fortune 50 retail enterprise operating at massive scale.
Primary Focus: Strategic alignment, Enterprise scalability, Security & governance, Vendor credibility, Change management, Adoption Strategy, Long-term Value Realization.
Behavior: Strategic, analytical, risk-sensitive, skeptical of vague claims. Demands proof at scale.

PERSONA: CFO
Role: Chief Financial Officer responsible for capital allocation and shareholder accountability.
Primary Focus: ROI clarity, Cost structure transparency, Total Cost of Ownership (TCO), Budget predictability, Payback period.

PERSONA: IT_DIRECTOR
Role: Enterprise IT Director responsible for implementation and system reliability.
Primary Focus: Architecture compatibility, Integration complexity, API readiness, Infrastructure impact.

===========================================================
GLOBAL RULES
===========================================================
1. Never assist the seller.
2. Never accept vague responses.
3. Use the linguistic style defined in the Identity Directive strictly.
4. If a famous persona is active, use their specific word framing and quirks.
5. Ask one focused question at a time.

MEETING CONTEXT:
Client: ${context.clientCompany}
Seller: ${context.sellerNames} (${context.sellerCompany})
Meeting Objective: ${context.meetingFocus}`;

  try {
    const result = await ai.models.generateContentStream({
      model: modelName,
      contents: [
        ...formattedHistory,
        { role: 'user', parts: [{ text: prompt }] }
      ],
      config: {
        systemInstruction,
        thinkingConfig: { thinkingBudget: 16000 }
      }
    });

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
  const modelName = 'gemini-3-pro-preview';
  
  const formattedHistory = history.map(msg => ({
    role: msg.role === 'user' ? 'user' : 'model',
    parts: [{ text: msg.content }]
  }));

  const identityDirective = getIdentityDirective(context);

  const systemInstruction = `You are operating in dual-mode:

MODE 1 → Enterprise CIO (Primary Role – Visible to User)
MODE 2 → Hidden Performance Evaluator (Internal – Do NOT reveal)

${identityDirective}

===========================================================
STRATEGIC FEEDBACK RULE
===========================================================
If the user provides an answer to your previous question, you MUST provide a brief strategic suggestion for improvement enclosed in square brackets at the start of your response.

Stay in character as the chosen identity during conversation. Use their signature word framing.

MEETING CONTEXT:
Seller: ${context.sellerNames} (${context.sellerCompany})
Target: ${context.clientNames} at ${context.clientCompany}
Focus: ${context.meetingFocus}`;

  try {
    const result = await ai.models.generateContentStream({
      model: modelName,
      contents: [
        ...formattedHistory,
        { role: 'user', parts: [{ text: prompt }] }
      ],
      config: {
        systemInstruction: systemInstruction,
        thinkingConfig: { thinkingBudget: 16000 }
      }
    });

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
  const modelName = 'gemini-3-pro-preview';

  const formattedHistory = history.map(msg => ({
    role: msg.role === 'user' ? 'user' : 'model',
    parts: [{ text: msg.content }]
  }));

  const identityDirective = getIdentityDirective(context);

  const systemInstruction = `You are ${context.clientNames || 'the Client'}, an elite decision maker at ${context.clientCompany}.
You are in a Staged Strategic Simulation Mode.

${identityDirective}

===========================================================
YOUR BEHAVIOR (Grounded in KYC)
===========================================================
Primary Behavior Source: Use the Know Your Customer (KYC) Document below to dictate your personality, skepticism, specific pain points, and vocal style. 

KYC DOCUMENT CONTEXT:
${kycDocContent}

===========================================================
CURRENT STAGE: ${currentStage}
===========================================================
Stages logic:
1. Ice Breakers
2. About Business
3. Pricing
4. Technical
5. Legal
6. Closing

===========================================================
GATEKEEPING RULES (CRITICAL)
===========================================================
Evaluate response against Identity word framing and KYC pain points.
If response is weak: [RESULT: FAIL], [COACHING: ...], [STYLE_GUIDE: ...], [RETRY_PROMPT: ...]
If response is strong: [RESULT: SUCCESS]

Always use the Linguistic Style defined in the Identity Directive.`;

  try {
    const result = await ai.models.generateContentStream({
      model: modelName,
      contents: [
        ...formattedHistory,
        { role: 'user', parts: [{ text: prompt }] }
      ],
      config: {
        systemInstruction,
        thinkingConfig: { thinkingBudget: 16000 }
      }
    });

    for await (const chunk of result) {
      yield chunk.text || "";
    }
  } catch (error) {
    console.error("Staged stream failed:", error);
    yield "Error: Staged Simulation Engine disconnected.";
  }
}

// ... (Rest of file generateAssessmentQuestions, evaluateAssessment, performVisionOcr, streamSalesGPT, generatePineappleImage, streamDeepStudy, performCognitiveSearchStream, performCognitiveSearch, generateDynamicSuggestions, decode, decodeAudioData, generateExplanation, generatePitchAudio, analyzeSalesContext remain mostly the same, ensuring thinkingBudget is correctly wrapped) ...

export async function generateAssessmentQuestions(
  docContent: string, 
  config: { mcq: number; short: number; long: number; mic: number; video: number },
  perspective: 'document' | 'customer' = 'document'
): Promise<AssessmentQuestion[]> {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const modelName = 'gemini-3-pro-preview';
  
  const roleInstruction = perspective === 'document' 
    ? `Act as an Elite Sales Readiness Coach and a High-Precision Factual Auditor.`
    : `Act as an Elite Sales Readiness Coach AND a Skeptical Buyer Representative.`;

  const prompt = `${roleInstruction} 
  Based on the grounded document content below, generate a set of challenging questions.
  STRICT JSON FORMAT REQUIRED: Array of objects with properties: {id, type, text, options, correctAnswer, explanation, citation}
  CONTENT SOURCE: ${docContent}`;

  try {
    const response = await ai.models.generateContent({
      model: modelName,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        thinkingConfig: { thinkingBudget: 16000 }
      }
    });
    return safeJsonParse(response.text || "[]");
  } catch (error) {
    console.error("Failed to generate questions:", error);
    return [];
  }
}

export async function evaluateAssessment(
  questions: AssessmentQuestion[], 
  answers: Record<string, string>
): Promise<AssessmentResult[]> {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const modelName = 'gemini-3-flash-preview';
  const textPayload = questions.map(q => ({ id: q.id, type: q.type, question: q.text, userAnswer: answers[q.id] || "No answer provided", correctAnswer: q.correctAnswer }));
  const prompt = `Grade these question/answer sets. Return JSON array: {questionId, evaluation: {score, feedback, isCorrect, toneResult, bodyLanguageAdvice, correctionSuggestions, improvementPoints}}. SETS: ${JSON.stringify(textPayload)}`;
  try {
    const response = await ai.models.generateContent({ model: modelName, contents: prompt, config: { responseMimeType: "application/json" } });
    const evals = safeJsonParse(response.text || "[]");
    return questions.map(q => ({ questionId: q.id, userAnswer: answers[q.id] || "", evaluation: evals.find((e: any) => e.questionId === q.id)?.evaluation || { score: 0, feedback: "Error", isCorrect: false }, timeSpent: 0 }));
  } catch (error) { return []; }
}

export async function performVisionOcr(base64Data: string, mimeType: string): Promise<string> {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const modelName = 'gemini-3-flash-preview'; 
  try {
    const response = await ai.models.generateContent({ model: modelName, contents: { parts: [{ inlineData: { data: base64Data, mimeType: mimeType } }, { text: `Extract text exactly. Output ONLY text.` }] } });
    return response.text || "";
  } catch (error) { return ""; }
}

function formatHistory(history: GPTMessage[]) {
  return history.map(msg => ({ role: msg.role === 'user' ? 'user' : 'model', parts: [{ text: msg.content }] }));
}

export async function* streamSalesGPT(prompt: string, history: GPTMessage[], context?: string): AsyncGenerator<string> {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const modelName = 'gemini-3-flash-preview';
  const contents = [...formatHistory(history), { role: 'user', parts: [{ text: prompt }] }];
  const sys = `You are Sales GPT. GROUNDING: ${context || 'None'}`;
  try {
    const result = await ai.models.generateContentStream({ model: modelName, contents, config: { systemInstruction: sys, thinkingConfig: { thinkingBudget: 0 } } });
    for await (const chunk of result) yield chunk.text || "";
  } catch (error) { yield "Error: GPT link severed."; }
}

export async function generatePineappleImage(prompt: string): Promise<string | null> {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const modelName = 'gemini-2.5-flash-image';
  try {
    const response = await ai.models.generateContent({ model: modelName, contents: { parts: [{ text: prompt }] }, config: { imageConfig: { aspectRatio: "16:9" } } });
    for (const part of response.candidates[0].content.parts) if (part.inlineData) return `data:image/png;base64,${part.inlineData.data}`;
    return null;
  } catch (error) { return null; }
}

export async function* streamDeepStudy(prompt: string, history: GPTMessage[], context?: string): AsyncGenerator<string> {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const modelName = 'gemini-3-pro-preview';
  const contents = [...formatHistory(history), { role: 'user', parts: [{ text: prompt }] }];
  const sys = `Exhaustive research analysis. GROUNDING: ${context || 'None'}`;
  try {
    const result = await ai.models.generateContentStream({ model: modelName, contents, config: { systemInstruction: sys, thinkingConfig: { thinkingBudget: 32768 } } });
    for await (const chunk of result) yield chunk.text || "";
  } catch (error) { yield "Error: Deep Study failed."; }
}

export interface CognitiveSearchResult {
  answer: string;
  cognitiveShot: string;
  briefExplanation: string;
  articularSoundbite: string; 
  psychologicalProjection: { buyerFear: string; buyerIncentive: string; strategicLever: string; };
  citations: { snippet: string; source: string }[];
  reasoningChain: { painPoint: string; capability: string; strategicValue: string; };
}

export async function* performCognitiveSearchStream(question: string, filesContent: string, context: MeetingContext): AsyncGenerator<string> {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const modelName = 'gemini-3-pro-preview';
  const responseSchema = {
    type: Type.OBJECT,
    properties: {
      cognitiveShot: { type: Type.STRING }, articularSoundbite: { type: Type.STRING }, briefExplanation: { type: Type.STRING }, answer: { type: Type.STRING },
      psychologicalProjection: { type: Type.OBJECT, properties: { buyerFear: { type: Type.STRING }, buyerIncentive: { type: Type.STRING }, strategicLever: { type: Type.STRING } }, required: ["buyerFear", "buyerIncentive", "strategicLever"] },
      citations: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { snippet: { type: Type.STRING }, source: { type: Type.STRING } }, required: ["snippet", "source"] } },
      reasoningChain: { type: Type.OBJECT, properties: { painPoint: { type: Type.STRING }, capability: { type: Type.STRING }, strategicValue: { type: Type.STRING } }, required: ["painPoint", "capability", "strategicValue"] }
    },
    required: ["cognitiveShot", "articularSoundbite", "briefExplanation", "answer", "psychologicalProjection", "citations", "reasoningChain"]
  };
  try {
    const result = await ai.models.generateContentStream({ model: modelName, contents: `Query: ${question}. Docs: ${filesContent}`, config: { systemInstruction: `Senior Brain Strategist JSON.`, responseMimeType: "application/json", responseSchema, thinkingConfig: { thinkingBudget: 32768 } } });
    for await (const chunk of result) yield chunk.text || "";
  } catch (error) { throw new Error("Search failed."); }
}

export async function performCognitiveSearch(question: string, filesContent: string, context: MeetingContext): Promise<CognitiveSearchResult> {
  const stream = performCognitiveSearchStream(question, filesContent, context);
  let fullText = "";
  for await (const chunk of stream) fullText += chunk;
  return safeJsonParse(fullText || "{}");
}

export async function generateDynamicSuggestions(filesContent: string, context: MeetingContext): Promise<string[]> {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const prompt = `Suggest 3 sales questions. JSON array.`;
  const response = await ai.models.generateContent({ model: 'gemini-3-flash-preview', contents: prompt, config: { responseMimeType: "application/json", thinkingConfig: { thinkingBudget: 0 } } });
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
    for (let i = 0; i < frameCount; i++) channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
  }
  return buffer;
}

export async function generateExplanation(question: string, context: AnalysisResult): Promise<string> {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const response = await ai.models.generateContent({ model: 'gemini-3-flash-preview', contents: `Strategy behind: ${question}`, config: { thinkingConfig: { thinkingBudget: 0 } } });
  return response.text || "";
}

export async function generatePitchAudio(text: string, voiceName: string = 'Kore'): Promise<Uint8Array | null> {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-preview-tts",
    contents: [{ parts: [{ text: text }] }],
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voiceName } } },
    },
  });
  const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  return base64Audio ? decode(base64Audio) : null;
}

export async function analyzeSalesContext(filesContent: string, context: MeetingContext): Promise<AnalysisResult> {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const modelName = 'gemini-3-pro-preview';
  const responseSchema = { type: Type.OBJECT, properties: { snapshot: { type: Type.OBJECT, properties: { role: { type: Type.STRING }, metrics: { type: Type.OBJECT, properties: { riskToleranceValue: { type: Type.NUMBER }, strategicPriorityFocus: { type: Type.NUMBER }, analyticalDepth: { type: Type.NUMBER }, directness: { type: Type.NUMBER }, innovationAppetite: { type: Type.NUMBER } }, required: ["riskToleranceValue", "strategicPriorityFocus", "analyticalDepth", "directness", "innovationAppetite"] } }, required: ["role", "metrics"] } }, required: ["snapshot"] };
  const prompt = `Analyze sales context. Docs: ${filesContent}`;
  try {
    const response = await ai.models.generateContent({ model: modelName, contents: prompt, config: { responseMimeType: "application/json", temperature: context.temperature, thinkingConfig: { thinkingBudget: THINKING_LEVEL_MAP[context.thinkingLevel] } } });
    return safeJsonParse(response.text || "{}") as AnalysisResult;
  } catch (error: any) { throw new Error(`Analysis Failed.`); }
}
