import { NextRequest, NextResponse } from 'next/server';
import { connectToDB } from '@/lib/mongoose';
import User from '@/lib/models/user.model';
import Product from '@/lib/models/product.model';
import * as Sentry from '@sentry/nextjs';

interface GDPRCleanupResponse {
  success: boolean;
  data?: {
    processedAt: string;
    cleaned: {
      expiredConsents: number;
      staleProducts: number;
      oldPriceHistory: number;
      expiredSessions: number;
    };
  };
  error?: string;
}

export async function POST(request: NextRequest): Promise<NextResponse<GDPRCleanupResponse>> {
  try {
    // Verify the request is from Vercel Cron
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    console.log('Starting GDPR cleanup process...');

    // Connect to database
    await connectToDB();

    const cleaned = {
      expiredConsents: 0,
      staleProducts: 0,
      oldPriceHistory: 0,
      expiredSessions: 0
    };

    // 1. Clean up expired consents (older than 1 year)
    const expiredConsentsResult = await cleanupExpiredConsents();
    cleaned.expiredConsents = expiredConsentsResult;

    // 2. Archive stale products (not tracked by anyone for 90+ days)
    const staleProductsResult = await archiveStaleProducts();
    cleaned.staleProducts = staleProductsResult;

    // 3. Delete old price history (older than 90 days per retention policy)
    const oldPriceHistoryResult = await cleanupOldPriceHistory();
    cleaned.oldPriceHistory = oldPriceHistoryResult;

    // 4. Clean up expired user sessions and tokens
    const expiredSessionsResult = await cleanupExpiredSessions();
    cleaned.expiredSessions = expiredSessionsResult;

    console.log('GDPR cleanup completed:', cleaned);

    return NextResponse.json({
      success: true,
      data: {
        processedAt: new Date().toISOString(),
        cleaned
      }
    });

  } catch (error) {
    console.error('Error in GDPR cleanup process:', error);
    Sentry.captureException(error);
    
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

async function cleanupExpiredConsents(): Promise<number> {
  try {
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

    // Find users with expired consents
    const usersWithExpiredConsents = await User.find({
      'consent.lastUpdated': { $lt: oneYearAgo },
      status: 'active'
    }).select('clerkId consent');

    let updatedCount = 0;

    for (const user of usersWithExpiredConsents) {
      // Reset consent to require re-acceptance
      await User.updateOne(
        { _id: user._id },
        {
          $set: {
            'consent.analytics.granted': false,
            'consent.marketing.granted': false,
            'consent.lastUpdated': new Date(),
            'preferences.notifications.marketingEmails': false
          }
        }
      );

      // Log the consent expiration
      try {
        const { AuditLog } = await import('@/lib/models/audit-log.model');
        await AuditLog.create({
          userId: user.clerkId,
          action: 'consent_updated',
          entityType: 'user_consent',
          entityId: user.clerkId,
          changes: {
            reason: 'expired_consent',
            analytics: false,
            marketing: false,
            expiredAt: oneYearAgo
          },
          ipAddress: 'system',
          userAgent: 'gdpr_cleanup_cron',
          timestamp: new Date()
        });
      } catch (error) {
        console.error('Failed to log consent expiration:', error);
      }

      updatedCount++;
    }

    console.log(`Reset ${updatedCount} expired consents`);
    return updatedCount;

  } catch (error) {
    console.error('Error cleaning up expired consents:', error);
    Sentry.captureException(error);
    return 0;
  }
}

async function archiveStaleProducts(): Promise<number> {
  try {
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    // Find products that haven't been updated in 90+ days and have no active trackers
    const staleProducts = await Product.aggregate([
      {
        $lookup: {
          from: 'userproducttrackings',
          localField: '_id',
          foreignField: 'productId',
          as: 'trackers'
        }
      },
      {
        $match: {
          $and: [
            { updatedAt: { $lt: ninetyDaysAgo } },
            { 'trackers': { $size: 0 } },
            { status: { $ne: 'archived' } }
          ]
        }
      },
      {
        $project: { _id: 1 }
      }
    ]);

    if (staleProducts.length > 0) {
      const staleIds = staleProducts.map(p => p._id);
      
      const result = await Product.updateMany(
        { _id: { $in: staleIds } },
        {
          $set: {
            status: 'archived',
            archivedAt: new Date(),
            archivedReason: 'gdpr_retention_policy'
          }
        }
      );

      console.log(`Archived ${result.modifiedCount} stale products`);
      return result.modifiedCount || 0;
    }

    return 0;

  } catch (error) {
    console.error('Error archiving stale products:', error);
    Sentry.captureException(error);
    return 0;
  }
}

async function cleanupOldPriceHistory(): Promise<number> {
  try {
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    // Clean up old price history from embedded arrays in products
    try {
      const result = await Product.updateMany(
        {
          'priceHistory.timestamp': { $lt: ninetyDaysAgo }
        },
        {
          $pull: {
            priceHistory: {
              timestamp: { $lt: ninetyDaysAgo }
            }
          }
        }
      );

      console.log(`Cleaned old price history from ${result.modifiedCount} products`);
      return result.modifiedCount || 0;
    } catch (error) {
      console.log('Error cleaning up price history:', error);
      return 0;
    }

  } catch (error) {
    console.error('Error cleaning up old price history:', error);
    Sentry.captureException(error);
    return 0;
  }
}

async function cleanupExpiredSessions(): Promise<number> {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Clean up old API key usage records
    const result = await User.updateMany(
      {
        apiKeyLastUsed: { $lt: thirtyDaysAgo, $ne: null }
      },
      {
        $unset: {
          apiKeyLastUsed: 1
        }
      }
    );

    // Clean up old login tracking for inactive users
    await User.updateMany(
      {
        lastLoginAt: { $lt: thirtyDaysAgo },
        status: { $in: ['suspended', 'deleted'] }
      },
      {
        $unset: {
          lastLoginAt: 1
        },
        $set: {
          loginCount: 0
        }
      }
    );

    console.log(`Cleaned up ${result.modifiedCount} expired session records`);
    return result.modifiedCount || 0;

  } catch (error) {
    console.error('Error cleaning up expired sessions:', error);
    Sentry.captureException(error);
    return 0;
  }
}

// Allow GET requests for health checks
export async function GET(): Promise<NextResponse> {
  return NextResponse.json({
    success: true,
    message: 'GDPR cleanup endpoint is healthy',
    nextRun: 'Daily at 2:00 AM UTC'
  });
}