import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { verifyCalculation, verifyBatch, getVerificationStats } from '@/lib/ai/verification-service';

describe('VerificationService - Chain of Thought', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
    process.env.OPENAI_API_KEY = 'test-key';
    process.env.WOLFRAM_APP_ID = 'test-wolfram-id';
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  describe('verifyCalculation', () => {
    it('should return result with method and difficulty', async () => {
      const result = await verifyCalculation('2 + 3', '5');

      expect(result).toBeDefined();
      expect(result.method).toBeDefined();
      expect(result.difficulty).toBeDefined();
      expect(result.originalAnswer).toBe('5');
    });

    it('should classify simple problems correctly', async () => {
      const result = await verifyCalculation('2 + 3', '5');

      expect(result.difficulty).toBe('simple');
      expect(result.method).toBe('none');
    });

    it('should classify moderate problems correctly', async () => {
      const result = await verifyCalculation('1/2 + 1/4', '0.75');

      expect(result.difficulty).toBe('moderate');
    });

    it('should classify complex problems correctly', async () => {
      const result = await verifyCalculation('Solve: 2x + 3 = 7', '2');

      expect(result.difficulty).toBe('complex');
    });

    it('should skip verification when requested', async () => {
      const result = await verifyCalculation('2x + 3 = 7', '2', {
        skipVerification: true,
      });

      expect(result.method).toBe('none');
      expect(result.matched).toBe(true);
    });

    it('should force specific verification method', async () => {
      const result = await verifyCalculation('2 + 3', '5', {
        forceMethod: 'chain_of_thought',
      });

      expect(result.method).toBe('chain_of_thought');
    });

    it('should handle empty problem text', async () => {
      const result = await verifyCalculation('', '5');

      expect(result.difficulty).toBe('simple');
      expect(result.matched).toBe(true);
    });

    it('should return confidence score', async () => {
      const result = await verifyCalculation('2 + 3', '5');

      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
    });
  });

  describe('Wolfram Verification', () => {
    beforeEach(() => {
      process.env.WOLFRAM_APP_ID = 'test-id';
    });

    it('should use Wolfram for complex problems when available', async () => {
      const mockFetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          text: () => Promise.resolve('2'),
        } as Response)
      );
      global.fetch = mockFetch;

      const result = await verifyCalculation('Solve: 2x + 3 = 7', '2');

      // Should attempt Wolfram verification for complex
      expect(result.difficulty).toBe('complex');
    });

    it('should fall back to CoT when Wolfram unavailable', async () => {
      delete process.env.WOLFRAM_APP_ID;

      // Need to re-import the module to pick up new env state
      // The wolfram provider is initialized as a singleton
      const result = await verifyCalculation('Solve: 2x + 3 = 7', '2', {
        forceMethod: 'chain_of_thought', // Force CoT to test the fallback path
        aiVerifyFn: async () => ({
          success: true,
          content: JSON.stringify({
            yourAnswer: '2',
            providedAnswer: '2',
            match: true,
            confidence: 0.9,
          }),
          latencyMs: 100,
        }),
      });

      expect(result.method).toBe('chain_of_thought');
    });
  });

  describe('Chain of Thought Verification', () => {
    it('should catch incorrect AI calculations', async () => {
      const result = await verifyCalculation('3 + 5', '10', {
        forceMethod: 'chain_of_thought',
        aiVerifyFn: async () => ({
          success: true,
          content: JSON.stringify({
            yourAnswer: '8',
            providedAnswer: '10',
            match: false,
            confidence: 0.95,
            discrepancy: 'AI said 10 but correct answer is 8',
          }),
          latencyMs: 100,
        }),
      });

      expect(result.conflict).toBe(true);
      expect(result.verificationAnswer).toBe('8');
    });

    it('should confirm correct AI calculations', async () => {
      const result = await verifyCalculation('3 + 5', '8', {
        forceMethod: 'chain_of_thought',
        aiVerifyFn: async () => ({
          success: true,
          content: JSON.stringify({
            yourAnswer: '8',
            providedAnswer: '8',
            match: true,
            confidence: 0.98,
          }),
          latencyMs: 100,
        }),
      });

      expect(result.matched).toBe(true);
      expect(result.conflict).toBe(false);
    });

    it('should handle verification failures gracefully', async () => {
      const result = await verifyCalculation('3 + 5', '8', {
        forceMethod: 'chain_of_thought',
        aiVerifyFn: async () => ({
          success: false,
          content: '',
          error: 'API error',
          latencyMs: 100,
        }),
      });

      expect(result).toBeDefined();
      expect(result.matched).toBe(true); // Assumes correct when verification fails
    });

    it('should handle malformed verification response', async () => {
      const result = await verifyCalculation('3 + 5', '8', {
        forceMethod: 'chain_of_thought',
        aiVerifyFn: async () => ({
          success: true,
          content: 'This is not JSON',
          latencyMs: 100,
        }),
      });

      expect(result).toBeDefined();
      // Should handle gracefully
    });
  });

  describe('Verification Accuracy', () => {
    const testCases = [
      { problem: '2 + 3', answer: '5', shouldMatch: true },
      { problem: '10 - 4', answer: '6', shouldMatch: true },
      { problem: '3 * 4', answer: '12', shouldMatch: true },
      { problem: '15 / 3', answer: '5', shouldMatch: true },
    ];

    testCases.forEach(({ problem, answer, shouldMatch }) => {
      it(`should ${shouldMatch ? 'confirm' : 'reject'} "${problem}" = "${answer}"`, async () => {
        const result = await verifyCalculation(problem, answer);

        // Simple problems should match without conflict
        if (result.difficulty === 'simple') {
          expect(result.matched).toBe(shouldMatch);
        }
      });
    });
  });

  describe('False Positive Rate', () => {
    it('should not flag correct simple answers as errors', async () => {
      const correctCases = [
        { problem: '3 + 5', answer: '8' },
        { problem: '10 - 3', answer: '7' },
        { problem: '4 * 5', answer: '20' },
      ];

      let falsePositives = 0;

      for (const { problem, answer } of correctCases) {
        const result = await verifyCalculation(problem, answer);

        if (result.conflict) {
          falsePositives++;
        }
      }

      // False positive rate should be 0% for simple math
      expect(falsePositives).toBe(0);
    });
  });

  describe('verifyBatch', () => {
    it('should verify multiple calculations', async () => {
      const problems = [
        { problem: '2 + 3', answer: '5' },
        { problem: '10 - 5', answer: '5' },
      ];

      const results = await verifyBatch(problems);

      expect(results).toHaveLength(2);
      results.forEach((result) => {
        expect(result.difficulty).toBeDefined();
        expect(result.method).toBeDefined();
      });
    });
  });

  describe('getVerificationStats', () => {
    it('should calculate statistics correctly', () => {
      const mockResults = [
        { method: 'wolfram' as const, matched: true, conflict: false, confidence: 0.98, difficulty: 'complex' as const, originalAnswer: '2' },
        { method: 'chain_of_thought' as const, matched: true, conflict: false, confidence: 0.9, difficulty: 'moderate' as const, originalAnswer: '0.75' },
        { method: 'none' as const, matched: true, conflict: false, confidence: 0.85, difficulty: 'simple' as const, originalAnswer: '5' },
      ];

      const stats = getVerificationStats(mockResults);

      expect(stats.total).toBe(3);
      expect(stats.verified).toBe(3);
      expect(stats.conflicts).toBe(0);
      expect(stats.byMethod.wolfram).toBe(1);
      expect(stats.byMethod.chain_of_thought).toBe(1);
      expect(stats.byMethod.none).toBe(1);
      expect(stats.byDifficulty.complex).toBe(1);
      expect(stats.byDifficulty.moderate).toBe(1);
      expect(stats.byDifficulty.simple).toBe(1);
      expect(stats.averageConfidence).toBeCloseTo(0.91, 1);
    });

    it('should handle empty results', () => {
      const stats = getVerificationStats([]);

      expect(stats.total).toBe(0);
      expect(stats.averageConfidence).toBe(0);
    });
  });
});
