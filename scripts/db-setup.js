#!/usr/bin/env node

const mongoose = require('mongoose');
const path = require('path');

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

// Enhanced connection options (compatible with latest MongoDB driver)
const mongoOptions = {
  maxPoolSize: 10,
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
  maxIdleTimeMS: 30000,
  retryWrites: true,
  retryReads: true
};

// Database connection
async function connectToDatabase() {
  if (!process.env.MONGODB_URI) {
    console.error('❌ MONGODB_URI environment variable is required');
    process.exit(1);
  }

  try {
    console.log('🔄 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI, mongoOptions);
    console.log('✅ Connected to MongoDB successfully');
    console.log(`📊 Database: ${mongoose.connection.name}`);
  } catch (error) {
    console.error('🔥 Failed to connect to MongoDB:', error);
    process.exit(1);
  }
}

// Create essential indexes
async function createIndexes() {
  console.log('📊 Creating essential database indexes...');
  
  const db = mongoose.connection.db;
  
  try {
    // User collection indexes (with error handling)
    const users = db.collection('users');
    try {
      await users.createIndex({ email: 1 }, { unique: true });
    } catch (error) {
      if (error.code !== 11000) throw error;
      console.log('👤 Email index already exists');
    }
    
    try {
      await users.createIndex({ clerkId: 1 }, { unique: true, sparse: true });
    } catch (error) {
      if (error.code !== 11000) throw error;
      console.log('👤 ClerkId index already exists');
    }
    
    await users.createIndex({ 'subscription.plan': 1, 'subscription.status': 1 });
    await users.createIndex({ tenantId: 1, role: 1 });
    await users.createIndex({ status: 1, deletedAt: 1 });
    console.log('👤 User indexes created');
    
    // Product collection indexes (with proper data cleanup first)
    const products = db.collection('products');
    
    // Ensure URL index exists first
    try {
      await products.createIndex({ url: 1 }, { unique: true });
    } catch (error) {
      if (error.code !== 11000) throw error;
      console.log('📱 URL index already exists');
    }
    
    // Generate urlHash for existing products that don't have it
    console.log('🔄 Generating urlHash for existing products...');
    const crypto = require('crypto');
    const productsWithoutHash = await products.find({ 
      $or: [
        { urlHash: { $exists: false } },
        { urlHash: null },
        { urlHash: '' }
      ]
    }).toArray();
    
    for (const product of productsWithoutHash) {
      if (product.url) {
        const urlHash = crypto.createHash('sha256').update(product.url).digest('hex');
        await products.updateOne(
          { _id: product._id },
          { $set: { urlHash } }
        );
      }
    }
    console.log(`🔄 Updated ${productsWithoutHash.length} products with urlHash`);
    
    // Now create the urlHash unique index
    try {
      await products.createIndex({ urlHash: 1 }, { unique: true, sparse: true });
    } catch (error) {
      if (error.code !== 11000) throw error;
      console.log('📱 urlHash index already exists');
    }
    
    // Create other product indexes
    await products.createIndex({ brand: 1, category: 1 });
    await products.createIndex({ tenantId: 1, isActive: 1 });
    await products.createIndex({ source: 1, lastScrapedAt: 1 });
    await products.createIndex({ currentPrice: 1, brand: 1 });
    await products.createIndex({ nextScrapeAt: 1, trackingStatus: 1 });
    await products.createIndex({ 'analytics.popularityScore': -1, isActive: 1 });
    
    // Text search index for products
    try {
      await products.createIndex({
        title: 'text',
        description: 'text',
        brand: 'text',
        model: 'text'
      }, {
        weights: { title: 10, brand: 5, model: 5, description: 1 }
      });
    } catch (error) {
      console.log('📱 Text search index already exists or failed');
    }
    console.log('📱 Product indexes created');
    
    // Analytics collection indexes
    const analytics = db.collection('analytics');
    await analytics.createIndex({ tenantId: 1, 'events.timestamp': -1 });
    await analytics.createIndex({ tenantId: 1, 'events.event': 1, 'events.timestamp': -1 });
    await analytics.createIndex({ tenantId: 1, 'userBehavior.userId': 1 });
    await analytics.createIndex({ 'systemMetrics.timestamp': -1 });
    await analytics.createIndex({ createdAt: 1 }, { expireAfterSeconds: 63072000 }); // 2 years TTL
    console.log('📈 Analytics indexes created');
    
    console.log('✅ All indexes created successfully');
  } catch (error) {
    console.error('🔥 Error creating indexes:', error);
    throw error;
  }
}

// Add multi-tenancy support
async function addMultiTenancy() {
  console.log('🏢 Adding multi-tenancy support...');
  
  const db = mongoose.connection.db;
  
  try {
    // Add tenantId to existing users
    const users = db.collection('users');
    const userUpdateResult = await users.updateMany(
      { tenantId: { $exists: false } },
      { $set: { tenantId: 'default' } }
    );
    console.log(`👤 Updated ${userUpdateResult.modifiedCount} users with tenantId`);
    
    // Add tenantId and new fields to existing products
    const products = db.collection('products');
    const productUpdateResult = await products.updateMany(
      { tenantId: { $exists: false } },
      { 
        $set: { 
          tenantId: 'default',
          isActive: true,
          trackingStatus: 'active',
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
    console.log(`📱 Updated ${productUpdateResult.modifiedCount} products with new fields`);
    
    console.log('✅ Multi-tenancy support added successfully');
  } catch (error) {
    console.error('🔥 Error adding multi-tenancy:', error);
    throw error;
  }
}

// Migrate old user tracking format
async function migrateUserTracking() {
  console.log('🔄 Migrating user tracking format...');
  
  const db = mongoose.connection.db;
  const products = db.collection('products');
  
  try {
    // Find products with old 'users' array format
    const productsWithUsers = await products.find({ users: { $exists: true } }).toArray();
    
    for (const product of productsWithUsers) {
      if (product.users && Array.isArray(product.users) && product.users.length > 0) {
        const trackingUsers = product.users.map(user => ({
          userId: new mongoose.Types.ObjectId(),
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
    
    console.log(`🔄 Migrated ${productsWithUsers.length} products to new tracking format`);
  } catch (error) {
    console.error('🔥 Error migrating user tracking:', error);
    throw error;
  }
}

// Create sample development data
async function seedDevelopmentData() {
  console.log('🌱 Seeding development data...');
  
  const db = mongoose.connection.db;
  
  try {
    // Create sample users
    const users = db.collection('users');
    const sampleUsers = [
      {
        clerkId: 'dev_admin_001',
        email: 'admin@shopvalue.ro',
        firstName: 'Admin',
        lastName: 'User',
        role: 'admin',
        tenantId: 'default',
        status: 'active',
        subscription: {
          plan: 'enterprise',
          status: 'active'
        },
        usage: {
          productsTracked: 0,
          maxProducts: -1,
          apiCalls: 0,
          maxApiCalls: -1,
          emailsSent: 0,
          maxEmails: -1,
          resetDate: new Date()
        },
        preferences: {
          notifications: { email: true, priceAlerts: true },
          currency: 'RON',
          language: 'ro'
        },
        consent: {
          functional: { granted: true, timestamp: new Date() }
        },
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ];
    
    for (const user of sampleUsers) {
      const existingUser = await users.findOne({ email: user.email });
      if (!existingUser) {
        await users.insertOne(user);
        console.log(`👤 Created user: ${user.email}`);
      }
    }
    
    // Create sample products
    const products = db.collection('products');
    const sampleProducts = [
      {
        url: 'https://flip.ro/telefoane-mobile/apple/iphone-15-pro-max-256gb',
        urlHash: 'sample_hash_001',
        source: 'flip',
        title: 'iPhone 15 Pro Max 256GB Titanium Natural',
        brand: 'apple',
        model: 'iphone-15-pro-max',
        category: 'telefoane-mobile',
        currentPrice: 6999.99,
        originalPrice: 7499.99,
        currency: 'RON',
        image: 'https://cdn.flip.ro/sample-image.jpg',
        tenantId: 'default',
        isActive: true,
        trackingStatus: 'active',
        priceHistory: [
          { price: 6999.99, date: new Date() }
        ],
        lowestPrice: 6999.99,
        highestPrice: 7499.99,
        averagePrice: 7249.49,
        analytics: {
          viewCount: 145,
          trackingCount: 0,
          popularityScore: 50,
          lastViewed: new Date(),
          conversionRate: 0
        },
        lastScrapedAt: new Date(),
        nextScrapeAt: new Date(Date.now() + 4 * 60 * 60 * 1000),
        scraperVersion: '1.0.0',
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ];
    
    for (const product of sampleProducts) {
      const existingProduct = await products.findOne({ url: product.url });
      if (!existingProduct) {
        await products.insertOne(product);
        console.log(`📱 Created product: ${product.title}`);
      }
    }
    
    // Create analytics document
    const analytics = db.collection('analytics');
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
      console.log('📊 Created analytics collection');
    }
    
    console.log('✅ Development data seeded successfully');
  } catch (error) {
    console.error('🔥 Error seeding data:', error);
    throw error;
  }
}

// Generate database health report
async function generateHealthReport() {
  console.log('🏥 Generating database health report...');
  
  try {
    const db = mongoose.connection.db;
    const stats = await db.stats();
    
    const collections = await db.listCollections().toArray();
    const collectionStats = [];
    
    for (const collection of collections) {
      try {
        const collStats = await db.collection(collection.name).stats();
        collectionStats.push({
          name: collection.name,
          documents: collStats.count || 0,
          size: Math.round((collStats.size || 0) / 1024 / 1024 * 100) / 100, // MB
          avgObjSize: Math.round(collStats.avgObjSize || 0),
          indexes: collStats.nindexes || 0
        });
      } catch (error) {
        collectionStats.push({
          name: collection.name,
          documents: 0,
          size: 0,
          avgObjSize: 0,
          indexes: 0
        });
      }
    }
    
    const report = {
      database: db.databaseName,
      totalSize: Math.round((stats.dataSize || 0) / 1024 / 1024 * 100) / 100, // MB
      totalDocuments: stats.objects || 0,
      totalCollections: stats.collections || 0,
      totalIndexes: stats.indexes || 0,
      collections: collectionStats,
      generatedAt: new Date()
    };
    
    console.log('\n📊 Database Health Report:');
    console.log('========================');
    console.log(`Database: ${report.database}`);
    console.log(`Total Size: ${report.totalSize} MB`);
    console.log(`Total Documents: ${report.totalDocuments}`);
    console.log(`Total Collections: ${report.totalCollections}`);
    console.log(`Total Indexes: ${report.totalIndexes}`);
    console.log('\nCollections:');
    report.collections.forEach(coll => {
      console.log(`  ${coll.name}: ${coll.documents} docs, ${coll.size} MB, ${coll.indexes} indexes`);
    });
    
    return report;
  } catch (error) {
    console.error('🔥 Error generating health report:', error);
    throw error;
  }
}

// Clean existing data to prevent conflicts
async function cleanExistingData() {
  console.log('🧹 Cleaning existing data to prevent conflicts...');
  
  const db = mongoose.connection.db;
  
  try {
    const products = db.collection('products');
    
    // Remove products without URLs (invalid data)
    const deleteResult = await products.deleteMany({
      $or: [
        { url: { $exists: false } },
        { url: null },
        { url: '' }
      ]
    });
    
    if (deleteResult.deletedCount > 0) {
      console.log(`🗑️ Removed ${deleteResult.deletedCount} invalid products without URLs`);
    }
    
    // Remove duplicate products by URL (keep the most recent one)
    const duplicateUrls = await products.aggregate([
      { $group: { _id: '$url', count: { $sum: 1 }, docs: { $push: '$$ROOT' } } },
      { $match: { count: { $gt: 1 } } }
    ]).toArray();
    
    for (const duplicate of duplicateUrls) {
      // Sort by creation date and keep the newest
      const sorted = duplicate.docs.sort((a, b) => 
        new Date(b.createdAt || b._id.getTimestamp()) - new Date(a.createdAt || a._id.getTimestamp())
      );
      
      // Remove all but the first (newest)
      const toDelete = sorted.slice(1);
      for (const doc of toDelete) {
        await products.deleteOne({ _id: doc._id });
      }
      
      console.log(`🔄 Removed ${toDelete.length} duplicate products for URL: ${duplicate._id}`);
    }
    
    console.log('✅ Data cleanup completed');
  } catch (error) {
    console.error('🔥 Error during data cleanup:', error);
    // Don't throw error here, continue with setup
  }
}

// Main execution function
async function main() {
  const command = process.argv[2];
  
  try {
    await connectToDatabase();
    
    switch (command) {
      case 'clean':
        await cleanExistingData();
        console.log('🎉 Database cleanup completed successfully');
        break;
        
      case 'migrate':
        await cleanExistingData();
        await createIndexes();
        await addMultiTenancy();
        await migrateUserTracking();
        console.log('🎉 Database migration completed successfully');
        break;
        
      case 'seed':
        await seedDevelopmentData();
        console.log('🎉 Database seeding completed successfully');
        break;
        
      case 'health':
        await generateHealthReport();
        break;
        
      case 'setup':
        await cleanExistingData();
        await createIndexes();
        await addMultiTenancy();
        await migrateUserTracking();
        await seedDevelopmentData();
        console.log('🎉 Complete database setup completed successfully');
        break;
        
      default:
        console.log('Usage: node scripts/db-setup.js [command]');
        console.log('Commands:');
        console.log('  clean    - Clean existing data to prevent conflicts');
        console.log('  migrate  - Run database migrations (indexes, multi-tenancy, schema updates)');
        console.log('  seed     - Seed development data');
        console.log('  health   - Generate database health report');
        console.log('  setup    - Run cleanup, migrations and seed data (complete setup)');
        break;
    }
  } catch (error) {
    console.error('🔥 Script execution failed:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('👋 Disconnected from database');
  }
}

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('🔥 Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('🔥 Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Run the script
main();