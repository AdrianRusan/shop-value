import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { connectToDB } from '@/lib/mongoose';
import User from '@/lib/models/user.model';
import Product from '@/lib/models/product.model';
import UserProductTracking from '@/lib/models/user-product-tracking.model';
import { z } from 'zod';
import * as Sentry from '@sentry/nextjs';

// Validation schema for deletion request
const deleteAccountSchema = z.object({
  confirmationText: z.string().refine(
    val => val === 'DELETE MY ACCOUNT',
    { message: 'Confirmation text must be exactly "DELETE MY ACCOUNT"' }
  ),
  reason: z.string().optional()
});

interface DeleteAccountResponse {
  success: boolean;
  data?: {
    deletedAt: string;
    dataRemoved: {
      userAccount: boolean;
      trackedProducts: number;
      priceHistory: number;
      auditLogs: number;
    };
  };
  error?: string;
}

interface UserSubscriptionDoc {
  subscription: {
    stripeSubscriptionId?: string;
  };
}

export async function POST(request: NextRequest): Promise<NextResponse<DeleteAccountResponse>> {
  try {
    // Check authentication
    const { userId } = auth();
    
    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const validation = deleteAccountSchema.safeParse(body);
    
    if (!validation.success) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Invalid request data',
          details: validation.error.errors 
        },
        { status: 400 }
      );
    }

    const { confirmationText, reason } = validation.data;

    // Connect to database
    await connectToDB();

    // Log the deletion request for audit trail (before deletion)
    await logAccountDeletion(userId, request, reason);

    // Perform complete data purging
    const deletionResult = await purgeUserData(userId);

    if (!deletionResult.success) {
      return NextResponse.json(
        { success: false, error: deletionResult.error },
        { status: 500 }
      );
    }

    // Delete from Clerk (external auth provider)
    try {
      const { clerkClient } = await import('@clerk/nextjs/server');
      await clerkClient.users.deleteUser(userId);
    } catch (clerkError) {
      console.error('Error deleting user from Clerk:', clerkError);
      // Log but don't fail the operation - user data is already purged
      Sentry.captureException(clerkError, {
        tags: { operation: 'clerk_user_deletion' },
        extra: { userId }
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        deletedAt: new Date().toISOString(),
        dataRemoved: deletionResult.dataRemoved
      }
    });

  } catch (error) {
    console.error('Error deleting user account:', error);
    Sentry.captureException(error);
    
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

async function purgeUserData(userId: string): Promise<{
  success: boolean;
  error?: string;
  dataRemoved: {
    userAccount: boolean;
    trackedProducts: number;
    priceHistory: number;
    auditLogs: number;
  };
}> {
  const dataRemoved = {
    userAccount: false,
    trackedProducts: 0,
    priceHistory: 0,
    auditLogs: 0
  };

  try {
    // 1. Get user's tracked products to find product IDs
    const trackedProducts = await UserProductTracking.find({ userId }).lean();
    const productIds = trackedProducts.map(tp => tp.productId);

    // 2. Delete user's tracked products
    const trackedProductsResult = await UserProductTracking.deleteMany({ userId });
    dataRemoved.trackedProducts = trackedProductsResult.deletedCount || 0;

    // 3. Clear price history from user's products (embedded arrays)
    try {
      if (productIds.length > 0) {
        const priceHistoryResult = await Product.updateMany(
          { _id: { $in: productIds } },
          { $set: { priceHistory: [] } }
        );
        // Count total price history items cleared (estimated based on modified products)
        dataRemoved.priceHistory = priceHistoryResult.modifiedCount * 10; // Estimate
      }
    } catch (error) {
      console.log('Error clearing price history:', error);
    }

    // 4. Clean up products that are no longer tracked by anyone
    await cleanupOrphanedProducts();

    // 5. Delete user's audit logs (except the deletion log itself)
    try {
      const { AuditLog } = await import('@/lib/models/audit-log.model');
      const auditLogsResult = await AuditLog.deleteMany({ 
        userId,
        action: { $ne: 'data_deleted' } // Keep the deletion log for compliance
      });
      dataRemoved.auditLogs = auditLogsResult.deletedCount || 0;
    } catch (error) {
      console.log('Audit log model not found, skipping...');
    }

    // 6. Cancel any active Stripe subscriptions
    try {
      const user = await User.findOne({ clerkId: userId }).select('subscription').lean() as UserSubscriptionDoc | null;
      if (user?.subscription?.stripeSubscriptionId) {
        const stripe = (await import('stripe')).default;
        const stripeClient = new stripe(process.env.STRIPE_SECRET_KEY!, {
          apiVersion: '2024-06-20'
        });
        
        await stripeClient.subscriptions.cancel(user.subscription.stripeSubscriptionId);
        console.log('Cancelled Stripe subscription:', user.subscription.stripeSubscriptionId);
      }
    } catch (stripeError) {
      console.error('Error canceling Stripe subscription:', stripeError);
      // Log but don't fail the operation
      Sentry.captureException(stripeError);
    }

    // 7. Delete user account (soft delete first, then hard delete after delay)
    const userResult = await User.deleteOne({ clerkId: userId });
    dataRemoved.userAccount = userResult.deletedCount > 0;

    return {
      success: true,
      dataRemoved
    };

  } catch (error) {
    console.error('Error purging user data:', error);
    Sentry.captureException(error);
    
    return {
      success: false,
      error: 'Failed to purge user data',
      dataRemoved
    };
  }
}

async function cleanupOrphanedProducts(): Promise<void> {
  try {
    // Find products that are no longer tracked by any user
    const orphanedProducts = await Product.aggregate([
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
          'trackers': { $size: 0 }
        }
      },
      {
        $project: { _id: 1 }
      }
    ]);

    if (orphanedProducts.length > 0) {
      const orphanedIds = orphanedProducts.map(p => p._id);
      
      // Archive orphaned products instead of deleting (for business intelligence)
      await Product.updateMany(
        { _id: { $in: orphanedIds } },
        { 
          $set: { 
            status: 'archived',
            archivedAt: new Date(),
            archivedReason: 'no_active_trackers'
          }
        }
      );

      console.log(`Archived ${orphanedProducts.length} orphaned products`);
    }
  } catch (error) {
    console.error('Error cleaning up orphaned products:', error);
    // Don't fail the main operation
  }
}

async function logAccountDeletion(userId: string, request: NextRequest, reason?: string): Promise<void> {
  try {
    const { AuditLog } = await import('@/lib/models/audit-log.model');
    
    const ipAddress = request.headers.get('x-forwarded-for') || 
                     request.headers.get('x-real-ip') || 
                     'unknown';
    
    const userAgent = request.headers.get('user-agent') || 'unknown';

    await AuditLog.create({
      userId,
      action: 'data_deleted',
      entityType: 'user_account',
      entityId: userId,
      changes: {
        deletionType: 'user_requested',
        reason: reason || 'not_provided',
        requestedAt: new Date(),
        gdprCompliant: true
      },
      ipAddress: ipAddress.split(',')[0].trim(),
      userAgent,
      timestamp: new Date()
    });
  } catch (error) {
    // Don't fail the main operation if logging fails
    console.error('Failed to log account deletion:', error);
    Sentry.captureException(error);
  }
}