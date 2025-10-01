# US Retailer Scrapers

Multi-retailer price scraping system for Amazon, Walmart, and Target with built-in ROI calculation for retail arbitrage.

## Quick Start

### Installation

No additional packages needed! Uses existing project dependencies:
- `axios` - HTTP client
- `cheerio` - HTML parser

### Basic Usage

```typescript
import { scrapeAllRetailers } from './lib/scrapers';

// Scrape all retailers by Amazon ASIN
const result = await scrapeAllRetailers('B08N5WRWNW');

if (result) {
  console.log(`Product: ${result.product.title}`);
  console.log(`Amazon: $${result.prices.amazon}`);
  console.log(`Walmart: $${result.prices.walmart || 'N/A'}`);
  console.log(`Target: $${result.prices.target || 'N/A'}`);
}
```

## Configuration

### BrightData Proxy (Required for Amazon)

Set environment variables:

```bash
# .env file
BRIGHTDATA_USERNAME=your-username
BRIGHTDATA_PASSWORD=your-password
```

The Amazon scraper automatically detects and uses the proxy if credentials are available.

## API Reference

### Main Functions

#### `scrapeAllRetailers(input: string)`

Scrapes all three retailers and returns price comparison.

**Parameters:**
- `input` - Amazon ASIN or product URL

**Returns:**
```typescript
{
  product: {
    asin: string;
    title: string;
    price: number;
    available: boolean;
    imageUrl: string;
    url: string;
  };
  prices: {
    amazon: number | null;
    walmart: number | null;
    target: number | null;
  };
  urls: {
    amazon: string;
    walmart: string | null;
    target: string | null;
  };
}
```

#### `calculateROI(prices: MultiRetailerPrices)`

Calculates arbitrage potential.

**Returns:**
```typescript
{
  lowestPrice: number;
  highestPrice: number;
  lowestRetailer: string;
  highestRetailer: string;
  roi: number;        // Percentage
  profit: number;     // Dollar amount
}
```

#### `scrapeAllRetailersBatch(asins: string[], delay?: number)`

Batch scrape multiple products with rate limiting.

**Parameters:**
- `asins` - Array of ASINs to scrape
- `delay` - Milliseconds between requests (default: 3000)

### Individual Scrapers

#### Amazon
```typescript
import { scrapeAmazon, extractASIN } from './lib/scrapers';

const asin = extractASIN('https://amazon.com/dp/B08N5WRWNW');
const product = await scrapeAmazon(asin);
```

#### Walmart
```typescript
import { scrapeWalmart, scrapeWalmartById } from './lib/scrapers';

// Search by product title
const product = await scrapeWalmart('PlayStation 5 Console');

// Or by Walmart product ID
const product = await scrapeWalmartById('123456789');
```

#### Target
```typescript
import { scrapeTarget, scrapeTargetById } from './lib/scrapers';

// Search by product title
const product = await scrapeTarget('PlayStation 5 Console');

// Or by Target TCIN
const product = await scrapeTargetById('87654321');
```

## Testing

### Run Full Test Suite
```bash
npx tsx lib/scrapers/test.ts
```

### Test Individual Scrapers
```bash
npx tsx lib/scrapers/test.ts individual
```

### Test Batch Processing
```bash
npx tsx lib/scrapers/test.ts batch
```

### Debug Amazon Issues
```bash
npx tsx lib/scrapers/debug.ts B08N5WRWNW
```

## Error Handling

All scrapers return `null` on failure and log errors to console.

```typescript
const result = await scrapeAllRetailers('B08N5WRWNW');

if (!result) {
  console.error('Scraping failed');
  return;
}

// Proceed with result
```

## Rate Limiting

**Recommended delays:**
- Amazon: 2-5 seconds between requests
- Walmart: 1-2 seconds
- Target: 1-2 seconds

**Batch scraping:**
```typescript
// 3 second delay between products
const results = await scrapeAllRetailersBatch(asins, 3000);
```

## Common Issues

### Amazon Returns CAPTCHA

**Cause:** Bot detection triggered
**Solution:** Ensure BrightData proxy credentials are configured

### Walmart/Target No Results

**Cause:** Product title doesn't match search results
**Solution:** Try using more generic search terms or brand+model only

### Timeout Errors

**Cause:** Network issues or slow response
**Solution:** Increase timeout in scraper (default: 15000ms)

## Best Practices

1. **Always use proxy for Amazon** - Direct requests will be blocked
2. **Add delays between requests** - Prevent rate limiting
3. **Handle null returns** - Scrapers may fail gracefully
4. **Log failed scrapes** - Track success rate over time
5. **Cache results** - Avoid re-scraping recently checked products

## Example: Find Arbitrage Opportunities

```typescript
import {
  scrapeAllRetailersBatch,
  findArbitrageOpportunities
} from './lib/scrapers';

const asins = ['B08N5WRWNW', 'B0BDJ2L7NS', 'B09JQMJHXY'];

// Scrape all products
const results = await scrapeAllRetailersBatch(asins, 3000);

// Find opportunities with ROI >= 15%
const opportunities = findArbitrageOpportunities(results, 15);

opportunities.forEach(opp => {
  console.log(`${opp.product.title}: ${opp.roi.toFixed(2)}% ROI ($${opp.profit})`);
});
```

## File Structure

```
lib/scrapers/
├── index.ts          # Main exports
├── types.ts          # TypeScript interfaces
├── amazon.ts         # Amazon scraper
├── walmart.ts        # Walmart scraper
├── target.ts         # Target scraper
├── orchestrator.ts   # Multi-retailer coordination
├── test.ts           # Test suite
├── debug.ts          # Debug utility
└── README.md         # This file
```

## Support

For issues with:
- **Amazon scraping:** Check BrightData proxy configuration
- **Walmart/Target matching:** Verify product title is accurate
- **General bugs:** Check console logs for detailed error messages

## License

Part of StockWatch project - see main LICENSE file
