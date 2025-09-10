/**
 * Loan Repository
 * Handles loan-specific database operations with regional filtering and aggregations
 */

const BaseRepository = require("./BaseRepository");
const Loan = require("../models/Loan");
const { AppError } = require("../utils/customErrors");
const { logger } = require("../utils/logger");
const mongoose = require("mongoose");

class LoanRepository extends BaseRepository {
  constructor() {
    super(Loan);
  }

  /**
   * Find loans by region with filtering and pagination
   * @param {String} regionId - Region ID
   * @param {Object} filters - Additional filters
   * @param {Object} options - Query options
   * @returns {Promise<Object>} Paginated loans
   */
  async findByRegion(regionId, filters = {}, options = {}) {
    try {
      logger.debug("Finding loans by region", { regionId, filters });

      const query = {
        region: regionId,
        ...filters,
      };

      const defaultOptions = {
        populate: [
          {
            path: "clientUserId",
            select: "personalInfo registrationId status",
          },
          { path: "assignedAgent", select: "name email role" },
          { path: "assignedRegionalManager", select: "name email role" },
          { path: "agentReview.reviewedBy", select: "name email" },
          { path: "regionalAdminApproval.approvedBy", select: "name email" },
        ],
        sort: { createdAt: -1 },
      };

      const mergedOptions = { ...defaultOptions, ...options };

      if (options.page && options.limit) {
        return await this.paginate(query, mergedOptions);
      }

      return await this.find(query, mergedOptions);
    } catch (error) {
      logger.error("Error finding loans by region", error, {
        regionId,
        filters,
      });
      throw error;
    }
  }

  /**
   * Find loans by agent with status filtering
   * @param {String} agentId - Agent ID
   * @param {Object} filters - Additional filters
   * @param {Object} options - Query options
   * @returns {Promise<Array>} Agent's loans
   */
  async findByAgent(agentId, filters = {}, options = {}) {
    try {
      logger.debug("Finding loans by agent", { agentId, filters });

      const query = {
        assignedAgent: agentId,
        ...filters,
      };

      const defaultOptions = {
        populate: [
          {
            path: "clientUserId",
            select: "personalInfo registrationId status",
          },
          { path: "regionalAdminApproval.approvedBy", select: "name email" },
        ],
        sort: { createdAt: -1 },
      };

      return await this.find(query, { ...defaultOptions, ...options });
    } catch (error) {
      logger.error("Error finding loans by agent", error, { agentId, filters });
      throw error;
    }
  }

  /**
   * Find loans by regional manager for approval
   * @param {String} regionalManagerId - Regional Manager ID
   * @param {Object} filters - Additional filters
   * @param {Object} options - Query options
   * @returns {Promise<Array>} Loans for approval
   */
  async findForRegionalApproval(regionalManagerId, filters = {}, options = {}) {
    try {
      logger.debug("Finding loans for regional approval", {
        regionalManagerId,
        filters,
      });

      const query = {
        assignedRegionalManager: regionalManagerId,
        "agentReview.status": "Approved",
        "regionalAdminApproval.status": { $in: ["Pending", undefined] },
        ...filters,
      };

      const defaultOptions = {
        populate: [
          {
            path: "clientUserId",
            select: "personalInfo registrationId status verificationStatus",
          },
          { path: "assignedAgent", select: "name email role" },
          { path: "agentReview.reviewedBy", select: "name email" },
        ],
        sort: { "agentReview.reviewDate": 1 }, // Oldest first for FIFO processing
      };

      return await this.find(query, { ...defaultOptions, ...options });
    } catch (error) {
      logger.error("Error finding loans for regional approval", error, {
        regionalManagerId,
        filters,
      });
      throw error;
    }
  }

  /**
   * Get loan statistics by region
   * @param {String} regionId - Region ID
   * @param {Object} dateRange - Date range filter
   * @returns {Promise<Object>} Loan statistics
   */
  async getRegionalStatistics(regionId, dateRange = {}) {
    try {
      logger.debug("Getting regional loan statistics", { regionId, dateRange });

      const matchStage = { region: new mongoose.Types.ObjectId(regionId) };

      if (dateRange.startDate || dateRange.endDate) {
        matchStage.createdAt = {};
        if (dateRange.startDate)
          matchStage.createdAt.$gte = new Date(dateRange.startDate);
        if (dateRange.endDate)
          matchStage.createdAt.$lte = new Date(dateRange.endDate);
      }

      const pipeline = [
        { $match: matchStage },
        {
          $group: {
            _id: null,
            totalLoans: { $sum: 1 },
            totalAmount: { $sum: "$loanAmount" },
            averageAmount: { $avg: "$loanAmount" },
            statusBreakdown: {
              $push: "$loanStatus",
            },
            workflowStageBreakdown: {
              $push: "$workflowState.currentStage",
            },
          },
        },
        {
          $project: {
            _id: 0,
            totalLoans: 1,
            totalAmount: 1,
            averageAmount: { $round: ["$averageAmount", 2] },
            statusCounts: {
              $reduce: {
                input: "$statusBreakdown",
                initialValue: {},
                in: {
                  $mergeObjects: [
                    "$$value",
                    {
                      $arrayToObject: [
                        [
                          {
                            k: "$$this",
                            v: {
                              $add: [
                                {
                                  $ifNull: [
                                    {
                                      $getField: {
                                        field: "$$this",
                                        input: "$$value",
                                      },
                                    },
                                    0,
                                  ],
                                },
                                1,
                              ],
                            },
                          },
                        ],
                      ],
                    },
                  ],
                },
              },
            },
            workflowStageCounts: {
              $reduce: {
                input: "$workflowStageBreakdown",
                initialValue: {},
                in: {
                  $mergeObjects: [
                    "$$value",
                    {
                      $arrayToObject: [
                        [
                          {
                            k: "$$this",
                            v: {
                              $add: [
                                {
                                  $ifNull: [
                                    {
                                      $getField: {
                                        field: "$$this",
                                        input: "$$value",
                                      },
                                    },
                                    0,
                                  ],
                                },
                                1,
                              ],
                            },
                          },
                        ],
                      ],
                    },
                  ],
                },
              },
            },
          },
        },
      ];

      const result = await this.aggregate(pipeline);
      return (
        result[0] || {
          totalLoans: 0,
          totalAmount: 0,
          averageAmount: 0,
          statusCounts: {},
          workflowStageCounts: {},
        }
      );
    } catch (error) {
      logger.error("Error getting regional loan statistics", error, {
        regionId,
        dateRange,
      });
      throw error;
    }
  }

  /**
   * Get agent loan statistics
   * @param {String} agentId - Agent ID
   * @param {Object} dateRange - Date range filter
   * @returns {Promise<Object>} Agent loan statistics
   */
  async getAgentLoanStats(agentId, dateRange = {}) {
    try {
      logger.debug("Getting agent loan statistics", { agentId, dateRange });

      const matchStage = {
        assignedAgent: new mongoose.Types.ObjectId(agentId),
      };

      if (dateRange.startDate || dateRange.endDate) {
        matchStage.createdAt = {};
        if (dateRange.startDate)
          matchStage.createdAt.$gte = new Date(dateRange.startDate);
        if (dateRange.endDate)
          matchStage.createdAt.$lte = new Date(dateRange.endDate);
      }

      const pipeline = [
        { $match: matchStage },
        {
          $group: {
            _id: null,
            totalLoans: { $sum: 1 },
            totalLoanValue: { $sum: "$loanAmount" },
            averageLoanAmount: { $avg: "$loanAmount" },
            approvedLoans: {
              $sum: {
                $cond: [
                  { $in: ["$loanStatus", ["Approved", "Active", "Completed"]] },
                  1,
                  0,
                ],
              },
            },
            rejectedLoans: {
              $sum: { $cond: [{ $eq: ["$loanStatus", "Rejected"] }, 1, 0] },
            },
            pendingLoans: {
              $sum: {
                $cond: [
                  { $in: ["$loanStatus", ["Pending", "Under Review"]] },
                  1,
                  0,
                ],
              },
            },
            totalCommissionEarned: {
              $sum: {
                $cond: [
                  { $in: ["$loanStatus", ["Approved", "Active", "Completed"]] },
                  { $multiply: ["$loanAmount", 0.02] }, // 2% commission
                  0,
                ],
              },
            },
            averageProcessingTime: {
              $avg: {
                $cond: [
                  { $and: ["$agentReview.reviewDate", "$createdAt"] },
                  { $subtract: ["$agentReview.reviewDate", "$createdAt"] },
                  null,
                ],
              },
            },
          },
        },
        {
          $project: {
            _id: 0,
            totalLoans: 1,
            totalLoanValue: { $round: ["$totalLoanValue", 2] },
            averageLoanAmount: { $round: ["$averageLoanAmount", 2] },
            approvedLoans: 1,
            rejectedLoans: 1,
            pendingLoans: 1,
            approvalRate: {
              $round: [
                {
                  $cond: [
                    { $gt: ["$totalLoans", 0] },
                    {
                      $multiply: [
                        { $divide: ["$approvedLoans", "$totalLoans"] },
                        100,
                      ],
                    },
                    0,
                  ],
                },
                2,
              ],
            },
            totalCommissionEarned: { $round: ["$totalCommissionEarned", 2] },
            averageCommissionPerLoan: {
              $round: [
                {
                  $cond: [
                    { $gt: ["$approvedLoans", 0] },
                    { $divide: ["$totalCommissionEarned", "$approvedLoans"] },
                    0,
                  ],
                },
                2,
              ],
            },
            averageProcessingTime: {
              $round: [
                {
                  $cond: [
                    { $ne: ["$averageProcessingTime", null] },
                    {
                      $divide: ["$averageProcessingTime", 1000 * 60 * 60 * 24],
                    }, // Convert to days
                    0,
                  ],
                },
                2,
              ],
            },
          },
        },
      ];

      // Add period-specific statistics
      const periodMatchStage = {
        assignedAgent: new mongoose.Types.ObjectId(agentId),
      };
      if (dateRange.startDate && dateRange.endDate) {
        periodMatchStage.createdAt = {
          $gte: new Date(dateRange.startDate),
          $lte: new Date(dateRange.endDate),
        };
      }

      const periodPipeline = [
        { $match: periodMatchStage },
        {
          $group: {
            _id: null,
            loansInPeriod: { $sum: 1 },
            commissionInPeriod: {
              $sum: {
                $cond: [
                  { $in: ["$loanStatus", ["Approved", "Active", "Completed"]] },
                  { $multiply: ["$loanAmount", 0.02] },
                  0,
                ],
              },
            },
          },
        },
      ];

      // Get status counts separately
      const statusCountsPipeline = [
        { $match: matchStage },
        {
          $group: {
            _id: "$loanStatus",
            count: { $sum: 1 },
          },
        },
      ];

      const [mainResult, periodResult, statusCountsResult] = await Promise.all([
        this.aggregate(pipeline),
        this.aggregate(periodPipeline),
        this.aggregate(statusCountsPipeline),
      ]);

      // Convert status counts array to object
      const statusCounts = {};
      statusCountsResult.forEach((item) => {
        statusCounts[item._id] = item.count;
      });

      const stats = mainResult[0] || {
        totalLoans: 0,
        totalLoanValue: 0,
        averageLoanAmount: 0,
        approvedLoans: 0,
        rejectedLoans: 0,
        pendingLoans: 0,
        approvalRate: 0,
        totalCommissionEarned: 0,
        averageCommissionPerLoan: 0,
        averageProcessingTime: 0,
      };

      const periodStats = periodResult[0] || {
        loansInPeriod: 0,
        commissionInPeriod: 0,
      };

      return { ...stats, ...periodStats, statusCounts };
    } catch (error) {
      logger.error("Error getting agent loan statistics", error, {
        agentId,
        dateRange,
      });
      throw error;
    }
  }

  /**
   * Get agent performance statistics
   * @param {String} agentId - Agent ID
   * @param {Object} dateRange - Date range filter
   * @returns {Promise<Object>} Agent performance stats
   */
  async getAgentPerformanceStats(agentId, dateRange = {}) {
    try {
      logger.debug("Getting agent performance statistics", {
        agentId,
        dateRange,
      });

      const matchStage = {
        assignedAgent: new mongoose.Types.ObjectId(agentId),
      };

      if (dateRange.startDate || dateRange.endDate) {
        matchStage.createdAt = {};
        if (dateRange.startDate)
          matchStage.createdAt.$gte = new Date(dateRange.startDate);
        if (dateRange.endDate)
          matchStage.createdAt.$lte = new Date(dateRange.endDate);
      }

      const pipeline = [
        // Ensure createdAt is a Date object to handle string dates from legacy data
        {
          $addFields: {
            createdAt: {
              $cond: {
                if: { $eq: [{ $type: "$createdAt" }, "string"] },
                then: { $dateFromString: { dateString: "$createdAt" } },
                else: "$createdAt",
              },
            },
          },
        },
        { $match: matchStage },
        {
          $group: {
            _id: null,
            totalApplications: { $sum: 1 },
            totalAmount: { $sum: "$loanAmount" },
            averageAmount: { $avg: "$loanAmount" },
            approvedLoans: {
              $sum: {
                $cond: [{ $eq: ["$loanStatus", "Approved"] }, 1, 0],
              },
            },
            rejectedLoans: {
              $sum: {
                $cond: [{ $eq: ["$loanStatus", "Rejected"] }, 1, 0],
              },
            },
            pendingLoans: {
              $sum: {
                $cond: [
                  { $in: ["$loanStatus", ["Pending", "Under Review"]] },
                  1,
                  0,
                ],
              },
            },
            averageProcessingTime: {
              $avg: {
                $subtract: [
                  {
                    $ifNull: [
                      "$regionalAdminApproval.approvalDate",
                      "$agentReview.reviewDate",
                    ],
                  },
                  "$createdAt",
                ],
              },
            },
          },
        },
        {
          $project: {
            _id: 0,
            totalApplications: 1,
            totalAmount: 1,
            averageAmount: { $round: ["$averageAmount", 2] },
            approvedLoans: 1,
            rejectedLoans: 1,
            pendingLoans: 1,
            approvalRate: {
              $round: [
                {
                  $multiply: [
                    { $divide: ["$approvedLoans", "$totalApplications"] },
                    100,
                  ],
                },
                2,
              ],
            },
            averageProcessingTimeHours: {
              $round: [
                { $divide: ["$averageProcessingTime", 1000 * 60 * 60] },
                2,
              ],
            },
          },
        },
      ];

      const result = await this.aggregate(pipeline);
      return (
        result[0] || {
          totalApplications: 0,
          totalAmount: 0,
          averageAmount: 0,
          approvedLoans: 0,
          rejectedLoans: 0,
          pendingLoans: 0,
          approvalRate: 0,
          averageProcessingTimeHours: 0,
        }
      );
    } catch (error) {
      logger.error("Error getting agent performance statistics", error, {
        agentId,
        dateRange,
      });
      throw error;
    }
  }

  /**
   * Get loans by workflow stage
   * @param {String} stage - Workflow stage
   * @param {Object} filters - Additional filters
   * @param {Object} options - Query options
   * @returns {Promise<Array>} Loans in specified stage
   */
  async findByWorkflowStage(stage, filters = {}, options = {}) {
    try {
      logger.debug("Finding loans by workflow stage", { stage, filters });

      const query = {
        "workflowState.currentStage": stage,
        ...filters,
      };

      const defaultOptions = {
        populate: [
          {
            path: "clientUserId",
            select: "personalInfo registrationId status",
          },
          { path: "assignedAgent", select: "name email role" },
          { path: "assignedRegionalManager", select: "name email role" },
        ],
        sort: { "workflowState.stageHistory.enteredAt": 1 },
      };

      return await this.find(query, { ...defaultOptions, ...options });
    } catch (error) {
      logger.error("Error finding loans by workflow stage", error, {
        stage,
        filters,
      });
      throw error;
    }
  }

  /**
   * Get overdue loans
   * @param {Object} filters - Additional filters
   * @param {Object} options - Query options
   * @returns {Promise<Array>} Overdue loans
   */
  async findOverdueLoans(filters = {}, options = {}) {
    try {
      logger.debug("Finding overdue loans", { filters });

      const query = {
        loanStatus: "Active",
        "calculatedFields.daysOverdue": { $gt: 0 },
        ...filters,
      };

      const defaultOptions = {
        populate: [
          {
            path: "clientUserId",
            select: "personalInfo registrationId status",
          },
          { path: "assignedAgent", select: "name email role" },
        ],
        sort: { "calculatedFields.daysOverdue": -1 },
      };

      return await this.find(query, { ...defaultOptions, ...options });
    } catch (error) {
      logger.error("Error finding overdue loans", error, { filters });
      throw error;
    }
  }

  /**
   * Get loan trends over time
   * @param {String} regionId - Region ID (optional)
   * @param {String} period - Period (daily, weekly, monthly)
   * @param {Object} dateRange - Date range
   * @returns {Promise<Array>} Loan trends
   */
  async getLoanTrends(regionId = null, period = "monthly", dateRange = {}) {
    try {
      logger.debug("Getting loan trends", { regionId, period, dateRange });

      const matchStage = {};
      if (regionId) matchStage.region = new mongoose.Types.ObjectId(regionId);

      if (dateRange.startDate || dateRange.endDate) {
        matchStage.createdAt = {};
        if (dateRange.startDate)
          matchStage.createdAt.$gte = new Date(dateRange.startDate);
        if (dateRange.endDate)
          matchStage.createdAt.$lte = new Date(dateRange.endDate);
      }

      const dateGrouping = {
        daily: {
          year: { $year: "$createdAt" },
          month: { $month: "$createdAt" },
          day: { $dayOfMonth: "$createdAt" },
        },
        weekly: {
          year: { $year: "$createdAt" },
          week: { $week: "$createdAt" },
        },
        monthly: {
          year: { $year: "$createdAt" },
          month: { $month: "$createdAt" },
        },
      };

      const pipeline = [
        { $match: matchStage },
        {
          $group: {
            _id: dateGrouping[period],
            totalLoans: { $sum: 1 },
            totalAmount: { $sum: "$loanAmount" },
            averageAmount: { $avg: "$loanAmount" },
            approvedCount: {
              $sum: { $cond: [{ $eq: ["$loanStatus", "Approved"] }, 1, 0] },
            },
            rejectedCount: {
              $sum: { $cond: [{ $eq: ["$loanStatus", "Rejected"] }, 1, 0] },
            },
          },
        },
        {
          $project: {
            _id: 1,
            totalLoans: 1,
            totalAmount: 1,
            averageAmount: { $round: ["$averageAmount", 2] },
            approvedCount: 1,
            rejectedCount: 1,
            approvalRate: {
              $round: [
                {
                  $multiply: [
                    { $divide: ["$approvedCount", "$totalLoans"] },
                    100,
                  ],
                },
                2,
              ],
            },
          },
        },
        {
          $sort: { "_id.year": 1, "_id.month": 1, "_id.day": 1, "_id.week": 1 },
        },
      ];

      return await this.aggregate(pipeline);
    } catch (error) {
      logger.error("Error getting loan trends", error, {
        regionId,
        period,
        dateRange,
      });
      throw error;
    }
  }

  /**
   * Search loans with text search
   * @param {String} searchText - Search text
   * @param {Object} filters - Additional filters
   * @param {Object} options - Query options
   * @returns {Promise<Array>} Search results
   */
  async searchLoans(searchText, filters = {}, options = {}) {
    try {
      logger.debug("Searching loans", { searchText, filters });

      const query = {
        $text: { $search: searchText },
        ...filters,
      };

      const defaultOptions = {
        populate: [
          {
            path: "clientUserId",
            select: "personalInfo registrationId status",
          },
          { path: "assignedAgent", select: "name email role" },
        ],
        sort: { score: { $meta: "textScore" } },
      };

      return await this.find(query, { ...defaultOptions, ...options });
    } catch (error) {
      logger.error("Error searching loans", error, { searchText, filters });
      throw error;
    }
  }

  /**
   * Update loan workflow stage
   * @param {String} loanId - Loan ID
   * @param {String} newStage - New workflow stage
   * @param {String} performedBy - User performing the action
   * @param {String} notes - Optional notes
   * @returns {Promise<Object>} Updated loan
   */
  async updateWorkflowStage(loanId, newStage, performedBy, notes = "") {
    try {
      logger.info("Updating loan workflow stage", {
        loanId,
        newStage,
        performedBy,
      });

      const loan = await this.findById(loanId);
      if (!loan) {
        throw new AppError("Loan not found", 404, "LOAN_NOT_FOUND");
      }

      loan.advanceWorkflowStage(newStage, performedBy, notes);
      await loan.save();

      logger.info("Loan workflow stage updated successfully", {
        loanId,
        newStage,
        performedBy,
      });

      return loan;
    } catch (error) {
      logger.error("Error updating loan workflow stage", error, {
        loanId,
        newStage,
        performedBy,
      });
      throw error;
    }
  }

  /**
   * Get dashboard statistics for regional manager
   * @param {String} regionalManagerId - Regional Manager ID
   * @returns {Promise<Object>} Dashboard statistics
   */
  async getRegionalManagerDashboardStats(regionalManagerId) {
    try {
      logger.debug("Getting regional manager dashboard stats", {
        regionalManagerId,
      });

      const pipeline = [
        {
          $match: {
            assignedRegionalManager: new mongoose.Types.ObjectId(
              regionalManagerId
            ),
          },
        },
        {
          $facet: {
            statusStats: [
              {
                $group: {
                  _id: "$loanStatus",
                  count: { $sum: 1 },
                  totalAmount: { $sum: "$loanAmount" },
                },
              },
            ],
            workflowStats: [
              {
                $group: {
                  _id: "$workflowState.currentStage",
                  count: { $sum: 1 },
                },
              },
            ],
            pendingApprovals: [
              {
                $match: {
                  "agentReview.status": "Approved",
                  "regionalAdminApproval.status": { $in: ["Pending", null] },
                },
              },
              { $count: "count" },
            ],
            monthlyTrends: [
              {
                $match: {
                  createdAt: {
                    $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
                  },
                },
              },
              {
                $group: {
                  _id: {
                    year: { $year: "$createdAt" },
                    month: { $month: "$createdAt" },
                    day: { $dayOfMonth: "$createdAt" },
                  },
                  count: { $sum: 1 },
                  amount: { $sum: "$loanAmount" },
                },
              },
              { $sort: { "_id.year": 1, "_id.month": 1, "_id.day": 1 } },
            ],
          },
        },
      ];

      const result = await this.aggregate(pipeline);
      return (
        result[0] || {
          statusStats: [],
          workflowStats: [],
          pendingApprovals: [{ count: 0 }],
          monthlyTrends: [],
        }
      );
    } catch (error) {
      logger.error("Error getting regional manager dashboard stats", error, {
        regionalManagerId,
      });
      throw error;
    }
  }
}

module.exports = LoanRepository;
