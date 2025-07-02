# Universal Cursor AI Agent Instruction

Implement **Task #X** for ShopValue SaaS using the comprehensive template in `.taskmaster/templates/cursor-agent-prompt-template.md`.

## 📋 **Required Analysis & Implementation Steps:**

### **1. Read All Context First**
- Read the universal template: `.taskmaster/templates/cursor-agent-prompt-template.md`
- Review task details: `.taskmaster/tasks/Task-X.md` 
- Update the status of the task to in progress.
- Read all Cursor rules: `.cursor/rules/*.mdc`
- Study existing codebase architecture and current implementation

### **2. Analyze Current State**
- Examine existing models: `lib/models/*.ts`
- Review existing components: `components/*.tsx`
- Check existing API routes: `app/api/**/*.ts`
- Assess existing scraping system: `lib/scraper/index.ts`
- Understand current database structure and migrations
- Identify integration points with existing functionality

### **3. Implement Requirements**
- Follow ALL Cursor rules exactly (no exceptions)
- Use ONLY the specified tech stack (Clerk, Stripe, MongoDB, Upstash Redis, Resend, Sentry)
- Implement all task subtasks as detailed in the task file
- Ensure seamless integration with existing codebase
- Preserve ALL existing functionality and data structures
- Optimize for production performance and reliability

### **4. Testing & Quality Assurance**
- Write comprehensive unit tests for all new functionality
- Create integration tests for API endpoints and database operations
- Implement end-to-end tests for complete user workflows
- Test all error scenarios and edge cases
- Verify performance requirements (<200ms API responses)
- Validate security measures (input validation, rate limiting)
- Ensure TypeScript strict mode compliance (zero 'any' types)

### **5. Production Readiness**
- Implement proper error handling with Sentry integration
- Add appropriate caching strategies using Upstash Redis
- Ensure webhook signature verification for all external services
- Implement rate limiting for all API endpoints
- Add monitoring and alerting for critical operations
- Document any new APIs or complex implementation details

### **6. Business Requirements**
- Ensure feature supports revenue generation and subscription tiers
- Design for minimal manual intervention (<2 hours/week maintenance)
- Scale to support 1000+ concurrent users
- Maintain >95% uptime for business operations
- Implement automated testing, deployment, and recovery mechanisms

## 🎯 **Success Criteria:**
- ✅ All task requirements fully implemented and tested
- ✅ Zero breaking changes to existing functionality
- ✅ Complete integration with existing User, Product, and Analytics models
- ✅ All Cursor rules followed exactly
- ✅ Project built successfully
- ✅ Production-ready code with comprehensive error handling
- ✅ Performance optimized with appropriate caching
- ✅ Security validated (input sanitization, authentication, rate limiting)
- ✅ Comprehensive test coverage (>90% for new code)
- ✅ Documentation complete for maintenance and future development

**Implementation Note:** This is a production SaaS targeting real revenue. Code quality, security, reliability, and seamless integration with existing systems are non-negotiable requirements. 