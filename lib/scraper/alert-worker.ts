import { Worker, Job } from 'bullmq';
import { redisConnection } from './queue';
import PriceAlertService from '@/lib/services/price-alert.service';
import * as Sentry from '@sentry/nextjs';

// Job data interface for alert processing
export interface AlertJobData {
  type: 'check_product_alerts' | 'process_single_alert';
  productId?: string;
  alertId?: string;
  productData?: {
    productId: string;
    currentPrice: number;
    previousPrice: number;
    lowestPrice: number;
    isOutOfStock: boolean;
    wasOutOfStock: boolean;
    product: {
      id: string;
      title: string;
      brand: string;
      url: string;
      image?: string;
      availability?: string;
    };
  };
  trigger?: any; // AlertTrigger from service
}

// Alert worker - lazily initialized
let alertWorkerInstance: Worker | null = null;

function getAlertWorker(): Worker {
  if (!alertWorkerInstance) {
    alertWorkerInstance = new Worker(
      'price-alerts',
      async (job: Job<AlertJobData>) => {
        console.log(`Processing alert job: ${job.id}, type: ${job.data.type}`);
        
        try {
          switch (job.data.type) {
            case 'check_product_alerts':
              return await handleProductAlertsCheck(job);
            
            case 'process_single_alert':
              return await handleSingleAlert(job);
            
            default:
              throw new Error(`Unknown alert job type: ${job.data.type}`);
          }
        } catch (error) {
          console.error(`Alert job ${job.id} failed:`, error);
          
          // Track error in Sentry
          Sentry.captureException(error, {
            tags: {
              jobType: 'price-alert',
              jobId: job.id as string
            },
            extra: {
              jobData: job.data,
              timestamp: new Date().toISOString()
            }
          });
          
          throw error;
        }
      },
      {
        connection: redisConnection(),
        concurrency: 10, // Process up to 10 alerts concurrently
        maxStalledCount: 3,
        stalledInterval: 30000, // 30 seconds
      }
    );

    // Event handlers for monitoring
    alertWorkerInstance.on('completed', (job, result) => {
      console.log(`Alert job ${job.id} completed:`, result);
      
      // Track successful alert processing
      if (result?.triggered > 0) {
        console.log(`✅ ${result.triggered} alerts triggered for job ${job.id}`);
      }
    });

    alertWorkerInstance.on('failed', (job, err) => {
      console.error(`Alert job ${job?.id} failed:`, err);
      
      // Track failed alert processing
      Sentry.captureException(err, {
        tags: {
          jobType: 'price-alert-failed',
          jobId: job?.id as string
        },
        extra: {
          alertType: job?.data?.type,
          productId: job?.data?.productId,
          timestamp: new Date().toISOString()
        }
      });
    });

    alertWorkerInstance.on('stalled', (jobId) => {
      console.warn(`Alert job ${jobId} stalled`);
    });

    alertWorkerInstance.on('error', (err) => {
      console.error('Alert worker error:', err);
      Sentry.captureException(err);
    });

    console.log('Alert worker initialized successfully');
  }

  return alertWorkerInstance;
}

/**
 * Handle product alerts check job
 */
async function handleProductAlertsCheck(job: Job<AlertJobData>): Promise<{
  processed: number;
  triggered: number;
  errors: number;
}> {
  const { productData } = job.data;
  
  if (!productData) {
    throw new Error('Product data required for alerts check');
  }

  // Update job progress
  await job.updateProgress(10);

  try {
    const result = await PriceAlertService.processProductAlerts(productData);
    
    // Update progress to completion
    await job.updateProgress(100);
    
    return result;
  } catch (error) {
    console.error('Error processing product alerts:', error);
    throw error;
  }
}

/**
 * Handle single alert processing job
 */
async function handleSingleAlert(job: Job<AlertJobData>): Promise<{
  success: boolean;
  emailSent?: boolean;
  error?: string;
}> {
  const { trigger } = job.data;
  
  if (!trigger) {
    throw new Error('Alert trigger required for single alert processing');
  }

  // Update job progress
  await job.updateProgress(20);

  try {
    const result = await PriceAlertService.processPriceAlert(trigger);
    
    // Update progress to completion
    await job.updateProgress(100);
    
    return result;
  } catch (error) {
    console.error('Error processing single alert:', error);
    throw error;
  }
}

// Lazy getter for alert worker
export const alertWorker = {
  get instance() {
    return alertWorkerInstance;
  },
  
  get worker() {
    if (!alertWorkerInstance) {
      return getAlertWorker();
    }
    return alertWorkerInstance;
  }
};

// Helper function to add alert jobs
export const addAlertJob = async (
  jobData: AlertJobData,
  options?: {
    priority?: number;
    delay?: number;
    attempts?: number;
  }
): Promise<Job<AlertJobData>> => {
  try {
    // Lazy import the alert queue to avoid Redis connection during build
    const { alertQueue } = await import('./alert-queue');
    
    const job = await alertQueue.add(
      `alert-${jobData.type}`,
      jobData,
      {
        priority: options?.priority || 5,
        delay: options?.delay || 0,
        attempts: options?.attempts || 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        removeOnComplete: 50,
        removeOnFail: 25,
      }
    );

    console.log(`Alert job queued: ${job.id}`);
    return job;
  } catch (error) {
    console.error('Error adding alert job:', error);
    throw error;
  }
};

// Helper function to add alerts for scraped product
export const addProductAlertsJob = async (productData: {
  productId: string;
  currentPrice: number;
  previousPrice: number;
  lowestPrice: number;
  isOutOfStock: boolean;
  wasOutOfStock: boolean;
  product: {
    id: string;
    title: string;
    brand: string;
    url: string;
    image?: string;
    availability?: string;
  };
}): Promise<Job<AlertJobData> | null> => {
  try {
    // Only create job if price changed or stock status changed
    const hasChanges = productData.currentPrice !== productData.previousPrice ||
                      productData.isOutOfStock !== productData.wasOutOfStock;
    
    if (!hasChanges) {
      console.log(`No price/stock changes for product ${productData.productId}, skipping alerts`);
      return null;
    }

    return await addAlertJob({
      type: 'check_product_alerts',
      productId: productData.productId,
      productData
    }, {
      priority: 7, // Higher priority for time-sensitive alerts
      attempts: 2   // Fewer retries for alert processing
    });
  } catch (error) {
    console.error('Error adding product alerts job:', error);
    return null;
  }
};

// Graceful shutdown
export const shutdownAlertWorker = async (): Promise<void> => {
  try {
    if (alertWorkerInstance) {
      await alertWorkerInstance.close();
      alertWorkerInstance = null;
    }
    console.log('Alert worker shut down gracefully');
  } catch (error) {
    console.error('Error shutting down alert worker:', error);
  }
};

// Initialize worker when module is imported (lazy)
export const initializeAlertWorker = (): void => {
  try {
    getAlertWorker();
  } catch (error) {
    console.error('Failed to initialize alert worker:', error);
  }
};

export default alertWorker;