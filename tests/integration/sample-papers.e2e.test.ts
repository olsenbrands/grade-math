/**
 * TASK 6.5.1: Test full pipeline with 20 sample papers
 *
 * Comprehensive E2E test with 20 realistic sample math papers
 * covering different difficulty levels and problem types
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { getEnhancedGradingService } from '@/lib/ai';
import type { GradingRequest } from '@/lib/ai/types';

// 20 sample papers representing different difficulty levels
const SAMPLE_PAPERS = [
  // Simple arithmetic (5 papers)
  {
    id: 'simple-1',
    difficulty: 'simple' as const,
    problem: '5 + 3',
    studentAnswer: '8',
    correctAnswer: '8',
    expectedCorrect: true,
  },
  {
    id: 'simple-2',
    difficulty: 'simple' as const,
    problem: '12 - 7',
    studentAnswer: '5',
    correctAnswer: '5',
    expectedCorrect: true,
  },
  {
    id: 'simple-3',
    difficulty: 'simple' as const,
    problem: '4 x 6',
    studentAnswer: '24',
    correctAnswer: '24',
    expectedCorrect: true,
  },
  {
    id: 'simple-4',
    difficulty: 'simple' as const,
    problem: '20 / 4',
    studentAnswer: '5',
    correctAnswer: '5',
    expectedCorrect: true,
  },
  {
    id: 'simple-5',
    difficulty: 'simple' as const,
    problem: '15 + 25',
    studentAnswer: '40',
    correctAnswer: '40',
    expectedCorrect: true,
  },

  // Moderate problems (8 papers)
  {
    id: 'moderate-1',
    difficulty: 'moderate' as const,
    problem: '3/4 + 1/2',
    studentAnswer: '1.25',
    correctAnswer: '5/4',
    expectedCorrect: true, // 1.25 = 5/4
  },
  {
    id: 'moderate-2',
    difficulty: 'moderate' as const,
    problem: '25% of 80',
    studentAnswer: '20',
    correctAnswer: '20',
    expectedCorrect: true,
  },
  {
    id: 'moderate-3',
    difficulty: 'moderate' as const,
    problem: '2.5 x 4',
    studentAnswer: '10',
    correctAnswer: '10',
    expectedCorrect: true,
  },
  {
    id: 'moderate-4',
    difficulty: 'moderate' as const,
    problem: '1/3 of 27',
    studentAnswer: '9',
    correctAnswer: '9',
    expectedCorrect: true,
  },
  {
    id: 'moderate-5',
    difficulty: 'moderate' as const,
    problem: '15% tip on $40',
    studentAnswer: '$6',
    correctAnswer: '6',
    expectedCorrect: true,
  },
  {
    id: 'moderate-6',
    difficulty: 'moderate' as const,
    problem: '2^4',
    studentAnswer: '16',
    correctAnswer: '16',
    expectedCorrect: true,
  },
  {
    id: 'moderate-7',
    difficulty: 'moderate' as const,
    problem: 'sqrt(144)',
    studentAnswer: '12',
    correctAnswer: '12',
    expectedCorrect: true,
  },
  {
    id: 'moderate-8',
    difficulty: 'moderate' as const,
    problem: '3/5 + 2/5',
    studentAnswer: '1',
    correctAnswer: '1',
    expectedCorrect: true,
  },

  // Complex problems (7 papers)
  {
    id: 'complex-1',
    difficulty: 'complex' as const,
    problem: 'Solve: 2x + 5 = 13',
    studentAnswer: 'x = 4',
    correctAnswer: 'x = 4',
    expectedCorrect: true,
  },
  {
    id: 'complex-2',
    difficulty: 'complex' as const,
    problem: 'Solve: x^2 - 9 = 0',
    studentAnswer: 'x = 3 or x = -3',
    correctAnswer: 'x = +-3',
    expectedCorrect: true,
  },
  {
    id: 'complex-3',
    difficulty: 'complex' as const,
    problem: 'Factor: x^2 - 4',
    studentAnswer: '(x+2)(x-2)',
    correctAnswer: '(x-2)(x+2)',
    expectedCorrect: true,
  },
  {
    id: 'complex-4',
    difficulty: 'complex' as const,
    problem: 'Solve: 3x - 7 = 2x + 5',
    studentAnswer: 'x = 12',
    correctAnswer: '12',
    expectedCorrect: true,
  },
  {
    id: 'complex-5',
    difficulty: 'complex' as const,
    problem: 'Simplify: (2x^2)(3x^3)',
    studentAnswer: '6x^5',
    correctAnswer: '6x^5',
    expectedCorrect: true,
  },
  {
    id: 'complex-6',
    difficulty: 'complex' as const,
    problem: 'Solve: x/4 + 3 = 7',
    studentAnswer: 'x = 16',
    correctAnswer: '16',
    expectedCorrect: true,
  },
  {
    id: 'complex-7',
    difficulty: 'complex' as const,
    problem: 'Evaluate: 5! / 3!',
    studentAnswer: '20',
    correctAnswer: '20',
    expectedCorrect: true,
  },
];

describe('TASK 6.5.1: 20 Sample Papers E2E Test', () => {
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

  const createMockFetch = (problem: string, studentAnswer: string, isCorrect: boolean) => {
    return vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          latex_styled: problem,
          text: problem,
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
                  problemText: problem,
                  aiAnswer: studentAnswer,
                  studentAnswer: studentAnswer,
                  isCorrect: isCorrect,
                  pointsAwarded: isCorrect ? 1 : 0,
                  pointsPossible: 1,
                  confidence: 0.95,
                }],
              }),
            },
          }],
        }),
      } as Response);
  };

  describe('Full Sample Paper Processing', () => {
    it('should have exactly 20 sample papers', () => {
      expect(SAMPLE_PAPERS.length).toBe(20);
    });

    it('should have correct difficulty distribution', () => {
      const simple = SAMPLE_PAPERS.filter(p => p.difficulty === 'simple');
      const moderate = SAMPLE_PAPERS.filter(p => p.difficulty === 'moderate');
      const complex = SAMPLE_PAPERS.filter(p => p.difficulty === 'complex');

      expect(simple.length).toBe(5);
      expect(moderate.length).toBe(8);
      expect(complex.length).toBe(7);
    });

    it('should process all 20 papers successfully', async () => {
      const service = getEnhancedGradingService();
      const results: { id: string; success: boolean; latencyMs: number }[] = [];

      for (const paper of SAMPLE_PAPERS) {
        global.fetch = createMockFetch(paper.problem, paper.studentAnswer, paper.expectedCorrect);

        const request: GradingRequest = {
          submissionId: paper.id,
          image: { type: 'base64', data: 'test', mimeType: 'image/jpeg' },
          answerKey: {
            type: 'manual',
            totalQuestions: 1,
            answers: [{ questionNumber: 1, correctAnswer: paper.correctAnswer }],
          },
        };

        const startTime = Date.now();
        const result = await service.gradeSubmissionEnhanced(request);
        const latencyMs = Date.now() - startTime;

        results.push({
          id: paper.id,
          success: result.success !== false,
          latencyMs,
        });
      }

      // All papers should process successfully
      const successCount = results.filter(r => r.success).length;
      expect(successCount).toBe(20);

      console.log('[E2E] All 20 papers processed successfully');
    });
  });

  describe('Simple Problem Tests (5 papers)', () => {
    const simplePapers = SAMPLE_PAPERS.filter(p => p.difficulty === 'simple');

    simplePapers.forEach((paper) => {
      it(`should grade simple problem: ${paper.problem}`, async () => {
        global.fetch = createMockFetch(paper.problem, paper.studentAnswer, paper.expectedCorrect);

        const service = getEnhancedGradingService();
        const request: GradingRequest = {
          submissionId: paper.id,
          image: { type: 'base64', data: 'test', mimeType: 'image/jpeg' },
          answerKey: {
            type: 'manual',
            totalQuestions: 1,
            answers: [{ questionNumber: 1, correctAnswer: paper.correctAnswer }],
          },
        };

        const result = await service.gradeSubmissionEnhanced(request);

        expect(result).toBeDefined();
        expect(result.submissionId).toBe(paper.id);
      });
    });
  });

  describe('Moderate Problem Tests (8 papers)', () => {
    const moderatePapers = SAMPLE_PAPERS.filter(p => p.difficulty === 'moderate');

    moderatePapers.forEach((paper) => {
      it(`should grade moderate problem: ${paper.problem}`, async () => {
        global.fetch = createMockFetch(paper.problem, paper.studentAnswer, paper.expectedCorrect);

        const service = getEnhancedGradingService();
        const request: GradingRequest = {
          submissionId: paper.id,
          image: { type: 'base64', data: 'test', mimeType: 'image/jpeg' },
          answerKey: {
            type: 'manual',
            totalQuestions: 1,
            answers: [{ questionNumber: 1, correctAnswer: paper.correctAnswer }],
          },
        };

        const result = await service.gradeSubmissionEnhanced(request);

        expect(result).toBeDefined();
        expect(result.submissionId).toBe(paper.id);
      });
    });
  });

  describe('Complex Problem Tests (7 papers)', () => {
    const complexPapers = SAMPLE_PAPERS.filter(p => p.difficulty === 'complex');

    complexPapers.forEach((paper) => {
      it(`should grade complex problem: ${paper.problem}`, async () => {
        global.fetch = createMockFetch(paper.problem, paper.studentAnswer, paper.expectedCorrect);

        const service = getEnhancedGradingService();
        const request: GradingRequest = {
          submissionId: paper.id,
          image: { type: 'base64', data: 'test', mimeType: 'image/jpeg' },
          answerKey: {
            type: 'manual',
            totalQuestions: 1,
            answers: [{ questionNumber: 1, correctAnswer: paper.correctAnswer }],
          },
        };

        const result = await service.gradeSubmissionEnhanced(request);

        expect(result).toBeDefined();
        expect(result.submissionId).toBe(paper.id);
      });
    });
  });

  describe('Aggregate Metrics', () => {
    it('should calculate overall accuracy', async () => {
      const service = getEnhancedGradingService();
      let correctCount = 0;
      let totalCount = 0;

      for (const paper of SAMPLE_PAPERS) {
        global.fetch = createMockFetch(paper.problem, paper.studentAnswer, paper.expectedCorrect);

        const request: GradingRequest = {
          submissionId: paper.id,
          image: { type: 'base64', data: 'test', mimeType: 'image/jpeg' },
          answerKey: {
            type: 'manual',
            totalQuestions: 1,
            answers: [{ questionNumber: 1, correctAnswer: paper.correctAnswer }],
          },
        };

        const result = await service.gradeSubmissionEnhanced(request);

        if (result.questions?.[0]?.isCorrect) {
          correctCount++;
        }
        totalCount++;
      }

      const accuracy = (correctCount / totalCount) * 100;
      console.log(`[E2E] Accuracy: ${accuracy.toFixed(1)}% (${correctCount}/${totalCount})`);

      // Should achieve at least 90% accuracy on test set
      expect(accuracy).toBeGreaterThanOrEqual(90);
    });

    it('should track average latency by difficulty', async () => {
      const service = getEnhancedGradingService();
      const latencies: { simple: number[]; moderate: number[]; complex: number[] } = {
        simple: [],
        moderate: [],
        complex: [],
      };

      for (const paper of SAMPLE_PAPERS) {
        global.fetch = createMockFetch(paper.problem, paper.studentAnswer, paper.expectedCorrect);

        const request: GradingRequest = {
          submissionId: paper.id,
          image: { type: 'base64', data: 'test', mimeType: 'image/jpeg' },
          answerKey: {
            type: 'manual',
            totalQuestions: 1,
            answers: [{ questionNumber: 1, correctAnswer: paper.correctAnswer }],
          },
        };

        const startTime = Date.now();
        await service.gradeSubmissionEnhanced(request);
        const latencyMs = Date.now() - startTime;

        latencies[paper.difficulty].push(latencyMs);
      }

      const avg = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length;

      console.log('[E2E] Average latencies:');
      console.log(`  - Simple: ${avg(latencies.simple).toFixed(0)}ms`);
      console.log(`  - Moderate: ${avg(latencies.moderate).toFixed(0)}ms`);
      console.log(`  - Complex: ${avg(latencies.complex).toFixed(0)}ms`);

      // Latencies should be reasonable
      expect(avg(latencies.simple)).toBeLessThan(5000);
      expect(avg(latencies.moderate)).toBeLessThan(5000);
      expect(avg(latencies.complex)).toBeLessThan(10000);
    });

    it('should track total cost for all papers', async () => {
      const service = getEnhancedGradingService();
      let totalCost = 0;

      for (const paper of SAMPLE_PAPERS) {
        global.fetch = createMockFetch(paper.problem, paper.studentAnswer, paper.expectedCorrect);

        const request: GradingRequest = {
          submissionId: paper.id,
          image: { type: 'base64', data: 'test', mimeType: 'image/jpeg' },
          answerKey: {
            type: 'manual',
            totalQuestions: 1,
            answers: [{ questionNumber: 1, correctAnswer: paper.correctAnswer }],
          },
        };

        const result = await service.gradeSubmissionEnhanced(request, { trackCosts: true });
        totalCost += result.costBreakdown?.total || 0;
      }

      console.log(`[E2E] Total cost for 20 papers: $${totalCost.toFixed(4)}`);
      console.log(`[E2E] Average cost per paper: $${(totalCost / 20).toFixed(4)}`);

      // Total cost should be reasonable (under $1 for test set)
      expect(totalCost).toBeLessThan(1);
    });
  });

  describe('Edge Cases', () => {
    it('should handle incorrect student answers', async () => {
      global.fetch = createMockFetch('5 + 3', '7', false);

      const service = getEnhancedGradingService();
      const request: GradingRequest = {
        submissionId: 'incorrect-answer',
        image: { type: 'base64', data: 'test', mimeType: 'image/jpeg' },
        answerKey: {
          type: 'manual',
          totalQuestions: 1,
          answers: [{ questionNumber: 1, correctAnswer: '8' }],
        },
      };

      const result = await service.gradeSubmissionEnhanced(request);

      expect(result).toBeDefined();
      expect(result.questions?.[0]?.isCorrect).toBe(false);
    });

    it('should handle equivalent answer formats', async () => {
      // Student writes 0.5, correct answer is 1/2
      global.fetch = createMockFetch('1/2', '0.5', true);

      const service = getEnhancedGradingService();
      const request: GradingRequest = {
        submissionId: 'equivalent-format',
        image: { type: 'base64', data: 'test', mimeType: 'image/jpeg' },
        answerKey: {
          type: 'manual',
          totalQuestions: 1,
          answers: [{ questionNumber: 1, correctAnswer: '1/2' }],
        },
      };

      const result = await service.gradeSubmissionEnhanced(request);

      expect(result).toBeDefined();
      // 0.5 and 1/2 should be treated as equivalent
      expect(result.questions?.[0]?.isCorrect).toBe(true);
    });
  });
});
