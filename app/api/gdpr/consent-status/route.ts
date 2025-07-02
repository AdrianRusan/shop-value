import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { connectToDB } from '@/lib/mongoose';
import User from '@/lib/models/user.model';
import * as Sentry from '@sentry/nextjs';

// Force dynamic rendering for this route since it uses auth
export const dynamic = 'force-dynamic';

interface ConsentStatusResponse {
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

interface UserConsentDoc {
  consent: {
    functional: { granted: boolean; timestamp: Date; ipAddress?: string };
    analytics: { granted: boolean; timestamp?: Date; ipAddress?: string };
    marketing: { granted: boolean; timestamp?: Date; ipAddress?: string };
    lastUpdated: Date;
  };
}

export async function GET(request: NextRequest): Promise<NextResponse<ConsentStatusResponse>> {
  try {
    // Check authentication
    const { userId } = auth();
    
    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Connect to database
    await connectToDB();

    // Find user with consent data
    const user = await User.findOne({ clerkId: userId })
      .select('consent')
      .lean() as UserConsentDoc | null;

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }

    // Check if user has valid consent
    if (!user.consent || !user.consent.functional) {
      return NextResponse.json(
        { success: false, error: 'No consent data found' },
        { status: 200 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        consent: user.consent
      }
    });

  } catch (error) {
    console.error('Error fetching consent status:', error);
    Sentry.captureException(error);
    
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}