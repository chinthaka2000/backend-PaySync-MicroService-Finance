/**
 * Error Rate Monitoring Middleware
 * Tracks error rates and provides alerting capabilities
 */

const { logger, logSecurity } = require('../utils/logger');
const healthService = require('../services/healthService');

class ErrorMonitor {
  constructor() {
    this.errorThresholds = {
      errorRate: 10, // Alert if error rate exceeds 10%
      consecutiveErrors: 5, // Alert after 5 consecutive errors
      errorBurst: 20 // Alert if 20 errors in 1 minute
    };

    this.consecutiveErrorCount = 0;
    this.recentErrors = [];
    this.alertCooldown = new Map(); // Prevent spam alerts
    this.cooldownDuration = 5 * 60 * 1000; // 5 minutes
  }

  /**
   * Monitor and track errors
   */
  trackError(req, res, error) {
    const errorInfo = {
      timestamp: new Date(),
      method: req.method,
      url: req.originalUrl || req.url,
      statusCode: res.statusCode,
      errorMessage: error?.message,
      userId: req.user?.id,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      requestId: req.requestId
    };

    // Add to recent errors (keep last 100)
    this.recentErrors.push(errorInfo);
    if (this.recentErrors.length > 100) {
      this.recentErrors.shift();
    }

    // Track consecutive errors
    if (res.statusCode >= 400) {
      this.consecutiveErrorCount++;
    } else {
      this.consecutiveErrorCount = 0;
    }

    // Check for error patterns and alert if necessary
    this.checkErrorPatterns(errorInfo);
  }

  /**
   * Check for error patterns and trigger alerts
   */
  checkErrorPatterns(errorInfo) {
    // Check consecutive errors
    if (this.consecutiveErrorCount >= this.errorThresholds.consecutiveErrors) {
      this.triggerAlert('CONSECUTIVE_ERRORS', {
        count: this.consecutiveErrorCount,
        lastError: errorInfo
      });
    }

    // Check error burst (errors in last minute)
    const oneMinuteAgo = new Date(Date.now() - 60 * 1000);
    const recentErrorCount = this.recentErrors.filter(
      error => error.timestamp > oneMinuteAgo && error.statusCode >= 400
    ).length;

    if (recentErrorCount >= this.errorThresholds.errorBurst) {
      this.triggerAlert('ERROR_BURST', {
        count: recentErrorCount,
        timeframe: '1 minute'
      });
    }

    // Check overall error rate
    const errorMetrics = healthService.getErrorMetrics();
    if (errorMetrics.errorRate > this.errorThresholds.errorRate && errorMetrics.totalRequests > 10) {
      this.triggerAlert('HIGH_ERROR_RATE', {
        errorRate: errorMetrics.errorRate,
        totalErrors: errorMetrics.totalErrors,
        totalRequests: errorMetrics.totalRequests
      });
    }

    // Check for security-related errors
    if (errorInfo.statusCode === 401 || errorInfo.statusCode === 403) {
      this.trackSecurityEvent(errorInfo);
    }
  }

  /**
   * Track security-related events
   */
  trackSecurityEvent(errorInfo) {
    logSecurity('AUTHENTICATION_FAILURE', errorInfo.userId, {
      ip: errorInfo.ip,
      userAgent: errorInfo.userAgent,
      url: errorInfo.url,
      statusCode: errorInfo.statusCode,
      requestId: errorInfo.requestId
    });

    // Check for brute force attempts (multiple failures from same IP)
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    const failuresFromIP = this.recentErrors.filter(
      error => error.ip === errorInfo.ip &&
        error.timestamp > fiveMinutesAgo &&
        (error.statusCode === 401 || error.statusCode === 403)
    ).length;

    if (failuresFromIP >= 5) {
      this.triggerAlert('POTENTIAL_BRUTE_FORCE', {
        ip: errorInfo.ip,
        failureCount: failuresFromIP,
        timeframe: '5 minutes'
      });
    }
  }

  /**
   * Trigger alert with cooldown to prevent spam
   */
  triggerAlert(alertType, details) {
    const alertKey = `${alertType}_${details.ip || 'system'}`;
    const now = Date.now();

    // Check if alert is in cooldown
    if (this.alertCooldown.has(alertKey)) {
      const lastAlert = this.alertCooldown.get(alertKey);
      if (now - lastAlert < this.cooldownDuration) {
        return; // Skip alert due to cooldown
      }
    }

    // Set cooldown
    this.alertCooldown.set(alertKey, now);

    // Log alert
    logger.error(`ALERT: ${alertType}`, {
      type: 'SYSTEM_ALERT',
      alertType,
      details,
      timestamp: new Date().toISOString(),
      severity: this.getAlertSeverity(alertType)
    });

    // In a production environment, you might want to:
    // - Send notifications to monitoring systems
    // - Send emails to administrators
    // - Trigger automated responses
    this.handleAlert(alertType, details);
  }

  /**
   * Get alert severity level
   */
  getAlertSeverity(alertType) {
    const severityMap = {
      'CONSECUTIVE_ERRORS': 'medium',
      'ERROR_BURST': 'high',
      'HIGH_ERROR_RATE': 'high',
      'POTENTIAL_BRUTE_FORCE': 'critical'
    };
    return severityMap[alertType] || 'low';
  }

  /**
   * Handle alert actions (placeholder for future integrations)
   */
  handleAlert(alertType, details) {
    // Placeholder for alert handling logic
    // Could integrate with:
    // - Email notifications
    // - Slack/Discord webhooks
    // - PagerDuty
    // - SMS alerts
    // - Automated mitigation actions

    logger.info('Alert handler triggered', {
      alertType,
      details,
      message: 'Alert handling not yet implemented'
    });
  }

  /**
   * Get recent errors for health reporting
   */
  getRecentErrors(limit = 10) {
    return this.recentErrors
      .slice(-limit)
      .map(error => ({
        timestamp: error.timestamp,
        method: error.method,
        url: error.url,
        statusCode: error.statusCode,
        errorMessage: error.errorMessage,
        userId: error.userId,
        requestId: error.requestId
      }));
  }

  /**
   * Reset error tracking (for testing)
   */
  reset() {
    this.consecutiveErrorCount = 0;
    this.recentErrors = [];
    this.alertCooldown.clear();
  }

  /**
   * Update error thresholds
   */
  updateThresholds(newThresholds) {
    this.errorThresholds = { ...this.errorThresholds, ...newThresholds };
    logger.info('Error monitoring thresholds updated', {
      newThresholds: this.errorThresholds
    });
  }
}

// Create singleton instance
const errorMonitor = new ErrorMonitor();

/**
 * Express middleware for error monitoring
 */
const errorMonitoringMiddleware = (req, res, next) => {
  // Override res.end to capture error information
  const originalEnd = res.end;
  res.end = function (...args) {
    // Track the request/response
    errorMonitor.trackError(req, res);

    // Call original end method
    originalEnd.apply(this, args);
  };

  next();
};

module.exports = {
  errorMonitor,
  errorMonitoringMiddleware
};