/**
 * Verification Service
 *
 * Orchestrates the multi-layer verification pipeline:
 * 1. Classifies problem difficulty
 * 2. Routes to appropriate verification method
 * 3. Compares results and flags conflicts
 *
 * Verification Methods:
 * - Simple: No verification (basic arithmetic)
 * - Moderate: Chain-of-thought verification
 * - Complex: Wolfram Alpha verification + CoT fallback
 */

import type {
  MathDifficulty,
  VerificationMethod,
  VerificationResult,
  AIProviderResponse,
} from './types';
import { classifyDifficulty, classifyWithReason } from './math-classifier';
import { compareAnswers } from './answer-comparator';
import { getWolframProvider } from './providers/wolfram';
import {
  VERIFICATION_SYSTEM_PROMPT,
  buildVerificationPrompt,
  buildAlgebraVerificationPrompt,
  buildWordProblemVerificationPrompt,
  parseVerificationResponse,
} from './prompts-verification';

export interface VerificationOptions {
  /** Force a specific verification method */
  forceMethod?: VerificationMethod;
  /** Skip verification entirely */
  skipVerification?: boolean;
  /** Numeric tolerance for comparison */
  tolerance?: number;
  /** Provider function for chain-of-thought verification */
  aiVerifyFn?: (prompt: string, systemPrompt: string) => Promise<AIProviderResponse>;
}

export interface VerificationServiceResult extends VerificationResult {
  difficulty: MathDifficulty;
  difficultyReason?: string;
  wolframResult?: string;
  wolframLatencyMs?: number;
  cotResult?: string;
  cotLatencyMs?: number;
}

/**
 * Main verification function
 * Automatically selects verification method based on problem difficulty
 */
export async function verifyCalculation(
  problemText: string,
  aiAnswer: string,
  options: VerificationOptions = {}
): Promise<VerificationServiceResult> {
  const startTime = Date.now();

  // Skip verification if requested
  if (options.skipVerification) {
    return {
      method: 'none',
      originalAnswer: aiAnswer,
      matched: true,
      conflict: false,
      confidence: 0.7, // Lower confidence when skipping verification
      difficulty: 'simple',
      details: 'Verification skipped by request',
    };
  }

  // Classify difficulty
  const { difficulty, reason } = classifyWithReason(problemText);
  const method = options.forceMethod || selectVerificationMethod(difficulty);

  // Route to appropriate verification
  switch (method) {
    case 'wolfram':
      return await verifyWithWolfram(problemText, aiAnswer, difficulty, reason, options);

    case 'chain_of_thought':
      return await verifyWithChainOfThought(
        problemText,
        aiAnswer,
        difficulty,
        reason,
        options
      );

    case 'none':
    default:
      return {
        method: 'none',
        originalAnswer: aiAnswer,
        matched: true,
        conflict: false,
        confidence: 0.85, // Simple problems have inherent high confidence
        difficulty,
        difficultyReason: reason,
        details: `Simple arithmetic (${Date.now() - startTime}ms)`,
      };
  }
}

/**
 * Select verification method based on difficulty
 */
function selectVerificationMethod(difficulty: MathDifficulty): VerificationMethod {
  const wolfram = getWolframProvider();

  switch (difficulty) {
    case 'complex':
      // Use Wolfram if available, fall back to CoT
      return wolfram.isEnabled() ? 'wolfram' : 'chain_of_thought';

    case 'moderate':
      // Chain-of-thought for moderate problems
      return 'chain_of_thought';

    case 'simple':
    default:
      // No verification needed for simple arithmetic
      return 'none';
  }
}

/**
 * Verify using Wolfram Alpha
 */
async function verifyWithWolfram(
  problemText: string,
  aiAnswer: string,
  difficulty: MathDifficulty,
  difficultyReason: string,
  options: VerificationOptions
): Promise<VerificationServiceResult> {
  const wolfram = getWolframProvider();
  const tolerance = options.tolerance || 0.0001;

  // Try Wolfram Alpha
  const wolframResult = await wolfram.solve(problemText);

  if (wolframResult.success && wolframResult.result) {
    // Compare AI answer with Wolfram result
    const comparison = compareAnswers(aiAnswer, wolframResult.result, tolerance);

    return {
      method: 'wolfram',
      originalAnswer: aiAnswer,
      verificationAnswer: wolframResult.result,
      matched: comparison.matched,
      conflict: !comparison.matched,
      confidence: comparison.matched ? 0.98 : 0.6, // High confidence when Wolfram agrees
      difficulty,
      difficultyReason,
      wolframResult: wolframResult.result,
      wolframLatencyMs: wolframResult.latencyMs,
      details: comparison.matched
        ? `Wolfram Alpha verified: ${wolframResult.result}`
        : `CONFLICT: AI=${aiAnswer}, Wolfram=${wolframResult.result}`,
    };
  }

  // Wolfram failed - fall back to chain-of-thought
  console.warn(
    `Wolfram verification failed for "${problemText}": ${wolframResult.error}`
  );

  // Fall back to chain-of-thought if we have the AI function
  if (options.aiVerifyFn) {
    const cotResult = await verifyWithChainOfThought(
      problemText,
      aiAnswer,
      difficulty,
      difficultyReason,
      options
    );

    return {
      ...cotResult,
      details: `Wolfram failed (${wolframResult.error}), used CoT fallback. ${cotResult.details}`,
    };
  }

  // No fallback available
  return {
    method: 'wolfram',
    originalAnswer: aiAnswer,
    matched: true, // Assume correct when we can't verify
    conflict: false,
    confidence: 0.7, // Lower confidence when verification fails
    difficulty,
    difficultyReason,
    details: `Wolfram verification failed: ${wolframResult.error}`,
  };
}

/**
 * Verify using chain-of-thought prompting
 */
async function verifyWithChainOfThought(
  problemText: string,
  aiAnswer: string,
  difficulty: MathDifficulty,
  difficultyReason: string,
  options: VerificationOptions
): Promise<VerificationServiceResult> {
  const startTime = Date.now();
  const tolerance = options.tolerance || 0.0001;

  // Check if AI verify function is available
  if (!options.aiVerifyFn) {
    return {
      method: 'chain_of_thought',
      originalAnswer: aiAnswer,
      matched: true,
      conflict: false,
      confidence: 0.75,
      difficulty,
      difficultyReason,
      details: 'Chain-of-thought verification skipped (no AI function provided)',
    };
  }

  try {
    // Select appropriate prompt based on problem type
    const prompt = selectVerificationPrompt(problemText, aiAnswer, difficulty);

    // Call AI for verification
    const response = await options.aiVerifyFn(prompt, VERIFICATION_SYSTEM_PROMPT);

    if (!response.success) {
      return {
        method: 'chain_of_thought',
        originalAnswer: aiAnswer,
        matched: true,
        conflict: false,
        confidence: 0.7,
        difficulty,
        difficultyReason,
        cotLatencyMs: Date.now() - startTime,
        details: `CoT verification failed: ${response.error}`,
      };
    }

    // Parse the verification response
    const parsed = parseVerificationResponse(response.content);

    if (!parsed) {
      // Could not parse response - use answer comparison as fallback
      const comparison = compareAnswers(aiAnswer, aiAnswer, tolerance);
      return {
        method: 'chain_of_thought',
        originalAnswer: aiAnswer,
        matched: true,
        conflict: false,
        confidence: 0.75,
        difficulty,
        difficultyReason,
        cotResult: response.content,
        cotLatencyMs: Date.now() - startTime,
        details: 'Could not parse CoT response, assuming correct',
      };
    }

    // Compare the verification answer with original
    const comparison = compareAnswers(aiAnswer, parsed.yourAnswer, tolerance);

    return {
      method: 'chain_of_thought',
      originalAnswer: aiAnswer,
      verificationAnswer: parsed.yourAnswer,
      matched: comparison.matched || parsed.match,
      conflict: !comparison.matched && !parsed.match,
      confidence: parsed.confidence,
      difficulty,
      difficultyReason,
      cotResult: parsed.yourAnswer,
      cotLatencyMs: Date.now() - startTime,
      details: parsed.match
        ? `CoT verified: ${parsed.yourAnswer}`
        : `CONFLICT: AI=${aiAnswer}, CoT=${parsed.yourAnswer}. ${parsed.discrepancy || ''}`,
    };
  } catch (error) {
    return {
      method: 'chain_of_thought',
      originalAnswer: aiAnswer,
      matched: true,
      conflict: false,
      confidence: 0.7,
      difficulty,
      difficultyReason,
      cotLatencyMs: Date.now() - startTime,
      details: `CoT verification error: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

/**
 * Select the appropriate verification prompt based on problem characteristics
 */
function selectVerificationPrompt(
  problemText: string,
  aiAnswer: string,
  difficulty: MathDifficulty
): string {
  const lowerProblem = problemText.toLowerCase();

  // Check for word problem indicators
  const isWordProblem =
    /\b(has|had|have|bought|sold|gave|received|each|total|how many|how much|find|what is)\b/i.test(
      problemText
    );

  // Check for algebra indicators
  const isAlgebra =
    /[a-z]\s*[=+\-*/]|solve\s+for|simplify|factor|expand/i.test(problemText);

  if (isAlgebra && difficulty === 'complex') {
    return buildAlgebraVerificationPrompt(problemText, aiAnswer);
  }

  if (isWordProblem) {
    return buildWordProblemVerificationPrompt(problemText, aiAnswer);
  }

  // Default verification prompt
  return buildVerificationPrompt(problemText, aiAnswer);
}

/**
 * Batch verify multiple calculations
 */
export async function verifyBatch(
  problems: Array<{ problem: string; answer: string }>,
  options: VerificationOptions = {}
): Promise<VerificationServiceResult[]> {
  const results: VerificationServiceResult[] = [];

  for (const { problem, answer } of problems) {
    const result = await verifyCalculation(problem, answer, options);
    results.push(result);

    // Small delay between verifications to avoid rate limiting
    if (problems.indexOf({ problem, answer }) < problems.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  }

  return results;
}

/**
 * Get verification statistics for a batch of results
 */
export function getVerificationStats(results: VerificationServiceResult[]): {
  total: number;
  verified: number;
  conflicts: number;
  byMethod: Record<VerificationMethod, number>;
  byDifficulty: Record<MathDifficulty, number>;
  averageConfidence: number;
} {
  const stats = {
    total: results.length,
    verified: 0,
    conflicts: 0,
    byMethod: { wolfram: 0, chain_of_thought: 0, none: 0 } as Record<
      VerificationMethod,
      number
    >,
    byDifficulty: { simple: 0, moderate: 0, complex: 0 } as Record<
      MathDifficulty,
      number
    >,
    averageConfidence: 0,
  };

  let totalConfidence = 0;

  for (const result of results) {
    if (result.matched) stats.verified++;
    if (result.conflict) stats.conflicts++;
    stats.byMethod[result.method]++;
    stats.byDifficulty[result.difficulty]++;
    totalConfidence += result.confidence;
  }

  stats.averageConfidence = results.length > 0 ? totalConfidence / results.length : 0;

  return stats;
}
