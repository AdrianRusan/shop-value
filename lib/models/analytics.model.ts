import mongoose, { Document, Model } from 'mongoose';

// Interface for event tracking
interface IEvent {
  userId?: string;
  sessionId: string;
  event: string;
  properties: Record<string, any>;
  timestamp: Date;
  userAgent?: string;
  ipAddress?: string;
  page?: string;
  referrer?: string;
}

// Interface for system metrics
interface ISystemMetrics {
  timestamp: Date;
  memoryUsage: {
    rss: number;
    heapTotal: number;
    heapUsed: number;
    external: number;
  };
  cpuUsage: {
    user: number;
    system: number;
  };
  activeConnections: number;
  queueSize: number;
  responseTime: number;
  errorRate: number;
}

// Interface for business metrics
interface IBusinessMetrics {
  date: Date;
  newUsers: number;
  activeUsers: number;
  productsTracked: number;
  priceAlertsTriggered: number;
  subscriptionSignups: number;
  subscriptionCancellations: number;
  revenue: number;
  apiCalls: number;
  scrapingJobs: number;
  emailsSent: number;
  errorCount: number;
  averageResponseTime: number;
}

// Interface for user behavior analytics
interface IUserBehavior {
  userId: string;
  sessionId: string;
  tenantId: string;
  startTime: Date;
  endTime?: Date;
  duration?: number;
  pageViews: number;
  productsViewed: string[];
  productsTracked: string[];
  searchQueries: string[];
  actions: {
    type: string;
    target: string;
    timestamp: Date;
    metadata?: Record<string, any>;
  }[];
  deviceInfo: {
    type: 'desktop' | 'mobile' | 'tablet';
    browser: string;
    os: string;
    screenResolution?: string;
  };
  location?: {
    country: string;
    city: string;
    timezone: string;
  };
}

// Main analytics interfaces
interface IAnalytics extends Document {
  // Event tracking
  events: IEvent[];
  
  // System performance
  systemMetrics: ISystemMetrics[];
  
  // Business KPIs
  businessMetrics: IBusinessMetrics[];
  
  // User behavior
  userBehavior: IUserBehavior[];
  
  // Tenant-specific analytics
  tenantId: string;
  
  // Aggregated data
  aggregatedData: {
    daily: Record<string, any>;
    weekly: Record<string, any>;
    monthly: Record<string, any>;
  };
  
  // Methods
  trackEvent(event: Partial<IEvent>): Promise<IAnalytics>;
  recordSystemMetrics(metrics: ISystemMetrics): Promise<IAnalytics>;
  recordBusinessMetrics(metrics: IBusinessMetrics): Promise<IAnalytics>;
  trackUserBehavior(behavior: Partial<IUserBehavior>): Promise<IAnalytics>;
}

interface IAnalyticsModel extends Model<IAnalytics> {
  getBusinessMetrics(tenantId: string, dateRange: { start: Date; end: Date }): Promise<any>;
  getUserBehaviorInsights(tenantId: string, userId?: string): Promise<any>;
  getSystemPerformance(dateRange: { start: Date; end: Date }): Promise<any>;
  getPopularProducts(tenantId: string, limit?: number): Promise<any>;
  generateReport(tenantId: string, type: 'daily' | 'weekly' | 'monthly'): Promise<any>;
}

// Event schema for detailed tracking
const eventSchema = new mongoose.Schema({
  userId: {
    type: String,
    index: true
  },
  sessionId: {
    type: String,
    required: true,
    index: true
  },
  event: {
    type: String,
    required: true,
    index: true,
    enum: [
      'page_view',
      'product_view',
      'product_track',
      'product_untrack',
      'search',
      'signup',
      'login',
      'logout',
      'subscription_created',
      'subscription_cancelled',
      'price_alert_triggered',
      'api_call',
      'error',
      'feature_used'
    ]
  },
  properties: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  },
  userAgent: String,
  ipAddress: String,
  page: String,
  referrer: String
}, { _id: false });

// System metrics schema
const systemMetricsSchema = new mongoose.Schema({
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  },
  memoryUsage: {
    rss: Number,
    heapTotal: Number,
    heapUsed: Number,
    external: Number
  },
  cpuUsage: {
    user: Number,
    system: Number
  },
  activeConnections: {
    type: Number,
    default: 0
  },
  queueSize: {
    type: Number,
    default: 0
  },
  responseTime: {
    type: Number,
    default: 0
  },
  errorRate: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  }
}, { _id: false });

// Business metrics schema
const businessMetricsSchema = new mongoose.Schema({
  date: {
    type: Date,
    required: true,
    index: true
  },
  newUsers: {
    type: Number,
    default: 0,
    min: 0
  },
  activeUsers: {
    type: Number,
    default: 0,
    min: 0
  },
  productsTracked: {
    type: Number,
    default: 0,
    min: 0
  },
  priceAlertsTriggered: {
    type: Number,
    default: 0,
    min: 0
  },
  subscriptionSignups: {
    type: Number,
    default: 0,
    min: 0
  },
  subscriptionCancellations: {
    type: Number,
    default: 0,
    min: 0
  },
  revenue: {
    type: Number,
    default: 0,
    min: 0
  },
  apiCalls: {
    type: Number,
    default: 0,
    min: 0
  },
  scrapingJobs: {
    type: Number,
    default: 0,
    min: 0
  },
  emailsSent: {
    type: Number,
    default: 0,
    min: 0
  },
  errorCount: {
    type: Number,
    default: 0,
    min: 0
  },
  averageResponseTime: {
    type: Number,
    default: 0,
    min: 0
  }
}, { _id: false });

// User behavior schema
const userBehaviorSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    index: true
  },
  sessionId: {
    type: String,
    required: true,
    index: true
  },
  tenantId: {
    type: String,
    required: true,
    index: true
  },
  startTime: {
    type: Date,
    default: Date.now,
    index: true
  },
  endTime: Date,
  duration: Number, // in milliseconds
  pageViews: {
    type: Number,
    default: 0,
    min: 0
  },
  productsViewed: [{
    type: String
  }],
  productsTracked: [{
    type: String
  }],
  searchQueries: [{
    type: String
  }],
  actions: [{
    type: {
      type: String,
      required: true
    },
    target: String,
    timestamp: {
      type: Date,
      default: Date.now
    },
    metadata: mongoose.Schema.Types.Mixed
  }],
  deviceInfo: {
    type: {
      type: String,
      enum: ['desktop', 'mobile', 'tablet'],
      required: true
    },
    browser: String,
    os: String,
    screenResolution: String
  },
  location: {
    country: String,
    city: String,
    timezone: String
  }
}, { _id: false });

// Main analytics schema
const analyticsSchema = new mongoose.Schema<IAnalytics>({
  // Tenant isolation
  tenantId: {
    type: String,
    required: true,
    index: true
  },
  
  // Event tracking array
  events: [eventSchema],
  
  // System metrics array
  systemMetrics: [systemMetricsSchema],
  
  // Business metrics array
  businessMetrics: [businessMetricsSchema],
  
  // User behavior array
  userBehavior: [userBehaviorSchema],
  
  // Pre-aggregated data for performance
  aggregatedData: {
    daily: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },
    weekly: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },
    monthly: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    }
  }
}, {
  timestamps: true,
  // Cap collection size for performance
  capped: { size: 100000000, max: 10000 } // 100MB, 10k documents max
});

// Compound indexes for efficient queries
analyticsSchema.index({ tenantId: 1, 'events.timestamp': -1 });
analyticsSchema.index({ tenantId: 1, 'events.event': 1, 'events.timestamp': -1 });
analyticsSchema.index({ tenantId: 1, 'userBehavior.userId': 1, 'userBehavior.startTime': -1 });
analyticsSchema.index({ tenantId: 1, 'businessMetrics.date': -1 });
analyticsSchema.index({ 'systemMetrics.timestamp': -1 });
analyticsSchema.index({ 'events.sessionId': 1, 'events.timestamp': 1 });

// TTL index for automatic cleanup (data older than 2 years)
analyticsSchema.index({ createdAt: 1 }, { expireAfterSeconds: 63072000 });

// Instance methods
analyticsSchema.methods.trackEvent = async function(eventData: Partial<IEvent>) {
  this.events.push({
    sessionId: eventData.sessionId || 'unknown',
    event: eventData.event || 'unknown',
    properties: eventData.properties || {},
    timestamp: eventData.timestamp || new Date(),
    userId: eventData.userId,
    userAgent: eventData.userAgent,
    ipAddress: eventData.ipAddress,
    page: eventData.page,
    referrer: eventData.referrer
  });
  
  return this.save();
};

analyticsSchema.methods.recordSystemMetrics = async function(metrics: ISystemMetrics) {
  this.systemMetrics.push(metrics);
  
  // Keep only last 1000 system metrics to prevent document bloat
  if (this.systemMetrics.length > 1000) {
    this.systemMetrics = this.systemMetrics.slice(-1000);
  }
  
  return this.save();
};

analyticsSchema.methods.recordBusinessMetrics = async function(metrics: IBusinessMetrics) {
  // Check if metrics for this date already exist
  const existingIndex = this.businessMetrics.findIndex(
    (m: IBusinessMetrics) => m.date.toDateString() === metrics.date.toDateString()
  );
  
  if (existingIndex >= 0) {
    // Update existing metrics
    this.businessMetrics[existingIndex] = metrics;
  } else {
    // Add new metrics
    this.businessMetrics.push(metrics);
  }
  
  return this.save();
};

analyticsSchema.methods.trackUserBehavior = async function(behaviorData: Partial<IUserBehavior>) {
  const behavior = {
    userId: behaviorData.userId || 'anonymous',
    sessionId: behaviorData.sessionId || 'unknown',
    tenantId: behaviorData.tenantId || this.tenantId,
    startTime: behaviorData.startTime || new Date(),
    pageViews: behaviorData.pageViews || 0,
    productsViewed: behaviorData.productsViewed || [],
    productsTracked: behaviorData.productsTracked || [],
    searchQueries: behaviorData.searchQueries || [],
    actions: behaviorData.actions || [],
    deviceInfo: behaviorData.deviceInfo || {
      type: 'desktop',
      browser: 'unknown',
      os: 'unknown'
    },
    ...behaviorData
  };
  
  this.userBehavior.push(behavior);
  
  return this.save();
};

// Static methods for analytics queries
analyticsSchema.statics.getBusinessMetrics = async function(
  tenantId: string, 
  dateRange: { start: Date; end: Date }
) {
  return this.aggregate([
    { $match: { tenantId } },
    { $unwind: '$businessMetrics' },
    {
      $match: {
        'businessMetrics.date': {
          $gte: dateRange.start,
          $lte: dateRange.end
        }
      }
    },
    {
      $group: {
        _id: null,
        totalNewUsers: { $sum: '$businessMetrics.newUsers' },
        totalActiveUsers: { $max: '$businessMetrics.activeUsers' },
        totalProductsTracked: { $sum: '$businessMetrics.productsTracked' },
        totalRevenue: { $sum: '$businessMetrics.revenue' },
        totalApiCalls: { $sum: '$businessMetrics.apiCalls' },
        averageResponseTime: { $avg: '$businessMetrics.averageResponseTime' },
        dailyMetrics: { $push: '$businessMetrics' }
      }
    }
  ]);
};

analyticsSchema.statics.getUserBehaviorInsights = async function(
  tenantId: string,
  userId?: string
) {
  const matchStage: any = { tenantId };
  if (userId) {
    matchStage['userBehavior.userId'] = userId;
  }
  
  return this.aggregate([
    { $match: matchStage },
    { $unwind: '$userBehavior' },
    {
      $group: {
        _id: '$userBehavior.userId',
        totalSessions: { $sum: 1 },
        totalPageViews: { $sum: '$userBehavior.pageViews' },
        totalProductsViewed: { $sum: { $size: '$userBehavior.productsViewed' } },
        totalProductsTracked: { $sum: { $size: '$userBehavior.productsTracked' } },
        averageSessionDuration: { $avg: '$userBehavior.duration' },
        lastActivity: { $max: '$userBehavior.startTime' },
        deviceTypes: { $addToSet: '$userBehavior.deviceInfo.type' },
        topActions: { $push: '$userBehavior.actions' }
      }
    },
    { $sort: { lastActivity: -1 } }
  ]);
};

analyticsSchema.statics.getSystemPerformance = async function(
  dateRange: { start: Date; end: Date }
) {
  return this.aggregate([
    { $unwind: '$systemMetrics' },
    {
      $match: {
        'systemMetrics.timestamp': {
          $gte: dateRange.start,
          $lte: dateRange.end
        }
      }
    },
    {
      $group: {
        _id: null,
        averageResponseTime: { $avg: '$systemMetrics.responseTime' },
        maxMemoryUsage: { $max: '$systemMetrics.memoryUsage.heapUsed' },
        averageMemoryUsage: { $avg: '$systemMetrics.memoryUsage.heapUsed' },
        averageErrorRate: { $avg: '$systemMetrics.errorRate' },
        maxActiveConnections: { $max: '$systemMetrics.activeConnections' },
        metrics: { $push: '$systemMetrics' }
      }
    }
  ]);
};

analyticsSchema.statics.getPopularProducts = async function(
  tenantId: string,
  limit: number = 10
) {
  return this.aggregate([
    { $match: { tenantId } },
    { $unwind: '$events' },
    {
      $match: {
        'events.event': { $in: ['product_view', 'product_track'] },
        'events.properties.productId': { $exists: true }
      }
    },
    {
      $group: {
        _id: '$events.properties.productId',
        viewCount: {
          $sum: { $cond: [{ $eq: ['$events.event', 'product_view'] }, 1, 0] }
        },
        trackCount: {
          $sum: { $cond: [{ $eq: ['$events.event', 'product_track'] }, 1, 0] }
        },
        totalEngagement: { $sum: 1 }
      }
    },
    { $sort: { totalEngagement: -1 } },
    { $limit: limit }
  ]);
};

analyticsSchema.statics.generateReport = async function(
  tenantId: string,
  type: 'daily' | 'weekly' | 'monthly'
) {
  const now = new Date();
  let startDate: Date;
  
  switch (type) {
    case 'daily':
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
      break;
    case 'weekly':
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);
      break;
    case 'monthly':
      startDate = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
      break;
    default:
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  }
  
  // Get business metrics, user behavior, and system performance
  // Note: We'll use the exported Analytics model after it's defined
  // For now, return a basic report structure
  return {
    period: { start: startDate, end: now, type },
    businessMetrics: {},
    userInsights: [],
    popularProducts: [],
    generatedAt: new Date()
  };
};

const Analytics = (mongoose.models.Analytics || 
  mongoose.model<IAnalytics>('Analytics', analyticsSchema)) as IAnalyticsModel;

export default Analytics;