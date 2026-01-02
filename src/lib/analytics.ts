/**
 * TASK 7.2.2: Vercel Analytics Integration
 *
 * Track key metrics for grading pipeline performance
 */

import { logger } from './logger';

interface GradingAnalyticsEvent {
  submissionId: string;
  difficulty: 'simple' | 'moderate' | 'complex';
  success: boolean;
  needsReview: boolean;
  latencyMs: number;
  provider: string;
  ocrProvider?: 'mathpix' | 'vision';
  verificationMethod?: 'none' | 'chain_of_thought' | 'wolfram';
  costTotal?: number;
}

interface ProviderAnalyticsEvent {
  provider: string;
  success: boolean;
  latencyMs: number;
  errorType?: string;
  isFallback: boolean;
}

interface CostAnalyticsEvent {
  submissionId: string;
  mathpix: number;
  gpt4o: number;
  wolfram: number;
  total: number;
}

class Analytics {
  private isEnabled: boolean;

  constructor() {
    // Enable analytics in production or when VERCEL_ANALYTICS_ID is set
    this.isEnabled =
      process.env.NODE_ENV === 'production' ||
      !!process.env.VERCEL_ANALYTICS_ID ||
      process.env.ENABLE_ANALYTICS === 'true';
  }

  /**
   * Track a grading operation
   */
  trackGrading(event: GradingAnalyticsEvent): void {
    if (!this.isEnabled) return;

    logger.analytics('Grading event tracked', {
      submissionId: event.submissionId,
      data: {
        difficulty: event.difficulty,
        success: event.success,
        needsReview: event.needsReview,
        latencyMs: event.latencyMs,
        provider: event.provider,
        ocrProvider: event.ocrProvider,
        verificationMethod: event.verificationMethod,
        costTotal: event.costTotal,
      },
    });

    // If Vercel Analytics is available, use it
    if (typeof window !== 'undefined' && (window as any).va) {
      (window as any).va('track', 'grading', event);
    }

    // Server-side: log structured data for Vercel log drain
    if (typeof window === 'undefined') {
      console.log(JSON.stringify({
        event: 'grading',
        timestamp: new Date().toISOString(),
        ...event,
      }));
    }
  }

  /**
   * Track provider usage and failures
   */
  trackProvider(event: ProviderAnalyticsEvent): void {
    if (!this.isEnabled) return;

    logger.analytics('Provider event tracked', {
      data: {
        provider: event.provider,
        success: event.success,
        latencyMs: event.latencyMs,
        errorType: event.errorType,
        isFallback: event.isFallback,
      },
    });

    if (typeof window === 'undefined') {
      console.log(JSON.stringify({
        event: 'provider',
        timestamp: new Date().toISOString(),
        ...event,
      }));
    }
  }

  /**
   * Track API costs
   */
  trackCost(event: CostAnalyticsEvent): void {
    if (!this.isEnabled) return;

    logger.analytics('Cost event tracked', {
      submissionId: event.submissionId,
      data: {
        mathpix: event.mathpix,
        gpt4o: event.gpt4o,
        wolfram: event.wolfram,
        total: event.total,
      },
    });

    if (typeof window === 'undefined') {
      console.log(JSON.stringify({
        event: 'cost',
        timestamp: new Date().toISOString(),
        ...event,
      }));
    }
  }

  /**
   * Track needsReview flags for monitoring review rate
   */
  trackReview(submissionId: string, reason: string, confidence?: number): void {
    if (!this.isEnabled) return;

    logger.analytics('Review flagged', {
      submissionId,
      data: { reason, confidence },
    });

    if (typeof window === 'undefined') {
      console.log(JSON.stringify({
        event: 'review_flagged',
        timestamp: new Date().toISOString(),
        submissionId,
        reason,
        confidence,
      }));
    }
  }

  /**
   * Track API errors for alerting
   */
  trackError(provider: string, errorType: string, errorMessage: string): void {
    if (!this.isEnabled) return;

    logger.analytics('Error tracked', {
      data: { provider, errorType, errorMessage },
    });

    if (typeof window === 'undefined') {
      console.log(JSON.stringify({
        event: 'api_error',
        timestamp: new Date().toISOString(),
        provider,
        errorType,
        errorMessage,
      }));
    }
  }

  /**
   * Track daily summary metrics
   */
  trackDailySummary(summary: {
    date: string;
    totalSubmissions: number;
    successRate: number;
    reviewRate: number;
    avgLatencyMs: number;
    totalCost: number;
    byDifficulty: {
      simple: { count: number; successRate: number };
      moderate: { count: number; successRate: number };
      complex: { count: number; successRate: number };
    };
  }): void {
    if (!this.isEnabled) return;

    logger.analytics('Daily summary', {
      data: summary,
    });

    if (typeof window === 'undefined') {
      console.log(JSON.stringify({
        event: 'daily_summary',
        timestamp: new Date().toISOString(),
        ...summary,
      }));
    }
  }
}

// Export singleton instance
export const analytics = new Analytics();

// Export class for testing
export { Analytics };
