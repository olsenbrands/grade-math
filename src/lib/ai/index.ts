/**
 * AI Module Exports
 *
 * Main entry point for the AI grading system
 */

// Types
export * from './types';

// Providers
export { GroqProvider, createGroqProvider } from './providers/groq';
export { OpenAIProvider, createOpenAIProvider } from './providers/openai';
export { AnthropicProvider, createAnthropicProvider } from './providers/anthropic';

// Provider Manager
export {
  AIProviderManager,
  getAIProviderManager,
} from './provider-manager';

// Grading Service
export {
  GradingService,
  getGradingService,
  imageUrlToInput,
  createAnswerKeyData,
} from './grading-service';
export type { GradingServiceOptions } from './grading-service';

// Processing Queue
export {
  enqueueSubmission,
  enqueueSubmissions,
  getNextPendingItem,
  markCompleted,
  markFailed,
  releaseStaleItems,
  getQueueStats,
  getProjectQueueItems,
  cleanupOldItems,
  resetFailedSubmission,
  resetAllFailedForProject,
} from './processing-queue';
export type { QueuedSubmission } from './processing-queue';

// Results Service
export {
  saveGradingResult,
  getResultBySubmission,
  getProjectResults,
  getProjectStats,
  markAsReviewed,
  updateQuestionResult,
  deleteResult,
  linkResultToStudent,
} from './results-service';
export type { StoredResult } from './results-service';

// Prompts
export {
  GRADING_SYSTEM_PROMPT,
  FEEDBACK_SYSTEM_PROMPT,
  buildGradingPrompt,
  buildBatchFeedbackPrompt,
  NAME_EXTRACTION_PROMPT,
  parseGradingResponse,
  parseFeedbackResponse,
} from './prompts';

// =============================================================================
// Enhanced Math Grading (Mathpix + Wolfram + Chain-of-Thought)
// =============================================================================

// Mathpix OCR Provider
export {
  MathpixProvider,
  getMathpixProvider,
} from './providers/mathpix';

// Wolfram Alpha Provider
export {
  WolframProvider,
  getWolframProvider,
} from './providers/wolfram';

// Math Difficulty Classifier
export {
  classifyDifficulty,
  classifyWithReason,
  classifyBatch,
  getMaxDifficulty,
  requiresVerification,
} from './math-classifier';

// Answer Comparator
export {
  compareAnswers,
  normalizeAnswer,
  parseNumeric,
  parseFraction,
  parsePercentage,
} from './answer-comparator';

// Verification Service
export {
  verifyCalculation,
  verifyBatch,
  getVerificationStats,
} from './verification-service';
export type { VerificationOptions, VerificationServiceResult } from './verification-service';

// Verification Prompts
export {
  VERIFICATION_SYSTEM_PROMPT,
  buildVerificationPrompt,
  buildWordProblemVerificationPrompt,
  buildAlgebraVerificationPrompt,
  parseVerificationResponse,
} from './prompts-verification';
export type { VerificationResponse } from './prompts-verification';

// Enhanced Grading Service (with Mathpix + Wolfram + CoT)
export {
  EnhancedGradingService,
  getEnhancedGradingService,
} from './grading-service-enhanced';
export type { EnhancedGradingOptions } from './grading-service-enhanced';
