/**
 * TASK 7.2.3: Alert system for API failures
 *
 * Sends alerts via Slack webhook when critical failures occur
 */

import { logger } from './logger';

interface AlertConfig {
  slackWebhookUrl?: string;
  enabled: boolean;
  rateLimit: number; // Max alerts per minute
  cooldownMinutes: number; // Cooldown after rate limit hit
}

interface Alert {
  type: 'error' | 'warning' | 'critical';
  provider: string;
  message: string;
  details?: Record<string, unknown>;
  timestamp: Date;
}

const defaultConfig: AlertConfig = {
  slackWebhookUrl: process.env.SLACK_WEBHOOK_URL,
  enabled: process.env.ALERTS_ENABLED === 'true' || process.env.NODE_ENV === 'production',
  rateLimit: 10,
  cooldownMinutes: 5,
};

class AlertSystem {
  private config: AlertConfig;
  private alertCounts: Map<string, { count: number; resetTime: Date }> = new Map();
  private lastAlertTimes: Map<string, Date> = new Map();

  constructor(config: Partial<AlertConfig> = {}) {
    this.config = { ...defaultConfig, ...config };
  }

  /**
   * Check if we're within rate limits
   */
  private isRateLimited(alertKey: string): boolean {
    const now = new Date();
    const entry = this.alertCounts.get(alertKey);

    if (!entry || now > entry.resetTime) {
      this.alertCounts.set(alertKey, {
        count: 1,
        resetTime: new Date(now.getTime() + 60000), // 1 minute window
      });
      return false;
    }

    if (entry.count >= this.config.rateLimit) {
      // Check cooldown
      const lastAlert = this.lastAlertTimes.get(alertKey);
      if (lastAlert) {
        const cooldownEnd = new Date(lastAlert.getTime() + this.config.cooldownMinutes * 60000);
        if (now < cooldownEnd) {
          return true;
        }
      }
    }

    entry.count++;
    return false;
  }

  /**
   * Send alert to Slack webhook
   */
  private async sendSlackAlert(alert: Alert): Promise<void> {
    if (!this.config.slackWebhookUrl) {
      logger.warn('ALERT', 'Slack webhook not configured', { data: { ...alert } as Record<string, unknown> });
      return;
    }

    const emoji = alert.type === 'critical' ? ':rotating_light:' :
                  alert.type === 'error' ? ':x:' : ':warning:';

    const payload = {
      text: `${emoji} *Grade-Math Alert: ${alert.type.toUpperCase()}*`,
      blocks: [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: `${emoji} ${alert.type.toUpperCase()}: ${alert.provider}`,
          },
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: alert.message,
          },
        },
        {
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: `*Time:* ${alert.timestamp.toISOString()}`,
            },
          ],
        },
      ],
    };

    if (alert.details) {
      payload.blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `\`\`\`${JSON.stringify(alert.details, null, 2)}\`\`\``,
        },
      });
    }

    try {
      const response = await fetch(this.config.slackWebhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        logger.error('ALERT', `Failed to send Slack alert: ${response.status}`);
      }
    } catch (error) {
      logger.error('ALERT', `Slack webhook error: ${(error as Error).message}`);
    }
  }

  /**
   * Send an alert
   */
  async alert(alert: Omit<Alert, 'timestamp'>): Promise<void> {
    if (!this.config.enabled) {
      logger.info('ALERT', `Alert (disabled): ${alert.message}`, { data: alert.details });
      return;
    }

    const fullAlert: Alert = {
      ...alert,
      timestamp: new Date(),
    };

    const alertKey = `${alert.provider}-${alert.type}`;

    // Check rate limiting
    if (this.isRateLimited(alertKey)) {
      logger.warn('ALERT', `Rate limited: ${alertKey}`);
      return;
    }

    this.lastAlertTimes.set(alertKey, fullAlert.timestamp);

    // Log locally
    logger.alert(`${alert.type.toUpperCase()}: ${alert.provider} - ${alert.message}`, {
      data: alert.details,
    });

    // Send to Slack
    await this.sendSlackAlert(fullAlert);
  }

  // Convenience methods for common alerts

  /**
   * Alert when all AI providers fail
   */
  async allProvidersFailed(attemptedProviders: string[], lastError: string): Promise<void> {
    await this.alert({
      type: 'critical',
      provider: 'AI Providers',
      message: `All AI providers failed. Service is degraded.`,
      details: {
        attemptedProviders,
        lastError,
      },
    });
  }

  /**
   * Alert when a provider has repeated failures
   */
  async providerUnhealthy(provider: string, failureCount: number, lastError: string): Promise<void> {
    await this.alert({
      type: 'error',
      provider,
      message: `Provider experiencing repeated failures (${failureCount} in last 5 minutes)`,
      details: {
        failureCount,
        lastError,
      },
    });
  }

  /**
   * Alert when Mathpix OCR is unavailable
   */
  async mathpixUnavailable(error: string): Promise<void> {
    await this.alert({
      type: 'warning',
      provider: 'Mathpix',
      message: `Mathpix OCR unavailable. Falling back to GPT-4o vision.`,
      details: { error },
    });
  }

  /**
   * Alert when Wolfram Alpha is unavailable
   */
  async wolframUnavailable(error: string): Promise<void> {
    await this.alert({
      type: 'warning',
      provider: 'Wolfram Alpha',
      message: `Wolfram Alpha verification unavailable. Using chain-of-thought only.`,
      details: { error },
    });
  }

  /**
   * Alert when review rate exceeds threshold
   */
  async highReviewRate(rate: number, threshold: number): Promise<void> {
    await this.alert({
      type: 'warning',
      provider: 'Review System',
      message: `Review rate (${(rate * 100).toFixed(1)}%) exceeds threshold (${(threshold * 100).toFixed(0)}%)`,
      details: {
        currentRate: rate,
        threshold,
      },
    });
  }

  /**
   * Alert when costs exceed budget
   */
  async costBudgetExceeded(currentCost: number, budget: number, period: string): Promise<void> {
    await this.alert({
      type: 'warning',
      provider: 'Cost Tracking',
      message: `${period} cost ($${currentCost.toFixed(2)}) exceeds budget ($${budget.toFixed(2)})`,
      details: {
        currentCost,
        budget,
        period,
      },
    });
  }

  /**
   * Alert when rate limited by external API
   */
  async rateLimited(provider: string, retryAfterSeconds?: number): Promise<void> {
    await this.alert({
      type: 'warning',
      provider,
      message: `Rate limited by ${provider}${retryAfterSeconds ? `. Retry after ${retryAfterSeconds}s` : ''}`,
      details: { retryAfterSeconds },
    });
  }
}

// Export singleton instance
export const alerts = new AlertSystem();

// Export class for testing
export { AlertSystem };
