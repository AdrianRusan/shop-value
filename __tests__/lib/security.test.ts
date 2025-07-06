import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { NextRequest } from 'next/server';
import {
  validateEnvironment,
  envSchema,
  xssProtection,
  dbSecurity,
  createRateLimitMiddleware,
  verifyWebhookSignature,
  sessionSecurity,
} from '@/lib/security';
import { z } from 'zod';

// Mock dependencies
jest.mock('@/lib/upstash', () => ({
  rateLimits: {
    api: {
      limit: jest.fn()
    },
    sensitive: {
      limit: jest.fn()
    }
  }
}));

jest.mock('@sentry/nextjs', () => ({
  captureException: jest.fn(),
  addBreadcrumb: jest.fn(),
}));

describe('Security Utilities', () => {
  
  describe('Environment Validation', () => {
    const originalEnv = process.env;
    
    beforeEach(() => {
      process.env = { ...originalEnv };
    });
    
    afterAll(() => {
      process.env = originalEnv;
    });
    
    it('should validate correct environment variables', () => {
      process.env = {
        ...process.env,
        CLERK_SECRET_KEY: 'sk_test_clerk_key',
        STRIPE_SECRET_KEY: 'sk_test_stripe_key',
        MONGODB_URI: 'mongodb://localhost:27017/test',
        UPSTASH_REDIS_REST_URL: 'https://redis.upstash.io',
        UPSTASH_REDIS_REST_TOKEN: 'test_token',
        RESEND_API_KEY: 're_test_key',
        STRIPE_WEBHOOK_SECRET: 'whsec_test_secret',
        CLERK_WEBHOOK_SECRET: 'clerk_webhook_secret',
        NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: 'pk_test_clerk',
        NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: 'pk_test_stripe',
        NODE_ENV: 'test'
      };
      
      expect(() => validateEnvironment()).not.toThrow();
    });
    
    it('should throw error for missing required variables in production', () => {
      const originalNodeEnv = process.env.NODE_ENV;
      Object.defineProperty(process.env, 'NODE_ENV', {
        value: 'production',
        configurable: true
      });
      delete process.env.CLERK_SECRET_KEY;
      
      expect(() => validateEnvironment()).toThrow();
      
      // Restore original NODE_ENV
      Object.defineProperty(process.env, 'NODE_ENV', {
        value: originalNodeEnv,
        configurable: true
      });
    });
    
    it('should validate MongoDB URI format', () => {
      const result = envSchema.safeParse({
        ...process.env,
        MONGODB_URI: 'invalid-uri'
      });
      
      expect(result.success).toBe(false);
    });
  });
  
  describe('XSS Protection', () => {
    
    it('should sanitize malicious script tags', () => {
      const maliciousInput = '<script>alert("xss")</script>Hello World';
      const sanitized = xssProtection.sanitizeInput(maliciousInput);
      
      expect(sanitized).toBe('Hello World');
      expect(sanitized).not.toContain('<script>');
    });
    
    it('should remove javascript: protocols', () => {
      const maliciousInput = 'javascript:alert("xss")';
      const sanitized = xssProtection.sanitizeInput(maliciousInput);
      
      expect(sanitized).not.toContain('javascript:');
    });
    
    it('should remove event handlers', () => {
      const maliciousInput = '<div onclick="alert(1)">Click me</div>';
      const sanitized = xssProtection.sanitizeInput(maliciousInput);
      
      expect(sanitized).not.toContain('onclick');
    });
    
    it('should sanitize HTML while preserving safe tags', () => {
      const htmlInput = '<p>Safe content</p><script>alert("xss")</script>';
      const sanitized = xssProtection.sanitizeHtml(htmlInput);
      
      expect(sanitized).toContain('<p>Safe content</p>');
      expect(sanitized).not.toContain('<script>');
    });
    
    it('should validate and sanitize complex objects', () => {
      const schema = z.object({
        title: z.string(),
        description: z.string(),
        count: z.number()
      });
      
      const maliciousData = {
        title: '<script>alert("xss")</script>Test Title',
        description: 'Safe description',
        count: 5
      };
      
      const result = xssProtection.validateAndSanitize(schema, maliciousData);
      
      expect(result.title).toBe('Test Title');
      expect(result.title).not.toContain('<script>');
      expect(result.description).toBe('Safe description');
      expect(result.count).toBe(5);
    });
  });
  
  describe('Database Security', () => {
    
    it('should remove dangerous MongoDB operators', () => {
      const dangerousQuery = {
        name: 'test',
        $where: 'this.name === "admin"',
        $regex: /.*/,
        price: { $lt: 100 }
      };
      
      const sanitized = dbSecurity.sanitizeMongoQuery(dangerousQuery);
      
      expect(sanitized).not.toHaveProperty('$where');
      expect(sanitized).not.toHaveProperty('$regex');
      expect(sanitized).toHaveProperty('name', 'test');
      expect(sanitized).toHaveProperty('price');
    });
    
    it('should sanitize nested objects', () => {
      const nestedQuery = {
        user: {
          $where: 'dangerous code',
          name: 'valid'
        },
        status: 'active'
      };
      
      const sanitized = dbSecurity.sanitizeMongoQuery(nestedQuery);
      
      expect(sanitized.user).not.toHaveProperty('$where');
      expect(sanitized.user).toHaveProperty('name', 'valid');
      expect(sanitized).toHaveProperty('status', 'active');
    });
    
    it('should validate MongoDB ObjectIds', () => {
      expect(dbSecurity.isValidObjectId('507f1f77bcf86cd799439011')).toBe(true);
      expect(dbSecurity.isValidObjectId('invalid-id')).toBe(false);
      expect(dbSecurity.isValidObjectId('507f1f77bcf86cd79943901')).toBe(false); // Too short
      expect(dbSecurity.isValidObjectId('507f1f77bcf86cd799439011G')).toBe(false); // Invalid char
    });
  });
  
  describe('Rate Limiting', () => {
    
    it('should allow requests within rate limit', async () => {
      const { rateLimits } = await import('@/lib/upstash');
      
      // Mock successful rate limit
      (rateLimits.api.limit as jest.Mock).mockResolvedValueOnce({
        success: true,
        limit: 10,
        remaining: 9,
        reset: Date.now() + 60000
      });
      
      const mockRequest = new NextRequest('https://example.com/api/test', {
        headers: { 'x-forwarded-for': '192.168.1.1' }
      });
      
      const rateLimitMiddleware = createRateLimitMiddleware('api');
      const result = await rateLimitMiddleware(mockRequest);
      
      expect(result.success).toBe(true);
    });
    
    it('should handle rate limit exceeded', async () => {
      const { rateLimits } = await import('@/lib/upstash');
      
      // Mock rate limit exceeded
      (rateLimits.api.limit as jest.Mock).mockResolvedValueOnce({
        success: false,
        limit: 10,
        remaining: 0,
        reset: Date.now() + 60000
      });
      
      const mockRequest = new NextRequest('https://example.com/api/test', {
        headers: { 'x-forwarded-for': '192.168.1.1' }
      });
      
      const rateLimitMiddleware = createRateLimitMiddleware('api');
      const result = await rateLimitMiddleware(mockRequest);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Rate limit exceeded');
    });
    
    it('should use fallback IP when headers are missing', async () => {
      const { rateLimits } = await import('@/lib/upstash');
      
      // Mock successful rate limit
      (rateLimits.api.limit as jest.Mock).mockResolvedValueOnce({
        success: true,
        limit: 10,
        remaining: 9,
        reset: Date.now() + 60000
      });
      
      const mockRequest = new NextRequest('https://example.com/api/test');
      
      const rateLimitMiddleware = createRateLimitMiddleware('api');
      const result = await rateLimitMiddleware(mockRequest);
      
      expect(result.success).toBe(true);
    });
  });
  
  describe('Webhook Signature Verification', () => {
    
    it('should verify valid Stripe webhook signature', () => {
      // Mock stripe webhook verification
      jest.doMock('stripe', () => ({
        default: jest.fn().mockImplementation(() => ({
          webhooks: {
            constructEvent: jest.fn().mockReturnValue({ type: 'test.event' })
          }
        }))
      }));
      
      const body = '{"type":"test.event"}';
      const signature = 'valid_signature';
      const secret = 'whsec_test';
      
      const isValid = verifyWebhookSignature.stripe(body, signature, secret);
      expect(isValid).toBe(true);
    });
    
    it('should reject invalid Stripe webhook signature', () => {
      // Mock stripe webhook verification failure
      jest.doMock('stripe', () => ({
        default: jest.fn().mockImplementation(() => ({
          webhooks: {
            constructEvent: jest.fn().mockImplementation(() => {
              throw new Error('Invalid signature');
            })
          }
        }))
      }));
      
      const body = '{"type":"test.event"}';
      const signature = 'invalid_signature';
      const secret = 'whsec_test';
      
      const isValid = verifyWebhookSignature.stripe(body, signature, secret);
      expect(isValid).toBe(false);
    });
  });
  
  describe('Session Security', () => {
    
    it('should create secure session metadata', () => {
      const mockRequest = new NextRequest('https://example.com/api/test', {
        headers: {
          'x-forwarded-for': '192.168.1.1',
          'user-agent': 'Mozilla/5.0 Test Browser'
        }
      });
      
      const metadata = sessionSecurity.createSessionMetadata(mockRequest);
      
      expect(metadata.ip).toBe('192.168.1.1');
      expect(metadata.userAgent).toBe('Mozilla/5.0 Test Browser');
      expect(metadata.timestamp).toBeDefined();
      expect(metadata.requestId).toBeDefined();
    });
    
    it('should handle missing headers gracefully', () => {
      const mockRequest = new NextRequest('https://example.com/api/test');
      
      const metadata = sessionSecurity.createSessionMetadata(mockRequest);
      
      expect(metadata.ip).toBe('unknown');
      expect(metadata.userAgent).toBe('unknown');
    });
    
    it('should validate session tokens', async () => {
      const result = await sessionSecurity.validateSession('valid_token');
      expect(typeof result).toBe('boolean');
    });
  });
  
  describe('Security Headers', () => {
    
    it('should include all required security headers', async () => {
      const { securityHeaders } = await import('@/lib/security');
      
      expect(securityHeaders).toHaveProperty('Content-Security-Policy');
      expect(securityHeaders).toHaveProperty('Strict-Transport-Security');
      expect(securityHeaders).toHaveProperty('X-Frame-Options');
      expect(securityHeaders).toHaveProperty('X-Content-Type-Options');
      expect(securityHeaders).toHaveProperty('X-XSS-Protection');
      expect(securityHeaders).toHaveProperty('Referrer-Policy');
      expect(securityHeaders).toHaveProperty('Permissions-Policy');
    });
    
    it('should have proper CSP configuration', async () => {
      const { securityHeaders } = await import('@/lib/security');
      const csp = securityHeaders['Content-Security-Policy'];
      
      expect(csp).toContain("default-src 'self'");
      expect(csp).toContain("object-src 'none'");
      expect(csp).toContain("frame-ancestors 'none'");
      expect(csp).toContain("upgrade-insecure-requests");
    });
  });
  
  describe('CORS Configuration', () => {
    
    it('should include development origins in development mode', async () => {
      const originalEnv = process.env.NODE_ENV;
      Object.defineProperty(process.env, 'NODE_ENV', {
        value: 'development',
        configurable: true
      });
      
      const { corsConfig } = await import('@/lib/security');
      
      expect(corsConfig.allowedOrigins).toContain('http://localhost:3000');
      
      Object.defineProperty(process.env, 'NODE_ENV', {
        value: originalEnv,
        configurable: true
      });
    });
    
    it('should have proper CORS methods and headers', async () => {
      const { corsConfig } = await import('@/lib/security');
      
      expect(corsConfig.allowedMethods).toContain('GET');
      expect(corsConfig.allowedMethods).toContain('POST');
      expect(corsConfig.allowedMethods).toContain('PUT');
      expect(corsConfig.allowedMethods).toContain('DELETE');
      
      expect(corsConfig.allowedHeaders).toContain('Content-Type');
      expect(corsConfig.allowedHeaders).toContain('Authorization');
    });
  });
});

describe('Security Integration Tests', () => {
  
  it('should handle complete security flow', () => {
    const testData = {
      title: '<script>alert("xss")</script>Clean Title',
      description: 'Normal description',
      category: 'electronics'
    };
    
    const schema = z.object({
      title: z.string(),
      description: z.string(), 
      category: z.string()
    });
    
    // Test complete validation and sanitization flow
    const sanitized = xssProtection.validateAndSanitize(schema, testData);
    
    expect(sanitized.title).toBe('Clean Title');
    expect(sanitized.title).not.toContain('<script>');
    expect(sanitized.description).toBe('Normal description');
    expect(sanitized.category).toBe('electronics');
  });
  
  it('should handle database security with complex queries', () => {
    const complexQuery = {
      $and: [
        { status: 'active' },
        { 
          $or: [
            { price: { $lt: 100 } },
            { category: 'sale' }
          ]
        }
      ],
      user: {
        $where: 'this.isAdmin === true', // Should be removed
        role: 'customer'
      }
    };
    
    const sanitized = dbSecurity.sanitizeMongoQuery(complexQuery);
    
    expect(sanitized.$and).toBeDefined();
    expect(sanitized.user.role).toBe('customer');
    expect(sanitized.user).not.toHaveProperty('$where');
  });
});