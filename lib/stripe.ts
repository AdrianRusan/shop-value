import Stripe from 'stripe';

declare global {
  namespace NodeJS {
    interface ProcessEnv {
      STRIPE_SECRET_KEY: string;
      STRIPE_PRO_MONTHLY_PRICE_ID?: string;
      STRIPE_PRO_YEARLY_PRICE_ID?: string;
      STRIPE_ENTERPRISE_MONTHLY_PRICE_ID?: string;
      STRIPE_ENTERPRISE_YEARLY_PRICE_ID?: string;
      STRIPE_WEBHOOK_SECRET?: string;
      NEXT_PUBLIC_APP_URL?: string;
    }
  }
}

// Initialize Stripe
let stripe: Stripe;

try {
  const stripeSecretKey = (globalThis as any)?.process?.env?.STRIPE_SECRET_KEY || '';
  if (stripeSecretKey) {
    stripe = new Stripe(stripeSecretKey, {
      apiVersion: '2024-06-20',
      typescript: true,
    });
  } else {
    // Fallback for build time
    stripe = {} as Stripe;
  }
} catch (error) {
  // Fallback for build time when environment isn't available
  stripe = {} as Stripe;
}

export { stripe };

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

// Helper function to get price ID based on plan and billing cycle
export const getPriceId = (plan: SubscriptionPlan, billing: BillingCycle): string | null => {
  if (plan === 'free') return null;
  
  const planConfig = SUBSCRIPTION_PLANS[plan];
  const priceId = billing === 'monthly' ? planConfig.priceIdMonthly : planConfig.priceIdYearly;
  return priceId || null;
};

// Helper function to create or retrieve Stripe customer
export const createOrRetrieveCustomer = async (
  clerkId: string,
  email: string,
  firstName?: string,
  lastName?: string,
  existingCustomerId?: string
): Promise<Stripe.Customer> => {
  const stripeKey = (globalThis as any)?.process?.env?.STRIPE_SECRET_KEY;
  if (!stripeKey) {
    throw new Error('Stripe is not configured');
  }

  try {
    if (existingCustomerId) {
      // Retrieve existing customer
      const customer = await stripe.customers.retrieve(existingCustomerId);
      if (customer.deleted) {
        throw new Error('Customer was deleted');
      }
      return customer as Stripe.Customer;
    }

    // Create new customer
    const customer = await stripe.customers.create({
      email,
      name: firstName && lastName ? `${firstName} ${lastName}` : email,
      metadata: {
        clerkId,
        source: 'shopvalue_app'
      }
    });

    return customer;
  } catch (error) {
    console.error('Error creating/retrieving Stripe customer:', error);
    throw error;
  }
};

// Helper function to create checkout session
export const createCheckoutSession = async (
  customerId: string,
  priceId: string,
  plan: SubscriptionPlan,
  billing: BillingCycle,
  userId: string
): Promise<Stripe.Checkout.Session> => {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error('Stripe is not configured');
  }

  try {
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/dashboard?session_id={CHECKOUT_SESSION_ID}&success=true`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/pricing?canceled=true`,
      metadata: {
        userId,
        planId: plan,
        billing
      },
      subscription_data: {
        metadata: {
          userId,
          planId: plan,
          billing
        }
      },
      customer_update: {
        address: 'auto',
        name: 'auto'
      },
      tax_id_collection: {
        enabled: true // Important for EU VAT compliance
      },
      automatic_tax: {
        enabled: true
      },
      billing_address_collection: 'required',
      allow_promotion_codes: true,
    });

    return session;
  } catch (error) {
    console.error('Error creating checkout session:', error);
    throw error;
  }
};

// Helper function to create customer portal session
export const createCustomerPortalSession = async (
  customerId: string,
  returnUrl?: string
): Promise<Stripe.BillingPortal.Session> => {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error('Stripe is not configured');
  }

  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl || `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/dashboard`,
    });

    return session;
  } catch (error) {
    console.error('Error creating customer portal session:', error);
    throw error;
  }
};

// Helper function to cancel subscription at period end
export const cancelSubscriptionAtPeriodEnd = async (
  subscriptionId: string
): Promise<Stripe.Subscription> => {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error('Stripe is not configured');
  }

  try {
    const subscription = await stripe.subscriptions.update(subscriptionId, {
      cancel_at_period_end: true,
    });

    return subscription;
  } catch (error) {
    console.error('Error canceling subscription:', error);
    throw error;
  }
};

// Helper function to reactivate canceled subscription
export const reactivateSubscription = async (
  subscriptionId: string
): Promise<Stripe.Subscription> => {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error('Stripe is not configured');
  }

  try {
    const subscription = await stripe.subscriptions.update(subscriptionId, {
      cancel_at_period_end: false,
    });

    return subscription;
  } catch (error) {
    console.error('Error reactivating subscription:', error);
    throw error;
  }
};