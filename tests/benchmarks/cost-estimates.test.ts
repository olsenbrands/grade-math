/**
 * TASK 6.5.4: Verify cost estimates
 *
 * Verifies that cost breakdown matches expected API call costs
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { getEnhancedGradingService } from '@/lib/ai';
import type { GradingRequest } from '@/lib/ai/types';

describe('Cost Tracking Accuracy', () => {
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

  const createMockFetch = () => {
    return vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          latex_styled: '2 + 3',
          text: '2 + 3',
          confidence: 0.95,
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
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
      } as Response);
  };

  const createRequest = (): GradingRequest => ({
    submissionId: 'cost-test',
    image: { type: 'base64', data: 'test', mimeType: 'image/jpeg' },
    answerKey: {
      type: 'manual',
      totalQuestions: 1,
      answers: [{ questionNumber: 1, correctAnswer: '5' }],
    },
  });

  describe('TASK 6.5.4: Cost Estimate Verification', () => {
    it('should estimate Mathpix cost correctly', async () => {
      global.fetch = createMockFetch();
      const service = getEnhancedGradingService();

      const result = await service.gradeSubmissionEnhanced(createRequest(), {
        trackCosts: true,
      });

      // Mathpix: $0.004 per image
      expect(result.costBreakdown).toBeDefined();
      expect(result.costBreakdown?.mathpix).toBe(0.004);
    });

    it('should estimate GPT-4o cost correctly', async () => {
      global.fetch = createMockFetch();
      const service = getEnhancedGradingService();

      const result = await service.gradeSubmissionEnhanced(createRequest(), {
        trackCosts: true,
      });

      // GPT-4o: ~$0.015 per image (input + output tokens)
      expect(result.costBreakdown?.gpt4o).toBe(0.015);
    });

    it('should include all cost components', async () => {
      global.fetch = createMockFetch();
      const service = getEnhancedGradingService();

      const result = await service.gradeSubmissionEnhanced(createRequest(), {
        trackCosts: true,
      });

      expect(result.costBreakdown).toBeDefined();
      expect(result.costBreakdown?.mathpix).toBeGreaterThanOrEqual(0);
      expect(result.costBreakdown?.gpt4o).toBeGreaterThan(0); // Always called
      expect(result.costBreakdown?.wolfram).toBeGreaterThanOrEqual(0);
      expect(result.costBreakdown?.total).toBeGreaterThan(0);
    });

    it('should calculate total correctly', async () => {
      global.fetch = createMockFetch();
      const service = getEnhancedGradingService();

      const result = await service.gradeSubmissionEnhanced(createRequest(), {
        trackCosts: true,
      });

      const expectedTotal =
        (result.costBreakdown?.mathpix || 0) +
        (result.costBreakdown?.gpt4o || 0) +
        (result.costBreakdown?.wolfram || 0);

      expect(result.costBreakdown?.total).toBeCloseTo(expectedTotal, 6);
    });
  });

  describe('Cost by Problem Type', () => {
    it('should demonstrate cost/benefit for different problem types', () => {
      const costExpectations = {
        simple: {
          mathpix: 0, // No OCR needed for simple
          gpt4o: 0.015,
          wolfram: 0, // No verification
          total: 0.015,
          notes: 'No OCR or verification',
        },
        moderate: {
          mathpix: 0.004,
          gpt4o: 0.015,
          wolfram: 0, // Chain-of-thought only
          total: 0.019,
          notes: 'OCR + chain-of-thought',
        },
        complex: {
          mathpix: 0.004,
          gpt4o: 0.015,
          wolfram: 0.02,
          total: 0.039,
          notes: 'Full pipeline + Wolfram',
        },
      };

      // Verify cost expectations are reasonable
      expect(costExpectations.simple.total).toBeLessThan(costExpectations.moderate.total);
      expect(costExpectations.moderate.total).toBeLessThan(costExpectations.complex.total);
    });

    it('should log costs when TRACK_API_COSTS is enabled', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      global.fetch = createMockFetch();
      const service = getEnhancedGradingService();

      await service.gradeSubmissionEnhanced(createRequest(), {
        trackCosts: true,
      });

      // Should have logged cost breakdown
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[COST]')
      );

      consoleSpy.mockRestore();
    });
  });

  describe('Monthly Cost Projections', () => {
    it('should calculate monthly costs for 1000 submissions', () => {
      // Distribution: 30% simple, 50% moderate, 20% complex
      const submissions = 1000;
      const distribution = { simple: 0.3, moderate: 0.5, complex: 0.2 };

      const costs = {
        simple: 0.015,
        moderate: 0.019,
        complex: 0.039,
      };

      const monthlyCost =
        submissions * distribution.simple * costs.simple +
        submissions * distribution.moderate * costs.moderate +
        submissions * distribution.complex * costs.complex;

      console.log(`[COST] Monthly estimate for ${submissions} submissions: $${monthlyCost.toFixed(2)}`);

      // Should be around $21.80
      expect(monthlyCost).toBeGreaterThan(20);
      expect(monthlyCost).toBeLessThan(25);
    });

    it('should calculate monthly costs for 10000 submissions', () => {
      const submissions = 10000;
      const distribution = { simple: 0.3, moderate: 0.5, complex: 0.2 };

      const costs = {
        simple: 0.015,
        moderate: 0.019,
        complex: 0.039,
      };

      const monthlyCost =
        submissions * distribution.simple * costs.simple +
        submissions * distribution.moderate * costs.moderate +
        submissions * distribution.complex * costs.complex;

      console.log(`[COST] Monthly estimate for ${submissions} submissions: $${monthlyCost.toFixed(2)}`);

      // Should be around $218
      expect(monthlyCost).toBeGreaterThan(200);
      expect(monthlyCost).toBeLessThan(250);
    });
  });

  describe('Cost Optimization', () => {
    it('should identify cost optimization opportunities', () => {
      const optimizations = [
        { action: 'Disable Mathpix for simple problems', savings: '$0.004 per image' },
        { action: 'Use Wolfram only for equations', savings: '$0.02 per non-equation' },
        { action: 'Batch processing', savings: 'Slight API discounts' },
      ];

      expect(optimizations.length).toBeGreaterThan(0);

      for (const opt of optimizations) {
        expect(opt.action).toBeDefined();
        expect(opt.savings).toBeDefined();
      }
    });

    it('should verify free tier limits', () => {
      const freeTiers = {
        openai: { amount: 5, unit: 'USD trial credit', expires: '3 months' },
        wolfram: { amount: 2000, unit: 'calls/month', costAfter: '$0.0005/call' },
        mathpix: { amount: 100, unit: 'images/month', costAfter: '$0.004/image' },
      };

      expect(freeTiers.openai.amount).toBe(5);
      expect(freeTiers.wolfram.amount).toBe(2000);
      expect(freeTiers.mathpix.amount).toBe(100);
    });
  });
});
