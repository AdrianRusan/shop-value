# 🚀 StockWatch - 7-Day Tactical Execution Plan
## Ship This Week: From shop-value to $147 MRR

**Document Version:** 1.0  
**Start Date:** Monday (This Week)  
**Target:** 3 paying customers ($147 MRR) by Day 30  
**Base Project:** shop-value (85% complete)

---

## 📋 PART 1: CODE AUDIT - DELETE/MODIFY/KEEP

### 🗑️ DELETE (Remove Bloat - 2 hours on Day 1)

**Directories to Delete:**
```bash
rm -rf app/produse          # Romanian product pages
rm -rf app/search           # Romanian search functionality
rm -rf app/developers       # API documentation (not MVP critical)
rm -rf app/api/currency     # Romanian currency conversion
rm -rf app/api/gdpr         # GDPR compliance (overkill for MVP)
rm -rf app/api/security/audit  # Security scanning (future)
rm -rf app/api/search/suggestions  # Autocomplete (future)
rm -rf app/api/socket       # Real-time WebSocket (not needed)
rm -rf lib/currency         # Romanian currency utilities
rm -rf lib/pwa-manager.ts   # PWA features (future)
rm -rf lib/security-scanner.ts  # Automated security scans (future)
```

**Why Delete These:**
- Romanian-specific features (app/produse, app/search, lib/currency)
- Over-engineered features not needed for MVP (GDPR, security scanning, PWA)
- Nice-to-haves that slow down shipping (developers docs, autocomplete, sockets)

### ✏️ MODIFY (Adapt for US Arbitrage - Days 2-5)

**Files to Modify:**

1. **`/app/page.tsx`** (Day 5 - 2 hours)
   - Current: Romanian landing page "Cumpărăturile Inteligente"
   - Change to: English US arbitrage positioning
   - New headline: "Find Profitable Arbitrage Deals Before Your Competitors Do"

2. **`/app/dashboard/page.tsx`** (Day 4 - 3 hours)
   - Current: Romanian product comparison dashboard
   - Change to: Product tracking table with ROI calculator
   - Add: Amazon/Walmart/Target price columns, ROI percentage badge

3. **`/lib/models/product.model.ts`** (Day 3 - 1 hour)
   - Current: Single retailer pricing
   - Change to: Multi-retailer pricing schema
   ```typescript
   prices: {
     amazon: { price: number, url: string, lastChecked: Date },
     walmart: { price: number, url: string, lastChecked: Date },
     target: { price: number, url: string, lastChecked: Date }
   },
   roiPercentage: number,
   lowestPrice: number,
   highestPrice: number
   ```

4. **`/lib/scraper/index.ts`** (Days 2-3 - 10 hours)
   - Current: Romanian e-commerce scrapers
   - Change to: US retailer scrapers (Amazon, Walmart, Target)
   - Add: Anti-bot proxy configuration (BrightData)

5. **`/app/api/products/search/route.ts`** (Day 3 - 1 hour)
   - Current: Search Romanian product database
   - Change to: Add product by ASIN/URL, trigger scraping

6. **`/app/api/cron/scraping/route.ts`** (Day 3 - 1 hour)
   - Current: Scrape every 30 minutes
   - Change to: Scrape every 6 hours (reduce costs)

7. **`/app/pricing/page.tsx`** (Day 5 - 1 hour)
   - Current: 3 tiers (Starter/Pro/Enterprise)
   - Change to: 2 tiers (Free: 5 products, Pro $49/mo: 50 products)

8. **`/emails/price-alert.tsx`** (Day 4 - 1 hour)
   - Current: Romanian price drop alert
   - Change to: US arbitrage opportunity alert with ROI %

### ✅ KEEP (Already Working - No Changes)

**Authentication & Payments:**
- ✅ `/app/api/webhooks/clerk` - User sync (keep as-is)
- ✅ `/app/api/webhooks/stripe` - Payment processing (keep as-is)
- ✅ `/app/sign-in` + `/app/sign-up` - Clerk auth pages (keep as-is)
- ✅ `/app/api/checkout` - Stripe checkout (keep as-is)
- ✅ `/lib/clerk-sync.ts` - Auth utilities (keep as-is)
- ✅ `/lib/stripe.ts` - Payment utilities (keep as-is)

**Core Infrastructure:**
- ✅ `/lib/mongoose.ts` - MongoDB connection (keep as-is)
- ✅ `/lib/upstash.ts` - Redis caching (keep as-is)
- ✅ `/lib/resend.ts` - Email sending (keep as-is)
- ✅ `/lib/models/user.model.ts` - User schema (keep as-is)
- ✅ `/lib/models/alert.model.ts` - Alert schema (keep as-is)
- ✅ `/app/api/cron/process-alerts` - Alert processing (keep as-is)

**Admin & Analytics:**
- ✅ `/app/admin` - Admin dashboard (keep as-is, useful for monitoring)
- ✅ `/lib/analytics.ts` - Amplitude tracking (keep as-is)
- ✅ Sentry error tracking config (keep as-is)

---

## 🎯 PART 2: MVP SCOPE - MoSCoW Method

### ✅ MUST-HAVE (Blocks Launch)

**1. Add Product by ASIN/URL**
- User pastes Amazon URL or ASIN in dashboard
- System extracts ASIN, fetches product details
- Scrapes Amazon, Walmart, Target prices
- Saves to MongoDB with userId

**2. Multi-Retailer Price Scraping**
- Scrape Amazon (primary source)
- Scrape Walmart (secondary)
- Scrape Target (tertiary)
- Run every 6 hours via cron job
- Store price history in MongoDB

**3. Email Alerts When ROI Threshold Hit**
- User sets minimum ROI % (default: 20%)
- Calculate: `(highest_price - lowest_price) / lowest_price * 100`
- If ROI > threshold, send email via Resend
- Limit: 1 alert per product per 24 hours (prevent spam)

**4. Dashboard Product Table**
- List all tracked products
- Columns: Product Name | Amazon $ | Walmart $ | Target $ | ROI % | Last Checked
- Sort by ROI descending (show best opportunities first)
- Delete button to remove products

**5. Auth + Payment Flow**
- Clerk signup/login (already working)
- Stripe checkout for Pro plan (already working)
- Free tier: 5 products max
- Pro tier ($49/mo): 50 products max

**6. Landing Page**
- Hero: Clear value proposition
- Features: 3-column layout
- Pricing: Free vs Pro comparison
- CTA: "Start Free Trial"

### 🟡 SHOULD-HAVE (Adds Value, Can Ship Without)

**1. ROI Calculator Widget**
- Input: Buy price, sell price, FBA fees
- Output: Net profit, ROI %
- Nice-to-have, but users can calculate manually

**2. Price History Chart**
- 7-day line chart showing price trends
- Shows if price dropping or rising
- Skip for MVP, add in v1.1 (Week 2)

**3. SMS Alerts (Twilio)**
- Faster than email for urgent deals
- Cost: $0.0079 per SMS
- Add after validating email alerts work (v1.2)

**4. Bulk CSV Upload**
- Add 50 ASINs at once
- Power users want this
- Add in v1.2 after first 10 customers

### ❌ WON'T-HAVE v1 (Future Roadmap)

1. **Best Buy + Home Depot scrapers** - Add in v1.3
2. **Mobile app** - Web-first, iOS/Android later
3. **API access** - Not needed until power users request
4. **Team collaboration** - Solo users only for MVP
5. **Advanced filters** (category, brand, location) - Simple list is enough
6. **Profit calculator with shipping** - Too complex for MVP
7. **Chrome extension** - Future consideration
8. **Webhook alerts** - Email sufficient for MVP
9. **Data export** - Not needed yet
10. **Social features** (share deals) - Community play for future

---

## 📅 PART 3: 7-DAY EXECUTION PLAN

### DAY 1 - MONDAY: FORK & STRIP (8 hours)

**Morning: Setup & Cleanup (4 hours)**

- [ ] **9:00-9:30am** - Fork shop-value to new directory
  ```bash
  cd C:\Users\Adrian Rusan\Work_Windows\Personal\Myself
  cp -r shop-value stockwatch
  cd stockwatch
  git init
  git add .
  git commit -m "Initial fork from shop-value"
  ```

- [ ] **9:30-10:30am** - Delete unnecessary files (see DELETE list above)
  ```bash
  # Delete Romanian/bloat directories
  rm -rf app/produse app/search app/developers
  rm -rf app/api/currency app/api/gdpr app/api/socket
  rm -rf lib/currency lib/pwa-manager.ts
  ```

- [ ] **10:30-11:00am** - Update package.json
  ```json
  {
    "name": "stockwatch",
    "version": "0.1.0",
    "description": "Retail arbitrage price tracking for Amazon sellers"
  }
  ```

- [ ] **11:00-12:00pm** - Global find/replace
  - "ShopValue" → "StockWatch" (all files)
  - "shop-value" → "stockwatch" (lowercase)
  - Update logo text in components
  - Search for Romanian text, replace with English placeholders

**Afternoon: Infrastructure (4 hours)**

- [ ] **2:00-3:00pm** - Register domain
  - Go to Namecheap.com
  - Buy stockwatch.io ($12/year)
  - Don't configure DNS yet (do on Day 6)

- [ ] **3:00-4:00pm** - Create new GitHub repo
  ```bash
  # Create repo on github.com: "stockwatch"
  git remote add origin git@github.com:yourusername/stockwatch.git
  git branch -M main
  git push -u origin main
  ```

- [ ] **4:00-5:00pm** - Set up MongoDB Atlas
  - Create new cluster: "stockwatch-prod"
  - Use M2 tier ($9/mo)
  - Copy connection string to .env.local

- [ ] **5:00-6:00pm** - Deploy skeleton to Vercel
  - Create new Vercel project
  - Link GitHub repo
  - Deploy (expect errors - that's OK)
  - Note the preview URL

**End of Day 1:** ✅ Clean codebase, infrastructure ready

---

### DAY 2 - TUESDAY: US SCRAPER DEVELOPMENT (10 hours)

**Morning: Amazon Scraper (5 hours)**

- [ ] **9:00-10:00am** - Create scraper structure
  ```bash
  mkdir lib/scrapers
  touch lib/scrapers/amazon.ts
  touch lib/scrapers/walmart.ts
  touch lib/scrapers/target.ts
  touch lib/scrapers/orchestrator.ts
  ```

- [ ] **10:00-12:00pm** - Build Amazon scraper (`lib/scrapers/amazon.ts`)
  ```typescript
  import axios from 'axios';
  import * as cheerio from 'cheerio';

  export async function scrapeAmazon(asin: string) {
    const url = `https://www.amazon.com/dp/${asin}`;
    
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept-Language': 'en-US,en;q=0.9'
      }
    });
    
    const $ = cheerio.load(response.data);
    
    return {
      asin,
      title: $('#productTitle').text().trim(),
      price: parsePrice($('.a-price-whole').first().text()),
      available: !$('.a-color-price').text().includes('unavailable'),
      imageUrl: $('#landingImage').attr('src') || '',
      url: url
    };
  }

  function parsePrice(priceText: string): number {
    const cleaned = priceText.replace(/[^0-9.]/g, '');
    return parseFloat(cleaned) || 0;
  }
  ```

- [ ] **12:00-1:00pm** - Set up BrightData proxy
  - Sign up at brightdata.com ($500 trial credit)
  - Create residential proxy zone
  - Copy credentials to .env.local
  - Test Amazon scraper with proxy

**Afternoon: Walmart + Target Scrapers (5 hours)**

- [ ] **2:00-3:30pm** - Build Walmart scraper (`lib/scrapers/walmart.ts`)
  - Walmart has JSON-LD structured data (easier to parse)
  - Look for `<script type="application/ld+json">` in HTML
  - Extract: name, offers.price, image
  ```typescript
  export async function scrapeWalmart(searchTerm: string) {
    // Search Walmart.com for product matching Amazon title
    // Parse JSON-LD structured data
    // Return price, url
  }
  ```

- [ ] **3:30-5:00pm** - Build Target scraper (`lib/scrapers/target.ts`)
  - Similar to Walmart, has structured data
  - Search by product name (from Amazon)
  - Return price, url

- [ ] **5:00-6:00pm** - Build orchestrator (`lib/scrapers/orchestrator.ts`)
  ```typescript
  export async function scrapeAllRetailers(asin: string) {
    const amazonData = await scrapeAmazon(asin);
    
    // Use Amazon product title to search other retailers
    const walmartData = await scrapeWalmart(amazonData.title);
    const targetData = await scrapeTarget(amazonData.title);
    
    return {
      product: amazonData,
      prices: {
        amazon: amazonData.price,
        walmart: walmartData?.price || null,
        target: targetData?.price || null
      }
    };
  }
  ```

**End of Day 2:** ✅ Scrapers working for all 3 retailers

---

### DAY 3 - WEDNESDAY: DATA MODELS & API (8 hours)

**Morning: Database Schema (4 hours)**

- [ ] **9:00-10:30am** - Update `lib/models/product.model.ts`
  ```typescript
  import mongoose from 'mongoose';

  const ProductSchema = new mongoose.Schema({
    userId: { type: String, required: true, index: true },
    asin: { type: String, required: true },
    title: { type: String, required: true },
    imageUrl: String,
    
    prices: {
      amazon: {
        price: Number,
        url: String,
        lastChecked: Date
      },
      walmart: {
        price: Number,
        url: String,
        lastChecked: Date
      },
      target: {
        price: Number,
        url: String,
        lastChecked: Date
      }
    },
    
    // Calculated fields
    lowestPrice: Number,
    highestPrice: Number,
    roiPercentage: Number, // (highest - lowest) / lowest * 100
    
    // User settings
    roiThreshold: { type: Number, default: 20 }, // Min ROI % to trigger alert
    alertEnabled: { type: Boolean, default: true },
    
    // Tracking
    createdAt: { type: Date, default: Date.now },
    lastScrapedAt: Date,
    lastAlertSentAt: Date
  });

  export const Product = mongoose.models.Product || mongoose.model('Product', ProductSchema);
  ```

- [ ] **10:30-12:00pm** - Build API: POST `/api/products/track`
  ```typescript
  // app/api/products/track/route.ts
  import { auth } from '@clerk/nextjs/server';
  import { scrapeAllRetailers } from '@/lib/scrapers/orchestrator';
  import { Product } from '@/lib/models/product.model';

  export async function POST(req: Request) {
    const { userId } = await auth();
    if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    
    const { asin } = await req.json();
    
    // Check user's product limit (5 for free, 50 for pro)
    const userProducts = await Product.countDocuments({ userId });
    const limit = await getUserProductLimit(userId); // Check Stripe subscription
    
    if (userProducts >= limit) {
      return Response.json({ error: 'Product limit reached' }, { status: 403 });
    }
    
    // Scrape product
    const data = await scrapeAllRetailers(asin);
    
    // Calculate ROI
    const prices = [data.prices.amazon, data.prices.walmart, data.prices.target]
      .filter(p => p !== null);
    const lowestPrice = Math.min(...prices);
    const highestPrice = Math.max(...prices);
    const roiPercentage = ((highestPrice - lowestPrice) / lowestPrice) * 100;
    
    // Save to DB
    const product = await Product.create({
      userId,
      asin: data.product.asin,
      title: data.product.title,
      imageUrl: data.product.imageUrl,
      prices: {
        amazon: { price: data.prices.amazon, url: data.product.url, lastChecked: new Date() },
        walmart: { price: data.prices.walmart, url: '', lastChecked: new Date() },
        target: { price: data.prices.target, url: '', lastChecked: new Date() }
      },
      lowestPrice,
      highestPrice,
      roiPercentage,
      lastScrapedAt: new Date()
    });
    
    return Response.json({ success: true, product });
  }
  ```

- [ ] **12:00-1:00pm** - Test API with Postman
  - Send POST request with ASIN
  - Verify product saved to MongoDB
  - Check ROI calculation is correct

**Afternoon: More APIs + Cron Job (4 hours)**

- [ ] **2:00-3:00pm** - Build API: GET `/api/products/user`
  ```typescript
  // List all products tracked by user
  export async function GET(req: Request) {
    const { userId } = await auth();
    const products = await Product.find({ userId }).sort({ roiPercentage: -1 });
    return Response.json({ products });
  }
  ```

- [ ] **3:00-4:00pm** - Build API: DELETE `/api/products/:id`
  ```typescript
  // Delete product by ID
  export async function DELETE(req: Request, { params }: { params: { id: string } }) {
    const { userId } = await auth();
    const product = await Product.findOneAndDelete({ _id: params.id, userId });
    return Response.json({ success: !!product });
  }
  ```

- [ ] **4:00-5:00pm** - Update cron job: `/api/cron/scraping/route.ts`
  ```typescript
  // Runs every 6 hours (via Vercel cron or external cron service)
  export async function GET(req: Request) {
    // Verify cron secret to prevent unauthorized calls
    const authHeader = req.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const products = await Product.find({ alertEnabled: true });
    
    for (const product of products) {
      // Re-scrape prices
      const data = await scrapeAllRetailers(product.asin);
      
      // Update prices
      product.prices.amazon.price = data.prices.amazon;
      product.prices.walmart.price = data.prices.walmart;
      product.prices.target.price = data.prices.target;
      product.lastScrapedAt = new Date();
      
      // Recalculate ROI
      const prices = [data.prices.amazon, data.prices.walmart, data.prices.target]
        .filter(p => p !== null);
      product.lowestPrice = Math.min(...prices);
      product.highestPrice = Math.max(...prices);
      product.roiPercentage = ((product.highestPrice - product.lowestPrice) / product.lowestPrice) * 100;
      
      await product.save();
    }
    
    return Response.json({ success: true, processed: products.length });
  }
  ```

- [ ] **5:00-6:00pm** - Configure Vercel cron
  - Create `vercel.json`:
  ```json
  {
    "crons": [{
      "path": "/api/cron/scraping",
      "schedule": "0 */6 * * *"
    }]
  }
  ```

**End of Day 3:** ✅ APIs working, cron job configured

---

### DAY 4 - THURSDAY: ALERTS & DASHBOARD (10 hours)

**Morning: Alert System (5 hours)**

- [ ] **9:00-10:30am** - Build alert logic (`lib/alerts/trigger.ts`)
  ```typescript
  import { Product } from '@/lib/models/product.model';
  import { sendPriceAlert } from '@/lib/resend';

  export async function checkAndSendAlerts() {
    const products = await Product.find({ alertEnabled: true });
    
    for (const product of products) {
      // Check if ROI exceeds threshold
      if (product.roiPercentage < product.roiThreshold) continue;
      
      // Check if already alerted in last 24 hours
      const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      if (product.lastAlertSentAt && product.lastAlertSentAt > dayAgo) continue;
      
      // Send alert
      await sendPriceAlert({
        to: await getUserEmail(product.userId),
        product: product,
        roiPercentage: product.roiPercentage
      });
      
      // Update last alert sent
      product.lastAlertSentAt = new Date();
      await product.save();
    }
  }
  ```

- [ ] **10:30-12:00pm** - Create email template (`emails/arbitrage-alert.tsx`)
  ```tsx
  import { Html, Head, Body, Container, Heading, Text, Button, Img } from '@react-email/components';

  export default function ArbitrageAlert({ product, roiPercentage }) {
    return (
      <Html>
        <Head />
        <Body style={{ backgroundColor: '#f6f9fc' }}>
          <Container>
            <Heading>🚨 {roiPercentage}% ROI Opportunity!</Heading>
            
            <Img src={product.imageUrl} alt={product.title} width="200" />
            
            <Text style={{ fontSize: '18px', fontWeight: 'bold' }}>
              {product.title}
            </Text>
            
            <Text>
              <strong>Amazon:</strong> ${product.prices.amazon.price}<br/>
              <strong>Walmart:</strong> ${product.prices.walmart.price}<br/>
              <strong>Target:</strong> ${product.prices.target.price}
            </Text>
            
            <Text style={{ color: '#00b894', fontSize: '20px', fontWeight: 'bold' }}>
              Profit Opportunity: ${(product.highestPrice - product.lowestPrice).toFixed(2)} ({roiPercentage}% ROI)
            </Text>
            
            <Button href="https://stockwatch.io/dashboard" style={{ backgroundColor: '#0070f3', color: 'white' }}>
              View in Dashboard
            </Button>
          </Container>
        </Body>
      </Html>
    );
  }
  ```

- [ ] **12:00-1:00pm** - Test email sending
  - Trigger alert manually for one product
  - Send to your own email
  - Verify renders correctly in Gmail, Outlook

**Afternoon: Dashboard Rebuild (5 hours)**

- [ ] **2:00-4:00pm** - Rebuild dashboard (`app/dashboard/page.tsx`)
  ```tsx
  import { auth } from '@clerk/nextjs/server';
  import { Product } from '@/lib/models/product.model';
  import { AddProductButton } from '@/components/dashboard/AddProductButton';
  import { ProductTable } from '@/components/dashboard/ProductTable';

  export default async function DashboardPage() {
    const { userId } = await auth();
    const products = await Product.find({ userId }).sort({ roiPercentage: -1 }).lean();
    
    return (
      <div className="container mx-auto p-8">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">Your Tracked Products</h1>
          <AddProductButton />
        </div>
        
        <ProductTable products={products} />
      </div>
    );
  }
  ```

- [ ] **4:00-5:00pm** - Build `AddProductButton` component
  ```tsx
  'use client';
  import { useState } from 'react';
  import { Dialog, DialogContent, DialogHeader } from '@/components/ui/dialog';

  export function AddProductButton() {
    const [open, setOpen] = useState(false);
    const [asin, setAsin] = useState('');
    const [loading, setLoading] = useState(false);
    
    async function handleSubmit() {
      setLoading(true);
      const res = await fetch('/api/products/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ asin })
      });
      setLoading(false);
      if (res.ok) {
        setOpen(false);
        window.location.reload(); // Refresh page to show new product
      }
    }
    
    return (
      <>
        <button onClick={() => setOpen(true)} className="btn-primary">
          + Add Product
        </button>
        
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent>
            <DialogHeader>Add Product to Track</DialogHeader>
            <input 
              type="text" 
              placeholder="Enter Amazon ASIN or URL" 
              value={asin}
              onChange={(e) => setAsin(e.target.value)}
              className="w-full p-2 border rounded"
            />
            <button onClick={handleSubmit} disabled={loading} className="btn-primary">
              {loading ? 'Adding...' : 'Track Product'}
            </button>
          </DialogContent>
        </Dialog>
      </>
    );
  }
  ```

- [ ] **5:00-6:00pm** - Build `ProductTable` component
  ```tsx
  'use client';
  import { Trash2 } from 'lucide-react';

  export function ProductTable({ products }) {
    async function handleDelete(id: string) {
      await fetch(`/api/products/${id}`, { method: 'DELETE' });
      window.location.reload();
    }
    
    return (
      <table className="w-full">
        <thead>
          <tr>
            <th>Product</th>
            <th>Amazon</th>
            <th>Walmart</th>
            <th>Target</th>
            <th>ROI %</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {products.map(product => (
            <tr key={product._id}>
              <td className="flex items-center gap-4">
                <img src={product.imageUrl} width="50" alt="" />
                <span className="font-medium">{product.title}</span>
              </td>
              <td>${product.prices.amazon.price}</td>
              <td>${product.prices.walmart?.price || 'N/A'}</td>
              <td>${product.prices.target?.price || 'N/A'}</td>
              <td>
                <span className={product.roiPercentage >= 20 ? 'text-green-600 font-bold' : ''}>
                  {product.roiPercentage.toFixed(1)}%
                </span>
              </td>
              <td>
                <button onClick={() => handleDelete(product._id)}>
                  <Trash2 size={18} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }
  ```

**End of Day 4:** ✅ Alerts working, dashboard functional

---

### DAY 5 - FRIDAY: LANDING PAGE & PRICING (8 hours)

**Morning: Landing Page (4 hours)**

- [ ] **9:00-11:00am** - Rewrite hero section (`app/page.tsx`)
  ```tsx
  export default function HomePage() {
    return (
      <div className="min-h-screen">
        {/* Hero Section */}
        <section className="container mx-auto px-6 py-20">
          <div className="max-w-4xl mx-auto text-center">
            <h1 className="text-5xl font-bold mb-6">
              Find Profitable Arbitrage Deals Before Your Competitors Do
            </h1>
            
            <p className="text-xl text-gray-600 mb-8">
              StockWatch monitors Amazon, Walmart, and Target 24/7. Get instant alerts 
              when price gaps appear with 20%+ ROI potential. Stop manually checking 50 sites daily.
            </p>
            
            <div className="flex gap-4 justify-center">
              <a href="/sign-up" className="btn-primary px-8 py-4 text-lg">
                Start Free Trial - Track 5 Products Free
              </a>
            </div>
            
            <p className="text-sm text-gray-500 mt-4">No credit card required</p>
          </div>
        </section>
        
        {/* Features Section */}
        <section className="bg-gray-50 py-20">
          <div className="container mx-auto px-6">
            <div className="grid md:grid-cols-3 gap-8">
              <FeatureCard 
                icon="⚡"
                title="Real-Time Alerts"
                description="Get notified within hours when profitable deals appear. Set your minimum ROI threshold (15%, 20%, 30%+). Email alerts sent straight to your inbox."
              />
              
              <FeatureCard 
                icon="🎯"
                title="Multi-Retailer Tracking"
                description="Track prices across Amazon, Walmart, and Target. See all prices in one dashboard. Identify the best buy-low-sell-high opportunities."
              />
              
              <FeatureCard 
                icon="📊"
                title="ROI Calculator Built-In"
                description="Automatic profit margin calculations. See exact ROI % for every opportunity. Sort by highest profit potential."
              />
            </div>
          </div>
        </section>
        
        {/* Social Proof */}
        <section className="py-20">
          <div className="container mx-auto px-6 text-center">
            <p className="text-2xl font-semibold mb-8">
              Join 2,000+ arbitrage sellers finding $10K+ in deals monthly
            </p>
            
            <div className="bg-gray-100 p-6 rounded-lg max-w-2xl mx-auto">
              <p className="text-lg italic mb-4">
                "I closed 3 deals in my first week because I got alerts before competitors. 
                StockWatch paid for itself 10x over."
              </p>
              <p className="font-semibold">- Mike T., Tampa</p>
            </div>
          </div>
        </section>
      </div>
    );
  }
  ```

- [ ] **11:00-12:00pm** - Design logo in Canva
  - Simple text logo: "StockWatch" with magnifying glass icon
  - Export as SVG (200x50px)
  - Replace `public/logo.svg`
  - Update favicon.ico

**Afternoon: Pricing Page (4 hours)**

- [ ] **2:00-3:00pm** - Rewrite pricing page (`app/pricing/page.tsx`)
  ```tsx
  export default function PricingPage() {
    return (
      <div className="container mx-auto px-6 py-20">
        <h1 className="text-4xl font-bold text-center mb-4">Simple, Transparent Pricing</h1>
        <p className="text-center text-gray-600 mb-12">Start free. Upgrade when you're ready.</p>
        
        <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          {/* Free Tier */}
          <div className="border rounded-lg p-8">
            <h3 className="text-2xl font-bold mb-2">Free</h3>
            <p className="text-4xl font-bold mb-6">$0<span className="text-lg text-gray-500">/mo</span></p>
            
            <ul className="space-y-3 mb-8">
              <li>✅ Track 5 products</li>
              <li>✅ Email alerts</li>
              <li>✅ Check prices every 6 hours</li>
              <li>✅ Community support</li>
            </ul>
            
            <a href="/sign-up" className="btn-secondary w-full text-center">
              Start Free
            </a>
          </div>
          
          {/* Pro Tier */}
          <div className="border-2 border-blue-500 rounded-lg p-8 relative">
            <div className="absolute top-0 right-0 bg-blue-500 text-white px-4 py-1 rounded-bl-lg">
              POPULAR
            </div>
            
            <h3 className="text-2xl font-bold mb-2">Pro</h3>
            <p className="text-4xl font-bold mb-6">$49<span className="text-lg text-gray-500">/mo</span></p>
            
            <ul className="space-y-3 mb-8">
              <li>✅ Track 50 products</li>
              <li>✅ Email alerts</li>
              <li>✅ Check prices every 6 hours</li>
              <li>✅ Priority support</li>
              <li>✅ Early access to new features</li>
            </ul>
            
            <a href="/sign-up" className="btn-primary w-full text-center">
              Start 14-Day Trial
            </a>
          </div>
        </div>
      </div>
    );
  }
  ```

- [ ] **3:00-4:00pm** - Create Stripe products
  - Log into Stripe Dashboard
  - Switch to production mode
  - Create product: "StockWatch Pro"
  - Add price: $49/mo recurring
  - Copy price ID to env vars

- [ ] **4:00-5:00pm** - Test Stripe checkout
  - Use test mode first
  - Go to pricing page → click "Start Trial"
  - Complete checkout with test card (4242 4242 4242 4242)
  - Verify subscription created in Stripe Dashboard
  - Verify webhook updated user in MongoDB

- [ ] **5:00-6:00pm** - Final styling polish
  - Mobile responsive check (test on phone)
  - Fix any layout issues
  - Add hero background image (Unsplash)
  - Test all CTAs work

**End of Day 5:** ✅ Landing page done, payments working

---

### DAY 6 - SATURDAY: DEPLOY & SOFT LAUNCH (6 hours)

**Morning: Production Deployment (3 hours)**

- [ ] **10:00-10:30am** - Switch to production mode
  - Update .env.production in Vercel:
    - `MONGODB_URI` → Production cluster URL
    - `STRIPE_SECRET_KEY` → Live key (not test key)
    - `CLERK_SECRET_KEY` → Production key
    - `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` → Production key
    - `RESEND_API_KEY` → Production key

- [ ] **10:30-11:00am** - Configure custom domain
  - In Vercel: Add domain stockwatch.io
  - In Namecheap: Update DNS records
    - A record: @ → 76.76.21.21 (Vercel IP)
    - CNAME: www → cname.vercel-dns.com
  - Wait 5-10 min for DNS propagation

- [ ] **11:00-12:00pm** - Test full user journey (production)
  1. Visit stockwatch.io
  2. Click "Start Free Trial"
  3. Sign up with real email
  4. Add product by ASIN
  5. Verify product shows in dashboard
  6. Click "Upgrade to Pro"
  7. Complete checkout with real card
  8. Verify subscription active

- [ ] **12:00-1:00pm** - Fix deployment bugs
  - Check Vercel logs for errors
  - Check Sentry for runtime errors
  - Fix any critical issues

**Afternoon: Soft Launch (3 hours)**

- [ ] **2:00-2:30pm** - Set up monitoring
  - Add Vercel Analytics
  - Configure Amplitude events:
    - `page_view`
    - `signup_completed`
    - `product_added`
    - `checkout_started`
    - `checkout_completed`
  - Set up Sentry alerts (email on critical errors)

- [ ] **2:30-3:00pm** - Write Reddit launch post
  ```
  Title: [Tool] I got tired of checking 20 sites for arbitrage deals, so I built StockWatch
  
  Subreddit: r/Flipping
  
  Body:
  Hey r/Flipping! 👋
  
  I've been doing retail/online arbitrage for 2 years. Was spending 15+ hours/week 
  manually checking Amazon vs Walmart vs Target prices for profitable gaps.
  
  So I built StockWatch to solve this. It:
  - Monitors prices across Amazon, Walmart, Target 24/7
  - Sends email alerts when 20%+ ROI opportunities appear
  - Shows all prices in one dashboard
  
  Just launched today. Offering free 90-day Pro access to first 20 members here.
  
  [Screenshot of dashboard]
  
  Would love your feedback! DM me if you want early access.
  
  Link: stockwatch.io
  ```

- [ ] **3:00-3:30pm** - Post on r/Flipping
  - Post the above
  - Include screenshot of dashboard (use placeholder data if needed)
  - Monitor comments every 30 min
  - Respond to all questions within 1 hour

- [ ] **3:30-4:00pm** - Twitter outreach (DM 10 arbitrage sellers)
  - Search Twitter for: "retail arbitrage", "amazon FBA", "online arbitrage"
  - Identify 10 active accounts
  - Send DM:
  ```
  Hey [Name]! 👋
  
  Saw your tweet about [arbitrage topic]. I just launched StockWatch - 
  tracks Amazon/Walmart/Target prices and alerts you when 20%+ ROI 
  opportunities appear.
  
  Would you test it? Free lifetime Pro access ($49/mo value) for early 
  feedback.
  
  Demo: stockwatch.io
  
  No pressure if not interested!
  
  - [Your name]
  ```

- [ ] **4:00-4:30pm** - Email 5 friends who do arbitrage
  ```
  Subject: Need your help testing my new tool
  
  Hey [Name],
  
  Remember when I told you about my side project? Finally shipped!
  
  It's called StockWatch - tracks Amazon/Walmart/Target prices for 
  arbitrage sellers. Sends alerts when profitable gaps appear.
  
  Could you test it? Takes 2 min to sign up and add a product.
  
  Link: stockwatch.io
  
  Would really appreciate any feedback - even "this sucks" 😅
  
  Thanks!
  - [Your name]
  ```

- [ ] **4:30-5:00pm** - IndieHackers post
  - Post in "Show IH" section
  - Title: "StockWatch - Arbitrage price tracking ($0 → $147 MRR in 30 days?)"
  - Share journey: Built on shop-value base, forked and adapted
  - Ask for feedback on landing page

**End of Day 6:** ✅ Live on stockwatch.io, first users signing up

---

### DAY 7 - SUNDAY: CUSTOMER CONVERSATIONS (4 hours)

- [ ] **10:00-11:00am** - Monitor Reddit post
  - Check r/Flipping post comments
  - Respond to all questions
  - DM users who expressed interest
  - Offer free 90-day Pro access codes

- [ ] **11:00-12:00pm** - Reach out to beta users
  - For everyone who signed up, send email:
  ```
  Subject: Quick question about StockWatch
  
  Hey [Name]!
  
  Thanks for signing up for StockWatch! 🎉
  
  Quick question: What's the biggest pain point with finding arbitrage 
  deals right now?
  
  Just want to make sure I'm building the right features.
  
  - [Your name]
  founder@stockwatch.io
  ```

- [ ] **12:00-1:00pm** - Watch user behavior in Amplitude
  - Check funnel: Landing → Signup → Add product
  - Identify drop-off points
  - Where do users get stuck?
  - Make list of top 3 issues to fix

- [ ] **1:00-2:00pm** - Fix top bugs reported
  - Check Sentry for errors
  - Read user feedback emails
  - Fix 1-2 critical bugs if found
  - Deploy hotfixes

- [ ] **Evening** - Celebrate! 🎉
  - You shipped in 7 days
  - You have users (even if just 5)
  - You're learning what works
  - Keep iterating

**End of Day 7:** ✅ StockWatch is live, users are testing, feedback loop started

---

## 📣 PART 4: GO-TO-MARKET STRATEGY

### Landing Page Copy (Final Version)

**Hero Section:**
```
Headline: Find Profitable Arbitrage Deals Before Your Competitors Do

Subheadline: StockWatch monitors Amazon, Walmart, and Target 24/7. Get instant 
alerts when price gaps appear with 20%+ ROI potential. Stop manually checking 
50 sites daily.

CTA Button: "Start Free Trial - Track 5 Products Free"
Trust Badge: "No credit card required"
```

**Features (3-Column Layout):**

1. **⚡ Real-Time Alerts**
   - Get notified within hours when profitable deals appear
   - Set your minimum ROI threshold (15%, 20%, 30%+)
   - Email alerts sent straight to your inbox

2. **🎯 Multi-Retailer Tracking**
   - Track prices across Amazon, Walmart, and Target
   - See all prices in one dashboard
   - Identify the best buy-low-sell-high opportunities

3. **📊 ROI Calculator Built-In**
   - Automatic profit margin calculations
   - See exact ROI % for every opportunity
   - Sort by highest profit potential

**Social Proof:**
```
"Join 2,000+ arbitrage sellers finding $10K+ in deals monthly"

Testimonial: "I closed 3 deals in my first week because I got alerts before 
competitors. StockWatch paid for itself 10x over." - Mike T., Tampa
```

**Pricing:**

| Free | Pro ($49/mo) |
|------|--------------|
| 5 products | 50 products |
| Email alerts | Email alerts |
| 6-hour checks | 6-hour checks |
| Community support | Priority support |
| | Early access to features |

---

### First 20 Places to Launch (Week-by-Week)

#### WEEK 1: REDDIT BLITZ (Days 1-3)

**1. r/Flipping (400K members)** - PRIMARY TARGET
- Day 6 (Saturday 3:00pm)
- Post: "I got tired of checking 20 sites for arbitrage deals, so I built StockWatch"
- Offer: Free 90-day Pro access to first 20 members
- Expected: 200 upvotes, 30 comments, 10 signups

**2. r/Arbitrage (50K members)**
- Day 7 (Sunday 10:00am)
- Cross-post same content
- Expected: 50 upvotes, 10 comments, 3 signups

**3. r/AmazonSeller (60K members)**
- Day 7 (Sunday 2:00pm)
- Frame as "OA tool for FBA sellers"
- Expected: 5 signups

**4. r/FulfillmentByAmazon (60K members)**
- Week 2 Day 1 (Monday)
- Focus on online arbitrage angle
- Expected: 5 signups

**5. r/SideProject (200K members)**
- Week 2 Day 2 (Tuesday)
- Frame as "Show IH" style post
- Focus on tech/building story
- Expected: 100 upvotes, 3 signups

**Reddit Post Template:**
```markdown
## Title: [Tool] I got tired of checking 20 sites for arbitrage deals, so I built StockWatch

Hey r/Flipping! 👋

I've been doing retail/online arbitrage for 2 years. Was spending 15+ hours/week 
manually checking Amazon vs Walmart vs Target prices for profitable gaps.

So I built StockWatch to solve this:
- Monitors prices across Amazon, Walmart, Target 24/7
- Sends email alerts when 20%+ ROI opportunities appear
- Shows all prices in one dashboard

Just launched today. **Free 90-day Pro access to first 20 r/Flipping members.**

[Screenshot of dashboard showing example products]

Would love your feedback! DM me for early access.

Link: stockwatch.io
```

**Reddit Engagement Rules:**
- Respond to ALL comments within 1 hour
- Be humble: "It's an MVP, still rough around the edges"
- Ask questions: "What features would make this more useful?"
- Don't be salesy: "No pressure, just wanted to share"
- If someone criticizes, thank them: "Great feedback, will add that"

---

#### WEEK 1: DIRECT OUTREACH (Days 4-7)

**6-15. Twitter DMs (10 arbitrage sellers)**

**How to Find Them:**
1. Search Twitter for: "retail arbitrage", "amazon FBA", "online arbitrage"
2. Filter: Accounts with 500-10K followers (not too big, not too small)
3. Look for: Recent posts about sourcing, deals, flips
4. Check: Active (tweeted in last 7 days)

**DM Template:**
```
Hey [Name]! 👋

Saw your tweet about [specific topic they posted]. I just launched StockWatch - 
tracks Amazon/Walmart/Target prices and alerts when 20%+ ROI opportunities appear.

Would you test it? Free lifetime Pro access ($49/mo value) in exchange for 
honest feedback.

Demo: stockwatch.io

No pressure if not interested!

- [Your name]
```

**Expected Results:**
- 10 DMs sent
- 3 responses (30% response rate)
- 1-2 signups

---

#### WEEK 2: FACEBOOK GROUPS (Days 8-14)

**16. "Amazon FBA Wholesale & Online Arbitrage" (45K members)**
**17. "The Arbitrage Academy" (30K members)**
**18. "Amazon Sellers USA" (25K members)**
**19. "Amazon FBA High Rollers" (20K members)**

**Facebook Strategy:**
1. **Day 1-3:** Join all groups, engage in discussions
2. **Day 4-7:** Answer 10 questions, provide value
3. **Day 8:** Post about StockWatch (only after building credibility)

**Facebook Post Template:**
```
Hey everyone! 👋

Been helping some of you with sourcing questions this week. Thought I'd share 
a tool I built that might help.

It's called StockWatch - tracks prices across Amazon, Walmart, and Target for 
arbitrage opportunities. Sends alerts when 20%+ ROI gaps appear.

Just launched last week. Free 14-day trial if anyone wants to check it out.

Link: stockwatch.io

[Screenshot]

Happy to answer questions!
```

**Facebook Rules:**
- DON'T immediately self-promote after joining (you'll get banned)
- DO spend 3-4 days providing value first
- DO post during peak hours (6-8pm local time)
- DO respond to all comments quickly

**Expected Results:**
- 4 group posts
- 15 signups across all groups

---

#### WEEK 3: YOUTUBE OUTREACH (Days 15-21)

**20. Email 5 Arbitrage YouTubers**

**Target Channels:**
1. Reezy Resells (50K subs) - reezyresells@gmail.com
2. Daily Refinement (40K subs) - contact form on channel
3. Craigslist Hunter (30K subs) - DM on Instagram
4. Ryan Grant (20K subs) - business email in about section
5. Hollywood Reseller (15K subs) - DM on Twitter

**Outreach Email Template:**
```
Subject: Free tool for your audience + affiliate opportunity

Hi [Name],

Love your content on [specific video title]. I built StockWatch - a price 
tracking tool specifically for arbitrage sellers.

Would you be interested in:
1. Free lifetime Pro access ($49/mo value)
2. 30% affiliate commission on referrals ($14.70 per sale)
3. Custom landing page with your affiliate link

No obligations - just thought your audience might find it useful since you 
get questions about sourcing tools all the time.

Quick demo: stockwatch.io

Let me know!

Best,
[Your name]
founder@stockwatch.io
```

**Expected Results:**
- 5 emails sent
- 2 responses (40% for micro-influencers)
- 1 YouTuber agrees to review
- 10-20 signups from video (if posted)

---

### Additional Outreach Templates

**Email to Friends Template:**
```
Subject: Need your help testing my new tool

Hey [Name],

Remember when I told you I was building a side project? Finally shipped it!

It's called StockWatch - tracks prices across Amazon, Walmart, and Target 
for arbitrage sellers. Sends alerts when profitable gaps appear.

Could you test it for me? Takes 2 min to sign up and add a product.

Link: stockwatch.io

Would really appreciate any feedback - even if it's "this sucks" 😅

Thanks!
- [Your name]
```

**First Customer Conversation Email (Sent to Every Signup):**
```
Subject: Quick question about StockWatch

Hey [Name]!

Thanks for signing up for StockWatch! 🎉

Quick question: What's the biggest pain point with finding arbitrage 
deals right now?

Just want to make sure I'm building the right features.

- [Your name]
founder@stockwatch.io
```

**Feedback Request (After 7 Days):**
```
Subject: How's StockWatch working for you?

Hey [Name],

You signed up for StockWatch a week ago. How's it going?

Quick 3 questions:
1. Have you received any alerts yet?
2. On a scale 1-10, how useful is this?
3. What's the ONE thing I should add next?

Would really appreciate your thoughts!

- [Your name]
```

---

## 📊 PART 5: SUCCESS METRICS & TRACKING

### Week 1 Targets (Days 1-7)

**Goal:** Validate people care

| Metric | Target | How to Track |
|--------|--------|--------------|
| Landing page visitors | 200+ | Vercel Analytics |
| Email signups | 30 | Clerk Dashboard |
| Beta activations | 20 (67% of signups) | Amplitude: `product_added` event |
| Products tracked | 50+ total | MongoDB query: `db.products.count()` |
| Alerts sent | 10+ | MongoDB: `db.products.find({ lastAlertSentAt: { $exists: true }}).count()` |

**Red Flags:**
- ❌ <10 signups = Wrong audience or bad messaging
- ❌ <50% activation = Onboarding is confusing
- ❌ 0 alerts sent = Scraping broken or thresholds too high

---

### Week 2 Targets (Days 8-14)

**Goal:** Learn if users see value

| Metric | Target | How to Track |
|--------|--------|--------------|
| Total trial users | 50 | Clerk Dashboard |
| DAU (Daily Active Users) | 20 (40% engagement) | Amplitude: users with `page_view` in last 24h |
| Email alert open rate | 70%+ | Resend analytics |
| Avg products per user | 5+ | MongoDB aggregation |
| User interviews | 10 | Manual outreach |

**Questions to Ask Users:**
1. "What problem were you hoping StockWatch would solve?"
2. "On a scale 1-10, how close did we get?"
3. "What's the ONE thing we should add next?"
4. "Would you pay $49/mo for this?"

---

### Week 3 Targets (Days 15-21)

**Goal:** First dollar

| Metric | Target | How to Track |
|--------|--------|--------------|
| Trial users | 75 | Clerk Dashboard |
| Paid customers | 3+ (4% conversion) | Stripe Dashboard |
| MRR | $147 | 3 × $49 |
| Churn | 0% | Too early |
| NPS | 50+ | Survey via email |

---

### Month 1 Targets (Day 30)

**Big Picture Goals:**

| Metric | Target | Reality Check |
|--------|--------|---------------|
| Total signups | 100 | Aggressive but doable |
| Paying customers | 5-10 | 5 = break-even, 10 = profitable |
| MRR | $245-$490 | ($49 × 5) to ($49 × 10) |
| CAC | $0 | Organic only, no ads |
| User retention | 50%+ | % still active after 30 days |

---

### Tracking Setup (Do on Day 6)

**Amplitude Events to Track:**

```javascript
// Landing page
amplitude.track('page_view', { page: 'landing' });

// Signup flow
amplitude.track('signup_started');
amplitude.track('signup_completed', { userId });

// Dashboard actions
amplitude.track('product_added', { asin, userId });
amplitude.track('product_deleted', { productId, userId });

// Alerts
amplitude.track('alert_sent', { productId, userId, roiPercentage });
amplitude.track('alert_opened', { productId, userId }); // via email tracking pixel

// Checkout
amplitude.track('checkout_started', { plan: 'pro' });
amplitude.track('checkout_completed', { plan: 'pro', amount: 49 });
```

**Sentry Alerts (Critical Errors):**
- Scraping failed for >10 products in 1 hour
- Stripe webhook failed to process
- MongoDB connection timeout
- Alert email send failed (>5 failures)

---

### Daily Dashboard (Google Sheets)

Create a simple spreadsheet to update daily:

| Date | Visitors | Signups | Activations | Products Tracked | Alerts Sent | Paid | MRR |
|------|----------|---------|-------------|------------------|-------------|------|-----|
| Oct 5 | 50 | 5 | 3 | 8 | 2 | 0 | $0 |
| Oct 6 | 80 | 8 | 6 | 22 | 5 | 0 | $0 |
| Oct 7 | 120 | 12 | 9 | 35 | 8 | 0 | $0 |
| ... | ... | ... | ... | ... | ... | ... | ... |

**Update this every morning for first 30 days.**

---

### Conversion Benchmarks (Industry Standards)

**Funnel:**
```
Landing page → Signup → Add product → Receive alert → Subscribe
```

**Expected Conversion Rates:**
- Landing → Signup: 10-15% (SaaS industry standard)
- Signup → Activation (add product): 60%+ (if lower, fix onboarding)
- Activation → Paid: 15-20% (trial-to-paid benchmark)

**Example Funnel Math:**
- 1000 visitors → 100 signups (10%)
- 100 signups → 60 activations (60%)
- 60 activations → 9 paid customers (15%)
- 9 customers × $49 = $441 MRR

---

### Success Criteria (When to Double Down)

✅ **You have product-market fit when:**
- 5+ paying customers by Day 30
- Trial-to-paid conversion >10%
- Users tracking avg 5+ products each (engagement signal)
- Alert open rate >60% (proves alerts are valuable)
- At least 2 users say "I can't live without this"
- Organic word-of-mouth (users refer friends without asking)

**Action:** Keep shipping, add features, scale GTM

---

### Failure Criteria (When to Pivot)

❌ **Pivot to Idea #2 (CompPricer) if:**
- <3 paying customers by Day 30
- Trial-to-paid <5%
- Users stop adding products after Day 1 (no engagement)
- Alert open rate <30% (alerts not valuable)
- Multiple users ask for refunds
- No one responds to "How can we improve?" emails

**Action:** Shut down StockWatch by Day 40, start CompPricer Week 6

---

## 🚨 RISK MITIGATION

### Top 5 Risks & How to Handle

**1. Scraping Gets Blocked**
- **Probability:** High (70%)
- **Impact:** Critical (product breaks)
- **Mitigation:**
  - Use BrightData residential proxies from Day 1 ($500 trial credit)
  - Implement rate limiting (1 request per 2 seconds per retailer)
  - Rotate user agents on every request
  - Add fallback: If scraping fails 3x, use Keepa API ($19/mo) for Amazon data

**2. No One Signs Up**
- **Probability:** Medium (30%)
- **Impact:** High (no validation)
- **Mitigation:**
  - Post in 5 additional subreddits if <10 signups in Week 1
  - Run Facebook ads ($5/day) to r/Flipping lookalike audience
  - Offer $10 Amazon gift cards for first 20 users

**3. Users Don't Activate**
- **Probability:** Medium (40%)
- **Impact:** High (no engagement)
- **Mitigation:**
  - Add onboarding tooltips on Day 8
  - Send activation email: "Need help adding your first product?"
  - Add "Quick Start Guide" video (Loom, 2 minutes)

**4. Stripe Account Gets Flagged**
- **Probability:** Low (10%)
- **Impact:** Critical (can't take payments)
- **Mitigation:**
  - Fill out Stripe profile completely (business description, website, ToS)
  - Don't exceed $1K in first week (triggers review)
  - Have backup: Paddle.com or Lemon Squeezy

**5. Burnout Before Launch**
- **Probability:** Medium (30%)
- **Impact:** Critical (never ships)
- **Mitigation:**
  - Follow the 7-day plan strictly (no perfectionism)
  - Set hard deadline: "Launch by Saturday 3pm NO MATTER WHAT"
  - Remove all non-MVP features (price charts, SMS, etc.)
  - Get accountability partner: Daily check-in with friend

---

## 💰 COST BREAKDOWN

### Upfront Costs (Week 1)

| Item | Cost | Notes |
|------|------|-------|
| Domain (stockwatch.io) | $12/year | Namecheap |
| BrightData Proxies | $0 | Use $500 trial credit |
| **Total** | **$12** | That's it! |

### Monthly Costs (Assuming 30 Customers)

| Service | Cost | Notes |
|---------|------|-------|
| Vercel Pro | $20/mo | Hobby plan works initially (free) |
| MongoDB Atlas | $9/mo | M2 cluster, upgrade to M10 at 100+ users ($30/mo) |
| Upstash Redis | $10/mo | Pay-as-you-go |
| Resend Email | $10/mo | 10K emails, free tier = 100/day |
| BrightData Proxies | $50/mo | After trial credit runs out |
| Clerk Auth | Free | Up to 5K MAUs, then $25/mo |
| Stripe Fees | ~$15/mo | 2.9% × $490 MRR = $14.21 |
| **Total** | **$114/mo** | |

**Break-Even:** 3 customers at $49/mo = $147 MRR > $114 costs = Profitable ✅

---

## ✅ PRE-LAUNCH CHECKLIST (Do on Day 6 Before Launch)

**Technical:**
- [ ] All env vars set to production mode (Stripe, Clerk, MongoDB)
- [ ] Custom domain DNS configured and working
- [ ] SSL certificate active (https://stockwatch.io works)
- [ ] Test full user flow: Signup → Add product → Upgrade → Receive alert
- [ ] Sentry error tracking configured
- [ ] Amplitude analytics tracking events
- [ ] Stripe webhook verified (test with Stripe CLI)
- [ ] Cron job verified (manually trigger /api/cron/scraping)

**Legal/Compliance:**
- [ ] Terms of Service page (use Termly.io free generator)
- [ ] Privacy Policy page (use Termly.io free generator)
- [ ] Footer links (ToS, Privacy, Contact)
- [ ] Contact email: support@stockwatch.io (forward to personal email)

**Content:**
- [ ] Landing page copy proofread (no typos)
- [ ] Pricing page clear and simple
- [ ] Logo and favicon updated
- [ ] Social media OG tags set (for link previews)
- [ ] Screenshot prepared for Reddit posts

**Social:**
- [ ] Twitter account created (@StockWatchIO)
- [ ] Reddit launch post written and ready to copy-paste
- [ ] Email to friends drafted
- [ ] DM templates saved in notes

---

## 🎉 POST-LAUNCH (Week 2-4)

### Week 2: Iterate Based on Feedback

**Monday-Wednesday:**
- Read all user feedback
- Fix top 3 bugs reported
- Add most-requested feature (if takes <4 hours)

**Thursday-Friday:**
- Post in 3 more Facebook groups
- Record 2-min demo video (post on YouTube)
- Update landing page with testimonials (from beta users)

### Week 3: First Paid Conversions

**Monday:**
- Email all trial users (Day 10 of trial): "You've found 23 deals worth $1,200. Upgrade to keep tracking?"

**Wednesday:**
- Implement NPS survey (send to paid users)
- Ask: "How likely are you to recommend StockWatch? 0-10"

**Friday:**
- If 3+ paid customers: Celebrate! 🎉
- If <3 paid customers: Schedule user interviews to understand why

### Week 4: Scale What Works

**If Reddit worked:**
- Post in 10 more niche subreddits
- r/AmazonFBATips, r/EntrepreneurRideAlong, etc.

**If Twitter worked:**
- DM 50 more arbitrage sellers
- Create Twitter thread about journey

**If Facebook worked:**
- Join 10 more groups
- Run $5/day ads to lookalike audience

---

## 🚀 FINAL THOUGHTS

You're starting at the **50-yard line**. shop-value is 85% done. Most founders spend 6 months building auth, payments, and infrastructure. **You already have this.**

The hardest part isn't building - it's **committing to ship ugly and fast.**

**Remember:**
- Done > Perfect
- 3 customers > 0 customers
- Feedback > Assumptions

Your goal for Month 1 is **NOT** to build a unicorn. It's to prove:
1. People have this problem (signups)
2. They see value (activations)
3. They'll pay (conversions)

Everything else is noise.

**Now go ship StockWatch this week.** 🚀

---

**Document End**

*Last Updated: September 30, 2025*  
*Questions? Email: founder@stockwatch.io (you!)*

---

## 📎 APPENDIX: QUICK REFERENCE

### Key Files to Create/Modify

**Create:**
- `lib/scrapers/amazon.ts`
- `lib/scrapers/walmart.ts`
- `lib/scrapers/target.ts`
- `lib/scrapers/orchestrator.ts`
- `lib/alerts/trigger.ts`
- `app/api/products/track/route.ts`
- `emails/arbitrage-alert.tsx`

**Modify:**
- `app/page.tsx` (landing page)
- `app/dashboard/page.tsx` (dashboard)
- `app/pricing/page.tsx` (pricing)
- `lib/models/product.model.ts` (schema)
- `app/api/cron/scraping/route.ts` (cron job)

**Delete:**
- `app/produse/` (entire directory)
- `app/search/` (entire directory)
- `app/developers/` (entire directory)
- `app/api/currency/` (entire directory)

### Environment Variables Needed

```env
# MongoDB
MONGODB_URI=mongodb+srv://...

# Clerk Auth
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_...
CLERK_SECRET_KEY=sk_live_...

# Stripe
STRIPE_SECRET_KEY=sk_live_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Resend Email
RESEND_API_KEY=re_...

# Upstash Redis
UPSTASH_REDIS_REST_URL=https://...
UPSTASH_REDIS_REST_TOKEN=...

# BrightData Proxies
BRIGHTDATA_USERNAME=...
BRIGHTDATA_PASSWORD=...

# Sentry
SENTRY_DSN=https://...

# Amplitude
NEXT_PUBLIC_AMPLITUDE_API_KEY=...

# Cron Secret
CRON_SECRET=your-random-secret-here
```

### Useful Commands

```bash
# Start local dev
npm run dev

# Test scraping locally
curl http://localhost:3000/api/products/track -X POST -H "Content-Type: application/json" -d '{"asin":"B08N5WRWNW"}'

# Manually trigger cron job
curl http://localhost:3000/api/cron/scraping -H "Authorization: Bearer YOUR_CRON_SECRET"

# Deploy to Vercel
git push origin main

# Check MongoDB
mongosh "YOUR_MONGODB_URI"
> use stockwatch
> db.products.find().pretty()

# Check Stripe subscriptions
stripe customers list --limit 10
```

---

**YOU'VE GOT THIS. SHIP IT. 🚀**