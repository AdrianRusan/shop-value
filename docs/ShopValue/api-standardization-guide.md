# API Standardization Guide

## Overview

This guide outlines the new standardized API framework for ShopValue that ensures consistent response formats, error handling, validation, rate limiting, and monitoring across all endpoints.

## Benefits

### ✅ **Consistency**
- Uniform response format across all endpoints
- Standardized error codes and messages
- Consistent validation patterns

### ✅ **Developer Experience**
- Predictable API responses
- Clear error messages with detailed context
- Type-safe validation with Zod schemas

### ✅ **Performance & Monitoring**
- Built-in rate limiting
- Automatic performance tracking
- Request/response logging
- Error reporting with Sentry

### ✅ **Security**
- Authentication middleware
- Role-based authorization
- Input sanitization and validation
- Rate limiting protection

## Framework Components

### 1. Standardized Response Format

All API responses follow this consistent structure:

#### Success Response
```typescript
{
  success: true,
  data: T, // Your response data
  message?: string, // Optional success message
  meta: {
    timestamp: string,
    requestId: string,
    version: string,
    pagination?: PaginationMeta, // For paginated responses
    performance?: PerformanceMeta // Response time metrics
  }
}
```

#### Error Response
```typescript
{
  success: false,
  error: {
    code: string, // Standardized error code
    message: string, // Human-readable error message
    details?: any, // Additional error context
    field?: string // Specific field for validation errors
  },
  meta: {
    timestamp: string,
    requestId: string,
    version: string
  }
}
```

### 2. Error Codes

Standardized error codes for consistent error handling:

```typescript
// Authentication & Authorization
UNAUTHORIZED = 'UNAUTHORIZED'
FORBIDDEN = 'FORBIDDEN'
TOKEN_EXPIRED = 'TOKEN_EXPIRED'
INVALID_TOKEN = 'INVALID_TOKEN'

// Validation
VALIDATION_FAILED = 'VALIDATION_FAILED'
INVALID_REQUEST = 'INVALID_REQUEST'
REQUIRED_FIELD_MISSING = 'REQUIRED_FIELD_MISSING'
INVALID_FORMAT = 'INVALID_FORMAT'

// Resource Management
RESOURCE_NOT_FOUND = 'RESOURCE_NOT_FOUND'
RESOURCE_ALREADY_EXISTS = 'RESOURCE_ALREADY_EXISTS'
RESOURCE_CONFLICT = 'RESOURCE_CONFLICT'

// Rate Limiting
RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED'
TOO_MANY_REQUESTS = 'TOO_MANY_REQUESTS'

// Server Errors
INTERNAL_ERROR = 'INTERNAL_ERROR'
SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE'
DATABASE_ERROR = 'DATABASE_ERROR'
EXTERNAL_SERVICE_ERROR = 'EXTERNAL_SERVICE_ERROR'

// Business Logic
SUBSCRIPTION_REQUIRED = 'SUBSCRIPTION_REQUIRED'
INSUFFICIENT_PERMISSIONS = 'INSUFFICIENT_PERMISSIONS'
QUOTA_EXCEEDED = 'QUOTA_EXCEEDED'
OPERATION_NOT_ALLOWED = 'OPERATION_NOT_ALLOWED'

// Method & Route
METHOD_NOT_ALLOWED = 'METHOD_NOT_ALLOWED'
ROUTE_NOT_FOUND = 'ROUTE_NOT_FOUND'
```

### 3. Rate Limiting

Built-in rate limiting configurations:

```typescript
const RATE_LIMITS = {
  general: { requests: 100, window: '5 m' },
  auth: { requests: 10, window: '5 m' },
  payment: { requests: 5, window: '5 m' },
  search: { requests: 50, window: '1 m' },
  admin: { requests: 200, window: '1 m' },
}
```

## Usage Guide

### Basic API Handler

```typescript
import { createAPIHandler } from '@/lib/api-framework';

export const GET = createAPIHandler({
  requireAuth: true,
  rateLimitType: 'general',
})(async (context) => {
  // Your handler logic here
  const { userId } = context;
  
  const data = await fetchUserData(userId);
  
  return {
    user: data,
    message: 'User data retrieved successfully',
  };
});
```

### With Validation

```typescript
import { z } from 'zod';
import { createAPIHandler, commonSchemas } from '@/lib/api-framework';

const createUserSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
  role: z.enum(['user', 'admin']).default('user'),
});

export const POST = createAPIHandler({
  requireAuth: true,
  validateRequest: createUserSchema,
  rateLimitType: 'general',
})(async (context) => {
  const { validatedData } = context;
  
  const user = await createUser(validatedData);
  
  return {
    user,
    message: 'User created successfully',
  };
});
```

### With Pagination

```typescript
import { createAPIHandler, commonSchemas } from '@/lib/api-framework';

const listUsersSchema = z.object({
  ...commonSchemas.pagination.shape,
  role: z.enum(['user', 'admin']).optional(),
});

export const GET = createAPIHandler({
  requireAuth: true,
  validateQuery: listUsersSchema,
  rateLimitType: 'general',
})(async (context) => {
  const { validatedQuery } = context;
  
  const result = await getUsersWithPagination(validatedQuery);
  
  return {
    users: result.users,
    pagination: result.pagination,
  };
});
```

### Role-Based Authorization

```typescript
export const DELETE = createAPIHandler({
  requireAuth: true,
  requiredRole: ['admin', 'moderator'],
  rateLimitType: 'admin',
})(async (context) => {
  const { userId, userRole } = context;
  
  await deleteResource(resourceId);
  
  return {
    message: 'Resource deleted successfully',
  };
});
```

## Migration Guide

### Step 1: Update Existing Endpoints

Replace your existing API handlers with the standardized framework:

#### Before:
```typescript
export async function GET(request: NextRequest) {
  try {
    const { userId } = auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const data = await fetchData(userId);
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
```

#### After:
```typescript
export const GET = createAPIHandler({
  requireAuth: true,
  rateLimitType: 'general',
})(async (context) => {
  const { userId } = context;
  const data = await fetchData(userId!);
  return { data };
});
```

### Step 2: Update Validation

Replace manual validation with Zod schemas:

#### Before:
```typescript
const body = await request.json();
if (!body.email || !body.name) {
  return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
}
```

#### After:
```typescript
const schema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
});

export const POST = createAPIHandler({
  validateRequest: schema,
})(async (context) => {
  const { validatedData } = context;
  // Use validatedData safely
});
```

### Step 3: Update Error Handling

Use standardized error responses:

#### Before:
```typescript
if (!resource) {
  return NextResponse.json({ error: 'Not found' }, { status: 404 });
}
```

#### After:
```typescript
if (!resource) {
  const { response, statusCode } = createAPIError(
    'RESOURCE_NOT_FOUND',
    'Resource not found',
    { requestId: context.requestId }
  );
  throw { response, statusCode };
}
```

### Step 4: Handle Unsupported Methods

```typescript
// Add method not allowed handlers
export const PUT = () => createMethodNotAllowedHandler(['GET', 'POST', 'DELETE']);
export const PATCH = () => createMethodNotAllowedHandler(['GET', 'POST', 'DELETE']);
```

## Best Practices

### 1. Input Validation
- Always use Zod schemas for validation
- Validate both request body and query parameters
- Use strict mode to prevent unknown fields

```typescript
const schema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
}).strict(); // Prevents additional fields
```

### 2. Error Handling
- Use specific error codes for different scenarios
- Provide meaningful error messages
- Include context in error details for debugging

```typescript
if (quota.exceeded) {
  const { response, statusCode } = createAPIError(
    'QUOTA_EXCEEDED',
    `Daily limit of ${quota.limit} requests exceeded`,
    { 
      requestId: context.requestId,
      details: {
        current: quota.current,
        limit: quota.limit,
        resetTime: quota.resetTime,
      }
    }
  );
  throw { response, statusCode };
}
```

### 3. Rate Limiting
- Choose appropriate rate limit types for different endpoints
- Use stricter limits for sensitive operations
- Consider user subscription levels for dynamic limits

```typescript
// For payment operations
export const POST = createAPIHandler({
  rateLimitType: 'payment', // 5 requests per 5 minutes
  requireAuth: true,
})

// For search operations
export const GET = createAPIHandler({
  rateLimitType: 'search', // 50 requests per minute
})
```

### 4. Performance Monitoring
- The framework automatically tracks performance metrics
- Use the built-in analytics for monitoring
- Review slow endpoints regularly

### 5. Security
- Always validate and sanitize input
- Use appropriate authentication and authorization
- Be careful with sensitive data in error responses

```typescript
// Don't expose sensitive details in production
const errorDetails = process.env.NODE_ENV === 'development' 
  ? error.stack 
  : undefined;
```

## Testing

### Unit Testing
```typescript
import { createAPIHandler } from '@/lib/api-framework';

// Test your handler logic
const handler = createAPIHandler({})(async (context) => {
  return { message: 'test' };
});

// Mock the request and test
const mockRequest = new NextRequest('http://localhost/api/test');
const response = await handler(mockRequest);
```

### Integration Testing
```typescript
// Test complete API flow
describe('GET /api/users', () => {
  it('should return paginated users', async () => {
    const response = await fetch('/api/users?page=1&limit=10');
    const data = await response.json();
    
    expect(data.success).toBe(true);
    expect(data.data.users).toHaveLength(10);
    expect(data.data.pagination).toBeDefined();
  });
});
```

## Monitoring & Analytics

The framework automatically provides:

### Request Metrics
- Total requests per day/hour
- Average response times
- Status code distribution
- Endpoint-specific metrics

### Error Tracking
- Automatic Sentry integration
- Error categorization by code
- Performance impact analysis

### Rate Limiting Metrics
- Rate limit hit rates
- User behavior patterns
- Abuse detection

## Advanced Features

### Custom Middleware
```typescript
const customMiddleware = async (context: RequestContext) => {
  // Custom validation logic
  if (context.ip === 'blocked.ip') {
    throw new Error('Blocked IP');
  }
  return { success: true };
};

export const GET = createAPIHandler({
  // Add custom middleware in the handler
})(async (context) => {
  await customMiddleware(context);
  // Handler logic
});
```

### Caching Integration
```typescript
export const GET = createAPIHandler({
  enableCaching: true,
  cacheDuration: 300, // 5 minutes
})(async (context) => {
  // Expensive operation that should be cached
  const data = await expensiveOperation();
  return { data };
});
```

## Troubleshooting

### Common Issues

1. **Validation Errors**
   - Check schema definitions
   - Ensure strict mode is used appropriately
   - Verify input data types

2. **Rate Limiting**
   - Adjust limits based on usage patterns
   - Consider user subscription levels
   - Monitor rate limit metrics

3. **Authentication Issues**
   - Verify Clerk integration
   - Check user role assignments
   - Ensure proper middleware order

4. **Performance Issues**
   - Monitor response times
   - Optimize database queries
   - Consider caching strategies

### Debugging

Enable debug logging:
```typescript
// Set environment variable
DEBUG_API=true

// View detailed logs in console
console.log('Request context:', context);
```

## Migration Checklist

- [ ] Install required dependencies
- [ ] Update API handlers to use framework
- [ ] Migrate validation to Zod schemas
- [ ] Standardize error responses
- [ ] Add rate limiting configuration
- [ ] Update method not allowed handlers
- [ ] Test all endpoints
- [ ] Update frontend to handle new response format
- [ ] Monitor performance metrics
- [ ] Document API changes

## Conclusion

The standardized API framework provides a robust foundation for building consistent, secure, and performant APIs. By following this guide, you'll ensure all endpoints maintain the same high standards for validation, error handling, security, and monitoring.

For questions or issues, refer to the framework source code in `/lib/api-framework.ts` or consult the development team. 