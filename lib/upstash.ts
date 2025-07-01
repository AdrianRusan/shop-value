import { Redis } from '@upstash/redis';
import { Ratelimit } from '@upstash/ratelimit';

if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
  throw new Error('UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN must be set in environment variables');
}

// Initialize Upstash Redis client
export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

// Rate limiting configurations
export const rateLimits = {
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
};

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