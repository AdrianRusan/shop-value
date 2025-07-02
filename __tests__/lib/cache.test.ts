import { 
  productCache, 
  userCache, 
  categoryCache, 
  cacheHealth,
  cacheInvalidation,
  cache 
} from '@/lib/cache';

// Mock Redis for testing
jest.mock('@/lib/upstash', () => ({
  redis: {
    get: jest.fn(),
    set: jest.fn(),
    setex: jest.fn(),
    del: jest.fn(),
    exists: jest.fn(),
    incr: jest.fn(),
    expire: jest.fn()
  },
  rateLimits: {
    api: { limit: jest.fn() },
    sensitive: { limit: jest.fn() }
  }
}));

import { redis } from '@/lib/upstash';

const mockRedis = redis as jest.Mocked<typeof redis>;

describe('Cache System', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('ProductCacheService', () => {
    describe('cacheProductSearch', () => {
      it('should cache product search results with correct TTL', async () => {
        const query = 'laptop';
        const filters = { category: 'electronics', minPrice: 100 };
        const results = [{ id: '1', title: 'Gaming Laptop' }];

        mockRedis.setex.mockResolvedValue('OK');
        mockRedis.incr.mockResolvedValue(1);
        mockRedis.expire.mockResolvedValue(1);

        const success = await productCache.cacheProductSearch(query, filters, results);

        expect(success).toBe(true);
        expect(mockRedis.setex).toHaveBeenCalledWith(
          expect.stringContaining('search:products:'),
          1800, // 30 minutes TTL
          expect.stringContaining('"results"')
        );
      });

      it('should handle caching errors gracefully', async () => {
        mockRedis.setex.mockRejectedValue(new Error('Redis error'));

        const success = await productCache.cacheProductSearch('query', {}, []);

        expect(success).toBe(false);
      });
    });

    describe('getCachedProductSearch', () => {
      it('should retrieve cached search results', async () => {
        const cachedData = {
          results: [{ id: '1', title: 'Laptop' }],
          timestamp: new Date().toISOString(),
          query: 'laptop',
          filters: {},
          count: 1
        };

        mockRedis.get.mockResolvedValue(JSON.stringify(cachedData));
        mockRedis.incr.mockResolvedValue(1);
        mockRedis.expire.mockResolvedValue(1);

        const result = await productCache.getCachedProductSearch('laptop', {});

        expect(result).toEqual(cachedData);
        expect(mockRedis.get).toHaveBeenCalledWith(
          expect.stringContaining('search:products:')
        );
      });

      it('should return null for cache miss', async () => {
        mockRedis.get.mockResolvedValue(null);
        mockRedis.incr.mockResolvedValue(1);
        mockRedis.expire.mockResolvedValue(1);

        const result = await productCache.getCachedProductSearch('query', {});

        expect(result).toBeNull();
      });
    });

    describe('cachePriceHistory', () => {
      it('should cache price history with correct structure', async () => {
        const productId = 'prod_123';
        const priceHistory = [
          { price: 100, date: new Date(), source: 'flip' },
          { price: 95, date: new Date(), source: 'flip' }
        ];

        mockRedis.setex.mockResolvedValue('OK');
        mockRedis.incr.mockResolvedValue(1);
        mockRedis.expire.mockResolvedValue(1);

        const success = await productCache.cachePriceHistory(productId, priceHistory);

        expect(success).toBe(true);
        expect(mockRedis.setex).toHaveBeenCalledWith(
          `prices:${productId}`,
          10800, // 3 hours TTL
          expect.stringContaining('"priceHistory"')
        );
      });
    });

    describe('invalidateProductCaches', () => {
      it('should invalidate all product-related caches', async () => {
        const productId = 'prod_123';

        mockRedis.del.mockResolvedValue(1);
        mockRedis.incr.mockResolvedValue(1);
        mockRedis.expire.mockResolvedValue(1);

        await productCache.invalidateProductCaches(productId);

        expect(mockRedis.del).toHaveBeenCalledWith(`product:${productId}`);
        expect(mockRedis.del).toHaveBeenCalledWith(`prices:${productId}`);
      });
    });
  });

  describe('UserCacheService', () => {
    describe('cacheUserSubscription', () => {
      it('should use correct TTL based on subscription plan', async () => {
        const userId = 'user_123';
        const subscriptionData = { plan: 'pro', status: 'active' };

        mockRedis.setex.mockResolvedValue('OK');
        mockRedis.incr.mockResolvedValue(1);
        mockRedis.expire.mockResolvedValue(1);

        await userCache.cacheUserSubscription(userId, subscriptionData);

        expect(mockRedis.setex).toHaveBeenCalledWith(
          `user:${userId}:subscription`,
          900, // Pro plan TTL (15 minutes)
          expect.any(String)
        );
      });

      it('should use free plan TTL for free users', async () => {
        const userId = 'user_123';
        const subscriptionData = { plan: 'free', status: 'active' };

        mockRedis.setex.mockResolvedValue('OK');
        mockRedis.incr.mockResolvedValue(1);
        mockRedis.expire.mockResolvedValue(1);

        await userCache.cacheUserSubscription(userId, subscriptionData);

        expect(mockRedis.setex).toHaveBeenCalledWith(
          `user:${userId}:subscription`,
          300, // Free plan TTL (5 minutes)
          expect.any(String)
        );
      });
    });

    describe('cacheUserProducts', () => {
      it('should cache user products with filters', async () => {
        const userId = 'user_123';
        const data = { products: [], pagination: {}, summary: {} };
        const filters = { category: 'electronics', status: 'active' };

        mockRedis.setex.mockResolvedValue('OK');
        mockRedis.incr.mockResolvedValue(1);
        mockRedis.expire.mockResolvedValue(1);

        const success = await userCache.cacheUserProducts(userId, data, filters);

        expect(success).toBe(true);
        expect(mockRedis.setex).toHaveBeenCalledWith(
          expect.stringContaining(`user:${userId}:products:`),
          1800, // 30 minutes TTL
          expect.stringContaining('"products"')
        );
      });
    });
  });

  describe('CategoryCacheService', () => {
    describe('cacheCategoryStats', () => {
      it('should cache category statistics', async () => {
        const category = 'electronics';
        const stats = { productCount: 100, averagePrice: 299.99 };

        mockRedis.setex.mockResolvedValue('OK');
        mockRedis.incr.mockResolvedValue(1);
        mockRedis.expire.mockResolvedValue(1);

        const success = await categoryCache.cacheCategoryStats(category, stats);

        expect(success).toBe(true);
        expect(mockRedis.setex).toHaveBeenCalledWith(
          `category:${category}:stats`,
          3600, // 1 hour TTL
          expect.stringContaining('"productCount"')
        );
      });
    });

    describe('cacheCategoryList', () => {
      it('should cache the list of categories', async () => {
        const categories = ['electronics', 'fashion', 'home', 'sports'];

        mockRedis.setex.mockResolvedValue('OK');
        mockRedis.incr.mockResolvedValue(1);
        mockRedis.expire.mockResolvedValue(1);

        const success = await categoryCache.cacheCategoryList(categories);

        expect(success).toBe(true);
        expect(mockRedis.setex).toHaveBeenCalledWith(
          'categories:list',
          43200, // 12 hours TTL
          expect.stringContaining('"categories"')
        );
      });
    });
  });

  describe('CacheHealthService', () => {
    describe('getCacheHealth', () => {
      it('should return cache health metrics', async () => {
        // Mock Redis responses for metrics
        mockRedis.get.mockImplementation((key: string) => {
          if (key.includes(':hit')) return Promise.resolve('100');
          if (key.includes(':miss')) return Promise.resolve('20');
          if (key.includes(':set')) return Promise.resolve('50');
          if (key.includes(':delete')) return Promise.resolve('10');
          if (key.includes(':error')) return Promise.resolve('2');
          return Promise.resolve(null);
        });

        mockRedis.setex.mockResolvedValue('OK');
        mockRedis.incr.mockResolvedValue(1);
        mockRedis.expire.mockResolvedValue(1);

        const health = await cacheHealth.getCacheHealth();

        expect(health).toHaveProperty('status');
        expect(health).toHaveProperty('metrics');
        expect(health.metrics).toHaveProperty('hitRate');
        expect(health.metrics).toHaveProperty('totalRequests');
        expect(health.metrics.hitRate).toBeGreaterThan(0);
      });

      it('should generate recommendations based on metrics', async () => {
        // Mock poor performance metrics
        mockRedis.get.mockImplementation((key: string) => {
          if (key.includes(':hit')) return Promise.resolve('10');
          if (key.includes(':miss')) return Promise.resolve('90');
          if (key.includes(':error')) return Promise.resolve('5');
          return Promise.resolve('0');
        });

        mockRedis.setex.mockResolvedValue('OK');
        mockRedis.incr.mockResolvedValue(1);
        mockRedis.expire.mockResolvedValue(1);

        const health = await cacheHealth.getCacheHealth();

        expect(health.recommendations).toContain(
          expect.stringContaining('Cache hit rate is low')
        );
        expect(health.recommendations).toContain(
          expect.stringContaining('High error rate detected')
        );
      });
    });
  });

  describe('Cache Invalidation', () => {
    describe('invalidateProduct', () => {
      it('should invalidate all product-related caches', async () => {
        const productId = 'prod_123';

        mockRedis.del.mockResolvedValue(1);
        mockRedis.incr.mockResolvedValue(1);
        mockRedis.expire.mockResolvedValue(1);

        await cacheInvalidation.invalidateProduct(productId);

        expect(mockRedis.del).toHaveBeenCalledTimes(2); // product and prices
      });
    });

    describe('invalidateUser', () => {
      it('should invalidate all user-related caches', async () => {
        const userId = 'user_123';

        mockRedis.del.mockResolvedValue(1);
        mockRedis.incr.mockResolvedValue(1);
        mockRedis.expire.mockResolvedValue(1);

        await cacheInvalidation.invalidateUser(userId);

        // Should attempt to delete user pattern caches
        expect(mockRedis.del).toHaveBeenCalled();
      });
    });
  });

  describe('Performance Tests', () => {
    it('should complete cache operations within acceptable time limits', async () => {
      const startTime = Date.now();

      mockRedis.setex.mockResolvedValue('OK');
      mockRedis.get.mockResolvedValue(JSON.stringify({ test: 'data' }));
      mockRedis.incr.mockResolvedValue(1);
      mockRedis.expire.mockResolvedValue(1);

      // Perform multiple cache operations
      await Promise.all([
        cache.set('test1', { data: 'value1' }),
        cache.set('test2', { data: 'value2' }),
        cache.get('test1'),
        cache.get('test2')
      ]);

      const duration = Date.now() - startTime;

      // Should complete within 100ms (very generous for mocked operations)
      expect(duration).toBeLessThan(100);
    });

    it('should handle concurrent cache operations', async () => {
      mockRedis.setex.mockResolvedValue('OK');
      mockRedis.get.mockResolvedValue(JSON.stringify({ test: 'data' }));
      mockRedis.incr.mockResolvedValue(1);
      mockRedis.expire.mockResolvedValue(1);

      // Simulate 10 concurrent operations
      const operations = Array.from({ length: 10 }, (_, i) =>
        cache.set(`concurrent_test_${i}`, { value: i })
      );

      const results = await Promise.all(operations);

      // All operations should succeed
      results.forEach(result => {
        expect(result).toBe(true);
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle Redis connection errors gracefully', async () => {
      mockRedis.get.mockRejectedValue(new Error('Connection refused'));
      mockRedis.incr.mockResolvedValue(1);
      mockRedis.expire.mockResolvedValue(1);

      const result = await cache.get('test_key');

      expect(result).toBeNull();
      // Should not throw an error
    });

    it('should handle Redis write errors gracefully', async () => {
      mockRedis.setex.mockRejectedValue(new Error('Disk full'));

      const result = await cache.set('test_key', 'test_value');

      expect(result).toBe(false);
      // Should not throw an error
    });
  });

  describe('TTL Configuration', () => {
    it('should respect custom TTL values', async () => {
      mockRedis.setex.mockResolvedValue('OK');
      mockRedis.incr.mockResolvedValue(1);
      mockRedis.expire.mockResolvedValue(1);

      const customTTL = 7200; // 2 hours
      await cache.set('test_key', 'test_value', customTTL);

      expect(mockRedis.setex).toHaveBeenCalledWith(
        'test_key',
        customTTL,
        '"test_value"'
      );
    });

    it('should use default TTL when none specified', async () => {
      mockRedis.setex.mockResolvedValue('OK');
      mockRedis.incr.mockResolvedValue(1);
      mockRedis.expire.mockResolvedValue(1);

      await cache.set('test_key', 'test_value');

      expect(mockRedis.setex).toHaveBeenCalledWith(
        'test_key',
        3600, // Default 1 hour
        '"test_value"'
      );
    });
  });
});