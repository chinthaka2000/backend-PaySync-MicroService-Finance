# Enhanced Error Handling and Logging System

## Overview

This document describes the comprehensive error handling and logging system implemented for the PaySync backend. The system provides structured error handling, detailed logging, audit trails, and performance monitoring.

## Features

### 1. Custom Error Classes

#### Available Error Types
- `AppError` - Base error class with enhanced context
- `ValidationError` - Input validation errors
- `AuthenticationError` - Authentication failures
- `AuthorizationError` - Permission/authorization errors
- `NotFoundError` - Resource not found errors
- `ConflictError` - Resource conflict errors
- `DatabaseError` - Database operation errors
- `FileUploadError` - File upload/handling errors
- `BusinessRuleError` - Business logic violations
- `RateLimitError` - Rate limiting errors
- `ExternalServiceError` - External API errors
- `EmailServiceError` - Email service errors

#### Error Code Constants
```javascript
const ERROR_CODES = {
  AUTH_ERROR: 'AUTH_ERROR',
  AUTHORIZATION_ERROR: 'AUTHORIZATION_ERROR',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  DATABASE_ERROR: 'DATABASE_ERROR',
  // ... and more
};
```

### 2. Enhanced Error Context

Each error can include:
- Request ID for tracing
- User ID for audit trails
- IP address for security
- Detailed error information
- Timestamp
- Stack trace (in development)

#### Example Usage
```javascript
const error = new ValidationError('Invalid email format', 'email', 'invalid-email');
error.setRequestContext(req.requestId, req.user?.id, req.ip);
throw error;
```

### 3. Global Error Handler

The error handler provides:
- Consistent error response format
- Environment-specific error details
- Request ID tracking
- Comprehensive error logging
- Proper HTTP status codes

#### Response Format
```json
{
  "success": false,
  "error": {
    "message": "Validation failed",
    "errorCode": "VALIDATION_ERROR",
    "timestamp": "2025-08-31T05:04:22.851Z",
    "requestId": "a299eb39-af7e-427e-88b7-8fecacb1b34d",
    "details": {
      "field": "email",
      "value": "invalid-email"
    }
  }
}
```

### 4. Structured Logging System

#### Log Levels
- `error` - Error conditions
- `warn` - Warning conditions
- `info` - Informational messages
- `http` - HTTP request/response logging
- `debug` - Debug information
- `audit` - Audit trail events

#### Log Files
- `combined.log` - All log entries
- `error.log` - Error-level logs only
- `warn.log` - Warning-level logs
- `audit.log` - Audit trail events
- `security.log` - Security-related events
- `performance.log` - HTTP performance metrics

### 5. Audit Trail System

#### Audit Logging
```javascript
logAudit('USER_LOGIN', userId, {
  ip: req.ip,
  userAgent: req.get('User-Agent'),
  result: 'SUCCESS',
  requestId: req.requestId
});
```

#### Security Logging
```javascript
logSecurity('UNAUTHORIZED_ACCESS', userId, {
  ip: req.ip,
  result: 'BLOCKED',
  reason: 'Invalid token'
});
```

#### Business Operation Logging
```javascript
logBusinessOperation('LOAN_APPROVED', managerId, {
  loanId: 'loan-123',
  amount: 50000,
  clientId: 'client-456'
});
```

### 6. Performance Monitoring

The system includes:
- Request/response time tracking
- HTTP method and status code logging
- User and IP tracking
- Content length monitoring

## Implementation

### Middleware Integration

```javascript
// In index.js
const { errorHandler, addRequestId } = require('./middlewares/errorHandler');
const performanceMonitor = require('./middlewares/performanceMonitor');

// Apply middleware in order
app.use(addRequestId);           // Add request ID
app.use(performanceMonitor);     // Monitor performance
// ... other middleware
app.use(errorHandler);           // Global error handler (must be last)
```

### Using Custom Errors

```javascript
// In controllers
const { ValidationError, NotFoundError } = require('../utils/customErrors');

// Validation error
if (!email || !isValidEmail(email)) {
  throw new ValidationError('Invalid email format', 'email', email);
}

// Not found error
const user = await User.findById(userId);
if (!user) {
  throw new NotFoundError('User', userId);
}
```

### Logging in Controllers

```javascript
const { logAudit, logBusinessOperation } = require('../utils/logger');

// Audit sensitive operations
logAudit('USER_CREATED', req.user.id, {
  ip: req.ip,
  userAgent: req.get('User-Agent'),
  resource: 'user',
  resourceId: newUser._id,
  result: 'SUCCESS',
  requestId: req.requestId
});

// Log business operations
logBusinessOperation('LOAN_APPLICATION_SUBMITTED', req.user.id, {
  loanId: loan._id,
  amount: loan.loanAmount,
  clientId: loan.clientUserId
});
```

## Configuration

### Environment Variables

```bash
# Logging configuration
LOG_LEVEL=info                    # Log level (error, warn, info, http, debug)
NODE_ENV=production              # Environment (development/production)
```

### Log File Configuration

Log files are automatically rotated when they reach size limits:
- Error logs: 10MB, keep 10 files
- Combined logs: 10MB, keep 10 files
- Audit logs: 20MB, keep 20 files
- Performance logs: 10MB, keep 5 files

## Security Considerations

### Sensitive Data Protection
- Passwords and tokens are never logged
- Personal information is masked in logs
- Stack traces are only shown in development

### Audit Trail Integrity
- Audit logs are tamper-evident
- Critical security events are logged to separate files
- Failed authentication attempts are tracked

## Monitoring and Alerting

### Log Analysis
Use log aggregation tools to monitor:
- Error rates and patterns
- Performance metrics
- Security events
- Business operation trends

### Key Metrics to Monitor
- Error rate by endpoint
- Average response times
- Failed authentication attempts
- Database operation failures
- External service errors

## Testing

### Running Tests

```bash
# Test error classes and logging
node test-error-logging.js

# Test API error handling
node test-api-error-handling.js
```

### Test Coverage
- Custom error class creation
- Error context setting
- Structured logging
- Audit trail logging
- Security event logging
- API error responses
- Performance monitoring

## Best Practices

### Error Handling
1. Use specific error types for different scenarios
2. Include relevant context in error details
3. Set appropriate HTTP status codes
4. Log errors with full context

### Logging
1. Use appropriate log levels
2. Include request IDs for tracing
3. Log business operations for audit trails
4. Avoid logging sensitive information

### Performance
1. Monitor response times
2. Track database query performance
3. Log slow operations
4. Monitor memory usage

## Troubleshooting

### Common Issues

#### High Error Rates
- Check error logs for patterns
- Monitor database connectivity
- Verify external service availability

#### Performance Issues
- Review performance logs
- Check database query times
- Monitor memory usage

#### Security Concerns
- Review security logs
- Check for unusual access patterns
- Monitor failed authentication attempts

### Log File Management
- Logs are automatically rotated
- Old log files are compressed
- Monitor disk space usage

## Future Enhancements

### Planned Features
- Real-time error alerting
- Log aggregation integration
- Performance dashboards
- Automated error analysis

### Integration Options
- ELK Stack (Elasticsearch, Logstash, Kibana)
- Splunk integration
- CloudWatch integration
- Custom monitoring dashboards