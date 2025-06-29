import { connectToDB } from '../mongoose';
import User from '../models/user.model';
import Product from '../models/product.model';
import Analytics from '../models/analytics.model';
import { Types } from 'mongoose';

// Migration interface
interface Migration {
  name: string;
  version: string;
  description: string;
  up: () => Promise<void>;
  down: () => Promise<void>;
}

// Migration tracking schema
const migrationSchema = {
  name: { type: String, required: true, unique: true },
  version: { type: String, required: true },
  appliedAt: { type: Date, default: Date.now },
  description: String
};

// Database migration utility class
export class DatabaseMigration {
  private migrations: Migration[] = [];
  
  constructor() {
    this.registerMigrations();
  }
  
  // Register all migrations
  private registerMigrations() {
    this.migrations = [
      {
        name: '001_create_indexes',
        version: '1.0.0',
        description: 'Create essential database indexes for performance',
        up: this.createIndexes,
        down: this.dropIndexes
      },
      {
        name: '002_add_tenant_isolation',
        version: '1.1.0',
        description: 'Add multi-tenancy support to existing collections',
        up: this.addTenantIsolation,
        down: this.removeTenantIsolation
      },
      {
        name: '003_optimize_product_schema',
        version: '1.2.0',
        description: 'Add analytics fields and optimize product schema',
        up: this.optimizeProductSchema,
        down: this.revertProductSchema
      },
      {
        name: '004_setup_analytics_collection',
        version: '1.3.0',
        description: 'Initialize analytics collection with proper structure',
        up: this.setupAnalyticsCollection,
        down: this.removeAnalyticsCollection
      }
    ];
  }
  
  // Run all pending migrations
  async runMigrations(): Promise<void> {
    try {
      await connectToDB();
      console.log('🔄 Starting database migrations...');
      
      for (const migration of this.migrations) {
        const isApplied = await this.isMigrationApplied(migration.name);
        
        if (!isApplied) {
          console.log(`📦 Running migration: ${migration.name} - ${migration.description}`);
          
          try {
            await migration.up();
            await this.recordMigration(migration);
            console.log(`✅ Migration ${migration.name} completed successfully`);
          } catch (error) {
            console.error(`❌ Migration ${migration.name} failed:`, error);
            throw error;
          }
        } else {
          console.log(`⏭️ Migration ${migration.name} already applied`);
        }
      }
      
      console.log('🎉 All migrations completed successfully');
    } catch (error) {
      console.error('🔥 Migration process failed:', error);
      throw error;
    }
  }
  
  // Check if migration is already applied
  private async isMigrationApplied(migrationName: string): Promise<boolean> {
    try {
      const db = require('mongoose').connection.db;
      const collection = db.collection('migrations');
      const migration = await collection.findOne({ name: migrationName });
      return !!migration;
    } catch (error) {
      return false;
    }
  }
  
  // Record successful migration
  private async recordMigration(migration: Migration): Promise<void> {
    const db = require('mongoose').connection.db;
    const collection = db.collection('migrations');
    
    await collection.insertOne({
      name: migration.name,
      version: migration.version,
      description: migration.description,
      appliedAt: new Date()
    });
  }
  
  // Migration 001: Create essential indexes
  private createIndexes = async (): Promise<void> => {
    const db = require('mongoose').connection.db;
    
    // User collection indexes
    const users = db.collection('users');
    await users.createIndex({ email: 1 }, { unique: true });
    await users.createIndex({ clerkId: 1 }, { unique: true });
    await users.createIndex({ 'subscription.plan': 1, 'subscription.status': 1 });
    await users.createIndex({ tenantId: 1, role: 1 });
    await users.createIndex({ status: 1, deletedAt: 1 });
    
    // Product collection indexes
    const products = db.collection('products');
    await products.createIndex({ url: 1 }, { unique: true });
    await products.createIndex({ brand: 1, category: 1 });
    await products.createIndex({ tenantId: 1, isActive: 1 });
    await products.createIndex({ source: 1, lastScrapedAt: 1 });
    await products.createIndex({ currentPrice: 1, brand: 1 });
    await products.createIndex({ nextScrapeAt: 1, trackingStatus: 1 });
    
    // Text search indexes
    await products.createIndex({
      title: 'text',
      description: 'text',
      brand: 'text',
      productModel: 'text'
    }, {
      weights: { title: 10, brand: 5, productModel: 5, description: 1 }
    });
    
    console.log('📊 Essential indexes created successfully');
  };
  
  // Drop indexes (rollback)
  private dropIndexes = async (): Promise<void> => {
    const db = require('mongoose').connection.db;
    
    try {
      await db.collection('users').dropIndexes();
      await db.collection('products').dropIndexes();
      console.log('🗑️ Indexes dropped successfully');
    } catch (error) {
      console.log('⚠️ Some indexes may not exist, continuing...');
    }
  };
  
  // Migration 002: Add tenant isolation
  private addTenantIsolation = async (): Promise<void> => {
    const db = require('mongoose').connection.db;
    
    // Add tenantId to existing users (single tenant setup)
    const users = db.collection('users');
    await users.updateMany(
      { tenantId: { $exists: false } },
      { $set: { tenantId: 'default' } }
    );
    
    // Add tenantId to existing products
    const products = db.collection('products');
    await products.updateMany(
      { tenantId: { $exists: false } },
      { $set: { tenantId: 'default', isActive: true, trackingStatus: 'active' } }
    );
    
    console.log('🏢 Multi-tenancy support added');
  };
  
  // Remove tenant isolation (rollback)
  private removeTenantIsolation = async (): Promise<void> => {
    const db = require('mongoose').connection.db;
    
    await db.collection('users').updateMany({}, { $unset: { tenantId: 1 } });
    await db.collection('products').updateMany({}, { 
      $unset: { tenantId: 1, isActive: 1, trackingStatus: 1 } 
    });
    
    console.log('🔄 Multi-tenancy support removed');
  };
  
  // Migration 003: Optimize product schema
  private optimizeProductSchema = async (): Promise<void> => {
    const db = require('mongoose').connection.db;
    const products = db.collection('products');
    
    // Add analytics fields to existing products
    await products.updateMany(
      { analytics: { $exists: false } },
      {
        $set: {
          analytics: {
            viewCount: 0,
            trackingCount: 0,
            lastViewed: new Date(),
            popularityScore: 0,
            conversionRate: 0
          },
          lastScrapedAt: new Date(),
          scrapingErrors: 0,
          nextScrapeAt: new Date(Date.now() + 4 * 60 * 60 * 1000), // 4 hours
          scraperVersion: '1.0.0'
        }
      }
    );
    
    // Update existing user arrays to new tracking format
    const productsWithUsers = await products.find({ users: { $exists: true } }).toArray();
    
    for (const product of productsWithUsers) {
      if (product.users && Array.isArray(product.users) && product.users.length > 0) {
        const trackingUsers = product.users.map((user: any) => ({
          userId: new Types.ObjectId(),
          email: user.email,
          addedAt: new Date(),
          alertSettings: {
            priceDecrease: true,
            priceIncrease: false,
            backInStock: true
          }
        }));
        
        await products.updateOne(
          { _id: product._id },
          { 
            $set: { trackingUsers },
            $unset: { users: 1 }
          }
        );
      }
    }
    
    console.log('🔧 Product schema optimized');
  };
  
  // Revert product schema optimization
  private revertProductSchema = async (): Promise<void> => {
    const db = require('mongoose').connection.db;
    const products = db.collection('products');
    
    await products.updateMany({}, {
      $unset: {
        analytics: 1,
        lastScrapedAt: 1,
        scrapingErrors: 1,
        nextScrapeAt: 1,
        scraperVersion: 1,
        trackingUsers: 1
      }
    });
    
    console.log('🔄 Product schema optimization reverted');
  };
  
  // Migration 004: Setup analytics collection
  private setupAnalyticsCollection = async (): Promise<void> => {
    const db = require('mongoose').connection.db;
    
    // Create analytics collection with proper indexes
    const analytics = db.collection('analytics');
    
    // Create indexes for analytics
    await analytics.createIndex({ tenantId: 1, 'events.timestamp': -1 });
    await analytics.createIndex({ tenantId: 1, 'events.event': 1, 'events.timestamp': -1 });
    await analytics.createIndex({ tenantId: 1, 'userBehavior.userId': 1 });
    await analytics.createIndex({ 'systemMetrics.timestamp': -1 });
    await analytics.createIndex({ createdAt: 1 }, { expireAfterSeconds: 63072000 }); // 2 years TTL
    
    // Insert initial analytics document for default tenant
    const existingAnalytics = await analytics.findOne({ tenantId: 'default' });
    if (!existingAnalytics) {
      await analytics.insertOne({
        tenantId: 'default',
        events: [],
        systemMetrics: [],
        businessMetrics: [],
        userBehavior: [],
        aggregatedData: { daily: {}, weekly: {}, monthly: {} },
        createdAt: new Date(),
        updatedAt: new Date()
      });
    }
    
    console.log('📈 Analytics collection initialized');
  };
  
  // Remove analytics collection
  private removeAnalyticsCollection = async (): Promise<void> => {
    const db = require('mongoose').connection.db;
    
    try {
      await db.collection('analytics').drop();
      console.log('🗑️ Analytics collection removed');
    } catch (error) {
      console.log('⚠️ Analytics collection may not exist');
    }
  };
}

// Database seeding utility
export class DatabaseSeeder {
  
  // Seed development data
  async seedDevelopmentData(): Promise<void> {
    try {
      await connectToDB();
      console.log('🌱 Starting database seeding for development...');
      
      await this.createDevelopmentUsers();
      await this.createSampleProducts();
      await this.createAnalyticsData();
      
      console.log('🎉 Development data seeded successfully');
    } catch (error) {
      console.error('🔥 Seeding failed:', error);
      throw error;
    }
  }
  
  // Create development users
  private async createDevelopmentUsers(): Promise<void> {
    const users = [
      {
        clerkId: 'dev_admin_001',
        email: 'admin@shopvalue.ro',
        firstName: 'Admin',
        lastName: 'User',
        role: 'admin',
        tenantId: 'default',
        subscription: {
          plan: 'enterprise',
          status: 'active'
        },
        usage: {
          maxProducts: -1,
          maxApiCalls: -1,
          maxEmails: -1
        },
        consent: {
          functional: { granted: true, timestamp: new Date() }
        }
      },
      {
        clerkId: 'dev_user_001',
        email: 'user@shopvalue.ro',
        firstName: 'Test',
        lastName: 'User',
        role: 'user',
        tenantId: 'default',
        subscription: {
          plan: 'pro',
          status: 'active'
        },
        consent: {
          functional: { granted: true, timestamp: new Date() }
        }
      }
    ];
    
    for (const userData of users) {
      const existingUser = await User.findOne({ email: userData.email });
      if (!existingUser) {
        await User.create(userData);
        console.log(`👤 Created user: ${userData.email}`);
      } else {
        console.log(`👤 User already exists: ${userData.email}`);
      }
    }
  }
  
  // Create sample products
  private async createSampleProducts(): Promise<void> {
    const sampleProducts = [
      {
        url: 'https://flip.ro/telefoane-mobile/apple/iphone-15-pro-max-256gb-titanium-natural',
        urlHash: 'sample_hash_001',
        source: 'flip',
        title: 'iPhone 15 Pro Max 256GB Titanium Natural',
        brand: 'apple',
        productModel: 'iphone-15-pro-max',
        category: 'telefoane-mobile',
        currentPrice: 6999.99,
        originalPrice: 7499.99,
        currency: 'RON',
        image: 'https://cdn.flip.ro/image001.jpg',
        tenantId: 'default',
        analytics: {
          viewCount: 145,
          trackingCount: 23,
          popularityScore: 50,
          lastViewed: new Date()
        }
      },
      {
        url: 'https://flip.ro/laptopuri/dell/xps-13-2024-i7-16gb-512gb',
        urlHash: 'sample_hash_002',
        source: 'flip',
        title: 'Dell XPS 13 2024 Intel i7 16GB 512GB SSD',
        brand: 'dell',
        productModel: 'xps-13-2024',
        category: 'laptopuri',
        currentPrice: 4999.99,
        originalPrice: 5499.99,
        currency: 'RON',
        image: 'https://cdn.flip.ro/image002.jpg',
        tenantId: 'default',
        analytics: {
          viewCount: 89,
          trackingCount: 12,
          popularityScore: 30,
          lastViewed: new Date()
        }
      }
    ];
    
    for (const productData of sampleProducts) {
      const existingProduct = await Product.findOne({ url: productData.url });
      if (!existingProduct) {
        await Product.create(productData);
        console.log(`📱 Created product: ${productData.title}`);
      } else {
        console.log(`📱 Product already exists: ${productData.title}`);
      }
    }
  }
  
  // Create sample analytics data
  private async createAnalyticsData(): Promise<void> {
    const existingAnalytics = await Analytics.findOne({ tenantId: 'default' });
    
    if (!existingAnalytics) {
      const analyticsData = {
        tenantId: 'default',
        events: [
          {
            sessionId: 'dev_session_001',
            event: 'page_view',
            properties: { page: '/dashboard' },
            timestamp: new Date(),
            userId: 'dev_user_001'
          },
          {
            sessionId: 'dev_session_001',
            event: 'product_view',
            properties: { productId: 'sample_product_001' },
            timestamp: new Date(),
            userId: 'dev_user_001'
          }
        ],
        businessMetrics: [
          {
            date: new Date(),
            newUsers: 2,
            activeUsers: 2,
            productsTracked: 2,
            revenue: 0,
            apiCalls: 0
          }
        ]
      };
      
      await Analytics.create(analyticsData);
      console.log('📊 Created sample analytics data');
    } else {
      console.log('📊 Analytics data already exists');
    }
  }
  
  // Clean development data
  async cleanDevelopmentData(): Promise<void> {
    try {
      await connectToDB();
      console.log('🧹 Cleaning development data...');
      
      // Remove development users
      await User.deleteMany({ 
        email: { $in: ['admin@shopvalue.ro', 'user@shopvalue.ro'] } 
      });
      
      // Remove sample products
      await Product.deleteMany({ 
        urlHash: { $in: ['sample_hash_001', 'sample_hash_002'] } 
      });
      
      // Remove analytics data
      await Analytics.deleteMany({ tenantId: 'default' });
      
      console.log('✅ Development data cleaned');
    } catch (error) {
      console.error('🔥 Cleaning failed:', error);
      throw error;
    }
  }
}

// Database maintenance utilities
export class DatabaseMaintenance {
  
  // Optimize database performance
  async optimizeDatabase(): Promise<void> {
    try {
      await connectToDB();
      console.log('🔧 Starting database optimization...');
      
      const db = require('mongoose').connection.db;
      
      // Rebuild indexes
      await this.rebuildIndexes(db);
      
      // Clean up old data
      await this.cleanupOldData(db);
      
      // Compact collections
      await this.compactCollections(db);
      
      console.log('✅ Database optimization completed');
    } catch (error) {
      console.error('🔥 Database optimization failed:', error);
      throw error;
    }
  }
  
  // Rebuild all indexes
  private async rebuildIndexes(db: any): Promise<void> {
    const collections = ['users', 'products', 'analytics'];
    
    for (const collectionName of collections) {
      try {
        const collection = db.collection(collectionName);
        await collection.reIndex();
        console.log(`📊 Rebuilt indexes for ${collectionName}`);
      } catch (error) {
        console.log(`⚠️ Failed to rebuild indexes for ${collectionName}`);
      }
    }
  }
  
  // Clean up old data
  private async cleanupOldData(db: any): Promise<void> {
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
    
    // Clean old analytics events
    const analytics = db.collection('analytics');
    await analytics.updateMany(
      {},
      { $pull: { events: { timestamp: { $lt: threeMonthsAgo } } } }
    );
    
    console.log('🧹 Cleaned up old analytics data');
  }
  
  // Compact collections
  private async compactCollections(db: any): Promise<void> {
    const collections = ['users', 'products', 'analytics'];
    
    for (const collectionName of collections) {
      try {
        await db.runCommand({ compact: collectionName });
        console.log(`📦 Compacted ${collectionName} collection`);
      } catch (error) {
        console.log(`⚠️ Failed to compact ${collectionName} collection`);
      }
    }
  }
  
  // Generate database health report
  async generateHealthReport(): Promise<any> {
    try {
      await connectToDB();
      const db = require('mongoose').connection.db;
      
      // Get database stats
      const stats = await db.stats();
      
      // Get collection stats
      const collections = await db.listCollections().toArray();
      const collectionStats = [];
      
      for (const collection of collections) {
        const collStats = await db.collection(collection.name).stats();
        collectionStats.push({
          name: collection.name,
          documents: collStats.count,
          size: Math.round(collStats.size / 1024 / 1024 * 100) / 100, // MB
          avgObjSize: Math.round(collStats.avgObjSize),
          indexes: collStats.nindexes
        });
      }
      
      return {
        database: db.databaseName,
        totalSize: Math.round(stats.dataSize / 1024 / 1024 * 100) / 100, // MB
        totalDocuments: stats.objects,
        totalCollections: stats.collections,
        totalIndexes: stats.indexes,
        collections: collectionStats,
        generatedAt: new Date()
      };
      
    } catch (error) {
      console.error('🔥 Health report generation failed:', error);
      throw error;
    }
  }
}

// Export utilities
export const migration = new DatabaseMigration();
export const seeder = new DatabaseSeeder();
export const maintenance = new DatabaseMaintenance();