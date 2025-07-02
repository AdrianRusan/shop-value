import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { connectToDB } from '@/lib/mongoose';
import User from '@/lib/models/user.model';
import Product from '@/lib/models/product.model';
import Analytics from '@/lib/models/analytics.model';
import UserProductTracking from '@/lib/models/user-product-tracking.model';
import { redis } from '@/lib/upstash';
import { startOfDay, startOfWeek, startOfMonth, subDays, subWeeks, subMonths } from 'date-fns';

// Admin-only endpoint for analytics
export async function GET(request: NextRequest) {
  try {
    // Check authentication and admin role
    const { userId } = auth();
    if (!userId) {
      return NextResponse.json({ 
        success: false, 
        error: 'Unauthorized' 
      }, { status: 401 });
    }

    await connectToDB();

    // Get user from database to check admin role
    const user = await User.findOne({ clerkId: userId });
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ 
        success: false, 
        error: 'Admin access required' 
      }, { status: 403 });
    }

    const searchParams = request.nextUrl.searchParams;
    const timeRange = searchParams.get('range') || '30d';
    const detailed = searchParams.get('detailed') === 'true';

    // Calculate date ranges
    const now = new Date();
    const dateRanges = calculateDateRanges(timeRange, now);

    // Get cached data first
    const cacheKey = `admin:analytics:${timeRange}:${detailed ? 'detailed' : 'summary'}`;
    const cached = await redis.get(cacheKey);
    
    if (cached && !detailed) {
      return NextResponse.json({
        success: true,
        data: cached,
        cached: true,
        timestamp: new Date().toISOString()
      });
    }

    // Gather analytics data
    const [
      userMetrics,
      subscriptionMetrics,
      productMetrics,
      systemMetrics,
      revenueMetrics
    ] = await Promise.all([
      getUserMetrics(dateRanges),
      getSubscriptionMetrics(dateRanges),
      getProductMetrics(dateRanges),
      getSystemMetrics(dateRanges),
      getRevenueMetrics(dateRanges)
    ]);

    const analytics = {
      timestamp: new Date().toISOString(),
      timeRange,
      overview: {
        totalUsers: userMetrics.total,
        activeUsers: userMetrics.active,
        totalRevenue: revenueMetrics.total,
        totalProducts: productMetrics.total,
        systemHealth: systemMetrics.health
      },
      userMetrics,
      subscriptionMetrics,
      productMetrics,
      systemMetrics,
      revenueMetrics,
      ...(detailed && {
        trends: await getTrends(dateRanges),
        topUsers: await getTopUsers(10),
        popularProducts: await getPopularProducts(10)
      })
    };

    // Cache for 5 minutes
    await redis.setex(cacheKey, 300, analytics);

    return NextResponse.json({
      success: true,
      data: analytics,
      cached: false,
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('Error fetching admin analytics:', error);
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

// Helper functions
function calculateDateRanges(timeRange: string, now: Date) {
  switch (timeRange) {
    case '7d':
      return {
        start: subDays(now, 7),
        end: now,
        previousStart: subDays(now, 14),
        previousEnd: subDays(now, 7)
      };
    case '30d':
      return {
        start: subDays(now, 30),
        end: now,
        previousStart: subDays(now, 60),
        previousEnd: subDays(now, 30)
      };
    case '90d':
      return {
        start: subDays(now, 90),
        end: now,
        previousStart: subDays(now, 180),
        previousEnd: subDays(now, 90)
      };
    default:
      return {
        start: subDays(now, 30),
        end: now,
        previousStart: subDays(now, 60),
        previousEnd: subDays(now, 30)
      };
  }
}

async function getUserMetrics(dateRanges: any) {
  const [totalUsers, activeUsers, newUsers, previousNewUsers] = await Promise.all([
    User.countDocuments({ status: 'active', deletedAt: { $exists: false } }),
    User.countDocuments({ 
      status: 'active', 
      deletedAt: { $exists: false },
      lastLoginAt: { $gte: dateRanges.start }
    }),
    User.countDocuments({ 
      status: 'active',
      createdAt: { $gte: dateRanges.start, $lte: dateRanges.end }
    }),
    User.countDocuments({ 
      status: 'active',
      createdAt: { $gte: dateRanges.previousStart, $lte: dateRanges.previousEnd }
    })
  ]);

  const growth = previousNewUsers > 0 ? 
    ((newUsers - previousNewUsers) / previousNewUsers) * 100 : 
    newUsers > 0 ? 100 : 0;

  return {
    total: totalUsers,
    active: activeUsers,
    new: newUsers,
    growth: Math.round(growth * 100) / 100,
    activeRate: totalUsers > 0 ? Math.round((activeUsers / totalUsers) * 100) : 0
  };
}

async function getSubscriptionMetrics(dateRanges: any) {
  const [
    freeUsers,
    proUsers,
    enterpriseUsers,
    newSubscriptions,
    canceledSubscriptions
  ] = await Promise.all([
    User.countDocuments({ 
      'subscription.plan': 'free',
      status: 'active'
    }),
    User.countDocuments({ 
      'subscription.plan': 'pro',
      'subscription.status': 'active',
      status: 'active'
    }),
    User.countDocuments({ 
      'subscription.plan': 'enterprise',
      'subscription.status': 'active',
      status: 'active'
    }),
    User.countDocuments({
      'subscription.plan': { $in: ['pro', 'enterprise'] },
      'subscription.currentPeriodStart': { $gte: dateRanges.start }
    }),
    User.countDocuments({
      'subscription.status': 'cancelled',
      'subscription.canceledAt': { $gte: dateRanges.start }
    })
  ]);

  const totalPaid = proUsers + enterpriseUsers;
  const totalUsers = freeUsers + totalPaid;
  const conversionRate = totalUsers > 0 ? Math.round((totalPaid / totalUsers) * 100) : 0;

  return {
    byPlan: {
      free: freeUsers,
      pro: proUsers,
      enterprise: enterpriseUsers
    },
    totalPaid,
    conversionRate,
    newSubscriptions,
    canceledSubscriptions,
    churnRate: totalPaid > 0 ? Math.round((canceledSubscriptions / totalPaid) * 100) : 0
  };
}

async function getProductMetrics(dateRanges: any) {
  const [
    totalProducts,
    activeProducts,
    newProducts,
    averageTrackedPerUser
  ] = await Promise.all([
    Product.countDocuments({ status: 'active' }),
    Product.countDocuments({ 
      status: 'active',
      lastScrapedAt: { $gte: subDays(new Date(), 1) }
    }),
    Product.countDocuments({
      createdAt: { $gte: dateRanges.start }
    }),
    UserProductTracking.aggregate([
      {
        $group: {
          _id: '$userId',
          productCount: { $sum: 1 }
        }
      },
      {
        $group: {
          _id: null,
          averageProducts: { $avg: '$productCount' }
        }
      }
    ])
  ]);

  return {
    total: totalProducts,
    active: activeProducts,
    new: newProducts,
    averagePerUser: averageTrackedPerUser[0]?.averageProducts || 0,
    activeRate: totalProducts > 0 ? Math.round((activeProducts / totalProducts) * 100) : 0
  };
}

async function getSystemMetrics(dateRanges: any) {
  try {
    const [scrapingStats, errorCounts] = await Promise.all([
      redis.mget(
        'scraping:jobs:created',
        'scraping:jobs:completed', 
        'scraping:jobs:failed'
      ),
      redis.get('system:errors:count') || '0'
    ]);

    const [created, completed, failed] = scrapingStats.map(s => parseInt(s as string) || 0);
    const total = completed + failed;
    const successRate = total > 0 ? Math.round((completed / total) * 100) : 0;

    return {
      health: successRate >= 95 ? 'excellent' : successRate >= 85 ? 'good' : 'needs attention',
      scraping: {
        successRate,
        totalJobs: total,
        completed,
        failed
      },
      errors: parseInt(errorCounts as string) || 0,
      uptime: '99.9%' // This would come from monitoring service
    };
  } catch (error) {
    return {
      health: 'unknown',
      scraping: { successRate: 0, totalJobs: 0, completed: 0, failed: 0 },
      errors: 0,
      uptime: 'unknown'
    };
  }
}

async function getRevenueMetrics(dateRanges: any) {
  const subscriptions = await User.aggregate([
    {
      $match: {
        'subscription.status': 'active',
        'subscription.plan': { $in: ['pro', 'enterprise'] }
      }
    },
    {
      $group: {
        _id: '$subscription.plan',
        count: { $sum: 1 }
      }
    }
  ]);

  const planPrices = { pro: 19.99, enterprise: 49.99 };
  let total = 0;
  const breakdown: Record<string, number> = {};

  subscriptions.forEach((sub: { _id: string; count: number }) => {
    const monthlyRevenue = sub.count * planPrices[sub._id as keyof typeof planPrices];
    breakdown[sub._id] = monthlyRevenue;
    total += monthlyRevenue;
  });

  return {
    total: Math.round(total * 100) / 100,
    monthly: Math.round(total * 100) / 100,
    annual: Math.round(total * 12 * 100) / 100,
    breakdown
  };
}

async function getTrends(dateRanges: any) {
  // This would typically come from the Analytics model
  // For now, return sample trend data
  return {
    userGrowth: [],
    revenue: [],
    productTracking: []
  };
}

async function getTopUsers(limit: number) {
  return User.find({ status: 'active' })
    .sort({ 'usage.productsTracked': -1 })
    .limit(limit)
    .select('firstName lastName email subscription.plan usage.productsTracked')
    .lean();
}

async function getPopularProducts(limit: number) {
  return UserProductTracking.aggregate([
    {
      $group: {
        _id: '$productId',
        trackingCount: { $sum: 1 }
      }
    },
    {
      $lookup: {
        from: 'products',
        localField: '_id',
        foreignField: '_id',
        as: 'product'
      }
    },
    {
      $unwind: '$product'
    },
    {
      $sort: { trackingCount: -1 }
    },
    {
      $limit: limit
    },
    {
      $project: {
        title: '$product.title',
        brand: '$product.brand',
        currentPrice: '$product.currentPrice',
        trackingCount: 1
      }
    }
  ]);
}