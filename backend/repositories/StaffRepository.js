/**
 * Staff Repository
 * Handles staff-specific database operations with role hierarchy queries
 */

const BaseRepository = require('./BaseRepository');
const Staff = require('../models/Staff');
const { AppError } = require('../utils/customErrors');
const logger = require('../utils/logger');
const mongoose = require('mongoose');

class StaffRepository extends BaseRepository {
  constructor() {
    super(Staff);
  }

  /**
   * Find staff by role with hierarchy filtering
   * @param {String} role - Staff role
   * @param {Object} filters - Additional filters
   * @param {Object} options - Query options
   * @returns {Promise<Array>} Staff members with specified role
   */
  async findByRole(role, filters = {}, options = {}) {
    try {
      logger.debug('Finding staff by role', { role, filters });

      const query = {
        role,
        status: 'active',
        ...filters
      };

      const defaultOptions = {
        populate: [
          { path: 'createdBy', select: 'name email role' },
          { path: 'reportsTo', select: 'name email role' },
          { path: 'managedBy', select: 'name email role' },
          { path: 'region', select: 'name code districts' }
        ],
        sort: { createdAt: -1 }
      };

      return await this.find(query, { ...defaultOptions, ...options });
    } catch (error) {
      logger.error('Error finding staff by role', error, { role, filters });
      throw error;
    }
  }

  /**
   * Find staff created by a specific user (hierarchy management)
   * @param {String} creatorId - Creator's user ID
   * @param {Object} filters - Additional filters
   * @param {Object} options - Query options
   * @returns {Promise<Array>} Staff created by the user
   */
  async findCreatedBy(creatorId, filters = {}, options = {}) {
    try {
      logger.debug('Finding staff created by user', { creatorId, filters });

      const query = {
        createdBy: creatorId,
        ...filters
      };

      const defaultOptions = {
        populate: [
          { path: 'region', select: 'name code districts' },
          { path: 'reportsTo', select: 'name email role' },
          { path: 'managedBy', select: 'name email role' }
        ],
        sort: { createdAt: -1 }
      };

      return await this.find(query, { ...defaultOptions, ...options });
    } catch (error) {
      logger.error('Error finding staff created by user', error, { creatorId, filters });
      throw error;
    }
  }

  /**
   * Find subordinates of a staff member
   * @param {String} managerId - Manager's user ID
   * @param {Object} filters - Additional filters
   * @param {Object} options - Query options
   * @returns {Promise<Array>} Subordinate staff members
   */
  async findSubordinates(managerId, filters = {}, options = {}) {
    try {
      logger.debug('Finding subordinates', { managerId, filters });

      const query = {
        $or: [
          { reportsTo: managerId },
          { managedBy: managerId }
        ],
        status: 'active',
        ...filters
      };

      const defaultOptions = {
        populate: [
          { path: 'region', select: 'name code districts' },
          { path: 'createdBy', select: 'name email role' }
        ],
        sort: { role: 1, createdAt: -1 }
      };

      return await this.find(query, { ...defaultOptions, ...options });
    } catch (error) {
      logger.error('Error finding subordinates', error, { managerId, filters });
      throw error;
    }
  }

  /**
   * Find staff by region
   * @param {String} regionId - Region ID
   * @param {Object} filters - Additional filters
   * @param {Object} options - Query options
   * @returns {Promise<Array>} Staff in the region
   */
  async findByRegion(regionId, filters = {}, options = {}) {
    try {
      logger.debug('Finding staff by region', { regionId, filters });

      const query = {
        region: regionId,
        status: 'active',
        ...filters
      };

      const defaultOptions = {
        populate: [
          { path: 'createdBy', select: 'name email role' },
          { path: 'reportsTo', select: 'name email role' },
          { path: 'managedBy', select: 'name email role' }
        ],
        sort: { role: 1, createdAt: -1 }
      };

      return await this.find(query, { ...defaultOptions, ...options });
    } catch (error) {
      logger.error('Error finding staff by region', error, { regionId, filters });
      throw error;
    }
  }

  /**
   * Find agents managed by a regional manager
   * @param {String} regionalManagerId - Regional Manager ID
   * @param {Object} filters - Additional filters
   * @param {Object} options - Query options
   * @returns {Promise<Array>} Agents managed by the regional manager
   */
  async findAgentsByRegionalManager(regionalManagerId, filters = {}, options = {}) {
    try {
      logger.debug('Finding agents by regional manager', { regionalManagerId, filters });

      const query = {
        role: 'agent',
        managedBy: regionalManagerId,
        status: 'active',
        ...filters
      };

      const defaultOptions = {
        populate: [
          { path: 'region', select: 'name code districts' },
          { path: 'createdBy', select: 'name email role' }
        ],
        sort: { createdAt: -1 }
      };

      return await this.find(query, { ...defaultOptions, ...options });
    } catch (error) {
      logger.error('Error finding agents by regional manager', error, { regionalManagerId, filters });
      throw error;
    }
  }

  /**
   * Get staff hierarchy tree
   * @param {String} rootUserId - Root user ID (optional)
   * @returns {Promise<Array>} Hierarchical staff structure
   */
  async getHierarchyTree(rootUserId = null) {
    try {
      logger.debug('Getting staff hierarchy tree', { rootUserId });

      const pipeline = [
        {
          $match: {
            status: 'active',
            ...(rootUserId ? { createdBy: new mongoose.Types.ObjectId(rootUserId) } : {})
          }
        },
        {
          $lookup: {
            from: 'staff',
            localField: '_id',
            foreignField: 'reportsTo',
            as: 'directReports'
          }
        },
        {
          $lookup: {
            from: 'staff',
            localField: '_id',
            foreignField: 'managedBy',
            as: 'managedStaff'
          }
        },
        {
          $lookup: {
            from: 'regions',
            localField: 'region',
            foreignField: '_id',
            as: 'regionInfo'
          }
        },
        {
          $project: {
            name: 1,
            email: 1,
            role: 1,
            status: 1,
            createdAt: 1,
            reportsTo: 1,
            managedBy: 1,
            region: { $arrayElemAt: ['$regionInfo', 0] },
            directReportsCount: { $size: '$directReports' },
            managedStaffCount: { $size: '$managedStaff' },
            hierarchyLevel: {
              $switch: {
                branches: [
                  { case: { $eq: ['$role', 'super_admin'] }, then: 1 },
                  { case: { $eq: ['$role', 'moderate_admin'] }, then: 2 },
                  { case: { $eq: ['$role', 'ceo'] }, then: 3 },
                  { case: { $eq: ['$role', 'regional_manager'] }, then: 4 },
                  { case: { $eq: ['$role', 'agent'] }, then: 5 }
                ],
                default: 999
              }
            }
          }
        },
        {
          $sort: { hierarchyLevel: 1, createdAt: -1 }
        }
      ];

      return await this.aggregate(pipeline);
    } catch (error) {
      logger.error('Error getting staff hierarchy tree', error, { rootUserId });
      throw error;
    }
  }

  /**
   * Get staff statistics by role
   * @param {String} createdBy - Creator ID (optional)
   * @returns {Promise<Object>} Staff statistics
   */
  async getRoleStatistics(createdBy = null) {
    try {
      logger.debug('Getting staff role statistics', { createdBy });

      const matchStage = { status: 'active' };
      if (createdBy) {
        matchStage.createdBy = new mongoose.Types.ObjectId(createdBy);
      }

      const pipeline = [
        { $match: matchStage },
        {
          $group: {
            _id: '$role',
            count: { $sum: 1 },
            activeCount: {
              $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] }
            },
            withRegion: {
              $sum: { $cond: [{ $ne: ['$region', null] }, 1, 0] }
            },
            averageMetricsScore: { $avg: '$metrics.performanceScore' }
          }
        },
        {
          $project: {
            _id: 0,
            role: '$_id',
            count: 1,
            activeCount: 1,
            withRegion: 1,
            regionAssignmentRate: {
              $round: [
                { $multiply: [{ $divide: ['$withRegion', '$count'] }, 100] },
                2
              ]
            },
            averagePerformanceScore: {
              $round: ['$averageMetricsScore', 2]
            }
          }
        },
        { $sort: { role: 1 } }
      ];

      const result = await this.aggregate(pipeline);

      // Convert array to object for easier access
      const statistics = {};
      result.forEach(stat => {
        statistics[stat.role] = stat;
      });

      return statistics;
    } catch (error) {
      logger.error('Error getting staff role statistics', error, { createdBy });
      throw error;
    }
  }

  /**
   * Find staff with specific permissions
   * @param {Array} permissions - Required permissions
   * @param {Object} filters - Additional filters
   * @param {Object} options - Query options
   * @returns {Promise<Array>} Staff with required permissions
   */
  async findWithPermissions(permissions, filters = {}, options = {}) {
    try {
      logger.debug('Finding staff with permissions', { permissions, filters });

      const query = {
        permissions: { $all: permissions },
        status: 'active',
        ...filters
      };

      const defaultOptions = {
        populate: [
          { path: 'region', select: 'name code' },
          { path: 'reportsTo', select: 'name email role' }
        ],
        sort: { role: 1, createdAt: -1 }
      };

      return await this.find(query, { ...defaultOptions, ...options });
    } catch (error) {
      logger.error('Error finding staff with permissions', error, { permissions, filters });
      throw error;
    }
  }

  /**
   * Check if user can manage target staff (hierarchy validation)
   * @param {String} managerId - Manager's user ID
   * @param {String} targetStaffId - Target staff ID
   * @returns {Promise<Boolean>} True if can manage, false otherwise
   */
  async canManageStaff(managerId, targetStaffId) {
    try {
      logger.debug('Checking if user can manage staff', { managerId, targetStaffId });

      const [manager, targetStaff] = await Promise.all([
        this.findById(managerId),
        this.findById(targetStaffId)
      ]);

      if (!manager || !targetStaff) {
        return false;
      }

      return manager.canManage(targetStaff);
    } catch (error) {
      logger.error('Error checking staff management permission', error, { managerId, targetStaffId });
      throw error;
    }
  }

  /**
   * Assign staff to regional manager
   * @param {String} staffId - Staff ID
   * @param {String} regionalManagerId - Regional Manager ID
   * @param {String} assignedBy - User performing assignment
   * @returns {Promise<Object>} Updated staff
   */
  async assignToRegionalManager(staffId, regionalManagerId, assignedBy) {
    try {
      logger.info('Assigning staff to regional manager', {
        staffId,
        regionalManagerId,
        assignedBy
      });

      const staff = await this.findById(staffId);
      if (!staff) {
        throw new AppError('Staff not found', 404, 'STAFF_NOT_FOUND');
      }

      const regionalManager = await this.findById(regionalManagerId);
      if (!regionalManager || regionalManager.role !== 'regional_manager') {
        throw new AppError('Regional manager not found', 404, 'REGIONAL_MANAGER_NOT_FOUND');
      }

      // Update staff assignment
      staff.managedBy = regionalManagerId;
      staff.region = regionalManager.region;
      staff.addAuditEntry('assigned', assignedBy, {
        assignedTo: regionalManagerId,
        region: regionalManager.region
      });

      // Update regional manager's subordinates
      regionalManager.assignSubordinate(staffId, assignedBy);

      await Promise.all([
        staff.save(),
        regionalManager.save()
      ]);

      logger.info('Staff assigned to regional manager successfully', {
        staffId,
        regionalManagerId,
        assignedBy
      });

      return staff;
    } catch (error) {
      logger.error('Error assigning staff to regional manager', error, {
        staffId,
        regionalManagerId,
        assignedBy
      });
      throw error;
    }
  }

  /**
   * Update staff performance metrics
   * @param {String} staffId - Staff ID
   * @param {Object} metrics - Performance metrics
   * @param {String} updatedBy - User performing update
   * @returns {Promise<Object>} Updated staff
   */
  async updatePerformanceMetrics(staffId, metrics, updatedBy) {
    try {
      logger.info('Updating staff performance metrics', { staffId, metrics, updatedBy });

      const staff = await this.findById(staffId);
      if (!staff) {
        throw new AppError('Staff not found', 404, 'STAFF_NOT_FOUND');
      }

      staff.updateMetrics(metrics);
      staff.addAuditEntry('performance_updated', updatedBy, { metrics });
      await staff.save();

      logger.info('Staff performance metrics updated successfully', {
        staffId,
        updatedBy
      });

      return staff;
    } catch (error) {
      logger.error('Error updating staff performance metrics', error, {
        staffId,
        metrics,
        updatedBy
      });
      throw error;
    }
  }

  /**
   * Find staff by email (for authentication)
   * @param {String} email - Email address
   * @param {Boolean} includePassword - Whether to include password hash
   * @returns {Promise<Object|null>} Staff member or null
   */
  async findByEmail(email, includePassword = false) {
    try {
      logger.debug('Finding staff by email', { email });

      const query = { email: email.toLowerCase(), status: 'active' };
      const options = {
        populate: [
          { path: 'region', select: 'name code districts' },
          { path: 'reportsTo', select: 'name email role' }
        ]
      };

      if (includePassword) {
        options.select = '+passwordHash';
      }

      return await this.findOne(query, options);
    } catch (error) {
      logger.error('Error finding staff by email', error, { email });
      throw error;
    }
  }

  /**
   * Get regional managers for assignment
   * @param {String} createdBy - Creator ID (moderate admin)
   * @param {Object} filters - Additional filters
   * @returns {Promise<Array>} Available regional managers
   */
  async getAvailableRegionalManagers(createdBy, filters = {}) {
    try {
      logger.debug('Getting available regional managers', { createdBy, filters });

      const query = {
        role: 'regional_manager',
        createdBy,
        status: 'active',
        ...filters
      };

      const options = {
        populate: [
          { path: 'region', select: 'name code districts' }
        ],
        sort: { createdAt: -1 }
      };

      return await this.find(query, options);
    } catch (error) {
      logger.error('Error getting available regional managers', error, { createdBy, filters });
      throw error;
    }
  }

  /**
   * Get staff workload statistics
   * @param {String} staffId - Staff ID
   * @returns {Promise<Object>} Workload statistics
   */
  async getWorkloadStats(staffId) {
    try {
      logger.debug('Getting staff workload statistics', { staffId });

      const pipeline = [
        { $match: { _id: new mongoose.Types.ObjectId(staffId) } },
        {
          $lookup: {
            from: 'clients',
            localField: '_id',
            foreignField: 'assignedAgent',
            as: 'assignedClients'
          }
        },
        {
          $lookup: {
            from: 'loans',
            localField: '_id',
            foreignField: 'assignedAgent',
            as: 'assignedLoans'
          }
        },
        {
          $lookup: {
            from: 'loans',
            localField: '_id',
            foreignField: 'assignedRegionalManager',
            as: 'managedLoans'
          }
        },
        {
          $project: {
            name: 1,
            email: 1,
            role: 1,
            totalAssignedClients: { $size: '$assignedClients' },
            totalAssignedLoans: { $size: '$assignedLoans' },
            totalManagedLoans: { $size: '$managedLoans' },
            pendingClientVerifications: {
              $size: {
                $filter: {
                  input: '$assignedClients',
                  cond: { $eq: ['$$this.status', 'Pending'] }
                }
              }
            },
            pendingLoanApprovals: {
              $size: {
                $filter: {
                  input: '$managedLoans',
                  cond: {
                    $and: [
                      { $eq: ['$$this.agentReview.status', 'Approved'] },
                      { $in: ['$$this.regionalAdminApproval.status', ['Pending', null]] }
                    ]
                  }
                }
              }
            }
          }
        }
      ];

      const result = await this.aggregate(pipeline);
      return result[0] || {
        totalAssignedClients: 0,
        totalAssignedLoans: 0,
        totalManagedLoans: 0,
        pendingClientVerifications: 0,
        pendingLoanApprovals: 0
      };
    } catch (error) {
      logger.error('Error getting staff workload statistics', error, { staffId });
      throw error;
    }
  }

  /**
   * Find staff requiring performance review
   * @param {Object} filters - Additional filters
   * @returns {Promise<Array>} Staff requiring review
   */
  async findRequiringPerformanceReview(filters = {}) {
    try {
      logger.debug('Finding staff requiring performance review', { filters });

      const threeMonthsAgo = new Date();
      threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

      const query = {
        status: 'active',
        $or: [
          { 'metrics.lastPerformanceReview': { $lt: threeMonthsAgo } },
          { 'metrics.lastPerformanceReview': { $exists: false } }
        ],
        ...filters
      };

      const options = {
        populate: [
          { path: 'reportsTo', select: 'name email role' },
          { path: 'region', select: 'name code' }
        ],
        sort: { 'metrics.lastPerformanceReview': 1 }
      };

      return await this.find(query, options);
    } catch (error) {
      logger.error('Error finding staff requiring performance review', error, { filters });
      throw error;
    }
  }
}

module.exports = StaffRepository;