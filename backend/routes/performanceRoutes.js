/**
 * @fileoverview Performance Routes - System performance and cache monitoring endpoints
 * @module routes/performanceRoutes
 */

const express = require('express');
const router = express.Router();

// Controllers
const performanceController = require('../controllers/performanceController');

// Middleware
const { authenticate: authenticateToken, authorizeRoles } = require('../middlewares/authMiddleware');
const { cacheMiddleware } = require('../middlewares/cacheMiddleware');

/**
 * @route GET /api/performance/metrics
 * @desc Get comprehensive system performance metrics
 * @access Private (Admin roles only)
 * @cache 30 seconds
 */
router.get('/metrics',
  authenticateToken,
  authorizeRoles(['moderate_admin', 'ceo', 'super_admin']),
  cacheMiddleware({
    ttl: 30, // 30 seconds - performance data changes frequently
    keyGenerator: () => 'performance-metrics'
  }),
  performanceController.getPerformanceMetrics
);

/**
 * @route GET /api/performance/cache
 * @desc Get cache-specific metrics and statistics
 * @access Private (Admin roles only)
 * @cache 60 seconds
 */
router.get('/cache',
  authenticateToken,
  authorizeRoles(['moderate_admin', 'ceo', 'super_admin']),
  cacheMiddleware({
    ttl: 60, // 1 minute
    keyGenerator: () => 'cache-metrics'
  }),
  performanceController.getCacheMetrics
);

/**
 * @route GET /api/performance/database
 * @desc Get database performance metrics
 * @access Private (Admin roles only)
 * @cache 2 minutes
 */
router.get('/database',
  authenticateToken,
  authorizeRoles(['moderate_admin', 'ceo', 'super_admin']),
  cacheMiddleware({
    ttl: 120, // 2 minutes
    keyGenerator: () => 'database-metrics'
  }),
  performanceController.getDatabaseMetrics
);

/**
 * @route POST /api/performance/cache/warmup
 * @desc Trigger cache warmup manually
 * @access Private (Admin roles only)
 * @body {Array} [keys] - Optional array of specific keys to warm
 */
router.post('/cache/warmup',
  authenticateToken,
  authorizeRoles(['moderate_admin', 'super_admin']),
  performanceController.triggerCacheWarmup
);

/**
 * @route POST /api/performance/cache/clear
 * @desc Clear cache entries
 * @access Private (Super Admin only)
 * @body {string} [pattern] - Pattern to match keys for deletion
 * @body {Array} [keys] - Specific keys to delete
 */
router.post('/cache/clear',
  authenticateToken,
  authorizeRoles(['super_admin']),
  performanceController.clearCache
);

module.exports = router;