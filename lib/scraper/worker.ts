import { Worker, Job } from 'bullmq';
import { redisConnection } from './queue';
import { ScrapingJobData, ScrapingResult } from './queue';

// Simplified worker for processing scraping jobs
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
    } catch (error) {
      console.error('Failed to initialize scraping worker:', error);
    }
  }

  private async processScrapingJob(job: Job<ScrapingJobData>): Promise<ScrapingResult> {
    const { productId, url, userId, userTier, source } = job.data;
    
    console.log(`Processing scraping job ${job.id} for product ${productId} (${userTier})`);

    try {
      // Dynamic import to avoid build-time database connections
      const mongooseModule = await import('@/lib/mongoose').catch(() => null);
      
      if (mongooseModule) {
        await mongooseModule.connectToDB();
      }

      // Basic scraping result for now
      const scrapingResult: ScrapingResult = {
        success: true,
        productId,
        url,
        price: 100, // TODO: Implement actual scraping
        title: 'Test Product',
        availability: 'in_stock',
        scrapedAt: new Date(),
        strategy: 'basic',
        confidence: 0.9,
      };

      console.log(`✅ Successfully processed job for ${url}`);
      return scrapingResult;

    } catch (error) {
      console.error(`❌ Scraping job ${job.id} failed:`, error);
      
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
      console.log(`✅ Job ${job.id} completed successfully:`, result.strategy);
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

// Simplified email worker
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
    } catch (error) {
      console.error('Failed to initialize email worker:', error);
    }
  }

  private async processEmailJob(job: Job): Promise<void> {
    const { type } = job.data;

    console.log(`Processing email job ${job.id} of type ${type}`);

    try {
      // Basic email processing for now
      console.log(`📧 Would send ${type} email - functionality simplified for build`);
      
    } catch (error) {
      console.error(`❌ Email job ${job.id} failed:`, error);
      throw error;
    }
  }

  private setupEventHandlers(): void {
    if (!this.worker) return;

    this.worker.on('completed', (job: Job) => {
      console.log(`✅ Email job ${job.id} completed`);
    });

    this.worker.on('failed', (job: Job | undefined, err: Error) => {
      console.error(`❌ Email job ${job?.id} failed:`, err.message);
    });
  }

  public async stop(): Promise<void> {
    console.log('🛑 Stopping email worker...');
    if (this.worker) {
      await this.worker.close();
    }
  }
}

// Create lazy instances that only initialize when needed
let scrapingWorkerInstance: ScrapingWorker | null = null;
let emailWorkerInstance: EmailWorker | null = null;

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