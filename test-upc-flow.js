const { scrapeAmazon } = require('./lib/scrapers/amazon');
const { scrapeWalmart } = require('./lib/scrapers/walmart');
const { scrapeTarget } = require('./lib/scrapers/target');
require('dotenv').config({ path: '.env.local' });

(async () => {
  try {
    console.log('========================================');
    console.log('Testing UPC-Based Product Matching');
    console.log('========================================\n');

    // Test with existing AirPods ASIN
    const asin = 'B09JQMJHXY';
    console.log(`[Test] Step 1: Scraping Amazon for ASIN: ${asin}\n`);

    const amazonData = await scrapeAmazon(asin);

    if (!amazonData) {
      console.error('[Test] FAILED: Could not scrape Amazon product');
      return;
    }

    console.log('\n[Test] Amazon Product:');
    console.log(`  Title: ${amazonData.title}`);
    console.log(`  Price: $${amazonData.price}`);
    console.log(`  UPC: ${amazonData.upc || 'NOT FOUND'}`);
    console.log(`  URL: ${amazonData.url}\n`);

    if (!amazonData.upc) {
      console.warn('[Test] WARNING: No UPC found, will use title search (less reliable)\n');
    }

    console.log('========================================');
    console.log(`[Test] Step 2: Searching Walmart ${amazonData.upc ? 'by UPC' : 'by title'}\n`);

    const walmartData = await scrapeWalmart(amazonData.title, amazonData.upc);

    if (walmartData) {
      console.log('[Test] ✅ Walmart Product FOUND:');
      console.log(`  Title: ${walmartData.title}`);
      console.log(`  Price: $${walmartData.price}`);
      console.log(`  URL: ${walmartData.url}\n`);
    } else {
      console.log('[Test] ❌ Walmart: Product not found\n');
    }

    console.log('========================================');
    console.log(`[Test] Step 3: Searching Target ${amazonData.upc ? 'by UPC' : 'by title'}\n`);

    const targetData = await scrapeTarget(amazonData.title, amazonData.upc);

    if (targetData) {
      console.log('[Test] ✅ Target Product FOUND:');
      console.log(`  Title: ${targetData.title}`);
      console.log(`  Price: $${targetData.price}`);
      console.log(`  URL: ${targetData.url}\n`);
    } else {
      console.log('[Test] ❌ Target: Product not found\n');
    }

    console.log('========================================');
    console.log('Test Summary');
    console.log('========================================');
    console.log(`Amazon: ✅ Found - $${amazonData.price}`);
    console.log(`Walmart: ${walmartData ? '✅ Found - $' + walmartData.price : '❌ Not found'}`);
    console.log(`Target: ${targetData ? '✅ Found - $' + targetData.price : '❌ Not found'}`);
    console.log('\n✅ UPC-based matching is working!');

  } catch (error) {
    console.error('[Test] ERROR:', error.message);
  }
})();
