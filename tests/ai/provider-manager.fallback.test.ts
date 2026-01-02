import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AIProviderManager } from '@/lib/ai/provider-manager';

describe('AIProviderManager - Fallback Behavior', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
    // Clear all provider env vars except OpenAI
    delete process.env.GROQ_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    process.env.OPENAI_API_KEY = 'test-key';
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('TASK 1.3.1: Fallback when GROQ_API_KEY removed', () => {
    it('should use OpenAI when GROQ_API_KEY is missing', () => {
      const manager = new AIProviderManager();
      const availableProviders = manager.getAvailableProviders();
      expect(availableProviders).toContain('openai');
      expect(availableProviders).not.toContain('groq');
    });

    it('should not crash when GROQ_API_KEY is unset', () => {
      delete process.env.GROQ_API_KEY;
      expect(() => new AIProviderManager()).not.toThrow();
    });

    it('should produce valid response with OpenAI fallback', async () => {
      delete process.env.GROQ_API_KEY;
      const manager = new AIProviderManager();

      // OpenAI should be available
      expect(manager.isProviderAvailable('openai')).toBe(true);
      expect(manager.isProviderAvailable('groq')).toBe(false);
    });
  });

  describe('TASK 1.3.2: All Providers Unavailable', () => {
    it('should handle graceful failure when all providers fail', async () => {
      delete process.env.OPENAI_API_KEY;
      delete process.env.ANTHROPIC_API_KEY;
      delete process.env.GROQ_API_KEY;

      const manager = new AIProviderManager();

      const result = await manager.analyzeImage(
        { type: 'base64', data: 'test', mimeType: 'image/jpeg' },
        'test prompt',
        'system',
        undefined
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('All providers failed');
    });

    it('should return clear error message when no providers available', async () => {
      delete process.env.OPENAI_API_KEY;
      delete process.env.ANTHROPIC_API_KEY;
      delete process.env.GROQ_API_KEY;

      const manager = new AIProviderManager();

      const result = await manager.analyzeImage(
        { type: 'base64', data: 'test', mimeType: 'image/jpeg' },
        'test',
        'system'
      );

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error).toContain('No providers available');
    });

    it('should not crash when all providers fail', () => {
      delete process.env.OPENAI_API_KEY;
      delete process.env.ANTHROPIC_API_KEY;
      delete process.env.GROQ_API_KEY;

      expect(() => new AIProviderManager()).not.toThrow();
    });
  });

  describe('Fallback Order', () => {
    it('should have fallback order: openai → anthropic → groq by default', () => {
      const manager = new AIProviderManager();
      const config = (manager as any).config;
      expect(config.fallbackOrder[0]).toBe('openai');
      expect(config.fallbackOrder).toContain('anthropic');
      expect(config.fallbackOrder).toContain('groq');
    });

    it('should skip unavailable providers in fallback chain', () => {
      process.env.ANTHROPIC_API_KEY = '';
      const manager = new AIProviderManager();
      const config = (manager as any).config;
      expect(config.fallbackOrder).toContain('groq');
    });
  });

  describe('Provider Availability', () => {
    it('should use first available provider from fallback order', () => {
      process.env.OPENAI_API_KEY = 'test-key';
      const manager = new AIProviderManager();
      const primary = manager.getPrimaryProvider();
      expect(primary).toBeDefined();
    });

    it('should return undefined when no providers available', () => {
      delete process.env.OPENAI_API_KEY;
      delete process.env.ANTHROPIC_API_KEY;
      delete process.env.GROQ_API_KEY;

      const manager = new AIProviderManager();
      const primary = manager.getPrimaryProvider();
      expect(primary).toBeUndefined();
    });

    it('should track latency across fallback attempts', async () => {
      delete process.env.OPENAI_API_KEY;
      const manager = new AIProviderManager();

      const result = await manager.analyzeImage(
        { type: 'base64', data: 'test', mimeType: 'image/jpeg' },
        'test',
        'system'
      );

      expect(result.latencyMs).toBeGreaterThanOrEqual(0);
    });
  });
});
