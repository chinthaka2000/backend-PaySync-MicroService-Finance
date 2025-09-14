# Enhanced Comprehensive Validation System

This document describes the enhanced comprehensive validation system implemented for the PaySync backend. The system provides multiple layers of validation to ensure data integrity, security, and business rule compliance.

## 🚀 Recent Enhancements

The validation system has been significantly enhanced with:
- **Advanced middleware functions** (conditional validation, input sanitization, request size limits)
- **Enhanced file security** (magic number validation, dangerous pattern detection)
- **Extended business rules** (region assignment, payment validation, agent assignment)
- **New schema categories** (system, payment, report schemas)
- **Improved error handling** (detailed messages, request tracking, better UX)

See [ENHANCED_VALIDATION_README.md](./ENHANCED_VALIDATION_README.md) for complete enhancement documentation.

## Overview

The validation system consists of four main components:

1. **Request Validation** - Schema-based validation using Joi
2. **File Upload Validation** - Type, size, and security validation for file uploads
3. **Business Rules Validation** - Complex business logic validation
4. **Integration Middleware** - Seamless integration with Express routes

## Architecture

```
Request → Schema Validation → File Validation → Business Rules → Controller
    ↓           ↓                   ↓               ↓
Error Handler ←─────────────────────────────────────┘
```

## Components

### 1. Request Validation (`middlewares/validation.js`)

Provides middleware functions for validating request data using Joi schemas.

#### Functions

- `validate(schema, source)` - Validates single source (body, params, query)
- `validateMultiple(schemas)` - Validates multiple sources simultaneously

#### Usage

```javascript
const { validate, validateMultiple } = require('../validation');
const { loanSchemas } = require('../validation');

// Single source validation
router.post('/loans', 
  validate(loanSchemas.createLoan.body),
  loanController.createLoan
);

// Multiple source validation
router.get('/loans/:id', 
  validateMultiple({
    params: loanSchemas.getLoanById.params,
    query: loanSchemas.searchLoans.query
  }),
  loanController.getLoanById
);
```

### 2. Validation Schemas (`validation/schemas.js`)

Comprehensive Joi schemas for all API endpoints.

#### Schema Categories

- **Authentication Schemas** (`authSchemas`)
  - Login validation
  - Password change validation
  - Token refresh validation

- **Loan Schemas** (`loanSchemas`)
  - Loan creation validation
  - Loan status updates
  - Payment processing
  - Search and filtering

- **Client Schemas** (`clientSchemas`)
  - Client registration
  - Client approval/rejection
  - Status updates

- **Staff Schemas** (`staffSchemas`)
  - Staff creation
  - Profile updates
  - Role assignments

- **Regional Admin Schemas** (`regionalAdminSchemas`)
  - Regional operations
  - Agent assignments
  - Region management

#### Custom Validators

```javascript
const objectId = Joi.string().pattern(/^[0-9a-fA-F]{24}$/).message('Invalid ObjectId format');
const email = Joi.string().email().lowercase();
const phone = Joi.string().pattern(/^[0-9+\-\s()]+$/).min(10).max(15);
const password = Joi.string().min(8).pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/);
```

### 3. File Upload Validation (`validation/fileValidation.js`)

Secure file upload validation with type, size, and security checks.

#### File Type Configurations

- **DOCUMENTS** - PDF, Word documents, text files (5MB limit)
- **IMAGES** - JPEG, PNG, GIF, WebP images (2MB limit)
- **ID_DOCUMENTS** - ID cards, certificates (3MB limit)
- **AGREEMENTS** - PDF agreements only (10MB limit)

#### Security Features

- File type validation (MIME type + extension)
- File size limits
- Filename sanitization
- Dangerous pattern detection
- Virus scanning integration ready

#### Usage

```javascript
const { validateClientDocuments, validateAgreements } = require('../validation');

// Client document upload
router.post('/clients/register', 
  validateClientDocuments,
  clientController.registerClient
);

// Agreement upload
router.post('/agreements/upload', 
  validateAgreements,
  agreementController.uploadAgreement
);
```

### 4. Business Rules Validation (`validation/businessRules.js`)

Complex business logic validation functions.

#### Available Validations

- **Loan Application Validation**
  - Client eligibility checks
  - Debt-to-income ratio validation
  - Guarantor validation
  - Regional constraints
  - Loan amount limits

- **Staff Creation Validation**
  - Role hierarchy validation
  - Email uniqueness
  - Region assignment rules
  - Manager assignment validation

- **Client Approval Validation**
  - Status transition rules
  - Regional constraints
  - Required document checks

- **Loan Status Update Validation**
  - Valid status transitions
  - Authorization checks
  - High-value loan approvals

#### Usage

```javascript
const { validateLoanApplication } = require('../validation/businessRules');

exports.createLoan = async (req, res) => {
  const validation = await validateLoanApplication(req.body, req.user);
  
  if (!validation.isValid) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'BUSINESS_RULE_VIOLATION',
        details: validation.errors
      }
    });
  }
  
  // Proceed with loan creation
};
```

## Error Response Format

All validation errors follow a consistent format:

```javascript
{
  success: false,
  error: {
    code: 'VALIDATION_ERROR',
    message: 'Validation failed',
    details: [
      {
        field: 'loanAmount',
        message: 'Loan amount must be between 1000 and 10000000',
        value: 500,
        source: 'body' // Optional: indicates source (body, params, query)
      }
    ],
    timestamp: '2024-01-01T00:00:00Z',
    requestId: 'req_123456789' // Optional: for request tracking
  }
}
```

## Integration Examples

### Complete Route Integration

```javascript
const express = require('express');
const router = express.Router();
const { 
  validate, 
  validateMultiple, 
  loanSchemas, 
  validateClientDocuments,
  validateLoanApplication 
} = require('../validation');

// Loan creation with full validation
router.post('/loans',
  authenticate,
  requirePermissions(PERMISSIONS.CREATE_LOAN),
  validateClientDocuments, // File validation
  validate(loanSchemas.createLoan.body), // Schema validation
  async (req, res, next) => {
    // Business rule validation
    const validation = await validateLoanApplication(req.body, req.user);
    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'BUSINESS_RULE_VIOLATION',
          details: validation.errors
        }
      });
    }
    next();
  },
  loanController.createLoan
);
```

### Controller Integration

```javascript
exports.createLoan = async (req, res) => {
  try {
    // Data is already validated by middleware
    const loanData = req.body; // Sanitized and validated
    const files = req.files; // Validated file uploads
    
    // Create loan with confidence in data integrity
    const loan = new Loan({
      ...loanData,
      auditTrail: [{
        action: 'loan_created',
        performedBy: req.user.userId,
        timestamp: new Date(),
        ipAddress: req.ip
      }]
    });
    
    await loan.save();
    
    res.status(201).json({
      success: true,
      data: { loan },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Error creating loan',
        timestamp: new Date().toISOString()
      }
    });
  }
};
```

## Configuration

### Environment Variables

```bash
# File upload limits
MAX_FILE_SIZE_MB=10
MAX_FILES_PER_REQUEST=10

# Validation settings
ENABLE_STRICT_VALIDATION=true
VALIDATION_LOG_LEVEL=info

# Business rules
MAX_LOAN_AMOUNT=10000000
MIN_LOAN_AMOUNT=1000
MAX_DTI_RATIO=40
```

### Customization

#### Adding New Validation Schemas

```javascript
// In validation/schemas.js
const newFeatureSchemas = {
  createFeature: {
    body: Joi.object({
      name: Joi.string().min(2).max(100).required(),
      description: Joi.string().max(500).optional()
    })
  }
};

module.exports = {
  // ... existing schemas
  newFeatureSchemas
};
```

#### Adding New Business Rules

```javascript
// In validation/businessRules.js
const validateNewFeature = async (featureData, user) => {
  const errors = [];
  
  // Custom validation logic
  if (someCondition) {
    errors.push({
      field: 'fieldName',
      message: 'Validation message',
      code: 'VALIDATION_CODE'
    });
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

module.exports = {
  // ... existing functions
  validateNewFeature
};
```

## Testing

The validation system includes comprehensive tests:

```bash
# Run validation tests
node test-validation.js

# Expected output:
# ✅ Validation system is working correctly
# ✅ File validation is properly configured
# ✅ Business rules are implemented
# ✅ All schemas are validating correctly
```

## Performance Considerations

1. **Schema Compilation** - Joi schemas are compiled once and reused
2. **Async Validation** - Business rules use async/await for database operations
3. **Error Short-Circuiting** - Validation stops on first critical error when configured
4. **Memory Management** - File uploads are streamed to prevent memory issues

## Security Features

1. **Input Sanitization** - All inputs are sanitized and validated
2. **File Security** - Comprehensive file type and content validation
3. **SQL/NoSQL Injection Prevention** - Schema validation prevents injection attacks
4. **XSS Protection** - Input sanitization removes malicious scripts
5. **Rate Limiting Integration** - Works with rate limiting middleware

## Best Practices

1. **Always validate at the route level** before reaching controllers
2. **Use business rule validation** for complex logic
3. **Provide clear error messages** for better user experience
4. **Log validation failures** for monitoring and debugging
5. **Keep schemas up to date** with API changes
6. **Test validation thoroughly** with edge cases

## Troubleshooting

### Common Issues

1. **Schema Validation Fails**
   - Check field names match exactly
   - Verify data types are correct
   - Ensure required fields are provided

2. **File Upload Validation Fails**
   - Check file type is in allowed list
   - Verify file size is within limits
   - Ensure filename doesn't contain invalid characters

3. **Business Rule Validation Fails**
   - Check database connectivity
   - Verify user permissions
   - Ensure related records exist

### Debug Mode

Enable debug logging:

```javascript
process.env.VALIDATION_DEBUG = 'true';
```

This will log detailed validation information to help troubleshoot issues.