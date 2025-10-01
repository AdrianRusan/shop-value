# Priority 2: Black Friday Score (BFS) Implementation - Comprehensive PRD

**Date**: August 12, 2025  
**Priority**: CRITICAL - Core Value Proposition  
**Timeline**: 2 Weeks Implementation  
**Revenue Impact**: Critical - Primary conversion driver  
**Dependencies**: Price history data, Product page updates, Performance optimization

---

## Problem Statement

**Missing Core Feature**: The Black Friday Score is ShopValue's **primary differentiator** and **main value proposition** according to the blueprint, but it's completely missing from the current implementation.

**Business Impact:**
- No competitive differentiation vs other price trackers
- Users can't distinguish real vs fake discounts
- Missing the "truth over hype" value proposition
- No viral sharing potential (BFS screenshots)
- Can't achieve "Black Friday Score 2025" marketing campaign

**User Problem**: Romanian consumers can't tell if Black Friday discounts are real or manipulated baseline prices.

---

## Solution Overview: Black Friday Score Algorithm

### Core Algorithm (From Blueprint)
```
For variant v at time t:
- median90 = median(price over last 90 days where available=true)
- lowest180 = min(price over last 180 days where available=true)  
- realDiscount = 1 - (current / median90)
- allTimeFactor = 1 - (current / lowest180)
- BFS = clamp(0.7*realDiscount + 0.3*allTimeFactor, 0, 1)
```

**Display**: 0-100 score with quality labels and badges

---

## Detailed Feature Specifications

### 🎯 BFS Calculation Engine

#### Algorithm Implementation
```typescript
interface BFSCalculation {
  score: number;           // 0-100
  label: string;          // "Poor", "Meh", "Real Deal", "Great"
  median90: number;       // 90-day median price
  lowest180: number;      // 180-day lowest price
  realDiscount: number;   // % discount vs median
  allTimeFactor: number;  // Factor vs all-time low
  badges: string[];       // Special badges array
}

const calculateBFS = async (productId: string): Promise<BFSCalculation> => {
  // Implementation details in technical section
}
```

#### Score Ranges & Labels
```yaml
Score Ranges:
  0-29: "Poor" (Red badge)
    - "Nu este o ofertă bună"
    - Current price above or near median
    
  30-59: "Meh" (Yellow badge)  
    - "Ofertă acceptabilă"
    - Moderate discount vs recent prices
    
  60-79: "Real Deal" (Orange badge)
    - "Ofertă foarte bună!"
    - Significant discount vs median
    
  80-100: "Great" (Green badge)
    - "Ofertă excepțională!"
    - Near or at historical low

Special Badges:
  - "Cel mai mic preț în 180 zile" (if current == lowest180)
  - "Sub prețul median cu X%" (if significant discount)
  - "Preț stabil" (if low price volatility)
```

### 🎨 UI/UX Implementation

#### Product Page Display
```tsx
<div className="bfs-container">
  <div className="bfs-score-circle">
    <span className="bfs-number">{bfs.score}</span>
    <span className="bfs-max">/100</span>
  </div>
  
  <div className="bfs-label">
    <span className={`bfs-badge ${getBadgeColor(bfs.score)}`}>
      {bfs.label}
    </span>
  </div>
  
  {bfs.badges.map(badge => (
    <div key={badge} className="special-badge">
      {badge}
    </div>
  ))}
  
  <div className="bfs-explanation">
    <p>Bazat pe {bfs.median90}€ preț median (90 zile)</p>
    <p>Cel mai mic: {bfs.lowest180}€ (180 zile)</p>
  </div>
</div>
```

#### Homepage Feature
```tsx
<section className="bfs-hero">
  <h2>Scorul Black Friday 2025</h2>
  <p>Vezi cât de reală e reducerea</p>
  <div className="bfs-demo">
    <!-- Live example with real product -->
    <ProductBFSCard productId="demo-product" />
  </div>
</section>
```

#### Search Results Integration
```tsx
<ProductCard>
  <div className="product-image-container">
    <img src={product.image} />
    <div className="bfs-overlay">
      <span className="bfs-mini-score">{bfs.score}</span>
    </div>
  </div>
  <!-- Rest of product card -->
</ProductCard>
```

---

## Technical Implementation

### Phase 1: Database Schema Updates (Days 1-2)

#### Product Model Enhancement
```typescript
// Add to Product model
interface IProduct {
  // ... existing fields
  
  // BFS-related fields
  bfsScore?: number;
  bfsCalculatedAt?: Date;
  bfsData?: {
    median90: number;
    lowest180: number;
    highest180: number;
    volatilityScore: number;
    trendDirection: 'up' | 'down' | 'stable';
  };
  
  // Price statistics (for faster BFS calculation)
  priceStats?: {
    min90Days: number;
    max90Days: number;
    median90Days: number;
    min180Days: number;
    max180Days: number;
    median180Days: number;
    lastCalculated: Date;
  };
}
```

#### Database Indexes for Performance
```javascript
// MongoDB indexes for fast BFS calculation
db.products.createIndex({ "priceHistory.date": -1 });
db.products.createIndex({ "bfsCalculatedAt": 1 });
db.products.createIndex({ "bfsScore": -1, "isActive": 1 });
db.products.createIndex({ "priceStats.lastCalculated": 1 });
```

### Phase 2: BFS Calculation Service (Days 3-5)

#### Core Calculation Function
```typescript
// lib/services/bfs-calculator.ts
export class BFSCalculator {
  
  static async calculateBFS(productId: string): Promise<BFSCalculation> {
    const product = await Product.findById(productId)
      .select('currentPrice priceHistory priceStats')
      .lean();
    
    if (!product || !product.priceHistory?.length) {
      return this.getDefaultBFS(product?.currentPrice || 0);
    }
    
    const now = new Date();
    const days90Ago = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    const days180Ago = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);
    
    // Get price data for calculations
    const prices90Days = product.priceHistory
      .filter(p => p.date >= days90Ago && p.price > 0)
      .map(p => p.price)
      .sort((a, b) => a - b);
      
    const prices180Days = product.priceHistory
      .filter(p => p.date >= days180Ago && p.price > 0)
      .map(p => p.price)
      .sort((a, b) => a - b);
    
    if (prices90Days.length === 0 || prices180Days.length === 0) {
      return this.getDefaultBFS(product.currentPrice);
    }
    
    // Calculate statistics
    const median90 = this.calculateMedian(prices90Days);
    const lowest180 = Math.min(...prices180Days);
    const highest180 = Math.max(...prices180Days);
    
    // Core BFS algorithm
    const realDiscount = Math.max(0, 1 - (product.currentPrice / median90));
    const allTimeFactor = Math.max(0, 1 - (product.currentPrice / lowest180));
    const rawBFS = (0.7 * realDiscount) + (0.3 * allTimeFactor);
    const bfsScore = Math.round(Math.max(0, Math.min(1, rawBFS)) * 100);
    
    // Generate labels and badges
    const label = this.getBFSLabel(bfsScore);
    const badges = this.generateBadges(product.currentPrice, lowest180, median90, highest180);
    
    // Cache results for performance
    await this.cacheBFSResult(productId, {
      score: bfsScore,
      median90,
      lowest180,
      calculatedAt: now
    });
    
    return {
      score: bfsScore,
      label,
      median90,
      lowest180,
      realDiscount: realDiscount * 100,
      allTimeFactor: allTimeFactor * 100,
      badges
    };
  }
  
  private static calculateMedian(prices: number[]): number {
    const sorted = [...prices].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0 
      ? (sorted[mid - 1] + sorted[mid]) / 2 
      : sorted[mid];
  }
  
  private static getBFSLabel(score: number): string {
    if (score >= 80) return "Excepțional";
    if (score >= 60) return "Ofertă foarte bună";
    if (score >= 30) return "Acceptabil";
    return "Nu e o ofertă bună";
  }
  
  private static generateBadges(current: number, lowest180: number, median90: number, highest180: number): string[] {
    const badges: string[] = [];
    
    if (current === lowest180) {
      badges.push("🔥 Cel mai mic preț în 180 zile");
    }
    
    const discountVsMedian = ((median90 - current) / median90) * 100;
    if (discountVsMedian >= 20) {
      badges.push(`💰 ${Math.round(discountVsMedian)}% sub prețul median`);
    }
    
    if (current <= lowest180 * 1.05) {
      badges.push("⭐ Aproape de minimul istoric");
    }
    
    return badges;
  }
}
```

#### Caching Strategy
```typescript
// Redis caching for performance
export class BFSCache {
  private static readonly CACHE_TTL = 6 * 60 * 60; // 6 hours
  
  static async getBFS(productId: string): Promise<BFSCalculation | null> {
    const cached = await redis.get(`bfs:${productId}`);
    return cached ? JSON.parse(cached) : null;
  }
  
  static async setBFS(productId: string, bfs: BFSCalculation): Promise<void> {
    await redis.setex(`bfs:${productId}`, this.CACHE_TTL, JSON.stringify(bfs));
  }
  
  static async invalidateBFS(productId: string): Promise<void> {
    await redis.del(`bfs:${productId}`);
  }
}
```

### Phase 3: API Integration (Days 6-8)

#### BFS API Endpoint
```typescript
// app/api/products/[id]/bfs/route.ts
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const productId = params.id;
    
    // Check cache first
    let bfs = await BFSCache.getBFS(productId);
    
    if (!bfs) {
      // Calculate fresh BFS
      bfs = await BFSCalculator.calculateBFS(productId);
      await BFSCache.setBFS(productId, bfs);
    }
    
    return NextResponse.json({
      success: true,
      data: bfs,
      cacheHit: !!bfs
    });
    
  } catch (error) {
    console.error('BFS calculation error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to calculate BFS' },
      { status: 500 }
    );
  }
}
```

#### Product Page Integration
```typescript
// app/produse/[brand]/[model]/[id]/page.tsx
export default async function ProductPage({ params }: { params: { id: string } }) {
  const [product, bfs] = await Promise.all([
    getProduct(params.id),
    BFSCalculator.calculateBFS(params.id)
  ]);
  
  return (
    <div className="product-page">
      <ProductHeader product={product} bfs={bfs} />
      <BFSExplanationCard bfs={bfs} />
      <PriceHistoryChart product={product} bfs={bfs} />
    </div>
  );
}
```

### Phase 4: Background Processing (Days 9-11)

#### Batch BFS Calculation
```typescript
// lib/jobs/bfs-batch-calculator.ts
export class BFSBatchProcessor {
  
  static async processAllProducts(): Promise<void> {
    const batchSize = 100;
    let skip = 0;
    let processed = 0;
    
    while (true) {
      const products = await Product.find({ isActive: true })
        .select('_id bfsCalculatedAt')
        .sort({ bfsCalculatedAt: 1 }) // Oldest first
        .limit(batchSize)
        .skip(skip)
        .lean();
      
      if (products.length === 0) break;
      
      // Process in parallel batches
      const promises = products.map(product => 
        this.safeCalculateBFS(product._id.toString())
      );
      
      await Promise.allSettled(promises);
      
      processed += products.length;
      skip += batchSize;
      
      console.log(`BFS batch processed: ${processed} products`);
      
      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  private static async safeCalculateBFS(productId: string): Promise<void> {
    try {
      const bfs = await BFSCalculator.calculateBFS(productId);
      
      // Update product with calculated BFS
      await Product.findByIdAndUpdate(productId, {
        bfsScore: bfs.score,
        bfsCalculatedAt: new Date(),
        'bfsData.median90': bfs.median90,
        'bfsData.lowest180': bfs.lowest180
      });
      
    } catch (error) {
      console.error(`BFS calculation failed for product ${productId}:`, error);
    }
  }
}
```

#### Cron Job Setup
```typescript
// app/api/cron/calculate-bfs/route.ts
export async function GET(request: NextRequest) {
  try {
    // Verify cron secret
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    console.log('Starting BFS batch calculation...');
    await BFSBatchProcessor.processAllProducts();
    console.log('BFS batch calculation completed');
    
    return NextResponse.json({ success: true, message: 'BFS calculation completed' });
    
  } catch (error) {
    console.error('BFS cron job error:', error);
    return NextResponse.json({ error: 'BFS calculation failed' }, { status: 500 });
  }
}
```

### Phase 5: UI Components (Days 12-14)

#### BFS Score Component
```tsx
// components/BFSScore.tsx
interface BFSScoreProps {
  bfs: BFSCalculation;
  size?: 'small' | 'medium' | 'large';
  showDetails?: boolean;
}

export const BFSScore: React.FC<BFSScoreProps> = ({ bfs, size = 'medium', showDetails = true }) => {
  const getBadgeColor = (score: number) => {
    if (score >= 80) return 'bg-green-500';
    if (score >= 60) return 'bg-orange-500';
    if (score >= 30) return 'bg-yellow-500';
    return 'bg-red-500';
  };
  
  const sizeClasses = {
    small: 'w-12 h-12 text-sm',
    medium: 'w-16 h-16 text-lg',
    large: 'w-24 h-24 text-2xl'
  };
  
  return (
    <div className="bfs-score-container">
      <div className={`bfs-circle ${sizeClasses[size]} ${getBadgeColor(bfs.score)} rounded-full flex items-center justify-center text-white font-bold`}>
        <span>{bfs.score}</span>
      </div>
      
      <div className="bfs-label mt-2 text-center">
        <span className={`px-2 py-1 rounded text-white text-xs font-medium ${getBadgeColor(bfs.score)}`}>
          {bfs.label}
        </span>
      </div>
      
      {showDetails && bfs.badges.length > 0 && (
        <div className="bfs-badges mt-2 space-y-1">
          {bfs.badges.map((badge, index) => (
            <div key={index} className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
              {badge}
            </div>
          ))}
        </div>
      )}
      
      {showDetails && (
        <div className="bfs-details mt-2 text-xs text-gray-600">
          <div>Mediana 90 zile: {bfs.median90.toFixed(2)}€</div>
          <div>Minim 180 zile: {bfs.lowest180.toFixed(2)}€</div>
        </div>
      )}
    </div>
  );
};
```

#### BFS Explanation Modal
```tsx
// components/BFSExplanationModal.tsx
export const BFSExplanationModal: React.FC<{ bfs: BFSCalculation; product: Product }> = ({ bfs, product }) => {
  return (
    <div className="bfs-explanation-modal">
      <h3>Ce înseamnă Scorul Black Friday?</h3>
      
      <div className="bfs-algorithm-explanation">
        <p>Scorul se calculează comparând prețul actual cu:</p>
        <ul>
          <li><strong>Prețul median din ultimele 90 zile</strong>: {bfs.median90.toFixed(2)}€</li>
          <li><strong>Cel mai mic preț din ultimele 180 zile</strong>: {bfs.lowest180.toFixed(2)}€</li>
        </ul>
      </div>
      
      <div className="bfs-current-analysis">
        <h4>Analiza prețului actual ({product.currentPrice.toFixed(2)}€):</h4>
        <div className="bfs-metrics">
          <div>Reducere vs mediana: {bfs.realDiscount.toFixed(1)}%</div>
          <div>Proximitate față de minim: {bfs.allTimeFactor.toFixed(1)}%</div>
        </div>
      </div>
      
      <div className="bfs-recommendation">
        {bfs.score >= 60 ? (
          <p className="text-green-600">✅ Recomandăm această ofertă!</p>
        ) : (
          <p className="text-yellow-600">⚠️ Poate să așteptați o ofertă mai bună.</p>
        )}
      </div>
    </div>
  );
};
```

---

## Performance Optimization

### Caching Strategy
```yaml
Multi-Level Caching:
  Level 1 - Redis: 6-hour cache for calculated BFS
  Level 2 - Database: Store BFS in product document
  Level 3 - CDN: Cache BFS images for social sharing

Cache Invalidation:
  - On price updates
  - Daily batch recalculation
  - Manual invalidation for important products
```

### Database Optimization
```javascript
// Pre-calculated price statistics for faster BFS
const priceStatsPipeline = [
  {
    $match: { 
      _id: ObjectId(productId),
      'priceHistory.0': { $exists: true }
    }
  },
  {
    $project: {
      currentPrice: 1,
      prices90: {
        $filter: {
          input: '$priceHistory',
          cond: { 
            $gte: ['$$this.date', new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)]
          }
        }
      },
      prices180: {
        $filter: {
          input: '$priceHistory',
          cond: { 
            $gte: ['$$this.date', new Date(Date.now() - 180 * 24 * 60 * 60 * 1000)]
          }
        }
      }
    }
  }
];
```

---

## Marketing & Growth Impact

### Viral Sharing Potential
```tsx
// Social sharing with BFS
<ShareButton 
  text={`${product.title} are scor Black Friday de ${bfs.score}/100! ${bfs.label}`}
  image={`/api/og/bfs/${product._id}.png`}
  url={`/produse/${product.slug}`}
/>
```

### SEO Benefits
```tsx
// JSON-LD with BFS data
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Product",
  "name": "{product.title}",
  "aggregateRating": {
    "@type": "AggregateRating",
    "ratingValue": "{bfs.score}",
    "bestRating": "100",
    "ratingCount": "1",
    "reviewCount": "1"
  }
}
</script>
```

### Landing Page Strategy
```yaml
Black Friday Landing Pages:
  /black-friday-2025: Main BFS campaign page
  /verificare-reduceri: BFS checker tool
  /scoruri-live: Live BFS feed for trending products
  
Content Strategy:
  - "Top 10 produse cu scor BFS 90+"
  - "Cum să nu te lași păcălit de Black Friday"
  - "Istoricul reducerilor reale vs false"
```

---

## Success Metrics & KPIs

### User Engagement Metrics
- **BFS Page Views**: Track views of products with high BFS scores
- **BFS Interaction Rate**: Clicks on BFS explanations and details
- **Time on Page**: Higher for pages with prominent BFS display
- **Share Rate**: Social shares of high-BFS products

### Conversion Metrics
- **BFS to Alert Conversion**: Users creating alerts after seeing good BFS
- **BFS to Purchase**: Click-through rate to merchant sites
- **Pro Upgrade Rate**: Users upgrading to see advanced BFS features

### Business Intelligence
- **BFS Distribution**: Histogram of BFS scores across catalog
- **Seasonal Patterns**: BFS changes during sales periods
- **Merchant Analysis**: Which stores have consistently high/low BFS

### Performance Metrics
- **Calculation Time**: BFS calculation performance (<500ms target)
- **Cache Hit Rate**: Redis cache efficiency (>80% target)  
- **API Response Time**: BFS API endpoint performance (<200ms)

---

## Risk Assessment & Mitigation

### High Risks
1. **Algorithm Accuracy**: BFS doesn't match user perception of "good deals"
   - **Mitigation**: A/B test different algorithm weights, user feedback collection

2. **Performance Impact**: BFS calculations slow down page loads
   - **Mitigation**: Aggressive caching, background pre-calculation, lazy loading

3. **Data Quality**: Insufficient price history for accurate BFS
   - **Mitigation**: Minimum data requirements, graceful degradation

### Medium Risks
1. **User Confusion**: Users don't understand BFS methodology
   - **Mitigation**: Clear explanations, tooltips, help documentation

2. **Gaming by Merchants**: Stores manipulate prices to influence BFS
   - **Mitigation**: Algorithm transparency, longer historical windows

### Low Risks
1. **Legal Issues**: Merchants object to BFS scoring
   - **Mitigation**: Clear disclaimers, focus on historical data analysis

---

## Testing Strategy

### Algorithm Testing
```typescript
// BFS algorithm unit tests
describe('BFS Calculator', () => {
  test('should return 100 for current price = historical minimum', () => {
    const priceHistory = [100, 120, 110, 150, 80]; // 80 is minimum
    const current = 80;
    const bfs = calculateBFS(current, priceHistory);
    expect(bfs.score).toBeGreaterThanOrEqual(95);
  });
  
  test('should return low score for current price = historical maximum', () => {
    const priceHistory = [100, 120, 110, 80, 150]; // 150 is maximum
    const current = 150;
    const bfs = calculateBFS(current, priceHistory);
    expect(bfs.score).toBeLessThanOrEqual(10);
  });
});
```

### Performance Testing
```bash
# Load testing for BFS calculation
artillery run bfs-load-test.yml

# Target: 
# - 1000 concurrent BFS calculations
# - <500ms response time
# - >95% success rate
```

### User Acceptance Testing
- **A/B Test**: BFS display vs traditional price display
- **User Interviews**: Understanding of BFS meaning
- **Conversion Testing**: Impact on alert creation and purchases

---

## Launch Plan

### Week 1: Core Algorithm (Days 1-7)
- Database schema updates
- BFS calculation service
- Unit tests and performance optimization

### Week 2: UI Integration (Days 8-14)
- Product page BFS display
- API endpoints
- Background calculation jobs
- Component library

### Soft Launch (Week 3)
- Deploy to beta users
- Monitor performance and user feedback
- Fix critical bugs

### Full Launch (Week 4)
- Public launch with marketing campaign
- "Scorul Black Friday 2025" content marketing
- Press outreach and social media

---

## Conclusion

The Black Friday Score is ShopValue's **killer feature** - the primary reason users will choose it over competitors. Without BFS, ShopValue is just another price tracker. With BFS, it becomes the **truth detector** for Romanian e-commerce.

**Expected Outcomes:**
- **Viral sharing** of BFS screenshots
- **Trust building** with "truth over hype" positioning  
- **Conversion driver** for Pro subscriptions
- **SEO benefits** from unique content
- **Market differentiation** vs all competitors

**Implementation Priority**: This should be implemented immediately after pricing restructure, as it's the core product feature that justifies the Pro subscription and drives organic growth through sharing.

The technical complexity is moderate, but the business impact is transformational - this feature alone can establish ShopValue as the definitive price intelligence platform for Romanian consumers.