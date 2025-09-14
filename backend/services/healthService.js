/**
 * Health Monitoring Service
 * Provides comprehensive system health checks and metrics collection
 */

const mongoose = require('mongoose');
const os = require('os');
const { logger } = require('../utils/logger');

class HealthService {
  constructor() {
    this.startTime = Date.now();
    this.requestCount = 0;
    this.errorCount = 0;
    this.responseTimeHistory = [];
    this.maxHistorySize = 100;
    this.healthCheckInterval = null;
    this.systemMetrics = {
      memory: {},
      cpu: {},
      connections: 0,
      uptime: 0
    };

    // Start periodic health monitoring
    this.startPeriodicMonitoring();
  }

  /**
   * Get comprehensive health status
   */
  async getHealthStatus() {
    try {
      const dbStatus = await this.getDatabaseStatus();
      const systemMetrics = this.getSystemMetrics();
      const performanceMetrics = this.getPerformanceMetrics();
      const errorMetrics = this.getErrorMetrics();

      const isHealthy = dbStatus.connected &&
        systemMetrics.memory.usage < 90 &&
        performanceMetrics.averageResponseTime < 5000;

      return {
        status: isHealthy ? 'healthy' : 'degraded',
        timestamp: new Date().toISOString(),
        uptime: this.getUptime(),
        database: dbStatus,
        system: systemMetrics,
        performance: performanceMetrics,
        errors: errorMetrics,
        services: await this.getServiceStatus()
      };
    } catch (error) {
      logger.error('Health check failed', { error: error.message, stack: error.stack });
      return {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: error.message
      };
    }
  }

  /**
   * Get detailed database status
   */
  async getDatabaseStatus() {
    try {
      const dbState = mongoose.connection.readyState;
      const stateMap = {
        0: 'disconnected',
        1: 'connected',
        2: 'connecting',
        3: 'disconnecting'
      };

      let collections = {};
      let responseTime = null;

      if (dbState === 1) {
        const startTime = Date.now();

        // Test database responsiveness and get collection counts
        const [clientCount, loanCount, staffCount, regionCount] = await Promise.all([
          mongoose.connection.db.collection('clients').countDocuments(),
          mongoose.connection.db.collection('loans').countDocuments(),
          mongoose.connection.db.collection('staff').countDocuments(),
          mongoose.connection.db.collection('regions').countDocuments()
        ]);

        responseTime = Date.now() - startTime;

        collections = {
          clients: clientCount,
          loans: loanCount,
          staff: staffCount,
          regions: regionCount
        };
      }

      return {
        connected: dbState === 1,
        state: stateMap[dbState],
        host: mongoose.connection.host,
        port: mongoose.connection.port,
        name: mongoose.connection.name,
        responseTime: responseTime ? `${responseTime}ms` : null,
        collections,
        connectionPoolSize: mongoose.connection.db?.serverConfig?.s?.poolSize || 'unknown'
      };
    } catch (error) {
      return {
        connected: false,
        error: error.message,
        responseTime: null
      };
    }
  }

  /**
   * Get system metrics (memory, CPU, etc.)
   */
  getSystemMetrics() {
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const usedMemory = totalMemory - freeMemory;
    const memoryUsagePercent = ((usedMemory / totalMemory) * 100).toFixed(2);

    const processMemory = process.memoryUsage();

    return {
      memory: {
        total: this.formatBytes(totalMemory),
        used: this.formatBytes(usedMemory),
        free: this.formatBytes(freeMemory),
        usage: parseFloat(memoryUsagePercent),
        process: {
          rss: this.formatBytes(processMemory.rss),
          heapTotal: this.formatBytes(processMemory.heapTotal),
          heapUsed: this.formatBytes(processMemory.heapUsed),
          external: this.formatBytes(processMemory.external)
        }
      },
      cpu: {
        cores: os.cpus().length,
        model: os.cpus()[0]?.model || 'unknown',
        loadAverage: os.loadavg(),
        architecture: os.arch()
      },
      platform: {
        type: os.type(),
        platform: os.platform(),
        release: os.release(),
        hostname: os.hostname()
      },
      network: {
        interfaces: Object.keys(os.networkInterfaces()).length
      }
    };
  }

  /**
   * Get performance metrics
   */
  getPerformanceMetrics() {
    const averageResponseTime = this.responseTimeHistory.length > 0
      ? this.responseTimeHistory.reduce((a, b) => a + b, 0) / this.responseTimeHistory.length
      : 0;

    const maxResponseTime = this.responseTimeHistory.length > 0
      ? Math.max(...this.responseTimeHistory)
      : 0;

    const minResponseTime = this.responseTimeHistory.length > 0
      ? Math.min(...this.responseTimeHistory)
      : 0;

    return {
      requestCount: this.requestCount,
      averageResponseTime: Math.round(averageResponseTime),
      maxResponseTime,
      minResponseTime,
      requestsPerSecond: this.calculateRequestsPerSecond(),
      responseTimeHistory: this.responseTimeHistory.slice(-10) // Last 10 response times
    };
  }

  /**
   * Get error metrics
   */
  getErrorMetrics() {
    const errorRate = this.requestCount > 0 ? ((this.errorCount / this.requestCount) * 100).toFixed(2) : 0;

    return {
      totalErrors: this.errorCount,
      totalRequests: this.requestCount,
      errorRate: parseFloat(errorRate),
      recentErrors: this.getRecentErrors()
    };
  }

  /**
   * Get service status
   */
  async getServiceStatus() {
    const services = {
      email: 'unknown',
      fileStorage: 'unknown',
      logging: 'healthy'
    };

    // Check email service (if configured)
    try {
      if (process.env.EMAIL_SERVICE_ENABLED === 'true') {
        // Simple check - if env vars are set, assume healthy
        services.email = (process.env.EMAIL_HOST && process.env.EMAIL_USER) ? 'healthy' : 'misconfigured';
      } else {
        services.email = 'disabled';
      }
    } catch (error) {
      services.email = 'unhealthy';
    }

    // Check file storage service
    try {
      const fs = require('fs');
      const uploadsDir = require('path').join(__dirname, '../uploads');
      if (fs.existsSync(uploadsDir)) {
        services.fileStorage = 'healthy';
      } else {
        services.fileStorage = 'directory_missing';
      }
    } catch (error) {
      services.fileStorage = 'unhealthy';
    }

    return services;
  }

  /**
   * Record request metrics
   */
  recordRequest(responseTime, isError = false) {
    this.requestCount++;

    if (isError) {
      this.errorCount++;
    }

    // Add to response time history
    this.responseTimeHistory.push(responseTime);

    // Keep only recent history
    if (this.responseTimeHistory.length > this.maxHistorySize) {
      this.responseTimeHistory.shift();
    }
  }

  /**
   * Get system uptime
   */
  getUptime() {
    const uptimeMs = Date.now() - this.startTime;
    const uptimeSeconds = Math.floor(uptimeMs / 1000);
    const days = Math.floor(uptimeSeconds / 86400);
    const hours = Math.floor((uptimeSeconds % 86400) / 3600);
    const minutes = Math.floor((uptimeSeconds % 3600) / 60);
    const seconds = uptimeSeconds % 60;

    return {
      milliseconds: uptimeMs,
      seconds: uptimeSeconds,
      formatted: `${days}d ${hours}h ${minutes}m ${seconds}s`
    };
  }

  /**
   * Calculate requests per second
   */
  calculateRequestsPerSecond() {
    const uptimeSeconds = (Date.now() - this.startTime) / 1000;
    return uptimeSeconds > 0 ? (this.requestCount / uptimeSeconds).toFixed(2) : 0;
  }

  /**
   * Get recent errors from error monitor
   */
  getRecentErrors() {
    try {
      const { errorMonitor } = require('../middlewares/errorMonitor');
      return errorMonitor.getRecentErrors();
    } catch (error) {
      logger.error('Failed to get recent errors', { error: error.message });
      return [];
    }
  }

  /**
   * Format bytes to human readable format
   */
  formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Start periodic health monitoring
   */
  startPeriodicMonitoring() {
    // Log system metrics every 5 minutes
    this.healthCheckInterval = setInterval(() => {
      this.logSystemMetrics();
    }, 5 * 60 * 1000);
  }

  /**
   * Log system metrics periodically
   */
  async logSystemMetrics() {
    try {
      const metrics = await this.getHealthStatus();
      logger.info('System health metrics', {
        type: 'SYSTEM_METRICS',
        metrics: {
          memory: metrics.system.memory,
          performance: metrics.performance,
          errors: metrics.errors,
          database: {
            connected: metrics.database.connected,
            responseTime: metrics.database.responseTime
          }
        }
      });
    } catch (error) {
      logger.error('Failed to log system metrics', { error: error.message });
    }
  }

  /**
   * Stop monitoring
   */
  stopMonitoring() {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
  }

  /**
   * Reset metrics (useful for testing)
   */
  resetMetrics() {
    this.requestCount = 0;
    this.errorCount = 0;
    this.responseTimeHistory = [];
    this.startTime = Date.now();
  }
}

// Create singleton instance
const healthService = new HealthService();

module.exports = healthService;