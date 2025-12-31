import { NextRequest, NextResponse } from 'next/server';
import { fetchProducts, updateProductDetails } from '@/lib/productService';
import { connectToDB } from '@/lib/mongoose';
import Bottleneck from 'bottleneck';
import { Product } from '@/types';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

const limiter = new Bottleneck({
  minTime: 200,
});

async function updateProductWithLimiter(product: Product) {
  return limiter.schedule(() => updateProductDetails(product));
}

export async function GET(request: NextRequest) {
  try {
    // Verify cron secret if configured
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    await connectToDB();
    const products = await fetchProducts();

    // Handle empty products gracefully - no work to do is not an error
    if (!products || products.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No products to update',
        updatedCount: 0
      });
    }

    const updatedProducts = await Promise.all(
      products.map(async (product) => {
        return await updateProductWithLimiter(product);
      })
    );

    return NextResponse.json({
      success: true,
      updatedCount: updatedProducts.length,
      updatedProducts
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error updating products:', error);
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}
