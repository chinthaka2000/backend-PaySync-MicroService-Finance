/**
 * Unit Tests for Authentication Controller
 * @fileoverview Tests for authentication controller business logic
 */

const authController = require("../../../controllers/authController");
const Staff = require("../../../models/Staff");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const {
  mockRequest,
  mockResponse,
  mockNext,
} = require("../../utils/testHelpers");

// Mock dependencies
jest.mock("../../../models/Staff");
jest.mock("bcryptjs");
jest.mock("jsonwebtoken");
jest.mock("../../../utils/logger");

describe("AuthController", () => {
  let req, res, next;

  beforeEach(() => {
    req = mockRequest();
    res = mockResponse();
    next = mockNext();
    jest.clearAllMocks();
  });

  describe("login", () => {
    /**
     * Test successful login with valid credentials
     */
    it("should login successfully with valid credentials", async () => {
      // Arrange
      const loginData = {
        email: "test@example.com",
        password: "password123",
      };

      const mockUser = {
        _id: "user123",
        name: "John Doe",
        email: "test@example.com",
        role: "agent",
        region: "region123",
        passwordHash: "hashedPassword",
        status: "active",
        permissions: [],
      };

      req.body = loginData;

      Staff.findOne.mockResolvedValue(mockUser);
      bcrypt.compare.mockResolvedValue(true);

      // Mock the generateTokenPair function
      const mockTokens = {
        accessToken: "mock-access-token",
        refreshToken: "mock-refresh-token",
      };
      require("../../../utils/jwtUtils").generateTokenPair = jest
        .fn()
        .mockReturnValue(mockTokens);

      // Act
      await authController.login(req, res);

      // Assert
      expect(Staff.findOne).toHaveBeenCalledWith({
        email: "test@example.com",
      });
      expect(bcrypt.compare).toHaveBeenCalledWith(
        "password123",
        "hashedPassword"
      );
      expect(
        require("../../../utils/jwtUtils").generateTokenPair
      ).toHaveBeenCalledWith(mockUser);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: "Login successful",
        data: {
          user: {
            id: "user123",
            name: "John Doe",
            email: "test@example.com",
            role: "agent",
            region: "region123",
            permissions: [],
          },
          tokens: mockTokens,
        },
        timestamp: expect.any(String),
      });
    });

    /**
     * Test login with invalid email
     */
    it("should reject login with invalid email", async () => {
      // Arrange
      req.body = {
        email: "nonexistent@example.com",
        password: "password123",
      };

      Staff.findOne.mockResolvedValue(null);

      // Act
      await authController.login(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: "INVALID_CREDENTIALS",
          message: "Invalid email or password",
          timestamp: expect.any(String),
        },
      });
    });

    /**
     * Test login with invalid password
     */
    it("should reject login with invalid password", async () => {
      // Arrange
      const mockUser = {
        _id: "user123",
        personalInfo: { email: "test@example.com" },
        password: "hashedPassword",
        isActive: true,
      };

      req.body = {
        email: "test@example.com",
        password: "wrongpassword",
      };

      Staff.findOne.mockResolvedValue(mockUser);
      bcrypt.compare.mockResolvedValue(false);

      // Act
      await authController.login(req, res);

      // Assert
      expect(bcrypt.compare).toHaveBeenCalledWith(
        "wrongpassword",
        "hashedPassword"
      );
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: "INVALID_CREDENTIALS",
          message: "Invalid email or password",
          timestamp: expect.any(String),
        },
      });
    });

    /**
     * Test login with inactive user
     */
    it("should reject login for inactive user", async () => {
      // Arrange
      const mockUser = {
        _id: "user123",
        personalInfo: { email: "test@example.com" },
        password: "hashedPassword",
        isActive: false,
      };

      req.body = {
        email: "test@example.com",
        password: "password123",
      };

      Staff.findOne.mockResolvedValue(null); // findOne with isActive: true returns null

      // Act
      await authController.login(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: "INVALID_CREDENTIALS",
          message: "Invalid email or password",
          timestamp: expect.any(String),
        },
      });
    });

    /**
     * Test login with missing credentials
     */
    it("should reject login with missing credentials", async () => {
      // Arrange
      req.body = {
        email: "test@example.com",
        // password missing
      };

      // Act
      await authController.login(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Email and password are required",
          timestamp: expect.any(String),
        },
      });
    });
  });

  describe("changePassword", () => {
    /**
     * Test successful password change
     */
    it("should change password successfully", async () => {
      // Arrange
      const passwordData = {
        currentPassword: "oldpassword",
        newPassword: "newpassword123",
      };

      const mockUser = {
        _id: "user123",
        password: "hashedOldPassword",
        save: jest.fn().mockResolvedValue(true),
      };

      req.body = passwordData;
      req.user = { userId: "user123" };

      Staff.findById.mockResolvedValue(mockUser);
      bcrypt.compare.mockResolvedValue(true);
      bcrypt.hash.mockResolvedValue("hashedNewPassword");

      // Act
      await authController.changePassword(req, res);

      // Assert
      expect(Staff.findById).toHaveBeenCalledWith("user123");
      expect(bcrypt.compare).toHaveBeenCalledWith(
        "oldpassword",
        "hashedOldPassword"
      );
      expect(bcrypt.hash).toHaveBeenCalledWith("newpassword123", 10);
      expect(mockUser.save).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: "Password changed successfully",
      });
    });

    /**
     * Test password change with incorrect current password
     */
    it("should reject password change with incorrect current password", async () => {
      // Arrange
      const mockUser = {
        _id: "user123",
        password: "hashedOldPassword",
      };

      req.body = {
        currentPassword: "wrongpassword",
        newPassword: "newpassword123",
      };
      req.user = { userId: "user123" };

      Staff.findById.mockResolvedValue(mockUser);
      bcrypt.compare.mockResolvedValue(false);

      // Act
      await authController.changePassword(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: "INVALID_PASSWORD",
          message: "Current password is incorrect",
          timestamp: expect.any(String),
        },
      });
    });
  });

  describe("refreshToken", () => {
    /**
     * Test successful token refresh
     */
    it("should refresh token successfully", async () => {
      // Arrange
      const mockUser = {
        _id: "user123",
        personalInfo: {
          email: "test@example.com",
          firstName: "John",
          lastName: "Doe",
        },
        role: "agent",
        region: "region123",
        isActive: true,
      };

      req.user = { userId: "user123" };

      Staff.findById.mockResolvedValue(mockUser);
      jwt.sign.mockReturnValue("new-jwt-token");

      // Act
      await authController.refreshToken(req, res);

      // Assert
      expect(Staff.findById).toHaveBeenCalledWith("user123");
      expect(jwt.sign).toHaveBeenCalledWith(
        {
          userId: "user123",
          email: "test@example.com",
          role: "agent",
          region: "region123",
        },
        expect.any(String),
        { expiresIn: "24h" }
      );
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: "Token refreshed successfully",
        data: {
          token: "new-jwt-token",
        },
      });
    });

    /**
     * Test token refresh with inactive user
     */
    it("should reject token refresh for inactive user", async () => {
      // Arrange
      const mockUser = {
        _id: "user123",
        isActive: false,
      };

      req.user = { userId: "user123" };

      Staff.findById.mockResolvedValue(mockUser);

      // Act
      await authController.refreshToken(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: "USER_INACTIVE",
          message: "User account is inactive",
          timestamp: expect.any(String),
        },
      });
    });
  });
});
