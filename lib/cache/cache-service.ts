import { redis, cacheKeys, cacheTTL } from '@/lib/upstash';
import { connectToDB } from '@/lib/mongoose';
import Product from '@/lib/models/product.model';
import User from '@/lib/models/user.model';
import UserProductTracking from '@/lib/models/user-product-tracking.model';
import Analytics from '@/lib/models/analytics.model';
// Sentry import removed to avoid build errors in environments without Sentry

// Cache Service Interface
export interface CacheService {
  get<T>(key: string): Promise<T | null>;
  set(key: string, value: any, ttl?: number): Promise<void>;
  delete(key: string): Promise<void>;
  invalidatePattern(pattern: string): Promise<void>;
  warmCache(): Promise<void>;
}

// Cache configuration
export const CACHE_CONFIG = {
  // Product caching
  PRODUCTS_SEARCH: {
    ttl: cacheTTL.product, // 1 hour
    keyPattern: 'search:products:*'
  },
  PRODUCT_DETAILS: {
    ttl: cacheTTL.product, // 1 hour
    keyPattern: 'product:*'
  },
  PRICE_HISTORY: {
    ttl: cacheTTL.prices, // 30 minutes
    keyPattern: 'prices:*'
  },
  
  // User caching
  USER_SUBSCRIPTIONS: {
    ttl: cacheTTL.userData, // 5 minutes
    keyPattern: 'user:*:subscription'
  },
  USER_PRODUCTS: {
    ttl: cacheTTL.userData, // 5 minutes
    keyPattern: 'user:*:products'
  },
  USER_STATS: {
    ttl: cacheTTL.userData, // 5 minutes
    keyPattern: 'user:*:stats'
  },
  
  // Popular and category data
  POPULAR_PRODUCTS: {
    ttl: cacheTTL.marketData, // 2 hours
    keyPattern: 'popular:*'
  },
  CATEGORY_DATA: {
    ttl: cacheTTL.marketData, // 2 hours
    keyPattern: 'category:*'
  },
  
  // Analytics caching
  ANALYTICS_DASHBOARD: {
    ttl: 900, // 15 minutes
    keyPattern: 'analytics:*'
  },
  
  // Scraping metadata
  SCRAPING_ATTEMPTS: {
    ttl: cacheTTL.scrapeAttempts, // 24 hours
    keyPattern: 'scrape:*'
  }
} as const;

/**
 * Main cache service implementation with comprehensive caching strategies
 */
export class RedisCache implements CacheService {
  private static instance: RedisCache;
  
  public static getInstance(): RedisCache {
    if (!RedisCache.instance) {
      RedisCache.instance = new RedisCache();
    }
    return RedisCache.instance;
  }

  /**
   * Get cached data with type safety
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      const cached = await redis.get(key);
      if (cached === null) return null;
      
      // Handle different data types
      if (typeof cached === 'string') {
        try {
          return JSON.parse(cached) as T;
        } catch {
          return cached as unknown as T;
        }
      }
      
      return cached as T;
    } catch (error) {
      console.error(`Cache GET error for key ${key}:`, error);
      return null;
    }
  }

  /**
   * Set cached data with TTL
   */
  async set(key: string, value: any, ttl?: number): Promise<void> {
    try {
      const serializedValue = typeof value === 'string' ? value : JSON.stringify(value);
      
      if (ttl) {
        await redis.setex(key, ttl, serializedValue);
      } else {
        await redis.set(key, serializedValue);
      }
    } catch (error) {
      console.error(`Cache SET error for key ${key}:`, error);
    }
  }

  /**
   * Delete cached data
   */
  async delete(key: string): Promise<void> {
    try {
      await redis.del(key);
    } catch (error) {
      console.error(`Cache DELETE error for key ${key}:`, error);
    }
  }

  /**
   * Invalidate cache entries matching a pattern
   */
  async invalidatePattern(pattern: string): Promise<void> {
    try {
      // Get all keys matching the pattern
      const keys = await this.getKeysMatchingPattern(pattern);
      
      if (keys.length > 0) {
        await redis.del(...keys);
        console.log(`Invalidated ${keys.length} cache entries matching pattern: ${pattern}`);
      }
    } catch (error) {
      Sentry.captureException(error, {
        tags: { operation: 'cache_invalidate_pattern' },
        extra: { pattern }
      });
      console.error(`Cache invalidation error for pattern ${pattern}:`, error);
    }
  }

  /**
   * Get keys matching a pattern using SCAN for efficiency
   */
  private async getKeysMatchingPattern(pattern: string): Promise<string[]> {
    const keys: string[] = [];
    let cursor = 0;
    
    do {
      try {
        const result = await redis.scan(cursor, { match: pattern, count: 100 });
        cursor = result[0];
        keys.push(...result[1]);
      } catch (error) {
        console.error('Error during SCAN operation:', error);
        break;
      }
    } while (cursor !== 0);
    
    return keys;
  }

  /**
   * Warm cache with frequently accessed data
   */
  async warmCache(): Promise<void> {
    try {
      console.log('Starting cache warming...');
      
      await connectToDB();
      
      // Warm popular products cache
      await this.warmPopularProducts();
      
      // Warm category data cache
      await this.warmCategoryData();
      
      // Warm analytics dashboard cache
      await this.warmAnalyticsDashboard();
      
      console.log('Cache warming completed successfully');
    } catch (error) {
      Sentry.captureException(error, {
        tags: { operation: 'cache_warm' }
      });
      console.error('Cache warming failed:', error);
    }
  }

  /**
   * Warm popular products cache
   */
  private async warmPopularProducts(): Promise<void> {
    try {
      const popularProducts = await Product.find({
        isActive: true,
        deletedAt: { $exists: false }
      })
      .sort({ 'analytics.popularityScore': -1 })
      .limit(50)
      .select('title brand category currentPrice originalPrice image url analytics')
      .lean();

      await this.set(
        cacheKeys.marketData('popular_products'),
        popularProducts,
        CACHE_CONFIG.POPULAR_PRODUCTS.ttl
      );
      
      console.log(`Warmed popular products cache with ${popularProducts.length} items`);
    } catch (error) {
      console.error('Error warming popular products cache:', error);
    }
  }

  /**
   * Warm category data cache
   */
  private async warmCategoryData(): Promise<void> {
    try {
      // Get category statistics
      const categoryStats = await Product.aggregate([
        {
          $match: {
            isActive: true,
            deletedAt: { $exists: false }
          }
        },
        {
          $group: {
            _id: '$category',
            count: { $sum: 1 },
            avgPrice: { $avg: '$currentPrice' },
            minPrice: { $min: '$currentPrice' },
            maxPrice: { $max: '$currentPrice' },
            popularityScore: { $avg: '$analytics.popularityScore' }
          }
        },
        {
          $sort: { count: -1 }
        }
      ]);

      await this.set(
        cacheKeys.marketData('category_stats'),
        categoryStats,
        CACHE_CONFIG.CATEGORY_DATA.ttl
      );
      
      console.log(`Warmed category data cache with ${categoryStats.length} categories`);
    } catch (error) {
      console.error('Error warming category data cache:', error);
    }
  }

  /**
   * Warm analytics dashboard cache
   */
  private async warmAnalyticsDashboard(): Promise<void> {
    try {
      const [userCount, productCount, trackingCount] = await Promise.all([
        User.countDocuments({ deletedAt: { $exists: false } }),
        Product.countDocuments({ isActive: true, deletedAt: { $exists: false } }),
        UserProductTracking.countDocuments({ isActive: true, deletedAt: { $exists: false } })
      ]);

      const dashboardData = {
        users: {
          total: userCount,
          timestamp: new Date()
        },
        products: {
          total: productCount,
          timestamp: new Date()
        },
        tracking: {
          total: trackingCount,
          timestamp: new Date()
        }
      };

      await this.set(
        'analytics:dashboard:overview',
        dashboardData,
        CACHE_CONFIG.ANALYTICS_DASHBOARD.ttl
      );
      
      console.log('Warmed analytics dashboard cache');
    } catch (error) {
      console.error('Error warming analytics dashboard cache:', error);
    }
  }
}

// Cache invalidation strategies
export class CacheInvalidation {
  private cache: RedisCache;

  constructor() {
    this.cache = RedisCache.getInstance();
  }

  /**
   * Invalidate product-related caches when product data changes
   */
  async invalidateProductCache(productId: string, options: {
    userId?: string;
    category?: string;
    brand?: string;
  } = {}): Promise<void> {
    const invalidationPromises: Promise<void>[] = [];

    // Invalidate specific product cache
    invalidationPromises.push(
      this.cache.delete(cacheKeys.product(productId))
    );

    // Invalidate price history
    invalidationPromises.push(
      this.cache.delete(cacheKeys.productPrices(productId))
    );

    // Invalidate user products cache if userId provided
    if (options.userId) {
      invalidationPromises.push(
        this.cache.delete(cacheKeys.userProducts(options.userId))
      );
    }

    // Invalidate search caches
    invalidationPromises.push(
      this.cache.invalidatePattern('search:products:*')
    );

    // Invalidate popular products if high popularity
    invalidationPromises.push(
      this.cache.invalidatePattern('popular:*')
    );

    // Invalidate category cache if category provided
    if (options.category) {
      invalidationPromises.push(
        this.cache.invalidatePattern(`category:${options.category}:*`)
      );
    }

    await Promise.all(invalidationPromises);
    console.log(`Invalidated cache for product ${productId}`);
  }

  /**
   * Invalidate user-related caches when user data changes
   */
  async invalidateUserCache(userId: string): Promise<void> {
    const invalidationPromises = [
      this.cache.delete(cacheKeys.userProducts(userId)),
      this.cache.delete(cacheKeys.userStats(userId)),
      this.cache.invalidatePattern(`user:${userId}:*`)
    ];

    await Promise.all(invalidationPromises);
    console.log(`Invalidated cache for user ${userId}`);
  }

  /**
   * Invalidate market data caches when aggregate data changes
   */
  async invalidateMarketDataCache(): Promise<void> {
    const invalidationPromises = [
      this.cache.invalidatePattern('popular:*'),
      this.cache.invalidatePattern('category:*'),
      this.cache.invalidatePattern('analytics:*')
    ];

    await Promise.all(invalidationPromises);
    console.log('Invalidated market data caches');
  }

  /**
   * Invalidate all search-related caches
   */
  async invalidateSearchCache(): Promise<void> {
    await this.cache.invalidatePattern('search:*');
    console.log('Invalidated search caches');
  }
}

// Cache warming scheduler
export class CacheWarmer {
  private cache: RedisCache;
  private isWarming = false;

  constructor() {
    this.cache = RedisCache.getInstance();
  }

  /**
   * Schedule automatic cache warming
   */
  async scheduleWarming(): Promise<void> {
    // Warm cache immediately
    await this.warmCache();

    // Schedule periodic warming (every 30 minutes)
    setInterval(async () => {
      await this.warmCache();
    }, 30 * 60 * 1000);
  }

  /**
   * Warm cache with frequently accessed data
   */
  async warmCache(): Promise<void> {
    if (this.isWarming) {
      console.log('Cache warming already in progress, skipping...');
      return;
    }

    this.isWarming = true;
    
    try {
      await this.cache.warmCache();
    } finally {
      this.isWarming = false;
    }
  }

  /**
   * Intelligent cache warming based on usage patterns
   */
  async intelligentWarm(): Promise<void> {
    try {
      // Get most accessed cache keys from analytics
      const accessStats = await this.getCacheAccessStats();
      
      // Warm most frequently accessed data first
      for (const { key, pattern } of accessStats) {
        if (pattern.includes('user:')) {
          // Skip user-specific data for intelligent warming
          continue;
        }
        
        await this.warmSpecificCache(key, pattern);
      }
    } catch (error) {
      console.error('Intelligent cache warming failed:', error);
    }
  }

  /**
   * Get cache access statistics from analytics
   */
  private async getCacheAccessStats(): Promise<Array<{ key: string; pattern: string; hits: number }>> {
    // This would be implemented based on analytics tracking
    // For now, return common patterns
    return [
      { key: 'popular_products', pattern: 'popular:*', hits: 100 },
      { key: 'category_stats', pattern: 'category:*', hits: 80 },
      { key: 'analytics_dashboard', pattern: 'analytics:*', hits: 60 }
    ];
  }

  /**
   * Warm specific cache based on pattern
   */
  private async warmSpecificCache(key: string, pattern: string): Promise<void> {
    switch (key) {
      case 'popular_products':
        await this.cache.warmPopularProducts();
        break;
      case 'category_stats':
        await this.cache.warmCategoryData();
        break;
      case 'analytics_dashboard':
        await this.cache.warmAnalyticsDashboard();
        break;
    }
  }
}

// Export singleton instances
export const cacheService = RedisCache.getInstance();
export const cacheInvalidation = new CacheInvalidation();
export const cacheWarmer = new CacheWarmer();

// Cache middleware helper
export const withCache = <T>(
  key: string,
  fetcher: () => Promise<T>,
  ttl?: number
) => {
  return async (): Promise<T> => {
    // Try to get from cache first
    const cached = await cacheService.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    // Fetch fresh data
    const fresh = await fetcher();
    
    // Cache the result
    await cacheService.set(key, fresh, ttl);
    
    return fresh;
  };
};

// Cache metrics for monitoring
export class CacheMetrics {
  static async getStats(): Promise<{
    hits: number;
    misses: number;
    hitRate: number;
    totalKeys: number;
    memoryUsage: string;
  }> {
    try {
      const [hits, misses, info] = await Promise.all([
        redis.get('cache:stats:hits').then(v => parseInt(v as string) || 0),
        redis.get('cache:stats:misses').then(v => parseInt(v as string) || 0),
        redis.info('memory')
      ]);

      const totalRequests = hits + misses;
      const hitRate = totalRequests > 0 ? (hits / totalRequests) * 100 : 0;

      return {
        hits,
        misses,
        hitRate: Math.round(hitRate * 100) / 100,
        totalKeys: await redis.dbsize(),
        memoryUsage: info || 'N/A'
      };
    } catch (error) {
      console.error('Error getting cache stats:', error);
      return {
        hits: 0,
        misses: 0,
        hitRate: 0,
        totalKeys: 0,
        memoryUsage: 'Error'
      };
    }
  }

  static async incrementHit(): Promise<void> {
    try {
      await redis.incr('cache:stats:hits');
    } catch (error) {
      console.error('Error incrementing cache hit:', error);
    }
  }

  static async incrementMiss(): Promise<void> {
    try {
      await redis.incr('cache:stats:misses');
    } catch (error) {
      console.error('Error incrementing cache miss:', error);
    }
  }
}