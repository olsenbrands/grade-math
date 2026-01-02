import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { WolframProvider } from '@/lib/ai/providers/wolfram';

describe('WolframProvider', () => {
  let provider: WolframProvider;
  const originalEnv = process.env;
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
    process.env.WOLFRAM_APP_ID = 'test-wolfram-id';
    provider = new WolframProvider();
  });

  afterEach(() => {
    process.env = originalEnv;
    global.fetch = originalFetch;
    vi.restoreAllMocks();
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

    it('should return false when credentials missing', () => {
      delete process.env.WOLFRAM_APP_ID;
      const p = new WolframProvider();
      expect(p.isEnabled()).toBe(false);
    });

    it('should always be enabled when credentials are present', () => {
      // Feature flags removed - always enabled if credentials present
      const p = new WolframProvider();
      expect(p.isEnabled()).toBe(true);
    });
  });

  describe('solve', () => {
    it('should call Wolfram API with correct endpoint', async () => {
      const fetchSpy = vi.fn(() =>
        Promise.resolve({
          ok: true,
          text: () => Promise.resolve('5'),
        } as Response)
      );
      global.fetch = fetchSpy;

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
      expect(result.success).toBe(true);
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
      expect(result.success).toBe(true);
      expect(result.result).toBe('1.25');
    });

    it('should solve equations', async () => {
      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          text: () => Promise.resolve('5'),
        } as Response)
      );

      const result = await provider.solve('solve 2x + 3 = 13 for x');
      expect(result.success).toBe(true);
      expect(result.result).toBe('5');
    });

    it('should handle LaTeX input by normalizing', async () => {
      const fetchSpy = vi.fn(() =>
        Promise.resolve({
          ok: true,
          text: () => Promise.resolve('1.25'),
        } as Response)
      );
      global.fetch = fetchSpy;

      await provider.solve('\\frac{5}{4}');

      // Check the URL was called with normalized expression
      const callUrl = (fetchSpy.mock.calls[0] as any)[0] as string;
      expect(callUrl).not.toContain('\\frac');
    });

    it('should handle invalid expressions (501 response)', async () => {
      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: false,
          status: 501,
          text: () => Promise.resolve('Wolfram|Alpha did not understand your input'),
        } as Response)
      );

      const result = await provider.solve('not math gibberish');
      expect(result.success).toBe(false);
      expect(result.error).toContain('could not interpret');
    });

    it('should respect timeout configuration', () => {
      const p = new WolframProvider({ timeout: 3000 });
      expect((p as any).config.timeout).toBe(3000);
    });

    it('should return error when not available', async () => {
      delete process.env.WOLFRAM_APP_ID;
      const p = new WolframProvider();

      const result = await p.solve('2 + 2');

      expect(result.success).toBe(false);
      expect(result.error).toContain('not configured');
    });

    it('should handle network timeout', async () => {
      global.fetch = vi.fn(() =>
        new Promise((_, reject) => {
          const error = new Error('Timeout');
          (error as any).name = 'AbortError';
          reject(error);
        })
      );

      const result = await provider.solve('2 + 2');

      expect(result.success).toBe(false);
      expect(result.error).toContain('timeout');
    });

    it('should normalize LaTeX fractions to Wolfram format', async () => {
      const fetchSpy = vi.fn(() =>
        Promise.resolve({
          ok: true,
          text: () => Promise.resolve('0.75'),
        } as Response)
      );
      global.fetch = fetchSpy;

      await provider.solve('\\frac{3}{4}');

      const callUrl = (fetchSpy.mock.calls[0] as any)[0] as string;
      // Should convert \frac{3}{4} to (3)/(4) or similar
      expect(callUrl).toContain('3');
      expect(callUrl).toContain('4');
    });

    it('should normalize LaTeX multiplication symbols', async () => {
      const fetchSpy = vi.fn(() =>
        Promise.resolve({
          ok: true,
          text: () => Promise.resolve('6'),
        } as Response)
      );
      global.fetch = fetchSpy;

      await provider.solve('2 \\times 3');

      const callUrl = (fetchSpy.mock.calls[0] as any)[0] as string;
      expect(callUrl).not.toContain('\\times');
    });
  });

  describe('Rate Limiting', () => {
    it('should handle HTTP 429 error', async () => {
      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: false,
          status: 429,
          statusText: 'Too Many Requests',
          text: () => Promise.resolve('Rate limit exceeded'),
        } as Response)
      );

      const result = await provider.solve('2 + 2');
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should include error message in result', async () => {
      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: false,
          status: 429,
          text: () => Promise.resolve('Rate limit exceeded'),
        } as Response)
      );

      const result = await provider.solve('2 + 2');

      expect(result.success).toBe(false);
      expect(result.error).toContain('429');
    });
  });

  describe('solveBatch', () => {
    it('should solve multiple expressions sequentially', async () => {
      global.fetch = vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          text: () => Promise.resolve('5'),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          text: () => Promise.resolve('10'),
        } as Response);

      const results = await provider.solveBatch(['2 + 3', '5 + 5']);

      expect(results).toHaveLength(2);
      expect(results[0].result).toBe('5');
      expect(results[1].result).toBe('10');
    });
  });
});
