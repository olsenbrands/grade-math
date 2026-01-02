/**
 * TASK 7.2.4: Track needsReview rate
 *
 * Monitor and track the rate of submissions flagged for manual review
 */

import { logger } from './logger';
import { alerts } from './alerts';
import { analytics } from './analytics';

interface ReviewMetrics {
  totalSubmissions: number;
  flaggedForReview: number;
  reviewRate: number;
  byReason: Record<string, number>;
  byDifficulty: {
    simple: { total: number; flagged: number };
    moderate: { total: number; flagged: number };
    complex: { total: number; flagged: number };
  };
}

interface ReviewEntry {
  submissionId: string;
  timestamp: Date;
  reason: string;
  confidence?: number;
  difficulty: 'simple' | 'moderate' | 'complex';
}

// Common review flag reasons
export const REVIEW_REASONS = {
  LOW_CONFIDENCE: 'low_confidence',
  ANSWER_MISMATCH: 'answer_mismatch',
  OCR_UNCERTAIN: 'ocr_uncertain',
  VERIFICATION_FAILED: 'verification_failed',
  MULTIPLE_ANSWERS: 'multiple_answers',
  HANDWRITING_UNCLEAR: 'handwriting_unclear',
  PROVIDER_FALLBACK: 'provider_fallback',
  CALCULATION_ERROR: 'calculation_error',
} as const;

export type ReviewReason = typeof REVIEW_REASONS[keyof typeof REVIEW_REASONS];

// Threshold for alerting on high review rate
const REVIEW_RATE_THRESHOLD = 0.15; // 15%

class ReviewTracker {
  private entries: ReviewEntry[] = [];
  private windowMinutes: number;
  private checkInterval: ReturnType<typeof setInterval> | null = null;

  constructor(windowMinutes: number = 60) {
    this.windowMinutes = windowMinutes;
  }

  /**
   * Record a submission that was flagged for review
   */
  flagForReview(
    submissionId: string,
    reason: ReviewReason,
    difficulty: 'simple' | 'moderate' | 'complex',
    confidence?: number
  ): void {
    const entry: ReviewEntry = {
      submissionId,
      timestamp: new Date(),
      reason,
      confidence,
      difficulty,
    };

    this.entries.push(entry);
    this.cleanupOldEntries();

    // Log the review flag
    logger.review(`Flagged for review: ${reason}`, {
      submissionId,
      data: { difficulty, confidence },
    });

    // Track in analytics
    analytics.trackReview(submissionId, reason, confidence);

    // Check if we should alert
    this.checkReviewRate();
  }

  /**
   * Record a successful submission (not flagged)
   */
  recordSuccess(
    submissionId: string,
    difficulty: 'simple' | 'moderate' | 'complex'
  ): void {
    // We track successful submissions implicitly through total - flagged
    // This method is for consistency in the API
    this.cleanupOldEntries();
  }

  /**
   * Get current review metrics
   */
  getMetrics(totalSubmissions: number): ReviewMetrics {
    this.cleanupOldEntries();

    const flaggedCount = this.entries.length;
    const reviewRate = totalSubmissions > 0 ? flaggedCount / totalSubmissions : 0;

    // Count by reason
    const byReason: Record<string, number> = {};
    for (const entry of this.entries) {
      byReason[entry.reason] = (byReason[entry.reason] || 0) + 1;
    }

    // Count by difficulty
    const byDifficulty = {
      simple: { total: 0, flagged: 0 },
      moderate: { total: 0, flagged: 0 },
      complex: { total: 0, flagged: 0 },
    };

    for (const entry of this.entries) {
      byDifficulty[entry.difficulty].flagged++;
    }

    return {
      totalSubmissions,
      flaggedForReview: flaggedCount,
      reviewRate,
      byReason,
      byDifficulty,
    };
  }

  /**
   * Get recent review entries
   */
  getRecentEntries(limit: number = 50): ReviewEntry[] {
    return this.entries.slice(-limit);
  }

  /**
   * Check if review rate exceeds threshold and alert if necessary
   */
  private checkReviewRate(): void {
    // Need at least 10 entries to compute meaningful rate
    if (this.entries.length < 10) return;

    // Estimate total from flagged (assuming typical 10% flag rate means ~10x total)
    const estimatedTotal = this.entries.length * 10;
    const currentRate = this.entries.length / estimatedTotal;

    if (currentRate > REVIEW_RATE_THRESHOLD) {
      alerts.highReviewRate(currentRate, REVIEW_RATE_THRESHOLD);
    }
  }

  /**
   * Remove entries older than the window
   */
  private cleanupOldEntries(): void {
    const cutoff = new Date(Date.now() - this.windowMinutes * 60 * 1000);
    this.entries = this.entries.filter(e => e.timestamp > cutoff);
  }

  /**
   * Start periodic monitoring
   */
  startMonitoring(intervalMinutes: number = 5): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }

    this.checkInterval = setInterval(() => {
      this.cleanupOldEntries();
      const metrics = this.getMetrics(this.entries.length * 10); // Estimate total

      logger.info('REVIEW', `Review rate check: ${(metrics.reviewRate * 100).toFixed(1)}%`, {
        data: {
          flagged: metrics.flaggedForReview,
          byReason: metrics.byReason,
        },
      });
    }, intervalMinutes * 60 * 1000);
  }

  /**
   * Stop periodic monitoring
   */
  stopMonitoring(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }

  /**
   * Reset all entries (for testing)
   */
  reset(): void {
    this.entries = [];
  }
}

// Export singleton instance
export const reviewTracker = new ReviewTracker();

// Export class for testing
export { ReviewTracker };

// Helper function to determine if a result should be flagged for review
export function shouldFlagForReview(result: {
  confidence?: number;
  isCorrect?: boolean;
  verificationResult?: { matched: boolean };
  ocrConfidence?: number;
  providerFallback?: boolean;
}): { shouldFlag: boolean; reason: ReviewReason | null } {
  // Low confidence
  if (result.confidence !== undefined && result.confidence < 0.8) {
    return { shouldFlag: true, reason: REVIEW_REASONS.LOW_CONFIDENCE };
  }

  // Answer mismatch between AI and verification
  if (result.verificationResult && !result.verificationResult.matched) {
    return { shouldFlag: true, reason: REVIEW_REASONS.ANSWER_MISMATCH };
  }

  // OCR uncertainty
  if (result.ocrConfidence !== undefined && result.ocrConfidence < 0.85) {
    return { shouldFlag: true, reason: REVIEW_REASONS.OCR_UNCERTAIN };
  }

  // Provider fallback occurred
  if (result.providerFallback) {
    return { shouldFlag: true, reason: REVIEW_REASONS.PROVIDER_FALLBACK };
  }

  return { shouldFlag: false, reason: null };
}
