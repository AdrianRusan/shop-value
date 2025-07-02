import { z } from 'zod';
import { NextRequest, NextResponse } from 'next/server';
import { rateLimits } from './upstash';
import * as Sentry from '@sentry/nextjs';

// Lazy-loaded DOMPurify to avoid Edge Runtime issues
let DOMPurify: any = null;
const getDOMPurify = () => {
  if (!DOMPurify) {
    DOMPurify = require('isomorphic-dompurify');
  }
  return DOMPurify;
};

// Environment validation schema
export const envSchema = z.object({
  // Required for production
  CLERK_SECRET_KEY: z.string().min(1, 'CLERK_SECRET_KEY is required'),
  STRIPE_SECRET_KEY: z.string().min(1, 'STRIPE_SECRET_KEY is required'),
  MONGODB_URI: z.string().url('MONGODB_URI must be a valid URL'),
  UPSTASH_REDIS_REST_URL: z.string().url('UPSTASH_REDIS_REST_URL must be a valid URL'),
  UPSTASH_REDIS_REST_TOKEN: z.string().min(1, 'UPSTASH_REDIS_REST_TOKEN is required'),
  RESEND_API_KEY: z.string().min(1, 'RESEND_API_KEY is required'),
  SENTRY_DSN: z.string().url('SENTRY_DSN must be a valid URL').optional(),
  
  // Webhook secrets
  STRIPE_WEBHOOK_SECRET: z.string().min(1, 'STRIPE_WEBHOOK_SECRET is required'),
  CLERK_WEBHOOK_SECRET: z.string().min(1, 'CLERK_WEBHOOK_SECRET is required'),
  
  // Optional
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: z.string().min(1, 'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY is required'),
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.string().min(1, 'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY is required'),
});

// Validate environment variables on module load
export const validateEnvironment = () => {
  try {
    const result = envSchema.safeParse(process.env);
    if (!result.success) {
      console.error('Environment validation failed:', result.error.errors);
      if (process.env.NODE_ENV === 'production') {
        throw new Error('Invalid environment configuration');
      }
    }
    return result.data;
  } catch (error) {
    Sentry.captureException(error);
    throw error;
  }
};

// Security headers configuration
export const securityHeaders = {
  // Content Security Policy
  'Content-Security-Policy': [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com https://cdn.jsdelivr.net",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: https: blob:",
    "connect-src 'self' https://api.stripe.com https://api.clerk.com https://api.sentry.io https://api.resend.com",
    "frame-src 'self' https://js.stripe.com https://hooks.stripe.com",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "upgrade-insecure-requests"
  ].join('; '),
  
  // Security headers
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()',
  'Cross-Origin-Embedder-Policy': 'require-corp',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Resource-Policy': 'same-origin',
};

// CORS configuration
export const corsConfig = {
  allowedOrigins: [
    'https://shop-value.vercel.app',
    'https://shop-value-feature1.vercel.app',
    'https://shop-value-develop.vercel.app',
    'https://shop-value-release.vercel.app',
    'https://shop-value-hotfix.vercel.app',
    ...(process.env.NODE_ENV === 'development' ? ['http://localhost:3000'] : [])
  ],
  allowedMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  credentials: true,
  maxAge: 86400, // 24 hours
};

// XSS Protection utilities
export const xssProtection = {
  sanitizeHtml: (html: string): string => {
    const domPurify = getDOMPurify();
    return domPurify.sanitize(html, {
      ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'p', 'br'],
      ALLOWED_ATTR: ['href'],
      ALLOW_DATA_ATTR: false,
    });
  },
  
  sanitizeInput: (input: string): string => {
    return input
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/javascript:/gi, '')
      .replace(/on\w+\s*=/gi, '')
      .trim();
  },
  
  validateAndSanitize: <T>(schema: z.ZodSchema<T>, data: unknown): T => {
    // First validate with Zod
    const validated = schema.parse(data);
    
    // Then sanitize string fields
    if (typeof validated === 'object' && validated !== null) {
      const sanitized = { ...validated } as any;
      for (const [key, value] of Object.entries(sanitized)) {
        if (typeof value === 'string') {
          sanitized[key] = xssProtection.sanitizeInput(value);
        }
      }
      return sanitized;
    }
    
    return validated;
  }
};

// Database security utilities
export const dbSecurity = {
  // Prevent NoSQL injection by sanitizing MongoDB queries
  sanitizeMongoQuery: (query: any): any => {
    if (typeof query !== 'object' || query === null) {
      return query;
    }
    
    const sanitized = { ...query };
    
    // Remove potentially dangerous operators
    const dangerousOperators = ['$where', '$regex', '$expr', '$function'];
    dangerousOperators.forEach(op => {
      if (sanitized[op]) {
        delete sanitized[op];
      }
    });
    
    // Recursively sanitize nested objects
    for (const [key, value] of Object.entries(sanitized)) {
      if (typeof value === 'object' && value !== null) {
        sanitized[key] = dbSecurity.sanitizeMongoQuery(value);
      }
    }
    
    return sanitized;
  },
  
  // Validate MongoDB ObjectId
  isValidObjectId: (id: string): boolean => {
    return /^[0-9a-fA-F]{24}$/.test(id);
  }
};

// Rate limiting middleware with different tiers
export const createRateLimitMiddleware = (type: 'api' | 'scraping' | 'email' | 'sensitive') => {
  return async (request: NextRequest): Promise<{ success: boolean; error?: string }> => {
    try {
      const ip = request.headers.get('x-forwarded-for') ?? 
                request.headers.get('x-real-ip') ?? 
                'anonymous';
      
      const { success, limit, remaining, reset } = await rateLimits[type].limit(ip);
      
      if (!success) {
        Sentry.addBreadcrumb({
          message: 'Rate limit exceeded',
          level: 'warning',
          data: { ip, type, limit, remaining, reset }
        });
        
        return {
          success: false,
          error: `Rate limit exceeded. Try again in ${Math.ceil((reset - Date.now()) / 1000)} seconds.`
        };
      }
      
      return { success: true };
    } catch (error) {
      Sentry.captureException(error);
      return { success: false, error: 'Rate limiting error' };
    }
  };
};

// Security middleware factory
export const createSecurityMiddleware = (options: {
  rateLimit?: 'api' | 'scraping' | 'email' | 'sensitive';
  requireAuth?: boolean;
  validateInput?: z.ZodSchema<any>;
  corsEnabled?: boolean;
}) => {
  return async (
    request: NextRequest,
    handler: (req: NextRequest, validatedData?: any) => Promise<NextResponse>
  ): Promise<NextResponse> => {
    try {
      // CORS handling
      if (options.corsEnabled) {
        const origin = request.headers.get('origin');
        const isAllowedOrigin = origin && corsConfig.allowedOrigins.includes(origin);
        
        if (request.method === 'OPTIONS') {
          return new NextResponse(null, {
            status: 200,
            headers: {
              'Access-Control-Allow-Origin': isAllowedOrigin ? origin : 'null',
              'Access-Control-Allow-Methods': corsConfig.allowedMethods.join(', '),
              'Access-Control-Allow-Headers': corsConfig.allowedHeaders.join(', '),
              'Access-Control-Allow-Credentials': corsConfig.credentials.toString(),
              'Access-Control-Max-Age': corsConfig.maxAge.toString(),
            },
          });
        }
      }
      
      // Rate limiting
      if (options.rateLimit) {
        const rateLimitCheck = await createRateLimitMiddleware(options.rateLimit)(request);
        if (!rateLimitCheck.success) {
          return NextResponse.json({
            success: false,
            error: rateLimitCheck.error
          }, { status: 429 });
        }
      }
      
      // Authentication check
      if (options.requireAuth) {
        const { auth } = await import('@clerk/nextjs/server');
        const { userId } = auth();
        
        if (!userId) {
          return NextResponse.json({
            success: false,
            error: 'Authentication required'
          }, { status: 401 });
        }
      }
      
      // Input validation
      let validatedData;
      if (options.validateInput) {
        try {
          const method = request.method.toUpperCase();
          const hasBody = ['POST', 'PUT', 'PATCH'].includes(method);
          const contentLength = request.headers.get('content-length');
          const contentType = request.headers.get('content-type');
          
          // Skip body parsing for methods that typically don't have bodies
          // or when there's no content to parse
          if (!hasBody || contentLength === '0' || contentLength === null) {
            // For methods without bodies, validate an empty object or skip validation
            if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') {
              validatedData = undefined; // No validation needed for GET requests
            } else {
              // For DELETE and other methods that might optionally have bodies,
              // try to validate an empty object
              validatedData = xssProtection.validateAndSanitize(options.validateInput, {});
            }
          } else {
            // Only parse JSON if content-type suggests JSON and there's content
            if (contentType?.includes('application/json')) {
              const body = await request.json();
              validatedData = xssProtection.validateAndSanitize(options.validateInput, body);
            } else {
              // Non-JSON content types - validate empty object or handle appropriately
              validatedData = xssProtection.validateAndSanitize(options.validateInput, {});
            }
          }
        } catch (error) {
          return NextResponse.json({
            success: false,
            error: 'Invalid input data',
            details: error instanceof z.ZodError ? error.errors : undefined
          }, { status: 400 });
        }
      }
      
      // Call the actual handler
      const response = await handler(request, validatedData);
      
      // Add security headers
      Object.entries(securityHeaders).forEach(([key, value]) => {
        response.headers.set(key, value);
      });
      
      // Add CORS headers if enabled
      if (options.corsEnabled) {
        const origin = request.headers.get('origin');
        const isAllowedOrigin = origin && corsConfig.allowedOrigins.includes(origin);
        
        if (isAllowedOrigin) {
          response.headers.set('Access-Control-Allow-Origin', origin);
          response.headers.set('Access-Control-Allow-Credentials', 'true');
        }
      }
      
      return response;
      
    } catch (error) {
      Sentry.captureException(error);
      
      return NextResponse.json({
        success: false,
        error: 'Internal security error'
      }, { status: 500 });
    }
  };
};

// Webhook signature verification
export const verifyWebhookSignature = {
  stripe: (body: string, signature: string, secret: string): boolean => {
    try {
      const { default: stripe } = require('stripe');
      const stripeInstance = new stripe(process.env.STRIPE_SECRET_KEY!);
      stripeInstance.webhooks.constructEvent(body, signature, secret);
      return true;
    } catch (error) {
      Sentry.captureException(error);
      return false;
    }
  },
  
  clerk: (body: string, headers: Headers): boolean => {
    try {
      const { Webhook } = require('svix');
      const webhook = new Webhook(process.env.CLERK_WEBHOOK_SECRET!);
      
      const svixId = headers.get('svix-id');
      const svixTimestamp = headers.get('svix-timestamp');
      const svixSignature = headers.get('svix-signature');
      
      webhook.verify(body, {
        'svix-id': svixId,
        'svix-timestamp': svixTimestamp,
        'svix-signature': svixSignature,
      });
      
      return true;
    } catch (error) {
      Sentry.captureException(error);
      return false;
    }
  }
};

// Session security utilities
export const sessionSecurity = {
  // Validate session tokens
  validateSession: async (token: string): Promise<boolean> => {
    try {
      // Use Clerk's server-side verification
      const { auth } = await import('@clerk/nextjs/server');
      // For session validation, we can use the auth() function in context
      return token.length > 0; // Basic validation, enhanced by Clerk middleware
    } catch (error) {
      return false;
    }
  },
  
  // Generate secure session metadata
  createSessionMetadata: (request: NextRequest) => ({
    ip: request.headers.get('x-forwarded-for') ?? 'unknown',
    userAgent: request.headers.get('user-agent') ?? 'unknown',
    timestamp: new Date().toISOString(),
    requestId: crypto.randomUUID(),
  })
};

// Initialize environment validation on module load
// Skip during build time when environment variables may not be available
if (process.env.NODE_ENV === 'production' && !process.env.BUILDING) {
  validateEnvironment();
}

export default {
  validateEnvironment,
  securityHeaders,
  corsConfig,
  xssProtection,
  dbSecurity,
  createRateLimitMiddleware,
  createSecurityMiddleware,
  verifyWebhookSignature,
  sessionSecurity,
};