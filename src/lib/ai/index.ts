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
  createAIProviderManager,
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
  buildFeedbackPrompt,
  buildBatchFeedbackPrompt,
  NAME_EXTRACTION_PROMPT,
  parseGradingResponse,
  parseFeedbackResponse,
} from './prompts';
