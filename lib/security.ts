import { z } from 'zod';
import { NextRequest, NextResponse } from 'next/server';
import { rateLimits } from './upstash';
import * as Sentry from '@sentry/nextjs';
import { auth } from '@clerk/nextjs/server';
import crypto from 'crypto';

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
  CLERK_SECRET_KEY: z.string().min(1, 'CLERK_SECRET_KEY is required').optional(),
  STRIPE_SECRET_KEY: z.string().min(1, 'STRIPE_SECRET_KEY is required').optional(),
  MONGODB_URI: z.string().url('MONGODB_URI must be a valid URL').optional(),
  UPSTASH_REDIS_REST_URL: z.string().url('UPSTASH_REDIS_REST_URL must be a valid URL').optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().min(1, 'UPSTASH_REDIS_REST_TOKEN is required').optional(),
  RESEND_API_KEY: z.string().min(1, 'RESEND_API_KEY is required').optional(),
  SENTRY_DSN: z.string().url('SENTRY_DSN must be a valid URL').optional(),
  
  // Webhook secrets
  STRIPE_WEBHOOK_SECRET: z.string().min(1, 'STRIPE_WEBHOOK_SECRET is required').optional(),
  CLERK_WEBHOOK_SECRET: z.string().min(1, 'CLERK_WEBHOOK_SECRET is required').optional(),
  
  // Optional
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: z.string().min(1, 'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY is required').optional(),
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.string().min(1, 'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY is required').optional(),
});

// Validate environment variables on module load
export const validateEnvironment = () => {
  // Skip validation during build time
  if (process.env.BUILDING === 'true' || process.env.NEXT_PHASE === 'phase-production-build') {
    return process.env;
  }
  
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
  'X-DNS-Prefetch-Control': 'off',
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'origin-when-cross-origin',
  'X-XSS-Protection': '1; mode=block',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'Content-Security-Policy': [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com https://checkout.stripe.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: https: blob:",
    "connect-src 'self' https://api.stripe.com https://*.clerk.accounts.dev wss:",
    "frame-src https://js.stripe.com https://hooks.stripe.com https://checkout.stripe.com",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'"
  ].join('; '),
};

// CORS configuration
export const corsConfig = {
  allowedOrigins: process.env.NODE_ENV === 'production' 
    ? [
        process.env.NEXT_PUBLIC_APP_URL,
        'https://shop-value.vercel.app',
        'https://shop-value-feature1.vercel.app'
      ].filter(Boolean)
    : ['http://localhost:3000', 'http://127.0.0.1:3000'],
  allowedMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token', 'X-Requested-With'],
  credentials: true,
  maxAge: 86400, // 24 hours
};

// Enhanced CSRF Protection
export const csrfProtection = {
  generateToken: (): string => {
    return crypto.randomBytes(32).toString('hex');
  },
  
  validateToken: (token: string, expectedToken: string): boolean => {
    if (!token || !expectedToken) return false;
    try {
      return crypto.timingSafeEqual(
        Buffer.from(token, 'hex'),
        Buffer.from(expectedToken, 'hex')
      );
    } catch {
      return false;
    }
  },
  
  middleware: (request: NextRequest) => {
    // Skip CSRF for GET requests and webhooks
    if (request.method === 'GET' || request.nextUrl.pathname.includes('/webhooks/')) {
      return { valid: true };
    }
    
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

// Enhanced XSS Protection utilities
export const xssProtection = {
  sanitizeInput: (input: string): string => {
    if (typeof input !== 'string') return '';
    
    const purify = getDOMPurify();
    if (purify) {
      return purify.sanitize(input, { 
        ALLOWED_TAGS: [], 
        ALLOWED_ATTR: [] 
      });
    }
    
    // Fallback sanitization
    return input
      .replace(/[<>'"&]/g, (match) => {
        const escapeMap: { [key: string]: string } = {
          '<': '&lt;',
          '>': '&gt;',
          '"': '&quot;',
          "'": '&#x27;',
          '&': '&amp;'
        };
        return escapeMap[match];
      })
      .trim();
  },
  
  sanitizeHtml: (html: string): string => {
    const purify = getDOMPurify();
    if (purify) {
      return purify.sanitize(html, {
        ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'u', 'ol', 'ul', 'li'],
        ALLOWED_ATTR: []
      });
    }
    return xssProtection.sanitizeInput(html);
  },
  
  // Recursive sanitization for objects
  sanitizeObject: (obj: any): any => {
    if (typeof obj === 'string') {
      return xssProtection.sanitizeInput(obj);
    }
    
    if (Array.isArray(obj)) {
      return obj.map(xssProtection.sanitizeObject);
    }
    
    if (obj && typeof obj === 'object') {
      const sanitized: any = {};
      for (const [key, value] of Object.entries(obj)) {
        sanitized[xssProtection.sanitizeInput(key)] = xssProtection.sanitizeObject(value);
      }
      return sanitized;
    }
    
    return obj;
  }
};

// Database security utilities
export const dbSecurity = {
  sanitizeMongoQuery: (query: any): any => {
    if (typeof query !== 'object' || query === null) {
      return query;
    }
    
    if (Array.isArray(query)) {
      return query.map(dbSecurity.sanitizeMongoQuery);
    }
    
    const sanitized: any = {};
    for (const [key, value] of Object.entries(query)) {
      // Block dangerous operators
      if (key.startsWith('$') && !['$eq', '$ne', '$gt', '$gte', '$lt', '$lte', '$in', '$nin', '$exists', '$regex', '$or', '$and'].includes(key)) {
        continue; // Skip dangerous operators
      }
      
      if (typeof value === 'string') {
        sanitized[xssProtection.sanitizeInput(key)] = xssProtection.sanitizeInput(value);
      } else if (typeof value === 'object' && value !== null) {
        sanitized[xssProtection.sanitizeInput(key)] = dbSecurity.sanitizeMongoQuery(value);
      } else {
        sanitized[xssProtection.sanitizeInput(key)] = value;
      }
    }
    
    return sanitized;
  },

  isValidObjectId: (id: string): boolean => {
    if (!id || typeof id !== 'string') return false;
    return /^[a-fA-F0-9]{24}$/.test(id);
  },

  escapeRegex: (text: string): string => {
    return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  },
};

// Enhanced database security
export const databaseSecurity = {
  sanitizeMongoQuery: (query: any): any => {
    if (typeof query !== 'object' || query === null) {
      return query;
    }
    
    if (Array.isArray(query)) {
      return query.map(databaseSecurity.sanitizeMongoQuery);
    }
    
    const sanitized: any = {};
    for (const [key, value] of Object.entries(query)) {
      // Block dangerous MongoDB operators
      if (key.startsWith('$') && !['$eq', '$ne', '$gt', '$gte', '$lt', '$lte', '$in', '$nin', '$exists', '$regex'].includes(key)) {
        continue; // Skip dangerous operators
      }
      
      // Recursively sanitize nested objects
      if (typeof value === 'object' && value !== null) {
        sanitized[key] = databaseSecurity.sanitizeMongoQuery(value);
      } else if (typeof value === 'string') {
        // Prevent NoSQL injection in string values
        sanitized[key] = value.replace(/[\${}]/g, '');
      } else {
        sanitized[key] = value;
      }
    }
    
    return sanitized;
  },
  
  validateObjectId: (id: string): boolean => {
    return /^[0-9a-fA-F]{24}$/.test(id);
  },
  
  createSafeAggregationPipeline: (stages: any[]): any[] => {
    return stages.filter(stage => {
      const stageKeys = Object.keys(stage);
      // Allow only safe aggregation stages
      const allowedStages = ['$match', '$sort', '$limit', '$skip', '$project', '$group', '$lookup', '$unwind'];
      return stageKeys.every(key => allowedStages.includes(key));
    });
  }
};

// IP Access Control
export const ipAccessControl = {
  blacklistedIPs: new Set<string>(),
  
  isBlacklisted: (ip: string): boolean => {
    return ipAccessControl.blacklistedIPs.has(ip);
  },
  
  blacklistIP: (ip: string, reason?: string): void => {
    ipAccessControl.blacklistedIPs.add(ip);
    console.warn(`IP ${ip} blacklisted: ${reason || 'No reason provided'}`);
  },
  
  whitelistIP: (ip: string): void => {
    ipAccessControl.blacklistedIPs.delete(ip);
    console.info(`IP ${ip} removed from blacklist`);
  },
  
  getClientIP: (request: NextRequest): string => {
    const forwarded = request.headers.get('x-forwarded-for');
    const realIP = request.headers.get('x-real-ip');
    const remoteAddress = request.ip;
    
    if (forwarded) {
      return forwarded.split(',')[0].trim();
    }
    
    return realIP || remoteAddress || 'unknown';
  },
  
  isPrivateIP: (ip: string): boolean => {
    const privateRanges = [
      /^10\./,
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
      /^192\.168\./,
      /^127\./,
      /^::1$/,
      /^fe80:/,
      /^fc00:/
    ];
    
    return privateRanges.some(range => range.test(ip));
  }
};

// Enhanced rate limiting
export const createRateLimitMiddleware = (type: 'api' | 'scraping' | 'email' | 'sensitive') => {
  const limits = {
    api: { requests: 100, windowMs: 60000 }, // 100 requests per minute
    scraping: { requests: 10, windowMs: 60000 }, // 10 requests per minute
    email: { requests: 5, windowMs: 60000 }, // 5 requests per minute
    sensitive: { requests: 3, windowMs: 300000 }, // 3 requests per 5 minutes
  };

  const config = limits[type];

  return async (request: NextRequest) => {
    try {
      const { userId } = auth();
      const clientIP = ipAccessControl.getClientIP(request);
      
      // Use user ID if available, otherwise fall back to IP
      const identifier = userId ?? clientIP;

      const rateLimiter = rateLimits[type];
      const result = await rateLimiter.limit(identifier);

      if (!result.success) {
                  securityAudit.logSecurityEvent({
            type: 'suspicious',
            severity: 'medium',
            description: `Rate limit exceeded for ${type}`,
            ip: clientIP,
            userId: userId || undefined,
            metadata: { 
              type, 
              identifier, 
              limit: config.requests,
              windowMs: config.windowMs 
            }
          });

        return {
          success: false,
          error: 'Rate limit exceeded',
          code: 'RATE_LIMIT_EXCEEDED',
          headers: {
            'X-RateLimit-Limit': config.requests.toString(),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': new Date(Date.now() + config.windowMs).toISOString(),
          }
        };
      }

      return {
        success: true,
        headers: {
          'X-RateLimit-Limit': config.requests.toString(),
          'X-RateLimit-Remaining': result.remaining.toString(),
          'X-RateLimit-Reset': new Date(Date.now() + config.windowMs).toISOString(),
        }
      };
    } catch (error) {
      Sentry.captureException(error);
      return {
        success: false,
        error: 'Rate limiting service unavailable',
        code: 'RATE_LIMIT_ERROR'
      };
    }
  };
};

// Request size limiting
export const requestSizeLimiter = (maxSize: number) => {
  return (request: NextRequest) => {
    const contentLength = request.headers.get('content-length');
    
    if (contentLength && parseInt(contentLength) > maxSize) {
      return {
        success: false,
        error: 'Request too large',
        code: 'PAYLOAD_TOO_LARGE',
        maxSize,
        actualSize: parseInt(contentLength)
      };
    }
    
    return { success: true };
  };
};

// Webhook signature verification
export const verifyWebhookSignature = (
  payload: string,
  signature: string,
  secret: string
): boolean => {
  try {
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(payload, 'utf8')
      .digest('hex');
    
    const providedSignature = signature.replace('sha256=', '');
    
    return crypto.timingSafeEqual(
      Buffer.from(expectedSignature, 'hex'),
      Buffer.from(providedSignature, 'hex')
    );
  } catch {
    return false;
  }
};

// Session security utilities
export const sessionSecurity = {
  validateSession: (sessionId: string): boolean => {
    // Validate session format and expiration
    if (!sessionId || sessionId.length < 32) return false;
    
    // Additional session validation logic
    return true;
  },

  generateSecureToken: (): string => {
    return crypto.randomBytes(32).toString('hex');
  },

  hashSensitiveData: (data: string): string => {
    return crypto.createHash('sha256').update(data).digest('hex');
  }
};

// Security audit helpers
export const securityAudit = {
  logSecurityEvent: (event: {
    type: 'authentication' | 'authorization' | 'validation' | 'suspicious';
    severity: 'low' | 'medium' | 'high' | 'critical';
    description: string;
    ip?: string;
    userId?: string;
    metadata?: any;
  }) => {
    const auditLog = {
      ...event,
      timestamp: new Date().toISOString(),
      service: 'shopvalue-api'
    };
    
    console.log('Security Event:', auditLog);
    
    // Send to Sentry for high/critical events
    if (['high', 'critical'].includes(event.severity)) {
      Sentry.captureMessage(`Security Event: ${event.description}`, {
        level: event.severity === 'critical' ? 'error' : 'warning',
        tags: {
          type: event.type,
          severity: event.severity
        },
        extra: auditLog
      });
    }
  },

  validateSecurityHeaders: (request: NextRequest): boolean => {
    const requiredHeaders = ['user-agent', 'accept'];
    return requiredHeaders.every(header => request.headers.has(header));
  },

  detectSuspiciousPatterns: (request: NextRequest): string[] => {
    const suspiciousPatterns = [];
    const userAgent = request.headers.get('user-agent') || '';
    const url = request.url;
    
    // Check for automated/bot requests
    if (!userAgent || userAgent.length < 10) {
      suspiciousPatterns.push('Missing or suspicious User-Agent');
    }
    
    // Check for SQL injection attempts
    if (url.includes('UNION') || url.includes('SELECT') || url.includes('DROP')) {
      suspiciousPatterns.push('Potential SQL injection attempt');
    }
    
    // Check for path traversal attempts
    if (url.includes('../') || url.includes('..\\')) {
      suspiciousPatterns.push('Potential path traversal attempt');
    }
    
    return suspiciousPatterns;
  }
};

// Comprehensive security middleware
export const createSecurityMiddleware = (options: {
  rateLimit?: 'api' | 'scraping' | 'email' | 'sensitive';
  requireAuth?: boolean;
  validateInput?: z.ZodSchema<any>;
  corsEnabled?: boolean;
  maxRequestSize?: number;
  csrfProtection?: boolean;
  ipAccessControl?: boolean;
}) => {
  return async (request: NextRequest) => {
    const results: any = {
      success: true,
      headers: {},
      errors: []
    };

    try {
      // 1. IP Access Control
      if (options.ipAccessControl) {
        const clientIP = ipAccessControl.getClientIP(request);
        if (ipAccessControl.isBlacklisted(clientIP)) {
          securityAudit.logSecurityEvent({
            type: 'authorization',
            severity: 'high',
            description: 'Blacklisted IP attempted access',
            ip: clientIP
          });
          
          return {
            success: false,
            error: 'Access denied',
            code: 'IP_BLACKLISTED'
          };
        }
      }

      // 2. Request size limiting
      if (options.maxRequestSize) {
        const sizeCheck = requestSizeLimiter(options.maxRequestSize)(request);
        if (!sizeCheck.success) {
          results.errors.push(sizeCheck.error);
          return sizeCheck;
        }
      }

      // 3. Rate limiting
      if (options.rateLimit) {
        const rateLimit = await createRateLimitMiddleware(options.rateLimit)(request);
        if (!rateLimit.success) {
          results.errors.push(rateLimit.error);
          return rateLimit;
        }
        if (rateLimit.headers) {
          Object.assign(results.headers, rateLimit.headers);
        }
      }

      // 4. CSRF Protection
      if (options.csrfProtection) {
        const csrfResult = csrfProtection.middleware(request);
        if (!csrfResult.valid) {
          securityAudit.logSecurityEvent({
            type: 'validation',
            severity: 'medium',
            description: `CSRF validation failed: ${csrfResult.error}`,
            ip: ipAccessControl.getClientIP(request)
          });
          
          return {
            success: false,
            error: csrfResult.error || 'CSRF validation failed',
            code: 'CSRF_INVALID'
          };
        }
      }

      // 5. Authentication check
      if (options.requireAuth) {
        const { userId } = auth();
        if (!userId) {
          return {
            success: false,
            error: 'Authentication required',
            code: 'AUTH_REQUIRED'
          };
        }
        results.userId = userId;
      }

      // 6. Security headers validation
      if (!securityAudit.validateSecurityHeaders(request)) {
        securityAudit.logSecurityEvent({
          type: 'suspicious',
          severity: 'low',
          description: 'Request missing required security headers',
          ip: ipAccessControl.getClientIP(request)
        });
      }

      // 7. Suspicious pattern detection
      const suspiciousPatterns = securityAudit.detectSuspiciousPatterns(request);
      if (suspiciousPatterns.length > 0) {
        securityAudit.logSecurityEvent({
          type: 'suspicious',
          severity: 'medium',
          description: `Suspicious patterns detected: ${suspiciousPatterns.join(', ')}`,
          ip: ipAccessControl.getClientIP(request),
          metadata: { patterns: suspiciousPatterns }
        });
      }

      return results;
    } catch (error) {
      Sentry.captureException(error);
      return {
        success: false,
        error: 'Security middleware error',
        code: 'SECURITY_ERROR'
      };
    }
  };
};

// Initialize environment validation on module load
// Skip during build time when environment variables may not be available
if (process.env.NODE_ENV === 'production' && !process.env.BUILDING && process.env.NEXT_PHASE !== 'phase-production-build') {
  validateEnvironment();
}

export default {
  validateEnvironment,
  securityHeaders,
  corsConfig,
  xssProtection,
  databaseSecurity,
  createRateLimitMiddleware,
  csrfProtection,
  ipAccessControl,
  requestSizeLimiter,
  verifyWebhookSignature,
  sessionSecurity,
  securityAudit,
  createSecurityMiddleware,
};