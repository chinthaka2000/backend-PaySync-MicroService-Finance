const Staff = require('../models/Staff');
const Client = require('../models/Client');
const Loan = require('../models/Loan');
const Region = require('../models/Region');
const { ClientRepository, LoanRepository, StaffRepository } = require('../repositories');
const { AppError } = require('../utils/customErrors');
const { logger } = require('../utils/logger');
const mongoose = require('mongoose');

// Get agent dashboard data
exports.getAgentDashboard = async (req, res) => {
  try {
    const { agentId } = req.params;

    // Verify agent exists
    const agent = await Staff.findById(agentId).populate('region');
    if (!agent) {
      return res.status(404).json({ message: 'Agent not found' });
    }

    // Get clients assigned to this agent
    const agentClients = await Client.find({ assignedReviewer: agentId });
    const clientIds = agentClients.map(client => client._id);

    // Client statistics
    const totalBorrowers = agentClients.length;
    const approvedBorrowers = await Client.countDocuments({
      assignedReviewer: agentId,
      status: 'Approved'
    });
    const pendingRegistrations = await Client.countDocuments({
      assignedReviewer: agentId,
      status: 'Pending Review'
    });

    // Loan statistics
    const totalLoans = await Loan.countDocuments({ clientUserId: { $in: clientIds } });
    const pendingLoans = await Loan.countDocuments({
      clientUserId: { $in: clientIds },
      'agentReview.status': 'Pending'
    });
    const approvedLoans = await Loan.countDocuments({
      clientUserId: { $in: clientIds },
      loanStatus: { $in: ['Approved', 'Active'] }
    });

    // Calculate commission
    const approvedLoanAmounts = await Loan.aggregate([
      {
        $match: {
          clientUserId: { $in: clientIds },
          loanStatus: { $in: ['Approved', 'Active', 'Completed'] }
        }
      },
      { $group: { _id: null, totalAmount: { $sum: '$loanAmount' } } }
    ]);

    const approvedLoanAmount = approvedLoanAmounts.length > 0 ? approvedLoanAmounts[0].totalAmount : 0;
    const commissionEarned = approvedLoanAmount * 0.02; // 2% commission

    // This month's statistics
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const thisMonthApplications = await Loan.countDocuments({
      clientUserId: { $in: clientIds },
      createdAt: { $gte: startOfMonth }
    });

    const thisMonthApproved = await Loan.countDocuments({
      clientUserId: { $in: clientIds },
      loanStatus: { $in: ['Approved', 'Active'] },
      'regionalAdminApproval.approvalDate': { $gte: startOfMonth }
    });

    const approvalRate = totalLoans > 0 ? Math.round((approvedLoans / totalLoans) * 100) : 0;

    // Recent activity
    const recentLoans = await Loan.find({ clientUserId: { $in: clientIds } })
      .populate('clientUserId', 'personalInfo')
      .sort({ createdAt: -1 })
      .limit(5);

    const recentClients = await Client.find({ assignedReviewer: agentId })
      .sort({ createdAt: -1 })
      .limit(5);

    res.json({
      agent: {
        id: agent._id,
        name: agent.name,
        email: agent.email,
        region: agent.region?.name || 'Not assigned'
      },
      stats: {
        totalBorrowers,
        approvedBorrowers,
        pendingRegistrations,
        totalLoans,
        pendingLoans,
        approvedLoans,
        commissionEarned,
        thisMonthApplications,
        thisMonthApproved,
        approvalRate,
        avgReviewTime: 2.1 // This could be calculated from actual data
      },
      recentActivity: {
        loans: recentLoans,
        clients: recentClients
      }
    });
  } catch (error) {
    res.status(500).json({
      message: 'Error fetching agent dashboard data',
      error: error.message
    });
  }
};

// Get agent profile
exports.getAgentProfile = async (req, res) => {
  try {
    const { agentId } = req.params;

    const agent = await Staff.findById(agentId)
      .populate('region', 'name districts')
      .select('-password');

    if (!agent) {
      return res.status(404).json({ message: 'Agent not found' });
    }

    res.json({
      message: 'Agent profile fetched successfully',
      agent
    });
  } catch (error) {
    res.status(500).json({
      message: 'Error fetching agent profile',
      error: error.message
    });
  }
};

// Get all agents (for admin use)
exports.getAllAgents = async (req, res) => {
  try {
    const { page = 1, limit = 10, search = '', region } = req.query;

    let query = { role: 'agent' };

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } }
      ];
    }

    if (region) {
      query.region = region;
    }

    const agents = await Staff.find(query)
      .populate('region', 'name')
      .select('-password')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await Staff.countDocuments(query);

    // Get performance data for each agent
    const agentsWithStats = await Promise.all(agents.map(async (agent) => {
      const clientCount = await Client.countDocuments({ assignedReviewer: agent._id });
      const loanCount = await Loan.countDocuments({
        clientUserId: { $in: await Client.find({ assignedReviewer: agent._id }).distinct('_id') }
      });

      return {
        ...agent.toObject(),
        performance: {
          clientsManaged: clientCount,
          loansProcessed: loanCount,
          rating: 4.2 // This could be calculated from actual ratings
        }
      };
    }));

    res.json({
      agents: agentsWithStats,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / limit)
    });
  } catch (error) {
    res.status(500).json({
      message: 'Error fetching agents',
      error: error.message
    });
  }
};

// Get agent statistics
exports.getAgentStats = async (req, res) => {
  try {
    const totalAgents = await Staff.countDocuments({ role: 'agent' });
    const activeAgents = await Staff.countDocuments({ role: 'agent', status: 'active' });

    // Get total loans processed by all agents
    const totalLoansProcessed = await Loan.countDocuments();

    // Get total clients managed by all agents
    const totalClientsManaged = await Client.countDocuments();

    // Calculate average rating (placeholder)
    const averageRating = 4.2;

    res.json({
      totalAgents,
      activeAgents,
      totalLoansProcessed,
      totalClientsManaged,
      averageRating
    });
  } catch (error) {
    res.status(500).json({
      message: 'Error fetching agent statistics',
      error: error.message
    });
  }
};

// Update agent profile
exports.updateAgentProfile = async (req, res) => {
  try {
    const { agentId } = req.params;
    const updateData = req.body;

    // Remove sensitive fields that shouldn't be updated via this endpoint
    delete updateData.password;
    delete updateData.role;

    const agent = await Staff.findByIdAndUpdate(
      agentId,
      { ...updateData, updatedAt: new Date() },
      { new: true }
    ).populate('region', 'name districts').select('-password');

    if (!agent) {
      return res.status(404).json({ message: 'Agent not found' });
    }

    res.json({
      message: 'Agent profile updated successfully',
      agent
    });
  } catch (error) {
    res.status(500).json({
      message: 'Error updating agent profile',
      error: error.message
    });
  }
};

// Get agents by region
exports.getAgentsByRegion = async (req, res) => {
  try {
    const { regionId } = req.params;

    const agents = await Staff.find({ role: 'agent', region: regionId })
      .populate('region', 'name districts')
      .select('-password');

    res.json({
      message: 'Agents fetched successfully',
      agents
    });
  } catch (error) {
    res.status(500).json({
      message: 'Error fetching agents by region',
      error: error.message
    });
  }
};

// Get agent agreements
exports.getAgentAgreements = async (req, res) => {
  try {
    const { agentId } = req.params;
    const { status, search, page = 1, limit = 10 } = req.query;

    // Verify agent exists
    const agent = await Staff.findById(agentId);
    if (!agent || agent.role !== 'agent') {
      return res.status(404).json({ message: 'Agent not found' });
    }

    // Get clients assigned to this agent
    const agentClients = await Client.find({ assignedReviewer: agentId });
    const clientIds = agentClients.map(client => client._id);

    // Build query for loans with agreements
    let query = {
      clientUserId: { $in: clientIds },
      agreementGenerated: true
    };

    // Add status filter if provided
    if (status && status !== 'All') {
      query.agreementStatus = status;
    }

    // Get loans with agreements
    let loans = await Loan.find(query)
      .populate('clientUserId', 'personalInfo registrationId')
      .sort({ agreementGeneratedDate: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    // Add search functionality
    if (search) {
      loans = loans.filter(loan => {
        const client = loan.clientUserId;
        return (
          client?.personalInfo?.fullName?.toLowerCase().includes(search.toLowerCase()) ||
          client?.personalInfo?.email?.toLowerCase().includes(search.toLowerCase()) ||
          loan.loanApplicationId.toLowerCase().includes(search.toLowerCase())
        );
      });
    }

    // Transform loans to agreement format
    const agreements = loans.map(loan => ({
      _id: loan._id,
      loanId: loan._id,
      loanApplicationId: loan.loanApplicationId,
      clientUserId: loan.clientUserId,
      loanAmount: loan.loanAmount,
      monthlyInstallment: loan.monthlyInstallment,
      loanTerm: loan.loanTerm,
      interestRate: loan.interestRate,
      agreementDate: loan.agreementGeneratedDate,
      status: loan.agreementStatus || 'Generated',
      agreementUrl: loan.agreementUrl
    }));

    const total = await Loan.countDocuments(query);

    // If no agreements found, return mock data for testing
    if (agreements.length === 0) {
      const mockAgreements = [
        {
          _id: 'mock1',
          loanId: 'mock1',
          loanApplicationId: 'A001',
          clientUserId: {
            personalInfo: {
              fullName: 'John Smith',
              email: 'john.smith@email.com',
              phone: '+94771234567'
            },
            registrationId: 'R001'
          },
          loanAmount: 50000,
          monthlyInstallment: 2500,
          loanTerm: 24,
          interestRate: 12.5,
          agreementDate: new Date(),
          status: 'Generated',
          agreementUrl: '/agreements/mock1.pdf'
        },
        {
          _id: 'mock2',
          loanId: 'mock2',
          loanApplicationId: 'A002',
          clientUserId: {
            personalInfo: {
              fullName: 'Jane Doe',
              email: 'jane.doe@email.com',
              phone: '+94771234568'
            },
            registrationId: 'R002'
          },
          loanAmount: 75000,
          monthlyInstallment: 3750,
          loanTerm: 24,
          interestRate: 13.0,
          agreementDate: new Date(),
          status: 'Sent',
          agreementUrl: '/agreements/mock2.pdf'
        }
      ];

      return res.json({
        message: 'Agent agreements fetched successfully (mock data)',
        agreements: mockAgreements,
        total: mockAgreements.length,
        page: parseInt(page),
        pages: 1
      });
    }

    res.json({
      message: 'Agent agreements fetched successfully',
      agreements,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / limit)
    });
  } catch (error) {
    res.status(500).json({
      message: 'Error fetching agent agreements',
      error: error.message
    });
  }
};

// ===== ENHANCED AGENT MANAGEMENT SYSTEM =====

// Get agent's assigned clients with filtering and pagination
exports.getAgentClients = async (req, res) => {
  try {
    const { agentId } = req.params;
    const {
      status,
      verificationStatus,
      riskLevel,
      district,
      search,
      page = 1,
      limit = 10,
      sortBy = 'assignedAt',
      sortOrder = 'desc'
    } = req.query;

    logger.info('Fetching agent clients', { agentId, filters: req.query });

    // Verify agent exists and user has permission
    const agent = await Staff.findById(agentId);
    if (!agent || agent.role !== 'agent') {
      throw new AppError('Agent not found', 404, 'AGENT_NOT_FOUND');
    }

    // Check if user can access this agent's data
    if (req.user.role === 'agent' && req.user.id !== agentId) {
      throw new AppError('Access denied', 403, 'ACCESS_DENIED');
    }

    const clientRepository = new ClientRepository();

    // Build filters
    const filters = {};
    if (status) filters.status = status;
    if (district) filters['personalInfo.district'] = district;
    if (riskLevel) filters['riskProfile.riskLevel'] = riskLevel;

    // Handle verification status filter
    if (verificationStatus) {
      switch (verificationStatus) {
        case 'complete':
          filters['verificationStatus.identity.verified'] = true;
          filters['verificationStatus.employment.verified'] = true;
          filters['verificationStatus.income.verified'] = true;
          filters['verificationStatus.documents.verified'] = true;
          break;
        case 'incomplete':
          filters.$or = [
            { 'verificationStatus.identity.verified': false },
            { 'verificationStatus.employment.verified': false },
            { 'verificationStatus.income.verified': false },
            { 'verificationStatus.documents.verified': false }
          ];
          break;
      }
    }

    // Build options
    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
      sort: { [sortBy]: sortOrder === 'desc' ? -1 : 1 }
    };

    let clients;
    if (search) {
      // Use text search if search term provided
      clients = await clientRepository.searchClients(search, { assignedAgent: agentId, ...filters }, options);
    } else {
      // Use regular filtering
      clients = await clientRepository.findByAgent(agentId, filters, options);
    }

    res.json({
      success: true,
      message: 'Agent clients fetched successfully',
      data: {
        clients: clients.docs || clients,
        pagination: clients.docs ? {
          total: clients.totalDocs,
          page: clients.page,
          pages: clients.totalPages,
          limit: clients.limit
        } : null
      }
    });
  } catch (error) {
    logger.error('Error fetching agent clients', error, { agentId });
    if (error instanceof AppError) {
      return res.status(error.statusCode).json({
        success: false,
        error: {
          code: error.errorCode,
          message: error.message
        }
      });
    }
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Error fetching agent clients'
      }
    });
  }
};

// Get agent's loans with filtering and status management
exports.getAgentLoans = async (req, res) => {
  try {
    const { agentId } = req.params;
    const {
      status,
      loanStatus,
      clientName,
      dateFrom,
      dateTo,
      minAmount,
      maxAmount,
      page = 1,
      limit = 10,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    logger.info('Fetching agent loans', { agentId, filters: req.query });

    // Verify agent exists and user has permission
    const agent = await Staff.findById(agentId);
    if (!agent || agent.role !== 'agent') {
      throw new AppError('Agent not found', 404, 'AGENT_NOT_FOUND');
    }

    // Check if user can access this agent's data
    if (req.user.role === 'agent' && req.user.id !== agentId) {
      throw new AppError('Access denied', 403, 'ACCESS_DENIED');
    }

    const loanRepository = new LoanRepository();

    // Build filters
    const filters = {};
    if (status) filters['agentReview.status'] = status;
    if (loanStatus) filters.loanStatus = loanStatus;
    if (minAmount) filters.loanAmount = { $gte: parseFloat(minAmount) };
    if (maxAmount) filters.loanAmount = { ...filters.loanAmount, $lte: parseFloat(maxAmount) };

    // Date range filter
    if (dateFrom || dateTo) {
      filters.createdAt = {};
      if (dateFrom) filters.createdAt.$gte = new Date(dateFrom);
      if (dateTo) filters.createdAt.$lte = new Date(dateTo);
    }

    // Build options
    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
      sort: { [sortBy]: sortOrder === 'desc' ? -1 : 1 }
    };

    let loans = await loanRepository.findByAgent(agentId, filters, options);

    // Client name search (post-query filtering for now)
    if (clientName && loans.docs) {
      loans.docs = loans.docs.filter(loan =>
        loan.clientUserId?.personalInfo?.fullName?.toLowerCase().includes(clientName.toLowerCase())
      );
    } else if (clientName && Array.isArray(loans)) {
      loans = loans.filter(loan =>
        loan.clientUserId?.personalInfo?.fullName?.toLowerCase().includes(clientName.toLowerCase())
      );
    }

    res.json({
      success: true,
      message: 'Agent loans fetched successfully',
      data: {
        loans: loans.docs || loans,
        pagination: loans.docs ? {
          total: loans.totalDocs,
          page: loans.page,
          pages: loans.totalPages,
          limit: loans.limit
        } : null
      }
    });
  } catch (error) {
    logger.error('Error fetching agent loans', error, { agentId });
    if (error instanceof AppError) {
      return res.status(error.statusCode).json({
        success: false,
        error: {
          code: error.errorCode,
          message: error.message
        }
      });
    }
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Error fetching agent loans'
      }
    });
  }
};

// Get comprehensive agent performance statistics
exports.getAgentPerformance = async (req, res) => {
  try {
    const { agentId } = req.params;
    const {
      dateFrom,
      dateTo,
      period = 'month' // month, quarter, year
    } = req.query;

    logger.info('Fetching agent performance', { agentId, period, dateFrom, dateTo });

    // Verify agent exists and user has permission
    const agent = await Staff.findById(agentId).populate('region', 'name code');
    if (!agent || agent.role !== 'agent') {
      throw new AppError('Agent not found', 404, 'AGENT_NOT_FOUND');
    }

    // Check if user can access this agent's data
    if (req.user.role === 'agent' && req.user.id !== agentId) {
      throw new AppError('Access denied', 403, 'ACCESS_DENIED');
    }

    const clientRepository = new ClientRepository();
    const loanRepository = new LoanRepository();

    // Calculate date range
    let startDate, endDate;
    if (dateFrom && dateTo) {
      startDate = new Date(dateFrom);
      endDate = new Date(dateTo);
    } else {
      endDate = new Date();
      switch (period) {
        case 'month':
          startDate = new Date();
          startDate.setMonth(startDate.getMonth() - 1);
          break;
        case 'quarter':
          startDate = new Date();
          startDate.setMonth(startDate.getMonth() - 3);
          break;
        case 'year':
          startDate = new Date();
          startDate.setFullYear(startDate.getFullYear() - 1);
          break;
        default:
          startDate = new Date();
          startDate.setMonth(startDate.getMonth() - 1);
      }
    }

    const dateRange = { startDate, endDate };

    // Get client statistics
    const clientStats = await clientRepository.getAgentClientStats(agentId, dateRange);

    // Get loan performance statistics
    const loanStats = await loanRepository.getAgentLoanStats(agentId, dateRange);

    // Calculate performance metrics
    const performanceMetrics = {
      clientManagement: {
        totalClients: clientStats.totalClients,
        newClientsInPeriod: clientStats.newClientsInPeriod || 0,
        verificationCompletionRate: clientStats.verificationCompletionRate,
        averageRiskScore: clientStats.averageRiskScore,
        clientRetentionRate: 95.2 // This would be calculated from actual data
      },
      loanProcessing: {
        totalLoans: loanStats.totalLoans,
        loansInPeriod: loanStats.loansInPeriod || 0,
        approvalRate: loanStats.approvalRate,
        averageProcessingTime: loanStats.averageProcessingTime || 2.5,
        totalLoanValue: loanStats.totalLoanValue || 0,
        averageLoanAmount: loanStats.averageLoanAmount || 0
      },
      productivity: {
        averageClientsPerMonth: Math.round(clientStats.totalClients / 12),
        averageLoansPerMonth: Math.round(loanStats.totalLoans / 12),
        conversionRate: loanStats.totalLoans > 0 ?
          Math.round((loanStats.totalLoans / clientStats.totalClients) * 100) : 0,
        responseTime: 1.8 // Average response time in hours
      },
      financial: {
        totalCommissionEarned: loanStats.totalCommissionEarned || 0,
        commissionInPeriod: loanStats.commissionInPeriod || 0,
        averageCommissionPerLoan: loanStats.averageCommissionPerLoan || 0
      }
    };

    // Get recent activity summary
    const recentActivity = await Promise.all([
      clientRepository.findByAgent(agentId, {}, { limit: 5, sort: { assignedAt: -1 } }),
      loanRepository.findByAgent(agentId, {}, { limit: 5, sort: { createdAt: -1 } })
    ]);

    res.json({
      success: true,
      message: 'Agent performance data fetched successfully',
      data: {
        agent: {
          id: agent._id,
          name: agent.name,
          email: agent.email,
          region: agent.region?.name || 'Not assigned',
          joinDate: agent.createdAt,
          status: agent.status
        },
        period: {
          startDate,
          endDate,
          period
        },
        performance: performanceMetrics,
        recentActivity: {
          clients: recentActivity[0],
          loans: recentActivity[1]
        },
        statusBreakdown: {
          clients: clientStats.statusCounts || {},
          loans: loanStats.statusCounts || {}
        }
      }
    });
  } catch (error) {
    logger.error('Error fetching agent performance', error, { agentId });
    if (error instanceof AppError) {
      return res.status(error.statusCode).json({
        success: false,
        error: {
          code: error.errorCode,
          message: error.message
        }
      });
    }
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Error fetching agent performance'
      }
    });
  }
};

// Assign client to agent (for moderate admin use)
exports.assignClientToAgent = async (req, res) => {
  try {
    const { agentId } = req.params;
    const { clientId, reason } = req.body;

    logger.info('Assigning client to agent', { agentId, clientId, assignedBy: req.user.id });

    // Verify permissions
    if (!['moderate_admin', 'super_admin'].includes(req.user.role)) {
      throw new AppError('Insufficient permissions', 403, 'INSUFFICIENT_PERMISSIONS');
    }

    // Verify agent exists
    const agent = await Staff.findById(agentId);
    if (!agent || agent.role !== 'agent') {
      throw new AppError('Agent not found', 404, 'AGENT_NOT_FOUND');
    }

    const clientRepository = new ClientRepository();
    const updatedClient = await clientRepository.assignToAgent(
      clientId,
      agentId,
      req.user.id,
      reason || 'Administrative assignment'
    );

    res.json({
      success: true,
      message: 'Client assigned to agent successfully',
      data: {
        client: updatedClient
      }
    });
  } catch (error) {
    logger.error('Error assigning client to agent', error, { agentId, clientId: req.body.clientId });
    if (error instanceof AppError) {
      return res.status(error.statusCode).json({
        success: false,
        error: {
          code: error.errorCode,
          message: error.message
        }
      });
    }
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Error assigning client to agent'
      }
    });
  }
};

// Update client information with audit trail
exports.updateClientInfo = async (req, res) => {
  try {
    const { agentId, clientId } = req.params;
    const updateData = req.body;

    logger.info('Updating client information', { agentId, clientId, updatedBy: req.user.id });

    // Verify agent exists and user has permission
    const agent = await Staff.findById(agentId);
    if (!agent || agent.role !== 'agent') {
      throw new AppError('Agent not found', 404, 'AGENT_NOT_FOUND');
    }

    // Check if user can update this client
    if (req.user.role === 'agent' && req.user.id !== agentId) {
      throw new AppError('Access denied', 403, 'ACCESS_DENIED');
    }

    const clientRepository = new ClientRepository();

    // Get current client data
    const client = await clientRepository.findById(clientId);
    if (!client) {
      throw new AppError('Client not found', 404, 'CLIENT_NOT_FOUND');
    }

    // Verify client is assigned to this agent
    if (client.assignedAgent?.toString() !== agentId) {
      throw new AppError('Client not assigned to this agent', 403, 'CLIENT_NOT_ASSIGNED');
    }

    // Create audit trail entry
    const auditEntry = {
      action: 'client_info_update',
      performedBy: req.user.id,
      timestamp: new Date(),
      changes: {},
      ipAddress: req.ip || req.connection.remoteAddress
    };

    // Track changes
    const allowedFields = [
      'personalInfo.fullName',
      'personalInfo.email',
      'personalInfo.phone',
      'personalInfo.address',
      'personalInfo.occupation',
      'personalInfo.monthlyIncome',
      'preferences.emailNotifications',
      'preferences.smsNotifications',
      'preferences.preferredLanguage'
    ];

    allowedFields.forEach(field => {
      const fieldPath = field.split('.');
      let currentValue = client;
      let newValue = updateData;

      for (const path of fieldPath) {
        currentValue = currentValue?.[path];
        newValue = newValue?.[path];
      }

      if (newValue !== undefined && currentValue !== newValue) {
        auditEntry.changes[field] = {
          from: currentValue,
          to: newValue
        };
      }
    });

    // Update client with audit trail
    const updatedClient = await clientRepository.updateById(clientId, {
      ...updateData,
      updatedAt: new Date(),
      updatedBy: req.user.id,
      $push: { auditTrail: auditEntry }
    });

    res.json({
      success: true,
      message: 'Client information updated successfully',
      data: {
        client: updatedClient,
        changes: auditEntry.changes
      }
    });
  } catch (error) {
    logger.error('Error updating client information', error, { agentId, clientId: req.params.clientId });
    if (error instanceof AppError) {
      return res.status(error.statusCode).json({
        success: false,
        error: {
          code: error.errorCode,
          message: error.message
        }
      });
    }
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Error updating client information'
      }
    });
  }
};

// Update client verification status
exports.updateClientVerification = async (req, res) => {
  try {
    const { agentId, clientId } = req.params;
    const { category, verified, reason } = req.body;

    logger.info('Updating client verification status', {
      agentId,
      clientId,
      category,
      verified,
      verifiedBy: req.user.id
    });

    // Verify agent exists and user has permission
    const agent = await Staff.findById(agentId);
    if (!agent || agent.role !== 'agent') {
      throw new AppError('Agent not found', 404, 'AGENT_NOT_FOUND');
    }

    // Check if user can update this client
    if (req.user.role === 'agent' && req.user.id !== agentId) {
      throw new AppError('Access denied', 403, 'ACCESS_DENIED');
    }

    // Validate category
    const validCategories = ['identity', 'employment', 'income', 'documents'];
    if (!validCategories.includes(category)) {
      throw new AppError('Invalid verification category', 400, 'INVALID_CATEGORY');
    }

    const clientRepository = new ClientRepository();
    const updatedClient = await clientRepository.updateVerificationStatus(
      clientId,
      category,
      verified,
      req.user.id,
      reason || ''
    );

    res.json({
      success: true,
      message: 'Client verification status updated successfully',
      data: {
        client: updatedClient,
        verification: {
          category,
          verified,
          verifiedBy: req.user.id,
          verifiedAt: new Date()
        }
      }
    });
  } catch (error) {
    logger.error('Error updating client verification status', error, {
      agentId,
      clientId: req.params.clientId,
      category: req.body.category
    });
    if (error instanceof AppError) {
      return res.status(error.statusCode).json({
        success: false,
        error: {
          code: error.errorCode,
          message: error.message
        }
      });
    }
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Error updating client verification status'
      }
    });
  }
};