/**
 * Next.js Instrumentation
 * Initializes monitoring and instrumentation for the application
 */

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // Server-side instrumentation
    await import('./sentry.server.config');
  }

  if (process.env.NEXT_RUNTIME === 'edge') {
    // Edge runtime instrumentation
    await import('./sentry.edge.config');
  }
}

export const onRequestError = (err: unknown, request: Request, context: unknown) => {
  // This function will be called when an unhandled error occurs in a request
  console.error('Unhandled request error:', err);
};