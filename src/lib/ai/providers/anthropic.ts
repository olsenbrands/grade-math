/**
 * Anthropic AI Provider
 *
 * Uses Claude 3.5 Sonnet for image analysis
 * Excellent reasoning, good for complex grading
 */

import type {
  AIProvider,
  AIProviderConfig,
  AIProviderResponse,
  ImageInput,
} from '../types';

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';

export class AnthropicProvider implements AIProvider {
  name = 'anthropic' as const;
  private config: AIProviderConfig;

  constructor(config: Partial<AIProviderConfig> = {}) {
    this.config = {
      name: 'anthropic',
      apiKey: config.apiKey || process.env.ANTHROPIC_API_KEY || '',
      model: config.model || 'claude-3-5-sonnet-20241022',
      maxTokens: config.maxTokens || 4096,
      temperature: config.temperature ?? 0, // Use 0 for deterministic math output
      timeout: config.timeout || 60000,
    };
  }

  isAvailable(): boolean {
    return !!this.config.apiKey;
  }

  async healthCheck(): Promise<boolean> {
    // Anthropic doesn't have a simple health endpoint
    // Just check if API key is set
    return this.isAvailable();
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
        error: 'Anthropic API key not configured',
        latencyMs: Date.now() - startTime,
      };
    }

    try {
      // Anthropic requires base64 for images
      const imageData = image.type === 'base64' ? image.data : await this.urlToBase64(image.data);

      // Map MIME type to Anthropic's expected format
      const mediaType = image.mimeType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';

      // Build content array
      const content: Array<
        | { type: 'image'; source: { type: 'base64'; media_type: string; data: string } }
        | { type: 'text'; text: string }
      > = [
        {
          type: 'image',
          source: {
            type: 'base64',
            media_type: mediaType,
            data: imageData,
          },
        },
        {
          type: 'text',
          text: prompt,
        },
      ];

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

      const requestBody: {
        model: string;
        max_tokens: number;
        messages: Array<{ role: 'user'; content: typeof content }>;
        system?: string;
      } = {
        model: this.config.model,
        max_tokens: this.config.maxTokens ?? 4096,
        messages: [
          {
            role: 'user',
            content,
          },
        ],
      };

      if (systemPrompt) {
        requestBody.system = systemPrompt;
      }

      const response = await fetch(ANTHROPIC_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.config.apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        return {
          success: false,
          content: '',
          error: `Anthropic API error: ${response.status} - ${errorText}`,
          latencyMs: Date.now() - startTime,
        };
      }

      const data = await response.json();

      // Extract text content
      const textContent = data.content?.find((c: { type: string }) => c.type === 'text');
      const responseText = textContent?.text || '';

      return {
        success: true,
        content: responseText,
        tokensUsed: data.usage
          ? {
              input: data.usage.input_tokens,
              output: data.usage.output_tokens,
              total: data.usage.input_tokens + data.usage.output_tokens,
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

  private async urlToBase64(url: string): Promise<string> {
    const response = await fetch(url);
    const arrayBuffer = await response.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    let binary = '';
    for (let i = 0; i < uint8Array.length; i++) {
      const byte = uint8Array[i];
      if (byte !== undefined) {
        binary += String.fromCharCode(byte);
      }
    }
    return btoa(binary);
  }
}

export function createAnthropicProvider(config?: Partial<AIProviderConfig>): AnthropicProvider {
  return new AnthropicProvider(config);
}
