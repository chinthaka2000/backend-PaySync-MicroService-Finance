/**
 * Jest Configuration for PaySync Backend
 * @fileoverview Configuration for Jest testing framework
 */

module.exports = {
  // Test environment
  testEnvironment: 'node',

  // Test file patterns
  testMatch: [
    '**/tests/**/*.test.js',
    '**/tests/**/*.spec.js'
  ],

  // Setup files
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],

  // Coverage configuration
  collectCoverageFrom: [
    'controllers/**/*.js',
    'services/**/*.js',
    'repositories/**/*.js',
    'utils/**/*.js',
    'middlewares/**/*.js',
    'validation/**/*.js',
    '!**/node_modules/**',
    '!**/tests/**',
    '!**/logs/**'
  ],

  // Coverage thresholds
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70
    }
  },

  // Test timeout
  testTimeout: 30000,

  // Clear mocks between tests
  clearMocks: true,

  // Verbose output
  verbose: true
};