import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { z } from 'zod';
import * as Sentry from '@sentry/nextjs';
import { Ratelimit } from '@upstash/ratelimit';
import { redis } from '@/lib/upstash';
import { 
  createOrRetrieveCustomer, 
  createCheckoutSession, 
  getPriceId,
  SUBSCRIPTION_PLANS 
} from '@/lib/stripe';
import User from '@/lib/models/user.model';
import { subscriptionCreateSchema } from '@/lib/validation';

// Rate limiting for checkout endpoint
const ratelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(5, '5 m'), // 5 requests per 5 minutes
});

export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const ip = request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip') ?? 'anonymous';
    const { success: rateLimitSuccess } = await ratelimit.limit(`checkout:${ip}`);
    
    if (!rateLimitSuccess) {
      return NextResponse.json(
        { success: false, error: 'Rate limit exceeded. Please try again later.' },
        { status: 429 }
      );
    }

    // Authentication check
    const { userId: clerkUserId } = await auth();
    if (!clerkUserId) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const validation = subscriptionCreateSchema.safeParse(body);
    
    if (!validation.success) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Invalid request data',
          details: validation.error.errors.map((err: z.ZodIssue) => `${err.path.join('.')}: ${err.message}`)
        },
        { status: 400 }
      );
    }

    const { planId, billing } = validation.data;

    // Get user from database
    const user = await User.findOne({ clerkId: clerkUserId });
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }

    // Check if user already has an active subscription
    if (user.subscription?.status === 'active' && user.subscription?.plan !== 'free') {
      return NextResponse.json(
        { success: false, error: 'User already has an active subscription' },
        { status: 400 }
      );
    }

    // Get price ID for the selected plan and billing cycle
    const priceId = getPriceId(planId, billing);
    if (!priceId) {
      return NextResponse.json(
        { success: false, error: 'Invalid subscription plan or billing cycle' },
        { status: 400 }
      );
    }

    // Create or retrieve Stripe customer
    const stripeCustomer = await createOrRetrieveCustomer(
      clerkUserId,
      user.email,
      user.firstName,
      user.lastName,
      user.subscription?.stripeCustomerId
    );

    // Update user with Stripe customer ID if not already set
    if (!user.subscription?.stripeCustomerId) {
      await User.findOneAndUpdate(
        { clerkId: clerkUserId },
        { 
          'subscription.stripeCustomerId': stripeCustomer.id,
          updatedAt: new Date()
        }
      );
    }

    // Create checkout session
    const checkoutSession = await createCheckoutSession(
      stripeCustomer.id,
      priceId,
      planId,
      billing,
      clerkUserId
    );

    // Track checkout session creation
    await redis.incr('metrics:checkout_sessions_created');
    
    // Log successful checkout session creation (without sensitive data)
    console.log(`Checkout session created for user ${clerkUserId}: ${planId} (${billing})`);

    return NextResponse.json({
      success: true,
      data: {
        url: checkoutSession.url,
        sessionId: checkoutSession.id
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    // Log error with Sentry
    Sentry.captureException(error, {
      tags: {
        section: 'stripe_checkout',
        action: 'create_session'
      },
      extra: {
        ip: request.headers.get('x-forwarded-for') ?? 'unknown',
        userAgent: request.headers.get('user-agent') ?? 'unknown'
      }
    });

    console.error('Checkout session creation failed:', error);

    // Return generic error to client
    return NextResponse.json(
      { 
        success: false, 
        error: 'Unable to create checkout session. Please try again.',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}

// Handle unsupported methods
export async function GET() {
  return NextResponse.json(
    { success: false, error: 'Method not allowed' },
    { status: 405 }
  );
}

export async function PUT() {
  return NextResponse.json(
    { success: false, error: 'Method not allowed' },
    { status: 405 }
  );
}

export async function DELETE() {
  return NextResponse.json(
    { success: false, error: 'Method not allowed' },
    { status: 405 }
  );
}