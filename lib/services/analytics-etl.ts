/**
 * Advanced Analytics ETL Service
 * Processes raw analytics data into business intelligence insights
 */

import { Queue, Worker, Job } from 'bullmq';
import { redis } from '@/lib/upstash';
import { connectToDB } from '@/lib/mongoose';
import Analytics from '@/lib/models/analytics.model';
import User from '@/lib/models/user.model';
import UserProductTracking from '@/lib/models/user-product-tracking.model';
import * as Sentry from '@sentry/nextjs';
import {
  startOfDay,
  startOfWeek,
  startOfMonth,
  endOfDay,
  endOfWeek,
  endOfMonth,
  subDays,
  subWeeks,
  subMonths,
  format,
  differenceInDays,
  parseISO
} from 'date-fns';

// ETL Job Types
export type ETLJobType = 
  | 'process_daily_metrics'
  | 'calculate_cohorts'
  | 'compute_ltv'
  | 'aggregate_revenue'
  | 'generate_reports'
  | 'clean_old_data';

// Data Processing Interfaces
interface CohortData {
  cohortMonth: string;
  userCount: number;
  retentionWeeks: Record<number, number>;
  retentionPercentages: Record<number, number>;
}

interface LTVCalculation {
  userId: string;
  currentLTV: number;
  predictedLTV: number;
  subscriptionTier: string;
  cohortMonth: string;
  daysActive: number;
  totalRevenue: number;
}

interface BusinessMetrics {
  date: Date;
  totalUsers: number;
  activeUsers: number;
  newUsers: number;
  churnedUsers: number;
  revenue: number;
  subscriptions: {
    free: number;
    pro: number;
    enterprise: number;
  };
  retention: {
    day1: number;
    day7: number;
    day30: number;
  };
}

class AnalyticsETLService {
  private etlQueue: Queue | null = null;
  private worker: Worker | null = null;
  private isWorkerRunning = false;
  private isInitialized = false;

  constructor() {
    // Only skip initialization during actual build time
    if (process.env.BUILDING) {
      console.log('Skipping ETL service initialization during build time');
      return;
    }
    // Lazy initialization will handle missing Redis environment variables gracefully
  }

  /**
   * Check if Redis environment variables are available
   * This is separate from runtime environment detection to avoid blocking initialization
   */
  private hasRedisEnvironment(): boolean {
    return !!(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
  }

  /**
   * Check if we're in a server-side environment (not browser)
   */
  private isServerSide(): boolean {
    return typeof window === 'undefined';
  }

  /**
   * Check if we're in development mode with mock Redis
   */
  private isDevelopmentMode(): boolean {
    return process.env.UPSTASH_REDIS_REST_URL === 'mock' || 
           process.env.NODE_ENV === 'development';
  }

  /**
   * Lazy initialization of Redis connections
   */
  private async ensureInitialized(): Promise<boolean> {
    if (this.isInitialized) {
      return true;
    }

    // Check if we're in development mode
    if (this.isDevelopmentMode()) {
      console.log('ETL service running in development mode (Redis disabled)');
      this.isInitialized = true;
      return true;
    }

    // Check if Redis environment variables are available
    if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
      console.warn('Redis environment variables not available. ETL service disabled.');
      return false;
    }

    try {
      // Initialize the ETL queue
      this.etlQueue = new Queue('analytics-etl', {
        connection: redis as any,
        defaultJobOptions: {
          removeOnComplete: 100,
          removeOnFail: 50,
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 5000,
          },
        },
      });

      // Initialize the worker
      this.worker = new Worker('analytics-etl', this.processJob.bind(this), {
        connection: redis as any,
        concurrency: 5,
      });

      this.setupEventHandlers();
      this.isInitialized = true;
      console.log('Analytics ETL service initialized successfully');
      return true;
    } catch (error) {
      console.error('Failed to initialize Analytics ETL service:', error);
      Sentry.captureException(error);
      return false;
    }
  }

  /**
   * Setup event handlers for monitoring
   */
  private setupEventHandlers(): void {
    if (!this.worker) return;

    this.worker.on('completed', (job: Job) => {
      console.log(`ETL job ${job.name} completed successfully`);
    });

    this.worker.on('failed', (job: Job | undefined, err: Error) => {
      console.error(`ETL job ${job?.name} failed:`, err);
      Sentry.captureException(err, {
        tags: {
          jobType: job?.name,
          jobId: job?.id,
        },
      });
    });

    this.worker.on('progress', (job: Job, progress: any) => {
      const progressPercent = typeof progress === 'number' ? progress : 
        (typeof progress === 'object' && progress?.percentage) ? progress.percentage : 0;
      console.log(`ETL job ${job.name} progress: ${progressPercent}%`);
    });
  }

  /**
   * Process ETL job based on type
   */
  private async processJob(job: Job): Promise<any> {
    const { type, data } = job.data;

    try {
      await connectToDB();

      switch (type as ETLJobType) {
        case 'process_daily_metrics':
          return await this.processDailyMetrics(data);
        case 'calculate_cohorts':
          return await this.calculateCohorts(data);
        case 'compute_ltv':
          return await this.computeLTV(data);
        case 'aggregate_revenue':
          return await this.aggregateRevenue(data);
        case 'generate_reports':
          return await this.generateReports(data);
        case 'clean_old_data':
          return await this.cleanOldData(data);
        default:
          throw new Error(`Unknown ETL job type: ${type}`);
      }
    } catch (error) {
      console.error(`Error processing ETL job ${type}:`, error);
      throw error;
    }
  }

  /**
   * Schedule ETL jobs
   */
  async scheduleJob(type: ETLJobType, data: any = {}, delay?: number): Promise<void> {
    try {
      const initialized = await this.ensureInitialized();
      if (!initialized) {
        if (this.isDevelopmentMode()) {
          console.log(`Development mode: Simulating ETL job ${type}`);
          // In development mode, execute the job immediately
          try {
            await this.processJob({ name: type, data: { type, data } } as Job);
            return;
          } catch (error) {
            console.error(`Failed to process development ETL job ${type}:`, error);
            return;
          }
        }
        console.warn(`Cannot schedule ETL job ${type}: service not initialized`);
        return;
      }

      if (!this.etlQueue) {
        console.warn(`Cannot schedule ETL job ${type}: queue not available`);
        return;
      }

      await this.etlQueue.add(
        type,
        { type, data },
        {
          delay: delay || 0,
          priority: this.getJobPriority(type),
        }
      );
    } catch (error) {
      console.error(`Error scheduling ETL job ${type}:`, error);
      Sentry.captureException(error);
    }
  }

  /**
   * Get job priority based on type
   */
  private getJobPriority(type: ETLJobType): number {
    const priorities = {
      'process_daily_metrics': 1,
      'calculate_cohorts': 2,
      'compute_ltv': 3,
      'aggregate_revenue': 1,
      'generate_reports': 4,
      'clean_old_data': 5,
    };
    return priorities[type] || 3;
  }

  /**
   * Process daily business metrics
   */
  private async processDailyMetrics(data: { date?: Date } = {}): Promise<BusinessMetrics> {
    const targetDate = data.date || new Date();
    const dayStart = startOfDay(targetDate);
    const dayEnd = endOfDay(targetDate);

    console.log(`Processing daily metrics for ${format(targetDate, 'yyyy-MM-dd')}`);

    // Get user metrics
    const [totalUsers, activeUsers, newUsers, churnedUsers] = await Promise.all([
      User.countDocuments({ 
        status: 'active', 
        deletedAt: { $exists: false } 
      }),
      User.countDocuments({
        status: 'active',
        lastLoginAt: { $gte: dayStart, $lte: dayEnd }
      }),
      User.countDocuments({
        status: 'active',
        createdAt: { $gte: dayStart, $lte: dayEnd }
      }),
      User.countDocuments({
        status: 'suspended',
        updatedAt: { $gte: dayStart, $lte: dayEnd }
      })
    ]);

    // Get subscription breakdown
    const subscriptions = await User.aggregate([
      {
        $match: {
          status: 'active',
          'subscription.status': 'active'
        }
      },
      {
        $group: {
          _id: '$subscription.plan',
          count: { $sum: 1 }
        }
      }
    ]);

    const subscriptionBreakdown = {
      free: 0,
      pro: 0,
      enterprise: 0
    };

    subscriptions.forEach((sub: any) => {
      if (sub._id in subscriptionBreakdown) {
        subscriptionBreakdown[sub._id as keyof typeof subscriptionBreakdown] = sub.count;
      }
    });

    // Calculate revenue
    const revenue = await this.calculateDayRevenue(dayStart, dayEnd);

    // Calculate retention rates
    const retention = await this.calculateRetentionRates(targetDate);

    const metrics: BusinessMetrics = {
      date: targetDate,
      totalUsers,
      activeUsers,
      newUsers,
      churnedUsers,
      revenue,
      subscriptions: subscriptionBreakdown,
      retention
    };

    // Store in analytics collection
    await this.storeBusinessMetrics(metrics);

    return metrics;
  }

  /**
   * Calculate cohort analysis
   */
  private async calculateCohorts(data: { monthsBack?: number } = {}): Promise<CohortData[]> {
    const monthsBack = data.monthsBack || 12;
    const cohorts: CohortData[] = [];

    console.log(`Calculating cohort analysis for ${monthsBack} months`);

    for (let i = 0; i < monthsBack; i++) {
      const cohortDate = subMonths(new Date(), i);
      const cohortStart = startOfMonth(cohortDate);
      const cohortEnd = endOfMonth(cohortDate);

      // Get users who signed up in this cohort month
      const cohortUsers = await User.find({
        createdAt: { $gte: cohortStart, $lte: cohortEnd },
        status: 'active'
      }).select('_id clerkId createdAt lastLoginAt');

      if (cohortUsers.length === 0) continue;

      const cohortData: CohortData = {
        cohortMonth: format(cohortDate, 'yyyy-MM'),
        userCount: cohortUsers.length,
        retentionWeeks: {},
        retentionPercentages: {}
      };

      // Calculate retention for each week after signup
      for (let week = 1; week <= 12; week++) {
        // Calculate the start of the retention period
        // Week 1 = day 1 onwards, Week 2 = day 8 onwards, etc.
        const retentionPeriodStart = new Date(cohortStart);
        retentionPeriodStart.setDate(retentionPeriodStart.getDate() + ((week - 1) * 7));

        // Don't calculate retention for future weeks
        if (retentionPeriodStart > new Date()) break;

        // Count users who were active AT ANY POINT from the retention period start onwards
        // This is the correct cohort retention methodology: users are considered retained
        // if they were active at any time during or after the retention period
        const activeUsers = cohortUsers.filter(user => 
          user.lastLoginAt && 
          user.lastLoginAt >= retentionPeriodStart
        ).length;

        cohortData.retentionWeeks[week] = activeUsers;
        cohortData.retentionPercentages[week] = 
          Math.round((activeUsers / cohortUsers.length) * 100);
      }

      cohorts.push(cohortData);
    }

    // Store cohort data
    await this.storeCohortData(cohorts);

    return cohorts;
  }

  /**
   * Compute Customer Lifetime Value (LTV)
   */
  private async computeLTV(data: { recalculateAll?: boolean } = {}): Promise<LTVCalculation[]> {
    console.log('Computing Customer Lifetime Value...');

    const users = await User.find({
      status: 'active',
      'subscription.plan': { $in: ['pro', 'enterprise'] }
    }).select('clerkId subscription createdAt lastLoginAt');

    const ltvCalculations: LTVCalculation[] = [];

    for (const user of users) {
      const ltvData = await this.calculateUserLTV(user);
      ltvCalculations.push(ltvData);
    }

    // Store LTV calculations
    await this.storeLTVData(ltvCalculations);

    return ltvCalculations;
  }

  /**
   * Calculate individual user LTV
   */
  private async calculateUserLTV(user: any): Promise<LTVCalculation> {
    const planPrices = { pro: 19.99, enterprise: 49.99, free: 0 };
    const monthlyRevenue = planPrices[user.subscription.plan as keyof typeof planPrices] || 0;
    
    const daysActive = differenceInDays(new Date(), user.createdAt);
    const monthsActive = Math.max(1, Math.floor(daysActive / 30));
    
    // Current LTV (what they've paid so far)
    const currentLTV = monthlyRevenue * monthsActive;
    
    // Predicted LTV based on retention curves
    const retentionFactor = await this.getUserRetentionFactor(user);
    const averageLifespanMonths = this.getAverageLifespanByPlan(user.subscription.plan);
    const predictedLTV = monthlyRevenue * averageLifespanMonths * retentionFactor;

    return {
      userId: user.clerkId,
      currentLTV,
      predictedLTV,
      subscriptionTier: user.subscription.plan,
      cohortMonth: format(user.createdAt, 'yyyy-MM'),
      daysActive,
      totalRevenue: currentLTV
    };
  }

  /**
   * Get user retention factor based on behavior
   */
  private async getUserRetentionFactor(user: any): Promise<number> {
    // This would analyze user behavior patterns
    // For now, return a simplified calculation
    const daysActive = differenceInDays(new Date(), user.createdAt);
    const daysSinceLastLogin = user.lastLoginAt ? 
      differenceInDays(new Date(), user.lastLoginAt) : 999;

    if (daysSinceLastLogin > 30) return 0.5; // Low retention
    if (daysSinceLastLogin > 7) return 0.75; // Medium retention
    if (daysActive > 90) return 1.2; // High retention for long-term users
    
    return 1.0; // Default retention
  }

  /**
   * Get average lifespan by subscription plan
   */
  private getAverageLifespanByPlan(plan: string): number {
    const lifespans = {
      free: 3,      // 3 months average
      pro: 12,      // 12 months average
      enterprise: 24 // 24 months average
    };
    return lifespans[plan as keyof typeof lifespans] || 6;
  }

  /**
   * Aggregate revenue data
   */
  private async aggregateRevenue(data: { period?: 'daily' | 'weekly' | 'monthly' } = {}): Promise<any> {
    const period = data.period || 'daily';
    console.log(`Aggregating ${period} revenue data`);

    // Implementation would aggregate revenue by different time periods
    // This is a simplified version
    return { period, status: 'completed' };
  }

  /**
   * Generate comprehensive reports
   */
  private async generateReports(data: { reportType?: string } = {}): Promise<any> {
    console.log('Generating comprehensive reports...');

    const reports = {
      daily: await this.generateDailyReport(),
      weekly: await this.generateWeeklyReport(),
      monthly: await this.generateMonthlyReport()
    };

    // Store reports in cache for quick access
    if (this.isDevelopmentMode()) {
      console.log('Development mode: Reports generated but not cached', {
        hasDaily: !!reports.daily,
        hasWeekly: !!reports.weekly,
        hasMonthly: !!reports.monthly
      });
    } else {
      await Promise.all([
        redis.setex('reports:daily', 3600, JSON.stringify(reports.daily)),
        redis.setex('reports:weekly', 7200, JSON.stringify(reports.weekly)),
        redis.setex('reports:monthly', 14400, JSON.stringify(reports.monthly))
      ]);
    }

    return reports;
  }

  /**
   * Clean old analytics data
   */
  private async cleanOldData(data: { daysToKeep?: number } = {}): Promise<void> {
    const daysToKeep = data.daysToKeep || 90;
    const cutoffDate = subDays(new Date(), daysToKeep);

    console.log(`Cleaning analytics data older than ${daysToKeep} days`);

    await Analytics.updateMany(
      {},
      {
        $pull: {
          events: { timestamp: { $lt: cutoffDate } },
          systemMetrics: { timestamp: { $lt: cutoffDate } }
        }
      }
    );
  }

  /**
   * Helper: Calculate daily revenue
   */
  private async calculateDayRevenue(dayStart: Date, dayEnd: Date): Promise<number> {
    const activeSubscriptions = await User.aggregate([
      {
        $match: {
          'subscription.status': 'active',
          'subscription.plan': { $in: ['pro', 'enterprise'] },
          'subscription.currentPeriodStart': { $lte: dayEnd },
          'subscription.currentPeriodEnd': { $gte: dayStart }
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
    let totalRevenue = 0;

    activeSubscriptions.forEach((sub: any) => {
      const dailyRevenue = (planPrices[sub._id as keyof typeof planPrices] || 0) / 30;
      totalRevenue += dailyRevenue * sub.count;
    });

    return Math.round(totalRevenue * 100) / 100;
  }

  /**
   * Helper: Calculate retention rates
   */
  private async calculateRetentionRates(targetDate: Date): Promise<{ day1: number; day7: number; day30: number }> {
    const day1Users = await User.countDocuments({
      createdAt: { $gte: subDays(targetDate, 1) },
      lastLoginAt: { $gte: subDays(targetDate, 1) }
    });

    const day7Users = await User.countDocuments({
      createdAt: { $gte: subDays(targetDate, 7) },
      lastLoginAt: { $gte: subDays(targetDate, 1) }
    });

    const day30Users = await User.countDocuments({
      createdAt: { $gte: subDays(targetDate, 30) },
      lastLoginAt: { $gte: subDays(targetDate, 1) }
    });

    const totalDay1 = await User.countDocuments({
      createdAt: { $gte: subDays(targetDate, 1) }
    });

    const totalDay7 = await User.countDocuments({
      createdAt: { $gte: subDays(targetDate, 7) }
    });

    const totalDay30 = await User.countDocuments({
      createdAt: { $gte: subDays(targetDate, 30) }
    });

    return {
      day1: totalDay1 > 0 ? Math.round((day1Users / totalDay1) * 100) : 0,
      day7: totalDay7 > 0 ? Math.round((day7Users / totalDay7) * 100) : 0,
      day30: totalDay30 > 0 ? Math.round((day30Users / totalDay30) * 100) : 0
    };
  }

  /**
   * Store processed business metrics
   */
  private async storeBusinessMetrics(metrics: BusinessMetrics): Promise<void> {
    const tenantId = 'default';
    
    await Analytics.findOneAndUpdate(
      { tenantId },
      {
        $push: {
          businessMetrics: metrics
        }
      },
      { upsert: true }
    );
  }

  /**
   * Store cohort analysis data
   */
  private async storeCohortData(cohorts: CohortData[]): Promise<void> {
    if (this.isDevelopmentMode()) {
      console.log('Development mode: Storing cohort data in memory', { cohortCount: cohorts.length });
      return;
    }
    
    const cacheKey = 'analytics:cohorts';
    await redis.setex(cacheKey, 3600 * 24, JSON.stringify(cohorts)); // Cache for 24 hours
  }

  /**
   * Store LTV calculations
   */
  private async storeLTVData(ltvData: LTVCalculation[]): Promise<void> {
    if (this.isDevelopmentMode()) {
      console.log('Development mode: Storing LTV data in memory', { ltvCount: ltvData.length });
      return;
    }
    
    const cacheKey = 'analytics:ltv';
    await redis.setex(cacheKey, 3600 * 12, JSON.stringify(ltvData)); // Cache for 12 hours
  }

  /**
   * Generate daily report
   */
  private async generateDailyReport(): Promise<any> {
    const today = new Date();
    const yesterday = subDays(today, 1);

    return {
      date: format(today, 'yyyy-MM-dd'),
      metrics: await this.processDailyMetrics({ date: yesterday }),
      timestamp: new Date()
    };
  }

  /**
   * Generate weekly report
   */
  private async generateWeeklyReport(): Promise<any> {
    const weekStart = startOfWeek(new Date());
    const weekEnd = endOfWeek(new Date());

    // Aggregate weekly data
    const weeklyMetrics = await Analytics.aggregate([
      {
        $match: {
          'businessMetrics.date': {
            $gte: weekStart,
            $lte: weekEnd
          }
        }
      },
      {
        $unwind: '$businessMetrics'
      },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: '$businessMetrics.revenue' },
          totalNewUsers: { $sum: '$businessMetrics.newUsers' },
          avgActiveUsers: { $avg: '$businessMetrics.activeUsers' }
        }
      }
    ]);

    return {
      week: format(weekStart, 'yyyy-ww'),
      metrics: weeklyMetrics[0] || {},
      timestamp: new Date()
    };
  }

  /**
   * Generate monthly report
   */
  private async generateMonthlyReport(): Promise<any> {
    const monthStart = startOfMonth(new Date());
    const monthEnd = endOfMonth(new Date());

    // Aggregate monthly data
    const monthlyMetrics = await Analytics.aggregate([
      {
        $match: {
          'businessMetrics.date': {
            $gte: monthStart,
            $lte: monthEnd
          }
        }
      },
      {
        $unwind: '$businessMetrics'
      },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: '$businessMetrics.revenue' },
          totalNewUsers: { $sum: '$businessMetrics.newUsers' },
          avgActiveUsers: { $avg: '$businessMetrics.activeUsers' },
          avgRetention: { $avg: '$businessMetrics.retention.day30' }
        }
      }
    ]);

    return {
      month: format(monthStart, 'yyyy-MM'),
      metrics: monthlyMetrics[0] || {},
      timestamp: new Date()
    };
  }

  /**
   * Start the ETL worker
   */
  async startWorker(): Promise<void> {
    const initialized = await this.ensureInitialized();
    if (!initialized || !this.worker) {
      console.warn('Cannot start ETL worker: service not initialized');
      return;
    }

    if (!this.isWorkerRunning) {
      await this.worker.run();
      this.isWorkerRunning = true;
      console.log('Analytics ETL worker started');
    }
  }

  /**
   * Stop the ETL worker
   */
  async stopWorker(): Promise<void> {
    if (this.isWorkerRunning && this.worker) {
      await this.worker.close();
      this.isWorkerRunning = false;
      console.log('Analytics ETL worker stopped');
    }
  }

  /**
   * Get ETL queue status
   */
  async getQueueStatus(): Promise<any> {
    const initialized = await this.ensureInitialized();
    if (!initialized) {
      return {
        waiting: 0,
        active: 0,
        completed: 0,
        failed: 0,
        status: this.isDevelopmentMode() ? 'development' : 'unavailable',
        mode: this.isDevelopmentMode() ? 'development' : 'disabled'
      };
    }

    if (!this.etlQueue) {
      return {
        waiting: 0,
        active: 0,
        completed: 0,
        failed: 0,
        status: 'development',
        mode: 'development'
      };
    }

    try {
      const [waiting, active, completed, failed] = await Promise.all([
        this.etlQueue.getWaiting(),
        this.etlQueue.getActive(),
        this.etlQueue.getCompleted(),
        this.etlQueue.getFailed()
      ]);

      return {
        waiting: waiting.length,
        active: active.length,
        completed: completed.length,
        failed: failed.length,
        status: 'available',
        mode: 'production'
      };
    } catch (error) {
      console.error('Failed to get queue status:', error);
      return {
        waiting: 0,
        active: 0,
        completed: 0,
        failed: 0,
        status: 'error',
        mode: 'error',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}

// Lazy singleton initialization
let analyticsETLInstance: AnalyticsETLService | null = null;

const getAnalyticsETL = (): AnalyticsETLService => {
  if (!analyticsETLInstance) {
    analyticsETLInstance = new AnalyticsETLService();
  }
  return analyticsETLInstance;
};

// Export singleton accessor
export const analyticsETL = getAnalyticsETL();

// Utility functions for scheduling ETL jobs
export const scheduleAnalyticsJob = (type: ETLJobType, data?: any, delay?: number) => {
  return getAnalyticsETL().scheduleJob(type, data, delay);
};

export const getETLQueueStatus = () => {
  return getAnalyticsETL().getQueueStatus();
};

export default analyticsETL;