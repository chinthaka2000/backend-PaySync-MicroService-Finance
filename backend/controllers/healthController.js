/**
 * Health Monitoring Controller
 * Handles health check endpoints and system monitoring
 */

const healthService = require('../services/healthService');
const { logger, logAudit } = require('../utils/logger');

class HealthController {
  /**
   * Get comprehensive health status
   * GET /health
   */
  async getHealth(req, res) {
    try {
      const healthStatus = await healthService.getHealthStatus();

      // Log health check request
      logger.info('Health check requested', {
        requestId: req.requestId,
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });

      // Set appropriate status code based on health
      const statusCode = healthStatus.status === 'healthy' ? 200 :
        healthStatus.status === 'degraded' ? 200 : 503;

      res.status(statusCode).json({
        success: true,
        data: healthStatus
      });
    } catch (error) {
      logger.error('Health check failed', {
        error: error.message,
        stack: error.stack,
        requestId: req.requestId
      });

      res.status(500).json({
        success: false,
        error: {
          code: 'HEALTH_CHECK_FAILED',
          message: 'Health check failed',
          details: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        }
      });
    }
  }

  /**
   * Get basic health status (lightweight)
   * GET /health/basic
   */
  async getBasicHealth(req, res) {
    try {
      const uptime = healthService.getUptime();
      const performanceMetrics = healthService.getPerformanceMetrics();

      res.json({
        success: true,
        data: {
          status: 'healthy',
          timestamp: new Date().toISOString(),
          uptime: uptime.formatted,
          requestCount: performanceMetrics.requestCount,
          averageResponseTime: performanceMetrics.averageResponseTime
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: {
          code: 'BASIC_HEALTH_CHECK_FAILED',
          message: 'Basic health check failed'
        }
      });
    }
  }

  /**
   * Get system metrics
   * GET /health/metrics
   */
  async getMetrics(req, res) {
    try {
      // Check if user has permission to view system metrics
      if (!req.user || !['super_admin', 'moderate_admin'].includes(req.user.role)) {
        return res.status(403).json({
          success: false,
          error: {
            code: 'INSUFFICIENT_PERMISSIONS',
            message: 'Access denied. Admin privileges required.'
          }
        });
      }

      const systemMetrics = healthService.getSystemMetrics();
      const performanceMetrics = healthService.getPerformanceMetrics();
      const errorMetrics = healthService.getErrorMetrics();

      // Log metrics access
      logAudit('SYSTEM_METRICS_ACCESSED', req.user.id, {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        requestId: req.requestId
      });

      res.json({
        success: true,
        data: {
          system: systemMetrics,
          performance: performanceMetrics,
          errors: errorMetrics,
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      logger.error('Failed to get system metrics', {
        error: error.message,
        stack: error.stack,
        requestId: req.requestId,
        userId: req.user?.id
      });

      res.status(500).json({
        success: false,
        error: {
          code: 'METRICS_FETCH_FAILED',
          message: 'Failed to retrieve system metrics'
        }
      });
    }
  }

  /**
   * Get database status
   * GET /health/database
   */
  async getDatabaseHealth(req, res) {
    try {
      // Check permissions
      if (!req.user || !['super_admin', 'moderate_admin'].includes(req.user.role)) {
        return res.status(403).json({
          success: false,
          error: {
            code: 'INSUFFICIENT_PERMISSIONS',
            message: 'Access denied. Admin privileges required.'
          }
        });
      }

      const dbStatus = await healthService.getDatabaseStatus();

      // Log database health check
      logAudit('DATABASE_HEALTH_CHECKED', req.user.id, {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        requestId: req.requestId,
        result: dbStatus.connected ? 'success' : 'failure'
      });

      res.json({
        success: true,
        data: dbStatus
      });
    } catch (error) {
      logger.error('Database health check failed', {
        error: error.message,
        stack: error.stack,
        requestId: req.requestId,
        userId: req.user?.id
      });

      res.status(500).json({
        success: false,
        error: {
          code: 'DATABASE_HEALTH_CHECK_FAILED',
          message: 'Database health check failed'
        }
      });
    }
  }

  /**
   * Reset metrics (for testing/admin purposes)
   * POST /health/reset-metrics
   */
  async resetMetrics(req, res) {
    try {
      // Only super admin can reset metrics
      if (!req.user || req.user.role !== 'super_admin') {
        return res.status(403).json({
          success: false,
          error: {
            code: 'INSUFFICIENT_PERMISSIONS',
            message: 'Access denied. Super admin privileges required.'
          }
        });
      }

      healthService.resetMetrics();

      // Log metrics reset
      logAudit('SYSTEM_METRICS_RESET', req.user.id, {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        requestId: req.requestId,
        action: 'metrics_reset'
      });

      logger.info('System metrics reset by admin', {
        userId: req.user.id,
        requestId: req.requestId
      });

      res.json({
        success: true,
        message: 'System metrics have been reset',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Failed to reset metrics', {
        error: error.message,
        stack: error.stack,
        requestId: req.requestId,
        userId: req.user?.id
      });

      res.status(500).json({
        success: false,
        error: {
          code: 'METRICS_RESET_FAILED',
          message: 'Failed to reset system metrics'
        }
      });
    }
  }

  /**
   * Get error rate and recent errors
   * GET /health/errors
   */
  async getErrorMetrics(req, res) {
    try {
      // Check permissions
      if (!req.user || !['super_admin', 'moderate_admin'].includes(req.user.role)) {
        return res.status(403).json({
          success: false,
          error: {
            code: 'INSUFFICIENT_PERMISSIONS',
            message: 'Access denied. Admin privileges required.'
          }
        });
      }

      const errorMetrics = healthService.getErrorMetrics();

      res.json({
        success: true,
        data: errorMetrics
      });
    } catch (error) {
      logger.error('Failed to get error metrics', {
        error: error.message,
        stack: error.stack,
        requestId: req.requestId,
        userId: req.user?.id
      });

      res.status(500).json({
        success: false,
        error: {
          code: 'ERROR_METRICS_FETCH_FAILED',
          message: 'Failed to retrieve error metrics'
        }
      });
    }
  }
}

module.exports = new HealthController();