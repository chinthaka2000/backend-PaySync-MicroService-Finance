/**
 * Integration Tests for Loan API
 * @fileoverview Tests for loan API endpoints
 */

const request = require('supertest');
const app = require('../../index');
const {
  createTestStaff,
  createTestClient,
  createTestLoan,
  createTestRegion,
  createAuthHeaders,
  cleanupTestData
} = require('../utils/testHelpers');

describe('Loan API Integration Tests', () => {
  let agent, regionalManager, client, region;

  beforeEach(async () => {
    await cleanupTestData();

    // Create test data
    region = await createTestRegion({
      name: 'Test Region',
      code: 'TR001',
      districts: ['Colombo', 'Gampaha']
    });

    regionalManager = await createTestStaff({
      personalInfo: {
        firstName: 'Regional',
        lastName: 'Manager',
        email: 'rm@example.com'
      },
      role: 'regional_manager',
      region: region._id
    });

    agent = await createTestStaff({
      personalInfo: {
        firstName: 'Test',
        lastName: 'Agent',
        email: 'agent@example.com'
      },
      role: 'agent',
      region: region._id,
      assignedRegionalManager: regionalManager._id
    });

    client = await createTestClient({
      personalInfo: {
        firstName: 'Test',
        lastName: 'Client',
        email: 'client@example.com',
        district: 'Colombo',
        monthlyIncome: 100000
      },
      assignedAgent: agent._id
    });
  });

  describe('POST /api/loans', () => {
    /**
     * Test successful loan creation
     */
    it('should create loan application successfully', async () => {
      // Arrange
      const loanData = {
        clientUserId: client._id.toString(),
        loanAmount: 50000,
        loanTerm: 12,
        interestRate: 15,
        purpose: 'business',
        guarantorInfo: {
          name: 'John Guarantor',
          relationship: 'friend',
          phone: '9876543210'
        }
      };

      const headers = createAuthHeaders(agent);

      // Act
      const response = await request(app)
        .post('/api/loans')
        .set(headers)
        .send(loanData)
        .expect(201);

      // Assert
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Loan application created successfully');
      expect(response.body.data.loan.loanAmount).toBe(50000);
      expect(response.body.data.loan.loanStatus).toBe('pending');
      expect(response.body.data.loan.clientUserId).toBe(client._id.toString());
    });

    /**
     * Test loan creation with invalid amount
     */
    it('should reject loan with invalid amount', async () => {
      // Arrange
      const loanData = {
        clientUserId: client._id.toString(),
        loanAmount: -1000, // Invalid negative amount
        loanTerm: 12,
        interestRate: 15
      };

      const headers = createAuthHeaders(agent);

      // Act
      const response = await request(app)
        .post('/api/loans')
        .set(headers)
        .send(loanData)
        .expect(400);

      // Assert
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    /**
     * Test loan creation with non-existent client
     */
    it('should reject loan for non-existent client', async () => {
      // Arrange
      const loanData = {
        clientUserId: '507f1f77bcf86cd799439011', // Non-existent ID
        loanAmount: 50000,
        loanTerm: 12,
        interestRate: 15
      };

      const headers = createAuthHeaders(agent);

      // Act
      const response = await request(app)
        .post('/api/loans')
        .set(headers)
        .send(loanData)
        .expect(404);

      // Assert
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('CLIENT_NOT_FOUND');
    });

    /**
     * Test loan creation without authentication
     */
    it('should reject loan creation without authentication', async () => {
      // Arrange
      const loanData = {
        clientUserId: client._id.toString(),
        loanAmount: 50000,
        loanTerm: 12,
        interestRate: 15
      };

      // Act
      const response = await request(app)
        .post('/api/loans')
        .send(loanData)
        .expect(401);

      // Assert
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('NO_TOKEN');
    });
  });

  describe('GET /api/loans/regional', () => {
    /**
     * Test getting regional loans
     */
    it('should return regional loans for regional manager', async () => {
      // Arrange
      const loan1 = await createTestLoan({
        clientUserId: client._id,
        agentId: agent._id,
        loanAmount: 50000,
        loanStatus: 'pending'
      });

      const loan2 = await createTestLoan({
        clientUserId: client._id,
        agentId: agent._id,
        loanAmount: 75000,
        loanStatus: 'approved'
      });

      const headers = createAuthHeaders(regionalManager);

      // Act
      const response = await request(app)
        .get('/api/loans/regional')
        .set(headers)
        .expect(200);

      // Assert
      expect(response.body.success).toBe(true);
      expect(response.body.data.loans).toHaveLength(2);
      expect(response.body.data.pagination).toHaveProperty('totalCount');
      expect(response.body.data.pagination.totalCount).toBe(2);
    });

    /**
     * Test getting regional loans with filters
     */
    it('should return filtered regional loans', async () => {
      // Arrange
      await createTestLoan({
        clientUserId: client._id,
        agentId: agent._id,
        loanStatus: 'pending'
      });

      await createTestLoan({
        clientUserId: client._id,
        agentId: agent._id,
        loanStatus: 'approved'
      });

      const headers = createAuthHeaders(regionalManager);

      // Act
      const response = await request(app)
        .get('/api/loans/regional?status=pending')
        .set(headers)
        .expect(200);

      // Assert
      expect(response.body.success).toBe(true);
      expect(response.body.data.loans).toHaveLength(1);
      expect(response.body.data.loans[0].loanStatus).toBe('pending');
    });

    /**
     * Test unauthorized access to regional loans
     */
    it('should reject access from non-regional manager', async () => {
      // Arrange
      const headers = createAuthHeaders(agent);

      // Act
      const response = await request(app)
        .get('/api/loans/regional')
        .set(headers)
        .expect(403);

      // Assert
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INSUFFICIENT_PERMISSIONS');
    });
  });

  describe('PUT /api/loans/:id/status', () => {
    /**
     * Test successful loan approval
     */
    it('should approve loan successfully', async () => {
      // Arrange
      const loan = await createTestLoan({
        clientUserId: client._id,
        agentId: agent._id,
        loanStatus: 'pending'
      });

      const statusUpdate = {
        status: 'approved',
        comments: 'Loan approved after review'
      };

      const headers = createAuthHeaders(regionalManager);

      // Act
      const response = await request(app)
        .put(`/api/loans/${loan._id}/status`)
        .set(headers)
        .send(statusUpdate)
        .expect(200);

      // Assert
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Loan status updated successfully');
      expect(response.body.data.loan.loanStatus).toBe('approved');
    });

    /**
     * Test loan rejection
     */
    it('should reject loan successfully', async () => {
      // Arrange
      const loan = await createTestLoan({
        clientUserId: client._id,
        agentId: agent._id,
        loanStatus: 'pending'
      });

      const statusUpdate = {
        status: 'rejected',
        comments: 'Insufficient documentation'
      };

      const headers = createAuthHeaders(regionalManager);

      // Act
      const response = await request(app)
        .put(`/api/loans/${loan._id}/status`)
        .set(headers)
        .send(statusUpdate)
        .expect(200);

      // Assert
      expect(response.body.success).toBe(true);
      expect(response.body.data.loan.loanStatus).toBe('rejected');
    });

    /**
     * Test unauthorized status update
     */
    it('should reject status update from agent', async () => {
      // Arrange
      const loan = await createTestLoan({
        clientUserId: client._id,
        agentId: agent._id,
        loanStatus: 'pending'
      });

      const statusUpdate = {
        status: 'approved',
        comments: 'Attempting to approve'
      };

      const headers = createAuthHeaders(agent);

      // Act
      const response = await request(app)
        .put(`/api/loans/${loan._id}/status`)
        .set(headers)
        .send(statusUpdate)
        .expect(403);

      // Assert
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INSUFFICIENT_PERMISSIONS');
    });

    /**
     * Test invalid status transition
     */
    it('should reject invalid status transition', async () => {
      // Arrange
      const loan = await createTestLoan({
        clientUserId: client._id,
        agentId: agent._id,
        loanStatus: 'rejected'
      });

      const statusUpdate = {
        status: 'approved',
        comments: 'Trying to approve rejected loan'
      };

      const headers = createAuthHeaders(regionalManager);

      // Act
      const response = await request(app)
        .put(`/api/loans/${loan._id}/status`)
        .set(headers)
        .send(statusUpdate)
        .expect(400);

      // Assert
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INVALID_STATUS_TRANSITION');
    });
  });

  describe('GET /api/loans/statistics', () => {
    /**
     * Test getting loan statistics
     */
    it('should return loan statistics for regional manager', async () => {
      // Arrange
      await createTestLoan({
        clientUserId: client._id,
        agentId: agent._id,
        loanAmount: 50000,
        loanStatus: 'pending'
      });

      await createTestLoan({
        clientUserId: client._id,
        agentId: agent._id,
        loanAmount: 75000,
        loanStatus: 'approved'
      });

      await createTestLoan({
        clientUserId: client._id,
        agentId: agent._id,
        loanAmount: 25000,
        loanStatus: 'rejected'
      });

      const headers = createAuthHeaders(regionalManager);

      // Act
      const response = await request(app)
        .get('/api/loans/statistics')
        .set(headers)
        .expect(200);

      // Assert
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('totalLoans');
      expect(response.body.data).toHaveProperty('pendingLoans');
      expect(response.body.data).toHaveProperty('approvedLoans');
      expect(response.body.data).toHaveProperty('rejectedLoans');
      expect(response.body.data).toHaveProperty('totalAmount');
      expect(response.body.data.totalLoans).toBe(3);
      expect(response.body.data.pendingLoans).toBe(1);
      expect(response.body.data.approvedLoans).toBe(1);
      expect(response.body.data.rejectedLoans).toBe(1);
    });
  });

  describe('GET /api/loans/:id', () => {
    /**
     * Test getting loan details
     */
    it('should return loan details for authorized user', async () => {
      // Arrange
      const loan = await createTestLoan({
        clientUserId: client._id,
        agentId: agent._id,
        loanAmount: 50000,
        loanStatus: 'pending'
      });

      const headers = createAuthHeaders(agent);

      // Act
      const response = await request(app)
        .get(`/api/loans/${loan._id}`)
        .set(headers)
        .expect(200);

      // Assert
      expect(response.body.success).toBe(true);
      expect(response.body.data.loan._id).toBe(loan._id.toString());
      expect(response.body.data.loan.loanAmount).toBe(50000);
      expect(response.body.data.loan).toHaveProperty('clientUserId');
    });

    /**
     * Test getting non-existent loan
     */
    it('should return 404 for non-existent loan', async () => {
      // Arrange
      const headers = createAuthHeaders(agent);

      // Act
      const response = await request(app)
        .get('/api/loans/507f1f77bcf86cd799439011')
        .set(headers)
        .expect(404);

      // Assert
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('LOAN_NOT_FOUND');
    });
  });
});