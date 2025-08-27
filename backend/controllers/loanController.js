const Loan = require('../models/Loan');
const Client = require('../models/Client');
const Staff = require('../models/Staff');
const sendEmail = require('../utils/sendEmail');

// Create a new loan application
exports.createLoanApplication = async (req, res) => {
  try {
    const loanData = req.body;

    // Validate client exists
    const client = await Client.findById(loanData.clientUserId);
    if (!client) {
      return res.status(404).json({ message: 'Client not found' });
    }

    // Calculate down payment requirement (1/3 of loan amount)
    const requiredDownPayment = loanData.loanAmount / 3;

    if (loanData.downPayment.amount < requiredDownPayment) {
      return res.status(400).json({
        message: `Down payment must be at least ${requiredDownPayment}`
      });
    }

    const newLoan = new Loan({
      ...loanData,
      loanStatus: 'Pending',
      agentReview: {
        status: 'Pending'
      },
      regionalAdminApproval: {
        status: 'Pending'
      }
    });

    await newLoan.save();

    res.status(201).json({
      message: 'Loan application created successfully',
      loan: newLoan
    });
  } catch (error) {
    res.status(500).json({
      message: 'Error creating loan application',
      error: error.message
    });
  }
};

// Get all loans for an agent
exports.getAgentLoans = async (req, res) => {
  try {
    const { agentId } = req.params;
    const { status, page = 1, limit = 10, search = '' } = req.query;

    // Find clients assigned to this agent
    const agentClients = await Client.find({ assignedReviewer: agentId });
    const clientIds = agentClients.map(client => client._id);

    let query = { clientUserId: { $in: clientIds } };

    // Add status filter if provided
    if (status) {
      query.loanStatus = status;
    }

    // Add search functionality
    if (search) {
      // First find clients that match the search term
      const matchingClients = await Client.find({
        _id: { $in: clientIds },
        $or: [
          { 'personalInfo.fullName': { $regex: search, $options: 'i' } },
          { 'personalInfo.email': { $regex: search, $options: 'i' } },
          { registrationId: { $regex: search, $options: 'i' } }
        ]
      });

      const matchingClientIds = matchingClients.map(client => client._id);

      query.$or = [
        { loanApplicationId: { $regex: search, $options: 'i' } },
        { product: { $regex: search, $options: 'i' } },
        { purpose: { $regex: search, $options: 'i' } },
        { clientUserId: { $in: matchingClientIds } }
      ];
    }

    const loans = await Loan.find(query)
      .populate('clientUserId', 'personalInfo registrationId')
      .populate('agentReview.reviewedBy', 'name email')
      .populate('regionalAdminApproval.approvedBy', 'name email')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await Loan.countDocuments(query);

    // Transform to match frontend interface
    const transformedLoans = loans.map(loan => ({
      id: loan._id.toString(),
      borrowerName: loan.clientUserId?.personalInfo?.fullName || 'Unknown',
      amount: loan.loanAmount,
      status: loan.loanStatus.toLowerCase().replace(/\s+/g, '_'),
      assignedAgentId: loan.agentReview?.reviewedBy?._id?.toString() || agentId,
      createdAt: loan.createdAt,
      updatedAt: loan.updatedAt,
      interestRate: loan.interestRate,
      totalPaid: loan.paymentHistory?.reduce((sum, payment) =>
        payment.status === 'Approved' ? sum + payment.amount : sum, 0) || 0,
      termMonths: loan.loanTerm,
      monthlyPayment: loan.monthlyInstallment,
      disbursedDate: loan.loanStatus === 'Active' ? loan.updatedAt : null,
      completedDate: loan.loanStatus === 'Completed' ? loan.updatedAt : null,
      // Additional fields that might be useful
      loanApplicationId: loan.loanApplicationId,
      product: loan.product,
      purpose: loan.purpose,
      clientId: loan.clientUserId?._id?.toString(),
      registrationId: loan.clientUserId?.registrationId
    }));

    res.json({
      loans: transformedLoans,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / limit)
    });
  } catch (error) {
    res.status(500).json({
      message: 'Error fetching agent loans',
      error: error.message
    });
  }
};

// Get loan by ID
exports.getLoanById = async (req, res) => {
  try {
    const { id } = req.params;

    const loan = await Loan.findOne({ loanApplicationId: id })
      .populate('clientUserId')
      .populate('agentReview.reviewedBy', 'name email')
      .populate('regionalAdminApproval.approvedBy', 'name email')
      .populate('paymentHistory.approvedBy', 'name email');

    if (!loan) {
      return res.status(404).json({ message: 'Loan not found' });
    }

    res.json({
      message: 'Loan details fetched successfully',
      loan
    });
  } catch (error) {
    res.status(500).json({
      message: 'Error fetching loan details',
      error: error.message
    });
  }
};

// Agent review loan application
exports.agentReviewLoan = async (req, res) => {
  try {
    const { loanId } = req.params;
    const { agentId, status, comments, rating } = req.body;

    const loan = await Loan.findOne({ loanApplicationId: loanId });
    if (!loan) {
      return res.status(404).json({ message: 'Loan not found' });
    }

    // Verify agent has permission to review this loan
    const client = await Client.findById(loan.clientUserId);
    if (client.assignedReviewer.toString() !== agentId) {
      return res.status(403).json({ message: 'Not authorized to review this loan' });
    }

    loan.agentReview = {
      reviewedBy: agentId,
      reviewDate: new Date(),
      status,
      comments,
      rating
    };

    if (status === 'Approved') {
      loan.loanStatus = 'Under Review'; // Ready for regional admin approval
    } else if (status === 'Rejected') {
      loan.loanStatus = 'Rejected';
    }

    await loan.save();

    // Send notification email to client
    const clientEmail = client.personalInfo.email;
    const message = `Your loan application ${loanId} has been ${status.toLowerCase()} by your agent. ${comments ? 'Comments: ' + comments : ''}`;

    await sendEmail(clientEmail, `Loan Application ${status}`, message);

    res.json({
      message: 'Loan review completed successfully',
      loan
    });
  } catch (error) {
    res.status(500).json({
      message: 'Error reviewing loan',
      error: error.message
    });
  }
};

// Get loan statistics for agent dashboard
exports.getAgentLoanStats = async (req, res) => {
  try {
    const { agentId } = req.params;
    // Find clients assigned to this agent
    const agentClients = await Client.find({ assignedReviewer: agentId });
    const clientIds = agentClients.map(client => client._id);

    console.log(`Found ${clientIds} clients for agent ${agentId}`);

    const totalLoans = await Loan.countDocuments({ clientUserId: { $in: clientIds } });

    console.log(`Total loans for agent ${agentId}: ${totalLoans}`);

    const activeLoans = await Loan.countDocuments({
      clientUserId: { $in: clientIds },
      loanStatus: 'Active'
    });
    const pendingLoans = await Loan.countDocuments({
      clientUserId: { $in: clientIds },
      loanStatus: 'Pending'
    });
    const approvedLoans = await Loan.countDocuments({
      clientUserId: { $in: clientIds },
      loanStatus: 'Approved'
    });
    const rejectedLoans = await Loan.countDocuments({
      clientUserId: { $in: clientIds },
      loanStatus: 'Rejected'
    });

    // Calculate total loan amount processed
    const loanAmounts = await Loan.aggregate([
      { $match: { clientUserId: { $in: clientIds } } },
      { $group: { _id: null, totalAmount: { $sum: '$loanAmount' } } }
    ]);

    const totalLoanAmount = loanAmounts.length > 0 ? loanAmounts[0].totalAmount : 0;

    // Calculate commission (assuming 2% of approved loan amount)
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

    res.json({
      totalLoans,
      activeLoans,
      pendingLoans,
      completeLoans: approvedLoans,
      pendingApplications: pendingLoans,
      rejectedLoans,
      totalLoanAmount,
      commissionEarned,
      averageLoanAmount: totalLoans > 0 ? totalLoanAmount / totalLoans : 0
    });
  } catch (error) {
    res.status(500).json({
      message: 'Error fetching loan statistics',
      error: error.message
    });
  }
};

// Get pending loans for agent review
exports.getPendingLoansForAgent = async (req, res) => {
  try {
    const { agentId } = req.params;

    // Find clients assigned to this agent
    const agentClients = await Client.find({ assignedReviewer: agentId });
    const clientIds = agentClients.map(client => client._id);

    const pendingLoans = await Loan.find({
      clientUserId: { $in: clientIds },
      'agentReview.status': 'Pending'
    })
      .populate('clientUserId', 'personalInfo registrationId')
      .sort({ createdAt: -1 });

    res.json({
      message: 'Pending loans fetched successfully',
      loans: pendingLoans,
      count: pendingLoans.length
    });
  } catch (error) {
    res.status(500).json({
      message: 'Error fetching pending loans',
      error: error.message
    });
  }
};

// Update loan status
exports.updateLoanStatus = async (req, res) => {
  try {
    const { loanId } = req.params;
    const { status, comments } = req.body;

    const loan = await Loan.findOne({ loanApplicationId: loanId });
    if (!loan) {
      return res.status(404).json({ message: 'Loan not found' });
    }

    loan.loanStatus = status;
    if (comments) {
      loan.agentReview.comments = comments;
    }

    await loan.save();

    res.json({
      message: 'Loan status updated successfully',
      loan
    });
  } catch (error) {
    res.status(500).json({
      message: 'Error updating loan status',
      error: error.message
    });
  }
};

// Add payment to loan
exports.addPayment = async (req, res) => {
  try {
    const { loanId } = req.params;
    const paymentData = req.body;

    const loan = await Loan.findOne({ loanApplicationId: loanId });
    if (!loan) {
      return res.status(404).json({ message: 'Loan not found' });
    }

    // Generate payment ID
    const paymentId = `P${loanId}${String(loan.paymentHistory.length + 1).padStart(3, '0')}`;

    const payment = {
      paymentId,
      ...paymentData,
      status: 'Pending'
    };

    loan.paymentHistory.push(payment);
    await loan.save();

    res.json({
      message: 'Payment added successfully',
      payment
    });
  } catch (error) {
    res.status(500).json({
      message: 'Error adding payment',
      error: error.message
    });
  }
};

// Get payment history for a loan
exports.getPaymentHistory = async (req, res) => {
  try {
    const { loanId } = req.params;

    const loan = await Loan.findOne({ loanApplicationId: loanId })
      .populate('paymentHistory.approvedBy', 'name email');

    if (!loan) {
      return res.status(404).json({ message: 'Loan not found' });
    }

    res.json({
      message: 'Payment history fetched successfully',
      payments: loan.paymentHistory,
      loanInfo: {
        loanApplicationId: loan.loanApplicationId,
        monthlyInstallment: loan.monthlyInstallment,
        totalPayableAmount: loan.totalPayableAmount
      }
    });
  } catch (error) {
    res.status(500).json({
      message: 'Error fetching payment history',
      error: error.message
    });
  }
};

// Search loans
exports.searchLoans = async (req, res) => {
  try {
    const { query, agentId } = req.query;

    // Find clients assigned to this agent
    const agentClients = await Client.find({ assignedReviewer: agentId });
    const clientIds = agentClients.map(client => client._id);

    const searchQuery = {
      clientUserId: { $in: clientIds },
      $or: [
        { loanApplicationId: { $regex: query, $options: 'i' } },
        { product: { $regex: query, $options: 'i' } },
        { purpose: { $regex: query, $options: 'i' } }
      ]
    };

    const loans = await Loan.find(searchQuery)
      .populate('clientUserId', 'personalInfo registrationId')
      .sort({ createdAt: -1 })
      .limit(20);

    res.json({
      message: 'Search results fetched successfully',
      loans
    });
  } catch (error) {
    res.status(500).json({
      message: 'Error searching loans',
      error: error.message
    });
  }
};

// Get all loans (for useLoanData hook)
exports.getAllLoans = async (req, res) => {
  try {
    const { status, page = 1, limit = 50 } = req.query;

    let query = {};
    if (status) {
      query.loanStatus = status;
    }

    const loans = await Loan.find(query)
      .populate('clientUserId', 'personalInfo registrationId')
      .populate('agentReview.reviewedBy', 'name email')
      .populate('regionalAdminApproval.approvedBy', 'name email')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    // Transform to match frontend interface
    const transformedLoans = loans.map(loan => ({
      id: loan._id.toString(),
      borrowerName: loan.clientUserId?.personalInfo?.fullName || 'Unknown',
      amount: loan.loanAmount,
      status: loan.loanStatus.toLowerCase().replace(' ', '_'),
      assignedAgentId: loan.agentReview?.reviewedBy?.toString() || '',
      createdAt: loan.createdAt,
      updatedAt: loan.updatedAt,
      interestRate: loan.interestRate,
      totalPaid: loan.paymentHistory?.reduce((sum, payment) =>
        payment.status === 'Approved' ? sum + payment.amount : sum, 0) || 0,
      termMonths: loan.loanTerm,
      monthlyPayment: loan.monthlyInstallment,
      disbursedDate: loan.loanStatus === 'Active' ? loan.updatedAt : null,
      completedDate: loan.loanStatus === 'Completed' ? loan.updatedAt : null
    }));

    res.json(transformedLoans);
  } catch (error) {
    res.status(500).json({
      message: 'Error fetching all loans',
      error: error.message
    });
  }
};

// Get loan statistics (for useLoanData hook)
exports.getLoanStats = async (req, res) => {
  try {
    const totalLoans = await Loan.countDocuments();
    const completeLoans = await Loan.countDocuments({ loanStatus: 'Completed' });
    const pendingLoans = await Loan.countDocuments({ loanStatus: { $in: ['Pending', 'Under Review'] } });
    const overdueLoans = await Loan.countDocuments({ loanStatus: 'Defaulted' });
    const pendingApplications = await Loan.countDocuments({ loanStatus: 'Pending' });

    // Calculate financial stats
    const financialStats = await Loan.aggregate([
      {
        $group: {
          _id: null,
          totalAmount: { $sum: '$loanAmount' },
          totalDisbursed: {
            $sum: {
              $cond: [
                { $in: ['$loanStatus', ['Active', 'Completed', 'Defaulted']] },
                '$loanAmount',
                0
              ]
            }
          },
          averageInterestRate: { $avg: '$interestRate' }
        }
      }
    ]);

    // Calculate total collected from payments
    const paymentStats = await Loan.aggregate([
      { $unwind: { path: '$paymentHistory', preserveNullAndEmptyArrays: true } },
      {
        $match: {
          'paymentHistory.status': 'Approved'
        }
      },
      {
        $group: {
          _id: null,
          totalCollected: { $sum: '$paymentHistory.amount' }
        }
      }
    ]);

    const stats = financialStats[0] || {};
    const totalCollected = paymentStats[0]?.totalCollected || 0;
    const defaultRate = totalLoans > 0 ? (overdueLoans / totalLoans) * 100 : 0;

    res.json({
      totalLoans,
      completeLoans,
      pendingLoans,
      overdueLoans,
      pendingApplications,
      totalAmount: stats.totalAmount || 0,
      totalDisbursed: stats.totalDisbursed || 0,
      totalCollected,
      averageInterestRate: stats.averageInterestRate || 0,
      defaultRate
    });
  } catch (error) {
    res.status(500).json({
      message: 'Error fetching loan statistics',
      error: error.message
    });
  }
};

// Get loan agreements (for useLoanData hook)
exports.getLoanAgreements = async (req, res) => {
  try {
    const loans = await Loan.find({
      loanStatus: { $in: ['Active', 'Completed'] },
      agreementGenerated: true
    })
      .populate('clientUserId', 'personalInfo registrationId')
      .sort({ createdAt: -1 });

    const agreements = loans.map(loan => ({
      id: loan._id.toString(),
      loanId: loan.loanApplicationId,
      borrowerId: loan.clientUserId._id.toString(),
      borrowerName: loan.clientUserId.personalInfo.fullName,
      amount: loan.loanAmount,
      interestRate: loan.interestRate,
      termMonths: loan.loanTerm,
      monthlyPayment: loan.monthlyInstallment,
      startDate: loan.createdAt,
      endDate: new Date(new Date(loan.createdAt).setMonth(
        new Date(loan.createdAt).getMonth() + loan.loanTerm
      )).toISOString(),
      status: loan.loanStatus === 'Completed' ? 'completed' : 'active',
      signedDate: loan.agreementGeneratedDate,
      documentUrl: loan.agreementUrl,
      createdAt: loan.createdAt,
      updatedAt: loan.updatedAt
    }));

    res.json(agreements);
  } catch (error) {
    res.status(500).json({
      message: 'Error fetching loan agreements',
      error: error.message
    });
  }
};