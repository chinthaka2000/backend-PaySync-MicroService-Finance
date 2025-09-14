/**
 * Mobile App Routes for Clients
 * Handles client registration, loans, payments, and notifications
 */

const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const { authenticate } = require("../middlewares/authMiddleware");
const { validate } = require("../validation");
const Joi = require("joi");

// Configure multer for file uploads
const upload = multer({
  dest: "uploads/mobile/",
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "image/jpg",
      "application/pdf",
    ];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(
        new Error(
          "Invalid file type. Only JPEG, PNG, and PDF files are allowed."
        )
      );
    }
  },
});

// ==================== CLIENT AUTHENTICATION ====================

/**
 * Client Registration
 * POST /api/mobile/auth/register
 */
router.post(
  "/auth/register",
  validate(
    Joi.object({
      firstName: Joi.string().required().min(2).max(50),
      lastName: Joi.string().required().min(2).max(50),
      email: Joi.string().email().required(),
      phone: Joi.string()
        .required()
        .pattern(/^[0-9+\-\s()]+$/),
      password: Joi.string().min(6).required(),
      dateOfBirth: Joi.date().required(),
      address: Joi.object({
        street: Joi.string().required(),
        city: Joi.string().required(),
        district: Joi.string().required(),
        postalCode: Joi.string().required(),
      }).required(),
      occupation: Joi.string().required(),
      monthlyIncome: Joi.number().positive().required(),
      nic: Joi.string().required().min(10).max(12),
    }),
    "body"
  ),
  async (req, res) => {
    try {
      const {
        firstName,
        lastName,
        email,
        phone,
        password,
        dateOfBirth,
        address,
        occupation,
        monthlyIncome,
        nic,
      } = req.body;

      // Check if client already exists
      const existingClient = await require("../models/Client").findOne({
        $or: [{ email }, { phone }, { nic }],
      });

      if (existingClient) {
        return res.status(400).json({
          success: false,
          error: {
            code: "CLIENT_EXISTS",
            message: "Client with this email, phone, or NIC already exists",
            timestamp: new Date().toISOString(),
          },
        });
      }

      // Hash password
      const passwordHash = await bcrypt.hash(password, 12);

      // Find an available agent (round-robin assignment)
      const agents = await require("../models/Staff")
        .find({
          role: "agent",
          status: "active",
        })
        .populate("region");

      if (agents.length === 0) {
        return res.status(503).json({
          success: false,
          error: {
            code: "NO_AGENTS_AVAILABLE",
            message:
              "No agents available for assignment. Please try again later.",
            timestamp: new Date().toISOString(),
          },
        });
      }

      // Simple round-robin assignment based on client count
      const agentAssignments = await Promise.all(
        agents.map(async (agent) => ({
          agent,
          clientCount: await require("../models/Client").countDocuments({
            assignedReviewer: agent._id,
          }),
        }))
      );

      const assignedAgent = agentAssignments.reduce((min, current) =>
        current.clientCount < min.clientCount ? current : min
      ).agent;

      // Create client
      const client = new require("../models/Client")({
        firstName,
        lastName,
        email,
        phone,
        passwordHash,
        dateOfBirth,
        address,
        occupation,
        monthlyIncome,
        nic,
        assignedReviewer: assignedAgent._id,
        status: "pending_verification",
        registrationDate: new Date(),
        kycStatus: "pending",
      });

      await client.save();

      // Generate JWT token for client
      const token = jwt.sign(
        {
          clientId: client._id,
          email: client.email,
          type: "client",
        },
        process.env.JWT_SECRET,
        { expiresIn: "30d" }
      );

      res.status(201).json({
        success: true,
        message: "Registration successful. Please complete KYC verification.",
        data: {
          client: {
            id: client._id,
            firstName: client.firstName,
            lastName: client.lastName,
            email: client.email,
            phone: client.phone,
            status: client.status,
            kycStatus: client.kycStatus,
            assignedAgent: {
              id: assignedAgent._id,
              name: assignedAgent.name,
              region: assignedAgent.region.name,
            },
          },
          token,
          nextStep: "kyc_verification",
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Client registration error:", error);
      res.status(500).json({
        success: false,
        error: {
          code: "SERVER_ERROR",
          message: "Internal server error during registration",
          timestamp: new Date().toISOString(),
        },
      });
    }
  }
);

/**
 * Client Login
 * POST /api/mobile/auth/login
 */
router.post(
  "/auth/login",
  validate(
    Joi.object({
      email: Joi.string().email().required(),
      password: Joi.string().required(),
    }),
    "body"
  ),
  async (req, res) => {
    try {
      const { email, password } = req.body;

      // Find client
      const client = await require("../models/Client")
        .findOne({ email })
        .select("+passwordHash")
        .populate("assignedReviewer", "name email region");

      if (!client) {
        return res.status(401).json({
          success: false,
          error: {
            code: "INVALID_CREDENTIALS",
            message: "Invalid email or password",
            timestamp: new Date().toISOString(),
          },
        });
      }

      // Verify password
      const isPasswordValid = await bcrypt.compare(
        password,
        client.passwordHash
      );
      if (!isPasswordValid) {
        return res.status(401).json({
          success: false,
          error: {
            code: "INVALID_CREDENTIALS",
            message: "Invalid email or password",
            timestamp: new Date().toISOString(),
          },
        });
      }

      // Generate JWT token
      const token = jwt.sign(
        {
          clientId: client._id,
          email: client.email,
          type: "client",
        },
        process.env.JWT_SECRET,
        { expiresIn: "30d" }
      );

      // Update last login
      client.lastLogin = new Date();
      await client.save();

      res.status(200).json({
        success: true,
        message: "Login successful",
        data: {
          client: {
            id: client._id,
            firstName: client.firstName,
            lastName: client.lastName,
            email: client.email,
            phone: client.phone,
            status: client.status,
            kycStatus: client.kycStatus,
            assignedAgent: client.assignedReviewer,
          },
          token,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Client login error:", error);
      res.status(500).json({
        success: false,
        error: {
          code: "SERVER_ERROR",
          message: "Internal server error during login",
          timestamp: new Date().toISOString(),
        },
      });
    }
  }
);

// Client authentication middleware
const authenticateClient = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({
      success: false,
      error: {
        code: "AUTH_ERROR",
        message: "Unauthorized: No token provided",
        timestamp: new Date().toISOString(),
      },
    });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (decoded.type !== "client") {
      return res.status(401).json({
        success: false,
        error: {
          code: "INVALID_TOKEN_TYPE",
          message: "Invalid token type for mobile app",
          timestamp: new Date().toISOString(),
        },
      });
    }

    req.client = {
      clientId: decoded.clientId,
      email: decoded.email,
    };

    next();
  } catch (err) {
    return res.status(401).json({
      success: false,
      error: {
        code: "INVALID_TOKEN",
        message: "Invalid or expired token",
        timestamp: new Date().toISOString(),
      },
    });
  }
};

// ==================== KYC VERIFICATION ====================

/**
 * Upload KYC Documents
 * POST /api/mobile/kyc/upload
 */
router.post(
  "/kyc/upload",
  authenticateClient,
  upload.fields([
    { name: "nicFront", maxCount: 1 },
    { name: "nicBack", maxCount: 1 },
    { name: "selfie", maxCount: 1 },
    { name: "incomeProof", maxCount: 1 },
  ]),
  async (req, res) => {
    try {
      const client = await require("../models/Client").findById(
        req.client.clientId
      );

      if (!client) {
        return res.status(404).json({
          success: false,
          error: {
            code: "CLIENT_NOT_FOUND",
            message: "Client not found",
            timestamp: new Date().toISOString(),
          },
        });
      }

      const documents = {};

      if (req.files.nicFront) documents.nicFront = req.files.nicFront[0].path;
      if (req.files.nicBack) documents.nicBack = req.files.nicBack[0].path;
      if (req.files.selfie) documents.selfie = req.files.selfie[0].path;
      if (req.files.incomeProof)
        documents.incomeProof = req.files.incomeProof[0].path;

      client.kycDocuments = { ...client.kycDocuments, ...documents };
      client.kycStatus = "under_review";
      client.kycSubmittedAt = new Date();
      await client.save();

      res.status(200).json({
        success: true,
        message: "KYC documents uploaded successfully",
        data: {
          kycStatus: client.kycStatus,
          documentsUploaded: Object.keys(documents),
          nextStep: "wait_for_approval",
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error("KYC upload error:", error);
      res.status(500).json({
        success: false,
        error: {
          code: "SERVER_ERROR",
          message: "Internal server error during KYC upload",
          timestamp: new Date().toISOString(),
        },
      });
    }
  }
);

/**
 * Get KYC Status
 * GET /api/mobile/kyc/status
 */
router.get("/kyc/status", authenticateClient, async (req, res) => {
  try {
    const client = await require("../models/Client")
      .findById(req.client.clientId)
      .select(
        "kycStatus kycSubmittedAt kycApprovedAt kycRejectedAt kycRejectionReason"
      );

    res.status(200).json({
      success: true,
      message: "KYC status retrieved successfully",
      data: {
        kycStatus: client.kycStatus,
        submittedAt: client.kycSubmittedAt,
        approvedAt: client.kycApprovedAt,
        rejectedAt: client.kycRejectedAt,
        rejectionReason: client.kycRejectionReason,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Get KYC status error:", error);
    res.status(500).json({
      success: false,
      error: {
        code: "SERVER_ERROR",
        message: "Internal server error while fetching KYC status",
        timestamp: new Date().toISOString(),
      },
    });
  }
});

module.exports = router;
// ==================== LOAN MANAGEMENT ====================

/**
 * Apply for Loan
 * POST /api/mobile/loans/apply
 */
router.post(
  "/loans/apply",
  authenticateClient,
  validate(
    Joi.object({
      loanAmount: Joi.number().positive().max(10000000).required(),
      loanPurpose: Joi.string().required().min(10).max(500),
      loanTerm: Joi.number().integer().min(6).max(60).required(), // months
      collateral: Joi.object({
        type: Joi.string().required(),
        value: Joi.number().positive().required(),
        description: Joi.string().required(),
      }).optional(),
      guarantor: Joi.object({
        name: Joi.string().required(),
        phone: Joi.string().required(),
        relationship: Joi.string().required(),
        nic: Joi.string().required(),
      }).optional(),
    }),
    "body"
  ),
  async (req, res) => {
    try {
      const { loanAmount, loanPurpose, loanTerm, collateral, guarantor } =
        req.body;

      // Get client details
      const client = await require("../models/Client").findById(
        req.client.clientId
      );

      if (!client) {
        return res.status(404).json({
          success: false,
          error: {
            code: "CLIENT_NOT_FOUND",
            message: "Client not found",
            timestamp: new Date().toISOString(),
          },
        });
      }

      // Check KYC status
      if (client.kycStatus !== "approved") {
        return res.status(400).json({
          success: false,
          error: {
            code: "KYC_NOT_APPROVED",
            message:
              "KYC verification must be completed before applying for loans",
            timestamp: new Date().toISOString(),
          },
        });
      }

      // Check for existing pending loans
      const existingLoan = await require("../models/Loan").findOne({
        clientUserId: client._id,
        loanStatus: { $in: ["Pending", "Under Review"] },
      });

      if (existingLoan) {
        return res.status(400).json({
          success: false,
          error: {
            code: "PENDING_LOAN_EXISTS",
            message: "You already have a pending loan application",
            timestamp: new Date().toISOString(),
          },
        });
      }

      // Calculate interest rate based on loan amount and client profile
      let interestRate = 12.5; // Base rate
      if (loanAmount > 5000000) interestRate = 14.0; // Higher rate for large loans
      if (client.monthlyIncome > 100000) interestRate -= 1.0; // Discount for high income

      // Create loan application
      const loan = new require("../models/Loan")({
        clientUserId: client._id,
        loanAmount,
        loanPurpose,
        loanTerm,
        interestRate,
        collateral,
        guarantor,
        loanStatus: "Pending",
        applicationDate: new Date(),
        assignedReviewer: client.assignedReviewer,
      });

      await loan.save();

      res.status(201).json({
        success: true,
        message: "Loan application submitted successfully",
        data: {
          loan: {
            id: loan._id,
            loanAmount: loan.loanAmount,
            loanPurpose: loan.loanPurpose,
            loanTerm: loan.loanTerm,
            interestRate: loan.interestRate,
            loanStatus: loan.loanStatus,
            applicationDate: loan.applicationDate,
            estimatedMonthlyPayment:
              (loanAmount * (interestRate / 100 / 12)) /
              (1 - Math.pow(1 + interestRate / 100 / 12, -loanTerm)),
          },
          nextStep: "wait_for_review",
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Loan application error:", error);
      res.status(500).json({
        success: false,
        error: {
          code: "SERVER_ERROR",
          message: "Internal server error during loan application",
          timestamp: new Date().toISOString(),
        },
      });
    }
  }
);

/**
 * Get Client's Loans
 * GET /api/mobile/loans
 */
router.get("/loans", authenticateClient, async (req, res) => {
  try {
    const { status, page = 1, limit = 10 } = req.query;

    let query = { clientUserId: req.client.clientId };
    if (status) query.loanStatus = status;

    const loans = await require("../models/Loan")
      .find(query)
      .populate("assignedReviewer", "name email")
      .sort({ applicationDate: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await require("../models/Loan").countDocuments(query);

    const loansWithPayments = await Promise.all(
      loans.map(async (loan) => {
        const loanObj = loan.toObject();

        if (loan.loanStatus === "approved") {
          // Get payment history
          const payments = await require("../models/Payment")
            .find({
              loanId: loan._id,
            })
            .sort({ paymentDate: -1 })
            .limit(5);

          loanObj.recentPayments = payments;
          loanObj.nextPaymentDue = loan.nextPaymentDate;
          loanObj.remainingBalance = loan.remainingBalance;
        }

        return loanObj;
      })
    );

    res.status(200).json({
      success: true,
      message: "Loans retrieved successfully",
      data: {
        loans: loansWithPayments,
        pagination: {
          total,
          page: parseInt(page),
          pages: Math.ceil(total / limit),
          limit: parseInt(limit),
        },
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Get loans error:", error);
    res.status(500).json({
      success: false,
      error: {
        code: "SERVER_ERROR",
        message: "Internal server error while fetching loans",
        timestamp: new Date().toISOString(),
      },
    });
  }
});

/**
 * Get Loan Details
 * GET /api/mobile/loans/:id
 */
router.get(
  "/loans/:id",
  authenticateClient,
  validate(
    Joi.object({
      id: Joi.string().hex().length(24).required(),
    }),
    "params"
  ),
  async (req, res) => {
    try {
      const { id } = req.params;

      const loan = await require("../models/Loan")
        .findOne({
          _id: id,
          clientUserId: req.client.clientId,
        })
        .populate("assignedReviewer", "name email phone");

      if (!loan) {
        return res.status(404).json({
          success: false,
          error: {
            code: "LOAN_NOT_FOUND",
            message: "Loan not found",
            timestamp: new Date().toISOString(),
          },
        });
      }

      let loanDetails = loan.toObject();

      if (loan.loanStatus === "approved") {
        // Get payment schedule and history
        const [payments, paymentSchedule] = await Promise.all([
          require("../models/Payment")
            .find({ loanId: loan._id })
            .sort({ paymentDate: -1 }),
          // Generate payment schedule (simplified)
          Array.from({ length: loan.loanTerm }, (_, i) => ({
            installmentNumber: i + 1,
            dueDate: new Date(
              loan.approvedDate.getTime() + (i + 1) * 30 * 24 * 60 * 60 * 1000
            ),
            amount: loan.monthlyPayment,
            status: i < payments.length ? "paid" : "pending",
          })),
        ]);

        loanDetails.payments = payments;
        loanDetails.paymentSchedule = paymentSchedule;
      }

      res.status(200).json({
        success: true,
        message: "Loan details retrieved successfully",
        data: { loan: loanDetails },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Get loan details error:", error);
      res.status(500).json({
        success: false,
        error: {
          code: "SERVER_ERROR",
          message: "Internal server error while fetching loan details",
          timestamp: new Date().toISOString(),
        },
      });
    }
  }
);

// ==================== PAYMENT MANAGEMENT ====================

/**
 * Upload Payment Proof
 * POST /api/mobile/payments/upload
 */
router.post(
  "/payments/upload",
  authenticateClient,
  upload.single("paymentProof"),
  validate(
    Joi.object({
      loanId: Joi.string().hex().length(24).required(),
      paymentAmount: Joi.number().positive().required(),
      paymentDate: Joi.date().required(),
      paymentMethod: Joi.string()
        .valid("bank_transfer", "cash_deposit", "online_payment")
        .required(),
      referenceNumber: Joi.string().optional(),
      notes: Joi.string().max(500).optional(),
    }),
    "body"
  ),
  async (req, res) => {
    try {
      const {
        loanId,
        paymentAmount,
        paymentDate,
        paymentMethod,
        referenceNumber,
        notes,
      } = req.body;

      // Verify loan belongs to client
      const loan = await require("../models/Loan").findOne({
        _id: loanId,
        clientUserId: req.client.clientId,
        loanStatus: "approved",
      });

      if (!loan) {
        return res.status(404).json({
          success: false,
          error: {
            code: "LOAN_NOT_FOUND",
            message: "Approved loan not found",
            timestamp: new Date().toISOString(),
          },
        });
      }

      // Create payment record
      const payment = new require("../models/Payment")({
        loanId: loan._id,
        clientId: req.client.clientId,
        paymentAmount,
        paymentDate,
        paymentMethod,
        referenceNumber,
        notes,
        paymentProof: req.file ? req.file.path : null,
        status: "pending_verification",
        submittedAt: new Date(),
      });

      await payment.save();

      res.status(201).json({
        success: true,
        message: "Payment submitted successfully. Awaiting verification.",
        data: {
          payment: {
            id: payment._id,
            paymentAmount: payment.paymentAmount,
            paymentDate: payment.paymentDate,
            paymentMethod: payment.paymentMethod,
            status: payment.status,
            submittedAt: payment.submittedAt,
          },
          nextStep: "wait_for_verification",
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Payment upload error:", error);
      res.status(500).json({
        success: false,
        error: {
          code: "SERVER_ERROR",
          message: "Internal server error during payment upload",
          timestamp: new Date().toISOString(),
        },
      });
    }
  }
);

/**
 * Get Payment History
 * GET /api/mobile/payments
 */
router.get("/payments", authenticateClient, async (req, res) => {
  try {
    const { loanId, status, page = 1, limit = 10 } = req.query;

    let query = { clientId: req.client.clientId };
    if (loanId) query.loanId = loanId;
    if (status) query.status = status;

    const payments = await require("../models/Payment")
      .find(query)
      .populate("loanId", "loanAmount loanPurpose")
      .sort({ paymentDate: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await require("../models/Payment").countDocuments(query);

    res.status(200).json({
      success: true,
      message: "Payment history retrieved successfully",
      data: {
        payments,
        pagination: {
          total,
          page: parseInt(page),
          pages: Math.ceil(total / limit),
          limit: parseInt(limit),
        },
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Get payment history error:", error);
    res.status(500).json({
      success: false,
      error: {
        code: "SERVER_ERROR",
        message: "Internal server error while fetching payment history",
        timestamp: new Date().toISOString(),
      },
    });
  }
});

// ==================== NOTIFICATIONS ====================

/**
 * Get Notifications
 * GET /api/mobile/notifications
 */
router.get("/notifications", authenticateClient, async (req, res) => {
  try {
    const { page = 1, limit = 20, unreadOnly = false } = req.query;

    let query = { clientId: req.client.clientId };
    if (unreadOnly === "true") query.isRead = false;

    const notifications = await require("../models/Notification")
      .find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await require("../models/Notification").countDocuments(query);
    const unreadCount = await require("../models/Notification").countDocuments({
      clientId: req.client.clientId,
      isRead: false,
    });

    res.status(200).json({
      success: true,
      message: "Notifications retrieved successfully",
      data: {
        notifications,
        unreadCount,
        pagination: {
          total,
          page: parseInt(page),
          pages: Math.ceil(total / limit),
          limit: parseInt(limit),
        },
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Get notifications error:", error);
    res.status(500).json({
      success: false,
      error: {
        code: "SERVER_ERROR",
        message: "Internal server error while fetching notifications",
        timestamp: new Date().toISOString(),
      },
    });
  }
});

/**
 * Mark Notification as Read
 * PUT /api/mobile/notifications/:id/read
 */
router.put("/notifications/:id/read", authenticateClient, async (req, res) => {
  try {
    const { id } = req.params;

    const notification =
      await require("../models/Notification").findOneAndUpdate(
        { _id: id, clientId: req.client.clientId },
        { isRead: true, readAt: new Date() },
        { new: true }
      );

    if (!notification) {
      return res.status(404).json({
        success: false,
        error: {
          code: "NOTIFICATION_NOT_FOUND",
          message: "Notification not found",
          timestamp: new Date().toISOString(),
        },
      });
    }

    res.status(200).json({
      success: true,
      message: "Notification marked as read",
      data: { notification },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Mark notification read error:", error);
    res.status(500).json({
      success: false,
      error: {
        code: "SERVER_ERROR",
        message: "Internal server error while updating notification",
        timestamp: new Date().toISOString(),
      },
    });
  }
});

/**
 * Get Client Profile
 * GET /api/mobile/profile
 */
router.get("/profile", authenticateClient, async (req, res) => {
  try {
    const client = await require("../models/Client")
      .findById(req.client.clientId)
      .populate("assignedReviewer", "name email phone")
      .select("-passwordHash");

    if (!client) {
      return res.status(404).json({
        success: false,
        error: {
          code: "CLIENT_NOT_FOUND",
          message: "Client not found",
          timestamp: new Date().toISOString(),
        },
      });
    }

    // Get loan summary
    const loanSummary = await require("../models/Loan").aggregate([
      { $match: { clientUserId: client._id } },
      {
        $group: {
          _id: "$loanStatus",
          count: { $sum: 1 },
          totalAmount: { $sum: "$loanAmount" },
        },
      },
    ]);

    res.status(200).json({
      success: true,
      message: "Profile retrieved successfully",
      data: {
        client,
        loanSummary,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Get profile error:", error);
    res.status(500).json({
      success: false,
      error: {
        code: "SERVER_ERROR",
        message: "Internal server error while fetching profile",
        timestamp: new Date().toISOString(),
      },
    });
  }
});

module.exports = router;
