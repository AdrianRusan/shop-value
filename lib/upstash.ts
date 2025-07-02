import { Redis } from '@upstash/redis';
import { Ratelimit } from '@upstash/ratelimit';

// Lazy-initialized Redis client to avoid build-time errors
let _redis: Redis | null = null;

const getRedis = (): Redis => {
  if (!_redis) {
    // Check for mock/development mode
    if (process.env.UPSTASH_REDIS_REST_URL === 'mock' || process.env.NODE_ENV === 'development') {
      // Return a mock Redis client for development
      console.log('Using mock Redis client for development');
      return {
        get: async () => null,
        set: async () => 'OK',
        setex: async () => 'OK',
        incr: async () => 1,
        expire: async () => 1,
        hmset: async () => 'OK',
        lpush: async () => 1,
        ltrim: async () => 'OK',
        del: async () => 1,
        exists: async () => 0,
        keys: async () => [],
        flushall: async () => 'OK',
        ping: async () => 'PONG',
        hget: async () => null,
        hset: async () => 1,
        hdel: async () => 1,
        hgetall: async () => ({}),
        zadd: async () => 1,
        zrange: async () => [],
        zrem: async () => 1,
        lrange: async () => [],
        rpush: async () => 1,
        lpop: async () => null,
        rpop: async () => null,
      } as any;
    }

    if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
      // During build time, we don't have these variables, so we'll create a mock
      if (process.env.NODE_ENV === 'production' && typeof window === 'undefined') {
        // Only throw in production runtime (not build time)
        throw new Error('UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN must be set in environment variables');
      }
      // Return a mock Redis client for build time
      return {
        get: async () => null,
        set: async () => 'OK',
        setex: async () => 'OK',
        incr: async () => 1,
        expire: async () => 1,
        hmset: async () => 'OK',
        lpush: async () => 1,
        ltrim: async () => 'OK',
      } as any;
    }
    
    _redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });
  }
  
  return _redis;
};

// Export a proxy that lazily initializes Redis
export const redis = new Proxy({} as Redis, {
  get(target, prop) {
    const redisInstance = getRedis();
    const value = redisInstance[prop as keyof Redis];
    return typeof value === 'function' ? value.bind(redisInstance) : value;
  }
});

// Rate limiting configurations (lazy-loaded)
const createRateLimits = () => ({
  // API endpoints - 10 requests per minute
  api: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(10, '1 m'),
    analytics: true,
  }),
  
  // Product scraping - 5 requests per minute
  scraping: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(5, '1 m'),
    analytics: true,
  }),
  
  // Email sending - 3 requests per minute
  email: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(3, '1 m'),
    analytics: true,
  }),
  
  // Strict rate limiting for sensitive operations
  sensitive: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(3, '5 m'),
    analytics: true,
  }),
});

let _rateLimits: ReturnType<typeof createRateLimits> | null = null;

export const rateLimits = new Proxy({} as ReturnType<typeof createRateLimits>, {
  get(target, prop) {
    if (!_rateLimits) {
      _rateLimits = createRateLimits();
    }
    return _rateLimits[prop as keyof typeof _rateLimits];
  }
});

// Cache key helpers
export const cacheKeys = {
  product: (url: string) => `product:${Buffer.from(url).toString('base64')}`,
  productPrices: (productId: string) => `prices:${productId}`,
  userProducts: (userId: string) => `user:${userId}:products`,
  userStats: (userId: string) => `user:${userId}:stats`,
  marketData: (category: string) => `market:${category}`,
  scrapeAttempts: (url: string) => `scrape:attempts:${Buffer.from(url).toString('base64')}`,
} as const;

// Cache TTL constants (in seconds)
export const cacheTTL = {
  product: 3600, // 1 hour
  prices: 1800, // 30 minutes
  userData: 300, // 5 minutes
  marketData: 7200, // 2 hours
  scrapeAttempts: 86400, // 24 hours
} as const;