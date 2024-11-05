import { NextResponse } from 'next/server';
import { fetchProducts, updateProductDetails } from '@/lib/productService';

export const dynamic = 'force-dynamic'; // static by default, unless reading the request

export async function GET() {
  try {
    const products = await fetchProducts();
    if (!products) throw new Error('No product fetched');

    const updatedProducts = await Promise.all(
      products.map(async (product) => {
        return await updateProductDetails(product);
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
