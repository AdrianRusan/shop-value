import { NextResponse } from 'next/server';
import { connectToDB } from '@/lib/mongoose';
import Product from '@/lib/models/product.model';
import User from '@/lib/models/user.model';
import { redis } from '@/lib/upstash';

export const maxDuration = 250;
export const dynamic = 'force-dynamic';

// Simplified cron job for basic operations
export async function GET() {
  try {
    console.log('🚀 Starting basic cron job...');
    await connectToDB();

    // Track cron execution
    await trackCronExecution();

    // Get basic product stats for monitoring
    const stats = await getBasicStats();

    const response = {
      success: true,
      message: 'Basic cron job completed successfully',
      stats: {
        timestamp: new Date().toISOString(),
        ...stats,
      },
    };

    console.log('✅ Cron job completed successfully:', stats);
    return NextResponse.json(response);

  } catch (error: any) {
    console.error('❌ Cron job failed:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error.message,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

// Get basic statistics
async function getBasicStats() {
  try {
    // Basic stats for monitoring
    return {
      totalProducts: 0, // TODO: Implement when Model issues are resolved
      activeProducts: 0,
      totalUsers: 0,
      activeUsers: 0,
      status: 'operational',
    };
  } catch (error) {
    console.error('Error getting basic stats:', error);
    return {
      totalProducts: 0,
      activeProducts: 0,
      totalUsers: 0,
      activeUsers: 0,
      status: 'error',
    };
  }
}

// Track cron job execution for monitoring
async function trackCronExecution() {
  try {
    const today = new Date().toISOString().split('T')[0];
    
    await Promise.all([
      redis.incr('cron:executions:total'),
      redis.incr(`cron:executions:${today}`),
      redis.setex('cron:last_execution', 3600 * 24, Date.now().toString()),
    ]);
  } catch (error) {
    console.error('Error tracking cron execution:', error);
  }
}
