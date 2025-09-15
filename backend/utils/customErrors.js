/**
 * Custom Error Classes for PaySync Application
 */

// Error code constants
const ERROR_CODES = {
  // Authentication & Authorization
  AUTH_ERROR: 'AUTH_ERROR',
  AUTHORIZATION_ERROR: 'AUTHORIZATION_ERROR',
  INVALID_TOKEN: 'INVALID_TOKEN',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  ACCOUNT_LOCKED: 'ACCOUNT_LOCKED',

  // Validation
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  BUSINESS_RULE_ERROR: 'BUSINESS_RULE_ERROR',
  INVALID_DATA: 'INVALID_DATA',
  DUPLICATE_FIELD: 'DUPLICATE_FIELD',

  // Resources
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT_ERROR: 'CONFLICT_ERROR',
  RESOURCE_LOCKED: 'RESOURCE_LOCKED',

  // Database
  DATABASE_ERROR: 'DATABASE_ERROR',
  CONNECTION_ERROR: 'CONNECTION_ERROR',
  TRANSACTION_ERROR: 'TRANSACTION_ERROR',

  // File Operations
  FILE_UPLOAD_ERROR: 'FILE_UPLOAD_ERROR',
  FILE_NOT_FOUND: 'FILE_NOT_FOUND',
  FILE_SIZE_ERROR: 'FILE_SIZE_ERROR',
  FILE_TYPE_ERROR: 'FILE_TYPE_ERROR',

  // External Services
  EMAIL_SERVICE_ERROR: 'EMAIL_SERVICE_ERROR',
  EXTERNAL_API_ERROR: 'EXTERNAL_API_ERROR',

  // System
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED'
};

class AppError extends Error {
  constructor(message, statusCode, errorCode = null, isOperational = true, details = null) {
    super(message);
    this.statusCode = statusCode;
    this.errorCode = errorCode || ERROR_CODES.INTERNAL_ERROR;
    this.isOperational = isOperational;
    this.timestamp = new Date().toISOString();
    this.details = details;
    this.requestId = null; // Will be set by middleware

    Error.captureStackTrace(this, this.constructor);
  }

  // Method to add request context
  setRequestContext(requestId, userId = null, ip = null) {
    this.requestId = requestId;
    this.userId = userId;
    this.ip = ip;
    return this;
  }

  // Method to serialize error for logging
  toJSON() {
    return {
      message: this.message,
      statusCode: this.statusCode,
      errorCode: this.errorCode,
      timestamp: this.timestamp,
      requestId: this.requestId,
      userId: this.userId,
      ip: this.ip,
      details: this.details,
      stack: this.stack
    };
  }
}

class ValidationError extends AppError {
  constructor(message, field = null, value = null) {
    super(message, 400, ERROR_CODES.VALIDATION_ERROR, true, { field, value });
    this.field = field;
    this.value = value;
  }
}

class AuthenticationError extends AppError {
  constructor(message = 'Authentication failed', attempts = null) {
    super(message, 401, ERROR_CODES.AUTH_ERROR, true, { attempts });
  }
}

class AuthorizationError extends AppError {
  constructor(message = 'Insufficient permissions', requiredRole = null, userRole = null) {
    super(message, 403, ERROR_CODES.AUTHORIZATION_ERROR, true, { requiredRole, userRole });
  }
}

class NotFoundError extends AppError {
  constructor(resource = 'Resource', resourceId = null) {
    super(`${resource} not found`, 404, ERROR_CODES.NOT_FOUND, true, { resource, resourceId });
  }
}

class ConflictError extends AppError {
  constructor(message = 'Resource conflict', conflictingField = null) {
    super(message, 409, ERROR_CODES.CONFLICT_ERROR, true, { conflictingField });
  }
}

class DatabaseError extends AppError {
  constructor(message = 'Database operation failed', operation = null, collection = null) {
    super(message, 500, ERROR_CODES.DATABASE_ERROR, false, { operation, collection });
  }
}

class FileUploadError extends AppError {
  constructor(message = 'File upload failed', fileName = null, fileSize = null) {
    super(message, 400, ERROR_CODES.FILE_UPLOAD_ERROR, true, { fileName, fileSize });
  }
}

class BusinessRuleError extends AppError {
  constructor(message, rule = null, context = null) {
    super(message, 422, ERROR_CODES.BUSINESS_RULE_ERROR, true, { rule, context });
  }
}

// Additional specialized error classes
class RateLimitError extends AppError {
  constructor(message = 'Rate limit exceeded', limit = null, resetTime = null) {
    super(message, 429, ERROR_CODES.RATE_LIMIT_EXCEEDED, true, { limit, resetTime });
  }
}

class ExternalServiceError extends AppError {
  constructor(message = 'External service error', service = null, statusCode = null) {
    super(message, 502, ERROR_CODES.EXTERNAL_API_ERROR, false, { service, statusCode });
  }
}

class EmailServiceError extends AppError {
  constructor(message = 'Email service error', recipient = null) {
    super(message, 500, ERROR_CODES.EMAIL_SERVICE_ERROR, false, { recipient });
  }
}

module.exports = {
  ERROR_CODES,
  AppError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ConflictError,
  DatabaseError,
  FileUploadError,
  BusinessRuleError,
  RateLimitError,
  ExternalServiceError,
  EmailServiceError
};