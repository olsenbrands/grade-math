/**
 * Graceful Degradation Utilities
 *
 * Provides retry logic, fallbacks, and resilient error handling
 */

/**
 * Retry configuration
 */
interface RetryConfig {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  backoffFactor: number;
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelay: 1000,
  maxDelay: 10000,
  backoffFactor: 2,
};

/**
 * Calculate delay with exponential backoff and jitter
 */
function calculateDelay(attempt: number, config: RetryConfig): number {
  const delay = Math.min(
    config.baseDelay * Math.pow(config.backoffFactor, attempt),
    config.maxDelay
  );
  // Add jitter (0-25% of delay)
  const jitter = delay * 0.25 * Math.random();
  return delay + jitter;
}

/**
 * Retry a function with exponential backoff
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  config: Partial<RetryConfig> = {}
): Promise<T> {
  const fullConfig = { ...DEFAULT_RETRY_CONFIG, ...config };
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= fullConfig.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Don't retry on certain errors
      if (isNonRetryableError(lastError)) {
        throw lastError;
      }

      if (attempt < fullConfig.maxRetries) {
        const delay = calculateDelay(attempt, fullConfig);
        await sleep(delay);
      }
    }
  }

  throw lastError;
}

/**
 * Check if error should not be retried
 */
function isNonRetryableError(error: Error): boolean {
  const message = error.message.toLowerCase();
  return (
    message.includes('unauthorized') ||
    message.includes('forbidden') ||
    message.includes('not found') ||
    message.includes('invalid') ||
    message.includes('bad request')
  );
}

/**
 * Sleep utility
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Execute with timeout
 */
export async function withTimeout<T>(
  fn: () => Promise<T>,
  timeoutMs: number,
  fallback?: T
): Promise<T> {
  return Promise.race([
    fn(),
    new Promise<T>((resolve, reject) =>
      setTimeout(() => {
        if (fallback !== undefined) {
          resolve(fallback as T);
        } else {
          reject(new Error(`Operation timed out after ${timeoutMs}ms`));
        }
      }, timeoutMs)
    ),
  ]);
}

/**
 * Execute with fallback on error
 */
export async function withFallback<T>(
  fn: () => Promise<T>,
  fallback: T | (() => T) | (() => Promise<T>)
): Promise<T> {
  try {
    return await fn();
  } catch {
    if (typeof fallback === 'function') {
      return await (fallback as () => Promise<T>)();
    }
    return fallback;
  }
}

/**
 * Circuit breaker state
 */
interface CircuitBreakerState {
  failures: number;
  lastFailure: number;
  isOpen: boolean;
}

const circuitBreakers = new Map<string, CircuitBreakerState>();

interface CircuitBreakerConfig {
  failureThreshold: number;
  resetTimeout: number;
}

const DEFAULT_CIRCUIT_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 5,
  resetTimeout: 30000, // 30 seconds
};

/**
 * Execute with circuit breaker pattern
 */
export async function withCircuitBreaker<T>(
  key: string,
  fn: () => Promise<T>,
  config: Partial<CircuitBreakerConfig> = {}
): Promise<T> {
  const fullConfig = { ...DEFAULT_CIRCUIT_CONFIG, ...config };

  let state = circuitBreakers.get(key);
  if (!state) {
    state = { failures: 0, lastFailure: 0, isOpen: false };
    circuitBreakers.set(key, state);
  }

  // Check if circuit should be reset
  if (state.isOpen && Date.now() - state.lastFailure > fullConfig.resetTimeout) {
    state.isOpen = false;
    state.failures = 0;
  }

  // Circuit is open - fail fast
  if (state.isOpen) {
    throw new Error(`Circuit breaker open for: ${key}`);
  }

  try {
    const result = await fn();
    // Success - reset failures
    state.failures = 0;
    return result;
  } catch (error) {
    state.failures++;
    state.lastFailure = Date.now();

    if (state.failures >= fullConfig.failureThreshold) {
      state.isOpen = true;
    }

    throw error;
  }
}

/**
 * Debounced async function
 */
export function debounceAsync<T, Args extends unknown[]>(
  fn: (...args: Args) => Promise<T>,
  delay: number
): (...args: Args) => Promise<T> {
  let timeoutId: NodeJS.Timeout | null = null;
  let pendingPromise: Promise<T> | null = null;

  return (...args: Args): Promise<T> => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    pendingPromise = new Promise((resolve, reject) => {
      timeoutId = setTimeout(async () => {
        try {
          const result = await fn(...args);
          resolve(result);
        } catch (error) {
          reject(error);
        }
      }, delay);
    });

    return pendingPromise;
  };
}

/**
 * Cache with TTL
 */
interface CacheEntry<T> {
  value: T;
  expiry: number;
}

const cache = new Map<string, CacheEntry<unknown>>();

export async function withCache<T>(
  key: string,
  fn: () => Promise<T>,
  ttlMs: number = 60000
): Promise<T> {
  const entry = cache.get(key) as CacheEntry<T> | undefined;

  if (entry && entry.expiry > Date.now()) {
    return entry.value;
  }

  const value = await fn();
  cache.set(key, { value, expiry: Date.now() + ttlMs });
  return value;
}

/**
 * Clear cache entry or all entries
 */
export function clearCache(key?: string): void {
  if (key) {
    cache.delete(key);
  } else {
    cache.clear();
  }
}

/**
 * Batch multiple calls into one
 */
export function createBatcher<T, K>(
  fn: (keys: K[]) => Promise<Map<K, T>>,
  options: { maxBatchSize?: number; delay?: number } = {}
): (key: K) => Promise<T> {
  const { maxBatchSize = 50, delay = 10 } = options;
  let queue: Array<{ key: K; resolve: (value: T) => void; reject: (error: Error) => void }> = [];
  let timeoutId: NodeJS.Timeout | null = null;

  async function flush() {
    const batch = queue;
    queue = [];
    timeoutId = null;

    const keys = batch.map((item) => item.key);

    try {
      const results = await fn(keys);
      batch.forEach(({ key, resolve, reject }) => {
        const result = results.get(key);
        if (result !== undefined) {
          resolve(result);
        } else {
          reject(new Error(`No result for key: ${key}`));
        }
      });
    } catch (error) {
      batch.forEach(({ reject }) => {
        reject(error instanceof Error ? error : new Error(String(error)));
      });
    }
  }

  return (key: K): Promise<T> => {
    return new Promise((resolve, reject) => {
      queue.push({ key, resolve, reject });

      if (queue.length >= maxBatchSize) {
        if (timeoutId) clearTimeout(timeoutId);
        flush();
      } else if (!timeoutId) {
        timeoutId = setTimeout(flush, delay);
      }
    });
  };
}

/**
 * Rate limiter
 */
interface RateLimiterState {
  tokens: number;
  lastRefill: number;
}

const rateLimiters = new Map<string, RateLimiterState>();

export async function withRateLimit<T>(
  key: string,
  fn: () => Promise<T>,
  options: { maxTokens?: number; refillRate?: number } = {}
): Promise<T> {
  const { maxTokens = 10, refillRate = 1000 } = options;

  let state = rateLimiters.get(key);
  if (!state) {
    state = { tokens: maxTokens, lastRefill: Date.now() };
    rateLimiters.set(key, state);
  }

  // Refill tokens
  const now = Date.now();
  const elapsed = now - state.lastRefill;
  const refill = Math.floor(elapsed / refillRate);
  if (refill > 0) {
    state.tokens = Math.min(maxTokens, state.tokens + refill);
    state.lastRefill = now;
  }

  // Check if we have tokens
  if (state.tokens <= 0) {
    const waitTime = refillRate - (now - state.lastRefill);
    await sleep(waitTime);
    state.tokens = 1;
    state.lastRefill = Date.now();
  }

  state.tokens--;
  return fn();
}
