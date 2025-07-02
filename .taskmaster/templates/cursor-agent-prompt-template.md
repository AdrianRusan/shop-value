# Universal Cursor AI Agent Prompt for ShopValue SaaS Implementation

## 🎯 PROJECT CONTEXT & MISSION

You are implementing a task for **ShopValue**, a Romanian price tracking SaaS platform targeting €2-5K MRR in 6 months with <2 hours/week maintenance.

**Current State:** Functional Next.js app with existing components, MongoDB models, and scraping infrastructure  
**Goal:** Transform into automated, revenue-generating SaaS with minimal manual intervention  
**Tech Stack:** Next.js 14 + TypeScript + Tailwind + Clerk + Stripe + MongoDB + Upstash Redis + Resend + Sentry

---

## 📋 MANDATORY REQUIREMENTS

### **1. ALWAYS READ CURSOR RULES FIRST**
```bash
# Before writing ANY code, read these files:
- .cursor/rules/shopvalue-project.mdc (main project rules)
- .cursor/rules/authentication.mdc (Clerk patterns)  
- .cursor/rules/payments.mdc (Stripe integration)
- .cursor/rules/risk-mitigation.mdc (business protection)
```

### **2. TRACK TASK STATUS WITH TASK-MASTER**
```bash
# MANDATORY: Update task status as you work
# At start of work:
task-master set-status --id=X --status=in-progress

# During implementation:
task-master update-subtask --id=X.Y --prompt="Progress update: [details]"

# Upon completion:
task-master set-status --id=X --status=done
```

### **3. ANALYZE EXISTING CODEBASE**
```bash
# Study existing implementation:
- lib/models/ (User, Product, Analytics models)
- lib/scraper/index.ts (existing scraping system)
- components/ (ProductCard, Searchbar, Navbar, etc.)
- app/produse/ (existing product pages)
- scripts/db-setup.js (migration scripts)
```

### **4. FOLLOW EXACT TECH STACK (NO SUBSTITUTIONS)**
- **Authentication:** ONLY Clerk (no custom auth, no NextAuth)
- **Payments:** ONLY Stripe (no other processors)
- **Database:** ONLY MongoDB with Mongoose (no PostgreSQL)
- **Caching:** ONLY Upstash Redis (no other Redis services)
- **Email:** ONLY Resend with React Email templates
- **Monitoring:** ONLY Sentry for error tracking
- **Styling:** ONLY Tailwind CSS (no CSS modules, no styled-components)

### **5. VALIDATE BUILD SUCCESS**
```bash
# CRITICAL: Always ensure project builds successfully
npm run build  # Must pass without errors
npm run type-check  # Must pass TypeScript validation
npm run lint  # Must pass linting
npm test  # Must pass all tests
```

---

## 🧪 TESTING REQUIREMENTS

### **Mandatory Testing Protocol:**
1. **Unit Tests:** Test all functions, utilities, components
2. **Integration Tests:** Test API endpoints, database operations  
3. **E2E Tests:** Test complete user workflows with Playwright
4. **Error Scenarios:** Test all failure modes and edge cases
5. **Performance Tests:** Ensure <200ms API response times
6. **Security Tests:** Validate input sanitization and auth
7. **Build Validation:** `npm run build` must succeed

### **Test Files Structure:**
```
__tests__/
├── components/ (React component tests)
├── lib/ (utility function tests)
├── api/ (API endpoint tests)
└── e2e/ (end-to-end workflow tests)
```

---

## 🔧 IMPLEMENTATION STANDARDS

### **Code Quality Requirements:**
```typescript
// ✅ DO: Use TypeScript strict mode, no 'any' types
interface UserSubscription {
  plan: 'free' | 'pro' | 'enterprise';
  stripeSubscriptionId: string;
  status: 'active' | 'cancelled' | 'past_due';
}

// ❌ DON'T: Use any or loose typing  
const subscription: any = userSubscription;
```

### **Error Handling Pattern:**
```typescript
// ✅ DO: Comprehensive error handling with Sentry
try {
  const result = await riskyOperation();
  return { success: true, data: result };
} catch (error) {
  Sentry.captureException(error);
  console.error('Operation failed:', error);
  return { success: false, error: error.message };
}
```

### **API Response Pattern:**
```typescript
// ✅ DO: Consistent API responses
return Response.json({ 
  success: true, 
  data: results,
  metadata: { count: results.length, timestamp: new Date() }
});
```

---

## 🚀 AUTOMATION REQUIREMENTS

### **Webhook Implementation (Critical):**
```typescript
// ✅ DO: Always implement webhook signature verification
const signature = request.headers.get('stripe-signature');
const event = stripe.webhooks.constructEvent(body, signature!, webhookSecret);

// ❌ DON'T: Skip webhook verification (security risk)
```

### **Queue Processing Pattern:**
```typescript
// ✅ DO: Use Bull queues for async processing
import { Queue } from 'bullmq';
const emailQueue = new Queue('email-processing', { 
  connection: redis,
  defaultJobOptions: { removeOnComplete: 100, attempts: 3 }
});
```

---

## 📊 PERFORMANCE REQUIREMENTS

### **Caching Strategy:**
```typescript
// ✅ DO: Cache expensive operations
const cacheKey = `product:${productId}:prices`;
const cachedData = await redis.get(cacheKey);
if (cachedData) return JSON.parse(cachedData);

const freshData = await expensiveDbQuery();
await redis.setex(cacheKey, 300, JSON.stringify(freshData));
```

### **Database Optimization:**
```typescript
// ✅ DO: Use proper indexes and lean queries
const products = await Product.find({ userId })
  .select('title currentPrice brand category')
  .lean() // 50% performance improvement
  .limit(20);
```

---

## 🛡️ SECURITY REQUIREMENTS

### **Input Validation:**
```typescript
import { z } from 'zod';

const createProductSchema = z.object({
  url: z.string().url(),
  userId: z.string().min(1),
  alertPrice: z.number().positive().optional()
});

// ✅ DO: Validate all inputs
const validatedData = createProductSchema.parse(requestBody);
```

### **Rate Limiting:**
```typescript
// ✅ DO: Implement rate limiting for all API endpoints
const rateLimiter = new Ratelimit({
  redis: upstashRedis,
  limiter: Ratelimit.slidingWindow(10, '1 m'),
});
```

---

## 📈 SUCCESS CRITERIA

### **Functional Requirements:**
- [ ] All task requirements implemented and working
- [ ] Integration with existing codebase seamless
- [ ] No breaking changes to existing functionality
- [ ] All error scenarios handled gracefully
- [ ] Performance meets <200ms API response requirement
- [ ] `npm run build` completes successfully

### **Quality Requirements:**
- [ ] 100% TypeScript strict mode compliance
- [ ] >90% test coverage for new code
- [ ] All Cursor rules followed exactly
- [ ] Sentry error tracking implemented
- [ ] Rate limiting and input validation in place
- [ ] Task status properly tracked in task-master

### **Documentation Requirements:**
- [ ] Code is self-documenting with clear variable names
- [ ] Complex logic has inline comments
- [ ] API endpoints documented with examples
- [ ] Integration steps documented for future maintenance

---

## 🔄 DEVELOPMENT WORKFLOW

### **Implementation Process:**
1. **Start Task:** `task-master set-status --id=X --status=in-progress`
2. **Analyze:** Read existing code, understand current implementation
3. **Plan:** Design solution that integrates with existing architecture  
4. **Code:** Implement following all Cursor rules and patterns
5. **Test:** Write comprehensive tests for all scenarios
6. **Build:** Validate with `npm run build` (must succeed)
7. **Integrate:** Ensure seamless integration with existing features
8. **Validate:** Run full test suite and manual validation
9. **Complete:** `task-master set-status --id=X --status=done`
10. **Document:** Add any necessary documentation

### **Quality Checkpoints:**
- ✅ Cursor rules compliance verified
- ✅ TypeScript strict mode passing
- ✅ `npm run build` succeeds without errors
- ✅ All tests passing (unit + integration + e2e)
- ✅ Performance requirements met
- ✅ Security requirements implemented
- ✅ Error handling with Sentry working
- ✅ Integration with existing code validated
- ✅ Task status updated in task-master

---

## 🚨 CRITICAL SUCCESS FACTORS

### **Business Impact:**
- Feature must support revenue generation (subscription tiers)
- Must work reliably with minimal manual intervention
- Must scale to support 1000+ concurrent users
- Must maintain >95% uptime for business operations

### **Technical Excellence:**
- Zero tolerance for 'any' types or loose typing
- All external API calls must have proper error handling
- All database operations must be optimized and indexed
- All user inputs must be validated and sanitized
- `npm run build` must always succeed

### **Automation Focus:**
- Implement automated testing for all new functionality
- Use webhooks for all external service integrations
- Implement monitoring and alerting for critical operations
- Design for self-healing and automatic recovery

### **Integration Requirements:**
- Must work with existing User model in `lib/models/user.model.ts`
- Must integrate with existing scraping system in `lib/scraper/index.ts`
- Must maintain compatibility with existing components in `components/`
- Must follow existing database schema and migration patterns

### **Task Management:**
- Update task status to "in-progress" when starting work
- Log progress using `task-master update-subtask` during implementation
- Update task status to "done" upon successful completion
- Ensure all subtasks are properly tracked and completed

---

**Remember:** This is a production SaaS application targeting real revenue. Code quality, security, reliability, and proper task tracking are non-negotiable. Follow the Cursor rules exactly, test thoroughly, validate builds, and build for scale from day one. 