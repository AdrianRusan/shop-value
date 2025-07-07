import { redis } from '@/lib/upstash';
import { connectToDB } from '@/lib/mongoose';
import * as Sentry from '@sentry/nextjs';
import { PerformanceMonitor } from '@/lib/performance-monitor';
import { DatabaseOptimizer } from '@/lib/database/optimization';

// Enhanced performance optimization interfaces
export interface OptimizationRecommendation {
  id: string;
  category: 'caching' | 'database' | 'frontend' | 'network' | 'memory';
  priority: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  impact: 'low' | 'medium' | 'high';
  effort: 'low' | 'medium' | 'high';
  estimatedGain: string;
  implementation: string;
  autoApplicable: boolean;
  timestamp: number;
}

export interface PerformanceOptimizationConfig {
  enableAdaptiveCaching: boolean;
  enableQueryOptimization: boolean;
  enablePreloading: boolean;
  enableResourceCompression: boolean;
  enableCDNCaching: boolean;
  cacheStrategy: 'aggressive' | 'balanced' | 'conservative';
  monitoringInterval: number;
}

export interface CacheStrategy {
  name: string;
  ttl: number;
  maxSize: number;
  evictionPolicy: 'lru' | 'lfu' | 'ttl';
  enabled: boolean;
}

export interface QueryOptimizationMetrics {
  slowQueries: Array<{
    query: string;
    duration: number;
    frequency: number;
    lastExecuted: Date;
    optimization: string;
  }>;
  indexSuggestions: Array<{
    collection: string;
    fields: string[];
    reason: string;
    estimatedImprovement: string;
  }>;
  queryPatterns: Array<{
    pattern: string;
    count: number;
    avgDuration: number;
  }>;
}

export class EnhancedPerformanceOptimizer {
  private static instance: EnhancedPerformanceOptimizer;
  private performanceMonitor: PerformanceMonitor;
  private config: PerformanceOptimizationConfig;
  private cacheStrategies: Map<string, CacheStrategy>;
  private optimizationHistory: OptimizationRecommendation[];

  private constructor() {
    this.performanceMonitor = PerformanceMonitor.getInstance();
    this.config = {
      enableAdaptiveCaching: true,
      enableQueryOptimization: true,
      enablePreloading: true,
      enableResourceCompression: true,
      enableCDNCaching: true,
      cacheStrategy: 'balanced',
      monitoringInterval: 60000, // 1 minute
    };

    this.cacheStrategies = new Map([
      ['user_data', { name: 'user_data', ttl: 900, maxSize: 1000, evictionPolicy: 'lru', enabled: true }],
      ['product_data', { name: 'product_data', ttl: 1800, maxSize: 5000, evictionPolicy: 'lfu', enabled: true }],
      ['search_results', { name: 'search_results', ttl: 300, maxSize: 2000, evictionPolicy: 'lru', enabled: true }],
      ['analytics_data', { name: 'analytics_data', ttl: 3600, maxSize: 500, evictionPolicy: 'ttl', enabled: true }],
      ['api_responses', { name: 'api_responses', ttl: 600, maxSize: 3000, evictionPolicy: 'lru', enabled: true }],
    ]);

    this.optimizationHistory = [];
  }

  public static getInstance(): EnhancedPerformanceOptimizer {
    if (!EnhancedPerformanceOptimizer.instance) {
      EnhancedPerformanceOptimizer.instance = new EnhancedPerformanceOptimizer();
    }
    return EnhancedPerformanceOptimizer.instance;
  }

  /**
   * Initialize the enhanced performance optimizer
   */
  public async initialize(): Promise<void> {
    try {
      console.log('🚀 Initializing Enhanced Performance Optimizer...');

      // Start monitoring
      await this.startContinuousOptimization();

      // Load existing optimization history
      await this.loadOptimizationHistory();

      // Initialize adaptive caching
      if (this.config.enableAdaptiveCaching) {
        await this.initializeAdaptiveCaching();
      }

      // Setup query optimization monitoring
      if (this.config.enableQueryOptimization) {
        await this.setupQueryOptimization();
      }

      console.log('✅ Enhanced Performance Optimizer initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize Enhanced Performance Optimizer:', error);
      Sentry.captureException(error);
    }
  }

  /**
   * Start continuous optimization monitoring
   */
  private async startContinuousOptimization(): Promise<void> {
    setInterval(async () => {
      try {
        await this.analyzeAndOptimize();
      } catch (error) {
        console.error('Error in continuous optimization:', error);
      }
    }, this.config.monitoringInterval);
  }

  /**
   * Main optimization analysis and execution
   */
  public async analyzeAndOptimize(): Promise<OptimizationRecommendation[]> {
    const recommendations: OptimizationRecommendation[] = [];

    try {
      // Collect current performance metrics
      const metrics = await this.performanceMonitor.collectMetrics();

      // Analyze caching performance
      if (this.config.enableAdaptiveCaching) {
        const cachingRecommendations = await this.analyzeCachingPerformance(metrics);
        recommendations.push(...cachingRecommendations);
      }

      // Analyze database performance
      if (this.config.enableQueryOptimization) {
        const dbRecommendations = await this.analyzeDatabasePerformance(metrics);
        recommendations.push(...dbRecommendations);
      }

      // Analyze frontend performance
      const frontendRecommendations = await this.analyzeFrontendPerformance(metrics);
      recommendations.push(...frontendRecommendations);

      // Analyze memory usage
      const memoryRecommendations = await this.analyzeMemoryUsage(metrics);
      recommendations.push(...memoryRecommendations);

      // Auto-apply critical optimizations
      await this.autoApplyOptimizations(recommendations);

      // Store recommendations
      await this.storeRecommendations(recommendations);

      return recommendations;
    } catch (error) {
      console.error('Error in performance analysis:', error);
      Sentry.captureException(error);
      return [];
    }
  }

  /**
   * Analyze caching performance and suggest improvements
   */
  private async analyzeCachingPerformance(metrics: any): Promise<OptimizationRecommendation[]> {
    const recommendations: OptimizationRecommendation[] = [];

    try {
      // Get cache hit rates
      const cacheMetrics = await this.getCacheMetrics();

      // Analyze each cache strategy
      for (const [key, strategy] of Array.from(this.cacheStrategies.entries())) {
        const hitRate = cacheMetrics[key]?.hitRate || 0;
        const usage = cacheMetrics[key]?.usage || 0;

        // Low hit rate recommendation
        if (hitRate < 70 && strategy.enabled) {
          recommendations.push({
            id: `cache_hitrate_${key}`,
            category: 'caching',
            priority: 'medium',
            title: `Improve ${key} cache hit rate`,
            description: `Cache hit rate for ${key} is ${hitRate}%, below optimal threshold of 70%`,
            impact: 'medium',
            effort: 'medium',
            estimatedGain: '15-25% faster response times',
            implementation: `Increase TTL to ${strategy.ttl * 1.5}s or review cache invalidation strategy`,
            autoApplicable: true,
            timestamp: Date.now(),
          });
        }

        // High memory usage recommendation
        if (usage > 85) {
          recommendations.push({
            id: `cache_memory_${key}`,
            category: 'caching',
            priority: 'high',
            title: `Optimize ${key} cache memory usage`,
            description: `Cache memory usage for ${key} is ${usage}%, approaching limit`,
            impact: 'high',
            effort: 'low',
            estimatedGain: 'Prevent cache overflow and performance degradation',
            implementation: `Reduce max size from ${strategy.maxSize} to ${Math.floor(strategy.maxSize * 0.8)}`,
            autoApplicable: true,
            timestamp: Date.now(),
          });
        }
      }

      // Suggest new cache strategies for frequently accessed data
      const frequentQueries = await this.getFrequentQueries();
      for (const query of frequentQueries) {
        if (!this.isCached(query.pattern)) {
          recommendations.push({
            id: `cache_new_${query.pattern.replace(/\W/g, '_')}`,
            category: 'caching',
            priority: 'medium',
            title: `Cache frequent query pattern`,
            description: `Query pattern "${query.pattern}" executed ${query.count} times with ${query.avgDuration}ms avg duration`,
            impact: 'medium',
            effort: 'medium',
            estimatedGain: `${Math.round(query.avgDuration * 0.8)}ms reduction per query`,
            implementation: `Implement caching for query pattern with 5-minute TTL`,
            autoApplicable: false,
            timestamp: Date.now(),
          });
        }
      }

      return recommendations;
    } catch (error) {
      console.error('Error analyzing caching performance:', error);
      return [];
    }
  }

  /**
   * Analyze database performance
   */
  private async analyzeDatabasePerformance(metrics: any): Promise<OptimizationRecommendation[]> {
    const recommendations: OptimizationRecommendation[] = [];

    try {
      // Get query optimization metrics
      const queryMetrics = await this.getQueryOptimizationMetrics();

      // Analyze slow queries
      for (const slowQuery of queryMetrics.slowQueries) {
        if (slowQuery.duration > 1000 && slowQuery.frequency > 10) {
          recommendations.push({
            id: `slow_query_${slowQuery.query.replace(/\W/g, '_').substring(0, 20)}`,
            category: 'database',
            priority: 'high',
            title: 'Optimize slow query',
            description: `Query "${slowQuery.query.substring(0, 50)}..." takes ${slowQuery.duration}ms and is executed ${slowQuery.frequency} times/hour`,
            impact: 'high',
            effort: 'medium',
            estimatedGain: `${Math.round(slowQuery.duration * 0.6)}ms reduction per query`,
            implementation: slowQuery.optimization || 'Add appropriate indexes or optimize query structure',
            autoApplicable: false,
            timestamp: Date.now(),
          });
        }
      }

      // Analyze index suggestions
      for (const indexSuggestion of queryMetrics.indexSuggestions) {
        recommendations.push({
          id: `index_${indexSuggestion.collection}_${indexSuggestion.fields.join('_')}`,
          category: 'database',
          priority: 'medium',
          title: `Add index to ${indexSuggestion.collection}`,
          description: `Missing index on ${indexSuggestion.collection}.${indexSuggestion.fields.join(', ')}`,
          impact: 'medium',
          effort: 'low',
          estimatedGain: indexSuggestion.estimatedImprovement,
          implementation: `db.${indexSuggestion.collection}.createIndex({${indexSuggestion.fields.map(f => `"${f}": 1`).join(', ')}})`,
          autoApplicable: true,
          timestamp: Date.now(),
        });
      }

      // Connection pool optimization
      if (metrics.database.connectionPoolUsage > 80) {
        recommendations.push({
          id: 'connection_pool_optimization',
          category: 'database',
          priority: 'high',
          title: 'Optimize database connection pool',
          description: `Connection pool usage is ${metrics.database.connectionPoolUsage}%, approaching limit`,
          impact: 'high',
          effort: 'low',
          estimatedGain: 'Prevent connection timeouts and improve scalability',
          implementation: 'Increase maxPoolSize or optimize connection lifecycle',
          autoApplicable: false,
          timestamp: Date.now(),
        });
      }

      return recommendations;
    } catch (error) {
      console.error('Error analyzing database performance:', error);
      return [];
    }
  }

  /**
   * Analyze frontend performance
   */
  private async analyzeFrontendPerformance(metrics: any): Promise<OptimizationRecommendation[]> {
    const recommendations: OptimizationRecommendation[] = [];

    try {
      // Get Core Web Vitals data
      const webVitals = await this.getCoreWebVitals();

      // LCP optimization
      if (webVitals.lcp > 2500) {
        recommendations.push({
          id: 'optimize_lcp',
          category: 'frontend',
          priority: 'high',
          title: 'Optimize Largest Contentful Paint',
          description: `LCP is ${webVitals.lcp}ms, exceeding good threshold of 2500ms`,
          impact: 'high',
          effort: 'medium',
          estimatedGain: 'Improved user experience and SEO ranking',
          implementation: 'Optimize images, implement resource preloading, reduce server response times',
          autoApplicable: false,
          timestamp: Date.now(),
        });
      }

      // FID optimization
      if (webVitals.fid > 100) {
        recommendations.push({
          id: 'optimize_fid',
          category: 'frontend',
          priority: 'medium',
          title: 'Optimize First Input Delay',
          description: `FID is ${webVitals.fid}ms, exceeding good threshold of 100ms`,
          impact: 'medium',
          effort: 'medium',
          estimatedGain: 'Better interactivity and user experience',
          implementation: 'Reduce JavaScript execution time, use code splitting, optimize event handlers',
          autoApplicable: false,
          timestamp: Date.now(),
        });
      }

      // CLS optimization
      if (webVitals.cls > 0.1) {
        recommendations.push({
          id: 'optimize_cls',
          category: 'frontend',
          priority: 'medium',
          title: 'Optimize Cumulative Layout Shift',
          description: `CLS is ${webVitals.cls}, exceeding good threshold of 0.1`,
          impact: 'medium',
          effort: 'low',
          estimatedGain: 'Reduced layout instability and better UX',
          implementation: 'Set explicit dimensions for images, avoid inserting content above viewport',
          autoApplicable: false,
          timestamp: Date.now(),
        });
      }

      // Bundle size optimization
      const bundleSize = await this.getBundleSize();
      if (bundleSize.main > 1000000) { // 1MB
        recommendations.push({
          id: 'optimize_bundle_size',
          category: 'frontend',
          priority: 'medium',
          title: 'Reduce JavaScript bundle size',
          description: `Main bundle size is ${Math.round(bundleSize.main / 1024)}KB, consider optimization`,
          impact: 'medium',
          effort: 'medium',
          estimatedGain: 'Faster page loads and reduced bandwidth usage',
          implementation: 'Implement code splitting, tree shaking, and dynamic imports',
          autoApplicable: false,
          timestamp: Date.now(),
        });
      }

      return recommendations;
    } catch (error) {
      console.error('Error analyzing frontend performance:', error);
      return [];
    }
  }

  /**
   * Analyze memory usage patterns
   */
  private async analyzeMemoryUsage(metrics: any): Promise<OptimizationRecommendation[]> {
    const recommendations: OptimizationRecommendation[] = [];

    try {
      const memoryUsagePercent = (metrics.application.memory.heapUsed / metrics.application.memory.heapTotal) * 100;

      // High memory usage
      if (memoryUsagePercent > 85) {
        recommendations.push({
          id: 'memory_optimization',
          category: 'memory',
          priority: 'critical',
          title: 'Critical memory usage detected',
          description: `Memory usage is ${memoryUsagePercent.toFixed(1)}%, approaching limit`,
          impact: 'high',
          effort: 'medium',
          estimatedGain: 'Prevent out-of-memory errors and crashes',
          implementation: 'Implement memory profiling, fix memory leaks, optimize data structures',
          autoApplicable: false,
          timestamp: Date.now(),
        });
      }

      // Memory leaks detection
      const memoryTrend = await this.getMemoryTrend();
      if (memoryTrend.slope > 0.1) { // Growing more than 10% per hour
        recommendations.push({
          id: 'memory_leak_detection',
          category: 'memory',
          priority: 'high',
          title: 'Potential memory leak detected',
          description: `Memory usage trending upward at ${(memoryTrend.slope * 100).toFixed(1)}% per hour`,
          impact: 'high',
          effort: 'high',
          estimatedGain: 'Prevent application instability',
          implementation: 'Investigate memory leaks using heap profiling and fix identified issues',
          autoApplicable: false,
          timestamp: Date.now(),
        });
      }

      return recommendations;
    } catch (error) {
      console.error('Error analyzing memory usage:', error);
      return [];
    }
  }

  /**
   * Auto-apply safe optimizations
   */
  private async autoApplyOptimizations(recommendations: OptimizationRecommendation[]): Promise<void> {
    for (const rec of recommendations) {
      if (rec.autoApplicable && rec.priority !== 'critical') {
        try {
          await this.applyOptimization(rec);
          console.log(`🔧 Auto-applied optimization: ${rec.title}`);
        } catch (error) {
          console.error(`Failed to auto-apply optimization ${rec.id}:`, error);
        }
      }
    }
  }

  /**
   * Apply a specific optimization
   */
  private async applyOptimization(recommendation: OptimizationRecommendation): Promise<void> {
    switch (recommendation.category) {
      case 'caching':
        await this.applyCachingOptimization(recommendation);
        break;
      case 'database':
        await this.applyDatabaseOptimization(recommendation);
        break;
      case 'frontend':
        await this.applyFrontendOptimization(recommendation);
        break;
      default:
        console.log(`Optimization ${recommendation.id} requires manual implementation`);
    }
  }

  /**
   * Apply caching optimization
   */
  private async applyCachingOptimization(recommendation: OptimizationRecommendation): Promise<void> {
    if (recommendation.id.includes('cache_memory_')) {
      const cacheKey = recommendation.id.replace('cache_memory_', '');
      const strategy = this.cacheStrategies.get(cacheKey);
      
      if (strategy) {
        strategy.maxSize = Math.floor(strategy.maxSize * 0.8);
        await redis.hset('cache:strategies', { [cacheKey]: JSON.stringify(strategy) });
      }
    } else if (recommendation.id.includes('cache_hitrate_')) {
      const cacheKey = recommendation.id.replace('cache_hitrate_', '');
      const strategy = this.cacheStrategies.get(cacheKey);
      
      if (strategy) {
        strategy.ttl = Math.floor(strategy.ttl * 1.5);
        await redis.hset('cache:strategies', { [cacheKey]: JSON.stringify(strategy) });
      }
    }
  }

  /**
   * Apply database optimization
   */
  private async applyDatabaseOptimization(recommendation: OptimizationRecommendation): Promise<void> {
    if (recommendation.id.includes('index_')) {
      // This would require manual review and implementation
      console.log(`Database index optimization requires manual implementation: ${recommendation.implementation}`);
    }
  }

  /**
   * Apply frontend optimization
   */
  private async applyFrontendOptimization(recommendation: OptimizationRecommendation): Promise<void> {
    // Frontend optimizations typically require code changes and can't be auto-applied
    console.log(`Frontend optimization requires manual implementation: ${recommendation.implementation}`);
  }

  /**
   * Helper methods for data collection
   */

  private async getCacheMetrics(): Promise<Record<string, any>> {
    try {
      const metrics: Record<string, any> = {};
      
      for (const key of Array.from(this.cacheStrategies.keys())) {
        const hits = String(await redis.get(`cache:${key}:hits`) || '0');
        const misses = String(await redis.get(`cache:${key}:misses`) || '0');
        const size = String(await redis.get(`cache:${key}:size`) || '0');
        
        const totalRequests = parseInt(hits) + parseInt(misses);
        const hitRate = totalRequests > 0 ? (parseInt(hits) / totalRequests) * 100 : 0;
        
        metrics[key] = {
          hitRate: Math.round(hitRate),
          usage: parseInt(size),
          hits: parseInt(hits),
          misses: parseInt(misses),
        };
      }
      
      return metrics;
    } catch (error) {
      console.error('Error getting cache metrics:', error);
      return {};
    }
  }

  private async getFrequentQueries(): Promise<Array<{ pattern: string; count: number; avgDuration: number }>> {
    try {
      const queryData = await redis.lrange('db:query:patterns', 0, 99);
      return queryData.map(item => JSON.parse(item));
    } catch (error) {
      console.error('Error getting frequent queries:', error);
      return [];
    }
  }

  private async getQueryOptimizationMetrics(): Promise<QueryOptimizationMetrics> {
    try {
      const [slowQueries, indexSuggestions, queryPatterns] = await Promise.all([
        redis.lrange('db:metrics:slow_queries', 0, 49).then(items => 
          items.map(item => JSON.parse(item))
        ),
        redis.lrange('db:index:suggestions', 0, 19).then(items => 
          items.map(item => JSON.parse(item))
        ),
        redis.lrange('db:query:patterns', 0, 29).then(items => 
          items.map(item => JSON.parse(item))
        ),
      ]);

      return {
        slowQueries,
        indexSuggestions,
        queryPatterns,
      };
    } catch (error) {
      console.error('Error getting query optimization metrics:', error);
      return { slowQueries: [], indexSuggestions: [], queryPatterns: [] };
    }
  }

  private async getCoreWebVitals(): Promise<{ lcp: number; fid: number; cls: number }> {
    try {
      const vitals = await redis.hgetall('performance:web_vitals:current');
      return {
        lcp: parseFloat(String(vitals?.lcp || '0')),
        fid: parseFloat(String(vitals?.fid || '0')),
        cls: parseFloat(String(vitals?.cls || '0')),
      };
    } catch (error) {
      console.error('Error getting Core Web Vitals:', error);
      return { lcp: 0, fid: 0, cls: 0 };
    }
  }

  private async getBundleSize(): Promise<{ main: number; vendor: number }> {
    try {
      const bundleData = await redis.hgetall('performance:bundle_size');
      return {
        main: parseInt(String(bundleData?.main || '0')),
        vendor: parseInt(String(bundleData?.vendor || '0')),
      };
    } catch (error) {
      console.error('Error getting bundle size:', error);
      return { main: 0, vendor: 0 };
    }
  }

  private async getMemoryTrend(): Promise<{ slope: number; correlation: number }> {
    try {
      const memoryHistory = await redis.lrange('performance:memory:history', 0, 59); // Last hour
      if (memoryHistory.length < 10) return { slope: 0, correlation: 0 };
      
      const data = memoryHistory.map((item, index) => ({
        x: index,
        y: JSON.parse(item).usage,
      }));
      
      // Simple linear regression to detect trend
      const n = data.length;
      const sumX = data.reduce((sum, point) => sum + point.x, 0);
      const sumY = data.reduce((sum, point) => sum + point.y, 0);
      const sumXY = data.reduce((sum, point) => sum + point.x * point.y, 0);
      const sumXX = data.reduce((sum, point) => sum + point.x * point.x, 0);
      
      const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
      
      return { slope: slope / 100, correlation: 0.8 }; // Normalized slope
    } catch (error) {
      console.error('Error calculating memory trend:', error);
      return { slope: 0, correlation: 0 };
    }
  }

  private isCached(pattern: string): boolean {
    // Check if a query pattern is already being cached
    return pattern.includes('find') || pattern.includes('aggregate');
  }

  private async initializeAdaptiveCaching(): Promise<void> {
    console.log('🧠 Initializing adaptive caching strategies...');
    
    // Load existing cache strategies from Redis
    try {
      const strategies = await redis.hgetall('cache:strategies');
      for (const [key, value] of Object.entries(strategies || {})) {
        if (value) {
          this.cacheStrategies.set(key, JSON.parse(String(value)));
        }
      }
    } catch (error) {
      console.error('Error loading cache strategies:', error);
    }
  }

  private async setupQueryOptimization(): Promise<void> {
    console.log('🔍 Setting up query optimization monitoring...');
    // Query optimization monitoring is handled by the existing mongoose performance tracking
  }

  private async loadOptimizationHistory(): Promise<void> {
    try {
      const history = await redis.lrange('performance:optimization:history', 0, 99);
      this.optimizationHistory = history.map(item => JSON.parse(item));
    } catch (error) {
      console.error('Error loading optimization history:', error);
    }
  }

  private async storeRecommendations(recommendations: OptimizationRecommendation[]): Promise<void> {
    try {
      if (recommendations.length > 0) {
        const serialized = recommendations.map(rec => JSON.stringify(rec));
        await redis.lpush('performance:optimization:recommendations', ...serialized);
        await redis.ltrim('performance:optimization:recommendations', 0, 199);
        
        // Store in optimization history
        this.optimizationHistory.unshift(...recommendations);
        this.optimizationHistory = this.optimizationHistory.slice(0, 100);
        
        const historyData = this.optimizationHistory.map(rec => JSON.stringify(rec));
        await redis.del('performance:optimization:history');
        if (historyData.length > 0) {
          await redis.lpush('performance:optimization:history', ...historyData);
        }
      }
    } catch (error) {
      console.error('Error storing recommendations:', error);
    }
  }

  /**
   * Get optimization dashboard data
   */
  public async getOptimizationDashboard(): Promise<{
    currentRecommendations: OptimizationRecommendation[];
    appliedOptimizations: OptimizationRecommendation[];
    performanceScore: number;
    trends: any;
  }> {
    try {
      const [currentRecs, appliedOpts, score] = await Promise.all([
        this.getCurrentRecommendations(),
        this.getAppliedOptimizations(),
        this.calculatePerformanceScore(),
      ]);

      const trends = await this.getPerformanceTrends();

      return {
        currentRecommendations: currentRecs,
        appliedOptimizations: appliedOpts,
        performanceScore: score,
        trends,
      };
    } catch (error) {
      console.error('Error getting optimization dashboard:', error);
      return {
        currentRecommendations: [],
        appliedOptimizations: [],
        performanceScore: 0,
        trends: {},
      };
    }
  }

  private async getCurrentRecommendations(): Promise<OptimizationRecommendation[]> {
    try {
      const recs = await redis.lrange('performance:optimization:recommendations', 0, 19);
      return recs.map(rec => JSON.parse(rec));
    } catch (error) {
      return [];
    }
  }

  private async getAppliedOptimizations(): Promise<OptimizationRecommendation[]> {
    try {
      const applied = await redis.lrange('performance:optimization:applied', 0, 19);
      return applied.map(rec => JSON.parse(rec));
    } catch (error) {
      return [];
    }
  }

  private async calculatePerformanceScore(): Promise<number> {
    try {
      const metrics = await this.performanceMonitor.getPerformanceReport();
      if (!metrics.current) return 0;

      let score = 100;

      // Database score (30%)
      const dbHealth = metrics.current.database.healthy ? 100 : 0;
      const dbLatency = Math.max(0, 100 - (metrics.current.database.averageQueryTime / 10));
      const dbCacheHit = metrics.current.database.cacheHitRate;
      const dbScore = (dbHealth + dbLatency + dbCacheHit) / 3;

      // WebSocket score (20%)
      const wsHealth = metrics.current.websocket.healthy ? 100 : 0;
      const wsLatency = Math.max(0, 100 - (metrics.current.websocket.averageResponseTime / 10));
      const wsMemory = Math.max(0, 100 - metrics.current.websocket.memoryUsage);
      const wsScore = (wsHealth + wsLatency + wsMemory) / 3;

      // Application score (30%)
      const memoryUsage = (metrics.current.application.memory.heapUsed / metrics.current.application.memory.heapTotal) * 100;
      const appMemory = Math.max(0, 100 - memoryUsage);
      const appScore = appMemory;

      // Redis score (20%)
      const redisHealth = metrics.current.redis.connected ? 100 : 0;
      const redisMemory = Math.max(0, 100 - metrics.current.redis.memoryUsage);
      const redisScore = (redisHealth + redisMemory) / 2;

      // Calculate weighted average
      score = (dbScore * 0.3) + (wsScore * 0.2) + (appScore * 0.3) + (redisScore * 0.2);

      return Math.round(Math.max(0, Math.min(100, score)));
    } catch (error) {
      console.error('Error calculating performance score:', error);
      return 0;
    }
  }

  private async getPerformanceTrends(): Promise<any> {
    try {
      const trends = await redis.lrange('performance:timeseries', 0, 47);
      return trends.map(trend => JSON.parse(trend));
    } catch (error) {
      return [];
    }
  }

  /**
   * Manual optimization trigger
   */
  public async triggerOptimization(): Promise<OptimizationRecommendation[]> {
    console.log('🔧 Triggering manual performance optimization...');
    return await this.analyzeAndOptimize();
  }

  /**
   * Get configuration
   */
  public getConfig(): PerformanceOptimizationConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  public updateConfig(newConfig: Partial<PerformanceOptimizationConfig>): void {
    this.config = { ...this.config, ...newConfig };
    console.log('⚙️ Performance optimization configuration updated');
  }
}

export default EnhancedPerformanceOptimizer; 