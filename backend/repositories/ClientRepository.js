/**
 * Client Repository
 * Handles client-specific database operations with agent assignment queries
 */

const BaseRepository = require('./BaseRepository');
const Client = require('../models/Client');
const { AppError } = require('../utils/customErrors');
const { logger } = require('../utils/logger');
const mongoose = require('mongoose');

class ClientRepository extends BaseRepository {
  constructor() {
    super(Client);
  }

  /**
   * Find clients by agent assignment
   * @param {String} agentId - Agent ID
   * @param {Object} filters - Additional filters
   * @param {Object} options - Query options
   * @returns {Promise<Array>} Agent's assigned clients
   */
  async findByAgent(agentId, filters = {}, options = {}) {
    try {
      logger.debug('Finding clients by agent', { agentId, filters });

      const query = {
        assignedAgent: agentId,
        ...filters
      };

      const defaultOptions = {
        populate: [
          { path: 'assignedAgent', select: 'name email role' },
          { path: 'assignedBy', select: 'name email role' },
          { path: 'region', select: 'name code districts' }
        ],
        sort: { assignedAt: -1 }
      };

      return await this.find(query, { ...defaultOptions, ...options });
    } catch (error) {
      logger.error('Error finding clients by agent', error, { agentId, filters });
      throw error;
    }
  }

  /**
   * Find unassigned clients in a region
   * @param {String} regionId - Region ID
   * @param {Object} filters - Additional filters
   * @param {Object} options - Query options
   * @returns {Promise<Array>} Unassigned clients
   */
  async findUnassignedInRegion(regionId, filters = {}, options = {}) {
    try {
      logger.debug('Finding unassigned clients in region', { regionId, filters });

      const query = {
        region: regionId,
        assignedAgent: { $exists: false },
        status: { $in: ['Pending', 'Under_Review', 'Approved'] },
        ...filters
      };

      const defaultOptions = {
        populate: [
          { path: 'region', select: 'name code districts' }
        ],
        sort: { createdAt: 1 } // Oldest first for fair assignment
      };

      return await this.find(query, { ...defaultOptions, ...options });
    } catch (error) {
      logger.error('Error finding unassigned clients in region', error, { regionId, filters });
      throw error;
    }
  }

  /**
   * Find clients by district
   * @param {String} district - District name
   * @param {Object} filters - Additional filters
   * @param {Object} options - Query options
   * @returns {Promise<Array>} Clients in district
   */
  async findByDistrict(district, filters = {}, options = {}) {
    try {
      logger.debug('Finding clients by district', { district, filters });

      const query = {
        'personalInfo.district': district,
        ...filters
      };

      const defaultOptions = {
        populate: [
          { path: 'assignedAgent', select: 'name email role' },
          { path: 'region', select: 'name code' }
        ],
        sort: { createdAt: -1 }
      };

      return await this.find(query, { ...defaultOptions, ...options });
    } catch (error) {
      logger.error('Error finding clients by district', error, { district, filters });
      throw error;
    }
  }

  /**
   * Find clients by verification status
   * @param {Object} verificationFilters - Verification status filters
   * @param {Object} filters - Additional filters
   * @param {Object} options - Query options
   * @returns {Promise<Array>} Clients matching verification criteria
   */
  async findByVerificationStatus(verificationFilters, filters = {}, options = {}) {
    try {
      logger.debug('Finding clients by verification status', { verificationFilters, filters });

      const query = { ...filters };

      // Build verification status query
      if (verificationFilters.identity !== undefined) {
        query['verificationStatus.identity.verified'] = verificationFilters.identity;
      }
      if (verificationFilters.employment !== undefined) {
        query['verificationStatus.employment.verified'] = verificationFilters.employment;
      }
      if (verificationFilters.income !== undefined) {
        query['verificationStatus.income.verified'] = verificationFilters.income;
      }
      if (verificationFilters.documents !== undefined) {
        query['verificationStatus.documents.verified'] = verificationFilters.documents;
      }

      const defaultOptions = {
        populate: [
          { path: 'assignedAgent', select: 'name email role' },
          { path: 'verificationStatus.identity.verifiedBy', select: 'name email' },
          { path: 'verificationStatus.employment.verifiedBy', select: 'name email' },
          { path: 'verificationStatus.income.verifiedBy', select: 'name email' },
          { path: 'verificationStatus.documents.verifiedBy', select: 'name email' }
        ],
        sort: { createdAt: -1 }
      };

      return await this.find(query, { ...defaultOptions, ...options });
    } catch (error) {
      logger.error('Error finding clients by verification status', error, { verificationFilters, filters });
      throw error;
    }
  }

  /**
   * Get client statistics by agent
   * @param {String} agentId - Agent ID
   * @param {Object} dateRange - Date range filter
   * @returns {Promise<Object>} Client statistics
   */
  async getAgentClientStats(agentId, dateRange = {}) {
    try {
      logger.debug('Getting agent client statistics', { agentId, dateRange });

      const matchStage = { assignedAgent: new mongoose.Types.ObjectId(agentId) };

      if (dateRange.startDate || dateRange.endDate) {
        matchStage.assignedAt = {};
        if (dateRange.startDate) matchStage.assignedAt.$gte = new Date(dateRange.startDate);
        if (dateRange.endDate) matchStage.assignedAt.$lte = new Date(dateRange.endDate);
      }

      const pipeline = [
        { $match: matchStage },
        {
          $group: {
            _id: null,
            totalClients: { $sum: 1 },
            statusBreakdown: {
              $push: '$status'
            },
            verificationStats: {
              $push: {
                identity: '$verificationStatus.identity.verified',
                employment: '$verificationStatus.employment.verified',
                income: '$verificationStatus.income.verified',
                documents: '$verificationStatus.documents.verified'
              }
            },
            riskLevelBreakdown: {
              $push: '$riskProfile.riskLevel'
            },
            averageRiskScore: { $avg: '$riskProfile.score' }
          }
        },
        {
          $project: {
            _id: 0,
            totalClients: 1,
            averageRiskScore: { $round: ['$averageRiskScore', 2] },
            statusCounts: {
              $reduce: {
                input: '$statusBreakdown',
                initialValue: {},
                in: {
                  $mergeObjects: [
                    '$$value',
                    {
                      $arrayToObject: [[{
                        k: '$$this',
                        v: { $add: [{ $ifNull: [{ $getField: { field: '$$this', input: '$$value' } }, 0] }, 1] }
                      }]]
                    }
                  ]
                }
              }
            },
            riskLevelCounts: {
              $reduce: {
                input: '$riskLevelBreakdown',
                initialValue: {},
                in: {
                  $mergeObjects: [
                    '$$value',
                    {
                      $arrayToObject: [[{
                        k: '$$this',
                        v: { $add: [{ $ifNull: [{ $getField: { field: '$$this', input: '$$value' } }, 0] }, 1] }
                      }]]
                    }
                  ]
                }
              }
            },
            verificationCompletionRate: {
              $multiply: [
                {
                  $divide: [
                    {
                      $size: {
                        $filter: {
                          input: '$verificationStats',
                          cond: {
                            $and: [
                              '$$this.identity',
                              '$$this.employment',
                              '$$this.income',
                              '$$this.documents'
                            ]
                          }
                        }
                      }
                    },
                    '$totalClients'
                  ]
                },
                100
              ]
            }
          }
        }
      ];

      const result = await this.aggregate(pipeline);
      return result[0] || {
        totalClients: 0,
        averageRiskScore: 0,
        statusCounts: {},
        riskLevelCounts: {},
        verificationCompletionRate: 0
      };
    } catch (error) {
      logger.error('Error getting agent client statistics', error, { agentId, dateRange });
      throw error;
    }
  }

  /**
   * Get regional client statistics
   * @param {String} regionId - Region ID
   * @param {Object} dateRange - Date range filter
   * @returns {Promise<Object>} Regional client statistics
   */
  async getRegionalClientStats(regionId, dateRange = {}) {
    try {
      logger.debug('Getting regional client statistics', { regionId, dateRange });

      const matchStage = { region: new mongoose.Types.ObjectId(regionId) };

      if (dateRange.startDate || dateRange.endDate) {
        matchStage.createdAt = {};
        if (dateRange.startDate) matchStage.createdAt.$gte = new Date(dateRange.startDate);
        if (dateRange.endDate) matchStage.createdAt.$lte = new Date(dateRange.endDate);
      }

      const pipeline = [
        { $match: matchStage },
        {
          $group: {
            _id: null,
            totalClients: { $sum: 1 },
            assignedClients: {
              $sum: { $cond: [{ $ne: ['$assignedAgent', null] }, 1, 0] }
            },
            unassignedClients: {
              $sum: { $cond: [{ $eq: ['$assignedAgent', null] }, 1, 0] }
            },
            districtBreakdown: {
              $push: '$personalInfo.district'
            },
            statusBreakdown: {
              $push: '$status'
            },
            averageRiskScore: { $avg: '$riskProfile.score' }
          }
        },
        {
          $project: {
            _id: 0,
            totalClients: 1,
            assignedClients: 1,
            unassignedClients: 1,
            assignmentRate: {
              $round: [
                {
                  $multiply: [
                    { $divide: ['$assignedClients', '$totalClients'] },
                    100
                  ]
                },
                2
              ]
            },
            averageRiskScore: { $round: ['$averageRiskScore', 2] },
            districtCounts: {
              $reduce: {
                input: '$districtBreakdown',
                initialValue: {},
                in: {
                  $mergeObjects: [
                    '$$value',
                    {
                      $arrayToObject: [[{
                        k: '$$this',
                        v: { $add: [{ $ifNull: [{ $getField: { field: '$$this', input: '$$value' } }, 0] }, 1] }
                      }]]
                    }
                  ]
                }
              }
            },
            statusCounts: {
              $reduce: {
                input: '$statusBreakdown',
                initialValue: {},
                in: {
                  $mergeObjects: [
                    '$$value',
                    {
                      $arrayToObject: [[{
                        k: '$$this',
                        v: { $add: [{ $ifNull: [{ $getField: { field: '$$this', input: '$$value' } }, 0] }, 1] }
                      }]]
                    }
                  ]
                }
              }
            }
          }
        }
      ];

      const result = await this.aggregate(pipeline);
      return result[0] || {
        totalClients: 0,
        assignedClients: 0,
        unassignedClients: 0,
        assignmentRate: 0,
        averageRiskScore: 0,
        districtCounts: {},
        statusCounts: {}
      };
    } catch (error) {
      logger.error('Error getting regional client statistics', error, { regionId, dateRange });
      throw error;
    }
  }

  /**
   * Assign client to agent
   * @param {String} clientId - Client ID
   * @param {String} agentId - Agent ID
   * @param {String} assignedBy - User performing assignment
   * @param {String} reason - Assignment reason
   * @returns {Promise<Object>} Updated client
   */
  async assignToAgent(clientId, agentId, assignedBy, reason = '') {
    try {
      logger.info('Assigning client to agent', { clientId, agentId, assignedBy, reason });

      const client = await this.findById(clientId);
      if (!client) {
        throw new AppError('Client not found', 404, 'CLIENT_NOT_FOUND');
      }

      client.assignToAgent(agentId, assignedBy, reason);
      await client.save();

      logger.info('Client assigned to agent successfully', {
        clientId,
        agentId,
        assignedBy
      });

      return client;
    } catch (error) {
      logger.error('Error assigning client to agent', error, {
        clientId,
        agentId,
        assignedBy
      });
      throw error;
    }
  }

  /**
   * Update client verification status
   * @param {String} clientId - Client ID
   * @param {String} category - Verification category
   * @param {Boolean} verified - Verification status
   * @param {String} verifiedBy - User performing verification
   * @param {String} reason - Verification reason/notes
   * @returns {Promise<Object>} Updated client
   */
  async updateVerificationStatus(clientId, category, verified, verifiedBy, reason = '') {
    try {
      logger.info('Updating client verification status', {
        clientId,
        category,
        verified,
        verifiedBy,
        reason
      });

      const client = await this.findById(clientId);
      if (!client) {
        throw new AppError('Client not found', 404, 'CLIENT_NOT_FOUND');
      }

      client.updateVerificationStatus(category, verified, verifiedBy, reason);
      await client.save();

      logger.info('Client verification status updated successfully', {
        clientId,
        category,
        verified,
        verifiedBy
      });

      return client;
    } catch (error) {
      logger.error('Error updating client verification status', error, {
        clientId,
        category,
        verified,
        verifiedBy
      });
      throw error;
    }
  }

  /**
   * Search clients with text search
   * @param {String} searchText - Search text
   * @param {Object} filters - Additional filters
   * @param {Object} options - Query options
   * @returns {Promise<Array>} Search results
   */
  async searchClients(searchText, filters = {}, options = {}) {
    try {
      logger.debug('Searching clients', { searchText, filters });

      const query = {
        $text: { $search: searchText },
        ...filters
      };

      const defaultOptions = {
        populate: [
          { path: 'assignedAgent', select: 'name email role' },
          { path: 'region', select: 'name code' }
        ],
        sort: { score: { $meta: 'textScore' } }
      };

      return await this.find(query, { ...defaultOptions, ...options });
    } catch (error) {
      logger.error('Error searching clients', error, { searchText, filters });
      throw error;
    }
  }

  /**
   * Get clients requiring attention (incomplete verification, etc.)
   * @param {String} agentId - Agent ID (optional)
   * @param {Object} filters - Additional filters
   * @param {Object} options - Query options
   * @returns {Promise<Array>} Clients requiring attention
   */
  async findRequiringAttention(agentId = null, filters = {}, options = {}) {
    try {
      logger.debug('Finding clients requiring attention', { agentId, filters });

      const query = {
        status: { $in: ['Pending', 'Under_Review'] },
        $or: [
          { 'verificationStatus.identity.verified': false },
          { 'verificationStatus.employment.verified': false },
          { 'verificationStatus.income.verified': false },
          { 'verificationStatus.documents.verified': false },
          { 'riskProfile.score': { $gt: 75 } } // High risk clients
        ],
        ...filters
      };

      if (agentId) {
        query.assignedAgent = agentId;
      }

      const defaultOptions = {
        populate: [
          { path: 'assignedAgent', select: 'name email role' },
          { path: 'region', select: 'name code' }
        ],
        sort: { 'riskProfile.score': -1, createdAt: 1 }
      };

      return await this.find(query, { ...defaultOptions, ...options });
    } catch (error) {
      logger.error('Error finding clients requiring attention', error, { agentId, filters });
      throw error;
    }
  }

  /**
   * Get client assignment history
   * @param {String} clientId - Client ID
   * @returns {Promise<Object>} Client with assignment history
   */
  async getAssignmentHistory(clientId) {
    try {
      logger.debug('Getting client assignment history', { clientId });

      const client = await this.findById(clientId, {
        populate: [
          { path: 'assignedAgent', select: 'name email role' },
          { path: 'assignedBy', select: 'name email role' },
          { path: 'assignmentHistory.agent', select: 'name email role' },
          { path: 'assignmentHistory.assignedBy', select: 'name email role' }
        ]
      });

      if (!client) {
        throw new AppError('Client not found', 404, 'CLIENT_NOT_FOUND');
      }

      return client;
    } catch (error) {
      logger.error('Error getting client assignment history', error, { clientId });
      throw error;
    }
  }

  /**
   * Get clients by risk level
   * @param {String} riskLevel - Risk level (low, medium, high, very_high)
   * @param {Object} filters - Additional filters
   * @param {Object} options - Query options
   * @returns {Promise<Array>} Clients with specified risk level
   */
  async findByRiskLevel(riskLevel, filters = {}, options = {}) {
    try {
      logger.debug('Finding clients by risk level', { riskLevel, filters });

      const query = {
        'riskProfile.riskLevel': riskLevel,
        ...filters
      };

      const defaultOptions = {
        populate: [
          { path: 'assignedAgent', select: 'name email role' },
          { path: 'riskProfile.assessedBy', select: 'name email role' }
        ],
        sort: { 'riskProfile.score': -1 }
      };

      return await this.find(query, { ...defaultOptions, ...options });
    } catch (error) {
      logger.error('Error finding clients by risk level', error, { riskLevel, filters });
      throw error;
    }
  }
}

module.exports = ClientRepository;