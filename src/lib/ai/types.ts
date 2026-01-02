/**
 * AI Provider Types for Grade-Math
 *
 * Unified types for multi-provider AI grading system
 */

// Supported AI providers
export type AIProviderName = 'groq' | 'openai' | 'anthropic';

// Provider configuration
export interface AIProviderConfig {
  name: AIProviderName;
  apiKey: string;
  model: string;
  maxTokens?: number;
  temperature?: number;
  timeout?: number; // ms
}

// Image input for vision models
export interface ImageInput {
  type: 'base64' | 'url';
  data: string; // base64 string or URL
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif';
}

// Grading request
export interface GradingRequest {
  submissionId: string;
  image: ImageInput;
  answerKey: AnswerKeyData;
  options?: GradingOptions;
}

// Answer key structure
export interface AnswerKeyData {
  type: 'manual' | 'image';
  totalQuestions: number;
  answers: AnswerKeyEntry[];
  pointsPerQuestion?: number;
}

export interface AnswerKeyEntry {
  questionNumber: number;
  correctAnswer: string;
  alternateAnswers?: string[]; // Accept multiple correct forms
  points?: number;
  partialCreditRules?: PartialCreditRule[];
}

export interface PartialCreditRule {
  pattern: string; // Regex or substring to match
  points: number;
  feedback: string;
}

// Grading options
export interface GradingOptions {
  generateFeedback?: boolean;
  extractStudentName?: boolean;
  strictMatching?: boolean; // Exact match vs fuzzy
  language?: string;
}

// Individual question result
export interface QuestionResult {
  questionNumber: number;
  problemText?: string; // The math problem as written
  aiCalculation?: string; // AI's step-by-step calculation
  aiAnswer?: string; // AI's calculated answer
  studentAnswer: string | null;
  correctAnswer: string; // Final correct answer (AI answer or answer key)
  answerKeyValue?: string | null; // What the answer key says (if provided)
  isCorrect: boolean;
  pointsAwarded: number;
  pointsPossible: number;
  confidence: number; // 0-1 grading confidence
  readabilityConfidence?: number; // 0-1 how clearly the handwriting was read
  readabilityIssue?: string | null; // Description of reading difficulties
  feedback?: string;
  partialCredit?: boolean;
  discrepancy?: string | null; // If AI answer differs from answer key
}

// Overall grading result
export interface GradingResult {
  submissionId: string;
  success: boolean;

  // Score data
  totalScore: number;
  totalPossible: number;
  percentage: number;

  // Question-level results
  questions: QuestionResult[];

  // Extracted data
  detectedStudentName?: string;
  nameConfidence?: number;

  // Metadata
  provider: AIProviderName;
  model: string;
  processingTimeMs: number;
  tokensUsed?: number;

  // Errors
  error?: string;
  needsReview?: boolean;
  reviewReason?: string;
}

// Provider response (raw)
export interface AIProviderResponse {
  success: boolean;
  content: string;
  tokensUsed?: {
    input: number;
    output: number;
    total: number;
  };
  error?: string;
  latencyMs: number;
}

// Provider interface
export interface AIProvider {
  name: AIProviderName;

  // Check if provider is available/configured
  isAvailable(): boolean;

  // Send a vision request
  analyzeImage(
    image: ImageInput,
    prompt: string,
    systemPrompt?: string
  ): Promise<AIProviderResponse>;

  // Health check
  healthCheck(): Promise<boolean>;
}

// Provider factory config
export interface AIProviderManagerConfig {
  providers: AIProviderConfig[];
  fallbackOrder: AIProviderName[];
  maxRetries: number;
  retryDelayMs: number;
}

// Processing queue item
export interface ProcessingQueueItem {
  id: string;
  submissionId: string;
  projectId: string;
  priority: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  attempts: number;
  maxAttempts: number;
  lastAttemptAt?: string;
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
}

// Token usage tracking
export interface TokenUsage {
  provider: AIProviderName;
  model: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  estimatedCost: number;
  timestamp: string;
}

// Cost estimation per provider
export const PROVIDER_COSTS: Record<AIProviderName, { input: number; output: number }> = {
  groq: { input: 0.00005, output: 0.00008 }, // per 1K tokens (Llama 3.2 Vision)
  openai: { input: 0.005, output: 0.015 }, // per 1K tokens (GPT-4o)
  anthropic: { input: 0.003, output: 0.015 }, // per 1K tokens (Claude 3.5 Sonnet)
};

// Estimate cost for token usage
export function estimateCost(
  provider: AIProviderName,
  inputTokens: number,
  outputTokens: number
): number {
  const costs = PROVIDER_COSTS[provider];
  return (inputTokens / 1000) * costs.input + (outputTokens / 1000) * costs.output;
}

// =============================================================================
// Mathpix OCR Types
// =============================================================================

export type OcrProvider = 'mathpix' | 'vision';

export interface MathpixConfig {
  appId: string;
  appKey: string;
  timeout?: number; // ms, default 10000
}

export interface MathpixResult {
  success: boolean;
  latex?: string; // LaTeX representation of the math
  text?: string; // Plain text representation
  confidence: number; // 0-1 confidence score
  error?: string;
  latencyMs: number;
  // Detailed word-level data (optional)
  wordData?: Array<{
    text: string;
    confidence: number;
    rect?: { x: number; y: number; width: number; height: number };
  }>;
}

// =============================================================================
// Wolfram Alpha Types
// =============================================================================

export interface WolframConfig {
  appId: string;
  timeout?: number; // ms, default 10000
}

export interface WolframResult {
  success: boolean;
  input: string; // Original input expression
  result?: string; // Computed result
  confidence: number; // 0-1 confidence
  error?: string;
  latencyMs: number;
}

// =============================================================================
// Verification Types
// =============================================================================

export type VerificationMethod = 'wolfram' | 'chain_of_thought' | 'none';

export type MathDifficulty = 'simple' | 'moderate' | 'complex';

export interface VerificationResult {
  method: VerificationMethod;
  originalAnswer: string;
  verificationAnswer?: string;
  matched: boolean;
  conflict: boolean; // True if answers don't match
  confidence: number;
  details?: string;
}

export interface ComparisonResult {
  matched: boolean;
  method?: 'exact' | 'numeric' | 'fraction' | 'percentage';
  aiNormalized?: string;
  verifyNormalized?: string;
}

// =============================================================================
// Enhanced Question Result (with verification data)
// =============================================================================

export interface QuestionResultEnhanced extends QuestionResult {
  // OCR data
  mathpixLatex?: string;
  ocrConfidence?: number;

  // Verification
  difficultyLevel?: MathDifficulty;
  verificationMethod?: VerificationMethod;
  wolframVerified?: boolean;
  wolframAnswer?: string;
  verificationConflict?: boolean;
}

// =============================================================================
// Enhanced Grading Result (with OCR and verification metadata)
// =============================================================================

export interface GradingResultEnhanced extends GradingResult {
  // OCR metadata
  ocrProvider?: OcrProvider;
  ocrConfidence?: number;

  // Verification metadata
  verificationMethod?: VerificationMethod;
  verificationResult?: Record<string, unknown>;
  mathDifficulty?: MathDifficulty;
}
