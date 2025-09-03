const express = require('express');
const router = express.Router();
const emailController = require('../controllers/emailController');
const { authenticate } = require('../middlewares/authMiddleware');
const { validate } = require('../middlewares/validation');
const Joi = require('joi');

// Validation schemas
const loanStatusNotificationSchema = Joi.object({
  loanId: Joi.string().required(),
  newStatus: Joi.string().valid('approved', 'rejected', 'under_review', 'disbursed', 'completed').required(),
  message: Joi.string().optional(),
  reason: Joi.string().optional()
});

const agreementNotificationSchema = Joi.object({
  loanId: Joi.string().required(),
  downloadLink: Joi.string().uri().required()
});

const paymentReminderSchema = Joi.object({
  loanId: Joi.string().required(),
  dueDate: Joi.date().required(),
  amountDue: Joi.number().positive().required(),
  daysUntilDue: Joi.number().integer().min(0).optional()
});

const customEmailSchema = Joi.object({
  to: Joi.string().email().required(),
  subject: Joi.string().required(),
  content: Joi.object({
    html: Joi.string().optional(),
    text: Joi.string().optional()
  }).optional(),
  template: Joi.string().optional(),
  templateData: Joi.object().optional(),
  priority: Joi.string().valid('high', 'normal', 'low').optional()
});

const bulkLoanNotificationSchema = Joi.object({
  loanIds: Joi.array().items(Joi.string()).min(1).required(),
  newStatus: Joi.string().valid('approved', 'rejected', 'under_review', 'disbursed', 'completed').required(),
  message: Joi.string().optional(),
  reason: Joi.string().optional()
});

const testEmailSchema = Joi.object({
  to: Joi.string().email().required(),
  template: Joi.string().valid('loan-status-change', 'agreement-ready', 'loan-reminder').optional()
});

// Apply authentication middleware to all routes
router.use(authenticate);

// Email notification routes

/**
 * @route POST /api/email/loan-status
 * @desc Send loan status change notification
 * @access Private (Agent, Regional Manager, Admin)
 */
router.post('/loan-status',
  validate(loanStatusNotificationSchema),
  emailController.sendLoanStatusNotification
);

/**
 * @route POST /api/email/agreement-ready
 * @desc Send agreement ready notification
 * @access Private (Agent, Regional Manager, Admin)
 */
router.post('/agreement-ready',
  validate(agreementNotificationSchema),
  emailController.sendAgreementNotification
);

/**
 * @route POST /api/email/payment-reminder
 * @desc Send payment reminder
 * @access Private (Agent, Regional Manager, Admin)
 */
router.post('/payment-reminder',
  validate(paymentReminderSchema),
  emailController.sendPaymentReminder
);

/**
 * @route POST /api/email/custom
 * @desc Send custom email
 * @access Private (Admin only)
 */
router.post('/custom',
  (req, res, next) => {
    // Check admin permissions
    if (!['super_admin', 'moderate_admin', 'ceo'].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'AUTHORIZATION_ERROR',
          message: 'Insufficient permissions to send custom emails'
        }
      });
    }
    next();
  },
  validate(customEmailSchema),
  emailController.sendCustomEmail
);

/**
 * @route POST /api/email/bulk-loan-notifications
 * @desc Send bulk loan status notifications
 * @access Private (Regional Manager, Admin)
 */
router.post('/bulk-loan-notifications',
  (req, res, next) => {
    // Check permissions for bulk operations
    if (!['super_admin', 'moderate_admin', 'regional_manager'].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'AUTHORIZATION_ERROR',
          message: 'Insufficient permissions for bulk email operations'
        }
      });
    }
    next();
  },
  validate(bulkLoanNotificationSchema),
  emailController.bulkSendLoanNotifications
);

// Queue management routes

/**
 * @route GET /api/email/queue/status
 * @desc Get email queue status
 * @access Private (Admin only)
 */
router.get('/queue/status',
  (req, res, next) => {
    // Check admin permissions
    if (!['super_admin', 'moderate_admin'].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'AUTHORIZATION_ERROR',
          message: 'Insufficient permissions to view queue status'
        }
      });
    }
    next();
  },
  emailController.getQueueStatus
);

/**
 * @route DELETE /api/email/queue/clear
 * @desc Clear email queue
 * @access Private (Super Admin only)
 */
router.delete('/queue/clear',
  (req, res, next) => {
    // Check super admin permissions
    if (req.user.role !== 'super_admin') {
      return res.status(403).json({
        success: false,
        error: {
          code: 'AUTHORIZATION_ERROR',
          message: 'Only super admin can clear email queue'
        }
      });
    }
    next();
  },
  emailController.clearQueue
);

// Testing routes

/**
 * @route POST /api/email/test
 * @desc Send test email
 * @access Private (Admin only)
 */
router.post('/test',
  (req, res, next) => {
    // Check admin permissions
    if (!['super_admin', 'moderate_admin'].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'AUTHORIZATION_ERROR',
          message: 'Insufficient permissions to send test emails'
        }
      });
    }
    next();
  },
  validate(testEmailSchema),
  emailController.testEmail
);

module.exports = router;