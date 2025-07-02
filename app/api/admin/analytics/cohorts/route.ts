import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { connectToDB } from '@/lib/mongoose';
import User from '@/lib/models/user.model';
import { redis } from '@/lib/upstash';
import { scheduleAnalyticsJob } from '@/lib/services/analytics-etl';
import * as Sentry from '@sentry/nextjs';

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/analytics/cohorts
 * Retrieve cohort analysis data
 */
export async function GET(request: NextRequest) {
  try {
    // Check authentication and admin role
    const { userId } = auth();
    if (!userId) {
      return NextResponse.json({ 
        success: false, 
        error: 'Unauthorized' 
      }, { status: 401 });
    }

    await connectToDB();

    // Verify admin role
    const user = await User.findOne({ clerkId: userId });
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ 
        success: false, 
        error: 'Admin access required' 
      }, { status: 403 });
    }

    const searchParams = request.nextUrl.searchParams;
    const monthsBack = parseInt(searchParams.get('months') || '12');
    const refresh = searchParams.get('refresh') === 'true';

    // Check cache first unless refresh is requested
    if (!refresh) {
      const cachedData = await redis.get('analytics:cohorts');
      if (cachedData) {
        return NextResponse.json({
          success: true,
          data: JSON.parse(cachedData as string),
          cached: true,
          timestamp: new Date().toISOString()
        });
      }
    }

    // Schedule ETL job to calculate cohorts
    await scheduleAnalyticsJob('calculate_cohorts', { monthsBack });

    // For immediate response, calculate basic cohort data
    const cohortData = await calculateBasicCohorts(monthsBack);

    return NextResponse.json({
      success: true,
      data: cohortData,
      cached: false,
      message: 'Detailed cohort analysis is being processed in the background',
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('Error fetching cohort analytics:', error);
    Sentry.captureException(error);
    
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch cohort analytics',
        details: error.message 
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/analytics/cohorts
 * Trigger cohort analysis calculation
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = auth();
    if (!userId) {
      return NextResponse.json({ 
        success: false, 
        error: 'Unauthorized' 
      }, { status: 401 });
    }

    await connectToDB();

    const user = await User.findOne({ clerkId: userId });
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ 
        success: false, 
        error: 'Admin access required' 
      }, { status: 403 });
    }

    const body = await request.json();
    const { monthsBack = 12, priority = false } = body;

    // Schedule ETL job with optional priority
    await scheduleAnalyticsJob(
      'calculate_cohorts', 
      { monthsBack }, 
      priority ? 0 : undefined
    );

    return NextResponse.json({
      success: true,
      message: 'Cohort analysis calculation has been scheduled',
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('Error scheduling cohort analysis:', error);
    Sentry.captureException(error);
    
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to schedule cohort analysis',
        details: error.message 
      },
      { status: 500 }
    );
  }
}

/**
 * Calculate basic cohort data for immediate response
 */
async function calculateBasicCohorts(monthsBack: number) {
  const cohorts = [];
  const now = new Date();

  for (let i = 0; i < Math.min(monthsBack, 6); i++) { // Limit to 6 months for quick response
    const cohortDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const cohortStart = new Date(cohortDate.getFullYear(), cohortDate.getMonth(), 1);
    const cohortEnd = new Date(cohortDate.getFullYear(), cohortDate.getMonth() + 1, 0);

    const cohortUsers = await User.countDocuments({
      createdAt: { $gte: cohortStart, $lte: cohortEnd },
      status: 'active'
    });

    if (cohortUsers === 0) continue;

    // Calculate basic retention (active users from this cohort)
    const currentlyActive = await User.countDocuments({
      createdAt: { $gte: cohortStart, $lte: cohortEnd },
      status: 'active',
      lastLoginAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } // Last 30 days
    });

    const retentionRate = Math.round((currentlyActive / cohortUsers) * 100);

    cohorts.push({
      month: cohortDate.toISOString().substring(0, 7), // YYYY-MM format
      userCount: cohortUsers,
      currentlyActive,
      retentionRate,
      basic: true // Flag to indicate this is basic data
    });
  }

  return cohorts;
}