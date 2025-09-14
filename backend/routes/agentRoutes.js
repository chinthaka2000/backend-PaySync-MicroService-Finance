const express = require('express');
const router = express.Router();
const agentController = require('../controllers/agentController');
const { authenticate, authorizeRoles, requirePermissions } = require('../middlewares/authMiddleware');
const { agentRateLimit } = require('../middlewares/security');
const { PERMISSIONS } = require('../utils/permissions');
const { validate, agentSchemas, schemas } = require('../validation');
const Joi = require('joi');
const { objectId } = schemas;

// All routes require authentication
router.use(authenticate);

// Apply higher rate limit for agent endpoints
router.use(agentRateLimit);

// Agent dashboard and profile routes (agents can access their own data)
router.get('/:agentId/dashboard',
  authorizeRoles('agent', 'regional_manager', 'moderate_admin', 'super_admin'),
  validate(Joi.object({ agentId: objectId.required() }), 'params'),
  agentController.getAgentDashboard
);

router.get('/:agentId/profile',
  authorizeRoles('agent', 'regional_manager', 'moderate_admin', 'super_admin'),
  validate(Joi.object({ agentId: objectId.required() }), 'params'),
  agentController.getAgentProfile
);

router.put('/:agentId/profile',
  authorizeRoles('agent', 'regional_manager', 'moderate_admin', 'super_admin'),
  validate(Joi.object({ agentId: objectId.required() }), 'params'),
  agentController.updateAgentProfile
);

// Agent management routes (for admin use)
router.get('/',
  requirePermissions(PERMISSIONS.MANAGE_STAFF),
  agentController.getAllAgents
);

router.get('/stats',
  requirePermissions(PERMISSIONS.VIEW_SYSTEM_ANALYTICS),
  agentController.getAgentStats
);

router.get('/region/:regionId',
  requirePermissions(PERMISSIONS.VIEW_REGIONAL_DATA),
  validate(Joi.object({ regionId: objectId.required() }), 'params'),
  agentController.getAgentsByRegion
);

// Agreement management
router.get('/:agentId/agreements',
  requirePermissions(PERMISSIONS.VIEW_AGREEMENTS),
  validate(Joi.object({ agentId: objectId.required() }), 'params'),
  agentController.getAgentAgreements
);

// ===== ENHANCED AGENT MANAGEMENT ROUTES =====

// Agent client management
router.get('/:agentId/clients',
  authorizeRoles('agent', 'regional_manager', 'moderate_admin', 'super_admin'),
  validate(Joi.object({ agentId: objectId.required() }), 'params'),
  agentController.getAgentClients
);

// Agent loan management
router.get('/:agentId/loans',
  authorizeRoles('agent', 'regional_manager', 'moderate_admin', 'super_admin'),
  validate(Joi.object({ agentId: objectId.required() }), 'params'),
  agentController.getAgentLoans
);

// Agent performance tracking
router.get('/:agentId/performance',
  authorizeRoles('agent', 'regional_manager', 'moderate_admin', 'super_admin'),
  validate(Joi.object({ agentId: objectId.required() }), 'params'),
  agentController.getAgentPerformance
);

// Client assignment (moderate admin only)
router.post('/:agentId/assign-client',
  requirePermissions(PERMISSIONS.MANAGE_STAFF),
  validate(Joi.object({ agentId: objectId.required() }), 'params'),
  validate(Joi.object({
    clientId: objectId.required(),
    reason: Joi.string().optional()
  }), 'body'),
  agentController.assignClientToAgent
);

// Client information updates
router.put('/:agentId/clients/:clientId',
  authorizeRoles('agent', 'regional_manager', 'moderate_admin', 'super_admin'),
  validate(Joi.object({
    agentId: objectId.required(),
    clientId: objectId.required()
  }), 'params'),
  agentController.updateClientInfo
);

// Client verification status updates
router.put('/:agentId/clients/:clientId/verification',
  authorizeRoles('agent', 'regional_manager', 'moderate_admin', 'super_admin'),
  validate(Joi.object({
    agentId: objectId.required(),
    clientId: objectId.required()
  }), 'params'),
  validate(Joi.object({
    category: Joi.string().valid('identity', 'employment', 'income', 'documents').required(),
    verified: Joi.boolean().required(),
    reason: Joi.string().optional()
  }), 'body'),
  agentController.updateClientVerification
);

module.exports = router;