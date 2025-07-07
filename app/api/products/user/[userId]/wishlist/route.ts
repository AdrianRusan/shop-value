import { NextRequest, NextResponse } from 'next/server';
import { connectToDB } from '@/lib/mongoose';
import Product from '@/lib/models/product.model';
import UserProductTracking from '@/lib/models/user-product-tracking.model';
import User from '@/lib/models/user.model';
import { auth } from '@clerk/nextjs/server';
import { z } from 'zod';
import { Ratelimit } from '@upstash/ratelimit';
import { redis } from '@/lib/upstash';
import * as Sentry from '@sentry/nextjs';

// Rate limiting
const ratelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(30, '1 m'), // 30 requests per minute for wishlist operations
});

// Input validation schemas
const addToWishlistSchema = z.object({
  productId: z.string().min(1, 'Product ID is required'),
  userNotes: z.string().max(500).optional(),
  personalRating: z.number().min(1).max(5).optional(),
  category: z.string().max(100).optional(), // For wishlist categorization
  priority: z.enum(['low', 'medium', 'high']).default('medium'),
  isPublic: z.boolean().default(false)
});

const updateWishlistItemSchema = z.object({
  userNotes: z.string().max(500).optional(),
  personalRating: z.number().min(1).max(5).optional(),
  category: z.string().max(100).optional(),
  priority: z.enum(['low', 'medium', 'high']).optional(),
  isPublic: z.boolean().optional()
});

const organizeWishlistSchema = z.object({
  items: z.array(z.object({
    trackingId: z.string(),
    category: z.string().optional(),
    order: z.number()
  }))
});

// Helper function to verify user access
async function verifyUserAccess(userId: string, clerkUserId: string) {
  if (userId !== clerkUserId) {
    throw new Error('Unauthorized: Cannot access other user data');
  }
}

// GET /api/products/user/[userId]/wishlist - Get user's wishlist
export async function GET(
  request: NextRequest,
  { params }: { params: { userId: string } }
) {
  try {
    // Rate limiting
    const ip = request.headers.get('x-forwarded-for') ?? 'anonymous';
    const { success } = await ratelimit.limit(ip);
    
    if (!success) {
      return NextResponse.json({ 
        success: false, 
        error: 'Rate limit exceeded' 
      }, { status: 429 });
    }

    // Authentication
    const { userId: clerkUserId } = auth();
    if (!clerkUserId) {
      return NextResponse.json({ 
        success: false, 
        error: 'Unauthorized' 
      }, { status: 401 });
    }

    await verifyUserAccess(params.userId, clerkUserId);
    await connectToDB();

    // Query parameters for filtering and pagination
    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
    const skip = (page - 1) * limit;
    const category = searchParams.get('category');
    const sortBy = searchParams.get('sortBy') || 'addedAt';
    const sortOrder = searchParams.get('sortOrder') === 'asc' ? 1 : -1;

    // Build query - only get wishlist items
    const trackingQuery: any = {
      userId: params.userId,
      trackingReason: 'wishlist',
      deletedAt: { $exists: false }
    };

    // Get wishlist items with populated product data
    const wishlistItems = await UserProductTracking.find(trackingQuery)
      .populate({
        path: 'productId',
        match: category ? { category: new RegExp(category, 'i') } : {},
        select: 'title brand category currentPrice originalPrice currency image isOutOfStock url priceHistory lastScrapedAt updatedAt'
      })
      .sort({ [sortBy]: sortOrder })
      .skip(skip)
      .limit(limit)
      .lean();

    // Filter out items where product wasn't found
    const validWishlistItems = wishlistItems.filter((item: any) => item.productId);

    // Get total count for pagination
    const totalCount = await UserProductTracking.countDocuments(trackingQuery);

    // Group by category for organization
    const itemsByCategory = validWishlistItems.reduce((acc: any, item: any) => {
      const categoryName = item.userNotes?.includes('category:') 
        ? item.userNotes.split('category:')[1].split('|')[0] 
        : 'Uncategorized';
      
      if (!acc[categoryName]) {
        acc[categoryName] = [];
      }
      acc[categoryName].push({
        ...item,
        priceChangePercentage: item.productId && (item.productId as any).currentPrice && (item.productId as any).originalPrice ? 
          (((item.productId as any).currentPrice - (item.productId as any).originalPrice) / (item.productId as any).originalPrice) * 100 : 0
      });
      return acc;
    }, {});

    const responseData = {
      items: validWishlistItems.map((item: any) => ({
        ...item,
        priceChangePercentage: item.productId && (item.productId as any).currentPrice && (item.productId as any).originalPrice ? 
          (((item.productId as any).currentPrice - (item.productId as any).originalPrice) / (item.productId as any).originalPrice) * 100 : 0
      })),
      itemsByCategory,
      pagination: {
        page,
        limit,
        total: totalCount,
        pages: Math.ceil(totalCount / limit)
      },
      summary: {
        totalItems: totalCount,
        categories: Object.keys(itemsByCategory).length,
        averagePriceChange: validWishlistItems.reduce((acc: number, item: any) => {
          const priceChange = item.productId && item.productId.currentPrice && item.productId.originalPrice ? 
            ((item.productId.currentPrice - item.productId.originalPrice) / item.productId.originalPrice) * 100 : 0;
          return acc + priceChange;
        }, 0) / validWishlistItems.length || 0
      }
    };

    // Properly serialize the data
    const serializedResponseData = JSON.parse(JSON.stringify(responseData));

    return NextResponse.json({
      success: true,
      data: serializedResponseData,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    Sentry.captureException(error);
    console.error('Error fetching wishlist:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error'
    }, { status: error instanceof Error && error.message.includes('Unauthorized') ? 403 : 500 });
  }
}

// POST /api/products/user/[userId]/wishlist - Add product to wishlist
export async function POST(
  request: NextRequest,
  { params }: { params: { userId: string } }
) {
  try {
    // Rate limiting
    const ip = request.headers.get('x-forwarded-for') ?? 'anonymous';
    const { success } = await ratelimit.limit(ip);
    
    if (!success) {
      return NextResponse.json({ 
        success: false, 
        error: 'Rate limit exceeded' 
      }, { status: 429 });
    }

    // Authentication
    const { userId: clerkUserId } = auth();
    if (!clerkUserId) {
      return NextResponse.json({ 
        success: false, 
        error: 'Unauthorized' 
      }, { status: 401 });
    }

    await verifyUserAccess(params.userId, clerkUserId);
    await connectToDB();

    // Validate request body
    const body = await request.json();
    const validation = addToWishlistSchema.safeParse(body);
    
    if (!validation.success) {
      return NextResponse.json({
        success: false,
        error: 'Invalid input',
        details: validation.error.errors
      }, { status: 400 });
    }

    const { productId, userNotes, personalRating, category, priority, isPublic } = validation.data;

    // Check if product exists
    const product = await Product.findById(productId);
    if (!product) {
      return NextResponse.json({
        success: false,
        error: 'Product not found'
      }, { status: 404 });
    }

    // Check if already in wishlist
    const existingWishlistItem = await UserProductTracking.findOne({
      userId: params.userId,
      productId,
      trackingReason: 'wishlist',
      deletedAt: { $exists: false }
    });

    if (existingWishlistItem) {
      return NextResponse.json({
        success: false,
        error: 'Product already in wishlist'
      }, { status: 409 });
    }

    // Create wishlist notes with category information
    const enrichedNotes = category 
      ? `category:${category}|priority:${priority}${userNotes ? `|${userNotes}` : ''}` 
      : `priority:${priority}${userNotes ? `|${userNotes}` : ''}`;

    // Create new wishlist item
    const wishlistItem = new UserProductTracking({
      userId: params.userId,
      productId,
      trackingReason: 'wishlist',
      userNotes: enrichedNotes,
      personalRating,
      isPublic,
      isActive: true
    });

    await wishlistItem.save();

    // Update product analytics
    await Product.findByIdAndUpdate(productId, {
      $inc: { 'analytics.wishlistCount': 1 },
      $set: { 'analytics.lastViewed': new Date() }
    });

    // Populate product data for response
    await wishlistItem.populate('productId', 'title brand category currentPrice currency image');

    // Properly serialize the data
    const serializedWishlistItem = JSON.parse(JSON.stringify(wishlistItem));

    return NextResponse.json({
      success: true,
      data: serializedWishlistItem,
      message: 'Product added to wishlist successfully',
      timestamp: new Date().toISOString()
    }, { status: 201 });

  } catch (error) {
    Sentry.captureException(error);
    console.error('Error adding to wishlist:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error'
    }, { status: 500 });
  }
}

// PUT /api/products/user/[userId]/wishlist - Update wishlist item or organize wishlist
export async function PUT(
  request: NextRequest,
  { params }: { params: { userId: string } }
) {
  try {
    // Rate limiting
    const ip = request.headers.get('x-forwarded-for') ?? 'anonymous';
    const { success } = await ratelimit.limit(ip);
    
    if (!success) {
      return NextResponse.json({ 
        success: false, 
        error: 'Rate limit exceeded' 
      }, { status: 429 });
    }

    // Authentication
    const { userId: clerkUserId } = auth();
    if (!clerkUserId) {
      return NextResponse.json({ 
        success: false, 
        error: 'Unauthorized' 
      }, { status: 401 });
    }

    await verifyUserAccess(params.userId, clerkUserId);
    await connectToDB();

    const body = await request.json();
    
    // Check if this is a bulk organization request
    if (body.items && Array.isArray(body.items)) {
      const validation = organizeWishlistSchema.safeParse(body);
      if (!validation.success) {
        return NextResponse.json({
          success: false,
          error: 'Invalid organization data',
          details: validation.error.errors
        }, { status: 400 });
      }

      // Update each item's category and order
      const updatePromises = validation.data.items.map(async (item) => {
        const updateData: any = {};
        
        if (item.category !== undefined) {
          // Update the category in userNotes
          const existingItem = await UserProductTracking.findById(item.trackingId);
          if (existingItem) {
            const notes = existingItem.userNotes || '';
            const updatedNotes = notes.includes('category:') 
              ? notes.replace(/category:[^|]*/, `category:${item.category}`)
              : `category:${item.category}|${notes}`;
            updateData.userNotes = updatedNotes;
          }
        }
        
        updateData.updatedAt = new Date();
        
        return UserProductTracking.findByIdAndUpdate(item.trackingId, { $set: updateData });
      });

      await Promise.all(updatePromises);

      return NextResponse.json({
        success: true,
        message: 'Wishlist organized successfully',
        timestamp: new Date().toISOString()
      });
    } else {
      // Single item update
      const { trackingId, ...updates } = body;
      
      if (!trackingId) {
        return NextResponse.json({
          success: false,
          error: 'Tracking ID is required'
        }, { status: 400 });
      }

      const validation = updateWishlistItemSchema.safeParse(updates);
      if (!validation.success) {
        return NextResponse.json({
          success: false,
          error: 'Invalid update data',
          details: validation.error.errors
        }, { status: 400 });
      }

      // Update the wishlist item
      const updateData: any = { ...validation.data };
      
      // Handle category updates in userNotes
      if (updates.category !== undefined) {
        const existingItem = await UserProductTracking.findById(trackingId);
        if (existingItem) {
          const notes = existingItem.userNotes || '';
          const updatedNotes = notes.includes('category:') 
            ? notes.replace(/category:[^|]*/, `category:${updates.category}`)
            : `category:${updates.category}|${notes}`;
          updateData.userNotes = updatedNotes;
        }
      }

      const result = await UserProductTracking.findOneAndUpdate(
        {
          _id: trackingId,
          userId: params.userId,
          trackingReason: 'wishlist',
          deletedAt: { $exists: false }
        },
        { $set: updateData },
        { new: true }
      ).populate('productId', 'title brand category currentPrice currency image');

      if (!result) {
        return NextResponse.json({
          success: false,
          error: 'Wishlist item not found'
        }, { status: 404 });
      }

      return NextResponse.json({
        success: true,
        data: JSON.parse(JSON.stringify(result)),
        message: 'Wishlist item updated successfully',
        timestamp: new Date().toISOString()
      });
    }

  } catch (error) {
    Sentry.captureException(error);
    console.error('Error updating wishlist:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
}

// DELETE /api/products/user/[userId]/wishlist - Remove items from wishlist
export async function DELETE(
  request: NextRequest,
  { params }: { params: { userId: string } }
) {
  try {
    // Rate limiting
    const ip = request.headers.get('x-forwarded-for') ?? 'anonymous';
    const { success } = await ratelimit.limit(ip);
    
    if (!success) {
      return NextResponse.json({ 
        success: false, 
        error: 'Rate limit exceeded' 
      }, { status: 429 });
    }

    // Authentication
    const { userId: clerkUserId } = auth();
    if (!clerkUserId) {
      return NextResponse.json({ 
        success: false, 
        error: 'Unauthorized' 
      }, { status: 401 });
    }

    await verifyUserAccess(params.userId, clerkUserId);
    await connectToDB();

    const searchParams = request.nextUrl.searchParams;
    const trackingIds = searchParams.get('trackingIds')?.split(',');
    const softDelete = searchParams.get('softDelete') === 'true';

    if (!trackingIds || trackingIds.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Tracking IDs are required'
      }, { status: 400 });
    }

    let result;
    if (softDelete) {
      // Soft delete
      result = await UserProductTracking.updateMany(
        {
          _id: { $in: trackingIds },
          userId: params.userId,
          trackingReason: 'wishlist',
          deletedAt: { $exists: false }
        },
        {
          $set: {
            deletedAt: new Date(),
            isActive: false
          }
        }
      );
    } else {
      // Hard delete
      result = await UserProductTracking.deleteMany({
        _id: { $in: trackingIds },
        userId: params.userId,
        trackingReason: 'wishlist'
      });
    }

    const removedCount = softDelete ? (result as any).modifiedCount : (result as any).deletedCount;

    return NextResponse.json({
      success: true,
      data: {
        removedCount,
        softDelete
      },
      message: `Removed ${removedCount} items from wishlist`,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    Sentry.captureException(error);
    console.error('Error removing wishlist items:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
}