import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import Product from '@/lib/models/product.model';
import { connectToDB } from '@/lib/mongoose';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    await connectToDB();

    // Get all products for this user, sorted by ROI descending
    const products = await Product.findByUserId(userId);

    return NextResponse.json({
      success: true,
      products,
      count: products.length,
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('[User Products API] Error fetching products:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
