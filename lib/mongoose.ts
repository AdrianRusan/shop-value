import mongoose from 'mongoose';
import * as Sentry from '@sentry/nextjs';
import { redis } from './upstash';

// Add Node.js types
declare global {
  namespace NodeJS {
    interface ProcessEnv {
      MONGODB_URI?: string;
      DATABASE_URL?: string;
    }
  }
}

const MONGODB_URI = process.env.MONGODB_URI || process.env.DATABASE_URL;

if (!MONGODB_URI) {
  throw new Error(
    'Please define the MONGODB_URI environment variable inside .env.local'
  );
}

interface ConnectionState {
  isConnected: boolean;
  isConnecting: boolean;
  lastConnected?: Date;
  retryCount: number;
  connectionErrors: string[];
  connectionTime?: number;
  totalQueries: number;
  slowQueries: number;
  avgQueryTime: number;
  peakConnections: number;
  currentConnections: number;
}

interface PerformanceMetrics {
  queryCount: number;
  slowQueryCount: number;
  avgResponseTime: number;
  peakResponseTime: number;
  cacheHits: number;
  cacheMisses: number;
  connectionPoolUsage: number;
  lastOptimizationRun?: Date;
}

let connectionState: ConnectionState = {
  isConnected: false,
  isConnecting: false,
  retryCount: 0,
  connectionErrors: [],
  totalQueries: 0,
  slowQueries: 0,
  avgQueryTime: 0,
  peakConnections: 0,
  currentConnections: 0,
};

let performanceMetrics: PerformanceMetrics = {
  queryCount: 0,
  slowQueryCount: 0,
  avgResponseTime: 0,
  peakResponseTime: 0,
  cacheHits: 0,
  cacheMisses: 0,
  connectionPoolUsage: 0,
};

// Enhanced connection options for production performance
const connectionOptions: mongoose.ConnectOptions = {
  // Optimized connection pool settings
  maxPoolSize: process.env.NODE_ENV === 'production' ? 20 : 10, // More connections in production
  minPoolSize: 2,  // Lower minimum to reduce initial load
  serverSelectionTimeoutMS: 10000, // Longer timeout for IP whitelisting issues
  socketTimeoutMS: 45000, // Longer socket timeout for network issues
  connectTimeoutMS: 10000, // Longer connection timeout for better reliability
  heartbeatFrequencyMS: 10000, // Less frequent heartbeats to reduce network load
  
  // Buffer settings optimized for performance
  bufferCommands: false, // Disable command buffering
  
  // Performance optimizations
  autoIndex: false, // Disable auto-indexing in production for performance
  autoCreate: false, // Don't auto-create collections
  
  // Advanced monitoring
  monitorCommands: true, // Always monitor for performance tracking
  
  // Write concern optimized for performance and safety
  writeConcern: {
    w: process.env.NODE_ENV === 'production' ? 'majority' : 1,
    j: true, // Ensure writes are written to journal
    wtimeout: 10000, // Longer write timeout
  },
  
  // Read preference for performance
  readPreference: 'primaryPreferred', // Allow secondary reads for better performance
  readConcern: { level: 'majority' },
  
  // Connection management
  maxIdleTimeMS: 30000, // Shorter idle time to free up connections
  compressors: ['zlib'], // Simple compression to reduce network load
  
  // Connection retry settings - Enhanced for IP whitelisting issues
  retryWrites: true,
  retryReads: true,
  
  // SSL and security optimizations
  ssl: process.env.NODE_ENV === 'production',
  
  // Family preference for better IP resolution
  family: 4, // Force IPv4 to avoid dual-stack issues
  
  // Additional resilience options
  directConnection: false, // Allow connection to replica sets
  waitQueueTimeoutMS: 5000, // Wait queue timeout
};

// Query cache for frequently accessed data
const queryCache = new Map<string, { data: any; timestamp: number; ttl: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes default TTL

let isConnected = false; // Variable to track the connection status

export const connectToDB = async () => {
  // During build time, don't attempt to connect to MongoDB
  if (process.env.BUILDING === 'true') {
    console.log('Skipping MongoDB connection during build');
    return;
  }

  mongoose.set('strictQuery', true);

  if (!process.env.MONGODB_URI) {
    console.log('MONGODB_URI is not defined');
    return;
  }

  if (isConnected) {
    console.log('MongoDB is already connected');
    return;
  }

  try {
    await mongoose.connect(process.env.MONGODB_URI);

    isConnected = true;

    console.log('MongoDB connected');
  } catch (error) {
    console.log('🔥 MongoDB connection failed:', error);
    // Re-throw the error to let the calling function handle it
    throw error;
  }
};

// Enhanced connection monitoring setup
const setupConnectionMonitoring = async () => {
  const connection = mongoose.connection;

  // Monitor connection events
  connection.on('connected', async () => {
    console.log('📡 MongoDB connected event');
    connectionState.isConnected = true;
    connectionState.lastConnected = new Date();
    
    // Track connection metrics
    await redis.hset('db:metrics:connection', {
      connected: 'true',
      connectedAt: Date.now().toString(),
      retryCount: connectionState.retryCount.toString(),
    });
  });

  connection.on('error', async (error) => {
    console.error('🔥 MongoDB connection error:', error);
    connectionState.connectionErrors.push(error.message);
    
    // Track error metrics
    await redis.incr('db:metrics:errors:total');
    await redis.setex(`db:metrics:errors:latest`, 3600, error.message);
    
    Sentry.captureException(error, {
      tags: { section: 'database', action: 'connection_error' }
    });
  });

  connection.on('disconnected', async () => {
    console.warn('⚠️ MongoDB disconnected');
    connectionState.isConnected = false;
    connectionState.currentConnections = 0;
    
    await redis.hset('db:metrics:connection', {
      connected: 'false',
      disconnectedAt: Date.now().toString(),
    });
  });

  connection.on('reconnected', async () => {
    console.log('🔄 MongoDB reconnected');
    connectionState.isConnected = true;
    connectionState.lastConnected = new Date();
    connectionState.currentConnections = 1;
    
    await redis.incr('db:metrics:reconnections');
  });

  // Enhanced query monitoring
  connection.on('commandStarted', async (event) => {
    const startTime = Date.now();
    
    // Store start time for duration calculation
    await redis.setex(`db:query:${event.requestId}`, 60, startTime.toString());
    
    if (process.env.NODE_ENV === 'development') {
      if (event.commandName === 'find' || event.commandName === 'aggregate') {
        console.log(`🔍 MongoDB ${event.commandName} started:`, {
          collection: event.command[event.commandName],
          filter: event.command.filter,
        });
      }
    }
  });

  connection.on('commandSucceeded', async (event) => {
    connectionState.totalQueries++;
    performanceMetrics.queryCount++;
    
    // Calculate query duration
    const startTimeStr = await redis.get(`db:query:${event.requestId}`);
    if (startTimeStr && typeof startTimeStr === 'string') {
      const duration = Date.now() - parseInt(startTimeStr, 10);
      
      // Update average query time
      connectionState.avgQueryTime = 
        (connectionState.avgQueryTime * (connectionState.totalQueries - 1) + duration) / connectionState.totalQueries;
      
      // Update performance metrics
      performanceMetrics.avgResponseTime = 
        (performanceMetrics.avgResponseTime * (performanceMetrics.queryCount - 1) + duration) / performanceMetrics.queryCount;
      
      if (duration > performanceMetrics.peakResponseTime) {
        performanceMetrics.peakResponseTime = duration;
      }
      
      // Track slow queries
      if (duration > 1000) { // Log slow queries (>1s)
        connectionState.slowQueries++;
        performanceMetrics.slowQueryCount++;
        
        console.warn(`🐌 Slow MongoDB ${event.commandName}: ${duration}ms`);
        
        // Store slow query details for analysis
        await redis.lpush('db:metrics:slow_queries', JSON.stringify({
          command: event.commandName,
          duration,
          timestamp: new Date().toISOString(),
          collection: (event as any).reply?.collection || 'unknown',
        }));
        
        // Keep only last 100 slow queries
        await redis.ltrim('db:metrics:slow_queries', 0, 99);
        
        Sentry.captureMessage(`Slow MongoDB Query: ${event.commandName}`, {
          level: 'warning',
          tags: { section: 'database', action: 'slow_query' },
          extra: {
            commandName: event.commandName,
            duration: duration,
            collection: event.reply?.collection,
          }
        });
      }
      
      // Store query metrics
      await redis.hmset('db:metrics:performance', {
        totalQueries: connectionState.totalQueries,
        slowQueries: connectionState.slowQueries,
        avgQueryTime: Math.round(connectionState.avgQueryTime),
        lastUpdated: Date.now(),
      });
      
      // Clean up start time
      await redis.del(`db:query:${event.requestId}`);
    }
  });

  connection.on('commandFailed', async (event) => {
    console.error(`❌ MongoDB ${event.commandName} failed:`, event.failure);
    
    await redis.incr('db:metrics:failed_queries');
    await redis.lpush('db:metrics:failed_queries_log', JSON.stringify({
      command: event.commandName,
      error: event.failure?.errmsg || 'Unknown error',
      timestamp: new Date().toISOString(),
    }));
    
    Sentry.captureException(new Error(`MongoDB Command Failed: ${event.commandName}`), {
      tags: { section: 'database', action: 'command_failed' },
      extra: {
        commandName: event.commandName,
        failure: event.failure,
      }
    });
  });
};

// Initialize performance tracking
const initializePerformanceTracking = async () => {
  // Set up periodic metrics collection
  setInterval(async () => {
    try {
      await collectAndStoreMetrics();
    } catch (error) {
      console.error('Error collecting metrics:', error);
    }
  }, 60000); // Every minute

  // Set up query cache cleanup
  setInterval(() => {
    cleanupQueryCache();
  }, 300000); // Every 5 minutes

  console.log('📈 Performance tracking initialized');
};

// Collect and store performance metrics
const collectAndStoreMetrics = async () => {
  const connection = mongoose.connection;
  if (!connection.db) return;

  try {
    // Get database stats
    const stats = await connection.db.stats();
    
    // Calculate connection pool usage
    const poolUsage = (connectionState.currentConnections / (connectionOptions.maxPoolSize || 10)) * 100;
    performanceMetrics.connectionPoolUsage = poolUsage;
    
    // Store comprehensive metrics
    await redis.hmset('db:metrics:current', {
      totalQueries: connectionState.totalQueries,
      slowQueries: connectionState.slowQueries,
      avgQueryTime: Math.round(connectionState.avgQueryTime),
      peakConnections: connectionState.peakConnections,
      currentConnections: connectionState.currentConnections,
      connectionPoolUsage: Math.round(poolUsage),
      cacheHits: performanceMetrics.cacheHits,
      cacheMisses: performanceMetrics.cacheMisses,
      dbSize: stats.dataSize,
      indexSize: stats.indexSize,
      collections: stats.collections,
      objects: stats.objects,
      timestamp: Date.now(),
    });
    
    // Store historical metrics for trending
    const hourlyKey = `db:metrics:hourly:${new Date().getHours()}`;
    await redis.hmset(hourlyKey, {
      queryCount: performanceMetrics.queryCount,
      slowQueryCount: performanceMetrics.slowQueryCount,
      avgResponseTime: Math.round(performanceMetrics.avgResponseTime),
      peakResponseTime: performanceMetrics.peakResponseTime,
      timestamp: Date.now(),
    });
    
    // Reset periodic counters
    performanceMetrics.queryCount = 0;
    performanceMetrics.slowQueryCount = 0;
    performanceMetrics.avgResponseTime = 0;
    performanceMetrics.peakResponseTime = 0;
    
  } catch (error) {
    console.error('Error collecting database metrics:', error);
  }
};

  // Query cache management
const cleanupQueryCache = () => {
  const now = Date.now();
  let cleanedCount = 0;
  
  for (const [key, cache] of Array.from(queryCache.entries())) {
    if (now - cache.timestamp > cache.ttl) {
      queryCache.delete(key);
      cleanedCount++;
    }
  }
  
  if (cleanedCount > 0) {
    console.log(`🧹 Cleaned ${cleanedCount} expired cache entries`);
  }
};

// Enhanced database performance helpers
export const dbPerformance = {
  // Create lean query for better performance
  createLeanQuery: <T>(model: mongoose.Model<T>) => {
    return model.find().lean().exec();
  },

  // Cached query with automatic performance tracking
  cachedQuery: async <T>(
    cacheKey: string,
    queryFn: () => Promise<T>,
    ttl: number = CACHE_TTL
  ): Promise<T> => {
    const startTime = Date.now();
    
    // Check cache first
    const cached = queryCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < cached.ttl) {
      performanceMetrics.cacheHits++;
      await redis.incr('db:metrics:cache_hits');
      console.log(`💨 Cache hit for ${cacheKey} (${Date.now() - startTime}ms)`);
      return cached.data;
    }
    
    // Cache miss - execute query
    performanceMetrics.cacheMisses++;
    await redis.incr('db:metrics:cache_misses');
    
    try {
      const result = await queryFn();
      
      // Cache the result
      queryCache.set(cacheKey, {
        data: result,
        timestamp: Date.now(),
        ttl
      });
      
      const duration = Date.now() - startTime;
      console.log(`🗄️ Cache miss for ${cacheKey}, query executed (${duration}ms)`);
      
      return result;
    } catch (error) {
      console.error(`Error executing cached query ${cacheKey}:`, error);
      throw error;
    }
  },

  // Paginated query with performance optimization and caching
  createPaginatedQuery: async <T>(
    model: mongoose.Model<T>,
    filter: any = {},
    options: {
      page?: number;
      limit?: number;
      sort?: any;
      select?: string;
      populate?: string | any[];
      cache?: boolean;
      cacheTTL?: number;
    } = {}
  ) => {
    const {
      page = 1,
      limit = 20,
      sort = { createdAt: -1 },
      select,
      populate,
      cache = false,
      cacheTTL = CACHE_TTL
    } = options;

    const skip = (page - 1) * limit;
    const cacheKey = cache ? 
      `paginated:${model.modelName}:${JSON.stringify({filter, page, limit, sort, select})}` : 
      null;

    const executeQuery = async () => {
      // Start with the base query
      let query = model.find(filter).skip(skip).limit(limit).sort(sort);

      // Add select if specified
      if (select) {
        query = query.select(select);
      }

      // Add populate if specified
      if (populate) {
        if (Array.isArray(populate)) {
          populate.forEach(pop => {
            query = query.populate(pop);
          });
        } else {
          query = query.populate(populate);
        }
      }

      // Execute query with lean for better performance
      const [data, total] = await Promise.all([
        query.lean().exec(),
        model.countDocuments(filter)
      ]);

      return {
        data,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
          hasNext: page < Math.ceil(total / limit),
          hasPrev: page > 1
        }
      };
    };

    if (cache && cacheKey) {
      return dbPerformance.cachedQuery(cacheKey, executeQuery, cacheTTL);
    } else {
      return executeQuery();
    }
  },

  // Bulk operations with enhanced error handling and performance tracking
  bulkWrite: async <T>(model: mongoose.Model<T>, operations: any[], options: { ordered?: boolean } = {}) => {
    if (operations.length === 0) return { success: true, result: null };

    const startTime = Date.now();
    
    try {
      const result = await model.bulkWrite(operations, { 
        ordered: options.ordered || false,
        writeConcern: { w: 'majority', j: true }
      });
      
      const duration = Date.now() - startTime;
      console.log(`📦 Bulk write completed: ${operations.length} operations in ${duration}ms`);
      
      return { success: true, result, duration };
    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(`Bulk write error after ${duration}ms:`, error);
      
      Sentry.captureException(error, {
        tags: { section: 'database', action: 'bulk_write_failed' },
        extra: { operationCount: operations.length, duration }
      });
      
      return { success: false, error, duration };
    }
  },

  // Aggregation with performance monitoring and caching
  aggregate: async <T>(
    model: mongoose.Model<T>, 
    pipeline: any[], 
    options: { cache?: boolean; cacheTTL?: number } = {}
  ) => {
    const { cache = false, cacheTTL = CACHE_TTL } = options;
    const cacheKey = cache ? 
      `aggregate:${model.modelName}:${JSON.stringify(pipeline)}` : 
      null;

    const executeAggregation = async () => {
      const startTime = Date.now();
      
      try {
        const result = await model.aggregate(pipeline).exec();
        const duration = Date.now() - startTime;
        
        if (duration > 1000) {
          console.warn(`🐌 Slow aggregation on ${model.modelName}: ${duration}ms`);
          
          // Store slow aggregation details
          await redis.lpush('db:metrics:slow_aggregations', JSON.stringify({
            model: model.modelName,
            duration,
            timestamp: new Date().toISOString(),
            pipelineLength: pipeline.length,
          }));
        }
        
        return { success: true, data: result, duration };
      } catch (error) {
        console.error('Aggregation error:', error);
        Sentry.captureException(error, {
          tags: { section: 'database', action: 'aggregation_failed' },
          extra: { model: model.modelName, pipelineLength: pipeline.length }
        });
        return { success: false, error };
      }
    };

    if (cache && cacheKey) {
      return dbPerformance.cachedQuery(cacheKey, executeAggregation, cacheTTL);
    } else {
      return executeAggregation();
    }
  },

  // Performance optimization helper
  optimizeQuery: async <T>(model: mongoose.Model<T>, filter: any, options: any = {}) => {
    const startTime = Date.now();
    
    // Analyze the query for optimization opportunities
    const queryPlan = await model.find(filter).explain();
    const duration = Date.now() - startTime;
    
    return {
      filter,
      options,
      queryPlan,
      analysisTime: duration,
      suggestions: analyzeQueryPlan(queryPlan)
    };
  }
};

// Query plan analysis for optimization suggestions
const analyzeQueryPlan = (queryPlan: any): string[] => {
  const suggestions: string[] = [];
  
  if (queryPlan?.executionStats?.totalDocsExamined > queryPlan?.executionStats?.totalDocsReturned * 10) {
    suggestions.push('Consider adding an index to reduce documents examined');
  }
  
  if (queryPlan?.executionStats?.stage === 'COLLSCAN') {
    suggestions.push('Query is performing a collection scan - add appropriate indexes');
  }
  
  if (queryPlan?.executionStats?.executionTimeMillis > 1000) {
    suggestions.push('Query execution time is high - optimize indexes or query structure');
  }
  
  return suggestions;
};

// Comprehensive indexing strategy with performance monitoring
export const createIndexes = async () => {
  try {
    console.log('🔧 Creating optimized database indexes...');
    const startTime = Date.now();
    
    const db = mongoose.connection.db;
    if (!db) {
      console.warn('Database connection not available for index creation');
      return;
    }

    // Helper function to safely create index with conflict resolution
    const safeCreateIndex = async (collection: any, indexSpec: any, options: any) => {
      try {
        await collection.createIndex(indexSpec, options);
        console.log(`✅ Created index: ${options.name || JSON.stringify(indexSpec)}`);
      } catch (error: any) {
        if (error.code === 85 || error.code === 86) {
          // Index already exists with different options
          console.log(`⚠️ Index conflict detected for ${options.name || JSON.stringify(indexSpec)}`);
          
          // Try to drop and recreate the index if it's safe to do so
          try {
            if (options.name) {
              await collection.dropIndex(options.name);
              console.log(`🗑️ Dropped conflicting index: ${options.name}`);
              
              // Recreate the index
              await collection.createIndex(indexSpec, options);
              console.log(`✅ Recreated index: ${options.name}`);
            }
          } catch (dropError: any) {
            console.warn(`⚠️ Could not resolve index conflict for ${options.name}: ${dropError.message}`);
          }
        } else if (error.code === 11000) {
          // Index already exists, which is fine
          console.log(`ℹ️ Index already exists: ${options.name || JSON.stringify(indexSpec)}`);
        } else {
          console.warn(`⚠️ Index creation warning for ${options.name || JSON.stringify(indexSpec)}: ${error.message}`);
        }
      }
    };

    // Get collections
    const products = db.collection('products');
    const users = db.collection('users');
    const userProductTrackings = db.collection('userproducttrackings');
    const priceAlerts = db.collection('pricealerts');
    const analytics = db.collection('analytics');

    // Create indexes with conflict resolution
    const indexOperations = [
      // Product indexes for search and filtering performance
      safeCreateIndex(products, 
        { title: 'text', description: 'text', brand: 'text' }, 
        { 
          name: 'text_search_optimized_v2',
          weights: { title: 10, brand: 5, description: 1 },
          background: true 
        }
      ),
      safeCreateIndex(products, 
        { category: 1, brand: 1, currentPrice: 1 }, 
        { name: 'category_brand_price', background: true }
      ),
      safeCreateIndex(products, 
        { currentPrice: 1, isActive: 1 }, 
        { name: 'price_active', background: true }
      ),
      safeCreateIndex(products, 
        { isActive: 1, createdAt: -1 }, 
        { name: 'active_created', background: true }
      ),
      safeCreateIndex(products, 
        { url: 1 }, 
        { unique: true, name: 'url_unique', background: true }
      ),
      safeCreateIndex(products, 
        { lastChecked: 1, isActive: 1 }, 
        { name: 'last_checked_active', background: true }
      ),
      safeCreateIndex(products, 
        { 'priceHistory.date': -1 }, 
        { name: 'price_history_date', background: true, sparse: true }
      ),
      safeCreateIndex(products, 
        { source: 1, category: 1 }, 
        { name: 'source_category', background: true }
      ),

      // User indexes for authentication and queries
      safeCreateIndex(users, 
        { clerkId: 1 }, 
        { unique: true, name: 'clerk_id_unique', background: true, sparse: true }
      ),
      safeCreateIndex(users, 
        { email: 1 }, 
        { unique: true, name: 'email_unique', background: true }
      ),
      safeCreateIndex(users, 
        { stripeCustomerId: 1 }, 
        { sparse: true, name: 'stripe_customer', background: true }
      ),
      safeCreateIndex(users, 
        { 'subscription.plan': 1, 'subscription.status': 1 }, 
        { name: 'subscription_status', background: true }
      ),
      safeCreateIndex(users, 
        { createdAt: -1 }, 
        { name: 'created_at', background: true }
      ),
      safeCreateIndex(users, 
        { lastLoginAt: -1 }, 
        { name: 'last_login', background: true, sparse: true }
      ),
      safeCreateIndex(users, 
        { status: 1, deletedAt: 1 }, 
        { name: 'status_deleted', background: true, sparse: true }
      ),

      // User product tracking indexes
      safeCreateIndex(userProductTrackings, 
        { userId: 1, productId: 1 }, 
        { unique: true, name: 'user_product_unique', background: true }
      ),
      safeCreateIndex(userProductTrackings, 
        { userId: 1, isActive: 1, createdAt: -1 }, 
        { name: 'user_active_tracking', background: true }
      ),
      safeCreateIndex(userProductTrackings, 
        { productId: 1, isActive: 1 }, 
        { name: 'product_active_tracking', background: true }
      ),
      safeCreateIndex(userProductTrackings, 
        { alertThreshold: 1, isActive: 1, lastChecked: 1 }, 
        { name: 'alert_threshold_check', background: true }
      ),

      // Price alert indexes
      safeCreateIndex(priceAlerts, 
        { userId: 1, status: 1, createdAt: -1 }, 
        { name: 'user_status_alerts', background: true }
      ),
      safeCreateIndex(priceAlerts, 
        { productId: 1, isActive: 1, triggeredAt: -1 }, 
        { name: 'product_active_alerts', background: true }
      ),
      safeCreateIndex(priceAlerts, 
        { triggeredAt: -1 }, 
        { name: 'triggered_at', background: true, sparse: true }
      ),

      // Analytics indexes for performance reporting
      safeCreateIndex(analytics, 
        { userId: 1, timestamp: -1, event: 1 }, 
        { name: 'user_analytics', background: true }
      ),
      safeCreateIndex(analytics, 
        { event: 1, timestamp: -1 }, 
        { name: 'event_timeline', background: true }
      ),
      safeCreateIndex(analytics, 
        { 'metadata.productId': 1, timestamp: -1 }, 
        { name: 'product_analytics', background: true, sparse: true }
      ),
      safeCreateIndex(analytics, 
        { timestamp: -1 }, 
        { name: 'timestamp_desc', background: true }
      ),
      safeCreateIndex(analytics, 
        { tenantId: 1, event: 1, timestamp: -1 }, 
        { name: 'tenant_event_analytics', background: true }
      ),
    ];

    // Execute all index operations in sequence to avoid conflicts
    await Promise.allSettled(indexOperations);

    const duration = Date.now() - startTime;
    console.log(`✅ Database indexes creation completed in ${duration}ms`);
    
    // Store indexing metrics
    await redis.hmset('db:metrics:indexing', {
      lastIndexingTime: duration,
      lastIndexingDate: Date.now(),
      indexCount: indexOperations.length,
    });
    
  } catch (error) {
    console.error('🔥 Error in index creation process:', error);
    
    Sentry.captureException(error, {
      tags: { section: 'database', action: 'index_creation' }
    });
    
    // Don't throw the error to prevent app startup failure
    console.warn('⚠️ Index creation failed, but continuing application startup');
  }
};

// Enhanced health check functionality
export const getHealthStatus = async () => {
  try {
    const connection = mongoose.connection;
    const startTime = Date.now();
    
    // Test database connectivity with timeout
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Ping timeout')), 5000)
    );
    
    await Promise.race([
      connection.db?.admin().ping(),
      timeoutPromise
    ]);
    
    const pingTime = Date.now() - startTime;
    
    // Get comprehensive connection stats
    const stats = {
      connected: connectionState.isConnected,
      readyState: connection.readyState,
      host: connection.host,
      name: connection.name,
      pingTime,
      connectionTime: connectionState.connectionTime,
      totalQueries: connectionState.totalQueries,
      slowQueries: connectionState.slowQueries,
      avgQueryTime: Math.round(connectionState.avgQueryTime),
      lastConnected: connectionState.lastConnected,
      retryCount: connectionState.retryCount,
      recentErrors: connectionState.connectionErrors.slice(-3),
      peakConnections: connectionState.peakConnections,
      currentConnections: connectionState.currentConnections,
      connectionPoolUsage: Math.round(performanceMetrics.connectionPoolUsage),
      cacheHitRate: performanceMetrics.cacheHits + performanceMetrics.cacheMisses > 0 ?
        Math.round((performanceMetrics.cacheHits / (performanceMetrics.cacheHits + performanceMetrics.cacheMisses)) * 100) : 0,
    };
    
    const isHealthy = connectionState.isConnected && 
                     pingTime < 2000 && 
                     connectionState.retryCount < 3 &&
                     performanceMetrics.connectionPoolUsage < 90;
    
    return {
      healthy: isHealthy,
      stats,
      warnings: generateHealthWarnings(stats),
      recommendations: generatePerformanceRecommendations(stats)
    };
  } catch (error) {
    return {
      healthy: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      stats: connectionState
    };
  }
};

// Generate health warnings
const generateHealthWarnings = (stats: any): string[] => {
  const warnings: string[] = [];
  
  if (stats.pingTime > 1000) warnings.push('High database latency detected');
  if (stats.slowQueries > stats.totalQueries * 0.1) warnings.push('High percentage of slow queries');
  if (stats.connectionPoolUsage > 80) warnings.push('Connection pool usage is high');
  if (stats.retryCount > 0) warnings.push('Recent connection retries detected');
  if (stats.cacheHitRate < 70) warnings.push('Low cache hit rate');
  
  return warnings;
};

// Generate performance recommendations
const generatePerformanceRecommendations = (stats: any): string[] => {
  const recommendations: string[] = [];
  
  if (stats.avgQueryTime > 500) recommendations.push('Consider optimizing slow queries or adding indexes');
  if (stats.connectionPoolUsage > 80) recommendations.push('Consider increasing connection pool size');
  if (stats.cacheHitRate < 50) recommendations.push('Review caching strategy to improve hit rate');
  if (stats.slowQueries > 10) recommendations.push('Analyze slow query patterns and optimize');
  
  return recommendations;
};

// Enhanced metrics collection
export const collectMetrics = async () => {
  const connection = mongoose.connection;
  
  try {
    const dbStats = connection.db ? await connection.db.stats() : null;
    
    const metrics = {
      database: {
        connected: connectionState.isConnected,
        readyState: connection.readyState,
        host: connection.host,
        name: connection.name,
        uptime: connectionState.lastConnected ? 
          Date.now() - connectionState.lastConnected.getTime() : 0,
        size: dbStats ? Math.round(dbStats.dataSize / 1024 / 1024) : 0, // MB
        indexSize: dbStats ? Math.round(dbStats.indexSize / 1024 / 1024) : 0, // MB
        collections: dbStats?.collections || 0,
        objects: dbStats?.objects || 0,
      },
      performance: {
        totalQueries: connectionState.totalQueries,
        slowQueries: connectionState.slowQueries,
        avgQueryTime: Math.round(connectionState.avgQueryTime),
        peakConnections: connectionState.peakConnections,
        currentConnections: connectionState.currentConnections,
        connectionPoolUsage: Math.round(performanceMetrics.connectionPoolUsage),
        cacheHits: performanceMetrics.cacheHits,
        cacheMisses: performanceMetrics.cacheMisses,
        cacheHitRate: performanceMetrics.cacheHits + performanceMetrics.cacheMisses > 0 ?
          Math.round((performanceMetrics.cacheHits / (performanceMetrics.cacheHits + performanceMetrics.cacheMisses)) * 100) : 0,
      },
      errors: {
        retryCount: connectionState.retryCount,
        recentErrors: connectionState.connectionErrors.slice(-5),
      }
    };
    
    // Store metrics in Redis for external monitoring
    await redis.hmset('db:metrics:realtime', {
      ...Object.fromEntries(
        Object.entries(metrics).flatMap(([category, values]) => 
          Object.entries(values).map(([key, value]) => [`${category}_${key}`, value])
        )
      ),
      timestamp: Date.now(),
    });
    
    return metrics;
  } catch (error) {
    console.error('Error collecting metrics:', error);
    return null;
  }
};

// Graceful shutdown with connection cleanup
export const gracefulShutdown = async () => {
  try {
    if (mongoose.connection.readyState === 1) {
      console.log('🔄 Gracefully shutting down MongoDB connection...');
      
      // Clear intervals
      if ((global as any).metricsInterval) {
        clearInterval((global as any).metricsInterval);
      }
      
      if ((global as any).cacheCleanupInterval) {
        clearInterval((global as any).cacheCleanupInterval);
      }
      
      // Close connection
      await mongoose.connection.close();
      connectionState.isConnected = false;
      
      console.log('✅ MongoDB connection closed successfully');
    }
  } catch (error) {
    console.error('🔥 Error during graceful shutdown:', error);
    Sentry.captureException(error);
  }
};

// Alias for backward compatibility
export const connectToDatabase = connectToDB;

// Export enhanced database utilities
export { connectionState, performanceMetrics };
export const checkDBHealth = getHealthStatus;
export const getDBStats = collectMetrics;
export default connectToDB;



