import 'dotenv/config'; // Load .env variables
import { scrapeAllRetailers, formatPriceComparison, findArbitrageOpportunities, scrapeAllRetailersBatch } from './orchestrator';

/**
 * Test all scrapers with real products
 */
async function testScrapers() {
  console.log('='.repeat(80));
  console.log('STOCKWATCH - US RETAILER SCRAPER TEST');
  console.log('='.repeat(80));
  console.log('');

  // Test ASINs covering different categories
  const testASINs = [
    'B08N5WRWNW', // PlayStation 5 Console (Electronics - High value)
    'B0BDJ2L7NS', // Echo Dot (Electronics - Low value)
    'B09JQMJHXY'  // Book example (Books)
  ];

  console.log(`Testing ${testASINs.length} products:\n`);

  for (let i = 0; i < testASINs.length; i++) {
    const asin = testASINs[i];
    console.log('\n' + '='.repeat(80));
    console.log(`TEST ${i + 1}/${testASINs.length}: ASIN ${asin}`);
    console.log('='.repeat(80));
    console.log('');

    const result = await scrapeAllRetailers(asin);

    if (result) {
      console.log('\n' + '-'.repeat(80));
      console.log(formatPriceComparison(result));
      console.log('-'.repeat(80));

      // Display URLs
      console.log('\nProduct URLs:');
      console.log(`  Amazon:  ${result.urls.amazon}`);
      if (result.urls.walmart) {
        console.log(`  Walmart: ${result.urls.walmart}`);
      }
      if (result.urls.target) {
        console.log(`  Target:  ${result.urls.target}`);
      }
    } else {
      console.log('\n❌ FAILED: Could not scrape this product');
    }

    // Add delay to avoid rate limiting (except for last item)
    if (i < testASINs.length - 1) {
      const delaySeconds = 3;
      console.log(`\nWaiting ${delaySeconds} seconds before next test...`);
      await new Promise(resolve => setTimeout(resolve, delaySeconds * 1000));
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log('TEST COMPLETE');
  console.log('='.repeat(80));
}

/**
 * Test batch scraping and arbitrage opportunity detection
 */
async function testBatchScraping() {
  console.log('='.repeat(80));
  console.log('BATCH SCRAPING TEST');
  console.log('='.repeat(80));
  console.log('');

  const asins = [
    'B08N5WRWNW',
    'B0BDJ2L7NS',
    'B09JQMJHXY'
  ];

  const results = await scrapeAllRetailersBatch(asins, 3000);

  console.log('\n' + '='.repeat(80));
  console.log('ARBITRAGE OPPORTUNITIES (ROI >= 10%)');
  console.log('='.repeat(80));
  console.log('');

  const opportunities = findArbitrageOpportunities(results, 10);

  if (opportunities.length === 0) {
    console.log('No arbitrage opportunities found with ROI >= 10%');
  } else {
    opportunities.forEach((opp, index) => {
      console.log(`${index + 1}. ${opp.product.title}`);
      console.log(`   ASIN: ${opp.product.asin}`);
      console.log(`   ROI: ${opp.roi.toFixed(2)}%`);
      console.log(`   Profit: $${opp.profit.toFixed(2)}`);
      console.log('');
    });
  }
}

/**
 * Test individual scrapers
 */
async function testIndividualScrapers() {
  console.log('='.repeat(80));
  console.log('INDIVIDUAL SCRAPER TESTS');
  console.log('='.repeat(80));
  console.log('');

  const { scrapeAmazon } = await import('./amazon');
  const { scrapeWalmart } = await import('./walmart');
  const { scrapeTarget } = await import('./target');

  // Test Amazon
  console.log('Testing Amazon scraper...');
  const amazonResult = await scrapeAmazon('B08N5WRWNW');
  console.log(amazonResult ? `✅ Amazon: ${amazonResult.title}` : '❌ Amazon failed');
  console.log('');

  // Test Walmart
  console.log('Testing Walmart scraper...');
  const walmartResult = await scrapeWalmart('PlayStation 5 Console');
  console.log(walmartResult ? `✅ Walmart: ${walmartResult.title}` : '❌ Walmart failed');
  console.log('');

  // Test Target
  console.log('Testing Target scraper...');
  const targetResult = await scrapeTarget('PlayStation 5 Console');
  console.log(targetResult ? `✅ Target: ${targetResult.title}` : '❌ Target failed');
  console.log('');
}

/**
 * Main test runner
 */
async function main() {
  const testMode = process.argv[2] || 'all';

  try {
    switch (testMode) {
      case 'individual':
        await testIndividualScrapers();
        break;
      case 'batch':
        await testBatchScraping();
        break;
      case 'all':
      default:
        await testScrapers();
        break;
    }

    console.log('\n✅ All tests completed successfully!\n');
  } catch (error: any) {
    console.error('\n❌ Test failed with error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run tests
main();
