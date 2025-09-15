const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../../index');
const { connectDB, disconnectDB } = require('../setup');
const Staff = require('../../models/Staff');
const Client = require('../../models/Client');
const Loan = require('../../models/Loan');
const Region = require('../../models/Region');

describe('Complete Loan Workflow Integration Tests', () => {
  let superAdminToken, moderateAdminToken, regionalManagerToken, agentToken;
  let superAdmin, moderateAdmin, regionalManager, agent;
  let region, client, loan;

  beforeAll(async () => {
    await connectDB();
    await clearDatabase();
    await setupTestData();
  });

  afterAll(async () => {
    await clearDatabase();
    await disconnectDB();
  });

  const clearDatabase = async () => {
    await Staff.deleteMany({});
    await Client.deleteMany({});
    await Loan.deleteMany({});
    await Region.deleteMany({});
  };

  const setupTestData = async () => {
    // Create Super Admin
    superAdmin = await Staff.create({
      personalInfo: {
        firstName: 'Super',
        lastName: 'Admin',
        email: 'superadmin@test.com',
        phone: '1234567890'
      },
      role: 'super_admin',
      password: 'password123',
      isActive: true
    });

    // Create Moderate Admin
    moderateAdmin = await Staff.create({
      personalInfo: {
        firstName: 'Moderate',
        lastName: 'Admin',
        email: 'moderateadmin@test.com',
        phone: '1234567891'
      },
      role: 'moderate_admin',
      password: 'password123',
      isActive: true,
      createdBy: superAdmin._id
    });

    // Create Region
    region = await Region.create({
      name: 'Western Province',
      code: 'WP',
      districts: ['Colombo', 'Gampaha', 'Kalutara'],
      createdBy: moderateAdmin._id,
      isActive: true
    });

    // Create Regional Manager
    regionalManager = await Staff.create({
      personalInfo: {
        firstName: 'Regional',
        lastName: 'Manager',
        email: 'regionalmanager@test.com',
        phone: '1234567892'
      },
      role: 'regional_manager',
      password: 'password123',
      region: region._id,
      isActive: true,
      createdBy: moderateAdmin._id
    });

    // Update region with regional manager
    await Region.findByIdAndUpdate(region._id, { regionalManager: regionalManager._id });

    // Create Agent
    agent = await Staff.create({
      personalInfo: {
        firstName: 'Test',
        lastName: 'Agent',
        email: 'agent@test.com',
        phone: '1234567893'
      },
      role: 'agent',
      password: 'password123',
      region: region._id,
      isActive: true,
      createdBy: moderateAdmin._id,
      assignedTo: regionalManager._id
    });

    // Get authentication tokens
    superAdminToken = await getAuthToken('superadmin@test.com', 'password123');
    moderateAdminToken = await getAuthToken('moderateadmin@test.com', 'password123');
    regionalManagerToken = await getAuthToken('regionalmanager@test.com', 'password123');
    agentToken = await getAuthToken('agent@test.com', 'password123');
  };

  const getAuthToken = async (email, password) => {
    const response = await request(app)
      .post('/api/auth/staff/login')
      .send({ email, password });
    return response.body.token;
  };

  describe('1. Complete Loan Workflow', () => {
    test('Should complete full loan workflow from application to approval', async () => {
      // Step 1: Agent creates a client
      const clientResponse = await request(app)
        .post('/api/agent/clients')
        .set('Authorization', `Bearer ${agentToken}`)
        .send({
          personalInfo: {
            firstName: 'John',
            lastName: 'Doe',
            email: 'john.doe@test.com',
            phone: '9876543210',
            nic: '123456789V',
            dateOfBirth: '1990-01-01',
            address: {
              street: '123 Main St',
              city: 'Colombo',
              district: 'Colombo',
              postalCode: '10100'
            }
          },
          employmentInfo: {
            employmentType: 'employed',
            employer: 'Test Company',
            monthlyIncome: 50000,
            workExperience: 5
          }
        });

      expect(clientResponse.status).toBe(201);
      client = clientResponse.body.data;

      // Step 2: Agent creates loan application
      const loanResponse = await request(app)
        .post('/api/agent/loans')
        .set('Authorization', `Bearer ${agentToken}`)
        .send({
          clientUserId: client._id,
          loanAmount: 100000,
          loanTerm: 12,
          interestRate: 15,
          purpose: 'Business expansion',
          guarantors: [{
            name: 'Jane Doe',
            relationship: 'Spouse',
            phone: '9876543211',
            nic: '987654321V'
          }]
        });

      expect(loanResponse.status).toBe(201);
      loan = loanResponse.body.data;
      expect(loan.loanStatus).toBe('pending');

      // Step 3: Agent reviews and submits loan
      const agentReviewResponse = await request(app)
        .put(`/api/agent/loans/${loan._id}/review`)
        .set('Authorization', `Bearer ${agentToken}`)
        .send({
          recommendation: 'approve',
          comments: 'Client meets all criteria'
        });

      expect(agentReviewResponse.status).toBe(200);
      expect(agentReviewResponse.body.data.loanStatus).toBe('agent_reviewed');

      // Step 4: Regional Manager approves loan
      const managerApprovalResponse = await request(app)
        .put(`/api/regional-admin/loans/${loan._id}/approve`)
        .set('Authorization', `Bearer ${regionalManagerToken}`)
        .send({
          decision: 'approve',
          comments: 'Approved for disbursement'
        });

      expect(managerApprovalResponse.status).toBe(200);
      expect(managerApprovalResponse.body.data.loanStatus).toBe('approved');

      // Step 5: Verify loan workflow completion
      const finalLoanResponse = await request(app)
        .get(`/api/regional-admin/loans/${loan._id}`)
        .set('Authorization', `Bearer ${regionalManagerToken}`);

      expect(finalLoanResponse.status).toBe(200);
      const finalLoan = finalLoanResponse.body.data;
      expect(finalLoan.loanStatus).toBe('approved');
      expect(finalLoan.agentReview.reviewedBy).toBe(agent._id.toString());
      expect(finalLoan.regionalManagerReview.reviewedBy).toBe(regionalManager._id.toString());
    });

    test('Should handle loan rejection workflow', async () => {
      // Create another loan for rejection test
      const rejectionLoanResponse = await request(app)
        .post('/api/agent/loans')
        .set('Authorization', `Bearer ${agentToken}`)
        .send({
          clientUserId: client._id,
          loanAmount: 50000,
          loanTerm: 6,
          interestRate: 15,
          purpose: 'Personal use'
        });

      const rejectionLoan = rejectionLoanResponse.body.data;

      // Agent rejects loan
      const agentRejectionResponse = await request(app)
        .put(`/api/agent/loans/${rejectionLoan._id}/review`)
        .set('Authorization', `Bearer ${agentToken}`)
        .send({
          recommendation: 'reject',
          comments: 'Insufficient documentation'
        });

      expect(agentRejectionResponse.status).toBe(200);
      expect(agentRejectionResponse.body.data.loanStatus).toBe('rejected');
    });
  });

  describe('2. Role-Based Access Control Verification', () => {
    test('Should enforce agent access restrictions', async () => {
      // Agent should not access other regions' data
      const otherRegion = await Region.create({
        name: 'Central Province',
        code: 'CP',
        districts: ['Kandy', 'Matale'],
        createdBy: moderateAdmin._id,
        isActive: true
      });

      const otherClient = await Client.create({
        personalInfo: {
          firstName: 'Other',
          lastName: 'Client',
          email: 'other@test.com',
          phone: '5555555555',
          nic: '555555555V',
          address: { district: 'Kandy' }
        },
        assignedAgent: agent._id,
        region: otherRegion._id
      });

      // Agent should not be able to access clients from other regions
      const unauthorizedResponse = await request(app)
        .get(`/api/agent/clients/${otherClient._id}`)
        .set('Authorization', `Bearer ${agentToken}`);

      expect(unauthorizedResponse.status).toBe(403);
    });

    test('Should enforce regional manager access restrictions', async () => {
      // Regional manager should not access other regions' loans
      const otherRegionalManager = await Staff.create({
        personalInfo: {
          firstName: 'Other',
          lastName: 'Manager',
          email: 'othermanager@test.com',
          phone: '7777777777'
        },
        role: 'regional_manager',
        password: 'password123',
        region: new mongoose.Types.ObjectId(),
        isActive: true,
        createdBy: moderateAdmin._id
      });

      const otherManagerToken = await getAuthToken('othermanager@test.com', 'password123');

      // Should not access loans from different region
      const unauthorizedLoanResponse = await request(app)
        .get(`/api/regional-admin/loans/${loan._id}`)
        .set('Authorization', `Bearer ${otherManagerToken}`);

      expect(unauthorizedLoanResponse.status).toBe(403);
    });

    test('Should allow moderate admin full access', async () => {
      // Moderate admin should access all data
      const allLoansResponse = await request(app)
        .get('/api/moderate-admin/loans')
        .set('Authorization', `Bearer ${moderateAdminToken}`);

      expect(allLoansResponse.status).toBe(200);

      const allStaffResponse = await request(app)
        .get('/api/moderate-admin/staff')
        .set('Authorization', `Bearer ${moderateAdminToken}`);

      expect(allStaffResponse.status).toBe(200);
    });

    test('Should prevent unauthorized role creation', async () => {
      // Agent should not be able to create staff
      const unauthorizedStaffResponse = await request(app)
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

      expect(unauthorizedStaffResponse.status).toBe(403);

      // Regional manager should not create moderate admin
      const unauthorizedAdminResponse = await request(app)
        .post('/api/moderate-admin/staff')
        .set('Authorization', `Bearer ${regionalManagerToken}`)
        .send({
          personalInfo: {
            firstName: 'Unauthorized',
            lastName: 'Admin',
            email: 'unauthorizedadmin@test.com',
            phone: '8888888888'
          },
          role: 'moderate_admin'
        });

      expect(unauthorizedAdminResponse.status).toBe(403);
    });
  });
});