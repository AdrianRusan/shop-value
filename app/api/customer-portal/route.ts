import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import * as Sentry from '@sentry/nextjs';
import { Ratelimit } from '@upstash/ratelimit';
import { redis } from '@/lib/upstash';
import { createCustomerPortalSession } from '@/lib/stripe';
import User from '@/lib/models/user.model';

// Rate limiting for customer portal endpoint
const ratelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(10, '5 m'), // 10 requests per 5 minutes
});

export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const ip = request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip') ?? 'anonymous';
    const { success: rateLimitSuccess } = await ratelimit.limit(`portal:${ip}`);
    
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

    // Get user from database
    const user = await User.findOne({ clerkId: clerkUserId });
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }

    // Check if user has a Stripe customer ID
    if (!user.subscription?.stripeCustomerId) {
      return NextResponse.json(
        { success: false, error: 'No Stripe customer found. Please subscribe first.' },
        { status: 400 }
      );
    }

    // Parse optional return URL from request body
    const body = await request.json().catch(() => ({}));
    const returnUrl = body.returnUrl || `${process.env.NEXT_PUBLIC_APP_URL}/dashboard`;

    // Create customer portal session
    const portalSession = await createCustomerPortalSession(
      user.subscription.stripeCustomerId,
      returnUrl
    );

    // Track portal session creation
    await redis.incr('metrics:portal_sessions_created');
    
    // Log successful portal session creation
    console.log(`Customer portal session created for user ${clerkUserId}`);

    return NextResponse.json({
      success: true,
      data: {
        url: portalSession.url
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    // Log error with Sentry
    Sentry.captureException(error, {
      tags: {
        section: 'stripe_portal',
        action: 'create_session'
      },
      extra: {
        ip: request.headers.get('x-forwarded-for') ?? 'unknown',
        userAgent: request.headers.get('user-agent') ?? 'unknown'
      }
    });

    console.error('Customer portal session creation failed:', error);

    // Return generic error to client
    return NextResponse.json(
      { 
        success: false, 
        error: 'Unable to create customer portal session. Please try again.',
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