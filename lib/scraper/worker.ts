import { Worker, Job } from 'bullmq';
import { redisConnection } from './queue';
import { ScrapingJobData, ScrapingResult } from './queue';
import { scrapeWithRetry } from './resilient-scraper';
import { connectToDB } from '@/lib/mongoose';
import Product from '@/lib/models/product.model';
import User from '@/lib/models/user.model';
import { emailQueue } from './queue';

// Worker for processing scraping jobs
export class ScrapingWorker {
  private worker: Worker;
  private isShuttingDown = false;

  constructor() {
    this.worker = new Worker('product-scraping', this.processScrapingJob.bind(this), {
      connection: redisConnection,
      concurrency: 5, // Process up to 5 jobs concurrently
      removeOnComplete: 100,
      removeOnFail: 50,
    });

    this.setupEventHandlers();
  }

  private async processScrapingJob(job: Job<ScrapingJobData>): Promise<ScrapingResult> {
    const { productId, url, userId, userTier, source, tenantId } = job.data;
    
    console.log(`Processing scraping job ${job.id} for product ${productId} (${userTier})`);

    try {
      // Connect to database
      await connectToDB();

      // Get product from database
      const product = await Product.findById(productId);
      if (!product) {
        throw new Error(`Product ${productId} not found`);
      }

      // Get user to check subscription limits
      const user = await User.findOne({ clerkId: userId });
      if (!user) {
        throw new Error(`User ${userId} not found`);
      }

      // Check user's scraping limits based on tier
      const canScrape = await this.checkScrapingLimits(user, userTier);
      if (!canScrape) {
        throw new Error(`Scraping limit exceeded for user ${userId} (${userTier})`);
      }

      // Perform the scraping with retry logic
      const scrapingResult = await scrapeWithRetry({
        _id: productId,
        url,
        source,
      });

      if (!scrapingResult) {
        throw new Error('All scraping strategies failed');
      }

      // Update product in database
      await this.updateProductData(product, scrapingResult);

      // Check for price alerts
      await this.checkPriceAlerts(product, scrapingResult, user);

      // Track usage for the user
      await this.trackUsage(user, userTier);

      console.log(`✅ Successfully scraped ${url}: ${scrapingResult.currency}${scrapingResult.price}`);

      return scrapingResult;

    } catch (error) {
      console.error(`❌ Scraping job ${job.id} failed:`, error);
      
      // Update failure count in product
      await this.updateFailureCount(productId);
      
      throw error;
    }
  }

  private async checkScrapingLimits(user: any, userTier: string): Promise<boolean> {
    // For now, return true - implement rate limiting later based on subscription
    // TODO: Implement per-user rate limiting based on subscription tier
    return true;
  }

  private async updateProductData(product: any, result: ScrapingResult): Promise<void> {
    try {
      const currentPrice = result.price;
      const priceChanged = Math.abs(product.currentPrice - currentPrice) > 0.01;

      // Update price history if price changed
      const updates: any = {
        currentPrice,
        lastScrapedAt: new Date(),
        'scraping.lastSuccessful': new Date(),
        'scraping.failureCount': 0,
        availability: result.availability,
      };

      if (priceChanged) {
        updates.$push = {
          priceHistory: {
            price: currentPrice,
            date: new Date(),
            source: result.strategy,
            scraperVersion: '2.0.0',
          }
        };

        // Update price statistics
        updates.lowestPrice = Math.min(product.lowestPrice || currentPrice, currentPrice);
        updates.highestPrice = Math.max(product.highestPrice || currentPrice, currentPrice);
        
        // Recalculate average price
        const allPrices = [...(product.priceHistory || []), { price: currentPrice }];
        const totalPrice = allPrices.reduce((sum, h) => sum + h.price, 0);
        updates.averagePrice = totalPrice / allPrices.length;
      }

      // Update selector if it's different and worked
      if (result.selector && result.selector !== 'cached' && result.selector !== 'fallback') {
        updates['scraping.selector'] = result.selector;
      }

      // Calculate next scrape time based on user activity and price volatility
      const baseInterval = this.getScrapingInterval(product.analytics?.popularityScore || 0);
      updates.nextScrapeAt = new Date(Date.now() + baseInterval);

      await Product.findByIdAndUpdate(product._id, updates);

      console.log(`Updated product ${product._id} with new price: ${currentPrice}`);

    } catch (error) {
      console.error('Error updating product data:', error);
      throw error;
    }
  }

  private async checkPriceAlerts(product: any, result: ScrapingResult, user: any): Promise<void> {
    try {
      const priceChanged = Math.abs(product.currentPrice - result.price) > 0.01;
      const priceDropped = result.price < product.currentPrice;
      const significantDrop = ((product.currentPrice - result.price) / product.currentPrice) > 0.05; // 5% drop

      // Check if product came back in stock
      const backInStock = product.availability === 'out_of_stock' && result.availability === 'in_stock';

      // Send notifications based on user preferences
      if (priceChanged && priceDropped && user.preferences?.notifications?.priceAlerts) {
        await emailQueue.add('price-alert', {
          userId: user.clerkId,
          userEmail: user.email,
          productId: product._id,
          productTitle: result.title || product.title,
          productUrl: product.url,
          oldPrice: product.currentPrice,
          newPrice: result.price,
          percentageChange: ((product.currentPrice - result.price) / product.currentPrice) * 100,
          type: significantDrop ? 'significant-drop' : 'price-drop',
        });

        console.log(`📧 Queued price alert for user ${user.email}: ${product.title}`);
      }

      if (backInStock && user.preferences?.notifications?.email) {
        await emailQueue.add('stock-alert', {
          userId: user.clerkId,
          userEmail: user.email,
          productId: product._id,
          productTitle: result.title || product.title,
          productUrl: product.url,
          currentPrice: result.price,
        });

        console.log(`📧 Queued stock alert for user ${user.email}: ${product.title}`);
      }

    } catch (error) {
      console.error('Error checking price alerts:', error);
      // Don't throw - this shouldn't fail the scraping job
    }
  }

  private async trackUsage(user: any, userTier: string): Promise<void> {
    try {
      // Increment API calls or scraping usage
      await User.findByIdAndUpdate(user._id, {
        $inc: { 'usage.apiCalls': 1 },
        lastLoginAt: new Date(),
      });

    } catch (error) {
      console.error('Error tracking usage:', error);
      // Don't throw - this shouldn't fail the scraping job
    }
  }

  private async updateFailureCount(productId: string): Promise<void> {
    try {
      await Product.findByIdAndUpdate(productId, {
        $inc: { 'scraping.failureCount': 1 },
        'scraping.lastFailedAt': new Date(),
      });
    } catch (error) {
      console.error('Error updating failure count:', error);
    }
  }

  private getScrapingInterval(popularityScore: number): number {
    // Base intervals by popularity
    const baseInterval = 4 * 60 * 60 * 1000; // 4 hours
    const popularityMultiplier = Math.max(0.5, 2 - (popularityScore / 100));
    return baseInterval * popularityMultiplier;
  }

  private setupEventHandlers(): void {
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
    await this.worker.close();
  }

  public async pause(): Promise<void> {
    console.log('⏸️ Pausing scraping worker...');
    await this.worker.pause();
  }

  public async resume(): Promise<void> {
    console.log('▶️ Resuming scraping worker...');
    await this.worker.resume();
  }

  public getStats() {
    return {
      isRunning: !this.worker.isRunning(),
      isPaused: this.worker.isPaused(),
      isShuttingDown: this.isShuttingDown,
    };
  }
}

// Email worker for processing notification emails
export class EmailWorker {
  private worker: Worker;

  constructor() {
    this.worker = new Worker('email-notifications', this.processEmailJob.bind(this), {
      connection: redisConnection,
      concurrency: 3,
      removeOnComplete: 50,
      removeOnFail: 25,
    });

    this.setupEventHandlers();
  }

  private async processEmailJob(job: Job): Promise<void> {
    const { type } = job.data;

    console.log(`Processing email job ${job.id} of type ${type}`);

    try {
      switch (type) {
        case 'price-alert':
          await this.sendPriceAlert(job.data);
          break;
        case 'stock-alert':
          await this.sendStockAlert(job.data);
          break;
        case 'weekly-report':
          await this.sendWeeklyReport(job.data);
          break;
        default:
          console.warn(`Unknown email job type: ${type}`);
      }

      console.log(`✅ Email job ${job.id} completed successfully`);

    } catch (error) {
      console.error(`❌ Email job ${job.id} failed:`, error);
      throw error;
    }
  }

  private async sendPriceAlert(data: any): Promise<void> {
    // TODO: Implement actual email sending with Resend
    console.log(`📧 Would send price alert to ${data.userEmail} for ${data.productTitle}`);
    console.log(`   Price dropped from ${data.oldPrice} to ${data.newPrice} (${data.percentageChange.toFixed(1)}%)`);
  }

  private async sendStockAlert(data: any): Promise<void> {
    // TODO: Implement actual email sending with Resend
    console.log(`📧 Would send stock alert to ${data.userEmail} for ${data.productTitle}`);
    console.log(`   Product is back in stock at ${data.currentPrice}`);
  }

  private async sendWeeklyReport(data: any): Promise<void> {
    // TODO: Implement weekly report email
    console.log(`📧 Would send weekly report to ${data.userEmail}`);
  }

  private setupEventHandlers(): void {
    this.worker.on('completed', (job: Job) => {
      console.log(`✅ Email job ${job.id} completed`);
    });

    this.worker.on('failed', (job: Job | undefined, err: Error) => {
      console.error(`❌ Email job ${job?.id} failed:`, err.message);
    });

    this.worker.on('error', (err: Error) => {
      console.error('❌ Email worker error:', err);
    });
  }

  public async stop(): Promise<void> {
    console.log('🛑 Stopping email worker...');
    await this.worker.close();
  }
}

// Export worker instances
export const scrapingWorker = new ScrapingWorker();
export const emailWorker = new EmailWorker();