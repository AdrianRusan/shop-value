import { NextResponse } from 'next/server';
import Product from '@/lib/models/product.model';
import { scrapeAllRetailers } from '@/lib/scrapers/orchestrator';
import { connectToDB } from '@/lib/mongoose';

export const maxDuration = 300; // 5 minutes max for cron job
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    // Verify cron secret for security
    const authHeader = req.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      console.error('[CRON] Unauthorized access attempt');
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    await connectToDB();

    // Get all active products
    const products = await Product.findActiveProducts();

    console.log(`[CRON] Starting scrape job for ${products.length} products...`);

    let processed = 0;
    let errors = 0;
    const results = [];

    for (const product of products) {
      try {
        console.log(`[CRON] Processing: ${product.title} (ASIN: ${product.asin})`);

        // Re-scrape prices from all retailers
        const scrapedData = await scrapeAllRetailers(product.asin);

        if (!scrapedData) {
          product.errorCount += 1;
          product.lastError = 'Failed to scrape data';

          // Mark as error if too many failures (5+ consecutive)
          if (product.errorCount >= 5) {
            product.status = 'error';
            console.warn(`[CRON] Product marked as error after ${product.errorCount} failures: ${product.title}`);
          }

          await product.save();
          errors++;
          results.push({
            asin: product.asin,
            title: product.title,
            status: 'failed',
            error: 'Scraping failed'
          });
          continue;
        }

        // Update Amazon price
        if (scrapedData.prices.amazon) {
          product.prices.amazon = {
            price: scrapedData.prices.amazon,
            url: scrapedData.urls.amazon || product.prices.amazon?.url || '',
            lastChecked: new Date()
          };
        }

        // Update Walmart price
        if (scrapedData.prices.walmart) {
          product.prices.walmart = {
            price: scrapedData.prices.walmart,
            url: scrapedData.urls.walmart || product.prices.walmart?.url || '',
            lastChecked: new Date()
          };
        }

        // Update Target price
        if (scrapedData.prices.target) {
          product.prices.target = {
            price: scrapedData.prices.target,
            url: scrapedData.urls.target || product.prices.target?.url || '',
            lastChecked: new Date()
          };
        }

        // Recalculate ROI
        const roi = product.calculateROI();
        product.lastScrapedAt = new Date();
        product.errorCount = 0; // Reset error count on success
        product.lastError = '';

        await product.save();
        processed++;

        console.log(`[CRON] Success: ${product.title} - ROI: ${roi.toFixed(2)}%`);

        results.push({
          asin: product.asin,
          title: product.title,
          status: 'success',
          roi: roi.toFixed(2),
          prices: {
            amazon: scrapedData.prices.amazon,
            walmart: scrapedData.prices.walmart,
            target: scrapedData.prices.target
          }
        });

        // Add delay between requests to avoid rate limiting (500ms)
        if (products.indexOf(product) < products.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }

      } catch (error: any) {
        console.error(`[CRON] Error processing product ${product._id}:`, error.message);
        product.errorCount += 1;
        product.lastError = error.message;
        await product.save();
        errors++;

        results.push({
          asin: product.asin,
          title: product.title,
          status: 'failed',
          error: error.message
        });
      }
    }

    const summary = {
      success: true,
      timestamp: new Date().toISOString(),
      total: products.length,
      processed,
      errors,
      successRate: products.length > 0 ? ((processed / products.length) * 100).toFixed(2) : 0
    };

    console.log(`[CRON] Job complete: ${processed}/${products.length} processed, ${errors} errors (${summary.successRate}% success rate)`);

    return NextResponse.json({
      ...summary,
      results: results.slice(0, 10) // Only return first 10 results to keep response small
    });

  } catch (error: any) {
    console.error('[CRON] Fatal error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error', timestamp: new Date().toISOString() },
      { status: 500 }
    );
  }
}
