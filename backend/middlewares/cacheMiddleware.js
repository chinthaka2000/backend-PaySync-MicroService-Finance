/**
 * @fileoverview Cache Middleware - Provides automatic caching for API responses
 * @module middlewares/cacheMiddleware
 */

const cacheService = require('../services/cacheService');
const { logger } = require('../utils/logger');

/**
 * Cache middleware factory
 * Creates middleware for caching API responses
 * @param {Object} options - Cache options
 * @param {number} [options.ttl=300] - Time to live in seconds
 * @param {Function} [options.keyGenerator] - Custom key generator function
 * @param {Function} [options.condition] - Condition function to determine if response should be cached
 * @param {Array<string>} [options.varyBy] - Headers to vary cache by
 * @param {boolean} [options.skipOnError=true] - Skip caching on error responses
 * @returns {Function} Express middleware function
 */
const cacheMiddleware = (options = {}) => {
  const {
    ttl = 300, // 5 minutes default
    keyGenerator = defaultKeyGenerator,
    condition = defaultCondition,
    varyBy = [],
    skipOnError = true
  } = options;

  return async (req, res, next) => {
    // Skip caching for non-GET requests by default
    if (req.method !== 'GET') {
      return next();
    }

    try {
      // Generate cache key
      const cacheKey = keyGenerator(req, varyBy);

      // Try to get cached response
      const cachedResponse = await cacheService.get(cacheKey);

      if (cachedResponse) {
        logger.debug('Cache hit for request', {
          method: req.method,
          url: req.originalUrl,
          cacheKey,
          userId: req.user?.userId
        });

        // Set cache headers
        res.set('X-Cache', 'HIT');
        res.set('X-Cache-Key', cacheKey);

        return res.status(cachedResponse.statusCode).json(cachedResponse.data);
      }

      // Cache miss - continue to route handler
      logger.debug('Cache miss for request', {
        method: req.method,
        url: req.originalUrl,
        cacheKey,
        userId: req.user?.userId
      });

      // Override res.json to cache the response
      const originalJson = res.json;
      res.json = function (data) {
        // Check if response should be cached
        if (condition(req, res, data)) {
          // Only cache successful responses unless configured otherwise
          if (!skipOnError || (res.statusCode >= 200 && res.statusCode < 300)) {
            const responseToCache = {
              statusCode: res.statusCode,
              data: data,
              timestamp: new Date().toISOString()
            };

            // Cache the response asynchronously
            cacheService.set(cacheKey, responseToCache, ttl)
              .then(() => {
                logger.debug('Response cached successfully', {
                  cacheKey,
                  statusCode: res.statusCode,
                  ttl
                });
              })
              .catch(error => {
                logger.error('Failed to cache response', {
                  cacheKey,
                  error: error.message
                });
              });
          }
        }

        // Set cache headers
        res.set('X-Cache', 'MISS');
        res.set('X-Cache-Key', cacheKey);

        // Call original json method
        return originalJson.call(this, data);
      };

      next();
    } catch (error) {
      logger.error('Cache middleware error', {
        error: error.message,
        url: req.originalUrl,
        method: req.method
      });
      // Continue without caching on error
      next();
    }
  };
};

/**
 * Default cache key generator
 * @param {Object} req - Express request object
 * @param {Array<string>} varyBy - Headers to vary by
 * @returns {string} Cache key
 */
function defaultKeyGenerator(req, varyBy = []) {
  const baseKey = `${req.method}:${req.originalUrl}`;

  // Add user context if available
  const userContext = req.user ? `:user:${req.user.userId}` : '';

  // Add query parameters
  const queryString = Object.keys(req.query).length > 0
    ? `:query:${JSON.stringify(req.query)}`
    : '';

  // Add vary headers
  const varyString = varyBy.length > 0
    ? `:vary:${varyBy.map(header => `${header}:${req.get(header) || ''}`).join(',')}`
    : '';

  return `api${baseKey}${userContext}${queryString}${varyString}`;
}

/**
 * Default condition function
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {*} data - Response data
 * @returns {boolean} Whether to cache the response
 */
function defaultCondition(req, res, data) {
  // Don't cache error responses by default
  if (res.statusCode >= 400) {
    return false;
  }

  // Don't cache empty responses
  if (!data) {
    return false;
  }

  // Don't cache responses with sensitive data (basic check)
  const dataString = JSON.stringify(data).toLowerCase();
  const sensitiveFields = ['password', 'token', 'secret', 'key'];

  for (const field of sensitiveFields) {
    if (dataString.includes(field)) {
      return false;
    }
  }

  return true;
}

/**
 * Cache invalidation middleware
 * Invalidates cache entries based on patterns
 * @param {Array<string>} patterns - Cache key patterns to invalidate
 * @returns {Function} Express middleware function
 */
const cacheInvalidation = (patterns = []) => {
  return async (req, res, next) => {
    // Store original end function
    const originalEnd = res.end;

    res.end = async function (...args) {
      // Only invalidate on successful write operations
      if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method) &&
        res.statusCode >= 200 && res.statusCode < 300) {

        try {
          for (const pattern of patterns) {
            const resolvedPattern = typeof pattern === 'function'
              ? pattern(req, res)
              : pattern;

            if (resolvedPattern) {
              const deletedCount = await cacheService.delPattern(resolvedPattern);
              logger.debug('Cache invalidated', {
                pattern: resolvedPattern,
                deletedKeys: deletedCount,
                method: req.method,
                url: req.originalUrl
              });
            }
          }
        } catch (error) {
          logger.error('Cache invalidation error', {
            error: error.message,
            patterns,
            method: req.method,
            url: req.originalUrl
          });
        }
      }

      // Call original end function
      return originalEnd.apply(this, args);
    };

    next();
  };
};

/**
 * Predefined cache configurations for common use cases
 */
const cacheConfigs = {
  // Short-term cache for frequently changing data
  shortTerm: {
    ttl: 60, // 1 minute
    condition: (req, res, data) => res.statusCode === 200 && data
  },

  // Medium-term cache for moderately changing data
  mediumTerm: {
    ttl: 300, // 5 minutes
    condition: (req, res, data) => res.statusCode === 200 && data
  },

  // Long-term cache for rarely changing data
  longTerm: {
    ttl: 3600, // 1 hour
    condition: (req, res, data) => res.statusCode === 200 && data
  },

  // User-specific cache
  userSpecific: {
    ttl: 300,
    keyGenerator: (req, varyBy) => {
      const userId = req.user?.userId || 'anonymous';
      return `user:${userId}:${req.method}:${req.originalUrl}:${JSON.stringify(req.query)}`;
    }
  },

  // Region-specific cache
  regionSpecific: {
    ttl: 600, // 10 minutes
    keyGenerator: (req, varyBy) => {
      const region = req.user?.region || 'global';
      return `region:${region}:${req.method}:${req.originalUrl}:${JSON.stringify(req.query)}`;
    }
  }
};

/**
 * Cache warming utility
 * Pre-populates cache with frequently accessed data
 */
class CacheWarmer {
  constructor() {
    this.warmupTasks = [];
  }

  /**
   * Add a warmup task
   * @param {string} key - Cache key
   * @param {Function} dataProvider - Function that returns data to cache
   * @param {number} ttl - Time to live
   */
  addTask(key, dataProvider, ttl = 300) {
    this.warmupTasks.push({ key, dataProvider, ttl });
  }

  /**
   * Execute all warmup tasks
   * @async
   * @returns {Promise<void>}
   */
  async warmup() {
    logger.info('Starting cache warmup', { tasks: this.warmupTasks.length });

    const results = await Promise.allSettled(
      this.warmupTasks.map(async (task) => {
        try {
          const data = await task.dataProvider();
          await cacheService.set(task.key, data, task.ttl);
          return { key: task.key, success: true };
        } catch (error) {
          logger.error('Cache warmup task failed', {
            key: task.key,
            error: error.message
          });
          return { key: task.key, success: false, error: error.message };
        }
      })
    );

    const successful = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
    const failed = results.length - successful;

    logger.info('Cache warmup completed', {
      total: results.length,
      successful,
      failed
    });
  }
}

module.exports = {
  cacheMiddleware,
  cacheInvalidation,
  cacheConfigs,
  CacheWarmer
};