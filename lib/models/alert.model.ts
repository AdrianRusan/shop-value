import mongoose, { Schema, Document } from 'mongoose';

export interface IAlert extends Document {
  userId: string;
  productId: string;
  type: 'price_drop' | 'back_in_stock' | 'price_threshold';
  threshold?: number;
  isActive: boolean;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  notificationMethods: ('email' | 'push' | 'sms')[];
  lastTriggered?: Date;
  triggeredCount: number;
  createdAt: Date;
  updatedAt: Date;
}

const alertSchema = new Schema<IAlert>({
  userId: {
    type: String,
    required: true,
    index: true,
  },
  productId: {
    type: String,
    required: true,
    ref: 'Product',
    index: true,
  },
  type: {
    type: String,
    enum: ['price_drop', 'back_in_stock', 'price_threshold'],
    required: true,
  },
  threshold: {
    type: Number,
    min: 0,
    required: function(this: IAlert) {
      return this.type === 'price_threshold';
    },
  },
  isActive: {
    type: Boolean,
    default: true,
    index: true,
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium',
  },
  notificationMethods: [{
    type: String,
    enum: ['email', 'push', 'sms'],
  }],
  lastTriggered: {
    type: Date,
    default: null,
  },
  triggeredCount: {
    type: Number,
    default: 0,
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

// Indexes for performance
alertSchema.index({ userId: 1, productId: 1, type: 1 });
alertSchema.index({ isActive: 1, type: 1 });
alertSchema.index({ createdAt: -1 });

// Update updatedAt on save
alertSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

const Alert = mongoose.models.Alert || mongoose.model<IAlert>('Alert', alertSchema);

export default Alert; 