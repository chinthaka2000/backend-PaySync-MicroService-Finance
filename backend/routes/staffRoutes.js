const express = require('express');
const router = express.Router();
const { authenticate, authorizeRoles, requirePermissions } = require('../middlewares/authMiddleware');
const { PERMISSIONS } = require('../utils/permissions');
const { validate, validateMultiple, staffSchemas, schemas } = require('../validation');
const Staff = require('../models/Staff');
const Joi = require('joi');

const { objectId, paginationSchema } = schemas;

// All routes require authentication
router.use(authenticate);

// Get staff member by ID
router.get('/:id',
  requirePermissions(PERMISSIONS.VIEW_STAFF),
  validate(Joi.object({ id: objectId.required() }), 'params'),
  async (req, res) => {
    try {
      const { id } = req.params;
      const requestingUser = req.user;

      const staff = await Staff.findById(id)
        .populate('region', 'name code districts')
        .populate('managedBy', 'name email role')
        .populate('createdBy', 'name email role')
        .populate('subordinates', 'name email role')
        .select('-passwordHash');

      if (!staff) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'STAFF_NOT_FOUND',
            message: 'Staff member not found',
            timestamp: new Date().toISOString()
          }
        });
      }

      // Check if user can view this staff member
      const canView = requestingUser.role === 'super_admin' ||
        requestingUser.role === 'moderate_admin' ||
        requestingUser.userId === id ||
        (requestingUser.role === 'regional_manager' &&
          staff.managedBy?.toString() === requestingUser.userId);

      if (!canView) {
        return res.status(403).json({
          success: false,
          error: {
            code: 'ACCESS_DENIED',
            message: 'You do not have permission to view this staff member',
            timestamp: new Date().toISOString()
          }
        });
      }

      res.status(200).json({
        success: true,
        message: 'Staff member retrieved successfully',
        data: { staff },
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('Get staff by ID error:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'SERVER_ERROR',
          message: 'Internal server error while fetching staff member',
          timestamp: new Date().toISOString()
        }
      });
    }
  }
);

// Get all staff with filtering
router.get('/',
  requirePermissions(PERMISSIONS.VIEW_STAFF),
  validate(Joi.object({
    ...paginationSchema,
    role: Joi.string().valid('agent', 'regional_manager', 'moderate_admin', 'ceo', 'super_admin').optional(),
    region: objectId.optional(),
    status: Joi.string().valid('active', 'inactive', 'suspended', 'terminated').optional(),
    search: Joi.string().min(2).max(100).optional()
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
        sort = '-createdAt'
      } = req.query;
      const requestingUser = req.user;

      // Build query based on user permissions
      let query = {};

      // Role-based filtering
      if (requestingUser.role === 'regional_manager') {
        // Regional managers can only see their subordinates and themselves
        query.$or = [
          { managedBy: requestingUser.userId },
          { _id: requestingUser.userId }
        ];
      } else if (requestingUser.role === 'agent') {
        // Agents can only see themselves
        query._id = requestingUser.userId;
      }
      // moderate_admin and super_admin can see all

      // Apply additional filters
      if (role) query.role = role;
      if (region) query.region = region;
      if (status) query.status = status;

      if (search) {
        query.$and = query.$and || [];
        query.$and.push({
          $or: [
            { name: { $regex: search, $options: 'i' } },
            { email: { $regex: search, $options: 'i' } },
            { 'profile.firstName': { $regex: search, $options: 'i' } },
            { 'profile.lastName': { $regex: search, $options: 'i' } }
          ]
        });
      }

      const staff = await Staff.find(query)
        .populate('region', 'name code')
        .populate('managedBy', 'name email')
        .populate('createdBy', 'name email')
        .sort(sort)
        .skip((page - 1) * limit)
        .limit(parseInt(limit))
        .select('-passwordHash');

      const total = await Staff.countDocuments(query);

      res.status(200).json({
        success: true,
        message: 'Staff retrieved successfully',
        data: {
          staff,
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

// Update staff member (basic profile updates)
router.put('/:id',
  requirePermissions(PERMISSIONS.UPDATE_STAFF),
  validateMultiple({
    params: Joi.object({ id: objectId.required() }),
    body: staffSchemas.updateStaff.body
  }),
  async (req, res) => {
    try {
      const { id } = req.params;
      const updates = req.body;
      const requestingUser = req.user;

      const staff = await Staff.findById(id);
      if (!staff) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'STAFF_NOT_FOUND',
            message: 'Staff member not found',
            timestamp: new Date().toISOString()
          }
        });
      }

      // Check permissions
      const canUpdate = requestingUser.role === 'super_admin' ||
        requestingUser.role === 'moderate_admin' ||
        requestingUser.userId === id;

      if (!canUpdate) {
        return res.status(403).json({
          success: false,
          error: {
            code: 'ACCESS_DENIED',
            message: 'You do not have permission to update this staff member',
            timestamp: new Date().toISOString()
          }
        });
      }

      // Apply updates
      if (updates.personalInfo) {
        Object.assign(staff.profile, updates.personalInfo);
      }

      if (updates.region && ['moderate_admin', 'super_admin'].includes(requestingUser.role)) {
        staff.region = updates.region;
      }

      if (updates.managedBy && ['moderate_admin', 'super_admin'].includes(requestingUser.role)) {
        staff.managedBy = updates.managedBy;
        staff.reportsTo = updates.managedBy;
      }

      if (updates.status !== undefined && ['moderate_admin', 'super_admin'].includes(requestingUser.role)) {
        staff.status = updates.status;
      }

      // Add audit entry
      staff.addAuditEntry('updated', requestingUser.userId, updates, req.ip, req.get('User-Agent'));

      await staff.save();

      const updatedStaff = await Staff.findById(id)
        .populate('region', 'name code')
        .populate('managedBy', 'name email')
        .select('-passwordHash');

      res.status(200).json({
        success: true,
        message: 'Staff member updated successfully',
        data: { staff: updatedStaff },
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('Update staff error:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'SERVER_ERROR',
          message: 'Internal server error while updating staff member',
          timestamp: new Date().toISOString()
        }
      });
    }
  }
);

module.exports = router;
