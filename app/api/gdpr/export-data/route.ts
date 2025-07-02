import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { connectToDB } from '@/lib/mongoose';
import User from '@/lib/models/user.model';
import Product from '@/lib/models/product.model';
import UserProductTracking from '@/lib/models/user-product-tracking.model';
import { z } from 'zod';
import * as Sentry from '@sentry/nextjs';

interface DataExportResponse {
  success: boolean;
  data?: {
    exportDate: string;
    user: any;
    trackedProducts: any[];
    products: any[];
    priceHistory: any[];
    auditLogs: any[];
  };
  error?: string;
}

export async function POST(request: NextRequest): Promise<NextResponse<DataExportResponse>> {
  try {
    // Check authentication
    const { userId } = auth();
    
    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Connect to database
    await connectToDB();

    // Log the data export request for audit trail
    await logDataExport(userId, request);

    // Export user data
    const exportData = await exportUserData(userId);

    if (!exportData) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: exportData
    });

  } catch (error) {
    console.error('Error exporting user data:', error);
    Sentry.captureException(error);
    
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

async function exportUserData(userId: string) {
  try {
    // Get user data (sanitized)
    const user = await User.findOne({ clerkId: userId })
      .select('-stripeCustomerId -stripeSubscriptionId -apiKey -__v')
      .lean();

    if (!user) {
      return null;
    }

    // Get tracked products for this user
    const trackedProducts = await UserProductTracking.find({ userId })
      .select('-__v')
      .lean();

    // Get product IDs from tracked products
    const productIds = trackedProducts.map(t => t.productId);

    // Get product details (sanitized)
    const products = await Product.find({ _id: { $in: productIds } })
      .select('-__v -scraping')
      .lean();

    // Get price history from embedded arrays in products
    let priceHistory: any[] = [];
    try {
      // Price history is embedded in Product model, extract it
      const productsWithHistory = await Product.find({ 
        _id: { $in: productIds },
        'priceHistory.0': { $exists: true } // Only products with price history
      })
      .select('priceHistory url')
      .lean();
      
      // Flatten price history from all products
      priceHistory = productsWithHistory.flatMap(product => 
        product.priceHistory.map((h: any) => ({
          price: h.price,
          timestamp: h.timestamp,
          currency: h.currency || 'RON',
          productUrl: product.url
        }))
      );
    } catch (error) {
      console.log('Error extracting price history:', error);
    }

    // Get audit logs for this user
    let auditLogs: any[] = [];
    try {
      const { AuditLog } = await import('@/lib/models/audit-log.model');
      auditLogs = await AuditLog.findByUserId(userId);
    } catch (error) {
      console.log('Audit log model not found, skipping...');
    }

    // Price history is already enriched with product URLs
    const enrichedPriceHistory = priceHistory;

    return {
      exportDate: new Date().toISOString(),
      exportedBy: userId,
      user: {
        ...user,
        _id: undefined, // Remove internal MongoDB ID
      },
      trackedProducts: trackedProducts.map(tp => ({
        ...tp,
        _id: undefined,
        userId: undefined // Remove user ID from export for cleaner data
      })),
      products: products.map(p => ({
        ...p,
        _id: undefined,
        url: p.url,
        title: p.title,
        brand: p.brand,
        category: p.category,
        currentPrice: p.currentPrice,
        currency: p.currency,
        lastUpdated: (p as any).updatedAt || p.lastScrapedAt || new Date()
      })),
      priceHistory: enrichedPriceHistory,
      auditLogs: auditLogs.map(log => ({
        action: log.action,
        entityType: log.entityType,
        timestamp: log.timestamp,
        changes: log.changes
      })),
      metadata: {
        totalTrackedProducts: trackedProducts.length,
        totalPriceHistoryRecords: priceHistory.length,
        totalAuditLogEntries: auditLogs.length,
        dataRetentionPolicy: '90 days for price history, 7 years for audit logs',
        exportFormat: 'JSON',
        gdprCompliant: true
      }
    };

  } catch (error) {
    console.error('Error in exportUserData:', error);
    Sentry.captureException(error);
    throw error;
  }
}

async function logDataExport(userId: string, request: NextRequest): Promise<void> {
  try {
    const { AuditLog } = await import('@/lib/models/audit-log.model');
    
    const ipAddress = request.headers.get('x-forwarded-for') || 
                     request.headers.get('x-real-ip') || 
                     'unknown';
    
    const userAgent = request.headers.get('user-agent') || 'unknown';

    await AuditLog.create({
      userId,
      action: 'data_exported',
      entityType: 'user_data',
      entityId: userId,
      changes: {
        exportType: 'full_user_data',
        requestedAt: new Date()
      },
      ipAddress: ipAddress.split(',')[0].trim(),
      userAgent,
      timestamp: new Date()
    });
  } catch (error) {
    // Don't fail the main operation if logging fails
    console.error('Failed to log data export:', error);
    Sentry.captureException(error);
  }
}