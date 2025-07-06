#!/usr/bin/env node

/**
 * Performance Monitoring Script for ShopValue
 * Analyzes performance metrics and provides optimization recommendations
 */

const fs = require('fs');
const path = require('path');

// ANSI color codes for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

function log(message, color = colors.reset) {
  console.log(color + message + colors.reset);
}

function analyzeNextBuild() {
  log('\n🔍 Analyzing Next.js Build Output...', colors.cyan);
  
  const buildDir = path.join(process.cwd(), '.next');
  
  if (!fs.existsSync(buildDir)) {
    log('❌ Build directory not found. Run "npm run build" first.', colors.red);
    return false;
  }

  // Analyze static folder
  const staticDir = path.join(buildDir, 'static');
  if (fs.existsSync(staticDir)) {
    const chunks = analyzeChunks(staticDir);
    displayChunkAnalysis(chunks);
  }

  return true;
}

function analyzeChunks(staticDir) {
  const chunks = {
    js: [],
    css: [],
    total: 0
  };

  function scanDirectory(dir) {
    const items = fs.readdirSync(dir);
    
    items.forEach(item => {
      const itemPath = path.join(dir, item);
      const stat = fs.statSync(itemPath);
      
      if (stat.isDirectory()) {
        scanDirectory(itemPath);
      } else if (stat.isFile()) {
        const size = stat.size;
        chunks.total += size;
        
        if (item.endsWith('.js')) {
          chunks.js.push({ name: item, size, path: itemPath });
        } else if (item.endsWith('.css')) {
          chunks.css.push({ name: item, size, path: itemPath });
        }
      }
    });
  }

  scanDirectory(staticDir);
  
  // Sort by size descending
  chunks.js.sort((a, b) => b.size - a.size);
  chunks.css.sort((a, b) => b.size - a.size);
  
  return chunks;
}

function displayChunkAnalysis(chunks) {
  log('\n📊 Bundle Analysis:', colors.bright);
  
  const formatSize = (bytes) => {
    const kb = bytes / 1024;
    const mb = kb / 1024;
    
    if (mb >= 1) {
      return `${mb.toFixed(2)} MB`;
    } else {
      return `${kb.toFixed(2)} KB`;
    }
  };

  log(`Total Bundle Size: ${formatSize(chunks.total)}`, colors.blue);
  
  // JavaScript chunks
  if (chunks.js.length > 0) {
    log('\n📦 JavaScript Chunks:', colors.yellow);
    chunks.js.slice(0, 10).forEach(chunk => {
      const color = chunk.size > 500000 ? colors.red : chunk.size > 250000 ? colors.yellow : colors.green;
      log(`  ${chunk.name}: ${formatSize(chunk.size)}`, color);
    });
  }

  // CSS chunks
  if (chunks.css.length > 0) {
    log('\n🎨 CSS Chunks:', colors.yellow);
    chunks.css.forEach(chunk => {
      const color = chunk.size > 100000 ? colors.red : colors.green;
      log(`  ${chunk.name}: ${formatSize(chunk.size)}`, color);
    });
  }

  // Recommendations
  provideRecommendations(chunks);
}

function provideRecommendations(chunks) {
  log('\n💡 Performance Recommendations:', colors.magenta);

  const largeJsChunks = chunks.js.filter(chunk => chunk.size > 500000);
  const largeCssChunks = chunks.css.filter(chunk => chunk.size > 100000);

  if (largeJsChunks.length > 0) {
    log('  ⚠️  Large JavaScript chunks detected:', colors.yellow);
    largeJsChunks.forEach(chunk => {
      log(`    - ${chunk.name} (${formatSize(chunk.size)}) - Consider code splitting`, colors.red);
    });
  }

  if (largeCssChunks.length > 0) {
    log('  ⚠️  Large CSS chunks detected:', colors.yellow);
    largeCssChunks.forEach(chunk => {
      log(`    - ${chunk.name} (${formatSize(chunk.size)}) - Consider CSS optimization`, colors.red);
    });
  }

  if (chunks.total > 5000000) { // 5MB
    log('  ❌ Total bundle size exceeds 5MB - Critical optimization needed', colors.red);
  } else if (chunks.total > 2000000) { // 2MB
    log('  ⚠️  Total bundle size exceeds 2MB - Optimization recommended', colors.yellow);
  } else {
    log('  ✅ Bundle size is within acceptable limits', colors.green);
  }

  // General recommendations
  log('\n🚀 Optimization Strategies:', colors.cyan);
  log('  1. Implement dynamic imports for non-critical components');
  log('  2. Use React.lazy() for route-based code splitting');
  log('  3. Optimize images with Next.js Image component');
  log('  4. Remove unused dependencies and dead code');
  log('  5. Enable tree shaking for better bundle optimization');
  log('  6. Consider using a CDN for static assets');
}

function analyzeCoreWebVitals() {
  log('\n📈 Core Web Vitals Guidelines:', colors.cyan);
  log('  LCP (Largest Contentful Paint): < 2.5s (Good), < 4s (Needs Improvement)');
  log('  FID (First Input Delay): < 100ms (Good), < 300ms (Needs Improvement)');
  log('  CLS (Cumulative Layout Shift): < 0.1 (Good), < 0.25 (Needs Improvement)');
  log('\n💡 To measure actual metrics, run: npm run perf:vitals');
}

function checkPerformanceOptimizations() {
  log('\n🔧 Checking Performance Optimizations...', colors.cyan);

  const optimizations = [
    {
      name: 'Next.js Image Optimization',
      check: () => fs.existsSync(path.join(process.cwd(), 'next.config.js')),
      status: true
    },
    {
      name: 'Vercel Analytics',
      check: () => {
        const packageJson = require(path.join(process.cwd(), 'package.json'));
        return packageJson.dependencies['@vercel/analytics'];
      },
      status: true
    },
    {
      name: 'Bundle Analyzer Configuration',
      check: () => {
        const nextConfig = path.join(process.cwd(), 'next.config.js');
        if (fs.existsSync(nextConfig)) {
          const content = fs.readFileSync(nextConfig, 'utf8');
          return content.includes('BundleAnalyzerPlugin');
        }
        return false;
      },
      status: true
    },
    {
      name: 'Performance Monitoring',
      check: () => {
        const monitorPath = path.join(process.cwd(), 'components', 'monitoring', 'PerformanceMonitor.tsx');
        return fs.existsSync(monitorPath);
      },
      status: true
    }
  ];

  optimizations.forEach(opt => {
    const isEnabled = opt.check();
    const status = isEnabled ? '✅' : '❌';
    const color = isEnabled ? colors.green : colors.red;
    log(`  ${status} ${opt.name}`, color);
  });
}

function main() {
  log('🚀 ShopValue Performance Monitor', colors.bright + colors.blue);
  log('====================================', colors.blue);

  // Analyze build output
  const buildExists = analyzeNextBuild();
  
  if (buildExists) {
    // Check optimizations
    checkPerformanceOptimizations();
    
    // Core Web Vitals info
    analyzeCoreWebVitals();
    
    log('\n✨ Performance analysis complete!', colors.green);
    log('\nNext steps:', colors.bright);
    log('1. Run "npm run perf:lighthouse" for detailed Lighthouse audit');
    log('2. Run "npm run build:analyze" to view bundle analyzer');
    log('3. Monitor Core Web Vitals in production');
  }
}

// Run the performance monitor
if (require.main === module) {
  main();
}

function formatSize(bytes) {
  const kb = bytes / 1024;
  const mb = kb / 1024;
  
  if (mb >= 1) {
    return `${mb.toFixed(2)} MB`;
  } else {
    return `${kb.toFixed(2)} KB`;
  }
}

module.exports = {
  analyzeNextBuild,
  analyzeChunks,
  displayChunkAnalysis,
  provideRecommendations,
  analyzeCoreWebVitals,
  checkPerformanceOptimizations,
  formatSize
};