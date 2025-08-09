const Staff = require('../models/Staff');
const Client = require('../models/Client');
const Loan = require('../models/Loan');
const Region = require('../models/Region');

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