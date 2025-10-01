import mongoose from 'mongoose';

// Interface for retailer price data
interface IRetailerPrice {
  price?: number;
  url?: string;
  lastChecked?: Date;
}

// Interface for multi-retailer pricing
interface IPrices {
  amazon?: IRetailerPrice;
  walmart?: IRetailerPrice;
  target?: IRetailerPrice;
}

// Main product interface
interface IProduct extends Document {
  // User who tracks this product
  userId: string;

  // Product identifiers
  asin: string;
  title: string;
  imageUrl?: string;

  // Multi-retailer pricing
  prices: IPrices;

  // Calculated fields (for sorting/filtering)
  lowestPrice?: number;
  highestPrice?: number;
  priceDelta?: number; // highestPrice - lowestPrice
  roiPercentage?: number; // (priceDelta / lowestPrice) * 100

  // User alert settings
  roiThreshold: number; // Minimum ROI % to trigger alert
  alertEnabled: boolean;

  // Tracking metadata
  createdAt: Date;
  lastScrapedAt?: Date;
  lastAlertSentAt?: Date;

  // Status
  status: 'active' | 'paused' | 'error';
  errorCount: number;
  lastError?: string;

  // Methods
  calculateROI(): number;
}

interface IProductModel extends mongoose.Model<IProduct> {
  findByUserId(userId: string): Promise<IProduct[]>;
  findActiveProducts(): Promise<IProduct[]>;
}

// Product schema with multi-retailer pricing
const productSchema = new mongoose.Schema<IProduct>({
  // User who tracks this product
  userId: {
    type: String,
    required: true,
    index: true
  },

  // Product identifiers
  asin: {
    type: String,
    required: true
  },
  title: {
    type: String,
    required: true
  },
  imageUrl: String,

  // Multi-retailer pricing
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

  // Calculated fields (for sorting/filtering)
  lowestPrice: Number,
  highestPrice: Number,
  priceDelta: Number, // highestPrice - lowestPrice
  roiPercentage: Number, // (priceDelta / lowestPrice) * 100

  // User alert settings
  roiThreshold: {
    type: Number,
    default: 20
  }, // Minimum ROI % to trigger alert
  alertEnabled: {
    type: Boolean,
    default: true
  },

  // Tracking metadata
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  lastScrapedAt: Date,
  lastAlertSentAt: Date,

  // Status
  status: {
    type: String,
    enum: ['active', 'paused', 'error'],
    default: 'active'
  },
  errorCount: {
    type: Number,
    default: 0
  },
  lastError: String
}, {
  timestamps: true
});

// Indexes for performance
productSchema.index({ userId: 1, roiPercentage: -1 });
productSchema.index({ userId: 1, createdAt: -1 });
productSchema.index({ alertEnabled: 1, roiPercentage: -1 });
productSchema.index({ userId: 1, asin: 1 }, { unique: true }); // Prevent duplicate tracking

// Method to calculate ROI
productSchema.methods.calculateROI = function() {
  const prices = [
    this.prices.amazon?.price,
    this.prices.walmart?.price,
    this.prices.target?.price
  ].filter(p => p !== null && p !== undefined && p > 0);

  if (prices.length < 2) {
    this.roiPercentage = 0;
    this.lowestPrice = prices[0] || 0;
    this.highestPrice = prices[0] || 0;
    this.priceDelta = 0;
    return 0;
  }

  this.lowestPrice = Math.min(...prices);
  this.highestPrice = Math.max(...prices);
  this.priceDelta = this.highestPrice - this.lowestPrice;
  this.roiPercentage = (this.priceDelta / this.lowestPrice) * 100;

  return this.roiPercentage;
};

// Static methods
productSchema.statics.findByUserId = function(userId: string) {
  return this.find({ userId }).sort({ roiPercentage: -1 });
};

productSchema.statics.findActiveProducts = function() {
  return this.find({ status: 'active' });
};

const Product = (mongoose.models.Product || mongoose.model<IProduct>('Product', productSchema)) as IProductModel;

export default Product;
