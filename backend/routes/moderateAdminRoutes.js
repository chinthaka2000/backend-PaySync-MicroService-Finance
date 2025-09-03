// routes/moderateAdminRoutes.js

const express = require('express');
const router = express.Router();
const moderateAdminController = require('../controllers/moderateAdminController');
const { authenticate, authorizeRoles, requirePermissions } = require('../middlewares/authMiddleware');
const { PERMISSIONS } = require('../utils/permissions');
const { validate, staffSchemas, regionalAdminSchemas, schemas } = require('../validation');
const Joi = require('joi');

const { objectId, paginationSchema } = schemas;

// All routes require authentication and moderate admin or higher privileges
router.use(authenticate);
router.use(authorizeRoles('moderate_admin', 'super_admin'));

// Staff Management Routes

/**
 * Create new staff member (CEO, Regional Admin, Agent)
 * POST /api/moderate-admin/staff
 */
router.post('/staff',
  requirePermissions(PERMISSIONS.CREATE_STAFF),
  validate(staffSchemas.createStaff.body),
  moderateAdminController.createStaff
);

/**
 * Create CEO account
 * POST /api/moderate-admin/staff/ceo
 */
router.post('/staff/ceo',
  requirePermissions(PERMISSIONS.CREATE_CEO),
  validate(Joi.object({
    name: Joi.string().required().min(2).max(100),
    email: Joi.string().email().required(),
    password: Joi.string().min(6).required(),
    profile: Joi.object({
      firstName: Joi.string().required(),
      lastName: Joi.string().required(),
      phone: Joi.string().optional(),
      address: Joi.string().optional()
    }).required()
  }), 'body'),
  async (req, res) => {
    try {
      const { name, email, password, profile } = req.body;

      // Check if CEO already exists
      const existingCEO = await require('../models/Staff').findOne({ role: 'ceo' });
      if (existingCEO) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'CEO_EXISTS',
            message: 'CEO account already exists in the system',
            timestamp: new Date().toISOString()
          }
        });
      }

      // Check if email already exists
      const existingUser = await require('../models/Staff').findOne({ email });
      if (existingUser) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'EMAIL_EXISTS',
            message: 'Email already exists in the system',
            timestamp: new Date().toISOString()
          }
        });
      }

      // Hash password
      const bcrypt = require('bcryptjs');
      const passwordHash = await bcrypt.hash(password, 12);

      // Create CEO
      const ceo = new require('../models/Staff')({
        name,
        email,
        passwordHash,
        role: 'ceo',
        createdBy: req.user.userId,
        registrationId: `CEO${Date.now()}${Math.random().toString(36).substr(2, 5).toUpperCase()}`,
        profile: {
          ...profile,
          employeeId: `CEO${String(Date.now()).slice(-6)}`
        },
        status: 'active'
      });

      ceo.updateRolePermissions();
      await ceo.save();

      res.status(201).json({
        success: true,
        message: 'CEO account created successfully',
        data: {
          ceo: {
            id: ceo._id,
            name: ceo.name,
            email: ceo.email,
            role: ceo.role,
            employeeId: ceo.profile.employeeId,
            createdAt: ceo.createdAt
          }
        },
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('Create CEO error:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'SERVER_ERROR',
          message: 'Internal server error while creating CEO',
          timestamp: new Date().toISOString()
        }
      });
    }
  }
);

/**
 * Create Regional Admin and assign to region
 * POST /api/moderate-admin/staff/regional-admin
 */
router.post('/staff/regional-admin',
  requirePermissions(PERMISSIONS.CREATE_REGIONAL_MANAGER),
  validate(Joi.object({
    name: Joi.string().required().min(2).max(100),
    email: Joi.string().email().required(),
    password: Joi.string().min(6).required(),
    regionId: objectId.required(),
    profile: Joi.object({
      firstName: Joi.string().required(),
      lastName: Joi.string().required(),
      phone: Joi.string().optional(),
      address: Joi.string().optional()
    }).required()
  }), 'body'),
  async (req, res) => {
    try {
      const { name, email, password, regionId, profile } = req.body;

      // Check if region exists
      const region = await require('../models/Region').findById(regionId);
      if (!region) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'REGION_NOT_FOUND',
            message: 'Region not found',
            timestamp: new Date().toISOString()
          }
        });
      }

      // Check if region already has a regional manager
      if (region.regionalManager) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'REGION_HAS_MANAGER',
            message: 'Region already has a regional manager assigned',
            timestamp: new Date().toISOString()
          }
        });
      }

      // Check if email already exists
      const existingUser = await require('../models/Staff').findOne({ email });
      if (existingUser) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'EMAIL_EXISTS',
            message: 'Email already exists in the system',
            timestamp: new Date().toISOString()
          }
        });
      }

      // Hash password
      const bcrypt = require('bcryptjs');
      const passwordHash = await bcrypt.hash(password, 12);

      // Create Regional Admin
      const regionalAdmin = new require('../models/Staff')({
        name,
        email,
        passwordHash,
        role: 'regional_manager',
        region: regionId,
        createdBy: req.user.userId,
        registrationId: `RM${Date.now()}${Math.random().toString(36).substr(2, 5).toUpperCase()}`,
        profile: {
          ...profile,
          employeeId: `RM${String(Date.now()).slice(-6)}`
        },
        status: 'active'
      });

      regionalAdmin.updateRolePermissions();
      await regionalAdmin.save();

      // Assign to region
      region.regionalManager = regionalAdmin._id;
      region.assignRegionalManager(regionalAdmin._id, req.user.userId);
      await region.save();

      res.status(201).json({
        success: true,
        message: 'Regional Admin created and assigned successfully',
        data: {
          regionalAdmin: {
            id: regionalAdmin._id,
            name: regionalAdmin.name,
            email: regionalAdmin.email,
            role: regionalAdmin.role,
            employeeId: regionalAdmin.profile.employeeId,
            region: {
              id: region._id,
              name: region.name,
              code: region.code
            },
            createdAt: regionalAdmin.createdAt
          }
        },
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('Create Regional Admin error:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'SERVER_ERROR',
          message: 'Internal server error while creating Regional Admin',
          timestamp: new Date().toISOString()
        }
      });
    }
  }
);

/**
 * Create Agent and assign to Regional Admin
 * POST /api/moderate-admin/staff/agent
 */
router.post('/staff/agent',
  requirePermissions(PERMISSIONS.CREATE_AGENT),
  validate(Joi.object({
    name: Joi.string().required().min(2).max(100),
    email: Joi.string().email().required(),
    password: Joi.string().min(6).required(),
    regionalManagerId: objectId.required(),
    profile: Joi.object({
      firstName: Joi.string().required(),
      lastName: Joi.string().required(),
      phone: Joi.string().optional(),
      address: Joi.string().optional()
    }).required()
  }), 'body'),
  async (req, res) => {
    try {
      const { name, email, password, regionalManagerId, profile } = req.body;

      // Check if regional manager exists
      const regionalManager = await require('../models/Staff').findOne({
        _id: regionalManagerId,
        role: 'regional_manager'
      }).populate('region');

      if (!regionalManager) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'REGIONAL_MANAGER_NOT_FOUND',
            message: 'Regional Manager not found',
            timestamp: new Date().toISOString()
          }
        });
      }

      // Check if email already exists
      const existingUser = await require('../models/Staff').findOne({ email });
      if (existingUser) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'EMAIL_EXISTS',
            message: 'Email already exists in the system',
            timestamp: new Date().toISOString()
          }
        });
      }

      // Hash password
      const bcrypt = require('bcryptjs');
      const passwordHash = await bcrypt.hash(password, 12);

      // Create Agent
      const agent = new require('../models/Staff')({
        name,
        email,
        passwordHash,
        role: 'agent',
        region: regionalManager.region._id,
        managedBy: regionalManagerId,
        reportsTo: regionalManagerId,
        createdBy: req.user.userId,
        registrationId: `AG${Date.now()}${Math.random().toString(36).substr(2, 5).toUpperCase()}`,
        profile: {
          ...profile,
          employeeId: `AG${String(Date.now()).slice(-6)}`
        },
        status: 'active'
      });

      agent.updateRolePermissions();
      await agent.save();

      // Add agent to regional manager's subordinates
      regionalManager.subordinates.push(agent._id);
      await regionalManager.save();

      // Add agent to region's assigned staff
      const region = regionalManager.region;
      region.assignStaff(agent._id, 'agent', req.user.userId);
      await region.save();

      res.status(201).json({
        success: true,
        message: 'Agent created and assigned successfully',
        data: {
          agent: {
            id: agent._id,
            name: agent.name,
            email: agent.email,
            role: agent.role,
            employeeId: agent.profile.employeeId,
            region: {
              id: region._id,
              name: region.name,
              code: region.code
            },
            managedBy: {
              id: regionalManager._id,
              name: regionalManager.name,
              email: regionalManager.email
            },
            createdAt: agent.createdAt
          }
        },
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('Create Agent error:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'SERVER_ERROR',
          message: 'Internal server error while creating Agent',
          timestamp: new Date().toISOString()
        }
      });
    }
  }
);

/**
 * Assign agent to regional manager
 * POST /api/moderate-admin/staff/assign-agent
 */
router.post('/staff/assign-agent',
  requirePermissions(PERMISSIONS.ASSIGN_AGENT_TO_REGIONAL_MANAGER),
  validate(regionalAdminSchemas.assignAgentToManager.body),
  moderateAdminController.assignAgentToManager
);

/**
 * Get staff management dashboard
 * GET /api/moderate-admin/dashboard
 */
router.get('/dashboard',
  requirePermissions(PERMISSIONS.MANAGE_STAFF),
  validate(Joi.object({
    startDate: Joi.date().iso().optional(),
    endDate: Joi.date().iso().min(Joi.ref('startDate')).optional(),
    includeInactive: Joi.boolean().default(false)
  }), 'query'),
  moderateAdminController.getStaffDashboard
);

// Region Management Routes

/**
 * Create new region
 * POST /api/moderate-admin/regions
 */
router.post('/regions',
  requirePermissions(PERMISSIONS.MANAGE_REGIONS),
  validate(regionalAdminSchemas.createRegion.body),
  moderateAdminController.createRegion
);

/**
 * Update region
 * PUT /api/moderate-admin/regions/:id
 */
router.put('/regions/:id',
  requirePermissions(PERMISSIONS.MANAGE_REGIONS),
  validate(Joi.object({ id: objectId.required() }), 'params'),
  validate(regionalAdminSchemas.updateRegion.body),
  moderateAdminController.updateRegion
);

/**
 * Customize region districts (add/remove districts)
 * PUT /api/moderate-admin/regions/:id/districts
 */
router.put('/regions/:id/districts',
  requirePermissions(PERMISSIONS.CUSTOMIZE_REGIONS),
  validate(Joi.object({ id: objectId.required() }), 'params'),
  validate(Joi.object({
    districts: Joi.array().items(
      Joi.string().valid(
        'Colombo', 'Gampaha', 'Kalutara',
        'Kandy', 'Matale', 'Nuwara Eliya',
        'Galle', 'Matara', 'Hambantota',
        'Jaffna', 'Kilinochchi', 'Mannar',
        'Vavuniya', 'Mullaitivu',
        'Batticaloa', 'Ampara', 'Trincomalee',
        'Kurunegala', 'Puttalam',
        'Anuradhapura', 'Polonnaruwa',
        'Badulla', 'Monaragala',
        'Ratnapura', 'Kegalle'
      )
    ).min(1).required(),
    action: Joi.string().valid('set', 'add', 'remove').default('set')
  }), 'body'),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { districts, action } = req.body;

      const region = await require('../models/Region').findById(id);
      if (!region) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'REGION_NOT_FOUND',
            message: 'Region not found',
            timestamp: new Date().toISOString()
          }
        });
      }

      let updatedDistricts = [...region.districts];

      switch (action) {
        case 'set':
          updatedDistricts = districts;
          break;
        case 'add':
          districts.forEach(district => {
            if (!updatedDistricts.includes(district)) {
              updatedDistricts.push(district);
            }
          });
          break;
        case 'remove':
          updatedDistricts = updatedDistricts.filter(district => !districts.includes(district));
          break;
      }

      if (updatedDistricts.length === 0) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_DISTRICTS',
            message: 'Region must have at least one district',
            timestamp: new Date().toISOString()
          }
        });
      }

      region.districts = updatedDistricts;
      region.addAuditEntry('districts_updated', req.user.userId, {
        action,
        previousDistricts: region.districts,
        newDistricts: updatedDistricts
      });
      await region.save();

      res.status(200).json({
        success: true,
        message: 'Region districts updated successfully',
        data: {
          region: {
            id: region._id,
            name: region.name,
            code: region.code,
            districts: region.districts,
            updatedAt: region.updatedAt
          }
        },
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('Update region districts error:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'SERVER_ERROR',
          message: 'Internal server error while updating region districts',
          timestamp: new Date().toISOString()
        }
      });
    }
  }
);

/**
 * Assign Regional Manager to Region
 * PUT /api/moderate-admin/regions/:id/assign-manager
 */
router.put('/regions/:id/assign-manager',
  requirePermissions(PERMISSIONS.MANAGE_REGIONS),
  validate(Joi.object({ id: objectId.required() }), 'params'),
  validate(Joi.object({
    regionalManagerId: objectId.required()
  }), 'body'),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { regionalManagerId } = req.body;

      const [region, regionalManager] = await Promise.all([
        require('../models/Region').findById(id),
        require('../models/Staff').findOne({
          _id: regionalManagerId,
          role: 'regional_manager'
        })
      ]);

      if (!region) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'REGION_NOT_FOUND',
            message: 'Region not found',
            timestamp: new Date().toISOString()
          }
        });
      }

      if (!regionalManager) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'REGIONAL_MANAGER_NOT_FOUND',
            message: 'Regional Manager not found',
            timestamp: new Date().toISOString()
          }
        });
      }

      // Check if regional manager is already assigned to another region
      if (regionalManager.region && regionalManager.region.toString() !== id) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'MANAGER_ALREADY_ASSIGNED',
            message: 'Regional Manager is already assigned to another region',
            timestamp: new Date().toISOString()
          }
        });
      }

      // Update region
      region.regionalManager = regionalManagerId;
      region.assignRegionalManager(regionalManagerId, req.user.userId);
      await region.save();

      // Update regional manager
      regionalManager.region = id;
      await regionalManager.save();

      res.status(200).json({
        success: true,
        message: 'Regional Manager assigned to region successfully',
        data: {
          region: {
            id: region._id,
            name: region.name,
            code: region.code
          },
          regionalManager: {
            id: regionalManager._id,
            name: regionalManager.name,
            email: regionalManager.email
          }
        },
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('Assign regional manager error:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'SERVER_ERROR',
          message: 'Internal server error while assigning regional manager',
          timestamp: new Date().toISOString()
        }
      });
    }
  }
);

/**
 * Get all regions with management data
 * GET /api/moderate-admin/regions
 */
router.get('/regions',
  requirePermissions(PERMISSIONS.MANAGE_REGIONS),
  validate(Joi.object({
    ...paginationSchema,
    status: Joi.string().valid('active', 'inactive', 'suspended').optional(),
    hasManager: Joi.boolean().optional(),
    search: Joi.string().min(2).max(100).optional()
  }), 'query'),
  async (req, res) => {
    try {
      const { page = 1, limit = 10, status, hasManager, search, sort = '-createdAt' } = req.query;

      // Build query
      let query = {};

      if (status) {
        query.status = status;
      }

      if (hasManager !== undefined) {
        query.regionalManager = hasManager === 'true'
          ? { $ne: null }
          : null;
      }

      if (search) {
        query.$or = [
          { name: { $regex: search, $options: 'i' } },
          { code: { $regex: search, $options: 'i' } },
          { districts: { $in: [new RegExp(search, 'i')] } }
        ];
      }

      // Execute query with pagination
      const regions = await require('../models/Region').find(query)
        .populate('regionalManager', 'name email profile.employeeId')
        .populate('createdBy', 'name email')
        .populate('assignedStaff.staff', 'name email role')
        .sort(sort)
        .skip((page - 1) * limit)
        .limit(parseInt(limit));

      const total = await require('../models/Region').countDocuments(query);

      // Get statistics for each region
      const regionsWithStats = await Promise.all(
        regions.map(async (region) => {
          const regionObj = region.toObject();

          // Get staff count by role
          const staffStats = await require('../models/Staff').aggregate([
            { $match: { region: region._id } },
            { $group: { _id: '$role', count: { $sum: 1 } } }
          ]);

          const staffByRole = {};
          staffStats.forEach(stat => {
            staffByRole[stat._id] = stat.count;
          });

          // Get client and loan counts
          const agentIds = await require('../models/Staff').find({
            region: region._id,
            role: 'agent'
          }).distinct('_id');

          const clientCount = await require('../models/Client').countDocuments({
            assignedReviewer: { $in: agentIds }
          });

          const loanCount = await require('../models/Loan').countDocuments({
            clientUserId: {
              $in: await require('../models/Client').find({
                assignedReviewer: { $in: agentIds }
              }).distinct('_id')
            }
          });

          return {
            ...regionObj,
            statistics: {
              totalStaff: region.assignedStaff.length,
              staffByRole,
              totalClients: clientCount,
              totalLoans: loanCount
            }
          };
        })
      );

      res.status(200).json({
        success: true,
        message: 'Regions retrieved successfully',
        data: {
          regions: regionsWithStats,
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
      console.error('Get regions error:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'SERVER_ERROR',
          message: 'Internal server error while fetching regions',
          timestamp: new Date().toISOString()
        }
      });
    }
  }
);

/**
 * Get region by ID with detailed information
 * GET /api/moderate-admin/regions/:id
 */
router.get('/regions/:id',
  requirePermissions(PERMISSIONS.MANAGE_REGIONS),
  validate(Joi.object({ id: objectId.required() }), 'params'),
  async (req, res) => {
    try {
      const { id } = req.params;

      const region = await require('../models/Region').findById(id)
        .populate('regionalManager', 'name email profile role')
        .populate('createdBy', 'name email')
        .populate('assignedStaff.staff', 'name email role profile')
        .populate('assignedStaff.assignedBy', 'name email');

      if (!region) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'REGION_NOT_FOUND',
            message: 'Region not found',
            timestamp: new Date().toISOString()
          }
        });
      }

      // Get detailed statistics
      const agentIds = await require('../models/Staff').find({
        region: id,
        role: 'agent'
      }).distinct('_id');

      const clientIds = await require('../models/Client').find({
        assignedReviewer: { $in: agentIds }
      }).distinct('_id');

      const [
        staffStats,
        clientStats,
        loanStats,
        recentActivity
      ] = await Promise.all([
        require('../models/Staff').aggregate([
          { $match: { region: require('mongoose').Types.ObjectId(id) } },
          {
            $group: {
              _id: '$role',
              count: { $sum: 1 },
              active: { $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] } }
            }
          }
        ]),
        require('../models/Client').aggregate([
          { $match: { assignedReviewer: { $in: agentIds } } },
          {
            $group: {
              _id: '$status',
              count: { $sum: 1 }
            }
          }
        ]),
        require('../models/Loan').aggregate([
          { $match: { clientUserId: { $in: clientIds } } },
          {
            $group: {
              _id: '$loanStatus',
              count: { $sum: 1 },
              totalAmount: { $sum: '$loanAmount' }
            }
          }
        ]),
        require('../models/Staff').find({
          region: id,
          createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
        })
          .populate('createdBy', 'name email')
          .sort({ createdAt: -1 })
          .limit(5)
      ]);

      res.status(200).json({
        success: true,
        message: 'Region details retrieved successfully',
        data: {
          region: region.toObject(),
          statistics: {
            staff: staffStats,
            clients: clientStats,
            loans: loanStats
          },
          recentActivity,
          performance: {
            staffUtilization: staffStats.reduce((acc, stat) => acc + stat.active, 0),
            totalClients: clientStats.reduce((acc, stat) => acc + stat.count, 0),
            totalLoanAmount: loanStats.reduce((acc, stat) => acc + stat.totalAmount, 0)
          }
        },
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('Get region details error:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'SERVER_ERROR',
          message: 'Internal server error while fetching region details',
          timestamp: new Date().toISOString()
        }
      });
    }
  }
);

/**
 * Get all staff with management information
 * GET /api/moderate-admin/staff
 */
router.get('/staff',
  requirePermissions(PERMISSIONS.MANAGE_STAFF),
  validate(Joi.object({
    ...paginationSchema,
    role: Joi.string().valid('agent', 'regional_manager', 'moderate_admin', 'ceo').optional(),
    region: objectId.optional(),
    status: Joi.string().valid('active', 'inactive', 'suspended', 'terminated').optional(),
    search: Joi.string().min(2).max(100).optional(),
    hasManager: Joi.boolean().optional()
  }), 'query'),
  async (req, res) => {
    try {
      const {
        page = 1,
        limit = 10,
        role,
        region,
        status,
        search,
        hasManager,
        sort = '-createdAt'
      } = req.query;

      // Build query
      let query = {};

      if (role) query.role = role;
      if (region) query.region = region;
      if (status) query.status = status;

      if (hasManager !== undefined) {
        query.managedBy = hasManager === 'true'
          ? { $ne: null }
          : null;
      }

      if (search) {
        query.$or = [
          { name: { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } },
          { 'profile.firstName': { $regex: search, $options: 'i' } },
          { 'profile.lastName': { $regex: search, $options: 'i' } },
          { 'profile.employeeId': { $regex: search, $options: 'i' } }
        ];
      }

      // Execute query
      const staff = await require('../models/Staff').find(query)
        .populate('region', 'name code')
        .populate('managedBy', 'name email profile.employeeId')
        .populate('createdBy', 'name email')
        .populate('subordinates', 'name email role')
        .sort(sort)
        .skip((page - 1) * limit)
        .limit(parseInt(limit))
        .select('-passwordHash');

      const total = await require('../models/Staff').countDocuments(query);

      // Get performance metrics for each staff member
      const staffWithMetrics = await Promise.all(
        staff.map(async (member) => {
          const memberObj = member.toObject();

          if (member.role === 'agent') {
            // Get agent performance metrics
            const clientCount = await require('../models/Client').countDocuments({
              assignedReviewer: member._id
            });

            const loanCount = await require('../models/Loan').countDocuments({
              clientUserId: {
                $in: await require('../models/Client').find({
                  assignedReviewer: member._id
                }).distinct('_id')
              }
            });

            memberObj.performance = {
              clientsManaged: clientCount,
              loansProcessed: loanCount,
              subordinates: 0
            };
          } else if (member.role === 'regional_manager') {
            // Get regional manager metrics
            const subordinateCount = member.subordinates.length;
            const regionClients = await require('../models/Client').countDocuments({
              assignedReviewer: { $in: member.subordinates }
            });

            memberObj.performance = {
              subordinates: subordinateCount,
              regionClients,
              loansProcessed: 0
            };
          }

          return memberObj;
        })
      );

      res.status(200).json({
        success: true,
        message: 'Staff retrieved successfully',
        data: {
          staff: staffWithMetrics,
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
      console.error('Get staff error:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'SERVER_ERROR',
          message: 'Internal server error while fetching staff',
          timestamp: new Date().toISOString()
        }
      });
    }
  }
);

module.exports = router;