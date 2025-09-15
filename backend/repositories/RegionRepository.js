/**
 * Region Repository
 * Handles region-specific database operations with district management
 */

const BaseRepository = require('./BaseRepository');
const Region = require('../models/Region');
const { AppError } = require('../utils/customErrors');
const logger = require('../utils/logger');
const mongoose = require('mongoose');

class RegionRepository extends BaseRepository {
  constructor() {
    super(Region);
  }

  /**
   * Find regions by district
   * @param {String} district - District name
   * @param {Object} filters - Additional filters
   * @param {Object} options - Query options
   * @returns {Promise<Array>} Regions containing the district
   */
  async findByDistrict(district, filters = {}, options = {}) {
    try {
      logger.debug('Finding regions by district', { district, filters });

      const query = {
        districts: district,
        status: 'active',
        ...filters
      };

      const defaultOptions = {
        populate: [
          { path: 'regionalManager', select: 'name email role profile' },
          { path: 'createdBy', select: 'name email role' },
          { path: 'managedBy', select: 'name email role' },
          { path: 'assignedStaff.staff', select: 'name email role' }
        ],
        sort: { createdAt: -1 }
      };

      return await this.find(query, { ...defaultOptions, ...options });
    } catch (error) {
      logger.error('Error finding regions by district', error, { district, filters });
      throw error;
    }
  }

  /**
   * Find regions managed by a specific user
   * @param {String} managerId - Manager's user ID
   * @param {Object} filters - Additional filters
   * @param {Object} options - Query options
   * @returns {Promise<Array>} Regions managed by the user
   */
  async findByManager(managerId, filters = {}, options = {}) {
    try {
      logger.debug('Finding regions by manager', { managerId, filters });

      const query = {
        $or: [
          { regionalManager: managerId },
          { managedBy: managerId }
        ],
        status: 'active',
        ...filters
      };

      const defaultOptions = {
        populate: [
          { path: 'regionalManager', select: 'name email role profile' },
          { path: 'createdBy', select: 'name email role' },
          { path: 'assignedStaff.staff', select: 'name email role' }
        ],
        sort: { createdAt: -1 }
      };

      return await this.find(query, { ...defaultOptions, ...options });
    } catch (error) {
      logger.error('Error finding regions by manager', error, { managerId, filters });
      throw error;
    }
  }

  /**
   * Find regions created by a specific user
   * @param {String} creatorId - Creator's user ID
   * @param {Object} filters - Additional filters
   * @param {Object} options - Query options
   * @returns {Promise<Array>} Regions created by the user
   */
  async findCreatedBy(creatorId, filters = {}, options = {}) {
    try {
      logger.debug('Finding regions created by user', { creatorId, filters });

      const query = {
        createdBy: creatorId,
        ...filters
      };

      const defaultOptions = {
        populate: [
          { path: 'regionalManager', select: 'name email role profile' },
          { path: 'managedBy', select: 'name email role' },
          { path: 'assignedStaff.staff', select: 'name email role' }
        ],
        sort: { createdAt: -1 }
      };

      return await this.find(query, { ...defaultOptions, ...options });
    } catch (error) {
      logger.error('Error finding regions created by user', error, { creatorId, filters });
      throw error;
    }
  }

  /**
   * Get regions without assigned regional manager
   * @param {Object} filters - Additional filters
   * @param {Object} options - Query options
   * @returns {Promise<Array>} Regions without regional manager
   */
  async findWithoutManager(filters = {}, options = {}) {
    try {
      logger.debug('Finding regions without manager', { filters });

      const query = {
        regionalManager: { $exists: false },
        status: 'active',
        ...filters
      };

      const defaultOptions = {
        populate: [
          { path: 'createdBy', select: 'name email role' },
          { path: 'managedBy', select: 'name email role' }
        ],
        sort: { createdAt: 1 } // Oldest first for priority assignment
      };

      return await this.find(query, { ...defaultOptions, ...options });
    } catch (error) {
      logger.error('Error finding regions without manager', error, { filters });
      throw error;
    }
  }

  /**
   * Get comprehensive region statistics
   * @param {String} regionId - Region ID (optional)
   * @returns {Promise<Object>} Region statistics
   */
  async getRegionStatistics(regionId = null) {
    try {
      logger.debug('Getting region statistics', { regionId });

      const matchStage = { status: 'active' };
      if (regionId) {
        matchStage._id = new mongoose.Types.ObjectId(regionId);
      }

      const pipeline = [
        { $match: matchStage },
        {
          $lookup: {
            from: 'staff',
            localField: '_id',
            foreignField: 'region',
            as: 'staffMembers'
          }
        },
        {
          $lookup: {
            from: 'clients',
            localField: '_id',
            foreignField: 'region',
            as: 'clients'
          }
        },
        {
          $lookup: {
            from: 'loans',
            localField: '_id',
            foreignField: 'region',
            as: 'loans'
          }
        },
        {
          $project: {
            name: 1,
            code: 1,
            districts: 1,
            status: 1,
            createdAt: 1,
            totalDistricts: { $size: '$districts' },
            totalStaff: { $size: '$staffMembers' },
            totalClients: { $size: '$clients' },
            totalLoans: { $size: '$loans' },
            staffByRole: {
              $reduce: {
                input: '$staffMembers',
                initialValue: {},
                in: {
                  $mergeObjects: [
                    '$$value',
                    {
                      $arrayToObject: [[{
                        k: '$$this.role',
                        v: { $add: [{ $ifNull: [{ $getField: { field: '$$this.role', input: '$$value' } }, 0] }, 1] }
                      }]]
                    }
                  ]
                }
              }
            },
            clientsByStatus: {
              $reduce: {
                input: '$clients',
                initialValue: {},
                in: {
                  $mergeObjects: [
                    '$$value',
                    {
                      $arrayToObject: [[{
                        k: '$$this.status',
                        v: { $add: [{ $ifNull: [{ $getField: { field: '$$this.status', input: '$$value' } }, 0] }, 1] }
                      }]]
                    }
                  ]
                }
              }
            },
            loansByStatus: {
              $reduce: {
                input: '$loans',
                initialValue: {},
                in: {
                  $mergeObjects: [
                    '$$value',
                    {
                      $arrayToObject: [[{
                        k: '$$this.loanStatus',
                        v: { $add: [{ $ifNull: [{ $getField: { field: '$$this.loanStatus', input: '$$value' } }, 0] }, 1] }
                      }]]
                    }
                  ]
                }
              }
            },
            totalLoanAmount: { $sum: '$loans.loanAmount' },
            averageLoanAmount: { $avg: '$loans.loanAmount' },
            statistics: 1
          }
        }
      ];

      const result = await this.aggregate(pipeline);

      if (regionId) {
        return result[0] || null;
      }

      return result;
    } catch (error) {
      logger.error('Error getting region statistics', error, { regionId });
      throw error;
    }
  }

  /**
   * Get district distribution across regions
   * @returns {Promise<Object>} District distribution statistics
   */
  async getDistrictDistribution() {
    try {
      logger.debug('Getting district distribution');

      const pipeline = [
        { $match: { status: 'active' } },
        { $unwind: '$districts' },
        {
          $group: {
            _id: '$districts',
            regions: {
              $push: {
                regionId: '$_id',
                regionName: '$name',
                regionCode: '$code'
              }
            },
            regionCount: { $sum: 1 }
          }
        },
        {
          $project: {
            _id: 0,
            district: '$_id',
            regions: 1,
            regionCount: 1,
            isShared: { $gt: ['$regionCount', 1] }
          }
        },
        { $sort: { district: 1 } }
      ];

      const result = await this.aggregate(pipeline);

      // Also get summary statistics
      const summaryPipeline = [
        { $match: { status: 'active' } },
        {
          $group: {
            _id: null,
            totalRegions: { $sum: 1 },
            totalDistrictAssignments: { $sum: { $size: '$districts' } },
            uniqueDistricts: { $addToSet: { $arrayElemAt: ['$districts', 0] } }
          }
        },
        {
          $project: {
            _id: 0,
            totalRegions: 1,
            totalDistrictAssignments: 1,
            uniqueDistrictsCount: { $size: '$uniqueDistricts' },
            averageDistrictsPerRegion: {
              $round: [
                { $divide: ['$totalDistrictAssignments', '$totalRegions'] },
                2
              ]
            }
          }
        }
      ];

      const summary = await this.aggregate(summaryPipeline);

      return {
        distribution: result,
        summary: summary[0] || {
          totalRegions: 0,
          totalDistrictAssignments: 0,
          uniqueDistrictsCount: 0,
          averageDistrictsPerRegion: 0
        }
      };
    } catch (error) {
      logger.error('Error getting district distribution', error);
      throw error;
    }
  }

  /**
   * Assign regional manager to region
   * @param {String} regionId - Region ID
   * @param {String} managerId - Manager's user ID
   * @param {String} assignedBy - User performing assignment
   * @returns {Promise<Object>} Updated region
   */
  async assignRegionalManager(regionId, managerId, assignedBy) {
    try {
      logger.info('Assigning regional manager to region', {
        regionId,
        managerId,
        assignedBy
      });

      const region = await this.findById(regionId);
      if (!region) {
        throw new AppError('Region not found', 404, 'REGION_NOT_FOUND');
      }

      region.assignRegionalManager(managerId, assignedBy);
      await region.save();

      logger.info('Regional manager assigned to region successfully', {
        regionId,
        managerId,
        assignedBy
      });

      return region;
    } catch (error) {
      logger.error('Error assigning regional manager to region', error, {
        regionId,
        managerId,
        assignedBy
      });
      throw error;
    }
  }

  /**
   * Add district to region
   * @param {String} regionId - Region ID
   * @param {String} district - District name
   * @param {String} addedBy - User performing action
   * @returns {Promise<Object>} Updated region
   */
  async addDistrict(regionId, district, addedBy) {
    try {
      logger.info('Adding district to region', { regionId, district, addedBy });

      // Check if district is already assigned to another region
      const existingRegion = await this.findOne({
        districts: district,
        _id: { $ne: regionId },
        status: 'active'
      });

      if (existingRegion) {
        throw new AppError(
          `District ${district} is already assigned to region ${existingRegion.name}`,
          409,
          'DISTRICT_ALREADY_ASSIGNED'
        );
      }

      const region = await this.findById(regionId);
      if (!region) {
        throw new AppError('Region not found', 404, 'REGION_NOT_FOUND');
      }

      region.addDistrict(district, addedBy);
      await region.save();

      logger.info('District added to region successfully', {
        regionId,
        district,
        addedBy
      });

      return region;
    } catch (error) {
      logger.error('Error adding district to region', error, {
        regionId,
        district,
        addedBy
      });
      throw error;
    }
  }

  /**
   * Remove district from region
   * @param {String} regionId - Region ID
   * @param {String} district - District name
   * @param {String} removedBy - User performing action
   * @returns {Promise<Object>} Updated region
   */
  async removeDistrict(regionId, district, removedBy) {
    try {
      logger.info('Removing district from region', { regionId, district, removedBy });

      const region = await this.findById(regionId);
      if (!region) {
        throw new AppError('Region not found', 404, 'REGION_NOT_FOUND');
      }

      region.removeDistrict(district, removedBy);
      await region.save();

      logger.info('District removed from region successfully', {
        regionId,
        district,
        removedBy
      });

      return region;
    } catch (error) {
      logger.error('Error removing district from region', error, {
        regionId,
        district,
        removedBy
      });
      throw error;
    }
  }

  /**
   * Update region configuration
   * @param {String} regionId - Region ID
   * @param {Object} configuration - New configuration
   * @param {String} updatedBy - User performing update
   * @returns {Promise<Object>} Updated region
   */
  async updateConfiguration(regionId, configuration, updatedBy) {
    try {
      logger.info('Updating region configuration', { regionId, configuration, updatedBy });

      const region = await this.findById(regionId);
      if (!region) {
        throw new AppError('Region not found', 404, 'REGION_NOT_FOUND');
      }

      region.updateConfiguration(configuration, updatedBy);
      await region.save();

      logger.info('Region configuration updated successfully', {
        regionId,
        updatedBy
      });

      return region;
    } catch (error) {
      logger.error('Error updating region configuration', error, {
        regionId,
        configuration,
        updatedBy
      });
      throw error;
    }
  }

  /**
   * Update region statistics
   * @param {String} regionId - Region ID
   * @param {Object} statistics - New statistics
   * @param {String} updatedBy - User performing update
   * @returns {Promise<Object>} Updated region
   */
  async updateStatistics(regionId, statistics, updatedBy) {
    try {
      logger.info('Updating region statistics', { regionId, statistics, updatedBy });

      const region = await this.findById(regionId);
      if (!region) {
        throw new AppError('Region not found', 404, 'REGION_NOT_FOUND');
      }

      region.updateStatistics(statistics, updatedBy);
      await region.save();

      logger.info('Region statistics updated successfully', {
        regionId,
        updatedBy
      });

      return region;
    } catch (error) {
      logger.error('Error updating region statistics', error, {
        regionId,
        statistics,
        updatedBy
      });
      throw error;
    }
  }

  /**
   * Get regions with performance metrics
   * @param {Object} filters - Additional filters
   * @param {String} sortBy - Sort criteria (performance, clients, loans)
   * @returns {Promise<Array>} Regions with performance data
   */
  async getRegionsWithPerformance(filters = {}, sortBy = 'performance') {
    try {
      logger.debug('Getting regions with performance metrics', { filters, sortBy });

      const matchStage = { status: 'active', ...filters };

      const pipeline = [
        { $match: matchStage },
        {
          $lookup: {
            from: 'loans',
            localField: '_id',
            foreignField: 'region',
            as: 'loans'
          }
        },
        {
          $lookup: {
            from: 'clients',
            localField: '_id',
            foreignField: 'region',
            as: 'clients'
          }
        },
        {
          $lookup: {
            from: 'staff',
            localField: 'regionalManager',
            foreignField: '_id',
            as: 'managerInfo'
          }
        },
        {
          $project: {
            name: 1,
            code: 1,
            districts: 1,
            createdAt: 1,
            regionalManager: { $arrayElemAt: ['$managerInfo', 0] },
            performance: {
              totalLoans: { $size: '$loans' },
              totalClients: { $size: '$clients' },
              approvedLoans: {
                $size: {
                  $filter: {
                    input: '$loans',
                    cond: { $eq: ['$$this.loanStatus', 'Approved'] }
                  }
                }
              },
              totalLoanAmount: { $sum: '$loans.loanAmount' },
              averageLoanAmount: { $avg: '$loans.loanAmount' },
              approvalRate: {
                $cond: [
                  { $gt: [{ $size: '$loans' }, 0] },
                  {
                    $multiply: [
                      {
                        $divide: [
                          {
                            $size: {
                              $filter: {
                                input: '$loans',
                                cond: { $eq: ['$$this.loanStatus', 'Approved'] }
                              }
                            }
                          },
                          { $size: '$loans' }
                        ]
                      },
                      100
                    ]
                  },
                  0
                ]
              },
              clientVerificationRate: {
                $cond: [
                  { $gt: [{ $size: '$clients' }, 0] },
                  {
                    $multiply: [
                      {
                        $divide: [
                          {
                            $size: {
                              $filter: {
                                input: '$clients',
                                cond: { $eq: ['$$this.status', 'Approved'] }
                              }
                            }
                          },
                          { $size: '$clients' }
                        ]
                      },
                      100
                    ]
                  },
                  0
                ]
              }
            }
          }
        }
      ];

      // Add sorting based on criteria
      const sortStage = {};
      switch (sortBy) {
        case 'performance':
          sortStage['performance.approvalRate'] = -1;
          break;
        case 'clients':
          sortStage['performance.totalClients'] = -1;
          break;
        case 'loans':
          sortStage['performance.totalLoans'] = -1;
          break;
        case 'amount':
          sortStage['performance.totalLoanAmount'] = -1;
          break;
        default:
          sortStage.createdAt = -1;
      }

      pipeline.push({ $sort: sortStage });

      return await this.aggregate(pipeline);
    } catch (error) {
      logger.error('Error getting regions with performance metrics', error, { filters, sortBy });
      throw error;
    }
  }

  /**
   * Find available districts for assignment
   * @param {String} excludeRegionId - Region ID to exclude (optional)
   * @returns {Promise<Array>} Available districts
   */
  async getAvailableDistricts(excludeRegionId = null) {
    try {
      logger.debug('Getting available districts', { excludeRegionId });

      // All possible districts in Sri Lanka
      const allDistricts = [
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
      ];

      // Get assigned districts
      const matchStage = { status: 'active' };
      if (excludeRegionId) {
        matchStage._id = { $ne: new mongoose.Types.ObjectId(excludeRegionId) };
      }

      const assignedDistricts = await this.aggregate([
        { $match: matchStage },
        { $unwind: '$districts' },
        { $group: { _id: null, districts: { $addToSet: '$districts' } } },
        { $project: { _id: 0, districts: 1 } }
      ]);

      const assigned = assignedDistricts[0]?.districts || [];
      const available = allDistricts.filter(district => !assigned.includes(district));

      return {
        available,
        assigned,
        total: allDistricts.length,
        availableCount: available.length,
        assignedCount: assigned.length
      };
    } catch (error) {
      logger.error('Error getting available districts', error, { excludeRegionId });
      throw error;
    }
  }

  /**
   * Search regions by name or code
   * @param {String} searchText - Search text
   * @param {Object} filters - Additional filters
   * @param {Object} options - Query options
   * @returns {Promise<Array>} Search results
   */
  async searchRegions(searchText, filters = {}, options = {}) {
    try {
      logger.debug('Searching regions', { searchText, filters });

      const query = {
        $or: [
          { name: { $regex: searchText, $options: 'i' } },
          { code: { $regex: searchText, $options: 'i' } },
          { districts: { $regex: searchText, $options: 'i' } }
        ],
        status: 'active',
        ...filters
      };

      const defaultOptions = {
        populate: [
          { path: 'regionalManager', select: 'name email role' },
          { path: 'createdBy', select: 'name email role' }
        ],
        sort: { name: 1 }
      };

      return await this.find(query, { ...defaultOptions, ...options });
    } catch (error) {
      logger.error('Error searching regions', error, { searchText, filters });
      throw error;
    }
  }
}

module.exports = RegionRepository;