/**
 * Enhanced AI Grading Service
 *
 * Extends the base grading service with:
 * 1. Mathpix OCR for handwriting recognition
 * 2. Math difficulty classification
 * 3. Multi-layer verification (Wolfram Alpha + Chain-of-Thought)
 * 4. Answer normalization and comparison
 *
 * This service provides significantly improved accuracy for:
 * - Complex math problems (algebra, equations)
 * - Handwritten answers that are difficult to read
 * - Fraction/decimal/percentage equivalence
 */

import { getAIProviderManager } from './provider-manager';
import {
  GRADING_SYSTEM_PROMPT,
  buildGradingPrompt,
  parseGradingResponse,
} from './prompts';
import type {
  GradingRequest,
  GradingResult,
  GradingResultEnhanced,
  QuestionResult,
  QuestionResultEnhanced,
  AIProviderName,
  ImageInput,
  MathDifficulty,
  VerificationMethod,
} from './types';
import { getMathpixProvider } from './providers/mathpix';
import { verifyCalculation, type VerificationOptions } from './verification-service';
import { classifyDifficulty } from './math-classifier';
import { compareAnswers } from './answer-comparator';

export interface EnhancedGradingOptions {
  /** Use Mathpix for OCR preprocessing */
  useMathpix?: boolean;
  /** Enable verification pipeline */
  enableVerification?: boolean;
  /** Force specific verification method */
  forceVerificationMethod?: VerificationMethod;
  /** Preferred AI provider */
  preferredProvider?: AIProviderName;
  /** Generate feedback for incorrect answers */
  generateFeedback?: boolean;
  /** Maximum retries for failed operations */
  maxRetries?: number;
  /** Track API costs */
  trackCosts?: boolean;
}

/** Cost breakdown for grading operation */
export interface CostBreakdown {
  mathpix: number;
  gpt4o: number;
  wolfram: number;
  total: number;
}

/** Processing metrics for grading operation */
export interface ProcessingMetrics {
  totalTimeMs: number;
  mathpixTimeMs?: number;
  gpt4oTimeMs?: number;
  verificationTimeMs?: number;
  aiProviderUsed: string;
  fallbacksRequired: number;
}

/** Extended result with cost tracking */
export interface GradingResultWithCosts extends GradingResultEnhanced {
  costBreakdown?: CostBreakdown;
  processingMetrics?: ProcessingMetrics;
}

export class EnhancedGradingService {
  private manager = getAIProviderManager();
  private mathpix = getMathpixProvider();

  /**
   * Grade a submission with enhanced accuracy
   *
   * Pipeline:
   * 1. (Optional) Mathpix OCR for better handwriting recognition
   * 2. AI grading with chain-of-thought calculation
   * 3. Difficulty classification per problem
   * 4. Verification based on difficulty (Wolfram or CoT)
   * 5. Answer comparison and conflict detection
   */
  async gradeSubmissionEnhanced(
    request: GradingRequest,
    options: EnhancedGradingOptions = {}
  ): Promise<GradingResultWithCosts> {
    const startTime = Date.now();
    const {
      useMathpix = this.mathpix.isEnabled(),
      enableVerification = true,
      preferredProvider,
      trackCosts = process.env.TRACK_API_COSTS !== 'false',
    } = options;

    // Cost tracking
    let mathpixCost = 0;
    let gpt4oCost = 0;
    let wolframCost = 0;
    let mathpixTimeMs = 0;
    let gpt4oTimeMs = 0;
    let verificationTimeMs = 0;

    try {
      // Step 1: Optional Mathpix OCR preprocessing
      let mathpixData: { latex?: string; text?: string; confidence: number } | null = null;

      if (useMathpix && request.image.type === 'base64') {
        const mathpixStart = Date.now();
        const mathpixResult = await this.mathpix.extractMath(
          request.image.data,
          request.image.mimeType
        );
        mathpixTimeMs = Date.now() - mathpixStart;

        if (mathpixResult.success) {
          mathpixData = {
            latex: mathpixResult.latex,
            text: mathpixResult.text,
            confidence: mathpixResult.confidence,
          };
          // Mathpix cost: $0.004 per image (standard tier)
          mathpixCost = 0.004;
        }
      }

      // Step 2: AI Grading (with Mathpix data if available)
      const gradingPrompt = this.buildEnhancedGradingPrompt(
        request.answerKey,
        mathpixData
      );

      const gpt4oStart = Date.now();
      const response = await this.manager.analyzeImage(
        request.image,
        gradingPrompt,
        GRADING_SYSTEM_PROMPT,
        preferredProvider
      );
      gpt4oTimeMs = Date.now() - gpt4oStart;

      // GPT-4o cost estimate: ~$0.015 per image (input + output)
      // Based on: ~1500 input tokens + ~500 output tokens
      if (response.success) {
        gpt4oCost = 0.015;
      }

      if (!response.success) {
        return this.createFailedResult(
          request.submissionId,
          response.error,
          startTime,
          response.provider,
          mathpixData ? 'mathpix' : 'vision'
        );
      }

      // Step 3: Parse AI response
      const parsed = parseGradingResponse(response.content);
      if (!parsed) {
        return this.createFailedResult(
          request.submissionId,
          'Failed to parse AI response',
          startTime,
          response.provider,
          mathpixData ? 'mathpix' : 'vision'
        );
      }

      // Step 4: Process each question with verification
      const enhancedQuestions: QuestionResultEnhanced[] = await Promise.all(
        parsed.questions.map(async (q) => {
          return this.processQuestion(q, request, options, response.provider);
        })
      );

      // Step 5: Calculate overall difficulty and verification stats
      const difficulties = enhancedQuestions.map((q) => q.difficultyLevel || 'simple');
      const overallDifficulty = this.getMaxDifficulty(difficulties);
      const verificationConflicts = enhancedQuestions.filter(
        (q) => q.verificationConflict
      ).length;

      // Step 6: Calculate totals
      const totalScore = enhancedQuestions.reduce((sum, q) => sum + q.pointsAwarded, 0);
      const totalPossible = enhancedQuestions.reduce(
        (sum, q) => sum + q.pointsPossible,
        0
      );
      const percentage =
        totalPossible > 0 ? Math.round((totalScore / totalPossible) * 100) : 0;

      // Determine if review is needed
      const needsReview =
        parsed.needsReview ||
        verificationConflicts > 0 ||
        enhancedQuestions.some(
          (q) => (q.readabilityConfidence ?? 1) < 0.7 || q.verificationConflict
        );

      let reviewReason = parsed.reviewReason;
      if (!reviewReason && verificationConflicts > 0) {
        reviewReason = `${verificationConflicts} question(s) have verification conflicts`;
      }

      // Calculate Wolfram costs based on verification methods used
      const wolframQuestions = enhancedQuestions.filter(
        (q) => q.verificationMethod === 'wolfram'
      ).length;
      wolframCost = wolframQuestions * 0.02; // ~$0.02 per Wolfram query

      const totalCost = mathpixCost + gpt4oCost + wolframCost;

      // Log costs if tracking is enabled
      if (trackCosts) {
        console.log(
          `[COST] Grading ${request.submissionId}: Mathpix=$${mathpixCost.toFixed(4)}, GPT-4o=$${gpt4oCost.toFixed(4)}, Wolfram=$${wolframCost.toFixed(4)}, Total=$${totalCost.toFixed(4)}`
        );
      }

      return {
        submissionId: request.submissionId,
        success: true,
        totalScore,
        totalPossible,
        percentage,
        questions: enhancedQuestions,
        detectedStudentName: parsed.studentName || undefined,
        nameConfidence: parsed.nameConfidence,
        provider: response.provider,
        model: this.getModelForProvider(response.provider),
        processingTimeMs: Date.now() - startTime,
        tokensUsed: response.tokensUsed?.total,
        needsReview,
        reviewReason: reviewReason || undefined,
        // Enhanced metadata
        ocrProvider: mathpixData ? 'mathpix' : 'vision',
        ocrConfidence: mathpixData?.confidence,
        mathDifficulty: overallDifficulty,
        // Cost tracking
        costBreakdown: {
          mathpix: mathpixCost,
          gpt4o: gpt4oCost,
          wolfram: wolframCost,
          total: totalCost,
        },
        processingMetrics: {
          totalTimeMs: Date.now() - startTime,
          mathpixTimeMs: mathpixTimeMs || undefined,
          gpt4oTimeMs,
          verificationTimeMs: verificationTimeMs || undefined,
          aiProviderUsed: response.provider,
          fallbacksRequired: 0,
        },
      };
    } catch (error) {
      return this.createFailedResult(
        request.submissionId,
        error instanceof Error ? error.message : 'Unknown error',
        startTime,
        preferredProvider || 'openai',
        'vision'
      );
    }
  }

  /**
   * Process a single question with verification
   */
  private async processQuestion(
    q: {
      questionNumber: number;
      problemText?: string;
      aiCalculation?: string;
      aiAnswer?: string;
      studentAnswer: string | null;
      isCorrect: boolean;
      pointsAwarded: number;
      pointsPossible: number;
      confidence: number;
      readabilityConfidence?: number;
      readabilityIssue?: string | null;
    },
    request: GradingRequest,
    options: EnhancedGradingOptions,
    provider: AIProviderName
  ): Promise<QuestionResultEnhanced> {
    // Look up answer key entry only if answer key exists
    const hasAnswerKey = request.answerKey && request.answerKey.answers.length > 0;
    const answerKeyEntry = hasAnswerKey
      ? request.answerKey!.answers.find((a) => a.questionNumber === q.questionNumber)
      : undefined;

    const aiAnswer = q.aiAnswer || '';
    const answerKeyValue = answerKeyEntry?.correctAnswer || null;
    const problemText = q.problemText || '';

    // Classify difficulty
    const difficultyLevel = classifyDifficulty(problemText);

    // Determine verification method
    let verificationMethod: VerificationMethod = 'none';
    let wolframVerified = false;
    let wolframAnswer: string | undefined;
    let verificationConflict = false;

    // Run verification if enabled and not a simple problem
    if (options.enableVerification !== false && difficultyLevel !== 'simple' && aiAnswer) {
      const verificationOptions: VerificationOptions = {
        forceMethod: options.forceVerificationMethod,
        aiVerifyFn: async (prompt, systemPrompt) => {
          const result = await this.manager.analyzeImage(
            { type: 'base64', data: '', mimeType: 'image/jpeg' },
            prompt,
            systemPrompt,
            provider
          );
          return {
            success: result.success,
            content: result.content,
            error: result.error,
            latencyMs: 0,
          };
        },
      };

      const verification = await verifyCalculation(
        problemText,
        aiAnswer,
        verificationOptions
      );

      verificationMethod = verification.method;
      verificationConflict = verification.conflict;

      if (verification.method === 'wolfram' && verification.verificationAnswer) {
        wolframVerified = verification.matched;
        wolframAnswer = verification.verificationAnswer;
      }
    }

    // Check for discrepancy between AI answer and answer key
    let discrepancy: string | null = null;
    if (answerKeyValue && aiAnswer) {
      const comparison = compareAnswers(aiAnswer, answerKeyValue);
      if (!comparison.matched) {
        discrepancy = `AI calculated "${aiAnswer}" but answer key says "${answerKeyValue}"`;
      }
    }

    // Ensure every question counts
    const pointsPossible = Math.max(q.pointsPossible || 1, 1);
    const pointsAwarded = Math.min(q.pointsAwarded || 0, pointsPossible);

    return {
      questionNumber: q.questionNumber,
      problemText: q.problemText,
      aiCalculation: q.aiCalculation,
      aiAnswer: aiAnswer,
      studentAnswer: q.studentAnswer,
      correctAnswer: aiAnswer, // AI's calculation is the authority
      answerKeyValue: answerKeyValue,
      isCorrect: q.isCorrect,
      pointsAwarded: pointsAwarded,
      pointsPossible: pointsPossible,
      confidence: q.confidence,
      readabilityConfidence: q.readabilityConfidence,
      readabilityIssue: q.readabilityIssue,
      discrepancy: discrepancy,
      // Enhanced fields
      difficultyLevel,
      verificationMethod,
      wolframVerified,
      wolframAnswer,
      verificationConflict,
    };
  }

  /**
   * Build enhanced grading prompt with Mathpix data
   */
  private buildEnhancedGradingPrompt(
    answerKey: GradingRequest['answerKey'],
    mathpixData: { latex?: string; text?: string; confidence: number } | null
  ): string {
    // Handle optional answer key - create empty one if not provided
    const answerKeyData = answerKey || { type: 'manual' as const, totalQuestions: 0, answers: [] };
    let prompt = buildGradingPrompt(answerKeyData);

    if (mathpixData) {
      prompt += `

ADDITIONAL OCR DATA (from Mathpix - confidence: ${(mathpixData.confidence * 100).toFixed(1)}%):
${mathpixData.text ? `Text: ${mathpixData.text}` : ''}
${mathpixData.latex ? `LaTeX: ${mathpixData.latex}` : ''}

Use this OCR data to help read any unclear handwriting, but always verify against the actual image.`;
    }

    return prompt;
  }

  /**
   * Get the maximum difficulty from a list
   */
  private getMaxDifficulty(difficulties: MathDifficulty[]): MathDifficulty {
    if (difficulties.includes('complex')) return 'complex';
    if (difficulties.includes('moderate')) return 'moderate';
    return 'simple';
  }

  /**
   * Create a failed result
   */
  private createFailedResult(
    submissionId: string,
    error: string | undefined,
    startTime: number,
    provider: AIProviderName,
    ocrProvider: 'mathpix' | 'vision'
  ): GradingResultEnhanced {
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
      ocrProvider,
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

  /**
   * Get available providers
   */
  getAvailableProviders(): AIProviderName[] {
    return this.manager.getAvailableProviders();
  }

  /**
   * Health check all components
   */
  async healthCheck(): Promise<{
    providers: Record<AIProviderName, boolean>;
    mathpix: boolean;
    wolfram: boolean;
  }> {
    const [providers] = await Promise.all([this.manager.healthCheckAll()]);

    return {
      providers,
      mathpix: this.mathpix.isEnabled(),
      wolfram:
        (await import('./providers/wolfram')).getWolframProvider().isEnabled(),
    };
  }
}

// Singleton instance
let enhancedServiceInstance: EnhancedGradingService | null = null;

export function getEnhancedGradingService(): EnhancedGradingService {
  if (!enhancedServiceInstance) {
    enhancedServiceInstance = new EnhancedGradingService();
  }
  return enhancedServiceInstance;
}
