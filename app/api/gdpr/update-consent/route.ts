import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { connectToDB } from '@/lib/mongoose';
import User from '@/lib/models/user.model';
import { z } from 'zod';
import * as Sentry from '@sentry/nextjs';

// Validation schema
const updateConsentSchema = z.object({
  preferences: z.object({
    functional: z.boolean().default(true), // Always true
    analytics: z.boolean().default(false),
    marketing: z.boolean().default(false)
  }),
  ipAddress: z.string().optional()
});

interface UpdateConsentResponse {
  success: boolean;
  data?: {
    consent: {
      functional: { granted: boolean; timestamp: Date };
      analytics: { granted: boolean; timestamp?: Date };
      marketing: { granted: boolean; timestamp?: Date };
      lastUpdated: Date;
    };
  };
  error?: string;
}

interface UserWithConsent {
  consent: {
    functional: { granted: boolean; timestamp: Date; ipAddress?: string };
    analytics: { granted: boolean; timestamp?: Date; ipAddress?: string };
    marketing: { granted: boolean; timestamp?: Date; ipAddress?: string };
    lastUpdated: Date;
  };
}

export async function POST(request: NextRequest): Promise<NextResponse<UpdateConsentResponse>> {
  try {
    // Check authentication
    const { userId } = auth();
    
    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const validation = updateConsentSchema.safeParse(body);
    
    if (!validation.success) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Invalid request data',
          details: validation.error.errors 
        },
        { status: 400 }
      );
    }

    const { preferences, ipAddress } = validation.data;

    // Connect to database
    await connectToDB();

    // Update user consent
    const now = new Date();
    const consentUpdate = {
      functional: {
        granted: true, // Always required
        timestamp: now,
        ipAddress: ipAddress || 'unknown'
      },
      analytics: {
        granted: preferences.analytics,
        timestamp: preferences.analytics ? now : undefined,
        ipAddress: preferences.analytics ? (ipAddress || 'unknown') : undefined
      },
      marketing: {
        granted: preferences.marketing,
        timestamp: preferences.marketing ? now : undefined,
        ipAddress: preferences.marketing ? (ipAddress || 'unknown') : undefined
      },
      lastUpdated: now
    };

    const user = await User.findOneAndUpdate(
      { clerkId: userId },
      { 
        $set: { 
          consent: consentUpdate,
          'preferences.notifications.marketingEmails': preferences.marketing
        }
      },
      { new: true, select: 'consent' }
    ) as UserWithConsent | null;

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }

    // Log consent change for audit trail
    await logConsentChange(userId, preferences, ipAddress || 'unknown');

    return NextResponse.json({
      success: true,
      data: {
        consent: user.consent
      }
    });

  } catch (error) {
    console.error('Error updating consent:', error);
    Sentry.captureException(error);
    
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Helper function to log consent changes for audit trail
async function logConsentChange(
  userId: string, 
  preferences: { functional: boolean; analytics: boolean; marketing: boolean },
  ipAddress: string
): Promise<void> {
  try {
    // Import the audit log model
    const { AuditLog } = await import('@/lib/models/audit-log.model');
    
    await AuditLog.create({
      userId,
      action: 'consent_updated',
      entityType: 'user_consent',
      entityId: userId,
      changes: {
        functional: preferences.functional,
        analytics: preferences.analytics,
        marketing: preferences.marketing
      },
      ipAddress,
      userAgent: 'web_browser',
      timestamp: new Date()
    });
  } catch (error) {
    // Don't fail the main operation if logging fails
    console.error('Failed to log consent change:', error);
    Sentry.captureException(error);
  }
}