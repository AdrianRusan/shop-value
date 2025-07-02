import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { 
  createSecurityMiddleware, 
  xssProtection, 
  dbSecurity,
  verifyWebhookSignature
} from '@/lib/security';
import { connectToDB } from '@/lib/mongoose';
import * as Sentry from '@sentry/nextjs';

// Input validation schema
const exampleSchema = z.object({
  title: z.string().min(1).max(100),
  description: z.string().min(1).max(1000),
  category: z.enum(['electronics', 'fashion', 'home', 'books']),
  price: z.number().positive(),
  tags: z.array(z.string().max(50)).max(10).optional(),
  metadata: z.record(z.any()).optional(),
});

// Secure middleware configuration
const secureMiddleware = createSecurityMiddleware({
  rateLimit: 'api',
  requireAuth: true,
  validateInput: exampleSchema,
  corsEnabled: true,
});

// Example secure API endpoint
const secureHandler = async (request: NextRequest, validatedData?: z.infer<typeof exampleSchema>) => {
  try {
    await connectToDB();
    
    // Check if validation was performed and data is available
    if (!validatedData) {
      return NextResponse.json({
        success: false,
        error: 'Invalid request data or missing content',
        code: 'VALIDATION_FAILED'
      }, { status: 400 });
    }
    
    // Sanitize the validated data for XSS protection
    const sanitizedData = {
      ...validatedData,
      title: xssProtection.sanitizeInput(validatedData.title),
      description: xssProtection.sanitizeHtml(validatedData.description),
      tags: validatedData.tags?.map(tag => xssProtection.sanitizeInput(tag)),
    };
    
    // Example database query with security measures
    const mongoQuery = dbSecurity.sanitizeMongoQuery({
      category: sanitizedData.category,
      price: { $lte: sanitizedData.price }
    });
    
    // Simulate database operation (replace with actual model)
    const result = {
      id: crypto.randomUUID(),
      ...sanitizedData,
      createdAt: new Date().toISOString(),
      securityChecks: {
        inputValidated: true,
        xssSanitized: true,
        rateLimited: true,
        authenticated: true,
      }
    };
    
    return NextResponse.json({
      success: true,
      data: result,
      message: 'Secure operation completed successfully',
      timestamp: new Date().toISOString(),
    });
    
  } catch (error) {
    Sentry.captureException(error);
    
    return NextResponse.json({
      success: false,
      error: 'Internal server error',
      code: 'INTERNAL_ERROR'
    }, { status: 500 });
  }
};

// Apply security middleware to all methods
export const GET = (request: NextRequest) => secureMiddleware(request, async () => {
  return NextResponse.json({
    success: true,
    message: 'Secure GET endpoint working',
    security: {
      rateLimited: true,
      authenticated: true,
      headersApplied: true,
      corsEnabled: true,
    },
    timestamp: new Date().toISOString(),
  });
});

export const POST = (request: NextRequest) => secureMiddleware(request, secureHandler);

export const PUT = (request: NextRequest) => secureMiddleware(request, secureHandler);

export const DELETE = (request: NextRequest) => secureMiddleware(request, async () => {
  // Example delete with additional security checks
  const searchParams = request.nextUrl.searchParams;
  const id = searchParams.get('id');
  
  if (!id || !dbSecurity.isValidObjectId(id)) {
    return NextResponse.json({
      success: false,
      error: 'Invalid ID format',
      code: 'INVALID_ID'
    }, { status: 400 });
  }
  
  return NextResponse.json({
    success: true,
    message: 'Secure delete operation completed',
    deletedId: id,
    timestamp: new Date().toISOString(),
  });
});

// Note: Webhook signature verification is available in lib/security.ts
// For webhook endpoints, create a separate route like app/api/webhooks/stripe/route.ts
// and use the verifyWebhookSignature.stripe() function from our security module