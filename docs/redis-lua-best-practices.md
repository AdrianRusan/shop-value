# Redis Lua Scripts - Best Practices and Common Issues

## ❌ The `collectgarbage()` Issue

### Problem
The `collectgarbage()` function is a standard Lua function used for garbage collection, but it is **NOT supported** in the Redis Lua environment. Attempting to use it will result in a script execution error.

### Why It's Not Supported
Redis Lua scripts run in a sandboxed environment for security reasons. Many standard Lua functions are disabled, including:
- `collectgarbage()` - Memory management
- `loadfile()`, `dofile()` - File operations
- `io.*` - Input/output operations
- `os.*` - Operating system access
- `debug.*` - Debug functions
- `package.*`, `require()`, `module()` - Module system

### Common Error Messages
```
ERR Error running script: [string "..."]:X: attempt to call global 'collectgarbage' (a nil value)
```

## ✅ Solutions and Alternatives

### 1. Use Batching Instead of collectgarbage()
The main purpose of `collectgarbage()` in Redis Lua scripts is usually to manage memory when processing large datasets. Instead, use batching:

```lua
-- ❌ BAD: Using collectgarbage()
local keys = redis.call('keys', 'session:*')
for i=1,#keys do
  -- Process key
  if i % 1000 == 0 then
    collectgarbage() -- This will fail!
  end
end

-- ✅ GOOD: Using batching
local keys = redis.call('keys', 'session:*')
local batch_size = 100
local processed = 0

for i=1,math.min(#keys, batch_size) do
  -- Process key
  processed = processed + 1
end

return processed
```

### 2. Use Our Safe Redis Lua Helpers
We've created a utility library (`lib/redis-lua-helpers.ts`) that provides safe, pre-tested Redis Lua scripts:

```typescript
import { 
  cleanupExpiredSessions, 
  cleanupOldLogs,
  executeRedisScript,
  validateRedisLuaScript 
} from '@/lib/redis-lua-helpers';

// Safe session cleanup
const expiredCount = await cleanupExpiredSessions('session:*', 86400, 100);

// Safe log cleanup  
const deletedLogs = await cleanupOldLogs('log:*', 86400, 100);
```

### 3. Validate Scripts Before Execution
Always validate your Redis Lua scripts:

```typescript
import { validateRedisLuaScript } from '@/lib/redis-lua-helpers';

const script = `
  local keys = redis.call('keys', ARGV[1])
  -- Your script logic here
`;

const validation = validateRedisLuaScript(script);
if (!validation.isValid) {
  console.error('Script validation failed:', validation.errors);
  return;
}
```

## 📝 Best Practices for Redis Lua Scripts

### 1. Keep Scripts Short and Focused
- Limit processing to essential operations
- Use batching for large datasets
- Avoid complex business logic in Lua scripts

### 2. Use Proper Error Handling
```lua
-- ✅ GOOD: Use pcall for error handling
local ok, result = pcall(function()
  return redis.call('get', 'some-key')
end)

if not ok then
  return redis.error_reply('Failed to get key: ' .. result)
end
```

### 3. Parameterize Scripts with ARGV
```lua
-- ✅ GOOD: Use ARGV for parameters
local pattern = ARGV[1]
local batch_size = tonumber(ARGV[2]) or 100
local keys = redis.call('keys', pattern)
```

### 4. Implement Batching for Large Operations
```lua
-- ✅ GOOD: Process in batches
local keys = redis.call('keys', ARGV[1])
local batch_size = tonumber(ARGV[2]) or 100
local processed = 0

for i=1,math.min(#keys, batch_size) do
  -- Process each key
  processed = processed + 1
end

return processed
```

### 5. Use Atomic Operations
```lua
-- ✅ GOOD: Atomic operations
local current = redis.call('get', 'counter')
if current then
  redis.call('incr', 'counter')
  return tonumber(current) + 1
else
  redis.call('set', 'counter', 1)
  return 1
end
```

## 🚫 Functions to Avoid in Redis Lua

| Function | Alternative |
|----------|-------------|
| `collectgarbage()` | Use batching with limited iterations |
| `loadfile()`, `dofile()` | Embed logic directly in script |
| `io.*` | Use Redis commands for persistence |
| `os.*` | Use Redis `TIME` command for timestamps |
| `debug.*` | Use proper logging and error handling |
| `package.*`, `require()` | Keep scripts self-contained |

## 🔧 Migration Guide

### If You Have Existing Scripts with collectgarbage()

1. **Identify the problem:**
   ```bash
   # Search for problematic scripts
   grep -r "collectgarbage" . --include="*.ts" --include="*.js"
   ```

2. **Replace with batching:**
   ```lua
   -- Old problematic code
   local keys = redis.call('keys', 'session:*')
   for i=1,#keys do
     -- process key
     if i % 1000 == 0 then
       collectgarbage() -- Remove this!
     end
   end
   
   -- New safe code
   local keys = redis.call('keys', 'session:*')
   local batch_size = 100
   
   for i=1,math.min(#keys, batch_size) do
     -- process key
   end
   ```

3. **Use our helpers:**
   ```typescript
   // Replace direct redis.eval calls
   const result = await cleanupExpiredSessions('session:*', 86400, 100);
   ```

## 📊 Performance Considerations

### Memory Management
- Redis Lua scripts have memory limits
- Use batching to process large datasets
- Consider multiple script executions for very large operations

### Script Caching
- Redis caches compiled scripts
- Use `EVALSHA` for frequently executed scripts
- Our helpers handle caching automatically

### Monitoring
- Monitor script execution times
- Set reasonable timeouts
- Log script performance metrics

## 🔍 Testing Your Scripts

### Unit Testing
```typescript
// Test script validation
describe('Redis Lua Scripts', () => {
  it('should validate safe scripts', () => {
    const script = `return redis.call('get', 'test')`;
    const validation = validateRedisLuaScript(script);
    expect(validation.isValid).toBe(true);
  });
  
  it('should reject unsafe scripts', () => {
    const script = `collectgarbage()`;
    const validation = validateRedisLuaScript(script);
    expect(validation.isValid).toBe(false);
  });
});
```

### Integration Testing
```typescript
// Test actual Redis operations
describe('Redis Cleanup', () => {
  it('should cleanup expired sessions', async () => {
    const result = await cleanupExpiredSessions('test:session:*', 86400, 10);
    expect(typeof result).toBe('number');
  });
});
```

## 🆘 Troubleshooting

### Common Issues and Solutions

1. **Script fails with "nil value" error**
   - Check if you're using unsupported functions
   - Validate script before execution

2. **Performance issues**
   - Implement batching
   - Reduce batch size
   - Monitor script execution time

3. **Memory issues**
   - Use smaller batch sizes
   - Split large operations into multiple scripts
   - Avoid storing large amounts of data in script variables

### Getting Help
- Check our Redis Lua helpers documentation
- Review script validation errors
- Monitor Redis logs for detailed error messages
- Test scripts in a development environment first

## 📚 Additional Resources

- [Redis Lua Scripting Documentation](https://redis.io/docs/interact/programmability/lua-api/)
- [Redis Lua Security](https://redis.io/docs/interact/programmability/eval-intro/#lua-scripting-security)
- [Our Redis Lua Helpers](/lib/redis-lua-helpers.ts)

---

**Remember:** When in doubt, use our pre-built safe helpers rather than writing custom Lua scripts. They're tested, optimized, and handle common edge cases.