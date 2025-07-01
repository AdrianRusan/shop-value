import Stripe from 'stripe';

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('STRIPE_SECRET_KEY is not set in environment variables');
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2024-06-20',
  typescript: true,
});

// Subscription plans configuration as per PRD
export const SUBSCRIPTION_PLANS = {
  free: {
    name: 'Free',
    priceId: null,
    amount: 0,
    maxProducts: 5,
    checkFrequency: 24, // hours
    features: ['Basic price tracking', 'Daily notifications']
  },
  pro: {
    name: 'Pro',
    priceIdMonthly: process.env.STRIPE_PRO_MONTHLY_PRICE_ID,
    priceIdYearly: process.env.STRIPE_PRO_YEARLY_PRICE_ID,
    amountMonthly: 1999, // €19.99 in cents
    amountYearly: 19990, // €199.90 in cents (2 months free)
    maxProducts: 50,
    checkFrequency: 6, // hours (4x daily)
    features: ['50 products', 'Real-time alerts', 'Price history', '4x daily checks']
  },
  enterprise: {
    name: 'Enterprise',
    priceIdMonthly: process.env.STRIPE_ENTERPRISE_MONTHLY_PRICE_ID,
    priceIdYearly: process.env.STRIPE_ENTERPRISE_YEARLY_PRICE_ID,
    amountMonthly: 4999, // €49.99 in cents
    amountYearly: 49990, // €499.90 in cents
    maxProducts: Infinity,
    checkFrequency: 1, // hours (hourly checks)
    features: ['Unlimited products', 'API access', 'Priority support', 'Hourly checks']
  }
} as const;

export type SubscriptionPlan = keyof typeof SUBSCRIPTION_PLANS;
export type BillingCycle = 'monthly' | 'yearly';