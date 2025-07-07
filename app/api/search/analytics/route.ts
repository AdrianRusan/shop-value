import { NextRequest, NextResponse } from 'next/server';
import { searchAnalytics } from '@/lib/searchAnalytics';
import { auth } from '@clerk/nextjs/server';

export async function POST(request: NextRequest) {
  try {
    const { userId } = auth();
    const body = await request.json();
    const { action, data } = body;

    switch (action) {
      case 'track_search':
        await searchAnalytics.trackSearchQuery({
          ...data,
          user: {
            ...data.user,
            id: userId || undefined,
            sessionId: data.user?.sessionId || 'anonymous',
            userAgent: request.headers.get('user-agent') || undefined,
            ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined
          }
        });
        break;

      case 'track_click':
        await searchAnalytics.trackResultClick({
          ...data,
          userId: userId || undefined
        });
        break;

      case 'track_conversion':
        await searchAnalytics.trackSearchConversion({
          ...data,
          userId: userId || undefined
        });
        break;

      case 'track_performance':
        await searchAnalytics.trackSearchPerformance(data);
        break;

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Search analytics API error:', error);
    return NextResponse.json(
      { error: 'Failed to track analytics' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { userId } = auth();
    
    // Check if user has admin access for analytics viewing
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('start');
    const endDate = searchParams.get('end');
    const type = searchParams.get('type') || 'metrics';

    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: 'Start and end dates are required' },
        { status: 400 }
      );
    }

    const dateRange = {
      start: new Date(startDate),
      end: new Date(endDate)
    };

    let data;
    switch (type) {
      case 'metrics':
        data = await searchAnalytics.getSearchMetrics(dateRange);
        break;
      case 'insights':
        data = await searchAnalytics.getSearchInsights(dateRange);
        break;
      default:
        return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Search analytics API error:', error);
    return NextResponse.json(
      { error: 'Failed to get analytics data' },
      { status: 500 }
    );
  }
}