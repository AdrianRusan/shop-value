import mongoose, { Document, Model } from 'mongoose';

interface IAuditLog extends Document {
  userId: string;
  action: 'consent_updated' | 'data_exported' | 'data_deleted' | 'data_accessed' | 'login' | 'logout';
  entityType: 'user_consent' | 'user_data' | 'user_account' | 'product_data' | 'price_history';
  entityId: string;
  changes?: Record<string, any>;
  ipAddress: string;
  userAgent: string;
  timestamp: Date;
}

interface IAuditLogModel extends Model<IAuditLog> {
  findByUserId(userId: string): Promise<IAuditLog[]>;
  findByAction(action: string): Promise<IAuditLog[]>;
}

const auditLogSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    index: true
  },
  action: {
    type: String,
    required: true,
    enum: [
      'consent_updated',
      'data_exported', 
      'data_deleted',
      'data_accessed',
      'login',
      'logout'
    ],
    index: true
  },
  entityType: {
    type: String,
    required: true,
    enum: [
      'user_consent',
      'user_data',
      'user_account',
      'product_data',
      'price_history'
    ],
    index: true
  },
  entityId: {
    type: String,
    required: true,
    index: true
  },
  changes: {
    type: mongoose.Schema.Types.Mixed,
    default: null
  },
  ipAddress: {
    type: String,
    required: true,
    index: true
  },
  userAgent: {
    type: String,
    required: true
  },
  timestamp: {
    type: Date,
    default: Date.now,
    required: true,
    index: true
  }
}, {
  timestamps: false // We're using our own timestamp field
});

// Compound indexes for efficient querying
auditLogSchema.index({ userId: 1, timestamp: -1 });
auditLogSchema.index({ action: 1, timestamp: -1 });
auditLogSchema.index({ entityType: 1, entityId: 1, timestamp: -1 });

// TTL index to automatically delete logs after 7 years (GDPR requirement)
auditLogSchema.index({ timestamp: 1 }, { expireAfterSeconds: 7 * 365 * 24 * 60 * 60 });

// Static methods
auditLogSchema.statics.findByUserId = function(userId: string) {
  return this.find({ userId }).sort({ timestamp: -1 });
};

auditLogSchema.statics.findByAction = function(action: string) {
  return this.find({ action }).sort({ timestamp: -1 });
};

const AuditLog = (mongoose.models.AuditLog || mongoose.model<IAuditLog, IAuditLogModel>('AuditLog', auditLogSchema)) as IAuditLogModel;

export { AuditLog };
export type { IAuditLog };