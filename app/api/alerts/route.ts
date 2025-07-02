import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { z } from 'zod';
import * as Sentry from '@sentry/nextjs';

// Request validation schemas
const createAlertSchema = z.object({
  productId: z.string().min(1, 'Product ID is required'),
  alertType: z.enum(['target_price', 'percentage_drop', 'significant_drop', 'back_in_stock', 'any_drop']),
  targetPrice: z.number().positive().optional(),
  percentageThreshold: z.number().min(1).max(90).optional(),
  significantDropAmount: z.number().positive().optional(),
  frequency: z.enum(['immediate', 'daily', 'weekly']).default('immediate'),
  maxAlertsPerDay: z.number().min(1).max(50).default(5),
});

const updateAlertSchema = createAlertSchema.partial().extend({
  isActive: z.boolean().optional(),
  isPaused: z.boolean().optional(),
});

const alertQuerySchema = z.object({
  productId: z.string().optional(),
  isActive: z.boolean().optional(),
  limit: z.number().min(1).max(100).default(50),
  offset: z.number().min(0).default(0),
});

export async function GET(request: NextRequest) {
  try {
    const { userId } = auth();
    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Rate limiting
    const rateLimitResult = await checkRateLimit(request, userId);
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { success: false, error: 'Rate limit exceeded' },
        { status: 429 }
      );
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const queryValidation = alertQuerySchema.safeParse({
      productId: searchParams.get('productId'),
      isActive: searchParams.get('isActive') === 'true' ? true : 
                searchParams.get('isActive') === 'false' ? false : undefined,
      limit: parseInt(searchParams.get('limit') || '50'),
      offset: parseInt(searchParams.get('offset') || '0'),
    });

    if (!queryValidation.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid query parameters', details: queryValidation.error.errors },
        { status: 400 }
      );
    }

    const { productId, isActive, limit, offset } = queryValidation.data;

    // Get user alerts
    const { alerts, total } = await getUserAlerts(userId, {
      productId,
      isActive,
      limit,
      offset,
    });

    return NextResponse.json({
      success: true,
      data: {
        alerts,
        pagination: {
          total,
          limit,
          offset,
          hasMore: offset + limit < total
        }
      }
    });

  } catch (error) {
    console.error('Error fetching alerts:', error);
    Sentry.captureException(error);
    
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = auth();
    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Rate limiting
    const rateLimitResult = await checkRateLimit(request, userId);
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { success: false, error: 'Rate limit exceeded' },
        { status: 429 }
      );
    }

    // Validate request body
    const body = await request.json();
    const validation = createAlertSchema.safeParse(body);
    
    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid request data', details: validation.error.errors },
        { status: 400 }
      );
    }

    const alertData = validation.data;

    // Check if user can create price alerts (subscription feature)
    const featureCheck = await checkAlertFeatureAccess(userId);
    if (!featureCheck.allowed) {
      return NextResponse.json(
        { success: false, error: featureCheck.reason },
        { status: 403 }
      );
    }

    // Check if product exists and get product info
    const product = await getProduct(alertData.productId);
    if (!product) {
      return NextResponse.json(
        { success: false, error: 'Product not found' },
        { status: 404 }
      );
    }

    // Get user information
    const user = await getUser(userId);
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }

    // Check if user already has an alert for this product
    const existingAlert = await findExistingAlert(userId, alertData.productId);
    if (existingAlert) {
      return NextResponse.json(
        { success: false, error: 'Alert already exists for this product' },
        { status: 409 }
      );
    }

    // Create the alert
    const alert = await createAlert({
      userId,
      email: user.email,
      ...alertData,
    });

    // Track analytics
    await trackAlertCreation(userId, alertData);

    return NextResponse.json({
      success: true,
      data: alert,
      message: 'Price alert created successfully'
    }, { status: 201 });

  } catch (error) {
    console.error('Error creating alert:', error);
    Sentry.captureException(error);
    
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Helper functions
async function checkRateLimit(request: NextRequest, userId: string) {
  try {
    const { rateLimits } = await import('@/lib/upstash');
    if (rateLimits?.api) {
      const ip = request.headers.get('x-forwarded-for') ?? userId;
      const { success } = await rateLimits.api.limit(ip);
      return { success };
    }
    return { success: true };
  } catch (error) {
    console.warn('Rate limiting not available:', error);
    return { success: true };
  }
}

async function checkAlertFeatureAccess(userId: string) {
  try {
    const { checkFeatureAccess } = await import('@/lib/subscription-utils');
    return await checkFeatureAccess(userId, 'price_alerts');
  } catch (error) {
    console.error('Error checking feature access:', error);
    return { allowed: true }; // Allow by default if check fails
  }
}

async function getUserAlerts(userId: string, filters: {
  productId?: string;
  isActive?: boolean;
  limit: number;
  offset: number;
}) {
  try {
    const [mongoose, alertModel] = await Promise.all([
      import('@/lib/mongoose'),
      import('@/lib/models/price-alert.model')
    ]);
    
    await mongoose.connectToDB();
    
    const query: any = { userId };
    if (filters.productId) query.productId = filters.productId;
    if (filters.isActive !== undefined) query.isActive = filters.isActive;
    
    const [alerts, total] = await Promise.all([
      alertModel.default.find(query)
        .populate('productId', 'title brand currentPrice url image')
        .sort({ createdAt: -1 })
        .limit(filters.limit)
        .skip(filters.offset)
        .lean(),
      alertModel.default.countDocuments(query)
    ]);
    
    return { alerts, total };
  } catch (error) {
    console.error('Error fetching user alerts:', error);
    return { alerts: [], total: 0 };
  }
}

async function getProduct(productId: string) {
  try {
    const [mongoose, productModel] = await Promise.all([
      import('@/lib/mongoose'),
      import('@/lib/models/product.model')
    ]);
    
    await mongoose.connectToDB();
    return await productModel.default.findById(productId).lean();
  } catch (error) {
    console.error('Error fetching product:', error);
    return null;
  }
}

async function getUser(userId: string) {
  try {
    const [mongoose, userModel] = await Promise.all([
      import('@/lib/mongoose'),
      import('@/lib/models/user.model')
    ]);
    
    await mongoose.connectToDB();
    const user = await userModel.default.findOne({ clerkId: userId }).lean();
    return user ? {
      email: (user as any).email,
      firstName: (user as any).firstName || ''
    } : null;
  } catch (error) {
    console.error('Error fetching user:', error);
    return null;
  }
}

async function findExistingAlert(userId: string, productId: string) {
  try {
    const [mongoose, alertModel] = await Promise.all([
      import('@/lib/mongoose'),
      import('@/lib/models/price-alert.model')
    ]);
    
    await mongoose.connectToDB();
    return await alertModel.default.findOne({ userId, productId }).lean();
  } catch (error) {
    console.error('Error checking existing alert:', error);
    return null;
  }
}

async function createAlert(alertData: any) {
  try {
    const [mongoose, alertModel] = await Promise.all([
      import('@/lib/mongoose'),
      import('@/lib/models/price-alert.model')
    ]);
    
    await mongoose.connectToDB();
    const alert = new alertModel.default(alertData);
    await alert.save();
    return alert;
  } catch (error) {
    console.error('Error creating alert:', error);
    throw error;
  }
}

async function trackAlertCreation(userId: string, alertData: any) {
  try {
    const { trackBusinessMetric } = await import('@/lib/analytics');
    await trackBusinessMetric('price_alert_created', 1, {
      user_id: userId,
      alert_type: alertData.alertType,
      frequency: alertData.frequency,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.warn('Analytics tracking failed:', error);
  }
}