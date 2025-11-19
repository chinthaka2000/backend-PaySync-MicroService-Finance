/**
 * @fileoverview Loan Controller - Handles loan management operations
 * @module controllers/loanController
 */

const mongoose = require("mongoose");
const Loan = require("../models/Loan");
const Client = require("../models/Client");
const Staff = require("../models/Staff");
const Grantor = require('../models/Grantor'); // Your Grantor model (not directly used here, but available)
const Payment = require('../models/Payment');
const sendEmail = require("../utils/sendEmail");
const emailService = require("../services/emailService");
const {
  validateLoanApplication,
  validateLoanStatusUpdate,
  calculateMonthlyPayment,
} = require("../validation/businessRules");
const LoanRepository = require("../repositories/LoanRepository");
const { AppError } = require("../utils/customErrors");
const { logger } = require("../utils/logger");

/**
 * Create a new loan application with enhanced validation and workflow
 * @async
 * @function createLoanApplication
 * @param {Object} req - Express request object
 * @param {Object} req.body - Loan application data
 * @param {string} req.body.clientUserId - Client ID applying for loan
 * @param {number} req.body.loanAmount - Requested loan amount
 * @param {number} req.body.loanTerm - Loan term in months
 * @param {number} req.body.interestRate - Annual interest rate percentage
 * @param {string} req.body.purpose - Purpose of the loan
 * @param {Object} req.body.guarantorInfo - Guarantor information
 * @param {Object} req.user - Authenticated user from middleware
 * @param {Object} res - Express response object
 * @returns {Promise<void>} JSON response with loan creation result
 * @throws {AppError} When validation fails or client not found
 *
 * @example
 * // POST /api/loans
 * {
 *   "clientUserId": "507f1f77bcf86cd799439011",
 *   "loanAmount": 50000,
 *   "loanTerm": 12,
 *   "interestRate": 15,
 *   "purpose": "business",
 *   "guarantorInfo": {
 *     "name": "John Doe",
 *     "relationship": "friend",
 *     "phone": "1234567890"
 *   }
 * }
 *
 * @example
 * // Success Response (201)
 * {
 *   "success": true,
 *   "message": "Loan application created successfully",
 *   "data": {
 *     "loan": {
 *       "_id": "507f1f77bcf86cd799439012",
 *       "loanApplicationId": "LA-2024-001",
 *       "loanAmount": 50000,
 *       "loanStatus": "pending",
 *       "monthlyInstallment": 4500.25
 *     }
 *   }
 * }
 */
// exports.createLoanApplication = async (req, res) => {
//   try {
//     const loanData = req.body;
//     const user = req.user; // From authentication middleware
//     const loanRepository = new LoanRepository();

//     logger.info("Creating loan application", {
//       userId: user.userId,
//       clientId: loanData.clientUserId,
//       loanAmount: loanData.loanAmount,
//     });

//     // Perform comprehensive business rule validation
//     const validation = await validateLoanApplication(loanData, user);

//     if (!validation.isValid) {
//       logger.warn("Loan application validation failed", {
//         userId: user.userId,
//         errors: validation.errors,
//       });

//       return res.status(400).json({
//         success: false,
//         error: {
//           code: "BUSINESS_RULE_VIOLATION",
//           message: "Loan application violates business rules",
//           details: validation.errors,
//           timestamp: new Date().toISOString(),
//         },
//       });
//     }

//     // Get client information for workflow assignment
//     const client = await Client.findById(loanData.clientUserId)
//       .populate("assignedAgent")
//       .populate("assignedRegionalManager");

//     if (!client) {
//       throw new AppError("Client not found", 404, "CLIENT_NOT_FOUND");
//     }

//     // Calculate monthly payment and total payable amount
//     const monthlyPayment = calculateMonthlyPayment(
//       loanData.loanAmount,
//       loanData.interestRate || 12, // Default 12% if not provided
//       loanData.loanTerm
//     );

//     const totalPayableAmount = monthlyPayment * loanData.loanTerm;

//     // Generate unique loan application ID
//     const loanApplicationId = await generateLoanApplicationId();

//     // Create loan with enhanced workflow tracking
//     const newLoan = new Loan({
//       ...loanData,
//       loanApplicationId,
//       monthlyInstallment: monthlyPayment,
//       totalPayableAmount,
//       loanStatus: "pending",

//       // Assign to agent and regional manager from client
//       assignedAgent: client.assignedAgent?._id,
//       assignedRegionalManager: client.assignedRegionalManager?._id,
//       region: client.assignedAgent?.region || user.region,

//       // Initialize workflow state
//       workflowState: {
//         currentStage: "application_submitted",
//         stageHistory: [
//           {
//             stage: "application_submitted",
//             enteredAt: new Date(),
//             performedBy: user.userId,
//           },
//         ],
//       },

//       // Initialize review states
//       agentReview: {
//         status: "pending",
//         assignedTo: client.assignedAgent?._id,
//       },
//       regionalAdminApproval: {
//         status: "pending",
//         assignedTo: client.assignedRegionalManager?._id,
//       },

//       // Initialize audit trail
//       auditTrail: [
//         {
//           action: "loan_created",
//           performedBy: user.userId,
//           timestamp: new Date(),
//           changes: {
//             status: "pending",
//             stage: "application_submitted",
//             assignedAgent: client.assignedAgent?._id,
//             assignedRegionalManager: client.assignedRegionalManager?._id,
//           },
//           ipAddress: req.ip,
//           userAgent: req.get("User-Agent"),
//         },
//       ],

//       // Calculated fields for performance
//       calculatedFields: {
//         totalInterest: totalPayableAmount - loanData.loanAmount,
//         remainingBalance: loanData.loanAmount,
//         nextPaymentDate: null, // Will be set when loan is approved
//         daysOverdue: 0,
//       },

//       // Searchable text for full-text search
//       searchableText: `${loanApplicationId} ${client.personalInfo?.fullName} ${loanData.product} ${loanData.purpose}`,

//       createdBy: user.userId,
//     });

//     await newLoan.save();

//     // Send notification to assigned agent
//     if (client.assignedAgent?.personalInfo?.email) {
//       try {
//         await sendEmail(
//           client.assignedAgent.personalInfo.email,
//           "New Loan Application Assigned",
//           `A new loan application (${loanApplicationId}) has been assigned to you for review. 
//            Client: ${client.personalInfo?.fullName}
//            Amount: Rs. ${loanData.loanAmount.toLocaleString()}
//            Please review and process the application.`
//         );
//       } catch (emailError) {
//         logger.error("Failed to send notification email", emailError, {
//           loanId: newLoan._id,
//           agentEmail: client.assignedAgent.personalInfo.email,
//         });
//       }
//     }

//     logger.info("Loan application created successfully", {
//       loanId: newLoan._id,
//       loanApplicationId,
//       userId: user.userId,
//     });

//     res.status(201).json({
//       success: true,
//       message: "Loan application created successfully",
//       data: {
//         loan: newLoan,
//         loanId: newLoan._id,
//         loanApplicationId,
//         monthlyPayment,
//         totalPayableAmount,
//       },
//       timestamp: new Date().toISOString(),
//     });
//   } catch (error) {
//     logger.error("Error creating loan application", error, {
//       userId: req.user?.userId,
//       loanData: req.body,
//     });

//     if (error instanceof AppError) {
//       return res.status(error.statusCode).json({
//         success: false,
//         error: {
//           code: error.errorCode,
//           message: error.message,
//           timestamp: new Date().toISOString(),
//         },
//       });
//     }

//     res.status(500).json({
//       success: false,
//       error: {
//         code: "INTERNAL_SERVER_ERROR",
//         message: "Error creating loan application",
//         timestamp: new Date().toISOString(),
//       },
//     });
//   }
// };


exports.createLoanApplication = async (req, res) => {
  try {
    const loanData = req.body;
    const user = req.user; // From authentication middleware
    const loanRepository = new LoanRepository();

    logger.info("Registering loan application", {
      userId: user.userId,
      loanAmount: loanData.loanAmount,
    });

    // 🧠 STEP 1: Handling clientUserId
    if (user.role === "Client") {
      // If logged-in user is Client, auto-assign their own ID
      loanData.clientUserId = user.userId;
    } else {
      // If staff submits loan, they MUST provide clientUserId
      if (!loanData.clientUserId) {
        return res.status(400).json({
          success: false,
          error: {
            code: "CLIENT_ID_REQUIRED",
            message: "clientUserId must be provided when submitted by staff.",
            timestamp: new Date().toISOString(),
          },
        });
      }
    }

    // Perform comprehensive business rule validation
    const validation = await validateLoanApplication(loanData, user);
    if (!validation.isValid) {
      logger.warn("Loan application validation failed", {
        userId: user.userId,
        errors: validation.errors,
      });
      return res.status(400).json({
        success: false,
        error: {
          code: "BUSINESS_RULE_VIOLATION",
          message: "Loan application violates business rules",
          details: validation.errors,
          timestamp: new Date().toISOString(),
        },
      });
    }

    // Get client information for workflow assignment
    const client = await Client.findById(loanData.clientUserId)
      .populate("assignedAgent")
      .populate("region");
    if (!client) {
      throw new AppError("Client not found", 404, "CLIENT_NOT_FOUND");
    }

    // Calculate monthly payment and total payable amount
    const monthlyPayment = calculateMonthlyPayment(
      loanData.loanAmount,
      loanData.interestRate || 12, // Default 12% if not provided
      loanData.loanTerm
    );
    const totalPayableAmount = monthlyPayment * loanData.loanTerm;

    // Generate unique loan application ID
    const loanApplicationId = await generateLoanApplicationId();

    // Handle guarantor creation (integrating Grantor model)
    let primaryGuarantorId = null;
    let secondaryGuarantorId = null;

    // Create primary guarantor if provided
    if (loanData.primaryGuarantor) {
      const { name, id, phoneNumber } = loanData.primaryGuarantor;
      if (!name || !id || !phoneNumber) {
        return res.status(400).json({
          success: false,
          error: {
            code: "INVALID_INPUT",
            message: "Primary guarantor must include name, id, and phoneNumber",
            timestamp: new Date().toISOString(),
          },
        });
      }
      const primaryGuarantor = new Grantor({
        grantorId: `GR${Date.now()}${Math.random().toString(36).substr(2, 5).toUpperCase()}`, // Generate unique ID
        personalInfo: {
          fullName: name,
          contactNumber: phoneNumber,
        },
        identityVerification: {
          idType: "NIC", // Default; adjust if needed
          idNumber: id,
        },
        // Other fields (e.g., employmentDetails) left empty
      });
      await primaryGuarantor.save();
      primaryGuarantorId = primaryGuarantor._id;
      logger.info("Primary guarantor created", { grantorId: primaryGuarantor.grantorId });
    }

    // Create secondary guarantor if provided
    if (loanData.secondaryGuarantor) {
      const { name, id, phoneNumber } = loanData.secondaryGuarantor;
      if (!name || !id || !phoneNumber) {
        return res.status(400).json({
          success: false,
          error: {
            code: "INVALID_INPUT",
            message: "Secondary guarantor must include name, id, and phoneNumber",
            timestamp: new Date().toISOString(),
          },
        });
      }
      const secondaryGuarantor = new Grantor({
        grantorId: `GR${Date.now()}${Math.random().toString(36).substr(2, 5).toUpperCase()}`, // Generate unique ID
        personalInfo: {
          fullName: name,
          contactNumber: phoneNumber,
        },
        identityVerification: {
          idType: "NIC", // Default; adjust if needed
          idNumber: id,
        },
        // Other fields (e.g., employmentDetails) left empty
      });
      await secondaryGuarantor.save();
      secondaryGuarantorId = secondaryGuarantor._id;
      logger.info("Secondary guarantor created", { grantorId: secondaryGuarantor.grantorId });
    }

    // Create loan with enhanced workflow tracking (integrating Loan model)
    const newLoan = new Loan({
      ...loanData,
      loanApplicationId,
      monthlyInstallment: monthlyPayment,
      totalPayableAmount,
      loanStatus: "pending",
      primaryGuarantor: primaryGuarantorId, // Link to created Grantor
      secondaryGuarantor: secondaryGuarantorId, // Link to created Grantor
      payments: [], // Initialize empty array for future Payment refs

      // Assign to agent and regional manager from client
      assignedAgent: client.assignedAgent?._id,
      assignedRegionalManager: client.assignedRegionalManager?._id,
      region: client.assignedAgent?.region || user.region,

      // Initialize workflow state
      workflowState: {
        currentStage: "application_submitted",
        stageHistory: [
          {
            stage: "application_submitted",
            enteredAt: new Date(),
            performedBy: user.userId,
          },
        ],
      },

      // Initialize review states
      agentReview: {
        status: "pending",
        assignedTo: client.assignedAgent?._id,
      },
      regionalAdminApproval: {
        status: "pending",
        assignedTo: client.assignedRegionalManager?._id,
      },

      // Initialize audit trail
      auditTrail: [
        {
          action: "loanApplication_created",
          performedBy: user.userId,
          timestamp: new Date(),
          changes: {
            status: "pending",
            stage: "application_submitted",
            assignedAgent: client.assignedAgent?._id,
            assignedRegionalManager: client.assignedRegionalManager?._id,
            primaryGuarantor: primaryGuarantorId,
            secondaryGuarantor: secondaryGuarantorId,
          },
          ipAddress: req.ip,
          userAgent: req.get("User-Agent"),
        },
      ],

      // Calculated fields for performance
      calculatedFields: {
        totalInterest: totalPayableAmount - loanData.loanAmount,
        remainingBalance: loanData.loanAmount,
        nextPaymentDate: null, // Will be set when loan is approved
        daysOverdue: 0,
      },

      // Searchable text for full-text search
      searchableText: `${loanApplicationId} ${client.personalInfo?.fullName} ${loanData.product} ${loanData.purpose}`,

      createdBy: user.userId,
    });

    await newLoan.save();

    // Send notification to assigned agent
    if (client.assignedAgent?.personalInfo?.email) {
      try {
        await sendEmail(
          client.assignedAgent.personalInfo.email,
          "New Loan Application Assigned",
          `A new loan application (${loanApplicationId}) has been assigned to you for review. 
           Client: ${client.personalInfo?.fullName}
           Amount: Rs. ${loanData.loanAmount.toLocaleString()}
           Please review and process the application.`
        );
      } catch (emailError) {
        logger.error("Failed to send notification email", emailError, {
          loanId: newLoan._id,
          agentEmail: client.assignedAgent.personalInfo.email,
        });
      }
    }

    logger.info("Loan application registered successfully", {
      loanId: newLoan._id,
      loanApplicationId,
      userId: user.userId,
    });

    res.status(201).json({
      success: true,
      message: "Loan application registered successfully",
      data: {
        loan: newLoan,
        loanId: newLoan._id,
        loanApplicationId,
        monthlyPayment,
        totalPayableAmount,
        primaryGuarantorId,
        secondaryGuarantorId,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error("Error registering loan application", error, {
      userId: req.user?.userId,
      loanData: req.body,
    });

    if (error instanceof AppError) {
      return res.status(error.statusCode).json({
        success: false,
        error: {
          code: error.errorCode,
          message: error.message,
          timestamp: new Date().toISOString(),
        },
      });
    }

    res.status(500).json({
      success: false,
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "Error registering loan application",
        timestamp: new Date().toISOString(),
      },
    });
  }
};

/**
 * Get all loans for an agent with enhanced filtering and pagination
 * @async
 * @function getAgentLoans
 * @param {Object} req - Express request object
 * @param {string} req.params.agentId - Agent ID to get loans for
 * @param {Object} req.query - Query parameters for filtering
 * @param {string} req.query.status - Filter by loan status
 * @param {string} req.query.clientName - Filter by client name
 * @param {number} req.query.page - Page number for pagination
 * @param {number} req.query.limit - Number of items per page
 * @param {Object} res - Express response object
 * @returns {Promise<void>} JSON response with agent's loans
 *
 * @example
 * // GET /api/loans/agent/:agentId?status=pending&page=1&limit=10
 *
 * @example
 * // Success Response (200)
 * {
 *   "success": true,
 *   "data": {
 *     "loans": [...],
 *     "pagination": {
 *       "totalCount": 25,
 *       "currentPage": 1,
 *       "totalPages": 3,
 *       "hasNext": true,
 *       "hasPrev": false
 *     }
 *   }
 * }
 */
exports.getAgentLoans = async (req, res) => {
  try {
    const { agentId } = req.params;
    const {
      status,
      workflowStage,
      page = 1,
      limit = 10,
      search = "",
      sortBy = "createdAt",
      sortOrder = "desc",
      startDate,
      endDate,
      minAmount,
      maxAmount,
      product,
      purpose,
    } = req.query;

    const loanRepository = new LoanRepository();

    logger.debug("Getting agent loans with filters", {
      agentId,
      filters: { status, workflowStage, search, startDate, endDate },
    });

    // Build filters
    const filters = { assignedAgent: agentId };

    if (status) {
      // Normalize status values to match database enum values
      const normalizeStatus = (statusValue) => {
        const statusMap = {
          pending: "Pending",
          approved: "Approved",
          rejected: "Rejected",
          active: "Active",
          completed: "Completed",
          defaulted: "Defaulted",
          under_review: "Under Review",
          Active: "Active",
          Pending: "Pending",
          Approved: "Approved",
          Rejected: "Rejected",
        };
        return statusMap[statusValue] || statusValue;
      };

      if (Array.isArray(status)) {
        filters.loanStatus = { $in: status.map(normalizeStatus) };
      } else {
        filters.loanStatus = normalizeStatus(status);
      }
    }

    if (workflowStage) {
      filters["workflowState.currentStage"] = workflowStage;
    }

    if (startDate || endDate) {
      filters.createdAt = {};
      if (startDate) filters.createdAt.$gte = new Date(startDate);
      if (endDate) filters.createdAt.$lte = new Date(endDate);
    }

    if (minAmount || maxAmount) {
      filters.loanAmount = {};
      if (minAmount) filters.loanAmount.$gte = parseFloat(minAmount);
      if (maxAmount) filters.loanAmount.$lte = parseFloat(maxAmount);
    }

    if (product) {
      filters.product = { $regex: product, $options: "i" };
    }

    if (purpose) {
      filters.purpose = { $regex: purpose, $options: "i" };
    }

    // Handle search
    if (search) {
      // Use text search if available, otherwise use regex search
      try {
        filters.$text = { $search: search };
      } catch (textSearchError) {
        // Fallback to regex search
        const searchRegex = { $regex: search, $options: "i" };
        filters.$or = [
          { loanApplicationId: searchRegex },
          { product: searchRegex },
          { purpose: searchRegex },
          { searchableText: searchRegex },
        ];
      }
    }

    // Build sort options
    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === "desc" ? -1 : 1;

    // Query options
    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
      populate: [
        { path: "clientUserId", select: "personalInfo registrationId status" },
        { path: "assignedAgent", select: "personalInfo role" },
        { path: "assignedRegionalManager", select: "personalInfo role" },
        { path: "agentReview.reviewedBy", select: "personalInfo" },
        { path: "regionalAdminApproval.approvedBy", select: "personalInfo" },
      ],
      sort: sortOptions,
    };

    // Get paginated results
    const result = await loanRepository.findByAgent(agentId, filters, options);
    const loans = result.docs || result;
    const total = result.totalDocs || loans.length;

    // Transform to match frontend interface
    const transformedLoans = loans.map((loan) => ({
      id: loan._id.toString(),
      loanApplicationId: loan.loanApplicationId,
      borrowerName: loan.clientUserId?.personalInfo?.fullName || "Unknown",
      borrowerId: loan.clientUserId?._id?.toString(),
      registrationId: loan.clientUserId?.registrationId,
      amount: loan.loanAmount,
      status: loan.loanStatus,
      workflowStage: loan.workflowState?.currentStage,
      assignedAgentId: loan.assignedAgent?._id?.toString() || agentId,
      assignedRegionalManagerId: loan.assignedRegionalManager?._id?.toString(),
      createdAt: loan.createdAt,
      updatedAt: loan.updatedAt,
      interestRate: loan.interestRate,
      termMonths: loan.loanTerm,
      monthlyPayment: loan.monthlyInstallment,
      totalPayableAmount: loan.totalPayableAmount,
      product: loan.product,
      purpose: loan.purpose,

      // Payment information
      totalPaid:
        loan.paymentHistory?.reduce(
          (sum, payment) =>
            payment.status === "approved" ? sum + payment.amount : sum,
          0
        ) || 0,
      remainingBalance:
        loan.calculatedFields?.remainingBalance || loan.loanAmount,
      nextPaymentDate: loan.calculatedFields?.nextPaymentDate,
      daysOverdue: loan.calculatedFields?.daysOverdue || 0,

      // Review information
      agentReview: {
        status: loan.agentReview?.status,
        reviewDate: loan.agentReview?.reviewDate,
        comments: loan.agentReview?.comments,
        rating: loan.agentReview?.rating,
        reviewedBy: loan.agentReview?.reviewedBy?.personalInfo,
      },

      regionalApproval: {
        status: loan.regionalAdminApproval?.status,
        approvalDate: loan.regionalAdminApproval?.approvalDate,
        comments: loan.regionalAdminApproval?.comments,
        approvedBy: loan.regionalAdminApproval?.approvedBy?.personalInfo,
      },

      // Dates
      disbursedDate: loan.disbursementDate,
      completedDate: loan.completionDate,

      // Client status
      clientStatus: loan.clientUserId?.status,
    }));

    logger.debug("Agent loans retrieved", {
      agentId,
      totalLoans: total,
      returnedLoans: transformedLoans.length,
    });

    res.json({
      success: true,
      data: {
        loans: transformedLoans,
        pagination: {
          total,
          page: parseInt(page),
          pages: Math.ceil(total / parseInt(limit)),
          limit: parseInt(limit),
        },
        filters: {
          status,
          workflowStage,
          search,
          startDate,
          endDate,
          minAmount,
          maxAmount,
          product,
          purpose,
        },
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error("Error fetching agent loans", error, {
      agentId: req.params.agentId,
      filters: req.query,
    });

    res.status(500).json({
      success: false,
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "Error fetching agent loans",
        timestamp: new Date().toISOString(),
      },
    });
  }
};

// Get loan by ID
exports.getLoanById = async (req, res) => {
  try {
    const { id } = req.params;

    const loan = await Loan.findOne({ loanApplicationId: id })
      .populate("clientUserId")
      .populate("agentReview.reviewedBy", "name email")
      .populate("regionalAdminApproval.approvedBy", "name email")
      .populate("paymentHistory.approvedBy", "name email");

    if (!loan) {
      return res.status(404).json({ message: "Loan not found" });
    }

    res.json({
      message: "Loan details fetched successfully",
      loan,
    });
  } catch (error) {
    res.status(500).json({
      message: "Error fetching loan details",
      error: error.message,
    });
  }
};

// Agent review loan application with enhanced workflow
exports.agentReviewLoan = async (req, res) => {
  try {
    const { loanId } = req.params;
    const { status, comments, rating } = req.body;
    const user = req.user;
    const loanRepository = new LoanRepository();

    logger.info("Agent reviewing loan", {
      loanId,
      agentId: user.userId,
      status,
    });

    const loan = await Loan.findOne({
      $or: [{ loanApplicationId: loanId }, { _id: loanId }],
    })
      .populate("clientUserId")
      .populate("assignedAgent");

    if (!loan) {
      throw new AppError("Loan not found", 404, "LOAN_NOT_FOUND");
    }

    // Verify agent has permission to review this loan
    if (loan.assignedAgent?._id.toString() !== user.userId) {
      throw new AppError(
        "Not authorized to review this loan",
        403,
        "UNAUTHORIZED_REVIEW"
      );
    }

    // Validate current workflow stage
    if (
      loan.workflowState.currentStage !== "application_submitted" &&
      loan.agentReview.status !== "pending"
    ) {
      throw new AppError(
        "Loan is not in a reviewable state",
        400,
        "INVALID_WORKFLOW_STATE"
      );
    }

    // Update agent review
    loan.agentReview = {
      reviewedBy: user.userId,
      reviewDate: new Date(),
      status: status.toLowerCase(),
      comments,
      rating: rating || null,
      assignedTo: user.userId,
    };

    // Update workflow state and loan status
    let newWorkflowStage;
    let newLoanStatus;

    if (status.toLowerCase() === "approved") {
      newWorkflowStage = "agent_approved";
      newLoanStatus = "under_review"; // Ready for regional manager approval
    } else if (status.toLowerCase() === "rejected") {
      newWorkflowStage = "agent_rejected";
      newLoanStatus = "rejected";
    } else {
      throw new AppError("Invalid review status", 400, "INVALID_STATUS");
    }

    // Advance workflow stage
    loan.advanceWorkflowStage(newWorkflowStage, user.userId, comments);
    loan.loanStatus = newLoanStatus;

    // Add audit trail entry
    loan.auditTrail.push({
      action: `agent_review_${status.toLowerCase()}`,
      performedBy: user.userId,
      timestamp: new Date(),
      changes: {
        agentReviewStatus: status.toLowerCase(),
        workflowStage: newWorkflowStage,
        loanStatus: newLoanStatus,
      },
      ipAddress: req.ip,
      userAgent: req.get("User-Agent"),
      comments,
    });

    await loan.save();

    // Send notifications
    const client = loan.clientUserId;

    // Notify client
    if (client?.personalInfo?.email) {
      try {
        const emailSubject = `Loan Application ${status} - ${loan.loanApplicationId}`;
        const emailMessage = `
          Dear ${client.personalInfo.fullName},
          
          Your loan application ${
            loan.loanApplicationId
          } has been ${status.toLowerCase()} by your assigned agent.
          
          Application Details:
          - Loan Amount: Rs. ${loan.loanAmount.toLocaleString()}
          - Status: ${status}
          ${comments ? `- Agent Comments: ${comments}` : ""}
          ${rating ? `- Agent Rating: ${rating}/5` : ""}
          
          ${
            status.toLowerCase() === "approved"
              ? "Your application will now be reviewed by the regional manager for final approval."
              : "Please contact your agent for more information about reapplying."
          }
          
          Best regards,
          PaySync Financial Services
        `;

        await sendEmail(client.personalInfo.email, emailSubject, emailMessage);
      } catch (emailError) {
        logger.error("Failed to send client notification", emailError, {
          loanId: loan._id,
          clientEmail: client.personalInfo.email,
        });
      }
    }

    // Notify regional manager if approved
    if (status.toLowerCase() === "approved" && loan.assignedRegionalManager) {
      try {
        const regionalManager = await Staff.findById(
          loan.assignedRegionalManager
        );
        if (regionalManager?.personalInfo?.email) {
          await sendEmail(
            regionalManager.personalInfo.email,
            `Loan Application Ready for Approval - ${loan.loanApplicationId}`,
            `A loan application (${
              loan.loanApplicationId
            }) has been approved by the agent and is ready for your review.
             Client: ${client?.personalInfo?.fullName}
             Amount: Rs. ${loan.loanAmount.toLocaleString()}
             Agent: ${loan.assignedAgent?.personalInfo?.firstName} ${
              loan.assignedAgent?.personalInfo?.lastName
            }
             Please review and approve/reject the application.`
          );
        }
      } catch (emailError) {
        logger.error(
          "Failed to send regional manager notification",
          emailError,
          {
            loanId: loan._id,
          }
        );
      }
    }

    logger.info("Loan review completed successfully", {
      loanId: loan._id,
      agentId: user.userId,
      status: status.toLowerCase(),
    });

    res.json({
      success: true,
      message: "Loan review completed successfully",
      data: {
        loan,
        workflowStage: newWorkflowStage,
        nextStep:
          status.toLowerCase() === "approved"
            ? "regional_manager_approval"
            : "application_closed",
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error("Error reviewing loan", error, {
      loanId: req.params.loanId,
      agentId: req.user?.userId,
    });

    if (error instanceof AppError) {
      return res.status(error.statusCode).json({
        success: false,
        error: {
          code: error.errorCode,
          message: error.message,
          timestamp: new Date().toISOString(),
        },
      });
    }

    res.status(500).json({
      success: false,
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "Error reviewing loan",
        timestamp: new Date().toISOString(),
      },
    });
  }
};

// Get enhanced loan statistics for agent dashboard
exports.getAgentLoanStats = async (req, res) => {
  try {
    const { agentId } = req.params;
    const { startDate, endDate } = req.query;
    const loanRepository = new LoanRepository();

    logger.debug("Getting agent loan statistics", {
      agentId,
      startDate,
      endDate,
    });

    // Get performance statistics using repository
    const dateRange = {};
    if (startDate) dateRange.startDate = startDate;
    if (endDate) dateRange.endDate = endDate;

    const performanceStats = await loanRepository.getAgentPerformanceStats(
      agentId,
      dateRange
    );

    // Get additional statistics
    const additionalStats = await Loan.aggregate([
      {
        $match: {
          assignedAgent: new mongoose.Types.ObjectId(agentId),
          ...(startDate || endDate
            ? {
                createdAt: {
                  ...(startDate && { $gte: new Date(startDate) }),
                  ...(endDate && { $lte: new Date(endDate) }),
                },
              }
            : {}),
        },
      },
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
      {
        $facet: {
          statusBreakdown: [
            {
              $group: {
                _id: "$loanStatus",
                count: { $sum: 1 },
                totalAmount: { $sum: "$loanAmount" },
              },
            },
          ],
          workflowBreakdown: [
            {
              $group: {
                _id: "$workflowState.currentStage",
                count: { $sum: 1 },
              },
            },
          ],
          monthlyTrends: [
            {
              $group: {
                _id: {
                  year: { $year: "$createdAt" },
                  month: { $month: "$createdAt" },
                },
                count: { $sum: 1 },
                amount: { $sum: "$loanAmount" },
              },
            },
            { $sort: { "_id.year": 1, "_id.month": 1 } },
          ],
          commissionCalculation: [
            {
              $match: {
                loanStatus: { $in: ["Approved", "Active", "Completed"] },
              },
            },
            {
              $group: {
                _id: null,
                totalCommissionableAmount: { $sum: "$loanAmount" },
              },
            },
          ],
        },
      },
    ]);

    const stats = additionalStats[0] || {};
    const commissionRate = 0.02; // 2% commission
    const totalCommissionableAmount =
      stats.commissionCalculation?.[0]?.totalCommissionableAmount || 0;
    const commissionEarned = totalCommissionableAmount * commissionRate;

    // Format status breakdown
    const statusCounts = {};
    stats.statusBreakdown?.forEach((item) => {
      statusCounts[item._id] = {
        count: item.count,
        totalAmount: item.totalAmount,
      };
    });

    // Format workflow breakdown
    const workflowCounts = {};
    stats.workflowBreakdown?.forEach((item) => {
      workflowCounts[item._id] = item.count;
    });

    logger.debug("Agent statistics calculated", {
      agentId,
      totalApplications: performanceStats.totalApplications,
    });

    res.json({
      success: true,
      data: {
        // Core statistics
        totalLoans: performanceStats.totalApplications,
        totalAmount: performanceStats.totalAmount,
        averageAmount: performanceStats.averageAmount,

        // Status breakdown
        approvedLoans: performanceStats.approvedLoans,
        rejectedLoans: performanceStats.rejectedLoans,
        pendingLoans: performanceStats.pendingLoans,
        activeLoans: statusCounts.active?.count || 0,
        completedLoans: statusCounts.completed?.count || 0,

        // Performance metrics
        approvalRate: performanceStats.approvalRate,
        averageProcessingTimeHours: performanceStats.averageProcessingTimeHours,

        // Financial metrics
        commissionEarned,
        commissionRate: commissionRate * 100, // As percentage
        totalCommissionableAmount,

        // Detailed breakdowns
        statusBreakdown: statusCounts,
        workflowBreakdown: workflowCounts,
        monthlyTrends: stats.monthlyTrends || [],

        // Legacy compatibility
        completeLoans: statusCounts.completed?.count || 0,
        pendingApplications: performanceStats.pendingLoans,
        totalLoanAmount: performanceStats.totalAmount,
        averageLoanAmount: performanceStats.averageAmount,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error("Error fetching agent loan statistics", error, {
      agentId: req.params.agentId,
    });

    res.status(500).json({
      success: false,
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "Error fetching loan statistics",
        timestamp: new Date().toISOString(),
      },
    });
  }
};

// Get pending loans for agent review
exports.getPendingLoansForAgent = async (req, res) => {
  try {
    const { agentId } = req.params;

    // Find clients assigned to this agent
    const agentClients = await Client.find({ assignedReviewer: agentId });
    const clientIds = agentClients.map((client) => client._id);

    const pendingLoans = await Loan.find({
      clientUserId: { $in: clientIds },
      "agentReview.status": "Pending",
    })
      .populate("clientUserId", "personalInfo registrationId")
      .sort({ createdAt: -1 });

    res.json({
      message: "Pending loans fetched successfully",
      loans: pendingLoans,
      count: pendingLoans.length,
    });
  } catch (error) {
    res.status(500).json({
      message: "Error fetching pending loans",
      error: error.message,
    });
  }
};

/**
 * Regional manager approval workflow for loan applications
 * @async
 * @function regionalManagerApproval
 * @param {Object} req - Express request object
 * @param {string} req.params.loanId - Loan ID to approve/reject
 * @param {Object} req.body - Approval decision data
 * @param {string} req.body.decision - 'approve' or 'reject'
 * @param {string} req.body.comments - Comments for the decision
 * @param {Object} req.user - Authenticated regional manager
 * @param {Object} res - Express response object
 * @returns {Promise<void>} JSON response with approval result
 *
 * @example
 * // PUT /api/loans/:loanId/regional-approval
 * {
 *   "decision": "approve",
 *   "comments": "All documentation verified and approved"
 * }
 *
 * @example
 * // Success Response (200)
 * {
 *   "success": true,
 *   "message": "Loan approved successfully",
 *   "data": {
 *     "loan": {
 *       "_id": "507f1f77bcf86cd799439012",
 *       "loanStatus": "approved",
 *       "regionalAdminApproval": {
 *         "status": "approved",
 *         "approvedBy": "507f1f77bcf86cd799439013",
 *         "approvedAt": "2024-01-01T10:00:00.000Z"
 *       }
 *     }
 *   }
 * }
 */
exports.regionalManagerApproval = async (req, res) => {
  try {
    const { loanId } = req.params;
    const { status, comments, conditions } = req.body;
    const user = req.user;
    const loanRepository = new LoanRepository();

    logger.info("Regional manager reviewing loan", {
      loanId,
      regionalManagerId: user.userId,
      status,
    });

    const loan = await Loan.findOne({
      $or: [{ loanApplicationId: loanId }, { _id: loanId }],
    })
      .populate("clientUserId")
      .populate("assignedAgent")
      .populate("assignedRegionalManager");

    if (!loan) {
      throw new AppError("Loan not found", 404, "LOAN_NOT_FOUND");
    }

    // Verify regional manager has permission
    if (loan.assignedRegionalManager?._id.toString() !== user.userId) {
      throw new AppError(
        "Not authorized to approve this loan",
        403,
        "UNAUTHORIZED_APPROVAL"
      );
    }

    // Validate current workflow state
    if (
      loan.workflowState.currentStage !== "agent_approved" ||
      loan.agentReview.status !== "approved"
    ) {
      throw new AppError(
        "Loan must be approved by agent first",
        400,
        "INVALID_WORKFLOW_STATE"
      );
    }

    // Perform business rule validation for status update
    const validation = await validateLoanStatusUpdate(
      loan._id,
      status.toLowerCase(),
      user
    );
    if (!validation.isValid) {
      logger.warn("Loan status update validation failed", {
        loanId: loan._id,
        errors: validation.errors,
      });

      return res.status(400).json({
        success: false,
        error: {
          code: "BUSINESS_RULE_VIOLATION",
          message: "Loan status update violates business rules",
          details: validation.errors,
          timestamp: new Date().toISOString(),
        },
      });
    }

    // Update regional admin approval
    loan.regionalAdminApproval = {
      approvedBy: user.userId,
      approvalDate: new Date(),
      status: status.toLowerCase(),
      comments,
      conditions: conditions || [],
      assignedTo: user.userId,
    };

    // Update workflow state and loan status
    let newWorkflowStage;
    let newLoanStatus;

    if (status.toLowerCase() === "approved") {
      newWorkflowStage = "regional_approved";
      newLoanStatus = "approved";

      // Set next payment date (first payment due in 30 days)
      loan.calculatedFields.nextPaymentDate = new Date(
        Date.now() + 30 * 24 * 60 * 60 * 1000
      );
    } else if (status.toLowerCase() === "rejected") {
      newWorkflowStage = "regional_rejected";
      newLoanStatus = "rejected";
    } else {
      throw new AppError("Invalid approval status", 400, "INVALID_STATUS");
    }

    // Advance workflow stage
    loan.advanceWorkflowStage(newWorkflowStage, user.userId, comments);
    loan.loanStatus = newLoanStatus;

    // Add audit trail entry
    loan.auditTrail.push({
      action: `regional_approval_${status.toLowerCase()}`,
      performedBy: user.userId,
      timestamp: new Date(),
      changes: {
        regionalApprovalStatus: status.toLowerCase(),
        workflowStage: newWorkflowStage,
        loanStatus: newLoanStatus,
        conditions: conditions || [],
      },
      ipAddress: req.ip,
      userAgent: req.get("User-Agent"),
      comments,
    });

    await loan.save();

    // Send notifications
    const client = loan.clientUserId;

    // Notify client
    if (client?.personalInfo?.email) {
      try {
        const emailSubject = `Loan Application ${status} - ${loan.loanApplicationId}`;
        let emailMessage = `
          Dear ${client.personalInfo.fullName},
          
          Your loan application ${
            loan.loanApplicationId
          } has been ${status.toLowerCase()} by the regional manager.
          
          Application Details:
          - Loan Amount: Rs. ${loan.loanAmount.toLocaleString()}
          - Monthly Payment: Rs. ${loan.monthlyInstallment.toLocaleString()}
          - Status: ${status}
          ${comments ? `- Manager Comments: ${comments}` : ""}
        `;

        if (status.toLowerCase() === "approved") {
          emailMessage += `
          
          Congratulations! Your loan has been approved. 
          ${
            conditions && conditions.length > 0
              ? `
          Please note the following conditions:
          ${conditions.map((condition) => `- ${condition}`).join("\n")}
          `
              : ""
          }
          
          Next Steps:
          - Agreement generation will begin shortly
          - You will receive the loan agreement for signing
          - Funds will be disbursed after agreement signing
          `;
        } else {
          emailMessage += `
          
          Unfortunately, your loan application has been rejected.
          Please contact your agent for more information about reapplying.
          `;
        }

        emailMessage += `
          
          Best regards,
          PaySync Financial Services
        `;

        await sendEmail(client.personalInfo.email, emailSubject, emailMessage);
      } catch (emailError) {
        logger.error("Failed to send client notification", emailError, {
          loanId: loan._id,
        });
      }
    }

    // Notify agent
    if (loan.assignedAgent?.personalInfo?.email) {
      try {
        await sendEmail(
          loan.assignedAgent.personalInfo.email,
          `Loan Application ${status} - ${loan.loanApplicationId}`,
          `The loan application ${loan.loanApplicationId} for client ${
            client?.personalInfo?.fullName
          } has been ${status.toLowerCase()} by the regional manager.
           ${comments ? `Comments: ${comments}` : ""}
           ${
             status.toLowerCase() === "approved"
               ? "You can now proceed with agreement generation."
               : ""
           }`
        );
      } catch (emailError) {
        logger.error("Failed to send agent notification", emailError, {
          loanId: loan._id,
        });
      }
    }

    logger.info("Regional manager approval completed", {
      loanId: loan._id,
      regionalManagerId: user.userId,
      status: status.toLowerCase(),
    });

    res.json({
      success: true,
      message: "Loan approval completed successfully",
      data: {
        loan,
        workflowStage: newWorkflowStage,
        nextStep:
          status.toLowerCase() === "approved"
            ? "agreement_generation"
            : "application_closed",
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error("Error in regional manager approval", error, {
      loanId: req.params.loanId,
      regionalManagerId: req.user?.userId,
    });

    if (error instanceof AppError) {
      return res.status(error.statusCode).json({
        success: false,
        error: {
          code: error.errorCode,
          message: error.message,
          timestamp: new Date().toISOString(),
        },
      });
    }

    res.status(500).json({
      success: false,
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "Error processing loan approval",
        timestamp: new Date().toISOString(),
      },
    });
  }
};

/**
 * Update loan status with enhanced validation and audit trail
 * @async
 * @function updateLoanStatus
 * @param {Object} req - Express request object
 * @param {string} req.params.loanId - Loan ID to update
 * @param {Object} req.body - Status update data
 * @param {string} req.body.status - New loan status
 * @param {string} req.body.comments - Comments for status change
 * @param {Object} req.user - Authenticated user making the change
 * @param {Object} res - Express response object
 * @returns {Promise<void>} JSON response with update result
 *
 * @example
 * // PUT /api/loans/:loanId/status
 * {
 *   "status": "approved",
 *   "comments": "Loan approved after thorough review"
 * }
 *
 * @example
 * // Success Response (200)
 * {
 *   "success": true,
 *   "message": "Loan status updated successfully",
 *   "data": {
 *     "loan": {
 *       "_id": "507f1f77bcf86cd799439012",
 *       "loanStatus": "approved",
 *       "auditTrail": [...]
 *     }
 *   }
 * }
 */
exports.updateLoanStatus = async (req, res) => {
  try {
    const { loanId } = req.params;
    const { status, comments, reason } = req.body;
    const user = req.user;

    logger.info("Updating loan status", {
      loanId,
      userId: user.userId,
      newStatus: status,
    });

    const loan = await Loan.findOne({
      $or: [{ loanApplicationId: loanId }, { _id: loanId }],
    }).populate("clientUserId");

    if (!loan) {
      throw new AppError("Loan not found", 404, "LOAN_NOT_FOUND");
    }

    // Validate status update
    const validation = await validateLoanStatusUpdate(
      loan._id,
      status.toLowerCase(),
      user
    );
    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        error: {
          code: "BUSINESS_RULE_VIOLATION",
          message: "Loan status update violates business rules",
          details: validation.errors,
          timestamp: new Date().toISOString(),
        },
      });
    }

    const oldStatus = loan.loanStatus;
    loan.loanStatus = status.toLowerCase();

    // Update calculated fields based on new status
    if (status.toLowerCase() === "active") {
      loan.calculatedFields.nextPaymentDate = new Date(
        Date.now() + 30 * 24 * 60 * 60 * 1000
      );
      loan.disbursementDate = new Date();
    } else if (status.toLowerCase() === "completed") {
      loan.calculatedFields.remainingBalance = 0;
      loan.completionDate = new Date();
    }

    // Add audit trail entry
    loan.auditTrail.push({
      action: "status_updated",
      performedBy: user.userId,
      timestamp: new Date(),
      changes: {
        oldStatus,
        newStatus: status.toLowerCase(),
        reason,
      },
      ipAddress: req.ip,
      userAgent: req.get("User-Agent"),
      comments,
    });

    await loan.save();

    // Send email notification for status changes
    try {
      const client = await Client.findById(loan.clientUserId);
      if (client && client.personalInfo.email) {
        const statusChange = {
          newStatus: status.toLowerCase(),
          approvalMessage:
            status.toLowerCase() === "approved" ? comments : null,
          rejectionReason: status.toLowerCase() === "rejected" ? reason : null,
        };

        await emailService.sendLoanStatusChangeNotification(
          loan,
          client,
          statusChange
        );

        logger.info("Email notification queued for loan status change", {
          loanId: loan._id,
          clientEmail: client.personalInfo.email,
          newStatus: status.toLowerCase(),
        });
      }
    } catch (emailError) {
      // Log email error but don't fail the status update
      logger.error(
        "Failed to send email notification for loan status change",
        emailError,
        {
          loanId: loan._id,
          newStatus: status.toLowerCase(),
        }
      );
    }

    logger.info("Loan status updated successfully", {
      loanId: loan._id,
      oldStatus,
      newStatus: status.toLowerCase(),
      userId: user.userId,
    });

    res.json({
      success: true,
      message: "Loan status updated successfully",
      data: {
        loan,
        oldStatus,
        newStatus: status.toLowerCase(),
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error("Error updating loan status", error, {
      loanId: req.params.loanId,
      userId: req.user?.userId,
    });

    if (error instanceof AppError) {
      return res.status(error.statusCode).json({
        success: false,
        error: {
          code: error.errorCode,
          message: error.message,
          timestamp: new Date().toISOString(),
        },
      });
    }

    res.status(500).json({
      success: false,
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "Error updating loan status",
        timestamp: new Date().toISOString(),
      },
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
      return res.status(404).json({ message: "Loan not found" });
    }

    // Generate payment ID
    const paymentId = `P${loanId}${String(
      loan.paymentHistory.length + 1
    ).padStart(3, "0")}`;

    const payment = {
      paymentId,
      ...paymentData,
      status: "Pending",
    };

    loan.paymentHistory.push(payment);
    await loan.save();

    res.json({
      message: "Payment added successfully",
      payment,
    });
  } catch (error) {
    res.status(500).json({
      message: "Error adding payment",
      error: error.message,
    });
  }
};

// Get payment history for a loan
exports.getPaymentHistory = async (req, res) => {
  try {
    const { loanId } = req.params;

    const loan = await Loan.findOne({ loanApplicationId: loanId }).populate(
      "paymentHistory.approvedBy",
      "name email"
    );

    if (!loan) {
      return res.status(404).json({ message: "Loan not found" });
    }

    res.json({
      message: "Payment history fetched successfully",
      payments: loan.paymentHistory,
      loanInfo: {
        loanApplicationId: loan.loanApplicationId,
        monthlyInstallment: loan.monthlyInstallment,
        totalPayableAmount: loan.totalPayableAmount,
      },
    });
  } catch (error) {
    res.status(500).json({
      message: "Error fetching payment history",
      error: error.message,
    });
  }
};

// Search loans
exports.searchLoans = async (req, res) => {
  try {
    const { query, agentId } = req.query;

    // Find clients assigned to this agent
    const agentClients = await Client.find({ assignedReviewer: agentId });
    const clientIds = agentClients.map((client) => client._id);

    const searchQuery = {
      clientUserId: { $in: clientIds },
      $or: [
        { loanApplicationId: { $regex: query, $options: "i" } },
        { product: { $regex: query, $options: "i" } },
        { purpose: { $regex: query, $options: "i" } },
      ],
    };

    const loans = await Loan.find(searchQuery)
      .populate("clientUserId", "personalInfo registrationId")
      .sort({ createdAt: -1 })
      .limit(20);

    res.json({
      message: "Search results fetched successfully",
      loans,
    });
  } catch (error) {
    res.status(500).json({
      message: "Error searching loans",
      error: error.message,
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
      .populate("clientUserId", "personalInfo registrationId")
      .populate("agentReview.reviewedBy", "name email")
      .populate("regionalAdminApproval.approvedBy", "name email")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    // Transform to match frontend interface
    const transformedLoans = loans.map((loan) => ({
      id: loan._id.toString(),
      borrowerName: loan.clientUserId?.personalInfo?.fullName || "Unknown",
      amount: loan.loanAmount,
      status: loan.loanStatus.toLowerCase().replace(" ", "_"),
      assignedAgentId: loan.agentReview?.reviewedBy?.toString() || "",
      createdAt: loan.createdAt,
      updatedAt: loan.updatedAt,
      interestRate: loan.interestRate,
      totalPaid:
        loan.paymentHistory?.reduce(
          (sum, payment) =>
            payment.status === "Approved" ? sum + payment.amount : sum,
          0
        ) || 0,
      termMonths: loan.loanTerm,
      monthlyPayment: loan.monthlyInstallment,
      disbursedDate: loan.loanStatus === "Active" ? loan.updatedAt : null,
      completedDate: loan.loanStatus === "Completed" ? loan.updatedAt : null,
    }));

    res.json(transformedLoans);
  } catch (error) {
    res.status(500).json({
      message: "Error fetching all loans",
      error: error.message,
    });
  }
};

// Get regional manager loans for approval
exports.getRegionalManagerLoans = async (req, res) => {
  try {
    const { regionalManagerId } = req.params;
    const {
      status = "pending_approval",
      page = 1,
      limit = 10,
      search = "",
      sortBy = "agentReview.reviewDate",
      sortOrder = "asc", // Oldest first for FIFO processing
    } = req.query;

    const loanRepository = new LoanRepository();

    logger.debug("Getting regional manager loans", {
      regionalManagerId,
      status,
    });

    let filters = { assignedRegionalManager: regionalManagerId };

    // Filter based on status
    if (status === "pending_approval") {
      filters["agentReview.status"] = "approved";
      filters["regionalAdminApproval.status"] = { $in: ["pending", null] };
    } else if (status === "approved") {
      filters["regionalAdminApproval.status"] = "approved";
    } else if (status === "rejected") {
      filters["regionalAdminApproval.status"] = "rejected";
    }

    // Handle search
    if (search) {
      const searchRegex = { $regex: search, $options: "i" };
      filters.$or = [
        { loanApplicationId: searchRegex },
        { product: searchRegex },
        { purpose: searchRegex },
        { searchableText: searchRegex },
      ];
    }

    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
      populate: [
        {
          path: "clientUserId",
          select: "personalInfo registrationId status verificationStatus",
        },
        { path: "assignedAgent", select: "personalInfo role" },
        { path: "agentReview.reviewedBy", select: "personalInfo" },
      ],
      sort: { [sortBy]: sortOrder === "desc" ? -1 : 1 },
    };

    const result = await loanRepository.findForRegionalApproval(
      regionalManagerId,
      filters,
      options
    );
    const loans = result.docs || result;

    // Transform for frontend
    const transformedLoans = loans.map((loan) => ({
      id: loan._id.toString(),
      loanApplicationId: loan.loanApplicationId,
      borrowerName: loan.clientUserId?.personalInfo?.fullName || "Unknown",
      borrowerId: loan.clientUserId?._id?.toString(),
      amount: loan.loanAmount,
      monthlyPayment: loan.monthlyInstallment,
      termMonths: loan.loanTerm,
      interestRate: loan.interestRate,
      product: loan.product,
      purpose: loan.purpose,
      status: loan.loanStatus,
      workflowStage: loan.workflowState?.currentStage,

      // Agent review details
      agentReview: {
        status: loan.agentReview?.status,
        reviewDate: loan.agentReview?.reviewDate,
        comments: loan.agentReview?.comments,
        rating: loan.agentReview?.rating,
        reviewedBy: {
          name: `${loan.agentReview?.reviewedBy?.personalInfo?.firstName} ${loan.agentReview?.reviewedBy?.personalInfo?.lastName}`,
          email: loan.agentReview?.reviewedBy?.personalInfo?.email,
        },
      },

      // Client information
      client: {
        name: loan.clientUserId?.personalInfo?.fullName,
        email: loan.clientUserId?.personalInfo?.email,
        phone: loan.clientUserId?.personalInfo?.phone,
        status: loan.clientUserId?.status,
        verificationStatus: loan.clientUserId?.verificationStatus,
      },

      // Assigned agent
      assignedAgent: {
        name: `${loan.assignedAgent?.personalInfo?.firstName} ${loan.assignedAgent?.personalInfo?.lastName}`,
        email: loan.assignedAgent?.personalInfo?.email,
      },

      createdAt: loan.createdAt,
      updatedAt: loan.updatedAt,
    }));

    res.json({
      success: true,
      data: {
        loans: transformedLoans,
        pagination: {
          total: result.totalDocs || loans.length,
          page: parseInt(page),
          pages: Math.ceil(
            (result.totalDocs || loans.length) / parseInt(limit)
          ),
          limit: parseInt(limit),
        },
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error("Error fetching regional manager loans", error, {
      regionalManagerId: req.params.regionalManagerId,
    });

    res.status(500).json({
      success: false,
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "Error fetching loans for approval",
        timestamp: new Date().toISOString(),
      },
    });
  }
};

// Get regional manager dashboard statistics
exports.getRegionalManagerStats = async (req, res) => {
  try {
    const { regionalManagerId } = req.params;
    const { startDate, endDate } = req.query;
    const loanRepository = new LoanRepository();

    logger.debug("Getting regional manager statistics", {
      regionalManagerId,
      startDate,
      endDate,
    });

    const dashboardStats =
      await loanRepository.getRegionalManagerDashboardStats(regionalManagerId);

    // Get regional statistics
    const user = await Staff.findById(regionalManagerId);
    let regionalStats = {};

    if (user?.region) {
      const dateRange = {};
      if (startDate) dateRange.startDate = startDate;
      if (endDate) dateRange.endDate = endDate;

      regionalStats = await loanRepository.getRegionalStatistics(
        user.region,
        dateRange
      );
    }

    // Format response
    const stats = {
      // Pending approvals
      pendingApprovals: dashboardStats.pendingApprovals?.[0]?.count || 0,

      // Status breakdown
      statusStats:
        dashboardStats.statusStats?.reduce((acc, item) => {
          acc[item._id] = {
            count: item.count,
            totalAmount: item.totalAmount,
          };
          return acc;
        }, {}) || {},

      // Workflow breakdown
      workflowStats:
        dashboardStats.workflowStats?.reduce((acc, item) => {
          acc[item._id] = item.count;
          return acc;
        }, {}) || {},

      // Monthly trends
      monthlyTrends: dashboardStats.monthlyTrends || [],

      // Regional statistics
      regional: {
        totalLoans: regionalStats.totalLoans || 0,
        totalAmount: regionalStats.totalAmount || 0,
        averageAmount: regionalStats.averageAmount || 0,
        statusCounts: regionalStats.statusCounts || {},
        workflowStageCounts: regionalStats.workflowStageCounts || {},
      },
    };

    res.json({
      success: true,
      data: stats,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error("Error fetching regional manager statistics", error, {
      regionalManagerId: req.params.regionalManagerId,
    });

    res.status(500).json({
      success: false,
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "Error fetching dashboard statistics",
        timestamp: new Date().toISOString(),
      },
    });
  }
};

// Get enhanced loan statistics (for useLoanData hook)
exports.getLoanStats = async (req, res) => {
  try {
    const { regionId, agentId, startDate, endDate } = req.query;
    const user = req.user;

    logger.debug("Getting loan statistics", {
      regionId,
      agentId,
      startDate,
      endDate,
      userRole: user?.role,
    });

    // Build base filters based on user role
    let baseFilters = {};

    if (user?.role === "regional_manager" && user.region) {
      baseFilters.region = user.region;
    } else if (user?.role === "agent") {
      baseFilters.assignedAgent = user.userId;
    }

    // Apply additional filters
    if (
      regionId &&
      ["moderate_admin", "super_admin", "ceo"].includes(user?.role)
    ) {
      baseFilters.region = regionId;
    }

    if (
      agentId &&
      ["regional_manager", "moderate_admin", "super_admin"].includes(user?.role)
    ) {
      baseFilters.assignedAgent = agentId;
    }

    // Date range filter
    if (startDate || endDate) {
      baseFilters.createdAt = {};
      if (startDate) baseFilters.createdAt.$gte = new Date(startDate);
      if (endDate) baseFilters.createdAt.$lte = new Date(endDate);
    }

    // Get comprehensive statistics
    const stats = await Loan.aggregate([
      { $match: baseFilters },
      {
        $facet: {
          // Basic counts
          basicStats: [
            {
              $group: {
                _id: null,
                totalLoans: { $sum: 1 },
                totalAmount: { $sum: "$loanAmount" },
                averageAmount: { $avg: "$loanAmount" },
                averageInterestRate: { $avg: "$interestRate" },
              },
            },
          ],

          // Status breakdown
          statusStats: [
            {
              $group: {
                _id: "$loanStatus",
                count: { $sum: 1 },
                totalAmount: { $sum: "$loanAmount" },
              },
            },
          ],

          // Workflow stage breakdown
          workflowStats: [
            {
              $group: {
                _id: "$workflowState.currentStage",
                count: { $sum: 1 },
              },
            },
          ],

          // Financial calculations
          financialStats: [
            {
              $group: {
                _id: null,
                totalDisbursed: {
                  $sum: {
                    $cond: [
                      {
                        $in: [
                          "$loanStatus",
                          ["approved", "active", "completed"],
                        ],
                      },
                      "$loanAmount",
                      0,
                    ],
                  },
                },
                totalCompleted: {
                  $sum: {
                    $cond: [
                      { $eq: ["$loanStatus", "completed"] },
                      "$loanAmount",
                      0,
                    ],
                  },
                },
              },
            },
          ],

          // Payment statistics
          paymentStats: [
            {
              $unwind: {
                path: "$paymentHistory",
                preserveNullAndEmptyArrays: true,
              },
            },
            {
              $match: {
                "paymentHistory.status": "approved",
              },
            },
            {
              $group: {
                _id: null,
                totalCollected: { $sum: "$paymentHistory.amount" },
              },
            },
          ],

          // Overdue analysis
          overdueStats: [
            {
              $match: {
                "calculatedFields.daysOverdue": { $gt: 0 },
              },
            },
            {
              $group: {
                _id: null,
                overdueCount: { $sum: 1 },
                overdueAmount: { $sum: "$loanAmount" },
                averageOverdueDays: { $avg: "$calculatedFields.daysOverdue" },
              },
            },
          ],
        },
      },
    ]);

    const result = stats[0] || {};
    const basicStats = result.basicStats?.[0] || {};
    const financialStats = result.financialStats?.[0] || {};
    const paymentStats = result.paymentStats?.[0] || {};
    const overdueStats = result.overdueStats?.[0] || {};

    // Format status counts
    const statusCounts = {};
    result.statusStats?.forEach((item) => {
      statusCounts[item._id] = {
        count: item.count,
        totalAmount: item.totalAmount,
      };
    });

    // Format workflow counts
    const workflowCounts = {};
    result.workflowStats?.forEach((item) => {
      workflowCounts[item._id] = item.count;
    });

    // Calculate derived metrics
    const totalLoans = basicStats.totalLoans || 0;
    const defaultRate =
      totalLoans > 0
        ? ((overdueStats.overdueCount || 0) / totalLoans) * 100
        : 0;
    const collectionRate =
      financialStats.totalDisbursed > 0
        ? ((paymentStats.totalCollected || 0) / financialStats.totalDisbursed) *
          100
        : 0;

    const response = {
      // Basic statistics
      totalLoans,
      totalAmount: basicStats.totalAmount || 0,
      averageAmount: Math.round(basicStats.averageAmount || 0),
      averageInterestRate:
        Math.round((basicStats.averageInterestRate || 0) * 100) / 100,

      // Status counts (legacy compatibility)
      completeLoans: statusCounts.completed?.count || 0,
      pendingLoans:
        (statusCounts.pending?.count || 0) +
        (statusCounts.under_review?.count || 0),
      overdueLoans: overdueStats.overdueCount || 0,
      pendingApplications: statusCounts.pending?.count || 0,
      approvedLoans: statusCounts.approved?.count || 0,
      activeLoans: statusCounts.active?.count || 0,
      rejectedLoans: statusCounts.rejected?.count || 0,

      // Financial metrics
      totalDisbursed: financialStats.totalDisbursed || 0,
      totalCollected: paymentStats.totalCollected || 0,
      totalCompleted: financialStats.totalCompleted || 0,

      // Performance metrics
      defaultRate: Math.round(defaultRate * 100) / 100,
      collectionRate: Math.round(collectionRate * 100) / 100,
      averageOverdueDays: Math.round(overdueStats.averageOverdueDays || 0),

      // Detailed breakdowns
      statusBreakdown: statusCounts,
      workflowBreakdown: workflowCounts,

      // Overdue analysis
      overdueAnalysis: {
        count: overdueStats.overdueCount || 0,
        totalAmount: overdueStats.overdueAmount || 0,
        averageDays: Math.round(overdueStats.averageOverdueDays || 0),
      },
    };

    logger.debug("Loan statistics calculated", {
      totalLoans: response.totalLoans,
      filters: baseFilters,
    });

    res.json({
      success: true,
      data: response,
      filters: baseFilters,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error("Error fetching loan statistics", error, {
      query: req.query,
      userId: req.user?.userId,
    });

    res.status(500).json({
      success: false,
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "Error fetching loan statistics",
        timestamp: new Date().toISOString(),
      },
    });
  }
};

// Get loan agreements (for useLoanData hook)
exports.getLoanAgreements = async (req, res) => {
  try {
    const loans = await Loan.find({
      loanStatus: { $in: ["Active", "Completed"] },
      agreementGenerated: true,
    })
      .populate("clientUserId", "personalInfo registrationId")
      .sort({ createdAt: -1 });

    const agreements = loans.map((loan) => ({
      id: loan._id.toString(),
      loanId: loan.loanApplicationId,
      borrowerId: loan.clientUserId._id.toString(),
      borrowerName: loan.clientUserId.personalInfo.fullName,
      amount: loan.loanAmount,
      interestRate: loan.interestRate,
      termMonths: loan.loanTerm,
      monthlyPayment: loan.monthlyInstallment,
      startDate: loan.createdAt,
      endDate: new Date(
        new Date(loan.createdAt).setMonth(
          new Date(loan.createdAt).getMonth() + loan.loanTerm
        )
      ).toISOString(),
      status: loan.loanStatus === "Completed" ? "completed" : "active",
      signedDate: loan.agreementGeneratedDate,
      documentUrl: loan.agreementUrl,
      createdAt: loan.createdAt,
      updatedAt: loan.updatedAt,
    }));

    res.json(agreements);
  } catch (error) {
    res.status(500).json({
      message: "Error fetching loan agreements",
      error: error.message,
    });
  }
};

// Generate loan agreement (delegated to agreement controller)
exports.generateAgreement = async (req, res) => {
  try {
    // Delegate to the new agreement controller
    const agreementController = require("./agreementController");
    return agreementController.generateAgreement(req, res);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: "AGREEMENT_GENERATION_ERROR",
        message: "Error generating agreement",
        details: error.message,
        timestamp: new Date().toISOString(),
      },
    });
  }
};

// Send agreement to client
exports.sendAgreement = async (req, res) => {
  try {
    const { agreementId } = req.params;

    const loan = await Loan.findById(agreementId).populate(
      "clientUserId",
      "personalInfo"
    );
    if (!loan) {
      return res.status(404).json({ message: "Agreement not found" });
    }

    if (!loan.agreementGenerated) {
      return res.status(400).json({ message: "Agreement not generated yet" });
    }

    // Update agreement status
    loan.agreementStatus = "Sent";
    loan.agreementSentDate = new Date();

    await loan.save();

    // In a real implementation, you would send email here
    // For now, we'll just update the status

    res.json({
      message: "Agreement sent to client successfully",
      loan,
    });
  } catch (error) {
    res.status(500).json({
      message: "Error sending agreement",
      error: error.message,
    });
  }
};

// Download agreement
exports.downloadAgreement = async (req, res) => {
  try {
    const { agreementId } = req.params;

    const loan = await Loan.findById(agreementId).populate(
      "clientUserId",
      "personalInfo"
    );
    if (!loan) {
      return res.status(404).json({ message: "Agreement not found" });
    }

    if (!loan.agreementGenerated) {
      return res.status(400).json({ message: "Agreement not generated yet" });
    }

    // Generate agreement content as a readable text document
    const client = loan.clientUserId;

    const agreementContent = `
LOAN AGREEMENT DOCUMENT
=======================

Agreement ID: ${loan.loanApplicationId}
Generated Date: ${new Date().toLocaleDateString()}
Generated Time: ${new Date().toLocaleTimeString()}

PARTIES TO THE AGREEMENT
========================
Lender: PaySync Financial Services (Pvt) Ltd
Address: No. 123, Galle Road, Colombo 03, Sri Lanka
Phone: +94 11 234 5678
Email: info@paysync.lk

Borrower: ${client?.personalInfo?.fullName || "N/A"}
Email: ${client?.personalInfo?.email || "N/A"}
Registration ID: ${client?.registrationId || "N/A"}

LOAN DETAILS
============
Principal Amount: Rs. ${loan.loanAmount?.toLocaleString() || "N/A"}
Interest Rate: ${loan.interestRate}% per annum
Loan Term: ${loan.loanTerm} months
Monthly Installment: Rs. ${loan.monthlyInstallment?.toLocaleString() || "N/A"}
Total Payable Amount: Rs. ${loan.totalPayableAmount?.toLocaleString() || "N/A"}
Loan Purpose: ${loan.purpose || "N/A"}

TERMS AND CONDITIONS
===================
1. REPAYMENT: The borrower agrees to repay the loan amount with 
   interest in ${loan.loanTerm} equal monthly installments.

2. PAYMENT SCHEDULE: Monthly installments are due on the same date 
   each month starting from the loan disbursement date.

3. LATE PAYMENT: A penalty of 2% per month will be charged on 
   overdue amounts.

4. DEFAULT: Failure to pay two consecutive installments will 
   constitute default.

5. LEGAL ACTION: The lender reserves the right to take legal 
   action in case of default.

6. GOVERNING LAW: This agreement is governed by the laws of 
   Sri Lanka.

SIGNATURES
==========
BORROWER:
Signature: _________________________
Name: ${client?.personalInfo?.fullName || "N/A"}
Date: _____________________________

LENDER REPRESENTATIVE:
Signature: _________________________
Name: _____________________________
Title: Loan Officer
Date: _____________________________

DOCUMENT INFORMATION
===================
This agreement was generated electronically on ${new Date().toLocaleString()}
PaySync Financial Services (Pvt) Ltd - Loan Management System

For any queries regarding this agreement, please contact:
Email: support@paysync.lk
Phone: +94 11 234 5678
Website: www.paysync.lk

IMPORTANT NOTES
===============
- This is a legally binding document
- Please read all terms and conditions carefully
- Keep a copy of this agreement for your records
- Contact us immediately if you have any questions

END OF DOCUMENT
===============
    `;

    // Return as a text file that can be easily opened and read
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="LoanAgreement_${loan.loanApplicationId}.txt"`
    );
    res.send(agreementContent);
  } catch (error) {
    res.status(500).json({
      message: "Error downloading agreement",
      error: error.message,
    });
  }
};

// Helper function to generate unique loan application ID
const generateLoanApplicationId = async () => {
  const year = new Date().getFullYear();
  const month = String(new Date().getMonth() + 1).padStart(2, "0");

  // Find the latest loan for this month
  const latestLoan = await Loan.findOne({
    loanApplicationId: { $regex: `^LA${year}${month}` },
  }).sort({ loanApplicationId: -1 });

  let sequence = 1;
  if (latestLoan) {
    const lastSequence = parseInt(latestLoan.loanApplicationId.slice(-4));
    sequence = lastSequence + 1;
  }

  return `LA${year}${month}${String(sequence).padStart(4, "0")}`;
};


// Approve Loan Function
exports.approveLoan = async (req, res) => {
  try {
    const { loanId } = req.params;
    const { comments = '', rating } = req.body; // Optional comments and rating for agent reviews
    const user = req.user; // From authentication middleware

    logger.info("Approving loan", { loanId, userId: user.userId });

    // Fetch and validate the loan
    const loan = await Loan.findById(loanId).populate('clientUserId', 'personalInfo.email');
    if (!loan) {
      throw new AppError("Loan not found", 404, "LOAN_NOT_FOUND");
    }

    // Permission check: Only assigned agent or regional manager can approve
    const isAgent = loan.assignedAgent?.toString() === user.userId;
    const isRegionalManager = loan.assignedRegionalManager?.toString() === user.userId;
    if (!isAgent && !isRegionalManager) {
      throw new AppError("Unauthorized to approve this loan", 403, "UNAUTHORIZED");
    }

    // Determine approval stage and update accordingly
    let newStage = loan.workflowState.currentStage;
    if (loan.workflowState.currentStage === 'agent_review' && isAgent) {
      loan.agentReview.status = 'Approved';
      loan.agentReview.reviewDate = new Date();
      loan.agentReview.reviewedBy = user.userId;
      loan.agentReview.comments = comments;
      if (rating) loan.agentReview.rating = rating;
      newStage = 'regional_approval';
    } else if (loan.workflowState.currentStage === 'regional_approval' && isRegionalManager) {
      loan.regionalAdminApproval.status = 'Approved';
      loan.regionalAdminApproval.approvalDate = new Date();
      loan.regionalAdminApproval.approvedBy = user.userId;
      loan.regionalAdminApproval.comments = comments;
      newStage = 'approved';
      loan.loanStatus = 'Approved'; // Final approval
    } else {
      throw new AppError("Loan is not in a stage that can be approved by you", 400, "INVALID_STAGE");
    }

    // Advance workflow and add audit entry
    loan.advanceWorkflowStage(newStage, user.userId, comments);
    loan.addAuditEntry('approved', user.userId, { stage: newStage, comments }, comments, req.ip, req.get("User-Agent"));

    await loan.save();

    // Send notifications
    const clientEmail = loan.clientUserId?.personalInfo?.email;
    if (clientEmail) {
      try {
        await sendEmail(
          clientEmail,
          "Loan Application Approved",
          `Your loan application (${loan.loanApplicationId}) has been approved. 
           Status: ${loan.loanStatus}
           Next Steps: Agreement generation will follow.`
        );
      } catch (emailError) {
        logger.error("Failed to send approval email to client", emailError, { loanId, clientEmail });
      }
    }

    logger.info("Loan approved successfully", { loanId, newStage, userId: user.userId });

    res.status(200).json({
      success: true,
      message: "Loan approved successfully",
      data: {
        loanId: loan._id,
        loanApplicationId: loan.loanApplicationId,
        currentStage: loan.workflowState.currentStage,
        loanStatus: loan.loanStatus,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error("Error approving loan", error, { loanId: req.params.loanId, userId: req.user?.userId });

    if (error instanceof AppError) {
      return res.status(error.statusCode).json({
        success: false,
        error: {
          code: error.errorCode,
          message: error.message,
          timestamp: new Date().toISOString(),
        },
      });
    }

    res.status(500).json({
      success: false,
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "Error approving loan",
        timestamp: new Date().toISOString(),
      },
    });
  }
};

// Reject Loan Function
exports.rejectLoan = async (req, res) => {
  try {
    const { loanId } = req.params;
    const { comments } = req.body; // Required reason for rejection
    const user = req.user; // From authentication middleware

    if (!comments) {
      return res.status(400).json({
        success: false,
        error: {
          code: "INVALID_INPUT",
          message: "Rejection comments are required",
          timestamp: new Date().toISOString(),
        },
      });
    }

    logger.info("Rejecting loan", { loanId, userId: user.userId });

    // Fetch and validate the loan
    const loan = await Loan.findById(loanId).populate('clientUserId', 'personalInfo.email');
    if (!loan) {
      throw new AppError("Loan not found", 404, "LOAN_NOT_FOUND");
    }

    // Permission check: Only assigned agent or regional manager can reject
    const isAgent = loan.assignedAgent?.toString() === user.userId;
    const isRegionalManager = loan.assignedRegionalManager?.toString() === user.userId;
    if (!isAgent && !isRegionalManager) {
      throw new AppError("Unauthorized to reject this loan", 403, "UNAUTHORIZED");
    }

    // Update review status based on user role
    if (isAgent) {
      loan.agentReview.status = 'Rejected';
      loan.agentReview.reviewDate = new Date();
      loan.agentReview.reviewedBy = user.userId;
      loan.agentReview.comments = comments;
    } else if (isRegionalManager) {
      loan.regionalAdminApproval.status = 'Rejected';
      loan.regionalAdminApproval.approvalDate = new Date();
      loan.regionalAdminApproval.approvedBy = user.userId;
      loan.regionalAdminApproval.comments = comments;
    }

    // Block workflow, set status to Rejected, and add audit entry
    loan.blockWorkflow(`Rejected by ${isAgent ? 'agent' : 'regional manager'}: ${comments}`, user.userId);
    loan.loanStatus = 'Rejected';
    loan.addAuditEntry('rejected', user.userId, { status: 'Rejected', comments }, comments, req.ip, req.get("User-Agent"));

    await loan.save();

    // Send notifications
    const clientEmail = loan.clientUserId?.personalInfo?.email;
    if (clientEmail) {
      try {
        await sendEmail(
          clientEmail,
          "Loan Application Rejected",
          `Your loan application (${loan.loanApplicationId}) has been rejected. 
           Reason: ${comments}
           Please contact support for more details.`
        );
      } catch (emailError) {
        logger.error("Failed to send rejection email to client", emailError, { loanId, clientEmail });
      }
    }

    logger.info("Loan rejected successfully", { loanId, userId: user.userId });

    res.status(200).json({
      success: true,
      message: "Loan rejected successfully",
      data: {
        loanId: loan._id,
        loanApplicationId: loan.loanApplicationId,
        loanStatus: loan.loanStatus,
        rejectionReason: comments,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error("Error rejecting loan", error, { loanId: req.params.loanId, userId: req.user?.userId });

    if (error instanceof AppError) {
      return res.status(error.statusCode).json({
        success: false,
        error: {
          code: error.errorCode,
          message: error.message,
          timestamp: new Date().toISOString(),
        },
      });
    }

    res.status(500).json({
      success: false,
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "Error rejecting loan",
        timestamp: new Date().toISOString(),
      },
    });
  }
};

