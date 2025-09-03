/**
 * Health Monitoring Routes
 * Defines endpoints for system health checks and monitoring
 */

const express = require('express');
const router = express.Router();
const healthController = require('../controllers/healthController');
const { authenticate } = require('../middlewares/authMiddleware');

// Public health check endpoints (no authentication required)
router.get('/', healthController.getHealth);
router.get('/basic', healthController.getBasicHealth);

// Protected health monitoring endpoints (require authentication)
router.get('/metrics', authenticate, healthController.getMetrics);
router.get('/database', authenticate, healthController.getDatabaseHealth);
router.get('/errors', authenticate, healthController.getErrorMetrics);

// Admin-only endpoints
router.post('/reset-metrics', authenticate, healthController.resetMetrics);

module.exports = router;