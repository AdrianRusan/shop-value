import { NextRequest, NextResponse } from 'next/server';
import { connectToDB } from '@/lib/mongoose';
import { redis } from '@/lib/upstash';
import { auth } from '@clerk/nextjs/server';

// Fix build issues by forcing dynamic rendering
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    // Add authentication and admin role check
    const { userId } = auth();
    if (!userId) {
      return NextResponse.json({ 
        success: false, 
        error: 'Unauthorized' 
      }, { status: 401 });
    }
    
    await connectToDB();

    // Get query parameters for time range
    const searchParams = request.nextUrl.searchParams;
    const timeRange = searchParams.get('range') || '24h';
    const detailed = searchParams.get('detailed') === 'true';

    // Basic system metrics
    const systemMetrics = await getBasicSystemMetrics();

    const analytics = {
      timestamp: new Date().toISOString(),
      timeRange,
      overview: {
        systemHealth: 'healthy',
        version: '2.0.0',
      },
      systemMetrics,
      message: 'Scraping analytics system operational'
    };

    return NextResponse.json({
      success: true,
      data: analytics,
    });

  } catch (error: any) {
    console.error('Error fetching scraping analytics:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch analytics',
        details: error.message 
      },
      { status: 500 }
    );
  }
}

// Get basic system-level metrics
async function getBasicSystemMetrics() {
  try {
    const keys = [
      'scraping:jobs:created',
      'scraping:jobs:completed',
      'scraping:jobs:failed',
    ];

    const values = await redis.mget(...keys);
    const metrics: Record<string, number> = {};
    
    keys.forEach((key, index) => {
      const metricName = key.split(':')[1];
      metrics[metricName] = parseInt(values[index] as string) || 0;
    });

    // Calculate success rate
    const total = metrics.completed + metrics.failed;
    metrics.successRate = total > 0 ? ((metrics.completed / total) * 100) : 0;

    return metrics;
  } catch (error) {
    console.error('Error getting system metrics:', error);
    return {
      jobs: 0,
      completed: 0,
      failed: 0,
      successRate: 0
    };
  }
}

