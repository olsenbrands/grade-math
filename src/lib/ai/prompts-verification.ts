/**
 * Chain-of-Thought Verification Prompts
 *
 * Prompts designed to have the AI double-check its own calculations
 * using step-by-step reasoning to catch errors.
 */

/**
 * System prompt for verification pass
 * Emphasizes careful recalculation and showing work
 */
export const VERIFICATION_SYSTEM_PROMPT = `You are a math verification assistant. Your ONLY job is to verify mathematical calculations.

CRITICAL RULES:
1. You must RECALCULATE the problem from scratch - do NOT assume the given answer is correct
2. Show every step of your work clearly
3. Be extremely careful with:
   - Order of operations (PEMDAS/BODMAS)
   - Negative numbers and signs
   - Fraction arithmetic
   - Decimal places
   - Unit conversions
4. After calculating, compare your answer to the provided answer
5. State clearly whether they MATCH or DO NOT MATCH

OUTPUT FORMAT (JSON only):
{
  "steps": ["step 1 description", "step 2 description", ...],
  "calculation": "your complete calculation with work shown",
  "yourAnswer": "your calculated answer",
  "providedAnswer": "the answer you were asked to verify",
  "match": true/false,
  "confidence": 0.0-1.0,
  "discrepancy": "explanation if answers don't match, null if they match"
}

IMPORTANT: Return ONLY valid JSON, no markdown formatting, no code blocks.`;

/**
 * Build a verification prompt for a specific problem
 *
 * @param problemText - The original math problem
 * @param aiAnswer - The AI's answer to verify
 * @param studentAnswer - Optional: the student's answer for context
 * @returns Formatted verification prompt
 */
export function buildVerificationPrompt(
  problemText: string,
  aiAnswer: string,
  studentAnswer?: string
): string {
  let prompt = `VERIFICATION TASK:

Problem: ${problemText}

Answer to verify: ${aiAnswer}`;

  if (studentAnswer) {
    prompt += `
Student's answer (for context only): ${studentAnswer}`;
  }

  prompt += `

INSTRUCTIONS:
1. Read the problem carefully
2. Solve the problem yourself, showing all steps
3. Compare YOUR answer to the "Answer to verify"
4. Report whether they match

Remember: Recalculate from scratch. Do NOT assume the answer is correct.

Respond with JSON only.`;

  return prompt;
}

/**
 * Build a prompt for verifying fraction/decimal equivalence
 */
export function buildEquivalencePrompt(
  answer1: string,
  answer2: string
): string {
  return `EQUIVALENCE CHECK:

Are these two answers mathematically equivalent?

Answer 1: ${answer1}
Answer 2: ${answer2}

Consider:
- Fractions and their decimal equivalents (e.g., 1/2 = 0.5)
- Simplified vs unsimplified fractions (e.g., 2/4 = 1/2)
- Percentages and decimals (e.g., 50% = 0.5)
- Rounding differences within 0.01

Respond with JSON:
{
  "equivalent": true/false,
  "explanation": "why they are or aren't equivalent",
  "normalizedForm": "the simplest common form of both"
}`;
}

/**
 * Build a prompt for word problem verification
 * Word problems need extra care for setup and interpretation
 */
export function buildWordProblemVerificationPrompt(
  problemText: string,
  aiAnswer: string,
  aiSetup?: string
): string {
  return `WORD PROBLEM VERIFICATION:

Problem: ${problemText}

${aiSetup ? `AI's problem setup:\n${aiSetup}\n` : ''}
AI's answer: ${aiAnswer}

VERIFICATION STEPS:
1. UNDERSTAND: What is the problem actually asking for?
2. IDENTIFY: What are the given values and unknowns?
3. SETUP: Write the mathematical equation(s) needed
4. SOLVE: Calculate step by step
5. CHECK: Does your answer make sense in context?
6. COMPARE: Does your answer match the AI's answer?

Respond with JSON:
{
  "understanding": "what the problem is asking",
  "givenValues": ["list of given values"],
  "unknowns": ["list of unknowns to find"],
  "equations": ["mathematical equations needed"],
  "steps": ["step-by-step solution"],
  "yourAnswer": "your calculated answer",
  "providedAnswer": "the AI's answer",
  "match": true/false,
  "reasonableness": "does the answer make sense in context?",
  "confidence": 0.0-1.0,
  "discrepancy": "explanation if answers don't match"
}`;
}

/**
 * Build a prompt for algebraic verification
 */
export function buildAlgebraVerificationPrompt(
  problemText: string,
  aiAnswer: string
): string {
  return `ALGEBRA VERIFICATION:

Problem: ${problemText}
Answer to verify: ${aiAnswer}

VERIFICATION STEPS:
1. Identify the equation or expression
2. If solving for a variable, show each algebraic step
3. If simplifying, show the simplification process
4. Verify by substituting your answer back into the original
5. Compare with the provided answer

For equations: After solving, SUBSTITUTE your answer back to verify.
For expressions: Simplify step by step and compare.

Respond with JSON:
{
  "originalEquation": "the equation/expression",
  "algebraicSteps": ["step 1", "step 2", ...],
  "yourAnswer": "your calculated answer",
  "verification": "substitution check showing answer is correct",
  "providedAnswer": "the answer to verify",
  "match": true/false,
  "confidence": 0.0-1.0,
  "discrepancy": "explanation if answers don't match"
}`;
}

/**
 * Parse verification response from AI
 * Handles various response formats and extracts key data
 */
export interface VerificationResponse {
  yourAnswer: string;
  providedAnswer: string;
  match: boolean;
  confidence: number;
  steps?: string[];
  discrepancy?: string | null;
  calculation?: string;
}

export function parseVerificationResponse(response: string): VerificationResponse | null {
  try {
    // Try to extract JSON from the response
    let jsonStr = response.trim();

    // Remove markdown code blocks if present
    if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/```json?\n?/g, '').replace(/```\n?$/g, '');
    }

    // Find JSON object in response
    const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return null;
    }

    const parsed = JSON.parse(jsonMatch[0]);

    return {
      yourAnswer: parsed.yourAnswer || parsed.calculatedAnswer || '',
      providedAnswer: parsed.providedAnswer || parsed.givenAnswer || '',
      match: Boolean(parsed.match),
      confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.8,
      steps: parsed.steps || parsed.algebraicSteps,
      discrepancy: parsed.discrepancy,
      calculation: parsed.calculation,
    };
  } catch {
    return null;
  }
}
