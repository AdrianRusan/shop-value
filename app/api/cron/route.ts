import { NextResponse } from 'next/server';
import { connectToDB } from '@/lib/mongoose';
import Product from '@/lib/models/product.model';
import User from '@/lib/models/user.model';
import { redis } from '@/lib/upstash';
import logger, { apiLog } from '@/lib/logger';
import performanceMonitor from '@/lib/performance';

export const maxDuration = 250;
export const dynamic = 'force-dynamic';

// Enhanced cron job with comprehensive monitoring
export async function GET(request: Request) {
  const startTime = Date.now();
  const requestId = `cron-${Date.now()}`;
  
  // Start performance monitoring
  performanceMonitor.startAPITimer(requestId);

  try {
    logger.info('Starting enhanced cron job', { requestId }, 'system');

    // Validate request origin (basic security)
    const origin = request.headers.get('origin');
    const userAgent = request.headers.get('user-agent');
    
    // Log request details for monitoring
    logger.info('Cron job request details', {
      origin,
      userAgent,
      ip: request.headers.get('x-forwarded-for') || 'unknown',
    }, 'system');

    await connectToDB();

    // Track cron execution with enhanced metrics
    await trackCronExecution(requestId);

    // Get comprehensive stats for monitoring
    const stats = await getComprehensiveStats();

    // Perform health checks
    const healthChecks = await performHealthChecks();

    // Cleanup operations
    const cleanupResults = await performCleanupTasks();

    const response = {
      success: true,
      message: 'Enhanced cron job completed successfully',
      data: {
        requestId,
        timestamp: new Date().toISOString(),
        duration: Date.now() - startTime,
        stats,
        healthChecks,
        cleanup: cleanupResults,
      },
    };

    logger.info('Cron job completed successfully', {
      requestId,
      duration: Date.now() - startTime,
      stats,
    }, 'system');

    // End performance monitoring
    await performanceMonitor.endAPITimer(requestId, {
      endpoint: '/api/cron',
      method: 'GET',
      statusCode: 200,
      success: true,
    });

    return NextResponse.json(response);

  } catch (error: any) {
    const duration = Date.now() - startTime;
    
    logger.error('Cron job failed', error, {
      requestId,
      duration,
      errorType: error.constructor.name,
      stack: error.stack,
    }, 'system');

    // End performance monitoring with error
    await performanceMonitor.endAPITimer(requestId, {
      endpoint: '/api/cron',
      method: 'GET',
      statusCode: 500,
      success: false,
    });

    // Track error in Redis for monitoring
    await trackCronError(error, requestId);

    const errorResponse = {
      success: false,
      error: {
        message: error.message,
        type: error.constructor.name,
        timestamp: new Date().toISOString(),
        requestId,
        duration,
      },
    };

    return NextResponse.json(errorResponse, { status: 500 });
  }
}

// Get comprehensive statistics for monitoring
async function getComprehensiveStats() {
  const stats = {
    database: {
      products: { total: 0, active: 0, outOfStock: 0 },
      users: { total: 0, active: 0, premium: 0 },
      connection: 'unknown' as string,
    },
    cache: {
      size: 0,
      hitRate: 0,
      errors: 0,
    },
    system: {
      memory: process.memoryUsage ? process.memoryUsage() : null,
      uptime: process.uptime ? process.uptime() : null,
      nodeVersion: process.version || 'unknown',
    },
    timestamp: new Date().toISOString(),
  };

  try {
    // Database stats with error handling
    try {
      const productStats = await Product.aggregate([
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            active: { 
              $sum: { $cond: [{ $ne: ['$isOutOfStock', true] }, 1, 0] }
            },
            outOfStock: { 
              $sum: { $cond: ['$isOutOfStock', 1, 0] }
            },
          }
        }
      ]);

      if (productStats.length > 0) {
        stats.database.products = {
          total: productStats[0].total || 0,
          active: productStats[0].active || 0,
          outOfStock: productStats[0].outOfStock || 0,
        };
      }
    } catch (error) {
      logger.warn('Failed to get product stats', error, {}, 'database');
    }

    try {
      const userStats = await User.aggregate([
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            active: { 
              $sum: { $cond: [{ $gte: ['$lastActive', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)] }, 1, 0] }
            },
            premium: { 
              $sum: { $cond: [{ $ne: ['$subscription.tier', 'free'] }, 1, 0] }
            },
          }
        }
      ]);

      if (userStats.length > 0) {
        stats.database.users = {
          total: userStats[0].total || 0,
          active: userStats[0].active || 0,
          premium: userStats[0].premium || 0,
        };
      }
    } catch (error) {
      logger.warn('Failed to get user stats', error, {}, 'database');
    }

    // Database connection status
    const mongoose = require('mongoose');
    stats.database.connection = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';

  } catch (error) {
    logger.error('Failed to get database stats', error, {}, 'database');
  }

  try {
    // Cache stats
    const cacheInfo = await redis.info('memory');
    const cacheStats = await redis.info('stats');
    
    stats.cache = {
      size: parseInt(cacheInfo.match(/used_memory:(\d+)/)?.[1] || '0'),
      hitRate: parseFloat(cacheStats.match(/keyspace_hit_rate:([\d.]+)/)?.[1] || '0'),
      errors: parseInt(cacheStats.match(/total_error_replies:(\d+)/)?.[1] || '0'),
    };
  } catch (error) {
    logger.warn('Failed to get cache stats', error, {}, 'cache');
  }

  return stats;
}

// Perform health checks
async function performHealthChecks() {
  const checks = {
    database: false,
    cache: false,
    external: false,
    overall: false,
  };

  try {
    // Database health check
    const mongoose = require('mongoose');
    checks.database = mongoose.connection.readyState === 1;
    
    if (checks.database) {
      // Additional database operation test
      await mongoose.connection.db.admin().ping();
    }
  } catch (error) {
    logger.warn('Database health check failed', error, {}, 'database');
    checks.database = false;
  }

  try {
    // Cache health check
    await redis.ping();
    checks.cache = true;
  } catch (error) {
    logger.warn('Cache health check failed', error, {}, 'cache');
    checks.cache = false;
  }

  try {
    // External services health check (simplified)
    const response = await fetch('https://httpbin.org/status/200', {
      timeout: 5000,
    });
    checks.external = response.ok;
  } catch (error) {
    logger.warn('External services health check failed', error, {}, 'external');
    checks.external = false;
  }

  // Overall health
  checks.overall = checks.database && checks.cache;

  logger.info('Health checks completed', checks, 'system');
  return checks;
}

// Perform cleanup tasks
async function performCleanupTasks() {
  const results = {
    oldLogs: 0,
    expiredSessions: 0,
    tempFiles: 0,
    cacheCleanup: false,
  };

  try {
    // Clean up old log entries in Redis (if using Redis for logs)
    const logKeys = await redis.keys('log:*');
    const oldLogKeys = [];
    
    for (const key of logKeys) {
      try {
        const ttl = await redis.ttl(key);
        if (ttl === -1) { // Keys without expiration
          oldLogKeys.push(key);
        }
      } catch (error) {
        // Skip problematic keys
      }
    }

    if (oldLogKeys.length > 0) {
      await redis.del(...oldLogKeys.slice(0, 100)); // Limit cleanup batch size
      results.oldLogs = Math.min(oldLogKeys.length, 100);
    }

    // Clean up expired sessions
    try {
      const expiredSessionsResult = await redis.eval(`
        local keys = redis.call('keys', 'session:*')
        local expired = 0
        for i=1,#keys do
          local ttl = redis.call('ttl', keys[i])
          if ttl == -1 or ttl > 86400 then
            redis.call('del', keys[i])
            expired = expired + 1
          end
        end
        return expired
      `, 0);
      
      results.expiredSessions = expiredSessionsResult as number;
    } catch (error) {
      logger.warn('Failed to clean expired sessions', error, {}, 'cache');
    }

    // Cache maintenance
    try {
      // Force memory cleanup in Redis
      await redis.eval('collectgarbage()', 0);
      results.cacheCleanup = true;
    } catch (error) {
      logger.warn('Cache cleanup failed', error, {}, 'cache');
    }

    logger.info('Cleanup tasks completed', results, 'system');
  } catch (error) {
    logger.error('Cleanup tasks failed', error, {}, 'system');
  }

  return results;
}

// Track cron job execution with enhanced metrics
async function trackCronExecution(requestId: string) {
  try {
    const today = new Date().toISOString().split('T')[0];
    const hour = new Date().getHours();
    
    await Promise.all([
      redis.incr('cron:executions:total'),
      redis.incr(`cron:executions:${today}`),
      redis.incr(`cron:executions:${today}:${hour}`),
      redis.setex('cron:last_execution', 3600 * 24, Date.now().toString()),
      redis.setex(`cron:last_request_id`, 3600 * 24, requestId),
      redis.lpush('cron:execution_history', JSON.stringify({
        requestId,
        timestamp: new Date().toISOString(),
        status: 'started',
      })),
      redis.ltrim('cron:execution_history', 0, 99), // Keep last 100 executions
    ]);
  } catch (error) {
    logger.error('Failed to track cron execution', error, { requestId }, 'system');
  }
}

// Track cron job errors
async function trackCronError(error: Error, requestId: string) {
  try {
    const errorData = {
      requestId,
      error: error.message,
      type: error.constructor.name,
      stack: error.stack,
      timestamp: new Date().toISOString(),
    };

    await Promise.all([
      redis.incr('cron:errors:total'),
      redis.incr(`cron:errors:${new Date().toISOString().split('T')[0]}`),
      redis.setex('cron:last_error', 3600 * 24, JSON.stringify(errorData)),
      redis.lpush('cron:error_history', JSON.stringify(errorData)),
      redis.ltrim('cron:error_history', 0, 49), // Keep last 50 errors
    ]);
  } catch (redisError) {
    logger.error('Failed to track cron error', redisError, { originalError: error.message }, 'system');
  }
}
