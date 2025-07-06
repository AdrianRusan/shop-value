import { addScrapingJob, addBulkScrapingJobs, ScrapingJobData } from './queue';
import { connectToDB } from '@/lib/mongoose';
import ProductModel from '@/lib/models/product.model';
import { redis } from '@/lib/upstash';

interface QueueScrapingOptions {
  userId: string;
  userTier?: 'free' | 'pro' | 'enterprise';
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  tenantId?: string;
  delay?: number;
  recurring?: boolean;
}

/**
 * Queue a single product for scraping instead of scraping it directly
 */
export async function queueProductScraping(
  productId: string,
  url: string,
  options: QueueScrapingOptions
): Promise<{ success: boolean; jobId?: string; error?: string }> {
  try {
    await connectToDB();

    // Verify product exists
    const product = await ProductModel.findById(productId).lean();
    if (!product) {
      return { success: false, error: 'Product not found' };
    }

    const jobData: ScrapingJobData = {
      productId,
      url,
      userId: options.userId,
      userTier: options.userTier || 'free',
      priority: options.priority || 'medium',
      source: product.source || 'flip',
      tenantId: options.tenantId || 'default',
    };

    const job = await addScrapingJob(jobData, {
      delay: options.delay,
      jobId: `scraping-${productId}-${Date.now()}`,
    });

    // Track queue usage
    await redis.incr(`queue:usage:${options.tenantId || 'default'}`);
    await redis.incr(`queue:usage:${options.userTier || 'free'}`);

    return { success: true, jobId: job.id };

  } catch (error: any) {
    console.error('Error queueing product scraping:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Queue multiple products for scraping in bulk
 */
export async function queueBulkProductScraping(
  products: Array<{ productId: string; url: string }>,
  options: QueueScrapingOptions
): Promise<{ success: boolean; jobIds?: string[]; error?: string; failedProducts?: string[] }> {
  try {
    await connectToDB();

    // Verify all products exist
    const productIds = products.map(p => p.productId);
    const existingProducts = await ProductModel.find({ 
      _id: { $in: productIds } 
    }).lean();

    const existingProductIds = existingProducts.map(p => p._id.toString());
    const failedProducts = products
      .filter(p => !existingProductIds.includes(p.productId))
      .map(p => p.productId);

    // Create jobs for existing products
    const validProducts = products.filter(p => existingProductIds.includes(p.productId));
    const jobs: ScrapingJobData[] = validProducts.map((product, index) => {
      const existingProduct = existingProducts.find(p => p._id.toString() === product.productId);
      return {
        productId: product.productId,
        url: product.url,
        userId: options.userId,
        userTier: options.userTier || 'free',
        priority: options.priority || 'medium',
        source: existingProduct?.source || 'flip',
        tenantId: options.tenantId || 'default',
      };
    });

    if (jobs.length === 0) {
      return { success: false, error: 'No valid products to scrape', failedProducts };
    }

    const addedJobs = await addBulkScrapingJobs(jobs);

    // Track bulk queue usage
    await redis.incr(`queue:bulk_usage:${options.tenantId || 'default'}`);
    await redis.incrby(`queue:usage:${options.userTier || 'free'}`, addedJobs.length);

    return { 
      success: true, 
      jobIds: addedJobs.map(job => job.id || ''),
      failedProducts: failedProducts.length > 0 ? failedProducts : undefined
    };

  } catch (error: any) {
    console.error('Error queueing bulk product scraping:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Queue all products for a specific tenant
 */
export async function queueTenantProductScraping(
  tenantId: string,
  options: Omit<QueueScrapingOptions, 'tenantId'>
): Promise<{ success: boolean; queuedCount?: number; error?: string }> {
  try {
    await connectToDB();

    // Get all active products for the tenant
    const products = await ProductModel.find({
      tenantId,
      isActive: true,
      trackingStatus: 'active',
      deletedAt: { $exists: false }
    }).lean();

    if (products.length === 0) {
      return { success: false, error: 'No active products found for tenant' };
    }

    const jobs: ScrapingJobData[] = products.map(product => ({
      productId: product._id.toString(),
      url: product.url,
      userId: options.userId,
      userTier: options.userTier || 'free',
      priority: options.priority || 'medium',
      source: product.source || 'flip',
      tenantId,
    }));

    const addedJobs = await addBulkScrapingJobs(jobs);

    // Track tenant-wide queue usage
    await redis.incr(`queue:tenant_scraping:${tenantId}`);
    await redis.incrby(`queue:usage:${tenantId}`, addedJobs.length);

    return { success: true, queuedCount: addedJobs.length };

  } catch (error: any) {
    console.error('Error queueing tenant product scraping:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Queue products that are due for scraping based on their nextScrapeAt time
 */
export async function queueDueProductScraping(
  options: QueueScrapingOptions
): Promise<{ success: boolean; queuedCount?: number; error?: string }> {
  try {
    await connectToDB();

    // Get products that are due for scraping
    const dueProducts = await ProductModel.find({
      nextScrapeAt: { $lte: new Date() },
      trackingStatus: 'active',
      isActive: true,
      deletedAt: { $exists: false }
    }).lean();

    if (dueProducts.length === 0) {
      return { success: true, queuedCount: 0 };
    }

    const jobs: ScrapingJobData[] = dueProducts.map(product => ({
      productId: product._id.toString(),
      url: product.url,
      userId: options.userId,
      userTier: options.userTier || 'free',
      priority: options.priority || 'medium',
      source: product.source || 'flip',
      tenantId: options.tenantId || product.tenantId || 'default',
    }));

    const addedJobs = await addBulkScrapingJobs(jobs);

    // Track scheduled scraping
    await redis.incr('queue:scheduled_scraping');
    await redis.incrby('queue:scheduled_jobs', addedJobs.length);

    return { success: true, queuedCount: addedJobs.length };

  } catch (error: any) {
    console.error('Error queueing due product scraping:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get queue statistics for a specific tenant or user
 */
export async function getQueueStatistics(
  tenantId?: string,
  userTier?: string
): Promise<{
  success: boolean;
  stats?: {
    totalJobs: number;
    successfulJobs: number;
    failedJobs: number;
    bulkUsage: number;
    tenantUsage?: number;
    tierUsage?: number;
  };
  error?: string;
}> {
  try {
    const keys = [
      'queue:usage:total',
      'queue:successful:total',
      'queue:failed:total',
      'queue:bulk_usage:total',
    ];

    if (tenantId) {
      keys.push(`queue:usage:${tenantId}`);
    }
    if (userTier) {
      keys.push(`queue:usage:${userTier}`);
    }

    const results = await redis.mget(...keys);
    
    const stats = {
      totalJobs: parseInt(results[0] as string) || 0,
      successfulJobs: parseInt(results[1] as string) || 0,
      failedJobs: parseInt(results[2] as string) || 0,
      bulkUsage: parseInt(results[3] as string) || 0,
      tenantUsage: tenantId ? parseInt(results[4] as string) || 0 : undefined,
      tierUsage: userTier ? parseInt(results[keys.length - 1] as string) || 0 : undefined,
    };

    return { success: true, stats };

  } catch (error: any) {
    console.error('Error getting queue statistics:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Initialize workers when the application starts
 */
export async function initializeQueueWorkers(): Promise<{ success: boolean; error?: string }> {
  try {
    const { initializeAllWorkers } = await import('./worker');
    await initializeAllWorkers();
    
    console.log('✅ Queue workers initialized successfully');
    return { success: true };
    
  } catch (error: any) {
    console.error('❌ Failed to initialize queue workers:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Gracefully shutdown workers when the application stops
 */
export async function shutdownQueueWorkers(): Promise<{ success: boolean; error?: string }> {
  try {
    const { shutdownAllWorkers } = await import('./worker');
    await shutdownAllWorkers();
    
    console.log('✅ Queue workers shut down successfully');
    return { success: true };
    
  } catch (error: any) {
    console.error('❌ Failed to shutdown queue workers:', error);
    return { success: false, error: error.message };
  }
}