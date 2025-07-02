import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { connectToDB } from '@/lib/mongoose';
import User from '@/lib/models/user.model';
import { redis } from '@/lib/upstash';
import { scheduleAnalyticsJob } from '@/lib/services/analytics-etl';
import * as Sentry from '@sentry/nextjs';
import { differenceInDays, format } from 'date-fns';

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/analytics/ltv
 * Retrieve Customer Lifetime Value analysis
 */
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

    // Verify admin role
    const user = await User.findOne({ clerkId: userId });
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ 
        success: false, 
        error: 'Admin access required' 
      }, { status: 403 });
    }

    const searchParams = request.nextUrl.searchParams;
    const plan = searchParams.get('plan'); // Filter by plan
    const refresh = searchParams.get('refresh') === 'true';
    const detailed = searchParams.get('detailed') === 'true';

    // Check cache first unless refresh is requested
    if (!refresh) {
      const cacheKey = `analytics:ltv${plan ? `:${plan}` : ''}${detailed ? ':detailed' : ''}`;
      const cachedData = await redis.get(cacheKey);
      if (cachedData) {
        return NextResponse.json({
          success: true,
          data: JSON.parse(cachedData as string),
          cached: true,
          timestamp: new Date().toISOString()
        });
      }
    }

    // Schedule ETL job for detailed LTV calculation
    await scheduleAnalyticsJob('compute_ltv', { plan });

    // For immediate response, calculate basic LTV metrics
    const ltvData = await calculateBasicLTV(plan, detailed);

    // Cache the result
    const cacheKey = `analytics:ltv${plan ? `:${plan}` : ''}${detailed ? ':detailed' : ''}`;
    await redis.setex(cacheKey, 3600, JSON.stringify(ltvData)); // Cache for 1 hour

    return NextResponse.json({
      success: true,
      data: ltvData,
      cached: false,
      message: detailed ? 'Detailed LTV analysis is being processed in the background' : undefined,
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('Error fetching LTV analytics:', error);
    Sentry.captureException(error);
    
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch LTV analytics',
        details: error.message 
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/analytics/ltv
 * Trigger LTV calculation
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = auth();
    if (!userId) {
      return NextResponse.json({ 
        success: false, 
        error: 'Unauthorized' 
      }, { status: 401 });
    }

    await connectToDB();

    const user = await User.findOne({ clerkId: userId });
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ 
        success: false, 
        error: 'Admin access required' 
      }, { status: 403 });
    }

    const body = await request.json();
    const { recalculateAll = false, priority = false } = body;

    // Schedule ETL job with options
    await scheduleAnalyticsJob(
      'compute_ltv', 
      { recalculateAll }, 
      priority ? 0 : undefined
    );

    return NextResponse.json({
      success: true,
      message: 'LTV calculation has been scheduled',
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('Error scheduling LTV calculation:', error);
    Sentry.captureException(error);
    
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to schedule LTV calculation',
        details: error.message 
      },
      { status: 500 }
    );
  }
}

/**
 * Calculate basic LTV metrics for immediate response
 */
async function calculateBasicLTV(planFilter?: string | null, detailed: boolean = false) {
  const planPrices = { pro: 19.99, enterprise: 49.99, free: 0 };
  
  // Build query filter
  const matchQuery: any = { 
    status: 'active',
    'subscription.status': 'active'
  };
  
  if (planFilter && planFilter !== 'all') {
    matchQuery['subscription.plan'] = planFilter;
  }

  // Get all paid subscribers
  const paidUsers = await User.find({
    ...matchQuery,
    'subscription.plan': { $in: ['pro', 'enterprise'] }
  }).select('subscription createdAt lastLoginAt');

  if (paidUsers.length === 0) {
    return {
      summary: {
        totalUsers: 0,
        averageLTV: 0,
        totalRevenue: 0,
        averageLifespan: 0
      },
      byPlan: {},
      cohorts: [],
      detailed: detailed
    };
  }

  // Calculate basic metrics
  const ltvData = paidUsers.map(user => {
    const plan = user.subscription.plan;
    const monthlyRevenue = planPrices[plan as keyof typeof planPrices] || 0;
    const daysActive = differenceInDays(new Date(), user.createdAt);
    const monthsActive = Math.max(1, Math.floor(daysActive / 30));
    const currentLTV = monthlyRevenue * monthsActive;

    return {
      userId: user._id.toString(),
      plan,
      currentLTV,
      monthsActive,
      daysActive,
      cohortMonth: format(user.createdAt, 'yyyy-MM'),
      isActive: user.lastLoginAt && 
        differenceInDays(new Date(), user.lastLoginAt) <= 30
    };
  });

  // Aggregate by plan
  const byPlan: Record<string, any> = {};
  const cohortData: Record<string, any[]> = {};

  ['pro', 'enterprise'].forEach(plan => {
    const planUsers = ltvData.filter(u => u.plan === plan);
    if (planUsers.length === 0) return;

    const totalLTV = planUsers.reduce((sum, u) => sum + u.currentLTV, 0);
    const averageLTV = totalLTV / planUsers.length;
    const averageLifespan = planUsers.reduce((sum, u) => sum + u.monthsActive, 0) / planUsers.length;
    const activeUsers = planUsers.filter(u => u.isActive).length;
    const churnRate = ((planUsers.length - activeUsers) / planUsers.length) * 100;

    byPlan[plan] = {
      userCount: planUsers.length,
      totalRevenue: totalLTV,
      averageLTV: Math.round(averageLTV * 100) / 100,
      averageLifespan: Math.round(averageLifespan * 10) / 10,
      activeUsers,
      churnRate: Math.round(churnRate * 10) / 10,
      monthlyRevenue: planPrices[plan as keyof typeof planPrices] * planUsers.length
    };

    // Group by cohort month
    planUsers.forEach(user => {
      if (!cohortData[user.cohortMonth]) {
        cohortData[user.cohortMonth] = [];
      }
      cohortData[user.cohortMonth].push(user);
    });
  });

  // Calculate cohort-based LTV
  const cohorts = Object.keys(cohortData).map(month => {
    const users = cohortData[month];
    const totalLTV = users.reduce((sum, u) => sum + u.currentLTV, 0);
    const averageLTV = totalLTV / users.length;
    const activeUsers = users.filter(u => u.isActive).length;
    const retentionRate = (activeUsers / users.length) * 100;

    return {
      month,
      userCount: users.length,
      totalLTV,
      averageLTV: Math.round(averageLTV * 100) / 100,
      retentionRate: Math.round(retentionRate * 10) / 10,
      plans: users.reduce((acc: Record<string, number>, u) => {
        acc[u.plan] = (acc[u.plan] || 0) + 1;
        return acc;
      }, {})
    };
  }).sort((a, b) => b.month.localeCompare(a.month)); // Sort by month, newest first

  // Summary metrics
  const totalLTV = ltvData.reduce((sum, u) => sum + u.currentLTV, 0);
  const averageLTV = totalLTV / ltvData.length;
  const averageLifespan = ltvData.reduce((sum, u) => sum + u.monthsActive, 0) / ltvData.length;
  const activeUsers = ltvData.filter(u => u.isActive).length;
  const overallChurnRate = ((ltvData.length - activeUsers) / ltvData.length) * 100;

  const result: any = {
    summary: {
      totalUsers: ltvData.length,
      activeUsers,
      averageLTV: Math.round(averageLTV * 100) / 100,
      totalRevenue: Math.round(totalLTV * 100) / 100,
      averageLifespan: Math.round(averageLifespan * 10) / 10,
      churnRate: Math.round(overallChurnRate * 10) / 10,
      projectedAnnualRevenue: Math.round(
        Object.values(byPlan).reduce((sum: number, plan: any) => 
          sum + (plan.monthlyRevenue * 12), 0
        ) * 100
      ) / 100
    },
    byPlan,
    cohorts: cohorts.slice(0, 12), // Last 12 months
    detailed,
    calculatedAt: new Date().toISOString()
  };

  // Add individual user data for detailed view
  if (detailed) {
    result.users = ltvData.slice(0, 100); // Limit to 100 users for response size
  }

  return result;
}