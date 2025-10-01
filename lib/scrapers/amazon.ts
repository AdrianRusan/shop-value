import axios from 'axios';
import * as cheerio from 'cheerio';
import { ProductData } from './types';

/**
 * Scrape Amazon product data by ASIN
 * @param asin Amazon Standard Identification Number
 * @returns ProductData or null if scraping fails
 */
export async function scrapeAmazon(asin: string): Promise<ProductData | null> {
  const url = `https://www.amazon.com/dp/${asin}`;

  try {
    // Configure request with anti-bot headers
    const config: any = {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Cache-Control': 'max-age=0'
      },
      timeout: 15000
    };

    // Add BrightData proxy if credentials are available
    if (process.env.BRIGHTDATA_USERNAME && process.env.BRIGHTDATA_PASSWORD) {
      config.proxy = {
        host: 'brd.superproxy.io',
        port: 22225,
        auth: {
          username: process.env.BRIGHTDATA_USERNAME,
          password: process.env.BRIGHTDATA_PASSWORD
        },
        protocol: 'http'
      };
      console.log(`[Amazon] Using BrightData proxy for ASIN: ${asin}`);
    } else {
      console.log(`[Amazon] Using direct connection (no proxy) for ASIN: ${asin}`);
    }

    const response = await axios.get(url, config);

    const $ = cheerio.load(response.data);

    // Extract title - try multiple selectors
    let title = $('#productTitle').text().trim();
    if (!title) {
      title = $('h1.a-size-large').text().trim();
    }
    if (!title) {
      title = $('#title').text().trim();
    }

    if (!title) {
      console.error(`[Amazon] Product not found for ASIN: ${asin}`);
      return null; // Product not found
    }

    // Extract price - Amazon has multiple price selectors depending on deal type
    let price = 0;

    // Method 1: Deal price (most common)
    const priceWhole = $('.a-price-whole').first().text().replace(/[^0-9]/g, '');
    const priceFraction = $('.a-price-fraction').first().text().replace(/[^0-9]/g, '');

    if (priceWhole) {
      price = parseFloat(`${priceWhole}.${priceFraction || '00'}`);
    }

    // Method 2: Fallback price selectors
    if (price === 0) {
      const priceSelectors = [
        '#priceblock_ourprice',
        '#priceblock_dealprice',
        '.a-price .a-offscreen',
        '#price_inside_buybox',
        '.a-price-range .a-offscreen'
      ];

      for (const selector of priceSelectors) {
        const priceText = $(selector).first().text();
        const priceMatch = priceText.match(/\$?([\d,]+\.?\d*)/);
        if (priceMatch) {
          price = parseFloat(priceMatch[1].replace(/,/g, ''));
          if (price > 0) break;
        }
      }
    }

    // Check availability
    const availabilityText = $('#availability span').text().toLowerCase();
    const available = !availabilityText.includes('unavailable') &&
                      !availabilityText.includes('out of stock') &&
                      !availabilityText.includes('currently unavailable') &&
                      price > 0;

    // Extract image - try multiple selectors
    let imageUrl = $('#landingImage').attr('data-old-hires') ||
                   $('#landingImage').attr('src') ||
                   $('#imgBlkFront').attr('src') ||
                   $('.a-dynamic-image').first().attr('data-old-hires') ||
                   $('.a-dynamic-image').first().attr('src') || '';

    // Clean up image URL (remove size parameters for highest quality)
    if (imageUrl && imageUrl.includes('._')) {
      imageUrl = imageUrl.split('._')[0] + '.jpg';
    }

    console.log(`[Amazon] Successfully scraped ASIN ${asin}: "${title}" - $${price}`);

    return {
      asin,
      title,
      price,
      available,
      imageUrl,
      url
    };

  } catch (error: any) {
    if (error.response?.status === 503) {
      console.error(`[Amazon] Bot detection triggered for ASIN ${asin} - consider using proxy`);
    } else if (error.code === 'ECONNABORTED') {
      console.error(`[Amazon] Timeout scraping ASIN ${asin}`);
    } else {
      console.error(`[Amazon] Error scraping ASIN ${asin}:`, error.message);
    }
    return null;
  }
}

/**
 * Extract ASIN from URL or validate ASIN string
 * @param input Amazon URL or ASIN string
 * @returns ASIN string or null if invalid
 */
export function extractASIN(input: string): string | null {
  // If already an ASIN (10 characters, alphanumeric)
  if (/^[A-Z0-9]{10}$/.test(input)) {
    return input;
  }

  // Extract from Amazon URL patterns
  const patterns = [
    /\/dp\/([A-Z0-9]{10})/i,
    /\/gp\/product\/([A-Z0-9]{10})/i,
    /\/product\/([A-Z0-9]{10})/i,
    /asin=([A-Z0-9]{10})/i,
    /\/([A-Z0-9]{10})\//i
  ];

  for (const pattern of patterns) {
    const match = input.match(pattern);
    if (match) {
      return match[1].toUpperCase();
    }
  }

  return null;
}

/**
 * Scrape multiple ASINs with rate limiting
 * @param asins Array of ASINs to scrape
 * @param delayMs Delay between requests in milliseconds
 * @returns Array of ProductData
 */
export async function scrapeAmazonBatch(
  asins: string[],
  delayMs: number = 2000
): Promise<(ProductData | null)[]> {
  const results: (ProductData | null)[] = [];

  for (let i = 0; i < asins.length; i++) {
    const asin = asins[i];
    console.log(`[Amazon Batch] Scraping ${i + 1}/${asins.length}: ${asin}`);

    const result = await scrapeAmazon(asin);
    results.push(result);

    // Add delay between requests to avoid rate limiting
    if (i < asins.length - 1) {
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }

  return results;
}
