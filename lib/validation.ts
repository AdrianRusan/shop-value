import { z } from 'zod';
import { NextRequest } from 'next/server';
import crypto from 'crypto';
import * as Sentry from '@sentry/nextjs';

// Lazy-loaded DOMPurify to avoid Edge Runtime issues
let DOMPurify: any = null;
const getDOMPurify = () => {
  if (!DOMPurify && typeof window !== 'undefined') {
    DOMPurify = require('isomorphic-dompurify');
  }
  return DOMPurify;
};

// Enhanced input sanitization with XSS protection
export const sanitizeInput = (input: string): string => {
  if (typeof input !== 'string') return '';
  
  // Remove dangerous patterns
  const sanitized = input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Remove script tags
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/vbscript:/gi, '') // Remove vbscript: protocol
    .replace(/on\w+\s*=/gi, '') // Remove event handlers like onclick=
    .replace(/[\x00-\x1F\x7F-\x9F]/g, '') // Remove control characters
    .trim();
  
  // HTML entity encoding for dangerous characters
  return sanitized.replace(/[<>"'&]/g, (match) => {
    const escapeMap: { [key: string]: string } = {
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#x27;',
      '&': '&amp;'
    };
    return escapeMap[match];
  });
};

// Enhanced URL validation with security checks
const secureUrlSchema = z.string().url().refine((url) => {
  try {
    const parsed = new URL(url);
    
    // Block dangerous protocols
    const dangerousProtocols = ['javascript:', 'vbscript:', 'data:', 'file:'];
    if (dangerousProtocols.some(protocol => parsed.protocol.toLowerCase().startsWith(protocol))) {
      return false;
    }
    
    // Block private/local IP addresses in production
    if (process.env.NODE_ENV === 'production') {
      const hostname = parsed.hostname.toLowerCase();
      
      // Block localhost and private IPs
      if (
        hostname === 'localhost' ||
        hostname.startsWith('127.') ||
        hostname.startsWith('10.') ||
        hostname.startsWith('192.168.') ||
        /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(hostname) ||
        hostname.includes('::1') ||
        hostname.startsWith('fc00:') ||
        hostname.startsWith('fe80:')
      ) {
        return false;
      }
    }
    
    return true;
  } catch {
    return false;
  }
}, 'Invalid or unsafe URL');

// Enhanced string schemas with size limits and sanitization
const secureStringSchema = (minLength = 1, maxLength = 100) => 
  z.string()
    .min(minLength, `String must be at least ${minLength} characters`)
    .max(maxLength, `String must be at most ${maxLength} characters`)
    .transform(sanitizeInput);

const emailSchema = z.string()
  .email('Invalid email format')
  .max(254, 'Email too long')
  .transform(sanitizeInput);

const productIdSchema = z.string()
  .min(1, 'Product ID is required')
  .max(50, 'Product ID too long')
  .regex(/^[a-zA-Z0-9_-]+$/, 'Product ID contains invalid characters')
  .transform(sanitizeInput);

const userIdSchema = z.string()
  .min(1, 'User ID is required')
  .max(100, 'User ID too long')
  .regex(/^[a-zA-Z0-9_-]+$/, 'User ID contains invalid characters')
  .transform(sanitizeInput);

const priceSchema = z.number()
  .positive('Price must be positive')
  .max(999999.99, 'Price too high')
  .refine((val) => Number.isFinite(val), 'Price must be a valid number');

// MongoDB injection prevention
export const sanitizeMongoQuery = (query: any): any => {
  if (typeof query !== 'object' || query === null) {
    return query;
  }
  
  if (Array.isArray(query)) {
    return query.map(sanitizeMongoQuery);
  }
  
  const sanitized: any = {};
  for (const [key, value] of Object.entries(query)) {
    // Block dangerous operators
    if (key.startsWith('$') && !['$eq', '$ne', '$gt', '$gte', '$lt', '$lte', '$in', '$nin', '$exists'].includes(key)) {
      continue; // Skip dangerous operators
    }
    
    if (typeof value === 'string') {
      sanitized[sanitizeInput(key)] = sanitizeInput(value);
    } else if (typeof value === 'object' && value !== null) {
      sanitized[sanitizeInput(key)] = sanitizeMongoQuery(value);
    } else {
      sanitized[sanitizeInput(key)] = value;
    }
  }
  
  return sanitized;
};

// CSRF Token validation
export const csrfTokenSchema = z.string()
  .length(64, 'Invalid CSRF token format')
  .regex(/^[a-f0-9]{64}$/, 'CSRF token must be a valid hex string');

export const validateCSRFToken = (token: string, expectedToken: string): boolean => {
  try {
    csrfTokenSchema.parse(token);
    csrfTokenSchema.parse(expectedToken);
    
    return crypto.timingSafeEqual(
      Buffer.from(token, 'hex'),
      Buffer.from(expectedToken, 'hex')
    );
  } catch {
    return false;
  }
};

// Enhanced product schemas
export const productSchemas = {
  create: z.object({
    title: secureStringSchema(1, 200),
    description: secureStringSchema(1, 2000),
    url: secureUrlSchema,
    currentPrice: priceSchema,
    currency: z.enum(['RON', 'EUR', 'USD']).default('RON'),
    category: secureStringSchema(1, 50),
    brand: secureStringSchema(1, 50).optional(),
    model: secureStringSchema(1, 50).optional(),
    imageUrl: secureUrlSchema.optional(),
    isActive: z.boolean().default(true),
    metadata: z.record(z.any()).optional(),
  }).strict(),
  
  update: z.object({
    title: secureStringSchema(1, 200).optional(),
    description: secureStringSchema(1, 2000).optional(),
    currentPrice: priceSchema.optional(),
    currency: z.enum(['RON', 'EUR', 'USD']).optional(),
    category: secureStringSchema(1, 50).optional(),
    brand: secureStringSchema(1, 50).optional(),
    model: secureStringSchema(1, 50).optional(),
    imageUrl: secureUrlSchema.optional(),
    isActive: z.boolean().optional(),
    metadata: z.record(z.any()).optional(),
  }).strict(),
  
  search: z.object({
    query: secureStringSchema(1, 100).optional(),
    category: secureStringSchema(1, 50).optional(),
    brand: secureStringSchema(1, 50).optional(),
    minPrice: priceSchema.optional(),
    maxPrice: priceSchema.optional(),
    currency: z.enum(['RON', 'EUR', 'USD']).optional(),
    sortBy: z.enum(['price', 'title', 'createdAt', 'updatedAt']).default('createdAt'),
    sortOrder: z.enum(['asc', 'desc']).default('desc'),
    page: z.number().int().positive().max(1000).default(1),
    limit: z.number().int().positive().max(100).default(20),
  }).strict(),
};

// Enhanced user schemas
export const userSchemas = {
  profile: z.object({
    firstName: secureStringSchema(1, 50),
    lastName: secureStringSchema(1, 50),
    email: emailSchema,
    preferences: z.object({
      currency: z.enum(['RON', 'EUR', 'USD']).default('RON'),
      notifications: z.object({
        email: z.boolean().default(true),
        push: z.boolean().default(false),
        frequency: z.enum(['immediate', 'hourly', 'daily']).default('immediate'),
      }),
      privacy: z.object({
        analytics: z.boolean().default(true),
        marketing: z.boolean().default(false),
      }),
    }).strict(),
  }).strict(),
  
  tracking: z.object({
    productId: productIdSchema,
    alertThreshold: priceSchema.optional(),
    alertType: z.enum(['price_drop', 'price_increase', 'availability']).default('price_drop'),
  }).strict(),
};

// WebSocket event validation schemas
export const socketEventSchemas = {
  joinUserRoom: z.object({
    userId: userIdSchema,
  }).strict(),
  
  subscribeProduct: z.object({
    productId: productIdSchema,
  }).strict(),
  
  priceUpdate: z.object({
    productId: productIdSchema,
    newPrice: priceSchema,
    oldPrice: priceSchema,
    timestamp: z.string().datetime(),
    productTitle: secureStringSchema(1, 200),
    productUrl: secureUrlSchema,
  }).strict(),
};

// Stripe/payment validation schemas
export const paymentSchemas = {
  checkout: z.object({
    planId: z.enum(['pro', 'enterprise']),
    billing: z.enum(['monthly', 'yearly']),
    successUrl: secureUrlSchema.optional(),
    cancelUrl: secureUrlSchema.optional(),
  }).strict(),
  
  webhook: z.object({
    id: secureStringSchema(1, 100),
    type: secureStringSchema(1, 100),
    data: z.record(z.any()),
    created: z.number().positive(),
  }).strict(),
};

// Security validation helpers
export const securityValidation = {
  // Validate ObjectId format for MongoDB
  isValidObjectId: (id: string): boolean => {
    return /^[0-9a-fA-F]{24}$/.test(id);
  },

  // Validate IP address format
  isValidIP: (ip: string): boolean => {
    const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
    const ipv6Regex = /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;
    return ipv4Regex.test(ip) || ipv6Regex.test(ip);
  },

  // Validate JWT token format (basic structure check)
  isValidJWT: (token: string): boolean => {
    const parts = token.split('.');
    return parts.length === 3 && parts.every(part => part.length > 0);
  },

  // Check for suspicious patterns in input
  hasSuspiciousPatterns: (input: string): boolean => {
    const patterns = [
      /<script/i,
      /javascript:/i,
      /vbscript:/i,
      /onload=/i,
      /onerror=/i,
      /union\s+select/i,
      /drop\s+table/i,
      /insert\s+into/i,
      /delete\s+from/i,
      /update\s+.*set/i,
    ];
    
    return patterns.some(pattern => pattern.test(input));
  },
};

// Comprehensive validation middleware factory
export const createValidationMiddleware = <T>(schema: z.ZodSchema<T>) => {
  return async (data: unknown): Promise<{ success: true; data: T } | { success: false; error: string; details?: any }> => {
    try {
      // Check for suspicious patterns in string data
      if (typeof data === 'string' && securityValidation.hasSuspiciousPatterns(data)) {
        return {
          success: false,
          error: 'Input contains suspicious patterns',
        };
      }
      
      // Validate against schema
      const validatedData = schema.parse(data);
      
      return {
        success: true,
        data: validatedData,
      };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return {
          success: false,
          error: 'Validation failed',
          details: error.errors.map(err => ({
            path: err.path.join('.'),
            message: err.message,
            code: err.code,
          })),
        };
      }
      
      return {
        success: false,
        error: 'Validation error',
        details: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  };
};

// Export commonly used schemas and utilities
export {
  secureStringSchema,
  emailSchema,
  productIdSchema,
  userIdSchema,
  priceSchema,
  secureUrlSchema,
};

// Rate limiting validation
export const rateLimitSchemas = {
  api: z.object({
    requests: z.number().max(100, 'Too many API requests'),
    windowMs: z.number().min(60000), // At least 1 minute
  }),
  
  sensitive: z.object({
    requests: z.number().max(10, 'Too many sensitive requests'),
    windowMs: z.number().min(300000), // At least 5 minutes
  }),
};

// Content Security Policy validation
export const cspValidation = {
  validateSource: (source: string): boolean => {
    // Allow self, specific domains, and secure protocols
    const allowedPatterns = [
      /^'self'$/,
      /^'unsafe-inline'$/,
      /^'unsafe-eval'$/,
      /^https:\/\/[a-zA-Z0-9.-]+$/,
      /^data:$/,
      /^blob:$/,
    ];
    
    return allowedPatterns.some(pattern => pattern.test(source));
  },
  
  sanitizeDirective: (directive: string): string => {
    return directive
      .split(' ')
      .filter(source => cspValidation.validateSource(source))
      .join(' ');
  },
};

// Enhanced validation error formatting
export const formatValidationError = (error: z.ZodError) => {
  return {
    message: 'Validation failed',
    code: 'VALIDATION_ERROR',
    errors: error.errors.map(err => ({
      field: err.path.join('.'),
      message: err.message,
      code: err.code,
    })),
  };
};

// Enhanced validation with security features
export const validateWithSecurity = <T>(
  schema: z.ZodSchema<T>,
  data: unknown,
  options: {
    sanitize?: boolean;
    stripUnknown?: boolean;
    maxSize?: number;
    preventInjection?: boolean;
  } = {}
): { success: boolean; data?: T; error?: any } => {
  try {
    // Check request size if specified
    if (options.maxSize) {
      const dataSize = JSON.stringify(data).length;
      if (dataSize > options.maxSize) {
        return {
          success: false,
          error: {
            message: 'Request payload too large',
            code: 'PAYLOAD_TOO_LARGE',
            maxSize: options.maxSize,
            actualSize: dataSize,
          }
        };
      }
    }

    // MongoDB injection prevention
    if (options.preventInjection && typeof data === 'object' && data !== null) {
      data = sanitizeMongoQuery(data);
    }

    // XSS sanitization
    if (options.sanitize && typeof data === 'string') {
      data = sanitizeInput(data);
    }

    // Validate with schema
    const result = schema.safeParse(data);
    
    if (!result.success) {
      return {
        success: false,
        error: formatValidationError(result.error)
      };
    }

    return {
      success: true,
      data: result.data
    };
  } catch (error) {
    return {
      success: false,
      error: {
        message: 'Validation error occurred',
        code: 'VALIDATION_ERROR',
        details: error instanceof Error ? error.message : 'Unknown error'
      }
    };
  }
};

// CSRF Token Management
export const csrfProtection = {
  generateToken: (): string => {
    return crypto.randomBytes(32).toString('hex');
  },
  
  validateToken: (token: string, expectedToken: string): boolean => {
    if (!token || !expectedToken) return false;
    return crypto.timingSafeEqual(
      Buffer.from(token, 'hex'),
      Buffer.from(expectedToken, 'hex')
    );
  },
  
  middleware: (request: NextRequest) => {
    const token = request.headers.get('x-csrf-token') || 
                  request.headers.get('csrf-token') ||
                  request.nextUrl.searchParams.get('csrf_token');
    
    const expectedToken = request.headers.get('x-csrf-expected') ||
                         request.cookies.get('csrf-token')?.value;
    
    if (!token || !expectedToken) {
      return { valid: false, error: 'CSRF token missing' };
    }
    
    if (!csrfProtection.validateToken(token, expectedToken)) {
      return { valid: false, error: 'CSRF token invalid' };
    }
    
    return { valid: true };
  }
};

// Common validation schemas
export const idSchema = z.string()
  .min(1, 'ID required')
  .max(100, 'ID too long')
  .regex(/^[a-zA-Z0-9_-]+$/, 'Invalid ID format');

// Enhanced product validation
export const productSchema = z.object({
  title: z.string().min(1).max(200).transform(sanitizeInput),
  description: z.string().min(1).max(2000).transform(sanitizeInput),
  url: secureUrlSchema,
  price: priceSchema.optional(),
  brand: z.string().min(1).max(100).transform(sanitizeInput).optional(),
  category: z.string().min(1).max(100).transform(sanitizeInput).optional(),
  imageUrl: secureUrlSchema.optional(),
}).strict();

// Stripe webhook validation
export const stripeWebhookSchema = z.object({
  id: z.string(),
  object: z.literal('event'),
  type: z.string(),
  data: z.object({
    object: z.any(),
  }),
  created: z.number(),
  livemode: z.boolean(),
}).strict();

// API request validation schemas
export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sort: z.enum(['asc', 'desc']).default('desc'),
  sortBy: z.string().max(50).default('createdAt'),
}).strict();

// Subscription schema for checkout
export const subscriptionCreateSchema = z.object({
  priceId: secureStringSchema(1, 100),
  planId: z.enum(['free', 'pro', 'enterprise']),
  billing: z.enum(['monthly', 'yearly']),
  quantity: z.number().int().positive().max(100).default(1),
  metadata: z.record(z.string()).optional(),
  successUrl: secureUrlSchema.optional(),
  cancelUrl: secureUrlSchema.optional(),
}).strict();

// Environment validation for production readiness
export const validateProductionEnvironment = () => {
  const requiredEnvVars = [
    'DATABASE_URL',
    'CLERK_SECRET_KEY',
    'STRIPE_SECRET_KEY',
    'STRIPE_WEBHOOK_SECRET',
    'SENTRY_DSN',
    'UPSTASH_REDIS_REST_URL',
    'UPSTASH_REDIS_REST_TOKEN',
  ];

  const missing = requiredEnvVars.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
};

export default {
  sanitizeInput,
  sanitizeMongoQuery,
  csrfProtection,
  secureUrlSchema,
  validateWithSecurity,
  createValidationMiddleware,
  validateProductionEnvironment,
  securityValidation,
  socketEventSchemas,
  stripeWebhookSchema,
  paginationSchema,
  productSchema,
  formatValidationError,
};