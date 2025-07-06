#!/usr/bin/env node

const path = require('path');

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

// Import optimization utilities
async function runOptimization() {
  console.log('🚀 Starting ShopValue Database Optimization...');
  console.log('================================================');
  
  try {
    // Dynamic import to handle ES modules
    const { connectToDB } = await import('../lib/mongoose.js');
    const { 
      createProductionIndexes,
      auditIndexes,
      monitorDatabaseHealth,
      cleanupOldData,
      generateOptimizationReport
    } = await import('../lib/database/optimization.js');
    
    // Connect to database
    console.log('🔄 Connecting to MongoDB...');
    await connectToDB();
    console.log('✅ Connected to MongoDB successfully');
    
    const command = process.argv[2];
    
    switch (command) {
      case 'indexes':
        console.log('\n📊 Creating production indexes...');
        await createProductionIndexes();
        break;
        
      case 'audit':
        console.log('\n🔍 Auditing database indexes...');
        const auditResult = await auditIndexes();
        console.log('\nIndex Audit Results:');
        console.log('==================');
        console.log(`Users collection: ${auditResult.users.length} indexes`);
        console.log(`Products collection: ${auditResult.products.length} indexes`);
        console.log(`Analytics collection: ${auditResult.analytics.length} indexes`);
        
        if (auditResult.missing.length > 0) {
          console.log(`\n⚠️ Missing critical indexes: ${auditResult.missing.join(', ')}`);
        } else {
          console.log('\n✅ All critical indexes are present');
        }
        break;
        
      case 'health':
        console.log('\n🏥 Monitoring database health...');
        const healthResult = await monitorDatabaseHealth();
        console.log('\nDatabase Health Report:');
        console.log('======================');
        console.log(`Status: ${healthResult.status.toUpperCase()}`);
        console.log(`Connections: ${healthResult.metrics.connectionCount}`);
        console.log(`Queries/sec: ${healthResult.metrics.queriesPerSecond.toFixed(2)}`);
        console.log(`Avg Response Time: ${healthResult.metrics.avgResponseTime.toFixed(2)}ms`);
        console.log(`Index Hit Ratio: ${healthResult.metrics.indexHitRatio.toFixed(2)}%`);
        console.log(`Storage Size: ${healthResult.metrics.storageSize} MB`);
        
        if (healthResult.alerts.length > 0) {
          console.log('\n⚠️ Alerts:');
          healthResult.alerts.forEach(alert => console.log(`  - ${alert}`));
        }
        break;
        
      case 'cleanup':
        console.log('\n🧹 Cleaning up old data...');
        const cleanupResult = await cleanupOldData();
        console.log('\nCleanup Results:');
        console.log('===============');
        console.log(`Analytics records removed: ${cleanupResult.cleaned.analytics}`);
        console.log(`Inactive products removed: ${cleanupResult.cleaned.products}`);
        console.log(`Old price history removed: ${cleanupResult.cleaned.priceHistory}`);
        break;
        
      case 'report':
        console.log('\n📊 Generating comprehensive optimization report...');
        const report = await generateOptimizationReport();
        
        console.log('\nDatabase Optimization Report:');
        console.log('============================');
        console.log(`Overall Status: ${report.summary.status.toUpperCase()}`);
        console.log(`Total Collections: ${report.summary.totalCollections}`);
        console.log(`Total Documents: ${report.summary.totalDocuments}`);
        console.log(`Total Indexes: ${report.summary.totalIndexes}`);
        console.log(`Storage Size: ${report.summary.storageSize}`);
        
        if (report.indexAudit.missing.length > 0) {
          console.log(`\n⚠️ Missing Indexes: ${report.indexAudit.missing.join(', ')}`);
        }
        
        if (report.performance.slowQueries.length > 0) {
          console.log(`\n🐌 Found ${report.performance.slowQueries.length} slow queries in last 24h`);
        }
        
        if (report.recommendations.length > 0) {
          console.log('\n💡 Recommendations:');
          report.recommendations.forEach(rec => console.log(`  - ${rec}`));
        }
        break;
        
      case 'optimize':
        console.log('\n🔧 Running full database optimization...');
        
        // Create indexes
        console.log('1. Creating production indexes...');
        await createProductionIndexes();
        
        // Clean up old data
        console.log('2. Cleaning up old data...');
        const fullCleanupResult = await cleanupOldData();
        console.log(`   Cleaned: ${fullCleanupResult.cleaned.analytics} analytics, ${fullCleanupResult.cleaned.products} products, ${fullCleanupResult.cleaned.priceHistory} price records`);
        
        // Final health check
        console.log('3. Running final health check...');
        const finalHealth = await monitorDatabaseHealth();
        console.log(`   Final status: ${finalHealth.status.toUpperCase()}`);
        
        console.log('\n✅ Full optimization completed!');
        break;
        
      default:
        console.log('\nUsage: node db-optimize.js <command>');
        console.log('\nAvailable commands:');
        console.log('  indexes  - Create production indexes');
        console.log('  audit    - Audit existing indexes');
        console.log('  health   - Check database health');
        console.log('  cleanup  - Clean up old data');
        console.log('  report   - Generate comprehensive report');
        console.log('  optimize - Run full optimization (recommended)');
        console.log('\nExamples:');
        console.log('  node db-optimize.js optimize   # Full optimization');
        console.log('  node db-optimize.js health     # Quick health check');
        console.log('  node db-optimize.js report     # Detailed report');
        process.exit(1);
    }
    
    console.log('\n🎉 Operation completed successfully!');
    process.exit(0);
    
  } catch (error) {
    console.error('\n🔥 Optimization failed:', error);
    process.exit(1);
  }
}

// Run optimization
runOptimization();