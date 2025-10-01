# Priority 3: Affiliate Revenue System - Comprehensive PRD

**Date**: August 12, 2025  
**Priority**: CRITICAL - Secondary Revenue Stream  
**Timeline**: 2 Weeks Implementation  
**Revenue Impact**: 3-8% of traffic monetization (Blueprint target)  
**Dependencies**: Affiliate network partnerships, Tracking infrastructure, Legal compliance

---

## Problem Statement

**Missing Revenue Stream**: The blueprint targets 3-8% of traffic monetization through affiliate commissions, but ShopValue currently has **zero affiliate integration**.

**Business Impact:**
- Missing €200-800/month potential revenue (based on traffic projections)
- Users click through to merchants with no value capture
- No diversification beyond subscription revenue
- Competitive disadvantage vs affiliate-enabled price trackers

**User Impact**: Users currently get no additional value for price comparison research - no cashback, deals, or incentives.

---

## Solution Overview: Comprehensive Affiliate System

### Core Architecture
```
User clicks "Cumpără acum" → /go/[product]/[variant] → Track click → Redirect to affiliate URL with tags → Commission earned
```

### Revenue Model
```yaml
Revenue Streams:
  1. Commission per sale (2-8% depending on category)
  2. Cost-per-click (CPC) partnerships 
  3. Featured placement fees from merchants
  4. Cashback program (share commission with users)

Target Revenue:
  Conservative: €200-400/month (3-5% monetization)
  Optimistic: €600-1000/month (5-8% monetization)
```

---

## Detailed Feature Specifications

### 🔗 Affiliate Link Management System

#### URL Structure & Routing
```typescript
// Affiliate URL patterns
/go/[productId]/[variantId]     // Basic product redirect
/go/[productId]/[variantId]/[campaignId]  // Campaign-specific
/deal/[productId]               // Special deals/offers
/cashback/[productId]           // Cashback-enabled links

// Example URLs:
/go/abc123/var456               // Standard affiliate link
/go/abc123/var456/blackfriday   // Black Friday campaign
/deal/abc123                    // Special deal highlight
```

#### Affiliate Partner Integration
```yaml
Primary Partners (Romania):
  1. 2Performant:
     - Commission: 2-6%
     - Categories: Electronics, Fashion, Home
     - Setup: API integration + pixel tracking
     
  2. Profitshare:
     - Commission: 3-8% 
     - Categories: Tech, Books, Sports
     - Setup: Direct affiliate links
     
  3. eMAG Affiliate:
     - Commission: 1-4%
     - Categories: All electronics
     - Setup: Custom integration
     
  4. Flip.ro Partnership:
     - Commission: 2-5%
     - Categories: Refurbished electronics
     - Setup: Direct partnership negotiation

Secondary Partners:
  - Amazon Associates (international products)
  - Altex affiliate program
  - Fashion Days affiliate
```

### 🎯 Click Tracking & Analytics

#### AffiliateClick Model Enhancement
```typescript
// Enhanced affiliate tracking model
interface IAffiliateClick extends Document {
  // Basic tracking
  userId?: string;              // Clerk user ID (if logged in)
  sessionId: string;            // Anonymous session tracking
  productId: string;            // Product being clicked
  variantId?: string;           // Specific product variant
  
  // Affiliate details
  partnerName: string;          // '2performant', 'profitshare', etc.
  partnerClickId?: string;      // Partner's tracking ID
  affiliateUrl: string;         // Final destination URL
  
  // User context
  userAgent: string;            // Browser/device info
  ipAddress: string;            // User location
  referer?: string;             // How they got to our site
  utmSource?: string;           // Marketing campaign source
  utmMedium?: string;           // Marketing medium
  utmCampaign?: string;         // Specific campaign
  
  // Conversion tracking
  clickedAt: Date;              // When click occurred
  convertedAt?: Date;           // When purchase happened (webhook)
  commissionAmount?: number;    // Commission earned (in cents)
  orderValue?: number;          // Total order value
  status: 'clicked' | 'converted' | 'expired';
  
  // Device & context
  deviceType: 'mobile' | 'desktop' | 'tablet';
  country: string;              // Detected country
  city?: string;                // Detected city
  
  // Internal analytics
  pageLoadTime?: number;        // Performance tracking
  timeOnPage?: number;          // Engagement before click
  priceAtClick: number;         // Product price when clicked
  bfsScoreAtClick?: number;     // BFS score when clicked
}
```

#### Advanced Analytics Dashboard
```typescript
// Affiliate performance metrics
interface AffiliateMetrics {
  daily: {
    clicks: number;
    conversions: number;
    revenue: number;
    conversionRate: number;
    averageOrderValue: number;
  };
  
  byPartner: {
    [partnerName: string]: {
      clicks: number;
      conversions: number;
      revenue: number;
      conversionRate: number;
    };
  };
  
  byProduct: {
    productId: string;
    productTitle: string;
    clicks: number;
    conversions: number;
    revenue: number;
  }[];
  
  topPerformers: {
    bestConvertingProducts: Product[];
    bestRevenueDays: Date[];
    mostClickedCategories: string[];
  };
}
```

---

## Technical Implementation

### Phase 1: Database & Models (Days 1-3)

#### AffiliateClick Model Implementation
```typescript
// lib/models/affiliate-click.model.ts
import mongoose, { Document, Model } from 'mongoose';

const affiliateClickSchema = new mongoose.Schema({
  // Tracking identifiers
  userId: {
    type: String,
    index: true,
    sparse: true
  },
  sessionId: {
    type: String,
    required: true,
    index: true
  },
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true,
    index: true
  },
  
  // Affiliate partner info
  partnerName: {
    type: String,
    required: true,
    enum: ['2performant', 'profitshare', 'emag', 'flip', 'amazon'],
    index: true
  },
  partnerClickId: String,
  affiliateUrl: {
    type: String,
    required: true
  },
  
  // User context
  userAgent: String,
  ipAddress: {
    type: String,
    required: true
  },
  referer: String,
  utmSource: String,
  utmMedium: String,
  utmCampaign: String,
  
  // Timing and conversion
  clickedAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  convertedAt: {
    type: Date,
    index: true
  },
  commissionAmount: {
    type: Number,
    default: 0
  },
  orderValue: {
    type: Number,
    default: 0
  },
  status: {
    type: String,
    enum: ['clicked', 'converted', 'expired'],
    default: 'clicked',
    index: true
  },
  
  // Context at click time
  priceAtClick: {
    type: Number,
    required: true
  },
  bfsScoreAtClick: Number,
  
  // Device info
  deviceType: {
    type: String,
    enum: ['mobile', 'desktop', 'tablet'],
    default: 'desktop'
  },
  country: {
    type: String,
    default: 'RO'
  },
  city: String,
  
  // Performance metrics
  pageLoadTime: Number,
  timeOnPage: Number
}, {
  timestamps: true
});

// Indexes for performance
affiliateClickSchema.index({ clickedAt: -1, partnerName: 1 });
affiliateClickSchema.index({ userId: 1, clickedAt: -1 });
affiliateClickSchema.index({ productId: 1, status: 1 });
affiliateClickSchema.index({ sessionId: 1, clickedAt: -1 });

const AffiliateClick = mongoose.models.AffiliateClick || 
  mongoose.model('AffiliateClick', affiliateClickSchema);

export default AffiliateClick;
```

#### Partner Configuration Model
```typescript
// lib/models/affiliate-partner.model.ts
interface IAffiliatePartner extends Document {
  name: string;                 // '2performant', 'profitshare'
  displayName: string;          // 'Flip.ro', 'eMAG'
  isActive: boolean;
  
  // Commission structure
  baseCommission: number;       // Base percentage
  categoryCommissions: {
    [category: string]: number; // Category-specific rates
  };
  
  // Integration details
  apiKey?: string;
  trackingDomain: string;       // 'track.2performant.com'
  clickTrackingUrl: string;     // Template for click URLs
  
  // Performance limits
  monthlyClickLimit?: number;
  dailyClickLimit?: number;
  
  // Conversion tracking
  hasConversionTracking: boolean;
  webhookUrl?: string;
  
  // Display settings
  priority: number;             // For partner selection logic
  logo?: string;
  description?: string;
}
```

### Phase 2: Affiliate Redirect System (Days 4-6)

#### Core Redirect Handler
```typescript
// app/api/go/[product]/[variant]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import AffiliateClick from '@/lib/models/affiliate-click.model';
import { AffiliateService } from '@/lib/services/affiliate.service';
import { detectDevice, getLocationFromIP } from '@/lib/utils/device-detection';

export async function GET(
  request: NextRequest,
  { params }: { params: { product: string; variant?: string } }
) {
  try {
    const { product: productId, variant: variantId } = params;
    const headersList = await headers();
    
    // Extract tracking information
    const userAgent = headersList.get('user-agent') || '';
    const referer = headersList.get('referer') || '';
    const ipAddress = headersList.get('x-forwarded-for')?.split(',')[0] || 
                     headersList.get('x-real-ip') || 'unknown';
    
    // Get URL parameters
    const { searchParams } = new URL(request.url);
    const utmSource = searchParams.get('utm_source');
    const utmMedium = searchParams.get('utm_medium');
    const utmCampaign = searchParams.get('utm_campaign');
    const sessionId = searchParams.get('sid') || generateSessionId();
    
    // Get product information
    const product = await AffiliateService.getProductForAffiliate(productId);
    if (!product) {
      return NextResponse.redirect('/404');
    }
    
    // Select best affiliate partner for this product
    const partner = await AffiliateService.selectBestPartner(product);
    if (!partner) {
      // Fallback to direct product URL
      return NextResponse.redirect(product.originalUrl);
    }
    
    // Generate affiliate URL
    const affiliateUrl = await AffiliateService.generateAffiliateUrl(
      product,
      partner,
      { utmSource, utmMedium, utmCampaign }
    );
    
    // Detect device and location
    const deviceType = detectDevice(userAgent);
    const location = await getLocationFromIP(ipAddress);
    
    // Record the click
    const clickRecord = await AffiliateClick.create({
      productId,
      variantId,
      sessionId,
      partnerName: partner.name,
      affiliateUrl,
      userAgent,
      ipAddress,
      referer,
      utmSource,
      utmMedium,
      utmCampaign,
      priceAtClick: product.currentPrice,
      bfsScoreAtClick: product.bfsScore,
      deviceType,
      country: location.country,
      city: location.city,
      clickedAt: new Date()
    });
    
    // Track analytics
    await AffiliateService.trackClick(clickRecord);
    
    // Redirect to affiliate URL
    return NextResponse.redirect(affiliateUrl, { status: 302 });
    
  } catch (error) {
    console.error('Affiliate redirect error:', error);
    
    // Fallback: redirect to product page or external URL
    try {
      const product = await Product.findById(params.product).select('url').lean();
      return NextResponse.redirect(product?.url || '/');
    } catch {
      return NextResponse.redirect('/');
    }
  }
}
```

#### Affiliate Service Layer
```typescript
// lib/services/affiliate.service.ts
export class AffiliateService {
  
  static async selectBestPartner(product: Product): Promise<AffiliatePartner | null> {
    // Get active partners for this product's source/category
    const partners = await AffiliatePartner.find({
      isActive: true,
      $or: [
        { supportedSources: product.source },
        { supportedCategories: product.category }
      ]
    }).sort({ priority: -1 });
    
    if (partners.length === 0) return null;
    
    // Partner selection logic (can be enhanced with A/B testing)
    // 1. Highest commission rate
    // 2. Best conversion rate historically
    // 3. Partner priority setting
    
    return partners[0];
  }
  
  static async generateAffiliateUrl(
    product: Product,
    partner: AffiliatePartner,
    utm: { utmSource?: string; utmMedium?: string; utmCampaign?: string }
  ): Promise<string> {
    
    switch (partner.name) {
      case '2performant':
        return this.generate2PerformantUrl(product, partner, utm);
      
      case 'profitshare':
        return this.generateProfitshareUrl(product, partner, utm);
      
      case 'emag':
        return this.generateEmagUrl(product, partner, utm);
      
      default:
        // Direct URL with UTM parameters
        return this.addUtmParameters(product.url, {
          utm_source: 'shopvalue',
          utm_medium: 'affiliate',
          utm_campaign: utm.utmCampaign || 'price_tracker',
          ...utm
        });
    }
  }
  
  private static generate2PerformantUrl(
    product: Product,
    partner: AffiliatePartner,
    utm: any
  ): string {
    // 2Performant URL structure: 
    // https://track.2performant.com/click?pid=PROGRAM_ID&offer_id=OFFER_ID&aff_id=AFFILIATE_ID&url=ENCODED_URL
    
    const baseUrl = 'https://track.2performant.com/click';
    const params = new URLSearchParams({
      pid: partner.programId || '1',
      aff_id: process.env.PERFORMANT_AFFILIATE_ID || '',
      url: encodeURIComponent(product.url),
      aff_sub: `shopvalue_${product._id}`,
      aff_sub2: utm.utmCampaign || 'price_tracker'
    });
    
    return `${baseUrl}?${params.toString()}`;
  }
  
  private static generateProfitshareUrl(
    product: Product,
    partner: AffiliatePartner,
    utm: any
  ): string {
    // Profitshare URL structure
    const params = new URLSearchParams({
      a_aid: process.env.PROFITSHARE_AFFILIATE_ID || '',
      a_bid: partner.campaignId || '',
      dest_url: encodeURIComponent(product.url),
      a_sub: `shopvalue_${product._id}`
    });
    
    return `https://profitshare.ro/l/click?${params.toString()}`;
  }
  
  static async trackClick(clickRecord: AffiliateClick): Promise<void> {
    // Update Redis analytics
    const today = new Date().toISOString().split('T')[0];
    await Promise.all([
      redis.incr(`affiliate:clicks:${today}`),
      redis.incr(`affiliate:clicks:partner:${clickRecord.partnerName}:${today}`),
      redis.incr(`affiliate:clicks:product:${clickRecord.productId}:${today}`)
    ]);
  }
  
  static async trackConversion(
    clickId: string,
    orderValue: number,
    commissionAmount: number
  ): Promise<void> {
    const click = await AffiliateClick.findByIdAndUpdate(clickId, {
      status: 'converted',
      convertedAt: new Date(),
      orderValue,
      commissionAmount
    });
    
    if (click) {
      const today = new Date().toISOString().split('T')[0];
      await Promise.all([
        redis.incr(`affiliate:conversions:${today}`),
        redis.incrby(`affiliate:revenue:${today}`, commissionAmount),
        redis.incr(`affiliate:conversions:partner:${click.partnerName}:${today}`)
      ]);
    }
  }
}
```

### Phase 3: UI Integration (Days 7-10)

#### Enhanced Product Action Buttons
```tsx
// components/ProductActionButtons.tsx
interface ProductActionButtonsProps {
  product: Product;
  variant?: ProductVariant;
  bfsScore?: BFSCalculation;
}

export const ProductActionButtons: React.FC<ProductActionButtonsProps> = ({ 
  product, 
  variant, 
  bfsScore 
}) => {
  const [isGeneratingLink, setIsGeneratingLink] = useState(false);
  
  const handleAffiliateClick = async () => {
    setIsGeneratingLink(true);
    
    // Track user interaction
    await trackEvent('affiliate_click_initiated', {
      productId: product._id,
      variantId: variant?._id,
      bfsScore: bfsScore?.score,
      source: 'product_page'
    });
    
    // Generate session ID for tracking
    const sessionId = getOrCreateSessionId();
    
    // Build affiliate URL with tracking
    const affiliateUrl = `/go/${product._id}${variant ? `/${variant._id}` : ''}?sid=${sessionId}&utm_source=shopvalue&utm_medium=product_page&utm_campaign=price_tracker`;
    
    // Open in new tab
    window.open(affiliateUrl, '_blank');
    
    setIsGeneratingLink(false);
  };
  
  return (
    <div className="product-action-buttons space-y-3">
      {/* Primary CTA - Affiliate Link */}
      <button
        onClick={handleAffiliateClick}
        disabled={isGeneratingLink}
        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors flex items-center justify-center space-x-2"
      >
        {isGeneratingLink ? (
          <>
            <Spinner className="w-4 h-4" />
            <span>Se generează linkul...</span>
          </>
        ) : (
          <>
            <ShoppingCartIcon className="w-5 h-5" />
            <span>Cumpără acum pe {getStoreName(product.source)}</span>
          </>
        )}
      </button>
      
      {/* Secondary Actions */}
      <div className="grid grid-cols-2 gap-3">
        <AddToWatchlistButton product={product} variant={variant} />
        <ShareProductButton product={product} bfsScore={bfsScore} />
      </div>
      
      {/* Affiliate Disclosure */}
      <div className="text-xs text-gray-500 text-center">
        <InfoIcon className="w-3 h-3 inline mr-1" />
        Primim o comisie mică dacă cumpărați prin linkul nostru, fără cost suplimentar pentru voi.
      </div>
      
      {/* Price Drop Alert */}
      {bfsScore && bfsScore.score < 60 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
          <div className="flex items-center space-x-2">
            <BellIcon className="w-4 h-4 text-yellow-600" />
            <span className="text-sm text-yellow-800">
              Scorul BFS este {bfsScore.score}/100. Vreți să fiți alertat când scade prețul?
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
```

#### Cashback Integration (Advanced)
```tsx
// components/CashbackBanner.tsx
export const CashbackBanner: React.FC<{ product: Product; estimatedCashback: number }> = ({ 
  product, 
  estimatedCashback 
}) => {
  if (estimatedCashback <= 0) return null;
  
  return (
    <div className="cashback-banner bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="bg-green-100 p-2 rounded-full">
            <CashIcon className="w-5 h-5 text-green-600" />
          </div>
          <div>
            <h4 className="font-semibold text-green-800">Cashback disponibil!</h4>
            <p className="text-sm text-green-700">
              Primiți înapoi aproximativ {estimatedCashback.toFixed(2)}€ în contul ShopValue
            </p>
          </div>
        </div>
        <div className="text-right">
          <div className="text-lg font-bold text-green-600">
            +{estimatedCashback.toFixed(2)}€
          </div>
          <div className="text-xs text-green-600">cashback</div>
        </div>
      </div>
    </div>
  );
};
```

### Phase 4: Analytics & Reporting (Days 11-14)

#### Admin Dashboard for Affiliate Performance
```tsx
// components/admin/AffiliateAnalyticsDashboard.tsx
export const AffiliateAnalyticsDashboard: React.FC = () => {
  const [metrics, setMetrics] = useState<AffiliateMetrics | null>(null);
  const [dateRange, setDateRange] = useState({ start: new Date(), end: new Date() });
  
  useEffect(() => {
    loadAffiliateMetrics(dateRange).then(setMetrics);
  }, [dateRange]);
  
  if (!metrics) return <LoadingSpinner />;
  
  return (
    <div className="affiliate-dashboard">
      {/* Key Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <MetricCard
          title="Total Clicks"
          value={metrics.daily.clicks}
          icon={<CursorClickIcon />}
          trend={calculateTrend(metrics.daily.clicks)}
        />
        <MetricCard
          title="Conversions"
          value={metrics.daily.conversions}
          icon={<ShoppingCartIcon />}
          trend={calculateTrend(metrics.daily.conversions)}
        />
        <MetricCard
          title="Revenue"
          value={`€${metrics.daily.revenue.toFixed(2)}`}
          icon={<CashIcon />}
          trend={calculateTrend(metrics.daily.revenue)}
        />
        <MetricCard
          title="Conversion Rate"
          value={`${metrics.daily.conversionRate.toFixed(2)}%`}
          icon={<TrendingUpIcon />}
          trend={calculateTrend(metrics.daily.conversionRate)}
        />
      </div>
      
      {/* Partner Performance Table */}
      <div className="bg-white rounded-lg shadow mb-8">
        <div className="px-6 py-4 border-b">
          <h3 className="text-lg font-semibold">Performance by Partner</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left">Partner</th>
                <th className="px-6 py-3 text-right">Clicks</th>
                <th className="px-6 py-3 text-right">Conversions</th>
                <th className="px-6 py-3 text-right">Revenue</th>
                <th className="px-6 py-3 text-right">Conv. Rate</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(metrics.byPartner).map(([partner, data]) => (
                <tr key={partner} className="border-b">
                  <td className="px-6 py-4 font-medium">{partner}</td>
                  <td className="px-6 py-4 text-right">{data.clicks}</td>
                  <td className="px-6 py-4 text-right">{data.conversions}</td>
                  <td className="px-6 py-4 text-right">€{data.revenue.toFixed(2)}</td>
                  <td className="px-6 py-4 text-right">{data.conversionRate.toFixed(2)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      
      {/* Top Performing Products */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b">
          <h3 className="text-lg font-semibold">Top Converting Products</h3>
        </div>
        <div className="p-6">
          <div className="space-y-4">
            {metrics.byProduct.slice(0, 10).map((product) => (
              <div key={product.productId} className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="text-sm font-medium truncate max-w-xs">
                    {product.productTitle}
                  </div>
                </div>
                <div className="flex items-center space-x-6 text-sm">
                  <span>{product.clicks} clicks</span>
                  <span>{product.conversions} conv</span>
                  <span className="font-medium">€{product.revenue.toFixed(2)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
```

#### Real-time Revenue Tracking
```typescript
// lib/services/affiliate-analytics.service.ts
export class AffiliateAnalyticsService {
  
  static async getDailyMetrics(date: Date): Promise<DailyAffiliateMetrics> {
    const dateStr = date.toISOString().split('T')[0];
    
    // Get cached metrics from Redis first
    const cached = await redis.hgetall(`affiliate:metrics:${dateStr}`);
    if (cached && Object.keys(cached).length > 0) {
      return this.parseCachedMetrics(cached);
    }
    
    // Calculate metrics from database
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);
    
    const [clicks, conversions, revenue] = await Promise.all([
      AffiliateClick.countDocuments({
        clickedAt: { $gte: startOfDay, $lte: endOfDay }
      }),
      AffiliateClick.countDocuments({
        convertedAt: { $gte: startOfDay, $lte: endOfDay },
        status: 'converted'
      }),
      AffiliateClick.aggregate([
        {
          $match: {
            convertedAt: { $gte: startOfDay, $lte: endOfDay },
            status: 'converted'
          }
        },
        {
          $group: {
            _id: null,
            totalRevenue: { $sum: '$commissionAmount' },
            totalOrderValue: { $sum: '$orderValue' }
          }
        }
      ])
    ]);
    
    const metrics = {
      clicks,
      conversions,
      revenue: revenue[0]?.totalRevenue || 0,
      conversionRate: clicks > 0 ? (conversions / clicks) * 100 : 0,
      averageOrderValue: conversions > 0 ? (revenue[0]?.totalOrderValue || 0) / conversions : 0
    };
    
    // Cache for 1 hour
    await redis.hmset(`affiliate:metrics:${dateStr}`, metrics);
    await redis.expire(`affiliate:metrics:${dateStr}`, 3600);
    
    return metrics;
  }
  
  static async getTopPerformingProducts(limit: number = 10): Promise<TopProduct[]> {
    return AffiliateClick.aggregate([
      {
        $match: {
          status: 'converted',
          convertedAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
        }
      },
      {
        $group: {
          _id: '$productId',
          totalRevenue: { $sum: '$commissionAmount' },
          totalClicks: { $sum: 1 },
          totalConversions: { $sum: { $cond: [{ $eq: ['$status', 'converted'] }, 1, 0] } }
        }
      },
      {
        $lookup: {
          from: 'products',
          localField: '_id',
          foreignField: '_id',
          as: 'product'
        }
      },
      {
        $unwind: '$product'
      },
      {
        $project: {
          productId: '$_id',
          productTitle: '$product.title',
          productImage: '$product.image',
          totalRevenue: 1,
          totalClicks: 1,
          totalConversions: 1,
          conversionRate: {
            $multiply: [{ $divide: ['$totalConversions', '$totalClicks'] }, 100]
          }
        }
      },
      {
        $sort: { totalRevenue: -1 }
      },
      {
        $limit: limit
      }
    ]);
  }
}
```

---

## Revenue Optimization Strategies

### A/B Testing Framework
```typescript
// Different affiliate strategies to test
const affiliateStrategies = {
  'strategy_a': {
    name: 'Highest Commission First',
    partnerSelection: 'commission_based',
    buttonText: 'Cumpără acum',
    showCashback: false
  },
  'strategy_b': {
    name: 'Best Converting Partner',
    partnerSelection: 'conversion_based', 
    buttonText: 'Vezi oferta',
    showCashback: true
  },
  'strategy_c': {
    name: 'User Choice',
    partnerSelection: 'user_choice',
    buttonText: 'Compară prețuri',
    showMultipleOptions: true
  }
};
```

### Dynamic Commission Optimization
```typescript
// Adjust commission sharing based on user engagement
const calculateUserCashback = (user: User, commissionAmount: number): number => {
  let cashbackRate = 0.3; // Base 30% of commission back to user
  
  // Increase cashback for Pro users
  if (user.subscription.plan === 'pro') {
    cashbackRate = 0.5; // 50% cashback
  }
  
  // Bonus for high-engagement users
  if (user.stats.averageTimeOnSite > 180) { // 3+ minutes
    cashbackRate += 0.1;
  }
  
  // Bonus for users who create many alerts
  if (user.alertsCreated > 10) {
    cashbackRate += 0.1;
  }
  
  return commissionAmount * cashbackRate;
};
```

### Partner Negotiation Leverage
```yaml
Negotiation Points:
  Volume Commitment: "We send 1000+ clicks/month"
  Quality Traffic: "Our users have 15%+ conversion rates"
  Brand Alignment: "We promote honest pricing, perfect for your brand"
  Technical Integration: "Professional tracking and reporting"
  
Premium Partnership Benefits:
  - Higher commission rates (6-8% vs 2-4%)
  - Featured placement in search results
  - Custom landing pages for their products
  - Dedicated account management
  - Priority customer support referrals
```

---

## Compliance & Legal Considerations

### Romanian Affiliate Marketing Law
```yaml
Required Disclosures:
  - Clear affiliate relationship disclosure
  - "Link de afiliere" or "Link sponsorizat" labels
  - Privacy policy updates for tracking
  - Cookie consent for affiliate tracking
  
GDPR Compliance:
  - User consent for affiliate tracking
  - Right to opt-out of affiliate links
  - Data retention policies for click data
  - Cross-border data transfer notices
  
Tax Considerations:
  - VAT on affiliate commissions
  - Income reporting to ANAF
  - Business registration for affiliate income
```

### Terms of Service Updates
```markdown
## Affiliate Partnerships

ShopValue participates in affiliate marketing programs. This means:

1. **Commission Earnings**: We may earn a small commission when you purchase products through our links, at no additional cost to you.

2. **Price Independence**: Our price tracking and recommendations are independent of affiliate relationships.

3. **Transparency**: All affiliate links are clearly marked and you can opt-out in your account settings.

4. **Alternative Links**: We always provide access to direct (non-affiliate) links when requested.
```

---

## Success Metrics & KPIs

### Revenue Metrics
- **Monthly Affiliate Revenue**: Target €200-1000/month
- **Revenue per User**: Affiliate earnings divided by active users
- **Commission Rate by Partner**: Average commission percentage
- **Cashback Distribution**: Amount shared back with users

### Performance Metrics
- **Click-Through Rate (CTR)**: Clicks on affiliate links / page views
- **Conversion Rate**: Purchases / affiliate clicks  
- **Average Order Value (AOV)**: Total order value / conversions
- **Time to Conversion**: Hours between click and purchase

### User Experience Metrics
- **Affiliate Link Satisfaction**: User surveys on affiliate experience
- **Cashback Redemption Rate**: Users claiming cashback rewards
- **Opt-out Rate**: Users disabling affiliate links
- **Trust Score**: User perception of affiliate transparency

---

## Risk Assessment & Mitigation

### High Risks
1. **Affiliate Program Changes**: Partners reducing commissions or terminating
   - **Mitigation**: Diversify across multiple partners, direct partnerships

2. **User Backlash**: Users feeling deceived by affiliate links
   - **Mitigation**: Full transparency, opt-out options, clear value proposition

3. **Technical Issues**: Broken affiliate links or tracking failures
   - **Mitigation**: Monitoring systems, fallback links, automated testing

### Medium Risks
1. **Competition**: Other sites offering better deals or higher cashback
   - **Mitigation**: Focus on unique value (BFS), user experience, trust

2. **Regulatory Changes**: New laws affecting affiliate marketing
   - **Mitigation**: Legal compliance monitoring, adaptable system design

### Low Risks
1. **Partner Disputes**: Disagreements over commission attribution
   - **Mitigation**: Clear contracts, detailed tracking, third-party validation

---

## Launch Plan

### Week 1: Foundation (Days 1-7)
- Database models and basic tracking
- Partner account setup (2Performant, Profitshare)
- Basic redirect system

### Week 2: Integration (Days 8-14)
- UI components and button integration
- Analytics dashboard
- Testing and optimization

### Soft Launch (Week 3)
- Deploy to 10% of users
- Monitor conversion rates and user feedback
- Fix issues and optimize performance

### Full Launch (Week 4)
- 100% rollout
- Marketing campaign highlighting transparency
- Partner relationship optimization

---

## Conclusion

The affiliate system represents a crucial **secondary revenue stream** that can contribute €200-1000/month without requiring additional user payments. Unlike subscription revenue, affiliate income scales naturally with user engagement and product discovery.

**Key Success Factors:**
1. **Full Transparency**: Clear disclosure builds trust and long-term user loyalty
2. **User Value**: Cashback and exclusive deals justify affiliate relationships  
3. **Technical Excellence**: Reliable tracking and seamless user experience
4. **Partner Diversity**: Multiple revenue sources reduce dependency risk

**Expected Outcomes:**
- **€500+ monthly revenue** within 3 months
- **15-25% affiliate CTR** on product pages
- **3-5% conversion rate** from affiliate clicks
- **Enhanced user value** through cashback program

**Strategic Importance**: This system transforms ShopValue from a cost center (hosting, development) to a profitable platform that generates revenue from user value creation, enabling sustainable growth and reinvestment in product development.

Implementation should begin immediately after BFS deployment, as affiliate revenue helps fund the technical infrastructure needed for advanced features and competitive differentiation.