import mongoose, { Document, Model, Types } from 'mongoose';

// Interfaces for type safety
interface ISubscription {
  plan: 'free' | 'pro' | 'enterprise';
  status: 'active' | 'cancelled' | 'past_due' | 'trialing' | 'incomplete';
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  currentPeriodStart?: Date;
  currentPeriodEnd?: Date;
  cancelAtPeriodEnd: boolean;
  trialStart?: Date;
  trialEnd?: Date;
  canceledAt?: Date;
  endedAt?: Date;
}

interface IUsage {
  productsTracked: number;
  maxProducts: number;
  apiCalls: number;
  maxApiCalls: number;
  emailsSent: number;
  maxEmails: number;
  resetDate: Date;
}

interface IPreferences {
  notifications: {
    email: boolean;
    priceAlerts: boolean;
    weeklyReport: boolean;
    marketingEmails: boolean;
  };
  currency: 'RON' | 'EUR' | 'USD';
  language: 'ro' | 'en';
  timezone: string;
  dashboard: {
    defaultView: 'grid' | 'list' | 'analytics';
    itemsPerPage: number;
  };
}

interface IConsent {
  functional: {
    granted: boolean;
    timestamp: Date;
    ipAddress?: string;
  };
  analytics: {
    granted: boolean;
    timestamp?: Date;
    ipAddress?: string;
  };
  marketing: {
    granted: boolean;
    timestamp?: Date;
    ipAddress?: string;
  };
  lastUpdated: Date;
}

interface IUser extends Document {
  clerkId: string;
  email: string;
  emailVerified: boolean;
  firstName: string;
  lastName: string;
  avatar?: string;
  role: 'user' | 'admin' | 'moderator';
  tenantId: string;
  status: 'active' | 'suspended' | 'deleted' | 'pending';
  subscription: ISubscription;
  usage: IUsage;
  preferences: IPreferences;
  consent: IConsent;
  lastLoginAt?: Date;
  loginCount: number;
  referralCode?: string;
  referredBy?: Types.ObjectId;
  deletedAt?: Date;
  apiKey?: string;
  apiKeyCreatedAt?: Date;
  apiKeyLastUsed?: Date;
  
  // Virtuals
  fullName: string;
  isSubscriptionActive: boolean;
  isOnTrial: boolean;
  
  // Methods
  canTrackMoreProducts(): boolean;
  canMakeApiCall(): boolean;
  incrementUsage(type: 'products' | 'apiCalls' | 'emails'): Promise<IUser>;
  resetMonthlyUsage(): Promise<IUser>;
  generateApiKey(): Promise<IUser>;
}

interface IUserModel extends Model<IUser> {
  findActiveUsers(): Promise<IUser[]>;
  findBySubscriptionPlan(plan: string): Promise<IUser[]>;
  findExpiredTrials(): Promise<IUser[]>;
}

// User subscription schema
const subscriptionSchema = new mongoose.Schema({
  plan: {
    type: String,
    enum: ['free', 'pro', 'enterprise'],
    default: 'free',
    required: true,
    index: true
  },
  status: {
    type: String,
    enum: ['active', 'cancelled', 'past_due', 'trialing', 'incomplete'],
    default: 'active',
    required: true,
    index: true
  },
  stripeCustomerId: {
    type: String,
    sparse: true, // Only indexed when present
    index: true
  },
  stripeSubscriptionId: {
    type: String,
    sparse: true,
    index: true
  },
  currentPeriodStart: {
    type: Date,
    index: true
  },
  currentPeriodEnd: {
    type: Date,
    index: true
  },
  cancelAtPeriodEnd: {
    type: Boolean,
    default: false
  },
  trialStart: Date,
  trialEnd: Date,
  canceledAt: Date,
  endedAt: Date
}, { _id: false });

// Usage tracking schema
const usageSchema = new mongoose.Schema({
  productsTracked: {
    type: Number,
    default: 0,
    min: 0
  },
  maxProducts: {
    type: Number,
    required: true,
    default: 5 // Free plan limit
  },
  apiCalls: {
    type: Number,
    default: 0,
    min: 0
  },
  maxApiCalls: {
    type: Number,
    required: true,
    default: 0 // Free plan has no API access
  },
  emailsSent: {
    type: Number,
    default: 0,
    min: 0
  },
  maxEmails: {
    type: Number,
    required: true,
    default: 10 // Free plan limit
  },
  // Reset monthly usage
  resetDate: {
    type: Date,
    default: Date.now,
    index: true
  }
}, { _id: false });

// User preferences schema
const preferencesSchema = new mongoose.Schema({
  notifications: {
    email: {
      type: Boolean,
      default: true
    },
    priceAlerts: {
      type: Boolean,
      default: false // Only available for paid plans
    },
    weeklyReport: {
      type: Boolean,
      default: false
    },
    marketingEmails: {
      type: Boolean,
      default: false
    }
  },
  currency: {
    type: String,
    enum: ['RON', 'EUR', 'USD'],
    default: 'RON'
  },
  language: {
    type: String,
    enum: ['ro', 'en'],
    default: 'ro'
  },
  timezone: {
    type: String,
    default: 'Europe/Bucharest'
  },
  dashboard: {
    defaultView: {
      type: String,
      enum: ['grid', 'list', 'analytics'],
      default: 'grid'
    },
    itemsPerPage: {
      type: Number,
      default: 12,
      min: 6,
      max: 48
    }
  }
}, { _id: false });

// GDPR consent schema
const consentSchema = new mongoose.Schema({
  functional: {
    granted: { type: Boolean, required: true },
    timestamp: { type: Date, required: true },
    ipAddress: String
  },
  analytics: {
    granted: { type: Boolean, default: false },
    timestamp: Date,
    ipAddress: String
  },
  marketing: {
    granted: { type: Boolean, default: false },
    timestamp: Date,
    ipAddress: String
  },
  lastUpdated: {
    type: Date,
    default: Date.now
  }
}, { _id: false });

// Main user schema
const userSchema = new mongoose.Schema({
  // Authentication fields
  clerkId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    index: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
  },
  emailVerified: {
    type: Boolean,
    default: false,
    index: true
  },
  
  // Profile information
  firstName: {
    type: String,
    required: true,
    trim: true,
    maxlength: [50, 'First name cannot exceed 50 characters']
  },
  lastName: {
    type: String,
    required: true,
    trim: true,
    maxlength: [50, 'Last name cannot exceed 50 characters']
  },
  avatar: {
    type: String,
    default: null
  },
  
  // Role-based access control
  role: {
    type: String,
    enum: ['user', 'admin', 'moderator'],
    default: 'user',
    index: true
  },
  
  // Multi-tenancy support
  tenantId: {
    type: String,
    required: false, // Not required, but will be set by pre-save middleware
    index: true,
    default: 'default'
  },
  
  // Account status
  status: {
    type: String,
    enum: ['active', 'suspended', 'deleted', 'pending'],
    default: 'active',
    index: true
  },
  
  // SaaS-specific fields
  subscription: {
    type: subscriptionSchema,
    required: true,
    default: () => ({})
  },
  usage: {
    type: usageSchema,
    required: true,
    default: () => ({})
  },
  preferences: {
    type: preferencesSchema,
    required: true,
    default: () => ({})
  },
  
  // GDPR compliance
  consent: {
    type: consentSchema,
    required: true
  },
  
  // Analytics and tracking
  lastLoginAt: {
    type: Date,
    index: true
  },
  loginCount: {
    type: Number,
    default: 0
  },
  referralCode: {
    type: String,
    unique: true,
    sparse: true,
    index: true
  },
  referredBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    index: true
  },
  
  // Soft delete
  deletedAt: {
    type: Date,
    index: true
  },
  
  // API access
  apiKey: {
    type: String,
    unique: true,
    sparse: true,
    index: true
  },
  apiKeyCreatedAt: Date,
  apiKeyLastUsed: Date
}, {
  timestamps: true,
  // Add virtual for full name
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Compound indexes for performance
userSchema.index({ email: 1, status: 1 });
userSchema.index({ tenantId: 1, role: 1 });
userSchema.index({ 'subscription.plan': 1, 'subscription.status': 1 });
userSchema.index({ 'subscription.currentPeriodEnd': 1, 'subscription.status': 1 });
userSchema.index({ clerkId: 1, status: 1 });
userSchema.index({ referralCode: 1, status: 1 });
userSchema.index({ createdAt: 1, 'subscription.plan': 1 });

// Text index for search
userSchema.index({
  firstName: 'text',
  lastName: 'text',
  email: 'text'
});

// Virtual for full name
userSchema.virtual('fullName').get(function(this: IUser) {
  return `${this.firstName} ${this.lastName}`;
});

// Virtual for active subscription
userSchema.virtual('isSubscriptionActive').get(function(this: IUser) {
  return this.subscription?.status === 'active' && 
         this.subscription?.currentPeriodEnd && 
         this.subscription?.currentPeriodEnd > new Date();
});

// Virtual for trial status
userSchema.virtual('isOnTrial').get(function(this: IUser) {
  return this.subscription?.status === 'trialing' && 
         this.subscription?.trialEnd && 
         this.subscription?.trialEnd > new Date();
});

// Pre-save middleware
userSchema.pre('save', async function(this: IUser, next: mongoose.CallbackWithoutResultAndOptionalError) {
  // Ensure tenantId is always set (for both new and existing documents)
  if (!this.tenantId) {
    this.tenantId = 'default';
  }
  
  // Generate referral code if not exists
  if (!this.referralCode && this.isNew) {
    this.referralCode = `${this.firstName.toLowerCase()}${Math.random().toString(36).substr(2, 6)}`;
  }
  
  // Update usage limits based on subscription plan
  if (this.isModified('subscription.plan')) {
    const planLimits = {
      free: { maxProducts: 5, maxApiCalls: 0, maxEmails: 10 },
      pro: { maxProducts: 50, maxApiCalls: 1000, maxEmails: 100 },
      enterprise: { maxProducts: -1, maxApiCalls: 10000, maxEmails: 1000 } // -1 means unlimited
    };
    
    const limits = planLimits[this.subscription.plan];
    if (limits) {
      this.usage.maxProducts = limits.maxProducts;
      this.usage.maxApiCalls = limits.maxApiCalls;
      this.usage.maxEmails = limits.maxEmails;
    }
  }
  
  next();
});

// Static methods
userSchema.statics.findActiveUsers = function() {
  return this.find({ 
    status: 'active', 
    deletedAt: { $exists: false } 
  });
};

userSchema.statics.findBySubscriptionPlan = function(plan: string) {
  return this.find({ 
    'subscription.plan': plan,
    'subscription.status': 'active',
    status: 'active'
  });
};

userSchema.statics.findExpiredTrials = function() {
  return this.find({
    'subscription.status': 'trialing',
    'subscription.trialEnd': { $lt: new Date() }
  });
};

// Instance methods
userSchema.methods.canTrackMoreProducts = function() {
  if (this.usage.maxProducts === -1) return true; // Unlimited
  return this.usage.productsTracked < this.usage.maxProducts;
};

userSchema.methods.canMakeApiCall = function() {
  if (this.usage.maxApiCalls === -1) return true; // Unlimited
  return this.usage.apiCalls < this.usage.maxApiCalls;
};

userSchema.methods.incrementUsage = function(type: 'products' | 'apiCalls' | 'emails') {
  const field = type === 'products' ? 'productsTracked' : 
                type === 'apiCalls' ? 'apiCalls' : 'emailsSent';
  this.usage[field] += 1;
  return this.save();
};

userSchema.methods.resetMonthlyUsage = function() {
  this.usage.apiCalls = 0;
  this.usage.emailsSent = 0;
  this.usage.resetDate = new Date();
  return this.save();
};

userSchema.methods.generateApiKey = function() {
  this.apiKey = `sv_${Math.random().toString(36).substr(2, 32)}`;
  this.apiKeyCreatedAt = new Date();
  return this.save();
};

const User = mongoose.models.User || mongoose.model('User', userSchema);

export default User;