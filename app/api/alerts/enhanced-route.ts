import { NextRequest } from 'next/server';
import { z } from 'zod';
import { FilterQuery } from 'mongoose';
import { 
  createAPIHandler,
  commonSchemas,
  createPagination,
  API_ERROR_CODES,
  createAPIError,
  createMethodNotAllowedHandler,
} from '@/lib/api-framework';
import User from '@/lib/models/user.model';
import Alert, { IAlert } from '@/lib/models/alert.model';

// Helper function to safely extract alert ID from URL path
function extractAlertIdFromPath(path: string): string | undefined {
  try {
    // Safely construct a URL with a base to handle relative paths
    const url = new URL(path, 'http://localhost');
    
    // Validate that url.pathname exists
    if (!url.pathname) {
      console.warn(`[extractAlertIdFromPath] URL pathname is missing for path: ${path}`);
      return undefined;
    }
    
    const pathSegments = url.pathname.split('/').filter(segment => segment.length > 0);
    
    // Get the last path segment (alert ID)
    const rawAlertId = pathSegments.length > 0 ? pathSegments[pathSegments.length - 1] : undefined;
    
    if (!rawAlertId) {
      console.warn(`[extractAlertIdFromPath] No path segments found for path: ${path}`);
      return undefined;
    }
    
    // Decode the alert ID to handle URL-encoded characters
    let alertId: string;
    try {
      alertId = decodeURIComponent(rawAlertId);
    } catch (decodeError) {
      console.warn(`[extractAlertIdFromPath] Failed to decode URI component "${rawAlertId}" for path: ${path}`, decodeError);
      return undefined;
    }
    
    // Validate that alertId is a non-empty string after trimming
    const trimmedAlertId = alertId.trim();
    if (!trimmedAlertId) {
      console.warn(`[extractAlertIdFromPath] Alert ID is empty after trimming for path: ${path}`);
      return undefined;
    }
    
    return trimmedAlertId;
  } catch (error) {
    // Log the original path for debugging and return undefined if URL construction fails
    console.error(`[extractAlertIdFromPath] Failed to parse URL from path: ${path}`, error);
    return undefined;
  }
}

// Enhanced validation schemas using the standardized framework
const alertQuerySchema = z.object({
  ...commonSchemas.pagination.shape,
  productId: z.string().min(1).max(50).optional(),
  isActive: z.boolean().optional(),
  type: z.enum(['price_drop', 'back_in_stock', 'price_threshold']).optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
}).strict();

const createAlertSchema = z.object({
  productId: z.string().min(1).max(50),
  type: z.enum(['price_drop', 'back_in_stock', 'price_threshold']),
  threshold: z.number().min(0).optional(),
  isActive: z.boolean().default(true),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
  notificationMethods: z.array(z.enum(['email', 'push', 'sms'])).default(['email']),
}).strict();

const updateAlertSchema = z.object({
  threshold: z.number().min(0).optional(),
  isActive: z.boolean().optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
  notificationMethods: z.array(z.enum(['email', 'push', 'sms'])).optional(),
}).strict();

// Business logic functions
async function getUserAlerts(
  userId: string,
  filters: z.infer<typeof alertQuerySchema>
) {
  const query: FilterQuery<IAlert> = { userId };

  // Apply filters
  if (filters.productId) {
    query.productId = filters.productId;
  }
  
  if (filters.isActive !== undefined) {
    query.isActive = filters.isActive;
  }
  
  if (filters.type) {
    query.type = filters.type;
  }
  
  if (filters.priority) {
    query.priority = filters.priority;
  }

  // Date range filters
  if (filters.startDate || filters.endDate) {
    query.createdAt = {};
    if (filters.startDate) {
      query.createdAt.$gte = new Date(filters.startDate);
    }
    if (filters.endDate) {
      query.createdAt.$lte = new Date(filters.endDate);
    }
  }

  // Execute query with pagination
  const skip = (filters.page - 1) * filters.limit;
  
  const [alerts, total] = await Promise.all([
    Alert.find(query)
      .sort({ [filters.sortBy]: filters.sort === 'asc' ? 1 : -1 })
      .skip(skip)
      .limit(filters.limit)
      .populate('productId', 'title imageUrl currentPrice source')
      .lean(),
    Alert.countDocuments(query),
  ]);

  return {
    alerts,
    pagination: createPagination(filters.page, filters.limit, total),
  };
}

async function createAlert(userId: string, alertData: z.infer<typeof createAlertSchema>) {
  // Check if user exists and has permission
  const user = await User.findOne({ clerkId: userId });
  if (!user) {
    throw new Error('User not found');
  }

  // Check subscription limits
  const userAlerts = await Alert.countDocuments({ userId });
  const maxAlerts = user.subscription?.plan === 'free' ? 5 : 
                   user.subscription?.plan === 'pro' ? 50 : 
                   Number.MAX_SAFE_INTEGER;

  if (userAlerts >= maxAlerts) {
    throw new Error(`Alert limit reached. Your plan allows ${maxAlerts} alerts.`);
  }

  // Check if alert already exists
  const existingAlert = await Alert.findOne({
    userId,
    productId: alertData.productId,
    type: alertData.type,
    isActive: true,
  });

  if (existingAlert) {
    throw new Error('Active alert already exists for this product and type');
  }

  // Create new alert
  const alert = new Alert({
    ...alertData,
    userId,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  await alert.save();
  
  // Populate product data for response
  await alert.populate('productId', 'title imageUrl currentPrice source');
  
  return alert;
}

async function updateAlert(
  userId: string, 
  alertId: string, 
  updateData: z.infer<typeof updateAlertSchema>
) {
  const alert = await Alert.findOne({ _id: alertId, userId });
  
  if (!alert) {
    throw new Error('Alert not found');
  }

  // Update fields
  Object.assign(alert, updateData, { updatedAt: new Date() });
  
  await alert.save();
  await alert.populate('productId', 'title imageUrl currentPrice source');
  
  return alert;
}

async function deleteAlert(userId: string, alertId: string) {
  const result = await Alert.deleteOne({ _id: alertId, userId });
  
  if (result.deletedCount === 0) {
    throw new Error('Alert not found');
  }
  
  return { success: true };
}

// GET /api/alerts - List user alerts
export const GET = createAPIHandler({
  requireAuth: true,
  validateQuery: alertQuerySchema,
  rateLimitType: 'general',
})(async (context) => {
  const { userId, validatedQuery } = context;
  
  try {
    const result = await getUserAlerts(userId!, validatedQuery);
    
    return {
      alerts: result.alerts,
      pagination: result.pagination,
      meta: {
        totalActiveAlerts: result.alerts.filter(a => a.isActive).length,
        totalInactiveAlerts: result.alerts.filter(a => !a.isActive).length,
      },
    };
  } catch (error) {
    throw new Error(`Failed to fetch alerts: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
});

// POST /api/alerts - Create new alert
export const POST = createAPIHandler({
  requireAuth: true,
  validateRequest: createAlertSchema,
  rateLimitType: 'general',
})(async (context) => {
  const { userId, validatedData } = context;
  
  try {
    const alert = await createAlert(userId!, validatedData);
    
    return {
      alert,
      message: 'Alert created successfully',
    };
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('limit reached')) {
        const { response, statusCode } = createAPIError(
          'QUOTA_EXCEEDED',
          error.message,
          { requestId: context.requestId }
        );
        throw { response, statusCode };
      }
      
      if (error.message.includes('already exists')) {
        const { response, statusCode } = createAPIError(
          'RESOURCE_ALREADY_EXISTS',
          error.message,
          { requestId: context.requestId }
        );
        throw { response, statusCode };
      }
    }
    
    throw new Error(`Failed to create alert: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
});

// PUT /api/alerts/[id] - Update alert
export const PUT = createAPIHandler({
  requireAuth: true,
  validateRequest: updateAlertSchema,
  rateLimitType: 'general',
})(async (context) => {
  const { userId, validatedData } = context;
  
  // Extract alertId from URL (in a real implementation, this would come from route params)
  const alertId = extractAlertIdFromPath(context.path);
  
  if (!alertId) {
    console.warn(`[PUT /api/alerts] Failed to extract alert ID from path: ${context.path}`);
    const { response, statusCode } = createAPIError(
      'INVALID_REQUEST',
      'Invalid or missing alert ID in URL path',
      { 
        requestId: context.requestId,
        details: { path: context.path }
      }
    );
    throw { response, statusCode };
  }
  
  try {
    const alert = await updateAlert(userId!, alertId, validatedData);
    
    return {
      alert,
      message: 'Alert updated successfully',
    };
  } catch (error) {
    if (error instanceof Error && error.message.includes('not found')) {
      const { response, statusCode } = createAPIError(
        'RESOURCE_NOT_FOUND',
        'Alert not found',
        { requestId: context.requestId }
      );
      throw { response, statusCode };
    }
    
    throw new Error(`Failed to update alert: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
});

// DELETE /api/alerts/[id] - Delete alert
export const DELETE = createAPIHandler({
  requireAuth: true,
  rateLimitType: 'general',
})(async (context) => {
  const { userId } = context;
  
  // Extract alertId from URL
  const alertId = extractAlertIdFromPath(context.path);
  
  if (!alertId) {
    console.warn(`[DELETE /api/alerts] Failed to extract alert ID from path: ${context.path}`);
    const { response, statusCode } = createAPIError(
      'INVALID_REQUEST',
      'Invalid or missing alert ID in URL path',
      { 
        requestId: context.requestId,
        details: { path: context.path }
      }
    );
    throw { response, statusCode };
  }
  
  try {
    await deleteAlert(userId!, alertId);
    
    return {
      message: 'Alert deleted successfully',
    };
  } catch (error) {
    if (error instanceof Error && error.message.includes('not found')) {
      const { response, statusCode } = createAPIError(
        'RESOURCE_NOT_FOUND',
        'Alert not found',
        { requestId: context.requestId }
      );
      throw { response, statusCode };
    }
    
    throw new Error(`Failed to delete alert: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
});

// Handle unsupported methods
export const PATCH = createMethodNotAllowedHandler(['GET', 'POST', 'PUT', 'DELETE']);
export const HEAD = createMethodNotAllowedHandler(['GET', 'POST', 'PUT', 'DELETE']);
export const OPTIONS = createMethodNotAllowedHandler(['GET', 'POST', 'PUT', 'DELETE']); 