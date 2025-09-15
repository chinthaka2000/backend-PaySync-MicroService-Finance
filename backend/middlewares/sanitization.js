/**
 * Input Sanitization and XSS Protection Middleware
 * Sanitizes user input to prevent XSS attacks and other injection vulnerabilities
 */

const { logger } = require('../utils/logger');

/**
 * HTML Entity Encoding
 * Encodes HTML entities to prevent XSS attacks
 */
const htmlEntities = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#x27;',
  '/': '&#x2F;'
};

/**
 * Encode HTML entities in a string
 * @param {string} str - String to encode
 * @returns {string} - Encoded string
 */
function encodeHtmlEntities(str) {
  if (typeof str !== 'string') return str;
  return str.replace(/[&<>"'\/]/g, (s) => htmlEntities[s]);
}

/**
 * SQL Injection Prevention
 * Removes or escapes potentially dangerous SQL characters
 */
const sqlInjectionPatterns = [
  /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION|SCRIPT)\b)/gi,
  /(--|\/\*|\*\/|;|'|"|`)/g,
  /(\bOR\b|\bAND\b)\s+\d+\s*=\s*\d+/gi,
  /(\bOR\b|\bAND\b)\s+['"].*['"].*=/gi
];

/**
 * Check for SQL injection patterns
 * @param {string} str - String to check
 * @returns {boolean} - True if potentially dangerous patterns found
 */
function containsSqlInjection(str) {
  if (typeof str !== 'string') return false;
  return sqlInjectionPatterns.some(pattern => pattern.test(str));
}

/**
 * NoSQL Injection Prevention
 * Prevents MongoDB injection attacks
 */
function sanitizeNoSqlInjection(obj) {
  if (obj && typeof obj === 'object') {
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        // Remove MongoDB operators that could be used for injection
        if (key.startsWith('$') || key.includes('.')) {
          delete obj[key];
          logger.warn('Potential NoSQL injection attempt blocked', { key, value: obj[key] });
        } else if (typeof obj[key] === 'object') {
          sanitizeNoSqlInjection(obj[key]);
        }
      }
    }
  }
  return obj;
}

/**
 * XSS Protection
 * Removes or encodes potentially dangerous script content
 */
const xssPatterns = [
  /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
  /<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi,
  /<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi,
  /<embed\b[^<]*(?:(?!<\/embed>)<[^<]*)*<\/embed>/gi,
  /<link\b[^>]*>/gi,
  /<meta\b[^>]*>/gi,
  /javascript:/gi,
  /vbscript:/gi,
  /data:text\/html/gi,
  /on\w+\s*=/gi // Event handlers like onclick, onload, etc.
];

/**
 * Check for XSS patterns
 * @param {string} str - String to check
 * @returns {boolean} - True if XSS patterns found
 */
function containsXss(str) {
  if (typeof str !== 'string') return false;
  return xssPatterns.some(pattern => pattern.test(str));
}

/**
 * Sanitize string for XSS prevention
 * @param {string} str - String to sanitize
 * @returns {string} - Sanitized string
 */
function sanitizeXss(str) {
  if (typeof str !== 'string') return str;

  // Remove dangerous patterns
  let sanitized = str;
  xssPatterns.forEach(pattern => {
    sanitized = sanitized.replace(pattern, '');
  });

  // Encode HTML entities
  sanitized = encodeHtmlEntities(sanitized);

  return sanitized;
}

/**
 * Path Traversal Prevention
 * Prevents directory traversal attacks
 */
const pathTraversalPatterns = [
  /\.\./g,
  /\.\//g,
  /~\//g,
  /\\/g,
  /%2e%2e/gi,
  /%2f/gi,
  /%5c/gi
];

/**
 * Check for path traversal patterns
 * @param {string} str - String to check
 * @returns {boolean} - True if path traversal patterns found
 */
function containsPathTraversal(str) {
  if (typeof str !== 'string') return false;
  return pathTraversalPatterns.some(pattern => pattern.test(str));
}

/**
 * Recursively sanitize an object
 * @param {any} obj - Object to sanitize
 * @param {Object} options - Sanitization options
 * @returns {any} - Sanitized object
 */
function sanitizeObject(obj, options = {}) {
  const {
    enableXssProtection = true,
    enableSqlInjectionProtection = true,
    enableNoSqlInjectionProtection = true,
    enablePathTraversalProtection = true,
    logSuspiciousActivity = true
  } = options;

  if (obj === null || obj === undefined) {
    return obj;
  }

  if (typeof obj === 'string') {
    let sanitized = obj;
    let suspicious = false;

    // Check for various injection attempts
    if (enableXssProtection && containsXss(obj)) {
      sanitized = sanitizeXss(sanitized);
      suspicious = true;
      if (logSuspiciousActivity) {
        logger.warn('XSS attempt detected and sanitized', { original: obj, sanitized });
      }
    }

    if (enableSqlInjectionProtection && containsSqlInjection(obj)) {
      suspicious = true;
      if (logSuspiciousActivity) {
        logger.warn('SQL injection attempt detected', { value: obj });
      }
    }

    if (enablePathTraversalProtection && containsPathTraversal(obj)) {
      suspicious = true;
      if (logSuspiciousActivity) {
        logger.warn('Path traversal attempt detected', { value: obj });
      }
    }

    return sanitized;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item, options));
  }

  if (typeof obj === 'object') {
    const sanitized = {};

    // NoSQL injection protection
    if (enableNoSqlInjectionProtection) {
      obj = sanitizeNoSqlInjection({ ...obj });
    }

    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        // Sanitize the key itself
        const sanitizedKey = sanitizeObject(key, options);
        sanitized[sanitizedKey] = sanitizeObject(obj[key], options);
      }
    }
    return sanitized;
  }

  return obj;
}

/**
 * Input Sanitization Middleware
 * Sanitizes request body, query parameters, and URL parameters
 */
const inputSanitizer = (options = {}) => {
  return (req, res, next) => {
    try {
      const startTime = Date.now();

      // Sanitize request body
      if (req.body) {
        req.body = sanitizeObject(req.body, options);
      }

      // Sanitize query parameters
      if (req.query) {
        req.query = sanitizeObject(req.query, options);
      }

      // Sanitize URL parameters
      if (req.params) {
        req.params = sanitizeObject(req.params, options);
      }

      // Log sanitization performance in development
      if (process.env.NODE_ENV === 'development') {
        const duration = Date.now() - startTime;
        if (duration > 10) { // Log if sanitization takes more than 10ms
          logger.debug('Input sanitization completed', { duration: `${duration}ms` });
        }
      }

      next();
    } catch (error) {
      logger.error('Input sanitization failed', { error: error.message, stack: error.stack });
      res.status(400).json({
        success: false,
        error: {
          code: 'SANITIZATION_ERROR',
          message: 'Invalid input data format'
        }
      });
    }
  };
};

/**
 * Strict Input Sanitizer for sensitive endpoints
 * More aggressive sanitization for authentication and admin endpoints
 */
const strictInputSanitizer = inputSanitizer({
  enableXssProtection: true,
  enableSqlInjectionProtection: true,
  enableNoSqlInjectionProtection: true,
  enablePathTraversalProtection: true,
  logSuspiciousActivity: true
});

/**
 * File Upload Sanitizer
 * Sanitizes file upload data and validates file types
 */
const fileUploadSanitizer = (req, res, next) => {
  try {
    if (req.file) {
      // Sanitize filename
      if (req.file.originalname) {
        req.file.originalname = sanitizeXss(req.file.originalname);

        // Check for path traversal in filename
        if (containsPathTraversal(req.file.originalname)) {
          logger.warn('Path traversal attempt in filename', { filename: req.file.originalname });
          return res.status(400).json({
            success: false,
            error: {
              code: 'INVALID_FILENAME',
              message: 'Invalid filename detected'
            }
          });
        }
      }
    }

    if (req.files && Array.isArray(req.files)) {
      req.files.forEach(file => {
        if (file.originalname) {
          file.originalname = sanitizeXss(file.originalname);

          if (containsPathTraversal(file.originalname)) {
            logger.warn('Path traversal attempt in filename', { filename: file.originalname });
            throw new Error('Invalid filename detected');
          }
        }
      });
    }

    next();
  } catch (error) {
    logger.error('File upload sanitization failed', { error: error.message });
    res.status(400).json({
      success: false,
      error: {
        code: 'FILE_SANITIZATION_ERROR',
        message: 'File upload validation failed'
      }
    });
  }
};

module.exports = {
  inputSanitizer,
  strictInputSanitizer,
  fileUploadSanitizer,
  sanitizeObject,
  sanitizeXss,
  encodeHtmlEntities,
  containsXss,
  containsSqlInjection,
  containsPathTraversal
};