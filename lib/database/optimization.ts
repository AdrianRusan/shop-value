import mongoose from 'mongoose';
import { connectToDB } from '../mongoose';
import { redis } from '../upstash';

// Database optimization utilities for production SaaS scale
export class DatabaseOptimizer {
  
  // Index management for production workloads
  static async createProductionIndexes(): Promise<void> {
    try {
      await connectToDB();
      const db = mongoose.connection.db;
      
      if (!db) {
        throw new Error('Database connection not available');
      }
      
      console.log('🔧 Creating production indexes...');
      
      // User collection indexes
      const users = db.collection('users');
      await Promise.all([
        users.createIndex({ email: 1 }, { unique: true, background: true }),
        users.createIndex({ clerkId: 1 }, { unique: true, sparse: true, background: true }),
        users.createIndex({ 'subscription.plan': 1, 'subscription.status': 1 }, { background: true }),
        users.createIndex({ tenantId: 1, role: 1 }, { background: true }),
        users.createIndex({ status: 1, deletedAt: 1 }, { sparse: true, background: true }),
        users.createIndex({ 'subscription.stripeCustomerId': 1 }, { sparse: true, background: true }),
        users.createIndex({ 'subscription.stripeSubscriptionId': 1 }, { sparse: true, background: true }),
        users.createIndex({ createdAt: 1 }, { background: true }),
        users.createIndex({ lastLoginAt: 1 }, { sparse: true, background: true })
      ]);
      console.log('👤 User collection indexes created');
      
      // Product collection indexes
      const products = db.collection('products');
      await Promise.all([
        products.createIndex({ url: 1 }, { unique: true, background: true }),
        products.createIndex({ urlHash: 1 }, { unique: true, sparse: true, background: true }),
        products.createIndex({ brand: 1, category: 1 }, { background: true }),
        products.createIndex({ tenantId: 1, isActive: 1 }, { background: true }),
        products.createIndex({ source: 1, lastScrapedAt: 1 }, { background: true }),
        products.createIndex({ currentPrice: 1, brand: 1 }, { background: true }),
        products.createIndex({ nextScrapeAt: 1, trackingStatus: 1 }, { background: true }),
        products.createIndex({ 'analytics.popularityScore': -1, isActive: 1 }, { background: true }),
        products.createIndex({ 'trackingUsers.userId': 1 }, { background: true }),
        products.createIndex({ createdAt: 1 }, { background: true }),
        products.createIndex({ lowestPrice: 1, highestPrice: 1 }, { background: true }),
        // Text search index for product search
        products.createIndex({
          title: 'text',
          description: 'text',
          brand: 'text',
          productModel: 'text'
        }, {
          weights: { title: 10, brand: 5, productModel: 5, description: 1 },
          background: true
        })
      ]);
      console.log('📱 Product collection indexes created');
      
      // Analytics collection indexes
      const analytics = db.collection('analytics');
      await Promise.all([
        analytics.createIndex({ tenantId: 1, 'events.timestamp': -1 }, { background: true }),
        analytics.createIndex({ tenantId: 1, 'events.event': 1, 'events.timestamp': -1 }, { background: true }),
        analytics.createIndex({ tenantId: 1, 'userBehavior.userId': 1 }, { background: true }),
        analytics.createIndex({ 'systemMetrics.timestamp': -1 }, { background: true }),
        // TTL index for automatic cleanup (2 years)
        analytics.createIndex({ createdAt: 1 }, { expireAfterSeconds: 63072000, background: true })
      ]);
      console.log('📈 Analytics collection indexes created');
      
      console.log('✅ All production indexes created successfully');
      
    } catch (error) {
      console.error('🔥 Error creating production indexes:', error);
      throw error;
    }
  }
  
  // Check for missing indexes and create them
  static async auditIndexes(): Promise<{
    users: any[];
    products: any[];
    analytics: any[];
    missing: string[];
  }> {
    try {
      await connectToDB();
      const db = mongoose.connection.db;
      
      if (!db) {
        throw new Error('Database connection not available');
      }
      
      console.log('🔍 Auditing database indexes...');
      
      const [userIndexes, productIndexes, analyticsIndexes] = await Promise.all([
        db.collection('users').indexes(),
        db.collection('products').indexes(),
        db.collection('analytics').indexes()
      ]);
      
      // Check for missing critical indexes
      const missing: string[] = [];
      
      // User critical indexes
      const userEmailIndex = userIndexes.find(idx => idx.key?.email === 1);
      if (!userEmailIndex) missing.push('users.email');
      
      const userClerkIndex = userIndexes.find(idx => idx.key?.clerkId === 1);
      if (!userClerkIndex) missing.push('users.clerkId');
      
      // Product critical indexes
      const productUrlIndex = productIndexes.find(idx => idx.key?.url === 1);
      if (!productUrlIndex) missing.push('products.url');
      
      const productBrandCategoryIndex = productIndexes.find(idx => 
        idx.key?.brand === 1 && idx.key?.category === 1
      );
      if (!productBrandCategoryIndex) missing.push('products.brand_category');
      
      return {
        users: userIndexes,
        products: productIndexes,
        analytics: analyticsIndexes,
        missing
      };
      
    } catch (error) {
      console.error('🔥 Error auditing indexes:', error);
      throw error;
    }
  }
  
  // Query performance optimization
  static async optimizeQueries(): Promise<{
    slowQueries: any[];
    recommendations: string[];
  }> {
    try {
      await connectToDB();
      const db = mongoose.connection.db;
      
      if (!db) {
        throw new Error('Database connection not available');
      }
      
      console.log('⚡ Analyzing query performance...');
      
      // Enable profiling for slow queries (>100ms)
      await db.command({ profile: 2, slowms: 100 });
      
      // Get recent slow queries
      const profileCollection = db.collection('system.profile');
      const slowQueries = await profileCollection
        .find({ ts: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } }) // Last 24 hours
        .sort({ ts: -1 })
        .limit(50)
        .toArray();
      
      // Generate recommendations based on slow queries
      const recommendations: string[] = [];
      
      for (const query of slowQueries) {
        if (query.command?.find && query.millis > 1000) {
          recommendations.push(
            `Slow find query on ${query.ns}: ${query.millis}ms - Consider adding index on ${Object.keys(query.command.filter || {}).join(', ')}`
          );
        }
        
        if (query.command?.aggregate && query.millis > 2000) {
          recommendations.push(
            `Slow aggregation on ${query.ns}: ${query.millis}ms - Consider optimizing pipeline stages`
          );
        }
      }
      
      // Disable profiling after analysis
      await db.command({ profile: 0 });
      
      return {
        slowQueries: slowQueries.map(q => ({
          namespace: q.ns,
          duration: q.millis,
          timestamp: q.ts,
          command: q.command
        })),
        recommendations
      };
      
    } catch (error) {
      console.error('🔥 Error optimizing queries:', error);
      throw error;
    }
  }
  
  // Database health monitoring
  static async monitorDatabaseHealth(): Promise<{
    status: 'healthy' | 'warning' | 'critical';
    metrics: {
      connectionCount: number;
      queriesPerSecond: number;
      avgResponseTime: number;
      indexHitRatio: number;
      storageSize: number;
      replicationLag?: number;
    };
    alerts: string[];
  }> {
    try {
      await connectToDB();
      const db = mongoose.connection.db;
      
      if (!db) {
        throw new Error('Database connection not available');
      }
      
      console.log('🏥 Monitoring database health...');
      
      // Get server status
      const serverStatus = await db.admin().serverStatus();
      const dbStats = await db.stats();
      
      const metrics = {
        connectionCount: serverStatus.connections.current,
        queriesPerSecond: serverStatus.opcounters.query / serverStatus.uptime,
        avgResponseTime: serverStatus.globalLock?.totalTime 
          ? serverStatus.globalLock.totalTime / serverStatus.opcounters.query 
          : 0,
        indexHitRatio: serverStatus.indexCounters?.btree?.hits 
          ? (serverStatus.indexCounters.btree.hits / 
             (serverStatus.indexCounters.btree.hits + serverStatus.indexCounters.btree.misses)) * 100
          : 0,
        storageSize: Math.round(dbStats.storageSize / 1024 / 1024), // MB
        replicationLag: serverStatus.repl?.secondary ? serverStatus.repl.secondary.lagSeconds : undefined
      };
      
      // Determine health status and generate alerts
      const alerts: string[] = [];
      let status: 'healthy' | 'warning' | 'critical' = 'healthy';
      
      if (metrics.connectionCount > 80) {
        alerts.push('High connection count detected');
        status = 'warning';
      }
      
      if (metrics.avgResponseTime > 1000) {
        alerts.push('High average response time');
        status = 'warning';
      }
      
      if (metrics.indexHitRatio < 95) {
        alerts.push('Low index hit ratio - consider adding indexes');
        status = 'warning';
      }
      
      if (metrics.storageSize > 1000) { // 1GB
        alerts.push('Database storage size growing large');
        status = 'warning';
      }
      
      if (metrics.replicationLag && metrics.replicationLag > 60) {
        alerts.push('High replication lag detected');
        status = 'critical';
      }
      
      // Store metrics in Redis for trending
      await redis.hmset('db:health:metrics', {
        connectionCount: metrics.connectionCount,
        queriesPerSecond: metrics.queriesPerSecond.toFixed(2),
        avgResponseTime: metrics.avgResponseTime.toFixed(2),
        indexHitRatio: metrics.indexHitRatio.toFixed(2),
        storageSize: metrics.storageSize,
        timestamp: Date.now()
      });
      
      return {
        status,
        metrics,
        alerts
      };
      
    } catch (error) {
      console.error('🔥 Error monitoring database health:', error);
      return {
        status: 'critical',
        metrics: {
          connectionCount: 0,
          queriesPerSecond: 0,
          avgResponseTime: 0,
          indexHitRatio: 0,
          storageSize: 0
        },
        alerts: ['Database monitoring failed']
      };
    }
  }
  
  // Clean up old data for performance
  static async cleanupOldData(): Promise<{
    cleaned: {
      analytics: number;
      products: number;
      priceHistory: number;
    };
  }> {
    try {
      await connectToDB();
      const db = mongoose.connection.db;
      
      if (!db) {
        throw new Error('Database connection not available');
      }
      
      console.log('🧹 Cleaning up old data...');
      
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const twoYearsAgo = new Date(Date.now() - 2 * 365 * 24 * 60 * 60 * 1000);
      
      // Clean old analytics data (older than 2 years)
      const analyticsResult = await db.collection('analytics').deleteMany({
        createdAt: { $lt: twoYearsAgo }
      });
      
      // Clean inactive products (no trackers for 30+ days)
      const productsResult = await db.collection('products').deleteMany({
        'trackingUsers': { $size: 0 },
        'lastScrapedAt': { $lt: thirtyDaysAgo }
      });
      
      // Clean old price history (keep only last 90 days per product)
      const products = await db.collection('products').find({}).toArray();
      let priceHistoryDeleted = 0;
      
      for (const product of products) {
        if (product.priceHistory && product.priceHistory.length > 90) {
          const keepRecent = product.priceHistory
            .sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime())
            .slice(0, 90);
          
          await db.collection('products').updateOne(
            { _id: product._id },
            { $set: { priceHistory: keepRecent } }
          );
          
          priceHistoryDeleted += product.priceHistory.length - 90;
        }
      }
      
      console.log(`🗑️ Cleaned ${analyticsResult.deletedCount} analytics records`);
      console.log(`🗑️ Cleaned ${productsResult.deletedCount} inactive products`);
      console.log(`🗑️ Cleaned ${priceHistoryDeleted} old price history records`);
      
      return {
        cleaned: {
          analytics: analyticsResult.deletedCount || 0,
          products: productsResult.deletedCount || 0,
          priceHistory: priceHistoryDeleted
        }
      };
      
    } catch (error) {
      console.error('🔥 Error cleaning up old data:', error);
      throw error;
    }
  }
  
  // Generate comprehensive database report
  static async generateOptimizationReport(): Promise<{
    summary: {
      status: string;
      totalCollections: number;
      totalDocuments: number;
      totalIndexes: number;
      storageSize: string;
    };
    indexAudit: any;
    performance: any;
    health: any;
    recommendations: string[];
  }> {
    try {
      console.log('📊 Generating database optimization report...');
      
      const [indexAudit, performance, health] = await Promise.all([
        this.auditIndexes(),
        this.optimizeQueries(),
        this.monitorDatabaseHealth()
      ]);
      
      const db = mongoose.connection.db;
      const stats = db ? await db.stats() : null;
      
      const summary = {
        status: health.status,
        totalCollections: stats?.collections || 0,
        totalDocuments: stats?.objects || 0,
        totalIndexes: stats?.indexes || 0,
        storageSize: stats ? `${Math.round(stats.storageSize / 1024 / 1024)} MB` : '0 MB'
      };
      
      const recommendations: string[] = [
        ...performance.recommendations,
        ...health.alerts
      ];
      
      if (indexAudit.missing.length > 0) {
        recommendations.push(`Missing critical indexes: ${indexAudit.missing.join(', ')}`);
      }
      
      if (health.metrics.indexHitRatio < 95) {
        recommendations.push('Consider adding more indexes to improve query performance');
      }
      
      if (health.metrics.storageSize > 500) {
        recommendations.push('Consider implementing data archival strategy');
      }
      
      return {
        summary,
        indexAudit,
        performance,
        health,
        recommendations
      };
      
    } catch (error) {
      console.error('🔥 Error generating optimization report:', error);
      throw error;
    }
  }
}

// Export utility functions
export const createProductionIndexes = DatabaseOptimizer.createProductionIndexes;
export const auditIndexes = DatabaseOptimizer.auditIndexes;
export const optimizeQueries = DatabaseOptimizer.optimizeQueries;
export const monitorDatabaseHealth = DatabaseOptimizer.monitorDatabaseHealth;
export const cleanupOldData = DatabaseOptimizer.cleanupOldData;
export const generateOptimizationReport = DatabaseOptimizer.generateOptimizationReport;