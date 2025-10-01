import { NextRequest, NextResponse } from 'next/server';
import { checkAndSendAlerts } from '@/lib/alerts/trigger';

/**
 * Cron job endpoint to process price alerts
 * This should be called daily (configured in vercel.json)
 * 
 * Authorization: Bearer token from CRON_SECRET env var
 */
export async function GET(request: NextRequest) {
  try {
    // Verify cron secret to prevent unauthorized calls
    const authHeader = request.headers.get('authorization');
    const expectedAuth = `Bearer ${process.env.CRON_SECRET}`;
    
    if (authHeader !== expectedAuth) {
      console.error('[Cron] Unauthorized attempt to trigger alerts');
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    console.log('[Cron] Processing alerts...');
    
    // Check all products and send alerts
    const result = await checkAndSendAlerts();
    
    if (!result.success) {
      console.error('[Cron] Alert processing failed:', result.error);
      return NextResponse.json(
        { 
          success: false, 
          error: result.error 
        },
        { status: 500 }
      );
    }

    console.log('[Cron] Alert processing complete:', result);
    
    return NextResponse.json({
      success: true,
      data: {
        alertsSent: result.alertsSent,
        alertsSkipped: result.alertsSkipped,
        totalChecked: result.totalChecked,
        timestamp: new Date().toISOString()
      }
    });
    
  } catch (error) {
    console.error('[Cron] Error in process-alerts:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}

// Prevent caching
export const dynamic = 'force-dynamic';
export const revalidate = 0;
