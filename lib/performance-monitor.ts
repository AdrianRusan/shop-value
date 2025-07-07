import * as Sentry from '@sentry/nextjs';
import { redis } from './upstash';
import { getDBStats, checkDBHealth } from './mongoose';
import SocketManager from './socket-server';

// Performance monitoring interfaces
export interface SystemPerformanceMetrics {
  timestamp: number;
  database: {
    healthy: boolean;
    connectionPoolUsage: number;
    queryCount: number;
    slowQueries: number;
    averageQueryTime: number;
    cacheHitRate: number;
    totalSize: number;
    indexSize: number;
  };
  websocket: {
    healthy: boolean;
    connections: number;
    messagesPerSecond: number;
    averageResponseTime: number;
    memoryUsage: number;
    errors: number;
    slowOperations: number;
  };
  application: {
    memory: NodeJS.MemoryUsage;
    uptime: number;
    cpuUsage: number;
    eventLoopDelay: number;
  };
  redis: {
    connected: boolean;
    memoryUsage: number;
    commandsPerSecond: number;
    hitRate: number;
  };
}

export interface PerformanceAlert {
  id: string;
  type: 'warning' | 'critical';
  category: 'database' | 'websocket' | 'memory' | 'performance' | 'redis';
  message: string;
  value: number;
  threshold: number;
  timestamp: number;
}

export interface PerformanceRecommendation {
  category: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  impact: string;
  action: string;
}

export class PerformanceMonitor {
  private static instance: PerformanceMonitor;
  private monitoringInterval: NodeJS.Timeout | null = null;
  private alertThresholds = {
    database: {
      connectionPoolUsage: 80,
      slowQueryPercentage: 10,
      averageQueryTime: 1000,
      cacheHitRate: 70,
    },
    websocket: {
      memoryUsage: 85,
      averageResponseTime: 1000,
      errorRate: 5,
      connectionLimit: 1000,
    },
    application: {
      memoryUsage: 85,
      cpuUsage: 80,
      eventLoopDelay: 100,
    },
    redis: {
      memoryUsage: 80,
      hitRate: 90,
    }
  };

  private constructor() {}

  public static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor();
    }
    return PerformanceMonitor.instance;
  }

  public async initialize(): Promise<void> {
    console.log('🚀 Initializing Performance Monitor...');
    
    // Start monitoring every 30 seconds
    this.monitoringInterval = setInterval(async () => {
      try {
        await this.collectMetrics();
      } catch (error) {
        console.error('Error collecting performance metrics:', error);
        Sentry.captureException(error);
      }
    }, 30000);

    // Initial metrics collection
    await this.collectMetrics();
    
    console.log('✅ Performance Monitor initialized');
  }

  public async collectMetrics(): Promise<SystemPerformanceMetrics> {
    const timestamp = Date.now();

    // Collect metrics from all systems
    const [databaseMetrics, websocketMetrics, applicationMetrics, redisMetrics] = await Promise.all([
      this.collectDatabaseMetrics(),
      this.collectWebSocketMetrics(),
      this.collectApplicationMetrics(),
      this.collectRedisMetrics(),
    ]);

    const systemMetrics: SystemPerformanceMetrics = {
      timestamp,
      database: databaseMetrics,
      websocket: websocketMetrics,
      application: applicationMetrics,
      redis: redisMetrics,
    };

    // Store metrics in Redis
    await this.storeMetrics(systemMetrics);

    // Check for alerts
    const alerts = await this.checkAlerts(systemMetrics);
    if (alerts.length > 0) {
      await this.handleAlerts(alerts);
    }

    // Generate recommendations
    const recommendations = this.generateRecommendations(systemMetrics);
    if (recommendations.length > 0) {
      await this.storeRecommendations(recommendations);
    }

    return systemMetrics;
  }

  private async collectDatabaseMetrics() {
    try {
      const [health, stats] = await Promise.all([
        checkDBHealth(),
        getDBStats(),
      ]);

      return {
        healthy: health.healthy,
        connectionPoolUsage: (health.stats as any)?.connectionPoolUsage || 0,
        queryCount: health.stats?.totalQueries || 0,
        slowQueries: health.stats?.slowQueries || 0,
        averageQueryTime: health.stats?.avgQueryTime || 0,
        cacheHitRate: (health.stats as any)?.cacheHitRate || 0,
        totalSize: stats?.database?.size || 0,
        indexSize: stats?.database?.indexSize || 0,
      };
    } catch (error) {
      console.error('Error collecting database metrics:', error);
      return {
        healthy: false,
        connectionPoolUsage: 0,
        queryCount: 0,
        slowQueries: 0,
        averageQueryTime: 0,
        cacheHitRate: 0,
        totalSize: 0,
        indexSize: 0,
      };
    }
  }

  private async collectWebSocketMetrics() {
    try {
      const socketManager = SocketManager.getInstance();
      const [metrics, health] = await Promise.all([
        socketManager.getPerformanceMetrics(),
        socketManager.getHealthStatus(),
      ]);

      const messagesPerSecond = metrics.uptime > 0 
        ? ((metrics.messagesEmitted + metrics.messagesReceived) / (metrics.uptime / 1000))
        : 0;

      return {
        healthy: health.healthy,
        connections: metrics.currentConnections,
        messagesPerSecond: Math.round(messagesPerSecond),
        averageResponseTime: metrics.averageResponseTime,
        memoryUsage: metrics.memoryUsage.percentage,
        errors: metrics.errors,
        slowOperations: metrics.slowOperations,
      };
    } catch (error) {
      console.error('Error collecting WebSocket metrics:', error);
      return {
        healthy: false,
        connections: 0,
        messagesPerSecond: 0,
        averageResponseTime: 0,
        memoryUsage: 0,
        errors: 0,
        slowOperations: 0,
      };
    }
  }

  private async collectApplicationMetrics() {
    const memoryUsage = process.memoryUsage();
    const uptime = process.uptime();
    
    // Simple CPU usage approximation
    const startTime = process.hrtime();
    await new Promise(resolve => setTimeout(resolve, 100));
    const endTime = process.hrtime(startTime);
    const cpuUsage = (endTime[0] * 1000 + endTime[1] / 1000000) / 100; // Rough estimate

    // Event loop delay measurement
    const start = process.hrtime();
    setImmediate(() => {
      const delta = process.hrtime(start);
      const eventLoopDelay = delta[0] * 1000 + delta[1] / 1000000;
    });

    return {
      memory: memoryUsage,
      uptime,
      cpuUsage: Math.min(100, cpuUsage),
      eventLoopDelay: 0, // Would need proper implementation with async_hooks
    };
  }

  private async collectRedisMetrics() {
    try {
      // Check Redis connection
      await redis.ping();
      
      // Get Redis info (simplified version)
      const info = await (redis as any).info();
      const memorySection = info.split('\r\n').find((line: string) => line.startsWith('used_memory:'));
      const memoryUsed = memorySection ? parseInt(memorySection.split(':')[1]) : 0;
      
      return {
        connected: true,
        memoryUsage: Math.round((memoryUsed / (1024 * 1024 * 100)) * 100), // Rough percentage
        commandsPerSecond: 0, // Would need proper Redis monitoring
        hitRate: 0, // Would need cache hit/miss tracking
      };
    } catch (error) {
      return {
        connected: false,
        memoryUsage: 0,
        commandsPerSecond: 0,
        hitRate: 0,
      };
    }
  }

  private async checkAlerts(metrics: SystemPerformanceMetrics): Promise<PerformanceAlert[]> {
    const alerts: PerformanceAlert[] = [];

    // Database alerts
    if (metrics.database.connectionPoolUsage > this.alertThresholds.database.connectionPoolUsage) {
      alerts.push({
        id: `db-pool-${Date.now()}`,
        type: 'warning',
        category: 'database',
        message: 'High database connection pool usage',
        value: metrics.database.connectionPoolUsage,
        threshold: this.alertThresholds.database.connectionPoolUsage,
        timestamp: metrics.timestamp,
      });
    }

    if (metrics.database.averageQueryTime > this.alertThresholds.database.averageQueryTime) {
      alerts.push({
        id: `db-slow-${Date.now()}`,
        type: 'warning',
        category: 'database',
        message: 'High average database query time',
        value: metrics.database.averageQueryTime,
        threshold: this.alertThresholds.database.averageQueryTime,
        timestamp: metrics.timestamp,
      });
    }

    if (metrics.database.cacheHitRate < this.alertThresholds.database.cacheHitRate) {
      alerts.push({
        id: `db-cache-${Date.now()}`,
        type: 'warning',
        category: 'database',
        message: 'Low database cache hit rate',
        value: metrics.database.cacheHitRate,
        threshold: this.alertThresholds.database.cacheHitRate,
        timestamp: metrics.timestamp,
      });
    }

    // WebSocket alerts
    if (metrics.websocket.memoryUsage > this.alertThresholds.websocket.memoryUsage) {
      alerts.push({
        id: `ws-memory-${Date.now()}`,
        type: 'critical',
        category: 'websocket',
        message: 'High WebSocket memory usage',
        value: metrics.websocket.memoryUsage,
        threshold: this.alertThresholds.websocket.memoryUsage,
        timestamp: metrics.timestamp,
      });
    }

    if (metrics.websocket.averageResponseTime > this.alertThresholds.websocket.averageResponseTime) {
      alerts.push({
        id: `ws-response-${Date.now()}`,
        type: 'warning',
        category: 'websocket',
        message: 'High WebSocket response time',
        value: metrics.websocket.averageResponseTime,
        threshold: this.alertThresholds.websocket.averageResponseTime,
        timestamp: metrics.timestamp,
      });
    }

    if (metrics.websocket.connections > this.alertThresholds.websocket.connectionLimit) {
      alerts.push({
        id: `ws-connections-${Date.now()}`,
        type: 'warning',
        category: 'websocket',
        message: 'High WebSocket connection count',
        value: metrics.websocket.connections,
        threshold: this.alertThresholds.websocket.connectionLimit,
        timestamp: metrics.timestamp,
      });
    }

    // Application alerts
    const memoryUsagePercent = (metrics.application.memory.heapUsed / metrics.application.memory.heapTotal) * 100;
    if (memoryUsagePercent > this.alertThresholds.application.memoryUsage) {
      alerts.push({
        id: `app-memory-${Date.now()}`,
        type: 'critical',
        category: 'memory',
        message: 'High application memory usage',
        value: memoryUsagePercent,
        threshold: this.alertThresholds.application.memoryUsage,
        timestamp: metrics.timestamp,
      });
    }

    // Redis alerts
    if (!metrics.redis.connected) {
      alerts.push({
        id: `redis-connection-${Date.now()}`,
        type: 'critical',
        category: 'redis',
        message: 'Redis connection failed',
        value: 0,
        threshold: 1,
        timestamp: metrics.timestamp,
      });
    }

    return alerts;
  }

  private async handleAlerts(alerts: PerformanceAlert[]): Promise<void> {
    for (const alert of alerts) {
      console.warn(`🚨 Performance Alert [${alert.type.toUpperCase()}]: ${alert.message}`, {
        value: alert.value,
        threshold: alert.threshold,
        category: alert.category,
      });

      // Store alert in Redis
      await redis.lpush('performance:alerts', JSON.stringify(alert));
      await redis.ltrim('performance:alerts', 0, 999); // Keep last 1000 alerts

      // Send critical alerts to Sentry
      if (alert.type === 'critical') {
        Sentry.captureMessage(`Performance Alert: ${alert.message}`, {
          level: 'warning',
          tags: {
            category: alert.category,
            type: alert.type,
          },
          extra: {
            value: alert.value,
            threshold: alert.threshold,
            timestamp: alert.timestamp,
          },
        });
      }
    }
  }

  private generateRecommendations(metrics: SystemPerformanceMetrics): PerformanceRecommendation[] {
    const recommendations: PerformanceRecommendation[] = [];

    // Database recommendations
    if (metrics.database.slowQueries > 10) {
      recommendations.push({
        category: 'database',
        priority: 'high',
        message: 'High number of slow database queries detected',
        impact: 'Affects application response time and user experience',
        action: 'Analyze slow queries and add appropriate indexes',
      });
    }

    if (metrics.database.cacheHitRate < 50) {
      recommendations.push({
        category: 'database',
        priority: 'medium',
        message: 'Low database cache hit rate',
        impact: 'Increased database load and slower response times',
        action: 'Review caching strategy and increase cache TTL where appropriate',
      });
    }

    if (metrics.database.connectionPoolUsage > 70) {
      recommendations.push({
        category: 'database',
        priority: 'medium',
        message: 'High database connection pool usage',
        impact: 'Risk of connection exhaustion and failed requests',
        action: 'Consider increasing connection pool size or optimizing query patterns',
      });
    }

    // WebSocket recommendations
    if (metrics.websocket.slowOperations > 5) {
      recommendations.push({
        category: 'websocket',
        priority: 'high',
        message: 'High number of slow WebSocket operations',
        impact: 'Degraded real-time performance and user experience',
        action: 'Optimize WebSocket event handlers and message processing',
      });
    }

    if (metrics.websocket.connections > 500) {
      recommendations.push({
        category: 'websocket',
        priority: 'medium',
        message: 'High WebSocket connection count',
        impact: 'Increased server resource usage',
        action: 'Consider implementing connection pooling or load balancing',
      });
    }

    // Application recommendations
    const memoryUsagePercent = (metrics.application.memory.heapUsed / metrics.application.memory.heapTotal) * 100;
    if (memoryUsagePercent > 70) {
      recommendations.push({
        category: 'application',
        priority: 'high',
        message: 'High application memory usage',
        impact: 'Risk of out-of-memory errors and application crashes',
        action: 'Investigate memory leaks and optimize data structures',
      });
    }

    // Redis recommendations
    if (!metrics.redis.connected) {
      recommendations.push({
        category: 'redis',
        priority: 'critical',
        message: 'Redis connection failure',
        impact: 'Loss of caching and session management capabilities',
        action: 'Check Redis server status and network connectivity',
      });
    }

    return recommendations;
  }

  private async storeMetrics(metrics: SystemPerformanceMetrics): Promise<void> {
    try {
      // Store current metrics
      await redis.hset('performance:current', {
        timestamp: metrics.timestamp.toString(),
        'db.healthy': metrics.database.healthy.toString(),
        'db.connectionPoolUsage': metrics.database.connectionPoolUsage.toString(),
        'db.queryCount': metrics.database.queryCount.toString(),
        'db.slowQueries': metrics.database.slowQueries.toString(),
        'db.averageQueryTime': metrics.database.averageQueryTime.toString(),
        'db.cacheHitRate': metrics.database.cacheHitRate.toString(),
        'ws.healthy': metrics.websocket.healthy.toString(),
        'ws.connections': metrics.websocket.connections.toString(),
        'ws.messagesPerSecond': metrics.websocket.messagesPerSecond.toString(),
        'ws.averageResponseTime': metrics.websocket.averageResponseTime.toString(),
        'ws.memoryUsage': metrics.websocket.memoryUsage.toString(),
        'ws.errors': metrics.websocket.errors.toString(),
        'app.memoryUsed': metrics.application.memory.heapUsed.toString(),
        'app.memoryTotal': metrics.application.memory.heapTotal.toString(),
        'app.uptime': metrics.application.uptime.toString(),
        'redis.connected': metrics.redis.connected.toString(),
        'redis.memoryUsage': metrics.redis.memoryUsage.toString(),
      });

      // Store historical metrics (hourly)
      const hour = new Date().getHours();
      await redis.hset(`performance:hourly:${hour}`, {
        timestamp: metrics.timestamp.toString(),
        dbQueries: metrics.database.queryCount.toString(),
        wsConnections: metrics.websocket.connections.toString(),
        memoryUsage: Math.round((metrics.application.memory.heapUsed / metrics.application.memory.heapTotal) * 100).toString(),
      });

      // Store time series data for trending
      await redis.lpush('performance:timeseries', JSON.stringify({
        timestamp: metrics.timestamp,
        database: {
          queryTime: metrics.database.averageQueryTime,
          cacheHitRate: metrics.database.cacheHitRate,
          connectionPoolUsage: metrics.database.connectionPoolUsage,
        },
        websocket: {
          connections: metrics.websocket.connections,
          responseTime: metrics.websocket.averageResponseTime,
          memoryUsage: metrics.websocket.memoryUsage,
        },
        application: {
          memoryUsage: (metrics.application.memory.heapUsed / metrics.application.memory.heapTotal) * 100,
          uptime: metrics.application.uptime,
        },
      }));

      // Keep only last 1440 entries (48 hours with 2-minute intervals)
      await redis.ltrim('performance:timeseries', 0, 1439);

    } catch (error) {
      console.error('Error storing performance metrics:', error);
    }
  }

  private async storeRecommendations(recommendations: PerformanceRecommendation[]): Promise<void> {
    try {
      for (const recommendation of recommendations) {
        await redis.lpush('performance:recommendations', JSON.stringify({
          ...recommendation,
          timestamp: Date.now(),
        }));
      }

      // Keep only last 100 recommendations
      await redis.ltrim('performance:recommendations', 0, 99);
    } catch (error) {
      console.error('Error storing performance recommendations:', error);
    }
  }

  public async getPerformanceReport(): Promise<{
    current: SystemPerformanceMetrics | null;
    alerts: PerformanceAlert[];
    recommendations: PerformanceRecommendation[];
    trends: any[];
  }> {
    try {
      const [currentMetrics, alertsData, recommendationsData, trendsData] = await Promise.all([
        redis.hgetall('performance:current'),
        redis.lrange('performance:alerts', 0, 9), // Last 10 alerts
        redis.lrange('performance:recommendations', 0, 9), // Last 10 recommendations
        redis.lrange('performance:timeseries', 0, 47), // Last 48 entries
      ]);

      const current = currentMetrics && Object.keys(currentMetrics).length > 0 ? {
        timestamp: parseInt(String(currentMetrics.timestamp || '0')),
        database: {
          healthy: String(currentMetrics['db.healthy']) === 'true',
          connectionPoolUsage: parseInt(String(currentMetrics['db.connectionPoolUsage'] || '0')),
          queryCount: parseInt(String(currentMetrics['db.queryCount'] || '0')),
          slowQueries: parseInt(String(currentMetrics['db.slowQueries'] || '0')),
          averageQueryTime: parseInt(String(currentMetrics['db.averageQueryTime'] || '0')),
          cacheHitRate: parseInt(String(currentMetrics['db.cacheHitRate'] || '0')),
          totalSize: 0,
          indexSize: 0,
        },
        websocket: {
          healthy: String(currentMetrics['ws.healthy']) === 'true',
          connections: parseInt(String(currentMetrics['ws.connections'] || '0')),
          messagesPerSecond: parseInt(String(currentMetrics['ws.messagesPerSecond'] || '0')),
          averageResponseTime: parseInt(String(currentMetrics['ws.averageResponseTime'] || '0')),
          memoryUsage: parseInt(String(currentMetrics['ws.memoryUsage'] || '0')),
          errors: parseInt(String(currentMetrics['ws.errors'] || '0')),
          slowOperations: 0,
        },
        application: {
          memory: {
            heapUsed: parseInt(String(currentMetrics['app.memoryUsed'] || '0')),
            heapTotal: parseInt(String(currentMetrics['app.memoryTotal'] || '0')),
            external: 0,
            arrayBuffers: 0,
            rss: 0,
          },
          uptime: parseInt(String(currentMetrics['app.uptime'] || '0')),
          cpuUsage: 0,
          eventLoopDelay: 0,
        },
        redis: {
          connected: String(currentMetrics['redis.connected']) === 'true',
          memoryUsage: parseInt(String(currentMetrics['redis.memoryUsage'] || '0')),
          commandsPerSecond: 0,
          hitRate: 0,
        },
      } as SystemPerformanceMetrics : null;

      const alerts = alertsData.map(alert => JSON.parse(alert));
      const recommendations = recommendationsData.map(rec => JSON.parse(rec));
      const trends = trendsData.map(trend => JSON.parse(trend));

      return {
        current,
        alerts,
        recommendations,
        trends,
      };
    } catch (error) {
      console.error('Error getting performance report:', error);
      return {
        current: null,
        alerts: [],
        recommendations: [],
        trends: [],
      };
    }
  }

  public async shutdown(): Promise<void> {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    console.log('✅ Performance Monitor shutdown complete');
  }
}

// Export singleton instance
export const performanceMonitor = PerformanceMonitor.getInstance();
export default performanceMonitor; 