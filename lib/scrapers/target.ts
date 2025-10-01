import axios from 'axios';
import * as cheerio from 'cheerio';
import { ProductData } from './types';

/**
 * Scrape Target product data by UPC or search query
 * @param searchQuery Product UPC code or title/search term
 * @param upc Optional UPC code for more accurate matching
 * @returns ProductData or null if scraping fails
 */
export async function scrapeTarget(searchQuery: string, upc?: string | null): Promise<ProductData | null> {
  try {
    // Prioritize UPC search over title search for accuracy
    const searchTerm = upc || searchQuery;
    const searchUrl = `https://www.target.com/s?searchTerm=${encodeURIComponent(searchTerm)}`;

    if (upc) {
      console.log(`[Target] Searching by UPC: "${upc}"`);
    } else {
      console.log(`[Target] Searching by title: "${searchQuery}"`);
    }

    // Configure request with BrightData proxy if available
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
        'Sec-Fetch-Site': 'none'
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
      console.log(`[Target] Using BrightData proxy`);
    }

    const response = await axios.get(searchUrl, config);

    const $ = cheerio.load(response.data);

    // Target uses React with __NEXT_DATA__ embedded in the page
    let productData: any = null;

    // Method 1: Extract from __NEXT_DATA__ script tag
    $('script#__NEXT_DATA__').each((_, el) => {
      try {
        const scriptContent = $(el).html() || '{}';
        const json = JSON.parse(scriptContent);

        // Navigate to search results (Target's data structure)
        const searchData = json?.props?.pageProps?.initialData?.searchResponse;
        const products = searchData?.products;

        if (products && products.length > 0) {
          productData = products[0];
          return false; // break
        }
      } catch (e) {
        // Continue trying other methods
      }
    });

    // Method 2: Try inline script with window.__TGT_DATA__
    if (!productData) {
      $('script').each((_, el) => {
        const scriptContent = $(el).html() || '';
        if (scriptContent.includes('window.__TGT_DATA__') || scriptContent.includes('__PRELOADED_QUERIES__')) {
          try {
            // Extract JSON from script
            const dataMatch = scriptContent.match(/window\.__TGT_DATA__\s*=\s*({.+?});/) ||
                              scriptContent.match(/__PRELOADED_QUERIES__\s*=\s*({.+?});/);

            if (dataMatch) {
              const json = JSON.parse(dataMatch[1]);
              // Try to find product data in nested structure
              const findProducts = (obj: any): any => {
                if (obj?.products && Array.isArray(obj.products)) {
                  return obj.products[0];
                }
                if (typeof obj === 'object' && obj !== null) {
                  for (const key in obj) {
                    const result = findProducts(obj[key]);
                    if (result) return result;
                  }
                }
                return null;
              };

              productData = findProducts(json);
              if (productData) return false; // break
            }
          } catch (e) {
            // Continue
          }
        }
      });
    }

    // Method 3: Fallback to HTML scraping
    if (!productData) {
      const firstResult = $('[data-test="product-card"]').first();

      if (firstResult.length === 0) {
        console.error('[Target] No products found in search results');
        return null;
      }

      const title = firstResult.find('[data-test="product-title"]').text().trim() ||
                    firstResult.find('a[data-test="product-title"]').attr('aria-label') || '';

      const priceText = firstResult.find('[data-test="product-price"]').text() ||
                        firstResult.find('[data-test="current-price"]').text() || '';

      const price = parseFloat(priceText.replace(/[^0-9.]/g, '')) || 0;

      const imageUrl = firstResult.find('img').attr('src') || '';

      const relativeUrl = firstResult.find('a').attr('href') || '';
      const url = relativeUrl.startsWith('http')
        ? relativeUrl
        : `https://www.target.com${relativeUrl}`;

      if (!title || price === 0) {
        console.error('[Target] Failed to extract product data from HTML');
        return null;
      }

      console.log(`[Target] Found via HTML scraping: "${title}" - $${price}`);

      return {
        title,
        price,
        available: price > 0,
        imageUrl,
        url
      };
    }

    // Parse JSON data from __NEXT_DATA__
    const title = productData.item?.product_description?.title ||
                  productData.title ||
                  productData.item?.enrichment?.buy_url || '';

    const priceData = productData.price?.current_retail ||
                      productData.price?.current_retail_price ||
                      productData.price?.formatted_current_price ||
                      productData.item?.price?.current_retail || 0;

    const price = typeof priceData === 'string'
      ? parseFloat(priceData.replace(/[^0-9.]/g, ''))
      : parseFloat(priceData || 0);

    const available = productData.fulfillment?.is_out_of_stock_in_all_store_locations === false ||
                      productData.available === true ||
                      price > 0;

    const imageUrl = productData.item?.enrichment?.images?.primary_image_url ||
                     productData.item?.images?.primary ||
                     productData.image ||
                     '';

    const buyUrl = productData.item?.enrichment?.buy_url ||
                   productData.url ||
                   productData.item?.product_description?.url || '';

    const url = buyUrl.startsWith('http')
      ? buyUrl
      : `https://www.target.com${buyUrl}`;

    if (!title || price === 0) {
      console.error('[Target] Failed to extract valid product data from JSON');
      return null;
    }

    console.log(`[Target] Found via JSON: "${title}" - $${price}`);

    return {
      title,
      price,
      available,
      imageUrl,
      url
    };

  } catch (error: any) {
    if (error.response?.status === 403 || error.response?.status === 429) {
      console.error('[Target] Access forbidden or rate limited - bot detection triggered');
    } else if (error.code === 'ECONNABORTED') {
      console.error('[Target] Timeout during search');
    } else {
      console.error('[Target] Error scraping:', error.message);
    }
    return null;
  }
}

/**
 * Search Target by TCIN (Target.com Item Number)
 * @param tcin Target product ID
 * @returns ProductData or null if scraping fails
 */
export async function scrapeTargetById(tcin: string): Promise<ProductData | null> {
  try {
    // Target product page URL using TCIN
    const url = `https://www.target.com/p/-/A-${tcin}`;

    console.log(`[Target] Fetching TCIN: ${tcin}`);

    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept-Language': 'en-US,en;q=0.9'
      },
      timeout: 15000
    });

    const $ = cheerio.load(response.data);

    // Extract product data from __NEXT_DATA__
    let productData: any = null;

    $('script#__NEXT_DATA__').each((_, el) => {
      try {
        const json = JSON.parse($(el).html() || '{}');
        const product = json?.props?.pageProps?.initialData?.product;

        if (product) {
          productData = product;
          return false;
        }
      } catch (e) {
        // Skip
      }
    });

    if (!productData) {
      console.error(`[Target] TCIN ${tcin} not found`);
      return null;
    }

    const title = productData.item?.product_description?.title || '';
    const price = parseFloat(productData.price?.current_retail || 0);
    const available = productData.fulfillment?.is_out_of_stock_in_all_store_locations === false;
    const imageUrl = productData.item?.enrichment?.images?.primary_image_url || '';

    console.log(`[Target] Successfully scraped TCIN ${tcin}: "${title}" - $${price}`);

    return {
      title,
      price,
      available,
      imageUrl,
      url
    };

  } catch (error: any) {
    console.error(`[Target] Error scraping TCIN ${tcin}:`, error.message);
    return null;
  }
}
