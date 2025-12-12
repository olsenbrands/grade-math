/**
 * AI Provider Manager
 *
 * Manages multiple AI providers with automatic fallback
 */

import type {
  AIProvider,
  AIProviderName,
  AIProviderResponse,
  ImageInput,
  AIProviderManagerConfig,
} from './types';
import { createGroqProvider } from './providers/groq';
import { createOpenAIProvider } from './providers/openai';
import { createAnthropicProvider } from './providers/anthropic';

// Default configuration
const DEFAULT_CONFIG: AIProviderManagerConfig = {
  providers: [],
  fallbackOrder: ['groq', 'openai', 'anthropic'],
  maxRetries: 3,
  retryDelayMs: 1000,
};

export class AIProviderManager {
  private providers: Map<AIProviderName, AIProvider> = new Map();
  private config: AIProviderManagerConfig;

  constructor(config: Partial<AIProviderManagerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.initializeProviders();
  }

  private initializeProviders(): void {
    // Initialize all providers
    const groq = createGroqProvider();
    const openai = createOpenAIProvider();
    const anthropic = createAnthropicProvider();

    if (groq.isAvailable()) {
      this.providers.set('groq', groq);
    }
    if (openai.isAvailable()) {
      this.providers.set('openai', openai);
    }
    if (anthropic.isAvailable()) {
      this.providers.set('anthropic', anthropic);
    }
  }

  /**
   * Get list of available providers
   */
  getAvailableProviders(): AIProviderName[] {
    return Array.from(this.providers.keys());
  }

  /**
   * Check if a specific provider is available
   */
  isProviderAvailable(name: AIProviderName): boolean {
    return this.providers.has(name);
  }

  /**
   * Get a specific provider
   */
  getProvider(name: AIProviderName): AIProvider | undefined {
    return this.providers.get(name);
  }

  /**
   * Get the primary (first available) provider
   */
  getPrimaryProvider(): AIProvider | undefined {
    for (const name of this.config.fallbackOrder) {
      const provider = this.providers.get(name);
      if (provider) return provider;
    }
    return undefined;
  }

  /**
   * Analyze image with automatic fallback
   */
  async analyzeImage(
    image: ImageInput,
    prompt: string,
    systemPrompt?: string,
    preferredProvider?: AIProviderName
  ): Promise<AIProviderResponse & { provider: AIProviderName }> {
    // Build provider order
    const providerOrder = preferredProvider
      ? [preferredProvider, ...this.config.fallbackOrder.filter((p) => p !== preferredProvider)]
      : this.config.fallbackOrder;

    let lastError: string = 'No providers available';
    let totalLatency = 0;

    for (const providerName of providerOrder) {
      const provider = this.providers.get(providerName);
      if (!provider) continue;

      // Try this provider with retries
      for (let attempt = 1; attempt <= this.config.maxRetries; attempt++) {
        const response = await provider.analyzeImage(image, prompt, systemPrompt);
        totalLatency += response.latencyMs;

        if (response.success) {
          return {
            ...response,
            provider: providerName,
          };
        }

        lastError = response.error || 'Unknown error';

        // Check if error is retryable
        if (this.isRetryableError(response.error)) {
          // Wait before retry
          if (attempt < this.config.maxRetries) {
            await this.delay(this.config.retryDelayMs * attempt);
          }
        } else {
          // Non-retryable error, move to next provider
          break;
        }
      }

      // Provider failed, log and try next
      console.warn(`Provider ${providerName} failed: ${lastError}`);
    }

    // All providers failed
    return {
      success: false,
      content: '',
      error: `All providers failed. Last error: ${lastError}`,
      latencyMs: totalLatency,
      provider: providerOrder[0] || 'groq',
    };
  }

  /**
   * Analyze image with a specific provider (no fallback)
   */
  async analyzeImageWithProvider(
    providerName: AIProviderName,
    image: ImageInput,
    prompt: string,
    systemPrompt?: string
  ): Promise<AIProviderResponse> {
    const provider = this.providers.get(providerName);
    if (!provider) {
      return {
        success: false,
        content: '',
        error: `Provider ${providerName} not available`,
        latencyMs: 0,
      };
    }

    return provider.analyzeImage(image, prompt, systemPrompt);
  }

  /**
   * Health check all providers
   */
  async healthCheckAll(): Promise<Record<AIProviderName, boolean>> {
    const results: Record<string, boolean> = {};

    for (const [name, provider] of this.providers) {
      results[name] = await provider.healthCheck();
    }

    return results as Record<AIProviderName, boolean>;
  }

  private isRetryableError(error?: string): boolean {
    if (!error) return false;

    const retryablePatterns = [
      'timeout',
      'rate limit',
      '429',
      '503',
      '502',
      'network',
      'ECONNRESET',
      'ETIMEDOUT',
    ];

    const lowerError = error.toLowerCase();
    return retryablePatterns.some((pattern) => lowerError.includes(pattern.toLowerCase()));
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// Singleton instance
let managerInstance: AIProviderManager | null = null;

export function getAIProviderManager(): AIProviderManager {
  if (!managerInstance) {
    managerInstance = new AIProviderManager();
  }
  return managerInstance;
}

export function createAIProviderManager(
  config?: Partial<AIProviderManagerConfig>
): AIProviderManager {
  return new AIProviderManager(config);
}
