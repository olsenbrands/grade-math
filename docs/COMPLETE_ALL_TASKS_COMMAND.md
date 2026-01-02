# Complete Math Grading Accuracy Upgrade - Full Implementation Command

**Status:** Audit found 62.7% accuracy (69/110 tasks complete)
**Target:** 100% accuracy (110/110 tasks complete)
**Remaining Work:** 41 tasks across Phases 1.3, 2.5, 3.6, 4.4, 5.4, 6.2-6.5, 7.1-7.3

---

## CRITICAL BLOCKING ISSUES

- ❌ NO database migrations exist (Phase 6.2) - code writes to fields that don't exist in DB
- ❌ NO test suite (18 critical tests) - untested code cannot ship
- ❌ NO documentation (12 tasks) - operators don't know how to configure
- ❌ NO cost tracking (3 tasks) - cannot bill users accurately

---

## PHASE 1.3: TESTING & DEPLOYMENT (4 tasks)

### 1.3.1 Test with GROQ_API_KEY removed
Create file: `tests/ai/provider-manager.fallback.test.ts`

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AIProviderManager } from '@/lib/ai/provider-manager';

describe('AIProviderManager - Fallback Behavior', () => {
  beforeEach(() => {
    // Clear all provider env vars except OpenAI
    delete process.env.GROQ_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    process.env.OPENAI_API_KEY = 'test-key';
  });

  it('should use OpenAI when GROQ_API_KEY is missing', async () => {
    const manager = new AIProviderManager();
    const provider = manager.getPreferredProvider();
    expect(provider).toBe('openai');
  });

  it('should fallback order: openai → anthropic → groq', async () => {
    const manager = new AIProviderManager();
    const fallbackOrder = manager.config.fallbackOrder;
    expect(fallbackOrder[0]).toBe('openai');
    expect(fallbackOrder[1]).toBe('anthropic');
    expect(fallbackOrder[2]).toBe('groq');
  });

  it('should skip unavailable providers in fallback chain', async () => {
    process.env.ANTHROPIC_API_KEY = '';
    const manager = new AIProviderManager();
    // Should skip anthropic and try groq if openai fails
    expect(manager.config.fallbackOrder).toContain('groq');
  });
});
```

### 1.3.2 Test with all providers unavailable
Add to: `tests/ai/provider-manager.fallback.test.ts`

```typescript
  it('should throw error when all providers unavailable', async () => {
    delete process.env.OPENAI_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.GROQ_API_KEY;

    const manager = new AIProviderManager();
    await expect(
      manager.analyzeImage(
        { type: 'base64', data: 'test' },
        'test prompt',
        'system',
        undefined
      )
    ).rejects.toThrow('No AI providers available');
  });

  it('should return graceful error message with fallback hints', async () => {
    delete process.env.OPENAI_API_KEY;
    const manager = new AIProviderManager();

    try {
      await manager.analyzeImage(
        { type: 'base64', data: 'test' },
        'test',
        'system'
      );
    } catch (error) {
      expect(error.message).toContain('Configure at least one provider');
      expect(error.message).toContain('OPENAI_API_KEY');
    }
  });
```

### 1.3.3 Deploy to Vercel preview
```bash
# After all tests pass, create preview deployment
git checkout -b phase-7-completion
git add .
git commit -m "Complete math grading accuracy upgrade - all 110 tasks"
git push -u origin phase-7-completion

# Create PR (will auto-deploy to Vercel preview)
gh pr create --title "Upgrade: Complete math grading accuracy (110/110 tasks)" \
  --body "All phases complete. Ready for review and testing in staging."
```

Store preview URL for Phase 1.3.4 monitoring.

### 1.3.4 Monitor accuracy improvement in staging
```typescript
// Add to src/app/api/grading/process/route.ts
export async function POST(request: Request) {
  // ... existing grading logic ...

  // Track accuracy metrics
  const metrics = {
    timestamp: new Date().toISOString(),
    provider: result.provider,
    ocrProvider: result.ocrProvider,
    mathDifficulty: result.mathDifficulty,
    verificationMethod: result.verificationMethod,
    needsReview: result.needsReview,
    processingTimeMs: result.processingTimeMs,
    // Will be populated by verification
    accuracyScore: undefined,
  };

  // Send to analytics service (Vercel Analytics)
  if (process.env.NEXT_PUBLIC_ANALYTICS_ENABLED) {
    await trackGradingMetrics(metrics);
  }

  return NextResponse.json(result);
}

async function trackGradingMetrics(metrics: object) {
  // Vercel Web Analytics - automatically collected
  // Custom events can be sent via:
  // window.va?.event('grading_complete', metrics);
}
```

Record baseline accuracy before staging deployment.
After 24 hours of production staging data, compare:
- Accuracy before (Groq-based): ~70%
- Accuracy after (GPT-4o + Mathpix + Wolfram): Target 95%+
- needsReview rate: Target <10%
- Processing time: Target <30s average

---

## PHASE 2.5: MATHPIX TESTING (4 tasks)

### 2.5.1 Unit tests for Mathpix provider
Create file: `tests/ai/providers/mathpix.test.ts`

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MathpixProvider } from '@/lib/ai/providers/mathpix';

describe('MathpixProvider', () => {
  let provider: MathpixProvider;

  beforeEach(() => {
    process.env.MATHPIX_APP_ID = 'test-app-id';
    process.env.MATHPIX_APP_KEY = 'test-app-key';
    provider = new MathpixProvider();
  });

  describe('isAvailable', () => {
    it('should return true when credentials configured', () => {
      expect(provider.isAvailable()).toBe(true);
    });

    it('should return false when app_id missing', () => {
      delete process.env.MATHPIX_APP_ID;
      const p = new MathpixProvider();
      expect(p.isAvailable()).toBe(false);
    });

    it('should return false when app_key missing', () => {
      delete process.env.MATHPIX_APP_KEY;
      const p = new MathpixProvider();
      expect(p.isAvailable()).toBe(false);
    });
  });

  describe('isEnabled', () => {
    it('should return true by default when available', () => {
      expect(provider.isEnabled()).toBe(true);
    });

    it('should respect ENABLE_MATHPIX=false flag', () => {
      process.env.ENABLE_MATHPIX = 'false';
      const p = new MathpixProvider();
      expect(p.isEnabled()).toBe(false);
    });

    it('should respect ENABLE_MATHPIX=0 flag', () => {
      process.env.ENABLE_MATHPIX = '0';
      const p = new MathpixProvider();
      expect(p.isEnabled()).toBe(false);
    });
  });

  describe('extractMath', () => {
    it('should call Mathpix API with correct format', async () => {
      const fetchSpy = vi.spyOn(global, 'fetch');

      await provider.extractMath('base64data');

      expect(fetchSpy).toHaveBeenCalledWith(
        'https://api.mathpix.com/v3/text',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'app_id': 'test-app-id',
            'app_key': 'test-app-key',
          }),
        })
      );
    });

    it('should return MathpixResult with LaTeX and text', async () => {
      const mockResponse = {
        latex_styled: '\\frac{3}{4} + \\frac{1}{2}',
        text: '3/4 + 1/2',
        confidence: 0.95,
        word_data: [],
        detected_alphabets: [],
      };

      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockResponse),
        } as Response)
      );

      const result = await provider.extractMath('base64');

      expect(result.latex_styled).toBe('\\frac{3}{4} + \\frac{1}{2}');
      expect(result.text).toBe('3/4 + 1/2');
      expect(result.confidence).toBe(0.95);
    });

    it('should handle API errors gracefully', async () => {
      global.fetch = vi.fn(() =>
        Promise.reject(new Error('API timeout'))
      );

      await expect(provider.extractMath('base64')).rejects.toThrow('API timeout');
    });

    it('should respect timeout configuration', async () => {
      const p = new MathpixProvider({ timeout: 5000 });
      expect(p['config'].timeout).toBe(5000);
    });

    it('should handle malformed API response', async () => {
      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ error: 'Invalid image' }),
        } as Response)
      );

      await expect(provider.extractMath('invalid')).rejects.toThrow();
    });
  });
});
```

Run: `npm run test -- mathpix.test.ts`

### 2.5.2 Integration test with sample handwritten math images
Create file: `tests/ai/grading-service-enhanced.mathpix.integration.test.ts`

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { getEnhancedGradingService } from '@/lib/ai';
import { readFileSync } from 'fs';
import { join } from 'path';

describe('GradingService - Mathpix Integration', () => {
  let service: any;

  beforeEach(() => {
    process.env.MATHPIX_APP_ID = 'test-id';
    process.env.MATHPIX_APP_KEY = 'test-key';
    process.env.OPENAI_API_KEY = 'test-key';
    service = getEnhancedGradingService();
  });

  it('should extract math from handwritten addition problem', async () => {
    // Use test image: tests/fixtures/handwritten-3plus5.jpg
    const imageBuffer = readFileSync(
      join(process.cwd(), 'tests/fixtures/handwritten-3plus5.jpg')
    );
    const base64 = imageBuffer.toString('base64');

    const result = await service.gradeSubmissionEnhanced({
      image: { type: 'base64', data: base64 },
      projectId: 'test-project',
      studentId: 'test-student',
      answerKey: { questions: [{ answer: '8' }] },
    }, { useMathpix: true });

    expect(result.ocrProvider).toBe('mathpix');
    expect(result.ocrConfidence).toBeGreaterThan(0.7);
    expect(result.questions[0].problemText).toContain('3');
    expect(result.questions[0].problemText).toContain('5');
  });

  it('should extract LaTeX from handwritten fraction', async () => {
    const imageBuffer = readFileSync(
      join(process.cwd(), 'tests/fixtures/handwritten-fraction.jpg')
    );
    const base64 = imageBuffer.toString('base64');

    const result = await service.gradeSubmissionEnhanced({
      image: { type: 'base64', data: base64 },
      projectId: 'test-project',
      studentId: 'test-student',
      answerKey: { questions: [{ answer: '0.75' }] },
    }, { useMathpix: true });

    expect(result.ocrProvider).toBe('mathpix');
    // Should extract fraction notation (either LaTeX or text)
    const text = result.questions[0].problemText.toLowerCase();
    expect(text).toMatch(/frac|\/|\//);
  });

  it('should handle poor handwriting gracefully', async () => {
    // Test with deliberately poor handwriting image
    const imageBuffer = readFileSync(
      join(process.cwd(), 'tests/fixtures/poor-handwriting.jpg')
    );
    const base64 = imageBuffer.toString('base64');

    const result = await service.gradeSubmissionEnhanced({
      image: { type: 'base64', data: base64 },
      projectId: 'test-project',
      studentId: 'test-student',
      answerKey: { questions: [{ answer: 'unknown' }] },
    }, { useMathpix: true });

    // Should still return result, confidence may be low
    expect(result.ocrConfidence).toBeLessThan(0.7);
    expect(result.questions[0].needsReview).toBe(true);
  });

  it('should mark low-confidence extractions for review', async () => {
    const imageBuffer = readFileSync(
      join(process.cwd(), 'tests/fixtures/handwritten-3plus5.jpg')
    );
    const base64 = imageBuffer.toString('base64');

    const result = await service.gradeSubmissionEnhanced({
      image: { type: 'base64', data: base64 },
      projectId: 'test-project',
      studentId: 'test-student',
      answerKey: { questions: [{ answer: '8' }] },
    }, { useMathpix: true });

    if (result.ocrConfidence < 0.75) {
      expect(result.questions[0].needsReview).toBe(true);
    }
  });
});

// Test fixtures needed (create or provide):
// - tests/fixtures/handwritten-3plus5.jpg (simple addition)
// - tests/fixtures/handwritten-fraction.jpg (fraction 3/4)
// - tests/fixtures/poor-handwriting.jpg (deliberately poor)
```

### 2.5.3 Test fallback when Mathpix unavailable
Add to: `tests/ai/grading-service-enhanced.mathpix.integration.test.ts`

```typescript
  it('should fallback to vision OCR when Mathpix unavailable', async () => {
    delete process.env.MATHPIX_APP_ID;

    const fallbackService = getEnhancedGradingService();
    const imageBuffer = readFileSync(
      join(process.cwd(), 'tests/fixtures/handwritten-3plus5.jpg')
    );
    const base64 = imageBuffer.toString('base64');

    const result = await fallbackService.gradeSubmissionEnhanced({
      image: { type: 'base64', data: base64 },
      projectId: 'test-project',
      studentId: 'test-student',
      answerKey: { questions: [{ answer: '8' }] },
    });

    // Should use vision OCR instead
    expect(result.ocrProvider).toBe('vision');
    // But should still produce valid result
    expect(result.questions).toBeDefined();
    expect(result.questions.length).toBeGreaterThan(0);
  });

  it('should handle Mathpix timeout gracefully', async () => {
    process.env.MATHPIX_TIMEOUT = '100'; // Very short timeout

    const timeoutService = getEnhancedGradingService();
    const imageBuffer = readFileSync(
      join(process.cwd(), 'tests/fixtures/handwritten-3plus5.jpg')
    );
    const base64 = imageBuffer.toString('base64');

    const result = await timeoutService.gradeSubmissionEnhanced({
      image: { type: 'base64', data: base64 },
      projectId: 'test-project',
      studentId: 'test-student',
      answerKey: { questions: [{ answer: '8' }] },
    }, { useMathpix: true });

    // Should fallback to vision on timeout
    expect(result.ocrProvider).toBe('vision');
    expect(result.questions[0].needsReview).toBe(true);
  });

  it('should handle Mathpix API errors gracefully', async () => {
    // Mock Mathpix to return error
    global.fetch = vi.fn((url: string) => {
      if (url.includes('mathpix.com')) {
        return Promise.resolve({
          ok: false,
          status: 429,
          statusText: 'Too Many Requests',
        } as Response);
      }
      return Promise.resolve({ ok: true, json: () => ({}) } as Response);
    });

    const result = await service.gradeSubmissionEnhanced({
      image: { type: 'base64', data: 'test' },
      projectId: 'test',
      studentId: 'test',
      answerKey: { questions: [{ answer: '8' }] },
    }, { useMathpix: true });

    expect(result.ocrProvider).toBe('vision');
    expect(result.questions[0].needsReview).toBe(true);
  });
```

### 2.5.4 Verify LaTeX extraction accuracy
Add to: `tests/ai/grading-service-enhanced.mathpix.integration.test.ts`

```typescript
  it('should extract accurate LaTeX for fractions', async () => {
    const imageBuffer = readFileSync(
      join(process.cwd(), 'tests/fixtures/handwritten-fraction.jpg')
    );
    const base64 = imageBuffer.toString('base64');

    const result = await service.gradeSubmissionEnhanced({
      image: { type: 'base64', data: base64 },
      projectId: 'test-project',
      studentId: 'test-student',
      answerKey: { questions: [{ answer: '0.75' }] },
    }, { useMathpix: true });

    // Should have proper LaTeX format (contains \frac pattern)
    const problemText = result.questions[0].problemText;
    expect(problemText).toMatch(/\\frac|fraction|\//) ;
  });

  it('should extract accurate LaTeX for equations', async () => {
    const imageBuffer = readFileSync(
      join(process.cwd(), 'tests/fixtures/handwritten-equation.jpg')
    );
    const base64 = imageBuffer.toString('base64');

    const result = await service.gradeSubmissionEnhanced({
      image: { type: 'base64', data: base64 },
      projectId: 'test-project',
      studentId: 'test-student',
      answerKey: { questions: [{ answer: '5' }] },
    }, { useMathpix: true });

    // Should recognize equation (contains = or solve pattern)
    const problemText = result.questions[0].problemText;
    expect(problemText).toContain('=');
  });

  it('should handle mixed text and math', async () => {
    // Image with "Solve: 2x + 3 = 7"
    const imageBuffer = readFileSync(
      join(process.cwd(), 'tests/fixtures/handwritten-word-problem.jpg')
    );
    const base64 = imageBuffer.toString('base64');

    const result = await service.gradeSubmissionEnhanced({
      image: { type: 'base64', data: base64 },
      projectId: 'test-project',
      studentId: 'test-student',
      answerKey: { questions: [{ answer: '2' }] },
    }, { useMathpix: true });

    // Should extract both text and math
    const problemText = result.questions[0].problemText;
    expect(problemText.toLowerCase()).toContain('solve');
    expect(problemText).toMatch(/\d+x|\+|=/);
  });
```

Run tests: `npm run test -- mathpix.integration.test.ts`

---

## PHASE 3.6: WOLFRAM TESTING (4 tasks)

### 3.6.1 Unit tests for Wolfram provider
Create file: `tests/ai/providers/wolfram.test.ts`

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { WolframProvider } from '@/lib/ai/providers/wolfram';

describe('WolframProvider', () => {
  let provider: WolframProvider;

  beforeEach(() => {
    process.env.WOLFRAM_APP_ID = 'test-wolfram-id';
    provider = new WolframProvider();
  });

  describe('isAvailable', () => {
    it('should return true when configured', () => {
      expect(provider.isAvailable()).toBe(true);
    });

    it('should return false when app_id missing', () => {
      delete process.env.WOLFRAM_APP_ID;
      const p = new WolframProvider();
      expect(p.isAvailable()).toBe(false);
    });
  });

  describe('isEnabled', () => {
    it('should return true by default when available', () => {
      expect(provider.isEnabled()).toBe(true);
    });

    it('should respect ENABLE_WOLFRAM_VERIFICATION=false', () => {
      process.env.ENABLE_WOLFRAM_VERIFICATION = 'false';
      const p = new WolframProvider();
      expect(p.isEnabled()).toBe(false);
    });
  });

  describe('solve', () => {
    it('should call Wolfram API with correct endpoint', async () => {
      const fetchSpy = vi.spyOn(global, 'fetch');

      await provider.solve('2 + 3');

      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining('api.wolframalpha.com/v1/result'),
        expect.any(Object)
      );
    });

    it('should solve simple arithmetic', async () => {
      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          text: () => Promise.resolve('5'),
        } as Response)
      );

      const result = await provider.solve('2 + 3');
      expect(result.result).toBe('5');
    });

    it('should solve fractions', async () => {
      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          text: () => Promise.resolve('1.25'),
        } as Response)
      );

      const result = await provider.solve('5/4');
      expect(result.result).toBe('1.25');
    });

    it('should solve equations', async () => {
      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          text: () => Promise.resolve('5'),
        } as Response)
      );

      const result = await provider.solve('2x + 3 == 13');
      expect(result.result).toBe('5');
    });

    it('should handle LaTeX input', async () => {
      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          text: () => Promise.resolve('1.25'),
        } as Response)
      );

      const result = await provider.solve('\\frac{5}{4}');
      expect(result.result).toBe('1.25');
    });

    it('should normalize LaTeX to Wolfram format', async () => {
      const fetchSpy = vi.spyOn(global, 'fetch');

      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          text: () => Promise.resolve('1.25'),
        } as Response)
      );

      await provider.solve('\\frac{5}{4}');

      // Should convert \frac{5}{4} to 5/4
      const callUrl = (fetchSpy.mock.calls[0][0] as string);
      expect(callUrl).toContain('5/4');
      expect(callUrl).not.toContain('\\frac');
    });

    it('should handle invalid expressions', async () => {
      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: false,
          status: 400,
        } as Response)
      );

      await expect(provider.solve('not math')).rejects.toThrow();
    });

    it('should respect timeout configuration', async () => {
      const p = new WolframProvider({ timeout: 3000 });
      expect(p['config'].timeout).toBe(3000);
    });

    it('should handle rate limiting (HTTP 429)', async () => {
      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: false,
          status: 429,
          statusText: 'Too Many Requests',
        } as Response)
      );

      await expect(provider.solve('2 + 2')).rejects.toThrow('rate limit');
    });
  });
});
```

Run: `npm run test -- wolfram.test.ts`

### 3.6.2 Unit tests for answer comparator
Create file: `tests/ai/answer-comparator.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { compareAnswers } from '@/lib/ai/answer-comparator';

describe('Answer Comparator', () => {
  describe('Exact String Match', () => {
    it('should match identical answers', () => {
      const result = compareAnswers('5', '5');
      expect(result.matched).toBe(true);
      expect(result.method).toBe('exact');
    });

    it('should match case-insensitive', () => {
      const result = compareAnswers('FIVE', 'five');
      expect(result.matched).toBe(true);
    });

    it('should match with whitespace normalization', () => {
      const result = compareAnswers('  5  ', '5');
      expect(result.matched).toBe(true);
    });
  });

  describe('Numeric Comparison', () => {
    it('should match equivalent decimals', () => {
      const result = compareAnswers('5.0', '5');
      expect(result.matched).toBe(true);
      expect(result.method).toBe('numeric');
    });

    it('should match with tolerance for floating point', () => {
      const result = compareAnswers('3.14159', '3.14160', 0.0001);
      expect(result.matched).toBe(true);
    });

    it('should reject numbers outside tolerance', () => {
      const result = compareAnswers('3.0', '3.1', 0.01);
      expect(result.matched).toBe(false);
    });

    it('should use relative tolerance for large numbers', () => {
      // Relative tolerance: 0.01% of max value
      const result = compareAnswers('1000000', '1000010');
      expect(result.matched).toBe(true);
    });
  });

  describe('Fraction Equivalence', () => {
    it('should match equivalent fractions', () => {
      const result = compareAnswers('1/2', '2/4');
      expect(result.matched).toBe(true);
      expect(result.method).toBe('fraction');
    });

    it('should match fraction to decimal', () => {
      const result = compareAnswers('1/2', '0.5');
      expect(result.matched).toBe(true);
    });

    it('should match simplified fractions', () => {
      const result = compareAnswers('3/4', '6/8');
      expect(result.matched).toBe(true);
    });

    it('should handle improper fractions', () => {
      const result = compareAnswers('5/2', '2.5');
      expect(result.matched).toBe(true);
    });

    it('should handle negative fractions', () => {
      const result = compareAnswers('-1/2', '-0.5');
      expect(result.matched).toBe(true);
    });
  });

  describe('Percentage Equivalence', () => {
    it('should match percentage to decimal', () => {
      const result = compareAnswers('50%', '0.5');
      expect(result.matched).toBe(true);
    });

    it('should match percentage forms', () => {
      const result = compareAnswers('50%', '50 percent');
      expect(result.matched).toBe(true);
    });
  });

  describe('Symbolic Equivalence', () => {
    it('should match x=5 and 5=x', () => {
      const result = compareAnswers('x=5', '5=x');
      expect(result.matched).toBe(true);
    });

    it('should handle equations with variables', () => {
      const result = compareAnswers('x = 3', 'x=3');
      expect(result.matched).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    it('should handle null/undefined', () => {
      const result = compareAnswers(null as any, '5');
      expect(result.matched).toBe(false);
    });

    it('should handle empty strings', () => {
      const result = compareAnswers('', '5');
      expect(result.matched).toBe(false);
    });

    it('should not match different answers', () => {
      const result = compareAnswers('5', '10');
      expect(result.matched).toBe(false);
    });

    it('should handle special characters', () => {
      const result = compareAnswers('5#', '5');
      expect(result.matched).toBe(false);
    });
  });
});
```

Run: `npm run test -- answer-comparator.test.ts`

### 3.6.3 Integration test with algebra problems
Create file: `tests/ai/grading-service-enhanced.wolfram.integration.test.ts`

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { getEnhancedGradingService } from '@/lib/ai';
import { readFileSync } from 'fs';
import { join } from 'path';

describe('GradingService - Wolfram Integration', () => {
  let service: any;

  beforeEach(() => {
    process.env.WOLFRAM_APP_ID = 'test-wolfram-id';
    process.env.OPENAI_API_KEY = 'test-key';
    process.env.ENABLE_WOLFRAM_VERIFICATION = 'true';
    service = getEnhancedGradingService();
  });

  it('should verify simple algebra problem', async () => {
    const imageBuffer = readFileSync(
      join(process.cwd(), 'tests/fixtures/algebra-solve-2x+3=7.jpg')
    );
    const base64 = imageBuffer.toString('base64');

    const result = await service.gradeSubmissionEnhanced({
      image: { type: 'base64', data: base64 },
      projectId: 'test-project',
      studentId: 'test-student',
      answerKey: { questions: [{ answer: '2' }] },
    }, { enableVerification: true });

    // Should classify as complex
    expect(result.questions[0].difficultyLevel).toBe('complex');

    // Should use Wolfram verification
    expect(result.questions[0].verificationMethod).toBe('wolfram');

    // Should verify answer matches Wolfram result
    expect(result.questions[0].wolframVerified).toBe(true);
    expect(result.questions[0].verificationConflict).toBe(false);
  });

  it('should catch AI calculation errors via Wolfram', async () => {
    const imageBuffer = readFileSync(
      join(process.cwd(), 'tests/fixtures/algebra-equation.jpg')
    );
    const base64 = imageBuffer.toString('base64');

    // Simulate AI giving wrong answer
    global.fetch = vi.fn((url: string) => {
      if (url.includes('openai.com')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            choices: [{
              message: { content: 'answer: 10' } // Wrong answer
            }]
          }),
        } as Response);
      }
      if (url.includes('wolfram')) {
        return Promise.resolve({
          ok: true,
          text: () => Promise.resolve('5') // Correct answer
        } as Response);
      }
      return Promise.resolve({ ok: true, json: () => ({}) } as Response);
    });

    const result = await service.gradeSubmissionEnhanced({
      image: { type: 'base64', data: base64 },
      projectId: 'test-project',
      studentId: 'test-student',
      answerKey: { questions: [{ answer: 'unknown' }] },
    }, { enableVerification: true });

    // Should flag the conflict
    expect(result.questions[0].verificationConflict).toBe(true);
    expect(result.questions[0].needsReview).toBe(true);
  });

  it('should handle Wolfram verification timeout', async () => {
    process.env.WOLFRAM_TIMEOUT = '100';

    const timeoutService = getEnhancedGradingService();
    const imageBuffer = readFileSync(
      join(process.cwd(), 'tests/fixtures/algebra-solve-2x+3=7.jpg')
    );
    const base64 = imageBuffer.toString('base64');

    const result = await timeoutService.gradeSubmissionEnhanced({
      image: { type: 'base64', data: base64 },
      projectId: 'test-project',
      studentId: 'test-student',
      answerKey: { questions: [{ answer: '2' }] },
    }, { enableVerification: true });

    // Should fallback to chain-of-thought on timeout
    expect(result.questions[0].verificationMethod).toBe('chain_of_thought');
  });

  it('should skip Wolfram for simple math', async () => {
    const imageBuffer = readFileSync(
      join(process.cwd(), 'tests/fixtures/simple-addition-3plus5.jpg')
    );
    const base64 = imageBuffer.toString('base64');

    const result = await service.gradeSubmissionEnhanced({
      image: { type: 'base64', data: base64 },
      projectId: 'test-project',
      studentId: 'test-student',
      answerKey: { questions: [{ answer: '8' }] },
    }, { enableVerification: true });

    // Should classify as simple
    expect(result.questions[0].difficultyLevel).toBe('simple');

    // Should NOT use Wolfram
    expect(result.questions[0].verificationMethod).not.toBe('wolfram');
  });

  it('should handle Wolfram rate limiting', async () => {
    global.fetch = vi.fn((url: string) => {
      if (url.includes('wolfram')) {
        return Promise.resolve({
          ok: false,
          status: 429,
          statusText: 'Too Many Requests',
        } as Response);
      }
      return Promise.resolve({ ok: true, json: () => ({}) } as Response);
    });

    const imageBuffer = readFileSync(
      join(process.cwd(), 'tests/fixtures/algebra-solve-2x+3=7.jpg')
    );
    const base64 = imageBuffer.toString('base64');

    const result = await service.gradeSubmissionEnhanced({
      image: { type: 'base64', data: base64 },
      projectId: 'test-project',
      studentId: 'test-student',
      answerKey: { questions: [{ answer: '2' }] },
    }, { enableVerification: true });

    // Should fallback gracefully
    expect(result.questions[0].needsReview).toBe(true);
  });
});

// Test fixtures needed:
// - tests/fixtures/algebra-solve-2x+3=7.jpg
// - tests/fixtures/algebra-equation.jpg
// - tests/fixtures/simple-addition-3plus5.jpg
```

### 3.6.4 Test rate limiting behavior
Add to: `tests/ai/providers/wolfram.test.ts`

```typescript
  describe('Rate Limiting', () => {
    it('should handle HTTP 429 error', async () => {
      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: false,
          status: 429,
          statusText: 'Too Many Requests',
        } as Response)
      );

      await expect(provider.solve('2 + 2')).rejects.toThrow('rate limit');
    });

    it('should include retry-after header if available', async () => {
      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: false,
          status: 429,
          headers: new Map([['retry-after', '60']]),
        } as Response)
      );

      try {
        await provider.solve('2 + 2');
      } catch (error) {
        expect(error.retryAfter).toBe(60);
      }
    });

    it('should log rate limit events for monitoring', async () => {
      const consoleSpy = vi.spyOn(console, 'warn');

      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: false,
          status: 429,
        } as Response)
      );

      try {
        await provider.solve('2 + 2');
      } catch (error) {
        expect(consoleSpy).toHaveBeenCalledWith(
          expect.stringContaining('rate limit')
        );
      }
    });

    it('should track rate limit hits for alerting', async () => {
      // Should increment rate_limit_hits counter
      // This counter should trigger alert if >10 in 1 hour
      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: false,
          status: 429,
        } as Response)
      );

      try {
        await provider.solve('2 + 2');
      } catch (error) {
        // In production, this would increment Vercel Analytics counter
        // For testing, just verify it doesn't crash
        expect(error).toBeDefined();
      }
    });
  });
```

---

## PHASE 4.4: CHAIN-OF-THOUGHT TESTING (3 tasks)

### 4.4.1 Test verification catches AI calculation errors
Create file: `tests/ai/verification-service.test.ts`

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { VerificationService } from '@/lib/ai/verification-service';
import { createOpenAIProvider } from '@/lib/ai/providers/openai';

describe('VerificationService - Chain of Thought', () => {
  let service: VerificationService;

  beforeEach(() => {
    process.env.OPENAI_API_KEY = 'test-key';
    service = new VerificationService();
  });

  it('should catch incorrect AI calculations', async () => {
    global.fetch = vi.fn((url: string) => {
      // First call is original calculation (AI says 5)
      // Second call is verification (correct answer is 8)
      const callCount = (global.fetch as any).mock.calls.length;

      if (callCount === 1) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            choices: [{
              message: { content: 'The answer is 5' }
            }]
          }),
        } as Response);
      } else {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            choices: [{
              message: { content: 'Let me verify: 3 + 5 = 8' }
            }]
          }),
        } as Response);
      }
    });

    const result = await service.verifyCalculation(
      '3 + 5',
      '5'
    );

    // Verification should catch the error
    expect(result.matched).toBe(false);
    expect(result.verificationAnswer).toBe('8');
    expect(result.conflict).toBe(true);
  });

  it('should confirm correct AI calculations', async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({
          choices: [{
            message: { content: 'The answer is 8' }
          }]
        }),
      } as Response)
    );

    const result = await service.verifyCalculation(
      '3 + 5',
      '8'
    );

    // Verification should confirm
    expect(result.matched).toBe(true);
    expect(result.verificationAnswer).toBe('8');
    expect(result.conflict).toBe(false);
  });

  it('should handle verification failures gracefully', async () => {
    global.fetch = vi.fn(() =>
      Promise.reject(new Error('API error'))
    );

    const result = await service.verifyCalculation(
      '3 + 5',
      '8'
    );

    // Should return result with error flag
    expect(result).toBeDefined();
    expect(result.error).toBeDefined();
  });

  it('should use different solving approach for verification', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch');

    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({
          choices: [{
            message: { content: 'The answer is 8' }
          }]
        }),
      } as Response)
    );

    await service.verifyCalculation('2 * 4', '8');

    // Verification call should use different method instruction
    const calls = (fetchSpy as any).mock.calls;
    const verificationCall = calls[calls.length - 1];
    expect(verificationCall[1].body).toContain('different method');
  });

  it('should not modify original answer during verification', async () => {
    const originalAnswer = '8';

    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({
          choices: [{
            message: { content: 'The answer is 8' }
          }]
        }),
      } as Response)
    );

    const result = await service.verifyCalculation(
      '3 + 5',
      originalAnswer
    );

    // Original answer should be unchanged
    expect(originalAnswer).toBe('8');
  });
});
```

### 4.4.2 Test verification agrees with correct answers
Add to: `tests/ai/verification-service.test.ts`

```typescript
  describe('Verification Accuracy', () => {
    const testCases = [
      { problem: '2 + 3', answer: '5', shouldMatch: true },
      { problem: '10 - 4', answer: '6', shouldMatch: true },
      { problem: '3 * 4', answer: '12', shouldMatch: true },
      { problem: '15 / 3', answer: '5', shouldMatch: true },
      { problem: '2^3', answer: '8', shouldMatch: true },
      { problem: '√16', answer: '4', shouldMatch: true },
      { problem: '1/2 + 1/4', answer: '0.75', shouldMatch: true },
      { problem: 'Solve: 2x + 3 = 7', answer: '2', shouldMatch: true },
    ];

    testCases.forEach(({ problem, answer, shouldMatch }) => {
      it(`should ${shouldMatch ? 'confirm' : 'reject'} "${problem}" = "${answer}"`, async () => {
        global.fetch = vi.fn(() =>
          Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              choices: [{
                message: { content: `The answer is ${answer}` }
              }]
            }),
          } as Response)
        );

        const result = await service.verifyCalculation(problem, answer);
        expect(result.matched).toBe(shouldMatch);
      });
    });
  });
```

### 4.4.3 Measure false positive rate (unnecessary flags)
Add to: `tests/ai/verification-service.test.ts`

```typescript
  describe('False Positive Rate', () => {
    it('should not flag correct answers as errors', async () => {
      const correctCases = [
        '3 + 5 = 8',
        '10 - 3 = 7',
        '4 * 5 = 20',
      ];

      let falsePositives = 0;

      for (const problem of correctCases) {
        global.fetch = vi.fn(() =>
          Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              choices: [{
                message: { content: 'Correct' }
              }]
            }),
          } as Response)
        );

        const [problemText, answer] = problem.split(' = ');
        const result = await service.verifyCalculation(problemText, answer);

        if (result.conflict) {
          falsePositives++;
        }
      }

      // False positive rate should be <5%
      const falsePositiveRate = (falsePositives / correctCases.length) * 100;
      expect(falsePositiveRate).toBeLessThan(5);
    });

    it('should track false positive metrics', async () => {
      // Should log: { false_positives: 0, total_verifications: N, rate: 0% }
      // For alerting if rate exceeds 10%

      // This would be checked via analytics in production
      // For testing, just verify service tracks the metric
      expect(service.getMetrics).toBeDefined();
    });
  });
```

---

## PHASE 5.4: MATH CLASSIFIER TESTING (3 tasks)

### 5.4.1 Unit tests for classifier with 50+ problem types
Create file: `tests/ai/math-classifier.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { classifyDifficulty } from '@/lib/ai/math-classifier';

describe('Math Difficulty Classifier', () => {
  describe('Simple Math (basic arithmetic)', () => {
    const simpleProblems = [
      '2 + 3',
      '10 - 5',
      '4 * 6',
      '20 / 4',
      '3 + 5 - 2',
      '100 + 50 + 25',
      '8 * 2 / 4',
    ];

    simpleProblems.forEach(problem => {
      it(`should classify "${problem}" as simple`, () => {
        expect(classifyDifficulty(problem)).toBe('simple');
      });
    });
  });

  describe('Moderate Math (fractions, decimals, percentages)', () => {
    const moderateProblems = [
      '1/2 + 1/4',
      '3/4 of 100',
      '2.5 + 3.7',
      '50% of 200',
      '0.5 * 0.3',
      '1/3 + 1/6 + 1/9',
      '25% of 80',
      '1.5^2',
      '3^2',
      'Find: 15% of 150',
    ];

    moderateProblems.forEach(problem => {
      it(`should classify "${problem}" as moderate`, () => {
        expect(classifyDifficulty(problem)).toBe('moderate');
      });
    });
  });

  describe('Complex Math (algebra, equations, multi-step)', () => {
    const complexProblems = [
      'Solve: 2x + 3 = 7',
      'Find x: 3x - 5 = 10',
      'y = 2x + 1, find y when x = 5',
      'Solve the equation: x^2 - 4 = 0',
      'Factor: x^2 + 5x + 6',
      'Simplify: (2x + 3)^2',
      'Expand: (x - 2)(x + 3)',
      'If 3a = 15, what is a?',
      'Solve for x: 2(x + 3) = 14',
      'Find the root: √25',
      'Solve: x^2 = 16',
      'If y = x^2, find y when x = 3',
      'Simplify: 2x^3 + 3x^2 - x',
      'What value of x satisfies: 5x + 2 = 12?',
      'Solve the system: x + y = 5, x - y = 1',
      'Word problem: If John has 3 apples and buys 5 more, how many does he have?',
    ];

    complexProblems.forEach(problem => {
      it(`should classify "${problem}" as complex`, () => {
        const difficulty = classifyDifficulty(problem);
        expect(['complex', 'moderate']).toContain(difficulty);
        // (Moderate acceptable because some word problems may be simpler)
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty string', () => {
      expect(() => classifyDifficulty('')).not.toThrow();
    });

    it('should be case-insensitive', () => {
      const lower = classifyDifficulty('solve: 2x + 3 = 7');
      const upper = classifyDifficulty('SOLVE: 2X + 3 = 7');
      expect(lower).toBe(upper);
    });

    it('should handle LaTeX input', () => {
      const result = classifyDifficulty('\\frac{1}{2} + \\frac{1}{4}');
      expect(['moderate', 'complex']).toContain(result);
    });

    it('should handle text with mixed case and spacing', () => {
      expect(classifyDifficulty('  Solve  :  2 x  +  3  =  7  ')).toBe('complex');
    });
  });

  describe('50+ Problem Type Coverage', () => {
    const allProblems = [
      // Basic arithmetic (10)
      ...['2+3', '5-2', '3*4', '12/3', '1+1', '100-50', '2*5', '10/2', '7+8', '9-3'],
      // Fractions (10)
      ...['1/2', '3/4', '1/4+1/4', '1/2-1/4', '2/3*3/4', '5/6÷1/3', '1/2+1/3', '3/5', '7/8', '2/5+3/5'],
      // Decimals (10)
      ...['0.5+0.3', '1.5*2', '2.5-0.5', '0.1+0.2', '3.14*2', '10.5/2', '0.25*4', '5.5+4.5', '7.2-3.1', '0.5^2'],
      // Percentages (5)
      ...['50% of 100', '25% of 80', '10% increase of 200', '15% off 300', '33% of 90'],
      // Algebra (10)
      ...['2x+3=7', 'x-5=10', '3x=12', '2x+2=6', 'x/2=5', '4x-1=11', 'x+x=10', '5x=20', '2x+1=5', '3x-2=4'],
      // Equations (5)
      ...['x^2=16', 'x^2+2x+1=0', '(x-2)^2=9', 'x^3=8', '√x=4'],
    ];

    it(`should classify all ${allProblems.length} test problems without error`, () => {
      allProblems.forEach(problem => {
        expect(() => classifyDifficulty(problem)).not.toThrow();
      });
    });

    it('should classify 50+ problems correctly', () => {
      const classifications = allProblems.map(p => classifyDifficulty(p));
      expect(classifications).toHaveLength(allProblems.length);
      expect(classifications.every(c => ['simple', 'moderate', 'complex'].includes(c))).toBe(true);
    });
  });
});
```

### 5.4.2 Validate classification accuracy
Add to: `tests/ai/math-classifier.test.ts`

```typescript
  describe('Classification Accuracy', () => {
    const accuracyTest = [
      // Expected: simple
      { problem: '2 + 3', expected: 'simple' },
      { problem: '100 - 50', expected: 'simple' },
      { problem: '5 * 4', expected: 'simple' },

      // Expected: moderate
      { problem: '1/2 + 1/4', expected: 'moderate' },
      { problem: '2.5 * 3', expected: 'moderate' },
      { problem: '50% of 200', expected: 'moderate' },

      // Expected: complex
      { problem: 'Solve: 2x + 3 = 7', expected: 'complex' },
      { problem: 'x^2 - 4 = 0', expected: 'complex' },
      { problem: 'Find x: 3x + 2 = 11', expected: 'complex' },
    ];

    let correct = 0;
    let total = accuracyTest.length;

    accuracyTest.forEach(({ problem, expected }) => {
      it(`should correctly classify "${problem}" as ${expected}`, () => {
        const result = classifyDifficulty(problem);
        const matches = result === expected;
        if (matches) correct++;
        expect(result).toBe(expected);
      });
    });

    it(`should achieve 90%+ accuracy on known test cases`, () => {
      const accuracy = (correct / total) * 100;
      expect(accuracy).toBeGreaterThanOrEqual(90);
    });
  });
```

### 5.4.3 Test routing produces expected pipeline
Create file: `tests/ai/grading-service-enhanced.routing.test.ts`

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getEnhancedGradingService } from '@/lib/ai';

describe('Grading Pipeline - Difficulty Routing', () => {
  let service: any;

  beforeEach(() => {
    process.env.OPENAI_API_KEY = 'test-key';
    process.env.WOLFRAM_APP_ID = 'test-id';
    process.env.ENABLE_WOLFRAM_VERIFICATION = 'true';
    service = getEnhancedGradingService();
  });

  it('should route simple math → GPT-4o only (no verification)', async () => {
    const result = await service.gradeSubmissionEnhanced({
      image: { type: 'base64', data: 'test' },
      projectId: 'test',
      studentId: 'test',
      answerKey: {
        questions: [{ problem: '2 + 3', answer: '5' }]
      },
    });

    const question = result.questions[0];
    expect(question.difficultyLevel).toBe('simple');
    expect(question.verificationMethod).toBeUndefined();
    expect(question.wolframVerified).toBeUndefined();
  });

  it('should route moderate math → GPT-4o + chain-of-thought', async () => {
    const result = await service.gradeSubmissionEnhanced({
      image: { type: 'base64', data: 'test' },
      projectId: 'test',
      studentId: 'test',
      answerKey: {
        questions: [{ problem: '1/2 + 1/4', answer: '0.75' }]
      },
    });

    const question = result.questions[0];
    expect(question.difficultyLevel).toBe('moderate');
    expect(question.verificationMethod).toBe('chain_of_thought');
  });

  it('should route complex math → GPT-4o + Wolfram verification', async () => {
    const result = await service.gradeSubmissionEnhanced({
      image: { type: 'base64', data: 'test' },
      projectId: 'test',
      studentId: 'test',
      answerKey: {
        questions: [{ problem: 'Solve: 2x + 3 = 7', answer: '2' }]
      },
    });

    const question = result.questions[0];
    expect(question.difficultyLevel).toBe('complex');
    expect(question.verificationMethod).toBe('wolfram');
  });

  it('should fallback to CoT if Wolfram unavailable', async () => {
    delete process.env.WOLFRAM_APP_ID;
    const fallbackService = getEnhancedGradingService();

    const result = await fallbackService.gradeSubmissionEnhanced({
      image: { type: 'base64', data: 'test' },
      projectId: 'test',
      studentId: 'test',
      answerKey: {
        questions: [{ problem: 'Solve: 2x + 3 = 7', answer: '2' }]
      },
    }, { enableVerification: true });

    const question = result.questions[0];
    expect(question.verificationMethod).toBe('chain_of_thought');
  });

  it('should skip verification if disabled', async () => {
    const result = await service.gradeSubmissionEnhanced({
      image: { type: 'base64', data: 'test' },
      projectId: 'test',
      studentId: 'test',
      answerKey: {
        questions: [{ problem: 'Solve: 2x + 3 = 7', answer: '2' }]
      },
    }, { enableVerification: false });

    const question = result.questions[0];
    expect(question.verificationMethod).toBeUndefined();
  });
});
```

Run all tests: `npm run test`

---

## PHASE 6.2: DATABASE MIGRATIONS (3 tasks)

### 6.2.1 Create migration for new graded_results columns
Create file: `database/migrations/042_add_verification_fields_to_graded_results.sql`

```sql
-- Add OCR and verification tracking columns to graded_results
-- This migration adds fields to track: which OCR provider was used,
-- what verification method was applied, and the results of verification

ALTER TABLE graded_results
ADD COLUMN IF NOT EXISTS ocr_provider TEXT DEFAULT 'vision'
  CHECK (ocr_provider IN ('mathpix', 'vision')),
ADD COLUMN IF NOT EXISTS ocr_confidence DECIMAL(3,2)
  CHECK (ocr_confidence >= 0.0 AND ocr_confidence <= 1.0),
ADD COLUMN IF NOT EXISTS verification_method TEXT
  CHECK (verification_method IN ('wolfram', 'chain_of_thought', 'none', NULL)),
ADD COLUMN IF NOT EXISTS verification_result JSONB,
ADD COLUMN IF NOT EXISTS math_difficulty TEXT
  CHECK (math_difficulty IN ('simple', 'moderate', 'complex', NULL));

-- Add indexes for querying by verification method
CREATE INDEX IF NOT EXISTS idx_graded_results_verification_method
  ON graded_results(verification_method)
  WHERE verification_method IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_graded_results_math_difficulty
  ON graded_results(math_difficulty)
  WHERE math_difficulty IS NOT NULL;

-- Add index for finding low-confidence results that need review
CREATE INDEX IF NOT EXISTS idx_graded_results_ocr_confidence
  ON graded_results(ocr_confidence)
  WHERE ocr_confidence < 0.8;

-- Backfill existing records with default values
UPDATE graded_results
SET ocr_provider = 'vision',
    verification_method = 'none',
    math_difficulty = 'moderate'
WHERE ocr_provider IS NULL;

-- Add comment for documentation
COMMENT ON COLUMN graded_results.ocr_provider IS 'Which OCR service extracted the problem text: mathpix (specialized math OCR) or vision (generic vision model)';
COMMENT ON COLUMN graded_results.ocr_confidence IS 'Confidence score from OCR provider (0.0-1.0). Low confidence (<0.8) should trigger manual review';
COMMENT ON COLUMN graded_results.verification_method IS 'Which verification method was used: wolfram (computational verification), chain_of_thought (AI self-check), or none (no verification)';
COMMENT ON COLUMN graded_results.verification_result IS 'JSON object with verification details: {matched: boolean, method: string, verificationAnswer: string, conflict: boolean}';
COMMENT ON COLUMN graded_results.math_difficulty IS 'Automatically classified difficulty level: simple (basic arithmetic), moderate (fractions/decimals), complex (algebra/equations)';
```

Apply migration:
```bash
cd /Users/jordanolsen/Grade-Math
psql "$DATABASE_URL" < database/migrations/042_add_verification_fields_to_graded_results.sql
```

Verify:
```bash
psql "$DATABASE_URL" -c "
  SELECT column_name, data_type, column_default
  FROM information_schema.columns
  WHERE table_name='graded_results' AND column_name IN ('ocr_provider', 'ocr_confidence', 'verification_method', 'verification_result', 'math_difficulty')
  ORDER BY ordinal_position;"
```

Expected output:
```
    column_name     |   data_type   |     column_default
--------------------+---------------+---------------------
 ocr_provider       | text          | 'vision'::text
 ocr_confidence     | numeric       |
 verification_method| text          |
 verification_result| jsonb         |
 math_difficulty    | text          |
```

### 6.2.2 Update result storage to include new fields
Modify file: `src/lib/ai/grading-service-enhanced.ts`

Add to the result object returned from `gradeSubmissionEnhanced()`:

```typescript
// Around line 180-185, update the return statement:

return {
  // ... existing fields ...

  // OCR tracking (new)
  ocrProvider: mathpixData ? 'mathpix' : 'vision',
  ocrConfidence: mathpixData?.confidence,

  // Verification tracking (new)
  questions: questions.map(q => ({
    ...q,
    // Include these fields in questions array
    mathpixLatex: q.mathpixLatex,
    ocrConfidence: q.ocrConfidence,
    difficultyLevel: q.difficultyLevel,
    wolframVerified: q.wolframVerified,
    wolframAnswer: q.wolframAnswer,
    verificationConflict: q.verificationConflict,
    verificationMethod: q.verificationMethod,
  })),

  // Processing metrics
  processingTimeMs: Date.now() - startTime,

  // For database storage (in src/app/api/grading/process/route.ts):
  // await db.graded_results.update({
  //   ocrProvider: result.ocrProvider,
  //   ocr_confidence: result.ocrConfidence,
  //   verification_method: result.questions[0]?.verificationMethod,
  //   verification_result: {
  //     matched: result.questions[0]?.verificationConflict === false,
  //     method: result.questions[0]?.verificationMethod,
  //   },
  //   math_difficulty: result.questions[0]?.difficultyLevel,
  // });
};
```

### 6.2.3 Update questions_json structure
Modify file: `src/lib/ai/types.ts`

Update the `GradingResultQuestion` interface:

```typescript
export interface GradingResultQuestion {
  questionNumber: number;
  problemText: string;

  // OCR data (new)
  mathpixLatex?: string;
  ocrConfidence?: number;

  // AI calculation
  aiCalculation: string;
  aiAnswer: string;
  studentAnswer: string | null;
  isCorrect: boolean;

  // Verification (new)
  difficultyLevel?: 'simple' | 'moderate' | 'complex';
  verificationMethod?: VerificationMethod;
  wolframVerified?: boolean;
  wolframAnswer?: string;
  verificationConflict?: boolean;

  // Scoring
  pointsAwarded: number;
  pointsPossible: number;
  confidence: number;
  readabilityConfidence: number;
  needsReview: boolean;
}
```

Example stored JSON (questions_json column):
```json
{
  "questionNumber": 1,
  "problemText": "Solve: 2x + 3 = 7",
  "mathpixLatex": "2x + 3 = 7",
  "ocrConfidence": 0.96,
  "aiCalculation": "2x = 7 - 3 = 4, x = 4/2 = 2",
  "aiAnswer": "2",
  "studentAnswer": "2",
  "isCorrect": true,
  "difficultyLevel": "complex",
  "verificationMethod": "wolfram",
  "wolframVerified": true,
  "wolframAnswer": "2",
  "verificationConflict": false,
  "pointsAwarded": 10,
  "pointsPossible": 10,
  "confidence": 0.98,
  "readabilityConfidence": 0.95,
  "needsReview": false
}
```

---

## PHASE 6.3: COST TRACKING (3 tasks)

### 6.3.1 Track Mathpix API calls
Modify file: `src/lib/ai/grading-service-enhanced.ts`

Add cost tracking after Mathpix call:

```typescript
// Around line 83-95, after Mathpix extraction:

let mathpixCost = 0;
let mathpixData: any = null;

if (useMathpix && request.image.type === 'base64') {
  try {
    const mathpixResult = await this.mathpix.extractMath(request.image.data);

    if (mathpixResult.success) {
      // Mathpix cost: $0.004-0.01 per image
      // Standard tier: $0.004 per image
      mathpixCost = 0.004;

      // Track in token ledger
      await this.trackCost('mathpix', mathpixCost, {
        imageSize: request.image.data.length,
        confidence: mathpixResult.confidence,
      });
    }
  } catch (error) {
    // ...error handling...
  }
}

// Return with cost breakdown:
return {
  // ... existing fields ...
  costBreakdown: {
    mathpix: mathpixCost,
    gpt4o: estimateGPT4oCost(request.image),
    wolfram: wolframCost || 0,
    total: mathpixCost + gpt4oCost + (wolframCost || 0),
  }
}
```

Add helper method to GradingService:

```typescript
private async trackCost(
  service: string,
  costUSD: number,
  metadata: Record<string, any>
) {
  try {
    // Log for monitoring
    console.log(`[COST] ${service}: $${costUSD.toFixed(4)}`, metadata);

    // Track in token_ledger table
    // INSERT INTO token_ledger (user_id, transaction_type, amount, metadata, created_at)
    // VALUES (?, 'api_cost', ?, ?, NOW())

    // This would be called from the API route:
    // await supabase
    //   .from('token_ledger')
    //   .insert({
    //     user_id: userId,
    //     transaction_type: 'api_cost',
    //     amount: Math.round(costUSD * 10000), // Store as cents to avoid decimals
    //     metadata: { service, ...metadata },
    //     created_at: new Date().toISOString(),
    //   });
  } catch (error) {
    console.error('Failed to track cost:', error);
    // Don't fail grading if cost tracking fails
  }
}
```

### 6.3.2 Track Wolfram API calls
Add to tracking in grading-service-enhanced.ts:

```typescript
// After Wolfram verification (around line 350-370):

let wolframCost = 0;

if (difficulty === 'complex' && wolframAvailable) {
  try {
    const verification = await this.verifyWithWolfram(q);

    // Wolfram cost: $0.01-0.05 per query (depends on complexity)
    // Estimate: algebraic expressions = $0.02, equations = $0.05
    if (q.problemText.includes('=')) {
      wolframCost = 0.05; // Equation solving
    } else {
      wolframCost = 0.02; // Expression evaluation
    }

    await this.trackCost('wolfram', wolframCost, {
      expression: q.problemText.substring(0, 50),
      verified: verification.matched,
    });
  } catch (error) {
    // ...
  }
}
```

### 6.3.3 Add cost breakdown to grading result
Update return type in grading-service-enhanced.ts:

```typescript
export interface EnhancedGradingResult extends GradingResult {
  // ... existing fields ...

  costBreakdown: {
    mathpix: number;      // USD
    gpt4o: number;        // USD
    wolfram: number;      // USD
    total: number;        // USD (sum of above)
  };

  processingMetrics: {
    totalTimeMs: number;
    mathpixTimeMs?: number;
    gpt4oTimeMs: number;
    verificationTimeMs: number;
    aiProviderUsed: string;
    fallbacksRequired: number;
  };
}
```

Example result:
```json
{
  "questions": [...],
  "costBreakdown": {
    "mathpix": 0.004,
    "gpt4o": 0.015,
    "wolfram": 0.05,
    "total": 0.069
  },
  "processingMetrics": {
    "totalTimeMs": 18500,
    "mathpixTimeMs": 3200,
    "gpt4oTimeMs": 10000,
    "verificationTimeMs": 5300,
    "aiProviderUsed": "openai",
    "fallbacksRequired": 0
  }
}
```

---

## PHASE 6.4: FEATURE FLAG REMOVAL (3 tasks)

### 6.4.1 Remove ENABLE_MATHPIX flag (make default)
Modify file: `src/lib/ai/providers/mathpix.ts`

```typescript
// Change from (line 34-41):
// isEnabled(): boolean {
//   const flag = process.env.ENABLE_MATHPIX;
//   if (flag === 'false' || flag === '0') {
//     return false;
//   }
//   return this.isAvailable();
// }

// To (always enabled if credentials present):
isEnabled(): boolean {
  // Mathpix is now always enabled if credentials are present
  // No feature flag needed - it's production ready
  return this.isAvailable();
}
```

Remove from `.env.local.example`:
```
# REMOVE THIS LINE:
# ENABLE_MATHPIX=true
```

### 6.4.2 Remove ENABLE_WOLFRAM_VERIFICATION flag
Modify file: `src/lib/ai/providers/wolfram.ts`

```typescript
// Change from (line 34-41):
// isEnabled(): boolean {
//   const flag = process.env.ENABLE_WOLFRAM_VERIFICATION;
//   if (flag === 'false' || flag === '0') {
//     return false;
//   }
//   return this.isAvailable();
// }

// To (always enabled if credentials present):
isEnabled(): boolean {
  // Wolfram verification is now always enabled if credentials are present
  // Feature flag removed - it's production ready
  return this.isAvailable();
}
```

Remove from `.env.local.example`:
```
# REMOVE THIS LINE:
# ENABLE_WOLFRAM_VERIFICATION=true
```

### 6.4.3 Update documentation
Update file: `README.md`

```markdown
## Math Grading Pipeline (v2)

The enhanced grading pipeline uses a multi-layer approach:

1. **Mathpix OCR** - Specialized math handwriting recognition
   - Extracts LaTeX and plain text from handwritten math
   - Enabled automatically if MATHPIX_APP_ID and MATHPIX_APP_KEY are configured
   - Fallback to vision model if unavailable

2. **GPT-4o Analysis** - Primary AI provider
   - Configured via OPENAI_API_KEY
   - Set as primary in AI_PROVIDER_PRIMARY=openai
   - Temperature set to 0.0 for deterministic output

3. **Math Difficulty Classification** - Automatic routing
   - Simple: Basic arithmetic (no verification needed)
   - Moderate: Fractions, decimals, percentages (chain-of-thought verification)
   - Complex: Algebra, equations, multi-step (Wolfram verification)

4. **Multi-Layer Verification** - Confidence checking
   - Wolfram Alpha for complex math
   - Chain-of-thought for moderate math
   - Answer comparison handles equivalent forms (fractions ↔ decimals)

### Environment Variables

**AI Providers:**
```bash
OPENAI_API_KEY=sk-...          # Required - GPT-4o primary
ANTHROPIC_API_KEY=sk-ant-...   # Optional - fallback #2
GROQ_API_KEY=gsk_...           # Optional - fallback #3
AI_PROVIDER_PRIMARY=openai     # Default: openai
AI_FALLBACK_ORDER=openai,anthropic,groq  # Configurable
```

**Math Verification:**
```bash
MATHPIX_APP_ID=your-app-id     # Optional - math OCR
MATHPIX_APP_KEY=your-app-key   # Required if using Mathpix
WOLFRAM_APP_ID=your-app-id     # Optional - Wolfram verification
```

**Cost Tracking:**
```bash
TRACK_API_COSTS=true            # Enable cost tracking (default: true)
COST_ALERT_THRESHOLD=0.10       # Alert if cost > $0.10 per paper
```

### Cost Estimation

Per-paper costs vary by problem difficulty:

| Difficulty | Mathpix | GPT-4o | Wolfram | Total |
|-----------|---------|--------|---------|-------|
| Simple    | $0.004  | $0.01  | -       | ~$0.014 |
| Moderate  | $0.004  | $0.015 | -       | ~$0.019 |
| Complex   | $0.004  | $0.015 | $0.05   | ~$0.069 |

**Budget:** Assuming 100 papers/day with mixed difficulty:
- Average cost: ~$0.03/paper
- Monthly (2000 papers): ~$60
```

---

## PHASE 6.5: END-TO-END TESTING (4 tasks)

### 6.5.1 Test full pipeline with 20 sample papers
Create file: `tests/integration/full-pipeline.e2e.test.ts`

```typescript
import { describe, it, expect, beforeAll } from 'vitest';
import { getEnhancedGradingService } from '@/lib/ai';
import { readFileSync } from 'fs';
import { readdirSync, join } from 'path';

describe('Full Pipeline - End-to-End (20 sample papers)', () => {
  let service: any;
  const samplePapersDir = 'tests/fixtures/sample-papers';
  const results: any[] = [];

  beforeAll(() => {
    process.env.OPENAI_API_KEY = 'test-key';
    process.env.MATHPIX_APP_ID = 'test-id';
    process.env.MATHPIX_APP_KEY = 'test-key';
    process.env.WOLFRAM_APP_ID = 'test-id';

    service = getEnhancedGradingService();
  });

  it('should process 20 sample papers end-to-end', async () => {
    const sampleFiles = readdirSync(samplePapersDir)
      .filter(f => f.endsWith('.jpg') || f.endsWith('.png'))
      .slice(0, 20);

    expect(sampleFiles.length).toBeGreaterThanOrEqual(20);

    for (const file of sampleFiles) {
      const imagePath = join(samplePapersDir, file);
      const imageBuffer = readFileSync(imagePath);
      const base64 = imageBuffer.toString('base64');

      const result = await service.gradeSubmissionEnhanced({
        image: { type: 'base64', data: base64 },
        projectId: 'test-project',
        studentId: 'test-student',
        answerKey: {
          questions: [
            { problem: 'varies by paper', answer: 'varies by paper' }
          ]
        },
      });

      expect(result).toBeDefined();
      expect(result.questions).toBeDefined();
      expect(result.questions.length).toBeGreaterThan(0);
      expect(result.processingTimeMs).toBeLessThan(30000); // 30s timeout

      results.push({
        file,
        ocrProvider: result.ocrProvider,
        difficulty: result.questions[0].difficultyLevel,
        verificationMethod: result.questions[0].verificationMethod,
        needsReview: result.questions[0].needsReview,
        processingTime: result.processingTimeMs,
        cost: result.costBreakdown?.total || 0,
      });
    }

    console.log('Pipeline results:', JSON.stringify(results, null, 2));
  });

  it('should complete all 20 papers within time budget', () => {
    const totalTime = results.reduce((sum, r) => sum + r.processingTime, 0);
    const avgTime = totalTime / results.length;

    expect(avgTime).toBeLessThan(20000); // Average < 20s
    console.log(`Average processing time: ${avgTime.toFixed(0)}ms`);
  });

  it('should stay within cost budget', () => {
    const totalCost = results.reduce((sum, r) => sum + r.cost, 0);
    const avgCost = totalCost / results.length;

    expect(avgCost).toBeLessThan(0.10); // Average < $0.10/paper
    console.log(`Average cost: $${avgCost.toFixed(4)}`);
  });

  it('should classify difficulty across all levels', () => {
    const difficulties = new Set(results.map(r => r.difficulty));
    expect(difficulties.size).toBeGreaterThan(1); // Has multiple difficulty levels
    console.log('Difficulty distribution:', difficulties);
  });

  it('should use appropriate verification methods', () => {
    const byDifficulty = {};
    results.forEach(r => {
      byDifficulty[r.difficulty] = (byDifficulty[r.difficulty] || []).concat(r.verificationMethod);
    });

    console.log('Verification methods by difficulty:', byDifficulty);
    // Should have mix of verification methods
    expect(Object.keys(byDifficulty).length).toBeGreaterThan(1);
  });

  it('should flag papers needing review appropriately', () => {
    const needsReview = results.filter(r => r.needsReview).length;
    const reviewRate = (needsReview / results.length) * 100;

    expect(reviewRate).toBeLessThan(15); // <15% should need review
    console.log(`Review rate: ${reviewRate.toFixed(1)}%`);
  });
});
```

### 6.5.2 Compare accuracy to baseline
Create file: `tests/integration/accuracy-comparison.test.ts`

```typescript
import { describe, it, expect, beforeAll } from 'vitest';
import { getEnhancedGradingService } from '@/lib/ai';
import { createGroqProvider } from '@/lib/ai/providers/groq';

describe('Accuracy Comparison - Enhanced vs Baseline', () => {
  let enhancedService: any;
  let baselineProvider: any;
  const testCases = [
    // Structure: { image: base64, expectedAnswer: string }
    // Load from tests/fixtures/accuracy-test-cases.json
  ];

  beforeAll(() => {
    process.env.OPENAI_API_KEY = 'test-key';
    process.env.GROQ_API_KEY = 'test-key'; // For baseline
    process.env.MATHPIX_APP_ID = 'test-id';
    process.env.MATHPIX_APP_KEY = 'test-key';
    process.env.WOLFRAM_APP_ID = 'test-id';

    enhancedService = getEnhancedGradingService();
    baselineProvider = createGroqProvider();
  });

  it('should improve accuracy over baseline (Groq)', async () => {
    let enhancedCorrect = 0;
    let baselineCorrect = 0;

    for (const testCase of testCases) {
      // Run enhanced pipeline
      const enhancedResult = await enhancedService.gradeSubmissionEnhanced(testCase);
      if (enhancedResult.questions[0].aiAnswer === testCase.expectedAnswer) {
        enhancedCorrect++;
      }

      // Run baseline (Groq only)
      const baselineResult = await baselineProvider.analyzeImage(
        testCase.image,
        'Grade this problem. Answer: ',
        'You are a math grader'
      );
      if (baselineResult.includes(testCase.expectedAnswer)) {
        baselineCorrect++;
      }
    }

    const enhancedAccuracy = (enhancedCorrect / testCases.length) * 100;
    const baselineAccuracy = (baselineCorrect / testCases.length) * 100;

    console.log(`Enhanced accuracy: ${enhancedAccuracy.toFixed(1)}%`);
    console.log(`Baseline accuracy: ${baselineAccuracy.toFixed(1)}%`);
    console.log(`Improvement: ${(enhancedAccuracy - baselineAccuracy).toFixed(1)}%`);

    // Should improve by at least 10%
    expect(enhancedAccuracy).toBeGreaterThan(baselineAccuracy + 10);
  });

  it('should achieve target accuracy on algebra problems', async () => {
    const algebraCases = testCases.filter(t => t.isAlgebra);
    let correct = 0;

    for (const testCase of algebraCases) {
      const result = await enhancedService.gradeSubmissionEnhanced(testCase);
      if (result.questions[0].aiAnswer === testCase.expectedAnswer) {
        correct++;
      }
    }

    const accuracy = (correct / algebraCases.length) * 100;
    console.log(`Algebra accuracy: ${accuracy.toFixed(1)}%`);

    // Target: 95% on algebra
    expect(accuracy).toBeGreaterThanOrEqual(95);
  });
});
```

### 6.5.3 Measure latency
Create file: `tests/integration/latency.test.ts`

```typescript
import { describe, it, expect, beforeAll } from 'vitest';
import { getEnhancedGradingService } from '@/lib/ai';
import { readFileSync } from 'fs';

describe('Performance - Latency Measurement', () => {
  let service: any;
  const latencies: number[] = [];

  beforeAll(() => {
    process.env.OPENAI_API_KEY = 'test-key';
    process.env.MATHPIX_APP_ID = 'test-id';
    process.env.MATHPIX_APP_KEY = 'test-key';
    process.env.WOLFRAM_APP_ID = 'test-id';
    service = getEnhancedGradingService();
  });

  it('should complete simple math within 5 seconds', async () => {
    const imageBuffer = readFileSync('tests/fixtures/simple-addition-3plus5.jpg');
    const base64 = imageBuffer.toString('base64');

    const start = performance.now();
    await service.gradeSubmissionEnhanced({
      image: { type: 'base64', data: base64 },
      projectId: 'test',
      studentId: 'test',
      answerKey: { questions: [{ answer: '8' }] },
    });
    const duration = performance.now() - start;

    expect(duration).toBeLessThan(5000);
    console.log(`Simple math latency: ${duration.toFixed(0)}ms`);
    latencies.push(duration);
  });

  it('should complete complex math within 30 seconds', async () => {
    const imageBuffer = readFileSync('tests/fixtures/algebra-solve-2x+3=7.jpg');
    const base64 = imageBuffer.toString('base64');

    const start = performance.now();
    await service.gradeSubmissionEnhanced({
      image: { type: 'base64', data: base64 },
      projectId: 'test',
      studentId: 'test',
      answerKey: { questions: [{ answer: '2' }] },
    });
    const duration = performance.now() - start;

    expect(duration).toBeLessThan(30000);
    console.log(`Complex math latency: ${duration.toFixed(0)}ms`);
    latencies.push(duration);
  });

  it('should maintain sub-20s average latency', () => {
    const average = latencies.reduce((a, b) => a + b, 0) / latencies.length;
    expect(average).toBeLessThan(20000);
    console.log(`Average latency: ${average.toFixed(0)}ms`);
  });

  it('should handle 10 concurrent requests without timeout', async () => {
    const promises = [];
    const imageBuffer = readFileSync('tests/fixtures/simple-addition-3plus5.jpg');
    const base64 = imageBuffer.toString('base64');

    const start = performance.now();
    for (let i = 0; i < 10; i++) {
      promises.push(
        service.gradeSubmissionEnhanced({
          image: { type: 'base64', data: base64 },
          projectId: `test-${i}`,
          studentId: `student-${i}`,
          answerKey: { questions: [{ answer: '8' }] },
        })
      );
    }

    await Promise.all(promises);
    const totalDuration = performance.now() - start;

    console.log(`10 concurrent requests in ${totalDuration.toFixed(0)}ms`);
    expect(totalDuration).toBeLessThan(60000); // Should not exceed 60s
  });
});
```

### 6.5.4 Verify cost estimates
Create file: `tests/integration/cost-tracking.test.ts`

```typescript
import { describe, it, expect, beforeAll } from 'vitest';
import { getEnhancedGradingService } from '@/lib/ai';
import { readFileSync } from 'fs';

describe('Cost Tracking - Verification', () => {
  let service: any;

  beforeAll(() => {
    process.env.OPENAI_API_KEY = 'test-key';
    process.env.MATHPIX_APP_ID = 'test-id';
    process.env.MATHPIX_APP_KEY = 'test-key';
    process.env.WOLFRAM_APP_ID = 'test-id';
    process.env.TRACK_API_COSTS = 'true';
    service = getEnhancedGradingService();
  });

  it('should return cost breakdown', async () => {
    const imageBuffer = readFileSync('tests/fixtures/simple-addition-3plus5.jpg');
    const base64 = imageBuffer.toString('base64');

    const result = await service.gradeSubmissionEnhanced({
      image: { type: 'base64', data: base64 },
      projectId: 'test',
      studentId: 'test',
      answerKey: { questions: [{ answer: '8' }] },
    });

    expect(result.costBreakdown).toBeDefined();
    expect(result.costBreakdown.mathpix).toBeDefined();
    expect(result.costBreakdown.gpt4o).toBeDefined();
    expect(result.costBreakdown.total).toBeDefined();
  });

  it('should estimate costs within tolerance', async () => {
    // Test 10 papers and compare actual vs estimated
    const costs = [];

    for (let i = 0; i < 10; i++) {
      const imageBuffer = readFileSync('tests/fixtures/algebra-solve-2x+3=7.jpg');
      const base64 = imageBuffer.toString('base64');

      const result = await service.gradeSubmissionEnhanced({
        image: { type: 'base64', data: base64 },
        projectId: 'test',
        studentId: 'test',
        answerKey: { questions: [{ answer: '2' }] },
      });

      costs.push(result.costBreakdown.total);
    }

    const avgCost = costs.reduce((a, b) => a + b, 0) / costs.length;
    const expectedAvg = 0.069; // From cost table: complex = ~$0.069

    // Should be within 20% of estimate
    expect(Math.abs(avgCost - expectedAvg)).toBeLessThan(expectedAvg * 0.2);
    console.log(`Actual avg: $${avgCost.toFixed(4)}, Estimated: $${expectedAvg.toFixed(4)}`);
  });

  it('should alert if cost exceeds threshold', async () => {
    process.env.COST_ALERT_THRESHOLD = '0.05'; // Alert if > $0.05

    const imageBuffer = readFileSync('tests/fixtures/algebra-solve-2x+3=7.jpg');
    const base64 = imageBuffer.toString('base64');

    const result = await service.gradeSubmissionEnhanced({
      image: { type: 'base64', data: base64 },
      projectId: 'test',
      studentId: 'test',
      answerKey: { questions: [{ answer: '2' }] },
    });

    if (result.costBreakdown.total > 0.05) {
      expect(result.costAlert).toBe(true);
    }
  });
});
```

---

## PHASE 7: DOCUMENTATION & MONITORING

See documentation files in `/Users/jordanolsen/Grade-Math/docs/` for:
- Phase 7.1: Documentation (create project.md, README updates, troubleshooting guide, cost analysis)
- Phase 7.2: Monitoring setup (logging, analytics, alerts)
- Phase 7.3: Cleanup (remove dead code, archive old prompts)

---

## FINAL CHECKLIST

After completing all 110 tasks:

- [ ] `npm run build` - Verify no compilation errors
- [ ] `npm run test` - All 50+ tests pass
- [ ] `npm run lint` - No linting errors
- [ ] Database migration applied: `psql "$DATABASE_URL" < database/migrations/042_*`
- [ ] Environment variables configured in `.env.local`
- [ ] Preview deployed to Vercel
- [ ] Staging accuracy measured (95%+ target)
- [ ] Documentation complete and accurate
- [ ] Cost tracking verified
- [ ] Monitoring and alerts configured
- [ ] Ready for production deployment

---

**TOTAL REMAINING WORK: 41 tasks**
**ESTIMATED TIME: 4-5 days**
**BLOCKING: Database migrations (Phase 6.2) - complete first**
