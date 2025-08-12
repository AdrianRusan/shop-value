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
import { userCache, productCache, cacheInvalidation } from '@/lib/cache';
import Decimal from 'decimal.js';

// Rate limiting
const ratelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(20, '1 m'), // 20 requests per minute
});

// Input validation schemas
const trackProductSchema = z.object({
  productId: z.string().min(1, 'Product ID is required'),
  alertSettings: z.object({
    priceDecrease: z.boolean().default(true),
    priceIncrease: z.boolean().default(false),
    backInStock: z.boolean().default(true),
    threshold: z.number().positive().optional(),
    frequency: z.enum(['immediate', 'daily', 'weekly']).default('immediate')
  }).optional(),
  userNotes: z.string().max(1000).optional(),
  personalRating: z.number().min(1).max(5).optional(),
  trackingReason: z.enum(['purchase_intent', 'price_monitoring', 'research', 'wishlist', 'gift_idea', 'other']).default('purchase_intent'),
  isPublic: z.boolean().default(false)
});

const updateTrackingSchema = z.object({
  alertSettings: z.object({
    priceDecrease: z.boolean().optional(),
    priceIncrease: z.boolean().optional(),
    backInStock: z.boolean().optional(),
    threshold: z.number().positive().optional(),
    frequency: z.enum(['immediate', 'daily', 'weekly']).optional()
  }).optional(),
  userNotes: z.string().max(1000).optional(),
  personalRating: z.number().min(1).max(5).optional(),
  isPublic: z.boolean().optional(),
  isActive: z.boolean().optional()
});

// Helper function to verify user access
async function verifyUserAccess(userId: string, clerkUserId: string) {
  if (userId !== clerkUserId) {
    throw new Error('Unauthorized: Cannot access other user data');
  }
}

// Helper function to check subscription limits
async function checkSubscriptionLimits(userId: string) {
  const user = await User.findOne({ clerkId: userId });
  
  if (!user) {
    throw new Error('User not found');
  }
  
  if (!user.canTrackMoreProducts()) {
    throw new Error(`Product limit reached. Upgrade to add more products. Current: ${user.usage.productsTracked}/${user.usage.maxProducts}`);
  }
  
  return user;
}

// GET /api/products/user/[userId] - Get user's tracked products
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
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100);
    const skip = (page - 1) * limit;
    const category = searchParams.get('category');
    const status = searchParams.get('status') || 'active';
    const sortBy = searchParams.get('sortBy') || 'addedAt';
    const sortOrder = searchParams.get('sortOrder') === 'asc' ? 1 : -1;

    // Create cache key based on filters
    const filters = { page, limit, category, status, sortBy, sortOrder };
    
    // Try to get cached data first
    const cachedData = await userCache.getCachedUserProducts(params.userId, filters);
    if (cachedData) {
      return NextResponse.json({
        success: true,
        data: cachedData.products,
        cached: true,
        timestamp: cachedData.timestamp
      });
    }

    // Build query
    const trackingQuery: any = {
      userId: params.userId,
      deletedAt: { $exists: false }
    };

    if (status === 'active') {
      trackingQuery.isActive = true;
    } else if (status === 'inactive') {
      trackingQuery.isActive = false;
    }

    // PERFORMANCE OPTIMIZATION: Get tracked products with optimized aggregation pipeline
    // Key optimizations:
    // 1. Apply $match, $sort, $skip, $limit at tracking level BEFORE expensive $lookup operations
    // 2. Pagination is applied to ~20 tracking records instead of after expensive operations
    // 3. Price change percentage computed in $lookup projection instead of post-lookup $addFields
    // 4. Price history slicing optimized to only get recent entries
    // 5. Uses compound indexes: userId + deletedAt + sortField for efficient sorting/pagination
    const trackingAggregation: any[] = [
      // Match user's trackings first (uses indexes)
      {
        $match: trackingQuery
      },
      // Sort at tracking level for efficient pagination
      {
        $sort: { [sortBy]: sortOrder }
      },
      // Apply pagination early to reduce documents for expensive operations
      {
        $skip: skip
      },
      {
        $limit: limit
      },
      // Now perform lookup only on paginated results
      {
        $lookup: {
          from: 'products',
          localField: 'productId',
          foreignField: '_id',
          as: 'product',
          pipeline: [
            // Filter products by category if specified
            ...(category ? [{ $match: { category: new RegExp(category, 'i') } }] : []),
            // Project only essential fields and compute priceChangePercentage in projection
            {
              $project: {
                title: 1,
                brand: 1,
                category: 1,
                currentPrice: 1,
                originalPrice: 1,
                currency: 1,
                image: 1,
                isOutOfStock: 1,
                url: 1,
                lastScrapedAt: 1,
                updatedAt: 1,
                // Get only the most recent price history entries efficiently
                recentPriceHistory: { $slice: ['$priceHistory', -5] },
                // Compute price change percentage directly in projection
                priceChangePercentage: {
                  $cond: {
                    if: {
                      $and: [
                        { $ne: ['$currentPrice', null] },
                        { $ne: ['$originalPrice', null] },
                        { $gt: ['$originalPrice', 0] }
                      ]
                    },
                    then: {
                      $multiply: [
                        {
                          $divide: [
                            { $subtract: ['$currentPrice', '$originalPrice'] },
                            '$originalPrice'
                          ]
                        },
                        100
                      ]
                    },
                    else: 0
                  }
                }
              }
            }
          ]
        }
      },
      // Unwind the product array
      {
        $unwind: {
          path: '$product',
          preserveNullAndEmptyArrays: false // Filter out trackings without valid products
        }
      },
      // Flatten the computed priceChangePercentage to root level
      {
        $addFields: {
          priceChangePercentage: '$product.priceChangePercentage',
          // Rename recentPriceHistory back to priceHistory for backward compatibility
          'product.priceHistory': '$product.recentPriceHistory'
        }
      },
      // Clean up temporary fields
      {
        $project: {
          'product.recentPriceHistory': 0
        }
      }
    ];

    // Execute optimized aggregation query
    const [trackedProducts, totalCount] = await Promise.all([
      UserProductTracking.aggregate(trackingAggregation),
      UserProductTracking.countDocuments(trackingQuery)
    ]);

    // Prepare response with analytics and proper serialization
    const responseData = {
      products: trackedProducts,
      pagination: {
        page,
        limit,
        total: totalCount,
        pages: Math.ceil(totalCount / limit)
      },
      summary: {
        totalTracked: totalCount,
        activeTracked: trackedProducts.filter((t: any) => t.isActive).length,
        averagePriceChange: trackedProducts.length > 0 
          ? (() => {
              // Use precise decimal arithmetic to avoid floating-point precision errors
              const sum = trackedProducts.reduce((acc: InstanceType<typeof Decimal>, p: any) => {
                // Validate that priceChangePercentage is numeric, default to 0 if not
                const priceChange = typeof p.priceChangePercentage === 'number' && !isNaN(p.priceChangePercentage) 
                  ? p.priceChangePercentage 
                  : 0;
                return acc.plus(new Decimal(priceChange));
              }, new Decimal(0));
              
              return sum.dividedBy(new Decimal(trackedProducts.length)).toNumber();
            })()
          : 0
      }
    };

    // Properly serialize the data to avoid Next.js warnings about toJSON methods
    const serializedResponseData = JSON.parse(JSON.stringify(responseData));

    // Cache the response data
    await userCache.cacheUserProducts(params.userId, serializedResponseData, filters);

    return NextResponse.json({
      success: true,
      data: serializedResponseData,
      cached: false,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    Sentry.captureException(error);
    console.error('Error fetching user products:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error'
    }, { status: error instanceof Error && error.message.includes('Unauthorized') ? 403 : 500 });
  }
}

// POST /api/products/user/[userId] - Track a new product
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
    const validation = trackProductSchema.safeParse(body);
    
    if (!validation.success) {
      return NextResponse.json({
        success: false,
        error: 'Invalid input',
        details: validation.error.errors
      }, { status: 400 });
    }

    const { productId, alertSettings, userNotes, personalRating, trackingReason, isPublic } = validation.data;

    // Check subscription limits
    const user = await checkSubscriptionLimits(params.userId);

    // Check if product exists
    const product = await Product.findById(productId);
    if (!product) {
      return NextResponse.json({
        success: false,
        error: 'Product not found'
      }, { status: 404 });
    }

    // Check if already tracking
    const existingTracking = await UserProductTracking.findUserTracking(params.userId, productId);
    if (existingTracking && !existingTracking.deletedAt) {
      return NextResponse.json({
        success: false,
        error: 'Product already being tracked'
      }, { status: 409 });
    }

    // Create new tracking
    const tracking = new UserProductTracking({
      userId: params.userId,
      productId,
      alertSettings: alertSettings || {},
      userNotes,
      personalRating,
      trackingReason,
      isPublic
    });

    await tracking.save();

    // Update user usage
    await user.incrementUsage('products');

    // Update product analytics
    await Product.findByIdAndUpdate(productId, {
      $inc: { 'analytics.trackingCount': 1 },
      $set: { 'analytics.lastViewed': new Date() }
    });

    // Populate product data for response
    await tracking.populate('productId', 'title brand category currentPrice currency image');

    // Invalidate user caches since we added a new product
    await cacheInvalidation.invalidateUser(params.userId);

    // Properly serialize the data to avoid Next.js warnings about toJSON methods
    const serializedTracking = JSON.parse(JSON.stringify(tracking));

    return NextResponse.json({
      success: true,
      data: serializedTracking,
      message: 'Product tracking started successfully',
      timestamp: new Date().toISOString()
    }, { status: 201 });

  } catch (error) {
    Sentry.captureException(error);
    console.error('Error tracking product:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error'
    }, { status: error instanceof Error && error.message.includes('limit reached') ? 402 : 500 });
  }
}

// PUT /api/products/user/[userId] - Bulk update tracked products
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
    const { productIds, updates } = body;

    if (!Array.isArray(productIds) || productIds.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Product IDs array is required'
      }, { status: 400 });
    }

    // Validate updates
    const validation = updateTrackingSchema.safeParse(updates);
    if (!validation.success) {
      return NextResponse.json({
        success: false,
        error: 'Invalid update data',
        details: validation.error.errors
      }, { status: 400 });
    }

    // Perform bulk update
    const result = await UserProductTracking.updateMany(
      {
        userId: params.userId,
        productId: { $in: productIds },
        deletedAt: { $exists: false }
      },
      {
        $set: {
          ...validation.data,
          updatedAt: new Date()
        }
      }
    );

    // Invalidate user caches since we updated products
    await cacheInvalidation.invalidateUser(params.userId);

    return NextResponse.json({
      success: true,
      data: {
        modifiedCount: result.modifiedCount,
        matchedCount: result.matchedCount
      },
      message: `Updated ${result.modifiedCount} product trackings`,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    Sentry.captureException(error);
    console.error('Error bulk updating products:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
}

// DELETE /api/products/user/[userId] - Bulk remove products from tracking
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
    const productIds = searchParams.get('productIds')?.split(',');
    const softDelete = searchParams.get('softDelete') === 'true';

    if (!productIds || productIds.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Product IDs are required'
      }, { status: 400 });
    }

    let result;
    if (softDelete) {
      // Soft delete
      result = await UserProductTracking.updateMany(
        {
          userId: params.userId,
          productId: { $in: productIds },
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
        userId: params.userId,
        productId: { $in: productIds }
      });
    }

    // Update user usage
    const user = await User.findOne({ clerkId: params.userId });
    const removedCount = softDelete ? (result as any).modifiedCount : (result as any).deletedCount;
    
    if (user && removedCount > 0) {
      user.usage.productsTracked = Math.max(0, user.usage.productsTracked - removedCount);
      await user.save();
    }

    // Invalidate user caches since we removed products
    await cacheInvalidation.invalidateUser(params.userId);

    return NextResponse.json({
      success: true,
      data: {
        removedCount,
        softDelete
      },
      message: `Removed ${removedCount} products from tracking`,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    Sentry.captureException(error);
    console.error('Error removing tracked products:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
}