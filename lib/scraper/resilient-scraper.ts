import axios from 'axios';
import * as cheerio from 'cheerio';
import { scrapeFlipProduct } from './index';
import { redis } from '@/lib/upstash';
import { rateLimits } from '@/lib/upstash';

// Scraping strategy interfaces
export interface ScrapingStrategy {
  name: string;
  scrape: (url: string) => Promise<ScrapingResult | null>;
  timeout: number;
  reliability: number; // 0-1 score
  enabled: boolean;
}

export interface ScrapingResult {
  price: number;
  title: string;
  availability: 'in_stock' | 'out_of_stock' | 'limited' | 'discontinued';
  currency: string;
  confidence: number; // 0-1 score
  selector: string;
  scrapedAt: Date;
  strategy: string;
  image?: string;
  brand?: string;
  category?: string;
}

export interface Product {
  _id: string;
  url: string;
  source: string;
  scraping?: {
    selector?: string;
    lastSuccessful?: Date;
    failureCount?: number;
    lastFailedAt?: Date;
    isBlocked?: boolean;
    blockedAt?: Date;
  };
}

// User agents for rotation
const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:120.0) Gecko/20100101 Firefox/120.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:120.0) Gecko/20100101 Firefox/120.0',
];

// Common viewports
const VIEWPORTS = [
  { width: 1920, height: 1080 },
  { width: 1366, height: 768 },
  { width: 1536, height: 864 },
  { width: 1440, height: 900 },
  { width: 1280, height: 720 },
];

// Extract price from text using multiple patterns
const extractPriceFromText = (priceText: string): number => {
  if (!priceText) return 0;
  
  // Remove all non-numeric characters except dots and commas
  const cleanText = priceText.replace(/[^\d.,]/g, '');
  
  // Handle different price formats
  let price = 0;
  
  // Pattern 1: 1.234,56 (European format)
  if (cleanText.includes('.') && cleanText.includes(',')) {
    const lastComma = cleanText.lastIndexOf(',');
    const beforeComma = cleanText.substring(0, lastComma).replace(/[.,]/g, '');
    const afterComma = cleanText.substring(lastComma + 1);
    price = parseFloat(`${beforeComma}.${afterComma}`);
  }
  // Pattern 2: 1234,56 (Romanian format)
  else if (cleanText.includes(',') && !cleanText.includes('.')) {
    price = parseFloat(cleanText.replace(',', '.'));
  }
  // Pattern 3: 1234.56 (US format)
  else if (cleanText.includes('.') && !cleanText.includes(',')) {
    price = parseFloat(cleanText);
  }
  // Pattern 4: Plain number
  else {
    const numericPrice = parseInt(cleanText, 10);
    // If it's a large number, treat last two digits as decimals
    price = numericPrice > 999 ? numericPrice / 100 : numericPrice;
  }
  
  return isNaN(price) ? 0 : price;
};

// Strategy 1: Enhanced Flip.ro scraper with anti-detection
const scrapeFlipEnhanced = async (url: string): Promise<ScrapingResult | null> => {
  try {
    // Rate limiting
    const { success } = await rateLimits.scraping.limit('flip-enhanced');
    if (!success) {
      throw new Error('Rate limit exceeded for enhanced scraping');
    }

    // Random delay to appear more human
    await new Promise(resolve => setTimeout(resolve, Math.random() * 2000 + 1000));

    const userAgent = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
    
    // BrightData proxy configuration
    const username = String(process.env.BRIGHTDATA_USERNAME || '');
    const password = String(process.env.BRIGHTDATA_PASSWORD || '');
    const port = 22225;
    const session_id = (1000000 * Math.random()) | 0;

    const options = {
      headers: {
        'User-Agent': userAgent,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'ro-RO,ro;q=0.9,en;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
        'DNT': '1',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
      },
      timeout: 30000,
    };

    // Add proxy if available
    if (username && password) {
      (options as any).auth = {
        username: `${username}-session-${session_id}`,
        password: password,
      };
      (options as any).host = 'brd.superproxy.io';
      (options as any).port = port;
      (options as any).rejectUnauthorized = false;
    }

    const response = await axios.get(url, options);
    const $ = cheerio.load(response.data);

    // Try multiple price selectors
    const priceSelectors = [
      '#pdp-price-value',
      '#pdp-price-new-value', 
      '.price-current',
      '.price',
      '[data-price]',
      '.current-price',
      '.final-price'
    ];

    let price = 0;
    let usedSelector = '';
    
    for (const selector of priceSelectors) {
      const priceElement = $(selector).first();
      if (priceElement.length > 0) {
        const priceText = priceElement.text().trim();
        price = extractPriceFromText(priceText);
        if (price > 0) {
          usedSelector = selector;
          break;
        }
      }
    }

    if (price === 0) {
      throw new Error('No valid price found');
    }

    // Get product title
    const title = $('#pdp-title .leading-3.font-semibold').text().trim() || 
                  $('h1').first().text().trim() ||
                  $('title').text().trim();

    // Check availability
    const outOfStockElement = $('span.badge.stoc-alert-new.py-2.mb-3.badge-secondary');
    const outOfStockText = outOfStockElement.text().trim().toLowerCase();
    const isOutOfStock = outOfStockText.includes('va reveni curand in stoc') || 
                        outOfStockText.includes('stoc epuizat') ||
                        $('.out-of-stock').length > 0;

    return {
      price,
      title,
      availability: isOutOfStock ? 'out_of_stock' : 'in_stock',
      currency: 'RON',
      confidence: 0.9,
      selector: usedSelector,
      scrapedAt: new Date(),
      strategy: 'flip-enhanced'
    };

  } catch (error) {
    console.error('Enhanced Flip scraper failed:', error);
    return null;
  }
};

// Strategy 2: Fallback scraper with simplified approach
const scrapeFallback = async (url: string): Promise<ScrapingResult | null> => {
  try {
    const { success } = await rateLimits.scraping.limit('fallback');
    if (!success) {
      throw new Error('Rate limit exceeded for fallback scraping');
    }

    // Use the original scraper as fallback
    const result = await scrapeFlipProduct(url);
    if (!result || !result.currentPrice) {
      return null;
    }

    return {
      price: result.currentPrice,
      title: result.title,
      availability: result.isOutOfStock ? 'out_of_stock' : 'in_stock',
      currency: result.currency || 'RON',
      confidence: 0.7,
      selector: 'fallback',
      scrapedAt: new Date(),
      strategy: 'fallback'
    };

  } catch (error) {
    console.error('Fallback scraper failed:', error);
    return null;
  }
};

// Strategy 3: Cached price retrieval
const getCachedPrice = async (url: string): Promise<ScrapingResult | null> => {
  try {
    const cacheKey = `last_price:${Buffer.from(url).toString('base64')}`;
    const cachedData = await redis.get(cacheKey);
    
    if (cachedData) {
      const parsed = typeof cachedData === 'string' ? JSON.parse(cachedData) : cachedData;
      return {
        price: parsed.price,
        title: parsed.title,
        availability: parsed.availability || 'in_stock',
        currency: parsed.currency || 'RON',
        confidence: 0.6, // Lower confidence for cached data
        selector: 'cached',
        scrapedAt: new Date(parsed.scrapedAt),
        strategy: 'cached'
      };
    }

    return null;
  } catch (error) {
    console.error('Cache retrieval failed:', error);
    return null;
  }
};

// Main scraping strategies
export const scrapingStrategies: ScrapingStrategy[] = [
  {
    name: 'flip-enhanced',
    scrape: scrapeFlipEnhanced,
    timeout: 30000,
    reliability: 0.85,
    enabled: true
  },
  {
    name: 'fallback',
    scrape: scrapeFallback,
    timeout: 25000,
    reliability: 0.70,
    enabled: true
  },
  {
    name: 'cached',
    scrape: getCachedPrice,
    timeout: 1000,
    reliability: 0.60,
    enabled: true
  }
];

// Main resilient scraper function
export const scrapeWithFallbacks = async (product: Product): Promise<ScrapingResult | null> => {
  const enabledStrategies = scrapingStrategies.filter(s => s.enabled);
  
  // Sort by reliability (highest first)
  enabledStrategies.sort((a, b) => b.reliability - a.reliability);

  for (const strategy of enabledStrategies) {
    try {
      console.log(`Attempting ${strategy.name} for ${product.url}`);
      
      const result = await Promise.race([
        strategy.scrape(product.url),
        new Promise<null>((_, reject) => 
          setTimeout(() => reject(new Error('Timeout')), strategy.timeout)
        )
      ]);
      
      if (result && result.price > 0) {
        // Track successful strategy
        await redis.incr(`scraping:success:${strategy.name}`);
        
        // Cache the result
        const cacheKey = `last_price:${Buffer.from(product.url).toString('base64')}`;
        await redis.setex(cacheKey, 3600 * 6, JSON.stringify({
          price: result.price,
          title: result.title,
          availability: result.availability,
          currency: result.currency,
          scrapedAt: result.scrapedAt
        }));
        
        console.log(`✅ ${strategy.name} succeeded for ${product.url}: ${result.currency}${result.price}`);
        return result;
      }
      
    } catch (error) {
      console.error(`❌ ${strategy.name} failed for ${product.url}:`, error);
      
      // Track failed strategy
      await redis.incr(`scraping:failure:${strategy.name}`);
      
      // Continue to next strategy
      continue;
    }
  }
  
  // All strategies failed
  console.error(`🚨 All scraping strategies failed for ${product.url}`);
  return null;
};

// Scrape with retry logic and exponential backoff
export const scrapeWithRetry = async (
  product: Product, 
  maxRetries: number = 3
): Promise<ScrapingResult | null> => {
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await scrapeWithFallbacks(product);
      
      if (result) {
        // Reset failure count on success
        await redis.del(`failure_count:${product._id}`);
        return result;
      }
      
    } catch (error) {
      const delay = Math.min(1000 * Math.pow(2, attempt), 30000); // Max 30s delay
      
      console.log(`Retry ${attempt}/${maxRetries} for ${product.url} in ${delay}ms`);
      
      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  // Track consecutive failures
  const failureKey = `failure_count:${product._id}`;
  const failureCount = await redis.incr(failureKey);
  await redis.expire(failureKey, 3600 * 24); // Reset after 24 hours
  
  // If too many failures, mark as potentially blocked
  if (failureCount >= 5) {
    console.warn(`Product ${product.url} marked as potentially blocked after ${failureCount} failures`);
    // Could send admin alert here
  }
  
  return null;
};

// Get scraping statistics
export const getScrapingStats = async () => {
  try {
    const strategies = scrapingStrategies.map(s => s.name);
    const stats: any = {};
    
    for (const strategy of strategies) {
      const [success, failure] = await Promise.all([
        redis.get(`scraping:success:${strategy}`),
        redis.get(`scraping:failure:${strategy}`)
      ]);
      
      stats[strategy] = {
        success: parseInt(success as string) || 0,
        failure: parseInt(failure as string) || 0,
      };
      
      const total = stats[strategy].success + stats[strategy].failure;
      stats[strategy].successRate = total > 0 ? (stats[strategy].success / total) * 100 : 0;
    }
    
    return stats;
  } catch (error) {
    console.error('Error getting scraping stats:', error);
    return null;
  }
};