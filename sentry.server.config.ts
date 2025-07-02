// This file configures the initialization of Sentry on the server side

import * as Sentry from '@sentry/nextjs';

const SENTRY_DSN = process.env.SENTRY_DSN;
const SENTRY_ENVIRONMENT = process.env.SENTRY_ENVIRONMENT || 'development';

Sentry.init({
  dsn: SENTRY_DSN,
  environment: SENTRY_ENVIRONMENT,
  
  // Performance Monitoring
  tracesSampleRate: SENTRY_ENVIRONMENT === 'production' ? 0.1 : 1.0,
  
  // Error Filtering
  beforeSend(event, hint) {
    // Filter out common non-critical errors
    if (event.exception) {
      const error = hint.originalException;
      if (error && error instanceof Error) {
        // Skip MongoDB connection errors that are retried
        if (error.message.includes('MongoNetworkError')) {
          return null;
        }
        
        // Skip Clerk webhook verification errors (handled gracefully)
        if (error.message.includes('Webhook verification failed')) {
          return null;
        }
        
        // Skip rate limiting errors (expected behavior)
        if (error.message.includes('Rate limit exceeded')) {
          return null;
        }
      }
    }
    
    return event;
  },
  
  // Set tags for better organization
  initialScope: {
    tags: {
      component: 'server',
      environment: SENTRY_ENVIRONMENT,
    },
  },
  
  // Additional server-specific options
  debug: SENTRY_ENVIRONMENT === 'development',
  attachStacktrace: true,
  
  // Custom error handling for unhandled rejections
  integrations: [
    // Add Node.js specific integrations
    ...Sentry.getDefaultIntegrations({}).filter(
      integration => integration.name !== 'OnUncaughtException'
    ),
  ],
});