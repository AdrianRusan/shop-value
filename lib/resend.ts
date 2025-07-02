import { Resend } from 'resend';
import { render } from '@react-email/render';
import * as Sentry from '@sentry/nextjs';
import { 
  WelcomeEmail, 
  PriceAlertEmail, 
  SubscriptionConfirmationEmail, 
  PaymentFailedEmail,
  type EmailType,
  type WelcomeEmailProps,
  type PriceAlertEmailProps,
  type SubscriptionConfirmationEmailProps,
  type PaymentFailedEmailProps
} from '@/emails/templates';
import { emailQueue } from '@/lib/scraper/queue';
import { checkEmailLimit } from '@/lib/subscription-utils';

if (!process.env.RESEND_API_KEY) {
  throw new Error('RESEND_API_KEY is not set in environment variables');
}

export const resend = new Resend(process.env.RESEND_API_KEY);

// Email configuration
export const emailConfig = {
  from: process.env.FROM_EMAIL || 'ShopValue <noreply@shopvalue.com>',
  replyTo: 'support@shopvalue.com',
  
  // Email templates
  templates: {
    welcome: 'welcome-email',
    priceAlert: 'price-alert-email',
    subscriptionConfirmation: 'subscription-confirmation-email',
    paymentFailed: 'payment-failed-email',
    subscriptionCanceled: 'subscription-canceled-email',
    weeklyReport: 'weekly-report-email',
    trialReminder: 'trial-reminder-email',
  },
} as const;

// Email queue priority levels
export const emailPriority = {
  high: 1,      // Payment failures, security alerts
  normal: 5,    // Price alerts, confirmations
  low: 10,      // Marketing, reports
} as const;

// Type for email job data
export interface EmailJobData {
  type: EmailType;
  to: string | string[];
  userId?: string;
  data: any;
  priority?: keyof typeof emailPriority;
  scheduledFor?: Date;
  retryCount?: number;
}

// Enhanced email service with React Email templates
export class EmailService {
  /**
   * Render email template to HTML
   */
  private async renderTemplate(type: EmailType, data: any): Promise<{ subject: string; html: string }> {
    try {
      let emailComponent;
      let subject = '';

      switch (type) {
        case 'welcome':
          emailComponent = WelcomeEmail(data as WelcomeEmailProps);
          subject = 'Bun venit la ShopValue!';
          break;

        case 'price_alert':
          emailComponent = PriceAlertEmail(data as PriceAlertEmailProps);
          const alertData = data as PriceAlertEmailProps;
          switch (alertData.alertType) {
            case 'target_reached':
              subject = `🎯 Prețul țintă atins pentru ${alertData.product.title}`;
              break;
            case 'significant_drop':
              subject = `📉 Reducere mare la ${alertData.product.title}`;
              break;
            case 'lowest_price':
              subject = `💰 Cel mai mic preț la ${alertData.product.title}`;
              break;
            case 'back_in_stock':
              subject = `📦 ${alertData.product.title} este din nou în stoc`;
              break;
            default:
              subject = `🔔 Alertă de preț pentru ${alertData.product.title}`;
          }
          break;

        case 'subscription_confirmation':
          emailComponent = SubscriptionConfirmationEmail(data as SubscriptionConfirmationEmailProps);
          const subData = data as SubscriptionConfirmationEmailProps;
          subject = `Abonament ${subData.subscription.plan === 'pro' ? 'Pro' : 'Enterprise'} confirmat!`;
          break;

        case 'payment_failed':
          emailComponent = PaymentFailedEmail(data as PaymentFailedEmailProps);
          subject = '⚠️ Problemă cu plata abonamentului ShopValue';
          break;

        default:
          throw new Error(`Unknown email template type: ${type}`);
      }

      const html = await render(emailComponent);
      return { subject, html };
    } catch (error) {
      console.error(`Error rendering email template ${type}:`, error);
      Sentry.captureException(error);
      throw error;
    }
  }

  /**
   * Send email directly (bypass queue)
   */
  async sendEmail(
    to: string | string[],
    subject: string,
    html: string,
    options?: {
      replyTo?: string;
      attachments?: Array<{
        filename: string;
        content: string | Buffer;
        contentType?: string;
      }>;
    }
  ) {
    try {
      const result = await resend.emails.send({
        from: emailConfig.from,
        to,
        subject,
        html,
        replyTo: options?.replyTo || emailConfig.replyTo,
        attachments: options?.attachments,
      });

      console.log(`Email sent successfully: ${result.data?.id}`);
      return { success: true, data: result.data };
    } catch (error) {
      console.error('Email sending failed:', error);
      Sentry.captureException(error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * Send templated email with user limit checking
   */
  async sendTemplatedEmail(
    type: EmailType,
    to: string | string[],
    data: any,
    options?: {
      userId?: string;
      priority?: keyof typeof emailPriority;
      bypassLimits?: boolean;
    }
  ) {
    try {
      // Check email limits for user
      if (options?.userId && !options?.bypassLimits) {
        const limitCheck = await checkEmailLimit(options.userId);
        if (!limitCheck.allowed) {
          console.log(`Email limit reached for user ${options.userId}: ${limitCheck.reason}`);
          return { 
            success: false, 
            error: limitCheck.reason,
            limitReached: true 
          };
        }
      }

      // Render template
      const { subject, html } = await this.renderTemplate(type, data);

      // Send email
      const result = await this.sendEmail(to, subject, html);

      // Increment email count if successful and user is specified
      if (result.success && options?.userId && !options?.bypassLimits) {
        try {
          await this.incrementEmailCount(options.userId);
        } catch (error) {
          console.error('Failed to increment email count:', error);
          // Don't fail the email send for this
        }
      }

      return result;
    } catch (error) {
      console.error(`Error sending templated email ${type}:`, error);
      Sentry.captureException(error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * Queue email for background processing
   */
  async queueEmail(jobData: EmailJobData): Promise<{ success: boolean; jobId?: string; error?: string }> {
    try {
      const priority = emailPriority[jobData.priority || 'normal'];
      
      const job = await emailQueue.add(
        'send-email',
        {
          ...jobData,
          timestamp: new Date().toISOString(),
        },
        {
          priority,
          delay: jobData.scheduledFor ? jobData.scheduledFor.getTime() - Date.now() : 0,
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 5000,
          },
          removeOnComplete: 50,
          removeOnFail: 25,
        }
      );

      console.log(`Email queued successfully: ${job.id}`);
      return { success: true, jobId: job.id as string };
    } catch (error) {
      console.error('Failed to queue email:', error);
      Sentry.captureException(error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * Increment email count for user
   */
  private async incrementEmailCount(userId: string): Promise<void> {
    try {
      const { incrementUsage } = await import('@/lib/subscription-utils');
      await incrementUsage(userId, 'emails');
    } catch (error) {
      console.error('Error incrementing email count:', error);
      throw error;
    }
  }

  /**
   * Send welcome email
   */
  async sendWelcomeEmail(emailProps: WelcomeEmailProps, options?: { userId?: string }) {
    return this.sendTemplatedEmail('welcome', emailProps.email, emailProps, {
      ...options,
      priority: 'normal',
      bypassLimits: true, // Welcome emails don't count against limits
    });
  }

  /**
   * Send price alert email
   */
  async sendPriceAlertEmail(emailProps: PriceAlertEmailProps, options?: { userId?: string }) {
    return this.sendTemplatedEmail('price_alert', emailProps.email, emailProps, {
      ...options,
      priority: 'high',
    });
  }

  /**
   * Send subscription confirmation email
   */
  async sendSubscriptionConfirmationEmail(emailProps: SubscriptionConfirmationEmailProps, options?: { userId?: string }) {
    return this.sendTemplatedEmail('subscription_confirmation', emailProps.email, emailProps, {
      ...options,
      priority: 'high',
      bypassLimits: true, // Subscription emails don't count against limits
    });
  }

  /**
   * Send payment failed email
   */
  async sendPaymentFailedEmail(emailProps: PaymentFailedEmailProps, options?: { userId?: string }) {
    return this.sendTemplatedEmail('payment_failed', emailProps.email, emailProps, {
      ...options,
      priority: 'high',
      bypassLimits: true, // Payment failure emails don't count against limits
    });
  }

  /**
   * Queue price alert email
   */
  async queuePriceAlertEmail(emailProps: PriceAlertEmailProps, options?: { userId?: string; scheduledFor?: Date }) {
    return this.queueEmail({
      type: 'price_alert',
      to: emailProps.email,
      userId: options?.userId,
      data: emailProps,
      priority: 'high',
      scheduledFor: options?.scheduledFor,
    });
  }
}

// Create singleton instance
export const emailService = new EmailService();

// Legacy function for backward compatibility
export const sendEmail = emailService.sendEmail.bind(emailService);