import mongoose, { Document, Model, Types, CallbackWithoutResultAndOptionalError } from 'mongoose';

// Interface for price alert
interface IPriceAlert extends Document {
  userId: string; // Clerk user ID
  productId: Types.ObjectId;
  email: string;
  
  // Alert configuration
  alertType: 'target_price' | 'percentage_drop' | 'significant_drop' | 'back_in_stock' | 'any_drop';
  targetPrice?: number; // For target_price alerts
  percentageThreshold?: number; // For percentage_drop alerts (e.g., 10 for 10%)
  significantDropAmount?: number; // For significant_drop alerts in currency
  
  // Frequency controls to prevent spam
  frequency: 'immediate' | 'daily' | 'weekly';
  lastTriggered?: Date;
  maxAlertsPerDay: number;
  alertsToday: number;
  lastResetDate: Date;
  
  // Alert status
  isActive: boolean;
  isPaused: boolean;
  pausedUntil?: Date;
  
  // Tracking
  triggerCount: number;
  createdAt: Date;
  updatedAt: Date;
  
  // Methods
  canTriggerAlert(): boolean;
  recordAlertTrigger(): Promise<IPriceAlert>;
  resetDailyCount(): Promise<IPriceAlert>;
  pauseTemporarily(hours: number): Promise<IPriceAlert>;
}

interface IPriceAlertModel extends Model<IPriceAlert> {
  findActiveAlerts(): Promise<IPriceAlert[]>;
  findUserAlerts(userId: string): Promise<IPriceAlert[]>;
  findAlertsForProduct(productId: string): Promise<IPriceAlert[]>;
  findDueForCheck(): Promise<IPriceAlert[]>;
}

// Price Alert Schema
const priceAlertSchema = new mongoose.Schema<IPriceAlert>({
  userId: {
    type: String,
    required: [true, 'User ID is required'],
    index: true
  },
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: [true, 'Product ID is required'],
    index: true
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    lowercase: true,
    trim: true
  },
  
  // Alert configuration
  alertType: {
    type: String,
    enum: ['target_price', 'percentage_drop', 'significant_drop', 'back_in_stock', 'any_drop'],
    required: [true, 'Alert type is required'],
    index: true
  },
  targetPrice: {
    type: Number,
    min: [0, 'Target price cannot be negative'],
    validate: {
      validator: function(this: IPriceAlert, value: number) {
        return this.alertType !== 'target_price' || (value !== undefined && value > 0);
      },
      message: 'Target price is required for target_price alerts'
    }
  },
  percentageThreshold: {
    type: Number,
    min: [1, 'Percentage threshold must be at least 1%'],
    max: [90, 'Percentage threshold cannot exceed 90%'],
    validate: {
      validator: function(this: IPriceAlert, value: number) {
        return this.alertType !== 'percentage_drop' || (value !== undefined && value > 0);
      },
      message: 'Percentage threshold is required for percentage_drop alerts'
    }
  },
  significantDropAmount: {
    type: Number,
    min: [1, 'Significant drop amount must be at least 1'],
    validate: {
      validator: function(this: IPriceAlert, value: number) {
        return this.alertType !== 'significant_drop' || (value !== undefined && value > 0);
      },
      message: 'Significant drop amount is required for significant_drop alerts'
    }
  },
  
  // Frequency controls
  frequency: {
    type: String,
    enum: ['immediate', 'daily', 'weekly'],
    default: 'immediate',
    index: true
  },
  lastTriggered: {
    type: Date,
    index: true
  },
  maxAlertsPerDay: {
    type: Number,
    default: 5,
    min: [1, 'Max alerts per day must be at least 1'],
    max: [50, 'Max alerts per day cannot exceed 50']
  },
  alertsToday: {
    type: Number,
    default: 0,
    min: 0
  },
  lastResetDate: {
    type: Date,
    default: Date.now,
    index: true
  },
  
  // Status
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  isPaused: {
    type: Boolean,
    default: false,
    index: true
  },
  pausedUntil: {
    type: Date,
    index: true
  },
  
  // Tracking
  triggerCount: {
    type: Number,
    default: 0,
    min: 0
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Compound indexes for performance
priceAlertSchema.index({ userId: 1, productId: 1 });
priceAlertSchema.index({ isActive: 1, isPaused: 1 });
priceAlertSchema.index({ lastResetDate: 1, alertsToday: 1 });
priceAlertSchema.index({ frequency: 1, lastTriggered: 1 });
priceAlertSchema.index({ pausedUntil: 1 }, { sparse: true });
priceAlertSchema.index({ createdAt: 1, userId: 1 });

// Pre-save middleware
priceAlertSchema.pre('save', async function(this: IPriceAlert, next: CallbackWithoutResultAndOptionalError) {
  // Reset daily count if it's a new day
  const today = new Date();
  const lastReset = new Date(this.lastResetDate);
  
  if (today.toDateString() !== lastReset.toDateString()) {
    this.alertsToday = 0;
    this.lastResetDate = today;
  }
  
  // Check if pause period has expired
  if (this.isPaused && this.pausedUntil && new Date() > this.pausedUntil) {
    this.isPaused = false;
    this.pausedUntil = undefined;
  }
  
  next();
});

// Instance methods
priceAlertSchema.methods.canTriggerAlert = function(this: IPriceAlert): boolean {
  // Check if alert is active
  if (!this.isActive || this.isPaused) return false;
  
  // Check if paused temporarily
  if (this.pausedUntil && new Date() < this.pausedUntil) return false;
  
  // Check daily limit
  if (this.alertsToday >= this.maxAlertsPerDay) return false;
  
  // Check frequency constraints
  if (this.frequency !== 'immediate' && this.lastTriggered) {
    const now = new Date();
    const lastTriggered = new Date(this.lastTriggered);
    
    if (this.frequency === 'daily') {
      const daysDiff = Math.floor((now.getTime() - lastTriggered.getTime()) / (24 * 60 * 60 * 1000));
      if (daysDiff < 1) return false;
    } else if (this.frequency === 'weekly') {
      const weeksDiff = Math.floor((now.getTime() - lastTriggered.getTime()) / (7 * 24 * 60 * 60 * 1000));
      if (weeksDiff < 1) return false;
    }
  }
  
  return true;
};

priceAlertSchema.methods.recordAlertTrigger = function(this: IPriceAlert): Promise<IPriceAlert> {
  this.lastTriggered = new Date();
  this.alertsToday += 1;
  this.triggerCount += 1;
  return this.save();
};

priceAlertSchema.methods.resetDailyCount = function(this: IPriceAlert): Promise<IPriceAlert> {
  this.alertsToday = 0;
  this.lastResetDate = new Date();
  return this.save();
};

priceAlertSchema.methods.pauseTemporarily = function(this: IPriceAlert, hours: number): Promise<IPriceAlert> {
  this.isPaused = true;
  this.pausedUntil = new Date(Date.now() + hours * 60 * 60 * 1000);
  return this.save();
};

// Static methods
priceAlertSchema.statics.findActiveAlerts = function() {
  return this.find({
    isActive: true,
    isPaused: false,
    $or: [
      { pausedUntil: { $exists: false } },
      { pausedUntil: { $lt: new Date() } }
    ]
  }).populate('productId');
};

priceAlertSchema.statics.findUserAlerts = function(userId: string) {
  return this.find({ userId }).populate('productId');
};

priceAlertSchema.statics.findAlertsForProduct = function(productId: string) {
  return this.find({
    productId,
    isActive: true,
    isPaused: false
  }).populate('productId');
};

priceAlertSchema.statics.findDueForCheck = function() {
  const now = new Date();
  
  return this.find({
    isActive: true,
    isPaused: false,
    $or: [
      { pausedUntil: { $exists: false } },
      { pausedUntil: { $lt: now } }
    ],
    $expr: { $lt: ['$alertsToday', '$maxAlertsPerDay'] }
  }).populate('productId');
};

const PriceAlert = (mongoose.models.PriceAlert || 
  mongoose.model<IPriceAlert>('PriceAlert', priceAlertSchema)) as IPriceAlertModel;

export default PriceAlert;
export type { IPriceAlert };