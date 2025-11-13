import { NextResponse } from 'next/server';
import { fetchProducts, updateProductDetails } from '@/lib/productService';
import { connectToDB } from '@/lib/mongoose';
import Bottleneck from 'bottleneck';
import { Product } from '@/types';

export const maxDuration = 250;
export const dynamic = 'force-dynamic'; // static by default, unless reading the request

const limiter = new Bottleneck({
  minTime: 200, // Minimum time between requests in milliseconds
});

async function updateProductWithLimiter(product: Product) {
  return limiter.schedule(() => updateProductDetails(product));
}

export async function GET(request: Request) {
  try {
    // Authentication: Verify Vercel Cron Secret
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    await connectToDB();
    const products = await fetchProducts();
    if (!products) throw new Error('No product fetched');

    const updatedProducts = await Promise.all(
      products.map(async (product) => {
        return await updateProductWithLimiter(product);
      })
    );

    return NextResponse.json({ success: true, updatedProducts });
  } catch (error: any) {
    console.error('Error updating products:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
