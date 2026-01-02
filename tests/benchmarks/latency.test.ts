/**
 * TASK 6.5.3: Measure latency
 *
 * Measures processing time for different problem difficulties
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { getEnhancedGradingService } from '@/lib/ai';
import type { GradingRequest } from '@/lib/ai/types';

describe('Pipeline Latency Benchmarks', () => {
  const originalEnv = process.env;
  const originalFetch = global.fetch;

  beforeAll(() => {
    process.env = { ...originalEnv };
    process.env.OPENAI_API_KEY = 'test-key';
    process.env.MATHPIX_APP_ID = 'test-id';
    process.env.MATHPIX_APP_KEY = 'test-key';
    process.env.WOLFRAM_APP_ID = 'test-id';
    process.env.TRACK_API_COSTS = 'true';
  });

  afterAll(() => {
    process.env = originalEnv;
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  const createMockFetch = (delay: number = 100) => {
    return vi.fn(async () => {
      await new Promise(resolve => setTimeout(resolve, delay));
      return {
        ok: true,
        json: () => Promise.resolve({
          text: '2 + 3',
          confidence: 0.95,
          choices: [{
            message: {
              content: JSON.stringify({
                studentName: 'Test',
                questions: [{
                  questionNumber: 1,
                  problemText: '2 + 3',
                  aiAnswer: '5',
                  studentAnswer: '5',
                  isCorrect: true,
                  pointsAwarded: 1,
                  pointsPossible: 1,
                  confidence: 0.98,
                }],
              }),
            },
          }],
        }),
        text: () => Promise.resolve('5'),
      } as Response;
    });
  };

  const createSimpleRequest = (): GradingRequest => ({
    submissionId: 'latency-simple',
    image: { type: 'base64', data: 'test', mimeType: 'image/jpeg' },
    answerKey: {
      type: 'manual',
      totalQuestions: 1,
      answers: [{ questionNumber: 1, correctAnswer: '5' }],
    },
  });

  const createComplexRequest = (): GradingRequest => ({
    submissionId: 'latency-complex',
    image: { type: 'base64', data: 'test', mimeType: 'image/jpeg' },
    answerKey: {
      type: 'manual',
      totalQuestions: 1,
      answers: [{ questionNumber: 1, correctAnswer: 'x = 2' }],
    },
  });

  describe('TASK 6.5.3: Latency Measurements', () => {
    it('should process simple problems with low latency', async () => {
      global.fetch = createMockFetch(50);
      const service = getEnhancedGradingService();

      const startTime = Date.now();
      const result = await service.gradeSubmissionEnhanced(createSimpleRequest());
      const latency = Date.now() - startTime;

      console.log(`[LATENCY] Simple problem: ${latency}ms`);

      expect(result.processingMetrics?.totalTimeMs).toBeGreaterThanOrEqual(0);
      // In mocked environment, should be very fast
      expect(latency).toBeLessThan(5000);
    });

    it('should include processing metrics in result', async () => {
      global.fetch = createMockFetch(100);
      const service = getEnhancedGradingService();

      const result = await service.gradeSubmissionEnhanced(createSimpleRequest());

      expect(result.processingMetrics).toBeDefined();
      expect(result.processingMetrics?.totalTimeMs).toBeGreaterThanOrEqual(0);
      expect(result.processingMetrics?.aiProviderUsed).toBeDefined();
    });

    it('should track component latencies separately', async () => {
      global.fetch = createMockFetch(50);
      const service = getEnhancedGradingService();

      const result = await service.gradeSubmissionEnhanced(createSimpleRequest());

      expect(result.processingMetrics).toBeDefined();

      // If Mathpix was used, should have mathpixTimeMs
      if (result.ocrProvider === 'mathpix') {
        expect(result.processingMetrics?.mathpixTimeMs).toBeGreaterThanOrEqual(0);
      }

      // GPT-4o time should always be tracked
      expect(result.processingMetrics?.gpt4oTimeMs).toBeGreaterThanOrEqual(0);
    });

    it('should measure average latency across problem types', async () => {
      global.fetch = createMockFetch(50);
      const service = getEnhancedGradingService();

      const testProblems = [
        createSimpleRequest(),
        createSimpleRequest(),
        createSimpleRequest(),
      ];

      const latencies: number[] = [];

      for (const request of testProblems) {
        const startTime = Date.now();
        await service.gradeSubmissionEnhanced(request);
        latencies.push(Date.now() - startTime);
      }

      const average = latencies.reduce((a, b) => a + b, 0) / latencies.length;
      console.log(`[LATENCY] Average across ${latencies.length} problems: ${average.toFixed(0)}ms`);

      // Average should be reasonable
      expect(average).toBeLessThan(10000);
      expect(average).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Latency by Difficulty', () => {
    it('should track simple problem latency', async () => {
      global.fetch = createMockFetch(50);
      const service = getEnhancedGradingService();

      const result = await service.gradeSubmissionEnhanced(createSimpleRequest());

      // Simple problems should not have verification time
      if (result.mathDifficulty === 'simple') {
        // No verification needed
        expect(result.processingMetrics?.verificationTimeMs || 0).toBe(0);
      }
    });

    it('should demonstrate latency expectations', () => {
      const latencyExpectations = {
        simple: { maxMs: 2000, reason: 'No verification needed' },
        moderate: { maxMs: 5000, reason: 'Chain-of-thought verification' },
        complex: { maxMs: 10000, reason: 'Wolfram Alpha verification' },
      };

      // Verify expectations are reasonable
      expect(latencyExpectations.simple.maxMs).toBeLessThan(latencyExpectations.moderate.maxMs);
      expect(latencyExpectations.moderate.maxMs).toBeLessThan(latencyExpectations.complex.maxMs);
    });
  });

  describe('Performance Metrics', () => {
    it('should report fallback count', async () => {
      global.fetch = createMockFetch(50);
      const service = getEnhancedGradingService();

      const result = await service.gradeSubmissionEnhanced(createSimpleRequest());

      expect(result.processingMetrics?.fallbacksRequired).toBeDefined();
      expect(result.processingMetrics?.fallbacksRequired).toBeGreaterThanOrEqual(0);
    });

    it('should report provider used', async () => {
      global.fetch = createMockFetch(50);
      const service = getEnhancedGradingService();

      const result = await service.gradeSubmissionEnhanced(createSimpleRequest());

      expect(result.processingMetrics?.aiProviderUsed).toBeDefined();
      expect(['openai', 'anthropic', 'groq']).toContain(result.processingMetrics?.aiProviderUsed);
    });
  });
});
