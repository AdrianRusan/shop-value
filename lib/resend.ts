import { Resend } from 'resend';

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
    welcome: 'welcome-template',
    priceAlert: 'price-alert-template',
    subscriptionConfirmation: 'subscription-confirmation-template',
    paymentFailed: 'payment-failed-template',
    subscriptionCanceled: 'subscription-canceled-template',
    weeklyReport: 'weekly-report-template',
    trialReminder: 'trial-reminder-template',
  },
} as const;

// Email queue priority levels
export const emailPriority = {
  high: 1,      // Payment failures, security alerts
  normal: 5,    // Price alerts, confirmations
  low: 10,      // Marketing, reports
} as const;

// Email sending helper with error handling
export const sendEmail = async (
  to: string | string[],
  subject: string,
  html: string,
  options?: {
    priority?: keyof typeof emailPriority;
    replyTo?: string;
    attachments?: Array<{
      filename: string;
      content: string | Buffer;
      contentType?: string;
    }>;
  }
) => {
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
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
};