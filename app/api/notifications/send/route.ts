import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { z } from 'zod';
import * as Sentry from '@sentry/nextjs';
import { emailService } from '@/lib/resend';
import { rateLimits } from '@/lib/upstash';
import { checkEmailLimit } from '@/lib/subscription-utils';

// Request validation schemas
const sendEmailSchema = z.object({
  type: z.enum(['welcome', 'price_alert', 'subscription_confirmation', 'payment_failed']),
  recipient: z.string().email(),
  data: z.record(z.any()),
  priority: z.enum(['high', 'normal', 'low']).optional(),
  scheduled: z.boolean().optional(),
  scheduledFor: z.string().datetime().optional(),
});

const sendPriceAlertSchema = z.object({
  userId: z.string(),
  product: z.object({
    id: z.string(),
    title: z.string(),
    brand: z.string(),
    currentPrice: z.number(),
    originalPrice: z.number(),
    targetPrice: z.number().optional(),
    url: z.string().url(),
    image: z.string().url().optional(),
    availability: z.string().optional(),
  }),
  alertType: z.enum(['target_reached', 'significant_drop', 'lowest_price', 'back_in_stock']),
  discountPercentage: z.number().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const { userId } = auth();
    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Rate limiting
    const ip = request.headers.get('x-forwarded-for') ?? 'anonymous';
    const { success: rateLimitOk } = await rateLimits.email.limit(ip);
    
    if (!rateLimitOk) {
      return NextResponse.json(
        { success: false, error: 'Rate limit exceeded' },
        { status: 429 }
      );
    }

    const body = await request.json();
    const url = new URL(request.url);
    const endpoint = url.searchParams.get('endpoint');

    // Handle different notification endpoints
    switch (endpoint) {
      case 'price-alert':
        return await handlePriceAlert(body, userId);
      
      case 'welcome':
        return await handleWelcomeEmail(body, userId);
      
      case 'general':
        return await handleGeneralEmail(body, userId);
      
      default:
        return NextResponse.json(
          { success: false, error: 'Invalid endpoint' },
          { status: 400 }
        );
    }

  } catch (error) {
    console.error('Error in notification API:', error);
    Sentry.captureException(error);
    
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

async function handlePriceAlert(body: any, userId: string) {
  try {
    const validation = sendPriceAlertSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid request data', details: validation.error.errors },
        { status: 400 }
      );
    }

    const { product, alertType, discountPercentage } = validation.data;
    
    // Get user information for email
    const user = await getUser(userId);
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }

    // Check email limits
    const emailLimit = await checkEmailLimit(userId);
    if (!emailLimit.allowed) {
      return NextResponse.json(
        { success: false, error: emailLimit.reason, limitReached: true },
        { status: 403 }
      );
    }

    // Send price alert email
    const result = await emailService.sendPriceAlertEmail({
      firstName: user.firstName,
      email: user.email,
      product,
      alertType,
      discountPercentage,
    }, { userId });

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Price alert email sent successfully',
      emailId: 'data' in result ? result.data?.id : undefined,
    });

  } catch (error) {
    console.error('Error sending price alert:', error);
    Sentry.captureException(error);
    throw error;
  }
}

async function handleWelcomeEmail(body: any, userId: string) {
  try {
    const user = await getUser(userId);
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }

    // Send welcome email
    const result = await emailService.sendWelcomeEmail({
      firstName: user.firstName,
      email: user.email,
      dashboardUrl: `${process.env.NEXTAUTH_URL || 'https://shopvalue.com'}/dashboard`,
    }, { userId });

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Welcome email sent successfully',
      emailId: 'data' in result ? result.data?.id : undefined,
    });

  } catch (error) {
    console.error('Error sending welcome email:', error);
    Sentry.captureException(error);
    throw error;
  }
}

async function handleGeneralEmail(body: any, userId: string) {
  try {
    const validation = sendEmailSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid request data', details: validation.error.errors },
        { status: 400 }
      );
    }

    const { type, recipient, data, priority, scheduled, scheduledFor } = validation.data;

    if (scheduled && scheduledFor) {
      // Queue the email for later
      const result = await emailService.queueEmail({
        type,
        to: recipient,
        userId,
        data,
        priority,
        scheduledFor: new Date(scheduledFor),
      });

      return NextResponse.json({
        success: true,
        message: 'Email scheduled successfully',
        jobId: result.jobId,
      });
    } else {
      // Send immediately
      const result = await emailService.sendTemplatedEmail(type, recipient, data, {
        userId,
        priority,
      });

      if (!result.success) {
        return NextResponse.json(
          { success: false, error: result.error },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        message: 'Email sent successfully',
        emailId: 'data' in result ? result.data?.id : undefined,
      });
    }

  } catch (error) {
    console.error('Error sending general email:', error);
    Sentry.captureException(error);
    throw error;
  }
}

// Helper function to get user data
async function getUser(clerkUserId: string) {
  try {
    const mongoose = await import('@/lib/mongoose');
    const userModel = await import('@/lib/models/user.model');
    
    await mongoose.connectToDB();
    
    const user = await userModel.default.findOne({ clerkId: clerkUserId }).lean();
    return user ? {
      firstName: (user as any).firstName || '',
      email: (user as any).email,
    } : null;
    
  } catch (error) {
    console.error('Error fetching user:', error);
    return null;
  }
}

// Health check endpoint
export async function GET() {
  return NextResponse.json({
    status: 'healthy',
    service: 'notification-api',
    timestamp: new Date().toISOString(),
    endpoints: [
      '/api/notifications/send?endpoint=price-alert',
      '/api/notifications/send?endpoint=welcome',
      '/api/notifications/send?endpoint=general',
    ],
  });
}