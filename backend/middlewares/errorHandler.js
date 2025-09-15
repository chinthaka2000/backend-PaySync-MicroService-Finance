/**
 * Global Error Handling Middleware
 */

const { AppError, ERROR_CODES } = require('../utils/customErrors');
const { logError, logger } = require('../utils/logger');
const { v4: uuidv4 } = require('uuid');

const handleCastErrorDB = (err) => {
  const message = `Invalid ${err.path}: ${err.value}`;
  return new AppError(message, 400, ERROR_CODES.INVALID_DATA, true, {
    path: err.path,
    value: err.value,
    kind: err.kind
  });
};

const handleDuplicateFieldsDB = (err) => {
  const duplicateField = Object.keys(err.keyValue)[0];
  const duplicateValue = err.keyValue[duplicateField];
  const message = `Duplicate field value: ${duplicateValue}. Please use another value for ${duplicateField}!`;
  return new AppError(message, 400, ERROR_CODES.DUPLICATE_FIELD, true, {
    field: duplicateField,
    value: duplicateValue
  });
};

const handleValidationErrorDB = (err) => {
  const errors = Object.values(err.errors).map(el => ({
    field: el.path,
    message: el.message,
    value: el.value
  }));
  const message = `Invalid input data. ${errors.map(e => e.message).join('. ')}`;
  return new AppError(message, 400, ERROR_CODES.VALIDATION_ERROR, true, { errors });
};

const handleJWTError = () =>
  new AppError('Invalid token. Please log in again!', 401, ERROR_CODES.INVALID_TOKEN);

const handleJWTExpiredError = () =>
  new AppError('Your token has expired! Please log in again.', 401, ERROR_CODES.TOKEN_EXPIRED);

const handleMongoServerError = (err) => {
  const message = 'Database server error occurred';
  return new AppError(message, 500, ERROR_CODES.DATABASE_ERROR, false, {
    originalError: err.message
  });
};

const handleMongoNetworkError = (err) => {
  const message = 'Database connection error';
  return new AppError(message, 503, ERROR_CODES.CONNECTION_ERROR, false, {
    originalError: err.message
  });
};

const sendErrorDev = (err, req, res) => {
  // Check if response has already been sent
  if (res.headersSent) {
    return;
  }

  // API Error - Enhanced development response
  if (req.originalUrl.startsWith('/api') || req.originalUrl.startsWith('/clientsAPI')) {
    return res.status(err.statusCode).json({
      success: false,
      error: {
        message: err.message,
        errorCode: err.errorCode,
        statusCode: err.statusCode,
        timestamp: err.timestamp,
        requestId: err.requestId,
        details: err.details,
        stack: err.stack,
        request: {
          method: req.method,
          url: req.originalUrl,
          ip: req.ip,
          userAgent: req.get('User-Agent'),
          userId: req.user?.id
        }
      }
    });
  }

  // Fallback for non-API routes
  logger.error('ERROR 💥', err);
  return res.status(err.statusCode).json({
    success: false,
    error: {
      message: err.message,
      errorCode: err.errorCode,
      timestamp: err.timestamp
    }
  });
};

const sendErrorProd = (err, req, res) => {
  // Check if response has already been sent
  if (res.headersSent) {
    return;
  }

  // API Error - Enhanced production response
  if (req.originalUrl.startsWith('/api') || req.originalUrl.startsWith('/clientsAPI')) {
    // Operational, trusted error: send message to client
    if (err.isOperational) {
      const response = {
        success: false,
        error: {
          message: err.message,
          errorCode: err.errorCode,
          timestamp: err.timestamp,
          requestId: err.requestId
        }
      };

      // Include details for validation errors
      if (err.errorCode === ERROR_CODES.VALIDATION_ERROR && err.details) {
        response.error.details = err.details;
      }

      return res.status(err.statusCode).json(response);
    }

    // Programming or other unknown error: don't leak error details
    logger.error('ERROR 💥', err);
    return res.status(500).json({
      success: false,
      error: {
        message: 'Something went wrong!',
        errorCode: ERROR_CODES.INTERNAL_ERROR,
        timestamp: new Date().toISOString(),
        requestId: err.requestId
      }
    });
  }

  // Fallback for non-API routes
  if (err.isOperational) {
    return res.status(err.statusCode).json({
      success: false,
      error: {
        message: err.message,
        errorCode: err.errorCode,
        timestamp: err.timestamp
      }
    });
  }

  logger.error('ERROR 💥', err);
  return res.status(err.statusCode).json({
    success: false,
    error: {
      message: 'Please try again later.',
      errorCode: ERROR_CODES.INTERNAL_ERROR,
      timestamp: new Date().toISOString()
    }
  });
};

// Request ID middleware to track requests
const addRequestId = (req, res, next) => {
  req.requestId = uuidv4();
  res.setHeader('X-Request-ID', req.requestId);
  next();
};

// Main error handler
const errorHandler = (err, req, res, next) => {
  // Check if response has already been sent
  if (res.headersSent) {
    return next(err);
  }

  // Set default values
  err.statusCode = err.statusCode || 500;
  err.status = err.status || 'error';

  // Add request context to error
  if (err instanceof AppError) {
    err.setRequestContext(
      req.requestId,
      req.user?.id,
      req.ip
    );
  }

  // Log the error with full context
  logError(err, req);

  if (process.env.NODE_ENV === 'development') {
    sendErrorDev(err, req, res);
  } else {
    let error = { ...err };
    error.message = err.message;
    error.requestId = req.requestId;

    // Handle specific error types
    if (error.name === 'CastError') error = handleCastErrorDB(error);
    if (error.code === 11000) error = handleDuplicateFieldsDB(error);
    if (error.name === 'ValidationError') error = handleValidationErrorDB(error);
    if (error.name === 'JsonWebTokenError') error = handleJWTError();
    if (error.name === 'TokenExpiredError') error = handleJWTExpiredError();
    if (error.name === 'MongoServerError') error = handleMongoServerError(error);
    if (error.name === 'MongoNetworkError') error = handleMongoNetworkError(error);

    sendErrorProd(error, req, res);
  }
};

module.exports = {
  errorHandler,
  addRequestId
};