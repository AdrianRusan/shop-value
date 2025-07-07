import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import * as Sentry from '@sentry/nextjs';
import { 
  processWebhookEvent,
  StripeError,
  ENHANCED_SUBSCRIPTION_PLANS 
} from '@/lib/enhanced-stripe';
import { 
  createAPIResponse,
  createAPIError,
  createRequestContext,
  withRateLimit,
  API_ERROR_CODES
} from '@/lib/api-framework';
import { redis } from '@/lib/upstash';
import { performance } from 'perf_hooks';

// Enhanced webhook security configuration
const WEBHOOK_CONFIG = {
  maxBodySize: 1024 * 1024, // 1MB
  signatureHeader: 'stripe-signature',
  timestampTolerance: 300, // 5 minutes
  rateLimitWindow: '1 m',
  rateLimitRequests: 100,
};

// Webhook event validation
function validateWebhookRequest(request: NextRequest): {
  success: boolean;
  signature?: string;
  timestamp?: number;
  error?: string;
} {
  const signature = request.headers.get(WEBHOOK_CONFIG.signatureHeader);
  
  if (!signature) {
    return {
      success: false,
      error: 'Missing Stripe signature header'
    };
  }

  // Extract timestamp from signature
  const timestampMatch = signature.match(/t=(\d+)/);
  const timestamp = timestampMatch ? parseInt(timestampMatch[1]) : 0;
  
  // Check timestamp tolerance
  const currentTime = Math.floor(Date.now() / 1000);
  if (Math.abs(currentTime - timestamp) > WEBHOOK_CONFIG.timestampTolerance) {
    return {
      success: false,
      error: 'Webhook timestamp outside tolerance window'
    };
  }

  return {
    success: true,
    signature,
    timestamp
  };
}

// Enhanced webhook monitoring
async function trackWebhookMetrics(
  eventType: string,
  status: 'success' | 'failure' | 'retry',
  processingTime: number,
  error?: string
): Promise<void> {
  const date = new Date().toISOString().split('T')[0];
  const hour = new Date().getHours();

  const operations = [
    // Daily metrics
    redis.hincrby(`webhook:metrics:daily:${date}`, 'total', 1),
    redis.hincrby(`webhook:metrics:daily:${date}`, status, 1),
    redis.hincrby(`webhook:metrics:daily:${date}`, `type_${eventType}`, 1),
    redis.hincrby(`webhook:metrics:daily:${date}`, 'processing_time', processingTime),
    
    // Hourly metrics for pattern analysis
    redis.hincrby(`webhook:metrics:hourly:${date}:${hour}`, 'total', 1),
    redis.hincrby(`webhook:metrics:hourly:${date}:${hour}`, status, 1),
    
    // Event type metrics
    redis.hincrby(`webhook:metrics:events:${eventType}`, 'total', 1),
    redis.hincrby(`webhook:metrics:events:${eventType}`, status, 1),
    redis.hincrby(`webhook:metrics:events:${eventType}`, 'avg_processing_time', processingTime),
  ];

  // Track error types for failure analysis
  if (status === 'failure' && error) {
    operations.push(
      redis.hincrby(`webhook:metrics:errors:${date}`, error, 1),
      redis.hincrby(`webhook:metrics:errors:${eventType}`, error, 1)
    );
  }

  await Promise.all(operations);
}

// Enhanced webhook retry queue
async function queueWebhookRetry(
  eventId: string,
  eventType: string,
  rawBody: string,
  signature: string,
  retryCount: number = 0,
  delaySeconds: number = 60
): Promise<void> {
  const maxRetries = 5;
  
  if (retryCount >= maxRetries) {
    console.error(`Webhook ${eventId} exceeded max retries (${maxRetries})`);
    
    // Send to dead letter queue for manual investigation
    await redis.lpush('webhook:dead_letter_queue', JSON.stringify({
      eventId,
      eventType,
      rawBody,
      signature,
      retryCount,
      failedAt: new Date().toISOString(),
      reason: 'max_retries_exceeded'
    }));
    
    Sentry.captureMessage(`Webhook ${eventId} moved to dead letter queue`, 'error');
    return;
  }

  const retryTime = Date.now() + (delaySeconds * 1000);
  const retryData = {
    eventId,
    eventType,
    rawBody,
    signature,
    retryCount: retryCount + 1,
    scheduledFor: retryTime,
    originalTimestamp: Date.now()
  };

  // Use exponential backoff: 1min, 2min, 4min, 8min, 16min
  const nextDelay = Math.min(delaySeconds * 2, 960); // Max 16 minutes
  
  await redis.zadd('webhook:retry_queue', { score: retryTime, member: JSON.stringify(retryData) });
  
  console.log(`Webhook ${eventId} queued for retry ${retryCount + 1}/${maxRetries} in ${delaySeconds}s`);
}

// Main webhook handler
export async function POST(request: NextRequest): Promise<NextResponse> {
  const context = createRequestContext(request);
  const startTime = performance.now();
  
  try {
    // Enhanced rate limiting for webhooks
    const rateLimitResult = await withRateLimit(context, 'general');
    if (!rateLimitResult.success && rateLimitResult.error) {
      await trackWebhookMetrics('unknown', 'failure', performance.now() - startTime, 'rate_limit_exceeded');
      return NextResponse.json(
        rateLimitResult.error.response,
        { status: rateLimitResult.error.statusCode }
      );
    }

    // Validate webhook request
    const validation = validateWebhookRequest(request);
    if (!validation.success) {
      const { response, statusCode } = createAPIError(
        'VALIDATION_FAILED',
        validation.error || 'Invalid webhook request',
        { requestId: context.requestId }
      );
      
      await trackWebhookMetrics('unknown', 'failure', performance.now() - startTime, 'validation_failed');
      
      return NextResponse.json(response, { status: statusCode });
    }

    // Get raw body for signature verification
    const rawBody = await request.text();
    
    // Check body size limit
    if (rawBody.length > WEBHOOK_CONFIG.maxBodySize) {
      const { response, statusCode } = createAPIError(
        'INVALID_REQUEST',
        'Webhook payload too large',
        { 
          requestId: context.requestId,
          details: { maxSize: WEBHOOK_CONFIG.maxBodySize, actualSize: rawBody.length }
        }
      );
      
      await trackWebhookMetrics('unknown', 'failure', performance.now() - startTime, 'payload_too_large');
      
      return NextResponse.json(response, { status: statusCode });
    }

    // Parse webhook event
    let webhookEvent;
    try {
      webhookEvent = JSON.parse(rawBody);
    } catch (parseError) {
      const { response, statusCode } = createAPIError(
        'INVALID_REQUEST',
        'Invalid JSON in webhook payload',
        { requestId: context.requestId }
      );
      
      await trackWebhookMetrics('unknown', 'failure', performance.now() - startTime, 'invalid_json');
      
      return NextResponse.json(response, { status: statusCode });
    }

    // Enhanced webhook processing with comprehensive error handling
    try {
      const result = await processWebhookEvent(
        webhookEvent,
        validation.signature!,
        rawBody
      );

      const processingTime = performance.now() - startTime;

      if (result.processed) {
        // Track successful processing
        await trackWebhookMetrics(
          webhookEvent.type,
          'success',
          processingTime
        );

        // Update webhook health metrics
        await redis.setex('webhook:health:last_success', 3600, Date.now().toString());
        await redis.incr('webhook:health:success_count');

        const response = createAPIResponse(
          { 
            eventId: webhookEvent.id,
            eventType: webhookEvent.type,
            processed: true 
          },
          {
            requestId: context.requestId,
            message: 'Webhook processed successfully',
            meta: {
              performance: {
                responseTime: Math.round(processingTime)
              }
            }
          }
        );

        console.log(`✅ Webhook ${webhookEvent.type} (${webhookEvent.id}) processed successfully in ${Math.round(processingTime)}ms`);

        return NextResponse.json(response);

      } else {
        // Processing failed, queue for retry
        await queueWebhookRetry(
          webhookEvent.id,
          webhookEvent.type,
          rawBody,
          validation.signature!
        );

        await trackWebhookMetrics(
          webhookEvent.type,
          'retry',
          processingTime,
          result.error
        );

        // Return success to prevent Stripe from retrying immediately
        // Our internal retry queue will handle it
        const response = createAPIResponse(
          { 
            eventId: webhookEvent.id,
            eventType: webhookEvent.type,
            processed: false,
            queued: true 
          },
          {
            requestId: context.requestId,
            message: 'Webhook queued for retry'
          }
        );

        console.warn(`⚠️ Webhook ${webhookEvent.type} (${webhookEvent.id}) queued for retry: ${result.error}`);

        return NextResponse.json(response);
      }

    } catch (processingError) {
      const processingTime = performance.now() - startTime;
      
      // Handle specific Stripe errors
      if (processingError instanceof StripeError) {
        await trackWebhookMetrics(
          webhookEvent.type,
          'failure',
          processingTime,
          processingError.code
        );

        // Queue for retry unless it's a permanent error
        if (processingError.type !== 'validation_error') {
          await queueWebhookRetry(
            webhookEvent.id,
            webhookEvent.type,
            rawBody,
            validation.signature!
          );
        }

        const { response, statusCode } = createAPIError(
          'EXTERNAL_SERVICE_ERROR',
          `Stripe webhook processing failed: ${processingError.message}`,
          {
            requestId: context.requestId,
            details: {
              stripeErrorCode: processingError.code,
              stripeErrorType: processingError.type,
              eventId: webhookEvent.id,
              eventType: webhookEvent.type
            }
          }
        );

        return NextResponse.json(response, { status: statusCode });
      }

      // Handle unexpected errors
      await trackWebhookMetrics(
        webhookEvent.type,
        'failure',
        processingTime,
        'unexpected_error'
      );

      // Queue for retry
      await queueWebhookRetry(
        webhookEvent.id,
        webhookEvent.type,
        rawBody,
        validation.signature!
      );

      throw processingError; // Let the global error handler deal with it
    }

  } catch (error) {
    const processingTime = performance.now() - startTime;
    
    // Log comprehensive error details
    console.error(`❌ Webhook processing failed:`, {
      error: error instanceof Error ? error.message : 'Unknown error',
      requestId: context.requestId,
      processingTime: Math.round(processingTime),
      ip: context.ip,
      userAgent: context.userAgent
    });

    // Send detailed error to Sentry
    Sentry.captureException(error, {
      tags: {
        component: 'stripe_webhook',
        requestId: context.requestId
      },
      extra: {
        processingTime: Math.round(processingTime),
        ip: context.ip,
        userAgent: context.userAgent,
        headers: Object.fromEntries(request.headers.entries())
      }
    });

    // Track error metrics
    await trackWebhookMetrics(
      'unknown',
      'failure',
      processingTime,
      'internal_error'
    );

    // Update webhook health metrics
    await redis.setex('webhook:health:last_failure', 3600, Date.now().toString());
    await redis.incr('webhook:health:failure_count');

    const { response, statusCode } = createAPIError(
      'INTERNAL_ERROR',
      'Webhook processing failed',
      {
        requestId: context.requestId,
        details: process.env.NODE_ENV === 'development' 
          ? error instanceof Error ? error.message : 'Unknown error'
          : undefined
      }
    );

    return NextResponse.json(response, { status: statusCode });
  }
}

// Health check endpoint for webhook monitoring
export async function GET(request: NextRequest): Promise<NextResponse> {
  const context = createRequestContext(request);
  
  try {
    // Get webhook health metrics
    const [
      lastSuccess,
      lastFailure,
      successCount,
      failureCount,
      retryQueueSize,
      deadLetterQueueSize
    ] = await Promise.all([
      redis.get('webhook:health:last_success'),
      redis.get('webhook:health:last_failure'),
      redis.get('webhook:health:success_count'),
      redis.get('webhook:health:failure_count'),
      redis.zcard('webhook:retry_queue'),
      redis.llen('webhook:dead_letter_queue')
    ]);

    const now = Date.now();
    const lastSuccessTime = lastSuccess ? parseInt(String(lastSuccess)) : 0;
    const lastFailureTime = lastFailure ? parseInt(String(lastFailure)) : 0;
    
    // Determine health status
    const timeSinceLastSuccess = now - lastSuccessTime;
    const timeSinceLastFailure = now - lastFailureTime;
    
    let status = 'healthy';
    let issues = [];

    // Check if we haven't had a successful webhook in the last hour
    if (timeSinceLastSuccess > 3600000) { // 1 hour
      status = 'warning';
      issues.push('No successful webhooks in the last hour');
    }

    // Check if recent failures outweigh successes
    const recentSuccesses = parseInt(String(successCount) || '0');
    const recentFailures = parseInt(String(failureCount) || '0');
    
    if (recentFailures > recentSuccesses && recentFailures > 5) {
      status = 'unhealthy';
      issues.push('High failure rate detected');
    }

    // Check retry queue backlog
    if (retryQueueSize > 50) {
      status = status === 'healthy' ? 'warning' : status;
      issues.push('High retry queue backlog');
    }

    // Check dead letter queue
    if (deadLetterQueueSize > 10) {
      status = 'warning';
      issues.push('Items in dead letter queue require attention');
    }

    const response = createAPIResponse(
      {
        status,
        issues,
        metrics: {
          lastSuccessTime: lastSuccessTime || null,
          lastFailureTime: lastFailureTime || null,
          timeSinceLastSuccess: timeSinceLastSuccess,
          timeSinceLastFailure: timeSinceLastFailure,
          successCount: recentSuccesses,
          failureCount: recentFailures,
          retryQueueSize,
          deadLetterQueueSize,
          successRate: recentSuccesses + recentFailures > 0 
            ? (recentSuccesses / (recentSuccesses + recentFailures) * 100).toFixed(2) + '%'
            : 'N/A'
        },
        timestamp: new Date().toISOString()
      },
      {
        requestId: context.requestId,
        message: `Webhook health check: ${status}`
      }
    );

    return NextResponse.json(response);

  } catch (error) {
    console.error('Webhook health check failed:', error);
    
    const { response, statusCode } = createAPIError(
      'INTERNAL_ERROR',
      'Health check failed',
      { requestId: context.requestId }
    );

    return NextResponse.json(response, { status: statusCode });
  }
}

// Handle unsupported methods
export const PUT = () => NextResponse.json(
  createAPIError('METHOD_NOT_ALLOWED', 'Only POST and GET methods are allowed', { requestId: 'unknown' }).response,
  { status: 405 }
);

export const DELETE = () => NextResponse.json(
  createAPIError('METHOD_NOT_ALLOWED', 'Only POST and GET methods are allowed', { requestId: 'unknown' }).response,
  { status: 405 }
);

export const PATCH = () => NextResponse.json(
  createAPIError('METHOD_NOT_ALLOWED', 'Only POST and GET methods are allowed', { requestId: 'unknown' }).response,
  { status: 405 }
); 