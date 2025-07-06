/**
 * Redis Lua Script Helpers
 * Provides safe utilities for Redis Lua scripts and prevents common issues
 */

import { redis } from './upstash';

/**
 * Common Redis Lua script patterns that are safe to use
 */
export const RedisLuaScripts = {
  /**
   * Clean up expired sessions safely
   * Alternative to using collectgarbage() which is not supported in Redis Lua
   */
  cleanupExpiredSessions: `
    local keys = redis.call('keys', ARGV[1])
    local expired = 0
    local batch_size = tonumber(ARGV[2]) or 100
    
    for i=1,math.min(#keys, batch_size) do
      local ttl = redis.call('ttl', keys[i])
      if ttl == -1 or ttl > tonumber(ARGV[3]) then
        redis.call('del', keys[i])
        expired = expired + 1
      end
    end
    
    return expired
  `,

  /**
   * Clean up old log entries safely
   * Uses batching to prevent memory issues instead of collectgarbage()
   */
  cleanupOldLogs: `
    local keys = redis.call('keys', ARGV[1])
    local deleted = 0
    local batch_size = tonumber(ARGV[2]) or 100
    local max_age = tonumber(ARGV[3]) or 86400
    
    for i=1,math.min(#keys, batch_size) do
      local ttl = redis.call('ttl', keys[i])
      if ttl == -1 then
        redis.call('del', keys[i])
        deleted = deleted + 1
      end
    end
    
    return deleted
  `,

  /**
   * Bulk cleanup with memory-safe batching
   * Prevents memory issues that collectgarbage() was trying to solve
   */
  bulkCleanupWithBatching: `
    local pattern = ARGV[1]
    local batch_size = tonumber(ARGV[2]) or 100
    local max_ttl = tonumber(ARGV[3]) or 86400
    
    local keys = redis.call('keys', pattern)
    local deleted = 0
    local processed = 0
    
    for i=1,math.min(#keys, batch_size) do
      local key = keys[i]
      local ttl = redis.call('ttl', key)
      
      if ttl == -1 or ttl > max_ttl then
        redis.call('del', key)
        deleted = deleted + 1
      end
      
      processed = processed + 1
    end
    
    return {deleted, processed, #keys}
  `,
};

/**
 * Execute Redis Lua script safely with error handling
 */
export async function executeRedisScript(
  script: string,
  keys: string[] = [],
  args: string[] = []
): Promise<any> {
  try {
    // Validate script doesn't contain unsupported functions
    const unsupportedFunctions = ['collectgarbage', 'loadfile', 'dofile', 'io.', 'os.'];
    
    for (const func of unsupportedFunctions) {
      if (script.includes(func)) {
        throw new Error(`Unsupported function '${func}' detected in Redis Lua script. 
          Redis Lua sandbox doesn't support this function for security reasons.`);
      }
    }

    return await redis.eval(script, keys.length, ...keys, ...args);
  } catch (error) {
    console.error('Redis Lua script execution failed:', error);
    throw error;
  }
}

/**
 * Safe session cleanup function
 * Replaces any script that might have used collectgarbage()
 */
export async function cleanupExpiredSessions(
  pattern: string = 'session:*',
  maxAge: number = 86400,
  batchSize: number = 100
): Promise<number> {
  try {
    const result = await executeRedisScript(
      RedisLuaScripts.cleanupExpiredSessions,
      [],
      [pattern, batchSize.toString(), maxAge.toString()]
    );
    
    return typeof result === 'number' ? result : 0;
  } catch (error) {
    console.error('Failed to cleanup expired sessions:', error);
    return 0;
  }
}

/**
 * Safe log cleanup function
 * Replaces any script that might have used collectgarbage()
 */
export async function cleanupOldLogs(
  pattern: string = 'log:*',
  maxAge: number = 86400,
  batchSize: number = 100
): Promise<number> {
  try {
    const result = await executeRedisScript(
      RedisLuaScripts.cleanupOldLogs,
      [],
      [pattern, batchSize.toString(), maxAge.toString()]
    );
    
    return typeof result === 'number' ? result : 0;
  } catch (error) {
    console.error('Failed to cleanup old logs:', error);
    return 0;
  }
}

/**
 * Memory-safe bulk cleanup
 * Alternative to scripts that use collectgarbage()
 */
export async function bulkCleanupWithBatching(
  pattern: string,
  maxAge: number = 86400,
  batchSize: number = 100
): Promise<{ deleted: number; processed: number; total: number }> {
  try {
    const result = await executeRedisScript(
      RedisLuaScripts.bulkCleanupWithBatching,
      [],
      [pattern, batchSize.toString(), maxAge.toString()]
    );
    
    if (Array.isArray(result) && result.length === 3) {
      return {
        deleted: result[0] || 0,
        processed: result[1] || 0,
        total: result[2] || 0,
      };
    }
    
    return { deleted: 0, processed: 0, total: 0 };
  } catch (error) {
    console.error('Failed to perform bulk cleanup:', error);
    return { deleted: 0, processed: 0, total: 0 };
  }
}

/**
 * Validate Redis Lua script before execution
 */
export function validateRedisLuaScript(script: string): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  // Check for unsupported functions
  const unsupportedFunctions = [
    'collectgarbage',
    'loadfile',
    'dofile',
    'io.',
    'os.',
    'debug.',
    'package.',
    'require',
    'module',
  ];
  
  for (const func of unsupportedFunctions) {
    if (script.includes(func)) {
      errors.push(`Unsupported function '${func}' detected. Redis Lua sandbox doesn't support this function.`);
    }
  }
  
  // Check for potential infinite loops
  if (script.includes('while true') || script.includes('repeat') && !script.includes('until')) {
    errors.push('Potential infinite loop detected. Ensure loops have proper exit conditions.');
  }
  
  // Check for proper error handling
  if (script.includes('error(') && !script.includes('pcall(')) {
    errors.push('Consider using pcall() for error handling in Redis Lua scripts.');
  }
  
  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Documentation for developers
 */
export const RedisLuaDocumentation = {
  unsupportedFunctions: [
    'collectgarbage() - Use batching instead to manage memory',
    'loadfile() - Security restriction',
    'dofile() - Security restriction', 
    'io.* - File I/O not allowed',
    'os.* - OS access not allowed',
    'debug.* - Debug functions not allowed',
    'package.* - Package management not allowed',
    'require() - Module loading not allowed',
    'module() - Module creation not allowed',
  ],
  
  alternatives: {
    collectgarbage: 'Use batching with limited key processing per script execution',
    fileOperations: 'Use Redis commands for data persistence',
    osOperations: 'Use Redis TIME command for timestamps',
    errorHandling: 'Use pcall() for protected function calls',
  },
  
  bestPractices: [
    'Keep scripts short and focused',
    'Use batching for large data operations',
    'Implement proper error handling with pcall()',
    'Avoid infinite loops',
    'Use ARGV for parameters to make scripts reusable',
    'Test scripts thoroughly before deployment',
  ],
};

export default {
  RedisLuaScripts,
  executeRedisScript,
  cleanupExpiredSessions,
  cleanupOldLogs,
  bulkCleanupWithBatching,
  validateRedisLuaScript,
  RedisLuaDocumentation,
};