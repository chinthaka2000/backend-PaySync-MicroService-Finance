/**
 * Test Helper Utilities
 * @fileoverview Common utilities and helpers for testing
 */

const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const Staff = require('../../models/Staff');
const Client = require('../../models/Client');
const Loan = require('../../models/Loan');
const Region = require('../../models/Region');

/**
 * Generate JWT token for testing
 * @param {Object} payload - Token payload
 * @param {string} secret - JWT secret (optional)
 * @returns {string} JWT token
 */
const generateTestToken = (payload, secret = 'test-secret') => {
  return jwt.sign(payload, secret, { expiresIn: '1h' });
};

/**
 * Create test staff member
 * @param {Object} overrides - Override default values
 * @returns {Promise<Object>} Created staff member
 */
const createTestStaff = async (overrides = {}) => {
  const defaultStaff = {
    personalInfo: {
      firstName: 'Test',
      lastName: 'User',
      email: 'test@example.com',
      phone: '1234567890',
      nic: 'TEST123456789V',
      address: 'Test Address'
    },
    role: 'agent',
    password: await bcrypt.hash('password123', 10),
    isActive: true,
    ...overrides
  };

  return await Staff.create(defaultStaff);
};

/**
 * Create test client
 * @param {Object} overrides - Override default values
 * @returns {Promise<Object>} Created client
 */
const createTestClient = async (overrides = {}) => {
  const defaultClient = {
    personalInfo: {
      firstName: 'Test',
      lastName: 'Client',
      email: 'client@example.com',
      phone: '9876543210',
      nic: 'CLIENT123456789V',
      address: 'Client Address',
      district: 'Colombo'
    },
    status: 'active',
    ...overrides
  };

  return await Client.create(defaultClient);
};

/**
 * Create test loan
 * @param {Object} overrides - Override default values
 * @returns {Promise<Object>} Created loan
 */
const createTestLoan = async (overrides = {}) => {
  const client = overrides.clientUserId || await createTestClient();
  const agent = overrides.agentId || await createTestStaff();

  const defaultLoan = {
    clientUserId: client._id || client,
    loanAmount: 50000,
    loanTerm: 12,
    interestRate: 15,
    loanStatus: 'pending',
    agentReview: {
      reviewedBy: agent._id || agent,
      reviewDate: new Date(),
      status: 'pending'
    },
    ...overrides
  };

  return await Loan.create(defaultLoan);
};

/**
 * Create test region
 * @param {Object} overrides - Override default values
 * @returns {Promise<Object>} Created region
 */
const createTestRegion = async (overrides = {}) => {
  const defaultRegion = {
    name: 'Test Region',
    code: 'TR001',
    districts: ['Colombo', 'Gampaha'],
    isActive: true,
    ...overrides
  };

  return await Region.create(defaultRegion);
};

/**
 * Create authenticated request headers
 * @param {Object} user - User object
 * @returns {Object} Headers with authorization
 */
const createAuthHeaders = (user) => {
  const token = generateTestToken({
    userId: user._id,
    email: user.personalInfo.email,
    role: user.role
  });

  return {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  };
};

/**
 * Clean up test data
 * @returns {Promise<void>}
 */
const cleanupTestData = async () => {
  await Promise.all([
    Staff.deleteMany({}),
    Client.deleteMany({}),
    Loan.deleteMany({}),
    Region.deleteMany({})
  ]);
};

/**
 * Mock request object
 * @param {Object} overrides - Override default values
 * @returns {Object} Mock request object
 */
const mockRequest = (overrides = {}) => {
  return {
    body: {},
    params: {},
    query: {},
    headers: {},
    user: null,
    ...overrides
  };
};

/**
 * Mock response object
 * @returns {Object} Mock response object
 */
const mockResponse = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.send = jest.fn().mockReturnValue(res);
  res.cookie = jest.fn().mockReturnValue(res);
  res.clearCookie = jest.fn().mockReturnValue(res);
  return res;
};

/**
 * Mock next function
 * @returns {Function} Mock next function
 */
const mockNext = () => jest.fn();

module.exports = {
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
};