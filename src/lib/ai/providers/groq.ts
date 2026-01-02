/**
 * Groq AI Provider
 *
 * Uses Llama 3.2 Vision for image analysis
 * Most cost-effective option for vision tasks
 */

import type {
  AIProvider,
  AIProviderConfig,
  AIProviderResponse,
  ImageInput,
} from '../types';

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

export class GroqProvider implements AIProvider {
  name = 'groq' as const;
  private config: AIProviderConfig;

  constructor(config: Partial<AIProviderConfig> = {}) {
    this.config = {
      name: 'groq',
      apiKey: config.apiKey || process.env.GROQ_API_KEY || '',
      model: config.model || 'llama-3.2-90b-vision-preview',
      maxTokens: config.maxTokens || 4096,
      temperature: config.temperature ?? 0, // Use 0 for deterministic math output
      timeout: config.timeout || 60000,
    };
  }

  isAvailable(): boolean {
    return !!this.config.apiKey;
  }

  async healthCheck(): Promise<boolean> {
    if (!this.isAvailable()) return false;

    try {
      const response = await fetch('https://api.groq.com/openai/v1/models', {
        headers: {
          Authorization: `Bearer ${this.config.apiKey}`,
        },
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  async analyzeImage(
    image: ImageInput,
    prompt: string,
    systemPrompt?: string
  ): Promise<AIProviderResponse> {
    const startTime = Date.now();

    if (!this.isAvailable()) {
      return {
        success: false,
        content: '',
        error: 'Groq API key not configured',
        latencyMs: Date.now() - startTime,
      };
    }

    try {
      // Build image URL for the API
      const imageUrl =
        image.type === 'url'
          ? image.data
          : `data:${image.mimeType};base64,${image.data}`;

      // Build messages
      const messages: Array<{
        role: 'system' | 'user';
        content: string | Array<{ type: string; text?: string; image_url?: { url: string } }>;
      }> = [];

      if (systemPrompt) {
        messages.push({
          role: 'system',
          content: systemPrompt,
        });
      }

      messages.push({
        role: 'user',
        content: [
          {
            type: 'image_url',
            image_url: { url: imageUrl },
          },
          {
            type: 'text',
            text: prompt,
          },
        ],
      });

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

      const response = await fetch(GROQ_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify({
          model: this.config.model,
          messages,
          max_tokens: this.config.maxTokens,
          temperature: this.config.temperature,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        return {
          success: false,
          content: '',
          error: `Groq API error: ${response.status} - ${errorText}`,
          latencyMs: Date.now() - startTime,
        };
      }

      const data = await response.json();

      const content = data.choices?.[0]?.message?.content || '';
      const usage = data.usage;

      return {
        success: true,
        content,
        tokensUsed: usage
          ? {
              input: usage.prompt_tokens,
              output: usage.completion_tokens,
              total: usage.total_tokens,
            }
          : undefined,
        latencyMs: Date.now() - startTime,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.name === 'AbortError'
            ? 'Request timeout'
            : error.message
          : 'Unknown error';

      return {
        success: false,
        content: '',
        error: errorMessage,
        latencyMs: Date.now() - startTime,
      };
    }
  }
}

export function createGroqProvider(config?: Partial<AIProviderConfig>): GroqProvider {
  return new GroqProvider(config);
}
