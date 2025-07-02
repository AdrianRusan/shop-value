import * as Sentry from '@sentry/nextjs';

/**
 * Integration layer between scraping system and price alert system
 * This file provides functions to trigger alerts after successful scraping
 */

export interface ScrapingResult {
  success: boolean;
  productId: string;
  url: string;
  currentPrice?: number;
  previousPrice?: number;
  lowestPrice?: number;
  isOutOfStock?: boolean;
  wasOutOfStock?: boolean;
  title?: string;
  brand?: string;
  image?: string;
  availability?: string;
  error?: string;
}

/**
 * Process alerts after a product has been scraped
 * This is called by the scraping worker after successful price scraping
 */
export async function processAlertsAfterScraping(
  scrapingResult: ScrapingResult
): Promise<{
  alertsProcessed: number;
  alertsTriggered: number;
  errors: number;
}> {
  const stats = { alertsProcessed: 0, alertsTriggered: 0, errors: 0 };

  try {
    // Skip if scraping failed
    if (!scrapingResult.success) {
      console.log(`Skipping alerts for failed scraping: ${scrapingResult.productId}`);
      return stats;
    }

    // Skip if no price data
    if (scrapingResult.currentPrice === undefined) {
      console.log(`No price data for product ${scrapingResult.productId}, skipping alerts`);
      return stats;
    }

    // Get product data for alerts
    const product = await getProductForAlerts(scrapingResult.productId);
    if (!product) {
      console.log(`Product not found for alerts: ${scrapingResult.productId}`);
      return stats;
    }

    // Determine if there are price or stock changes
    const hasChanges = 
      scrapingResult.currentPrice !== scrapingResult.previousPrice ||
      scrapingResult.isOutOfStock !== scrapingResult.wasOutOfStock;

    if (!hasChanges) {
      console.log(`No changes detected for product ${scrapingResult.productId}, skipping alerts`);
      return stats;
    }

    // Prepare product data for alert processing
    const productData = {
      productId: scrapingResult.productId,
      currentPrice: scrapingResult.currentPrice!,
      previousPrice: scrapingResult.previousPrice || scrapingResult.currentPrice!,
      lowestPrice: scrapingResult.lowestPrice || scrapingResult.currentPrice!,
      isOutOfStock: scrapingResult.isOutOfStock || false,
      wasOutOfStock: scrapingResult.wasOutOfStock || false,
      product: {
        id: scrapingResult.productId,
        title: scrapingResult.title || product.title || 'Unknown Product',
        brand: scrapingResult.brand || product.brand || 'Unknown Brand',
        url: scrapingResult.url || product.url,
        image: scrapingResult.image || product.image,
        availability: scrapingResult.availability || (scrapingResult.isOutOfStock ? 'out_of_stock' : 'in_stock'),
      }
    };

    // Add alert processing job to queue
    const job = await addProductAlertsJob(productData);
    
    if (job) {
      console.log(`✅ Alert processing job created for product ${scrapingResult.productId}: ${job.id}`);
      stats.alertsProcessed = 1; // Job created, actual processing will happen async
    } else {
      console.log(`No alert job created for product ${scrapingResult.productId}`);
    }

    return stats;

  } catch (error) {
    console.error('Error processing alerts after scraping:', error);
    Sentry.captureException(error);
    stats.errors = 1;
    return stats;
  }
}

/**
 * Integrate alerts into existing scraping worker
 * Call this function from the scraping worker after each successful scrape
 */
export async function handleScrapingComplete(scrapingJobResult: any): Promise<void> {
  try {
    if (!scrapingJobResult || !scrapingJobResult.productId) {
      console.log('Invalid scraping result, skipping alert processing');
      return;
    }

    // Convert scraping job result to our format
    const scrapingResult: ScrapingResult = {
      success: scrapingJobResult.success || false,
      productId: scrapingJobResult.productId,
      url: scrapingJobResult.url || '',
      currentPrice: scrapingJobResult.price,
      previousPrice: scrapingJobResult.previousPrice,
      lowestPrice: scrapingJobResult.lowestPrice,
      isOutOfStock: scrapingJobResult.isOutOfStock,
      wasOutOfStock: scrapingJobResult.wasOutOfStock,
      title: scrapingJobResult.title,
      brand: scrapingJobResult.brand,
      image: scrapingJobResult.image,
      availability: scrapingJobResult.availability,
      error: scrapingJobResult.error,
    };

    await processAlertsAfterScraping(scrapingResult);

  } catch (error) {
    console.error('Error handling scraping completion:', error);
    Sentry.captureException(error);
  }
}

/**
 * Batch process alerts for multiple scraped products
 * Useful for bulk scraping operations
 */
export async function batchProcessAlerts(
  scrapingResults: ScrapingResult[]
): Promise<{
  totalProcessed: number;
  totalTriggered: number;
  totalErrors: number;
}> {
  const batchStats = { totalProcessed: 0, totalTriggered: 0, totalErrors: 0 };

  for (const result of scrapingResults) {
    try {
      const stats = await processAlertsAfterScraping(result);
      batchStats.totalProcessed += stats.alertsProcessed;
      batchStats.totalTriggered += stats.alertsTriggered;
      batchStats.totalErrors += stats.errors;
    } catch (error) {
      console.error(`Error processing alerts for product ${result.productId}:`, error);
      batchStats.totalErrors++;
    }
  }

  console.log(`Batch alert processing complete: ${batchStats.totalTriggered}/${batchStats.totalProcessed} triggered, ${batchStats.totalErrors} errors`);
  return batchStats;
}

/**
 * Get product data needed for alert processing
 */
async function getProductForAlerts(productId: string): Promise<{
  title: string;
  brand: string;
  url: string;
  image?: string;
} | null> {
  try {
    const [mongoose, productModel] = await Promise.all([
      import('@/lib/mongoose').catch(() => null),
      import('@/lib/models/product.model').catch(() => null)
    ]);
    
    if (!mongoose || !productModel) {
      console.warn('Database modules not available for alert processing');
      return null;
    }
    
    await mongoose.connectToDB();
    
    const product = await productModel.default.findById(productId)
      .select('title brand url image')
      .lean();
    
    return product ? {
      title: (product as any).title,
      brand: (product as any).brand,
      url: (product as any).url,
      image: (product as any).image,
    } : null;
    
  } catch (error) {
    console.error('Error fetching product for alerts:', error);
    return null;
  }
}

/**
 * Add alert processing job to queue
 */
async function addProductAlertsJob(productData: any): Promise<any> {
  try {
    const { addProductAlertsJob } = await import('./alert-worker').catch(() => ({ addProductAlertsJob: null }));
    
    if (!addProductAlertsJob) {
      console.warn('Alert worker not available');
      return null;
    }
    
    return await addProductAlertsJob(productData);
  } catch (error) {
    console.error('Error adding alert job:', error);
    return null;
  }
}

/**
 * Hook into existing scraping system
 * Add this to your existing scraping worker after successful product updates
 */
export const integrateWithScrapingWorker = {
  /**
   * Call this after updating product price in database
   */
  onProductPriceUpdated: async (productId: string, priceUpdate: {
    newPrice: number;
    oldPrice: number;
    lowestPrice: number;
    isOutOfStock: boolean;
    wasOutOfStock: boolean;
  }) => {
    try {
      const product = await getProductForAlerts(productId);
      if (!product) return;

      const scrapingResult: ScrapingResult = {
        success: true,
        productId,
        url: product.url,
        currentPrice: priceUpdate.newPrice,
        previousPrice: priceUpdate.oldPrice,
        lowestPrice: priceUpdate.lowestPrice,
        isOutOfStock: priceUpdate.isOutOfStock,
        wasOutOfStock: priceUpdate.wasOutOfStock,
        title: product.title,
        brand: product.brand,
        image: product.image,
      };

      await processAlertsAfterScraping(scrapingResult);
    } catch (error) {
      console.error('Error in price update hook:', error);
    }
  },

  /**
   * Call this after scraping a product with the full result
   */
  onScrapingComplete: handleScrapingComplete,

  /**
   * Call this for batch operations
   */
  onBatchScrapingComplete: batchProcessAlerts,
};

export default integrateWithScrapingWorker;