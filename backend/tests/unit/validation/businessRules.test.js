/**
 * Unit Tests for Business Rules Validation
 * @fileoverview Tests for business rules validation logic
 */

const {
  validateLoanApplication,
  validateLoanStatusUpdate,
  calculateMonthlyPayment,
  validateClientEligibility
} = require('../../../validation/businessRules');
const Client = require('../../../models/Client');
const Loan = require('../../../models/Loan');

// Mock dependencies
jest.mock('../../../models/Client');
jest.mock('../../../models/Loan');

describe('Business Rules Validation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('validateLoanApplication', () => {
    /**
     * Test valid loan application
     */
    it('should validate correct loan application', async () => {
      // Arrange
      const loanData = {
        clientUserId: 'client123',
        loanAmount: 50000,
        loanTerm: 12,
        interestRate: 15,
        purpose: 'business'
      };

      const user = {
        userId: 'agent123',
        role: 'agent',
        region: 'region123'
      };

      const mockClient = {
        _id: 'client123',
        personalInfo: {
          monthlyIncome: 100000,
          employmentStatus: 'employed'
        },
        creditScore: 750,
        assignedAgent: 'agent123'
      };

      Client.findById.mockResolvedValue(mockClient);
      Loan.find.mockResolvedValue([]); // No existing loans

      // Act
      const result = await validateLoanApplication(loanData, user);

      // Assert
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    /**
     * Test loan amount exceeds maximum limit
     */
    it('should reject loan with amount exceeding maximum limit', async () => {
      // Arrange
      const loanData = {
        clientUserId: 'client123',
        loanAmount: 15000000, // Exceeds 10M limit
        loanTerm: 12,
        interestRate: 15
      };

      const user = { userId: 'agent123', role: 'agent' };

      // Act
      const result = await validateLoanApplication(loanData, user);

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Loan amount exceeds maximum limit of 10,000,000');
    });

    /**
     * Test loan amount below minimum limit
     */
    it('should reject loan with amount below minimum limit', async () => {
      // Arrange
      const loanData = {
        clientUserId: 'client123',
        loanAmount: 500, // Below 1000 minimum
        loanTerm: 12,
        interestRate: 15
      };

      const user = { userId: 'agent123', role: 'agent' };

      // Act
      const result = await validateLoanApplication(loanData, user);

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Loan amount must be at least 1,000');
    });

    /**
     * Test invalid loan term
     */
    it('should reject loan with invalid term', async () => {
      // Arrange
      const loanData = {
        clientUserId: 'client123',
        loanAmount: 50000,
        loanTerm: 400, // Exceeds 360 months maximum
        interestRate: 15
      };

      const user = { userId: 'agent123', role: 'agent' };

      // Act
      const result = await validateLoanApplication(loanData, user);

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Loan term cannot exceed 360 months');
    });

    /**
     * Test client with insufficient income
     */
    it('should reject loan for client with insufficient income', async () => {
      // Arrange
      const loanData = {
        clientUserId: 'client123',
        loanAmount: 500000,
        loanTerm: 12,
        interestRate: 15
      };

      const user = { userId: 'agent123', role: 'agent' };

      const mockClient = {
        _id: 'client123',
        personalInfo: {
          monthlyIncome: 30000, // Too low for requested amount
          employmentStatus: 'employed'
        },
        creditScore: 700,
        assignedAgent: 'agent123'
      };

      Client.findById.mockResolvedValue(mockClient);
      Loan.find.mockResolvedValue([]);

      // Act
      const result = await validateLoanApplication(loanData, user);

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Monthly payment exceeds 40% of client income');
    });

    /**
     * Test client with existing active loans exceeding limit
     */
    it('should reject loan for client with too many active loans', async () => {
      // Arrange
      const loanData = {
        clientUserId: 'client123',
        loanAmount: 50000,
        loanTerm: 12,
        interestRate: 15
      };

      const user = { userId: 'agent123', role: 'agent' };

      const mockClient = {
        _id: 'client123',
        personalInfo: {
          monthlyIncome: 100000,
          employmentStatus: 'employed'
        },
        creditScore: 700,
        assignedAgent: 'agent123'
      };

      const existingLoans = [
        { loanAmount: 100000, loanStatus: 'active' },
        { loanAmount: 150000, loanStatus: 'active' },
        { loanAmount: 200000, loanStatus: 'active' }
      ];

      Client.findById.mockResolvedValue(mockClient);
      Loan.find.mockResolvedValue(existingLoans);

      // Act
      const result = await validateLoanApplication(loanData, user);

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Client has reached maximum number of active loans');
    });
  });

  describe('calculateMonthlyPayment', () => {
    /**
     * Test monthly payment calculation
     */
    it('should calculate monthly payment correctly', () => {
      // Arrange
      const principal = 100000;
      const annualRate = 12; // 12% annual
      const termMonths = 12;

      // Act
      const payment = calculateMonthlyPayment(principal, annualRate, termMonths);

      // Assert
      expect(payment).toBeCloseTo(8884.88, 2); // Expected payment for these values
    });

    /**
     * Test monthly payment with zero interest
     */
    it('should calculate payment correctly with zero interest', () => {
      // Arrange
      const principal = 120000;
      const annualRate = 0;
      const termMonths = 12;

      // Act
      const payment = calculateMonthlyPayment(principal, annualRate, termMonths);

      // Assert
      expect(payment).toBe(10000); // 120000 / 12
    });

    /**
     * Test monthly payment with single month term
     */
    it('should handle single month term correctly', () => {
      // Arrange
      const principal = 50000;
      const annualRate = 15;
      const termMonths = 1;

      // Act
      const payment = calculateMonthlyPayment(principal, annualRate, termMonths);

      // Assert
      expect(payment).toBeCloseTo(50625, 2); // Principal + one month interest
    });
  });

  describe('validateLoanStatusUpdate', () => {
    /**
     * Test valid status transition
     */
    it('should allow valid status transition', async () => {
      // Arrange
      const currentStatus = 'pending';
      const newStatus = 'approved';
      const user = { role: 'regional_manager' };

      // Act
      const result = await validateLoanStatusUpdate(currentStatus, newStatus, user);

      // Assert
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    /**
     * Test invalid status transition
     */
    it('should reject invalid status transition', async () => {
      // Arrange
      const currentStatus = 'rejected';
      const newStatus = 'approved';
      const user = { role: 'regional_manager' };

      // Act
      const result = await validateLoanStatusUpdate(currentStatus, newStatus, user);

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Cannot change status from rejected to approved');
    });

    /**
     * Test unauthorized role for status update
     */
    it('should reject status update from unauthorized role', async () => {
      // Arrange
      const currentStatus = 'pending';
      const newStatus = 'approved';
      const user = { role: 'agent' }; // Agents cannot approve loans

      // Act
      const result = await validateLoanStatusUpdate(currentStatus, newStatus, user);

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Insufficient permissions to approve loans');
    });
  });

  describe('validateClientEligibility', () => {
    /**
     * Test eligible client
     */
    it('should validate eligible client', async () => {
      // Arrange
      const clientData = {
        personalInfo: {
          age: 30,
          monthlyIncome: 75000,
          employmentStatus: 'employed',
          employmentDuration: 24 // months
        },
        creditScore: 720,
        hasDefaultHistory: false
      };

      // Act
      const result = await validateClientEligibility(clientData);

      // Assert
      expect(result.isEligible).toBe(true);
      expect(result.reasons).toHaveLength(0);
    });

    /**
     * Test client below minimum age
     */
    it('should reject client below minimum age', async () => {
      // Arrange
      const clientData = {
        personalInfo: {
          age: 17, // Below 18 minimum
          monthlyIncome: 75000,
          employmentStatus: 'employed'
        }
      };

      // Act
      const result = await validateClientEligibility(clientData);

      // Assert
      expect(result.isEligible).toBe(false);
      expect(result.reasons).toContain('Client must be at least 18 years old');
    });

    /**
     * Test client with insufficient income
     */
    it('should reject client with insufficient income', async () => {
      // Arrange
      const clientData = {
        personalInfo: {
          age: 25,
          monthlyIncome: 15000, // Below 25000 minimum
          employmentStatus: 'employed'
        }
      };

      // Act
      const result = await validateClientEligibility(clientData);

      // Assert
      expect(result.isEligible).toBe(false);
      expect(result.reasons).toContain('Minimum monthly income requirement not met');
    });

    /**
     * Test unemployed client
     */
    it('should reject unemployed client', async () => {
      // Arrange
      const clientData = {
        personalInfo: {
          age: 30,
          monthlyIncome: 0,
          employmentStatus: 'unemployed'
        }
      };

      // Act
      const result = await validateClientEligibility(clientData);

      // Assert
      expect(result.isEligible).toBe(false);
      expect(result.reasons).toContain('Client must be employed or self-employed');
    });

    /**
     * Test client with poor credit score
     */
    it('should reject client with poor credit score', async () => {
      // Arrange
      const clientData = {
        personalInfo: {
          age: 30,
          monthlyIncome: 75000,
          employmentStatus: 'employed'
        },
        creditScore: 450, // Below 500 minimum
        hasDefaultHistory: false
      };

      // Act
      const result = await validateClientEligibility(clientData);

      // Assert
      expect(result.isEligible).toBe(false);
      expect(result.reasons).toContain('Credit score below minimum requirement');
    });
  });
});