import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { z } from 'zod';
import * as Sentry from '@sentry/nextjs';
import { Ratelimit } from '@upstash/ratelimit';
import { redis } from './upstash';
import { performance } from 'perf_hooks';

// Cache User model import for performance optimization
let cachedUserModel: any = null;
const getUserModel = async () => {
  if (!cachedUserModel) {
    cachedUserModel = (await import('./models/user.model')).default;
  }
  return cachedUserModel;
};

// Standard API Response Types
export interface APISuccessResponse<T = any> {
  success: true;
  data: T;
  message?: string;
  meta?: {
    timestamp: string;
    requestId: string;
    version: string;
    pagination?: PaginationMeta;
    performance?: PerformanceMeta;
  };
}

export interface APIErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: any;
    field?: string;
  };
  meta?: {
    timestamp: string;
    requestId: string;
    version: string;
  };
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface PerformanceMeta {
  responseTime: number;
  dbQueries?: number;
  cacheHits?: number;
}

export type APIResponse<T = any> = APISuccessResponse<T> | APIErrorResponse;

// Standard Error Codes
export const API_ERROR_CODES = {
  // Authentication & Authorization
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  INVALID_TOKEN: 'INVALID_TOKEN',
  
  // Validation
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  INVALID_REQUEST: 'INVALID_REQUEST',
  REQUIRED_FIELD_MISSING: 'REQUIRED_FIELD_MISSING',
  INVALID_FORMAT: 'INVALID_FORMAT',
  
  // Resource Management
  RESOURCE_NOT_FOUND: 'RESOURCE_NOT_FOUND',
  RESOURCE_ALREADY_EXISTS: 'RESOURCE_ALREADY_EXISTS',
  RESOURCE_CONFLICT: 'RESOURCE_CONFLICT',
  
  // Rate Limiting
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  TOO_MANY_REQUESTS: 'TOO_MANY_REQUESTS',
  
  // Server Errors
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
  DATABASE_ERROR: 'DATABASE_ERROR',
  EXTERNAL_SERVICE_ERROR: 'EXTERNAL_SERVICE_ERROR',
  
  // Business Logic
  SUBSCRIPTION_REQUIRED: 'SUBSCRIPTION_REQUIRED',
  INSUFFICIENT_PERMISSIONS: 'INSUFFICIENT_PERMISSIONS',
  QUOTA_EXCEEDED: 'QUOTA_EXCEEDED',
  OPERATION_NOT_ALLOWED: 'OPERATION_NOT_ALLOWED',
  
  // Method & Route
  METHOD_NOT_ALLOWED: 'METHOD_NOT_ALLOWED',
  ROUTE_NOT_FOUND: 'ROUTE_NOT_FOUND',
} as const;

// Rate Limiting Configurations
export const RATE_LIMITS = {
  // General API limits
  general: {
    requests: 100,
    window: '5 m',
  },
  
  // Stricter limits for sensitive operations
  auth: {
    requests: 10,
    window: '5 m',
  },
  
  // Payment operations
  payment: {
    requests: 5,
    window: '5 m',
  },
  
  // Search operations
  search: {
    requests: 50,
    window: '1 m',
  },
  
  // Admin operations
  admin: {
    requests: 200,
    window: '1 m',
  },
} as const;

// Request Context Interface
export interface RequestContext {
  userId?: string;
  userRole?: string;
  ip: string;
  userAgent: string;
  requestId: string;
  startTime: number;
  method: string;
  path: string;
}

// API Handler Configuration
export interface APIHandlerConfig {
  rateLimitType?: keyof typeof RATE_LIMITS;
  requireAuth?: boolean;
  requiredRole?: string[];
  validateRequest?: z.ZodSchema;
  validateQuery?: z.ZodSchema;
  enableCaching?: boolean;
  cacheDuration?: number;
}

// Create standardized API response
export function createAPIResponse<T = any>(
  data: T,
  options: {
    message?: string;
    meta?: Partial<APISuccessResponse<T>['meta']>;
    requestId: string;
  }
): APISuccessResponse<T> {
  return {
    success: true,
    data,
    message: options.message,
    meta: {
      timestamp: new Date().toISOString(),
      requestId: options.requestId,
      version: process.env.API_VERSION || 'v1',
      ...options.meta,
    },
  };
}

// Create standardized error response
export function createAPIError(
  code: keyof typeof API_ERROR_CODES,
  message: string,
  options: {
    details?: any;
    field?: string;
    requestId: string;
    statusCode?: number;
  }
): { response: APIErrorResponse; statusCode: number } {
  const statusCodes: Record<string, number> = {
    [API_ERROR_CODES.UNAUTHORIZED]: 401,
    [API_ERROR_CODES.FORBIDDEN]: 403,
    [API_ERROR_CODES.TOKEN_EXPIRED]: 401,
    [API_ERROR_CODES.INVALID_TOKEN]: 401,
    [API_ERROR_CODES.VALIDATION_FAILED]: 400,
    [API_ERROR_CODES.INVALID_REQUEST]: 400,
    [API_ERROR_CODES.REQUIRED_FIELD_MISSING]: 400,
    [API_ERROR_CODES.INVALID_FORMAT]: 400,
    [API_ERROR_CODES.RESOURCE_NOT_FOUND]: 404,
    [API_ERROR_CODES.RESOURCE_ALREADY_EXISTS]: 409,
    [API_ERROR_CODES.RESOURCE_CONFLICT]: 409,
    [API_ERROR_CODES.RATE_LIMIT_EXCEEDED]: 429,
    [API_ERROR_CODES.TOO_MANY_REQUESTS]: 429,
    [API_ERROR_CODES.INTERNAL_ERROR]: 500,
    [API_ERROR_CODES.SERVICE_UNAVAILABLE]: 503,
    [API_ERROR_CODES.DATABASE_ERROR]: 500,
    [API_ERROR_CODES.EXTERNAL_SERVICE_ERROR]: 502,
    [API_ERROR_CODES.SUBSCRIPTION_REQUIRED]: 402,
    [API_ERROR_CODES.INSUFFICIENT_PERMISSIONS]: 403,
    [API_ERROR_CODES.QUOTA_EXCEEDED]: 429,
    [API_ERROR_CODES.OPERATION_NOT_ALLOWED]: 403,
    [API_ERROR_CODES.METHOD_NOT_ALLOWED]: 405,
    [API_ERROR_CODES.ROUTE_NOT_FOUND]: 404,
  };

  return {
    response: {
      success: false,
      error: {
        code,
        message,
        details: options.details,
        field: options.field,
      },
      meta: {
        timestamp: new Date().toISOString(),
        requestId: options.requestId,
        version: process.env.API_VERSION || 'v1',
      },
    },
    statusCode: options.statusCode || statusCodes[code] || 500,
  };
}

// Create request context
export function createRequestContext(request: NextRequest): RequestContext {
  const requestId = crypto.randomUUID();
  
  return {
    ip: request.headers.get('x-forwarded-for') || 
        request.headers.get('x-real-ip') || 
        'unknown',
    userAgent: request.headers.get('user-agent') || 'unknown',
    requestId,
    startTime: performance.now(),
    method: request.method,
    path: new URL(request.url).pathname,
  };
}

// Authentication middleware
export async function withAuth(context: RequestContext): Promise<{
  success: boolean;
  userId?: string;
  userRole?: string;
  error?: { response: APIErrorResponse; statusCode: number };
}> {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return {
        success: false,
        error: createAPIError(
          'UNAUTHORIZED',
          'Authentication required',
          { requestId: context.requestId }
        ),
      };
    }

    // Get user role from database (simplified)
    let userRole = 'user';
    try {
      const User = await getUserModel();
      const user = await User.findOne({ clerkId: userId }).select('role');
      if (user?.role) {
        userRole = user.role;
      }
    } catch (error) {
      console.warn('Failed to fetch user role:', error);
    }

    return {
      success: true,
      userId,
      userRole,
    };
  } catch (error) {
    console.error('Auth middleware error:', error);
    return {
      success: false,
      error: createAPIError(
        'INTERNAL_ERROR',
        'Authentication check failed',
        { 
          requestId: context.requestId,
          details: error instanceof Error ? error.message : 'Unknown error',
        }
      ),
    };
  }
}

// Role-based authorization middleware
export function withRole(
  requiredRoles: string[],
  userRole?: string,
  requestId?: string
): {
  success: boolean;
  error?: { response: APIErrorResponse; statusCode: number };
} {
  if (!userRole || !requiredRoles.includes(userRole)) {
    return {
      success: false,
      error: createAPIError(
        'INSUFFICIENT_PERMISSIONS',
        `Required role: ${requiredRoles.join(' or ')}`,
        { requestId: requestId || 'unknown' }
      ),
    };
  }

  return { success: true };
}

// Rate limiting middleware
export async function withRateLimit(
  context: RequestContext,
  limitType: keyof typeof RATE_LIMITS = 'general'
): Promise<{
  success: boolean;
  error?: { response: APIErrorResponse; statusCode: number };
}> {
  try {
    const config = RATE_LIMITS[limitType];
    const identifier = context.userId || context.ip;
    
    const ratelimit = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(config.requests, config.window),
    });

    const { success, remaining, reset } = await ratelimit.limit(
      `${limitType}:${identifier}`
    );

    if (!success) {
      return {
        success: false,
        error: createAPIError(
          'RATE_LIMIT_EXCEEDED',
          `Rate limit exceeded. Try again after ${new Date(reset).toISOString()}`,
          {
            requestId: context.requestId,
            details: {
              limit: config.requests,
              window: config.window,
              remaining,
              resetTime: reset,
            },
          }
        ),
      };
    }

    return { success: true };
  } catch (error) {
    console.error('Rate limit middleware error:', error);
    // Don't fail the request if rate limiting fails
    return { success: true };
  }
}

// Request validation middleware
export async function withValidation<T>(
  request: NextRequest,
  schema: z.ZodSchema<T>,
  context: RequestContext,
  source: 'body' | 'query' = 'body'
): Promise<{
  success: boolean;
  data?: T;
  error?: { response: APIErrorResponse; statusCode: number };
}> {
  try {
    let input: any;
    
    if (source === 'body') {
      const contentType = request.headers.get('content-type') || '';
      
      if (contentType.includes('application/json')) {
        input = await request.json();
      } else if (contentType.includes('application/x-www-form-urlencoded')) {
        const formData = await request.formData();
        input = Object.fromEntries(formData);
      } else {
        input = {};
      }
    } else {
      const { searchParams } = new URL(request.url);
      input = Object.fromEntries(searchParams);
    }

    const result = schema.safeParse(input);
    
    if (!result.success) {
      const firstError = result.error.errors[0];
      
      return {
        success: false,
        error: createAPIError(
          'VALIDATION_FAILED',
          firstError.message,
          {
            requestId: context.requestId,
            field: firstError.path.join('.'),
            details: result.error.errors.map(err => ({
              field: err.path.join('.'),
              message: err.message,
              code: err.code,
            })),
          }
        ),
      };
    }

    return {
      success: true,
      data: result.data,
    };
  } catch (error) {
    console.error('Validation middleware error:', error);
    return {
      success: false,
      error: createAPIError(
        'INVALID_REQUEST',
        'Invalid request format',
        {
          requestId: context.requestId,
          details: error instanceof Error ? error.message : 'Unknown error',
        }
      ),
    };
  }
}

// Comprehensive API handler wrapper
export function createAPIHandler(config: APIHandlerConfig = {}) {
  return function <T = any>(
    handler: (context: RequestContext & {
      userId?: string;
      userRole?: string;
      validatedData?: any;
      validatedQuery?: any;
    }) => Promise<T>
  ) {
    return async function (request: NextRequest): Promise<NextResponse> {
      const context = createRequestContext(request);
      
      try {
        // Rate limiting
        if (config.rateLimitType) {
          const rateLimitResult = await withRateLimit(context, config.rateLimitType);
          if (!rateLimitResult.success && rateLimitResult.error) {
            return NextResponse.json(
              rateLimitResult.error.response,
              { status: rateLimitResult.error.statusCode }
            );
          }
        }

        // Authentication
        let userId: string | undefined;
        let userRole: string | undefined;
        
        if (config.requireAuth) {
          const authResult = await withAuth(context);
          if (!authResult.success && authResult.error) {
            return NextResponse.json(
              authResult.error.response,
              { status: authResult.error.statusCode }
            );
          }
          userId = authResult.userId;
          userRole = authResult.userRole;
        }

        // Role-based authorization
        if (config.requiredRole && config.requireAuth) {
          // If a role is required but userRole is undefined, return unauthorized
          if (!userRole) {
            const { response, statusCode } = createAPIError(
              'FORBIDDEN',
              'User role is required but not found',
              { requestId: context.requestId }
            );
            return NextResponse.json(response, { status: statusCode });
          }
          
          // Only call withRole when we have a defined role
          const roleResult = withRole(config.requiredRole, userRole, context.requestId);
          if (!roleResult.success && roleResult.error) {
            return NextResponse.json(
              roleResult.error.response,
              { status: roleResult.error.statusCode }
            );
          }
        }

        // Request validation
        let validatedData: any;
        if (config.validateRequest) {
          const validationResult = await withValidation(
            request,
            config.validateRequest,
            context,
            'body'
          );
          if (!validationResult.success && validationResult.error) {
            return NextResponse.json(
              validationResult.error.response,
              { status: validationResult.error.statusCode }
            );
          }
          validatedData = validationResult.data;
        }

        // Query validation
        let validatedQuery: any;
        if (config.validateQuery) {
          const queryValidationResult = await withValidation(
            request,
            config.validateQuery,
            context,
            'query'
          );
          if (!queryValidationResult.success && queryValidationResult.error) {
            return NextResponse.json(
              queryValidationResult.error.response,
              { status: queryValidationResult.error.statusCode }
            );
          }
          validatedQuery = queryValidationResult.data;
        }

        // Execute handler
        const result = await handler({
          ...context,
          userId,
          userRole,
          validatedData,
          validatedQuery,
        });

        // Calculate performance metrics
        const responseTime = performance.now() - context.startTime;
        
        // Create standardized response
        const response = createAPIResponse(result, {
          requestId: context.requestId,
          meta: {
            performance: {
              responseTime: Math.round(responseTime),
            },
          },
        });

        // Log successful request
        console.log(`✅ ${context.method} ${context.path} - ${Math.round(responseTime)}ms`);

        // Track analytics
        await trackAPIRequest(context, responseTime, 200);

        return NextResponse.json(response);

      } catch (error) {
        // Calculate error response time
        const responseTime = performance.now() - context.startTime;
        
        // Log error
        console.error(`❌ ${context.method} ${context.path} - Error:`, error);
        
        // Send to Sentry
        Sentry.captureException(error, {
          tags: {
            section: 'api',
            method: context.method,
            path: context.path,
          },
          extra: {
            requestId: context.requestId,
            userId: context.userId,
            ip: context.ip,
            responseTime,
          },
        });

        // Create error response
        const { response, statusCode } = createAPIError(
          'INTERNAL_ERROR',
          'An unexpected error occurred',
          {
            requestId: context.requestId,
            details: process.env.NODE_ENV === 'development' 
              ? error instanceof Error ? error.message : 'Unknown error'
              : undefined,
          }
        );

        // Track error analytics
        await trackAPIRequest(context, responseTime, statusCode);

        return NextResponse.json(response, { status: statusCode });
      }
    };
  };
}

// Analytics tracking
async function trackAPIRequest(
  context: RequestContext,
  responseTime: number,
  statusCode: number
): Promise<void> {
  try {
    // Store metrics in Redis with proper TTL to prevent memory growth
    const date = new Date().toISOString().split('T')[0];
    const hour = new Date().getHours();
    
    const dailyKey = `api:metrics:daily:${date}`;
    const hourlyKey = `api:metrics:hourly:${date}:${hour}`;
    const endpointKey = `api:metrics:endpoint:${context.path}`;
    
    // Use Redis pipeline for atomic operations with TTL
    const pipeline = redis.pipeline();
    
    // Daily metrics (90 days TTL)
    pipeline.hincrby(dailyKey, 'requests', 1);
    pipeline.hincrby(dailyKey, 'response_time', responseTime);
    pipeline.hincrby(dailyKey, `status_${statusCode}`, 1);
    pipeline.expire(dailyKey, 90 * 24 * 60 * 60); // 90 days in seconds
    
    // Hourly metrics (7 days TTL)
    pipeline.hincrby(hourlyKey, 'requests', 1);
    pipeline.hincrby(hourlyKey, 'response_time', responseTime);
    pipeline.expire(hourlyKey, 7 * 24 * 60 * 60); // 7 days in seconds
    
    // Endpoint-specific metrics (90 days TTL)
    pipeline.hincrby(endpointKey, 'requests', 1);
    pipeline.hincrby(endpointKey, 'response_time', responseTime);
    pipeline.expire(endpointKey, 90 * 24 * 60 * 60); // 90 days in seconds
    
    // Execute all operations atomically
    await pipeline.exec();
  } catch (error) {
    console.warn('Failed to track API metrics:', error);
  }
}

// Create method not allowed handler
export function createMethodNotAllowedHandler(allowedMethods: string[]) {
  return function () {
    const { response, statusCode } = createAPIError(
      'METHOD_NOT_ALLOWED',
      `Method not allowed. Allowed methods: ${allowedMethods.join(', ')}`,
      { requestId: crypto.randomUUID() }
    );

    return NextResponse.json(response, { 
      status: statusCode,
      headers: {
        'Allow': allowedMethods.join(', '),
      },
    });
  };
}

// Pagination helper
export function createPagination(
  page: number,
  limit: number,
  total: number
): PaginationMeta {
  const totalPages = Math.ceil(total / limit);
  
  return {
    page,
    limit,
    total,
    totalPages,
    hasNext: page < totalPages,
    hasPrev: page > 1,
  };
}

// Common validation schemas
export const commonSchemas = {
  pagination: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    sort: z.enum(['asc', 'desc']).default('desc'),
    sortBy: z.string().max(50).default('createdAt'),
  }),
  
  search: z.object({
    q: z.string().min(1).max(200),
    category: z.string().optional(),
    filters: z.record(z.string()).optional(),
  }),
  
  id: z.object({
    id: z.string().min(1).max(50),
  }),
};

// Types are already exported above as interfaces 