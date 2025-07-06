import mongoose, { Document, Model, Types } from 'mongoose';

// Interface for price history
interface IPriceHistory {
  price: number;
  date: Date;
  source?: string;
  scraperVersion?: string;
}

// Interface for tracking users
interface ITrackingUser {
  userId: Types.ObjectId;
  email: string;
  addedAt: Date;
  alertSettings: {
    priceDecrease: boolean;
    priceIncrease: boolean;
    backInStock: boolean;
    threshold?: number;
  };
}

// Interface for product analytics
interface IProductAnalytics {
  viewCount: number;
  trackingCount: number;
  lastViewed: Date;
  popularityScore: number;
  conversionRate: number;
}

// Main product interface
interface IProduct extends Document {
  // Basic product information
  url: string;
  urlHash: string;
  source: string;
  currency: string;
  image: string;
  title: string;
  description?: string;
  
  // Price information
  currentPrice: number;
  originalPrice: number;
  priceHistory: IPriceHistory[];
  lowestPrice: number;
  highestPrice: number;
  averagePrice: number;
  discountRate: number;
  
  // Product details
  category: string;
  brand: string;
  productModel: string;
  stars: number;
  reviewsCount: number;
  
  // Stock and availability
  isOutOfStock: boolean;
  availability: 'in_stock' | 'out_of_stock' | 'limited' | 'discontinued';
  
  // SaaS and multi-tenancy
  tenantId: string;
  isActive: boolean;
  trackingStatus: 'active' | 'paused' | 'failed' | 'archived';
  
  // User tracking
  trackingUsers: ITrackingUser[];
  
  // Analytics
  analytics: IProductAnalytics;
  
  // Scraping metadata
  lastScrapedAt: Date;
  scrapingErrors: number;
  nextScrapeAt: Date;
  scraperVersion: string;
  
  // SEO and search
  slug: string;
  keywords: string[];
  
  // Soft delete
  deletedAt?: Date;
  
  // Methods
  updatePriceHistory(newPrice: number, source?: string): Promise<IProduct>;
  calculateAveragePrice(): number;
  addTrackingUser(userId: string, email: string, alertSettings?: any): Promise<IProduct>;
  removeTrackingUser(userId: string): Promise<IProduct>;
  incrementViewCount(): Promise<IProduct>;
}

interface IProductModel extends Model<IProduct> {
  findActiveProducts(): Promise<IProduct[]>;
  findByBrandAndCategory(brand: string, category: string): Promise<IProduct[]>;
  findExpensiveProducts(minPrice: number): Promise<IProduct[]>;
  findByTenant(tenantId: string): Promise<IProduct[]>;
  findDueForScraping(): Promise<IProduct[]>;
  searchProducts(query: string, options?: any): Promise<IProduct[]>;
}

// Enhanced product schema with proper indexing and validation
const productSchema = new mongoose.Schema<IProduct>({
  // Basic product information
  url: { 
    type: String, 
    required: [true, 'Product URL is required'],
    unique: true,
    index: true,
    validate: {
      validator: function(v: string) {
        return /^https?:\/\/.+/.test(v);
      },
      message: 'Please enter a valid URL'
    }
  },
  urlHash: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  source: { 
    type: String, 
    required: [true, 'Source is required'],
    enum: ['flip', 'emag', 'altex', 'cel', 'amazon'],
    index: true
  },
  currency: { 
    type: String, 
    required: [true, 'Currency is required'],
    enum: ['RON', 'EUR', 'USD'],
    default: 'RON',
    index: true
  },
  image: { 
    type: String, 
    required: [true, 'Product image is required'],
    validate: {
      validator: function(v: string) {
        return /^https?:\/\/.+\.(jpg|jpeg|png|webp|gif)/.test(v);
      },
      message: 'Please enter a valid image URL'
    }
  },
  title: { 
    type: String, 
    required: [true, 'Product title is required'],
    maxlength: [500, 'Title cannot exceed 500 characters'],
    index: 'text'
  },
  description: { 
    type: String,
    maxlength: [5000, 'Description cannot exceed 5000 characters']
  },
  
  // Price information with validation
  currentPrice: { 
    type: Number, 
    required: [true, 'Current price is required'],
    min: [0, 'Price cannot be negative'],
    index: true
  },
  originalPrice: { 
    type: Number, 
    required: [true, 'Original price is required'],
    min: [0, 'Price cannot be negative'],
    index: true
  },
  priceHistory: [{
    price: { 
      type: Number, 
      required: true,
      min: [0, 'Price cannot be negative']
    },
    date: { 
      type: Date, 
      default: Date.now,
      index: true
    },
    source: String,
    scraperVersion: String
  }],
  lowestPrice: { 
    type: Number,
    min: [0, 'Price cannot be negative'],
    index: true
  },
  highestPrice: { 
    type: Number,
    min: [0, 'Price cannot be negative'],
    index: true
  },
  averagePrice: { 
    type: Number,
    min: [0, 'Price cannot be negative'],
    index: true
  },
  discountRate: { 
    type: Number,
    min: [0, 'Discount rate cannot be negative'],
    max: [100, 'Discount rate cannot exceed 100%'],
    default: 0
  },
  
  // Product categorization
  category: { 
    type: String, 
    required: [true, 'Category is required'],
    index: true,
    lowercase: true,
    trim: true
  },
  brand: { 
    type: String, 
    required: [true, 'Brand is required'],
    index: true,
    lowercase: true,
    trim: true
  },
  productModel: { 
    type: String, 
    required: [true, 'Model is required'],
    index: true,
    lowercase: true,
    trim: true
  },
  stars: { 
    type: Number,
    min: [0, 'Rating cannot be negative'],
    max: [5, 'Rating cannot exceed 5 stars'],
    default: 0
  },
  reviewsCount: { 
    type: Number,
    min: [0, 'Review count cannot be negative'],
    default: 0,
    index: true
  },
  
  // Stock and availability
  isOutOfStock: { 
    type: Boolean, 
    default: false,
    index: true
  },
  availability: {
    type: String,
    enum: ['in_stock', 'out_of_stock', 'limited', 'discontinued'],
    default: 'in_stock',
    index: true
  },
  
  // Multi-tenancy and SaaS features
  tenantId: {
    type: String,
    required: [true, 'Tenant ID is required'],
    index: true
  },
  isActive: { 
    type: Boolean, 
    default: true,
    index: true
  },
  trackingStatus: { 
    type: String, 
    enum: ['active', 'paused', 'failed', 'archived'],
    default: 'active',
    index: true
  },
  
  // User tracking with enhanced alert settings
  trackingUsers: [{
    userId: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: 'User',
      required: true,
      index: true
    },
    email: { 
      type: String, 
      required: true,
      lowercase: true,
      trim: true
    },
    addedAt: { 
      type: Date, 
      default: Date.now 
    },
    alertSettings: {
      priceDecrease: { type: Boolean, default: true },
      priceIncrease: { type: Boolean, default: false },
      backInStock: { type: Boolean, default: true },
      threshold: { 
        type: Number,
        min: [0, 'Threshold cannot be negative']
      }
    }
  }],
  
  // Analytics for business intelligence
  analytics: {
    viewCount: { type: Number, default: 0, min: 0 },
    trackingCount: { type: Number, default: 0, min: 0 },
    lastViewed: { type: Date, default: Date.now },
    popularityScore: { type: Number, default: 0, min: 0 },
    conversionRate: { type: Number, default: 0, min: 0, max: 100 }
  },
  
  // Scraping metadata
  lastScrapedAt: { 
    type: Date,
    default: Date.now,
    index: true
  },
  scrapingErrors: { 
    type: Number, 
    default: 0,
    min: 0
  },
  nextScrapeAt: { 
    type: Date,
    index: true
  },
  scraperVersion: { 
    type: String,
    default: '1.0.0'
  },
  
  // SEO and search optimization
  slug: {
    type: String,
    unique: true,
    sparse: true,
    index: true
  },
  keywords: [{
    type: String,
    lowercase: true,
    trim: true
  }],
  
  // Soft delete
  deletedAt: {
    type: Date
    // Index removed to avoid duplicate with compound indexes
  }
}, {
  timestamps: true,
  // Add virtual for tracking count
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Compound indexes for optimized queries - optimized to avoid duplicates
productSchema.index({ brand: 1, category: 1 });
productSchema.index({ currentPrice: 1, brand: 1 });
productSchema.index({ tenantId: 1, isActive: 1, deletedAt: 1 }); // Added deletedAt
productSchema.index({ tenantId: 1, trackingStatus: 1 });
productSchema.index({ source: 1, lastScrapedAt: 1 });
productSchema.index({ category: 1, currentPrice: 1 });
productSchema.index({ brand: 1, productModel: 1, isActive: 1 });
productSchema.index({ 'analytics.popularityScore': -1, isActive: 1 });
productSchema.index({ nextScrapeAt: 1, trackingStatus: 1 });
productSchema.index({ createdAt: 1, tenantId: 1 });
productSchema.index({ deletedAt: 1, isActive: 1 }); // For soft delete queries

// Text search index
productSchema.index({
  title: 'text',
  description: 'text',
  brand: 'text',
  productModel: 'text',
  keywords: 'text'
}, {
  weights: {
    title: 10,
    brand: 5,
    productModel: 5,
    keywords: 3,
    description: 1
  }
});

// Pre-save middleware
productSchema.pre('save', async function(next) {
  // Generate URL hash for duplicate detection
  if (this.isModified('url')) {
    const crypto = require('crypto');
    this.urlHash = crypto.createHash('sha256').update(this.url).digest('hex');
  }
  
  // Generate slug if not provided
  if (!this.slug && (this.isNew || this.isModified('title'))) {
    this.slug = this.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }
  
  // Update analytics tracking count
  if (this.isModified('trackingUsers')) {
    this.analytics.trackingCount = this.trackingUsers.length;
  }
  
  // Calculate price statistics
  if (this.isModified('priceHistory') || this.isNew) {
    const prices = this.priceHistory.map(h => h.price);
    if (prices.length > 0) {
      this.lowestPrice = Math.min(...prices);
      this.highestPrice = Math.max(...prices);
      this.averagePrice = prices.reduce((a, b) => a + b, 0) / prices.length;
    }
  }
  
  // Set next scrape time based on popularity
  if (this.isNew || this.isModified('analytics.popularityScore')) {
    const baseInterval = 4 * 60 * 60 * 1000; // 4 hours
    const popularityMultiplier = Math.max(0.5, 2 - (this.analytics.popularityScore / 100));
    this.nextScrapeAt = new Date(Date.now() + (baseInterval * popularityMultiplier));
  }
  
  next();
});

// Virtual for tracking users count
productSchema.virtual('trackingUsersCount').get(function() {
  return this.trackingUsers?.length || 0;
});

// Virtual for price change percentage
productSchema.virtual('priceChangePercentage').get(function() {
  if (this.originalPrice === 0) return 0;
  return ((this.currentPrice - this.originalPrice) / this.originalPrice) * 100;
});

// Static methods
productSchema.statics.findActiveProducts = function() {
  return this.find({ 
    isActive: true, 
    deletedAt: { $exists: false },
    trackingStatus: 'active'
  });
};

productSchema.statics.findByBrandAndCategory = function(brand: string, category: string) {
  return this.find({ 
    brand: brand.toLowerCase(),
    category: category.toLowerCase(),
    isActive: true,
    deletedAt: { $exists: false }
  });
};

productSchema.statics.findExpensiveProducts = function(minPrice: number) {
  return this.find({ 
    currentPrice: { $gte: minPrice },
    isActive: true 
  }).sort({ currentPrice: -1 });
};

productSchema.statics.findByTenant = function(tenantId: string) {
  return this.find({ 
    tenantId,
    isActive: true,
    deletedAt: { $exists: false }
  });
};

productSchema.statics.findDueForScraping = function() {
  return this.find({
    nextScrapeAt: { $lte: new Date() },
    trackingStatus: 'active',
    isActive: true
  }).sort({ nextScrapeAt: 1 });
};

productSchema.statics.searchProducts = function(query: string, options: any = {}) {
  const searchOptions: any = {
    $text: { $search: query },
    isActive: true,
    deletedAt: { $exists: false }
  };
  
  if (options.tenantId) {
    searchOptions.tenantId = options.tenantId;
  }
  
  if (options.category) {
    searchOptions.category = options.category.toLowerCase();
  }
  
  if (options.priceRange) {
    searchOptions.currentPrice = {
      $gte: options.priceRange.min || 0,
      $lte: options.priceRange.max || Number.MAX_SAFE_INTEGER
    };
  }
  
  return this.find(searchOptions, { score: { $meta: 'textScore' } })
    .sort({ score: { $meta: 'textScore' } })
    .limit(options.limit || 20);
};

// Instance methods
productSchema.methods.updatePriceHistory = async function(newPrice: number, source?: string) {
  this.priceHistory.push({
    price: newPrice,
    date: new Date(),
    source: source || this.source,
    scraperVersion: this.scraperVersion
  });
  
  this.currentPrice = newPrice;
  this.lastScrapedAt = new Date();
  
  return this.save();
};

productSchema.methods.calculateAveragePrice = function() {
  if (this.priceHistory.length === 0) return this.currentPrice;
  
  const total = this.priceHistory.reduce((sum: number, item: IPriceHistory) => sum + item.price, 0);
  return total / this.priceHistory.length;
};

productSchema.methods.addTrackingUser = async function(userId: string, email: string, alertSettings: any = {}) {
  const existingUser = this.trackingUsers.find((user: any) => 
    user.userId.toString() === userId
  );
  
  if (!existingUser) {
    this.trackingUsers.push({
      userId: new mongoose.Types.ObjectId(userId),
      email: email.toLowerCase(),
      addedAt: new Date(),
      alertSettings: {
        priceDecrease: true,
        priceIncrease: false,
        backInStock: true,
        ...alertSettings
      }
    });
    
    return this.save();
  }
  
  return this;
};

productSchema.methods.removeTrackingUser = async function(userId: string) {
  this.trackingUsers = this.trackingUsers.filter((user: any) => 
    user.userId.toString() !== userId
  );
  
  return this.save();
};

productSchema.methods.incrementViewCount = async function() {
  this.analytics.viewCount += 1;
  this.analytics.lastViewed = new Date();
  
  // Update popularity score based on views and tracking
  this.analytics.popularityScore = 
    (this.analytics.viewCount * 0.1) + 
    (this.analytics.trackingCount * 2);
  
  return this.save();
};

const Product = (mongoose.models.Product || mongoose.model<IProduct>('Product', productSchema)) as IProductModel;

export default Product;
