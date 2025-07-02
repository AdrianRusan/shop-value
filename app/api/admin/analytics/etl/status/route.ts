import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { connectToDB } from '@/lib/mongoose';
import User from '@/lib/models/user.model';
import { getETLQueueStatus } from '@/lib/services/analytics-etl';
import * as Sentry from '@sentry/nextjs';

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/analytics/etl/status
 * Get ETL queue status and statistics
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

    // Get ETL queue status
    const queueStatus = await getETLQueueStatus();

    return NextResponse.json({
      success: true,
      data: queueStatus,
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('Error fetching ETL status:', error);
    Sentry.captureException(error);
    
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch ETL status',
        details: error.message 
      },
      { status: 500 }
    );
  }
}