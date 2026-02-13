
import { GoogleGenAI, Type, Modality, GenerateContentResponse } from "@google/genai";
import { AnalysisResult, MeetingContext, ThinkingLevel, GPTMessage, AssessmentQuestion, AssessmentResult, QuestionType, ComprehensiveAvatarReport } from "../types";

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

  const systemInstruction = `You are operating in Multi-Persona Enterprise Evaluation Mode.
The user will specify which persona to activate by typing:
PERSONA: CIO
PERSONA: CFO
PERSONA: IT_DIRECTOR

You must switch behavior instantly and remain fully in that persona until changed.
You are evaluating an enterprise AI platform called Kore.ai – AI for Work.
You are conducting a serious enterprise buying evaluation.

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

  const systemInstruction = `You are operating in dual-mode:

MODE 1 → Enterprise CIO (Primary Role – Visible to User)
MODE 2 → Hidden Performance Evaluator (Internal – Do NOT reveal)

===========================================================
STRATEGIC FEEDBACK RULE
===========================================================
If the user provides an answer to your previous question, you MUST provide a brief strategic suggestion for improvement enclosed in square brackets at the start of your response.
Example: "[SUGGESTION: Instead of technical jargon, focus on the business outcome.] Your next question is..."

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

// Generate Assessment Questions
export async function generateAssessmentQuestions(
  docContent: string, 
  config: { mcq: number; short: number; long: number; mic: number; video: number },
  perspective: 'document' | 'customer' = 'document'
): Promise<AssessmentQuestion[]> {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const modelName = 'gemini-3-pro-preview';
  
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
    "explanation": "Brief coaching explanation explaining the strategic significance of this question.",
    "citation": { "snippet": "exact quote from text or derived context", "sourceFile": "filename or 'Document Context'" }
  }
  
  CONTENT SOURCE:
  ${docContent}`;

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
    - For Video specifically: Include "bodyLanguageAdvice" inferred from phrasing density and filler word count.

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
      "improvementPoints": ["Impact point 1", "Impact point 2"]
    }
  }
  
  SETS:
  ${JSON.stringify(textPayload)}`;

  try {
    const response = await ai.models.generateContent({
      model: modelName,
      contents: prompt,
      config: { responseMimeType: "application/json" }
    });
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
    const response = await ai.models.generateContent({
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
    });
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

  const systemInstruction = `You are Sales GPT, an elite sales intelligence agent. 
  
  CORE MISSION: Provide high-impact sales intelligence.
  
  GROUNDING RULES:
  1. If GROUNDING DATA is provided below, prioritize it. 
  2. If the user's question relates to specific data in the documents, use that data and cite the source.
  3. If the question is general or the data isn't in the docs, do NOT refuse to answer. Instead, use your world-class general knowledge to provide a strategic, authoritative response.
  
  STYLE: Direct, authoritative, and strategic. No fluff.
  
  ${context ? `--- DOCUMENT GROUNDING DATA ---
  ${context}
  -----------------------` : ""}`;

  try {
    const result = await ai.models.generateContentStream({
      model: modelName,
      contents: contents,
      config: {
        systemInstruction: systemInstruction,
        thinkingConfig: { thinkingBudget: 0 }
      }
    });

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
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const modelName = 'gemini-2.5-flash-image';
  try {
    const strategicPrompt = `Create a high-fidelity, enterprise-grade strategic visual asset for: "${prompt}". 
    The style should be a modern 3D render, minimalist, with soft cinematic lighting and a professional color palette. 
    Avoid cluttered details. Ensure it looks like a slide from a top-tier executive presentation.`;

    const response = await ai.models.generateContent({
      model: modelName,
      contents: {
        parts: [{ text: strategicPrompt }],
      },
      config: {
        imageConfig: { aspectRatio: "16:9" }
      }
    });

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

// Deep Study: Advanced Reasoning Core upgraded to Pro model
export async function* streamDeepStudy(prompt: string, history: GPTMessage[], context?: string): AsyncGenerator<string> {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  // Using gemini-3-pro-preview for complex reasoning tasks
  const modelName = 'gemini-3-pro-preview';
  
  const contents = [
    ...formatHistory(history),
    { role: 'user', parts: [{ text: prompt }] }
  ];

  const systemInstruction = `You are a world-class Strategic Research Lead performing a "Deep Study".
  
  MISSION: Conduct an exhaustive, multi-layered analysis that goes far beyond obvious observations.
  
  ANALYTICAL LAYERS:
  1. DOCUMENT SYNTHESIS: Extract specific strategic pillars from the grounded context provided.
  2. OUT-OF-THE-BOX THINKING: Infuse creative, non-obvious sales maneuvers and global market trends.
  3. CUSTOMER PSYCHOLOGY: Analyze the situation from the CUSTOMER'S point of view (their fears, personal incentives, and organizational pressures).
  4. STRATEGIC ROADMAP: Provide a step-by-step execution plan for the salesperson.
  
  STYLE: Exhaustive, professional, academic but actionable.
  
  ${context ? `--- GROUNDED DOCUMENT CONTEXT ---
  ${context}
  -----------------------` : ""}
  
  Use the maximum thinking budget to find hidden connections.`;

  try {
    const result = await ai.models.generateContentStream({
      model: modelName,
      contents: contents,
      config: {
        systemInstruction: systemInstruction,
        thinkingConfig: { thinkingBudget: 32768 }
      }
    });

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
  citations: { snippet: string; source: string }[];
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
  // Using gemini-3-pro-preview for advanced reasoning and complex query synthesis
  const modelName = 'gemini-3-pro-preview';
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
            source: { type: Type.STRING }
          },
          required: ["snippet", "source"]
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
    const result = await ai.models.generateContentStream({
      model: modelName,
      contents: prompt,
      config: {
        systemInstruction: `You are a Senior Cognitive Brain Strategist. Provide technical rigor and grounded depth in JSON.`,
        responseMimeType: "application/json",
        responseSchema,
        thinkingConfig: { thinkingBudget: 32768 }
      }
    });

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
  const response = await ai.models.generateContent({ 
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
  });
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
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Explain the deep sales strategy behind: "${question}" based on the buyer snapshot: ${JSON.stringify(context.snapshot)}.`,
    config: { thinkingConfig: { thinkingBudget: 0 } }
  });
  return response.text || "";
}

// Text to speech generation using specialized TTS model
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

// Full Context Analysis upgraded to Pro model for comprehensive reasoning
export async function analyzeSalesContext(filesContent: string, context: MeetingContext): Promise<AnalysisResult> {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  // Using gemini-3-pro-preview for exhaustive material synthesis and competitive intelligence
  const modelName = 'gemini-3-pro-preview';
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
    const response = await ai.models.generateContent({
      model: modelName,
      contents: prompt,
      config: {
        systemInstruction: `You are a Cognitive Brain Strategist. Provide grounded intelligence in JSON.`,
        responseMimeType: "application/json",
        responseSchema,
        temperature: context.temperature,
        thinkingConfig: { thinkingBudget: THINKING_LEVEL_MAP[context.thinkingLevel] }
      },
    });
    return safeJsonParse(response.text || "{}") as AnalysisResult;
  } catch (error: any) { throw new Error(`Analysis Failed: ${error.message}`); }
}
