import { Queue, Worker, Job, QueueEvents } from 'bullmq';
import { Redis } from 'ioredis';

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

// Lazy Redis connection - only create when needed
let redisConnection: Redis | null = null;

function getRedisConnection(): Redis {
  if (!redisConnection) {
    const redisUrl = process.env.UPSTASH_REDIS_REST_URL || process.env.REDIS_URL;
    
    if (redisUrl && redisUrl.startsWith('redis://')) {
      // Use external Redis (Upstash or similar)
      redisConnection = new Redis(redisUrl, {
        maxRetriesPerRequest: null,
        enableReadyCheck: false,
        lazyConnect: true,
      });
    } else {
      // Fallback to local Redis for development
      redisConnection = new Redis({
        host: 'localhost',
        port: 6379,
        maxRetriesPerRequest: null,
        enableReadyCheck: false,
        lazyConnect: true,
      });
    }
  }
  return redisConnection;
}

// Lazy queue initialization
let scrapingQueueInstance: Queue<ScrapingJobData> | null = null;
let emailQueueInstance: Queue | null = null;
let analyticsQueueInstance: Queue | null = null;
let scrapingQueueEventsInstance: QueueEvents | null = null;

// Queue configuration based on subscription tiers
const getQueuePriority = (userTier: string): number => {
  switch (userTier) {
    case 'enterprise': return 100;
    case 'pro': return 50;
    case 'free': return 10;
    default: return 1;
  }
};

// Lazy getters for queues
export const scrapingQueue = {
  get instance(): Queue<ScrapingJobData> {
    if (!scrapingQueueInstance) {
      scrapingQueueInstance = new Queue<ScrapingJobData>('product-scraping', {
        connection: getRedisConnection(),
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
    }
    return scrapingQueueInstance;
  },
  
  // Proxy methods to the actual queue instance
  async add(name: string, data: ScrapingJobData, options?: any) {
    return this.instance.add(name, data, options);
  },
  
  async addBulk(jobs: any[]) {
    return this.instance.addBulk(jobs);
  },
  
  async getJob(jobId: string) {
    return this.instance.getJob(jobId);
  },
  
  async getWaiting() {
    return this.instance.getWaiting();
  },
  
  async getActive() {
    return this.instance.getActive();
  },
  
  async getCompleted() {
    return this.instance.getCompleted();
  },
  
  async getFailed() {
    return this.instance.getFailed();
  },
  
  async getDelayed() {
    return this.instance.getDelayed();
  },
  
  async clean(grace: number, limit: number, type: string) {
    return this.instance.clean(grace, limit, type as any);
  },
  
  async close() {
    if (scrapingQueueInstance) {
      await scrapingQueueInstance.close();
      scrapingQueueInstance = null;
    }
  }
};

export const emailQueue = {
  get instance(): Queue {
    if (!emailQueueInstance) {
      emailQueueInstance = new Queue('email-notifications', {
        connection: getRedisConnection(),
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
    }
    return emailQueueInstance;
  },
  
  async add(name: string, data: any, options?: any) {
    return this.instance.add(name, data, options);
  },
  
  async close() {
    if (emailQueueInstance) {
      await emailQueueInstance.close();
      emailQueueInstance = null;
    }
  }
};

export const analyticsQueue = {
  get instance(): Queue {
    if (!analyticsQueueInstance) {
      analyticsQueueInstance = new Queue('scraping-analytics', {
        connection: getRedisConnection(),
        defaultJobOptions: {
          removeOnComplete: 200,
          removeOnFail: 50,
          attempts: 2,
          delay: 1000,
        },
      });
    }
    return analyticsQueueInstance;
  },
  
  async add(name: string, data: any, options?: any) {
    return this.instance.add(name, data, options);
  },
  
  async close() {
    if (analyticsQueueInstance) {
      await analyticsQueueInstance.close();
      analyticsQueueInstance = null;
    }
  }
};

export const scrapingQueueEvents = {
  get instance(): QueueEvents {
    if (!scrapingQueueEventsInstance) {
      scrapingQueueEventsInstance = new QueueEvents('product-scraping', {
        connection: getRedisConnection(),
      });
    }
    return scrapingQueueEventsInstance;
  },
  
  async close() {
    if (scrapingQueueEventsInstance) {
      await scrapingQueueEventsInstance.close();
      scrapingQueueEventsInstance = null;
    }
  }
};

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

    // Track job creation (lazy import redis to avoid build-time connection)
    try {
      const { redis } = await import('@/lib/upstash');
      await redis.incr('scraping:jobs:created');
      await redis.incr(`scraping:jobs:${jobData.userTier}`);
    } catch (error) {
      console.warn('Failed to track scraping job creation:', error);
      // Don't fail the job creation for this
    }

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

    // Track bulk job creation (lazy import redis)
    try {
      const { redis } = await import('@/lib/upstash');
      await redis.incr('scraping:jobs:bulk_created');
      await redis.incrby('scraping:jobs:created', addedJobs.length);
    } catch (error) {
      console.warn('Failed to track bulk scraping job creation:', error);
    }

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
    
    if (redisConnection) {
      await redisConnection.quit();
      redisConnection = null;
    }
    
    console.log('Queues shut down gracefully');
  } catch (error) {
    console.error('Error shutting down queues:', error);
  }
};

// Export the connection getter for use in workers
export { getRedisConnection as redisConnection };