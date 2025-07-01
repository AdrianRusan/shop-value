import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import Stripe from 'stripe';
import * as Sentry from '@sentry/nextjs';
import { stripe, SUBSCRIPTION_PLANS } from '@/lib/stripe';
import { redis } from '@/lib/upstash';
import User from '@/lib/models/user.model';

// Type definitions for webhook events
interface StripeEventData {
  object: Stripe.Subscription | Stripe.Invoice | Stripe.Customer | any;
}

interface StripeEvent {
  id: string;
  type: string;
  data: StripeEventData;
}

export async function POST(request: NextRequest) {
  const body = await request.text();
  const headersList = await headers();
  const signature = headersList.get('stripe-signature');

  if (!signature) {
    console.error('Missing Stripe signature');
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 });
  }

  let event: StripeEvent;

  try {
    // Verify webhook signature
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    ) as StripeEvent;
  } catch (error) {
    console.error('Webhook signature verification failed:', error);
    Sentry.captureException(error, {
      tags: { section: 'stripe_webhook', action: 'signature_verification' }
    });
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  try {
    // Handle different webhook events
    switch (event.type) {
      case 'customer.subscription.created':
        await handleSubscriptionCreated(event.data.object as Stripe.Subscription);
        break;
        
      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
        break;
        
      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;
        
      case 'invoice.payment_succeeded':
        await handlePaymentSucceeded(event.data.object as Stripe.Invoice);
        break;
        
      case 'invoice.payment_failed':
        await handlePaymentFailed(event.data.object as Stripe.Invoice);
        break;
        
      case 'customer.subscription.trial_will_end':
        await handleTrialWillEnd(event.data.object as Stripe.Subscription);
        break;
        
      case 'checkout.session.completed':
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;

      case 'customer.created':
        await handleCustomerCreated(event.data.object as Stripe.Customer);
        break;

      default:
        console.log(`Unhandled webhook event type: ${event.type}`);
    }

    // Track webhook processing
    await redis.incr(`metrics:webhooks:${event.type}`);
    await redis.incr('metrics:webhooks:total');

    return NextResponse.json({ received: true });

  } catch (error) {
    console.error(`Error handling webhook ${event.type}:`, error);
    Sentry.captureException(error, {
      tags: {
        section: 'stripe_webhook',
        action: 'event_processing',
        event_type: event.type
      },
      extra: {
        event_id: event.id,
        event_type: event.type
      }
    });

    // Return success to avoid Stripe retries for application errors
    // Log the error but don't fail the webhook
    return NextResponse.json({ received: true, error: 'Processing error logged' });
  }
}

// Subscription created handler
async function handleSubscriptionCreated(subscription: Stripe.Subscription) {
  const userId = subscription.metadata.userId;
  const planId = subscription.metadata.planId as keyof typeof SUBSCRIPTION_PLANS;
  const billing = subscription.metadata.billing;

  if (!userId || !planId) {
    throw new Error('Missing metadata in subscription created event');
  }

  console.log(`Processing subscription created for user ${userId}: ${planId} (${billing})`);

  // Update user subscription in database
  await User.findOneAndUpdate(
    { clerkId: userId },
    {
      'subscription.plan': planId,
      'subscription.status': subscription.status,
      'subscription.stripeSubscriptionId': subscription.id,
      'subscription.stripeCustomerId': subscription.customer as string,
      'subscription.currentPeriodStart': new Date(subscription.current_period_start * 1000),
      'subscription.currentPeriodEnd': new Date(subscription.current_period_end * 1000),
      'subscription.cancelAtPeriodEnd': subscription.cancel_at_period_end,
      'subscription.trialStart': subscription.trial_start ? new Date(subscription.trial_start * 1000) : undefined,
      'subscription.trialEnd': subscription.trial_end ? new Date(subscription.trial_end * 1000) : undefined,
      updatedAt: new Date()
    }
  );

  // Update usage limits based on new plan
  const planLimits = {
    free: { maxProducts: 5, maxApiCalls: 0, maxEmails: 10 },
    pro: { maxProducts: 50, maxApiCalls: 1000, maxEmails: 100 },
    enterprise: { maxProducts: -1, maxApiCalls: 10000, maxEmails: 1000 }
  };

  const limits = planLimits[planId];
  if (limits) {
    await User.findOneAndUpdate(
      { clerkId: userId },
      {
        'usage.maxProducts': limits.maxProducts,
        'usage.maxApiCalls': limits.maxApiCalls,
        'usage.maxEmails': limits.maxEmails
      }
    );
  }

  // Track business metrics
  await trackSubscriptionMetrics('created', subscription, planId, billing);
  
  console.log(`✅ Subscription created successfully for user ${userId}`);
}

// Subscription updated handler
async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  const userId = subscription.metadata.userId;
  const planId = subscription.metadata.planId as keyof typeof SUBSCRIPTION_PLANS;

  if (!userId) {
    console.error('No userId in subscription updated metadata');
    return;
  }

  console.log(`Processing subscription updated for user ${userId}: ${subscription.status}`);

  // Update user subscription status
  await User.findOneAndUpdate(
    { clerkId: userId },
    {
      'subscription.status': subscription.status,
      'subscription.currentPeriodStart': new Date(subscription.current_period_start * 1000),
      'subscription.currentPeriodEnd': new Date(subscription.current_period_end * 1000),
      'subscription.cancelAtPeriodEnd': subscription.cancel_at_period_end,
      'subscription.canceledAt': subscription.canceled_at ? new Date(subscription.canceled_at * 1000) : undefined,
      updatedAt: new Date()
    }
  );

  // Track metrics for status changes
  await redis.incr(`metrics:subscription_status:${subscription.status}`);
  
  console.log(`✅ Subscription updated for user ${userId}: ${subscription.status}`);
}

// Subscription deleted/canceled handler
async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const userId = subscription.metadata.userId;

  if (!userId) {
    console.error('No userId in subscription deleted metadata');
    return;
  }

  console.log(`Processing subscription canceled for user ${userId}`);

  // Update user to free plan
  await User.findOneAndUpdate(
    { clerkId: userId },
    {
      'subscription.plan': 'free',
      'subscription.status': 'canceled',
      'subscription.endedAt': new Date(),
      'subscription.canceledAt': new Date(),
      // Reset to free plan limits
      'usage.maxProducts': 5,
      'usage.maxApiCalls': 0,
      'usage.maxEmails': 10,
      updatedAt: new Date()
    }
  );

  // Track churn metrics
  await redis.incr('metrics:churn:total');
  await redis.incr(`metrics:churn:${new Date().getFullYear()}-${new Date().getMonth() + 1}`);
  
  console.log(`✅ Subscription canceled for user ${userId}, reverted to free plan`);
}

// Payment succeeded handler
async function handlePaymentSucceeded(invoice: Stripe.Invoice) {
  const subscription = await stripe.subscriptions.retrieve(invoice.subscription as string);
  const userId = subscription.metadata.userId;

  if (!userId) {
    console.error('No userId in payment succeeded metadata');
    return;
  }

  console.log(`Processing successful payment for user ${userId}: ${invoice.amount_paid / 100} ${invoice.currency}`);

  // Clear any payment issues
  await User.findOneAndUpdate(
    { clerkId: userId },
    {
      'subscription.status': 'active',
      $unset: { 'paymentIssue': 1 }
    }
  );

  // Track revenue metrics
  await redis.incrby('metrics:revenue:total', invoice.amount_paid);
  await redis.incrby(`metrics:revenue:${new Date().getFullYear()}-${new Date().getMonth() + 1}`, invoice.amount_paid);
  
  console.log(`✅ Payment processed for user ${userId}`);
}

// Payment failed handler
async function handlePaymentFailed(invoice: Stripe.Invoice) {
  const subscription = await stripe.subscriptions.retrieve(invoice.subscription as string);
  const userId = subscription.metadata.userId;

  if (!userId) {
    console.error('No userId in payment failed metadata');
    return;
  }

  console.log(`Processing failed payment for user ${userId}: attempt ${invoice.attempt_count}`);

  // Update user status and track payment issue
  await User.findOneAndUpdate(
    { clerkId: userId },
    {
      'subscription.status': 'past_due',
      'paymentIssue.hasIssue': true,
      'paymentIssue.lastFailedAt': new Date(),
      'paymentIssue.attemptCount': invoice.attempt_count,
      updatedAt: new Date()
    }
  );

  // Track failed payment metrics
  await redis.incr('metrics:payments:failed');
  
  console.log(`⚠️ Payment failed for user ${userId}, marked as past_due`);
}

// Trial ending soon handler
async function handleTrialWillEnd(subscription: Stripe.Subscription) {
  const userId = subscription.metadata.userId;

  if (!userId) {
    console.error('No userId in trial ending metadata');
    return;
  }

  console.log(`Processing trial ending for user ${userId}`);

  // Track trial ending metric
  await redis.incr('metrics:trials:ending');
  
  console.log(`⏰ Trial ending processed for user ${userId}`);
}

// Checkout completed handler
async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const userId = session.metadata?.userId;

  if (!userId) {
    console.error('No userId in checkout session metadata');
    return;
  }

  console.log(`Processing checkout completed for user ${userId}`);

  // Track conversion metrics
  await redis.incr('metrics:conversions:total');
  
  console.log(`✅ Checkout completed for user ${userId}`);
}

// Customer created handler
async function handleCustomerCreated(customer: Stripe.Customer) {
  const clerkId = customer.metadata?.clerkId;

  if (!clerkId) {
    console.log('Customer created without clerkId metadata');
    return;
  }

  console.log(`Processing customer created for user ${clerkId}`);

  // Update user with Stripe customer ID if not already set
  await User.findOneAndUpdate(
    { clerkId },
    { 'subscription.stripeCustomerId': customer.id },
    { new: true }
  );
  
  console.log(`✅ Customer created and linked for user ${clerkId}`);
}

// Helper function to track subscription metrics
async function trackSubscriptionMetrics(
  action: 'created' | 'updated' | 'canceled',
  subscription: Stripe.Subscription,
  planId?: keyof typeof SUBSCRIPTION_PLANS,
  billing?: string
) {
  const monthlyAmount = billing === 'yearly' 
    ? (subscription.items.data[0]?.price.unit_amount || 0) / 12 
    : (subscription.items.data[0]?.price.unit_amount || 0);

  if (action === 'created') {
    await redis.incrby('metrics:mrr:current', monthlyAmount);
    await redis.incr('metrics:subscriptions:active');
    if (planId) {
      await redis.incr(`metrics:plan:${planId}`);
    }
  } else if (action === 'canceled') {
    await redis.decrby('metrics:mrr:current', monthlyAmount);
    await redis.decr('metrics:subscriptions:active');
  }
}

// Handle unsupported methods
export async function GET() {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
}

export async function PUT() {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
}

export async function DELETE() {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
}