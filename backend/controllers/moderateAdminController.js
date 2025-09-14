// controllers/moderateAdminController.js

const bcrypt = require('bcryptjs');
const Staff = require('../models/Staff');
const Region = require('../models/Region');
const Client = require('../models/Client');
const Loan = require('../models/Loan');
const { validateRoleCreation, getPermissionsForRole } = require('../utils/permissions');
const { AppError } = require('../utils/customErrors');
const logger = require('../utils/logger');

/**
 * Create new staff member with role hierarchy validation
 */
exports.createStaff = async (req, res) => {
  try {
    const { personalInfo, role, region, managedBy, credentials, permissions } = req.body;
    const creatorId = req.user.userId;
    const creatorRole = req.user.role;

    // Validate role creation permissions
    const roleValidation = validateRoleCreation(creatorRole, role);
    if (!roleValidation.valid) {
      throw new AppError(roleValidation.message, 403, 'ROLE_CREATION_FORBIDDEN');
    }

    // Check if email already exists
    const existingStaff = await Staff.findOne({ email: personalInfo.email });
    if (existingStaff) {
      throw new AppError('Email already exists', 400, 'EMAIL_EXISTS');
    }

    // Validate region assignment for regional roles
    if (['agent', 'regional_manager'].includes(role) && !region) {
      throw new AppError('Region is required for agent and regional manager roles', 400, 'REGION_REQUIRED');
    }

    // Validate regional manager assignment for agents
    if (role === 'agent' && !managedBy) {
      throw new AppError('Regional manager assignment is required for agents', 400, 'MANAGER_REQUIRED');
    }

    // If managedBy is provided, validate the regional manager
    if (managedBy) {
      const manager = await Staff.findById(managedBy);
      if (!manager || manager.role !== 'regional_manager') {
        throw new AppError('Invalid regional manager', 400, 'INVALID_MANAGER');
      }

      // Ensure agent and manager are in the same region
      if (role === 'agent' && manager.region?.toString() !== region) {
        throw new AppError('Agent and regional manager must be in the same region', 400, 'REGION_MISMATCH');
      }
    }

    // Hash password
    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(credentials.password, saltRounds);

    // Get role-based permissions
    const rolePermissions = getPermissionsForRole(role);

    // Create staff member
    const newStaff = new Staff({
      name: `${personalInfo.firstName} ${personalInfo.lastName}`,
      email: personalInfo.email,
      passwordHash,
      role,
      region: region || null,
      managedBy: managedBy || null,
      createdBy: creatorId,
      reportsTo: managedBy || creatorId,
      permissions: permissions || rolePermissions,
      profile: {
        firstName: personalInfo.firstName,
        lastName: personalInfo.lastName,
        phoneNumber: personalInfo.phoneNumber,
        address: personalInfo.address,
        dateOfBirth: personalInfo.dateOfBirth,
        hireDate: new Date()
      },
      security: {
        passwordLastChanged: new Date(),
        mustChangePassword: credentials.temporaryPassword || true
      }
    });

    // Update role permissions
    newStaff.updateRolePermissions();

    // Add audit entry
    newStaff.addAuditEntry('created', creatorId, {
      createdRole: role,
      assignedRegion: region,
      assignedManager: managedBy
    }, req.ip, req.get('User-Agent'));

    await newStaff.save();

    // Update regional manager's subordinates if applicable
    if (managedBy) {
      await Staff.findByIdAndUpdate(managedBy, {
        $addToSet: { subordinates: newStaff._id }
      });
    }

    // Update region's assigned staff
    if (region) {
      await Region.findByIdAndUpdate(region, {
        $push: {
          assignedStaff: {
            staff: newStaff._id,
            role: role,
            assignedAt: new Date(),
            assignedBy: creatorId
          }
        }
      });
    }

    // Log the creation
    logger.audit('Staff created', creatorId, 'Staff', {
      staffId: newStaff._id,
      role: role,
      email: personalInfo.email,
      region: region
    });

    // Populate response data
    const populatedStaff = await Staff.findById(newStaff._id)
      .populate('region', 'name code districts')
      .populate('managedBy', 'name email role')
      .populate('createdBy', 'name email role');

    res.status(201).json({
      success: true,
      message: 'Staff member created successfully',
      data: {
        staff: {
          id: populatedStaff._id,
          name: populatedStaff.name,
          email: populatedStaff.email,
          role: populatedStaff.role,
          region: populatedStaff.region,
          managedBy: populatedStaff.managedBy,
          createdBy: populatedStaff.createdBy,
          profile: populatedStaff.profile,
          status: populatedStaff.status,
          createdAt: populatedStaff.createdAt
        }
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Create staff error', error, {
      userId: req.user.userId,
      requestBody: req.body
    });

    if (error instanceof AppError) {
      return res.status(error.statusCode).json({
        success: false,
        error: {
          code: error.errorCode,
          message: error.message,
          timestamp: new Date().toISOString()
        }
      });
    }

    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Internal server error while creating staff',
        timestamp: new Date().toISOString()
      }
    });
  }
};

/**
 * Assign agent to regional manager
 */
exports.assignAgentToManager = async (req, res) => {
  try {
    const { agentId, regionalManagerId, effectiveDate, assignmentReason } = req.body;
    const assignedBy = req.user.userId;

    // Validate agent exists and is an agent
    const agent = await Staff.findById(agentId);
    if (!agent || agent.role !== 'agent') {
      throw new AppError('Invalid agent ID', 400, 'INVALID_AGENT');
    }

    // Validate regional manager exists and is a regional manager
    const regionalManager = await Staff.findById(regionalManagerId);
    if (!regionalManager || regionalManager.role !== 'regional_manager') {
      throw new AppError('Invalid regional manager ID', 400, 'INVALID_REGIONAL_MANAGER');
    }

    // Ensure both are in the same region
    if (agent.region?.toString() !== regionalManager.region?.toString()) {
      throw new AppError('Agent and regional manager must be in the same region', 400, 'REGION_MISMATCH');
    }

    // Remove agent from previous manager's subordinates if exists
    if (agent.managedBy) {
      await Staff.findByIdAndUpdate(agent.managedBy, {
        $pull: { subordinates: agentId }
      });
    }

    // Update agent's manager
    agent.managedBy = regionalManagerId;
    agent.reportsTo = regionalManagerId;
    agent.addAuditEntry('subordinate_assigned', assignedBy, {
      previousManager: agent.managedBy,
      newManager: regionalManagerId,
      assignmentReason,
      effectiveDate: effectiveDate || new Date()
    }, req.ip, req.get('User-Agent'));

    await agent.save();

    // Add agent to regional manager's subordinates
    await Staff.findByIdAndUpdate(regionalManagerId, {
      $addToSet: { subordinates: agentId }
    });

    // Log the assignment
    logger.audit('Agent assigned to regional manager', assignedBy, 'Staff', {
      agentId,
      regionalManagerId,
      assignmentReason,
      effectiveDate
    });

    res.status(200).json({
      success: true,
      message: 'Agent assigned to regional manager successfully',
      data: {
        assignment: {
          agentId,
          agentName: agent.name,
          regionalManagerId,
          regionalManagerName: regionalManager.name,
          effectiveDate: effectiveDate || new Date(),
          assignedBy,
          assignmentReason
        }
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Assign agent to manager error', error, {
      userId: req.user.userId,
      requestBody: req.body
    });

    if (error instanceof AppError) {
      return res.status(error.statusCode).json({
        success: false,
        error: {
          code: error.errorCode,
          message: error.message,
          timestamp: new Date().toISOString()
        }
      });
    }

    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Internal server error while assigning agent',
        timestamp: new Date().toISOString()
      }
    });
  }
};

/**
 * Create new region with district customization
 */
exports.createRegion = async (req, res) => {
  try {
    const { name, code, districts, regionalManager, description } = req.body;
    const createdBy = req.user.userId;

    // Check if region code already exists
    const existingRegion = await Region.findOne({ code: code.toUpperCase() });
    if (existingRegion) {
      throw new AppError('Region code already exists', 400, 'REGION_CODE_EXISTS');
    }

    // Validate regional manager if provided
    if (regionalManager) {
      const manager = await Staff.findById(regionalManager);
      if (!manager || manager.role !== 'regional_manager') {
        throw new AppError('Invalid regional manager', 400, 'INVALID_REGIONAL_MANAGER');
      }

      // Check if manager is already assigned to another region
      const existingAssignment = await Region.findOne({ regionalManager });
      if (existingAssignment) {
        throw new AppError('Regional manager is already assigned to another region', 400, 'MANAGER_ALREADY_ASSIGNED');
      }
    }

    // Create region
    const newRegion = new Region({
      name,
      code: code.toUpperCase(),
      districts,
      regionalManager: regionalManager || null,
      createdBy,
      managedBy: createdBy,
      configuration: {
        maxLoanAmount: 10000000,
        defaultInterestRate: 12.5,
        maxLoanTerm: 60,
        requiredDocuments: ['id_copy', 'income_proof', 'address_proof'],
        businessHours: {
          start: '09:00',
          end: '17:00',
          timezone: 'Asia/Colombo',
          workingDays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday']
        }
      }
    });

    // Add audit entry
    newRegion.addAuditEntry('created', createdBy, {
      name,
      code: code.toUpperCase(),
      districts,
      regionalManager,
      description
    }, req.ip);

    await newRegion.save();

    // Update regional manager's region assignment if provided
    if (regionalManager) {
      await Staff.findByIdAndUpdate(regionalManager, {
        region: newRegion._id
      });

      // Add to region's assigned staff
      newRegion.assignedStaff.push({
        staff: regionalManager,
        role: 'regional_manager',
        assignedAt: new Date(),
        assignedBy: createdBy
      });

      await newRegion.save();
    }

    // Log the creation
    logger.audit('Region created', createdBy, 'Region', {
      regionId: newRegion._id,
      name,
      code: code.toUpperCase(),
      districts,
      regionalManager
    });

    // Populate response data
    const populatedRegion = await Region.findById(newRegion._id)
      .populate('regionalManager', 'name email role')
      .populate('createdBy', 'name email role');

    res.status(201).json({
      success: true,
      message: 'Region created successfully',
      data: {
        region: {
          id: populatedRegion._id,
          name: populatedRegion.name,
          code: populatedRegion.code,
          districts: populatedRegion.districts,
          regionalManager: populatedRegion.regionalManager,
          createdBy: populatedRegion.createdBy,
          configuration: populatedRegion.configuration,
          status: populatedRegion.status,
          createdAt: populatedRegion.createdAt
        }
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Create region error', error, {
      userId: req.user.userId,
      requestBody: req.body
    });

    if (error instanceof AppError) {
      return res.status(error.statusCode).json({
        success: false,
        error: {
          code: error.errorCode,
          message: error.message,
          timestamp: new Date().toISOString()
        }
      });
    }

    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Internal server error while creating region',
        timestamp: new Date().toISOString()
      }
    });
  }
};

/**
 * Update region with district customization
 */
exports.updateRegion = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, districts, regionalManager, description, isActive } = req.body;
    const updatedBy = req.user.userId;

    // Find region
    const region = await Region.findById(id);
    if (!region) {
      throw new AppError('Region not found', 404, 'REGION_NOT_FOUND');
    }

    // Validate regional manager if provided
    if (regionalManager && regionalManager !== region.regionalManager?.toString()) {
      const manager = await Staff.findById(regionalManager);
      if (!manager || manager.role !== 'regional_manager') {
        throw new AppError('Invalid regional manager', 400, 'INVALID_REGIONAL_MANAGER');
      }

      // Check if manager is already assigned to another region
      const existingAssignment = await Region.findOne({
        regionalManager,
        _id: { $ne: id }
      });
      if (existingAssignment) {
        throw new AppError('Regional manager is already assigned to another region', 400, 'MANAGER_ALREADY_ASSIGNED');
      }
    }

    // Store previous values for audit
    const previousValues = {
      name: region.name,
      districts: region.districts,
      regionalManager: region.regionalManager,
      status: region.status
    };

    // Update region fields
    if (name) region.name = name;
    if (districts) region.districts = districts;
    if (isActive !== undefined) region.status = isActive ? 'active' : 'inactive';

    // Handle regional manager change
    if (regionalManager !== undefined) {
      // Remove previous manager's region assignment
      if (region.regionalManager) {
        await Staff.findByIdAndUpdate(region.regionalManager, {
          $unset: { region: 1 }
        });

        // Remove from assigned staff
        region.assignedStaff = region.assignedStaff.filter(
          staff => staff.staff.toString() !== region.regionalManager.toString()
        );
      }

      // Assign new manager
      if (regionalManager) {
        region.regionalManager = regionalManager;

        await Staff.findByIdAndUpdate(regionalManager, {
          region: region._id
        });

        // Add to assigned staff
        region.assignedStaff.push({
          staff: regionalManager,
          role: 'regional_manager',
          assignedAt: new Date(),
          assignedBy: updatedBy
        });
      } else {
        region.regionalManager = null;
      }
    }

    // Add audit entry
    region.addAuditEntry('updated', updatedBy, {
      previousValues,
      newValues: {
        name: region.name,
        districts: region.districts,
        regionalManager: region.regionalManager,
        status: region.status
      }
    }, req.ip);

    await region.save();

    // Log the update
    logger.audit('Region updated', updatedBy, 'Region', {
      regionId: region._id,
      changes: req.body
    });

    // Populate response data
    const populatedRegion = await Region.findById(region._id)
      .populate('regionalManager', 'name email role')
      .populate('createdBy', 'name email role');

    res.status(200).json({
      success: true,
      message: 'Region updated successfully',
      data: {
        region: {
          id: populatedRegion._id,
          name: populatedRegion.name,
          code: populatedRegion.code,
          districts: populatedRegion.districts,
          regionalManager: populatedRegion.regionalManager,
          createdBy: populatedRegion.createdBy,
          configuration: populatedRegion.configuration,
          status: populatedRegion.status,
          updatedAt: populatedRegion.updatedAt
        }
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Update region error', error, {
      userId: req.user.userId,
      regionId: req.params.id,
      requestBody: req.body
    });

    if (error instanceof AppError) {
      return res.status(error.statusCode).json({
        success: false,
        error: {
          code: error.errorCode,
          message: error.message,
          timestamp: new Date().toISOString()
        }
      });
    }

    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Internal server error while updating region',
        timestamp: new Date().toISOString()
      }
    });
  }
};

/**
 * Get staff management dashboard data
 */
exports.getStaffDashboard = async (req, res) => {
  try {
    const { startDate, endDate, includeInactive } = req.query;
    const userId = req.user.userId;

    // Build date filter
    const dateFilter = {};
    if (startDate && endDate) {
      dateFilter.createdAt = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }

    // Build status filter
    const statusFilter = includeInactive === 'true'
      ? {}
      : { status: { $ne: 'inactive' } };

    // Get staff statistics
    const staffStats = await Staff.aggregate([
      { $match: { ...dateFilter, ...statusFilter } },
      {
        $group: {
          _id: '$role',
          count: { $sum: 1 },
          activeCount: {
            $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] }
          }
        }
      }
    ]);

    // Get regional statistics
    const regionStats = await Region.aggregate([
      { $match: { status: 'active' } },
      {
        $group: {
          _id: null,
          totalRegions: { $sum: 1 },
          totalDistricts: { $sum: { $size: '$districts' } },
          regionsWithManagers: {
            $sum: { $cond: [{ $ne: ['$regionalManager', null] }, 1, 0] }
          }
        }
      }
    ]);

    // Get recent staff activities
    const recentStaff = await Staff.find({ ...dateFilter, ...statusFilter })
      .populate('region', 'name code')
      .populate('createdBy', 'name email')
      .populate('managedBy', 'name email')
      .sort({ createdAt: -1 })
      .limit(10)
      .select('name email role region createdBy managedBy status createdAt');

    // Get loan and client statistics by region
    const performanceStats = await Region.aggregate([
      { $match: { status: 'active' } },
      {
        $lookup: {
          from: 'staffs',
          localField: '_id',
          foreignField: 'region',
          as: 'regionStaff'
        }
      },
      {
        $project: {
          name: 1,
          code: 1,
          totalStaff: { $size: '$regionStaff' },
          agents: {
            $size: {
              $filter: {
                input: '$regionStaff',
                cond: { $eq: ['$$this.role', 'agent'] }
              }
            }
          },
          regionalManagers: {
            $size: {
              $filter: {
                input: '$regionStaff',
                cond: { $eq: ['$$this.role', 'regional_manager'] }
              }
            }
          }
        }
      }
    ]);

    // Get system-wide metrics
    const systemMetrics = {
      totalStaff: await Staff.countDocuments(statusFilter),
      activeStaff: await Staff.countDocuments({ ...statusFilter, status: 'active' }),
      totalRegions: await Region.countDocuments({ status: 'active' }),
      totalClients: await Client.countDocuments(),
      totalLoans: await Loan.countDocuments(),
      pendingLoans: await Loan.countDocuments({
        'regionalAdminApproval.status': 'Pending',
        'agentReview.status': 'Approved'
      })
    };

    // Format staff statistics
    const formattedStaffStats = {
      super_admin: 0,
      moderate_admin: 0,
      ceo: 0,
      regional_manager: 0,
      agent: 0
    };

    staffStats.forEach(stat => {
      formattedStaffStats[stat._id] = stat.count;
    });

    res.status(200).json({
      success: true,
      message: 'Staff dashboard data retrieved successfully',
      data: {
        staffStatistics: formattedStaffStats,
        regionStatistics: regionStats[0] || {
          totalRegions: 0,
          totalDistricts: 0,
          regionsWithManagers: 0
        },
        systemMetrics,
        performanceByRegion: performanceStats,
        recentStaff,
        summary: {
          totalActiveStaff: systemMetrics.activeStaff,
          staffGrowth: recentStaff.length,
          regionCoverage: regionStats[0]?.regionsWithManagers || 0,
          systemHealth: 'operational'
        }
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Get staff dashboard error', error, {
      userId: req.user.userId,
      query: req.query
    });

    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Internal server error while fetching dashboard data',
        timestamp: new Date().toISOString()
      }
    });
  }
};

module.exports = exports;