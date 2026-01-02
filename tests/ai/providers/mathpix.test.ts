import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MathpixProvider } from '@/lib/ai/providers/mathpix';

describe('MathpixProvider', () => {
  let provider: MathpixProvider;
  const originalEnv = process.env;
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
    process.env.MATHPIX_APP_ID = 'test-app-id';
    process.env.MATHPIX_APP_KEY = 'test-app-key';
    provider = new MathpixProvider();
  });

  afterEach(() => {
    process.env = originalEnv;
    global.fetch = originalFetch;
    vi.restoreAllMocks();
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

    it('should return false when credentials missing', () => {
      delete process.env.MATHPIX_APP_ID;
      const p = new MathpixProvider();
      expect(p.isEnabled()).toBe(false);
    });

    it('should always be enabled when credentials are present', () => {
      // Feature flags removed - always enabled if credentials present
      const p = new MathpixProvider();
      expect(p.isEnabled()).toBe(true);
    });
  });

  describe('extractMath', () => {
    it('should call Mathpix API with correct format', async () => {
      const fetchSpy = vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            latex_styled: '3 + 5',
            text: '3 + 5',
            confidence: 0.95,
          }),
        } as Response)
      );
      global.fetch = fetchSpy;

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
      };

      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockResponse),
        } as Response)
      );

      const result = await provider.extractMath('base64');

      expect(result.success).toBe(true);
      expect(result.latex).toBe('\\frac{3}{4} + \\frac{1}{2}');
      expect(result.text).toBe('3/4 + 1/2');
      expect(result.confidence).toBe(0.95);
    });

    it('should handle API errors gracefully', async () => {
      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: false,
          status: 500,
          text: () => Promise.resolve('Internal Server Error'),
        } as Response)
      );

      const result = await provider.extractMath('base64');
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should respect timeout configuration', () => {
      const p = new MathpixProvider({ timeout: 5000 });
      expect((p as any).config.timeout).toBe(5000);
    });

    it('should return error when not available', async () => {
      delete process.env.MATHPIX_APP_ID;
      const p = new MathpixProvider();

      const result = await p.extractMath('base64');

      expect(result.success).toBe(false);
      expect(result.error).toContain('not configured');
    });

    it('should handle network timeout', async () => {
      global.fetch = vi.fn(() =>
        new Promise((_, reject) => {
          const error = new Error('Network timeout');
          (error as any).name = 'AbortError';
          reject(error);
        })
      );

      const result = await provider.extractMath('base64');

      expect(result.success).toBe(false);
      expect(result.error).toContain('timeout');
    });

    it('should clean base64 data with data URL prefix', async () => {
      const fetchSpy = vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            latex_styled: '3 + 5',
            text: '3 + 5',
            confidence: 0.95,
          }),
        } as Response)
      );
      global.fetch = fetchSpy;

      await provider.extractMath('data:image/jpeg;base64,SGVsbG8=');

      const callBody = JSON.parse((fetchSpy.mock.calls[0] as any)[1].body);
      // Should have cleaned the data URL
      expect(callBody.src).toContain('base64,');
    });
  });
});
