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
  studentAnswer: string | null;
  correctAnswer: string;
  isCorrect: boolean;
  pointsAwarded: number;
  pointsPossible: number;
  confidence: number; // 0-1
  feedback?: string;
  partialCredit?: boolean;
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
