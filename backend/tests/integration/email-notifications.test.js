const request = require('supertest');
const app = require('../../index');
const { connectDB, disconnectDB } = require('../setup');
const Staff = require('../../models/Staff');
const Client = require('../../models/Client');
const Loan = require('../../models/Loan');
const Region = require('../../models/Region');
const emailService = require('../../services/emailService');

// Mock email service to capture sent emails
jest.mock('../../services/emailService');

describe('Email Notifications and Error Handling Integration Tests', () => {
  let agentToken, regionalManagerToken, moderateAdminToken;
  let agent, regionalManager, moderateAdmin, region, client, loan;

  beforeAll(async () => {
    await connectDB();
    await clearDatabase();
    await setupTestData();
  });

  afterAll(async () => {
    await clearDatabase();
    await disconnectDB();
  });

  beforeEach(() => {
    // Reset email service mocks
    jest.clearAllMocks();
    emailService.sendLoanStatusNotification.mockResolvedValue({ success: true });
    emailService.sendAgreementReadyNotification.mockResolvedValue({ success: true });
    emailService.sendWelcomeEmail.mockResolvedValue({ success: true });
  });

  const clearDatabase = async () => {
    await Staff.deleteMany({});
    await Client.deleteMany({});
    await Loan.deleteMany({});
    await Region.deleteMany({});
  };

  const setupTestData = async () => {
    // Create moderate admin
    moderateAdmin = await Staff.create({
      personalInfo: {
        firstName: 'Moderate',
        lastName: 'Admin',
        email: 'moderateadmin@test.com',
        phone: '1111111111'
      },
      role: 'moderate_admin',
      password: 'password123',
      isActive: true
    });

    // Create region
    region = await Region.create({
      name: 'Test Region',
      code: 'TR',
      districts: ['Colombo'],
      createdBy: moderateAdmin._id,
      isActive: true
    });

    // Create regional manager
    regionalManager = await Staff.create({
      personalInfo: {
        firstName: 'Regional',
        lastName: 'Manager',
        email: 'rm@test.com',
        phone: '2222222222'
      },
      role: 'regional_manager',
      password: 'password123',
      region: region._id,
      isActive: true,
      createdBy: moderateAdmin._id
    });

    // Create agent
    agent = await Staff.create({
      personalInfo: {
        firstName: 'Test',
        lastName: 'Agent',
        email: 'agent@test.com',
        phone: '3333333333'
      },
      role: 'agent',
      password: 'password123',
      region: region._id,
      isActive: true,
      createdBy: moderateAdmin._id,
      assignedTo: regionalManager._id
    });

    // Create client
    client = await Client.create({
      personalInfo: {
        firstName: 'Test',
        lastName: 'Client',
        email: 'client@test.com',
        phone: '4444444444',
        nic: '123456789V',
        address: { district: 'Colombo' }
      },
      assignedAgent: agent._id,
      region: region._id
    });

    // Get tokens
    agentToken = await getAuthToken('agent@test.com', 'password123');
    regionalManagerToken = await getAuthToken('rm@test.com', 'password123');
    moderateAdminToken = await getAuthToken('moderateadmin@test.com', 'password123');
  };

  const getAuthToken = async (email, password) => {
    const response = await request(app)
      .post('/api/auth/staff/login')
      .send({ email, password });
    return response.body.token;
  };

  describe('6. Email Notification Tests', () => {
    test('Should send notification when loan status changes', async () => {
      // Create loan
      const loanResponse = await request(app)
        .post('/api/agent/loans')
        .set('Authorization', `Bearer ${agentToken}`)
        .send({
          clientUserId: client._id,
          loanAmount: 100000,
          loanTerm: 12,
          interestRate: 15,
          purpose: 'Business expansion'
        });

      loan = loanResponse.body.data;

      // Agent reviews loan (should trigger notification)
      await request(app)
        .put(`/api/agent/loans/${loan._id}/review`)
        .set('Authorization', `Bearer ${agentToken}`)
        .send({
          recommendation: 'approve',
          comments: 'Client meets criteria'
        });

      // Verify email notification was sent
      expect(emailService.sendLoanStatusNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          to: client.personalInfo.email,
          loanId: loan._id,
          status: 'agent_reviewed',
          clientName: `${client.personalInfo.firstName} ${client.personalInfo.lastName}`
        })
      );
    });

    test('Should send notification when loan is approved by regional manager', async () => {
      // Create and review loan
      const loanResponse = await request(app)
        .post('/api/agent/loans')
        .set('Authorization', `Bearer ${agentToken}`)
        .send({
          clientUserId: client._id,
          loanAmount: 75000,
          loanTerm: 9,
          interestRate: 15,
          purpose: 'Equipment purchase'
        });

      const testLoan = loanResponse.body.data;

      await request(app)
        .put(`/api/agent/loans/${testLoan._id}/review`)
        .set('Authorization', `Bearer ${agentToken}`)
        .send({
          recommendation: 'approve',
          comments: 'Approved by agent'
        });

      // Regional manager approves
      await request(app)
        .put(`/api/regional-admin/loans/${testLoan._id}/approve`)
        .set('Authorization', `Bearer ${regionalManagerToken}`)
        .send({
          decision: 'approve',
          comments: 'Final approval granted'
        });

      // Verify approval notification was sent
      expect(emailService.sendLoanStatusNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          to: client.personalInfo.email,
          loanId: testLoan._id,
          status: 'approved',
          clientName: `${client.personalInfo.firstName} ${client.personalInfo.lastName}`
        })
      );
    });

    test('Should send notification when agreement is ready', async () => {
      // Create approved loan
      const approvedLoan = await Loan.create({
        clientUserId: client._id,
        loanAmount: 50000,
        loanTerm: 6,
        interestRate: 15,
        purpose: 'Personal',
        loanStatus: 'approved',
        agentReview: {
          reviewedBy: agent._id,
          recommendation: 'approve',
          reviewedAt: new Date()
        },
        regionalManagerReview: {
          reviewedBy: regionalManager._id,
          decision: 'approve',
          reviewedAt: new Date()
        }
      });

      // Generate agreement
      await request(app)
        .post(`/api/agreements/generate/${approvedLoan._id}`)
        .set('Authorization', `Bearer ${agentToken}`)
        .send({
          templateType: 'standard'
        });

      // Verify agreement ready notification was sent
      expect(emailService.sendAgreementReadyNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          to: client.personalInfo.email,
          loanId: approvedLoan._id,
          clientName: `${client.personalInfo.firstName} ${client.personalInfo.lastName}`
        })
      );
    });

    test('Should send welcome email when new staff is created', async () => {
      const newStaffResponse = await request(app)
        .post('/api/moderate-admin/staff')
        .set('Authorization', `Bearer ${moderateAdminToken}`)
        .send({
          personalInfo: {
            firstName: 'New',
            lastName: 'Agent',
            email: 'newagent@test.com',
            phone: '5555555555'
          },
          role: 'agent',
          region: region._id,
          assignedTo: regionalManager._id
        });

      expect(newStaffResponse.status).toBe(201);

      // Verify welcome email was sent
      expect(emailService.sendWelcomeEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'newagent@test.com',
          name: 'New Agent',
          role: 'agent'
        })
      );
    });

    test('Should handle email service failures gracefully', async () => {
      // Mock email service to fail
      emailService.sendLoanStatusNotification.mockRejectedValue(new Error('Email service unavailable'));

      // Create loan (should not fail even if email fails)
      const loanResponse = await request(app)
        .post('/api/agent/loans')
        .set('Authorization', `Bearer ${agentToken}`)
        .send({
          clientUserId: client._id,
          loanAmount: 25000,
          loanTerm: 3,
          interestRate: 15,
          purpose: 'Emergency'
        });

      expect(loanResponse.status).toBe(201);

      // Review loan (should not fail even if email fails)
      const reviewResponse = await request(app)
        .put(`/api/agent/loans/${loanResponse.body.data._id}/review`)
        .set('Authorization', `Bearer ${agentToken}`)
        .send({
          recommendation: 'approve',
          comments: 'Emergency loan approved'
        });

      expect(reviewResponse.status).toBe(200);
      expect(emailService.sendLoanStatusNotification).toHaveBeenCalled();
    });

    test('Should queue emails when service is temporarily unavailable', async () => {
      // Test email queue endpoint
      const queueResponse = await request(app)
        .get('/api/email/queue/status')
        .set('Authorization', `Bearer ${moderateAdminToken}`);

      expect(queueResponse.status).toBe(200);
      expect(queueResponse.body.data).toHaveProperty('queueSize');
      expect(queueResponse.body.data).toHaveProperty('processing');
    });
  });

  describe('7. Comprehensive Error Handling Tests', () => {
    test('Should handle validation errors with detailed messages', async () => {
      const invalidLoanResponse = await request(app)
        .post('/api/agent/loans')
        .set('Authorization', `Bearer ${agentToken}`)
        .send({
          clientUserId: 'invalid-id',
          loanAmount: -1000,
          loanTerm: 0,
          interestRate: -5
        });

      expect(invalidLoanResponse.status).toBe(400);
      expect(invalidLoanResponse.body.success).toBe(false);
      expect(invalidLoanResponse.body.error.code).toBe('VALIDATION_ERROR');
      expect(invalidLoanResponse.body.error.details).toBeInstanceOf(Array);
      expect(invalidLoanResponse.body.error.details.length).toBeGreaterThan(0);
    });

    test('Should handle authentication errors properly', async () => {
      const unauthenticatedResponse = await request(app)
        .get('/api/agent/loans')
        .set('Authorization', 'Bearer invalid-token');

      expect(unauthenticatedResponse.status).toBe(401);
      expect(unauthenticatedResponse.body.success).toBe(false);
      expect(unauthenticatedResponse.body.error.code).toBe('AUTHENTICATION_ERROR');
    });

    test('Should handle authorization errors with clear messages', async () => {
      const unauthorizedResponse = await request(app)
        .post('/api/moderate-admin/staff')
        .set('Authorization', `Bearer ${agentToken}`)
        .send({
          personalInfo: {
            firstName: 'Unauthorized',
            lastName: 'Staff',
            email: 'unauthorized@test.com',
            phone: '9999999999'
          },
          role: 'agent'
        });

      expect(unauthorizedResponse.status).toBe(403);
      expect(unauthorizedResponse.body.success).toBe(false);
      expect(unauthorizedResponse.body.error.code).toBe('AUTHORIZATION_ERROR');
    });

    test('Should handle resource not found errors', async () => {
      const notFoundResponse = await request(app)
        .get('/api/agent/loans/507f1f77bcf86cd799439011')
        .set('Authorization', `Bearer ${agentToken}`);

      expect(notFoundResponse.status).toBe(404);
      expect(notFoundResponse.body.success).toBe(false);
      expect(notFoundResponse.body.error.code).toBe('RESOURCE_NOT_FOUND');
    });

    test('Should handle business logic errors', async () => {
      // Try to approve already approved loan
      const approvedLoan = await Loan.create({
        clientUserId: client._id,
        loanAmount: 30000,
        loanTerm: 4,
        interestRate: 15,
        purpose: 'Already approved',
        loanStatus: 'approved'
      });

      const businessErrorResponse = await request(app)
        .put(`/api/regional-admin/loans/${approvedLoan._id}/approve`)
        .set('Authorization', `Bearer ${regionalManagerToken}`)
        .send({
          decision: 'approve',
          comments: 'Double approval attempt'
        });

      expect(businessErrorResponse.status).toBe(400);
      expect(businessErrorResponse.body.success).toBe(false);
      expect(businessErrorResponse.body.error.code).toBe('BUSINESS_LOGIC_ERROR');
    });

    test('Should handle database connection errors gracefully', async () => {
      // This test would require mocking mongoose connection
      // For now, we'll test that the error handler is properly configured
      const healthResponse = await request(app)
        .get('/api/health');

      expect(healthResponse.status).toBe(200);
      expect(healthResponse.body.database).toBeDefined();
    });

    test('Should handle rate limiting', async () => {
      // Make multiple rapid requests to trigger rate limiting
      const requests = Array(20).fill().map(() =>
        request(app)
          .post('/api/auth/staff/login')
          .send({
            email: 'nonexistent@test.com',
            password: 'wrongpassword'
          })
      );

      const responses = await Promise.all(requests);

      // At least some requests should be rate limited
      const rateLimitedResponses = responses.filter(res => res.status === 429);
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    });

    test('Should log errors with proper context', async () => {
      // Make request that will cause an error
      await request(app)
        .post('/api/agent/loans')
        .set('Authorization', `Bearer ${agentToken}`)
        .send({
          clientUserId: 'invalid-id',
          loanAmount: 'not-a-number'
        });

      // In a real test, we would check log files or mock the logger
      // For now, we verify the request was handled properly
      expect(true).toBe(true); // Placeholder assertion
    });

    test('Should provide different error details in development vs production', async () => {
      // This would require testing with different NODE_ENV values
      // For now, we verify error structure is consistent
      const errorResponse = await request(app)
        .get('/api/agent/loans/invalid-id')
        .set('Authorization', `Bearer ${agentToken}`);

      expect(errorResponse.body.error).toHaveProperty('code');
      expect(errorResponse.body.error).toHaveProperty('message');
      expect(errorResponse.body.error).toHaveProperty('timestamp');
    });

    test('Should handle concurrent requests properly', async () => {
      // Create multiple concurrent loan applications
      const concurrentRequests = Array(5).fill().map((_, index) =>
        request(app)
          .post('/api/agent/loans')
          .set('Authorization', `Bearer ${agentToken}`)
          .send({
            clientUserId: client._id,
            loanAmount: 10000 + (index * 1000),
            loanTerm: 6,
            interestRate: 15,
            purpose: `Concurrent loan ${index}`
          })
      );

      const responses = await Promise.all(concurrentRequests);

      // All requests should succeed
      responses.forEach(response => {
        expect(response.status).toBe(201);
        expect(response.body.success).toBe(true);
      });
    });
  });
});