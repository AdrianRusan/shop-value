import { redis, cacheKeys, cacheTTL } from '@/lib/upstash';
import * as Sentry from '@sentry/nextjs';

// Cache service interface
interface CacheService {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttl?: number): Promise<boolean>;
  del(key: string): Promise<boolean>;
  delPattern(pattern: string): Promise<boolean>;
  exists(key: string): Promise<boolean>;
  incr(key: string): Promise<number>;
  expire(key: string, ttl: number): Promise<boolean>;
}

// Enhanced cache keys with better organization
export const enhancedCacheKeys = {
  // Product-related caching
  product: (id: string) => `product:${id}`,
  productSearch: (query: string, filters?: any) => {
    const filterKey = filters ? btoa(JSON.stringify(filters)) : 'all';
    return `search:products:${btoa(query)}:${filterKey}`;
  },
  productPrices: (productId: string) => `prices:${productId}`,
  productPopular: (category?: string) => category ? `popular:${category}` : 'popular:all',
  productsByCategory: (category: string) => `category:${category}:products`,
  
  // User-related caching
  userProducts: (userId: string, filters?: any) => {
    const filterKey = filters ? btoa(JSON.stringify(filters)) : 'all';
    return `user:${userId}:products:${filterKey}`;
  },
  userSubscription: (userId: string) => `user:${userId}:subscription`,
  userUsage: (userId: string) => `user:${userId}:usage`,
  userStats: (userId: string) => `user:${userId}:stats`,
  
  // Category and market data
  categoryStats: (category: string) => `category:${category}:stats`,
  categoryList: () => 'categories:list',
  brandList: (category?: string) => category ? `brands:${category}` : 'brands:all',
  marketTrends: (timeframe: 'daily' | 'weekly' | 'monthly') => `market:trends:${timeframe}`,
  
  // Analytics and reporting
  adminDashboard: () => 'admin:dashboard',
  scrapingStats: () => 'scraping:stats',
  userAnalytics: (timeframe: string) => `analytics:users:${timeframe}`,
  
  // API rate limiting and monitoring
  apiUsage: (userId: string, endpoint: string) => `api:usage:${userId}:${endpoint}`,
  popularSearches: () => 'searches:popular',
  
  // Cache warming and maintenance
  warmingQueue: () => 'warming:queue',
  cacheHealth: () => 'cache:health'
} as const;

// Enhanced TTL configurations
export const enhancedCacheTTL = {
  // Short-lived data (5-15 minutes)
  userSession: 300, // 5 minutes
  apiResponse: 600, // 10 minutes
  userUsage: 900, // 15 minutes
  
  // Medium-lived data (30 minutes - 2 hours)
  productSearch: 1800, // 30 minutes
  userProducts: 1800, // 30 minutes
  categoryStats: 3600, // 1 hour
  userStats: 3600, // 1 hour
  
  // Long-lived data (2-6 hours)
  productData: 7200, // 2 hours
  priceHistory: 10800, // 3 hours
  popularProducts: 14400, // 4 hours
  marketTrends: 21600, // 6 hours
  
  // Very long-lived data (12-24 hours)
  categoryList: 43200, // 12 hours
  brandList: 43200, // 12 hours
  adminDashboard: 86400, // 24 hours
  
  // User subscription data (varies by plan)
  subscriptionFree: 300, // 5 minutes for free users
  subscriptionPro: 900, // 15 minutes for pro users
  subscriptionEnterprise: 1800, // 30 minutes for enterprise users
} as const;

class CacheManager implements CacheService {
  constructor() {}

  async get<T>(key: string): Promise<T | null> {
    try {
      const value = await redis.get(key);
      if (value === null || value === undefined) return null;
      
      // Track cache hits for analytics
      await this.trackCacheMetric(key, 'hit');
      
      return typeof value === 'string' ? JSON.parse(value) : null;
    } catch (error) {
      Sentry.captureException(error);
      console.error(`Cache get error for key ${key}:`, error);
      
      // Track cache misses due to errors
      await this.trackCacheMetric(key, 'error');
      
      return null;
    }
  }

  async set<T>(key: string, value: T, ttl: number = 3600): Promise<boolean> {
    try {
      const serializedValue = typeof value === 'string' ? value : JSON.stringify(value);
      
      if (ttl > 0) {
        await redis.setex(key, ttl, serializedValue);
      } else {
        await redis.set(key, serializedValue);
      }
      
      // Track cache sets for analytics
      await this.trackCacheMetric(key, 'set');
      
      return true;
    } catch (error) {
      Sentry.captureException(error);
      console.error(`Cache set error for key ${key}:`, error);
      return false;
    }
  }

  async del(key: string): Promise<boolean> {
    try {
      const result = await redis.del(key);
      
      // Track cache deletions
      await this.trackCacheMetric(key, 'delete');
      
      return result > 0;
    } catch (error) {
      Sentry.captureException(error);
      console.error(`Cache delete error for key ${key}:`, error);
      return false;
    }
  }

  async delPattern(pattern: string): Promise<boolean> {
    try {
      // Note: This is a simplified pattern deletion
      // In production, you might want to use Redis SCAN for better performance
      const keys = await this.getKeysByPattern(pattern);
      if (keys.length === 0) return true;
      
      const result = await redis.del(...keys);
      
      // Track pattern deletions
      await this.trackCacheMetric(pattern, 'pattern_delete');
      
      return result > 0;
    } catch (error) {
      Sentry.captureException(error);
      console.error(`Cache pattern delete error for pattern ${pattern}:`, error);
      return false;
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      const result = await redis.exists(key);
      return result > 0;
    } catch (error) {
      Sentry.captureException(error);
      console.error(`Cache exists error for key ${key}:`, error);
      return false;
    }
  }

  async incr(key: string): Promise<number> {
    try {
      return await redis.incr(key);
    } catch (error) {
      Sentry.captureException(error);
      console.error(`Cache incr error for key ${key}:`, error);
      return 0;
    }
  }

  async expire(key: string, ttl: number): Promise<boolean> {
    try {
      const result = await redis.expire(key, ttl);
      return result > 0;
    } catch (error) {
      Sentry.captureException(error);
      console.error(`Cache expire error for key ${key}:`, error);
      return false;
    }
  }

  // Helper method to get keys by pattern (simplified version)
  private async getKeysByPattern(pattern: string): Promise<string[]> {
    // This is a simplified implementation
    // In production, you'd use Redis SCAN for better performance
    try {
      // For now, we'll return an empty array and let specific invalidation methods handle this
      return [];
    } catch (error) {
      console.error('Error getting keys by pattern:', error);
      return [];
    }
  }

  // Track cache metrics for monitoring
  private async trackCacheMetric(key: string, operation: 'hit' | 'miss' | 'set' | 'delete' | 'error' | 'pattern_delete') {
    try {
      const metricKey = `cache:metrics:${operation}`;
      const dailyMetricKey = `cache:metrics:daily:${new Date().toISOString().split('T')[0]}:${operation}`;
      
      await Promise.all([
        redis.incr(metricKey),
        redis.incr(dailyMetricKey),
        // Set expiry for daily metrics (7 days)
        redis.expire(dailyMetricKey, 7 * 24 * 3600)
      ]);
    } catch (error) {
      // Don't throw errors for metrics tracking
      console.error('Error tracking cache metrics:', error);
    }
  }
}

// Product caching service
export class ProductCacheService {
  private cache = new CacheManager();

  // Cache product search results
  async cacheProductSearch(query: string, filters: any, results: any[]): Promise<boolean> {
    const key = enhancedCacheKeys.productSearch(query, filters);
    return this.cache.set(key, {
      results,
      timestamp: new Date().toISOString(),
      query,
      filters,
      count: results.length
    }, enhancedCacheTTL.productSearch);
  }

  // Get cached product search results
  async getCachedProductSearch(query: string, filters: any): Promise<any | null> {
    const key = enhancedCacheKeys.productSearch(query, filters);
    return this.cache.get(key);
  }

  // Cache individual product data
  async cacheProduct(productId: string, productData: any): Promise<boolean> {
    const key = enhancedCacheKeys.product(productId);
    return this.cache.set(key, productData, enhancedCacheTTL.productData);
  }

  // Get cached product data
  async getCachedProduct(productId: string): Promise<any | null> {
    const key = enhancedCacheKeys.product(productId);
    return this.cache.get(key);
  }

  // Cache product price history
  async cachePriceHistory(productId: string, priceHistory: any[]): Promise<boolean> {
    const key = enhancedCacheKeys.productPrices(productId);
    return this.cache.set(key, {
      priceHistory,
      timestamp: new Date().toISOString(),
      productId
    }, enhancedCacheTTL.priceHistory);
  }

  // Get cached price history
  async getCachedPriceHistory(productId: string): Promise<any | null> {
    const key = enhancedCacheKeys.productPrices(productId);
    return this.cache.get(key);
  }

  // Cache popular products
  async cachePopularProducts(products: any[], category?: string): Promise<boolean> {
    const key = enhancedCacheKeys.productPopular(category);
    return this.cache.set(key, {
      products,
      timestamp: new Date().toISOString(),
      category: category || 'all'
    }, enhancedCacheTTL.popularProducts);
  }

  // Get cached popular products
  async getCachedPopularProducts(category?: string): Promise<any | null> {
    const key = enhancedCacheKeys.productPopular(category);
    return this.cache.get(key);
  }

  // Invalidate product-related caches
  async invalidateProductCaches(productId: string): Promise<void> {
    const keys = [
      enhancedCacheKeys.product(productId),
      enhancedCacheKeys.productPrices(productId)
    ];

    await Promise.all(keys.map(key => this.cache.del(key)));
    
    // Also invalidate search caches (simplified - in production you'd be more selective)
    await this.invalidateSearchCaches();
  }

  // Invalidate search caches
  async invalidateSearchCaches(): Promise<void> {
    // This would typically be more sophisticated in production
    await this.cache.delPattern('search:products:*');
  }
}

// User caching service
export class UserCacheService {
  private cache = new CacheManager();

  // Cache user subscription data
  async cacheUserSubscription(userId: string, subscriptionData: any): Promise<boolean> {
    const key = enhancedCacheKeys.userSubscription(userId);
    
    // Determine TTL based on subscription plan
    let ttl: number = enhancedCacheTTL.subscriptionFree;
    if (subscriptionData.plan === 'pro') {
      ttl = enhancedCacheTTL.subscriptionPro;
    } else if (subscriptionData.plan === 'enterprise') {
      ttl = enhancedCacheTTL.subscriptionEnterprise;
    }
    
    return this.cache.set(key, {
      ...subscriptionData,
      timestamp: new Date().toISOString()
    }, ttl);
  }

  // Get cached user subscription
  async getCachedUserSubscription(userId: string): Promise<any | null> {
    const key = enhancedCacheKeys.userSubscription(userId);
    return this.cache.get(key);
  }

  // Cache user's tracked products
  async cacheUserProducts(userId: string, data: any, filters?: any): Promise<boolean> {
    const key = enhancedCacheKeys.userProducts(userId, filters);
    return this.cache.set(key, {
      products: data,
      timestamp: new Date().toISOString(),
      userId,
      filters: filters || {}
    }, enhancedCacheTTL.userProducts);
  }

  // Get cached user products
  async getCachedUserProducts(userId: string, filters?: any): Promise<any | null> {
    const key = enhancedCacheKeys.userProducts(userId, filters);
    return this.cache.get(key);
  }

  // Cache user usage statistics
  async cacheUserUsage(userId: string, usageData: any): Promise<boolean> {
    const key = enhancedCacheKeys.userUsage(userId);
    return this.cache.set(key, {
      ...usageData,
      timestamp: new Date().toISOString()
    }, enhancedCacheTTL.userUsage);
  }

  // Get cached user usage
  async getCachedUserUsage(userId: string): Promise<any | null> {
    const key = enhancedCacheKeys.userUsage(userId);
    return this.cache.get(key);
  }

  // Invalidate user-related caches
  async invalidateUserCaches(userId: string): Promise<void> {
    const patterns = [
      `user:${userId}:*`
    ];

    await Promise.all(patterns.map(pattern => this.cache.delPattern(pattern)));
  }
}

// Category and market data caching service
export class CategoryCacheService {
  private cache = new CacheManager();

  // Cache category statistics
  async cacheCategoryStats(category: string, stats: any): Promise<boolean> {
    const key = enhancedCacheKeys.categoryStats(category);
    return this.cache.set(key, {
      ...stats,
      timestamp: new Date().toISOString(),
      category
    }, enhancedCacheTTL.categoryStats);
  }

  // Get cached category statistics
  async getCachedCategoryStats(category: string): Promise<any | null> {
    const key = enhancedCacheKeys.categoryStats(category);
    return this.cache.get(key);
  }

  // Cache category list
  async cacheCategoryList(categories: string[]): Promise<boolean> {
    const key = enhancedCacheKeys.categoryList();
    return this.cache.set(key, {
      categories,
      timestamp: new Date().toISOString()
    }, enhancedCacheTTL.categoryList);
  }

  // Get cached category list
  async getCachedCategoryList(): Promise<any | null> {
    const key = enhancedCacheKeys.categoryList();
    return this.cache.get(key);
  }

  // Cache brand list
  async cacheBrandList(brands: string[], category?: string): Promise<boolean> {
    const key = enhancedCacheKeys.brandList(category);
    return this.cache.set(key, {
      brands,
      timestamp: new Date().toISOString(),
      category: category || 'all'
    }, enhancedCacheTTL.brandList);
  }

  // Get cached brand list
  async getCachedBrandList(category?: string): Promise<any | null> {
    const key = enhancedCacheKeys.brandList(category);
    return this.cache.get(key);
  }

  // Cache market trends
  async cacheMarketTrends(timeframe: 'daily' | 'weekly' | 'monthly', trends: any): Promise<boolean> {
    const key = enhancedCacheKeys.marketTrends(timeframe);
    return this.cache.set(key, {
      trends,
      timestamp: new Date().toISOString(),
      timeframe
    }, enhancedCacheTTL.marketTrends);
  }

  // Get cached market trends
  async getCachedMarketTrends(timeframe: 'daily' | 'weekly' | 'monthly'): Promise<any | null> {
    const key = enhancedCacheKeys.marketTrends(timeframe);
    return this.cache.get(key);
  }
}

// Cache warming service
export class CacheWarmingService {
  private productCache = new ProductCacheService();
  private categoryCache = new CategoryCacheService();

  // Warm frequently accessed data
  async warmFrequentlyAccessedData(): Promise<void> {
    try {
      await Promise.all([
        this.warmPopularProducts(),
        this.warmCategoryData(),
        this.warmMarketTrends()
      ]);
    } catch (error) {
      Sentry.captureException(error);
      console.error('Error warming cache:', error);
    }
  }

  // Warm popular products cache
  private async warmPopularProducts(): Promise<void> {
    try {
      // This would typically fetch from database
      // For now, we'll just create placeholder logic
      const categories = ['electronics', 'fashion', 'home', 'sports'];
      
             for (const category of categories) {
         // In real implementation, fetch popular products from database
         const popularProducts: any[] = []; // await ProductModel.getPopularByCategory(category)
         await this.productCache.cachePopularProducts(popularProducts, category);
       }
    } catch (error) {
      console.error('Error warming popular products cache:', error);
    }
  }

  // Warm category data cache
  private async warmCategoryData(): Promise<void> {
         try {
       // In real implementation, fetch from database
       const categories: string[] = []; // await ProductModel.getDistinctCategories()
       await this.categoryCache.cacheCategoryList(categories);
       
       const brands: string[] = []; // await ProductModel.getDistinctBrands()
       await this.categoryCache.cacheBrandList(brands);
    } catch (error) {
      console.error('Error warming category data cache:', error);
    }
  }

  // Warm market trends cache
  private async warmMarketTrends(): Promise<void> {
    try {
      const timeframes: ('daily' | 'weekly' | 'monthly')[] = ['daily', 'weekly', 'monthly'];
      
      for (const timeframe of timeframes) {
        // In real implementation, calculate trends from database
        const trends = {}; // await AnalyticsModel.getMarketTrends(timeframe)
        await this.categoryCache.cacheMarketTrends(timeframe, trends);
      }
    } catch (error) {
      console.error('Error warming market trends cache:', error);
    }
  }
}

// Cache monitoring and health service
export class CacheHealthService {
  private cache = new CacheManager();

  // Get cache health metrics
  async getCacheHealth(): Promise<any> {
    try {
      const healthKey = enhancedCacheKeys.cacheHealth();
      
      // Check if health data is cached
      const cachedHealth = await this.cache.get(healthKey);
      if (cachedHealth) {
        return cachedHealth;
      }
      
      // Calculate health metrics
      const health = await this.calculateHealthMetrics();
      
      // Cache health data for 5 minutes
      await this.cache.set(healthKey, health, 300);
      
      return health;
    } catch (error) {
      Sentry.captureException(error);
      console.error('Error getting cache health:', error);
      return { status: 'error', error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  // Calculate cache health metrics
  private async calculateHealthMetrics(): Promise<any> {
    try {
      const now = new Date();
      const today = now.toISOString().split('T')[0];
      
      // Get basic metrics
      const [hits, misses, sets, deletes, errors] = await Promise.all([
        redis.get(`cache:metrics:daily:${today}:hit`) || 0,
        redis.get(`cache:metrics:daily:${today}:miss`) || 0,
        redis.get(`cache:metrics:daily:${today}:set`) || 0,
        redis.get(`cache:metrics:daily:${today}:delete`) || 0,
        redis.get(`cache:metrics:daily:${today}:error`) || 0
      ]);

      const totalRequests = Number(hits) + Number(misses);
      const hitRate = totalRequests > 0 ? (Number(hits) / totalRequests) * 100 : 0;

      return {
        status: 'healthy',
        timestamp: now.toISOString(),
        metrics: {
          hitRate: Math.round(hitRate * 100) / 100,
          totalRequests,
          hits: Number(hits),
          misses: Number(misses),
          sets: Number(sets),
          deletes: Number(deletes),
          errors: Number(errors)
        },
        recommendations: this.generateRecommendations(hitRate, Number(errors), totalRequests)
      };
         } catch (error) {
       return {
         status: 'error',
         error: error instanceof Error ? error.message : 'Unknown error',
         timestamp: new Date().toISOString()
       };
     }
  }

  // Generate cache optimization recommendations
  private generateRecommendations(hitRate: number, errors: number, totalRequests: number): string[] {
    const recommendations: string[] = [];

    if (hitRate < 50) {
      recommendations.push('Cache hit rate is low. Consider increasing TTL for stable data.');
    }

    if (errors > totalRequests * 0.01) {
      recommendations.push('High error rate detected. Check Redis connection and memory.');
    }

    if (totalRequests > 10000) {
      recommendations.push('High traffic detected. Consider implementing cache partitioning.');
    }

    if (hitRate > 95) {
      recommendations.push('Excellent cache performance! Consider monitoring for cache invalidation needs.');
    }

    return recommendations;
  }
}

// Export singleton instances
export const productCache = new ProductCacheService();
export const userCache = new UserCacheService();
export const categoryCache = new CategoryCacheService();
export const cacheWarming = new CacheWarmingService();
export const cacheHealth = new CacheHealthService();

// Export the base cache manager for custom use cases
export const cache = new CacheManager();

// Cache invalidation utilities
export const cacheInvalidation = {
  // Invalidate all caches related to a product
  async invalidateProduct(productId: string): Promise<void> {
    await productCache.invalidateProductCaches(productId);
  },

  // Invalidate all caches related to a user
  async invalidateUser(userId: string): Promise<void> {
    await userCache.invalidateUserCaches(userId);
  },

  // Invalidate search and category caches
  async invalidateSearchAndCategories(): Promise<void> {
    await Promise.all([
      productCache.invalidateSearchCaches(),
      cache.delPattern('category:*'),
      cache.delPattern('popular:*'),
      cache.delPattern('brands:*')
    ]);
  },

  // Global cache flush (use carefully!)
  async flushAll(): Promise<void> {
    try {
      // Note: This would flush the entire Redis database
      // In production, you might want to be more selective
      console.warn('Flushing all cache data...');
      // await redis.flushall(); // Commented out for safety
    } catch (error) {
      Sentry.captureException(error);
      console.error('Error flushing cache:', error);
    }
  }
};