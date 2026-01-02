/**
 * Mathpix OCR Provider
 *
 * Specialized math handwriting recognition using Mathpix API
 * Converts handwritten math to LaTeX and plain text
 *
 * API Documentation: https://docs.mathpix.com/
 */

import type { MathpixConfig, MathpixResult } from '../types';

const MATHPIX_API_URL = 'https://api.mathpix.com/v3/text';

export class MathpixProvider {
  private config: MathpixConfig;

  constructor(config?: Partial<MathpixConfig>) {
    this.config = {
      appId: config?.appId || process.env.MATHPIX_APP_ID || '',
      appKey: config?.appKey || process.env.MATHPIX_APP_KEY || '',
      timeout: config?.timeout || 10000,
    };
  }

  /**
   * Check if Mathpix is configured and available
   */
  isAvailable(): boolean {
    return !!(this.config.appId && this.config.appKey);
  }

  /**
   * Check if Mathpix is enabled
   * Now always enabled if credentials are present (feature flag removed)
   */
  isEnabled(): boolean {
    // Mathpix is now always enabled if credentials are present
    // No feature flag needed - it's production ready
    return this.isAvailable();
  }

  /**
   * Extract math from an image using Mathpix OCR
   *
   * @param imageBase64 - Base64 encoded image data (without data URL prefix)
   * @param mimeType - Image MIME type (default: image/jpeg)
   * @returns MathpixResult with LaTeX and text representations
   */
  async extractMath(
    imageBase64: string,
    mimeType: string = 'image/jpeg'
  ): Promise<MathpixResult> {
    const startTime = Date.now();

    if (!this.isAvailable()) {
      return {
        success: false,
        confidence: 0,
        error: 'Mathpix API not configured (missing APP_ID or APP_KEY)',
        latencyMs: Date.now() - startTime,
      };
    }

    try {
      // Clean base64 data - remove any whitespace or data URL prefix
      let cleanBase64 = imageBase64.replace(/[\s\r\n]/g, '');
      if (cleanBase64.includes(',')) {
        cleanBase64 = cleanBase64.split(',')[1] || cleanBase64;
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

      const response = await fetch(MATHPIX_API_URL, {
        method: 'POST',
        headers: {
          'app_id': this.config.appId,
          'app_key': this.config.appKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          src: `data:${mimeType};base64,${cleanBase64}`,
          formats: ['latex_styled', 'text'],
          data_options: {
            include_detected_alphabets: true,
            include_word_data: true,
          },
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        return {
          success: false,
          confidence: 0,
          error: `Mathpix API error: ${response.status} - ${errorText}`,
          latencyMs: Date.now() - startTime,
        };
      }

      const data = await response.json();

      // Extract confidence from response
      // Mathpix returns confidence per character, we average them
      let confidence = 0.8; // Default confidence
      if (data.confidence !== undefined) {
        confidence = data.confidence;
      } else if (data.confidence_rate !== undefined) {
        confidence = data.confidence_rate;
      }

      // Extract word-level data if available
      const wordData = data.word_data?.map((w: { text: string; confidence?: number; cnt?: { x: number; y: number; w: number; h: number }[] }) => ({
        text: w.text,
        confidence: w.confidence || 0.8,
        rect: w.cnt ? {
          x: w.cnt[0]?.x || 0,
          y: w.cnt[0]?.y || 0,
          width: w.cnt[2]?.x ? w.cnt[2].x - (w.cnt[0]?.x || 0) : 0,
          height: w.cnt[2]?.y ? w.cnt[2].y - (w.cnt[0]?.y || 0) : 0,
        } : undefined,
      }));

      return {
        success: true,
        latex: data.latex_styled || data.latex,
        text: data.text,
        confidence,
        latencyMs: Date.now() - startTime,
        wordData,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.name === 'AbortError'
            ? 'Mathpix request timeout'
            : error.message
          : 'Unknown Mathpix error';

      return {
        success: false,
        confidence: 0,
        error: errorMessage,
        latencyMs: Date.now() - startTime,
      };
    }
  }

  /**
   * Extract math from multiple regions of an image
   * Useful for worksheets with multiple problems
   */
  async extractMathBatch(
    imageBase64: string,
    mimeType: string = 'image/jpeg'
  ): Promise<MathpixResult> {
    // For now, just use the single extraction
    // Future: Could implement region-based extraction
    return this.extractMath(imageBase64, mimeType);
  }
}

// Singleton instance
let mathpixInstance: MathpixProvider | null = null;

export function getMathpixProvider(): MathpixProvider {
  if (!mathpixInstance) {
    mathpixInstance = new MathpixProvider();
  }
  return mathpixInstance;
}

export function createMathpixProvider(config?: Partial<MathpixConfig>): MathpixProvider {
  return new MathpixProvider(config);
}
