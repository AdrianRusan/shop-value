import { Queue, Worker, Job, QueueEvents } from 'bullmq';
import { Redis } from 'ioredis';
import { redis } from '@/lib/upstash';

// Job data interfaces
export interface ScrapingJobData {
  productId: string;
  url: string;
  userId: string;
  userTier: 'free' | 'pro' | 'enterprise';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  retryCount?: number;
  lastAttempt?: Date;
  source: string;
  tenantId: string;
}

export interface ScrapingResult {
  success: boolean;
  productId: string;
  url: string;
  price?: number;
  title?: string;
  availability?: string;
  scrapedAt: Date;
  error?: string;
  strategy?: string;
  confidence?: number;
}

// Redis connection for BullMQ - simplified for now
const redisConnection = new Redis({
  host: 'localhost',
  port: 6379,
  maxRetriesPerRequest: 3,
  retryDelayOnFailure: 50,
  enableReadyCheck: false,
  lazyConnect: true,
});

// Queue configuration based on subscription tiers
const getQueuePriority = (userTier: string): number => {
  switch (userTier) {
    case 'enterprise': return 100;
    case 'pro': return 50;
    case 'free': return 10;
    default: return 1;
  }
};

// Create scraping queue
export const scrapingQueue = new Queue<ScrapingJobData>('product-scraping', {
  connection: redisConnection,
  defaultJobOptions: {
    removeOnComplete: 100,
    removeOnFail: 50,
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
    delay: 0,
  },
});

// Email notification queue for alerts
export const emailQueue = new Queue('email-notifications', {
  connection: redisConnection,
  defaultJobOptions: {
    removeOnComplete: 50,
    removeOnFail: 25,
    attempts: 5,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
  },
});

// Analytics queue for tracking scraping metrics
export const analyticsQueue = new Queue('scraping-analytics', {
  connection: redisConnection,
  defaultJobOptions: {
    removeOnComplete: 200,
    removeOnFail: 50,
    attempts: 2,
    delay: 1000,
  },
});

// Queue events for monitoring
export const scrapingQueueEvents = new QueueEvents('product-scraping', {
  connection: redisConnection,
});

// Add a scraping job with user-based priority
export const addScrapingJob = async (
  jobData: ScrapingJobData,
  options?: {
    delay?: number;
    priority?: number;
    jobId?: string;
  }
): Promise<Job<ScrapingJobData>> => {
  try {
    const priority = options?.priority || getQueuePriority(jobData.userTier);
    
    // Check if job already exists to prevent duplicates
    const existingJob = await scrapingQueue.getJob(
      options?.jobId || `${jobData.productId}-${jobData.userId}`
    );
    
    if (existingJob && ['waiting', 'active', 'delayed'].includes(await existingJob.getState())) {
      console.log(`Scraping job already exists for product ${jobData.productId}`);
      return existingJob;
    }

    const job = await scrapingQueue.add(
      'scrape-product',
      {
        ...jobData,
        retryCount: jobData.retryCount || 0,
        lastAttempt: new Date(),
      },
      {
        priority,
        delay: options?.delay || 0,
        jobId: options?.jobId || `${jobData.productId}-${jobData.userId}`,
        
        // Retry configuration based on user tier
        attempts: jobData.userTier === 'enterprise' ? 5 : 
                 jobData.userTier === 'pro' ? 4 : 3,
        
        backoff: {
          type: 'exponential',
          delay: jobData.userTier === 'enterprise' ? 1000 : 
                 jobData.userTier === 'pro' ? 2000 : 5000,
        },
      }
    );

    // Track job creation
    await redis.incr('scraping:jobs:created');
    await redis.incr(`scraping:jobs:${jobData.userTier}`);

    console.log(`Created scraping job ${job.id} for product ${jobData.productId} (${jobData.userTier})`);
    return job;
    
  } catch (error) {
    console.error('Error adding scraping job:', error);
    throw error;
  }
};

// Schedule recurring scraping based on user tier
export const scheduleRecurringScraping = async (
  jobData: ScrapingJobData
): Promise<void> => {
  try {
    // Calculate delay based on user tier
    const getDelayMs = (tier: string): number => {
      switch (tier) {
        case 'enterprise': return 60 * 60 * 1000; // 1 hour
        case 'pro': return 6 * 60 * 60 * 1000; // 6 hours
        case 'free': return 24 * 60 * 60 * 1000; // 24 hours
        default: return 24 * 60 * 60 * 1000;
      }
    };

    const delay = getDelayMs(jobData.userTier);
    const jobId = `recurring-${jobData.productId}-${jobData.userId}`;

    // Remove existing recurring job if any
    const existingJob = await scrapingQueue.getJob(jobId);
    if (existingJob) {
      await existingJob.remove();
    }

    // Add new recurring job
    await addScrapingJob(jobData, {
      delay,
      jobId,
    });

    console.log(`Scheduled recurring scraping for product ${jobData.productId} every ${delay / 1000 / 60} minutes`);
    
  } catch (error) {
    console.error('Error scheduling recurring scraping:', error);
    throw error;
  }
};

// Bulk add scraping jobs for multiple products
export const addBulkScrapingJobs = async (
  jobsData: ScrapingJobData[]
): Promise<Job<ScrapingJobData>[]> => {
  try {
    const jobs = jobsData.map((jobData) => ({
      name: 'scrape-product',
      data: {
        ...jobData,
        retryCount: 0,
        lastAttempt: new Date(),
      },
      opts: {
        priority: getQueuePriority(jobData.userTier),
        jobId: `${jobData.productId}-${jobData.userId}`,
        attempts: jobData.userTier === 'enterprise' ? 5 : 
                 jobData.userTier === 'pro' ? 4 : 3,
      },
    }));

    const addedJobs = await scrapingQueue.addBulk(jobs);

    // Track bulk job creation
    await redis.incr('scraping:jobs:bulk_created');
    await redis.incrby('scraping:jobs:created', addedJobs.length);

    console.log(`Added ${addedJobs.length} scraping jobs in bulk`);
    return addedJobs;
    
  } catch (error) {
    console.error('Error adding bulk scraping jobs:', error);
    throw error;
  }
};

// Queue monitoring and health check
export const getQueueStats = async () => {
  try {
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      scrapingQueue.getWaiting(),
      scrapingQueue.getActive(),
      scrapingQueue.getCompleted(),
      scrapingQueue.getFailed(),
      scrapingQueue.getDelayed(),
    ]);

    return {
      waiting: waiting.length,
      active: active.length,
      completed: completed.length,
      failed: failed.length,
      delayed: delayed.length,
      total: waiting.length + active.length + completed.length + failed.length + delayed.length,
    };
  } catch (error) {
    console.error('Error getting queue stats:', error);
    return null;
  }
};

// Clean up old jobs
export const cleanupOldJobs = async (): Promise<void> => {
  try {
    // Remove completed jobs older than 24 hours
    await scrapingQueue.clean(24 * 60 * 60 * 1000, 100, 'completed');
    
    // Remove failed jobs older than 7 days
    await scrapingQueue.clean(7 * 24 * 60 * 60 * 1000, 50, 'failed');
    
    console.log('Cleaned up old scraping jobs');
  } catch (error) {
    console.error('Error cleaning up old jobs:', error);
  }
};

// Graceful shutdown
export const shutdownQueues = async (): Promise<void> => {
  try {
    await scrapingQueue.close();
    await emailQueue.close();
    await analyticsQueue.close();
    await scrapingQueueEvents.close();
    await redisConnection.quit();
    
    console.log('Queues shut down gracefully');
  } catch (error) {
    console.error('Error shutting down queues:', error);
  }
};

// Export queue instances for use in workers
export { redisConnection };