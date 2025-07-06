/**
 * Tests for Redis Lua Helpers
 * Ensures safe Redis Lua script execution and prevents collectgarbage issues
 */

import { validateRedisLuaScript, RedisLuaDocumentation } from '../lib/redis-lua-helpers';

describe('Redis Lua Helpers', () => {
  describe('validateRedisLuaScript', () => {
    it('should validate safe Redis Lua scripts', () => {
      const safeScript = `
        local keys = redis.call('keys', ARGV[1])
        local deleted = 0
        
        for i=1,math.min(#keys, 100) do
          redis.call('del', keys[i])
          deleted = deleted + 1
        end
        
        return deleted
      `;
      
      const validation = validateRedisLuaScript(safeScript);
      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should reject scripts with collectgarbage()', () => {
      const unsafeScript = `
        local keys = redis.call('keys', 'session:*')
        for i=1,#keys do
          if i % 1000 == 0 then
            collectgarbage()
          end
        end
      `;
      
      const validation = validateRedisLuaScript(unsafeScript);
      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain(
        "Unsupported function 'collectgarbage' detected. Redis Lua sandbox doesn't support this function."
      );
    });

    it('should reject scripts with other unsupported functions', () => {
      const testCases = [
        { script: 'loadfile("test.lua")', func: 'loadfile' },
        { script: 'dofile("test.lua")', func: 'dofile' },
        { script: 'io.open("file")', func: 'io.' },
        { script: 'os.time()', func: 'os.' },
        { script: 'debug.traceback()', func: 'debug.' },
        { script: 'require("module")', func: 'require' },
      ];

      testCases.forEach(({ script, func }) => {
        const validation = validateRedisLuaScript(script);
        expect(validation.isValid).toBe(false);
        expect(validation.errors.some(error => error.includes(func))).toBe(true);
      });
    });

    it('should detect potential infinite loops', () => {
      const infiniteLoopScript = `
        while true do
          redis.call('get', 'key')
        end
      `;
      
      const validation = validateRedisLuaScript(infiniteLoopScript);
      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain(
        'Potential infinite loop detected. Ensure loops have proper exit conditions.'
      );
    });

    it('should suggest pcall for error handling', () => {
      const errorScript = `
        if not redis.call('exists', 'key') then
          error('Key does not exist')
        end
      `;
      
      const validation = validateRedisLuaScript(errorScript);
      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain(
        'Consider using pcall() for error handling in Redis Lua scripts.'
      );
    });
  });

  describe('RedisLuaDocumentation', () => {
    it('should provide comprehensive documentation', () => {
      expect(RedisLuaDocumentation.unsupportedFunctions).toBeDefined();
      expect(RedisLuaDocumentation.alternatives).toBeDefined();
      expect(RedisLuaDocumentation.bestPractices).toBeDefined();
      
      expect(RedisLuaDocumentation.unsupportedFunctions).toContain(
        'collectgarbage() - Use batching instead to manage memory'
      );
      
      expect(RedisLuaDocumentation.alternatives.collectgarbage).toBe(
        'Use batching with limited key processing per script execution'
      );
      
      expect(RedisLuaDocumentation.bestPractices).toContain(
        'Use batching for large data operations'
      );
    });
  });
});

describe('Redis Lua Script Examples', () => {
  it('should demonstrate safe batching pattern', () => {
    const safeBatchingScript = `
      local keys = redis.call('keys', ARGV[1])
      local batch_size = tonumber(ARGV[2]) or 100
      local processed = 0
      
      for i=1,math.min(#keys, batch_size) do
        redis.call('del', keys[i])
        processed = processed + 1
      end
      
      return processed
    `;
    
    const validation = validateRedisLuaScript(safeBatchingScript);
    expect(validation.isValid).toBe(true);
  });

  it('should demonstrate safe error handling with pcall', () => {
    const safeErrorHandlingScript = `
      local ok, result = pcall(function()
        return redis.call('get', ARGV[1])
      end)
      
      if not ok then
        return redis.error_reply('Failed to get key: ' .. result)
      end
      
      return result
    `;
    
    const validation = validateRedisLuaScript(safeErrorHandlingScript);
    expect(validation.isValid).toBe(true);
  });
});

describe('Migration from collectgarbage', () => {
  it('should show how to migrate from collectgarbage to batching', () => {
    // Old problematic pattern
    const oldPattern = `
      local keys = redis.call('keys', 'session:*')
      for i=1,#keys do
        redis.call('del', keys[i])
        if i % 1000 == 0 then
          collectgarbage()
        end
      end
    `;
    
    // New safe pattern
    const newPattern = `
      local keys = redis.call('keys', ARGV[1])
      local batch_size = tonumber(ARGV[2]) or 100
      local processed = 0
      
      for i=1,math.min(#keys, batch_size) do
        redis.call('del', keys[i])
        processed = processed + 1
      end
      
      return processed
    `;
    
    const oldValidation = validateRedisLuaScript(oldPattern);
    const newValidation = validateRedisLuaScript(newPattern);
    
    expect(oldValidation.isValid).toBe(false);
    expect(oldValidation.errors.some(error => error.includes('collectgarbage'))).toBe(true);
    
    expect(newValidation.isValid).toBe(true);
    expect(newValidation.errors).toHaveLength(0);
  });
});