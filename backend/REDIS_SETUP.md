# Redis Setup Guide for PaySync Backend

## Overview
Redis is used for caching in the PaySync backend to improve performance. It's **optional** in development mode but recommended for production.

## Current Status
- ✅ Redis is **disabled by default** in development
- ✅ Server runs perfectly without Redis
- ✅ All caching operations gracefully fallback when Redis is unavailable

## Quick Start (Development)

### Option 1: Run without Redis (Default)
The server works perfectly without Redis. No setup required!

```bash
npm run start
```

### Option 2: Enable Redis for Development

1. **Install Redis** (choose your method):

   **macOS (Homebrew):**
   ```bash
   brew install redis
   brew services start redis
   ```

   **Ubuntu/Debian:**
   ```bash
   sudo apt update
   sudo apt install redis-server
   sudo systemctl start redis-server
   ```

   **Windows:**
   - Download from: https://redis.io/download
   - Or use Docker: `docker run -d -p 6379:6379 redis:alpine`

2. **Enable Redis in PaySync:**
   ```bash
   # In your .env file, change:
   ENABLE_REDIS=true
   ```

3. **Restart the server:**
   ```bash
   npm run start
   ```

## Production Setup

For production, Redis is highly recommended for optimal performance:

1. **Set up Redis server** (cloud or dedicated instance)
2. **Configure environment variables:**
   ```env
   ENABLE_REDIS=true
   REDIS_HOST=your-redis-host
   REDIS_PORT=6379
   REDIS_PASSWORD=your-redis-password
   # OR use Redis URL
   REDIS_URL=redis://username:password@host:port
   ```

## Verification

### Check if Redis is Working
```bash
# Test server startup
node test-server-startup.js

# Check logs for:
# ✅ "Redis connected successfully" (if enabled)
# 🔄 "Redis disabled" (if disabled)
```

### Performance Benefits with Redis
When Redis is enabled, you'll get:
- ⚡ Faster loan data retrieval
- 📊 Cached statistics and reports  
- 🚀 Improved API response times
- 📈 Better performance monitoring

## Troubleshooting

### Redis Connection Issues
If you see Redis connection errors:

1. **Check if Redis is running:**
   ```bash
   redis-cli ping
   # Should return: PONG
   ```

2. **Disable Redis temporarily:**
   ```env
   ENABLE_REDIS=false
   ```

3. **Check Redis configuration:**
   - Verify host, port, and password
   - Ensure Redis server is accessible
   - Check firewall settings

### Common Redis Commands
```bash
# Check Redis status
redis-cli ping

# Monitor Redis activity
redis-cli monitor

# Check Redis info
redis-cli info

# Clear all cache (if needed)
redis-cli flushall
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `ENABLE_REDIS` | `false` | Enable/disable Redis connection |
| `REDIS_HOST` | `localhost` | Redis server hostname |
| `REDIS_PORT` | `6379` | Redis server port |
| `REDIS_PASSWORD` | - | Redis password (if required) |
| `REDIS_DB` | `0` | Redis database number |
| `REDIS_URL` | - | Complete Redis connection URL |

## Cache Features

When Redis is enabled, the following features are cached:

- 🏦 Loan statistics and summaries
- 👥 Agent performance metrics
- 🌍 Regional distribution data
- 📊 Monthly trends and analytics
- 🔍 Search results (short-term)
- 📈 Portfolio summaries

Cache TTL (Time To Live):
- Search results: 1 minute
- Loan stats: 5 minutes  
- Performance metrics: 10 minutes
- Regional data: 15 minutes
- Portfolio summary: 30 minutes

---

**Note:** The PaySync backend is designed to work seamlessly with or without Redis. Choose the setup that best fits your development and deployment needs!