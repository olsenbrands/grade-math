/**
 * TASK 7.2.1: Structured logging for pipeline steps
 *
 * Context-prefixed logging for easy filtering and debugging
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';
export type LogContext =
  | 'GRADING'
  | 'OCR'
  | 'MATHPIX'
  | 'WOLFRAM'
  | 'VERIFICATION'
  | 'PROVIDER'
  | 'COST'
  | 'REVIEW'
  | 'ALERT'
  | 'ANALYTICS';

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  context: LogContext;
  message: string;
  data?: Record<string, unknown>;
  submissionId?: string;
  duration?: number;
}

interface LoggerConfig {
  enabled: boolean;
  minLevel: LogLevel;
  includeTimestamp: boolean;
  includeData: boolean;
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const defaultConfig: LoggerConfig = {
  enabled: process.env.NODE_ENV !== 'test',
  minLevel: process.env.LOG_LEVEL as LogLevel || 'info',
  includeTimestamp: true,
  includeData: true,
};

class Logger {
  private config: LoggerConfig;

  constructor(config: Partial<LoggerConfig> = {}) {
    this.config = { ...defaultConfig, ...config };
  }

  private shouldLog(level: LogLevel): boolean {
    if (!this.config.enabled) return false;
    return LOG_LEVELS[level] >= LOG_LEVELS[this.config.minLevel];
  }

  private formatMessage(entry: LogEntry): string {
    const parts: string[] = [];

    if (this.config.includeTimestamp) {
      parts.push(`[${entry.timestamp}]`);
    }

    parts.push(`[${entry.context}]`);

    if (entry.submissionId) {
      parts.push(`[${entry.submissionId}]`);
    }

    parts.push(entry.message);

    if (entry.duration !== undefined) {
      parts.push(`(${entry.duration}ms)`);
    }

    return parts.join(' ');
  }

  private log(level: LogLevel, context: LogContext, message: string, options?: {
    data?: Record<string, unknown>;
    submissionId?: string;
    duration?: number;
  }): void {
    if (!this.shouldLog(level)) return;

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      context,
      message,
      ...options,
    };

    const formattedMessage = this.formatMessage(entry);

    switch (level) {
      case 'debug':
        console.debug(formattedMessage, this.config.includeData && entry.data ? entry.data : '');
        break;
      case 'info':
        console.log(formattedMessage, this.config.includeData && entry.data ? entry.data : '');
        break;
      case 'warn':
        console.warn(formattedMessage, this.config.includeData && entry.data ? entry.data : '');
        break;
      case 'error':
        console.error(formattedMessage, this.config.includeData && entry.data ? entry.data : '');
        break;
    }
  }

  // Convenience methods for each context
  grading(message: string, options?: { data?: Record<string, unknown>; submissionId?: string; duration?: number }) {
    this.log('info', 'GRADING', message, options);
  }

  ocr(message: string, options?: { data?: Record<string, unknown>; submissionId?: string; duration?: number }) {
    this.log('info', 'OCR', message, options);
  }

  mathpix(message: string, options?: { data?: Record<string, unknown>; submissionId?: string; duration?: number }) {
    this.log('info', 'MATHPIX', message, options);
  }

  wolfram(message: string, options?: { data?: Record<string, unknown>; submissionId?: string; duration?: number }) {
    this.log('info', 'WOLFRAM', message, options);
  }

  verification(message: string, options?: { data?: Record<string, unknown>; submissionId?: string; duration?: number }) {
    this.log('info', 'VERIFICATION', message, options);
  }

  provider(message: string, options?: { data?: Record<string, unknown>; submissionId?: string; duration?: number }) {
    this.log('info', 'PROVIDER', message, options);
  }

  cost(message: string, options?: { data?: Record<string, unknown>; submissionId?: string }) {
    this.log('info', 'COST', message, options);
  }

  review(message: string, options?: { data?: Record<string, unknown>; submissionId?: string }) {
    this.log('warn', 'REVIEW', message, options);
  }

  alert(message: string, options?: { data?: Record<string, unknown>; submissionId?: string }) {
    this.log('error', 'ALERT', message, options);
  }

  analytics(message: string, options?: { data?: Record<string, unknown>; submissionId?: string }) {
    this.log('info', 'ANALYTICS', message, options);
  }

  // Generic methods
  debug(context: LogContext, message: string, options?: { data?: Record<string, unknown>; submissionId?: string; duration?: number }) {
    this.log('debug', context, message, options);
  }

  info(context: LogContext, message: string, options?: { data?: Record<string, unknown>; submissionId?: string; duration?: number }) {
    this.log('info', context, message, options);
  }

  warn(context: LogContext, message: string, options?: { data?: Record<string, unknown>; submissionId?: string; duration?: number }) {
    this.log('warn', context, message, options);
  }

  error(context: LogContext, message: string, options?: { data?: Record<string, unknown>; submissionId?: string; duration?: number }) {
    this.log('error', context, message, options);
  }
}

// Export singleton instance
export const logger = new Logger();

// Export class for testing
export { Logger };

// Timing utility for measuring pipeline steps
export function withTiming<T>(
  fn: () => Promise<T>,
  context: LogContext,
  message: string,
  submissionId?: string
): Promise<T> {
  const startTime = Date.now();

  return fn().then(
    (result) => {
      const duration = Date.now() - startTime;
      logger.info(context, `${message} completed`, { submissionId, duration });
      return result;
    },
    (error) => {
      const duration = Date.now() - startTime;
      logger.error(context, `${message} failed: ${error.message}`, { submissionId, duration });
      throw error;
    }
  );
}

// Cost logging utility
export function logCost(
  submissionId: string,
  breakdown: { mathpix?: number; gpt4o?: number; wolfram?: number; total: number }
): void {
  const parts = [];
  if (breakdown.mathpix) parts.push(`Mathpix=$${breakdown.mathpix.toFixed(4)}`);
  if (breakdown.gpt4o) parts.push(`GPT-4o=$${breakdown.gpt4o.toFixed(4)}`);
  if (breakdown.wolfram) parts.push(`Wolfram=$${breakdown.wolfram.toFixed(4)}`);
  parts.push(`Total=$${breakdown.total.toFixed(4)}`);

  logger.cost(`Submission ${submissionId}: ${parts.join(', ')}`);
}

// Review flagging utility
export function logReview(
  submissionId: string,
  reason: string,
  confidence?: number
): void {
  logger.review(`Flagged for review: ${reason}`, {
    submissionId,
    data: confidence !== undefined ? { confidence } : undefined,
  });
}
