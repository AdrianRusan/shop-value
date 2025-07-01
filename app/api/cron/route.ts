import { NextResponse } from 'next/server';
import { connectToDB } from '@/lib/mongoose';
import Product from '@/lib/models/product.model';
import User from '@/lib/models/user.model';
import { addBulkScrapingJobs, getQueueStats, cleanupOldJobs, ScrapingJobData } from '@/lib/scraper/queue';
import { redis } from '@/lib/upstash';

export const maxDuration = 250;
export const dynamic = 'force-dynamic';

// Enhanced cron job for multi-user scraping
export async function GET() {
  try {
    console.log('🚀 Starting enhanced scraping cron job...');
    await connectToDB();

    // Clean up old queue jobs first
    await cleanupOldJobs();

    // Get current queue statistics
    const queueStats = await getQueueStats();
    if (queueStats) {
      console.log('📊 Current queue stats:', queueStats);
      
      // Don't add new jobs if queue is overloaded
      if (queueStats.waiting > 100) {
        console.warn('⚠️ Queue overloaded, skipping this cron run');
        return NextResponse.json({ 
          success: true, 
          message: 'Queue overloaded, skipped',
          queueStats 
        });
      }
    }

    // Get products that need scraping, ordered by priority
    const products = await getProductsForScraping();
    
    if (!products || products.length === 0) {
      console.log('ℹ️ No products found for scraping');
      return NextResponse.json({ 
        success: true, 
        message: 'No products to scrape',
        queueStats 
      });
    }

    console.log(`📦 Found ${products.length} products for scraping`);

    // Group products by user and subscription tier for fair processing
    const jobsByTier = await groupProductsByUserTier(products);

    // Create scraping jobs with user-based priorities
    const allJobs: ScrapingJobData[] = [];
    let jobCount = 0;

    // Process enterprise users first (highest priority)
    for (const tier of ['enterprise', 'pro', 'free']) {
      const tierProducts = jobsByTier[tier] || [];
      console.log(`📋 Processing ${tierProducts.length} products for ${tier} tier`);

      for (const product of tierProducts) {
        // Apply tier-based limits
        const maxJobsPerTier = getMaxJobsPerTier(tier);
        if (jobCount >= maxJobsPerTier) {
          console.log(`⏭️ Reached job limit for ${tier} tier (${maxJobsPerTier})`);
          break;
        }

        const job: ScrapingJobData = {
          productId: product._id.toString(),
          url: product.url,
          userId: product.userId,
          userTier: tier as 'free' | 'pro' | 'enterprise',
          priority: getTierPriority(tier),
          source: product.source,
          tenantId: product.tenantId,
        };

        allJobs.push(job);
        jobCount++;
      }
    }

    if (allJobs.length === 0) {
      console.log('ℹ️ No valid jobs created');
      return NextResponse.json({ 
        success: true, 
        message: 'No valid jobs created',
        queueStats 
      });
    }

    // Add jobs to queue in bulk
    console.log(`⚡ Adding ${allJobs.length} jobs to scraping queue...`);
    const addedJobs = await addBulkScrapingJobs(allJobs);

    // Update products' next scrape time
    await updateNextScrapeTime(products);

    // Track cron job execution
    await trackCronExecution(allJobs.length);

    const response = {
      success: true,
      message: `Successfully queued ${addedJobs.length} scraping jobs`,
      stats: {
        totalProducts: products.length,
        queuedJobs: addedJobs.length,
        byTier: {
          enterprise: jobsByTier.enterprise?.length || 0,
          pro: jobsByTier.pro?.length || 0,
          free: jobsByTier.free?.length || 0,
        },
        queueStats: await getQueueStats(),
      },
      timestamp: new Date().toISOString(),
    };

    console.log('✅ Cron job completed successfully:', response.stats);
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

// Get products that need scraping based on schedule and user activity
async function getProductsForScraping() {
  try {
    const now = new Date();
    
    // Find products due for scraping
    const products = await Product.aggregate([
      {
        $match: {
          isActive: true,
          trackingStatus: 'active',
          deletedAt: { $exists: false },
          $or: [
            { nextScrapeAt: { $lte: now } },
            { nextScrapeAt: { $exists: false } },
            { lastScrapedAt: { $lt: new Date(now.getTime() - 6 * 60 * 60 * 1000) } } // 6 hours old
          ],
        }
      },
      {
        $lookup: {
          from: 'userproducttrackings',
          localField: '_id',
          foreignField: 'productId',
          as: 'tracking'
        }
      },
      {
        $match: {
          'tracking.0': { $exists: true } // Only products with active tracking
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: 'tracking.userId',
          foreignField: '_id',
          as: 'users'
        }
      },
      {
        $addFields: {
          // Get the subscription tier of the first active user
          userTier: { $arrayElemAt: ['$users.subscription.plan', 0] },
          userId: { $arrayElemAt: ['$users.clerkId', 0] },
          // Calculate priority score based on multiple factors
          priorityScore: {
            $add: [
              { $multiply: ['$analytics.popularityScore', 0.3] },
              { $multiply: ['$analytics.trackingCount', 0.4] },
              { 
                $cond: {
                  if: { $eq: ['$availability', 'out_of_stock'] },
                  then: 20, // Higher priority for out of stock items
                  else: 0
                }
              },
              {
                $cond: {
                  if: { $gte: ['$analytics.trackingCount', 5] },
                  then: 15, // Higher priority for popular products
                  else: 0
                }
              }
            ]
          }
        }
      },
      {
        $match: {
          userId: { $exists: true },
          userTier: { $exists: true }
        }
      },
      {
        $sort: {
          priorityScore: -1,
          lastScrapedAt: 1 // Oldest first for same priority
        }
      },
      {
        $limit: 500 // Limit to prevent overwhelming the queue
      }
    ]);

    return products;
  } catch (error) {
    console.error('Error getting products for scraping:', error);
    return [];
  }
}

// Group products by user subscription tier
async function groupProductsByUserTier(products: any[]) {
  const grouped: Record<string, any[]> = {
    enterprise: [],
    pro: [],
    free: []
  };

  for (const product of products) {
    const tier = product.userTier || 'free';
    if (grouped[tier]) {
      grouped[tier].push(product);
    }
  }

  return grouped;
}

// Get maximum jobs per tier to ensure fair resource allocation
function getMaxJobsPerTier(tier: string): number {
  switch (tier) {
    case 'enterprise': return 200; // Unlimited in practice
    case 'pro': return 100;
    case 'free': return 50;
    default: return 10;
  }
}

// Get priority level for queue
function getTierPriority(tier: string): 'low' | 'medium' | 'high' | 'urgent' {
  switch (tier) {
    case 'enterprise': return 'urgent';
    case 'pro': return 'high';
    case 'free': return 'medium';
    default: return 'low';
  }
}

// Update next scrape time for processed products
async function updateNextScrapeTime(products: any[]) {
  try {
    const bulkOps = products.map(product => {
      const tier = product.userTier || 'free';
      const interval = getScrapingInterval(tier, product.analytics?.popularityScore || 0);
      
      return {
        updateOne: {
          filter: { _id: product._id },
          update: {
            $set: {
              nextScrapeAt: new Date(Date.now() + interval),
              'scraping.lastScheduled': new Date(),
            }
          }
        }
      };
    });

    if (bulkOps.length > 0) {
      const result = await Product.bulkWrite(bulkOps);
      console.log(`📅 Updated next scrape time for ${result.modifiedCount} products`);
    }
  } catch (error) {
    console.error('Error updating next scrape time:', error);
  }
}

// Calculate scraping interval based on user tier and popularity
function getScrapingInterval(tier: string, popularityScore: number): number {
  const baseIntervals = {
    enterprise: 60 * 60 * 1000, // 1 hour
    pro: 6 * 60 * 60 * 1000, // 6 hours
    free: 24 * 60 * 60 * 1000, // 24 hours
  };

  const baseInterval = baseIntervals[tier as keyof typeof baseIntervals] || baseIntervals.free;
  
  // Adjust based on popularity (more popular = more frequent)
  const popularityMultiplier = Math.max(0.5, 2 - (popularityScore / 100));
  
  return Math.floor(baseInterval * popularityMultiplier);
}

// Track cron job execution for monitoring
async function trackCronExecution(jobCount: number) {
  try {
    const today = new Date().toISOString().split('T')[0];
    
    await Promise.all([
      redis.incr('cron:executions:total'),
      redis.incr(`cron:executions:${today}`),
      redis.incrby('cron:jobs:created', jobCount),
      redis.setex('cron:last_execution', 3600 * 24, Date.now().toString()),
    ]);
  } catch (error) {
    console.error('Error tracking cron execution:', error);
  }
}
