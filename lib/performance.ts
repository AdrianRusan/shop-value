/**
 * Performance Monitoring Utility
 * Tracks API performance, component render times, and Core Web Vitals
 */

import * as Sentry from '@sentry/nextjs';
import analytics from './analytics';

// Performance thresholds (in milliseconds)
const PERFORMANCE_THRESHOLDS = {
  API_SLOW: 1000,        // API calls slower than 1s
  API_CRITICAL: 3000,    // API calls slower than 3s
  COMPONENT_SLOW: 100,   // Component renders slower than 100ms
  COMPONENT_CRITICAL: 500, // Component renders slower than 500ms
} as const;

interface APIPerformanceData {
  endpoint: string;
  method: string;
  duration: number;
  statusCode?: number;
  userId?: string;
  success: boolean;
}

interface ComponentPerformanceData {
  componentName: string;
  duration: number;
  userId?: string;
  props?: Record<string, any>;
}

class PerformanceMonitor {
  private apiTimers = new Map<string, number>();
  private componentTimers = new Map<string, number>();

  /**
   * Start timing an API call
   */
  startAPITimer(requestId: string): void {
    this.apiTimers.set(requestId, performance.now());
  }

  /**
   * End timing an API call and report performance
   */
  async endAPITimer(
    requestId: string,
    data: Omit<APIPerformanceData, 'duration'>
  ): Promise<void> {
    const startTime = this.apiTimers.get(requestId);
    if (!startTime) {
      console.warn('API timer not found for request:', requestId);
      return;
    }

    const duration = performance.now() - startTime;
    this.apiTimers.delete(requestId);

    const performanceData: APIPerformanceData = {
      ...data,
      duration,
    };

    // Log to analytics
    await this.trackAPIPerformance(performanceData);

    // Report to Sentry if performance is concerning
    if (duration > PERFORMANCE_THRESHOLDS.API_CRITICAL) {
      Sentry.captureMessage('Critical API Performance Issue', {
        level: 'warning',
        tags: {
          performance: 'api-critical',
          endpoint: data.endpoint,
        },
        extra: {
          ...performanceData,
          duration: performanceData.duration.toString(),
          statusCode: performanceData.statusCode?.toString(),
        },
      });
    } else if (duration > PERFORMANCE_THRESHOLDS.API_SLOW) {
      Sentry.addBreadcrumb({
        category: 'performance',
        message: 'Slow API call detected',
        level: 'warning',
        data: performanceData,
      });
    }
  }

  /**
   * Start timing a component render
   */
  startComponentTimer(componentName: string): string {
    const timerId = `${componentName}-${Date.now()}-${Math.random()}`;
    this.componentTimers.set(timerId, performance.now());
    return timerId;
  }

  /**
   * End timing a component render and report performance
   */
  async endComponentTimer(
    timerId: string,
    data: Omit<ComponentPerformanceData, 'duration'>
  ): Promise<void> {
    const startTime = this.componentTimers.get(timerId);
    if (!startTime) {
      console.warn('Component timer not found for timer ID:', timerId);
      return;
    }

    const duration = performance.now() - startTime;
    this.componentTimers.delete(timerId);

    const performanceData: ComponentPerformanceData = {
      ...data,
      duration,
    };

    // Log to analytics
    await this.trackComponentPerformance(performanceData);

    // Report to Sentry if performance is concerning
    if (duration > PERFORMANCE_THRESHOLDS.COMPONENT_CRITICAL) {
      Sentry.captureMessage('Critical Component Performance Issue', {
        level: 'warning',
        tags: {
          performance: 'component-critical',
          component: data.componentName,
        },
        extra: {
          ...performanceData,
          duration: performanceData.duration.toString(),
        },
      });
    } else if (duration > PERFORMANCE_THRESHOLDS.COMPONENT_SLOW) {
      Sentry.addBreadcrumb({
        category: 'performance',
        message: 'Slow component render detected',
        level: 'info',
        data: performanceData,
      });
    }
  }

  /**
   * Track API performance in analytics
   */
  private async trackAPIPerformance(data: APIPerformanceData): Promise<void> {
    try {
      await analytics.track('api_performance', {
        endpoint: data.endpoint,
        method: data.method,
        duration: data.duration,
        statusCode: data.statusCode,
        success: data.success,
        userId: data.userId,
        slow: data.duration > PERFORMANCE_THRESHOLDS.API_SLOW,
        critical: data.duration > PERFORMANCE_THRESHOLDS.API_CRITICAL,
      });
    } catch (error) {
      console.error('Failed to track API performance:', error);
    }
  }

  /**
   * Track component performance in analytics
   */
  private async trackComponentPerformance(data: ComponentPerformanceData): Promise<void> {
    try {
      await analytics.track('component_performance', {
        componentName: data.componentName,
        duration: data.duration,
        userId: data.userId,
        slow: data.duration > PERFORMANCE_THRESHOLDS.COMPONENT_SLOW,
        critical: data.duration > PERFORMANCE_THRESHOLDS.COMPONENT_CRITICAL,
      });
    } catch (error) {
      console.error('Failed to track component performance:', error);
    }
  }

  /**
   * Track Core Web Vitals
   */
  trackWebVitals(): void {
    if (typeof window === 'undefined') return;

    // Track Largest Contentful Paint (LCP)
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.entryType === 'largest-contentful-paint') {
          analytics.track('web_vital', {
            metric: 'LCP',
            value: entry.startTime,
            rating: entry.startTime > 2500 ? 'poor' : entry.startTime > 1500 ? 'needs-improvement' : 'good',
          });
        }
      }
    });

    try {
      observer.observe({ type: 'largest-contentful-paint', buffered: true });
    } catch (error) {
      console.warn('LCP observation not supported');
    }

    // Track First Input Delay (FID)
    const fidObserver = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.entryType === 'first-input') {
          const fidValue = (entry as any).processingStart - entry.startTime;
          analytics.track('web_vital', {
            metric: 'FID',
            value: fidValue,
            rating: fidValue > 100 ? 'poor' : fidValue > 50 ? 'needs-improvement' : 'good',
          });
        }
      }
    });

    try {
      fidObserver.observe({ type: 'first-input', buffered: true });
    } catch (error) {
      console.warn('FID observation not supported');
    }

    // Track Cumulative Layout Shift (CLS)
    let clsValue = 0;
    const clsObserver = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.entryType === 'layout-shift' && !(entry as any).hadRecentInput) {
          clsValue += (entry as any).value;
        }
      }
    });

    try {
      clsObserver.observe({ type: 'layout-shift', buffered: true });
      
      // Report CLS when page unloads
      window.addEventListener('beforeunload', () => {
        analytics.track('web_vital', {
          metric: 'CLS',
          value: clsValue,
          rating: clsValue > 0.25 ? 'poor' : clsValue > 0.1 ? 'needs-improvement' : 'good',
        });
      });
    } catch (error) {
      console.warn('CLS observation not supported');
    }
  }

  /**
   * Create a performance measurement for a function
   */
  measureFunction<T extends (...args: any[]) => any>(
    fn: T,
    name: string,
    context?: string
  ): T {
    return ((...args: Parameters<T>) => {
      const startTime = performance.now();
      
      try {
        const result = fn(...args);
        
        // Handle async functions
        if (result && typeof result.then === 'function') {
          return result
            .then((value: any) => {
              const duration = performance.now() - startTime;
              this.reportFunctionPerformance(name, duration, context, true);
              return value;
            })
            .catch((error: any) => {
              const duration = performance.now() - startTime;
              this.reportFunctionPerformance(name, duration, context, false, error);
              throw error;
            });
        }
        
        // Handle sync functions
        const duration = performance.now() - startTime;
        this.reportFunctionPerformance(name, duration, context, true);
        return result;
      } catch (error) {
        const duration = performance.now() - startTime;
        this.reportFunctionPerformance(name, duration, context, false, error);
        throw error;
      }
    }) as T;
  }

  /**
   * Report function performance
   */
  private reportFunctionPerformance(
    name: string,
    duration: number,
    context?: string,
    success: boolean = true,
    error?: any
  ): void {
    analytics.track('function_performance', {
      functionName: name,
      duration,
      context,
      success,
      slow: duration > 100,
      critical: duration > 500,
    });

    if (duration > 500) {
      Sentry.captureMessage('Slow Function Execution', {
        level: 'warning',
        tags: {
          performance: 'function-slow',
          function: name,
          context,
        },
        extra: {
          duration,
          success,
          error: error?.message,
        },
      });
    }
  }
}

// Create singleton instance
const performanceMonitor = new PerformanceMonitor();

export default performanceMonitor;

// Utility functions for common use cases
export const measureAPICall = async <T>(
  apiCall: () => Promise<T>,
  endpoint: string,
  method: string,
  userId?: string
): Promise<T> => {
  const requestId = `${endpoint}-${Date.now()}`;
  performanceMonitor.startAPITimer(requestId);
  
  try {
    const result = await apiCall();
    await performanceMonitor.endAPITimer(requestId, {
      endpoint,
      method,
      success: true,
      userId,
    });
    return result;
  } catch (error) {
    await performanceMonitor.endAPITimer(requestId, {
      endpoint,
      method,
      success: false,
      userId,
      statusCode: (error as any)?.status || 500,
    });
    throw error;
  }
};

export const measureComponent = (componentName: string) => {
  return {
    start: () => performanceMonitor.startComponentTimer(componentName),
    end: (timerId: string, userId?: string, props?: Record<string, any>) =>
      performanceMonitor.endComponentTimer(timerId, {
        componentName,
        userId,
        props,
      }),
  };
};