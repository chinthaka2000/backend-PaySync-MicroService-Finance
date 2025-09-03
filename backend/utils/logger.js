/**
 * Enhanced Structured Logging System for PaySync
 */

const winston = require('winston');
const path = require('path');
const fs = require('fs');

// Ensure logs directory exists
const logsDir = path.join(__dirname, '../logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Define log levels with priorities
const logLevels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
  audit: 5
};

// Define colors for each level
const logColors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'white',
  audit: 'cyan'
};

winston.addColors(logColors);

// Enhanced log formats
const consoleFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  winston.format.colorize({ all: true }),
  winston.format.errors({ stack: true }),
  winston.format.printf((info) => {
    const { timestamp, level, message, requestId, userId, ...meta } = info;
    let logMessage = `${timestamp} ${level}: ${message}`;

    if (requestId) logMessage += ` [RequestID: ${requestId}]`;
    if (userId) logMessage += ` [UserID: ${userId}]`;

    if (Object.keys(meta).length > 0) {
      logMessage += ` ${JSON.stringify(meta)}`;
    }

    return logMessage;
  })
);

// File format with structured data
const fileFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

// Performance format for HTTP requests
const performanceFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.json(),
  winston.format.printf((info) => {
    return JSON.stringify({
      timestamp: info.timestamp,
      level: info.level,
      method: info.method,
      url: info.url,
      statusCode: info.statusCode,
      responseTime: info.responseTime,
      ip: info.ip,
      userAgent: info.userAgent,
      userId: info.userId,
      requestId: info.requestId
    });
  })
);

// Define transports with enhanced configuration
const transports = [
  // Console transport
  new winston.transports.Console({
    format: consoleFormat,
    level: process.env.LOG_LEVEL || 'info',
    handleExceptions: true,
    handleRejections: true
  }),

  // Error log file
  new winston.transports.File({
    filename: path.join(logsDir, 'error.log'),
    level: 'error',
    format: fileFormat,
    maxsize: 10485760, // 10MB
    maxFiles: 10,
    handleExceptions: true
  }),

  // Warning log file
  new winston.transports.File({
    filename: path.join(logsDir, 'warn.log'),
    level: 'warn',
    format: fileFormat,
    maxsize: 5242880, // 5MB
    maxFiles: 5
  }),

  // Combined log file
  new winston.transports.File({
    filename: path.join(logsDir, 'combined.log'),
    format: fileFormat,
    maxsize: 10485760, // 10MB
    maxFiles: 10
  }),

  // Performance/HTTP log file
  new winston.transports.File({
    filename: path.join(logsDir, 'performance.log'),
    level: 'http',
    format: performanceFormat,
    maxsize: 10485760, // 10MB
    maxFiles: 5
  })
];

// Create main logger instance
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  levels: logLevels,
  format: fileFormat,
  transports,
  exitOnError: false,
  handleExceptions: true,
  handleRejections: true
});

// Enhanced audit logger for sensitive operations
const auditLogger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({
      filename: path.join(logsDir, 'audit.log'),
      maxsize: 20971520, // 20MB for audit logs
      maxFiles: 20, // Keep more audit files
      tailable: true
    }),
    // Also log critical audit events to a separate file
    new winston.transports.File({
      filename: path.join(logsDir, 'security.log'),
      level: 'warn', // Only warnings and errors
      maxsize: 10485760, // 10MB
      maxFiles: 15
    })
  ]
});

// Security logger for authentication and authorization events
const securityLogger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({
      filename: path.join(logsDir, 'security.log'),
      maxsize: 10485760, // 10MB
      maxFiles: 15
    })
  ]
});

// Enhanced helper functions
const logAudit = (action, userId, details = {}) => {
  const auditEntry = {
    action,
    userId,
    timestamp: new Date().toISOString(),
    ip: details.ip,
    userAgent: details.userAgent,
    resource: details.resource,
    resourceId: details.resourceId,
    result: details.result,
    changes: details.changes,
    additionalInfo: details.additionalInfo,
    requestId: details.requestId,
    sessionId: details.sessionId
  };

  auditLogger.info(auditEntry);

  // Log critical actions to security log as well
  const criticalActions = [
    'USER_LOGIN_FAILED',
    'USER_ACCOUNT_LOCKED',
    'UNAUTHORIZED_ACCESS_ATTEMPT',
    'ROLE_CHANGED',
    'PERMISSION_ESCALATION',
    'DATA_EXPORT',
    'BULK_DELETE',
    'SYSTEM_CONFIG_CHANGED'
  ];

  if (criticalActions.includes(action)) {
    securityLogger.warn(auditEntry);
  }
};

const logSecurity = (event, userId, details = {}) => {
  securityLogger.info({
    event,
    userId,
    timestamp: new Date().toISOString(),
    ip: details.ip,
    userAgent: details.userAgent,
    result: details.result,
    reason: details.reason,
    requestId: details.requestId,
    additionalInfo: details.additionalInfo
  });
};

const logError = (error, req = null) => {
  const errorInfo = {
    message: error.message,
    stack: error.stack,
    statusCode: error.statusCode,
    errorCode: error.errorCode,
    timestamp: error.timestamp || new Date().toISOString(),
    requestId: error.requestId,
    userId: error.userId,
    ip: error.ip,
    details: error.details
  };

  if (req) {
    errorInfo.request = {
      method: req.method,
      url: req.originalUrl || req.url,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      userId: req.user?.id,
      requestId: req.requestId,
      body: req.method !== 'GET' ? req.body : undefined,
      query: req.query,
      params: req.params
    };
  }

  logger.error(errorInfo);
};

const logPerformance = (req, res, responseTime) => {
  logger.http({
    method: req.method,
    url: req.originalUrl || req.url,
    statusCode: res.statusCode,
    responseTime: `${responseTime}ms`,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    userId: req.user?.id,
    requestId: req.requestId,
    contentLength: res.get('Content-Length') || 0
  });
};

// Structured logging methods
const logInfo = (message, meta = {}) => {
  logger.info(message, meta);
};

const logWarn = (message, meta = {}) => {
  logger.warn(message, meta);
};

const logDebug = (message, meta = {}) => {
  logger.debug(message, meta);
};

// Business operation logging
const logBusinessOperation = (operation, userId, details = {}) => {
  logger.info({
    type: 'BUSINESS_OPERATION',
    operation,
    userId,
    timestamp: new Date().toISOString(),
    ...details
  });
};

module.exports = {
  logger,
  auditLogger,
  securityLogger,
  logAudit,
  logSecurity,
  logError,
  logPerformance,
  logInfo,
  logWarn,
  logDebug,
  logBusinessOperation
};