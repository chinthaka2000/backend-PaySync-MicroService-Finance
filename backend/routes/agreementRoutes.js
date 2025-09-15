const express = require('express');
const router = express.Router();
const agreementController = require('../controllers/agreementController');
const { authenticate, requirePermissions } = require('../middlewares/authMiddleware');
const { PERMISSIONS } = require('../utils/permissions');
const { validate, schemas } = require('../validation');
const Joi = require('joi');

const { objectId } = schemas;

// All routes require authentication
router.use(authenticate);

/**
 * Generate agreement for a loan
 * POST /api/agreements/generate/:loanId
 */
router.post('/generate/:loanId',
  requirePermissions(PERMISSIONS.GENERATE_AGREEMENTS),
  validate(Joi.object({ loanId: objectId.required() }), 'params'),
  validate(Joi.object({
    template: Joi.string().valid('standard', 'premium', 'basic').optional(),
    language: Joi.string().valid('en', 'si', 'ta').optional(),
    includeTerms: Joi.boolean().optional(),
    watermark: Joi.string().max(50).optional()
  })),
  agreementController.generateAgreement
);

/**
 * Download agreement
 * GET /api/agreements/:agreementId/download
 */
router.get('/:agreementId/download',
  requirePermissions(PERMISSIONS.VIEW_AGREEMENTS),
  validate(Joi.object({ agreementId: Joi.string().required() }), 'params'),
  validate(Joi.object({
    download: Joi.string().valid('true', 'false').optional()
  }), 'query'),
  agreementController.downloadAgreement
);

/**
 * Get agreement information
 * GET /api/agreements/:agreementId
 */
router.get('/:agreementId',
  requirePermissions(PERMISSIONS.VIEW_AGREEMENTS),
  validate(Joi.object({ agreementId: Joi.string().required() }), 'params'),
  agreementController.getAgreementInfo
);

/**
 * List agreements with filtering
 * GET /api/agreements
 */
router.get('/',
  requirePermissions(PERMISSIONS.VIEW_AGREEMENTS),
  validate(Joi.object({
    status: Joi.string().valid('Generated', 'Signed', 'Completed', 'Cancelled').optional(),
    clientId: objectId.optional(),
    dateFrom: Joi.date().iso().optional(),
    dateTo: Joi.date().iso().optional(),
    page: Joi.number().integer().min(1).optional(),
    limit: Joi.number().integer().min(1).max(100).optional(),
    sortBy: Joi.string().valid('agreementGeneratedDate', 'loanAmount', 'clientName').optional(),
    sortOrder: Joi.string().valid('asc', 'desc').optional()
  }), 'query'),
  agreementController.listAgreements
);

/**
 * Send agreement via email
 * POST /api/agreements/:agreementId/send
 */
router.post('/:agreementId/send',
  requirePermissions(PERMISSIONS.GENERATE_AGREEMENTS),
  validate(Joi.object({ agreementId: Joi.string().required() }), 'params'),
  validate(Joi.object({
    email: Joi.string().email().required(),
    subject: Joi.string().min(5).max(200).optional(),
    message: Joi.string().max(1000).optional()
  })),
  agreementController.sendAgreement
);

/**
 * Regenerate agreement (for updates)
 * PUT /api/agreements/:agreementId/regenerate
 */
router.put('/:agreementId/regenerate',
  requirePermissions(PERMISSIONS.GENERATE_AGREEMENTS),
  validate(Joi.object({ agreementId: Joi.string().required() }), 'params'),
  validate(Joi.object({
    template: Joi.string().valid('standard', 'premium', 'basic').optional(),
    language: Joi.string().valid('en', 'si', 'ta').optional(),
    includeTerms: Joi.boolean().optional(),
    watermark: Joi.string().max(50).optional(),
    reason: Joi.string().max(500).required()
  })),
  async (req, res) => {
    try {
      // Find loan by agreement ID and regenerate
      const { agreementId } = req.params;
      const loan = await require('../models/Loan').findOne({ agreementId });

      if (!loan) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'AGREEMENT_NOT_FOUND',
            message: 'Agreement not found',
            timestamp: new Date().toISOString()
          }
        });
      }

      // Set loan ID in params for generateAgreement
      req.params.loanId = loan._id;

      // Add regeneration reason to audit trail
      req.body.regenerationReason = req.body.reason;

      // Call generate agreement
      return agreementController.generateAgreement(req, res);

    } catch (error) {
      res.status(500).json({
        success: false,
        error: {
          code: 'AGREEMENT_REGENERATION_ERROR',
          message: 'Failed to regenerate agreement',
          timestamp: new Date().toISOString()
        }
      });
    }
  }
);

module.exports = router;