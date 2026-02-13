
export interface Citation {
  snippet: string;
  sourceFile: string;
}

export interface PriorityItem {
  text: string;
  citation: Citation;
}

export interface ObjectionItem {
  text: string;
  citation: Citation;
}

export interface DocumentEntity {
  name: string;
  type: string; // 'Person', 'Company', 'Metric', 'Date'
  context: string;
  citation: Citation;
}

export interface DocumentStructure {
  sections: string[];
  keyHeadings: string[];
  detectedTablesSummary: string;
}

export interface DocumentSummary {
  fileName: string;
  summary: string;
  strategicImpact: string;
  criticalInsights: string[];
}

export interface CompetitorInsight {
  name: string;
  overview: string;
  threatProfile: 'Direct' | 'Indirect' | 'Niche';
  strengths: string[];
  weaknesses: string[];
  opportunities: string[]; 
  threats: string[]; 
  ourWedge: string;
  citation: Citation;
}

export interface BuyerSnapshot {
  role: string;
  roleCitation: Citation;
  roleConfidence: number;
  priorities: PriorityItem[];
  likelyObjections: ObjectionItem[];
  decisionStyle: string;
  decisionStyleCitation: Citation;
  riskTolerance: string;
  riskToleranceCitation: Citation;
  tone: string;
  metrics: {
    riskToleranceValue: number;
    strategicPriorityFocus: number;
    analyticalDepth: number;
    directness: number;
    innovationAppetite: number;
  };
  personaIdentity: string;
  decisionLogic: string;
}

export interface QuestionPair {
  customerAsks: string;
  salespersonShouldRespond: string;
  reasoning: string;
  category: 'Business Value' | 'Technical' | 'Risk' | 'ROI' | 'Integration';
  citation: Citation;
}

export interface ObjectionPair {
  objection: string;
  realMeaning: string;
  strategy: string;
  exactWording: string;
  empathyTip: string;
  valueTip: string;
  citation: Citation;
}

export interface StrategicQuestion {
  question: string;
  whyItMatters: string;
  citation: Citation;
}

export interface OpeningLine {
  text: string;
  label: string;
  citation: Citation;
}

export interface MatrixItem {
  category: string;
  observation: string;
  significance: string;
  evidence: Citation;
}

export interface AnalysisResult {
  snapshot: BuyerSnapshot;
  documentInsights: {
    entities: DocumentEntity[];
    structure: DocumentStructure;
    summaries: DocumentSummary[];
    materialSynthesis: string;
  };
  groundMatrix: MatrixItem[];
  competitiveHub: {
    cognigy: CompetitorInsight;
    amelia: CompetitorInsight;
    others: CompetitorInsight[];
  };
  openingLines: OpeningLine[];
  predictedQuestions: QuestionPair[];
  strategicQuestionsToAsk: StrategicQuestion[];
  objectionHandling: ObjectionPair[];
  toneGuidance: {
    wordsToUse: string[];
    wordsToAvoid: string[];
    sentenceLength: string;
    technicalDepth: string;
  };
  finalCoaching: {
    dos: string[];
    donts: string[];
    finalAdvice: string;
  };
  reportSections: {
    introBackground: string;
    technicalDiscussion: string;
    productIntegration: string;
  };
}

export interface UploadedFile {
  name: string;
  content: string;
  type: string;
  status: 'processing' | 'ready' | 'error' | 'ocr';
}

export interface StoredDocument {
  id: string;
  name: string;
  content: string;
  timestamp: number;
  updatedAt?: number;
  type: string;
}

export type CustomerPersonaType = 'Balanced' | 'Technical' | 'Financial' | 'Business Executives';

export type ThinkingLevel = 'Minimal' | 'Low' | 'Medium' | 'High';

export interface MeetingContext {
  sellerCompany: string;
  sellerNames: string;
  clientCompany: string;
  clientNames: string;
  targetProducts: string;
  productDomain: string;
  meetingFocus: string;
  persona: CustomerPersonaType;
  answerStyles: string[];
  executiveSnapshot: string;
  strategicKeywords: string[];
  baseSystemPrompt: string;
  thinkingLevel: ThinkingLevel;
  temperature: number;
  kycDocId?: string;
}

// Comprehensive Simulation Report Structure
export interface ComprehensiveAvatarReport {
  persona_used: string;
  conversation_summary: {
    main_themes: string[];
    decisions_reached: string[];
    inflection_points: string[];
  };
  sentiment_analysis: {
    trend: 'positive' | 'neutral' | 'skeptical';
    narrative: string;
    emotional_shifts: Array<{ point: string; shift: string }>;
  };
  objection_mapping: Array<{
    objection: string;
    handled_effectively: boolean;
    quality_score: number;
    coaching_note: string;
    suggested_alternative: string;
  }>;
  value_alignment_score: number;
  confidence_clarity_analysis: {
    score: number;
    narrative: string;
  };
  roi_strength_score: number;
  risk_signals: string[];
  trust_signals: string[];
  missed_opportunities: string[];
  deal_readiness_score: number;
  next_step_likelihood: 'low' | 'medium' | 'high';
  coaching_recommendations: string[];
}

// Assessment Lab Types
export type QuestionType = 'mcq' | 'short' | 'long' | 'mic' | 'video';

export interface AssessmentQuestion {
  id: string;
  type: QuestionType;
  text: string;
  options?: string[]; // Only for MCQ
  correctAnswer: string;
  explanation: string;
  citation?: Citation; // Grounded evidence for the answer
}

export interface AssessmentEvaluation {
  score: number;
  feedback: string;
  isCorrect: boolean;
  toneResult?: string; // Specific for mic/video
  bodyLanguageAdvice?: string; // Specific for video
  correctionSuggestions: string[]; // Specific points to fix
  improvementPoints: string[]; // How to improve further
}

export interface AssessmentResult {
  questionId: string;
  userAnswer: string;
  evaluation: AssessmentEvaluation;
  timeSpent: number; // Seconds spent on this specific question
}

// Sales GPT Types
export type GPTToolMode = 'standard' | 'pineapple' | 'deep-study' | 'cognitive';

export interface GPTMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  mode: GPTToolMode;
  imageUrl?: string;
  isStreaming?: boolean;
}

export interface GroomingEvaluation {
  transcription: string;
  grammarScore: number;
  toneAnalysis: string;
  grammarFeedback: string;
  sentenceFormation: string;
  breathPacingGuide: string;
  strategicAlignment: string;
  idealWording: string;
  correctionExplanation: string;
}

// Avatar Simulation 2.0 Types
export type SimPersonaV2 = 'CIO' | 'CFO' | 'IT_DIRECTOR';

export type StagedSimStage = 'Ice Breakers' | 'About Business' | 'Pricing' | 'Technical' | 'Legal' | 'Closing';
