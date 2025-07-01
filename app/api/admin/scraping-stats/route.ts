import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs';
import { connectToDB } from '@/lib/mongoose';
import { redis } from '@/lib/upstash';
import { getQueueStats } from '@/lib/scraper/queue';
import { getScrapingStats } from '@/lib/scraper/resilient-scraper';
import Product from '@/lib/models/product.model';
import User from '@/lib/models/user.model';

export async function GET(request: NextRequest) {
  try {
    // Check authentication and admin role
    const { userId } = auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectToDB();
    
    // Check if user is admin
    const user = await User.findOne({ clerkId: userId });
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    // Get query parameters for time range
    const searchParams = request.nextUrl.searchParams;
    const timeRange = searchParams.get('range') || '24h';
    const detailed = searchParams.get('detailed') === 'true';

    // Gather comprehensive scraping analytics
    const [
      queueStats,
      scrapingStats,
      systemMetrics,
      productStats,
      userStats,
      cronStats,
      errorStats
    ] = await Promise.all([
      getQueueStats(),
      getScrapingStats(),
      getSystemMetrics(timeRange),
      getProductStats(),
      getUserStats(),
      getCronStats(timeRange),
      getErrorStats(timeRange)
    ]);

    const analytics = {
      timestamp: new Date().toISOString(),
      timeRange,
      overview: {
        totalProducts: productStats.total,
        activeProducts: productStats.active,
        totalUsers: userStats.total,
        activeUsers: userStats.active,
        queueHealth: queueStats ? 'healthy' : 'degraded',
      },
      queue: queueStats,
      scraping: {
        strategies: scrapingStats,
        systemMetrics,
        performance: await getPerformanceMetrics(timeRange),
      },
      products: productStats,
      users: userStats,
      cron: cronStats,
      errors: errorStats,
    };

    // Add detailed information if requested
    if (detailed) {
      analytics.detailed = {
        recentFailures: await getRecentFailures(),
        topProducts: await getTopProducts(),
        alertsSent: await getRecentAlerts(timeRange),
      };
    }

    return NextResponse.json({
      success: true,
      data: analytics,
    });

  } catch (error: any) {
    console.error('Error fetching scraping analytics:', error);
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

// Get system-level metrics
async function getSystemMetrics(timeRange: string) {
  try {
    const keys = [
      'scraping:jobs:created',
      'scraping:jobs:completed',
      'scraping:jobs:failed',
      'scraping:requests:total',
      'scraping:cache:hits',
      'scraping:cache:misses',
    ];

    const values = await redis.mget(...keys);
    const metrics = keys.reduce((acc, key, index) => {
      acc[key.split(':')[1]] = parseInt(values[index] as string) || 0;
      return acc;
    }, {} as Record<string, number>);

    // Calculate success rate
    const total = metrics.completed + metrics.failed;
    metrics.successRate = total > 0 ? ((metrics.completed / total) * 100) : 0;

    // Calculate cache hit rate
    const cacheTotal = metrics.hits + metrics.misses;
    metrics.cacheHitRate = cacheTotal > 0 ? ((metrics.hits / cacheTotal) * 100) : 0;

    return metrics;
  } catch (error) {
    console.error('Error getting system metrics:', error);
    return {};
  }
}

// Get product-related statistics
async function getProductStats() {
  try {
    const [
      total,
      active,
      bySource,
      byAvailability,
      avgPrice,
      priceRanges
    ] = await Promise.all([
      Product.countDocuments({}),
      Product.countDocuments({ isActive: true, trackingStatus: 'active' }),
      Product.aggregate([
        { $group: { _id: '$source', count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ]),
      Product.aggregate([
        { $group: { _id: '$availability', count: { $sum: 1 } } }
      ]),
      Product.aggregate([
        { $group: { _id: null, avgPrice: { $avg: '$currentPrice' } } }
      ]),
      Product.aggregate([
        {
          $bucket: {
            groupBy: '$currentPrice',
            boundaries: [0, 50, 100, 250, 500, 1000, 2000, 5000],
            default: '5000+',
            output: { count: { $sum: 1 } }
          }
        }
      ])
    ]);

    return {
      total,
      active,
      bySource: bySource.reduce((acc, item) => {
        acc[item._id] = item.count;
        return acc;
      }, {}),
      byAvailability: byAvailability.reduce((acc, item) => {
        acc[item._id] = item.count;
        return acc;
      }, {}),
      averagePrice: avgPrice[0]?.avgPrice || 0,
      priceDistribution: priceRanges,
    };
  } catch (error) {
    console.error('Error getting product stats:', error);
    return { total: 0, active: 0 };
  }
}

// Get user-related statistics
async function getUserStats() {
  try {
    const [
      total,
      active,
      byTier,
      byStatus
    ] = await Promise.all([
      User.countDocuments({}),
      User.countDocuments({ status: 'active' }),
      User.aggregate([
        { $group: { _id: '$subscription.plan', count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ]),
      User.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 } } }
      ])
    ]);

    return {
      total,
      active,
      byTier: byTier.reduce((acc, item) => {
        acc[item._id] = item.count;
        return acc;
      }, {}),
      byStatus: byStatus.reduce((acc, item) => {
        acc[item._id] = item.count;
        return acc;
      }, {}),
    };
  } catch (error) {
    console.error('Error getting user stats:', error);
    return { total: 0, active: 0 };
  }
}

// Get cron job execution statistics
async function getCronStats(timeRange: string) {
  try {
    const today = new Date().toISOString().split('T')[0];
    
    const [
      totalExecutions,
      todayExecutions,
      lastExecution,
      jobsCreated
    ] = await redis.mget(
      'cron:executions:total',
      `cron:executions:${today}`,
      'cron:last_execution',
      'cron:jobs:created'
    );

    return {
      totalExecutions: parseInt(totalExecutions as string) || 0,
      todayExecutions: parseInt(todayExecutions as string) || 0,
      lastExecution: lastExecution ? new Date(parseInt(lastExecution as string)).toISOString() : null,
      totalJobsCreated: parseInt(jobsCreated as string) || 0,
      isHealthy: lastExecution ? (Date.now() - parseInt(lastExecution as string)) < 3600000 : false // Within 1 hour
    };
  } catch (error) {
    console.error('Error getting cron stats:', error);
    return {};
  }
}

// Get error statistics
async function getErrorStats(timeRange: string) {
  try {
    // Get error counts by strategy
    const strategies = ['flip-enhanced', 'fallback', 'cached'];
    const errorCounts = {};

    for (const strategy of strategies) {
      const errors = await redis.get(`scraping:failure:${strategy}`);
      errorCounts[strategy] = parseInt(errors as string) || 0;
    }

    // Get recent blocked products
    const blockedCount = await Product.countDocuments({
      'scraping.isBlocked': true,
      'scraping.blockedAt': { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
    });

    return {
      byStrategy: errorCounts,
      recentlyBlocked: blockedCount,
      totalErrors: Object.values(errorCounts).reduce((sum: number, count: any) => sum + count, 0),
    };
  } catch (error) {
    console.error('Error getting error stats:', error);
    return {};
  }
}

// Get performance metrics
async function getPerformanceMetrics(timeRange: string) {
  try {
    // Calculate response times and success rates
    const recentProducts = await Product.aggregate([
      {
        $match: {
          lastScrapedAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
        }
      },
      {
        $group: {
          _id: null,
          avgResponseTime: { $avg: '$scraping.avgResponseTime' },
          totalAttempts: { $sum: '$scraping.totalAttempts' },
          successfulAttempts: { $sum: '$scraping.successfulAttempts' },
          products: { $sum: 1 }
        }
      }
    ]);

    const metrics = recentProducts[0] || {};
    
    return {
      avgResponseTime: metrics.avgResponseTime || 0,
      successRate: metrics.totalAttempts > 0 
        ? ((metrics.successfulAttempts / metrics.totalAttempts) * 100) 
        : 0,
      productsScraped: metrics.products || 0,
      requestsPerSecond: metrics.products ? (metrics.products / (24 * 60 * 60)) : 0,
    };
  } catch (error) {
    console.error('Error getting performance metrics:', error);
    return {};
  }
}

// Get recent failures for debugging
async function getRecentFailures() {
  try {
    const failures = await Product.find({
      'scraping.lastFailedAt': { $gte: new Date(Date.now() - 6 * 60 * 60 * 1000) },
      'scraping.failureCount': { $gte: 3 }
    })
    .select('url title source scraping.failureCount scraping.lastFailedAt')
    .sort({ 'scraping.lastFailedAt': -1 })
    .limit(10)
    .lean();

    return failures.map(product => ({
      url: product.url,
      title: product.title,
      source: product.source,
      failureCount: product.scraping?.failureCount || 0,
      lastFailedAt: product.scraping?.lastFailedAt,
    }));
  } catch (error) {
    console.error('Error getting recent failures:', error);
    return [];
  }
}

// Get top performing products
async function getTopProducts() {
  try {
    const topProducts = await Product.find({
      isActive: true,
      'analytics.trackingCount': { $gte: 3 }
    })
    .select('url title analytics.trackingCount analytics.popularityScore currentPrice')
    .sort({ 'analytics.popularityScore': -1 })
    .limit(10)
    .lean();

    return topProducts.map(product => ({
      url: product.url,
      title: product.title,
      trackingCount: product.analytics?.trackingCount || 0,
      popularityScore: product.analytics?.popularityScore || 0,
      currentPrice: product.currentPrice,
    }));
  } catch (error) {
    console.error('Error getting top products:', error);
    return [];
  }
}

// Get recent alerts sent
async function getRecentAlerts(timeRange: string) {
  try {
    const alertKeys = await redis.keys('alerts:sent:*');
    const recentAlerts = [];

    for (const key of alertKeys.slice(-50)) { // Last 50 alerts
      const alertData = await redis.get(key);
      if (alertData) {
        try {
          recentAlerts.push(JSON.parse(alertData as string));
        } catch (e) {
          // Skip invalid JSON
        }
      }
    }

    return recentAlerts
      .sort((a, b) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime())
      .slice(0, 20);
  } catch (error) {
    console.error('Error getting recent alerts:', error);
    return [];
  }
}