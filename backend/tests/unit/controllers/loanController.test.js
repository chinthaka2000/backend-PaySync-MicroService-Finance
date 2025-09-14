/**
 * Unit Tests for Loan Controller
 * @fileoverview Tests for loan controller business logic
 */

const loanController = require('../../../controllers/loanController');
const Loan = require('../../../models/Loan');
const Client = require('../../../models/Client');
const Staff = require('../../../models/Staff');
const { validateLoanApplication } = require('../../../validation/businessRules');
const LoanRepository = require('../../../repositories/LoanRepository');
const { mockRequest, mockResponse, mockNext, createTestClient, createTestStaff } = require('../../utils/testHelpers');

// Mock dependencies
jest.mock('../../../models/Loan');
jest.mock('../../../models/Client');
jest.mock('../../../models/Staff');
jest.mock('../../../validation/businessRules');
jest.mock('../../../repositories/LoanRepository');
jest.mock('../../../services/emailService');
jest.mock('../../../utils/logger');

describe('LoanController', () => {
  let req, res, next;

  beforeEach(() => {
    req = mockRequest();
    res = mockResponse();
    next = mockNext();
    jest.clearAllMocks();
  });

  describe('createLoanApplication', () => {
    /**
     * Test successful loan application creation
     */
    it('should create loan application with valid data', async () => {
      // Arrange
      const loanData = {
        clientUserId: 'client123',
        loanAmount: 50000,
        loanTerm: 12,
        interestRate: 15
      };

      const user = {
        userId: 'agent123',
        role: 'agent',
        region: 'region123'
      };

      req.body = loanData;
      req.user = user;

      const mockClient = {
        _id: 'client123',
        personalInfo: { firstName: 'John', lastName: 'Doe' },
        assignedAgent: 'agent123'
      };

      const mockLoan = {
        _id: 'loan123',
        ...loanData,
        loanStatus: 'pending'
      };

      // Mock validation success
      validateLoanApplication.mockResolvedValue({
        isValid: true,
        errors: []
      });

      Client.findById.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          populate: jest.fn().mockResolvedValue(mockClient)
        })
      });

      const mockLoanRepository = {
        create: jest.fn().mockResolvedValue(mockLoan)
      };
      LoanRepository.mockImplementation(() => mockLoanRepository);

      // Act
      await loanController.createLoanApplication(req, res);

      // Assert
      expect(validateLoanApplication).toHaveBeenCalledWith(loanData, user);
      expect(Client.findById).toHaveBeenCalledWith('client123');
      expect(mockLoanRepository.create).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Loan application created successfully',
        data: expect.objectContaining({
          loan: mockLoan
        })
      });
    });

    /**
     * Test loan application creation with validation errors
     */
    it('should reject loan application with validation errors', async () => {
      // Arrange
      const loanData = {
        clientUserId: 'client123',
        loanAmount: -1000, // Invalid amount
        loanTerm: 0 // Invalid term
      };

      req.body = loanData;
      req.user = { userId: 'agent123', role: 'agent' };

      const validationErrors = [
        'Loan amount must be positive',
        'Loan term must be at least 1 month'
      ];

      validateLoanApplication.mockResolvedValue({
        isValid: false,
        errors: validationErrors
      });

      // Act
      await loanController.createLoanApplication(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'BUSINESS_RULE_VIOLATION',
          message: 'Loan application violates business rules',
          details: validationErrors,
          timestamp: expect.any(String)
        }
      });
    });

    /**
     * Test loan application creation with non-existent client
     */
    it('should handle non-existent client error', async () => {
      // Arrange
      const loanData = {
        clientUserId: 'nonexistent',
        loanAmount: 50000,
        loanTerm: 12
      };

      req.body = loanData;
      req.user = { userId: 'agent123', role: 'agent' };

      validateLoanApplication.mockResolvedValue({
        isValid: true,
        errors: []
      });

      Client.findById.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          populate: jest.fn().mockResolvedValue(null)
        })
      });

      // Act
      await loanController.createLoanApplication(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'CLIENT_NOT_FOUND',
          message: 'Client not found',
          timestamp: expect.any(String)
        }
      });
    });
  });

  describe('getRegionalLoans', () => {
    /**
     * Test getting regional loans with proper filtering
     */
    it('should return loans filtered by region', async () => {
      // Arrange
      const user = {
        userId: 'rm123',
        role: 'regional_manager',
        region: 'region123'
      };

      const filters = {
        status: 'pending',
        page: 1,
        limit: 10
      };

      req.user = user;
      req.query = filters;

      const mockLoans = [
        { _id: 'loan1', loanAmount: 50000, loanStatus: 'pending' },
        { _id: 'loan2', loanAmount: 75000, loanStatus: 'pending' }
      ];

      const mockLoanRepository = {
        findByRegion: jest.fn().mockResolvedValue({
          loans: mockLoans,
          totalCount: 2,
          currentPage: 1,
          totalPages: 1
        })
      };
      LoanRepository.mockImplementation(() => mockLoanRepository);

      // Act
      await loanController.getRegionalLoans(req, res);

      // Assert
      expect(mockLoanRepository.findByRegion).toHaveBeenCalledWith(
        'region123',
        expect.objectContaining({ status: 'pending' }),
        expect.objectContaining({ page: 1, limit: 10 })
      );
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: {
          loans: mockLoans,
          pagination: {
            totalCount: 2,
            currentPage: 1,
            totalPages: 1,
            hasNext: false,
            hasPrev: false
          }
        }
      });
    });
  });

  describe('updateLoanStatus', () => {
    /**
     * Test successful loan status update
     */
    it('should update loan status with valid data', async () => {
      // Arrange
      const loanId = 'loan123';
      const statusUpdate = {
        status: 'approved',
        comments: 'Loan approved after review'
      };

      req.params = { id: loanId };
      req.body = statusUpdate;
      req.user = {
        userId: 'rm123',
        role: 'regional_manager',
        region: 'region123'
      };

      const mockLoan = {
        _id: loanId,
        loanStatus: 'pending',
        clientUserId: 'client123',
        save: jest.fn().mockResolvedValue(true)
      };

      Loan.findById.mockResolvedValue(mockLoan);

      const mockLoanRepository = {
        updateStatus: jest.fn().mockResolvedValue({
          ...mockLoan,
          loanStatus: 'approved'
        })
      };
      LoanRepository.mockImplementation(() => mockLoanRepository);

      // Act
      await loanController.updateLoanStatus(req, res);

      // Assert
      expect(Loan.findById).toHaveBeenCalledWith(loanId);
      expect(mockLoanRepository.updateStatus).toHaveBeenCalledWith(
        loanId,
        'approved',
        req.user.userId,
        'Loan approved after review'
      );
      expect(res.status).toHaveBeenCalledWith(200);
    });

    /**
     * Test loan status update with non-existent loan
     */
    it('should handle non-existent loan error', async () => {
      // Arrange
      req.params = { id: 'nonexistent' };
      req.body = { status: 'approved' };
      req.user = { userId: 'rm123', role: 'regional_manager' };

      Loan.findById.mockResolvedValue(null);

      // Act
      await loanController.updateLoanStatus(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'LOAN_NOT_FOUND',
          message: 'Loan not found',
          timestamp: expect.any(String)
        }
      });
    });
  });

  describe('getLoanStatistics', () => {
    /**
     * Test getting loan statistics
     */
    it('should return loan statistics for region', async () => {
      // Arrange
      req.user = {
        userId: 'rm123',
        role: 'regional_manager',
        region: 'region123'
      };

      const mockStats = {
        totalLoans: 100,
        pendingLoans: 25,
        approvedLoans: 60,
        rejectedLoans: 15,
        totalAmount: 5000000,
        averageAmount: 50000
      };

      const mockLoanRepository = {
        getStatsByRegion: jest.fn().mockResolvedValue(mockStats)
      };
      LoanRepository.mockImplementation(() => mockLoanRepository);

      // Act
      await loanController.getLoanStatistics(req, res);

      // Assert
      expect(mockLoanRepository.getStatsByRegion).toHaveBeenCalledWith('region123');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: mockStats
      });
    });
  });
});