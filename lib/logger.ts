/**
 * Comprehensive Logging Utility
 * Provides structured logging with different levels and integrations
 */

import * as Sentry from '@sentry/nextjs';
import analytics from './analytics';

// Log levels with numeric priorities
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  CRITICAL = 4,
}

// Log categories for better organization
export type LogCategory = 
  | 'auth'
  | 'api'
  | 'database'
  | 'scraping'
  | 'performance'
  | 'security'
  | 'payment'
  | 'user'
  | 'system'
  | 'cache'
  | 'external'
  | 'validation'
  | 'unknown';

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  category: LogCategory;
  message: string;
  context?: Record<string, any>;
  userId?: string;
  sessionId?: string;
  traceId?: string;
  error?: Error;
  stack?: string;
  metadata?: Record<string, any>;
}

interface LoggerConfig {
  level: LogLevel;
  enableConsole: boolean;
  enableSentry: boolean;
  enableAnalytics: boolean;
  enableRemoteLogging: boolean;
  sensitiveKeys: string[];
  maxLogSize: number;
  environment: string;
}

class Logger {
  private config: LoggerConfig;
  private logBuffer: LogEntry[] = [];
  private readonly MAX_BUFFER_SIZE = 1000;
  private readonly SENSITIVE_KEYS = [
    'password',
    'token',
    'secret',
    'key',
    'auth',
    'credential',
    'session',
    'cookie',
    'authorization',
    'stripe',
    'payment',
  ];

  constructor(config?: Partial<LoggerConfig>) {
    this.config = {
      level: process.env.NODE_ENV === 'production' ? LogLevel.INFO : LogLevel.DEBUG,
      enableConsole: process.env.NODE_ENV === 'development',
      enableSentry: process.env.NODE_ENV === 'production',
      enableAnalytics: true,
      enableRemoteLogging: process.env.NODE_ENV === 'production',
      sensitiveKeys: this.SENSITIVE_KEYS,
      maxLogSize: 10000, // 10KB max per log
      environment: process.env.NODE_ENV || 'development',
      ...config,
    };
  }

  /**
   * Debug level logging
   */
  debug(message: string, context?: Record<string, any>, category: LogCategory = 'unknown'): void {
    this.log(LogLevel.DEBUG, message, context, category);
  }

  /**
   * Info level logging
   */
  info(message: string, context?: Record<string, any>, category: LogCategory = 'unknown'): void {
    this.log(LogLevel.INFO, message, context, category);
  }

  /**
   * Warning level logging
   */
  warn(message: string, context?: Record<string, any>, category: LogCategory = 'unknown'): void {
    this.log(LogLevel.WARN, message, context, category);
  }

  /**
   * Error level logging
   */
  error(message: string, error?: Error, context?: Record<string, any>, category: LogCategory = 'unknown'): void {
    this.log(LogLevel.ERROR, message, context, category, error);
  }

  /**
   * Critical level logging
   */
  critical(message: string, error?: Error, context?: Record<string, any>, category: LogCategory = 'system'): void {
    this.log(LogLevel.CRITICAL, message, context, category, error);
  }

  /**
   * Log API requests and responses
   */
  apiLog(
    method: string,
    url: string,
    statusCode: number,
    duration: number,
    context?: Record<string, any>
  ): void {
    const level = statusCode >= 400 ? LogLevel.ERROR : LogLevel.INFO;
    const message = `${method} ${url} - ${statusCode} (${duration}ms)`;
    
    this.log(level, message, {
      ...context,
      method,
      url,
      statusCode,
      duration,
    }, 'api');
  }

  /**
   * Log database operations
   */
  dbLog(
    operation: string,
    collection: string,
    duration: number,
    success: boolean,
    context?: Record<string, any>
  ): void {
    const level = success ? LogLevel.INFO : LogLevel.ERROR;
    const message = `DB ${operation} on ${collection} - ${success ? 'success' : 'failed'} (${duration}ms)`;
    
    this.log(level, message, {
      ...context,
      operation,
      collection,
      duration,
      success,
    }, 'database');
  }

  /**
   * Log scraping operations
   */
  scrapeLog(
    url: string,
    success: boolean,
    duration: number,
    error?: Error,
    context?: Record<string, any>
  ): void {
    const level = success ? LogLevel.INFO : LogLevel.ERROR;
    const message = `Scraping ${url} - ${success ? 'success' : 'failed'} (${duration}ms)`;
    
    this.log(level, message, {
      ...context,
      url,
      success,
      duration,
    }, 'scraping', error);
  }

  /**
   * Log authentication events
   */
  authLog(
    event: 'login' | 'logout' | 'register' | 'failed_login' | 'token_refresh',
    userId?: string,
    context?: Record<string, any>
  ): void {
    const level = event === 'failed_login' ? LogLevel.WARN : LogLevel.INFO;
    const message = `Auth event: ${event}`;
    
    this.log(level, message, {
      ...context,
      event,
      userId,
    }, 'auth');
  }

  /**
   * Log security events
   */
  securityLog(
    event: string,
    severity: 'low' | 'medium' | 'high' | 'critical',
    context?: Record<string, any>
  ): void {
    const levelMap = {
      low: LogLevel.INFO,
      medium: LogLevel.WARN,
      high: LogLevel.ERROR,
      critical: LogLevel.CRITICAL,
    };
    
    const level = levelMap[severity];
    const message = `Security event: ${event}`;
    
    this.log(level, message, {
      ...context,
      event,
      severity,
    }, 'security');
  }

  /**
   * Main logging method
   */
  private log(
    level: LogLevel,
    message: string,
    context?: Record<string, any>,
    category: LogCategory = 'unknown',
    error?: Error
  ): void {
    // Check if we should log this level
    if (level < this.config.level) {
      return;
    }

    // Create log entry
    const logEntry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      category,
      message,
      context: this.sanitizeContext(context),
      error,
      stack: error?.stack,
      metadata: {
        environment: this.config.environment,
        userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : undefined,
      },
    };

    // Add to buffer
    this.addToBuffer(logEntry);

    // Console logging
    if (this.config.enableConsole) {
      this.logToConsole(logEntry);
    }

    // Sentry logging
    if (this.config.enableSentry && level >= LogLevel.WARN) {
      this.logToSentry(logEntry);
    }

    // Analytics logging
    if (this.config.enableAnalytics) {
      this.logToAnalytics(logEntry);
    }

    // Remote logging (could be your own logging service)
    if (this.config.enableRemoteLogging && level >= LogLevel.ERROR) {
      this.logToRemote(logEntry);
    }
  }

  /**
   * Console logging with proper formatting
   */
  private logToConsole(entry: LogEntry): void {
    const { level, message, context, category, error } = entry;
    const prefix = `[${LogLevel[level]}] [${category}]`;
    
    switch (level) {
      case LogLevel.DEBUG:
        console.debug(prefix, message, context);
        break;
      case LogLevel.INFO:
        console.info(prefix, message, context);
        break;
      case LogLevel.WARN:
        console.warn(prefix, message, context);
        break;
      case LogLevel.ERROR:
      case LogLevel.CRITICAL:
        console.error(prefix, message, context, error);
        break;
    }
  }

  /**
   * Sentry logging
   */
  private logToSentry(entry: LogEntry): void {
    try {
      if (entry.error) {
        Sentry.captureException(entry.error, {
          level: entry.level >= LogLevel.CRITICAL ? 'fatal' : 'error',
          tags: {
            category: entry.category,
            environment: this.config.environment,
          },
          extra: {
            message: entry.message,
            context: entry.context,
            timestamp: entry.timestamp,
          },
        });
      } else {
        Sentry.captureMessage(entry.message, {
          level: entry.level >= LogLevel.ERROR ? 'error' : 'warning',
          tags: {
            category: entry.category,
            environment: this.config.environment,
          },
          extra: {
            context: entry.context,
            timestamp: entry.timestamp,
          },
        });
      }
    } catch (error) {
      console.error('Failed to log to Sentry:', error);
    }
  }

  /**
   * Analytics logging
   */
  private logToAnalytics(entry: LogEntry): void {
    try {
      if (entry.level >= LogLevel.WARN) {
        analytics.track('log_event' as any, {
          level: LogLevel[entry.level],
          category: entry.category,
          message: entry.message,
          timestamp: entry.timestamp,
          hasError: !!entry.error,
        });
      }
    } catch (error) {
      console.error('Failed to log to analytics:', error);
    }
  }

  /**
   * Remote logging (placeholder for custom logging service)
   */
  private logToRemote(entry: LogEntry): void {
    // This would typically send to your logging service
    // For now, we'll just console.log in development
    if (process.env.NODE_ENV === 'development') {
      console.log('Remote log:', entry);
    }
  }

  /**
   * Sanitize context to remove sensitive information
   */
  private sanitizeContext(context?: Record<string, any>): Record<string, any> | undefined {
    if (!context) return undefined;

    const sanitized = { ...context };
    
    const sanitizeObject = (obj: any, path: string[] = []): any => {
      if (typeof obj !== 'object' || obj === null) {
        return obj;
      }

      if (Array.isArray(obj)) {
        return obj.map((item, index) => sanitizeObject(item, [...path, index.toString()]));
      }

      const result: any = {};
      for (const [key, value] of Object.entries(obj)) {
        const currentPath = [...path, key];
        const keyLower = key.toLowerCase();
        
        // Check if this key contains sensitive information
        if (this.config.sensitiveKeys.some(sensitiveKey => keyLower.includes(sensitiveKey))) {
          result[key] = '[REDACTED]';
        } else {
          result[key] = sanitizeObject(value, currentPath);
        }
      }
      return result;
    };

    return sanitizeObject(sanitized);
  }

  /**
   * Add log entry to buffer
   */
  private addToBuffer(entry: LogEntry): void {
    this.logBuffer.push(entry);
    
    // Keep buffer size manageable
    if (this.logBuffer.length > this.MAX_BUFFER_SIZE) {
      this.logBuffer = this.logBuffer.slice(-this.MAX_BUFFER_SIZE / 2);
    }
  }

  /**
   * Get recent logs
   */
  getRecentLogs(count: number = 50): LogEntry[] {
    return this.logBuffer.slice(-count);
  }

  /**
   * Clear log buffer
   */
  clearBuffer(): void {
    this.logBuffer = [];
  }

  /**
   * Get log statistics
   */
  getStats(): {
    total: number;
    byLevel: Record<string, number>;
    byCategory: Record<string, number>;
  } {
    const stats = {
      total: this.logBuffer.length,
      byLevel: {} as Record<string, number>,
      byCategory: {} as Record<string, number>,
    };

    for (const entry of this.logBuffer) {
      const levelName = LogLevel[entry.level];
      stats.byLevel[levelName] = (stats.byLevel[levelName] || 0) + 1;
      stats.byCategory[entry.category] = (stats.byCategory[entry.category] || 0) + 1;
    }

    return stats;
  }
}

// Create singleton instance
const logger = new Logger();

export default logger;

// Export convenience functions
export const log = logger.info.bind(logger);
export const debug = logger.debug.bind(logger);
export const info = logger.info.bind(logger);
export const warn = logger.warn.bind(logger);
export const error = logger.error.bind(logger);
export const critical = logger.critical.bind(logger);
export const apiLog = logger.apiLog.bind(logger);
export const dbLog = logger.dbLog.bind(logger);
export const scrapeLog = logger.scrapeLog.bind(logger);
export const authLog = logger.authLog.bind(logger);
export const securityLog = logger.securityLog.bind(logger);