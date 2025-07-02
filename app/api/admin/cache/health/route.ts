import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { cacheHealth } from '@/lib/cache';
import { rateLimits } from '@/lib/upstash';
import * as Sentry from '@sentry/nextjs';

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';

// GET /api/admin/cache/health - Get cache health metrics
export async function GET(request: NextRequest) {
  try {
    // Rate limiting
    const ip = request.headers.get('x-forwarded-for') ?? 'anonymous';
    const { success } = await rateLimits.sensitive.limit(ip);
    
    if (!success) {
      return NextResponse.json({ 
        success: false, 
        error: 'Rate limit exceeded' 
      }, { status: 429 });
    }

    // Authentication - require admin role
    const { userId } = auth();
    if (!userId) {
      return NextResponse.json({ 
        success: false, 
        error: 'Unauthorized' 
      }, { status: 401 });
    }

    // TODO: Add proper admin role check here
    // For now, we'll allow any authenticated user in development
    // In production, add: await checkAdminRole(userId);

    // Get cache health metrics
    const health = await cacheHealth.getCacheHealth();

    return NextResponse.json({
      success: true,
      data: health,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    Sentry.captureException(error);
    console.error('Error fetching cache health:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
}