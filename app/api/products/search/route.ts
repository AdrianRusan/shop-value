import { NextRequest, NextResponse } from 'next/server';
import { connectToDB } from '@/lib/mongoose';
import Product from '@/lib/models/product.model';
import { z } from 'zod';
import { Ratelimit } from '@upstash/ratelimit';
import { redis } from '@/lib/upstash';
import * as Sentry from '@sentry/nextjs';
import { ProductCacheService, enhancedCacheTTL } from '@/lib/cache';
import { searchRelevanceService, SearchRelevanceOptions, ScoredProduct } from '@/lib/services/search-relevance.service';

// Rate limiting - more generous for search functionality
const ratelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(50, '1 m'), // 50 search requests per minute
});

// Input validation schema for search parameters
const searchSchema = z.object({
  query: z.string().optional(),
  category: z.string().optional(),
  brand: z.string().optional(),
  source: z.enum(['flip', 'emag', 'altex', 'cel', 'amazon']).optional(),
  minPrice: z.number().min(0).optional(),
  maxPrice: z.number().min(0).optional(),
  availability: z.enum(['in_stock', 'out_of_stock', 'limited', 'discontinued']).optional(),
  minRating: z.number().min(0).max(5).optional(),
  page: z.number().min(1).default(1),
  limit: z.number().min(1).max(100).default(20),
  sortBy: z.enum(['relevance', 'price_asc', 'price_desc', 'rating', 'popularity', 'newest', 'discount']).default('relevance'),
  includeOutOfStock: z.boolean().default(true),
  currency: z.enum(['RON', 'EUR', 'USD']).optional(),
  discountMin: z.number().min(0).max(100).optional(), // Minimum discount percentage
  // Enhanced relevance scoring parameters
  userId: z.string().optional(),
  userTier: z.enum(['free', 'premium', 'enterprise']).optional(),
  abTestGroup: z.enum(['control', 'experiment_a', 'experiment_b']).optional(),
  includePersonalization: z.boolean().default(false),
  includeFreshness: z.boolean().default(true),
  includeFuzzyMatching: z.boolean().default(true),
  includeSynonyms: z.boolean().default(true),
});

type SearchParams = z.infer<typeof searchSchema>;

// Initialize cache service
const productCache = new ProductCacheService();

// Helper function to build MongoDB query from search parameters
function buildSearchQuery(params: SearchParams) {
  const query: any = {
    isActive: true,
    deletedAt: { $exists: false },
  };

  // Text search - use MongoDB's text index
  if (params.query) {
    query.$text = { $search: params.query };
  }

  // Category filter
  if (params.category) {
    query.category = new RegExp(params.category, 'i');
  }

  // Brand filter
  if (params.brand) {
    query.brand = new RegExp(params.brand, 'i');
  }

  // Source filter
  if (params.source) {
    query.source = params.source;
  }

  // Price range filter
  if (params.minPrice !== undefined || params.maxPrice !== undefined) {
    query.currentPrice = {};
    if (params.minPrice !== undefined) {
      query.currentPrice.$gte = params.minPrice;
    }
    if (params.maxPrice !== undefined) {
      query.currentPrice.$lte = params.maxPrice;
    }
  }

  // Availability filter
  if (params.availability) {
    query.availability = params.availability;
  } else if (!params.includeOutOfStock) {
    query.isOutOfStock = false;
    query.availability = { $ne: 'out_of_stock' };
  }

  // Currency filter
  if (params.currency) {
    query.currency = params.currency;
  }

  // Rating filter
  if (params.minRating !== undefined) {
    query.stars = { $gte: params.minRating };
  }

  // Discount filter
  if (params.discountMin !== undefined) {
    query.discountRate = { $gte: params.discountMin };
  }

  return query;
}

// Helper function to build sort options
function buildSortOptions(sortBy: string, hasTextSearch: boolean) {
  const sortOptions: any = {};

  switch (sortBy) {
    case 'relevance':
      if (hasTextSearch) {
        sortOptions.score = { $meta: 'textScore' };
      } else {
        // If no text search, sort by popularity
        sortOptions['analytics.popularityScore'] = -1;
      }
      break;
    case 'price_asc':
      sortOptions.currentPrice = 1;
      break;
    case 'price_desc':
      sortOptions.currentPrice = -1;
      break;
    case 'rating':
      sortOptions.stars = -1;
      sortOptions.reviewsCount = -1;
      break;
    case 'popularity':
      sortOptions['analytics.popularityScore'] = -1;
      sortOptions['analytics.trackingCount'] = -1;
      break;
    case 'newest':
      sortOptions.createdAt = -1;
      break;
    case 'discount':
      sortOptions.discountRate = -1;
      break;
    default:
      sortOptions['analytics.popularityScore'] = -1;
  }

  return sortOptions;
}

// Helper function to determine A/B test group for user
function determineABTestGroup(userId?: string): 'control' | 'experiment_a' | 'experiment_b' {
  if (!userId) return 'control';
  
  // Simple hash-based distribution for consistent assignment
  const hash = userId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const group = hash % 3;
  
  switch (group) {
    case 0: return 'control';
    case 1: return 'experiment_a';
    case 2: return 'experiment_b';
    default: return 'control';
  }
}

// Helper function to calculate enhanced relevance score
async function calculateEnhancedRelevanceScore(
  products: any[],
  searchOptions: SearchRelevanceOptions
): Promise<ScoredProduct[]> {
  const scoredProducts: ScoredProduct[] = [];
  
  for (const product of products) {
    const relevanceScore = await searchRelevanceService.calculateRelevanceScore(
      product,
      searchOptions
    );
    
    const searchMetadata = {
      matchedTerms: extractMatchedTerms(product, searchOptions.query || ''),
      highlightedText: highlightSearchTerms(product.title || '', searchOptions.query || ''),
      relevanceRank: 0 // Will be set after sorting
    };
    
    scoredProducts.push({
      ...product,
      relevanceScore,
      searchMetadata
    });
  }
  
  // Sort by relevance and assign ranks
  const sortedProducts = searchRelevanceService.sortByRelevance(scoredProducts);
  sortedProducts.forEach((product, index) => {
    product.searchMetadata.relevanceRank = index + 1;
  });
  
  return sortedProducts;
}

// Helper function to extract matched terms
function extractMatchedTerms(product: any, query: string): string[] {
  const searchTerms = query.toLowerCase().split(/\s+/).filter(term => term.length > 0);
  const title = product.title?.toLowerCase() || '';
  const brand = product.brand?.toLowerCase() || '';
  const description = product.description?.toLowerCase() || '';
  
  const matchedTerms: string[] = [];
  
  searchTerms.forEach(term => {
    if (title.includes(term) || brand.includes(term) || description.includes(term)) {
      matchedTerms.push(term);
    }
  });
  
  return matchedTerms;
}

// Helper function to highlight search terms in text
function highlightSearchTerms(text: string, query: string): string {
  const searchTerms = query.toLowerCase().split(/\s+/).filter(term => term.length > 0);
  let highlightedText = text;
  
  searchTerms.forEach(term => {
    const regex = new RegExp(`(${term})`, 'gi');
    highlightedText = highlightedText.replace(regex, '<mark>$1</mark>');
  });
  
  return highlightedText;
}

// Helper function to generate cache key for search results
function generateCacheKey(params: SearchParams) {
  const cacheParams = {
    query: params.query,
    category: params.category,
    brand: params.brand,
    source: params.source,
    minPrice: params.minPrice,
    maxPrice: params.maxPrice,
    availability: params.availability,
    minRating: params.minRating,
    sortBy: params.sortBy,
    includeOutOfStock: params.includeOutOfStock,
    currency: params.currency,
    discountMin: params.discountMin,
    page: params.page,
    limit: params.limit,
  };

  return `search:products:${Buffer.from(JSON.stringify(cacheParams)).toString('base64')}`;
}

// GET /api/products/search - Search products with advanced filtering
export async function GET(request: NextRequest) {
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

    // Parse and validate search parameters
    const searchParams = request.nextUrl.searchParams;
    const rawParams = {
      query: searchParams.get('query') || undefined,
      category: searchParams.get('category') || undefined,
      brand: searchParams.get('brand') || undefined,
      source: searchParams.get('source') || undefined,
      minPrice: searchParams.get('minPrice') ? parseFloat(searchParams.get('minPrice')!) : undefined,
      maxPrice: searchParams.get('maxPrice') ? parseFloat(searchParams.get('maxPrice')!) : undefined,
      availability: searchParams.get('availability') || undefined,
      minRating: searchParams.get('minRating') ? parseFloat(searchParams.get('minRating')!) : undefined,
      page: parseInt(searchParams.get('page') || '1'),
      limit: Math.min(parseInt(searchParams.get('limit') || '20'), 100),
      sortBy: searchParams.get('sortBy') || 'relevance',
      includeOutOfStock: searchParams.get('includeOutOfStock') !== 'false',
      currency: searchParams.get('currency') || undefined,
      discountMin: searchParams.get('discountMin') ? parseFloat(searchParams.get('discountMin')!) : undefined,
      // Enhanced relevance scoring parameters
      userId: searchParams.get('userId') || undefined,
      userTier: searchParams.get('userTier') || undefined,
      abTestGroup: searchParams.get('abTestGroup') || undefined,
      includePersonalization: searchParams.get('includePersonalization') === 'true',
      includeFreshness: searchParams.get('includeFreshness') !== 'false',
      includeFuzzyMatching: searchParams.get('includeFuzzyMatching') !== 'false',
      includeSynonyms: searchParams.get('includeSynonyms') !== 'false',
    };

    const validation = searchSchema.safeParse(rawParams);
    
    if (!validation.success) {
      return NextResponse.json({
        success: false,
        error: 'Invalid search parameters',
        details: validation.error.errors
      }, { status: 400 });
    }

    const params = validation.data;

    // Check cache first
    const cacheKey = generateCacheKey(params);
    const cachedResults = await productCache.getCachedProductSearch(params.query || '', params);
    
    if (cachedResults) {
      return NextResponse.json({
        success: true,
        data: cachedResults.results,
        pagination: cachedResults.pagination,
        facets: cachedResults.facets,
        cached: true,
        timestamp: cachedResults.timestamp
      });
    }

    await connectToDB();

    // Build MongoDB query
    const mongoQuery = buildSearchQuery(params);
    const hasTextSearch = !!params.query;
    const sortOptions = buildSortOptions(params.sortBy, hasTextSearch);

    // Calculate pagination
    const skip = (params.page - 1) * params.limit;

    // Execute search query with aggregation for better performance
    const aggregationPipeline: any[] = [
      { $match: mongoQuery }
    ];

    // Add text score projection if using text search
    if (hasTextSearch) {
      aggregationPipeline.push({
        $addFields: { score: { $meta: 'textScore' } }
      });
    }

    // Add sorting
    aggregationPipeline.push({ $sort: sortOptions });

    // Add pagination
    aggregationPipeline.push({ $skip: skip });
    aggregationPipeline.push({ $limit: params.limit });

    // Project only necessary fields for performance
    aggregationPipeline.push({
      $project: {
        title: 1,
        brand: 1,
        category: 1,
        currentPrice: 1,
        originalPrice: 1,
        currency: 1,
        image: 1,
        url: 1,
        stars: 1,
        reviewsCount: 1,
        isOutOfStock: 1,
        availability: 1,
        discountRate: 1,
        source: 1,
        analytics: 1,
        priceHistory: { $slice: ['$priceHistory', -5] }, // Last 5 price points
        createdAt: 1,
        score: hasTextSearch ? { $meta: 'textScore' } : undefined
      }
    });

    // Execute main query
    const [products, totalCount] = await Promise.all([
      Product.aggregate(aggregationPipeline),
      Product.countDocuments(mongoQuery)
    ]);

    // Calculate facets for filtering (run in parallel for performance)
    // Create a copy of mongoQuery without the text search condition for accurate facets
    const facetsQuery = { ...mongoQuery };
    delete facetsQuery.$text; // Remove text search condition for facets
    
    const facetsPromise = Product.aggregate([
      { $match: facetsQuery },
      {
        $facet: {
          categories: [
            { $group: { _id: '$category', count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: 20 }
          ],
          brands: [
            { $group: { _id: '$brand', count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: 20 }
          ],
          sources: [
            { $group: { _id: '$source', count: { $sum: 1 } } },
            { $sort: { count: -1 } }
          ],
          priceRanges: [
            {
              $bucket: {
                groupBy: '$currentPrice',
                boundaries: [0, 50, 100, 250, 500, 1000, 2500, 5000, 10000],
                default: 'Other',
                output: { count: { $sum: 1 } }
              }
            }
          ],
          availability: [
            { $group: { _id: '$availability', count: { $sum: 1 } } }
          ]
        }
      }
    ]);

    const facetsResult = await facetsPromise;
    const facets = facetsResult[0] || {};

    // Enhance products with relevance scores and additional data using new relevance service
    const searchRelevanceOptions: SearchRelevanceOptions = {
      query: params.query || '',
      userId: params.userId,
      userTier: params.userTier,
      abTestGroup: params.abTestGroup || determineABTestGroup(params.userId),
      includePersonalization: params.includePersonalization,
      includeFreshness: params.includeFreshness,
      includeFuzzyMatching: params.includeFuzzyMatching,
      includeSynonyms: params.includeSynonyms
    };

    const enhancedProducts = await calculateEnhancedRelevanceScore(products, searchRelevanceOptions);
    
    // Add additional product metadata
    const finalProducts = enhancedProducts.map(product => ({
      ...product,
      priceChangePercentage: (product as any).currentPrice && (product as any).originalPrice ? 
        (((product as any).currentPrice - (product as any).originalPrice) / (product as any).originalPrice) * 100 : 0,
      savings: (product as any).originalPrice - (product as any).currentPrice,
      isOnSale: (product as any).currentPrice < (product as any).originalPrice,
      trackingCount: (product as any).analytics?.trackingCount || 0
    }));

    // Products are already sorted by relevance from calculateEnhancedRelevanceScore
    // No need for additional sorting when using relevance

    // Prepare pagination info
    const pagination = {
      page: params.page,
      limit: params.limit,
      total: totalCount,
      pages: Math.ceil(totalCount / params.limit),
      hasNext: params.page < Math.ceil(totalCount / params.limit),
      hasPrev: params.page > 1
    };

    // Track search analytics for A/B testing and improvement
    await searchRelevanceService.trackSearchAnalytics(
      params.query || '',
      enhancedProducts,
      params.userId,
      params.abTestGroup || determineABTestGroup(params.userId)
    );

    // Prepare response data
    const responseData = {
      results: finalProducts,
      pagination,
      facets: {
        categories: facets.categories || [],
        brands: facets.brands || [],
        sources: facets.sources || [],
        priceRanges: facets.priceRanges || [],
        availability: facets.availability || []
      },
      searchInfo: {
        query: params.query,
        filters: {
          category: params.category,
          brand: params.brand,
          source: params.source,
          priceRange: params.minPrice || params.maxPrice ? {
            min: params.minPrice,
            max: params.maxPrice
          } : undefined,
          availability: params.availability,
          minRating: params.minRating,
          currency: params.currency,
          discountMin: params.discountMin
        },
        sorting: params.sortBy,
        totalResults: totalCount,
        responseTime: Date.now(),
        abTestGroup: params.abTestGroup || determineABTestGroup(params.userId),
        relevanceMetrics: {
          averageScore: enhancedProducts.reduce((sum, p) => sum + p.relevanceScore.totalScore, 0) / enhancedProducts.length,
          scoreDistribution: enhancedProducts.reduce((acc, p) => {
            const score = Math.floor(p.relevanceScore.totalScore / 25) * 25;
            acc[`${score}-${score + 24}`] = (acc[`${score}-${score + 24}`] || 0) + 1;
            return acc;
          }, {} as Record<string, number>)
        }
      }
    };

    // Cache the results
    await productCache.cacheProductSearch(
      params.query || '', 
      params, 
      finalProducts
    );

    return NextResponse.json({
      success: true,
      data: responseData.results,
      pagination: responseData.pagination,
      facets: responseData.facets,
      searchInfo: responseData.searchInfo,
      cached: false,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    Sentry.captureException(error);
    console.error('Error in product search:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Internal server error during search',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// POST /api/products/search - Advanced search with complex filters
export async function POST(request: NextRequest) {
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

    const body = await request.json();
    
    // Extended schema for POST requests with more complex filters
    const advancedSearchSchema = searchSchema.extend({
      filters: z.object({
        priceHistory: z.object({
          hasDecreased: z.boolean().optional(),
          hasIncreased: z.boolean().optional(),
          percentageChange: z.object({
            min: z.number().optional(),
            max: z.number().optional()
          }).optional()
        }).optional(),
        keywords: z.array(z.string()).optional(),
        excludeKeywords: z.array(z.string()).optional(),
        dateRange: z.object({
          from: z.string().datetime().optional(),
          to: z.string().datetime().optional()
        }).optional(),
        stockHistory: z.object({
          wasOutOfStock: z.boolean().optional(),
          backInStock: z.boolean().optional()
        }).optional()
      }).optional(),
      aggregations: z.object({
        includeStats: z.boolean().default(false),
        includeTrends: z.boolean().default(false),
        includeComparisons: z.boolean().default(false)
      }).optional()
    });

    const validation = advancedSearchSchema.safeParse(body);
    
    if (!validation.success) {
      return NextResponse.json({
        success: false,
        error: 'Invalid search parameters',
        details: validation.error.errors
      }, { status: 400 });
    }

    const params = validation.data;
    
    await connectToDB();

    // Build base query
    const mongoQuery = buildSearchQuery(params);

    // Add advanced filters
    if (params.filters) {
      // Collect all additional conditions to combine with existing query
      const additionalConditions: any[] = [];

      // Keywords filter - combine with existing conditions using $and
      if (params.filters.keywords && params.filters.keywords.length > 0) {
        const keywordRegex = params.filters.keywords.map(k => new RegExp(k, 'i'));
        const keywordCondition = {
          $or: [
            { title: { $in: keywordRegex } },
            { description: { $in: keywordRegex } },
            { keywords: { $in: params.filters.keywords } }
          ]
        };
        additionalConditions.push(keywordCondition);
      }

      // Exclude keywords filter - use $nin for proper exclusion
      if (params.filters.excludeKeywords && params.filters.excludeKeywords.length > 0) {
        const excludeRegex = params.filters.excludeKeywords.map(k => new RegExp(k, 'i'));
        const excludeCondition = {
          $and: [
            { title: { $nin: excludeRegex } },
            { description: { $nin: excludeRegex } },
            { keywords: { $nin: params.filters.excludeKeywords } }
          ]
        };
        additionalConditions.push(excludeCondition);
      }

      // Date range filter
      if (params.filters.dateRange) {
        const dateFilter: any = {};
        if (params.filters.dateRange.from) {
          dateFilter.$gte = new Date(params.filters.dateRange.from);
        }
        if (params.filters.dateRange.to) {
          dateFilter.$lte = new Date(params.filters.dateRange.to);
        }
        if (Object.keys(dateFilter).length > 0) {
          mongoQuery.createdAt = dateFilter;
        }
      }

      // Price history filters - use $expr for field comparisons
      if (params.filters.priceHistory) {
        const priceHistoryConditions: any[] = [];
        
        if (params.filters.priceHistory.hasDecreased) {
          priceHistoryConditions.push({
            $expr: { $lt: ['$currentPrice', '$originalPrice'] }
          });
        }
        
        if (params.filters.priceHistory.hasIncreased) {
          priceHistoryConditions.push({
            $expr: { $gt: ['$currentPrice', '$originalPrice'] }
          });
        }
        
        // Add price history conditions to additional conditions
        if (priceHistoryConditions.length > 0) {
          if (priceHistoryConditions.length === 1) {
            additionalConditions.push(priceHistoryConditions[0]);
          } else {
            // If both hasDecreased and hasIncreased are true, use $or to allow either condition
            additionalConditions.push({
              $or: priceHistoryConditions
            });
          }
        }
      }

      // Combine all additional conditions with the existing mongoQuery using $and
      if (additionalConditions.length > 0) {
        // If mongoQuery already has conditions, wrap everything in $and
        const existingConditions = Object.keys(mongoQuery).length > 0 ? [mongoQuery] : [];
        
        // Create the final combined query
        if (existingConditions.length > 0 || additionalConditions.length > 1) {
          const allConditions = [...existingConditions, ...additionalConditions];
          // Reset mongoQuery and set it to use $and to combine all conditions
          Object.keys(mongoQuery).forEach(key => delete mongoQuery[key]);
          mongoQuery.$and = allConditions;
        } else if (additionalConditions.length === 1) {
          // If only one additional condition and no existing conditions, use it directly
          Object.assign(mongoQuery, additionalConditions[0]);
        }
      }
    }

    // Build aggregation pipeline
    const aggregationPipeline: any[] = [
      { $match: mongoQuery }
    ];

    // Add statistics aggregations if requested
    if (params.aggregations?.includeStats) {
      aggregationPipeline.push({
        $group: {
          _id: null,
          avgPrice: { $avg: '$currentPrice' },
          minPrice: { $min: '$currentPrice' },
          maxPrice: { $max: '$currentPrice' },
          avgRating: { $avg: '$stars' },
          totalProducts: { $sum: 1 },
          avgDiscount: { $avg: '$discountRate' },
          items: { $push: '$$ROOT' }
        }
      });
      aggregationPipeline.push({
        $unwind: '$items'
      });
      aggregationPipeline.push({
        $replaceRoot: { newRoot: '$items' }
      });
    }

    const hasTextSearch = !!params.query;
    const sortOptions = buildSortOptions(params.sortBy, hasTextSearch);

    // Add sorting and pagination
    aggregationPipeline.push({ $sort: sortOptions });
    
    const skip = (params.page - 1) * params.limit;
    aggregationPipeline.push({ $skip: skip });
    aggregationPipeline.push({ $limit: params.limit });

    // Execute aggregation
    const [products, totalCount] = await Promise.all([
      Product.aggregate(aggregationPipeline),
      Product.countDocuments(mongoQuery)
    ]);

    // Calculate additional statistics if requested
    let statistics = null;
    if (params.aggregations?.includeStats && products.length > 0) {
      statistics = {
        averagePrice: products.reduce((sum, p) => sum + p.currentPrice, 0) / products.length,
        priceRange: {
          min: Math.min(...products.map(p => p.currentPrice)),
          max: Math.max(...products.map(p => p.currentPrice))
        },
        averageRating: products.reduce((sum, p) => sum + (p.stars || 0), 0) / products.length,
        availabilityDistribution: products.reduce((acc, p) => {
          acc[p.availability] = (acc[p.availability] || 0) + 1;
          return acc;
        }, {} as Record<string, number>)
      };
    }

    const pagination = {
      page: params.page,
      limit: params.limit,
      total: totalCount,
      pages: Math.ceil(totalCount / params.limit),
      hasNext: params.page < Math.ceil(totalCount / params.limit),
      hasPrev: params.page > 1
    };

    const responseData = {
      results: products,
      pagination,
      statistics,
      searchInfo: {
        query: params.query,
        advancedFilters: params.filters,
        sorting: params.sortBy,
        totalResults: totalCount,
        responseTime: Date.now()
      }
    };

    return NextResponse.json({
      success: true,
      data: responseData.results,
      pagination: responseData.pagination,
      statistics: responseData.statistics,
      searchInfo: responseData.searchInfo,
      cached: false,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    Sentry.captureException(error);
    console.error('Error in advanced product search:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Internal server error during advanced search',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}