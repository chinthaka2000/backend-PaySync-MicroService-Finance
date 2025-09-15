# Enhanced Validation System Documentation

## Overview

The PaySync backend now features a comprehensive validation system that provides robust data validation, file security, business rule enforcement, and enhanced error handling. This system ensures data integrity, security, and user-friendly error messages across all API endpoints.

## Features

### 1. Enhanced Validation Middleware

#### Core Validation Functions

- **`validate(schema, source, options)`** - Enhanced single-source validation with improved error messages
- **`validateMultiple(schemas, options)`** - Multi-source validation for body, params, and query
- **`validateIf(condition, schema, source, options)`** - Conditional validation based on request context
- **`sanitizeInput(fields, source)`** - XSS protection and input sanitization
- **`validateRequestSize(maxSize)`** - Request size validation middleware

#### Enhanced Error Handling

```javascript
// Example error response
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed for body",
    "details": [
      {
        "field": "email",
        "message": "email must be a valid email address",
        "value": "invalid-email",
        "type": "string.email",
        "source": "body"
      }
    ],
    "source": "body",
    "timestamp": "2024-01-01T00:00:00Z",
    "requestId": "req_123456789"
  }
}
```

### 2. Comprehensive Schema Validation

#### Available Schema Categories

1. **Authentication Schemas** (`authSchemas`)
   - Login validation
   - Password change validation
   - Token refresh validation
   - Role creation validation

2. **Loan Schemas** (`loanSchemas`)
   - Loan creation and updates
   - Payment processing
   - Status changes
   - Search and filtering

3. **Client Schemas** (`clientSchemas`)
   - Client registration
   - Approval/rejection workflows
   - Status updates

4. **Staff Schemas** (`staffSchemas`)
   - Staff creation and management
   - Role hierarchy validation
   - Profile updates

5. **Regional Admin Schemas** (`regionalAdminSchemas`)
   - Regional loan management
   - Region creation and updates
   - Agent assignments
   - Regional statistics

6. **System Schemas** (`systemSchemas`) - **NEW**
   - System settings configuration
   - Health check parameters
   - Audit log filtering

7. **Payment Schemas** (`paymentSchemas`) - **NEW**
   - Payment recording
   - Payment history queries
   - Payment method validation

8. **Report Schemas** (`reportSchemas`) - **NEW**
   - Report generation parameters
   - Filter validation
   - Format specifications

### 3. Enhanced File Validation

#### Security Features

- **Magic Number Validation** - Validates file content against declared MIME type
- **Dangerous Pattern Detection** - Blocks potentially harmful filenames
- **Enhanced Size Limits** - Configurable per file type
- **Executable File Blocking** - Prevents upload of executable files

#### File Type Configurations

```javascript
const FILE_TYPES = {
  DOCUMENTS: {
    mimeTypes: ['application/pdf', 'application/msword', ...],
    extensions: ['.pdf', '.doc', '.docx', '.txt'],
    maxSize: 5 * 1024 * 1024, // 5MB
    description: 'PDF, Word documents, or text files'
  },
  // ... other types
};
```

#### Available File Validators

- `validateClientDocuments` - ID cards, employment letters, etc.
- `validateAgreementDocuments` - PDF agreements only
- `validateDocuments` - General document uploads
- `validateImages` - Image files with size restrictions
- `validateLoanDocuments` - **NEW** - Loan-specific documents
- `validateProfileImages` - **NEW** - Profile pictures with strict limits

### 4. Enhanced Business Rules Validation

#### Core Business Rules

1. **Loan Application Validation**
   - Client eligibility checks
   - Debt-to-income ratio validation
   - Guarantor verification
   - Regional constraints

2. **Staff Creation Validation**
   - Role hierarchy enforcement
   - Email uniqueness
   - Regional assignments
   - Manager capacity limits

3. **Client Approval Validation**
   - Status transition rules
   - Regional authority checks
   - Document requirements

4. **Loan Status Updates**
   - Valid status transitions
   - Authorization levels
   - High-value loan approvals

#### New Business Rules

5. **Region Assignment Validation** - **NEW**
   - District conflict detection
   - Authorization checks
   - Assignment validation

6. **Payment Validation** - **NEW**
   - Loan status verification
   - Amount validation
   - Balance checks
   - Minimum payment enforcement

7. **Agent Assignment Validation** - **NEW**
   - Role verification
   - Regional matching
   - Manager capacity limits
   - Existing assignment checks

## Usage Examples

### Basic Validation

```javascript
const { validate, loanSchemas } = require('./validation');

// Single field validation
router.post('/loans', 
  validate(loanSchemas.createLoan.body),
  loanController.createLoan
);

// Multiple source validation
router.get('/loans/:id',
  validateMultiple({
    params: Joi.object({ id: objectId.required() }),
    query: loanSchemas.searchLoans.query
  }),
  loanController.getLoan
);
```

### Conditional Validation

```javascript
const { validateIf, systemSchemas } = require('./validation');

// Only validate if user is admin
router.put('/settings',
  validateIf(
    (req) => req.user.role === 'admin',
    systemSchemas.systemSettings.body
  ),
  settingsController.updateSettings
);
```

### File Upload with Validation

```javascript
const { validateClientDocuments } = require('./validation');

router.post('/clients/register',
  validateClientDocuments, // Handles file validation
  validate(clientSchemas.registerClient.body),
  clientController.register
);
```

### Business Rule Validation

```javascript
const { businessRules } = require('./validation');

// In controller
const loanValidation = await businessRules.validateLoanApplication(
  loanData, 
  req.user
);

if (!loanValidation.isValid) {
  return res.status(400).json({
    success: false,
    errors: loanValidation.errors
  });
}
```

### Input Sanitization

```javascript
const { sanitizeInput } = require('./validation');

router.post('/comments',
  sanitizeInput(['title', 'content', 'description']),
  validate(commentSchema),
  commentController.create
);
```

## Configuration Options

### Validation Options

```javascript
const options = {
  allowUnknown: false,     // Allow unknown fields
  stripUnknown: true,      // Remove unknown fields
  convert: true,           // Convert values (string to number, etc.)
  presence: 'optional',    // Default field presence
  joiOptions: {}          // Additional Joi options
};
```

### File Upload Options

```javascript
const fileOptions = {
  maxSize: 10 * 1024 * 1024,  // 10MB
  maxFiles: 5,                 // Maximum files per request
  maxFields: 20,               // Maximum form fields
  maxFieldNameSize: 100,       // Maximum field name length
  maxFieldSize: 1024 * 1024    // Maximum field value size
};
```

## Error Codes

### Validation Error Codes

- `VALIDATION_ERROR` - General validation failure
- `FILE_TOO_LARGE` - File exceeds size limit
- `INVALID_FILE_TYPE` - Unsupported file type
- `INVALID_FILE_CONTENT` - File content doesn't match declared type
- `FILENAME_TOO_LONG` - Filename exceeds length limit
- `INVALID_FILENAME` - Dangerous filename pattern
- `REQUEST_TOO_LARGE` - Request size exceeds limit

### Business Rule Error Codes

- `CLIENT_NOT_FOUND` - Referenced client doesn't exist
- `CLIENT_NOT_APPROVED` - Client not in approved status
- `EXISTING_ACTIVE_LOAN` - Client has existing active loan
- `HIGH_DEBT_TO_INCOME_RATIO` - Loan amount too high for income
- `UNAUTHORIZED_ROLE_CREATION` - User cannot create specified role
- `EMAIL_ALREADY_EXISTS` - Email address already in use
- `REGION_MANAGER_EXISTS` - Region already has a manager
- `CLIENT_OUTSIDE_REGION` - Client not in user's region

## Performance Considerations

### Optimization Features

1. **Schema Caching** - Joi schemas are compiled once and reused
2. **Efficient Validation** - Early termination on first error (configurable)
3. **Minimal Database Queries** - Business rules optimize database access
4. **Request Size Limits** - Prevent large request processing
5. **File Content Validation** - Quick magic number checks

### Best Practices

1. **Use Specific Schemas** - Don't use generic validation for specific endpoints
2. **Validate Early** - Place validation middleware before business logic
3. **Cache Results** - Cache business rule validation results when possible
4. **Log Validation Failures** - Monitor validation patterns for improvements
5. **Sanitize Input** - Always sanitize user input for XSS protection

## Security Features

### Input Security

- XSS protection through input sanitization
- SQL/NoSQL injection prevention
- File upload security with content validation
- Request size limits to prevent DoS attacks

### File Security

- Magic number validation prevents file type spoofing
- Dangerous filename pattern detection
- Executable file blocking
- Virus scanning integration points

### Business Logic Security

- Role hierarchy enforcement
- Regional data segregation
- Authorization level validation
- Audit trail for sensitive operations

## Testing

### Running Tests

```bash
# Basic validation tests
node test-validation.js

# Enhanced validation tests
node test-enhanced-validation.js
```

### Test Coverage

- ✅ Validation middleware functionality
- ✅ File upload validation and security
- ✅ Business rule enforcement
- ✅ Error handling and responses
- ✅ Schema validation for all categories
- ✅ Input sanitization and security
- ✅ Request size validation
- ✅ Conditional validation logic

## Migration Guide

### From Basic to Enhanced Validation

1. **Update Imports**
   ```javascript
   // Old
   const { validate } = require('./validation');
   
   // New
   const { validate, validateMultiple, sanitizeInput } = require('./validation');
   ```

2. **Add Request Size Validation**
   ```javascript
   app.use(validateRequestSize(10 * 1024 * 1024)); // 10MB limit
   ```

3. **Implement Input Sanitization**
   ```javascript
   router.post('/endpoint',
     sanitizeInput(['field1', 'field2']),
     validate(schema),
     controller.method
   );
   ```

4. **Use Enhanced Error Handling**
   - Error responses now include request IDs
   - More detailed error messages
   - Source information for multi-source validation

## Future Enhancements

### Planned Features

1. **Rate Limiting Integration** - Validation-aware rate limiting
2. **Caching Layer** - Cache validation results for performance
3. **Custom Validators** - Domain-specific validation functions
4. **Async Validation** - Database-dependent validation optimization
5. **Validation Metrics** - Performance and error rate monitoring

### Extension Points

- Custom business rule validators
- Additional file type support
- Integration with external validation services
- Custom error message templates
- Validation result caching strategies