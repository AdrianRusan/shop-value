// Email Templates Export
export { BaseLayout } from './base-layout';
export { WelcomeEmail } from './welcome-email';
export { PriceAlertEmail } from './price-alert-email';
export { SubscriptionConfirmationEmail } from './subscription-confirmation-email';
export { PaymentFailedEmail } from './payment-failed-email';

// Type definitions for email templates
export interface EmailProduct {
  id: string;
  title: string;
  brand: string;
  currentPrice: number;
  originalPrice: number;
  targetPrice?: number;
  url: string;
  image?: string;
  availability?: string;
}

export interface EmailSubscription {
  plan: 'pro' | 'enterprise';
  billingCycle: 'monthly' | 'yearly';
  amount: number;
  currency: string;
  startDate: string;
  nextBillingDate: string;
  invoiceUrl?: string;
}

export type EmailType = 
  | 'welcome'
  | 'price_alert'
  | 'subscription_confirmation'
  | 'payment_failed'
  | 'subscription_canceled'
  | 'trial_reminder'
  | 'weekly_report';

export type AlertType = 
  | 'target_reached' 
  | 'significant_drop' 
  | 'lowest_price' 
  | 'back_in_stock';

// Template props interfaces
export interface WelcomeEmailProps {
  firstName?: string;
  email: string;
  loginUrl?: string;
  dashboardUrl?: string;
}

export interface PriceAlertEmailProps {
  firstName?: string;
  email: string;
  product: EmailProduct;
  alertType: AlertType;
  discountPercentage?: number;
}

export interface SubscriptionConfirmationEmailProps {
  firstName?: string;
  email: string;
  subscription: EmailSubscription;
  features: string[];
  dashboardUrl?: string;
  invoiceUrl?: string;
}

export interface PaymentFailedEmailProps {
  firstName?: string;
  email: string;
  subscription: {
    plan: 'pro' | 'enterprise';
    amount: number;
    currency: string;
    nextAttempt?: string;
    retryUrl?: string;
  };
  failureReason?: string;
  retryUrl?: string;
}