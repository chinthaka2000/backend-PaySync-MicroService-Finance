const Joi = require('joi');

/**
 * Custom validation middleware factory
 * @param {Object} schema - Joi validation schema
 * @param {string} source - Source of data to validate ('body', 'params', 'query')
 * @param {Object} options - Additional validation options
 * @returns {Function} Express middleware function
 */
const validate = (schema, source = 'body', options = {}) => {
  return (req, res, next) => {
    const dataToValidate = req[source];

    // Default validation options
    const validationOptions = {
      abortEarly: false, // Return all validation errors
      allowUnknown: options.allowUnknown || false, // Don't allow unknown fields by default
      stripUnknown: options.stripUnknown !== false, // Remove unknown fields by default
      convert: options.convert !== false, // Convert values by default
      presence: options.presence || 'optional', // Fields are optional by default unless marked required
      ...options.joiOptions
    };

    const { error, value } = schema.validate(dataToValidate, validationOptions);

    if (error) {
      const validationErrors = error.details.map(detail => {
        const field = detail.path.join('.');
        let message = detail.message;

        // Customize error messages for better user experience
        switch (detail.type) {
          case 'any.required':
            message = `${field} is required`;
            break;
          case 'string.email':
            message = `${field} must be a valid email address`;
            break;
          case 'string.min':
            message = `${field} must be at least ${detail.context.limit} characters long`;
            break;
          case 'string.max':
            message = `${field} must not exceed ${detail.context.limit} characters`;
            break;
          case 'number.min':
            message = `${field} must be at least ${detail.context.limit}`;
            break;
          case 'number.max':
            message = `${field} must not exceed ${detail.context.limit}`;
            break;
          case 'any.only':
            message = `${field} must be one of: ${detail.context.valids.join(', ')}`;
            break;
          case 'string.pattern.base':
            if (field.includes('password')) {
              message = `${field} must contain at least 8 characters with uppercase, lowercase, and number`;
            } else if (field.includes('phone')) {
              message = `${field} must be a valid phone number`;
            } else if (field.includes('Id')) {
              message = `${field} must be a valid ID`;
            }
            break;
        }

        return {
          field,
          message,
          value: detail.context.value,
          type: detail.type,
          source
        };
      });

      // Log validation errors for debugging (in development)
      if (process.env.NODE_ENV === 'development') {
        console.log(`Validation failed for ${source}:`, validationErrors);
      }

      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: `Validation failed for ${source}`,
          details: validationErrors,
          source,
          timestamp: new Date().toISOString(),
          requestId: req.id || req.headers['x-request-id'] || 'unknown'
        }
      });
    }

    // Replace the original data with validated and sanitized data
    req[source] = value;

    // Add validation metadata to request for debugging
    if (!req.validationMeta) req.validationMeta = {};
    req.validationMeta[source] = {
      validated: true,
      schema: schema.describe(),
      timestamp: new Date().toISOString()
    };

    next();
  };
};

/**
 * Validate multiple sources (body, params, query) at once
 * @param {Object} schemas - Object containing schemas for different sources
 * @param {Object} options - Additional validation options
 * @returns {Function} Express middleware function
 */
const validateMultiple = (schemas, options = {}) => {
  return (req, res, next) => {
    const errors = [];
    const validatedData = {};

    // Default validation options
    const validationOptions = {
      abortEarly: false,
      allowUnknown: options.allowUnknown || false,
      stripUnknown: options.stripUnknown !== false,
      convert: options.convert !== false,
      presence: options.presence || 'optional',
      ...options.joiOptions
    };

    // Validate each source
    Object.keys(schemas).forEach(source => {
      const schema = schemas[source];
      const dataToValidate = req[source];

      const { error, value } = schema.validate(dataToValidate, validationOptions);

      if (error) {
        const sourceErrors = error.details.map(detail => {
          const field = detail.path.join('.');
          let message = detail.message;

          // Customize error messages
          switch (detail.type) {
            case 'any.required':
              message = `${field} is required`;
              break;
            case 'string.email':
              message = `${field} must be a valid email address`;
              break;
            case 'string.min':
              message = `${field} must be at least ${detail.context.limit} characters long`;
              break;
            case 'string.max':
              message = `${field} must not exceed ${detail.context.limit} characters`;
              break;
            case 'number.min':
              message = `${field} must be at least ${detail.context.limit}`;
              break;
            case 'number.max':
              message = `${field} must not exceed ${detail.context.limit}`;
              break;
            case 'any.only':
              message = `${field} must be one of: ${detail.context.valids.join(', ')}`;
              break;
          }

          return {
            source,
            field,
            message,
            value: detail.context.value,
            type: detail.type
          };
        });
        errors.push(...sourceErrors);
      } else {
        // Store validated data
        validatedData[source] = value;
      }
    });

    if (errors.length > 0) {
      // Log validation errors for debugging (in development)
      if (process.env.NODE_ENV === 'development') {
        console.log('Multi-source validation failed:', errors);
      }

      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Multi-source validation failed',
          details: errors,
          sources: Object.keys(schemas),
          timestamp: new Date().toISOString(),
          requestId: req.id || req.headers['x-request-id'] || 'unknown'
        }
      });
    }

    // Replace original data with validated data
    Object.keys(validatedData).forEach(source => {
      req[source] = validatedData[source];
    });

    // Add validation metadata to request
    if (!req.validationMeta) req.validationMeta = {};
    Object.keys(schemas).forEach(source => {
      req.validationMeta[source] = {
        validated: true,
        schema: schemas[source].describe(),
        timestamp: new Date().toISOString()
      };
    });

    next();
  };
};

/**
 * Conditional validation middleware - validates only if condition is met
 * @param {Function} condition - Function that returns true if validation should be applied
 * @param {Object} schema - Joi validation schema
 * @param {string} source - Source of data to validate
 * @param {Object} options - Additional validation options
 * @returns {Function} Express middleware function
 */
const validateIf = (condition, schema, source = 'body', options = {}) => {
  return (req, res, next) => {
    if (!condition(req)) {
      return next();
    }
    return validate(schema, source, options)(req, res, next);
  };
};

/**
 * Validation middleware that sanitizes input data
 * @param {Array} fields - Array of field names to sanitize
 * @param {string} source - Source of data to sanitize
 * @returns {Function} Express middleware function
 */
const sanitizeInput = (fields = [], source = 'body') => {
  return (req, res, next) => {
    if (!req[source]) return next();

    const data = req[source];

    fields.forEach(field => {
      if (data[field] && typeof data[field] === 'string') {
        // Basic XSS protection - remove script tags and dangerous characters
        data[field] = data[field]
          .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
          .replace(/javascript:/gi, '')
          .replace(/on\w+\s*=/gi, '')
          .trim();
      }
    });

    req[source] = data;
    next();
  };
};

/**
 * Request size validation middleware
 * @param {number} maxSize - Maximum request size in bytes
 * @returns {Function} Express middleware function
 */
const validateRequestSize = (maxSize = 10 * 1024 * 1024) => { // Default 10MB
  return (req, res, next) => {
    const contentLength = parseInt(req.headers['content-length'] || '0');

    if (contentLength > maxSize) {
      return res.status(413).json({
        success: false,
        error: {
          code: 'REQUEST_TOO_LARGE',
          message: `Request size exceeds maximum allowed size of ${(maxSize / (1024 * 1024)).toFixed(1)}MB`,
          maxSize: `${(maxSize / (1024 * 1024)).toFixed(1)}MB`,
          receivedSize: `${(contentLength / (1024 * 1024)).toFixed(1)}MB`,
          timestamp: new Date().toISOString()
        }
      });
    }

    next();
  };
};

module.exports = {
  validate,
  validateMultiple,
  validateIf,
  sanitizeInput,
  validateRequestSize
};