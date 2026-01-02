/**
 * Enhanced AI Grading Service
 *
 * Multi-AI Pipeline Architecture:
 * 1. Mathpix OCR (MANDATORY) - Primary handwriting recognition
 * 2. GPT-4o Vision - Secondary reading + problem solving
 * 3. Conflict Detection - Compare Mathpix vs GPT-4o interpretations
 * 4. Wolfram Alpha - Verify calculations when conflicts detected
 * 5. Teacher Resolution - Show options when AIs disagree
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
  ProblemInterpretation,
} from './types';
import { getMathpixProvider } from './providers/mathpix';
import { getWolframProvider } from './providers/wolfram';
import { verifyCalculation, type VerificationOptions } from './verification-service';
import { classifyDifficulty } from './math-classifier';
import { compareAnswers } from './answer-comparator';

export interface EnhancedGradingOptions {
  /**
   * Mathpix is now MANDATORY for reliable math OCR.
   * This option only controls whether to fail gracefully if Mathpix is unavailable.
   * @default true (always use Mathpix)
   */
  requireMathpix?: boolean;
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

/**
 * Normalize problem text for comparison
 * Removes whitespace, standardizes operators, etc.
 */
function normalizeProblemText(text: string): string {
  return text
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/×/g, '*')
    .replace(/÷/g, '/')
    .replace(/−/g, '-')
    .replace(/\(/g, '(')
    .replace(/\)/g, ')')
    .trim();
}

/**
 * Check if two problem texts are meaningfully different
 * Returns true if they likely represent different problems
 */
function hasReadingConflict(text1: string | undefined, text2: string | undefined): boolean {
  if (!text1 || !text2) return false;

  const norm1 = normalizeProblemText(text1);
  const norm2 = normalizeProblemText(text2);

  // If they're identical after normalization, no conflict
  if (norm1 === norm2) return false;

  // Check for significant differences
  // Allow minor variations (spacing, parentheses placement)
  // Flag if numbers or operators are different

  // Extract just numbers and operators for comparison
  const extractCore = (s: string) => s.replace(/[^0-9+\-*/=ixyz]/gi, '');
  const core1 = extractCore(norm1);
  const core2 = extractCore(norm2);

  return core1 !== core2;
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
  private wolfram = getWolframProvider();

  /**
   * Grade a submission with enhanced accuracy using Multi-AI Pipeline
   *
   * Pipeline:
   * 1. Mathpix OCR (MANDATORY) - Primary handwriting recognition
   * 2. GPT-4o Vision - Secondary reading + problem solving
   * 3. Conflict Detection - Compare Mathpix vs GPT-4o interpretations
   * 4. Wolfram Alpha - Verify when Mathpix and GPT-4o disagree
   * 5. Teacher Resolution - Show top 2 options when uncertain
   */
  async gradeSubmissionEnhanced(
    request: GradingRequest,
    options: EnhancedGradingOptions = {}
  ): Promise<GradingResultWithCosts> {
    const startTime = Date.now();
    const {
      requireMathpix = true,
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
      // =========================================================================
      // Step 1: MANDATORY Mathpix OCR
      // =========================================================================
      let mathpixData: { latex?: string; text?: string; confidence: number } | null = null;

      if (!this.mathpix.isAvailable()) {
        if (requireMathpix) {
          return this.createFailedResult(
            request.submissionId,
            'Mathpix OCR is required but not configured. Please set MATHPIX_APP_ID and MATHPIX_APP_KEY environment variables.',
            startTime,
            preferredProvider || 'openai',
            'vision'
          );
        }
        console.warn('[GRADING] Mathpix not available, falling back to vision-only mode');
      } else if (request.image.type === 'base64') {
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
          console.log(`[MATHPIX] OCR complete: ${mathpixTimeMs}ms, confidence: ${(mathpixResult.confidence * 100).toFixed(1)}%`);
        } else {
          console.warn(`[MATHPIX] OCR failed: ${mathpixResult.error}`);
          if (requireMathpix) {
            return this.createFailedResult(
              request.submissionId,
              `Mathpix OCR failed: ${mathpixResult.error}`,
              startTime,
              preferredProvider || 'openai',
              'vision'
            );
          }
        }
      }

      // =========================================================================
      // Step 2: GPT-4o Vision Grading (with Mathpix data as reference)
      // =========================================================================
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
      if (response.success) {
        gpt4oCost = 0.015;
        console.log(`[GPT-4o] Grading complete: ${gpt4oTimeMs}ms`);
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

      // =========================================================================
      // Step 4: Process each question with conflict detection and verification
      // =========================================================================
      const verificationStart = Date.now();
      const enhancedQuestions: QuestionResultEnhanced[] = await Promise.all(
        parsed.questions.map(async (q) => {
          return this.processQuestionWithConflictDetection(
            q,
            request,
            options,
            response.provider,
            mathpixData
          );
        })
      );
      verificationTimeMs = Date.now() - verificationStart;

      // =========================================================================
      // Step 5: Calculate statistics and determine if review is needed
      // =========================================================================
      const difficulties = enhancedQuestions.map((q) => q.difficultyLevel || 'simple');
      const overallDifficulty = this.getMaxDifficulty(difficulties);

      // Count different types of conflicts
      const verificationConflicts = enhancedQuestions.filter(
        (q) => q.verificationConflict
      ).length;
      const readingConflicts = enhancedQuestions.filter(
        (q) => q.hasReadingConflict
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
        readingConflicts > 0 ||
        enhancedQuestions.some(
          (q) => (q.readabilityConfidence ?? 1) < 0.7 || q.verificationConflict || q.hasReadingConflict
        );

      let reviewReason = parsed.reviewReason;
      if (!reviewReason) {
        if (readingConflicts > 0) {
          reviewReason = `${readingConflicts} question(s) have OCR reading conflicts - teacher verification recommended`;
        } else if (verificationConflicts > 0) {
          reviewReason = `${verificationConflicts} question(s) have calculation verification conflicts`;
        }
      }

      // Calculate Wolfram costs based on verification methods used
      // Count both verification calls and conflict resolution calls
      const wolframQuestions = enhancedQuestions.filter(
        (q) => q.verificationMethod === 'wolfram'
      ).length;
      // Each conflict may result in 2 Wolfram calls (one for each interpretation)
      const conflictWolframCalls = readingConflicts * 2;
      wolframCost = (wolframQuestions + conflictWolframCalls) * 0.02; // ~$0.02 per Wolfram query

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
   * Process a single question with multi-AI conflict detection
   *
   * This method:
   * 1. Compares Mathpix reading vs GPT-4o reading
   * 2. If conflict detected, calls Wolfram to verify
   * 3. Generates top 2 interpretation options for teacher review
   */
  private async processQuestionWithConflictDetection(
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
    provider: AIProviderName,
    mathpixData: { latex?: string; text?: string; confidence: number } | null
  ): Promise<QuestionResultEnhanced> {
    // Look up answer key entry only if answer key exists
    const hasAnswerKey = request.answerKey && request.answerKey.answers.length > 0;
    const answerKeyEntry = hasAnswerKey
      ? request.answerKey!.answers.find((a) => a.questionNumber === q.questionNumber)
      : undefined;

    const aiAnswer = q.aiAnswer || '';
    const answerKeyValue = answerKeyEntry?.correctAnswer || null;
    const gpt4oReading = q.problemText || '';

    // Extract Mathpix reading for this specific question (if available)
    // Note: Mathpix returns all problems as one block, so we use the full text
    // In a future enhancement, we could parse individual problems from Mathpix
    const mathpixReading = mathpixData?.text || undefined;
    const mathpixLatex = mathpixData?.latex || undefined;

    // Classify difficulty
    const difficultyLevel = classifyDifficulty(gpt4oReading);

    // =========================================================================
    // Conflict Detection: Compare Mathpix vs GPT-4o
    // =========================================================================
    const readingConflict = hasReadingConflict(mathpixReading, gpt4oReading);

    // Prepare interpretation options (top 2)
    let interpretationOptions: ProblemInterpretation[] | undefined;
    let verificationMethod: VerificationMethod = 'none';
    let wolframVerified = false;
    let wolframAnswer: string | undefined;
    let verificationConflict = false;

    // If there's a conflict between Mathpix and GPT-4o, call Wolfram and prepare options
    if (readingConflict && this.wolfram.isAvailable()) {
      console.log(`[CONFLICT] Q${q.questionNumber}: Mathpix vs GPT-4o disagree`);
      console.log(`  Mathpix: "${mathpixReading?.substring(0, 50)}..."`);
      console.log(`  GPT-4o:  "${gpt4oReading.substring(0, 50)}..."`);

      // Call Wolfram to verify GPT-4o's calculation
      const wolframResult = await this.wolfram.solve(gpt4oReading);
      verificationMethod = 'wolfram';

      if (wolframResult.success && wolframResult.result) {
        wolframAnswer = wolframResult.result;
        wolframVerified = compareAnswers(aiAnswer, wolframResult.result).matched;
        verificationConflict = !wolframVerified;

        console.log(`[WOLFRAM] Result: ${wolframResult.result}, matches AI: ${wolframVerified}`);
      }

      // Build top 2 interpretation options
      interpretationOptions = [
        {
          problemText: gpt4oReading,
          source: 'gpt4o' as const,
          confidence: q.confidence,
          calculatedAnswer: aiAnswer,
        },
      ];

      // Add Mathpix interpretation if different
      if (mathpixReading && mathpixReading !== gpt4oReading) {
        // Try to solve Mathpix's interpretation with Wolfram
        let mathpixAnswer: string | undefined;
        if (this.wolfram.isAvailable()) {
          const mathpixWolfram = await this.wolfram.solve(mathpixReading);
          if (mathpixWolfram.success) {
            mathpixAnswer = mathpixWolfram.result;
          }
        }

        interpretationOptions.push({
          problemText: mathpixReading,
          source: 'mathpix' as const,
          confidence: mathpixData?.confidence || 0.8,
          calculatedAnswer: mathpixAnswer,
          latex: mathpixLatex,
        });
      }
    } else if (options.enableVerification !== false && difficultyLevel !== 'simple' && aiAnswer) {
      // No conflict, but still run verification for complex problems
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
        gpt4oReading,
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
      problemText: gpt4oReading,
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
      // Multi-AI fields
      mathpixReading,
      mathpixLatex,
      mathpixText: mathpixReading,
      gpt4oReading,
      hasReadingConflict: readingConflict,
      interpretationOptions,
      selectedInterpretation: null,
      ocrConfidence: mathpixData?.confidence,
      // Verification fields
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
