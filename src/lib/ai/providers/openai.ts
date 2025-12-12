/**
 * OpenAI AI Provider
 *
 * Uses GPT-4o for image analysis
 * High quality, higher cost
 */

import type {
  AIProvider,
  AIProviderConfig,
  AIProviderResponse,
  ImageInput,
} from '../types';

const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';

export class OpenAIProvider implements AIProvider {
  name = 'openai' as const;
  private config: AIProviderConfig;

  constructor(config: Partial<AIProviderConfig> = {}) {
    this.config = {
      name: 'openai',
      apiKey: config.apiKey || process.env.OPENAI_API_KEY || '',
      model: config.model || 'gpt-4o',
      maxTokens: config.maxTokens || 4096,
      temperature: config.temperature ?? 0.1,
      timeout: config.timeout || 60000,
    };
  }

  isAvailable(): boolean {
    return !!this.config.apiKey;
  }

  async healthCheck(): Promise<boolean> {
    if (!this.isAvailable()) return false;

    try {
      const response = await fetch('https://api.openai.com/v1/models', {
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
        error: 'OpenAI API key not configured',
        latencyMs: Date.now() - startTime,
      };
    }

    try {
      // Build image URL for the API
      let imageUrl: string;
      if (image.type === 'url') {
        imageUrl = image.data;
      } else {
        // Clean base64 data - remove any whitespace, newlines, or invalid characters
        const cleanBase64 = image.data.replace(/[\s\r\n]/g, '');
        imageUrl = `data:${image.mimeType};base64,${cleanBase64}`;
      }

      // Build messages
      type MessageContent = string | Array<{ type: string; text?: string; image_url?: { url: string; detail?: string } }>;
      const messages: Array<{ role: 'system' | 'user'; content: MessageContent }> = [];

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
            image_url: {
              url: imageUrl,
              detail: 'high', // Use high detail for better OCR
            },
          },
          {
            type: 'text',
            text: prompt,
          },
        ],
      });

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

      const response = await fetch(OPENAI_API_URL, {
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
          error: `OpenAI API error: ${response.status} - ${errorText}`,
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

export function createOpenAIProvider(config?: Partial<AIProviderConfig>): OpenAIProvider {
  return new OpenAIProvider(config);
}
