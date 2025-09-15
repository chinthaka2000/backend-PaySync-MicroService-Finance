/**
 * @fileoverview Simple and Safe Compression Middleware
 * @module middlewares/compressionMiddleware
 */

const compression = require('compression');
const { logger } = require('../utils/logger');

/**
 * Simple compression filter
 */
function compressionFilter(req, res) {
  // Don't compress if no accept-encoding header
  if (!req.headers['accept-encoding']) return false;
  
  // Don't compress if already compressed
  if (res.getHeader('content-encoding')) return false;

  // Only compress JSON responses and text
  const contentType = res.getHeader('content-type');
  if (contentType) {
    return contentType.includes('application/json') || 
           contentType.includes('text/') ||
           contentType.includes('application/javascript');
  }

  return true;
}

/**
 * Create safe compression middleware
 */
function createCompressionMiddleware(options = {}) {
  const compressionOptions = {
    filter: compressionFilter,
    level: options.level || 6,
    threshold: options.threshold || 1024,
    ...options
  };

  return [
    // Add request start time for performance tracking
    (req, res, next) => {
      req._startTime = Date.now();
      next();
    },
    
    // Add response time header safely
    (req, res, next) => {
      const originalSend = res.send.bind(res);
      const originalJson = res.json.bind(res);
      
      res.send = function(data) {
        if (!res.headersSent) {
          const responseTime = Date.now() - (req._startTime || Date.now());
          res.set('X-Response-Time', `${responseTime}ms`);
        }
        return originalSend(data);
      };
      
      res.json = function(data) {
        if (!res.headersSent) {
          const responseTime = Date.now() - (req._startTime || Date.now());
          res.set('X-Response-Time', `${responseTime}ms`);
        }
        return originalJson(data);
      };
      
      next();
    },
    
    // Standard compression middleware
    compression(compressionOptions)
  ];
}

module.exports = {
  createCompressionMiddleware,
  compressionFilter
};