import mongoose, { Document, Model, Types, CallbackWithoutResultAndOptionalError } from 'mongoose';

// Interface for user-specific product tracking
interface IUserProductTracking extends Document {
  userId: string; // Clerk user ID
  productId: Types.ObjectId;
  addedAt: Date;
  isActive: boolean;
  
  // User-specific alert settings
  alertSettings: {
    priceDecrease: boolean;
    priceIncrease: boolean;
    backInStock: boolean;
    threshold?: number;
    frequency: 'immediate' | 'daily' | 'weekly';
  };
  
  // User-specific tracking metadata
  userNotes?: string;
  personalRating?: number;
  trackingReason?: string;
  
  // Privacy settings
  isPublic: boolean;
  sharedWith: string[]; // Array of user IDs who can see this tracking
  
  // Analytics
  viewCount: number;
  lastViewed: Date;
  
  // Soft delete
  deletedAt?: Date;
}

interface IUserProductTrackingModel extends Model<IUserProductTracking> {
  findByUser(userId: string): Promise<IUserProductTracking[]>;
  findByProduct(productId: string): Promise<IUserProductTracking[]>;
  findUserTracking(userId: string, productId: string): Promise<IUserProductTracking | null>;
  findPublicTrackings(productId: string): Promise<IUserProductTracking[]>;
}

// User Product Tracking Schema
const userProductTrackingSchema = new mongoose.Schema<IUserProductTracking>({
  userId: {
    type: String,
    required: [true, 'User ID is required']
    // Index removed - covered by compound indexes
  },
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: [true, 'Product ID is required']
    // Index removed - covered by compound indexes
  },
  addedAt: {
    type: Date,
    default: Date.now
    // Index removed - covered by compound indexes
  },
  isActive: {
    type: Boolean,
    default: true
    // Index removed - covered by compound indexes
  },
  
  // Enhanced alert settings
  alertSettings: {
    priceDecrease: { type: Boolean, default: true },
    priceIncrease: { type: Boolean, default: false },
    backInStock: { type: Boolean, default: true },
    threshold: { 
      type: Number,
      min: [0, 'Threshold cannot be negative']
    },
    frequency: {
      type: String,
      enum: ['immediate', 'daily', 'weekly'],
      default: 'immediate'
    }
  },
  
  // User customization
  userNotes: {
    type: String,
    maxlength: [1000, 'Notes cannot exceed 1000 characters']
  },
  personalRating: {
    type: Number,
    min: [1, 'Rating must be at least 1'],
    max: [5, 'Rating cannot exceed 5']
  },
  trackingReason: {
    type: String,
    enum: ['purchase_intent', 'price_monitoring', 'research', 'wishlist', 'gift_idea', 'other'],
    default: 'purchase_intent'
  },
  
  // Privacy controls
  isPublic: {
    type: Boolean,
    default: false
    // Index removed - covered by compound indexes
  },
  sharedWith: [{
    type: String // Clerk user IDs
    // Index removed - individual array element indexes not needed
  }],
  
  // Analytics
  viewCount: {
    type: Number,
    default: 0,
    min: 0
  },
  lastViewed: {
    type: Date,
    default: Date.now
  },
  
  // Soft delete
  deletedAt: {
    type: Date
    // Index removed - covered by explicit sparse index below
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Compound indexes for performance
userProductTrackingSchema.index({ userId: 1, productId: 1 }, { unique: true });
userProductTrackingSchema.index({ userId: 1, isActive: 1 });
userProductTrackingSchema.index({ productId: 1, isActive: 1 });
userProductTrackingSchema.index({ userId: 1, addedAt: -1 });
userProductTrackingSchema.index({ isPublic: 1, productId: 1 });
userProductTrackingSchema.index({ deletedAt: 1 }, { sparse: true });

// Pre-save middleware
userProductTrackingSchema.pre('save', async function(next) {
  // Update last viewed when tracking is modified
  if (this.isModified() && !this.isNew) {
    this.lastViewed = new Date();
  }
  
  next();
});

// Static methods
userProductTrackingSchema.statics.findByUser = function(userId: string) {
  return this.find({ 
    userId,
    isActive: true,
    deletedAt: { $exists: false }
  }).populate('productId');
};

userProductTrackingSchema.statics.findByProduct = function(productId: string) {
  return this.find({ 
    productId,
    isActive: true,
    deletedAt: { $exists: false }
  });
};

userProductTrackingSchema.statics.findUserTracking = function(userId: string, productId: string) {
  return this.findOne({ 
    userId,
    productId,
    deletedAt: { $exists: false }
  }).populate('productId');
};

userProductTrackingSchema.statics.findPublicTrackings = function(productId: string) {
  return this.find({ 
    productId,
    isPublic: true,
    isActive: true,
    deletedAt: { $exists: false }
  }).populate('userId', 'firstName lastName avatar');
};

// Instance methods
userProductTrackingSchema.methods.incrementViewCount = function() {
  this.viewCount += 1;
  this.lastViewed = new Date();
  return this.save();
};

userProductTrackingSchema.methods.shareWith = function(userIds: string[]) {
  const existingIds = this.sharedWith || [];
  const allIds = existingIds.concat(userIds);
  this.sharedWith = Array.from(new Set(allIds));
  return this.save();
};

userProductTrackingSchema.methods.removeSharing = function(userIds: string[]) {
  this.sharedWith = this.sharedWith.filter((id: string) => !userIds.includes(id));
  return this.save();
};

const UserProductTracking = (mongoose.models.UserProductTracking || 
  mongoose.model<IUserProductTracking>('UserProductTracking', userProductTrackingSchema)) as IUserProductTrackingModel;

export default UserProductTracking;
export type { IUserProductTracking };