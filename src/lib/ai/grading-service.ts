/**
 * AI Grading Service
 *
 * Orchestrates the grading pipeline:
 * 1. Load submission image
 * 2. Send to AI for analysis
 * 3. Parse and validate results
 * 4. Optionally generate feedback
 * 5. Store results
 */

import { getAIProviderManager } from './provider-manager';
import {
  GRADING_SYSTEM_PROMPT,
  FEEDBACK_SYSTEM_PROMPT,
  buildGradingPrompt,
  buildBatchFeedbackPrompt,
  parseGradingResponse,
  parseFeedbackResponse,
} from './prompts';
import type {
  GradingRequest,
  GradingResult,
  QuestionResult,
  AIProviderName,
  ImageInput,
  AnswerKeyData,
} from './types';
import { estimateCost } from './types';

export interface GradingServiceOptions {
  preferredProvider?: AIProviderName;
  generateFeedback?: boolean;
  maxRetries?: number;
}

export class GradingService {
  private manager = getAIProviderManager();

  /**
   * Grade a single submission
   */
  async gradeSubmission(
    request: GradingRequest,
    options: GradingServiceOptions = {}
  ): Promise<GradingResult> {
    const startTime = Date.now();
    const { generateFeedback = false, preferredProvider } = options;

    try {
      // Build the grading prompt - works with or without answer key
      // AI grades independently using blind grading (solves problems itself)
      const gradingPrompt = request.answerKey
        ? buildGradingPrompt(request.answerKey)
        : buildGradingPrompt({ type: 'manual', totalQuestions: 0, answers: [] });

      // Send to AI
      const response = await this.manager.analyzeImage(
        request.image,
        gradingPrompt,
        GRADING_SYSTEM_PROMPT,
        preferredProvider
      );

      if (!response.success) {
        return this.createFailedResult(request.submissionId, response.error, startTime, response.provider);
      }

      // Parse the response
      const parsed = parseGradingResponse(response.content);
      if (!parsed) {
        return this.createFailedResult(
          request.submissionId,
          'Failed to parse AI response',
          startTime,
          response.provider
        );
      }

      // PHASE 2: Compare AI's blind calculations to answer key (done AFTER AI responds)
      // The AI never saw the answer key - now we compare programmatically
      // If no answer key provided, AI's calculation is the only authority
      const hasAnswerKey = request.answerKey && request.answerKey.answers.length > 0;

      const questions: QuestionResult[] = parsed.questions.map((q, index) => {
        // Look up answer key entry only if answer key exists
        const answerKeyEntry = hasAnswerKey
          ? request.answerKey!.answers.find((a) => a.questionNumber === q.questionNumber)
          : undefined;

        // AI's calculated answer is authoritative (it never saw the answer key)
        const aiAnswer = q.aiAnswer || '';
        const answerKeyValue = answerKeyEntry?.correctAnswer || null;

        // Check if AI's calculation matches the answer key (only if key provided)
        let discrepancy: string | null = null;
        if (answerKeyValue && aiAnswer && answerKeyValue !== aiAnswer) {
          // AI calculated something different than the answer key
          discrepancy = `AI calculated "${aiAnswer}" but answer key says "${answerKeyValue}"`;
        }

        // Ensure every question counts - minimum 1 point possible
        // Even incomplete problems should count in the total
        const pointsPossible = Math.max(q.pointsPossible || 1, 1);
        const pointsAwarded = Math.min(q.pointsAwarded || 0, pointsPossible);

        return {
          questionNumber: q.questionNumber,
          problemText: q.problemText,
          aiCalculation: q.aiCalculation,
          aiAnswer: aiAnswer,
          studentAnswer: q.studentAnswer,
          correctAnswer: aiAnswer, // AI's calculation is the authority
          answerKeyValue: answerKeyValue, // For display/comparison only (null if no key)
          isCorrect: q.isCorrect, // Based on AI's independent calculation
          pointsAwarded: pointsAwarded,
          pointsPossible: pointsPossible,
          confidence: q.confidence,
          readabilityConfidence: q.readabilityConfidence,
          readabilityIssue: q.readabilityIssue,
          discrepancy: discrepancy,
        };
      });

      // Check if any question has low readability - flag for review
      const lowReadabilityQuestions = questions.filter(
        (q) => q.readabilityConfidence !== undefined && q.readabilityConfidence < 0.7
      );
      const hasReadabilityIssues = lowReadabilityQuestions.length > 0;

      // Build review reason if readability issues exist
      let reviewReason = parsed.reviewReason || undefined;
      let needsReview = parsed.needsReview;

      if (hasReadabilityIssues && !needsReview) {
        needsReview = true;
        const issueDescriptions = lowReadabilityQuestions
          .map((q) => `Q${q.questionNumber}: ${q.readabilityIssue || 'unclear handwriting'}`)
          .join('; ');
        reviewReason = `Low readability confidence: ${issueDescriptions}`;
      }

      // Generate feedback if requested
      if (generateFeedback && questions.length > 0) {
        const feedbackResult = await this.generateFeedback(questions, preferredProvider);
        if (feedbackResult) {
          questions.forEach((q, index) => {
            const fb = feedbackResult.feedback.find((f) => f.questionNumber === q.questionNumber);
            if (fb) {
              q.feedback = fb.message;
            }
          });
        }
      }

      // Calculate totals
      const totalScore = questions.reduce((sum, q) => sum + q.pointsAwarded, 0);
      const totalPossible = questions.reduce((sum, q) => sum + q.pointsPossible, 0);
      const percentage = totalPossible > 0 ? Math.round((totalScore / totalPossible) * 100) : 0;

      return {
        submissionId: request.submissionId,
        success: true,
        totalScore,
        totalPossible,
        percentage,
        questions,
        detectedStudentName: parsed.studentName || undefined,
        nameConfidence: parsed.nameConfidence,
        provider: response.provider,
        model: this.getModelForProvider(response.provider),
        processingTimeMs: Date.now() - startTime,
        tokensUsed: response.tokensUsed?.total,
        needsReview,
        reviewReason,
      };
    } catch (error) {
      return this.createFailedResult(
        request.submissionId,
        error instanceof Error ? error.message : 'Unknown error',
        startTime,
        preferredProvider || 'groq'
      );
    }
  }

  /**
   * Generate feedback for graded questions
   */
  private async generateFeedback(
    questions: QuestionResult[],
    preferredProvider?: AIProviderName
  ): Promise<{ feedback: Array<{ questionNumber: number; message: string }>; overallMessage: string } | null> {
    const feedbackPrompt = buildBatchFeedbackPrompt(
      questions.map((q) => ({
        questionNumber: q.questionNumber,
        studentAnswer: q.studentAnswer,
        correctAnswer: q.correctAnswer,
        isCorrect: q.isCorrect,
      }))
    );

    // Use a simple text prompt (no image needed for feedback)
    const response = await this.manager.analyzeImage(
      { type: 'base64', data: '', mimeType: 'image/jpeg' }, // Empty image
      feedbackPrompt,
      FEEDBACK_SYSTEM_PROMPT,
      preferredProvider
    );

    if (!response.success) return null;

    return parseFeedbackResponse(response.content);
  }

  /**
   * Estimate cost for grading
   */
  estimateGradingCost(
    provider: AIProviderName,
    imageCount: number = 1
  ): { minCost: number; maxCost: number; currency: string } {
    // Rough token estimates per image
    const inputTokensPerImage = 1500; // Image + prompt
    const outputTokensPerImage = 500; // Response

    const totalInput = inputTokensPerImage * imageCount;
    const totalOutput = outputTokensPerImage * imageCount;

    const cost = estimateCost(provider, totalInput, totalOutput);

    return {
      minCost: cost * 0.8, // -20% for variance
      maxCost: cost * 1.5, // +50% for variance
      currency: 'USD',
    };
  }

  /**
   * Get available providers
   */
  getAvailableProviders(): AIProviderName[] {
    return this.manager.getAvailableProviders();
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<Record<AIProviderName, boolean>> {
    return this.manager.healthCheckAll();
  }

  private createFailedResult(
    submissionId: string,
    error: string | undefined,
    startTime: number,
    provider: AIProviderName
  ): GradingResult {
    return {
      submissionId,
      success: false,
      totalScore: 0,
      totalPossible: 0,
      percentage: 0,
      questions: [],
      provider,
      model: this.getModelForProvider(provider),
      processingTimeMs: Date.now() - startTime,
      error: error || 'Unknown error',
      needsReview: true,
      reviewReason: error || 'Grading failed',
    };
  }

  private getModelForProvider(provider: AIProviderName): string {
    const models: Record<AIProviderName, string> = {
      groq: 'llama-3.2-90b-vision-preview',
      openai: 'gpt-4o',
      anthropic: 'claude-3-5-sonnet-20241022',
    };
    return models[provider];
  }
}

// Singleton instance
let serviceInstance: GradingService | null = null;

export function getGradingService(): GradingService {
  if (!serviceInstance) {
    serviceInstance = new GradingService();
  }
  return serviceInstance;
}

/**
 * Helper to convert Supabase storage URL to ImageInput
 */
export async function imageUrlToInput(url: string): Promise<ImageInput> {
  const response = await fetch(url);
  const arrayBuffer = await response.arrayBuffer();

  // Use Buffer for proper base64 encoding in Node.js
  const base64 = Buffer.from(arrayBuffer).toString('base64');

  // Determine MIME type from content-type header
  const contentType = response.headers.get('content-type') || 'image/jpeg';
  const mimeType = contentType.split(';')[0] as ImageInput['mimeType'];

  return {
    type: 'base64',
    data: base64,
    mimeType: mimeType || 'image/jpeg',
  };
}

/**
 * Helper to create answer key data from database format
 */
export function createAnswerKeyData(
  answers: Array<{ question_number: number; answer: string; points?: number }>,
  totalQuestions: number
): AnswerKeyData {
  return {
    type: 'manual',
    totalQuestions,
    answers: answers.map((a) => ({
      questionNumber: a.question_number,
      correctAnswer: a.answer,
      points: a.points || 1,
    })),
  };
}
