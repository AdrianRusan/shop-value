# ShopValue Monetization Gap Analysis & Product Requirements Document

**Date**: August 12, 2025  
**Author**: System Analysis  
**Status**: Implementation Required  
**Target**: €1,000–€2,000 MRR in 90 days  

## Executive Summary

**Current State**: ShopValue has a solid technical foundation with authentication, billing, and basic price tracking, but is missing the **core monetization features** that differentiate it from competitors and drive revenue.

**Gap Analysis**: 10 critical areas require implementation, with 3 being **business-critical** for immediate revenue generation.

**Revenue Impact**: Current pricing structure and missing features prevent achieving the blueprint's €1,000-€2,000 MRR target.

---

## Current vs Blueprint Comparison

### ✅ What's Implemented Well
- **Authentication**: Clerk integration with proper user management
- **Billing Infrastructure**: Stripe checkout, webhooks, customer portal
- **Database Models**: Comprehensive User, Product, PriceAlert models
- **Email System**: Professional templates and notification system
- **API Structure**: Rate limiting, validation, error handling
- **Analytics**: Basic tracking and monitoring

### 🚨 Critical Missing Features

#### 1. **Pricing Structure Mismatch** (BUSINESS CRITICAL)
- **Current**: €19.99/mo Pro, €49.99/mo Enterprise
- **Blueprint**: €4.99/mo Pro, €59/mo Merchant
- **Free Plan**: Currently unlimited → Must limit to 2 alerts, 30-day history
- **Impact**: 4x price difference blocks target market conversion

#### 2. **Black Friday Score (BFS) Algorithm** (BUSINESS CRITICAL)
- **Status**: Completely missing
- **Blueprint Position**: Primary value proposition and differentiator
- **Algorithm**: `BFS = 0.7*(1 - current/median90) + 0.3*(1 - current/lowest180)`
- **Display**: 0-100 score with quality badges
- **Impact**: This IS the product - without it, no competitive advantage

#### 3. **Affiliate Revenue Stream** (BUSINESS CRITICAL)
- **Status**: No affiliate system
- **Blueprint Target**: 3-8% of traffic monetization
- **Missing**: `/go/[product]/[variant]` redirects, link wrapping, tracking
- **Impact**: Missing entire secondary revenue stream

---

## Critical Business Gaps (Implement First - Weeks 1-3)

### 🚨 PRIORITY 1: Pricing & Plan Restructure
**Impact**: Direct revenue impact - current pricing blocks market penetration
**Implementation Details**:

```typescript
// Update lib/stripe.ts
export const SUBSCRIPTION_PLANS = {
  free: {
    name: 'Free',
    priceId: null,
    amount: 0,
    maxProducts: 2,        // ← Currently unlimited
    maxAlerts: 2,          // ← New limit
    historyDays: 30,       // ← New limit
    features: ['2 price alerts', '30-day history', 'Daily notifications']
  },
  pro: {
    name: 'Pro',
    amountMonthly: 499,    // ← Change from 1999 to 499 (€4.99)
    amountYearly: 3990,    // ← 2 months free
    maxProducts: 50,
    maxAlerts: 50,         // ← Unlimited alerts
    historyDays: 365,      // ← Full history
    features: ['50 alerts', 'Full history', 'Telegram alerts', 'CSV export']
  }
}
```

**Timeline**: 1 week  
**Revenue Impact**: High - Makes Pro accessible to target market

### 🚨 PRIORITY 2: Black Friday Score (BFS) - Missing Flagship Feature
**Impact**: This is your **primary value proposition** and differentiator

**Algorithm Implementation**:
```sql
-- Required SQL for BFS calculation
WITH last90 AS (
  SELECT price
  FROM price_point
  WHERE variant_id = $1 AND ts >= now() - interval '90 days' AND available = true
), last180 AS (
  SELECT price
  FROM price_point
  WHERE variant_id = $1 AND ts >= now() - interval '180 days' AND available = true
), stats AS (
  SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY price) AS median90,
         MIN(price) AS lowest180
  FROM last90, last180
)
SELECT ROUND(100 * GREATEST(0, LEAST(1, 0.7*(1 - $2/stats.median90) + 0.3*(1 - $2/stats.lowest180)))),
       stats.median90, stats.lowest180
FROM stats;
```

**Required Implementation**:
- Add BFS calculation service
- Update Product model with BFS fields
- Add BFS badge component
- Display "Cel mai mic preț în 180 zile" badges
- Show scores: Poor (0–29), Meh (30–59), Real Deal (60–79), Great (80–100)

**Timeline**: 2 weeks  
**Revenue Impact**: Critical - This drives conversion

### 🚨 PRIORITY 3: Affiliate Revenue Stream
**Impact**: 3-8% of traffic monetization target from blueprint

**Required Implementation**:
```typescript
// app/api/go/[product]/[variant]/route.ts
export async function GET(request: NextRequest, { params }: { params: { product: string, variant: string } }) {
  // Record affiliate click
  await AffiliateClick.create({
    productId: params.product,
    variantId: params.variant,
    userId: getCurrentUserId(),
    url: request.url,
    ts: new Date()
  });
  
  // Redirect to affiliate URL with tracking
  const affiliateUrl = await getAffiliateUrl(params.product, params.variant);
  return NextResponse.redirect(affiliateUrl);
}
```

**Components Needed**:
- AffiliateClick model implementation
- `/go/[product]/[variant]` redirect endpoint
- Affiliate link wrapping for "Cumpără acum" buttons
- Integration with 2Performant/Profitshare
- UTM parameter preservation

**Timeline**: 2 weeks  
**Revenue Impact**: High - Secondary revenue stream

---

## High Impact Features (Weeks 4-6)

### 4. Watchlist UX Overhaul
**Current Issue**: Complex alert system with multiple types confuses users  
**Blueprint Solution**: Simple "Add to watchlist" with target price slider

### 5. Telegram Integration
**Missing**: Telegram bot for alerts (blueprint emphasizes email + Telegram)

### 6. SEO & Sharing Infrastructure
**Missing**: OG images, JSON-LD, dynamic sitemaps, share buttons

---

## Operational Features (Weeks 7-9)

### 7. Weekly Digest Automation
**Missing**: n8n automation for user retention

### 8. Data Model Migration
**Current**: MongoDB Product→PriceHistory  
**Blueprint**: Prisma Product→Variant→PricePoint structure

### 9. CSV Export & Merchant Features
**Missing**: Pro user value-adds

---

## Compliance & Polish (Weeks 10-12)

### 10. Legal & GDPR Compliance
**Missing**: Privacy Policy, Terms, Cookie consent, GDPR data export

---

## Implementation Priority Matrix

| Feature | Revenue Impact | Implementation Effort | Priority Score |
|---------|---------------|----------------------|----------------|
| Pricing Restructure | 🔥🔥🔥 | 🔧 | **CRITICAL** |
| Black Friday Score | 🔥🔥🔥 | 🔧🔧 | **CRITICAL** |
| Affiliate System | 🔥🔥 | 🔧🔧 | **CRITICAL** |
| Watchlist UX | 🔥🔥 | 🔧 | **HIGH** |
| Telegram Alerts | 🔥 | 🔧 | **HIGH** |
| SEO Infrastructure | 🔥🔥 | 🔧🔧 | **HIGH** |

---

## Estimated Development Timeline

**Phase 1 (Weeks 1-3): Revenue Critical**
- Week 1: Pricing restructure + plan limits
- Week 2-3: Black Friday Score implementation
- Week 3: Affiliate system foundation

**Phase 2 (Weeks 4-6): Growth Features**
- Week 4: Watchlist UX overhaul
- Week 5: Telegram integration
- Week 6: SEO infrastructure

**Phase 3 (Weeks 7-12): Scale & Polish**
- Weeks 7-9: Automation & merchant features
- Weeks 10-12: Compliance & data model optimization

---

## Success Metrics to Track

**Revenue KPIs:**
- MRR growth (target: €1,000-€2,000)
- Pro conversion rate (target: 150-300 conversions)
- Affiliate revenue (target: 3-8% of traffic)

**Product KPIs:**
- BFS usage/engagement
- Watchlist additions per user
- Weekly digest open rates
- Affiliate click-through rates

**Technical KPIs:**
- Alert delivery success rate
- Page load times for BFS calculations
- SEO ranking improvements

---

## Recommended Next Steps

1. **Immediate (This Week)**: Start with pricing restructure - update Stripe plans and plan limits
2. **Week 2**: Begin BFS algorithm implementation - this is your killer feature
3. **Week 3**: Parallel development of affiliate system
4. **Weekly Reviews**: Track conversion rates and adjust priorities based on data

---

## Conclusion

The current codebase provides an excellent foundation with solid authentication, billing, and API infrastructure. However, achieving the €1,000–€2,000 MRR target requires implementing the monetization-focused features that differentiate ShopValue in the market.

The three critical priorities (pricing, BFS, affiliate system) address the core revenue blockers and should be implemented immediately for maximum business impact.

---

*This analysis is based on comparison between the current codebase implementation and the comprehensive 90-day monetization blueprint.*