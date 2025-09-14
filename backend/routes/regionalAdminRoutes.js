const express = require('express');
const router = express.Router();
const regionalAdminController = require('../controllers/regionalAdminController');
const { authenticate, authorizeRoles, requirePermissions } = require('../middlewares/authMiddleware');
const { PERMISSIONS } = require('../utils/permissions');
const { validate, regionalAdminSchemas, schemas } = require('../validation');
const { objectId } = schemas;

// All routes require authentication
router.use(authenticate);

// Simplified dashboard route (uses user's region from JWT)
router.get('/dashboard',
  authorizeRoles('regional_manager', 'moderate_admin', 'super_admin'),
  async (req, res) => {
    try {
      // Use the user's region from JWT token
      const userRegion = req.user.region;

      if (!userRegion && req.user.role === 'regional_manager') {
        return res.status(400).json({
          success: false,
          error: {
            code: 'REGION_REQUIRED',
            message: 'Regional manager must be assigned to a region',
            timestamp: new Date().toISOString()
          }
        });
      }

      // Get regional statistics
      const [
        totalAgents,
        totalClients,
        totalLoans,
        pendingLoans
      ] = await Promise.all([
        require('../models/Staff').countDocuments({
          region: userRegion,
          role: 'agent',
          status: 'active'
        }),
        require('../models/Client').countDocuments({
          assignedReviewer: {
            $in: await require('../models/Staff').find({
              region: userRegion,
              role: 'agent'
            }).distinct('_id')
          }
        }),
        require('../models/Loan').countDocuments({
          clientUserId: {
            $in: await require('../models/Client').find({
              assignedReviewer: {
                $in: await require('../models/Staff').find({
                  region: userRegion,
                  role: 'agent'
                }).distinct('_id')
              }
            }).distinct('_id')
          }
        }),
        require('../models/Loan').countDocuments({
          loanStatus: 'pending',
          clientUserId: {
            $in: await require('../models/Client').find({
              assignedReviewer: {
                $in: await require('../models/Staff').find({
                  region: userRegion,
                  role: 'agent'
                }).distinct('_id')
              }
            }).distinct('_id')
          }
        })
      ]);

      res.status(200).json({
        success: true,
        message: 'Regional dashboard data retrieved successfully',
        data: {
          overview: {
            totalAgents,
            totalClients,
            totalLoans,
            pendingLoans
          },
          region: userRegion,
          userRole: req.user.role,
          permissions: req.user.permissions
        },
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('Regional dashboard error:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'SERVER_ERROR',
          message: 'Internal server error while fetching dashboard data',
          timestamp: new Date().toISOString()
        }
      });
    }
  }
);

// Simplified agents route (uses user's region from JWT)
router.get('/agents',
  authorizeRoles('regional_manager', 'moderate_admin', 'super_admin'),
  requirePermissions(PERMISSIONS.MANAGE_REGIONAL_AGENTS),
  async (req, res) => {
    try {
      const userRegion = req.user.region;
      const { page = 1, limit = 10, status = 'active' } = req.query;

      // Get agents in the user's region
      const agents = await require('../models/Staff').find({
        region: userRegion,
        role: 'agent',
        ...(status && { status })
      })
        .populate('region', 'name code')
        .populate('managedBy', 'name email')
        .select('-passwordHash')
        .skip((page - 1) * limit)
        .limit(parseInt(limit))
        .sort({ createdAt: -1 });

      const total = await require('../models/Staff').countDocuments({
        region: userRegion,
        role: 'agent',
        ...(status && { status })
      });

      // Get performance metrics for each agent
      const agentsWithMetrics = await Promise.all(
        agents.map(async (agent) => {
          const clientCount = await require('../models/Client').countDocuments({
            assignedReviewer: agent._id
          });

          const loanCount = await require('../models/Loan').countDocuments({
            clientUserId: {
              $in: await require('../models/Client').find({
                assignedReviewer: agent._id
              }).distinct('_id')
            }
          });

          return {
            ...agent.toObject(),
            performance: {
              clientsManaged: clientCount,
              loansProcessed: loanCount
            }
          };
        })
      );

      res.status(200).json({
        success: true,
        message: 'Agents retrieved successfully',
        data: {
          agents: agentsWithMetrics,
          pagination: {
            total,
            page: parseInt(page),
            pages: Math.ceil(total / limit),
            limit: parseInt(limit)
          }
        },
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('Get agents error:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'SERVER_ERROR',
          message: 'Internal server error while fetching agents',
          timestamp: new Date().toISOString()
        }
      });
    }
  }
);

// Simplified clients route
router.get('/clients',
  authorizeRoles('regional_manager', 'moderate_admin', 'super_admin'),
  requirePermissions(PERMISSIONS.VIEW_REGIONAL_CLIENTS),
  async (req, res) => {
    try {
      const userRegion = req.user.region;
      const { page = 1, limit = 10, status } = req.query;

      // Get agent IDs in the user's region
      const agentIds = await require('../models/Staff').find({
        region: userRegion,
        role: 'agent'
      }).distinct('_id');

      // Build query
      let query = { assignedReviewer: { $in: agentIds } };
      if (status) query.status = status;

      // Get clients
      const clients = await require('../models/Client').find(query)
        .populate('assignedReviewer', 'name email profile.employeeId')
        .skip((page - 1) * limit)
        .limit(parseInt(limit))
        .sort({ createdAt: -1 });

      const total = await require('../models/Client').countDocuments(query);

      res.status(200).json({
        success: true,
        message: 'Regional clients retrieved successfully',
        data: {
          clients,
          pagination: {
            total,
            page: parseInt(page),
            pages: Math.ceil(total / limit),
            limit: parseInt(limit)
          }
        },
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('Get regional clients error:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'SERVER_ERROR',
          message: 'Internal server error while fetching clients',
          timestamp: new Date().toISOString()
        }
      });
    }
  }
);

// Regional admin dashboard (with regionalAdminId parameter - for backward compatibility)
router.get('/:regionalAdminId/dashboard',
  authorizeRoles('regional_manager', 'moderate_admin', 'super_admin'),
  regionalAdminController.getRegionalDashboard
);

// Debug endpoint (admin only)
router.get('/:regionalAdminId/debug',
  authorizeRoles('moderate_admin', 'super_admin'),
  regionalAdminController.debugRegionalData
);

// Loan management
router.get('/:regionalAdminId/loans',
  requirePermissions(PERMISSIONS.VIEW_REGIONAL_LOANS),
  validate(regionalAdminSchemas.getRegionalLoans.query, 'query'),
  regionalAdminController.getRegionalLoans
);

router.get('/:regionalAdminId/loans/pending',
  requirePermissions(PERMISSIONS.APPROVE_LOANS),
  regionalAdminController.getPendingLoansForApproval
);

router.post('/:regionalAdminId/loans/:loanId/approve',
  requirePermissions(PERMISSIONS.APPROVE_LOANS),
  regionalAdminController.approveRejectLoan
);

// Agent management
router.get('/:regionalAdminId/agents',
  requirePermissions(PERMISSIONS.MANAGE_REGIONAL_AGENTS),
  regionalAdminController.getAgentsInRegion
);

// Registration management
router.get('/:regionalAdminId/registrations/pending',
  requirePermissions(PERMISSIONS.VIEW_REGIONAL_CLIENTS),
  regionalAdminController.getPendingRegistrations
);

router.post('/:regionalAdminId/registrations/:registrationId/approve',
  requirePermissions(PERMISSIONS.UPDATE_REGIONAL_CLIENTS),
  regionalAdminController.approveRejectRegistration
);

// Payment management
router.get('/:regionalAdminId/payments/pending',
  requirePermissions(PERMISSIONS.VIEW_REGIONAL_LOANS),
  regionalAdminController.getPendingPayments
);

router.post('/:regionalAdminId/payments/approve',
  requirePermissions(PERMISSIONS.UPDATE_REGIONAL_LOANS),
  regionalAdminController.approveRejectPayment
);

// Reports
router.post('/:regionalAdminId/reports', regionalAdminController.generateRegionalReport);

module.exports = router;
