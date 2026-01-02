/**
 * Answer Comparator
 *
 * Compares answers from different sources (AI, Wolfram, student)
 * Handles equivalent forms: fractions ↔ decimals ↔ percentages
 */

import type { ComparisonResult } from './types';

/**
 * Compare two answers, handling equivalent forms
 *
 * @param answer1 - First answer (e.g., AI's answer)
 * @param answer2 - Second answer (e.g., Wolfram's answer)
 * @param tolerance - Numeric tolerance for floating point comparison (default: 0.0001)
 * @returns ComparisonResult with match status and method used
 */
export function compareAnswers(
  answer1: string,
  answer2: string,
  tolerance: number = 0.0001
): ComparisonResult {
  // Handle null/undefined/empty
  if (!answer1 || !answer2) {
    return { matched: false };
  }

  // Normalize both answers
  const norm1 = normalizeAnswer(answer1);
  const norm2 = normalizeAnswer(answer2);

  // 1. Direct string match (case-insensitive)
  if (norm1 === norm2) {
    return { matched: true, method: 'exact' };
  }

  // 2. Numeric comparison with tolerance
  const num1 = parseNumeric(norm1);
  const num2 = parseNumeric(norm2);

  if (num1 !== null && num2 !== null) {
    if (Math.abs(num1 - num2) < tolerance) {
      return { matched: true, method: 'numeric' };
    }
    // Also check relative tolerance for larger numbers
    const relTolerance = Math.max(Math.abs(num1), Math.abs(num2)) * 0.0001;
    if (Math.abs(num1 - num2) < relTolerance) {
      return { matched: true, method: 'numeric' };
    }
  }

  // 3. Fraction equivalence
  const frac1 = parseFraction(answer1);
  const frac2 = parseFraction(answer2);

  if (frac1 && frac2) {
    // Cross multiply to check equivalence: a/b = c/d if a*d = b*c
    if (frac1.numerator * frac2.denominator === frac2.numerator * frac1.denominator) {
      return { matched: true, method: 'fraction' };
    }
  }

  // 4. Fraction to decimal comparison
  if (frac1 && num2 !== null) {
    const fracValue = frac1.numerator / frac1.denominator;
    if (Math.abs(fracValue - num2) < tolerance) {
      return { matched: true, method: 'fraction' };
    }
  }
  if (frac2 && num1 !== null) {
    const fracValue = frac2.numerator / frac2.denominator;
    if (Math.abs(fracValue - num1) < tolerance) {
      return { matched: true, method: 'fraction' };
    }
  }

  // 5. Percentage comparison
  const pct1 = parsePercentage(answer1);
  const pct2 = parsePercentage(answer2);

  if (pct1 !== null && pct2 !== null) {
    if (Math.abs(pct1 - pct2) < tolerance) {
      return { matched: true, method: 'percentage' };
    }
  }

  // Percentage to decimal comparison
  if (pct1 !== null && num2 !== null) {
    // 50% = 0.5
    if (Math.abs(pct1 / 100 - num2) < tolerance) {
      return { matched: true, method: 'percentage' };
    }
  }
  if (pct2 !== null && num1 !== null) {
    if (Math.abs(pct2 / 100 - num1) < tolerance) {
      return { matched: true, method: 'percentage' };
    }
  }

  // No match found
  return {
    matched: false,
    aiNormalized: norm1,
    verifyNormalized: norm2,
  };
}

/**
 * Normalize an answer string for comparison
 */
export function normalizeAnswer(answer: string): string {
  let normalized = answer.trim().toLowerCase();

  // Remove leading/trailing whitespace
  normalized = normalized.replace(/^\s+|\s+$/g, '');

  // Remove leading equals sign or colon
  normalized = normalized.replace(/^[=:]\s*/, '');

  // Remove commas (thousands separators)
  normalized = normalized.replace(/,/g, '');

  // Remove trailing .0 or .00 etc
  normalized = normalized.replace(/\.0+$/, '');

  // Normalize whitespace
  normalized = normalized.replace(/\s+/g, ' ');

  // Remove units (common in word problems)
  normalized = normalized.replace(/\s*(dollars?|cents?|meters?|feet|inches|cm|mm|kg|g|lbs?|oz)\s*$/i, '');

  // Remove currency symbols
  normalized = normalized.replace(/^\$\s*/, '');

  return normalized;
}

/**
 * Parse a string as a numeric value
 * Returns null if not a valid number
 */
export function parseNumeric(str: string): number | null {
  const normalized = normalizeAnswer(str);

  // Try direct parse
  const direct = parseFloat(normalized);
  if (!isNaN(direct) && isFinite(direct)) {
    return direct;
  }

  // Try parsing as fraction
  const frac = parseFraction(str);
  if (frac) {
    return frac.numerator / frac.denominator;
  }

  // Try parsing as percentage
  const pct = parsePercentage(str);
  if (pct !== null) {
    return pct / 100;
  }

  return null;
}

/**
 * Parse a fraction string
 * Supports: "3/4", "3 / 4", "-3/4", "1 1/2" (mixed numbers)
 */
export function parseFraction(str: string): { numerator: number; denominator: number } | null {
  const normalized = str.trim();

  // Mixed number: "1 1/2" -> 3/2
  const mixedMatch = normalized.match(/^(-?\d+)\s+(\d+)\s*\/\s*(\d+)$/);
  if (mixedMatch && mixedMatch[1] && mixedMatch[2] && mixedMatch[3]) {
    const whole = parseInt(mixedMatch[1], 10);
    const num = parseInt(mixedMatch[2], 10);
    const den = parseInt(mixedMatch[3], 10);
    if (den === 0) return null;
    const sign = whole < 0 ? -1 : 1;
    return {
      numerator: sign * (Math.abs(whole) * den + num),
      denominator: den,
    };
  }

  // Simple fraction: "3/4"
  const fractionMatch = normalized.match(/^(-?\d+)\s*\/\s*(\d+)$/);
  if (fractionMatch && fractionMatch[1] && fractionMatch[2]) {
    const num = parseInt(fractionMatch[1], 10);
    const den = parseInt(fractionMatch[2], 10);
    if (den === 0) return null;
    return { numerator: num, denominator: den };
  }

  return null;
}

/**
 * Parse a percentage string
 * Supports: "50%", "50 %", "50 percent", "50.5%"
 */
export function parsePercentage(str: string): number | null {
  const normalized = str.trim().toLowerCase();

  // Match patterns like "50%", "50 %", "50percent"
  const match = normalized.match(/^(-?\d+\.?\d*)\s*(%|percent)$/);
  if (match && match[1]) {
    return parseFloat(match[1]);
  }

  return null;
}

/**
 * Check if two answers are equivalent (convenience function)
 */
export function areAnswersEquivalent(
  answer1: string,
  answer2: string,
  tolerance: number = 0.0001
): boolean {
  return compareAnswers(answer1, answer2, tolerance).matched;
}

/**
 * Format an answer for display (normalize common representations)
 */
export function formatAnswer(answer: string): string {
  const normalized = normalizeAnswer(answer);

  // If it's a simple integer, return as-is
  if (/^-?\d+$/.test(normalized)) {
    return normalized;
  }

  // If it's a decimal that can be a clean fraction, show as fraction
  const num = parseFloat(normalized);
  if (!isNaN(num)) {
    // Check for common fractions
    const commonFractions: Record<number, string> = {
      0.5: '1/2',
      0.25: '1/4',
      0.75: '3/4',
      0.333: '1/3',
      0.667: '2/3',
      0.2: '1/5',
      0.4: '2/5',
      0.6: '3/5',
      0.8: '4/5',
    };

    for (const [decimal, fraction] of Object.entries(commonFractions)) {
      if (Math.abs(num - parseFloat(decimal)) < 0.01) {
        return `${normalized} (${fraction})`;
      }
    }
  }

  return normalized;
}
