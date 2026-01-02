import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { getEnhancedGradingService } from '@/lib/ai';
import type { GradingRequest } from '@/lib/ai/types';

describe('Full Pipeline - End-to-End', () => {
  let service: ReturnType<typeof getEnhancedGradingService>;
  const originalEnv = process.env;

  beforeAll(() => {
    process.env = { ...originalEnv };
    process.env.OPENAI_API_KEY = 'test-key';
    process.env.MATHPIX_APP_ID = 'test-id';
    process.env.MATHPIX_APP_KEY = 'test-key';
    process.env.WOLFRAM_APP_ID = 'test-id';
    process.env.TRACK_API_COSTS = 'true';

    service = getEnhancedGradingService();
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('Pipeline Execution', () => {
    it('should process a simple math problem', async () => {
      // Mock the fetch calls
      global.fetch = vi.fn()
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
                  studentName: 'Test Student',
                  questions: [{
                    questionNumber: 1,
                    problemText: '2 + 3',
                    aiCalculation: '2 + 3 = 5',
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

      const request: GradingRequest = {
        submissionId: 'test-submission-1',
        image: {
          type: 'base64',
          data: 'test-base64-data',
          mimeType: 'image/jpeg',
        },
        answerKey: {
          type: 'manual',
          totalQuestions: 1,
          answers: [{ questionNumber: 1, correctAnswer: '5' }],
        },
      };

      const result = await service.gradeSubmissionEnhanced(request);

      expect(result).toBeDefined();
      expect(result.submissionId).toBe('test-submission-1');
      expect(result.questions).toBeDefined();
    });

    it('should include cost breakdown in result', async () => {
      global.fetch = vi.fn()
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

      const request: GradingRequest = {
        submissionId: 'test-cost-tracking',
        image: {
          type: 'base64',
          data: 'test-data',
          mimeType: 'image/jpeg',
        },
        answerKey: {
          type: 'manual',
          totalQuestions: 1,
          answers: [{ questionNumber: 1, correctAnswer: '5' }],
        },
      };

      const result = await service.gradeSubmissionEnhanced(request);

      expect(result.costBreakdown).toBeDefined();
      expect(result.costBreakdown?.mathpix).toBeGreaterThanOrEqual(0);
      expect(result.costBreakdown?.gpt4o).toBeGreaterThanOrEqual(0);
      expect(result.costBreakdown?.total).toBeGreaterThanOrEqual(0);
    });

    it('should include processing metrics', async () => {
      global.fetch = vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
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
                  questions: [{
                    questionNumber: 1,
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

      const request: GradingRequest = {
        submissionId: 'test-metrics',
        image: {
          type: 'base64',
          data: 'test-data',
          mimeType: 'image/jpeg',
        },
        answerKey: {
          type: 'manual',
          totalQuestions: 1,
          answers: [{ questionNumber: 1, correctAnswer: '5' }],
        },
      };

      const result = await service.gradeSubmissionEnhanced(request);

      expect(result.processingMetrics).toBeDefined();
      expect(result.processingMetrics?.totalTimeMs).toBeGreaterThanOrEqual(0);
      expect(result.processingMetrics?.aiProviderUsed).toBeDefined();
    });
  });

  describe('Difficulty Routing', () => {
    it('should route simple math to no verification', async () => {
      global.fetch = vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ text: '2 + 3', confidence: 0.95 }),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            choices: [{
              message: {
                content: JSON.stringify({
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

      const request: GradingRequest = {
        submissionId: 'simple-routing',
        image: { type: 'base64', data: 'test', mimeType: 'image/jpeg' },
        answerKey: {
          type: 'manual',
          totalQuestions: 1,
          answers: [{ questionNumber: 1, correctAnswer: '5' }],
        },
      };

      const result = await service.gradeSubmissionEnhanced(request);

      // Simple math should classify as simple difficulty
      expect(result.questions[0]?.difficultyLevel).toBe('simple');
    });
  });

  describe('Error Handling', () => {
    it('should handle AI provider failure gracefully', async () => {
      global.fetch = vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ text: '2 + 3', confidence: 0.95 }),
        } as Response)
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          statusText: 'Internal Server Error',
        } as Response);

      const request: GradingRequest = {
        submissionId: 'error-test',
        image: { type: 'base64', data: 'test', mimeType: 'image/jpeg' },
        answerKey: {
          type: 'manual',
          totalQuestions: 1,
          answers: [{ questionNumber: 1, correctAnswer: '5' }],
        },
      };

      const result = await service.gradeSubmissionEnhanced(request);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.needsReview).toBe(true);
    });

    it('should handle Mathpix failure with fallback to vision', async () => {
      // Mathpix fails, then OpenAI succeeds
      global.fetch = vi.fn()
        .mockRejectedValueOnce(new Error('Mathpix timeout'))
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            choices: [{
              message: {
                content: JSON.stringify({
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

      const request: GradingRequest = {
        submissionId: 'fallback-test',
        image: { type: 'base64', data: 'test', mimeType: 'image/jpeg' },
        answerKey: {
          type: 'manual',
          totalQuestions: 1,
          answers: [{ questionNumber: 1, correctAnswer: '5' }],
        },
      };

      const result = await service.gradeSubmissionEnhanced(request);

      // Should still succeed using vision OCR
      expect(result.ocrProvider).toBe('vision');
    });
  });

  describe('Health Check', () => {
    it('should return health status for all components', async () => {
      const health = await service.healthCheck();

      expect(health).toBeDefined();
      expect(health.providers).toBeDefined();
      expect(typeof health.mathpix).toBe('boolean');
      expect(typeof health.wolfram).toBe('boolean');
    });
  });

  describe('Available Providers', () => {
    it('should list available providers', () => {
      const providers = service.getAvailableProviders();

      expect(Array.isArray(providers)).toBe(true);
    });
  });
});
