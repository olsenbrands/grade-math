/**
 * Math Difficulty Classifier
 *
 * Classifies math problems by difficulty to determine the appropriate
 * verification pipeline:
 * - Simple: Basic arithmetic, no verification needed
 * - Moderate: Fractions, decimals, percentages - chain-of-thought verification
 * - Complex: Algebra, equations, multi-step - Wolfram Alpha verification
 */

import type { MathDifficulty } from './types';

/**
 * Patterns that indicate complex math (algebra, equations, etc.)
 */
const COMPLEX_PATTERNS = [
  // Variables in equations
  /[a-z]\s*[=+\-*/]/i,
  /[+\-*/=]\s*[a-z]/i,

  // Word problem indicators
  /solve\s+(for|the)/i,
  /find\s+(the|x|y)/i,
  /equation/i,
  /simplify/i,
  /factor/i,
  /expand/i,

  // Exponents greater than 1
  /\^[2-9]/,
  /\^{[2-9]/,
  /squared/i,
  /cubed/i,

  // Square roots
  /sqrt|√/i,
  /\\sqrt/,
  /square\s*root/i,

  // Parenthetical expressions with operations
  /\([^)]+[+\-*/][^)]+\)\s*[*/+\-]/,

  // Systems of equations
  /and\s+[a-z]\s*[=+\-]/i,

  // Inequalities
  /[<>≤≥]/,
  /less\s+than/i,
  /greater\s+than/i,

  // Absolute value
  /\|[^|]+\|/,
  /absolute/i,

  // Logarithms
  /log|ln/i,

  // Trigonometry
  /sin|cos|tan|cot|sec|csc/i,
];

/**
 * Patterns that indicate moderate difficulty (fractions, decimals, etc.)
 */
const MODERATE_PATTERNS = [
  // Fractions
  /\\frac/,
  /\d+\s*\/\s*\d+/,
  /fraction/i,

  // Decimals in calculations
  /\d+\.\d+\s*[+\-*/]/,
  /[+\-*/]\s*\d+\.\d+/,

  // Percentages
  /%/,
  /percent/i,

  // Mixed numbers (2 1/2)
  /\d+\s+\d+\s*\/\s*\d+/,

  // Simple exponents (^1, simple powers)
  /\^1\b/,
  /\^{1}/,

  // Order of operations with multiple operations
  /[+\-]\s*\d+\s*[*/]\s*\d+/,
  /\d+\s*[*/]\s*\d+\s*[+\-]/,

  // Negative numbers in operations
  /-\d+\s*[+\-*/]/,
  /[+\-*/]\s*-\d+/,

  // Ratio/proportion
  /ratio/i,
  /proportion/i,
  /:\s*\d+/,

  // Multi-step problems (3 or more numbers with operations)
  /\d+\s*[+\-*/]\s*\d+\s*[+\-*/]\s*\d+/,
];

/**
 * Classify the difficulty of a math problem
 *
 * @param problemText - The math problem text (can be LaTeX or plain text)
 * @returns MathDifficulty - 'simple', 'moderate', or 'complex'
 */
export function classifyDifficulty(problemText: string): MathDifficulty {
  if (!problemText || problemText.trim().length === 0) {
    return 'simple';
  }

  const normalized = problemText.trim();

  // Check for complex patterns first (most restrictive)
  for (const pattern of COMPLEX_PATTERNS) {
    if (pattern.test(normalized)) {
      return 'complex';
    }
  }

  // Check for moderate patterns
  for (const pattern of MODERATE_PATTERNS) {
    if (pattern.test(normalized)) {
      return 'moderate';
    }
  }

  // Default to simple (basic arithmetic)
  return 'simple';
}

/**
 * Get a human-readable description of why a problem was classified a certain way
 *
 * @param problemText - The math problem text
 * @returns Object with difficulty and reason
 */
export function classifyWithReason(problemText: string): {
  difficulty: MathDifficulty;
  reason: string;
  matchedPattern?: string;
} {
  if (!problemText || problemText.trim().length === 0) {
    return {
      difficulty: 'simple',
      reason: 'Empty or missing problem text',
    };
  }

  const normalized = problemText.trim();

  // Check complex patterns
  for (const pattern of COMPLEX_PATTERNS) {
    if (pattern.test(normalized)) {
      return {
        difficulty: 'complex',
        reason: 'Contains algebraic variables, equations, or advanced operations',
        matchedPattern: pattern.toString(),
      };
    }
  }

  // Check moderate patterns
  for (const pattern of MODERATE_PATTERNS) {
    if (pattern.test(normalized)) {
      return {
        difficulty: 'moderate',
        reason: 'Contains fractions, decimals, percentages, or multi-step operations',
        matchedPattern: pattern.toString(),
      };
    }
  }

  return {
    difficulty: 'simple',
    reason: 'Basic arithmetic with integers',
  };
}

/**
 * Batch classify multiple problems
 *
 * @param problems - Array of problem texts
 * @returns Array of MathDifficulty classifications
 */
export function classifyBatch(problems: string[]): MathDifficulty[] {
  return problems.map(classifyDifficulty);
}

/**
 * Get the highest difficulty from a set of problems
 * Useful for determining the overall verification strategy for a worksheet
 *
 * @param problems - Array of problem texts
 * @returns The highest difficulty level found
 */
export function getMaxDifficulty(problems: string[]): MathDifficulty {
  const difficulties = classifyBatch(problems);

  if (difficulties.includes('complex')) {
    return 'complex';
  }
  if (difficulties.includes('moderate')) {
    return 'moderate';
  }
  return 'simple';
}

/**
 * Determine if a problem requires Wolfram verification
 */
export function requiresWolframVerification(problemText: string): boolean {
  return classifyDifficulty(problemText) === 'complex';
}

/**
 * Determine if a problem requires any verification
 */
export function requiresVerification(problemText: string): boolean {
  const difficulty = classifyDifficulty(problemText);
  return difficulty === 'complex' || difficulty === 'moderate';
}
