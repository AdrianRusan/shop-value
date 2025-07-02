import { NextRequest, NextResponse } from 'next/server';
import { cacheWarmer } from '@/lib/cache/cache-service';

export async function GET(request: NextRequest) {
  try {
    // Verify this is a cron request
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('Starting scheduled cache warming...');
    
    // Perform cache warming
    await cacheWarmer.warmCache();
    
    console.log('Scheduled cache warming completed successfully');

    return NextResponse.json({
      success: true,
      message: 'Cache warming completed',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Cache warming cron job failed:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Cache warming failed',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}