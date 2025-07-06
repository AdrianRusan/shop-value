import { NextResponse } from 'next/server';
import { connectToDB } from '@/lib/mongoose';
import { queueDueProductScraping, getQueueStatistics } from '@/lib/scraper/queue-service';
import { redis } from '@/lib/upstash';

export const maxDuration = 250;
export const dynamic = 'force-dynamic';

// Cron job for queue-based scraping
export async function GET(request: Request) {
  const startTime = Date.now();
  const requestId = `scraping-cron-${Date.now()}`;

  try {
    console.log('🚀 Starting queue-based scraping cron job', { requestId });

    // Validate request origin (basic security)
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectToDB();

    // Track cron execution
    await trackCronExecution(requestId);

    // Queue products that are due for scraping
    const queueResult = await queueDueProductScraping({
      userId: 'system-cron',
      userTier: 'enterprise', // System jobs get highest priority
      priority: 'high',
      tenantId: 'system'
    });

    // Get queue statistics
    const stats = await getQueueStatistics('system', 'enterprise');

    const duration = Date.now() - startTime;

    const response = {
      success: true,
      message: 'Queue-based scraping cron job completed successfully',
      data: {
        requestId,
        timestamp: new Date().toISOString(),
        duration,
        queueResult,
        stats: stats.stats || null,
      },
    };

    console.log('✅ Scraping cron job completed successfully:', {
      requestId,
      duration,
      queuedProducts: queueResult.queuedCount || 0,
    });

    return NextResponse.json(response);

  } catch (error: any) {
    const duration = Date.now() - startTime;
    
    console.error('❌ Scraping cron job failed:', {
      requestId,
      duration,
      error: error.message,
      stack: error.stack,
    });

    // Track error in Redis for monitoring
    await trackCronError(error, requestId);

    const errorResponse = {
      success: false,
      error: {
        message: error.message,
        type: error.constructor.name,
        timestamp: new Date().toISOString(),
        requestId,
        duration,
      },
    };

    return NextResponse.json(errorResponse, { status: 500 });
  }
}

// Track cron job execution
async function trackCronExecution(requestId: string) {
  try {
    const today = new Date().toISOString().split('T')[0];
    const hour = new Date().getHours();
    
    await Promise.all([
      redis.incr('scraping_cron:executions:total'),
      redis.incr(`scraping_cron:executions:${today}`),
      redis.incr(`scraping_cron:executions:${today}:${hour}`),
      redis.setex('scraping_cron:last_execution', 3600 * 24, Date.now().toString()),
      redis.setex(`scraping_cron:last_request_id`, 3600 * 24, requestId),
      redis.lpush('scraping_cron:execution_history', JSON.stringify({
        requestId,
        timestamp: new Date().toISOString(),
        status: 'started',
      })),
      redis.ltrim('scraping_cron:execution_history', 0, 99), // Keep last 100 executions
    ]);
  } catch (error) {
    console.error('Failed to track scraping cron execution:', error);
  }
}

// Track cron job errors
async function trackCronError(error: Error, requestId: string) {
  try {
    const errorData = {
      requestId,
      error: error.message,
      type: error.constructor.name,
      stack: error.stack,
      timestamp: new Date().toISOString(),
    };

    await Promise.all([
      redis.incr('scraping_cron:errors:total'),
      redis.incr(`scraping_cron:errors:${new Date().toISOString().split('T')[0]}`),
      redis.setex('scraping_cron:last_error', 3600 * 24, JSON.stringify(errorData)),
      redis.lpush('scraping_cron:error_history', JSON.stringify(errorData)),
      redis.ltrim('scraping_cron:error_history', 0, 49), // Keep last 50 errors
    ]);
  } catch (redisError) {
    console.error('Failed to track scraping cron error:', redisError);
  }
}