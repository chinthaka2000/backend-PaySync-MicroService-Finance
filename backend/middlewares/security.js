/**
 * Security Middleware
 * Implements comprehensive security measures including CORS, rate limiting, and security headers
 */

const rateLimit = require('express-rate-limit');
const cors = require('cors');
const { config } = require('../config/environment');
const { logger } = require('../utils/logger');

/**
 * CORS Configuration
 * Configures Cross-Origin Resource Sharing based on environment
 */
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, curl)
    if (!origin) return callback(null, true);

    const allowedOrigins = config.security.corsOrigins;

    // Allow all Vercel preview URLs like:
    // https://project-randomhash.vercel.app
    const vercelPattern = /\.vercel\.app$/;

    // Allow Render frontend
    const renderPattern = /\.onrender\.com$/;

    // Check rules
    if (
      allowedOrigins.includes(origin) ||         // exact match
      vercelPattern.test(origin) ||              // wildcard for all Vercel URLs
      renderPattern.test(origin)                 // wildcard for all Render frontends
    ) {
      return callback(null, true);
    }

    // Block anything else
    logger.warn('CORS blocked request', { origin, allowedOrigins });
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: [
    'Origin',
    'X-Requested-With',
    'Content-Type',
    'Accept',
    'Authorization',
    'X-Request-ID'
  ],
  exposedHeaders: ['X-Request-ID'],
  maxAge: 86400 // 24 hours
};


/**
 * Rate Limiting Configuration
 * Implements different rate limits for different endpoints
 */

// General API rate limiting
const generalRateLimit = rateLimit({
  windowMs: config.security.rateLimitWindowMs,
  max: config.security.rateLimitMaxRequests,
  trustProxy: config.security.trustProxy, // Trust proxy for accurate IP detection
  message: {
    error: 'Too many requests from this IP, please try again later.',
    retryAfter: Math.ceil(config.security.rateLimitWindowMs / 1000)
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn('Rate limit exceeded', {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      endpoint: req.path
    });
    res.status(429).json({
      success: false,
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many requests from this IP, please try again later.',
        retryAfter: Math.ceil(config.security.rateLimitWindowMs / 1000)
      }
    });
  }
});

// Higher rate limit for agent endpoints (loans, dashboard, stats)
const agentRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500, // Allow 500 requests per 15 minutes for agent endpoints
  trustProxy: config.security.trustProxy, // Trust proxy for accurate IP detection
  message: {
    error: 'Too many agent requests from this IP, please try again later.',
    retryAfter: 900
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn('Agent rate limit exceeded', {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      endpoint: req.path
    });
    res.status(429).json({
      success: false,
      error: {
        code: 'AGENT_RATE_LIMIT_EXCEEDED',
        message: 'Too many agent requests from this IP, please try again later.',
        retryAfter: 900
      }
    });
  }
});

// Strict rate limiting for authentication endpoints
const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 requests per windowMs
  trustProxy: config.security.trustProxy, // Trust proxy for accurate IP detection
  message: {
    error: 'Too many authentication attempts, please try again later.',
    retryAfter: 900 // 15 minutes in seconds
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Don't count successful requests
  handler: (req, res) => {
    logger.warn('Auth rate limit exceeded', {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      endpoint: req.path
    });
    res.status(429).json({
      success: false,
      error: {
        code: 'AUTH_RATE_LIMIT_EXCEEDED',
        message: 'Too many authentication attempts, please try again later.',
        retryAfter: 900
      }
    });
  }
});

// File upload rate limiting
const fileUploadRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // Limit each IP to 10 file uploads per minute
  trustProxy: config.security.trustProxy, // Trust proxy for accurate IP detection
  message: {
    error: 'Too many file uploads, please try again later.',
    retryAfter: 60
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn('File upload rate limit exceeded', {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      endpoint: req.path
    });
    res.status(429).json({
      success: false,
      error: {
        code: 'FILE_UPLOAD_RATE_LIMIT_EXCEEDED',
        message: 'Too many file uploads, please try again later.',
        retryAfter: 60
      }
    });
  }
});

/**
 * Security Headers Middleware
 * Sets various security headers to protect against common attacks
 */
const securityHeaders = (req, res, next) => {
  // Prevent clickjacking
  res.setHeader('X-Frame-Options', 'DENY');

  // Prevent MIME type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');

  // Enable XSS protection
  res.setHeader('X-XSS-Protection', '1; mode=block');

  // Referrer policy
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  // Content Security Policy
  res.setHeader('Content-Security-Policy',
    "default-src 'self'; " +
    "script-src 'self' 'unsafe-inline'; " +
    "style-src 'self' 'unsafe-inline'; " +
    "img-src 'self' data: https:; " +
    "font-src 'self'; " +
    "connect-src 'self'; " +
    "frame-ancestors 'none';"
  );

  // Strict Transport Security (HTTPS only in production)
  if (config.isProduction) {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  }

  // Remove server information
  res.removeHeader('X-Powered-By');

  next();
};

/**
 * Request Size Limiting Middleware
 * Limits the size of request bodies to prevent DoS attacks
 */
const requestSizeLimiter = (req, res, next) => {
  const contentLength = parseInt(req.get('Content-Length') || '0');

  if (contentLength > config.security.maxFileSize) {
    logger.warn('Request size limit exceeded', {
      ip: req.ip,
      contentLength,
      maxSize: config.security.maxFileSize,
      endpoint: req.path
    });

    return res.status(413).json({
      success: false,
      error: {
        code: 'REQUEST_TOO_LARGE',
        message: 'Request entity too large',
        maxSize: config.security.maxFileSize
      }
    });
  }

  next();
};

/**
 * IP Whitelist/Blacklist Middleware (for future use)
 * Can be configured to allow/deny specific IP addresses
 */
const ipFilter = (req, res, next) => {
  const clientIP = req.ip || req.connection.remoteAddress;

  // In production, you might want to implement IP filtering
  // For now, we'll just log the IP for monitoring
  if (config.isProduction) {
    logger.info('Request from IP', { ip: clientIP, endpoint: req.path });
  }

  next();
};

/**
 * Security Audit Logging Middleware
 * Logs security-relevant events for monitoring and analysis
 */
const securityAuditLogger = (req, res, next) => {
  // Log security-sensitive endpoints
  const securityEndpoints = ['/api/auth', '/api/staff', '/api/moderate-admin'];
  const isSecurityEndpoint = securityEndpoints.some(endpoint => req.path.startsWith(endpoint));

  if (isSecurityEndpoint) {
    logger.info('Security endpoint accessed', {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      method: req.method,
      endpoint: req.path,
      timestamp: new Date().toISOString()
    });
  }

  next();
};

/**
 * Trust Proxy Configuration
 * Configures Express to trust proxy headers in production
 */
const configureTrustProxy = (app) => {
  if (config.security.trustProxy) {
    // Trust first proxy (for load balancers, reverse proxies)
    app.set('trust proxy', 1);
    logger.info('Trust proxy enabled for production environment');
  }
};

module.exports = {
  corsOptions,
  generalRateLimit,
  agentRateLimit,
  authRateLimit,
  fileUploadRateLimit,
  securityHeaders,
  requestSizeLimiter,
  ipFilter,
  securityAuditLogger,
  configureTrustProxy
};
