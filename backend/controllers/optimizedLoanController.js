/**
 * @fileoverview Optimized Loan Controller - Performance-optimized loan operations with caching
 * @module controllers/optimizedLoanController
 */

const mongoose = require('mongoose');
const Loan = require('../models/Loan');
const Client = require('../models/Client');
const Staff = require('../models/Staff');
const cacheService = require('../services/cacheService');
const { PaginationHelper } = require('../utils/pagination');
const {
  loanStatsPipeline,
  agentPerformancePipeline,
  regionalDistributionPipeline,
  monthlyTrendsPipeline,
  portfolioSummaryPipeline
} = require('../utils/aggregationPipelines');
const { logger } = require('../utils/logger');
const { AppError } = require('../utils/customErrors');

/**
 * Get paginated loans with caching and optimized queries
 * @async
 * @function getLoansOptimized
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getLoansOptimized = async (req, res) => {
  try {
    const { page = 1, limit = 20, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;
    const userId = req.user.userId;
    const userRole = req.user.role;
    const userRegion = req.user.region;

    // Generate cache key based on user context and query parameters
    const cacheKey = `loans:${userRole}:${userRegion}:${page}:${limit}:${sortBy}:${sortOrder}:${JSON.stringify(req.query)}`;

    // Try to get cached result
    const cachedResult = await cacheService.get(cacheKey);
    if (cachedResult) {
      logger.debug('Loans cache hit', { cacheKey, userId });
      return res.json(cachedResult);
    }

    // Build filter based on user role and permissions
    const filter = buildLoanFilter(req.user, req.query);

    // Pagination options
    const paginationOptions = {
      page: parseInt(page),
      limit: Math.min(parseInt(limit), 100), // Max 100 items per page
      sort: { [sortBy]: sortOrder === 'asc' ? 1 : -1 },
      populate: [
        {
          path: 'clientUserId',
          select: 'personalInfo.fullName personalInfo.district status',
          options: { lean: true }
        },
        {
          path: 'agentReview.reviewedBy',
          select: 'name email',
          options: { lean: true }
        }
      ],
      select: 'loanApplicationId loanAmount loanTerm loanStatus interestRate createdAt updatedAt monthlyInstallment'
    };

    // Execute paginated query
    const result = await PaginationHelper.paginateQuery(Loan, filter, paginationOptions);

    // Cache the result for 2 minutes
    await cacheService.set(cacheKey, result, 120);

    logger.info('Loans retrieved successfully', {
      userId,
      totalItems: result.pagination.totalItems,
      page: result.pagination.currentPage,
      cached: false
    });

    res.json(result);
  } catch (error) {
    logger.error('Failed to get loans', {
      error: error.message,
      userId: req.user?.userId,
      query: req.query
    });
    res.status(500).json({
      success: false,
      error: {
        code: 'LOANS_FETCH_ERROR',
        message: 'Failed to retrieve loans',
        details: error.message
      }
    });
  }
};

/**
 * Get loan statistics with caching
 * @async
 * @function getLoanStats
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getLoanStats = async (req, res) => {
  try {
    const userId = req.user.userId;
    const userRole = req.user.role;
    const userRegion = req.user.region;

    // Generate cache key
    const cacheKey = `loan-stats:${userRole}:${userRegion}:${JSON.stringify(req.query)}`;

    // Try cache first
    const cachedStats = await cacheService.get(cacheKey);
    if (cachedStats) {
      logger.debug('Loan stats cache hit', { cacheKey, userId });
      return res.json(cachedStats);
    }

    // Build filters for aggregation
    const filters = buildStatsFilter(req.user, req.query);

    // Execute optimized aggregation pipeline
    const pipeline = loanStatsPipeline(filters);
    const statsResult = await Loan.aggregate(pipeline);

    const stats = statsResult.length > 0 ? statsResult[0] : {
      statuses: [],
      totalLoans: 0,
      grandTotalAmount: 0
    };

    const response = {
      success: true,
      data: {
        overview: {
          totalLoans: stats.totalLoans,
          totalAmount: stats.grandTotalAmount,
          averageAmount: stats.totalLoans > 0 ? stats.grandTotalAmount / stats.totalLoans : 0
        },
        statusBreakdown: stats.statuses,
        generatedAt: new Date().toISOString()
      }
    };

    // Cache for 5 minutes
    await cacheService.set(cacheKey, response, 300);

    logger.info('Loan statistics generated', {
      userId,
      totalLoans: stats.totalLoans,
      cached: false
    });

    res.json(response);
  } catch (error) {
    logger.error('Failed to get loan statistics', {
      error: error.message,
      userId: req.user?.userId
    });
    res.status(500).json({
      success: false,
      error: {
        code: 'STATS_GENERATION_ERROR',
        message: 'Failed to generate loan statistics',
        details: error.message
      }
    });
  }
};

/**
 * Get agent performance metrics with caching
 * @async
 * @function getAgentPerformance
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getAgentPerformance = async (req, res) => {
  try {
    const userId = req.user.userId;
    const userRole = req.user.role;
    const userRegion = req.user.region;

    // Only allow regional managers and above to access this data
    if (!['regional_manager', 'moderate_admin', 'ceo', 'super_admin'].includes(userRole)) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'INSUFFICIENT_PERMISSIONS',
          message: 'Access denied: Insufficient permissions'
        }
      });
    }

    const cacheKey = `agent-performance:${userRole}:${userRegion}:${JSON.stringify(req.query)}`;

    // Try cache first
    const cachedPerformance = await cacheService.get(cacheKey);
    if (cachedPerformance) {
      logger.debug('Agent performance cache hit', { cacheKey, userId });
      return res.json(cachedPerformance);
    }

    // Build filters
    const filters = buildStatsFilter(req.user, req.query);

    // Execute aggregation pipeline
    const pipeline = agentPerformancePipeline(filters);
    const performanceData = await Loan.aggregate(pipeline);

    const response = {
      success: true,
      data: {
        agents: performanceData,
        summary: {
          totalAgents: performanceData.length,
          totalApplications: performanceData.reduce((sum, agent) => sum + agent.totalApplications, 0),
          totalApproved: performanceData.reduce((sum, agent) => sum + agent.approvedLoans, 0),
          averageApprovalRate: performanceData.length > 0
            ? performanceData.reduce((sum, agent) => sum + agent.approvalRate, 0) / performanceData.length
            : 0
        },
        generatedAt: new Date().toISOString()
      }
    };

    // Cache for 10 minutes
    await cacheService.set(cacheKey, response, 600);

    logger.info('Agent performance data generated', {
      userId,
      agentCount: performanceData.length,
      cached: false
    });

    res.json(response);
  } catch (error) {
    logger.error('Failed to get agent performance', {
      error: error.message,
      userId: req.user?.userId
    });
    res.status(500).json({
      success: false,
      error: {
        code: 'PERFORMANCE_DATA_ERROR',
        message: 'Failed to generate agent performance data',
        details: error.message
      }
    });
  }
};

/**
 * Get regional loan distribution with caching
 * @async
 * @function getRegionalDistribution
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getRegionalDistribution = async (req, res) => {
  try {
    const userId = req.user.userId;
    const userRole = req.user.role;

    // Only allow moderate admin and above
    if (!['moderate_admin', 'ceo', 'super_admin'].includes(userRole)) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'INSUFFICIENT_PERMISSIONS',
          message: 'Access denied: Insufficient permissions'
        }
      });
    }

    const cacheKey = `regional-distribution:${JSON.stringify(req.query)}`;

    // Try cache first
    const cachedDistribution = await cacheService.get(cacheKey);
    if (cachedDistribution) {
      logger.debug('Regional distribution cache hit', { cacheKey, userId });
      return res.json(cachedDistribution);
    }

    // Build filters
    const filters = {
      startDate: req.query.startDate ? new Date(req.query.startDate) : undefined,
      endDate: req.query.endDate ? new Date(req.query.endDate) : undefined
    };

    // Execute aggregation pipeline
    const pipeline = regionalDistributionPipeline(filters);
    const distributionData = await Loan.aggregate(pipeline);

    const response = {
      success: true,
      data: {
        distribution: distributionData,
        summary: {
          totalRegions: new Set(distributionData.map(d => d._id.region)).size,
          totalDistricts: new Set(distributionData.map(d => d._id.district)).size,
          totalLoans: distributionData.reduce((sum, d) => sum + d.loanCount, 0),
          totalAmount: distributionData.reduce((sum, d) => sum + d.totalAmount, 0)
        },
        generatedAt: new Date().toISOString()
      }
    };

    // Cache for 15 minutes
    await cacheService.set(cacheKey, response, 900);

    logger.info('Regional distribution data generated', {
      userId,
      regionCount: response.data.summary.totalRegions,
      cached: false
    });

    res.json(response);
  } catch (error) {
    logger.error('Failed to get regional distribution', {
      error: error.message,
      userId: req.user?.userId
    });
    res.status(500).json({
      success: false,
      error: {
        code: 'DISTRIBUTION_DATA_ERROR',
        message: 'Failed to generate regional distribution data',
        details: error.message
      }
    });
  }
};

/**
 * Get monthly loan trends with caching
 * @async
 * @function getMonthlyTrends
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getMonthlyTrends = async (req, res) => {
  try {
    const userId = req.user.userId;
    const userRole = req.user.role;
    const userRegion = req.user.region;

    const cacheKey = `monthly-trends:${userRole}:${userRegion}:${JSON.stringify(req.query)}`;

    // Try cache first
    const cachedTrends = await cacheService.get(cacheKey);
    if (cachedTrends) {
      logger.debug('Monthly trends cache hit', { cacheKey, userId });
      return res.json(cachedTrends);
    }

    // Build filters
    const filters = buildStatsFilter(req.user, req.query);
    filters.months = parseInt(req.query.months) || 12;

    // Execute aggregation pipeline
    const pipeline = monthlyTrendsPipeline(filters);
    const trendsData = await Loan.aggregate(pipeline);

    const response = {
      success: true,
      data: {
        trends: trendsData,
        summary: {
          totalMonths: trendsData.length,
          totalApplications: trendsData.reduce((sum, t) => sum + t.applicationCount, 0),
          totalApproved: trendsData.reduce((sum, t) => sum + t.approvedCount, 0),
          averageMonthlyApplications: trendsData.length > 0
            ? trendsData.reduce((sum, t) => sum + t.applicationCount, 0) / trendsData.length
            : 0
        },
        generatedAt: new Date().toISOString()
      }
    };

    // Cache for 1 hour
    await cacheService.set(cacheKey, response, 3600);

    logger.info('Monthly trends data generated', {
      userId,
      monthCount: trendsData.length,
      cached: false
    });

    res.json(response);
  } catch (error) {
    logger.error('Failed to get monthly trends', {
      error: error.message,
      userId: req.user?.userId
    });
    res.status(500).json({
      success: false,
      error: {
        code: 'TRENDS_DATA_ERROR',
        message: 'Failed to generate monthly trends data',
        details: error.message
      }
    });
  }
};

/**
 * Get portfolio summary with caching
 * @async
 * @function getPortfolioSummary
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getPortfolioSummary = async (req, res) => {
  try {
    const userId = req.user.userId;
    const userRole = req.user.role;
    const userRegion = req.user.region;

    const cacheKey = `portfolio-summary:${userRole}:${userRegion}`;

    // Try cache first
    const cachedSummary = await cacheService.get(cacheKey);
    if (cachedSummary) {
      logger.debug('Portfolio summary cache hit', { cacheKey, userId });
      return res.json(cachedSummary);
    }

    // Build filters
    const filters = buildStatsFilter(req.user, {});

    // Execute aggregation pipeline
    const pipeline = portfolioSummaryPipeline(filters);
    const summaryResult = await Loan.aggregate(pipeline);

    const summary = summaryResult.length > 0 ? summaryResult[0] : {
      totalLoans: 0,
      totalPortfolioValue: 0,
      avgLoanSize: 0,
      approvalRate: 0,
      defaultRate: 0,
      portfolioAtRisk: 0
    };

    const response = {
      success: true,
      data: {
        portfolio: summary,
        generatedAt: new Date().toISOString()
      }
    };

    // Cache for 30 minutes
    await cacheService.set(cacheKey, response, 1800);

    logger.info('Portfolio summary generated', {
      userId,
      totalLoans: summary.totalLoans,
      portfolioValue: summary.totalPortfolioValue,
      cached: false
    });

    res.json(response);
  } catch (error) {
    logger.error('Failed to get portfolio summary', {
      error: error.message,
      userId: req.user?.userId
    });
    res.status(500).json({
      success: false,
      error: {
        code: 'PORTFOLIO_SUMMARY_ERROR',
        message: 'Failed to generate portfolio summary',
        details: error.message
      }
    });
  }
};

/**
 * Search loans with optimized pagination and caching
 * @async
 * @function searchLoans
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const searchLoans = async (req, res) => {
  try {
    const { q: searchTerm, page = 1, limit = 20 } = req.query;
    const userId = req.user.userId;

    if (!searchTerm || searchTerm.trim().length < 2) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_SEARCH_TERM',
          message: 'Search term must be at least 2 characters long'
        }
      });
    }

    const cacheKey = `loan-search:${userId}:${searchTerm}:${page}:${limit}`;

    // Try cache first
    const cachedResults = await cacheService.get(cacheKey);
    if (cachedResults) {
      logger.debug('Loan search cache hit', { cacheKey, userId, searchTerm });
      return res.json(cachedResults);
    }

    // Build base filter
    const baseFilter = buildLoanFilter(req.user, {});

    // Search fields
    const searchFields = ['loanApplicationId', 'purpose'];

    // Execute search with pagination
    const result = await PaginationHelper.paginateSearch(
      Loan,
      searchTerm,
      searchFields,
      baseFilter,
      {
        page: parseInt(page),
        limit: Math.min(parseInt(limit), 50), // Max 50 for search
        sort: { createdAt: -1 },
        populate: [
          {
            path: 'clientUserId',
            select: 'personalInfo.fullName personalInfo.district',
            options: { lean: true }
          }
        ]
      }
    );

    // Cache for 1 minute (search results change frequently)
    await cacheService.set(cacheKey, result, 60);

    logger.info('Loan search completed', {
      userId,
      searchTerm,
      resultsCount: result.pagination.totalItems,
      cached: false
    });

    res.json(result);
  } catch (error) {
    logger.error('Loan search failed', {
      error: error.message,
      userId: req.user?.userId,
      searchTerm: req.query.q
    });
    res.status(500).json({
      success: false,
      error: {
        code: 'SEARCH_ERROR',
        message: 'Failed to search loans',
        details: error.message
      }
    });
  }
};

/**
 * Build loan filter based on user role and permissions
 * @param {Object} user - User object from authentication
 * @param {Object} query - Query parameters
 * @returns {Object} MongoDB filter object
 */
function buildLoanFilter(user, query) {
  const filter = {};

  // Role-based filtering
  switch (user.role) {
    case 'agent':
      // Agents can only see loans they've reviewed or from their assigned clients
      filter['agentReview.reviewedBy'] = new mongoose.Types.ObjectId(user.userId);
      break;

    case 'regional_manager':
      // Regional managers can see loans from their region
      if (user.region) {
        filter.region = new mongoose.Types.ObjectId(user.region);
      }
      break;

    case 'moderate_admin':
    case 'ceo':
    case 'super_admin':
      // These roles can see all loans (no additional filter)
      break;

    default:
      // Unknown role - restrict to no results
      filter._id = { $in: [] };
  }

  // Add query-based filters
  if (query.status) {
    filter.loanStatus = query.status;
  }

  if (query.minAmount) {
    filter.loanAmount = { ...filter.loanAmount, $gte: parseFloat(query.minAmount) };
  }

  if (query.maxAmount) {
    filter.loanAmount = { ...filter.loanAmount, $lte: parseFloat(query.maxAmount) };
  }

  if (query.startDate) {
    filter.createdAt = { ...filter.createdAt, $gte: new Date(query.startDate) };
  }

  if (query.endDate) {
    filter.createdAt = { ...filter.createdAt, $lte: new Date(query.endDate) };
  }

  return filter;
}

/**
 * Build stats filter based on user role and permissions
 * @param {Object} user - User object from authentication
 * @param {Object} query - Query parameters
 * @returns {Object} Filter object for aggregation pipelines
 */
function buildStatsFilter(user, query) {
  const filter = {};

  // Role-based filtering
  switch (user.role) {
    case 'regional_manager':
      if (user.region) {
        filter.region = user.region;
      }
      break;

    case 'agent':
      filter.agentId = user.userId;
      break;
  }

  // Add date filters
  if (query.startDate) {
    filter.startDate = new Date(query.startDate);
  }

  if (query.endDate) {
    filter.endDate = new Date(query.endDate);
  }

  return filter;
}

module.exports = {
  getLoansOptimized,
  getLoanStats,
  getAgentPerformance,
  getRegionalDistribution,
  getMonthlyTrends,
  getPortfolioSummary,
  searchLoans
};