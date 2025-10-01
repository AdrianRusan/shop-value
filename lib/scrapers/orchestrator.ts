import { scrapeAmazon, extractASIN } from './amazon';
import { scrapeWalmart } from './walmart';
import { scrapeTarget } from './target';
import { MultiRetailerPrices, ProductData } from './types';

/**
 * Scrape product prices from all retailers (Amazon, Walmart, Target)
 * @param input Amazon ASIN or Amazon product URL
 * @returns Multi-retailer price comparison or null if Amazon scraping fails
 */
export async function scrapeAllRetailers(input: string): Promise<MultiRetailerPrices | null> {
  try {
    console.log(`[Orchestrator] Starting multi-retailer scrape for: ${input}`);

    // Extract ASIN from input (URL or ASIN string)
    const asin = extractASIN(input);
    if (!asin) {
      console.error('[Orchestrator] Invalid ASIN or Amazon URL');
      throw new Error('Invalid ASIN or Amazon URL. Please provide a valid Amazon product URL or ASIN.');
    }

    console.log(`[Orchestrator] Extracted ASIN: ${asin}`);

    // Scrape Amazon first (primary source)
    const amazonData = await scrapeAmazon(asin);
    if (!amazonData) {
      console.error('[Orchestrator] Failed to scrape Amazon - aborting');
      throw new Error('Product not found on Amazon or scraping failed');
    }

    console.log(`[Orchestrator] Amazon data retrieved: "${amazonData.title}"`);

    // Use Amazon title to search other retailers
    const searchQuery = amazonData.title;

    // Scrape Walmart and Target in parallel for efficiency
    console.log('[Orchestrator] Scraping Walmart and Target in parallel...');
    const [walmartData, targetData] = await Promise.allSettled([
      scrapeWalmart(searchQuery),
      scrapeTarget(searchQuery)
    ]);

    // Extract results from settled promises
    const walmartResult = walmartData.status === 'fulfilled' ? walmartData.value : null;
    const targetResult = targetData.status === 'fulfilled' ? targetData.value : null;

    // Log results
    if (walmartResult) {
      console.log(`[Orchestrator] Walmart found: "${walmartResult.title}" - $${walmartResult.price}`);
    } else {
      console.log('[Orchestrator] Walmart: No match found');
    }

    if (targetResult) {
      console.log(`[Orchestrator] Target found: "${targetResult.title}" - $${targetResult.price}`);
    } else {
      console.log('[Orchestrator] Target: No match found');
    }

    // Calculate price statistics
    const prices = [amazonData.price, walmartResult?.price, targetResult?.price]
      .filter((p): p is number => p !== null && p !== undefined && p > 0);

    if (prices.length > 1) {
      const lowestPrice = Math.min(...prices);
      const highestPrice = Math.max(...prices);
      const roi = ((highestPrice - lowestPrice) / lowestPrice * 100).toFixed(2);
      console.log(`[Orchestrator] Price range: $${lowestPrice} - $${highestPrice} (ROI: ${roi}%)`);
    }

    return {
      product: amazonData,
      prices: {
        amazon: amazonData.price,
        walmart: walmartResult?.price || null,
        target: targetResult?.price || null
      },
      urls: {
        amazon: amazonData.url,
        walmart: walmartResult?.url || null,
        target: targetResult?.url || null
      }
    };

  } catch (error: any) {
    console.error('[Orchestrator] Error:', error.message);
    return null;
  }
}

/**
 * Calculate ROI potential from multi-retailer prices
 * @param prices MultiRetailerPrices object
 * @returns ROI analysis
 */
export function calculateROI(prices: MultiRetailerPrices): {
  lowestPrice: number;
  highestPrice: number;
  lowestRetailer: string;
  highestRetailer: string;
  roi: number;
  profit: number;
} | null {
  const priceMap = [
    { retailer: 'Amazon', price: prices.prices.amazon },
    { retailer: 'Walmart', price: prices.prices.walmart },
    { retailer: 'Target', price: prices.prices.target }
  ].filter(p => p.price !== null && p.price > 0) as { retailer: string; price: number }[];

  if (priceMap.length < 2) {
    return null; // Need at least 2 prices for ROI calculation
  }

  // Sort by price
  priceMap.sort((a, b) => a.price - b.price);

  const lowestPrice = priceMap[0].price;
  const highestPrice = priceMap[priceMap.length - 1].price;
  const lowestRetailer = priceMap[0].retailer;
  const highestRetailer = priceMap[priceMap.length - 1].retailer;

  const profit = highestPrice - lowestPrice;
  const roi = (profit / lowestPrice) * 100;

  return {
    lowestPrice,
    highestPrice,
    lowestRetailer,
    highestRetailer,
    roi,
    profit
  };
}

/**
 * Format price comparison for display
 * @param prices MultiRetailerPrices object
 * @returns Formatted string
 */
export function formatPriceComparison(prices: MultiRetailerPrices): string {
  const lines = [
    `Product: ${prices.product.title}`,
    ``,
    `Prices:`,
    `  Amazon:  ${prices.prices.amazon ? `$${prices.prices.amazon.toFixed(2)}` : 'Not found'}`,
    `  Walmart: ${prices.prices.walmart ? `$${prices.prices.walmart.toFixed(2)}` : 'Not found'}`,
    `  Target:  ${prices.prices.target ? `$${prices.prices.target.toFixed(2)}` : 'Not found'}`,
    ``
  ];

  const roiData = calculateROI(prices);
  if (roiData) {
    lines.push(`ROI Analysis:`);
    lines.push(`  Buy from:  ${roiData.lowestRetailer} ($${roiData.lowestPrice.toFixed(2)})`);
    lines.push(`  Sell to:   ${roiData.highestRetailer} ($${roiData.highestPrice.toFixed(2)})`);
    lines.push(`  Profit:    $${roiData.profit.toFixed(2)}`);
    lines.push(`  ROI:       ${roiData.roi.toFixed(2)}%`);
  } else {
    lines.push(`ROI: Insufficient price data`);
  }

  return lines.join('\n');
}

/**
 * Batch scrape multiple products
 * @param asins Array of ASINs or Amazon URLs
 * @param delayMs Delay between scrapes (milliseconds)
 * @returns Array of MultiRetailerPrices
 */
export async function scrapeAllRetailersBatch(
  asins: string[],
  delayMs: number = 3000
): Promise<(MultiRetailerPrices | null)[]> {
  const results: (MultiRetailerPrices | null)[] = [];

  console.log(`[Orchestrator] Starting batch scrape of ${asins.length} products`);

  for (let i = 0; i < asins.length; i++) {
    const asin = asins[i];
    console.log(`\n[Orchestrator] === Batch ${i + 1}/${asins.length}: ${asin} ===`);

    const result = await scrapeAllRetailers(asin);
    results.push(result);

    // Add delay between requests to avoid rate limiting
    if (i < asins.length - 1) {
      console.log(`[Orchestrator] Waiting ${delayMs}ms before next scrape...`);
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }

  console.log(`\n[Orchestrator] Batch scrape complete: ${results.filter(r => r !== null).length}/${asins.length} successful`);

  return results;
}

/**
 * Find best arbitrage opportunities from batch results
 * @param results Array of MultiRetailerPrices
 * @param minROI Minimum ROI percentage to include
 * @returns Sorted array of opportunities
 */
export function findArbitrageOpportunities(
  results: (MultiRetailerPrices | null)[],
  minROI: number = 10
): Array<{ product: ProductData; roi: number; profit: number }> {
  const opportunities = results
    .filter((r): r is MultiRetailerPrices => r !== null)
    .map(r => {
      const roiData = calculateROI(r);
      if (!roiData || roiData.roi < minROI) {
        return null;
      }
      return {
        product: r.product,
        roi: roiData.roi,
        profit: roiData.profit
      };
    })
    .filter((o): o is { product: ProductData; roi: number; profit: number } => o !== null);

  // Sort by ROI descending
  opportunities.sort((a, b) => b.roi - a.roi);

  return opportunities;
}
