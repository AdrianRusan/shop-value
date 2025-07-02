import { NextRequest, NextResponse } from 'next/server';
import { connectToDB } from '@/lib/mongoose';
import Product from '@/lib/models/product.model';
import { auth } from '@clerk/nextjs/server';
import { z } from 'zod';
import { rateLimits, cacheKeys } from '@/lib/upstash';
import { cacheService, CacheMetrics } from '@/lib/cache/cache-service';
import { CACHE_CONFIG } from '@/lib/cache/cache-service';

// Input validation schema
const searchProductsSchema = z.object({
  q: z.string().min(1, 'Search query is required').max(100),
  category: z.string().optional(),
  brand: z.string().optional(),
  minPrice: z.number().min(0).optional(),
  maxPrice: z.number().min(0).optional(),
  sortBy: z.enum(['relevance', 'price_asc', 'price_desc', 'popularity', 'date']).default('relevance'),
  page: z.number().min(1).default(1),
  limit: z.number().min(1).max(50).default(20)
});

// GET /api/products/search - Search products with caching
export async function GET(request: NextRequest) {
  try {
    // Rate limiting
    const ip = request.headers.get('x-forwarded-for') ?? 'anonymous';
    const { success } = await rateLimits.api.limit(ip);
    
    if (!success) {
      return NextResponse.json({ 
        success: false, 
        error: 'Rate limit exceeded' 
      }, { status: 429 });
    }

    // Parse and validate query parameters
    const searchParams = request.nextUrl.searchParams;
    const queryParams = {
      q: searchParams.get('q') || '',
      category: searchParams.get('category') || undefined,
      brand: searchParams.get('brand') || undefined,
      minPrice: searchParams.get('minPrice') ? parseFloat(searchParams.get('minPrice')!) : undefined,
      maxPrice: searchParams.get('maxPrice') ? parseFloat(searchParams.get('maxPrice')!) : undefined,
      sortBy: searchParams.get('sortBy') || 'relevance',
      page: parseInt(searchParams.get('page') || '1'),
      limit: parseInt(searchParams.get('limit') || '20')
    };

    const validation = searchProductsSchema.safeParse(queryParams);
    
    if (!validation.success) {
      return NextResponse.json({
        success: false,
        error: 'Invalid search parameters',
        details: validation.error.errors
      }, { status: 400 });
    }

    const { q, category, brand, minPrice, maxPrice, sortBy, page, limit } = validation.data;

    // Generate cache key based on search parameters
    const cacheKey = `search:products:${Buffer.from(JSON.stringify({
      q, category, brand, minPrice, maxPrice, sortBy, page, limit
    })).toString('base64')}`;

    // Try to get cached results first
    const cachedResults = await cacheService.get<any>(cacheKey);
    if (cachedResults) {
      await CacheMetrics.incrementHit();
      return NextResponse.json({
        ...cachedResults,
        cached: true,
        timestamp: new Date().toISOString()
      });
    }

    await CacheMetrics.incrementMiss();
    await connectToDB();

    // Build search query
    const searchQuery: any = {
      isActive: true,
      deletedAt: { $exists: false }
    };

    // Text search
    if (q) {
      searchQuery.$text = { $search: q };
    }

    // Category filter
    if (category) {
      searchQuery.category = new RegExp(category, 'i');
    }

    // Brand filter
    if (brand) {
      searchQuery.brand = new RegExp(brand, 'i');
    }

    // Price range filter
    if (minPrice !== undefined || maxPrice !== undefined) {
      searchQuery.currentPrice = {};
      if (minPrice !== undefined) {
        searchQuery.currentPrice.$gte = minPrice;
      }
      if (maxPrice !== undefined) {
        searchQuery.currentPrice.$lte = maxPrice;
      }
    }

    // Build sort options
    let sortOptions: any = {};
    switch (sortBy) {
      case 'price_asc':
        sortOptions = { currentPrice: 1 };
        break;
      case 'price_desc':
        sortOptions = { currentPrice: -1 };
        break;
      case 'popularity':
        sortOptions = { 'analytics.popularityScore': -1 };
        break;
      case 'date':
        sortOptions = { createdAt: -1 };
        break;
      case 'relevance':
      default:
        if (q) {
          sortOptions = { score: { $meta: 'textScore' } };
        } else {
          sortOptions = { 'analytics.popularityScore': -1 };
        }
        break;
    }

    const skip = (page - 1) * limit;

    // Execute search query
    const [products, totalCount] = await Promise.all([
      Product.find(searchQuery)
        .sort(sortOptions)
        .skip(skip)
        .limit(limit)
        .select('title brand category currentPrice originalPrice image url analytics isOutOfStock availability')
        .lean(),
      Product.countDocuments(searchQuery)
    ]);

    // Prepare response data
    const results = {
      success: true,
      data: {
        products: products.map(product => ({
          ...product,
          priceChangePercentage: product.originalPrice > 0 ? 
            ((product.currentPrice - product.originalPrice) / product.originalPrice) * 100 : 0
        })),
        pagination: {
          page,
          limit,
          total: totalCount,
          pages: Math.ceil(totalCount / limit)
        },
        filters: {
          query: q,
          category,
          brand,
          priceRange: { min: minPrice, max: maxPrice },
          sortBy
        }
      }
    };

    // Cache the results
    await cacheService.set(cacheKey, results, CACHE_CONFIG.PRODUCTS_SEARCH.ttl);

    return NextResponse.json({
      ...results,
      cached: false,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Product search error:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Search failed',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

// POST /api/products/search - Advanced search with filters
export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const ip = request.headers.get('x-forwarded-for') ?? 'anonymous';
    const { success } = await rateLimits.api.limit(ip);
    
    if (!success) {
      return NextResponse.json({ 
        success: false, 
        error: 'Rate limit exceeded' 
      }, { status: 429 });
    }

    // Authentication for advanced search
    const { userId } = auth();
    if (!userId) {
      return NextResponse.json({ 
        success: false, 
        error: 'Authentication required for advanced search' 
      }, { status: 401 });
    }

    const body = await request.json();
    
    // Advanced search schema
    const advancedSearchSchema = z.object({
      query: z.string().optional(),
      filters: z.object({
        categories: z.array(z.string()).optional(),
        brands: z.array(z.string()).optional(),
        priceRange: z.object({
          min: z.number().min(0),
          max: z.number().min(0)
        }).optional(),
        availability: z.array(z.enum(['in_stock', 'out_of_stock', 'limited'])).optional(),
        ratings: z.object({
          min: z.number().min(0).max(5),
          max: z.number().min(0).max(5)
        }).optional()
      }).optional(),
      sortBy: z.enum(['relevance', 'price_asc', 'price_desc', 'popularity', 'date', 'rating']).default('relevance'),
      page: z.number().min(1).default(1),
      limit: z.number().min(1).max(50).default(20),
      includeTracked: z.boolean().default(false)
    });

    const validation = advancedSearchSchema.safeParse(body);
    
    if (!validation.success) {
      return NextResponse.json({
        success: false,
        error: 'Invalid search parameters',
        details: validation.error.errors
      }, { status: 400 });
    }

    const { query, filters, sortBy, page, limit, includeTracked } = validation.data;

    // Generate cache key for advanced search
    const cacheKey = `search:advanced:${userId}:${Buffer.from(JSON.stringify({
      query, filters, sortBy, page, limit, includeTracked
    })).toString('base64')}`;

    // Try cache first
    const cachedResults = await cacheService.get<any>(cacheKey);
    if (cachedResults) {
      await CacheMetrics.incrementHit();
      return NextResponse.json({
        ...cachedResults,
        cached: true,
        timestamp: new Date().toISOString()
      });
    }

    await CacheMetrics.incrementMiss();
    await connectToDB();

    // Build advanced search query
    const searchQuery: any = {
      isActive: true,
      deletedAt: { $exists: false }
    };

    // Text search
    if (query) {
      searchQuery.$text = { $search: query };
    }

    // Category filters
    if (filters?.categories && filters.categories.length > 0) {
      searchQuery.category = { $in: filters.categories.map(c => new RegExp(c, 'i')) };
    }

    // Brand filters
    if (filters?.brands && filters.brands.length > 0) {
      searchQuery.brand = { $in: filters.brands.map(b => new RegExp(b, 'i')) };
    }

    // Price range
    if (filters?.priceRange) {
      searchQuery.currentPrice = {
        $gte: filters.priceRange.min,
        $lte: filters.priceRange.max
      };
    }

    // Availability filters
    if (filters?.availability && filters.availability.length > 0) {
      searchQuery.availability = { $in: filters.availability };
    }

    // Rating filters
    if (filters?.ratings) {
      searchQuery.stars = {
        $gte: filters.ratings.min,
        $lte: filters.ratings.max
      };
    }

    // Build sort options
    let sortOptions: any = {};
    switch (sortBy) {
      case 'price_asc':
        sortOptions = { currentPrice: 1 };
        break;
      case 'price_desc':
        sortOptions = { currentPrice: -1 };
        break;
      case 'popularity':
        sortOptions = { 'analytics.popularityScore': -1 };
        break;
      case 'date':
        sortOptions = { createdAt: -1 };
        break;
      case 'rating':
        sortOptions = { stars: -1 };
        break;
      case 'relevance':
      default:
        if (query) {
          sortOptions = { score: { $meta: 'textScore' } };
        } else {
          sortOptions = { 'analytics.popularityScore': -1 };
        }
        break;
    }

    const skip = (page - 1) * limit;

    // Execute advanced search
    const [products, totalCount] = await Promise.all([
      Product.find(searchQuery)
        .sort(sortOptions)
        .skip(skip)
        .limit(limit)
        .select('title brand category currentPrice originalPrice image url analytics isOutOfStock availability stars reviewsCount')
        .lean(),
      Product.countDocuments(searchQuery)
    ]);

    // If includeTracked is true, get user's tracked products
    let trackedProductIds: string[] = [];
    if (includeTracked && products.length > 0) {
      const UserProductTracking = (await import('@/lib/models/user-product-tracking.model')).default;
      const userTrackings = await UserProductTracking.find({
        userId,
        isActive: true,
        deletedAt: { $exists: false }
      }).select('productId').lean();
      
      trackedProductIds = userTrackings.map(t => t.productId.toString());
    }

    // Prepare response data
    const results = {
      success: true,
      data: {
        products: products.map(product => ({
          ...product,
          priceChangePercentage: product.originalPrice > 0 ? 
            ((product.currentPrice - product.originalPrice) / product.originalPrice) * 100 : 0,
          isTracked: trackedProductIds.includes(product._id.toString())
        })),
        pagination: {
          page,
          limit,
          total: totalCount,
          pages: Math.ceil(totalCount / limit)
        },
        appliedFilters: {
          query,
          ...filters,
          sortBy,
          includeTracked
        }
      }
    };

    // Cache the results (shorter TTL for user-specific data)
    await cacheService.set(cacheKey, results, 300); // 5 minutes

    return NextResponse.json({
      ...results,
      cached: false,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Advanced search error:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Advanced search failed',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}