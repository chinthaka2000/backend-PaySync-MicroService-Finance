/**
 * Validation module exports
 * Centralized validation system for the PaySync backend
 */

const { validate, validateMultiple, validateIf, sanitizeInput, validateRequestSize } = require('../middlewares/validation');
const schemas = require('./schemas');
const fileValidation = require('./fileValidation');
const businessRules = require('./businessRules');

module.exports = {
  // Core validation middleware
  validate,
  validateMultiple,
  validateIf,
  sanitizeInput,
  validateRequestSize,

  // Validation schemas
  schemas,

  // File validation
  fileValidation,

  // Business rules validation
  businessRules,

  // Convenience exports for commonly used schemas
  authSchemas: schemas.authSchemas,
  loanSchemas: schemas.loanSchemas,
  clientSchemas: schemas.clientSchemas,
  staffSchemas: schemas.staffSchemas,
  regionalAdminSchemas: schemas.regionalAdminSchemas,
  agentSchemas: schemas.agentSchemas,
  systemSchemas: schemas.systemSchemas,
  paymentSchemas: schemas.paymentSchemas,
  reportSchemas: schemas.reportSchemas,

  // Convenience exports for file validation
  validateClientDocuments: fileValidation.validateClientDocuments,
  validateAgreementDocuments: fileValidation.validateAgreementDocuments,
  validateDocuments: fileValidation.validateDocuments,
  validateImages: fileValidation.validateImages,
  validateLoanDocuments: fileValidation.validateLoanDocuments,
  validateProfileImages: fileValidation.validateProfileImages,

  // Convenience exports for business rules
  validateLoanApplication: businessRules.validateLoanApplication,
  validateStaffCreation: businessRules.validateStaffCreation,
  validateClientApproval: businessRules.validateClientApproval,
  validateLoanStatusUpdate: businessRules.validateLoanStatusUpdate,
  validateRegionAssignment: businessRules.validateRegionAssignment,
  validatePayment: businessRules.validatePayment,
  validateAgentAssignment: businessRules.validateAgentAssignment
};