/**
 * Integration Tests for Authentication API
 * @fileoverview Tests for authentication API endpoints
 */

const request = require('supertest');
const app = require('../../index');
const Staff = require('../../models/Staff');
const bcrypt = require('bcryptjs');
const { createTestStaff, cleanupTestData } = require('../utils/testHelpers');

describe('Authentication API Integration Tests', () => {
  beforeEach(async () => {
    await cleanupTestData();
  });

  describe('POST /api/auth/login', () => {
    /**
     * Test successful login
     */
    it('should login successfully with valid credentials', async () => {
      // Arrange
      const password = 'password123';
      const hashedPassword = await bcrypt.hash(password, 10);

      const testUser = await createTestStaff({
        personalInfo: {
          firstName: 'John',
          lastName: 'Doe',
          email: 'john.doe@example.com',
          phone: '1234567890',
          nic: 'TEST123456789V',
          address: 'Test Address'
        },
        role: 'agent',
        password: hashedPassword,
        isActive: true
      });

      const loginData = {
        email: 'john.doe@example.com',
        password: password
      };

      // Act
      const response = await request(app)
        .post('/api/auth/login')
        .send(loginData)
        .expect(200);

      // Assert
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Login successful');
      expect(response.body.data).toHaveProperty('user');
      expect(response.body.data).toHaveProperty('token');
      expect(response.body.data.user.email).toBe('john.doe@example.com');
      expect(response.body.data.user.role).toBe('agent');
      expect(response.body.data.user).not.toHaveProperty('password');
    });

    /**
     * Test login with invalid email
     */
    it('should return 401 for invalid email', async () => {
      // Arrange
      const loginData = {
        email: 'nonexistent@example.com',
        password: 'password123'
      };

      // Act
      const response = await request(app)
        .post('/api/auth/login')
        .send(loginData)
        .expect(401);

      // Assert
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INVALID_CREDENTIALS');
      expect(response.body.error.message).toBe('Invalid email or password');
    });

    /**
     * Test login with invalid password
     */
    it('should return 401 for invalid password', async () => {
      // Arrange
      const hashedPassword = await bcrypt.hash('correctpassword', 10);

      await createTestStaff({
        personalInfo: {
          email: 'test@example.com'
        },
        password: hashedPassword,
        isActive: true
      });

      const loginData = {
        email: 'test@example.com',
        password: 'wrongpassword'
      };

      // Act
      const response = await request(app)
        .post('/api/auth/login')
        .send(loginData)
        .expect(401);

      // Assert
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INVALID_CREDENTIALS');
    });

    /**
     * Test login with missing credentials
     */
    it('should return 400 for missing credentials', async () => {
      // Arrange
      const loginData = {
        email: 'test@example.com'
        // password missing
      };

      // Act
      const response = await request(app)
        .post('/api/auth/login')
        .send(loginData)
        .expect(400);

      // Assert
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    /**
     * Test login with inactive user
     */
    it('should return 401 for inactive user', async () => {
      // Arrange
      const hashedPassword = await bcrypt.hash('password123', 10);

      await createTestStaff({
        personalInfo: {
          email: 'inactive@example.com'
        },
        password: hashedPassword,
        isActive: false // Inactive user
      });

      const loginData = {
        email: 'inactive@example.com',
        password: 'password123'
      };

      // Act
      const response = await request(app)
        .post('/api/auth/login')
        .send(loginData)
        .expect(401);

      // Assert
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INVALID_CREDENTIALS');
    });
  });

  describe('POST /api/auth/change-password', () => {
    /**
     * Test successful password change
     */
    it('should change password successfully', async () => {
      // Arrange
      const oldPassword = 'oldpassword123';
      const newPassword = 'newpassword456';
      const hashedOldPassword = await bcrypt.hash(oldPassword, 10);

      const testUser = await createTestStaff({
        personalInfo: {
          email: 'test@example.com'
        },
        password: hashedOldPassword,
        isActive: true
      });

      // Login to get token
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: oldPassword
        });

      const token = loginResponse.body.data.token;

      const passwordData = {
        currentPassword: oldPassword,
        newPassword: newPassword
      };

      // Act
      const response = await request(app)
        .post('/api/auth/change-password')
        .set('Authorization', `Bearer ${token}`)
        .send(passwordData)
        .expect(200);

      // Assert
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Password changed successfully');

      // Verify new password works
      const newLoginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: newPassword
        })
        .expect(200);

      expect(newLoginResponse.body.success).toBe(true);
    });

    /**
     * Test password change with incorrect current password
     */
    it('should return 400 for incorrect current password', async () => {
      // Arrange
      const hashedPassword = await bcrypt.hash('correctpassword', 10);

      const testUser = await createTestStaff({
        personalInfo: {
          email: 'test@example.com'
        },
        password: hashedPassword,
        isActive: true
      });

      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'correctpassword'
        });

      const token = loginResponse.body.data.token;

      const passwordData = {
        currentPassword: 'wrongpassword',
        newPassword: 'newpassword123'
      };

      // Act
      const response = await request(app)
        .post('/api/auth/change-password')
        .set('Authorization', `Bearer ${token}`)
        .send(passwordData)
        .expect(400);

      // Assert
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INVALID_PASSWORD');
    });

    /**
     * Test password change without authentication
     */
    it('should return 401 without authentication token', async () => {
      // Arrange
      const passwordData = {
        currentPassword: 'oldpassword',
        newPassword: 'newpassword123'
      };

      // Act
      const response = await request(app)
        .post('/api/auth/change-password')
        .send(passwordData)
        .expect(401);

      // Assert
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('NO_TOKEN');
    });
  });

  describe('POST /api/auth/refresh-token', () => {
    /**
     * Test successful token refresh
     */
    it('should refresh token successfully', async () => {
      // Arrange
      const hashedPassword = await bcrypt.hash('password123', 10);

      const testUser = await createTestStaff({
        personalInfo: {
          email: 'test@example.com'
        },
        password: hashedPassword,
        isActive: true
      });

      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'password123'
        });

      const token = loginResponse.body.data.token;

      // Act
      const response = await request(app)
        .post('/api/auth/refresh-token')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      // Assert
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Token refreshed successfully');
      expect(response.body.data).toHaveProperty('token');
      expect(response.body.data.token).not.toBe(token); // Should be a new token
    });

    /**
     * Test token refresh without authentication
     */
    it('should return 401 without authentication token', async () => {
      // Act
      const response = await request(app)
        .post('/api/auth/refresh-token')
        .expect(401);

      // Assert
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('NO_TOKEN');
    });

    /**
     * Test token refresh with invalid token
     */
    it('should return 401 with invalid token', async () => {
      // Act
      const response = await request(app)
        .post('/api/auth/refresh-token')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);

      // Assert
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INVALID_TOKEN');
    });
  });

  describe('GET /api/auth/profile', () => {
    /**
     * Test getting user profile
     */
    it('should return user profile successfully', async () => {
      // Arrange
      const hashedPassword = await bcrypt.hash('password123', 10);

      const testUser = await createTestStaff({
        personalInfo: {
          firstName: 'John',
          lastName: 'Doe',
          email: 'john.doe@example.com',
          phone: '1234567890'
        },
        role: 'agent',
        password: hashedPassword,
        isActive: true
      });

      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'john.doe@example.com',
          password: 'password123'
        });

      const token = loginResponse.body.data.token;

      // Act
      const response = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      // Assert
      expect(response.body.success).toBe(true);
      expect(response.body.data.user.personalInfo.firstName).toBe('John');
      expect(response.body.data.user.personalInfo.lastName).toBe('Doe');
      expect(response.body.data.user.role).toBe('agent');
      expect(response.body.data.user).not.toHaveProperty('password');
    });

    /**
     * Test getting profile without authentication
     */
    it('should return 401 without authentication token', async () => {
      // Act
      const response = await request(app)
        .get('/api/auth/profile')
        .expect(401);

      // Assert
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('NO_TOKEN');
    });
  });
});