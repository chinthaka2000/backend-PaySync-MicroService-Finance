/**
 * @fileoverview Business Rules Validation - Complex business logic validation
 * @module validation/businessRules
 */

const mongoose = require('mongoose');
const Client = require('../models/Client');
const Staff = require('../models/Staff');
const Loan = require('../models/Loan');
const Region = require('../models/Region');

/**
 * Validate loan application against business rules
 * @async
 * @function validateLoanApplication
 * @param {Object} loanData - Loan application data to validate
 * @param {string} loanData.clientUserId - Client ID applying for loan
 * @param {number} loanData.loanAmount - Requested loan amount
 * @param {number} loanData.loanTerm - Loan term in months
 * @param {number} loanData.interestRate - Annual interest rate
 * @param {string} loanData.purpose - Purpose of the loan
 * @param {Object} user - Current authenticated user
 * @param {string} user.userId - User ID
 * @param {string} user.role - User role (agent, regional_manager, etc.)
 * @param {string} user.region - User's assigned region
 * @returns {Promise<Object>} Validation result object
 * @returns {boolean} returns.isValid - Whether validation passed
 * @returns {Array<Object>} returns.errors - Array of validation errors
 * 
 * @example
 * const loanData = {
 *   clientUserId: "507f1f77bcf86cd799439011",
 *   loanAmount: 50000,
 *   loanTerm: 12,
 *   interestRate: 15,
 *   purpose: "business"
 * };
 * 
 * const user = {
 *   userId: "507f1f77bcf86cd799439012",
 *   role: "agent",
 *   region: "507f1f77bcf86cd799439013"
 * };
 * 
 * const result = await validateLoanApplication(loanData, user);
 * if (!result.isValid) {
 *   console.log('Validation errors:', result.errors);
 * }
 */
const validateLoanApplication = async (loanData, user) => {
  const errors = [];

  try {
    // 1. Validate client exists and is approved
    const client = await Client.findById(loanData.clientUserId);
    if (!client) {
      errors.push({
        field: 'clientUserId',
        message: 'Client not found',
        code: 'CLIENT_NOT_FOUND'
      });
    } else {
      // Check client status
      if (client.status !== 'approved') {
        errors.push({
          field: 'clientUserId',
          message: 'Client must be approved before applying for a loan',
          code: 'CLIENT_NOT_APPROVED'
        });
      }

      // Check if client is assigned to the requesting agent (for agents)
      if (user.role === 'agent' && client.assignedAgent?.toString() !== user.userId) {
        errors.push({
          field: 'clientUserId',
          message: 'You can only create loans for clients assigned to you',
          code: 'CLIENT_NOT_ASSIGNED'
        });
      }

      // Check for existing active loans
      const existingLoans = await Loan.find({
        clientUserId: loanData.clientUserId,
        loanStatus: { $in: ['pending', 'approved', 'active'] }
      });

      if (existingLoans.length > 0) {
        errors.push({
          field: 'clientUserId',
          message: 'Client already has an active or pending loan',
          code: 'EXISTING_ACTIVE_LOAN'
        });
      }
    }

    // 2. Validate loan amount against client's income (debt-to-income ratio)
    if (client && client.employmentInfo?.monthlyIncome) {
      const monthlyIncome = client.employmentInfo.monthlyIncome;
      const monthlyPayment = calculateMonthlyPayment(
        loanData.loanAmount,
        loanData.interestRate,
        loanData.loanTerm
      );

      const debtToIncomeRatio = (monthlyPayment / monthlyIncome) * 100;

      if (debtToIncomeRatio > 40) { // 40% DTI ratio limit
        errors.push({
          field: 'loanAmount',
          message: `Loan amount results in ${debtToIncomeRatio.toFixed(1)}% debt-to-income ratio. Maximum allowed is 40%`,
          code: 'HIGH_DEBT_TO_INCOME_RATIO'
        });
      }
    }

    // 3. Validate loan amount limits based on client profile
    if (client) {
      const maxLoanAmount = calculateMaxLoanAmount(client);
      if (loanData.loanAmount > maxLoanAmount) {
        errors.push({
          field: 'loanAmount',
          message: `Maximum loan amount for this client is ${maxLoanAmount}`,
          code: 'EXCEEDS_MAX_LOAN_AMOUNT'
        });
      }
    }

    // 4. Validate guarantor information
    if (loanData.guarantorInfo) {
      // Check if guarantor is not the same as client
      if (client && loanData.guarantorInfo.idNumber === client.personalInfo?.idNumber) {
        errors.push({
          field: 'guarantorInfo.idNumber',
          message: 'Guarantor cannot be the same person as the loan applicant',
          code: 'GUARANTOR_SAME_AS_CLIENT'
        });
      }

      // Check if guarantor is already guaranteeing too many loans
      const guarantorLoans = await Loan.find({
        'guarantorInfo.idNumber': loanData.guarantorInfo.idNumber,
        loanStatus: { $in: ['approved', 'active'] }
      });

      if (guarantorLoans.length >= 3) { // Maximum 3 loans per guarantor
        errors.push({
          field: 'guarantorInfo.idNumber',
          message: 'Guarantor is already guaranteeing the maximum number of loans (3)',
          code: 'GUARANTOR_LIMIT_EXCEEDED'
        });
      }
    }

    // 5. Validate regional constraints
    if (user.role === 'agent' || user.role === 'regional_manager') {
      if (client && user.region && client.personalInfo?.address?.district) {
        const userRegion = await Region.findById(user.region);
        if (userRegion && !userRegion.districts.includes(client.personalInfo.address.district)) {
          errors.push({
            field: 'clientUserId',
            message: 'Client is not in your assigned region',
            code: 'CLIENT_OUTSIDE_REGION'
          });
        }
      }
    }

  } catch (error) {
    errors.push({
      field: 'general',
      message: 'Error validating loan application',
      code: 'VALIDATION_ERROR',
      details: error.message
    });
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

/**
 * Validate staff creation business rules
 * @param {Object} staffData - Staff creation data
 * @param {Object} creator - User creating the staff
 * @returns {Promise<Object>} Validation result
 */
const validateStaffCreation = async (staffData, creator) => {
  const errors = [];

  try {
    // 1. Validate role hierarchy - users can only create roles below their level
    const roleHierarchy = {
      'super_admin': ['moderate_admin', 'ceo', 'regional_manager', 'agent'],
      'moderate_admin': ['regional_manager', 'agent'],
      'ceo': [], // CEO cannot create users
      'regional_manager': [], // Regional manager cannot create users
      'agent': [] // Agent cannot create users
    };

    const allowedRoles = roleHierarchy[creator.role] || [];
    if (!allowedRoles.includes(staffData.role)) {
      errors.push({
        field: 'role',
        message: `You are not authorized to create users with role: ${staffData.role}`,
        code: 'UNAUTHORIZED_ROLE_CREATION'
      });
    }

    // 2. Validate email uniqueness
    const existingStaff = await Staff.findOne({
      'personalInfo.email': staffData.personalInfo.email
    });

    if (existingStaff) {
      errors.push({
        field: 'personalInfo.email',
        message: 'Email address is already in use',
        code: 'EMAIL_ALREADY_EXISTS'
      });
    }

    // 3. Validate region assignment
    if (staffData.region) {
      const region = await Region.findById(staffData.region);
      if (!region) {
        errors.push({
          field: 'region',
          message: 'Invalid region specified',
          code: 'INVALID_REGION'
        });
      } else if (!region.isActive) {
        errors.push({
          field: 'region',
          message: 'Cannot assign staff to inactive region',
          code: 'INACTIVE_REGION'
        });
      }

      // Regional manager can only be assigned to one region
      if (staffData.role === 'regional_manager') {
        const existingRegionalManager = await Staff.findOne({
          role: 'regional_manager',
          region: staffData.region,
          isActive: true
        });

        if (existingRegionalManager) {
          errors.push({
            field: 'region',
            message: 'Region already has an active regional manager',
            code: 'REGION_MANAGER_EXISTS'
          });
        }
      }
    }

    // 4. Validate manager assignment for agents
    if (staffData.role === 'agent' && staffData.managedBy) {
      const manager = await Staff.findById(staffData.managedBy);
      if (!manager) {
        errors.push({
          field: 'managedBy',
          message: 'Invalid manager specified',
          code: 'INVALID_MANAGER'
        });
      } else if (manager.role !== 'regional_manager') {
        errors.push({
          field: 'managedBy',
          message: 'Agents can only be managed by regional managers',
          code: 'INVALID_MANAGER_ROLE'
        });
      } else if (!manager.isActive) {
        errors.push({
          field: 'managedBy',
          message: 'Cannot assign agent to inactive manager',
          code: 'INACTIVE_MANAGER'
        });
      }

      // Check if agent and manager are in the same region
      if (manager.region?.toString() !== staffData.region?.toString()) {
        errors.push({
          field: 'managedBy',
          message: 'Agent and manager must be in the same region',
          code: 'REGION_MISMATCH'
        });
      }
    }

  } catch (error) {
    errors.push({
      field: 'general',
      message: 'Error validating staff creation',
      code: 'VALIDATION_ERROR',
      details: error.message
    });
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

/**
 * Validate client approval business rules
 * @param {string} clientId - Client ID to approve
 * @param {Object} approver - User approving the client
 * @returns {Promise<Object>} Validation result
 */
const validateClientApproval = async (clientId, approver) => {
  const errors = [];

  try {
    const client = await Client.findById(clientId);

    if (!client) {
      errors.push({
        field: 'clientId',
        message: 'Client not found',
        code: 'CLIENT_NOT_FOUND'
      });
      return { isValid: false, errors };
    }

    // 1. Check if client is in pending status
    if (client.status !== 'pending') {
      errors.push({
        field: 'status',
        message: `Client is already ${client.status}. Only pending clients can be approved.`,
        code: 'INVALID_CLIENT_STATUS'
      });
    }

    // 2. Validate regional constraints
    if (approver.role === 'regional_manager') {
      const approverRegion = await Region.findById(approver.region);
      if (approverRegion && client.personalInfo?.address?.district) {
        if (!approverRegion.districts.includes(client.personalInfo.address.district)) {
          errors.push({
            field: 'region',
            message: 'You can only approve clients in your assigned region',
            code: 'CLIENT_OUTSIDE_REGION'
          });
        }
      }
    }

    // 3. Check required documents
    const requiredDocuments = ['idCard', 'employmentLetter'];
    const missingDocuments = requiredDocuments.filter(doc => !client.documents?.[doc]);

    if (missingDocuments.length > 0) {
      errors.push({
        field: 'documents',
        message: `Missing required documents: ${missingDocuments.join(', ')}`,
        code: 'MISSING_DOCUMENTS'
      });
    }

  } catch (error) {
    errors.push({
      field: 'general',
      message: 'Error validating client approval',
      code: 'VALIDATION_ERROR',
      details: error.message
    });
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

/**
 * Validate loan status update business rules
 * @param {string} loanId - Loan ID to update
 * @param {string} newStatus - New status to set
 * @param {Object} updater - User updating the loan
 * @returns {Promise<Object>} Validation result
 */
const validateLoanStatusUpdate = async (loanId, newStatus, updater) => {
  const errors = [];

  try {
    const loan = await Loan.findById(loanId).populate('clientUserId');

    if (!loan) {
      errors.push({
        field: 'loanId',
        message: 'Loan not found',
        code: 'LOAN_NOT_FOUND'
      });
      return { isValid: false, errors };
    }

    // 1. Validate status transitions
    const validTransitions = {
      'pending': ['approved', 'rejected'],
      'approved': ['active', 'rejected'],
      'active': ['completed', 'defaulted'],
      'completed': [], // Final state
      'defaulted': ['active'], // Can be reactivated
      'rejected': [] // Final state
    };

    const allowedStatuses = validTransitions[loan.loanStatus] || [];
    if (!allowedStatuses.includes(newStatus)) {
      errors.push({
        field: 'status',
        message: `Cannot change loan status from ${loan.loanStatus} to ${newStatus}`,
        code: 'INVALID_STATUS_TRANSITION'
      });
    }

    // 2. Validate user permissions for status changes
    if (newStatus === 'approved' || newStatus === 'rejected') {
      // Only regional managers and above can approve/reject loans
      const authorizedRoles = ['regional_manager', 'moderate_admin', 'ceo', 'super_admin'];
      if (!authorizedRoles.includes(updater.role)) {
        errors.push({
          field: 'status',
          message: 'You are not authorized to approve or reject loans',
          code: 'UNAUTHORIZED_STATUS_CHANGE'
        });
      }

      // Regional managers can only approve loans in their region
      if (updater.role === 'regional_manager') {
        const updaterRegion = await Region.findById(updater.region);
        if (updaterRegion && loan.clientUserId?.personalInfo?.address?.district) {
          if (!updaterRegion.districts.includes(loan.clientUserId.personalInfo.address.district)) {
            errors.push({
              field: 'region',
              message: 'You can only approve loans for clients in your assigned region',
              code: 'LOAN_OUTSIDE_REGION'
            });
          }
        }
      }
    }

    // 3. Validate loan amount limits for approval
    if (newStatus === 'approved') {
      const HIGH_VALUE_THRESHOLD = 1000000; // 1M threshold for CEO approval

      if (loan.loanAmount > HIGH_VALUE_THRESHOLD && updater.role !== 'ceo' && updater.role !== 'super_admin') {
        errors.push({
          field: 'loanAmount',
          message: 'High-value loans require CEO approval',
          code: 'CEO_APPROVAL_REQUIRED'
        });
      }
    }

  } catch (error) {
    errors.push({
      field: 'general',
      message: 'Error validating loan status update',
      code: 'VALIDATION_ERROR',
      details: error.message
    });
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

/**
 * Helper function to calculate monthly payment
 * @param {number} principal - Loan amount
 * @param {number} annualRate - Annual interest rate (percentage)
 * @param {number} termMonths - Loan term in months
 * @returns {number} Monthly payment amount
 */
const calculateMonthlyPayment = (principal, annualRate, termMonths) => {
  const monthlyRate = (annualRate / 100) / 12;
  if (monthlyRate === 0) return principal / termMonths;

  return principal * (monthlyRate * Math.pow(1 + monthlyRate, termMonths)) /
    (Math.pow(1 + monthlyRate, termMonths) - 1);
};

/**
 * Helper function to calculate maximum loan amount based on client profile
 * @param {Object} client - Client object
 * @returns {number} Maximum loan amount
 */
const calculateMaxLoanAmount = (client) => {
  if (!client.employmentInfo?.monthlyIncome) return 50000; // Default minimum

  const monthlyIncome = client.employmentInfo.monthlyIncome;
  let multiplier = 10; // Base multiplier

  // Adjust based on employment type
  switch (client.employmentInfo.employmentType) {
    case 'employed':
      multiplier = 15;
      break;
    case 'self_employed':
      multiplier = 10;
      break;
    case 'unemployed':
      multiplier = 0;
      break;
    case 'retired':
      multiplier = 5;
      break;
  }

  // Adjust based on work experience
  if (client.employmentInfo.workExperience > 5) {
    multiplier += 2;
  } else if (client.employmentInfo.workExperience > 2) {
    multiplier += 1;
  }

  return Math.min(monthlyIncome * multiplier, 5000000); // Cap at 5M
};

/**
 * Validate region assignment business rules
 * @param {string} regionId - Region ID to validate
 * @param {Array} districts - Districts to assign to region
 * @param {Object} assigner - User assigning the region
 * @returns {Promise<Object>} Validation result
 */
const validateRegionAssignment = async (regionId, districts, assigner) => {
  const errors = [];

  try {
    // 1. Check if districts are already assigned to other regions
    const existingRegions = await Region.find({
      _id: { $ne: regionId },
      districts: { $in: districts },
      isActive: true
    });

    if (existingRegions.length > 0) {
      const conflictingDistricts = [];
      existingRegions.forEach(region => {
        const conflicts = region.districts.filter(d => districts.includes(d));
        conflictingDistricts.push(...conflicts.map(d => ({ district: d, region: region.name })));
      });

      errors.push({
        field: 'districts',
        message: `Districts already assigned to other regions: ${conflictingDistricts.map(c => `${c.district} (${c.region})`).join(', ')}`,
        code: 'DISTRICTS_ALREADY_ASSIGNED'
      });
    }

    // 2. Validate assigner permissions
    if (assigner.role !== 'moderate_admin' && assigner.role !== 'super_admin') {
      errors.push({
        field: 'assigner',
        message: 'Only moderate admins and super admins can assign regions',
        code: 'UNAUTHORIZED_REGION_ASSIGNMENT'
      });
    }

    // 3. Validate district list is not empty
    if (!districts || districts.length === 0) {
      errors.push({
        field: 'districts',
        message: 'At least one district must be assigned to the region',
        code: 'NO_DISTRICTS_ASSIGNED'
      });
    }

  } catch (error) {
    errors.push({
      field: 'general',
      message: 'Error validating region assignment',
      code: 'VALIDATION_ERROR',
      details: error.message
    });
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

/**
 * Validate payment business rules
 * @param {string} loanId - Loan ID for payment
 * @param {number} amount - Payment amount
 * @param {Object} payer - User making the payment
 * @returns {Promise<Object>} Validation result
 */
const validatePayment = async (loanId, amount, payer) => {
  const errors = [];

  try {
    const loan = await Loan.findById(loanId);

    if (!loan) {
      errors.push({
        field: 'loanId',
        message: 'Loan not found',
        code: 'LOAN_NOT_FOUND'
      });
      return { isValid: false, errors };
    }

    // 1. Check loan status
    if (loan.loanStatus !== 'active') {
      errors.push({
        field: 'loanStatus',
        message: 'Payments can only be made for active loans',
        code: 'INVALID_LOAN_STATUS'
      });
    }

    // 2. Validate payment amount
    if (amount <= 0) {
      errors.push({
        field: 'amount',
        message: 'Payment amount must be greater than zero',
        code: 'INVALID_PAYMENT_AMOUNT'
      });
    }

    // 3. Check if payment exceeds remaining balance
    const remainingBalance = loan.loanAmount - (loan.totalPaid || 0);
    if (amount > remainingBalance) {
      errors.push({
        field: 'amount',
        message: `Payment amount (${amount}) exceeds remaining balance (${remainingBalance})`,
        code: 'PAYMENT_EXCEEDS_BALANCE'
      });
    }

    // 4. Validate minimum payment amount (e.g., at least 1% of loan amount)
    const minPayment = loan.loanAmount * 0.01;
    if (amount < minPayment) {
      errors.push({
        field: 'amount',
        message: `Payment amount must be at least ${minPayment.toFixed(2)} (1% of loan amount)`,
        code: 'PAYMENT_BELOW_MINIMUM'
      });
    }

  } catch (error) {
    errors.push({
      field: 'general',
      message: 'Error validating payment',
      code: 'VALIDATION_ERROR',
      details: error.message
    });
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

/**
 * Validate agent assignment to regional manager
 * @param {string} agentId - Agent ID to assign
 * @param {string} regionalManagerId - Regional Manager ID
 * @param {Object} assigner - User making the assignment
 * @returns {Promise<Object>} Validation result
 */
const validateAgentAssignment = async (agentId, regionalManagerId, assigner) => {
  const errors = [];

  try {
    const agent = await Staff.findById(agentId);
    const regionalManager = await Staff.findById(regionalManagerId);

    if (!agent) {
      errors.push({
        field: 'agentId',
        message: 'Agent not found',
        code: 'AGENT_NOT_FOUND'
      });
    }

    if (!regionalManager) {
      errors.push({
        field: 'regionalManagerId',
        message: 'Regional manager not found',
        code: 'REGIONAL_MANAGER_NOT_FOUND'
      });
    }

    if (agent && regionalManager) {
      // 1. Validate roles
      if (agent.role !== 'agent') {
        errors.push({
          field: 'agentId',
          message: 'Selected staff member is not an agent',
          code: 'INVALID_AGENT_ROLE'
        });
      }

      if (regionalManager.role !== 'regional_manager') {
        errors.push({
          field: 'regionalManagerId',
          message: 'Selected staff member is not a regional manager',
          code: 'INVALID_MANAGER_ROLE'
        });
      }

      // 2. Check if both are in the same region
      if (agent.region?.toString() !== regionalManager.region?.toString()) {
        errors.push({
          field: 'region',
          message: 'Agent and regional manager must be in the same region',
          code: 'REGION_MISMATCH'
        });
      }

      // 3. Check if agent is already assigned to another manager
      if (agent.managedBy && agent.managedBy.toString() !== regionalManagerId) {
        const currentManager = await Staff.findById(agent.managedBy);
        errors.push({
          field: 'agentId',
          message: `Agent is already assigned to ${currentManager?.personalInfo?.firstName} ${currentManager?.personalInfo?.lastName}`,
          code: 'AGENT_ALREADY_ASSIGNED'
        });
      }

      // 4. Check manager capacity (max 20 agents per manager)
      const managedAgents = await Staff.countDocuments({
        managedBy: regionalManagerId,
        isActive: true
      });

      if (managedAgents >= 20) {
        errors.push({
          field: 'regionalManagerId',
          message: 'Regional manager has reached maximum capacity (20 agents)',
          code: 'MANAGER_CAPACITY_EXCEEDED'
        });
      }
    }

    // 5. Validate assigner permissions
    if (assigner.role !== 'moderate_admin' && assigner.role !== 'super_admin') {
      errors.push({
        field: 'assigner',
        message: 'Only moderate admins and super admins can assign agents to managers',
        code: 'UNAUTHORIZED_ASSIGNMENT'
      });
    }

  } catch (error) {
    errors.push({
      field: 'general',
      message: 'Error validating agent assignment',
      code: 'VALIDATION_ERROR',
      details: error.message
    });
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

module.exports = {
  validateLoanApplication,
  validateStaffCreation,
  validateClientApproval,
  validateLoanStatusUpdate,
  validateRegionAssignment,
  validatePayment,
  validateAgentAssignment,
  calculateMonthlyPayment,
  calculateMaxLoanAmount
};