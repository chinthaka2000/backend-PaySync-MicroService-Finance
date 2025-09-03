/**
 * @fileoverview Redis Cache Service - Handles caching for frequently accessed data
 * @module services/cacheService
 */

const Redis = require('ioredis');
const { config } = require('../config/environment');
const { logger } = require('../utils/logger');

/**
 * Redis Cache Service Class
 * Provides caching functionality with automatic serialization/deserialization
 */
class CacheService {
  constructor() {
    this.redis = null;
    this.isConnected = false;
    this.defaultTTL = 300; // 5 minutes default TTL
    this.keyPrefix = 'paysync:';
  }

  /**
   * Initialize Redis connection
   * @async
   * @returns {Promise<void>}
   */
  async connect() {
    // Skip Redis connection if explicitly disabled
    if (process.env.ENABLE_REDIS === 'false' || (config.isDevelopment && process.env.ENABLE_REDIS !== 'true')) {
      logger.info('🔄 Redis disabled (set ENABLE_REDIS=true to enable)');
      this.isConnected = false;
      return;
    }

    try {
      const redisConfig = {
        host: config.redis?.host || 'localhost',
        port: config.redis?.port || 6379,
        password: config.redis?.password || undefined,
        db: config.redis?.db || 0,
        retryDelayOnFailover: 1000,
        maxRetriesPerRequest: 2,
        lazyConnect: true,
        keepAlive: 30000,
        connectTimeout: 5000,
        commandTimeout: 3000,
        family: 4, // IPv4
        // Limit reconnection attempts
        retryDelayOnClusterDown: 300,
        maxRetriesPerRequest: 2,
        enableReadyCheck: false,
        maxRetriesPerRequest: null, // Disable retries to prevent spam
      };

      // Add authentication if password is provided
      if (config.redis?.password) {
        redisConfig.password = config.redis.password;
      }

      this.redis = new Redis(redisConfig);

      // Set up event handlers
      this.redis.on('connect', () => {
        logger.info('✅ Redis connected successfully', {
          host: redisConfig.host,
          port: redisConfig.port,
          db: redisConfig.db
        });
        this.isConnected = true;
      });

      this.redis.on('error', (err) => {
        if (!this.errorLogged) {
          logger.error('❌ Redis connection error', {
            error: err.message
          });
          this.errorLogged = true;
        }
        this.isConnected = false;
      });

      this.redis.on('close', () => {
        if (this.isConnected) {
          logger.warn('⚠️ Redis connection closed');
        }
        this.isConnected = false;
      });

      this.redis.on('reconnecting', () => {
        if (!this.reconnectLogged) {
          logger.info('🔄 Redis reconnecting...');
          this.reconnectLogged = true;
        }
      });

      // Test connection
      await this.redis.ping();
      logger.info('🏓 Redis ping successful');

    } catch (error) {
      logger.warn('⚠️ Redis not available, continuing without cache', {
        error: error.message
      });
      // Don't throw error - allow app to continue without cache
      this.isConnected = false;
    }
  }

  /**
   * Generate cache key with prefix
   * @param {string} key - Base key
   * @returns {string} Prefixed key
   */
  getKey(key) {
    return `${this.keyPrefix}${key}`;
  }

  /**
   * Set cache value with TTL
   * @async
   * @param {string} key - Cache key
   * @param {*} value - Value to cache
   * @param {number} [ttl] - Time to live in seconds
   * @returns {Promise<boolean>} Success status
   */
  async set(key, value, ttl = this.defaultTTL) {
    if (!this.isConnected) {
      logger.warn('Redis not connected, skipping cache set', { key });
      return false;
    }

    try {
      const cacheKey = this.getKey(key);
      const serializedValue = JSON.stringify(value);

      if (ttl > 0) {
        await this.redis.setex(cacheKey, ttl, serializedValue);
      } else {
        await this.redis.set(cacheKey, serializedValue);
      }

      logger.debug('Cache set successful', { key: cacheKey, ttl });
      return true;
    } catch (error) {
      logger.error('Cache set failed', {
        key,
        error: error.message
      });
      return false;
    }
  }

  /**
   * Get cache value
   * @async
   * @param {string} key - Cache key
   * @returns {Promise<*|null>} Cached value or null
   */
  async get(key) {
    if (!this.isConnected) {
      logger.warn('Redis not connected, skipping cache get', { key });
      return null;
    }

    try {
      const cacheKey = this.getKey(key);
      const value = await this.redis.get(cacheKey);

      if (value === null) {
        logger.debug('Cache miss', { key: cacheKey });
        return null;
      }

      const parsedValue = JSON.parse(value);
      logger.debug('Cache hit', { key: cacheKey });
      return parsedValue;
    } catch (error) {
      logger.error('Cache get failed', {
        key,
        error: error.message
      });
      return null;
    }
  }

  /**
   * Delete cache key
   * @async
   * @param {string} key - Cache key
   * @returns {Promise<boolean>} Success status
   */
  async del(key) {
    if (!this.isConnected) {
      return false;
    }

    try {
      const cacheKey = this.getKey(key);
      const result = await this.redis.del(cacheKey);
      logger.debug('Cache delete', { key: cacheKey, deleted: result > 0 });
      return result > 0;
    } catch (error) {
      logger.error('Cache delete failed', {
        key,
        error: error.message
      });
      return false;
    }
  }

  /**
   * Delete multiple cache keys by pattern
   * @async
   * @param {string} pattern - Key pattern (e.g., 'user:*')
   * @returns {Promise<number>} Number of keys deleted
   */
  async delPattern(pattern) {
    if (!this.isConnected) {
      return 0;
    }

    try {
      const cachePattern = this.getKey(pattern);
      const keys = await this.redis.keys(cachePattern);

      if (keys.length === 0) {
        return 0;
      }

      const result = await this.redis.del(...keys);
      logger.debug('Cache pattern delete', { pattern: cachePattern, deleted: result });
      return result;
    } catch (error) {
      logger.error('Cache pattern delete failed', {
        pattern,
        error: error.message
      });
      return 0;
    }
  }

  /**
   * Check if key exists in cache
   * @async
   * @param {string} key - Cache key
   * @returns {Promise<boolean>} Existence status
   */
  async exists(key) {
    if (!this.isConnected) {
      return false;
    }

    try {
      const cacheKey = this.getKey(key);
      const result = await this.redis.exists(cacheKey);
      return result === 1;
    } catch (error) {
      logger.error('Cache exists check failed', {
        key,
        error: error.message
      });
      return false;
    }
  }

  /**
   * Get cache TTL
   * @async
   * @param {string} key - Cache key
   * @returns {Promise<number>} TTL in seconds (-1 if no expiry, -2 if key doesn't exist)
   */
  async ttl(key) {
    if (!this.isConnected) {
      return -2;
    }

    try {
      const cacheKey = this.getKey(key);
      return await this.redis.ttl(cacheKey);
    } catch (error) {
      logger.error('Cache TTL check failed', {
        key,
        error: error.message
      });
      return -2;
    }
  }

  /**
   * Increment cache value
   * @async
   * @param {string} key - Cache key
   * @param {number} [increment=1] - Increment value
   * @returns {Promise<number|null>} New value or null on error
   */
  async incr(key, increment = 1) {
    if (!this.isConnected) {
      return null;
    }

    try {
      const cacheKey = this.getKey(key);
      const result = await this.redis.incrby(cacheKey, increment);
      logger.debug('Cache increment', { key: cacheKey, increment, newValue: result });
      return result;
    } catch (error) {
      logger.error('Cache increment failed', {
        key,
        error: error.message
      });
      return null;
    }
  }

  /**
   * Set cache with expiry at specific time
   * @async
   * @param {string} key - Cache key
   * @param {*} value - Value to cache
   * @param {Date} expireAt - Expiration date
   * @returns {Promise<boolean>} Success status
   */
  async setExpireAt(key, value, expireAt) {
    if (!this.isConnected) {
      return false;
    }

    try {
      const cacheKey = this.getKey(key);
      const serializedValue = JSON.stringify(value);
      const expireTimestamp = Math.floor(expireAt.getTime() / 1000);

      await this.redis.set(cacheKey, serializedValue);
      await this.redis.expireat(cacheKey, expireTimestamp);

      logger.debug('Cache set with expiry', { key: cacheKey, expireAt });
      return true;
    } catch (error) {
      logger.error('Cache set with expiry failed', {
        key,
        error: error.message
      });
      return false;
    }
  }

  /**
   * Get cache statistics
   * @async
   * @returns {Promise<Object>} Cache statistics
   */
  async getStats() {
    if (!this.isConnected) {
      return {
        connected: false,
        keys: 0,
        memory: '0B',
        hits: 0,
        misses: 0
      };
    }

    try {
      const info = await this.redis.info('stats');
      const keyspace = await this.redis.info('keyspace');
      const memory = await this.redis.info('memory');

      // Parse stats from info strings
      const stats = {};
      info.split('\r\n').forEach(line => {
        const [key, value] = line.split(':');
        if (key && value) {
          stats[key] = value;
        }
      });

      return {
        connected: this.isConnected,
        keys: await this.redis.dbsize(),
        memory: stats.used_memory_human || '0B',
        hits: parseInt(stats.keyspace_hits || '0'),
        misses: parseInt(stats.keyspace_misses || '0'),
        hitRate: stats.keyspace_hits && stats.keyspace_misses
          ? ((parseInt(stats.keyspace_hits) / (parseInt(stats.keyspace_hits) + parseInt(stats.keyspace_misses))) * 100).toFixed(2) + '%'
          : '0%'
      };
    } catch (error) {
      logger.error('Failed to get cache stats', {
        error: error.message
      });
      return {
        connected: false,
        error: error.message
      };
    }
  }

  /**
   * Flush all cache data
   * @async
   * @returns {Promise<boolean>} Success status
   */
  async flush() {
    if (!this.isConnected) {
      return false;
    }

    try {
      await this.redis.flushdb();
      logger.info('Cache flushed successfully');
      return true;
    } catch (error) {
      logger.error('Cache flush failed', {
        error: error.message
      });
      return false;
    }
  }

  /**
   * Close Redis connection
   * @async
   * @returns {Promise<void>}
   */
  async disconnect() {
    if (this.redis) {
      try {
        await this.redis.quit();
        logger.info('Redis connection closed gracefully');
      } catch (error) {
        logger.error('Error closing Redis connection', {
          error: error.message
        });
      }
    }
  }
}

// Create singleton instance
const cacheService = new CacheService();

module.exports = cacheService;