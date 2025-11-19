const Staff = require('../models/Staff');
const Client = require('../models/Client');
const Loan = require('../models/Loan');
const Region = require('../models/Region');

// Get CEO Dashboard Data
exports.getCEODashboard = async (req, res) => {
  try {
    const { ceoId } = req.params;

    // Verify user exists and has appropriate role
    const user = await Staff.findById(ceoId);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User not found',
          timestamp: new Date().toISOString()
        }
      });
    }

    // Allow CEO, super_admin, moderate_admin, and regional_manager to access
    if (!['ceo', 'super_admin', 'moderate_admin', 'regional_manager'].includes(user.role)) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'ACCESS_DENIED',
          message: 'Access denied: insufficient permissions',
          timestamp: new Date().toISOString()
        }
      });
    }

    // Get all loans
    const allLoans = await Loan.find({});
    const totalLoans = allLoans.length;
    const activeLoans = allLoans.filter(l => l.status === 'active' || l.status === 'approved').length;
    const completedLoans = allLoans.filter(l => l.status === 'completed' || l.status === 'closed').length;
    const defaultedLoans = allLoans.filter(l => l.status === 'defaulted').length;

    // Get total clients
    const totalClients = await Client.countDocuments({});

    // Get total regions
    const totalRegions = await Region.countDocuments({});

    // Calculate revenue
    const totalRevenue = allLoans.reduce((sum, loan) => {
      return sum + (loan.totalAmount || loan.amount || 0);
    }, 0);

    // Calculate monthly revenue (current month)
    const currentMonth = new Date();
    currentMonth.setDate(1);
    currentMonth.setHours(0, 0, 0, 0);

    const monthlyLoans = allLoans.filter(loan => {
      const loanDate = new Date(loan.createdAt);
      return loanDate >= currentMonth;
    });
    const monthlyRevenue = monthlyLoans.reduce((sum, loan) => sum + (loan.totalAmount || loan.amount || 0), 0);

    // Calculate yearly revenue
    const currentYear = new Date().getFullYear();
    const yearlyLoans = allLoans.filter(loan => {
      const loanDate = new Date(loan.createdAt);
      return loanDate.getFullYear() === currentYear;
    });
    const yearlyRevenue = yearlyLoans.reduce((sum, loan) => sum + (loan.totalAmount || loan.amount || 0), 0);

    // Calculate growth rates (mock data for now)
    const revenueGrowth = 12.5;
    const loanGrowth = 8.3;
    const clientGrowth = 15.2;

    // Get top regions
    const regions = await Region.find({}).limit(10);
    const topRegions = await Promise.all(
      regions.map(async (region) => {
        const regionLoans = await Loan.find({ region: region._id });
        const revenue = regionLoans.reduce((sum, loan) => sum + (loan.totalAmount || loan.amount || 0), 0);
        return {
          regionId: region._id,
          regionName: region.name,
          revenue: revenue,
          loanCount: regionLoans.length
        };
      })
    );
    topRegions.sort((a, b) => b.revenue - a.revenue);

    // Get recent transactions (recent loans)
    const recentLoans = await Loan.find({})
      .sort({ createdAt: -1 })
      .limit(5)
      .populate('client', 'name email');

    const recentTransactions = recentLoans.map(loan => ({
      id: loan._id,
      type: `Loan - ${loan.loanType || 'Personal'}`,
      amount: loan.amount || 0,
      date: loan.createdAt,
      status: loan.status === 'approved' || loan.status === 'active' ? 'completed' : 'pending'
    }));

    // Calculate performance metrics
    const approvedLoans = allLoans.filter(l => l.status === 'approved' || l.status === 'active').length;
    const approvalRate = totalLoans > 0 ? ((approvedLoans / totalLoans) * 100).toFixed(1) : 0;

    const averageLoanAmount = totalLoans > 0
      ? Math.round(allLoans.reduce((sum, loan) => sum + (loan.amount || 0), 0) / totalLoans)
      : 0;

    const collectionRate = 85.5; // Mock data
    const averageProcessingTime = 3; // Mock data in days

    const dashboardData = {
      totalRevenue,
      totalLoans,
      totalClients,
      totalRegions,
      activeLoans,
      completedLoans,
      defaultedLoans,
      monthlyRevenue,
      yearlyRevenue,
      revenueGrowth,
      loanGrowth,
      clientGrowth,
      topRegions: topRegions.slice(0, 5),
      recentTransactions,
      performanceMetrics: {
        collectionRate: parseFloat(collectionRate),
        approvalRate: parseFloat(approvalRate),
        averageLoanAmount,
        averageProcessingTime
      }
    };

    res.status(200).json({
      success: true,
      message: 'CEO dashboard data retrieved successfully',
      data: dashboardData,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Get CEO dashboard error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Internal server error while fetching CEO dashboard',
        details: error.message,
        timestamp: new Date().toISOString()
      }
    });
  }
};

// Get Financial Overview
exports.getFinancialOverview = async (req, res) => {
  try {
    const { ceoId } = req.params;
    const { startDate, endDate } = req.query;

    // Mock financial overview data
    const financialData = {
      totalRevenue: 5000000,
      totalExpenses: 2000000,
      netProfit: 3000000,
      profitMargin: 60,
      cashFlow: 1500000,
      assets: 10000000,
      liabilities: 3000000
    };

    res.status(200).json({
      success: true,
      message: 'Financial overview retrieved successfully',
      data: financialData,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Get financial overview error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Internal server error',
        timestamp: new Date().toISOString()
      }
    });
  }
};

// Get Reports
exports.getReports = async (req, res) => {
  try {
    const { ceoId } = req.params;

    res.status(200).json({
      success: true,
      message: 'Reports retrieved successfully',
      data: { reports: [] },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Get reports error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Internal server error',
        timestamp: new Date().toISOString()
      }
    });
  }
};

// Get Regional Performance
exports.getRegionalPerformance = async (req, res) => {
  try {
    const { ceoId } = req.params;

    const regions = await Region.find({});
    const performance = await Promise.all(
      regions.map(async (region) => {
        const loans = await Loan.find({ region: region._id });
        const revenue = loans.reduce((sum, loan) => sum + (loan.totalAmount || loan.amount || 0), 0);

        return {
          regionId: region._id,
          regionName: region.name,
          totalLoans: loans.length,
          revenue,
          activeLoans: loans.filter(l => l.status === 'active').length
        };
      })
    );

    res.status(200).json({
      success: true,
      message: 'Regional performance retrieved successfully',
      data: { regions: performance },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Get regional performance error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Internal server error',
        timestamp: new Date().toISOString()
      }
    });
  }
};
