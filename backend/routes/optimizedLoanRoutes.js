/**
 * @fileoverview Optimized Loan Routes - Performance-optimized loan endpoints with caching
 * @module routes/optimizedLoanRoutes
 */

const express = require('express');
const router = express.Router();

// Controllers
const optimizedLoanController = require('../controllers/optimizedLoanController');

// Middleware
const { authenticate: authenticateToken, authorizeRoles } = require('../middlewares/authMiddleware');
const { cacheMiddleware, cacheInvalidation, cacheConfigs } = require('../middlewares/cacheMiddleware');
const { paginationMiddleware } = require('../utils/pagination');

/**
 * @route GET /api/loans/optimized
 * @desc Get paginated loans with caching
 * @access Private (All authenticated users)
 * @cache 2 minutes, user-specific
 */
router.get('/optimized',
  authenticateToken,
  paginationMiddleware({ defaultLimit: 20, maxLimit: 100 }),
  cacheMiddleware(cacheConfigs.userSpecific),
  optimizedLoanController.getLoansOptimized
);

/**
 * @route GET /api/loans/stats
 * @desc Get loan statistics with caching
 * @access Private (All authenticated users)
 * @cache 5 minutes, user-specific
 */
router.get('/stats',
  authenticateToken,
  cacheMiddleware({
    ttl: 300, // 5 minutes
    keyGenerator: (req) => {
      const userId = req.user?.userId || 'anonymous';
      const role = req.user?.role || 'unknown';
      const region = req.user?.region || 'global';
      return `loan-stats:${role}:${region}:${userId}:${JSON.stringify(req.query)}`;
    }
  }),
  optimizedLoanController.getLoanStats
);

/**
 * @route GET /api/loans/agent-performance
 * @desc Get agent performance metrics
 * @access Private (Regional Manager and above)
 * @cache 10 minutes, region-specific
 */
router.get('/agent-performance',
  authenticateToken,
  authorizeRoles(['regional_manager', 'moderate_admin', 'ceo', 'super_admin']),
  cacheMiddleware({
    ttl: 600, // 10 minutes
    keyGenerator: (req) => {
      const role = req.user?.role || 'unknown';
      const region = req.user?.region || 'global';
      return `agent-performance:${role}:${region}:${JSON.stringify(req.query)}`;
    }
  }),
  optimizedLoanController.getAgentPerformance
);

/**
 * @route GET /api/loans/regional-distribution
 * @desc Get regional loan distribution
 * @access Private (Moderate Admin and above)
 * @cache 15 minutes, global
 */
router.get('/regional-distribution',
  authenticateToken,
  authorizeRoles(['moderate_admin', 'ceo', 'super_admin']),
  cacheMiddleware({
    ttl: 900, // 15 minutes
    keyGenerator: (req) => `regional-distribution:${JSON.stringify(req.query)}`
  }),
  optimizedLoanController.getRegionalDistribution
);

/**
 * @route GET /api/loans/monthly-trends
 * @desc Get monthly loan trends
 * @access Private (All authenticated users)
 * @cache 1 hour, user-specific
 */
router.get('/monthly-trends',
  authenticateToken,
  cacheMiddleware({
    ttl: 3600, // 1 hour
    keyGenerator: (req) => {
      const role = req.user?.role || 'unknown';
      const region = req.user?.region || 'global';
      return `monthly-trends:${role}:${region}:${JSON.stringify(req.query)}`;
    }
  }),
  optimizedLoanController.getMonthlyTrends
);

/**
 * @route GET /api/loans/portfolio-summary
 * @desc Get portfolio summary
 * @access Private (All authenticated users)
 * @cache 30 minutes, user-specific
 */
router.get('/portfolio-summary',
  authenticateToken,
  cacheMiddleware({
    ttl: 1800, // 30 minutes
    keyGenerator: (req) => {
      const role = req.user?.role || 'unknown';
      const region = req.user?.region || 'global';
      return `portfolio-summary:${role}:${region}`;
    }
  }),
  optimizedLoanController.getPortfolioSummary
);

/**
 * @route GET /api/loans/search
 * @desc Search loans with pagination
 * @access Private (All authenticated users)
 * @cache 1 minute, user-specific
 */
router.get('/search',
  authenticateToken,
  paginationMiddleware({ defaultLimit: 20, maxLimit: 50 }),
  cacheMiddleware({
    ttl: 60, // 1 minute (search results change frequently)
    keyGenerator: (req) => {
      const userId = req.user?.userId || 'anonymous';
      const searchTerm = req.query.q || '';
      return `loan-search:${userId}:${searchTerm}:${req.query.page || 1}:${req.query.limit || 20}`;
    }
  }),
  optimizedLoanController.searchLoans
);

/**
 * Cache invalidation middleware for write operations
 * Invalidates relevant cache entries when loans are modified
 */
const loanCacheInvalidation = cacheInvalidation([
  // Invalidate user-specific loan caches
  (req) => `loans:${req.user?.role}:${req.user?.region}:*`,

  // Invalidate stats caches
  (req) => `loan-stats:*`,

  // Invalidate performance caches if agent-related
  (req) => req.user?.role === 'agent' ? `agent-performance:*` : null,

  // Invalidate portfolio summary
  (req) => `portfolio-summary:*`,

  // Invalidate search caches
  (req) => `loan-search:*`
]);

/**
 * Apply cache invalidation to write operations
 * These would be added to existing loan routes that modify data
 */
router.use(loanCacheInvalidation);

module.exports = router;