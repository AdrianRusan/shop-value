/**
 * Enhanced Scraper for Production
 * Includes rate limiting, better error handling, and monitoring
 */

import axios, { AxiosError, AxiosRequestConfig } from 'axios';
import * as cheerio from 'cheerio';
import Bottleneck from 'bottleneck';
import logger, { scrapeLog } from '../logger';

// Custom error classes
export class ScrapingError extends Error {
  constructor(
    message: string,
    public originalError?: any,
    public isRetryable = true,
    public statusCode?: number,
    public url?: string
  ) {
    super(message);
    this.name = 'ScrapingError';
  }
}

export class RateLimitError extends ScrapingError {
  constructor(message: string, url?: string) {
    super(message, null, true, 429, url);
    this.name = 'RateLimitError';
  }
}

export class BlockedError extends ScrapingError {
  constructor(message: string, url?: string) {
    super(message, null, false, 403, url);
    this.name = 'BlockedError';
  }
}

// Configuration interfaces
interface ScraperConfig {
  maxConcurrency: number;
  minTime: number; // Minimum time between requests in ms
  maxRetries: number;
  timeoutMs: number;
  userAgents: string[];
  enableProxyRotation: boolean;
  enableJsRendering: boolean;
  respectRobotsTxt: boolean;
}

interface ProxyConfig {
  host: string;
  port: number;
  username?: string;
  password?: string;
  protocol: 'http' | 'https';
}

interface ScrapeResult {
  url: string;
  data?: any;
  success: boolean;
  duration: number;
  attempts: number;
  error?: ScrapingError;
  statusCode?: number;
  timestamp: string;
}

export class EnhancedScraper {
  private limiter: Bottleneck;
  private config: ScraperConfig;
  private proxies: ProxyConfig[] = [];
  private currentProxyIndex = 0;
  private blockedProxies = new Set<number>();
  private userAgentIndex = 0;
  private robotsCache = new Map<string, boolean>();

  constructor(config?: Partial<ScraperConfig>) {
    this.config = {
      maxConcurrency: 3, // Conservative default
      minTime: 2000, // 2 seconds between requests
      maxRetries: 3,
      timeoutMs: 30000,
      userAgents: [
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.1 Safari/605.1.15',
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:89.0) Gecko/20100101 Firefox/89.0',
        'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      ],
      enableProxyRotation: true,
      enableJsRendering: false,
      respectRobotsTxt: true,
      ...config,
    };

    // Initialize rate limiter
    this.limiter = new Bottleneck({
      maxConcurrent: this.config.maxConcurrency,
      minTime: this.config.minTime,
      reservoir: 10, // Allow burst of 10 requests
      reservoirRefreshAmount: 10,
      reservoirRefreshInterval: 60 * 1000, // Refill every minute
    });

    // Setup proxy configuration
    this.setupProxies();

    // Setup event listeners for monitoring
    this.setupMonitoring();
  }

  /**
   * Setup proxy configuration
   */
  private setupProxies(): void {
    const brightDataConfig = this.getBrightDataConfig();
    if (brightDataConfig) {
      this.proxies.push(brightDataConfig);
    }

    // Add more proxy configurations here if available
    // this.proxies.push(otherProxyConfig);
  }

  /**
   * Get BrightData proxy configuration
   */
  private getBrightDataConfig(): ProxyConfig | null {
    const username = process.env.BRIGHTDATA_USERNAME;
    const password = process.env.BRIGHTDATA_PASSWORD;

    if (!username || !password) {
      logger.warn('BrightData credentials not configured', {}, 'scraping');
      return null;
    }

    return {
      host: 'brd.superproxy.io',
      port: 22225,
      username: `${username}-session-${(1000000 * Math.random()) | 0}`,
      password,
      protocol: 'http',
    };
  }

  /**
   * Setup monitoring for the rate limiter
   */
  private setupMonitoring(): void {
    this.limiter.on('failed', (error, jobInfo) => {
      logger.warn('Scraping job failed', {
        error: error.message,
        jobId: jobInfo.options.id,
        retryCount: jobInfo.retryCount,
      }, 'scraping');
    });

    this.limiter.on('retry', (error, jobInfo) => {
      logger.info('Retrying scraping job', {
        error: error.message,
        jobId: jobInfo.options.id,
        retryCount: jobInfo.retryCount,
      }, 'scraping');
    });

    this.limiter.on('depleted', () => {
      logger.warn('Rate limiter depleted - requests will be queued', {}, 'scraping');
    });
  }

  /**
   * Main scraping method
   */
  async scrape(url: string, options?: {
    parser?: (html: string, url: string) => any;
    customHeaders?: Record<string, string>;
    priority?: number;
    bypassRateLimit?: boolean;
  }): Promise<ScrapeResult> {
    const startTime = Date.now();
    const result: ScrapeResult = {
      url,
      success: false,
      duration: 0,
      attempts: 0,
      timestamp: new Date().toISOString(),
    };

    try {
      // Validate URL
      this.validateUrl(url);

      // Check robots.txt if enabled
      if (this.config.respectRobotsTxt && !(await this.isAllowedByRobots(url))) {
        throw new BlockedError('Blocked by robots.txt', url);
      }

      // Execute scraping with rate limiting
      const scrapeFunction = () => this.executeScrapingAttempts(url, options);

      if (options?.bypassRateLimit) {
        result.data = await scrapeFunction();
      } else {
        result.data = await this.limiter.schedule(
          { priority: options?.priority || 5, id: `scrape-${url}` },
          scrapeFunction
        );
      }

      result.success = true;
      logger.info('Scraping completed successfully', { url }, 'scraping');

    } catch (error: any) {
      result.error = error instanceof ScrapingError ? error : new ScrapingError(
        `Scraping failed: ${error.message}`,
        error,
        true,
        error.status || error.statusCode
      );
      
      logger.error('Scraping failed', error, { url }, 'scraping');
    } finally {
      result.duration = Date.now() - startTime;
      
      // Log to analytics
      scrapeLog(url, result.success, result.duration, result.error, {
        attempts: result.attempts,
        statusCode: result.statusCode,
      });
    }

    return result;
  }

  /**
   * Execute scraping attempts with retries
   */
  private async executeScrapingAttempts(url: string, options?: any): Promise<any> {
    let lastError: any = null;
    let attempts = 0;

    while (attempts < this.config.maxRetries) {
      attempts++;
      
      try {
        logger.debug(`Scraping attempt ${attempts}/${this.config.maxRetries}`, { url }, 'scraping');
        
        const html = await this.fetchHtml(url, options?.customHeaders);
        
        // Use custom parser if provided, otherwise default to flip parser
        if (options?.parser) {
          return options.parser(html, url);
        } else {
          return this.parseFlipProduct(html, url);
        }

      } catch (error: any) {
        lastError = error;
        
        // Determine if we should retry
        const shouldRetry = this.shouldRetry(error, attempts);
        
        if (!shouldRetry || attempts >= this.config.maxRetries) {
          break;
        }

        // Exponential backoff with jitter
        const delay = this.calculateRetryDelay(attempts);
        logger.debug(`Waiting ${delay}ms before retry`, { url, attempts }, 'scraping');
        await this.sleep(delay);

        // Rotate proxy if the current one is failing
        if (error.statusCode === 403 || error.statusCode === 429) {
          this.rotateProxy();
        }
      }
    }

    // All attempts failed
    throw lastError instanceof ScrapingError 
      ? lastError 
      : new ScrapingError(`Failed after ${attempts} attempts: ${lastError?.message}`, lastError, false);
  }

  /**
   * Fetch HTML content
   */
  private async fetchHtml(url: string, customHeaders?: Record<string, string>): Promise<string> {
    const proxy = this.getCurrentProxy();
    const userAgent = this.getRotatedUserAgent();
    
    const config: AxiosRequestConfig = {
      timeout: this.config.timeoutMs,
      headers: {
        'User-Agent': userAgent,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate',
        'DNT': '1',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        ...customHeaders,
      },
      validateStatus: (status) => status < 500, // Don't throw on 4xx errors
    };

    // Add proxy configuration if available
    if (proxy && !this.blockedProxies.has(this.currentProxyIndex)) {
      config.proxy = {
        host: proxy.host,
        port: proxy.port,
        auth: proxy.username && proxy.password ? {
          username: proxy.username,
          password: proxy.password,
        } : undefined,
        protocol: proxy.protocol,
      };
    }

    try {
      const response = await axios.get(url, config);
      
      // Handle different status codes
      if (response.status === 429) {
        throw new RateLimitError('Rate limited by target server', url);
      }
      
      if (response.status === 403) {
        throw new BlockedError('Access forbidden', url);
      }
      
      if (response.status >= 400) {
        throw new ScrapingError(`HTTP ${response.status}: ${response.statusText}`, null, response.status < 500, response.status, url);
      }
      
      // Validate response content
      if (!response.data || response.data.length < 1000) {
        throw new ScrapingError('Response too short, likely blocked or empty page', null, true, response.status, url);
      }

      return response.data;

    } catch (error: any) {
      if (error instanceof ScrapingError) {
        throw error;
      }
      
      if (error.code === 'ENOTFOUND') {
        throw new ScrapingError('DNS resolution failed', error, false, undefined, url);
      }
      
      if (error.code === 'ECONNREFUSED') {
        throw new ScrapingError('Connection refused', error, true, undefined, url);
      }
      
      if (error.code === 'ETIMEDOUT') {
        throw new ScrapingError('Request timeout', error, true, undefined, url);
      }
      
      throw new ScrapingError(`Network error: ${error.message}`, error, true, error.status, url);
    }
  }

  /**
   * Parse Flip product (using existing logic)
   */
  private parseFlipProduct(html: string, url: string): any {
    const $ = cheerio.load(html);
    
    // Use the existing parsing logic from the original scraper
    // This is a simplified version - you'd copy the full logic from scrapeFlipProduct
    
    let source = 'flip';

    // Extract breadcrumbs
    const breadcrumbs: string[] = [];
    $('.flex.flex-row.mt-4.w-full span, .flex.flex-row.mt-4.w-full div').each(
      (i, el) => {
        const crumb = $(el).text().trim();
        if (!crumb.includes('/')) {
          breadcrumbs.push(crumb);
        }
      }
    );

    // Extract product name and variant details
    const productName = $('#pdp-title .leading-3.font-semibold').text().trim();
    const variantDetails = $('#pdp-title .tablet2\\:text-gray-dark').text().trim();
    const title = productName + ', ' + variantDetails;

    // Extract price details
    const extractNumericPrice = (priceText: string): number => {
      const numericPrice = priceText.replace(/[^\d]/g, '');
      const priceWithoutDecimal = parseInt(numericPrice, 10);
      return priceWithoutDecimal / 100;
    };

    const originalPriceText = $('#pdp-price-new-value').first().text().trim();
    const currentPriceText = $('#pdp-price-value').first().text().trim();
    
    const originalPrice = extractNumericPrice(originalPriceText);
    const currentPrice = extractNumericPrice(currentPriceText);

    // Extract other fields (simplified)
    const category = breadcrumbs[0];
    const brand = breadcrumbs[1]?.toLowerCase().replace(/\s/g, '-');
    const model = breadcrumbs[2]?.toLowerCase().replace(/\s/g, '-');

    const outOfStockElement = $('span.badge.stoc-alert-new.py-2.mb-3.badge-secondary');
    const isoutOfStock = outOfStockElement.text().trim().toLowerCase() === 'va reveni curand in stoc';

    return {
      url,
      source,
      currency: 'RON',
      image: $('.product-card_img-container img').first().attr('src') || '',
      title,
      currentPrice: Number(currentPrice.toFixed(2)) || 0,
      originalPrice: Number(originalPrice.toFixed(2)) || 0,
      priceHistory: [],
      discountRate: originalPrice > currentPrice ? 
        Number((((originalPrice - currentPrice) / originalPrice) * 100).toFixed(2)) : 0,
      category: category || '',
      brand: brand || '',
      productModel: model || '',
      reviewsCount: 0,
      stars: 0,
      isOutOfStock: isoutOfStock,
      description: '',
      lowestPrice: Number(currentPrice.toFixed(2)) || 0,
      highestPrice: Number(currentPrice.toFixed(2)) || 0,
      averagePrice: Number(currentPrice.toFixed(2)) || 0,
    };
  }

  /**
   * Helper methods
   */
  private validateUrl(url: string): void {
    if (!url || typeof url !== 'string') {
      throw new ScrapingError('Invalid URL provided', null, false);
    }
    
    try {
      new URL(url);
    } catch {
      throw new ScrapingError('Malformed URL', null, false);
    }
  }

  private async isAllowedByRobots(url: string): Promise<boolean> {
    try {
      const urlObj = new URL(url);
      const robotsUrl = `${urlObj.protocol}//${urlObj.host}/robots.txt`;
      
      // Check cache first
      if (this.robotsCache.has(robotsUrl)) {
        return this.robotsCache.get(robotsUrl)!;
      }
      
      // Simplified robots.txt check - in production you'd use a proper parser
      const response = await axios.get(robotsUrl, { timeout: 5000 });
      const isAllowed = !response.data.toLowerCase().includes('disallow: /');
      
      this.robotsCache.set(robotsUrl, isAllowed);
      return isAllowed;
      
    } catch {
      // If robots.txt is not accessible, assume allowed
      return true;
    }
  }

  private shouldRetry(error: any, attempts: number): boolean {
    if (attempts >= this.config.maxRetries) return false;
    
    if (error instanceof BlockedError) return false;
    if (error.statusCode === 404) return false;
    
    return true;
  }

  private calculateRetryDelay(attempt: number): number {
    // Exponential backoff with jitter
    const baseDelay = 1000;
    const maxDelay = 10000;
    const exponentialDelay = Math.min(baseDelay * Math.pow(2, attempt - 1), maxDelay);
    const jitter = Math.random() * 1000;
    return exponentialDelay + jitter;
  }

  private getCurrentProxy(): ProxyConfig | null {
    if (this.proxies.length === 0) return null;
    return this.proxies[this.currentProxyIndex];
  }

  private rotateProxy(): void {
    if (this.proxies.length <= 1) return;
    
    this.blockedProxies.add(this.currentProxyIndex);
    this.currentProxyIndex = (this.currentProxyIndex + 1) % this.proxies.length;
    
    logger.info('Rotated to next proxy', { proxyIndex: this.currentProxyIndex }, 'scraping');
  }

  private getRotatedUserAgent(): string {
    const userAgent = this.config.userAgents[this.userAgentIndex];
    this.userAgentIndex = (this.userAgentIndex + 1) % this.config.userAgents.length;
    return userAgent;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Public methods for monitoring and control
   */
  public getStats() {
    return {
      limiterStats: {
        running: this.limiter.running(),
        queued: this.limiter.queued(),
        pending: this.limiter.pending(),
      },
      proxies: {
        total: this.proxies.length,
        current: this.currentProxyIndex,
        blocked: Array.from(this.blockedProxies),
      },
      config: this.config,
    };
  }

  public resetBlockedProxies(): void {
    this.blockedProxies.clear();
    logger.info('Reset blocked proxies', {}, 'scraping');
  }

  public async stop(): Promise<void> {
    await this.limiter.stop();
    logger.info('Scraper stopped', {}, 'scraping');
  }
}

// Export singleton instance
export const enhancedScraper = new EnhancedScraper();

// Export convenience function that matches the original API
export async function scrapeFlipProduct(url: string, retries = 3): Promise<any> {
  const result = await enhancedScraper.scrape(url, {
    bypassRateLimit: false,
    priority: 5,
  });
  
  if (!result.success) {
    throw result.error || new ScrapingError('Scraping failed');
  }
  
  return result.data;
}

export default enhancedScraper;