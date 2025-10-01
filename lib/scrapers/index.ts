// Main exports for the scrapers module

export { scrapeAmazon, extractASIN, scrapeAmazonBatch } from './amazon';
export { scrapeWalmart, scrapeWalmartById } from './walmart';
export { scrapeTarget, scrapeTargetById } from './target';
export {
  scrapeAllRetailers,
  scrapeAllRetailersBatch,
  calculateROI,
  formatPriceComparison,
  findArbitrageOpportunities
} from './orchestrator';
export type { ProductData, MultiRetailerPrices, ScraperConfig } from './types';
