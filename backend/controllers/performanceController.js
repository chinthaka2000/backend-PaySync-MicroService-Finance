/**
 * @fileoverview Performance Controller - Monitors system performance and cache metrics
 * @module controllers/performanceController
 */

const cacheService = require('../services/cacheService');
const cacheWarmupService = require('../services/cacheWarmupService');
const mongoose = require('mongoose');
const { logger } = require('../utils/logger');

/**
 * Get comprehensive performance metrics
 * @async
 * @function getPerformanceMetrics
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getPerformanceMetrics = async (req, res) => {
  try {
    const startTime = Date.now();

    // Get cache statistics
    const cacheStats = await cacheService.getStats();

    // Get cache warmup service status
    const warmupStatus = cacheWarmupService.getStatus();

    // Get database connection status
    const dbStats = {
      connected: mongoose.connection.readyState === 1,
      readyState: mongoose.connection.readyState,
      host: mongoose.connection.host,
      port: mongoose.connection.port,
      database: mongoose.connection.name,
      collections: Object.keys(mongoose.connection.collections).length
    };

    // Get memory usage
    const memoryUsage = process.memoryUsage();
    const formatBytes = (bytes) => {
      const sizes = ['Bytes', 'KB', 'MB', 'GB'];
      if (bytes === 0) return '0 Bytes';
      const i = parseInt(Math.floor(Math.log(bytes) / Math.log(1024)));
      return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
    };

    // Get system uptime
    const uptime = process.uptime();
    const formatUptime = (seconds) => {
      const days = Math.floor(seconds / 86400);
      const hours = Math.floor((seconds % 86400) / 3600);
      const minutes = Math.floor((seconds % 3600) / 60);
      return `${days}d ${hours}h ${minutes}m`;
    };

    // Calculate response time for this request
    const responseTime = Date.now() - startTime;

    const metrics = {
      success: true,
      data: {
        timestamp: new Date().toISOString(),
        responseTime: `${responseTime}ms`,

        // System metrics
        system: {
          uptime: formatUptime(uptime),
          nodeVersion: process.version,
          platform: process.platform,
          arch: process.arch,
          pid: process.pid
        },

        // Memory metrics
        memory: {
          rss: formatBytes(memoryUsage.rss),
          heapTotal: formatBytes(memoryUsage.heapTotal),
          heapUsed: formatBytes(memoryUsage.heapUsed),
          external: formatBytes(memoryUsage.external),
          arrayBuffers: formatBytes(memoryUsage.arrayBuffers)
        },

        // Database metrics
        database: dbStats,

        // Cache metrics
        cache: {
          ...cacheStats,
          warmupService: warmupStatus
        },

        // Performance indicators
        performance: {
          healthy: responseTime < 1000 && dbStats.connected && cacheStats.connected,
          responseTime,
          dbConnected: dbStats.connected,
          cacheConnected: cacheStats.connected
        }
      }
    };

    res.json(metrics);
  } catch (error) {
    logger.error('Failed to get performance metrics', {
      error: error.message,
      stack: error.stack
    });

    res.status(500).json({
      success: false,
      error: {
        code: 'PERFORMANCE_METRICS_ERROR',
        message: 'Failed to retrieve performance metrics',
        details: error.message
      }
    });
  }
};

/**
 * Get cache-specific metrics and statistics
 * @async
 * @function getCacheMetrics
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getCacheMetrics = async (req, res) => {
  try {
    const cacheStats = await cacheService.getStats();
    const warmupStatus = cacheWarmupService.getStatus();

    const metrics = {
      success: true,
      data: {
        timestamp: new Date().toISOString(),
        cache: cacheStats,
        warmupService: warmupStatus,
        recommendations: generateCacheRecommendations(cacheStats)
      }
    };

    res.json(metrics);
  } catch (error) {
    logger.error('Failed to get cache metrics', {
      error: error.message
    });

    res.status(500).json({
      success: false,
      error: {
        code: 'CACHE_METRICS_ERROR',
        message: 'Failed to retrieve cache metrics',
        details: error.message
      }
    });
  }
};

/**
 * Trigger cache warmup manually
 * @async
 * @function triggerCacheWarmup
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const triggerCacheWarmup = async (req, res) => {
  try {
    const { keys } = req.body;

    if (keys && Array.isArray(keys)) {
      // Warm specific keys
      await cacheWarmupService.warmSpecificKeys(keys);

      res.json({
        success: true,
        message: 'Specific cache keys warmed successfully',
        data: {
          keys,
          timestamp: new Date().toISOString()
        }
      });
    } else {
      // Full warmup
      await cacheWarmupService.performWarmup();

      res.json({
        success: true,
        message: 'Cache warmup completed successfully',
        data: {
          timestamp: new Date().toISOString()
        }
      });
    }
  } catch (error) {
    logger.error('Cache warmup trigger failed', {
      error: error.message,
      keys: req.body.keys
    });

    res.status(500).json({
      success: false,
      error: {
        code: 'CACHE_WARMUP_ERROR',
        message: 'Failed to trigger cache warmup',
        details: error.message
      }
    });
  }
};

/**
 * Clear cache entries
 * @async
 * @function clearCache
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const clearCache = async (req, res) => {
  try {
    const { pattern, keys } = req.body;

    let clearedCount = 0;

    if (pattern) {
      // Clear by pattern
      clearedCount = await cacheService.delPattern(pattern);

      res.json({
        success: true,
        message: `Cache entries cleared by pattern: ${pattern}`,
        data: {
          pattern,
          clearedCount,
          timestamp: new Date().toISOString()
        }
      });
    } else if (keys && Array.isArray(keys)) {
      // Clear specific keys
      for (const key of keys) {
        const deleted = await cacheService.del(key);
        if (deleted) clearedCount++;
      }

      res.json({
        success: true,
        message: 'Specific cache keys cleared',
        data: {
          keys,
          clearedCount,
          timestamp: new Date().toISOString()
        }
      });
    } else {
      // Clear all cache
      const cleared = await cacheService.flush();

      res.json({
        success: true,
        message: cleared ? 'All cache cleared successfully' : 'Cache clear failed',
        data: {
          allCleared: cleared,
          timestamp: new Date().toISOString()
        }
      });
    }
  } catch (error) {
    logger.error('Cache clear failed', {
      error: error.message,
      pattern: req.body.pattern,
      keys: req.body.keys
    });

    res.status(500).json({
      success: false,
      error: {
        code: 'CACHE_CLEAR_ERROR',
        message: 'Failed to clear cache',
        details: error.message
      }
    });
  }
};

/**
 * Get database performance metrics
 * @async
 * @function getDatabaseMetrics
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getDatabaseMetrics = async (req, res) => {
  try {
    const startTime = Date.now();

    // Test database performance with a simple query
    const testQuery = await mongoose.connection.db.admin().ping();
    const queryTime = Date.now() - startTime;

    // Get database stats
    const dbStats = await mongoose.connection.db.stats();

    // Get collection stats
    const collections = await mongoose.connection.db.listCollections().toArray();
    const collectionStats = {};

    for (const collection of collections) {
      try {
        const stats = await mongoose.connection.db.collection(collection.name).stats();
        collectionStats[collection.name] = {
          count: stats.count || 0,
          size: stats.size || 0,
          avgObjSize: stats.avgObjSize || 0,
          storageSize: stats.storageSize || 0,
          indexes: stats.nindexes || 0,
          indexSize: stats.totalIndexSize || 0
        };
      } catch (error) {
        // Some collections might not support stats
        collectionStats[collection.name] = { error: 'Stats not available' };
      }
    }

    const metrics = {
      success: true,
      data: {
        timestamp: new Date().toISOString(),
        connectionTest: {
          success: testQuery.ok === 1,
          responseTime: `${queryTime}ms`
        },
        database: {
          name: dbStats.db,
          collections: dbStats.collections,
          objects: dbStats.objects,
          dataSize: formatBytes(dbStats.dataSize),
          storageSize: formatBytes(dbStats.storageSize),
          indexSize: formatBytes(dbStats.indexSize),
          avgObjSize: formatBytes(dbStats.avgObjSize)
        },
        collections: collectionStats,
        performance: {
          healthy: queryTime < 100 && testQuery.ok === 1,
          queryResponseTime: queryTime
        }
      }
    };

    res.json(metrics);
  } catch (error) {
    logger.error('Failed to get database metrics', {
      error: error.message
    });

    res.status(500).json({
      success: false,
      error: {
        code: 'DATABASE_METRICS_ERROR',
        message: 'Failed to retrieve database metrics',
        details: error.message
      }
    });
  }
};

/**
 * Generate cache performance recommendations
 * @param {Object} cacheStats - Cache statistics
 * @returns {Array} Array of recommendations
 */
function generateCacheRecommendations(cacheStats) {
  const recommendations = [];

  if (!cacheStats.connected) {
    recommendations.push({
      type: 'critical',
      message: 'Cache service is not connected. Check Redis configuration.',
      action: 'Verify Redis server is running and connection settings are correct.'
    });
    return recommendations;
  }

  // Check hit rate
  const hitRate = parseFloat(cacheStats.hitRate?.replace('%', '') || '0');
  if (hitRate < 50) {
    recommendations.push({
      type: 'warning',
      message: `Cache hit rate is low (${cacheStats.hitRate}). Consider optimizing cache keys and TTL values.`,
      action: 'Review frequently accessed data and ensure proper caching strategies.'
    });
  } else if (hitRate > 90) {
    recommendations.push({
      type: 'success',
      message: `Excellent cache hit rate (${cacheStats.hitRate}). Cache is performing well.`,
      action: 'Continue monitoring and maintain current caching strategies.'
    });
  }

  // Check memory usage
  if (cacheStats.memory && cacheStats.memory.includes('GB')) {
    const memoryValue = parseFloat(cacheStats.memory.split(' ')[0]);
    if (memoryValue > 1) {
      recommendations.push({
        type: 'info',
        message: `Cache is using ${cacheStats.memory} of memory. Monitor for memory pressure.`,
        action: 'Consider implementing cache eviction policies or increasing TTL optimization.'
      });
    }
  }

  // Check key count
  if (cacheStats.keys > 10000) {
    recommendations.push({
      type: 'info',
      message: `High number of cache keys (${cacheStats.keys}). Ensure proper key expiration.`,
      action: 'Review cache key patterns and implement appropriate TTL values.'
    });
  }

  return recommendations;
}

/**
 * Format bytes to human readable format
 * @param {number} bytes - Bytes to format
 * @returns {string} Formatted string
 */
function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

module.exports = {
  getPerformanceMetrics,
  getCacheMetrics,
  triggerCacheWarmup,
  clearCache,
  getDatabaseMetrics
};