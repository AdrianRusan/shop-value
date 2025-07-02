import { NextResponse } from 'next/server';
import { cacheWarming } from '@/lib/cache';
import * as Sentry from '@sentry/nextjs';

// GET /api/cron/cache-warming - Warm frequently accessed cache data
export async function GET() {
  try {
    console.log('Starting cache warming process...');
    
    // Warm frequently accessed data
    await cacheWarming.warmFrequentlyAccessedData();
    
    console.log('Cache warming completed successfully');
    
    return NextResponse.json({
      success: true,
      message: 'Cache warming completed',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    Sentry.captureException(error);
    console.error('Cache warming failed:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Cache warming failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}