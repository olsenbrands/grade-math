import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  withRetry,
  withTimeout,
  withFallback,
  withCircuitBreaker,
  debounceAsync,
  withCache,
  clearCache,
  withRateLimit,
} from './graceful-degradation';

describe('withRetry', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should succeed on first try', async () => {
    const fn = vi.fn().mockResolvedValue('success');

    const result = await withRetry(fn);

    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should retry on failure', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error('fail'))
      .mockResolvedValue('success');

    const promise = withRetry(fn, { maxRetries: 3 });

    // Fast-forward through retry delays
    await vi.runAllTimersAsync();

    const result = await promise;

    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('should throw after max retries', async () => {
    vi.useRealTimers(); // Use real timers for this test to avoid unhandled rejection
    const fn = vi.fn().mockRejectedValue(new Error('always fail'));

    await expect(withRetry(fn, { maxRetries: 2, baseDelay: 1, maxDelay: 1 })).rejects.toThrow('always fail');
    expect(fn).toHaveBeenCalledTimes(3); // Initial + 2 retries
  });

  it('should not retry non-retryable errors', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('Unauthorized'));

    await expect(withRetry(fn)).rejects.toThrow('Unauthorized');
    expect(fn).toHaveBeenCalledTimes(1);
  });
});

describe('withTimeout', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should return result if within timeout', async () => {
    const fn = vi.fn().mockResolvedValue('result');

    const result = await withTimeout(fn, 1000);

    expect(result).toBe('result');
  });

  it('should reject if timeout exceeded', async () => {
    vi.useRealTimers(); // Use real timers for timeout test
    const fn = vi.fn(() => new Promise((resolve) => setTimeout(resolve, 5000)));

    // Short timeout to test quickly
    await expect(withTimeout(fn, 50)).rejects.toThrow('Operation timed out');
  });
});

describe('withFallback', () => {
  it('should return result on success', async () => {
    const fn = vi.fn().mockResolvedValue('success');

    const result = await withFallback(fn, 'fallback');

    expect(result).toBe('success');
  });

  it('should return fallback value on error', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('fail'));

    const result = await withFallback(fn, 'fallback');

    expect(result).toBe('fallback');
  });

  it('should call fallback function on error', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('fail'));
    const fallbackFn = vi.fn().mockReturnValue('computed fallback');

    const result = await withFallback(fn, fallbackFn);

    expect(result).toBe('computed fallback');
    expect(fallbackFn).toHaveBeenCalled();
  });

  it('should call async fallback function on error', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('fail'));
    const fallbackFn = vi.fn().mockResolvedValue('async fallback');

    const result = await withFallback(fn, fallbackFn);

    expect(result).toBe('async fallback');
  });
});

describe('withCircuitBreaker', () => {
  beforeEach(() => {
    // Clear circuit breaker state between tests
    vi.resetModules();
  });

  it('should allow requests when circuit is closed', async () => {
    const fn = vi.fn().mockResolvedValue('success');

    const result = await withCircuitBreaker('test-key-1', fn);

    expect(result).toBe('success');
  });

  it('should track failures', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('fail'));

    // Make several failing calls
    for (let i = 0; i < 3; i++) {
      try {
        await withCircuitBreaker('test-key-2', fn, { failureThreshold: 5 });
      } catch {
        // Expected
      }
    }

    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('should open circuit after threshold failures', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('fail'));

    // Exceed failure threshold
    for (let i = 0; i < 5; i++) {
      try {
        await withCircuitBreaker('test-key-3', fn, { failureThreshold: 5 });
      } catch {
        // Expected
      }
    }

    // Next call should fail fast
    await expect(
      withCircuitBreaker('test-key-3', fn, { failureThreshold: 5 })
    ).rejects.toThrow('Circuit breaker open');
  });
});

describe('debounceAsync', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should debounce multiple calls', async () => {
    const fn = vi.fn().mockResolvedValue('result');
    const debounced = debounceAsync(fn, 100);

    // Make multiple rapid calls
    debounced('a');
    debounced('b');
    const promise = debounced('c');

    // Fast-forward past debounce delay
    await vi.advanceTimersByTimeAsync(150);

    const result = await promise;

    expect(result).toBe('result');
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith('c');
  });
});

describe('withCache', () => {
  beforeEach(() => {
    clearCache();
  });

  it('should cache results', async () => {
    const fn = vi.fn().mockResolvedValue('cached');

    const result1 = await withCache('cache-key-1', fn, 60000);
    const result2 = await withCache('cache-key-1', fn, 60000);

    expect(result1).toBe('cached');
    expect(result2).toBe('cached');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should return fresh data after TTL expires', async () => {
    vi.useFakeTimers();
    const fn = vi.fn().mockResolvedValue('fresh');

    await withCache('cache-key-2', fn, 1000);

    // Fast-forward past TTL
    vi.advanceTimersByTime(1001);

    await withCache('cache-key-2', fn, 1000);

    expect(fn).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });

  it('should clear specific cache entry', async () => {
    const fn = vi.fn().mockResolvedValue('data');

    await withCache('cache-key-3', fn);
    clearCache('cache-key-3');
    await withCache('cache-key-3', fn);

    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('should clear all cache entries', async () => {
    const fn1 = vi.fn().mockResolvedValue('data1');
    const fn2 = vi.fn().mockResolvedValue('data2');

    await withCache('cache-key-4a', fn1);
    await withCache('cache-key-4b', fn2);

    clearCache();

    await withCache('cache-key-4a', fn1);
    await withCache('cache-key-4b', fn2);

    expect(fn1).toHaveBeenCalledTimes(2);
    expect(fn2).toHaveBeenCalledTimes(2);
  });
});

describe('withRateLimit', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.resetModules();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should allow requests within rate limit', async () => {
    const fn = vi.fn().mockResolvedValue('result');

    const results = await Promise.all([
      withRateLimit('rate-key-1', fn, { maxTokens: 5 }),
      withRateLimit('rate-key-1', fn, { maxTokens: 5 }),
      withRateLimit('rate-key-1', fn, { maxTokens: 5 }),
    ]);

    expect(results).toEqual(['result', 'result', 'result']);
    expect(fn).toHaveBeenCalledTimes(3);
  });
});

describe('Module exports', () => {
  it('should export all functions', async () => {
    const module = await import('./graceful-degradation');

    expect(module.withRetry).toBeDefined();
    expect(module.withTimeout).toBeDefined();
    expect(module.withFallback).toBeDefined();
    expect(module.withCircuitBreaker).toBeDefined();
    expect(module.debounceAsync).toBeDefined();
    expect(module.withCache).toBeDefined();
    expect(module.clearCache).toBeDefined();
    expect(module.createBatcher).toBeDefined();
    expect(module.withRateLimit).toBeDefined();
  });
});
