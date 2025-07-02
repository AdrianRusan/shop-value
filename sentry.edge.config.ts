// This file configures the initialization of Sentry for Edge Runtime environments

import * as Sentry from '@sentry/nextjs';

const SENTRY_DSN = process.env.SENTRY_DSN;
const SENTRY_ENVIRONMENT = process.env.SENTRY_ENVIRONMENT || 'development';

Sentry.init({
  dsn: SENTRY_DSN,
  environment: SENTRY_ENVIRONMENT,
  
  // Performance Monitoring (lighter for edge)
  tracesSampleRate: SENTRY_ENVIRONMENT === 'production' ? 0.05 : 1.0,
  
  // Set tags for better organization
  initialScope: {
    tags: {
      component: 'edge',
      environment: SENTRY_ENVIRONMENT,
    },
  },
  
  // Simplified configuration for edge runtime
  debug: SENTRY_ENVIRONMENT === 'development',
});