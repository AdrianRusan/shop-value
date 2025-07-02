import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { rateLimits } from '@/lib/upstash';
import { cacheService, cacheInvalidation, cacheWarmer, CacheMetrics } from '@/lib/cache/cache-service';

// GET /api/admin/cache - Get cache statistics and health
export async function GET(request: NextRequest) {
  try {
    // Authentication check (admin only)
    const { userId } = auth();
    if (!userId) {
      return NextResponse.json({ 
        success: false, 
        error: 'Unauthorized' 
      }, { status: 401 });
    }

    // Rate limiting
    const ip = request.headers.get('x-forwarded-for') ?? 'anonymous';
    const { success } = await rateLimits.sensitive.limit(ip);
    
    if (!success) {
      return NextResponse.json({ 
        success: false, 
        error: 'Rate limit exceeded' 
      }, { status: 429 });
    }

    // Get cache statistics
    const stats = await CacheMetrics.getStats();

    // Get system health indicators
    const healthIndicators = {
      hitRate: stats.hitRate,
      status: stats.hitRate > 70 ? 'healthy' : stats.hitRate > 50 ? 'warning' : 'critical',
      totalKeys: stats.totalKeys,
      memoryUsage: stats.memoryUsage
    };

    return NextResponse.json({
      success: true,
      data: {
        stats,
        health: healthIndicators,
        recommendations: generateCacheRecommendations(stats)
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error getting cache stats:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Failed to get cache statistics',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

// POST /api/admin/cache - Cache management operations
export async function POST(request: NextRequest) {
  try {
    // Authentication check (admin only)
    const { userId } = auth();
    if (!userId) {
      return NextResponse.json({ 
        success: false, 
        error: 'Unauthorized' 
      }, { status: 401 });
    }

    // Rate limiting
    const ip = request.headers.get('x-forwarded-for') ?? 'anonymous';
    const { success } = await rateLimits.sensitive.limit(ip);
    
    if (!success) {
      return NextResponse.json({ 
        success: false, 
        error: 'Rate limit exceeded' 
      }, { status: 429 });
    }

    const body = await request.json();
    const { action, pattern, key } = body;

    switch (action) {
      case 'warm':
        await cacheWarmer.warmCache();
        return NextResponse.json({
          success: true,
          message: 'Cache warming initiated',
          timestamp: new Date().toISOString()
        });

      case 'invalidate_pattern':
        if (!pattern) {
          return NextResponse.json({
            success: false,
            error: 'Pattern is required for invalidation'
          }, { status: 400 });
        }
        
        await cacheService.invalidatePattern(pattern);
        return NextResponse.json({
          success: true,
          message: `Invalidated cache entries matching pattern: ${pattern}`,
          timestamp: new Date().toISOString()
        });

      case 'invalidate_key':
        if (!key) {
          return NextResponse.json({
            success: false,
            error: 'Key is required for invalidation'
          }, { status: 400 });
        }
        
        await cacheService.delete(key);
        return NextResponse.json({
          success: true,
          message: `Invalidated cache key: ${key}`,
          timestamp: new Date().toISOString()
        });

      case 'invalidate_all_users':
        await cacheInvalidation.invalidateSearchCache();
        await cacheService.invalidatePattern('user:*');
        return NextResponse.json({
          success: true,
          message: 'Invalidated all user-related caches',
          timestamp: new Date().toISOString()
        });

      case 'invalidate_all_products':
        await cacheInvalidation.invalidateSearchCache();
        await cacheService.invalidatePattern('product:*');
        await cacheService.invalidatePattern('popular:*');
        return NextResponse.json({
          success: true,
          message: 'Invalidated all product-related caches',
          timestamp: new Date().toISOString()
        });

      case 'invalidate_all_analytics':
        await cacheService.invalidatePattern('analytics:*');
        await cacheService.invalidatePattern('category:*');
        return NextResponse.json({
          success: true,
          message: 'Invalidated all analytics caches',
          timestamp: new Date().toISOString()
        });

      case 'intelligent_warm':
        await cacheWarmer.intelligentWarm();
        return NextResponse.json({
          success: true,
          message: 'Intelligent cache warming initiated',
          timestamp: new Date().toISOString()
        });

      default:
        return NextResponse.json({
          success: false,
          error: 'Invalid action. Supported actions: warm, invalidate_pattern, invalidate_key, invalidate_all_users, invalidate_all_products, invalidate_all_analytics, intelligent_warm'
        }, { status: 400 });
    }

  } catch (error) {
    console.error('Cache management error:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Cache management operation failed',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

// DELETE /api/admin/cache - Clear all cache
export async function DELETE(request: NextRequest) {
  try {
    // Authentication check (admin only)
    const { userId } = auth();
    if (!userId) {
      return NextResponse.json({ 
        success: false, 
        error: 'Unauthorized' 
      }, { status: 401 });
    }

    // Rate limiting
    const ip = request.headers.get('x-forwarded-for') ?? 'anonymous';
    const { success } = await rateLimits.sensitive.limit(ip);
    
    if (!success) {
      return NextResponse.json({ 
        success: false, 
        error: 'Rate limit exceeded' 
      }, { status: 429 });
    }

    // Clear all cache patterns
    const patterns = [
      'user:*',
      'product:*',
      'search:*',
      'popular:*',
      'category:*',
      'analytics:*',
      'prices:*'
    ];

    for (const pattern of patterns) {
      await cacheService.invalidatePattern(pattern);
    }

    // Restart cache warming
    setTimeout(async () => {
      await cacheWarmer.warmCache();
    }, 5000); // Wait 5 seconds before warming

    return NextResponse.json({
      success: true,
      message: 'All caches cleared successfully. Cache warming will restart in 5 seconds.',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Cache clear error:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Failed to clear cache',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

/**
 * Generate cache optimization recommendations based on statistics
 */
function generateCacheRecommendations(stats: {
  hits: number;
  misses: number;
  hitRate: number;
  totalKeys: number;
  memoryUsage: string;
}): string[] {
  const recommendations: string[] = [];

  // Hit rate recommendations
  if (stats.hitRate < 50) {
    recommendations.push('Cache hit rate is low. Consider increasing TTL values for frequently accessed data.');
  } else if (stats.hitRate < 70) {
    recommendations.push('Cache hit rate could be improved. Review cache invalidation strategies.');
  }

  // Memory usage recommendations
  if (stats.totalKeys > 10000) {
    recommendations.push('High number of cache keys detected. Consider implementing more aggressive cleanup policies.');
  }

  // Traffic pattern recommendations
  const totalRequests = stats.hits + stats.misses;
  if (totalRequests < 100) {
    recommendations.push('Low cache utilization. Ensure caching is properly implemented in API endpoints.');
  }

  // If no issues found
  if (recommendations.length === 0) {
    recommendations.push('Cache performance is optimal. Continue monitoring for any changes.');
  }

  return recommendations;
}