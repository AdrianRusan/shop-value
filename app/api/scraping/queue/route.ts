import { NextResponse } from 'next/server';
import { connectToDB } from '@/lib/mongoose';
import { 
  addScrapingJob, 
  addBulkScrapingJobs, 
  getQueueStats, 
  scheduleRecurringScraping,
  ScrapingJobData 
} from '@/lib/scraper/queue';
import { redis } from '@/lib/upstash';
import { auth } from '@clerk/nextjs/server';

export const dynamic = 'force-dynamic';

// Add a scraping job to the queue
export async function POST(request: Request) {
  try {
    const { userId } = auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { 
      productId, 
      url, 
      userTier = 'free',
      priority = 'medium',
      source = 'flip',
      tenantId = 'default',
      recurring = false,
      bulk = false,
      jobs = []
    } = body;

    await connectToDB();

    let result;

    if (bulk && jobs.length > 0) {
      // Handle bulk job creation
      const bulkJobs: ScrapingJobData[] = jobs.map((job: any) => ({
        productId: job.productId,
        url: job.url,
        userId,
        userTier,
        priority: job.priority || priority,
        source: job.source || source,
        tenantId: job.tenantId || tenantId,
      }));

      result = await addBulkScrapingJobs(bulkJobs);
      
      return NextResponse.json({
        success: true,
        message: `Added ${result.length} jobs to the queue`,
        jobs: result.map(job => ({
          id: job.id,
          productId: job.data.productId,
          status: 'queued'
        }))
      });

    } else {
      // Handle single job creation
      if (!productId || !url) {
        return NextResponse.json(
          { error: 'productId and url are required' },
          { status: 400 }
        );
      }

      const jobData: ScrapingJobData = {
        productId,
        url,
        userId,
        userTier,
        priority,
        source,
        tenantId,
      };

      if (recurring) {
        await scheduleRecurringScraping(jobData);
        result = { message: 'Recurring scraping scheduled' };
      } else {
        result = await addScrapingJob(jobData);
      }

      return NextResponse.json({
        success: true,
        message: recurring ? 'Recurring scraping scheduled' : 'Job added to queue',
        job: {
          id: result.id || 'recurring',
          productId,
          status: 'queued'
        }
      });
    }

  } catch (error: any) {
    console.error('Error adding scraping job:', error);
    return NextResponse.json(
      { error: 'Failed to add job to queue', details: error.message },
      { status: 500 }
    );
  }
}

// Get queue statistics and status
export async function GET(request: Request) {
  try {
    const { userId } = auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const url = new URL(request.url);
    const action = url.searchParams.get('action');

    if (action === 'stats') {
      const stats = await getQueueStats();
      
      // Get additional Redis metrics
      const [
        totalJobs,
        successfulJobs,
        failedJobs,
        lastExecution
      ] = await Promise.all([
        redis.get('scraping:jobs:created'),
        redis.get('scraping:jobs:success:total'),
        redis.get('scraping:jobs:failed:total'),
        redis.get('scraping:last_execution')
      ]);

      return NextResponse.json({
        success: true,
        stats: {
          queue: stats,
          metrics: {
            totalJobs: parseInt(totalJobs as string) || 0,
            successfulJobs: parseInt(successfulJobs as string) || 0,
            failedJobs: parseInt(failedJobs as string) || 0,
            lastExecution: lastExecution ? new Date(parseInt(lastExecution as string)) : null
          }
        }
      });
    }

    if (action === 'health') {
      try {
        await redis.ping();
        const stats = await getQueueStats();
        
        return NextResponse.json({
          success: true,
          health: {
            redis: 'healthy',
            queue: stats ? 'healthy' : 'degraded',
            timestamp: new Date().toISOString()
          }
        });
      } catch (error) {
        return NextResponse.json({
          success: false,
          health: {
            redis: 'unhealthy',
            queue: 'unhealthy',
            error: error instanceof Error ? error.message : 'Unknown error',
            timestamp: new Date().toISOString()
          }
        }, { status: 503 });
      }
    }

    return NextResponse.json(
      { error: 'Invalid action. Use ?action=stats or ?action=health' },
      { status: 400 }
    );

  } catch (error: any) {
    console.error('Error getting queue status:', error);
    return NextResponse.json(
      { error: 'Failed to get queue status', details: error.message },
      { status: 500 }
    );
  }
}

// Delete/cancel jobs from the queue
export async function DELETE(request: Request) {
  try {
    const { userId } = auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const url = new URL(request.url);
    const jobId = url.searchParams.get('jobId');
    const action = url.searchParams.get('action');

    const { scrapingQueue } = await import('@/lib/scraper/queue');

    if (action === 'clean') {
      // Clean old completed and failed jobs
      const cleanupResults = await Promise.all([
        scrapingQueue.clean(24 * 60 * 60 * 1000, 100, 'completed'),
        scrapingQueue.clean(7 * 24 * 60 * 60 * 1000, 50, 'failed')
      ]);

      return NextResponse.json({
        success: true,
        message: 'Queue cleaned successfully',
        cleaned: {
          completed: cleanupResults[0],
          failed: cleanupResults[1]
        }
      });
    }

    if (jobId) {
      const job = await scrapingQueue.getJob(jobId);
      if (!job) {
        return NextResponse.json(
          { error: 'Job not found' },
          { status: 404 }
        );
      }

      await job.remove();
      return NextResponse.json({
        success: true,
        message: 'Job removed from queue',
        jobId
      });
    }

    return NextResponse.json(
      { error: 'jobId is required or use ?action=clean' },
      { status: 400 }
    );

  } catch (error: any) {
    console.error('Error deleting job:', error);
    return NextResponse.json(
      { error: 'Failed to delete job', details: error.message },
      { status: 500 }
    );
  }
}