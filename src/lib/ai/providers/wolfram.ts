/**
 * Wolfram Alpha Provider
 *
 * Uses Wolfram Alpha Short Answers API for mathematical computation verification
 * Provides independent calculation to double-check AI grading results
 *
 * API Documentation: https://products.wolframalpha.com/short-answers-api/documentation
 */

import type { WolframConfig, WolframResult } from '../types';

// Short Answers API - returns just the answer as plain text
const WOLFRAM_API_URL = 'https://api.wolframalpha.com/v1/result';

export class WolframProvider {
  private config: WolframConfig;

  constructor(config?: Partial<WolframConfig>) {
    this.config = {
      appId: config?.appId || process.env.WOLFRAM_APP_ID || '',
      timeout: config?.timeout || 10000,
    };
  }

  /**
   * Check if Wolfram Alpha is configured
   */
  isAvailable(): boolean {
    return !!this.config.appId;
  }

  /**
   * Check if Wolfram verification is enabled
   * Now always enabled if credentials are present (feature flag removed)
   */
  isEnabled(): boolean {
    // Wolfram verification is now always enabled if credentials are present
    // No feature flag needed - it's production ready
    return this.isAvailable();
  }

  /**
   * Solve a mathematical expression using Wolfram Alpha
   *
   * @param expression - Math expression (plain text, LaTeX, or equation)
   * @returns WolframResult with computed answer
   */
  async solve(expression: string): Promise<WolframResult> {
    const startTime = Date.now();

    if (!this.isAvailable()) {
      return {
        success: false,
        input: expression,
        confidence: 0,
        error: 'Wolfram Alpha API not configured (missing APP_ID)',
        latencyMs: Date.now() - startTime,
      };
    }

    try {
      // Clean and normalize the expression for Wolfram
      const cleanedExpression = this.normalizeExpression(expression);

      const params = new URLSearchParams({
        appid: this.config.appId,
        i: cleanedExpression,
      });

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

      const response = await fetch(`${WOLFRAM_API_URL}?${params}`, {
        method: 'GET',
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        // Wolfram returns 501 for queries it can't understand
        if (response.status === 501) {
          return {
            success: false,
            input: expression,
            confidence: 0,
            error: 'Wolfram Alpha could not interpret the expression',
            latencyMs: Date.now() - startTime,
          };
        }

        const errorText = await response.text();
        return {
          success: false,
          input: expression,
          confidence: 0,
          error: `Wolfram Alpha API error: ${response.status} - ${errorText}`,
          latencyMs: Date.now() - startTime,
        };
      }

      // Short Answers API returns plain text
      const result = await response.text();

      return {
        success: true,
        input: expression,
        result: result.trim(),
        confidence: 0.95, // Wolfram is highly accurate when it returns a result
        latencyMs: Date.now() - startTime,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.name === 'AbortError'
            ? 'Wolfram Alpha request timeout'
            : error.message
          : 'Unknown Wolfram Alpha error';

      return {
        success: false,
        input: expression,
        confidence: 0,
        error: errorMessage,
        latencyMs: Date.now() - startTime,
      };
    }
  }

  /**
   * Normalize mathematical expression for Wolfram Alpha
   * Converts LaTeX and common notations to Wolfram-compatible format
   */
  private normalizeExpression(expr: string): string {
    let normalized = expr.trim();

    // Remove trailing equals signs (common in homework problems)
    normalized = normalized.replace(/\s*=\s*$/, '');

    // Convert LaTeX fractions: \frac{a}{b} -> a/b
    normalized = normalized.replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, '($1)/($2)');

    // Convert LaTeX multiplication symbols
    normalized = normalized.replace(/\\times/g, '*');
    normalized = normalized.replace(/\\cdot/g, '*');

    // Convert LaTeX division
    normalized = normalized.replace(/\\div/g, '/');

    // Convert LaTeX square root: \sqrt{x} -> sqrt(x)
    normalized = normalized.replace(/\\sqrt\{([^}]+)\}/g, 'sqrt($1)');

    // Convert superscripts: x^{2} -> x^2
    normalized = normalized.replace(/\^{([^}]+)}/g, '^$1');

    // Convert common Unicode math symbols
    normalized = normalized.replace(/×/g, '*');
    normalized = normalized.replace(/÷/g, '/');
    normalized = normalized.replace(/−/g, '-');
    normalized = normalized.replace(/√/g, 'sqrt');

    // Handle percentage: 15% of 80 -> 15% * 80
    // Wolfram understands "15% of 80" directly, so we leave it

    // Clean up extra whitespace
    normalized = normalized.replace(/\s+/g, ' ').trim();

    return normalized;
  }

  /**
   * Solve multiple expressions in batch
   * Note: Makes sequential calls as Wolfram doesn't have a batch API
   */
  async solveBatch(expressions: string[]): Promise<WolframResult[]> {
    const results: WolframResult[] = [];

    for (const expr of expressions) {
      const result = await this.solve(expr);
      results.push(result);

      // Small delay between requests to avoid rate limiting
      if (expressions.indexOf(expr) < expressions.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    return results;
  }
}

// Singleton instance
let wolframInstance: WolframProvider | null = null;

export function getWolframProvider(): WolframProvider {
  if (!wolframInstance) {
    wolframInstance = new WolframProvider();
  }
  return wolframInstance;
}

export function createWolframProvider(config?: Partial<WolframConfig>): WolframProvider {
  return new WolframProvider(config);
}
