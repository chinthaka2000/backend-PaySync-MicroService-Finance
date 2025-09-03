const request = require('supertest');
const path = require('path');
const fs = require('fs');
const app = require('../../index');
const { connectDB, disconnectDB } = require('../setup');
const Staff = require('../../models/Staff');
const Client = require('../../models/Client');
const Loan = require('../../models/Loan');
const Region = require('../../models/Region');

describe('File Handling and Agreement Generation Integration Tests', () => {
  let agentToken, regionalManagerToken;
  let agent, regionalManager, region, client, loan;

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
    // Create test region
    region = await Region.create({
      name: 'Test Region',
      code: 'TR',
      districts: ['Colombo'],
      isActive: true
    });

    // Create regional manager
    regionalManager = await Staff.create({
      personalInfo: {
        firstName: 'Regional',
        lastName: 'Manager',
        email: 'rm@test.com',
        phone: '1111111111'
      },
      role: 'regional_manager',
      password: 'password123',
      region: region._id,
      isActive: true
    });

    // Create agent
    agent = await Staff.create({
      personalInfo: {
        firstName: 'Test',
        lastName: 'Agent',
        email: 'agent@test.com',
        phone: '2222222222'
      },
      role: 'agent',
      password: 'password123',
      region: region._id,
      isActive: true,
      assignedTo: regionalManager._id
    });

    // Create client
    client = await Client.create({
      personalInfo: {
        firstName: 'Test',
        lastName: 'Client',
        email: 'client@test.com',
        phone: '3333333333',
        nic: '123456789V',
        address: { district: 'Colombo' }
      },
      assignedAgent: agent._id,
      region: region._id
    });

    // Create loan
    loan = await Loan.create({
      clientUserId: client._id,
      loanAmount: 100000,
      loanTerm: 12,
      interestRate: 15,
      purpose: 'Business',
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

    // Get tokens
    agentToken = await getAuthToken('agent@test.com', 'password123');
    regionalManagerToken = await getAuthToken('rm@test.com', 'password123');
  };

  const getAuthToken = async (email, password) => {
    const response = await request(app)
      .post('/api/auth/staff/login')
      .send({ email, password });
    return response.body.token;
  };

  const createTestFile = (filename, content = 'Test file content') => {
    const filePath = path.join(__dirname, '..', 'fixtures', filename);
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(filePath, content);
    return filePath;
  };

  describe('3. File Upload and Download Tests', () => {
    test('Should upload client documents successfully', async () => {
      const testFilePath = createTestFile('test-document.pdf', 'PDF content');

      const uploadResponse = await request(app)
        .post('/api/files/upload')
        .set('Authorization', `Bearer ${agentToken}`)
        .attach('file', testFilePath)
        .field('type', 'client_document')
        .field('clientId', client._id.toString());

      expect(uploadResponse.status).toBe(200);
      expect(uploadResponse.body.success).toBe(true);
      expect(uploadResponse.body.data.filename).toBeDefined();
      expect(uploadResponse.body.data.originalName).toBe('test-document.pdf');

      // Clean up
      fs.unlinkSync(testFilePath);
    });

    test('Should reject invalid file types', async () => {
      const testFilePath = createTestFile('test-script.js', 'console.log("malicious");');

      const uploadResponse = await request(app)
        .post('/api/files/upload')
        .set('Authorization', `Bearer ${agentToken}`)
        .attach('file', testFilePath)
        .field('type', 'client_document')
        .field('clientId', client._id.toString());

      expect(uploadResponse.status).toBe(400);
      expect(uploadResponse.body.success).toBe(false);

      // Clean up
      fs.unlinkSync(testFilePath);
    });

    test('Should reject oversized files', async () => {
      // Create a large file (simulate > 5MB)
      const largeContent = 'x'.repeat(6 * 1024 * 1024); // 6MB
      const testFilePath = createTestFile('large-file.pdf', largeContent);

      const uploadResponse = await request(app)
        .post('/api/files/upload')
        .set('Authorization', `Bearer ${agentToken}`)
        .attach('file', testFilePath)
        .field('type', 'client_document')
        .field('clientId', client._id.toString());

      expect(uploadResponse.status).toBe(400);
      expect(uploadResponse.body.success).toBe(false);

      // Clean up
      fs.unlinkSync(testFilePath);
    });

    test('Should download uploaded files with proper authorization', async () => {
      const testFilePath = createTestFile('download-test.pdf', 'Download test content');

      // Upload file first
      const uploadResponse = await request(app)
        .post('/api/files/upload')
        .set('Authorization', `Bearer ${agentToken}`)
        .attach('file', testFilePath)
        .field('type', 'client_document')
        .field('clientId', client._id.toString());

      const filename = uploadResponse.body.data.filename;

      // Download file
      const downloadResponse = await request(app)
        .get(`/api/files/download/${filename}`)
        .set('Authorization', `Bearer ${agentToken}`);

      expect(downloadResponse.status).toBe(200);
      expect(downloadResponse.headers['content-type']).toContain('application/pdf');

      // Clean up
      fs.unlinkSync(testFilePath);
    });

    test('Should prevent unauthorized file downloads', async () => {
      // Try to download non-existent file
      const downloadResponse = await request(app)
        .get('/api/files/download/non-existent-file.pdf')
        .set('Authorization', `Bearer ${agentToken}`);

      expect(downloadResponse.status).toBe(404);
    });
  });

  describe('4. Agreement Generation Tests', () => {
    test('Should generate loan agreement successfully', async () => {
      const agreementResponse = await request(app)
        .post(`/api/agreements/generate/${loan._id}`)
        .set('Authorization', `Bearer ${agentToken}`)
        .send({
          templateType: 'standard',
          additionalTerms: 'Standard terms and conditions apply'
        });

      expect(agreementResponse.status).toBe(200);
      expect(agreementResponse.body.success).toBe(true);
      expect(agreementResponse.body.data.agreementId).toBeDefined();
      expect(agreementResponse.body.data.filename).toBeDefined();
    });

    test('Should download generated agreement', async () => {
      // Generate agreement first
      const agreementResponse = await request(app)
        .post(`/api/agreements/generate/${loan._id}`)
        .set('Authorization', `Bearer ${agentToken}`)
        .send({
          templateType: 'standard'
        });

      const agreementId = agreementResponse.body.data.agreementId;

      // Download agreement
      const downloadResponse = await request(app)
        .get(`/api/agreements/download/${agreementId}`)
        .set('Authorization', `Bearer ${agentToken}`);

      expect(downloadResponse.status).toBe(200);
      expect(downloadResponse.headers['content-type']).toContain('application/pdf');
    });

    test('Should prevent agreement generation for unauthorized loans', async () => {
      // Create loan for different agent
      const otherAgent = await Staff.create({
        personalInfo: {
          firstName: 'Other',
          lastName: 'Agent',
          email: 'other@test.com',
          phone: '4444444444'
        },
        role: 'agent',
        password: 'password123',
        region: region._id,
        isActive: true
      });

      const otherClient = await Client.create({
        personalInfo: {
          firstName: 'Other',
          lastName: 'Client',
          email: 'otherclient@test.com',
          phone: '5555555555',
          nic: '987654321V',
          address: { district: 'Colombo' }
        },
        assignedAgent: otherAgent._id,
        region: region._id
      });

      const otherLoan = await Loan.create({
        clientUserId: otherClient._id,
        loanAmount: 50000,
        loanTerm: 6,
        interestRate: 15,
        purpose: 'Personal',
        loanStatus: 'approved'
      });

      // Try to generate agreement for other agent's loan
      const unauthorizedResponse = await request(app)
        .post(`/api/agreements/generate/${otherLoan._id}`)
        .set('Authorization', `Bearer ${agentToken}`);

      expect(unauthorizedResponse.status).toBe(403);
    });

    test('Should validate agreement generation for approved loans only', async () => {
      // Create pending loan
      const pendingLoan = await Loan.create({
        clientUserId: client._id,
        loanAmount: 75000,
        loanTerm: 9,
        interestRate: 15,
        purpose: 'Education',
        loanStatus: 'pending'
      });

      // Try to generate agreement for pending loan
      const invalidResponse = await request(app)
        .post(`/api/agreements/generate/${pendingLoan._id}`)
        .set('Authorization', `Bearer ${agentToken}`);

      expect(invalidResponse.status).toBe(400);
      expect(invalidResponse.body.error.message).toContain('approved');
    });

    test('Should include all required loan details in agreement', async () => {
      const agreementResponse = await request(app)
        .post(`/api/agreements/generate/${loan._id}`)
        .set('Authorization', `Bearer ${agentToken}`)
        .send({
          templateType: 'detailed',
          additionalTerms: 'Custom terms for this agreement'
        });

      expect(agreementResponse.status).toBe(200);

      const agreementData = agreementResponse.body.data;
      expect(agreementData.loanDetails).toBeDefined();
      expect(agreementData.loanDetails.loanAmount).toBe(loan.loanAmount);
      expect(agreementData.loanDetails.loanTerm).toBe(loan.loanTerm);
      expect(agreementData.loanDetails.interestRate).toBe(loan.interestRate);
      expect(agreementData.clientDetails).toBeDefined();
      expect(agreementData.clientDetails.firstName).toBe(client.personalInfo.firstName);
    });
  });

  describe('5. File Security and Validation Tests', () => {
    test('Should sanitize file names', async () => {
      const maliciousFilePath = createTestFile('../../../malicious.pdf', 'Malicious content');

      const uploadResponse = await request(app)
        .post('/api/files/upload')
        .set('Authorization', `Bearer ${agentToken}`)
        .attach('file', maliciousFilePath)
        .field('type', 'client_document')
        .field('clientId', client._id.toString());

      if (uploadResponse.status === 200) {
        // File name should be sanitized
        expect(uploadResponse.body.data.filename).not.toContain('../');
        expect(uploadResponse.body.data.filename).not.toContain('malicious');
      }

      // Clean up
      fs.unlinkSync(maliciousFilePath);
    });

    test('Should validate file content type', async () => {
      // Create file with wrong extension but correct content type
      const testFilePath = createTestFile('fake.pdf', 'This is not a PDF');

      const uploadResponse = await request(app)
        .post('/api/files/upload')
        .set('Authorization', `Bearer ${agentToken}`)
        .attach('file', testFilePath)
        .field('type', 'client_document')
        .field('clientId', client._id.toString());

      // Should validate actual file content, not just extension
      expect(uploadResponse.status).toBe(400);

      // Clean up
      fs.unlinkSync(testFilePath);
    });

    test('Should enforce file access permissions', async () => {
      // Upload file as one agent
      const testFilePath = createTestFile('restricted.pdf', 'Restricted content');

      const uploadResponse = await request(app)
        .post('/api/files/upload')
        .set('Authorization', `Bearer ${agentToken}`)
        .attach('file', testFilePath)
        .field('type', 'client_document')
        .field('clientId', client._id.toString());

      const filename = uploadResponse.body.data.filename;

      // Create another agent
      const otherAgent = await Staff.create({
        personalInfo: {
          firstName: 'Unauthorized',
          lastName: 'Agent',
          email: 'unauth@test.com',
          phone: '6666666666'
        },
        role: 'agent',
        password: 'password123',
        region: region._id,
        isActive: true
      });

      const otherAgentToken = await getAuthToken('unauth@test.com', 'password123');

      // Try to download file as different agent
      const unauthorizedDownload = await request(app)
        .get(`/api/files/download/${filename}`)
        .set('Authorization', `Bearer ${otherAgentToken}`);

      expect(unauthorizedDownload.status).toBe(403);

      // Clean up
      fs.unlinkSync(testFilePath);
    });
  });
});