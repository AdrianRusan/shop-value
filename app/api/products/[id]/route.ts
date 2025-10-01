import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import Product from '@/lib/models/product.model';
import { connectToDB } from '@/lib/mongoose';

export const dynamic = 'force-dynamic';

export async function DELETE(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    await connectToDB();

    // Delete only if owned by this user
    const result = await Product.findOneAndDelete({
      _id: params.id,
      userId
    });

    if (!result) {
      return NextResponse.json(
        { success: false, error: 'Product not found or unauthorized' },
        { status: 404 }
      );
    }

    console.log(`[Delete API] Product deleted: ${result.title} (ID: ${params.id})`);

    return NextResponse.json({
      success: true,
      message: 'Product deleted',
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('[Delete API] Error deleting product:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
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
    const { roiThreshold, alertEnabled, status } = body;

    // Build update object
    const update: any = {};
    if (typeof roiThreshold === 'number') update.roiThreshold = roiThreshold;
    if (typeof alertEnabled === 'boolean') update.alertEnabled = alertEnabled;
    if (status && ['active', 'paused', 'error'].includes(status)) update.status = status;

    if (Object.keys(update).length === 0) {
      return NextResponse.json(
        { success: false, error: 'No valid fields to update' },
        { status: 400 }
      );
    }

    // Update only if owned by this user
    const product = await Product.findOneAndUpdate(
      { _id: params.id, userId },
      update,
      { new: true }
    );

    if (!product) {
      return NextResponse.json(
        { success: false, error: 'Product not found or unauthorized' },
        { status: 404 }
      );
    }

    console.log(`[Update API] Product updated: ${product.title} (ID: ${params.id})`);

    return NextResponse.json({
      success: true,
      product,
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('[Update API] Error updating product:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
