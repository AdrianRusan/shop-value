// This file configures the initialization of Sentry on the browser/client side

import * as Sentry from '@sentry/nextjs';

const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN || process.env.SENTRY_DSN;
const SENTRY_ENVIRONMENT = process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT || 'development';

Sentry.init({
  dsn: SENTRY_DSN,
  environment: SENTRY_ENVIRONMENT,
  
  // Performance Monitoring
  tracesSampleRate: SENTRY_ENVIRONMENT === 'production' ? 0.1 : 1.0,
  
  // Release Health
  autoSessionTracking: true,
  
  // Error Filtering
  beforeSend(event, hint) {
    // Filter out common non-critical errors
    if (event.exception) {
      const error = hint.originalException;
      if (error && error instanceof Error) {
        // Skip network errors that are not actionable
        if (error.message.includes('Network request failed') || 
            error.message.includes('fetch')) {
          return null;
        }
        
        // Skip ChunkLoadError - happens during deployments
        if (error.name === 'ChunkLoadError') {
          return null;
        }
        
        // Skip ResizeObserver errors - browser quirks
        if (error.message.includes('ResizeObserver')) {
          return null;
        }
      }
    }
    
    return event;
  },
  
  // Integrations
  integrations: [
    Sentry.browserTracingIntegration(),
    Sentry.replayIntegration({
      // Capture session replays for debugging
      maskAllText: false,
      blockAllMedia: false,
    }),
  ],
  
  // Session Replay
  replaysSessionSampleRate: SENTRY_ENVIRONMENT === 'production' ? 0.01 : 1.0,
  replaysOnErrorSampleRate: SENTRY_ENVIRONMENT === 'production' ? 0.1 : 1.0,
  
  // Set tags for better organization
  initialScope: {
    tags: {
      component: 'client',
      environment: SENTRY_ENVIRONMENT,
    },
  },
});