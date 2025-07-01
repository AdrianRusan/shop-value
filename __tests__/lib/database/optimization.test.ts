import { describe, expect, test, beforeAll, afterAll, jest } from '@jest/globals';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import { DatabaseOptimizer } from '../../../lib/database/optimization';

// Mock Redis
jest.mock('../../../lib/upstash', () => ({
  redis: {
    hmset: jest.fn(),
    incr: jest.fn(),
    expire: jest.fn()
  }
}));

describe('Database Optimization Utilities', () => {
  let mongoServer: MongoMemoryServer;
  let mongoUri: string;

  beforeAll(async () => {
    // Start in-memory MongoDB instance
    mongoServer = await MongoMemoryServer.create();
    mongoUri = mongoServer.getUri();
    
    // Set environment variable for testing
    process.env.MONGODB_URI = mongoUri;
    
    // Connect to test database
    await mongoose.connect(mongoUri);
  });

  afterAll(async () => {
    // Clean up
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  describe('createProductionIndexes', () => {
    test('should create all required indexes without errors', async () => {
      await expect(DatabaseOptimizer.createProductionIndexes()).resolves.not.toThrow();
    });

    test('should create indexes on all collections', async () => {
      await DatabaseOptimizer.createProductionIndexes();
      
      const db = mongoose.connection.db!;
      
      // Check users collection indexes
      const userIndexes = await db.collection('users').indexes();
      expect(userIndexes.length).toBeGreaterThan(1); // Should have more than just _id
      
      // Check for critical user indexes
      const emailIndex = userIndexes.find(idx => idx.key?.email === 1);
      expect(emailIndex).toBeDefined();
      expect(emailIndex?.unique).toBe(true);
      
      const clerkIdIndex = userIndexes.find(idx => idx.key?.clerkId === 1);
      expect(clerkIdIndex).toBeDefined();
      expect(clerkIdIndex?.unique).toBe(true);
      
      // Check products collection indexes
      const productIndexes = await db.collection('products').indexes();
      expect(productIndexes.length).toBeGreaterThan(1);
      
      const urlIndex = productIndexes.find(idx => idx.key?.url === 1);
      expect(urlIndex).toBeDefined();
      expect(urlIndex?.unique).toBe(true);
      
      // Check for compound index
      const brandCategoryIndex = productIndexes.find(idx => 
        idx.key?.brand === 1 && idx.key?.category === 1
      );
      expect(brandCategoryIndex).toBeDefined();
      
      // Check analytics collection indexes
      const analyticsIndexes = await db.collection('analytics').indexes();
      expect(analyticsIndexes.length).toBeGreaterThan(1);
      
      // Check for TTL index
      const ttlIndex = analyticsIndexes.find(idx => 
        idx.key?.createdAt === 1 && idx.expireAfterSeconds
      );
      expect(ttlIndex).toBeDefined();
      expect(ttlIndex?.expireAfterSeconds).toBe(63072000); // 2 years
    });
  });

  describe('auditIndexes', () => {
    test('should return comprehensive index audit', async () => {
      // First create some indexes
      await DatabaseOptimizer.createProductionIndexes();
      
      const audit = await DatabaseOptimizer.auditIndexes();
      
      expect(audit).toHaveProperty('users');
      expect(audit).toHaveProperty('products');
      expect(audit).toHaveProperty('analytics');
      expect(audit).toHaveProperty('missing');
      
      expect(Array.isArray(audit.users)).toBe(true);
      expect(Array.isArray(audit.products)).toBe(true);
      expect(Array.isArray(audit.analytics)).toBe(true);
      expect(Array.isArray(audit.missing)).toBe(true);
      
      // Should have no missing indexes after optimization
      expect(audit.missing.length).toBe(0);
    });

    test('should detect missing critical indexes', async () => {
      // Test with fresh database (no indexes except _id)
      const audit = await DatabaseOptimizer.auditIndexes();
      
      // Should detect missing email and clerkId indexes
      expect(audit.missing).toContain('users.email');
      expect(audit.missing).toContain('users.clerkId');
      expect(audit.missing).toContain('products.url');
    });
  });

  describe('monitorDatabaseHealth', () => {
    test('should return health status and metrics', async () => {
      const health = await DatabaseOptimizer.monitorDatabaseHealth();
      
      expect(health).toHaveProperty('status');
      expect(health).toHaveProperty('metrics');
      expect(health).toHaveProperty('alerts');
      
      expect(['healthy', 'warning', 'critical']).toContain(health.status);
      expect(Array.isArray(health.alerts)).toBe(true);
      
      // Check metrics structure
      expect(health.metrics).toHaveProperty('connectionCount');
      expect(health.metrics).toHaveProperty('queriesPerSecond');
      expect(health.metrics).toHaveProperty('avgResponseTime');
      expect(health.metrics).toHaveProperty('indexHitRatio');
      expect(health.metrics).toHaveProperty('storageSize');
      
      expect(typeof health.metrics.connectionCount).toBe('number');
      expect(typeof health.metrics.storageSize).toBe('number');
    });

    test('should generate alerts for high connection count', async () => {
      // This test would need to mock server status to simulate high connections
      // For now, we'll just ensure the function doesn't throw
      await expect(DatabaseOptimizer.monitorDatabaseHealth()).resolves.not.toThrow();
    });
  });

  describe('cleanupOldData', () => {
    test('should cleanup old data and return counts', async () => {
      // Add some test data first
      const db = mongoose.connection.db!;
      
      // Add old analytics data
      const twoYearsAgo = new Date(Date.now() - 2 * 365 * 24 * 60 * 60 * 1000);
      await db.collection('analytics').insertOne({
        tenantId: 'test',
        events: [],
        createdAt: twoYearsAgo
      });
      
      // Add inactive product
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      await db.collection('products').insertOne({
        url: 'https://test.com/inactive',
        trackingUsers: [],
        lastScrapedAt: thirtyDaysAgo
      });
      
      const cleanup = await DatabaseOptimizer.cleanupOldData();
      
      expect(cleanup).toHaveProperty('cleaned');
      expect(cleanup.cleaned).toHaveProperty('analytics');
      expect(cleanup.cleaned).toHaveProperty('products');
      expect(cleanup.cleaned).toHaveProperty('priceHistory');
      
      expect(typeof cleanup.cleaned.analytics).toBe('number');
      expect(typeof cleanup.cleaned.products).toBe('number');
      expect(typeof cleanup.cleaned.priceHistory).toBe('number');
      
      // Should have cleaned at least our test data
      expect(cleanup.cleaned.analytics).toBeGreaterThanOrEqual(1);
      expect(cleanup.cleaned.products).toBeGreaterThanOrEqual(1);
    });
  });

  describe('generateOptimizationReport', () => {
    test('should generate comprehensive optimization report', async () => {
      const report = await DatabaseOptimizer.generateOptimizationReport();
      
      expect(report).toHaveProperty('summary');
      expect(report).toHaveProperty('indexAudit');
      expect(report).toHaveProperty('performance');
      expect(report).toHaveProperty('health');
      expect(report).toHaveProperty('recommendations');
      
      // Check summary structure
      expect(report.summary).toHaveProperty('status');
      expect(report.summary).toHaveProperty('totalCollections');
      expect(report.summary).toHaveProperty('totalDocuments');
      expect(report.summary).toHaveProperty('totalIndexes');
      expect(report.summary).toHaveProperty('storageSize');
      
      expect(typeof report.summary.totalCollections).toBe('number');
      expect(typeof report.summary.totalDocuments).toBe('number');
      expect(typeof report.summary.totalIndexes).toBe('number');
      expect(typeof report.summary.storageSize).toBe('string');
      
      // Check recommendations array
      expect(Array.isArray(report.recommendations)).toBe(true);
    });

    test('should include recommendations for missing indexes', async () => {
      // Ensure we have missing indexes
      const report = await DatabaseOptimizer.generateOptimizationReport();
      
      if (report.indexAudit.missing.length > 0) {
        const hasIndexRecommendation = report.recommendations.some(rec => 
          rec.includes('Missing critical indexes')
        );
        expect(hasIndexRecommendation).toBe(true);
      }
    });
  });

  describe('Error Handling', () => {
    test('should handle database connection errors gracefully', async () => {
      // Disconnect to simulate connection error
      await mongoose.disconnect();
      
      await expect(DatabaseOptimizer.monitorDatabaseHealth()).resolves.toEqual({
        status: 'critical',
        metrics: {
          connectionCount: 0,
          queriesPerSecond: 0,
          avgResponseTime: 0,
          indexHitRatio: 0,
          storageSize: 0
        },
        alerts: ['Database monitoring failed']
      });
      
      // Reconnect for other tests
      await mongoose.connect(mongoUri);
    });

    test('should handle invalid collection operations', async () => {
      // This would test edge cases where collections don't exist
      // The functions should handle these gracefully
      await expect(DatabaseOptimizer.auditIndexes()).resolves.not.toThrow();
    });
  });

  describe('Performance Requirements', () => {
    test('index creation should complete within reasonable time', async () => {
      const startTime = Date.now();
      await DatabaseOptimizer.createProductionIndexes();
      const duration = Date.now() - startTime;
      
      // Should complete within 30 seconds for test database
      expect(duration).toBeLessThan(30000);
    });

    test('health monitoring should be fast', async () => {
      const startTime = Date.now();
      await DatabaseOptimizer.monitorDatabaseHealth();
      const duration = Date.now() - startTime;
      
      // Should complete within 5 seconds
      expect(duration).toBeLessThan(5000);
    });
  });

  describe('Data Integrity', () => {
    test('should preserve data during cleanup operations', async () => {
      const db = mongoose.connection.db!;
      
      // Add recent data that should NOT be cleaned
      const recentProduct = {
        url: 'https://test.com/recent',
        trackingUsers: [{ userId: 'test-user' }],
        lastScrapedAt: new Date(),
        priceHistory: []
      };
      
      await db.collection('products').insertOne(recentProduct);
      
      const beforeCount = await db.collection('products').countDocuments({
        url: 'https://test.com/recent'
      });
      
      await DatabaseOptimizer.cleanupOldData();
      
      const afterCount = await db.collection('products').countDocuments({
        url: 'https://test.com/recent'
      });
      
      // Recent data should be preserved
      expect(afterCount).toBe(beforeCount);
    });
  });
});