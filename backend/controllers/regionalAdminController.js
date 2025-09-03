const Staff = require("../models/Staff");
const Client = require("../models/Client");
const Loan = require("../models/Loan");
const Region = require("../models/Region");
const sendEmail = require("../utils/sendEmail");

// Get regional admin dashboard data
exports.getRegionalDashboard = async (req, res) => {
  try {
    const { regionalAdminId } = req.params;

    // Verify regional admin exists and get their region
    const regionalAdmin = await Staff.findById(regionalAdminId).populate(
      "region"
    );
    if (!regionalAdmin || regionalAdmin.role !== "regional_manager") {
      return res.status(404).json({ message: "Regional admin not found" });
    }

    const regionId = regionalAdmin.region?._id;
    if (!regionId) {
      return res
        .status(400)
        .json({ message: "Regional admin is not assigned to any region" });
    }

    // Get agents in this region
    const agentsInRegion = await Staff.find({
      role: "agent",
      region: regionId,
    });

    const agentIds = agentsInRegion.map((agent) => agent._id);

    // Get clients assigned to agents in this region
    const regionClients = await Client.find({
      assignedReviewer: { $in: agentIds },
    });
    const clientIds = regionClients.map((client) => client._id);

    // Loan statistics for the region
    const totalLoans = await Loan.countDocuments({
      clientUserId: { $in: clientIds },
    });
    const pendingLoans = await Loan.countDocuments({
      clientUserId: { $in: clientIds },
      "regionalAdminApproval.status": "Pending",
      "agentReview.status": "Approved",
    });
    const approvedLoans = await Loan.countDocuments({
      clientUserId: { $in: clientIds },
      "regionalAdminApproval.status": "Approved",
    });
    const activeLoans = await Loan.countDocuments({
      clientUserId: { $in: clientIds },
      loanStatus: "Active",
    });

    // Registration statistics
    const pendingRegistrations = await Client.countDocuments({
      assignedReviewer: { $in: agentIds },
      status: "Pending",
    });
    const approvedRegistrations = await Client.countDocuments({
      assignedReviewer: { $in: agentIds },
      status: "Approved",
    });

    // Payment statistics
    const pendingPayments = await Loan.countDocuments({
      clientUserId: { $in: clientIds },
      "paymentHistory.status": "Pending",
    });

    // Financial statistics
    const financialStats = await Loan.aggregate([
      {
        $match: {
          clientUserId: { $in: clientIds },
          "regionalAdminApproval.status": "Approved",
        },
      },
      {
        $group: {
          _id: null,
          totalLoanAmount: { $sum: "$loanAmount" },
          totalCommission: { $sum: { $multiply: ["$loanAmount", 0.02] } }, // 2% commission
          averageLoanAmount: { $avg: "$loanAmount" },
        },
      },
    ]);

    // Recent activity
    const recentApprovedLoans = await Loan.find({
      clientUserId: { $in: clientIds },
      "regionalAdminApproval.status": "Approved",
    })
      .populate("clientUserId", "personalInfo registrationId")
      .populate("regionalAdminApproval.approvedBy", "name email")
      .sort({ "regionalAdminApproval.approvalDate": -1 })
      .limit(5);

    const recentPendingLoans = await Loan.find({
      clientUserId: { $in: clientIds },
      "regionalAdminApproval.status": "Pending",
      "agentReview.status": "Approved",
    })
      .populate("clientUserId", "personalInfo registrationId")
      .populate("agentReview.reviewedBy", "name email")
      .sort({ createdAt: -1 })
      .limit(5);

    res.json({
      regionalAdmin: {
        id: regionalAdmin._id,
        name: regionalAdmin.name,
        email: regionalAdmin.email,
        region: regionalAdmin.region,
      },
      stats: {
        totalAgents: agentsInRegion.length,
        totalBorrowers: regionClients.length,
        totalLoans,
        pendingLoans,
        approvedLoans,
        activeLoans,
        pendingRegistrations,
        approvedRegistrations,
        pendingPayments,
        totalLoanAmount: financialStats[0]?.totalLoanAmount || 0,
        totalCommission: financialStats[0]?.totalCommission || 0,
        averageLoanAmount: financialStats[0]?.averageLoanAmount || 0,
      },
      recentActivity: {
        approvedLoans: recentApprovedLoans,
        pendingLoans: recentPendingLoans,
      },
    });
  } catch (error) {
    res.status(500).json({
      message: "Error fetching regional dashboard data",
      error: error.message,
    });
  }
};

// Debug endpoint to check data
exports.debugRegionalData = async (req, res) => {
  try {
    const { regionalAdminId } = req.params;

    const regionalAdmin = await Staff.findById(regionalAdminId).populate("region");
    const allStaff = await Staff.find({ role: "regional_manager" }).populate("region");
    const allAgents = await Staff.find({ role: "agent" }).populate("region");
    const allClients = await Client.find().populate("assignedReviewer");
    const allLoans = await Loan.find().populate("clientUserId", "personalInfo registrationId");

    // Get a simple list of all loans for any regional admin
    const simpleLoans = await Loan.find()
      .populate("clientUserId", "personalInfo registrationId")
      .populate("agentReview.reviewedBy", "name email")
      .limit(5);

    res.json({
      regionalAdmin,
      allRegionalManagers: allStaff,
      allAgents: allAgents.length,
      allClients: allClients.length,
      allLoans: allLoans.length,
      sampleLoan: allLoans[0],
      simpleLoans: simpleLoans,
      testQuery: {
        regionalAdminId,
        hasRegionalAdmin: !!regionalAdmin,
        regionId: regionalAdmin?.region?._id
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get all loans for regional admin (with filtering and search)
exports.getRegionalLoans = async (req, res) => {
  try {
    const { regionalAdminId } = req.params;
    const { page = 1, limit = 10, search = '', status } = req.query;

    console.log('getRegionalLoans called with:', {
      regionalAdminId,
      page,
      limit,
      search,
      status
    });

    // Verify regional admin and get their region
    const regionalAdmin = await Staff.findById(regionalAdminId).populate("region");
    if (!regionalAdmin || regionalAdmin.role !== "regional_manager") {
      console.log('Regional admin not found or wrong role:', { regionalAdmin: !!regionalAdmin, role: regionalAdmin?.role });
      // For testing, let's return all loans if regional admin not found
      const allLoans = await Loan.find()
        .populate("clientUserId", "personalInfo registrationId")
        .populate("agentReview.reviewedBy", "name email")
        .populate("regionalAdminApproval.approvedBy", "name email")
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(parseInt(limit));

      const total = await Loan.countDocuments();

      return res.json({
        message: "All loans fetched (no regional admin found)",
        loans: allLoans,
        total,
        page: parseInt(page),
        pages: Math.ceil(total / limit),
      });
    }

    const regionId = regionalAdmin.region?._id;
    if (!regionId) {
      console.log('Regional admin has no region assigned');
      // For testing, let's return all loans if no region assigned
      const allLoans = await Loan.find()
        .populate("clientUserId", "personalInfo registrationId")
        .populate("agentReview.reviewedBy", "name email")
        .populate("regionalAdminApproval.approvedBy", "name email")
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(parseInt(limit));

      const total = await Loan.countDocuments();

      return res.json({
        message: "All loans fetched (no region assigned)",
        loans: allLoans,
        total,
        page: parseInt(page),
        pages: Math.ceil(total / limit),
      });
    }

    // Get agents in this region
    const agentsInRegion = await Staff.find({
      role: "agent",
      region: regionId,
    });
    const agentIds = agentsInRegion.map((agent) => agent._id);

    // Get clients assigned to these agents
    const regionClients = await Client.find({
      assignedReviewer: { $in: agentIds },
    });
    const clientIds = regionClients.map((client) => client._id);

    // Build query for loans
    let query = {
      clientUserId: { $in: clientIds },
    };

    // Add status filter
    if (status && status !== 'All Loans') {
      if (status === 'Pending') {
        query["agentReview.status"] = "Approved";
        query["regionalAdminApproval.status"] = "Pending";
      } else {
        query["regionalAdminApproval.status"] = status;
      }
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

      // Add search conditions to loan query
      query.$or = [
        { loanApplicationId: { $regex: search, $options: 'i' } },
        { product: { $regex: search, $options: 'i' } },
        { purpose: { $regex: search, $options: 'i' } },
        { clientUserId: { $in: matchingClientIds } }
      ];
    }

    const loans = await Loan.find(query)
      .populate("clientUserId", "personalInfo registrationId")
      .populate("agentReview.reviewedBy", "name email")
      .populate("regionalAdminApproval.approvedBy", "name email")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await Loan.countDocuments(query);

    // Calculate filter counts
    const baseQuery = { clientUserId: { $in: clientIds } };

    const filterCounts = {
      all: await Loan.countDocuments(baseQuery),
      pending: await Loan.countDocuments({
        ...baseQuery,
        "agentReview.status": "Approved",
        "regionalAdminApproval.status": "Pending"
      }),
      approved: await Loan.countDocuments({
        ...baseQuery,
        "regionalAdminApproval.status": "Approved"
      }),
      rejected: await Loan.countDocuments({
        ...baseQuery,
        "regionalAdminApproval.status": "Rejected"
      })
    };

    console.log('Query result:', {
      loansCount: loans.length,
      total,
      query,
      sampleLoan: loans[0],
      clientIds: clientIds.length,
      agentIds: agentIds.length,
      filterCounts
    });

    // If no loans found in region, return all loans for testing
    if (loans.length === 0 && total === 0) {
      console.log('No loans found in region, returning all loans for testing');
      const allLoans = await Loan.find()
        .populate("clientUserId", "personalInfo registrationId")
        .populate("agentReview.reviewedBy", "name email")
        .populate("regionalAdminApproval.approvedBy", "name email")
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(parseInt(limit));

      const allTotal = await Loan.countDocuments();

      // Calculate filter counts for all loans
      const allFilterCounts = {
        all: allTotal,
        pending: await Loan.countDocuments({
          "agentReview.status": "Approved",
          "regionalAdminApproval.status": "Pending"
        }),
        approved: await Loan.countDocuments({
          "regionalAdminApproval.status": "Approved"
        }),
        rejected: await Loan.countDocuments({
          "regionalAdminApproval.status": "Rejected"
        })
      };

      return res.json({
        message: "All loans fetched (no regional loans found)",
        loans: allLoans,
        total: allTotal,
        page: parseInt(page),
        pages: Math.ceil(allTotal / limit),
        filterCounts: allFilterCounts
      });
    }

    res.json({
      message: "Regional loans fetched successfully",
      loans,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / limit),
      filterCounts
    });
  } catch (error) {
    res.status(500).json({
      message: "Error fetching regional loans",
      error: error.message,
    });
  }
};

// Get pending loans for regional admin approval
exports.getPendingLoansForApproval = async (req, res) => {
  try {
    const { regionalAdminId } = req.params;
    const { page = 1, limit = 10, search = '', status } = req.query;

    // Verify regional admin and get their region
    const regionalAdmin = await Staff.findById(regionalAdminId).populate(
      "region"
    );
    if (!regionalAdmin || regionalAdmin.role !== "regional_manager") {
      return res.status(404).json({ message: "Regional admin not found" });
    }

    const regionId = regionalAdmin.region?._id;
    if (!regionId) {
      return res
        .status(400)
        .json({ message: "Regional admin is not assigned to any region" });
    }

    // Get agents in this region
    const agentsInRegion = await Staff.find({
      role: "agent",
      region: regionId,
    });
    const agentIds = agentsInRegion.map((agent) => agent._id);

    // Get clients assigned to these agents
    const regionClients = await Client.find({
      assignedReviewer: { $in: agentIds },
    });
    const clientIds = regionClients.map((client) => client._id);

    // Build query for loans
    let query = {
      clientUserId: { $in: clientIds },
    };

    // Add status filter
    if (status && status !== 'All Loans') {
      if (status === 'Pending') {
        query["agentReview.status"] = "Approved";
        query["regionalAdminApproval.status"] = "Pending";
      } else {
        query["regionalAdminApproval.status"] = status;
      }
    } else {
      // Default to pending loans for approval
      query["agentReview.status"] = "Approved";
      query["regionalAdminApproval.status"] = "Pending";
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

      // Add search conditions to loan query
      query.$or = [
        { loanApplicationId: { $regex: search, $options: 'i' } },
        { product: { $regex: search, $options: 'i' } },
        { purpose: { $regex: search, $options: 'i' } },
        { clientUserId: { $in: matchingClientIds } }
      ];
    }

    const pendingLoans = await Loan.find(query)
      .populate("clientUserId", "personalInfo registrationId")
      .populate("agentReview.reviewedBy", "name email")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await Loan.countDocuments(query);

    res.json({
      message: "Pending loans fetched successfully",
      loans: pendingLoans,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / limit),
    });
  } catch (error) {
    res.status(500).json({
      message: "Error fetching pending loans",
      error: error.message,
    });
  }
};

// Approve or reject a loan
exports.approveRejectLoan = async (req, res) => {
  try {
    const { regionalAdminId, loanId } = req.params;
    const { status, comments } = req.body;

    if (!["Approved", "Rejected"].includes(status)) {
      return res
        .status(400)
        .json({ message: "Status must be either Approved or Rejected" });
    }

    // Verify regional admin exists
    const regionalAdmin = await Staff.findById(regionalAdminId);
    if (!regionalAdmin || regionalAdmin.role !== "regional_manager") {
      return res.status(404).json({ message: "Regional admin not found" });
    }

    // Find the loan
    const loan = await Loan.findOne({ loanApplicationId: loanId }).populate(
      "clientUserId"
    );

    if (!loan) {
      return res.status(404).json({ message: "Loan not found" });
    }

    // Verify loan is in the regional admin's jurisdiction
    const client = await Client.findById(loan.clientUserId);
    const agent = await Staff.findById(client.assignedReviewer);

    if (agent.region.toString() !== regionalAdmin.region?.toString()) {
      return res
        .status(403)
        .json({ message: "Not authorized to approve this loan" });
    }

    // Update loan status
    loan.regionalAdminApproval = {
      approvedBy: regionalAdminId,
      approvalDate: new Date(),
      status,
      comments,
    };

    if (status === "Approved") {
      loan.loanStatus = "Approved";
    } else {
      loan.loanStatus = "Rejected";
    }

    await loan.save();

    // Send notification email to client
    const clientEmail = loan.clientUserId.personalInfo?.email;
    if (clientEmail) {
      const message = `Your loan application ${loanId} has been ${status.toLowerCase()} by the regional admin. ${comments ? "Comments: " + comments : ""
        }`;
      await sendEmail(clientEmail, `Loan Application ${status}`, message);
    }

    res.json({
      message: `Loan ${status.toLowerCase()} successfully`,
      loan,
    });
  } catch (error) {
    res.status(500).json({
      message: "Error processing loan approval",
      error: error.message,
    });
  }
};

// Get all agents in the regional admin's region
exports.getAgentsInRegion = async (req, res) => {
  try {
    const { regionalAdminId } = req.params;
    const { page = 1, limit = 10 } = req.query;

    // Verify regional admin and get their region
    const regionalAdmin = await Staff.findById(regionalAdminId).populate(
      "region"
    );
    if (!regionalAdmin || regionalAdmin.role !== "regional_manager") {
      return res.status(404).json({ message: "Regional admin not found" });
    }

    const regionId = regionalAdmin.region?._id;
    if (!regionId) {
      return res
        .status(400)
        .json({ message: "Regional admin is not assigned to any region" });
    }

    const query = { role: "agent", region: regionId };

    const agents = await Staff.find(query)
      .populate("region", "name districts")
      .select("-password")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await Staff.countDocuments(query);

    // Get performance data for each agent
    const agentsWithStats = await Promise.all(
      agents.map(async (agent) => {
        const clientCount = await Client.countDocuments({
          assignedReviewer: agent._id,
        });
        const loanCount = await Loan.countDocuments({
          clientUserId: {
            $in: await Client.find({ assignedReviewer: agent._id }).distinct(
              "_id"
            ),
          },
        });
        const approvedLoanCount = await Loan.countDocuments({
          clientUserId: {
            $in: await Client.find({ assignedReviewer: agent._id }).distinct(
              "_id"
            ),
          },
          "regionalAdminApproval.status": "Approved",
        });

        // Calculate commission
        const approvedLoans = await Loan.find({
          clientUserId: {
            $in: await Client.find({ assignedReviewer: agent._id }).distinct(
              "_id"
            ),
          },
          "regionalAdminApproval.status": "Approved",
        });

        const totalCommission = approvedLoans.reduce(
          (sum, loan) => sum + loan.loanAmount * 0.02,
          0
        );

        return {
          ...agent.toObject(),
          performance: {
            clientsManaged: clientCount,
            loansProcessed: loanCount,
            loansApproved: approvedLoanCount,
            totalCommission,
            approvalRate:
              loanCount > 0
                ? Math.round((approvedLoanCount / loanCount) * 100)
                : 0,
          },
        };
      })
    );

    res.json({
      message: "Agents in region fetched successfully",
      agents: agentsWithStats,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / limit),
    });
  } catch (error) {
    res.status(500).json({
      message: "Error fetching agents in region",
      error: error.message,
    });
  }
};

// Get pending borrower registrations in the region
exports.getPendingRegistrations = async (req, res) => {
  try {
    const { regionalAdminId } = req.params;
    const { page = 1, limit = 10 } = req.query;

    // Verify regional admin and get their region
    const regionalAdmin = await Staff.findById(regionalAdminId).populate(
      "region"
    );
    if (!regionalAdmin || regionalAdmin.role !== "regional_manager") {
      return res.status(404).json({ message: "Regional admin not found" });
    }

    const regionId = regionalAdmin.region?._id;
    if (!regionId) {
      return res
        .status(400)
        .json({ message: "Regional admin is not assigned to any region" });
    }

    // Get agents in this region
    const agentsInRegion = await Staff.find({
      role: "agent",
      region: regionId,
    });
    const agentIds = agentsInRegion.map((agent) => agent._id);

    // Find pending registrations assigned to these agents
    const query = {
      assignedReviewer: { $in: agentIds },
      status: "Pending",
    };

    const pendingRegistrations = await Client.find(query)
      .populate("assignedReviewer", "name email")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await Client.countDocuments(query);

    res.json({
      message: "Pending registrations fetched successfully",
      registrations: pendingRegistrations,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / limit),
    });
  } catch (error) {
    res.status(500).json({
      message: "Error fetching pending registrations",
      error: error.message,
    });
  }
};

// Approve or reject borrower registration
exports.approveRejectRegistration = async (req, res) => {
  try {
    const { regionalAdminId, registrationId } = req.params;
    const { status } = req.body;

    if (!["Approved", "Rejected"].includes(status)) {
      return res
        .status(400)
        .json({ message: "Status must be either Approved or Rejected" });
    }

    // Verify regional admin exists
    const regionalAdmin = await Staff.findById(regionalAdminId);
    if (!regionalAdmin || regionalAdmin.role !== "regional_manager") {
      return res.status(404).json({ message: "Regional admin not found" });
    }

    // Find the registration
    const registration = await Client.findOne({ registrationId });
    if (!registration) {
      return res.status(404).json({ message: "Registration not found" });
    }

    // Verify registration is in the regional admin's jurisdiction
    const agent = await Staff.findById(registration.assignedReviewer);
    if (agent.region.toString() !== regionalAdmin.region?.toString()) {
      return res
        .status(403)
        .json({ message: "Not authorized to approve this registration" });
    }

    // Update registration status
    registration.status = status;
    if (status === "Approved") {
      registration.approvedAt = new Date();
    } else {
      registration.rejectedAt = new Date();
    }

    await registration.save();

    res.json({
      message: `Registration ${status.toLowerCase()} successfully`,
      registration,
    });
  } catch (error) {
    res.status(500).json({
      message: "Error processing registration approval",
      error: error.message,
    });
  }
};

// Get pending payments in the region
exports.getPendingPayments = async (req, res) => {
  try {
    const { regionalAdminId } = req.params;
    const { page = 1, limit = 10 } = req.query;

    // Verify regional admin and get their region
    const regionalAdmin = await Staff.findById(regionalAdminId).populate(
      "region"
    );
    if (!regionalAdmin || regionalAdmin.role !== "regional_manager") {
      return res.status(404).json({ message: "Regional admin not found" });
    }

    const regionId = regionalAdmin.region?._id;
    if (!regionId) {
      return res
        .status(400)
        .json({ message: "Regional admin is not assigned to any region" });
    }

    // Get agents in this region
    const agentsInRegion = await Staff.find({
      role: "agent",
      region: regionId,
    });
    const agentIds = agentsInRegion.map((agent) => agent._id);

    // Get clients assigned to these agents
    const regionClients = await Client.find({
      assignedReviewer: { $in: agentIds },
    });
    const clientIds = regionClients.map((client) => client._id);

    // Find loans with pending payments
    const loansWithPendingPayments = await Loan.find({
      clientUserId: { $in: clientIds },
      "paymentHistory.status": "Pending",
    })
      .populate("clientUserId", "personalInfo registrationId")
      .populate("paymentHistory.approvedBy", "name email");

    // Extract pending payments
    const pendingPayments = [];
    loansWithPendingPayments.forEach((loan) => {
      loan.paymentHistory.forEach((payment) => {
        if (payment.status === "Pending") {
          pendingPayments.push({
            paymentId: payment.paymentId,
            loanId: loan.loanApplicationId,
            clientId: loan.clientUserId._id,
            clientName: loan.clientUserId.personalInfo?.fullName,
            amount: payment.amount,
            paymentDate: payment.paymentDate,
            paymentMethod: payment.paymentMethod,
            paymentSlipUrl: payment.paymentSlipUrl,
            loanAmount: loan.loanAmount,
            createdAt: payment.createdAt,
          });
        }
      });
    });

    // Apply pagination
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + parseInt(limit);
    const paginatedPayments = pendingPayments.slice(startIndex, endIndex);

    res.json({
      message: "Pending payments fetched successfully",
      payments: paginatedPayments,
      total: pendingPayments.length,
      page: parseInt(page),
      pages: Math.ceil(pendingPayments.length / limit),
    });
  } catch (error) {
    res.status(500).json({
      message: "Error fetching pending payments",
      error: error.message,
    });
  }
};

// Approve or reject payment
exports.approveRejectPayment = async (req, res) => {
  try {
    const { regionalAdminId } = req.params;
    const { paymentId, status, rejectedReason } = req.body;

    if (!["Approved", "Rejected"].includes(status)) {
      return res
        .status(400)
        .json({ message: "Status must be either Approved or Rejected" });
    }

    // Verify regional admin exists
    const regionalAdmin = await Staff.findById(regionalAdminId);
    if (!regionalAdmin || regionalAdmin.role !== "regional_manager") {
      return res.status(404).json({ message: "Regional admin not found" });
    }

    // Find the loan with this payment
    const loan = await Loan.findOne({
      "paymentHistory.paymentId": paymentId,
    }).populate("clientUserId");

    if (!loan) {
      return res.status(404).json({ message: "Payment not found" });
    }

    // Verify payment is in the regional admin's jurisdiction
    const client = await Client.findById(loan.clientUserId);
    const agent = await Staff.findById(client.assignedReviewer);

    if (agent.region.toString() !== regionalAdmin.region?.toString()) {
      return res
        .status(403)
        .json({ message: "Not authorized to approve this payment" });
    }

    // Update payment status
    const payment = loan.paymentHistory.id(paymentId);
    if (!payment) {
      return res.status(404).json({ message: "Payment not found" });
    }

    payment.status = status;
    if (status === "Approved") {
      payment.approvedBy = regionalAdminId;
      payment.approvedAt = new Date();
    } else {
      payment.rejectedReason = rejectedReason;
    }

    await loan.save();

    res.json({
      message: `Payment ${status.toLowerCase()} successfully`,
      payment,
    });
  } catch (error) {
    res.status(500).json({
      message: "Error processing payment approval",
      error: error.message,
    });
  }
};

// Generate regional report
exports.generateRegionalReport = async (req, res) => {
  try {
    const { regionalAdminId } = req.params;
    const { startDate, endDate } = req.body;

    // Verify regional admin and get their region
    const regionalAdmin = await Staff.findById(regionalAdminId).populate(
      "region"
    );
    if (!regionalAdmin || regionalAdmin.role !== "regional_manager") {
      return res.status(404).json({ message: "Regional admin not found" });
    }

    const regionId = regionalAdmin.region?._id;
    if (!regionId) {
      return res
        .status(400)
        .json({ message: "Regional admin is not assigned to any region" });
    }

    // Date filters
    const dateFilter = {};
    if (startDate && endDate) {
      dateFilter.createdAt = {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      };
    }

    // Get agents in this region
    const agentsInRegion = await Staff.find({
      role: "agent",
      region: regionId,
    });
    const agentIds = agentsInRegion.map((agent) => agent._id);

    // Get clients assigned to these agents
    const regionClients = await Client.find({
      assignedReviewer: { $in: agentIds },
      ...dateFilter,
    });
    const clientIds = regionClients.map((client) => client._id);

    // Get loans data
    const loans = await Loan.find({
      clientUserId: { $in: clientIds },
      ...dateFilter,
    });

    // Calculate statistics
    const totalLoans = loans.length;
    const approvedLoans = loans.filter(
      (loan) => loan.regionalAdminApproval?.status === "Approved"
    ).length;
    const rejectedLoans = loans.filter(
      (loan) => loan.regionalAdminApproval?.status === "Rejected"
    ).length;
    const activeLoans = loans.filter(
      (loan) => loan.loanStatus === "Active"
    ).length;

    const totalLoanAmount = loans.reduce(
      (sum, loan) => sum + loan.loanAmount,
      0
    );
    const totalCommission = loans.reduce((sum, loan) => {
      if (loan.regionalAdminApproval?.status === "Approved") {
        return sum + loan.loanAmount * 0.02;
      }
      return sum;
    }, 0);

    // Get payment data
    const allPayments = loans.flatMap((loan) => loan.paymentHistory);
    const approvedPayments = allPayments.filter(
      (payment) => payment.status === "Approved"
    );
    const totalPaymentsAmount = approvedPayments.reduce(
      (sum, payment) => sum + payment.amount,
      0
    );

    res.json({
      report: {
        period: {
          startDate: startDate || "All time",
          endDate: endDate || "Present",
        },
        region: regionalAdmin.region,
        statistics: {
          totalAgents: agentsInRegion.length,
          totalBorrowers: regionClients.length,
          totalLoans,
          approvedLoans,
          rejectedLoans,
          activeLoans,
          approvalRate:
            totalLoans > 0 ? Math.round((approvedLoans / totalLoans) * 100) : 0,
          totalLoanAmount,
          totalCommission,
          totalPayments: approvedPayments.length,
          totalPaymentsAmount,
        },
        agents: agentsInRegion.map((agent) => ({
          id: agent._id,
          name: agent.name,
          email: agent.email,
          performance: {
            clientsManaged: regionClients.filter(
              (client) =>
                client.assignedReviewer.toString() === agent._id.toString()
            ).length,
            loansProcessed: loans.filter((loan) => {
              const client = regionClients.find(
                (c) => c._id.toString() === loan.clientUserId.toString()
              );
              return (
                client &&
                client.assignedReviewer.toString() === agent._id.toString()
              );
            }).length,
          },
        })),
      },
    });
  } catch (error) {
    res.status(500).json({
      message: "Error generating regional report",
      error: error.message,
    });
  }
};
