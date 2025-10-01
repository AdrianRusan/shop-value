import axios from 'axios';
import * as cheerio from 'cheerio';
import { ProductData } from './types';

/**
 * Scrape Walmart product data by UPC or search query
 * @param searchQuery Product UPC code or title/search term
 * @param upc Optional UPC code for more accurate matching
 * @returns ProductData or null if scraping fails
 */
export async function scrapeWalmart(searchQuery: string, upc?: string | null): Promise<ProductData | null> {
  try {
    // Prioritize UPC search over title search for accuracy
    const searchTerm = upc || searchQuery;
    const searchUrl = `https://www.walmart.com/search?q=${encodeURIComponent(searchTerm)}`;

    if (upc) {
      console.log(`[Walmart] Searching by UPC: "${upc}"`);
    } else {
      console.log(`[Walmart] Searching by title: "${searchQuery}"`);
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
      console.log(`[Walmart] Using BrightData proxy`);
    }

    const response = await axios.get(searchUrl, config);

    const $ = cheerio.load(response.data);

    // Walmart embeds product data in JSON-LD structured data
    let productData: any = null;

    // Method 1: Try JSON-LD structured data
    $('script[type="application/ld+json"]').each((_, el) => {
      try {
        const scriptContent = $(el).html() || '{}';
        const json = JSON.parse(scriptContent);

        // Check if it's a product or item list
        if (json['@type'] === 'Product') {
          productData = json;
          return false; // break
        } else if (json['@type'] === 'ItemList' && json.itemListElement?.length > 0) {
          // Get first item from list
          const firstItem = json.itemListElement[0];
          if (firstItem?.item) {
            productData = firstItem.item;
            return false; // break
          }
        }
      } catch (e) {
        // Invalid JSON, skip
      }
    });

    // Method 2: Extract from __NEXT_DATA__ (Walmart uses Next.js)
    if (!productData) {
      $('script#__NEXT_DATA__').each((_, el) => {
        try {
          const scriptContent = $(el).html() || '{}';
          const json = JSON.parse(scriptContent);

          // Navigate to search results
          const searchResults = json?.props?.pageProps?.initialData?.searchResult?.itemStacks?.[0]?.items;

          if (searchResults && searchResults.length > 0) {
            const firstProduct = searchResults[0];
            productData = {
              name: firstProduct.name,
              offers: {
                price: firstProduct.price,
                priceCurrency: 'USD',
                availability: firstProduct.availabilityStatus === 'IN_STOCK' ? 'InStock' : 'OutOfStock'
              },
              image: firstProduct.image,
              url: firstProduct.canonicalUrl
            };
            return false; // break
          }
        } catch (e) {
          // Continue
        }
      });
    }

    // Method 3: Fallback to HTML scraping
    if (!productData) {
      const firstResult = $('[data-item-id]').first();

      if (firstResult.length === 0) {
        console.error('[Walmart] No products found in search results');
        return null;
      }

      // Extract data from HTML
      const title = firstResult.find('[data-automation-id="product-title"]').text().trim() ||
                    firstResult.find('span[data-automation-id="product-title"]').text().trim() ||
                    firstResult.find('a[link-identifier]').attr('aria-label') || '';

      const priceText = firstResult.find('[data-automation-id="product-price"]').text() ||
                        firstResult.find('div[data-automation-id="product-price"] span').first().text() ||
                        firstResult.find('.price-characteristic').text() || '';

      const price = parseFloat(priceText.replace(/[^0-9.]/g, '')) || 0;

      const imageUrl = firstResult.find('img').attr('src') || '';

      const relativeUrl = firstResult.find('a').attr('href') || '';
      const url = relativeUrl.startsWith('http')
        ? relativeUrl
        : `https://www.walmart.com${relativeUrl}`;

      if (!title || price === 0) {
        console.error('[Walmart] Failed to extract product data from HTML');
        return null;
      }

      console.log(`[Walmart] Found via HTML scraping: "${title}" - $${price}`);

      return {
        title,
        price,
        available: price > 0,
        imageUrl,
        url
      };
    }

    // Parse JSON-LD data
    const title = productData.name || '';
    const offers = Array.isArray(productData.offers) ? productData.offers[0] : productData.offers;
    const price = parseFloat(offers?.price || offers?.lowPrice || 0);
    const available = offers?.availability === 'InStock' ||
                      offers?.availability === 'https://schema.org/InStock';
    const imageUrl = Array.isArray(productData.image)
      ? productData.image[0]
      : productData.image || '';
    const url = productData.url || searchUrl;

    if (!title || price === 0) {
      console.error('[Walmart] Failed to extract valid product data from JSON-LD');
      return null;
    }

    console.log(`[Walmart] Found via JSON-LD: "${title}" - $${price}`);

    return {
      title,
      price,
      available,
      imageUrl,
      url
    };

  } catch (error: any) {
    if (error.response?.status === 403) {
      console.error('[Walmart] Access forbidden - bot detection triggered');
    } else if (error.code === 'ECONNABORTED') {
      console.error('[Walmart] Timeout during search');
    } else {
      console.error('[Walmart] Error scraping:', error.message);
    }
    return null;
  }
}

/**
 * Search Walmart by product ID/SKU
 * @param productId Walmart product ID or SKU
 * @returns ProductData or null if scraping fails
 */
export async function scrapeWalmartById(productId: string): Promise<ProductData | null> {
  try {
    const url = `https://www.walmart.com/ip/${productId}`;

    console.log(`[Walmart] Fetching product ID: ${productId}`);

    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept-Language': 'en-US,en;q=0.9'
      },
      timeout: 15000
    });

    const $ = cheerio.load(response.data);

    // Extract from JSON-LD
    let productData: any = null;

    $('script[type="application/ld+json"]').each((_, el) => {
      try {
        const json = JSON.parse($(el).html() || '{}');
        if (json['@type'] === 'Product') {
          productData = json;
          return false;
        }
      } catch (e) {
        // Skip
      }
    });

    if (!productData) {
      console.error(`[Walmart] Product ID ${productId} not found`);
      return null;
    }

    const title = productData.name || '';
    const offers = Array.isArray(productData.offers) ? productData.offers[0] : productData.offers;
    const price = parseFloat(offers?.price || 0);
    const available = offers?.availability === 'InStock';
    const imageUrl = Array.isArray(productData.image) ? productData.image[0] : productData.image || '';

    console.log(`[Walmart] Successfully scraped product ID ${productId}: "${title}" - $${price}`);

    return {
      title,
      price,
      available,
      imageUrl,
      url
    };

  } catch (error: any) {
    console.error(`[Walmart] Error scraping product ID ${productId}:`, error.message);
    return null;
  }
}
