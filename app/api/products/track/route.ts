import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import Product from '@/lib/models/product.model';
import { scrapeAllRetailers } from '@/lib/scrapers/orchestrator';
import { connectToDB } from '@/lib/mongoose';

export const maxDuration = 60; // Allow up to 60s for scraping
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    await connectToDB();

    const body = await req.json();
    const { asin } = body;

    if (!asin || typeof asin !== 'string') {
      return NextResponse.json(
        { success: false, error: 'ASIN is required' },
        { status: 400 }
      );
    }

    // Check if product already tracked by this user
    const existing = await Product.findOne({ userId, asin });
    if (existing) {
      return NextResponse.json(
        { success: false, error: 'Product already tracked', product: existing },
        { status: 409 }
      );
    }

    // Check user's product limit (basic implementation - enhance with user subscription check)
    const productCount = await Product.countDocuments({ userId });
    const limit = 50; // Default to 50, should be fetched from user's subscription

    if (productCount >= limit) {
      return NextResponse.json(
        { success: false, error: `Product limit reached (${limit} products max)`, limit },
        { status: 403 }
      );
    }

    // Scrape product data from all retailers
    console.log(`[Track API] Scraping ASIN: ${asin} for user: ${userId}`);
    const scrapedData = await scrapeAllRetailers(asin);

    if (!scrapedData) {
      return NextResponse.json(
        { success: false, error: 'Failed to scrape product data' },
        { status: 500 }
      );
    }

    // Create product in database
    const product = new Product({
      userId,
      asin: scrapedData.product.asin || asin,
      title: scrapedData.product.title,
      imageUrl: scrapedData.product.imageUrl,
      prices: {
        amazon: scrapedData.prices.amazon ? {
          price: scrapedData.prices.amazon,
          url: scrapedData.urls.amazon,
          lastChecked: new Date()
        } : undefined,
        walmart: scrapedData.prices.walmart ? {
          price: scrapedData.prices.walmart,
          url: scrapedData.urls.walmart || undefined,
          lastChecked: new Date()
        } : undefined,
        target: scrapedData.prices.target ? {
          price: scrapedData.prices.target,
          url: scrapedData.urls.target || undefined,
          lastChecked: new Date()
        } : undefined
      },
      lastScrapedAt: new Date(),
      status: 'active'
    });

    // Calculate ROI
    product.calculateROI();

    await product.save();

    console.log(`[Track API] Product tracked successfully: ${product.title} (ROI: ${product.roiPercentage?.toFixed(2)}%)`);

    return NextResponse.json({
      success: true,
      product,
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('[Track API] Error tracking product:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
