/**
 * @fileoverview Cache Warmup Service - Pre-populates cache with frequently accessed data
 * @module services/cacheWarmupService
 */

const cacheService = require('./cacheService');
const { CacheWarmer } = require('../middlewares/cacheMiddleware');
const Loan = require('../models/Loan');
const Client = require('../models/Client');
const Staff = require('../models/Staff');
const Region = require('../models/Region');
const {
  loanStatsPipeline,
  portfolioSummaryPipeline,
  regionalDistributionPipeline
} = require('../utils/aggregationPipelines');
const { logger } = require('../utils/logger');

/**
 * Cache Warmup Service Class
 * Handles pre-population of cache with frequently accessed data
 */
class CacheWarmupService {
  constructor() {
    this.warmer = new CacheWarmer();
    this.isWarming = false;
    this.lastWarmupTime = null;
    this.warmupInterval = null;
  }

  /**
   * Initialize cache warmup service
   * @async
   * @returns {Promise<void>}
   */
  async initialize() {
    try {
      logger.info('Initializing cache warmup service');

      // Check if cache service is available
      if (!cacheService.isConnected) {
        logger.info('Cache service not available, skipping warmup initialization');
        return;
      }

      // Add warmup tasks
      this.addWarmupTasks();

      // Perform initial warmup
      await this.performWarmup();

      // Schedule periodic warmup (every 30 minutes)
      this.schedulePeriodicWarmup(30 * 60 * 1000);

      logger.info('Cache warmup service initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize cache warmup service', {
        error: error.message,
        stack: error.stack
      });
    }
  }

  /**
   * Add warmup tasks for frequently accessed data
   */
  addWarmupTasks() {
    // Global loan statistics
    this.warmer.addTask(
      'global-loan-stats',
      async () => {
        const pipeline = loanStatsPipeline({});
        const result = await Loan.aggregate(pipeline);
        return result.length > 0 ? result[0] : { statuses: [], totalLoans: 0, grandTotalAmount: 0 };
      },
      300 // 5 minutes TTL
    );

    // Global portfolio summary
    this.warmer.addTask(
      'global-portfolio-summary',
      async () => {
        const pipeline = portfolioSummaryPipeline({});
        const result = await Loan.aggregate(pipeline);
        return result.length > 0 ? result[0] : {};
      },
      1800 // 30 minutes TTL
    );

    // Regional distribution
    this.warmer.addTask(
      'regional-distribution',
      async () => {
        const pipeline = regionalDistributionPipeline({});
        return await Loan.aggregate(pipeline);
      },
      900 // 15 minutes TTL
    );

    // Active regions list
    this.warmer.addTask(
      'active-regions',
      async () => {
        return await Region.find({ isActive: true })
          .select('name code districts')
          .lean();
      },
      3600 // 1 hour TTL
    );

    // Loan status counts by region
    this.warmer.addTask(
      'loan-status-by-region',
      async () => {
        return await Loan.aggregate([
          {
            $group: {
              _id: {
                region: '$region',
                status: '$loanStatus'
              },
              count: { $sum: 1 },
              totalAmount: { $sum: '$loanAmount' }
            }
          },
          {
            $lookup: {
              from: 'regions',
              localField: '_id.region',
              foreignField: '_id',
              as: 'regionInfo'
            }
          },
          {
            $unwind: {
              path: '$regionInfo',
              preserveNullAndEmptyArrays: true
            }
          },
          {
            $project: {
              regionName: '$regionInfo.name',
              status: '$_id.status',
              count: 1,
              totalAmount: 1
            }
          }
        ]);
      },
      600 // 10 minutes TTL
    );

    // Top performing agents (last 30 days)
    this.warmer.addTask(
      'top-agents-30d',
      async () => {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        return await Loan.aggregate([
          {
            $match: {
              createdAt: { $gte: thirtyDaysAgo },
              'agentReview.reviewedBy': { $exists: true }
            }
          },
          {
            $group: {
              _id: '$agentReview.reviewedBy',
              totalApplications: { $sum: 1 },
              approvedLoans: {
                $sum: {
                  $cond: [
                    { $in: ['$loanStatus', ['Approved', 'Active', 'Completed']] },
                    1,
                    0
                  ]
                }
              },
              totalAmount: { $sum: '$loanAmount' }
            }
          },
          {
            $lookup: {
              from: 'staff',
              localField: '_id',
              foreignField: '_id',
              as: 'agent'
            }
          },
          {
            $unwind: '$agent'
          },
          {
            $addFields: {
              approvalRate: {
                $multiply: [
                  { $divide: ['$approvedLoans', '$totalApplications'] },
                  100
                ]
              }
            }
          },
          {
            $sort: { totalApplications: -1 }
          },
          {
            $limit: 10
          },
          {
            $project: {
              agentName: '$agent.name',
              agentEmail: '$agent.email',
              totalApplications: 1,
              approvedLoans: 1,
              totalAmount: 1,
              approvalRate: 1
            }
          }
        ]);
      },
      1800 // 30 minutes TTL
    );

    // Recent loan applications (last 24 hours)
    this.warmer.addTask(
      'recent-loans-24h',
      async () => {
        const twentyFourHoursAgo = new Date();
        twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);

        return await Loan.find({
          createdAt: { $gte: twentyFourHoursAgo }
        })
          .populate('clientUserId', 'personalInfo.fullName personalInfo.district')
          .populate('agentReview.reviewedBy', 'name email')
          .select('loanApplicationId loanAmount loanStatus createdAt')
          .sort({ createdAt: -1 })
          .limit(50)
          .lean();
      },
      300 // 5 minutes TTL
    );

    // Client statistics by status
    this.warmer.addTask(
      'client-stats-by-status',
      async () => {
        return await Client.aggregate([
          {
            $group: {
              _id: '$status',
              count: { $sum: 1 }
            }
          },
          {
            $sort: { count: -1 }
          }
        ]);
      },
      600 // 10 minutes TTL
    );

    // Monthly application trends (last 12 months)
    this.warmer.addTask(
      'monthly-trends-12m',
      async () => {
        const twelveMonthsAgo = new Date();
        twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

        return await Loan.aggregate([
          {
            $match: {
              createdAt: { $gte: twelveMonthsAgo }
            }
          },
          {
            $group: {
              _id: {
                year: { $year: '$createdAt' },
                month: { $month: '$createdAt' }
              },
              applicationCount: { $sum: 1 },
              totalAmount: { $sum: '$loanAmount' },
              approvedCount: {
                $sum: {
                  $cond: [
                    { $in: ['$loanStatus', ['Approved', 'Active', 'Completed']] },
                    1,
                    0
                  ]
                }
              }
            }
          },
          {
            $addFields: {
              monthYear: {
                $dateFromParts: {
                  year: '$_id.year',
                  month: '$_id.month',
                  day: 1
                }
              }
            }
          },
          {
            $sort: { monthYear: 1 }
          }
        ]);
      },
      3600 // 1 hour TTL
    );
  }

  /**
   * Perform cache warmup
   * @async
   * @returns {Promise<void>}
   */
  async performWarmup() {
    if (this.isWarming) {
      logger.warn('Cache warmup already in progress, skipping');
      return;
    }

    try {
      this.isWarming = true;
      logger.info('Starting cache warmup');

      const startTime = Date.now();
      await this.warmer.warmup();
      const duration = Date.now() - startTime;

      this.lastWarmupTime = new Date();

      logger.info('Cache warmup completed', {
        duration: `${duration}ms`,
        completedAt: this.lastWarmupTime.toISOString()
      });
    } catch (error) {
      logger.error('Cache warmup failed', {
        error: error.message,
        stack: error.stack
      });
    } finally {
      this.isWarming = false;
    }
  }

  /**
   * Schedule periodic cache warmup
   * @param {number} intervalMs - Interval in milliseconds
   */
  schedulePeriodicWarmup(intervalMs) {
    if (this.warmupInterval) {
      clearInterval(this.warmupInterval);
    }

    this.warmupInterval = setInterval(async () => {
      logger.debug('Scheduled cache warmup starting');
      await this.performWarmup();
    }, intervalMs);

    logger.info('Periodic cache warmup scheduled', {
      intervalMinutes: intervalMs / (1000 * 60)
    });
  }

  /**
   * Warm specific cache keys on demand
   * @async
   * @param {Array<string>} keys - Cache keys to warm
   * @returns {Promise<void>}
   */
  async warmSpecificKeys(keys) {
    try {
      logger.info('Warming specific cache keys', { keys });

      const tasks = this.warmer.warmupTasks.filter(task =>
        keys.includes(task.key)
      );

      if (tasks.length === 0) {
        logger.warn('No matching warmup tasks found', { keys });
        return;
      }

      const results = await Promise.allSettled(
        tasks.map(async (task) => {
          try {
            const data = await task.dataProvider();
            await cacheService.set(task.key, data, task.ttl);
            return { key: task.key, success: true };
          } catch (error) {
            logger.error('Specific cache warmup failed', {
              key: task.key,
              error: error.message
            });
            return { key: task.key, success: false, error: error.message };
          }
        })
      );

      const successful = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
      logger.info('Specific cache warmup completed', {
        requested: keys.length,
        found: tasks.length,
        successful
      });
    } catch (error) {
      logger.error('Specific cache warmup error', {
        error: error.message,
        keys
      });
    }
  }

  /**
   * Get warmup service status
   * @returns {Object} Service status
   */
  getStatus() {
    return {
      isWarming: this.isWarming,
      lastWarmupTime: this.lastWarmupTime,
      scheduledInterval: this.warmupInterval ? true : false,
      totalTasks: this.warmer.warmupTasks.length,
      taskKeys: this.warmer.warmupTasks.map(task => task.key)
    };
  }

  /**
   * Stop the warmup service
   */
  stop() {
    if (this.warmupInterval) {
      clearInterval(this.warmupInterval);
      this.warmupInterval = null;
    }
    logger.info('Cache warmup service stopped');
  }
}

// Create singleton instance
const cacheWarmupService = new CacheWarmupService();

module.exports = cacheWarmupService;