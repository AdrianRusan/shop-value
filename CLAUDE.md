# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

ShopValue is a Romanian price tracking SaaS application built with Next.js 14 (App Router), TypeScript, MongoDB, and a comprehensive tech stack designed for automation, scalability, and minimal maintenance. The goal is €2-5K MRR with <2 hours/week maintenance.

**Revenue Model:**
- Free: 5 products, daily checks
- Pro: €19.99/month, 50 products, 4x daily checks, price history
- Enterprise: €49.99/month, unlimited products, API access, hourly checks

**Target Metrics:**
- 1,000+ users by month 6
- 15% trial-to-paid conversion rate
- <200ms API response time
- >95% scraping success rate

## Tech Stack (Non-Negotiable)

- **Frontend:** Next.js 14 (App Router only), TypeScript (strict mode), Tailwind CSS, Shadcn/ui
- **Authentication:** Clerk (webhooks required: user lifecycle, session events)
- **Payments:** Stripe (full webhook integration, Customer Portal)
- **Database:** MongoDB Atlas with Mongoose ODM
- **Caching:** Upstash Redis
- **Email:** Resend with React Email templates
- **Monitoring:** Sentry (errors), Amplitude (analytics), Vercel Analytics
- **Hosting:** Vercel with Edge functions
- **Scraping:** Cheerio + Axios with BrightData proxy support

## Development Commands

```bash
# Development
npm run dev                    # Start dev server (http://localhost:3000)
npm run build                  # Production build
npm run start                  # Start production server
npm run lint                   # Run ESLint
npm run type-check             # TypeScript type checking

# Testing
npm test                       # Run Jest unit tests
npm run test:watch             # Jest watch mode
npm run test:coverage          # Coverage report
npm run test:e2e               # Playwright E2E tests
npm run test:e2e:ui            # Playwright UI mode
npm run test:e2e:debug         # Playwright debug mode
npm run test:all               # Run all tests

# Database
npm run db:setup               # Initialize database (clean, migrate, seed)
npm run db:clean               # Clean database
npm run db:migrate             # Run migrations
npm run db:seed                # Seed database
npm run db:health              # Check database health

# Maintenance
npm run clean                  # Clean and reinstall dependencies
npm run clean:cache            # Clean Next.js cache and rebuild
npm run build:analyze          # Analyze bundle size
```

## Architecture Overview

### Directory Structure

```
├── app/                        # Next.js App Router
│   ├── api/                   # API routes
│   │   ├── admin/            # Admin-only endpoints
│   │   ├── alerts/           # Price alert endpoints
│   │   ├── checkout/         # Stripe checkout
│   │   ├── cron/             # Scheduled jobs
│   │   ├── gdpr/             # GDPR compliance endpoints
│   │   ├── products/         # Product CRUD
│   │   ├── search/           # Search functionality
│   │   └── webhooks/         # Clerk, Stripe, Resend webhooks
│   ├── admin/                # Admin dashboard pages
│   ├── dashboard/            # User dashboard
│   ├── pricing/              # Pricing page
│   ├── produse/              # Product pages ([brand]/[model]/[id])
│   └── search/               # Search page
├── components/                # React components
├── lib/                       # Core utilities and services
│   ├── actions/              # Server actions
│   ├── models/               # Mongoose models
│   ├── scraper/              # Scraping infrastructure
│   ├── services/             # Business logic
│   ├── mongoose.ts           # MongoDB connection with monitoring
│   ├── stripe.ts             # Stripe client
│   ├── upstash.ts            # Redis client
│   └── cache.ts              # Caching layer
├── hooks/                     # Custom React hooks
├── types/                     # TypeScript definitions
├── emails/                    # React Email templates
└── scripts/                   # Database scripts
```

### Core Patterns

**1. API Response Format (Consistent Across All Endpoints)**
```typescript
// Success
{ success: true, data: T, timestamp: string }

// Error
{ success: false, error: string }
```

**2. Database Queries**
- Always use `.lean()` for read-only queries (performance)
- Use compound indexes for frequent query patterns
- Implement caching via `dbPerformance.cachedQuery()`
- Monitor slow queries (>1s logged to Sentry)

**3. Authentication Flow**
- Middleware in `middleware.ts` protects routes
- Uses Clerk's `auth()` for user identification
- Webhook handlers in `app/api/webhooks/clerk/route.ts` sync user data to MongoDB
- Protected routes: `/dashboard`, `/admin`, `/api/products/user/*`

**4. Payment Flow**
- Checkout: `POST /api/checkout` → Stripe Checkout Session
- Webhooks: `POST /api/webhooks/stripe` handles subscription lifecycle
- Customer Portal: `POST /api/customer-portal` for self-service billing
- Subscription limits enforced in `lib/subscription-utils.ts`

**5. Scraping Architecture**
- Multi-strategy resilient scraper in `lib/scraper/resilient-scraper.ts`
- Strategies: Enhanced (proxy), Fallback (direct), Cached (Redis)
- Automatic fallback chain with exponential backoff
- Rate limiting per strategy via Upstash
- Cron job: `GET /api/cron/scraping` (runs every 6 hours per `vercel.json`)

**6. Caching Strategy**
```typescript
// Pattern for cached API endpoints
const cacheKey = `cache:${identifier}`;
const cached = await redis.get(cacheKey);
if (cached) return cached;

const data = await fetchData();
await redis.setex(cacheKey, TTL, data);
return data;
```

## Key Models

### User Model (`lib/models/user.model.ts`)
```typescript
{
  clerkId: string;              // Clerk user ID (unique)
  email: string;                // Email (unique)
  subscription: {
    plan: 'free' | 'pro' | 'enterprise';
    status: 'active' | 'cancelled' | 'past_due' | 'trialing';
    stripeCustomerId: string;
    stripeSubscriptionId: string;
  };
  usage: {
    productsTracked: number;
    maxProducts: number;
    apiCalls: number;
    emailsSent: number;
  };
  preferences: { notifications, currency, language, dashboard };
  consent: { functional, analytics, marketing };  // GDPR
}
```

**Important Methods:**
- `canTrackMoreProducts()`: Check subscription limits
- `incrementUsage(type)`: Track usage
- `generateApiKey()`: Create API key for Enterprise users

### Product Model (`lib/models/product.model.ts`)
```typescript
{
  url: string;                  // Unique product URL
  title: string;
  brand: string;
  category: string;
  currentPrice: number;
  originalPrice: number;
  currency: string;
  source: string;               // 'flip.ro', 'emag.ro', etc.
  isActive: boolean;
  lastChecked: Date;
  priceHistory: [{ price, date }];
  scraping: {
    selector: string;           // Last successful CSS selector
    failureCount: number;
    isBlocked: boolean;
  };
}
```

**Key Indexes:**
- Text search: `{ title: 'text', brand: 'text', description: 'text' }`
- Performance: `{ category: 1, brand: 1, currentPrice: 1 }`
- Scraping: `{ lastChecked: 1, isActive: 1 }`

### UserProductTracking Model
```typescript
{
  userId: string;               // Clerk user ID
  productId: ObjectId;          // Reference to Product
  isActive: boolean;
  alertThreshold: number;       // Price alert threshold
  priceAlert: {
    enabled: boolean;
    thresholdType: 'percentage' | 'fixed';
    threshold: number;
  };
}
```

**Unique Constraint:** `{ userId: 1, productId: 1 }`

## Critical Implementation Rules

### TypeScript Standards
- **Strict mode enabled** - No `any` types
- Use Zod for all input validation
- Define interfaces for all data structures
- Use type guards for runtime type safety

### Error Handling
```typescript
try {
  const result = await operation();
  return { success: true, data: result };
} catch (error) {
  Sentry.captureException(error, {
    tags: { section: 'module', action: 'operation' }
  });
  console.error('Operation failed:', error);
  return { success: false, error: 'User-friendly message' };
}
```

### Input Validation
```typescript
import { z } from 'zod';

const schema = z.object({
  url: z.string().url(),
  threshold: z.number().positive().optional(),
});

const validation = schema.safeParse(input);
if (!validation.success) {
  return Response.json({
    success: false,
    error: validation.error.errors
  }, { status: 400 });
}
```

### Rate Limiting
```typescript
import { Ratelimit } from '@upstash/ratelimit';
import { redis } from '@/lib/upstash';

const ratelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(10, '1 m'),
});

const { success } = await ratelimit.limit(identifier);
if (!success) {
  return Response.json({ error: 'Rate limit exceeded' }, { status: 429 });
}
```

### Performance Optimization
- Use `model.find().lean()` for read-only queries
- Implement Redis caching for expensive operations (TTL: 5-60 minutes)
- Use React `memo`, `useMemo`, `useCallback` for client components
- Aggregate queries for complex analytics
- Monitor query performance (queries >1s are logged)

## Webhook Implementation

### Clerk Webhooks (`/api/webhooks/clerk`)
**Required Events:**
- `user.created`: Create user in MongoDB
- `user.updated`: Sync user data
- `user.deleted`: Soft delete (GDPR)
- `session.created`: Update lastLoginAt

**Signature Verification:**
```typescript
import { Webhook } from 'svix';

const wh = new Webhook(process.env.CLERK_WEBHOOK_SECRET!);
const evt = wh.verify(body, headers);
```

### Stripe Webhooks (`/api/webhooks/stripe`)
**Required Events:**
- `customer.subscription.created`: Activate subscription
- `customer.subscription.updated`: Update subscription status
- `customer.subscription.deleted`: Handle cancellation
- `invoice.payment_succeeded`: Confirm payment
- `invoice.payment_failed`: Alert user, retry logic
- `checkout.session.completed`: Track conversion

**Implementation Pattern:**
```typescript
const event = stripe.webhooks.constructEvent(
  body,
  signature,
  process.env.STRIPE_WEBHOOK_SECRET!
);

switch (event.type) {
  case 'customer.subscription.created':
    await handleSubscriptionCreated(event.data.object);
    break;
  // ... handle all events
}

// Always update MRR metrics
await updateMRRMetrics(event.type, subscription);

// Always track business events
await trackBusinessEvent('subscription_started', userId, metadata);
```

## Cron Jobs (Vercel)

Configured in `vercel.json`:
- `/api/cron/scraping` - Every 6 hours - Scrape tracked products
- `/api/cron/process-alerts` - Daily at 9 AM - Process price alerts
- `/api/cron/security-scan` - Daily at 3 AM - Security audit
- `/api/cron/gdpr-cleanup` - Weekly Sunday 2 AM - GDPR data cleanup

**Cron Authorization:**
```typescript
const authHeader = request.headers.get('authorization');
if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
  return Response.json({ error: 'Unauthorized' }, { status: 401 });
}
```

## Testing Requirements

### Unit Tests (Jest)
- Location: `__tests__/` and co-located `*.test.ts` files
- Test utilities, business logic, and pure functions
- Mock external services (Stripe, Clerk, MongoDB)
- Target: >80% coverage

### E2E Tests (Playwright)
- Location: `tests/`
- Test critical user flows:
  - Registration → Add product → Receive alert
  - Free → Upgrade to Pro → Manage subscription
  - Search → View product → Track product

### Running Tests
```bash
npm test                       # Unit tests
npm run test:coverage          # With coverage
npm run test:e2e               # E2E tests
npm run test:e2e:ui            # Interactive mode
```

## Environment Variables

**Required:**
```env
# Database
MONGODB_URI=mongodb+srv://...

# Authentication
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_...
CLERK_SECRET_KEY=sk_...
CLERK_WEBHOOK_SECRET=whsec_...

# Payments
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_...
STRIPE_SECRET_KEY=sk_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Caching
UPSTASH_REDIS_REST_URL=https://...
UPSTASH_REDIS_REST_TOKEN=...

# Email
RESEND_API_KEY=re_...

# Monitoring
NEXT_PUBLIC_SENTRY_DSN=https://...
SENTRY_AUTH_TOKEN=...
NEXT_PUBLIC_AMPLITUDE_API_KEY=...

# Scraping (Optional)
BRIGHTDATA_USERNAME=...
BRIGHTDATA_PASSWORD=...

# Security
CRON_SECRET=...
NEXT_PUBLIC_APP_URL=https://...
```

## Database Connection

The MongoDB connection in `lib/mongoose.ts` includes:
- Connection pooling (10-20 connections)
- Automatic reconnection with exponential backoff
- Query performance monitoring (slow queries logged)
- Connection health checks
- Metrics tracking (query count, avg time, cache hit rate)

**Health Check:** `GET /api/admin/database/health`

## Security Best Practices

1. **Input Sanitization:** Use DOMPurify for HTML, Zod for validation
2. **Rate Limiting:** Implement on all public API endpoints
3. **CSRF Protection:** Handled by Next.js and Clerk
4. **SQL Injection:** Mongoose parameterized queries
5. **XSS Prevention:** Next.js automatic escaping
6. **Security Headers:** Applied in `middleware.ts` via `lib/security-headers.ts`

## Deployment (Vercel)

```bash
# Deploy to production
git push origin main

# Preview deployments
git push origin feature-branch
```

**Build Configuration:**
- Framework: Next.js
- Node version: >=20.0.0
- Build command: `npm run build`
- Environment: Set in Vercel dashboard

**Function Timeouts (vercel.json):**
- Cron jobs: 300s (5 min)
- Webhooks: 60s
- Scraping: 180s (3 min)
- Standard APIs: 30s

## Common Patterns

### Server Action Pattern
```typescript
'use server';
import { auth } from '@clerk/nextjs/server';

export async function serverAction(input: T) {
  const { userId } = auth();
  if (!userId) throw new Error('Unauthorized');

  // Validate input
  const validated = schema.parse(input);

  // Business logic
  const result = await performOperation(validated);

  // Revalidate if needed
  revalidatePath('/dashboard');

  return result;
}
```

### Pagination Pattern
```typescript
const result = await dbPerformance.createPaginatedQuery(
  Model,
  filter,
  { page: 1, limit: 20, sort: { createdAt: -1 }, cache: true }
);

// Returns: { data: T[], pagination: { page, limit, total, pages, hasNext, hasPrev } }
```

### Scraping Pattern
```typescript
const result = await scrapeWithRetry(product, maxRetries);
if (!result) {
  // All strategies failed
  await notifyAdmin('scraping_failed', product);
}
```

## Monitoring and Debugging

**Logs:**
- Console logs in development
- Sentry for production errors
- Amplitude for user events

**Metrics Endpoints:**
- `GET /api/admin/analytics` - Business metrics
- `GET /api/admin/scraping-stats` - Scraping health
- `GET /api/admin/database/health` - Database health
- `GET /api/admin/cache/health` - Redis health

**Performance:**
- Monitor API response times via Vercel Analytics
- Track slow queries via Sentry
- Monitor scraping success rate in admin dashboard

## Important Notes

- **NO Pages Router** - Only App Router patterns
- **NO CSS Modules** - Only Tailwind utility classes
- **NO custom auth** - Only Clerk
- **NO manual subscriptions** - Only Stripe webhooks
- All business metrics must be tracked for €2-5K MRR goal
- Scraping resilience is critical - always implement fallbacks
- GDPR compliance is mandatory (consent tracking, data export)
