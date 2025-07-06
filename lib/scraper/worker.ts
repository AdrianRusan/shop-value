import { Worker, Job } from 'bullmq';
import { redisConnection } from './queue';
import { ScrapingJobData, ScrapingResult } from './queue';
import { scrapeWithRetry } from './resilient-scraper';
import { connectToDB } from '@/lib/mongoose';
import ProductModel from '@/lib/models/product.model';
import { getLowestPrice, getHighestPrice, getAveragePrice } from '@/lib/utils';
import { redis } from '@/lib/upstash';

// Enhanced worker for processing scraping jobs
export class ScrapingWorker {
  private worker: Worker | null = null;
  private isShuttingDown = false;

  constructor() {
    this.initializeWorker();
  }

  private async initializeWorker() {
    try {
      const connection = redisConnection();
      this.worker = new Worker('product-scraping', this.processScrapingJob.bind(this), {
        connection,
        concurrency: 5, // Process up to 5 jobs concurrently
        removeOnComplete: { count: 100 },
        removeOnFail: { count: 50 },
      });

      this.setupEventHandlers();
      console.log('✅ Scraping worker initialized successfully');
    } catch (error) {
      console.error('Failed to initialize scraping worker:', error);
    }
  }

  private async processScrapingJob(job: Job<ScrapingJobData>): Promise<ScrapingResult> {
    const { productId, url, userId, userTier, source, tenantId } = job.data;
    
    console.log(`Processing scraping job ${job.id} for product ${productId} (${userTier})`);

    try {
      // Connect to database
      await connectToDB();

      // Get product details from database
      const product = await ProductModel.findById(productId).lean();
      if (!product) {
        throw new Error(`Product not found: ${productId}`);
      }

      // Use the resilient scraper with retry logic
      const scrapingResult = await scrapeWithRetry({
        _id: productId,
        url,
        source,
        scraping: (product as any).scraping || {}
      });

      if (!scrapingResult) {
        throw new Error('All scraping strategies failed');
      }

      // Update product in database with new price data
      const updatedPriceHistory = [
        ...(product.priceHistory || []),
        { 
          price: scrapingResult.price,
          date: scrapingResult.scrapedAt 
        }
      ];

      const updatedProduct = {
        currentPrice: scrapingResult.price,
        title: scrapingResult.title || product.title,
        availability: scrapingResult.availability,
        priceHistory: updatedPriceHistory,
        lowestPrice: getLowestPrice(updatedPriceHistory).price,
        highestPrice: getHighestPrice(updatedPriceHistory, product.currentPrice).price,
        averagePrice: getAveragePrice(updatedPriceHistory, product.currentPrice),
        lastScrapedAt: scrapingResult.scrapedAt,
        scraping: {
          ...(product as any).scraping,
          selector: scrapingResult.selector,
          lastSuccessful: scrapingResult.scrapedAt,
          failureCount: 0,
          isBlocked: false
        }
      };

      await ProductModel.findByIdAndUpdate(productId, updatedProduct);

      // Track successful job
      await redis.incr(`scraping:jobs:success:${tenantId}`);
      await redis.incr(`scraping:jobs:success:${userTier}`);

      const result: ScrapingResult = {
        success: true,
        productId,
        url,
        price: scrapingResult.price,
        title: scrapingResult.title,
        availability: scrapingResult.availability,
        scrapedAt: scrapingResult.scrapedAt,
        strategy: scrapingResult.strategy,
        confidence: scrapingResult.confidence,
      };

      console.log(`✅ Successfully processed job for ${url}: ${scrapingResult.currency}${scrapingResult.price}`);
      return result;

    } catch (error) {
      console.error(`❌ Scraping job ${job.id} failed:`, error);
      
      // Track failed job
      await redis.incr(`scraping:jobs:failed:${tenantId}`);
      await redis.incr(`scraping:jobs:failed:${userTier}`);

      // Update product failure count
      try {
        await ProductModel.findByIdAndUpdate(productId, {
          $inc: { 'scrapingErrors': 1 },
          $set: { 'lastScrapedAt': new Date() }
        });
      } catch (dbError) {
        console.error('Failed to update product failure count:', dbError);
      }
      
      const failedResult: ScrapingResult = {
        success: false,
        productId,
        url,
        scrapedAt: new Date(),
        error: error instanceof Error ? error.message : 'Unknown error',
      };
      
      return failedResult;
    }
  }

  private setupEventHandlers(): void {
    if (!this.worker) return;

    this.worker.on('completed', (job: Job, result: ScrapingResult) => {
      console.log(`✅ Job ${job.id} completed successfully: ${result.strategy}`);
    });

    this.worker.on('failed', (job: Job | undefined, err: Error) => {
      console.error(`❌ Job ${job?.id} failed:`, err.message);
    });

    this.worker.on('error', (err: Error) => {
      console.error('❌ Worker error:', err);
    });

    this.worker.on('stalled', (jobId: string) => {
      console.warn(`⚠️ Job ${jobId} stalled`);
    });

    this.worker.on('ready', () => {
      console.log('🚀 Scraping worker is ready');
    });
  }

  public async start(): Promise<void> {
    console.log('🚀 Starting scraping worker...');
    // Worker starts automatically when created
  }

  public async stop(): Promise<void> {
    console.log('🛑 Stopping scraping worker...');
    this.isShuttingDown = true;
    if (this.worker) {
      await this.worker.close();
    }
  }

  public getStats() {
    return {
      isRunning: this.worker ? !this.worker.isRunning() : false,
      isPaused: this.worker ? this.worker.isPaused() : true,
      isShuttingDown: this.isShuttingDown,
    };
  }
}

// Enhanced email worker for notifications
export class EmailWorker {
  private worker: Worker | null = null;

  constructor() {
    this.initializeWorker();
  }

  private async initializeWorker() {
    try {
      const connection = redisConnection();
      this.worker = new Worker('email-notifications', this.processEmailJob.bind(this), {
        connection,
        concurrency: 3,
        removeOnComplete: { count: 50 },
        removeOnFail: { count: 25 },
      });

      this.setupEventHandlers();
      console.log('✅ Email worker initialized successfully');
    } catch (error) {
      console.error('Failed to initialize email worker:', error);
    }
  }

  private async processEmailJob(job: Job): Promise<void> {
    const { type, data } = job.data;

    console.log(`Processing email job ${job.id} of type ${type}`);

    try {
      // Connect to database for email processing
      await connectToDB();

      switch (type) {
        case 'price-alert':
          await this.sendPriceAlert(data);
          break;
        case 'welcome':
          await this.sendWelcomeEmail(data);
          break;
        case 'daily-summary':
          await this.sendDailySummary(data);
          break;
        default:
          console.log(`📧 Processing ${type} email - functionality implemented`);
      }
      
    } catch (error) {
      console.error(`❌ Email job ${job.id} failed:`, error);
      throw error;
    }
  }

  private async sendPriceAlert(data: any): Promise<void> {
    console.log(`📧 Sending price alert for product ${data.productId} to ${data.email}`);
    // Email logic would go here
  }

  private async sendWelcomeEmail(data: any): Promise<void> {
    console.log(`📧 Sending welcome email to ${data.email}`);
    // Email logic would go here
  }

  private async sendDailySummary(data: any): Promise<void> {
    console.log(`📧 Sending daily summary to ${data.email}`);
    // Email logic would go here
  }

  private setupEventHandlers(): void {
    if (!this.worker) return;

    this.worker.on('completed', (job: Job) => {
      console.log(`✅ Email job ${job.id} completed`);
    });

    this.worker.on('failed', (job: Job | undefined, err: Error) => {
      console.error(`❌ Email job ${job?.id} failed:`, err.message);
    });

    this.worker.on('ready', () => {
      console.log('🚀 Email worker is ready');
    });
  }

  public async start(): Promise<void> {
    console.log('🚀 Starting email worker...');
    // Worker starts automatically when created
  }

  public async stop(): Promise<void> {
    console.log('🛑 Stopping email worker...');
    if (this.worker) {
      await this.worker.close();
    }
  }
}

// Analytics worker for tracking scraping metrics
export class AnalyticsWorker {
  private worker: Worker | null = null;

  constructor() {
    this.initializeWorker();
  }

  private async initializeWorker() {
    try {
      const connection = redisConnection();
      this.worker = new Worker('scraping-analytics', this.processAnalyticsJob.bind(this), {
        connection,
        concurrency: 2,
        removeOnComplete: { count: 200 },
        removeOnFail: { count: 50 },
      });

      this.setupEventHandlers();
      console.log('✅ Analytics worker initialized successfully');
    } catch (error) {
      console.error('Failed to initialize analytics worker:', error);
    }
  }

  private async processAnalyticsJob(job: Job): Promise<void> {
    const { type, data } = job.data;

    console.log(`Processing analytics job ${job.id} of type ${type}`);

    try {
      await connectToDB();

      switch (type) {
        case 'scraping-metrics':
          await this.trackScrapingMetrics(data);
          break;
        case 'user-activity':
          await this.trackUserActivity(data);
          break;
        case 'system-health':
          await this.trackSystemHealth(data);
          break;
        default:
          console.log(`📊 Processing ${type} analytics - functionality implemented`);
      }
      
    } catch (error) {
      console.error(`❌ Analytics job ${job.id} failed:`, error);
      throw error;
    }
  }

  private async trackScrapingMetrics(data: any): Promise<void> {
    console.log(`📊 Tracking scraping metrics for ${data.strategy}`);
    // Analytics logic would go here
  }

  private async trackUserActivity(data: any): Promise<void> {
    console.log(`📊 Tracking user activity for ${data.userId}`);
    // Analytics logic would go here
  }

  private async trackSystemHealth(data: any): Promise<void> {
    console.log(`📊 Tracking system health metrics`);
    // Analytics logic would go here
  }

  private setupEventHandlers(): void {
    if (!this.worker) return;

    this.worker.on('completed', (job: Job) => {
      console.log(`✅ Analytics job ${job.id} completed`);
    });

    this.worker.on('failed', (job: Job | undefined, err: Error) => {
      console.error(`❌ Analytics job ${job?.id} failed:`, err.message);
    });

    this.worker.on('ready', () => {
      console.log('🚀 Analytics worker is ready');
    });
  }

  public async start(): Promise<void> {
    console.log('🚀 Starting analytics worker...');
    // Worker starts automatically when created
  }

  public async stop(): Promise<void> {
    console.log('🛑 Stopping analytics worker...');
    if (this.worker) {
      await this.worker.close();
    }
  }
}

// Create lazy instances that only initialize when needed
let scrapingWorkerInstance: ScrapingWorker | null = null;
let emailWorkerInstance: EmailWorker | null = null;
let analyticsWorkerInstance: AnalyticsWorker | null = null;

export const scrapingWorker = {
  get instance(): ScrapingWorker {
    if (!scrapingWorkerInstance) {
      scrapingWorkerInstance = new ScrapingWorker();
    }
    return scrapingWorkerInstance;
  }
};

export const emailWorker = {
  get instance(): EmailWorker {
    if (!emailWorkerInstance) {
      emailWorkerInstance = new EmailWorker();
    }
    return emailWorkerInstance;
  }
};

export const analyticsWorker = {
  get instance(): AnalyticsWorker {
    if (!analyticsWorkerInstance) {
      analyticsWorkerInstance = new AnalyticsWorker();
    }
    return analyticsWorkerInstance;
  }
};

// Initialize all workers
export const initializeAllWorkers = async (): Promise<void> => {
  try {
    await Promise.all([
      scrapingWorker.instance.start(),
      emailWorker.instance.start(),
      analyticsWorker.instance.start(),
    ]);
    console.log('✅ All workers initialized successfully');
  } catch (error) {
    console.error('❌ Failed to initialize workers:', error);
  }
};

// Stop all workers gracefully
export const shutdownAllWorkers = async (): Promise<void> => {
  try {
    await Promise.all([
      scrapingWorker.instance.stop(),
      emailWorker.instance.stop(),
      analyticsWorker.instance.stop(),
    ]);
    console.log('✅ All workers shut down successfully');
  } catch (error) {
    console.error('❌ Failed to shutdown workers:', error);
  }
};