/**
 * Custom Error Boundary Component
 * Integrates with Sentry for error tracking and provides user-friendly error UI
 */

'use client';

import React, { ErrorInfo, ReactNode } from 'react';
import * as Sentry from '@sentry/nextjs';
import analytics from '@/lib/analytics';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  resetKeys?: Array<string | number>;
  resetOnPropsChange?: boolean;
  isolate?: boolean;
  level?: 'page' | 'component' | 'feature';
  context?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  eventId: string | null;
  resetCount: number;
  lastResetTime: number | null;
}

class ErrorBoundary extends React.Component<Props, State> {
  private resetTimeoutId: ReturnType<typeof setTimeout> | null = null;

  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      eventId: null,
      resetCount: 0,
      lastResetTime: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    // Update state so the next render will show the fallback UI
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log the error to Sentry
    const eventId = Sentry.captureException(error, {
      contexts: {
        react: {
          componentStack: errorInfo.componentStack || 'Unknown',
        },
      },
      tags: {
        component: 'ErrorBoundary',
        level: this.props.level || 'component',
        context: this.props.context,
      },
      extra: {
        errorInfo,
      },
    });

    // Log to analytics
    try {
      analytics.track('error_boundary_triggered' as any, {
        error: error.message,
        stack: error.stack || '',
        componentStack: errorInfo.componentStack || '',
        level: this.props.level || 'component',
        timestamp: new Date().toISOString(),
      });
    } catch (analyticsError) {
      console.warn('Failed to track error in analytics:', analyticsError);
    }

    // Log to console for development
    if (process.env.NODE_ENV === 'development') {
      console.error('Error Boundary caught an error:', error);
      console.error('Error Info:', errorInfo);
    }

    // Update state with error information
    this.setState({
      error,
      errorInfo,
      eventId,
    });

    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // Auto-reset after 10 seconds for non-critical errors
    // But only if we haven't reset too many times recently to prevent infinite loops
    const now = Date.now();
    const timeSinceLastReset = this.state.lastResetTime ? now - this.state.lastResetTime : Infinity;
    const shouldAutoReset = this.props.level !== 'page' && 
                           !this.props.isolate && 
                           this.state.resetCount < 3 && 
                           timeSinceLastReset > 30000; // 30 seconds between resets

    if (shouldAutoReset) {
      this.resetTimeoutId = setTimeout(() => {
        this.handleReset();
      }, 10000);
    } else if (this.props.level !== 'page' && !this.props.isolate) {
      // Log when auto-reset is skipped to help with debugging
      console.warn(
        'ErrorBoundary: Auto-reset skipped to prevent infinite loop.',
        {
          resetCount: this.state.resetCount,
          timeSinceLastReset,
          lastResetTime: this.state.lastResetTime,
        }
      );
    }
  }

  componentDidUpdate(prevProps: Props) {
    const { resetKeys, resetOnPropsChange } = this.props;
    const { hasError } = this.state;

    if (hasError && prevProps.resetKeys !== resetKeys) {
      if (resetKeys) {
        // Check if any reset key has changed
        const hasResetKeyChanged = resetKeys.some(
          (key, index) => prevProps.resetKeys?.[index] !== key
        );
        
        if (hasResetKeyChanged) {
          this.handleReset();
        }
      }
    }

    if (hasError && resetOnPropsChange && prevProps.children !== this.props.children) {
      this.handleReset();
    }
  }

  componentWillUnmount() {
    if (this.resetTimeoutId) {
      clearTimeout(this.resetTimeoutId);
    }
  }

  // Reset the counter after a longer period to allow normal auto-reset behavior
  resetCounterAfterDelay = () => {
    setTimeout(() => {
      if (!this.state.hasError) {
        this.setState({
          resetCount: 0,
          lastResetTime: null,
        });
      }
    }, 300000); // 5 minutes
  };

  handleReset = () => {
    if (this.resetTimeoutId) {
      clearTimeout(this.resetTimeoutId);
      this.resetTimeoutId = null;
    }

    this.setState(prevState => ({
      hasError: false,
      error: null,
      errorInfo: null,
      eventId: null,
      resetCount: prevState.resetCount + 1,
      lastResetTime: Date.now(),
    }));

    // Reset counter after a delay if no more errors occur
    this.resetCounterAfterDelay();
  };

  handleReportError = () => {
    if (this.state.eventId) {
      // Open Sentry user feedback dialog
      Sentry.showReportDialog({ eventId: this.state.eventId });
    }
  };

  render() {
    if (this.state.hasError) {
      // Custom fallback UI
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default error UI based on level
      const { error, errorInfo } = this.state;
      const isPageLevel = this.props.level === 'page';
      const isDevelopment = process.env.NODE_ENV === 'development';

      return (
        <div className={`error-boundary ${isPageLevel ? 'min-h-screen' : ''} flex items-center justify-center p-4`}>
          <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 border border-red-200 dark:border-red-800">
            <div className="flex items-center mb-4">
              <div className="flex-shrink-0">
                <svg className="w-8 h-8 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-lg font-medium text-red-800 dark:text-red-200">
                  {isPageLevel ? 'Page Error' : 'Component Error'}
                </h3>
                <p className="text-sm text-red-600 dark:text-red-400">
                  {isPageLevel 
                    ? 'Something went wrong while loading this page.' 
                    : 'This component encountered an error.'
                  }
                </p>
              </div>
            </div>

            <div className="mb-4">
              <p className="text-sm text-gray-700 dark:text-gray-300">
                {isPageLevel 
                  ? 'Please try refreshing the page or contact support if the problem persists.'
                  : 'The error has been logged and will be investigated.'
                }
              </p>
              {!isPageLevel && !this.props.isolate && this.state.resetCount >= 3 && (
                <p className="text-xs text-orange-600 dark:text-orange-400 mt-2">
                  Auto-recovery has been disabled after multiple attempts. Please use "Try Again" to manually retry.
                </p>
              )}
            </div>

            {isDevelopment && error && (
              <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 rounded border border-red-200 dark:border-red-800">
                <p className="text-xs font-mono text-red-800 dark:text-red-200 mb-2">
                  Error: {error.message}
                </p>
                {error.stack && (
                  <details className="text-xs font-mono text-red-700 dark:text-red-300">
                    <summary className="cursor-pointer mb-1">Stack Trace</summary>
                    <pre className="whitespace-pre-wrap text-xs overflow-x-auto">
                      {error.stack}
                    </pre>
                  </details>
                )}
              </div>
            )}

            <div className="flex space-x-3">
              <button
                onClick={this.handleReset}
                className="flex-1 px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-md transition-colors"
              >
                Try Again
              </button>
              
              {isPageLevel && (
                <button
                  onClick={() => window.location.reload()}
                  className="flex-1 px-4 py-2 text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/30 rounded-md transition-colors"
                >
                  Reload Page
                </button>
              )}
              
              <button
                onClick={this.handleReportError}
                className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600 rounded-md transition-colors"
              >
                Report
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;

// Hook version for functional components
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  level?: 'page' | 'component' | 'feature'
) {
  return function WrappedComponent(props: P) {
    return (
      <ErrorBoundary level={level || 'component'}>
        <Component {...props} />
      </ErrorBoundary>
    );
  };
}