export interface Citation {
  snippet: string;
  sourceFile: string;
  pageNumber?: number | string;
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
  category: 'Business Value' | 'Technical' | 'ROI' | 'Integration';
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
  id?: string;
  name: string;
  content: string;
  type: string;
  status: 'processing' | 'ready' | 'error' | 'ocr';
  category?: string;
  reasoning?: string;
}

export interface StoredDocument {
  id: string;
  name: string;
  content: string;
  timestamp: number;
  updatedAt?: number;
  type: string;
  folderId?: string; // ID of the folder it belongs to
  category?: string; // Predefined category name
  categorizationReasoning?: string; // AI's decision-making process
}

export interface Folder {
  id: string;
  name: string;
  userId: string;
  isCustom: boolean;
  timestamp: number;
  type?: 'main' | 'sub';
  parentId?: string | null;
}

export type CustomerPersonaType = 'Balanced' | 'Technical' | 'Financial' | 'Business Executives';

export type ThinkingLevel = 'Minimal' | 'Low' | 'Medium' | 'High';

export type DifficultyLevel = 'Easy' | 'Medium' | 'Hard';

export interface VocalPersonaStructure {
  pitch: string;
  tempo: string;
  cadence: string;
  accent: string;
  emotionalBaseline: string;
  breathingPatterns: string;
  mimicryDirective: string;
  baseVoice?: string;
  gender?: string;
  toneAdjectives?: string[];
  pace?: number;
  stability?: number;
  clarity?: number;
  pitchValue?: number;
}

export type VoiceMode = 'upload' | 'persona' | 'personality';

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
  clientsKeywords: string[];
  potentialObjections: string[];
  baseSystemPrompt: string;
  thinkingLevel: ThinkingLevel;
  temperature: number;
  kycDocId?: string;
  voiceMode: VoiceMode;
  selectedPersonaId?: string;
  selectedPersonalityId?: string;
  clonedVoiceBase64?: string;
  clonedVoiceMimeType?: string;
  vocalPersonaAnalysis?: VocalPersonaStructure;
  difficulty?: DifficultyLevel;
  simulationProtocol?: string;
}

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

export type QuestionType = 'quiz' | 'short' | 'long' | 'mic' | 'video';

export interface AssessmentQuestion {
  id: string;
  type: QuestionType;
  text: string;
  options?: string[];
  correctAnswer: string;
  explanation: string;
  hint?: string;
  citation?: Citation;
}

export interface BiometricTrace {
  stressLevel: number;
  attentionFocus: number;
  eyeContact: number;
  clarityScore: number;
  behavioralAudit: string;
}

export interface AssessmentEvaluation {
  score: number;
  feedback: string;
  isCorrect: boolean;
  toneResult?: string;
  bodyLanguageAdvice?: string;
  correctionSuggestions: string[];
  improvementPoints: string[];
  stressLevel?: number; // 0-100
  attentionScore?: number; // 0-100
  eyeContactScore?: number; // 0-100
  clarityScore?: number; // 0-100
  pitchScore?: number; // 0-100
  grammarScore?: number; // 0-100
  voiceToneScore?: number; // 0-100
  behavioralAnalysis?: string;
  modelDeliveryScript?: string;
}

export interface AssessmentResult {
  questionId: string;
  userAnswer: string;
  evaluation: AssessmentEvaluation;
  timeSpent: number;
}

export type GPTToolMode = 'standard' | 'pineapple' | 'deep-study' | 'cognitive' | 'cognitive-pro';

export interface GPTMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  mode: GPTToolMode;
  imageUrl?: string;
  isStreaming?: boolean;
  isError?: boolean;
  timestamp?: string;
  followUpQuestions?: string[];
  citations?: Citation[];
  selectedStyles?: string[];
  evaluation?: {
    logicDeficit?: string;
    idealResponse?: string;
    failReason?: string;
  };
}

export interface GroomingEvaluation {
  transcription: string;
  grammarScore: number;
  pacingScore: number;
  toneAnalysis: string;
  grammarFeedback: string;
  sentenceFormation: string;
  breathPacingGuide: string;
  strategicAlignment: string;
  idealWording: string;
  correctionExplanation: string;
  objectionHandlingSuggestions: string;
}

export type SimPersonaV2 = 'CIO' | 'CFO' | 'IT_DIRECTOR';

declare global {
  interface Window {
    aistudio: {
      hasSelectedApiKey: () => Promise<boolean>;
      openSelectKey: () => Promise<void>;
    };
    webkitAudioContext: typeof AudioContext;
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

export interface SimulationHistory {
  id: string;
  userId: string;
  type: 'avatar' | 'avatar2' | 'staged';
  timestamp: number;
  meetingContext: MeetingContext;
  messages: GPTMessage[];
  report?: ComprehensiveAvatarReport;
  biometrics?: BiometricTrace;
  score?: number;
}

export type StagedSimStage = 'Ice Breakers' | 'About Business' | 'Pricing' | 'Technical' | 'Legal' | 'Closing';

export interface SalesStrategy {
  executiveSummary: string;
  strategicPillars: Array<{
    title: string;
    description: string;
    tacticalActions: string[];
  }>;
  competitiveWedge: string;
  objectionDefense: Array<{
    objection: string;
    counterStrategy: string;
  }>;
  roadmap: Array<{
    phase: string;
    milestones: string[];
  }>;
}

export interface RoleplayQuestion {
  id: string;
  text: string;
  priority: 'High' | 'Medium' | 'Low';
  category: 'Financial' | 'Technical' | 'Strategic';
}

export interface RoleplayEvaluation {
  score: {
    confidence: number;
    clarity: number;
    relevance: number;
    persuasiveness: number;
    empathy: number;
  };
  feedback: string;
  strengths: string[];
  improvements: string[];
  suggestedNextSteps: string[];
}

export interface RoleplaySession {
  scenario: string;
  role: string;
  persona: string;
  focusArea: string;
  questions: RoleplayQuestion[];
  history: GPTMessage[];
  metrics: RoleplayEvaluation | null;
}

export interface SalesGPTSession {
  id: string;
  userId: string;
  title: string;
  timestamp: number;
  messages: GPTMessage[];
  isShared?: boolean;
  shareToken?: string;
}

export interface AppUpdate {
  id: string;
  title: string;
  description: string;
  detailedInfo: string;
  timestamp: number;
  isRead: boolean;
  version?: string;
}

export interface UserProfile {
  name: string;
  email: string;
  phone: string;
  photoURL: string;
  role: string;
  organization?: string;
}

export interface UserSecurity {
  mfaEnabled: boolean;
  mfaType?: 'email' | 'authenticator';
  lastLogin: number;
  sessions: Array<{
    id: string;
    device: string;
    lastActive: number;
    isCurrent: boolean;
  }>;
}

export interface UserPin {
  hashedPin: string;
  recoveryQuestion: string;
  recoveryAnswerHash: string;
  failedAttempts: number;
  isLocked: boolean;
}

export interface UserIntegrations {
  googleDrive: {
    connected: boolean;
    lastSync?: number;
  };
  googleCalendar: {
    connected: boolean;
    lastSync?: number;
  };
}

export interface UserPreferences {
  notifications: {
    email: boolean;
    inApp: boolean;
    onSimulationComplete: boolean;
    onNewRecommendations: boolean;
    onErrors: boolean;
  };
  defaultWorkspace: 'simulation' | 'grooming' | 'testing';
  experimentalFeatures: boolean;
}

export interface UserPrivacy {
  dataSharing: boolean;
  consentTimestamp: number;
  acceptedTerms?: boolean;
  acceptedPrivacyPolicy?: boolean;
  neuralPrivacyAccepted?: boolean;
}

export interface ActivityLog {
  id: string;
  type: 'simulation' | 'upload' | 'login' | 'security' | 'integration';
  action: string;
  timestamp: number;
  details?: string;
}

export interface UserSettings {
  profile: UserProfile;
  security: UserSecurity;
  pin: UserPin;
  integrations: UserIntegrations;
  preferences: UserPreferences;
  privacy: UserPrivacy;
}

export interface CalendarEvent {
  id: string;
  summary: string;
  start: {
    dateTime?: string;
    date?: string;
  };
  location?: string;
  description?: string;
}
