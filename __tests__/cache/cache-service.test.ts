import { cacheService, cacheInvalidation, cacheWarmer, CacheMetrics, CACHE_CONFIG } from '@/lib/cache/cache-service';

// Mock Redis for testing
jest.mock('@/lib/upstash', () => ({
  redis: {
    get: jest.fn(),
    set: jest.fn(),
    setex: jest.fn(),
    del: jest.fn(),
    scan: jest.fn(),
    incr: jest.fn(),
    dbsize: jest.fn(),
    info: jest.fn()
  },
  cacheKeys: {
    product: (id: string) => `product:${id}`,
    productPrices: (id: string) => `prices:${id}`,
    userProducts: (userId: string) => `user:${userId}:products`,
    userStats: (userId: string) => `user:${userId}:stats`,
    marketData: (type: string) => `market:${type}`
  },
  cacheTTL: {
    product: 3600,
    prices: 1800,
    userData: 300,
    marketData: 7200,
    scrapeAttempts: 86400
  }
}));

// Mock database connection and models
jest.mock('@/lib/mongoose', () => ({
  connectToDB: jest.fn()
}));

jest.mock('@/lib/models/product.model', () => ({
  find: jest.fn(() => ({
    sort: jest.fn(() => ({
      limit: jest.fn(() => ({
        select: jest.fn(() => ({
          lean: jest.fn(() => Promise.resolve([
            {
              _id: 'product1',
              title: 'Test Product 1',
              brand: 'TestBrand',
              category: 'electronics',
              currentPrice: 100,
              originalPrice: 120,
              analytics: { popularityScore: 85 }
            }
          ]))
        }))
      }))
    }))
  })),
  aggregate: jest.fn(() => Promise.resolve([
    {
      _id: 'electronics',
      count: 50,
      avgPrice: 150,
      minPrice: 50,
      maxPrice: 500,
      popularityScore: 75
    }
  ])),
  countDocuments: jest.fn(() => Promise.resolve(100))
}));

jest.mock('@/lib/models/user.model', () => ({
  countDocuments: jest.fn(() => Promise.resolve(50))
}));

jest.mock('@/lib/models/user-product-tracking.model', () => ({
  countDocuments: jest.fn(() => Promise.resolve(200))
}));

const { redis } = require('@/lib/upstash');

describe('CacheService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Basic Cache Operations', () => {
    test('should get cached data successfully', async () => {
      const testData = { id: 1, name: 'test' };
      redis.get.mockResolvedValue(JSON.stringify(testData));

      const result = await cacheService.get('test-key');
      
      expect(result).toEqual(testData);
      expect(redis.get).toHaveBeenCalledWith('test-key');
    });

    test('should return null for non-existent cache key', async () => {
      redis.get.mockResolvedValue(null);

      const result = await cacheService.get('non-existent-key');
      
      expect(result).toBeNull();
    });

    test('should set cache data with TTL', async () => {
      const testData = { id: 1, name: 'test' };
      redis.setex.mockResolvedValue('OK');

      await cacheService.set('test-key', testData, 3600);
      
      expect(redis.setex).toHaveBeenCalledWith('test-key', 3600, JSON.stringify(testData));
    });

    test('should set cache data without TTL', async () => {
      const testData = { id: 1, name: 'test' };
      redis.set.mockResolvedValue('OK');

      await cacheService.set('test-key', testData);
      
      expect(redis.set).toHaveBeenCalledWith('test-key', JSON.stringify(testData));
    });

    test('should delete cache key', async () => {
      redis.del.mockResolvedValue(1);

      await cacheService.delete('test-key');
      
      expect(redis.del).toHaveBeenCalledWith('test-key');
    });
  });

  describe('Cache Invalidation', () => {
    test('should invalidate pattern-based cache keys', async () => {
      redis.scan.mockResolvedValueOnce([0, ['user:123:products', 'user:456:products']]);
      redis.del.mockResolvedValue(2);

      await cacheService.invalidatePattern('user:*:products');
      
      expect(redis.scan).toHaveBeenCalled();
      expect(redis.del).toHaveBeenCalledWith('user:123:products', 'user:456:products');
    });

    test('should invalidate product cache with options', async () => {
      const deleteSpy = jest.spyOn(cacheService, 'delete').mockResolvedValue();
      const invalidatePatternSpy = jest.spyOn(cacheService, 'invalidatePattern').mockResolvedValue();

      await cacheInvalidation.invalidateProductCache('product123', {
        userId: 'user456',
        category: 'electronics',
        brand: 'testbrand'
      });

      expect(deleteSpy).toHaveBeenCalledWith('product:product123');
      expect(invalidatePatternSpy).toHaveBeenCalledWith('search:products:*');
    });

    test('should invalidate user cache', async () => {
      const deleteSpy = jest.spyOn(cacheService, 'delete').mockResolvedValue();
      const invalidatePatternSpy = jest.spyOn(cacheService, 'invalidatePattern').mockResolvedValue();

      await cacheInvalidation.invalidateUserCache('user123');

      expect(deleteSpy).toHaveBeenCalledWith('user:user123:products');
      expect(deleteSpy).toHaveBeenCalledWith('user:user123:stats');
      expect(invalidatePatternSpy).toHaveBeenCalledWith('user:user123:*');
    });
  });

  describe('Cache Warming', () => {
    test('should warm cache successfully', async () => {
      const setSpy = jest.spyOn(cacheService, 'set').mockResolvedValue();

      await cacheService.warmCache();

      expect(setSpy).toHaveBeenCalledWith(
        'market:popular_products',
        expect.any(Array),
        CACHE_CONFIG.POPULAR_PRODUCTS.ttl
      );
      expect(setSpy).toHaveBeenCalledWith(
        'market:category_stats',
        expect.any(Array),
        CACHE_CONFIG.CATEGORY_DATA.ttl
      );
    });

    test('should schedule cache warming', async () => {
      const warmCacheSpy = jest.spyOn(cacheService, 'warmCache').mockResolvedValue();
      
      // Test immediate warming
      await cacheWarmer.warmCache();
      
      expect(warmCacheSpy).toHaveBeenCalled();
    });

    test('should prevent concurrent cache warming', async () => {
      const warmCacheSpy = jest.spyOn(cacheService, 'warmCache').mockResolvedValue();
      
      // Start first warming
      const firstWarm = cacheWarmer.warmCache();
      
      // Try to start second warming while first is running
      const secondWarm = cacheWarmer.warmCache();
      
      await Promise.all([firstWarm, secondWarm]);
      
      // warmCache should only be called once due to isWarming flag
      expect(warmCacheSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('Cache Metrics', () => {
    test('should get cache statistics', async () => {
      redis.get.mockImplementation((key: string) => {
        if (key === 'cache:stats:hits') return Promise.resolve('150');
        if (key === 'cache:stats:misses') return Promise.resolve('50');
        return Promise.resolve('0');
      });
      redis.dbsize.mockResolvedValue(1000);
      redis.info.mockResolvedValue('used_memory:1048576');

      const stats = await CacheMetrics.getStats();

      expect(stats).toEqual({
        hits: 150,
        misses: 50,
        hitRate: 75,
        totalKeys: 1000,
        memoryUsage: 'used_memory:1048576'
      });
    });

    test('should increment cache hit counter', async () => {
      redis.incr.mockResolvedValue(1);

      await CacheMetrics.incrementHit();

      expect(redis.incr).toHaveBeenCalledWith('cache:stats:hits');
    });

    test('should increment cache miss counter', async () => {
      redis.incr.mockResolvedValue(1);

      await CacheMetrics.incrementMiss();

      expect(redis.incr).toHaveBeenCalledWith('cache:stats:misses');
    });
  });

  describe('Cache Configuration', () => {
    test('should have correct TTL values', () => {
      expect(CACHE_CONFIG.PRODUCTS_SEARCH.ttl).toBe(3600);
      expect(CACHE_CONFIG.USER_PRODUCTS.ttl).toBe(300);
      expect(CACHE_CONFIG.POPULAR_PRODUCTS.ttl).toBe(7200);
      expect(CACHE_CONFIG.ANALYTICS_DASHBOARD.ttl).toBe(900);
    });

    test('should have correct key patterns', () => {
      expect(CACHE_CONFIG.PRODUCTS_SEARCH.keyPattern).toBe('search:products:*');
      expect(CACHE_CONFIG.USER_PRODUCTS.keyPattern).toBe('user:*:products');
      expect(CACHE_CONFIG.POPULAR_PRODUCTS.keyPattern).toBe('popular:*');
    });
  });

  describe('Error Handling', () => {
    test('should handle Redis connection errors gracefully', async () => {
      redis.get.mockRejectedValue(new Error('Redis connection failed'));

      const result = await cacheService.get('test-key');

      expect(result).toBeNull();
    });

    test('should handle cache set errors gracefully', async () => {
      redis.setex.mockRejectedValue(new Error('Redis write failed'));

      // Should not throw an error
      await expect(cacheService.set('test-key', 'test-value', 3600)).resolves.toBeUndefined();
    });

    test('should handle cache delete errors gracefully', async () => {
      redis.del.mockRejectedValue(new Error('Redis delete failed'));

      // Should not throw an error
      await expect(cacheService.delete('test-key')).resolves.toBeUndefined();
    });
  });

  describe('Performance Tests', () => {
    test('should handle large data sets efficiently', async () => {
      const largeData = Array.from({ length: 1000 }, (_, i) => ({ id: i, name: `item-${i}` }));
      redis.setex.mockResolvedValue('OK');

      const startTime = Date.now();
      await cacheService.set('large-dataset', largeData, 3600);
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(100); // Should complete within 100ms
      expect(redis.setex).toHaveBeenCalledWith('large-dataset', 3600, JSON.stringify(largeData));
    });

    test('should batch invalidate multiple keys efficiently', async () => {
      const keys = Array.from({ length: 100 }, (_, i) => `key-${i}`);
      redis.scan.mockResolvedValueOnce([0, keys]);
      redis.del.mockResolvedValue(keys.length);

      const startTime = Date.now();
      await cacheService.invalidatePattern('key-*');
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(200); // Should complete within 200ms
      expect(redis.del).toHaveBeenCalledWith(...keys);
    });
  });
});

describe('Integration Tests', () => {
  test('should handle complete cache lifecycle', async () => {
    const testData = { id: 'test123', name: 'Test Product', price: 99.99 };
    
    // Set cache
    redis.setex.mockResolvedValue('OK');
    await cacheService.set('product:test123', testData, 3600);
    
    // Get cache
    redis.get.mockResolvedValue(JSON.stringify(testData));
    const retrieved = await cacheService.get('product:test123');
    expect(retrieved).toEqual(testData);
    
    // Invalidate cache
    redis.del.mockResolvedValue(1);
    await cacheService.delete('product:test123');
    
    // Verify cache is cleared
    redis.get.mockResolvedValue(null);
    const afterDelete = await cacheService.get('product:test123');
    expect(afterDelete).toBeNull();
  });

  test('should handle cache warming with real data flow', async () => {
    const setSpy = jest.spyOn(cacheService, 'set').mockResolvedValue();
    
    await cacheService.warmCache();
    
    // Verify all warming methods were called
    expect(setSpy).toHaveBeenCalledWith(
      'market:popular_products',
      expect.arrayContaining([
        expect.objectContaining({
          title: 'Test Product 1',
          brand: 'TestBrand'
        })
      ]),
      CACHE_CONFIG.POPULAR_PRODUCTS.ttl
    );
  });
});