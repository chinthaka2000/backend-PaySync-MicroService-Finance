/**
 * Enhanced Performance Monitoring Middleware
 */

const { logPerformance } = require('../utils/logger');
const healthService = require('../services/healthService');

const performanceMonitor = (req, res, next) => {
  const startTime = Date.now();

  // Override res.end to capture response time and metrics
  const originalEnd = res.end;
  res.end = function (...args) {
    const responseTime = Date.now() - startTime;
    const isError = res.statusCode >= 400;

    // Log performance metrics
    logPerformance(req, res, responseTime);

    // Record metrics in health service
    healthService.recordRequest(responseTime, isError);

    // Log slow requests (over 2 seconds)
    if (responseTime > 2000) {
      require('../utils/logger').logger.warn('Slow request detected', {
        method: req.method,
        url: req.originalUrl || req.url,
        responseTime: `${responseTime}ms`,
        statusCode: res.statusCode,
        requestId: req.requestId,
        userId: req.user?.id
      });
    }

    // Call original end method
    originalEnd.apply(this, args);
  };

  next();
};

module.exports = performanceMonitor;