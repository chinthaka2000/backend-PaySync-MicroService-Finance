# PaySync Backend Testing Guide

## Overview

This document provides comprehensive guidance for testing the PaySync backend application. The testing setup includes unit tests, integration tests, and API endpoint testing using Jest and Supertest.

## Testing Framework

- **Jest**: Primary testing framework for unit and integration tests
- **Supertest**: HTTP assertion library for API endpoint testing
- **MongoDB Memory Server**: In-memory MongoDB for isolated testing
- **Test Helpers**: Custom utilities for creating test data and mocking

## Test Structure

```
tests/
├── setup.js                 # Global test setup and configuration
├── utils/
│   └── testHelpers.js       # Test utility functions and helpers
├── unit/                    # Unit tests
│   ├── controllers/         # Controller unit tests
│   ├── services/           # Service unit tests
│   ├── utils/              # Utility function tests
│   └── validation/         # Validation logic tests
└── integration/            # Integration tests
    ├── auth.test.js        # Authentication API tests
    ├── loans.test.js       # Loan management API tests
    └── clients.test.js     # Client management API tests
```

## Running Tests

### All Tests
```bash
npm test
```

### Unit Tests Only
```bash
npm run test:unit
```

### Integration Tests Only
```bash
npm run test:integration
```

### Watch Mode (for development)
```bash
npm run test:watch
```

### Coverage Report
```bash
npm run test:coverage
```

### Specific Test File
```bash
npm test -- --testPathPattern=loanController.test.js
```

### Verbose Output
```bash
npm test -- --verbose
```

## Test Configuration

### Jest Configuration (jest.config.js)

```javascript
module.exports = {
  testEnvironment: 'node',
  testMatch: [
    '**/tests/**/*.test.js',
    '**/tests/**/*.spec.js'
  ],
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
  collectCoverageFrom: [
    'controllers/**/*.js',
    'services/**/*.js',
    'repositories/**/*.js',
    'utils/**/*.js',
    'middlewares/**/*.js',
    'validation/**/*.js'
  ],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70
    }
  },
  testTimeout: 30000,
  clearMocks: true,
  verbose: true
};
```

### Global Setup (tests/setup.js)

The setup file configures:
- In-memory MongoDB database for testing
- Database cleanup between tests
- Global test timeout settings
- Test environment variables

## Writing Unit Tests

### Controller Tests

Unit tests for controllers should mock all dependencies and focus on business logic:

```javascript
const controller = require('../../../controllers/loanController');
const Loan = require('../../../models/Loan');
const { mockRequest, mockResponse } = require('../../utils/testHelpers');

// Mock dependencies
jest.mock('../../../models/Loan');

describe('LoanController', () => {
  let req, res;

  beforeEach(() => {
    req = mockRequest();
    res = mockResponse();
    jest.clearAllMocks();
  });

  describe('createLoanApplication', () => {
    it('should create loan with valid data', async () => {
      // Arrange
      const loanData = { /* test data */ };
      req.body = loanData;
      req.user = { userId: 'test123', role: 'agent' };

      Loan.create.mockResolvedValue({ _id: 'loan123', ...loanData });

      // Act
      await controller.createLoanApplication(req, res);

      // Assert
      expect(Loan.create).toHaveBeenCalledWith(expect.objectContaining(loanData));
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true
      }));
    });
  });
});
```

### Service Tests

Test business logic in services:

```javascript
const emailService = require('../../../services/emailService');

describe('EmailService', () => {
  describe('sendLoanStatusNotification', () => {
    it('should send email with correct template', async () => {
      // Test email service functionality
    });
  });
});
```

### Validation Tests

Test business rules and validation logic:

```javascript
const { validateLoanApplication } = require('../../../validation/businessRules');

describe('Business Rules Validation', () => {
  describe('validateLoanApplication', () => {
    it('should validate correct loan application', async () => {
      const loanData = {
        loanAmount: 50000,
        loanTerm: 12,
        clientUserId: 'client123'
      };
      
      const result = await validateLoanApplication(loanData);
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });
});
```

## Writing Integration Tests

### API Endpoint Tests

Integration tests should test complete request/response cycles:

```javascript
const request = require('supertest');
const app = require('../../index');
const { createTestStaff, createAuthHeaders } = require('../utils/testHelpers');

describe('Authentication API', () => {
  describe('POST /api/auth/login', () => {
    it('should login with valid credentials', async () => {
      // Arrange
      const testUser = await createTestStaff({
        personalInfo: { email: 'test@example.com' },
        password: 'hashedPassword'
      });

      // Act
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'password123'
        })
        .expect(200);

      // Assert
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('token');
    });
  });
});
```

## Test Helpers and Utilities

### Available Test Helpers

```javascript
const {
  generateTestToken,
  createTestStaff,
  createTestClient,
  createTestLoan,
  createTestRegion,
  createAuthHeaders,
  cleanupTestData,
  mockRequest,
  mockResponse,
  mockNext
} = require('../utils/testHelpers');
```

### Creating Test Data

```javascript
// Create test staff member
const agent = await createTestStaff({
  personalInfo: { email: 'agent@example.com' },
  role: 'agent'
});

// Create test client
const client = await createTestClient({
  personalInfo: { email: 'client@example.com' },
  assignedAgent: agent._id
});

// Create test loan
const loan = await createTestLoan({
  clientUserId: client._id,
  agentId: agent._id,
  loanAmount: 50000
});
```

### Authentication Headers

```javascript
const headers = createAuthHeaders(user);

const response = await request(app)
  .get('/api/protected-endpoint')
  .set(headers)
  .expect(200);
```

## Mocking Strategies

### External Services

Mock external services to avoid dependencies:

```javascript
jest.mock('../../../services/emailService', () => ({
  sendEmail: jest.fn().mockResolvedValue({ success: true }),
  sendLoanStatusNotification: jest.fn().mockResolvedValue({ success: true })
}));
```

### Database Models

Mock Mongoose models for unit tests:

```javascript
jest.mock('../../../models/Loan', () => ({
  create: jest.fn(),
  findById: jest.fn(),
  find: jest.fn(),
  findOne: jest.fn()
}));
```

### Middleware

Mock authentication middleware:

```javascript
jest.mock('../../../middlewares/authMiddleware', () => ({
  authenticateToken: (req, res, next) => {
    req.user = { userId: 'test123', role: 'agent' };
    next();
  }
}));
```

## Test Data Management

### Database Cleanup

Tests automatically clean up data between runs:

```javascript
afterEach(async () => {
  await cleanupTestData();
});
```

### Test Isolation

Each test should be independent:
- Use fresh test data for each test
- Mock external dependencies
- Clean up after each test

## Coverage Requirements

Minimum coverage thresholds:
- **Branches**: 70%
- **Functions**: 70%
- **Lines**: 70%
- **Statements**: 70%

### Viewing Coverage

```bash
npm run test:coverage
```

Coverage reports are generated in the `coverage/` directory.

## Best Practices

### Test Organization

1. **Arrange-Act-Assert**: Structure tests clearly
2. **Descriptive Names**: Use clear, descriptive test names
3. **Single Responsibility**: Each test should test one thing
4. **Independent Tests**: Tests should not depend on each other

### Test Data

1. **Minimal Data**: Use only the data needed for the test
2. **Realistic Data**: Use realistic test data
3. **Edge Cases**: Test boundary conditions
4. **Error Cases**: Test error scenarios

### Mocking

1. **Mock External Dependencies**: Don't test external services
2. **Mock at Boundaries**: Mock at service/repository boundaries
3. **Verify Interactions**: Assert that mocks are called correctly
4. **Reset Mocks**: Clear mocks between tests

### Performance

1. **Fast Tests**: Keep tests fast and focused
2. **Parallel Execution**: Tests should be parallelizable
3. **Resource Cleanup**: Clean up resources after tests
4. **Timeout Handling**: Set appropriate timeouts

## Debugging Tests

### Running Single Test

```bash
npm test -- --testNamePattern="should create loan with valid data"
```

### Debug Mode

```bash
node --inspect-brk node_modules/.bin/jest --runInBand --testPathPattern=loanController.test.js
```

### Verbose Logging

```bash
npm test -- --verbose --no-coverage
```

### Test Output

Use `console.log` sparingly in tests. Prefer Jest's built-in matchers for better error messages.

## Continuous Integration

### GitHub Actions

```yaml
name: Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
        with:
          node-version: '18'
      - run: npm install
      - run: npm test
      - run: npm run test:coverage
```

### Pre-commit Hooks

```json
{
  "husky": {
    "hooks": {
      "pre-commit": "npm test"
    }
  }
}
```

## Common Issues and Solutions

### MongoDB Connection Issues

If tests fail with MongoDB connection errors:
1. Ensure MongoDB Memory Server is properly installed
2. Check that ports are not in use
3. Verify test timeout settings

### Memory Leaks

If tests show memory warnings:
1. Ensure proper cleanup in `afterEach` hooks
2. Close database connections
3. Clear timers and intervals

### Flaky Tests

If tests are inconsistent:
1. Check for race conditions
2. Ensure proper async/await usage
3. Add appropriate delays for async operations

### Mock Issues

If mocks aren't working:
1. Verify mock placement (before imports)
2. Check mock reset between tests
3. Ensure correct mock syntax

## Resources

- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [Supertest Documentation](https://github.com/visionmedia/supertest)
- [MongoDB Memory Server](https://github.com/nodkz/mongodb-memory-server)
- [Testing Best Practices](https://github.com/goldbergyoni/javascript-testing-best-practices)