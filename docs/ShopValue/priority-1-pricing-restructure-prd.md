# Priority 1: Pricing & Plan Restructure - Comprehensive PRD

**Date**: August 12, 2025  
**Priority**: CRITICAL - Business Revenue Blocker  
**Timeline**: 1 Week Implementation  
**Revenue Impact**: High - Direct conversion improvement  
**Dependencies**: Stripe plan creation, User model updates, UI changes

---

## Problem Statement

**Current State Issues:**
- Pro plan at €19.99/mo is **4x higher** than blueprint target of €4.99/mo
- Free plan is too generous (5 products vs required 2 alerts)
- Missing Merchant plan (€59/mo) for B2B revenue
- Enterprise plan positioning doesn't match target market
- Plan limits don't enforce the freemium conversion funnel

**Business Impact:**
- Current pricing blocks 80%+ of target Romanian market (price sensitivity)
- Free plan cannibalization - users have no reason to upgrade
- Missing €59/mo merchant revenue stream
- Not aligned with competitor pricing analysis from blueprint

---

## Solution Overview

### New Pricing Structure (Aligned with Blueprint)

| Plan | Current | New Target | Change | Market Position |
|------|---------|------------|--------|-----------------|
| **Free** | €0, 5 products | €0, 2 alerts, 30-day history | Limit reduction | Entry level |
| **Pro** | €19.99/mo | €4.99/mo | **-75% price** | Consumer sweet spot |
| **Merchant** | Missing | €59/mo | New plan | B2B revenue |
| **Enterprise** | €49.99/mo | Remove/Replace | Repositioning | Focus on Merchant |

---

## Detailed Plan Specifications

### 🆓 Free Plan (Freemium Hook)
**Purpose**: Lead generation and product validation

**Limits & Features:**
```yaml
Pricing: €0/month
Limits:
  - max_alerts: 2 (reduced from current 5 products)
  - history_days: 30 (new limit)
  - check_frequency: 24 hours (daily only)
  - no_telegram: true
  - no_csv_export: true
  - no_api_access: true

Features:
  - "2 price alerts"
  - "30-day price history"
  - "Daily email notifications"
  - "Basic Black Friday Score"
  - "Community support"

Conversion Strategy:
  - Show "upgrade" prompts when hitting limits
  - Display Pro features as "locked"
  - Highlight savings potential with Pro features
```

**User Journey:**
1. User signs up and adds 2 products easily
2. Tries to add 3rd product → blocked with upgrade prompt
3. Sees limited 30-day history vs full history in Pro
4. Converts when they find value in the 2 alerts

### 💪 Pro Plan (Revenue Driver)
**Purpose**: Primary revenue generator for consumers

**Pricing Strategy:**
```yaml
Pricing: 
  monthly: €4.99
  yearly: €39.90 (2 months free)
  
Target Conversion: 150-300 users (blueprint goal)
ARPU Target: €4.99 * 200 users = €998/month
```

**Features & Limits:**
```yaml
Limits:
  - max_alerts: 50 (sufficient for power users)
  - history_days: 365 (full year)
  - check_frequency: 6 hours (4x daily)
  - telegram_alerts: true
  - csv_export: true
  - api_calls: 1000/month

Features:
  - "50 product alerts"
  - "Full price history (365 days)"
  - "4x daily price checks"
  - "Email + Telegram alerts"
  - "CSV export for analysis"
  - "Advanced Black Friday Score"
  - "Priority email support"
  - "Price drop analytics"

Value Proposition:
  - "Never miss a deal again"
  - "Save hundreds on Black Friday"
  - "Track all your wishlist items"
```

**Conversion Triggers:**
- Free user hits 2-alert limit
- User wants longer price history
- User wants faster notifications (6hr vs 24hr)
- User wants Telegram alerts
- User wants to export data

### 🏢 Merchant Plan (B2B Revenue)
**Purpose**: Competitive intelligence for Romanian businesses

**Pricing Strategy:**
```yaml
Pricing:
  monthly: €59.00
  yearly: €590.00 (2 months free)
  
Target: 20-50 merchants
Revenue Potential: €59 * 30 = €1,770/month
```

**Features & Limits:**
```yaml
Limits:
  - max_skus: 250 (competitor monitoring)
  - check_frequency: 1 hour
  - api_calls: 10000/month
  - custom_reports: true
  - dedicated_support: true

Features:
  - "250 competitor SKUs monitoring"
  - "Hourly price monitoring"
  - "Weekly competitor reports"
  - "CSV/PDF bulk exports"
  - "Email digest automation"
  - "Basic API access"
  - "Competitor price alerts"
  - "Market trend analysis"
  - "Dedicated account support"

Target Customers:
  - Small e-commerce businesses
  - Resellers on Flip.ro
  - Marketing agencies
  - Product managers
```

---

## Implementation Breakdown

### Phase 1: Stripe Configuration (Day 1-2)
**Required Actions:**
1. **Create New Stripe Products:**
   ```bash
   # New Stripe price IDs needed:
   STRIPE_PRO_MONTHLY_PRICE_ID_NEW=price_xxx (€4.99)
   STRIPE_PRO_YEARLY_PRICE_ID_NEW=price_xxx (€39.90)
   STRIPE_MERCHANT_MONTHLY_PRICE_ID=price_xxx (€59.00)
   STRIPE_MERCHANT_YEARLY_PRICE_ID=price_xxx (€590.00)
   ```

2. **Update Environment Variables:**
   - Add new price IDs to production environment
   - Keep old price IDs for existing customers (grandfathering)

### Phase 2: Code Updates (Day 2-4)

#### 2.1 Update Stripe Configuration
**File**: `lib/stripe.ts`
- Update SUBSCRIPTION_PLANS object with new pricing
- Add merchant plan configuration
- Update plan limits and features

#### 2.2 Update User Model Validation
**File**: `lib/models/user.model.ts`
- Add merchant plan to subscription enum
- Update usage limits logic in pre-save middleware
- Add new limit fields (historyDays, maxAlerts)

#### 2.3 Update Billing Logic
**File**: `app/api/webhooks/stripe/route.ts`
- Handle merchant plan in webhook processing
- Update plan limits assignment in handleSubscriptionCreated
- Add grandfathering logic for existing customers

#### 2.4 Update Pricing Page
**File**: `app/pricing/page.tsx`
- Replace Enterprise with Merchant plan
- Update pricing display (€4.99 vs €19.99)
- Update feature lists per plan
- Add "Most Popular" tag to Pro plan

### Phase 3: Limit Enforcement (Day 4-6)

#### 3.1 Alert Creation Limits
**Files**: `app/api/alerts/route.ts`, `components/PriceAlertModal.tsx`
```typescript
// Example enforcement logic
const canCreateAlert = async (userId: string) => {
  const user = await User.findOne({ clerkId: userId });
  const currentAlerts = await PriceAlert.countDocuments({ userId, isActive: true });
  
  const maxAlerts = user.subscription.plan === 'free' ? 2 : 
                   user.subscription.plan === 'pro' ? 50 : 250;
  
  return currentAlerts < maxAlerts;
};
```

#### 3.2 History Access Limits
**Files**: API routes returning historical data
```typescript
// Limit history based on plan
const getHistoryLimit = (userPlan: string) => {
  const limits = {
    free: 30,      // 30 days
    pro: 365,      // 1 year  
    merchant: 365  // 1 year
  };
  return limits[userPlan] || 30;
};
```

#### 3.3 Feature Access Gates
**Components**: Throughout the app
- Telegram settings (Pro+ only)
- CSV export (Pro+ only) 
- API access (Merchant only)
- Advanced analytics (Pro+ only)

### Phase 4: Migration Strategy (Day 6-7)

#### 4.1 Existing Customer Handling
**Strategy**: Grandfather existing customers, encourage plan changes
```typescript
// Migration logic for existing customers
const migrateExistingCustomers = async () => {
  // Option 1: Grandfather existing Pro customers at €19.99
  // Option 2: Offer discount to migrate to new pricing
  // Option 3: Force migration with notice period
};
```

#### 4.2 Communication Plan
**Email Sequence**:
1. **Announcement**: "We're making ShopValue more affordable!"
2. **Migration Notice**: "Your plan is changing" (if forced migration)
3. **Feature Highlight**: "New features available in your plan"

---

## User Experience Impact

### Free User Journey Changes
**Before**: Signs up → can track 5 products → rarely converts
**After**: Signs up → quickly hits 2-alert limit → sees clear upgrade value → converts

### Conversion Funnel Optimization
```
Visitor → Sign up (Free) → Use 2 alerts → Hit limit → See Pro value → Convert
Expected conversion: 10-15% (vs current <5%)
```

### UI/UX Updates Required

#### Pricing Page Redesign
- Highlight Pro as "Most Popular" 
- Show savings: "Save €180/year vs old pricing"
- Add merchant testimonials/use cases
- Clear feature comparison table

#### Dashboard Limit Indicators
```jsx
// Example limit display
<div className="plan-limits">
  <span>Alerts: {currentAlerts}/{maxAlerts}</span>
  {currentAlerts >= maxAlerts && (
    <Button>Upgrade to Pro for unlimited alerts</Button>
  )}
</div>
```

#### Upgrade Prompts
- Context-aware upgrade suggestions
- Clear value proposition per upgrade trigger
- One-click upgrade flow

---

## Revenue Projections

### Conservative Scenario (Month 3)
```
Free Users: 1000
Pro Conversions: 150 (15% conversion)
Merchant Customers: 10

Monthly Revenue:
- Pro: 150 × €4.99 = €748.50
- Merchant: 10 × €59.00 = €590.00
- Total MRR: €1,338.50 ✅ (exceeds €1,000 target)
```

### Optimistic Scenario (Month 3)
```
Free Users: 2000
Pro Conversions: 300 (15% conversion)
Merchant Customers: 25

Monthly Revenue:
- Pro: 300 × €4.99 = €1,497.00
- Merchant: 25 × €59.00 = €1,475.00
- Total MRR: €2,972.00 ✅ (exceeds €2,000 target)
```

---

## Success Metrics & KPIs

### Conversion Metrics
- **Free to Pro conversion rate**: Target 10-15% (vs current <5%)
- **Visitor to signup rate**: Track impact of new pricing visibility
- **Time to first paid conversion**: Reduce from weeks to days

### Revenue Metrics
- **Monthly Recurring Revenue (MRR)**: Target €1,000-€2,000
- **Average Revenue Per User (ARPU)**: Track by plan
- **Customer Lifetime Value (LTV)**: Measure retention impact

### User Behavior Metrics
- **Alert creation rate**: Free users hitting 2-alert limit
- **Feature utilization**: CSV exports, Telegram usage
- **Support ticket volume**: Monitor for confusion

### Business Intelligence
- **Churn rate by plan**: Compare old vs new pricing
- **Upgrade path analysis**: Which features drive conversions
- **Merchant adoption**: B2B market penetration

---

## Risk Assessment & Mitigation

### High Risks
1. **Existing Customer Churn**: Current customers may leave if forced to new pricing
   - **Mitigation**: Grandfather existing customers, offer migration incentives

2. **Free Plan Abuse**: Users creating multiple accounts for more alerts
   - **Mitigation**: Email verification, IP tracking, device fingerprinting

3. **Pro Plan Cannibalization**: Too much value in Pro, no merchant upgrades
   - **Mitigation**: Clear B2B features distinction, merchant-specific marketing

### Medium Risks
1. **Development Complexity**: Plan limit enforcement across codebase
   - **Mitigation**: Centralized plan checking service, comprehensive testing

2. **Support Volume**: Users confused by plan changes
   - **Mitigation**: Clear documentation, FAQ updates, email communication

### Low Risks
1. **Stripe Integration Issues**: New pricing plans not working
   - **Mitigation**: Thorough testing in staging, gradual rollout

---

## Testing Strategy

### Pre-Launch Testing
1. **Stripe Integration**: Test all new price points and webhooks
2. **Limit Enforcement**: Verify free plan restrictions work correctly
3. **Upgrade Flow**: Test conversion path from free to paid
4. **Grandfathering**: Ensure existing customers unaffected

### A/B Testing Post-Launch
1. **Free Plan Limits**: Test 2 vs 3 alerts for conversion optimization
2. **Pro Pricing**: Test €4.99 vs €5.99 for revenue optimization
3. **Feature Positioning**: Test different value propositions

### Success Criteria
- No increase in support tickets
- >95% uptime during migration
- Zero billing errors
- Improved conversion metrics within 2 weeks

---

## Launch Plan

### Week 1: Implementation
- **Day 1-2**: Stripe setup and environment configuration
- **Day 3-4**: Code updates and limit enforcement
- **Day 5-6**: Testing and bug fixes
- **Day 7**: Soft launch to beta users

### Post-Launch Monitoring (Week 2)
- **Daily**: Revenue and conversion tracking
- **Weekly**: User feedback analysis and plan optimization

### Communication Timeline
- **Day -3**: Announce pricing changes to existing customers
- **Day 0**: Launch new pricing publicly
- **Day +7**: Send usage/upgrade prompts to free users
- **Day +14**: Analyze results and optimize

---

## Conclusion

This pricing restructure is the **most critical** change needed to achieve the blueprint's revenue targets. The current €19.99 Pro pricing is a fundamental barrier to market penetration in Romania.

**Expected Outcomes:**
- **3-4x increase** in Pro plan conversions
- **New revenue stream** from Merchant plan
- **Clear upgrade path** for free users
- **Market-competitive positioning**

**Implementation Priority**: This should be the **first change made** before any other feature development, as it unlocks the entire monetization strategy outlined in the blueprint.

The technical implementation is straightforward, but the business impact is transformational - this single change can move ShopValue from a nice-to-have tool to a must-have service for price-conscious Romanian consumers.