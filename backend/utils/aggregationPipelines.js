/**
 * @fileoverview Optimized MongoDB Aggregation Pipelines
 * @module utils/aggregationPipelines
 */

const mongoose = require('mongoose');

/**
 * Loan Statistics Aggregation Pipeline
 * Efficiently calculates loan statistics by status and region
 * @param {Object} filters - Filter criteria
 * @param {string} [filters.region] - Region ID to filter by
 * @param {string} [filters.agentId] - Agent ID to filter by
 * @param {Date} [filters.startDate] - Start date for filtering
 * @param {Date} [filters.endDate] - End date for filtering
 * @returns {Array} Aggregation pipeline
 */
const loanStatsPipeline = (filters = {}) => {
  const pipeline = [];

  // Match stage - filter documents early
  const matchStage = {};

  if (filters.region) {
    matchStage.region = new mongoose.Types.ObjectId(filters.region);
  }

  if (filters.agentId) {
    matchStage['agentReview.reviewedBy'] = new mongoose.Types.ObjectId(filters.agentId);
  }

  if (filters.startDate || filters.endDate) {
    matchStage.createdAt = {};
    if (filters.startDate) {
      matchStage.createdAt.$gte = filters.startDate;
    }
    if (filters.endDate) {
      matchStage.createdAt.$lte = filters.endDate;
    }
  }

  if (Object.keys(matchStage).length > 0) {
    pipeline.push({ $match: matchStage });
  }

  // Group by status and calculate statistics
  pipeline.push({
    $group: {
      _id: '$loanStatus',
      count: { $sum: 1 },
      totalAmount: { $sum: '$loanAmount' },
      avgAmount: { $avg: '$loanAmount' },
      minAmount: { $min: '$loanAmount' },
      maxAmount: { $max: '$loanAmount' }
    }
  });

  // Sort by count descending
  pipeline.push({
    $sort: { count: -1 }
  });

  // Add total summary
  pipeline.push({
    $group: {
      _id: null,
      statuses: {
        $push: {
          status: '$_id',
          count: '$count',
          totalAmount: '$totalAmount',
          avgAmount: '$avgAmount',
          minAmount: '$minAmount',
          maxAmount: '$maxAmount'
        }
      },
      totalLoans: { $sum: '$count' },
      grandTotalAmount: { $sum: '$totalAmount' }
    }
  });

  return pipeline;
};

/**
 * Agent Performance Aggregation Pipeline
 * Calculates comprehensive agent performance metrics
 * @param {Object} filters - Filter criteria
 * @param {string} [filters.region] - Region ID to filter by
 * @param {Date} [filters.startDate] - Start date for filtering
 * @param {Date} [filters.endDate] - End date for filtering
 * @returns {Array} Aggregation pipeline
 */
const agentPerformancePipeline = (filters = {}) => {
  const pipeline = [];

  // Match stage
  const matchStage = {};

  if (filters.region) {
    matchStage.region = new mongoose.Types.ObjectId(filters.region);
  }

  if (filters.startDate || filters.endDate) {
    matchStage.createdAt = {};
    if (filters.startDate) {
      matchStage.createdAt.$gte = filters.startDate;
    }
    if (filters.endDate) {
      matchStage.createdAt.$lte = filters.endDate;
    }
  }

  if (Object.keys(matchStage).length > 0) {
    pipeline.push({ $match: matchStage });
  }

  // Lookup agent information
  pipeline.push({
    $lookup: {
      from: 'staff',
      localField: 'agentReview.reviewedBy',
      foreignField: '_id',
      as: 'agent'
    }
  });

  // Unwind agent array
  pipeline.push({
    $unwind: {
      path: '$agent',
      preserveNullAndEmptyArrays: false
    }
  });

  // Group by agent and calculate metrics
  pipeline.push({
    $group: {
      _id: '$agent._id',
      agentName: { $first: '$agent.name' },
      agentEmail: { $first: '$agent.email' },
      region: { $first: '$agent.region' },
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
      rejectedLoans: {
        $sum: {
          $cond: [{ $eq: ['$loanStatus', 'Rejected'] }, 1, 0]
        }
      },
      pendingLoans: {
        $sum: {
          $cond: [{ $eq: ['$loanStatus', 'Pending'] }, 1, 0]
        }
      },
      totalLoanAmount: { $sum: '$loanAmount' },
      approvedLoanAmount: {
        $sum: {
          $cond: [
            { $in: ['$loanStatus', ['Approved', 'Active', 'Completed']] },
            '$loanAmount',
            0
          ]
        }
      },
      avgLoanAmount: { $avg: '$loanAmount' },
      avgProcessingTime: {
        $avg: {
          $cond: [
            { $and: ['$agentReview.reviewDate', '$createdAt'] },
            {
              $divide: [
                { $subtract: ['$agentReview.reviewDate', '$createdAt'] },
                1000 * 60 * 60 * 24 // Convert to days
              ]
            },
            null
          ]
        }
      }
    }
  });

  // Calculate approval rate and commission
  pipeline.push({
    $addFields: {
      approvalRate: {
        $cond: [
          { $gt: ['$totalApplications', 0] },
          {
            $multiply: [
              { $divide: ['$approvedLoans', '$totalApplications'] },
              100
            ]
          },
          0
        ]
      },
      estimatedCommission: {
        $multiply: ['$approvedLoanAmount', 0.02] // 2% commission
      }
    }
  });

  // Sort by total applications descending
  pipeline.push({
    $sort: { totalApplications: -1 }
  });

  return pipeline;
};

/**
 * Regional Loan Distribution Pipeline
 * Shows loan distribution across regions and districts
 * @param {Object} filters - Filter criteria
 * @param {Date} [filters.startDate] - Start date for filtering
 * @param {Date} [filters.endDate] - End date for filtering
 * @returns {Array} Aggregation pipeline
 */
const regionalDistributionPipeline = (filters = {}) => {
  const pipeline = [];

  // Match stage
  const matchStage = {};

  if (filters.startDate || filters.endDate) {
    matchStage.createdAt = {};
    if (filters.startDate) {
      matchStage.createdAt.$gte = filters.startDate;
    }
    if (filters.endDate) {
      matchStage.createdAt.$lte = filters.endDate;
    }
  }

  if (Object.keys(matchStage).length > 0) {
    pipeline.push({ $match: matchStage });
  }

  // Lookup client information for district
  pipeline.push({
    $lookup: {
      from: 'clients',
      localField: 'clientUserId',
      foreignField: '_id',
      as: 'client'
    }
  });

  // Unwind client array
  pipeline.push({
    $unwind: {
      path: '$client',
      preserveNullAndEmptyArrays: true
    }
  });

  // Lookup region information
  pipeline.push({
    $lookup: {
      from: 'regions',
      localField: 'region',
      foreignField: '_id',
      as: 'regionInfo'
    }
  });

  // Unwind region array
  pipeline.push({
    $unwind: {
      path: '$regionInfo',
      preserveNullAndEmptyArrays: true
    }
  });

  // Group by region and district
  pipeline.push({
    $group: {
      _id: {
        region: '$regionInfo.name',
        district: '$client.personalInfo.district'
      },
      loanCount: { $sum: 1 },
      totalAmount: { $sum: '$loanAmount' },
      avgAmount: { $avg: '$loanAmount' },
      statusBreakdown: {
        $push: '$loanStatus'
      }
    }
  });

  // Calculate status counts
  pipeline.push({
    $addFields: {
      approvedCount: {
        $size: {
          $filter: {
            input: '$statusBreakdown',
            cond: { $in: ['$$this', ['Approved', 'Active', 'Completed']] }
          }
        }
      },
      pendingCount: {
        $size: {
          $filter: {
            input: '$statusBreakdown',
            cond: { $eq: ['$$this', 'Pending'] }
          }
        }
      },
      rejectedCount: {
        $size: {
          $filter: {
            input: '$statusBreakdown',
            cond: { $eq: ['$$this', 'Rejected'] }
          }
        }
      }
    }
  });

  // Remove statusBreakdown array
  pipeline.push({
    $project: {
      statusBreakdown: 0
    }
  });

  // Sort by total amount descending
  pipeline.push({
    $sort: { totalAmount: -1 }
  });

  return pipeline;
};

/**
 * Monthly Loan Trends Pipeline
 * Shows loan application trends over time
 * @param {Object} filters - Filter criteria
 * @param {string} [filters.region] - Region ID to filter by
 * @param {number} [filters.months=12] - Number of months to include
 * @returns {Array} Aggregation pipeline
 */
const monthlyTrendsPipeline = (filters = {}) => {
  const pipeline = [];
  const months = filters.months || 12;

  // Calculate date range
  const endDate = new Date();
  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - months);

  // Match stage
  const matchStage = {
    createdAt: {
      $gte: startDate,
      $lte: endDate
    }
  };

  if (filters.region) {
    matchStage.region = new mongoose.Types.ObjectId(filters.region);
  }

  pipeline.push({ $match: matchStage });

  // Group by year and month
  pipeline.push({
    $group: {
      _id: {
        year: { $year: '$createdAt' },
        month: { $month: '$createdAt' }
      },
      applicationCount: { $sum: 1 },
      totalAmount: { $sum: '$loanAmount' },
      avgAmount: { $avg: '$loanAmount' },
      approvedCount: {
        $sum: {
          $cond: [
            { $in: ['$loanStatus', ['Approved', 'Active', 'Completed']] },
            1,
            0
          ]
        }
      },
      approvedAmount: {
        $sum: {
          $cond: [
            { $in: ['$loanStatus', ['Approved', 'Active', 'Completed']] },
            '$loanAmount',
            0
          ]
        }
      }
    }
  });

  // Add formatted date and approval rate
  pipeline.push({
    $addFields: {
      monthYear: {
        $dateFromParts: {
          year: '$_id.year',
          month: '$_id.month',
          day: 1
        }
      },
      approvalRate: {
        $cond: [
          { $gt: ['$applicationCount', 0] },
          {
            $multiply: [
              { $divide: ['$approvedCount', '$applicationCount'] },
              100
            ]
          },
          0
        ]
      }
    }
  });

  // Sort by date
  pipeline.push({
    $sort: { monthYear: 1 }
  });

  return pipeline;
};

/**
 * Client Risk Assessment Pipeline
 * Analyzes client risk factors and loan performance
 * @param {Object} filters - Filter criteria
 * @param {string} [filters.region] - Region ID to filter by
 * @param {string} [filters.riskLevel] - Risk level to filter by
 * @returns {Array} Aggregation pipeline
 */
const clientRiskPipeline = (filters = {}) => {
  const pipeline = [];

  // Lookup client information
  pipeline.push({
    $lookup: {
      from: 'clients',
      localField: 'clientUserId',
      foreignField: '_id',
      as: 'client'
    }
  });

  // Unwind client array
  pipeline.push({
    $unwind: {
      path: '$client',
      preserveNullAndEmptyArrays: false
    }
  });

  // Match stage
  const matchStage = {};

  if (filters.region) {
    matchStage['client.region'] = new mongoose.Types.ObjectId(filters.region);
  }

  if (filters.riskLevel) {
    matchStage['client.riskProfile.level'] = filters.riskLevel;
  }

  if (Object.keys(matchStage).length > 0) {
    pipeline.push({ $match: matchStage });
  }

  // Group by client and calculate risk metrics
  pipeline.push({
    $group: {
      _id: '$client._id',
      clientName: { $first: '$client.personalInfo.fullName' },
      riskLevel: { $first: '$client.riskProfile.level' },
      riskScore: { $first: '$client.riskProfile.score' },
      totalLoans: { $sum: 1 },
      totalBorrowed: { $sum: '$loanAmount' },
      avgLoanAmount: { $avg: '$loanAmount' },
      completedLoans: {
        $sum: {
          $cond: [{ $eq: ['$loanStatus', 'Completed'] }, 1, 0]
        }
      },
      defaultedLoans: {
        $sum: {
          $cond: [{ $eq: ['$loanStatus', 'Defaulted'] }, 1, 0]
        }
      },
      activeLoans: {
        $sum: {
          $cond: [{ $eq: ['$loanStatus', 'Active'] }, 1, 0]
        }
      }
    }
  });

  // Calculate performance metrics
  pipeline.push({
    $addFields: {
      completionRate: {
        $cond: [
          { $gt: ['$totalLoans', 0] },
          {
            $multiply: [
              { $divide: ['$completedLoans', '$totalLoans'] },
              100
            ]
          },
          0
        ]
      },
      defaultRate: {
        $cond: [
          { $gt: ['$totalLoans', 0] },
          {
            $multiply: [
              { $divide: ['$defaultedLoans', '$totalLoans'] },
              100
            ]
          },
          0
        ]
      }
    }
  });

  // Sort by risk score descending
  pipeline.push({
    $sort: { riskScore: -1 }
  });

  return pipeline;
};

/**
 * Loan Portfolio Summary Pipeline
 * Provides comprehensive portfolio overview
 * @param {Object} filters - Filter criteria
 * @param {string} [filters.region] - Region ID to filter by
 * @returns {Array} Aggregation pipeline
 */
const portfolioSummaryPipeline = (filters = {}) => {
  const pipeline = [];

  // Match stage
  const matchStage = {};

  if (filters.region) {
    matchStage.region = new mongoose.Types.ObjectId(filters.region);
  }

  if (Object.keys(matchStage).length > 0) {
    pipeline.push({ $match: matchStage });
  }

  // Calculate comprehensive portfolio metrics
  pipeline.push({
    $group: {
      _id: null,
      totalLoans: { $sum: 1 },
      totalPortfolioValue: { $sum: '$loanAmount' },
      avgLoanSize: { $avg: '$loanAmount' },

      // Status breakdown
      pendingLoans: {
        $sum: { $cond: [{ $eq: ['$loanStatus', 'Pending'] }, 1, 0] }
      },
      approvedLoans: {
        $sum: { $cond: [{ $eq: ['$loanStatus', 'Approved'] }, 1, 0] }
      },
      activeLoans: {
        $sum: { $cond: [{ $eq: ['$loanStatus', 'Active'] }, 1, 0] }
      },
      completedLoans: {
        $sum: { $cond: [{ $eq: ['$loanStatus', 'Completed'] }, 1, 0] }
      },
      rejectedLoans: {
        $sum: { $cond: [{ $eq: ['$loanStatus', 'Rejected'] }, 1, 0] }
      },
      defaultedLoans: {
        $sum: { $cond: [{ $eq: ['$loanStatus', 'Defaulted'] }, 1, 0] }
      },

      // Amount breakdown
      pendingAmount: {
        $sum: { $cond: [{ $eq: ['$loanStatus', 'Pending'] }, '$loanAmount', 0] }
      },
      activeAmount: {
        $sum: { $cond: [{ $eq: ['$loanStatus', 'Active'] }, '$loanAmount', 0] }
      },
      completedAmount: {
        $sum: { $cond: [{ $eq: ['$loanStatus', 'Completed'] }, '$loanAmount', 0] }
      },

      // Risk metrics
      highRiskLoans: {
        $sum: { $cond: [{ $gte: ['$loanAmount', 100000] }, 1, 0] }
      },

      // Term analysis
      shortTermLoans: {
        $sum: { $cond: [{ $lte: ['$loanTerm', 12] }, 1, 0] }
      },
      mediumTermLoans: {
        $sum: {
          $cond: [
            { $and: [{ $gt: ['$loanTerm', 12] }, { $lte: ['$loanTerm', 36] }] },
            1,
            0
          ]
        }
      },
      longTermLoans: {
        $sum: { $cond: [{ $gt: ['$loanTerm', 36] }, 1, 0] }
      }
    }
  });

  // Calculate rates and ratios
  pipeline.push({
    $addFields: {
      approvalRate: {
        $cond: [
          { $gt: ['$totalLoans', 0] },
          {
            $multiply: [
              {
                $divide: [
                  { $add: ['$approvedLoans', '$activeLoans', '$completedLoans'] },
                  '$totalLoans'
                ]
              },
              100
            ]
          },
          0
        ]
      },
      defaultRate: {
        $cond: [
          { $gt: ['$totalLoans', 0] },
          {
            $multiply: [
              { $divide: ['$defaultedLoans', '$totalLoans'] },
              100
            ]
          },
          0
        ]
      },
      portfolioAtRisk: {
        $cond: [
          { $gt: ['$totalPortfolioValue', 0] },
          {
            $multiply: [
              { $divide: ['$activeAmount', '$totalPortfolioValue'] },
              100
            ]
          },
          0
        ]
      }
    }
  });

  return pipeline;
};

module.exports = {
  loanStatsPipeline,
  agentPerformancePipeline,
  regionalDistributionPipeline,
  monthlyTrendsPipeline,
  clientRiskPipeline,
  portfolioSummaryPipeline
};