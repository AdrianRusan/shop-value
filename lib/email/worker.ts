import { Worker, Job } from 'bullmq';
import { emailQueue, redisConnection } from '@/lib/scraper/queue';
import { emailService, type EmailJobData } from '@/lib/resend';
import * as Sentry from '@sentry/nextjs';

// Email worker to process queued emails
export const emailWorker = new Worker(
  'email-notifications',
  async (job: Job<EmailJobData>) => {
    console.log(`Processing email job: ${job.id}, type: ${job.data.type}`);
    
    try {
      const { type, to, data, userId } = job.data;
      
      // Send the templated email
      const result = await emailService.sendTemplatedEmail(type, to, data, {
        userId,
        bypassLimits: false, // Respect limits for queued emails
      });

      if (!result.success) {
        if ('limitReached' in result && result.limitReached) {
          // Don't retry if limit is reached
          console.log(`Email limit reached for user ${userId}, skipping job ${job.id}`);
          return { skipped: true, reason: 'Email limit reached' };
        }
        
        // Throw error to trigger retry
        throw new Error(result.error || 'Failed to send email');
      }

      console.log(`Email job ${job.id} completed successfully`);
      return { 
        success: true, 
        emailId: 'data' in result ? result.data?.id : undefined,
        sentAt: new Date().toISOString()
      };

    } catch (error) {
      console.error(`Email job ${job.id} failed:`, error);
      Sentry.captureException(error, {
        tags: {
          jobId: job.id,
          emailType: job.data.type,
          userId: job.data.userId,
        },
        extra: {
          jobData: job.data,
        },
      });
      
      throw error; // Re-throw to trigger retry mechanism
    }
  },
  {
    connection: redisConnection,
    concurrency: 5, // Process up to 5 emails concurrently
  }
);

// Event handlers for monitoring
emailWorker.on('completed', (job, result) => {
  console.log(`Email job ${job.id} completed:`, result);
});

emailWorker.on('failed', (job, err) => {
  console.error(`Email job ${job?.id} failed:`, err);
  
  // Send to Sentry for critical failures
  Sentry.captureException(err, {
    tags: {
      jobId: job?.id,
      emailType: job?.data?.type,
      attemptsMade: job?.attemptsMade,
    },
  });
});

emailWorker.on('stalled', (jobId) => {
  console.warn(`Email job ${jobId} stalled`);
});

emailWorker.on('error', (err) => {
  console.error('Email worker error:', err);
  Sentry.captureException(err);
});

// Graceful shutdown
export const shutdownEmailWorker = async (): Promise<void> => {
  try {
    await emailWorker.close();
    console.log('Email worker shut down gracefully');
  } catch (error) {
    console.error('Error shutting down email worker:', error);
  }
};

// Helper function to add email notifications for price alerts
export const scheduleEmailNotifications = async (): Promise<void> => {
  try {
    // This would be called by the scraping system when price changes are detected
    console.log('Email notification scheduling system ready');
  } catch (error) {
    console.error('Error in email notification scheduling:', error);
    Sentry.captureException(error);
  }
};

export default emailWorker;