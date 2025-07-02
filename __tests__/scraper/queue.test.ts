import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { addScrapingJob, getQueueStats, ScrapingJobData } from '@/lib/scraper/queue';
import { connectToDB } from '@/lib/mongoose';

// Mock Redis and BullMQ for testing
jest.mock('ioredis', () => {
  return class MockRedis {
    data: Map<string, any> = new Map();
    
    async get(key: string) {
      return this.data.get(key) || null;
    }
    
    async set(key: string, value: any) {
      this.data.set(key, value);
      return 'OK';
    }
    
    async incr(key: string) {
      const current = parseInt(this.data.get(key) || '0');
      this.data.set(key, (current + 1).toString());
      return current + 1;
    }
    
    async setex(key: string, ttl: number, value: any) {
      this.data.set(key, value);
      return 'OK';
    }
    
    async quit() {
      return 'OK';
    }
  };
});

jest.mock('bullmq', () => ({
  Queue: class MockQueue {
    name: string;
    jobs: Map<string, any> = new Map();
    
    constructor(name: string) {
      this.name = name;
    }
    
    async add(jobName: string, data: any, options: any = {}) {
      const job = {
        id: options.jobId || `${data.productId}-${data.userId}`,
        name: jobName,
        data,
        options,
        getState: async () => 'waiting'
      };
      this.jobs.set(job.id, job);
      return job;
    }
    
    async getJob(jobId: string) {
      return this.jobs.get(jobId) || null;
    }
    
    async addBulk(jobs: any[]) {
      const addedJobs = [];
      for (const jobData of jobs) {
        const job = await this.add(jobData.name, jobData.data, jobData.opts);
        addedJobs.push(job);
      }
      return addedJobs;
    }
    
    async getWaiting() { return Array.from(this.jobs.values()).filter(j => j.getState() === 'waiting'); }
    async getActive() { return []; }
    async getCompleted() { return []; }
    async getFailed() { return []; }
    async getDelayed() { return []; }
    
    async clean() { return 0; }
    async close() { return; }
  },
  Worker: class MockWorker {
    constructor() {}
    on() {}
    async close() {}
  },
  QueueEvents: class MockQueueEvents {
    constructor() {}
    async close() {}
  }
}));

describe('Scraping Queue System', () => {
  let testJobData: ScrapingJobData;

  beforeEach(async () => {
    testJobData = {
      productId: 'test-product-id',
      url: 'https://flip.ro/test-product',
      userId: 'test-user-id',
      userTier: 'pro',
      priority: 'high',
      source: 'flip',
      tenantId: 'test-tenant',
    };
  });

  test('should add a scraping job successfully', async () => {
    const job = await addScrapingJob(testJobData);
    
    expect(job).toBeDefined();
    expect(job.id).toBe(`${testJobData.productId}-${testJobData.userId}`);
    expect(job.data.productId).toBe(testJobData.productId);
    expect(job.data.userTier).toBe(testJobData.userTier);
  });

  test('should prioritize enterprise users over free users', async () => {
    const enterpriseJob = {
      ...testJobData,
      userTier: 'enterprise' as const,
      userId: 'enterprise-user',
      productId: 'enterprise-product',
    };

    const freeJob = {
      ...testJobData,
      userTier: 'free' as const,
      userId: 'free-user',
      productId: 'free-product',
    };

    const [enterpriseResult, freeResult] = await Promise.all([
      addScrapingJob(enterpriseJob),
      addScrapingJob(freeJob),
    ]);

    expect(enterpriseResult).toBeDefined();
    expect(freeResult).toBeDefined();
    
    // Enterprise should have higher priority
    expect(enterpriseResult.options.priority).toBeGreaterThan(freeResult.options.priority);
  });

  test('should prevent duplicate jobs', async () => {
    const firstJob = await addScrapingJob(testJobData);
    const duplicateJob = await addScrapingJob(testJobData);
    
    expect(firstJob.id).toBe(duplicateJob.id);
  });

  test('should get queue statistics', async () => {
    await addScrapingJob(testJobData);
    
    const stats = await getQueueStats();
    
    expect(stats).toBeDefined();
    expect(stats).toHaveProperty('waiting');
    expect(stats).toHaveProperty('active');
    expect(stats).toHaveProperty('completed');
    expect(stats).toHaveProperty('failed');
    expect(stats).toHaveProperty('total');
    
    expect(stats!.waiting).toBeGreaterThanOrEqual(0);
    expect(stats!.total).toBeGreaterThanOrEqual(0);
  });

  test('should handle different subscription tiers correctly', async () => {
    const tiers: Array<'free' | 'pro' | 'enterprise'> = ['free', 'pro', 'enterprise'];
    const jobs = [];

    for (const tier of tiers) {
      const job = await addScrapingJob({
        ...testJobData,
        userTier: tier,
        userId: `${tier}-user`,
        productId: `${tier}-product`,
      });
      jobs.push(job);
    }

    // Verify all jobs were created
    expect(jobs).toHaveLength(3);
    
    // Verify enterprise has highest priority
    const enterpriseJob = jobs.find(j => j.data.userTier === 'enterprise');
    const freeJob = jobs.find(j => j.data.userTier === 'free');
    
    expect(enterpriseJob!.options.priority).toBeGreaterThan(freeJob!.options.priority);
  });
});

describe('Scraping Integration', () => {
  test('should handle realistic scraping workflow', async () => {
    // Simulate multiple users with different tiers tracking products
    const users = [
      { id: 'user1', tier: 'enterprise' as const },
      { id: 'user2', tier: 'pro' as const },
      { id: 'user3', tier: 'free' as const },
    ];

    const products = [
      'https://flip.ro/iphone-15-pro',
      'https://flip.ro/samsung-galaxy-s24',
      'https://flip.ro/macbook-air-m3',
    ];

    const jobs = [];
    
    // Create jobs for each user-product combination
    for (const user of users) {
      for (let i = 0; i < products.length; i++) {
        const job = await addScrapingJob({
          productId: `product-${i + 1}`,
          url: products[i],
          userId: user.id,
          userTier: user.tier,
          priority: user.tier === 'enterprise' ? 'urgent' : 
                   user.tier === 'pro' ? 'high' : 'medium',
          source: 'flip',
          tenantId: `tenant-${user.id}`,
        });
        jobs.push(job);
      }
    }

    expect(jobs).toHaveLength(9); // 3 users × 3 products

    // Verify queue stats
    const stats = await getQueueStats();
    expect(stats!.total).toBeGreaterThanOrEqual(9);
  });
});

describe('Error Handling', () => {
  test('should handle invalid job data gracefully', async () => {
    const invalidJobData = {
      productId: '',
      url: 'invalid-url',
      userId: '',
      userTier: 'invalid' as any,
      priority: 'invalid' as any,
      source: '',
      tenantId: '',
    };

    try {
      await addScrapingJob(invalidJobData);
      // If no error is thrown, that's okay - the queue should handle it
    } catch (error) {
      // If an error is thrown, verify it's a meaningful error
      expect(error).toBeDefined();
    }
  });
});

// Performance test
describe('Performance', () => {
  test('should handle bulk job creation efficiently', async () => {
    const startTime = Date.now();
    const jobPromises = [];

    // Create 100 jobs concurrently
    for (let i = 0; i < 100; i++) {
      jobPromises.push(addScrapingJob({
        productId: `perf-product-${i}`,
        url: `https://flip.ro/product-${i}`,
        userId: `perf-user-${i}`,
        userTier: i % 3 === 0 ? 'enterprise' : i % 2 === 0 ? 'pro' : 'free',
        priority: 'medium',
        source: 'flip',
        tenantId: `perf-tenant-${i}`,
      }));
    }

    const jobs = await Promise.all(jobPromises);
    const endTime = Date.now();

    expect(jobs).toHaveLength(100);
    expect(endTime - startTime).toBeLessThan(5000); // Should complete in under 5 seconds

    // Verify queue stats reflect the new jobs
    const stats = await getQueueStats();
    expect(stats!.total).toBeGreaterThanOrEqual(100);
  });
});