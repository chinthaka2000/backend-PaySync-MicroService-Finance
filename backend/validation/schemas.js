const Joi = require("joi");

// Custom validators
const objectId = Joi.string()
  .pattern(/^[0-9a-fA-F]{24}$/)
  .message("Invalid ObjectId format");
const email = Joi.string().email().lowercase();
const phone = Joi.string()
  .pattern(/^[0-9+\-\s()]+$/)
  .min(10)
  .max(15);
const password = Joi.string()
  .min(8)
  .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
  .message(
    "Password must contain at least 8 characters with uppercase, lowercase, and number"
  );

// Common schemas
const paginationSchema = {
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10),
  sort: Joi.string()
    .valid(
      "createdAt",
      "-createdAt",
      "loanAmount",
      "-loanAmount",
      "name",
      "-name"
    )
    .default("-createdAt"),
};

// Authentication schemas
const authSchemas = {
  login: {
    body: Joi.object({
      email: email.required(),
      password: Joi.string().required(),
    }),
  },

  refreshToken: {
    body: Joi.object({
      refreshToken: Joi.string().required(),
    }),
  },

  changePassword: {
    body: Joi.object({
      currentPassword: Joi.string().required(),
      newPassword: password.required(),
      confirmPassword: Joi.string()
        .valid(Joi.ref("newPassword"))
        .required()
        .messages({ "any.only": "Passwords do not match" }),
    }),
  },

  validateRoleCreation: {
    body: Joi.object({
      targetRole: Joi.string()
        .valid(
          "agent",
          "regional_manager",
          "moderate_admin",
          "ceo",
          "super_admin"
        )
        .required(),
    }),
  },
};

// Loan schemas
const loanSchemas = {
  createLoan: {
    body: Joi.object({
      clientUserId: objectId.required(),
      loanAmount: Joi.number().positive().min(1000).max(10000000).required(),
      loanTerm: Joi.number().integer().min(1).max(360).required(),
      interestRate: Joi.number().positive().min(0.01).max(50).required(),
      loanPurpose: Joi.string().min(10).max(500).required(),
      guarantorInfo: Joi.object({
        name: Joi.string().min(2).max(100).required(),
        relationship: Joi.string().min(2).max(50).required(),
        contactNumber: phone.required(),
        address: Joi.string().min(10).max(200).required(),
        idNumber: Joi.string().min(5).max(20).required(),
      }).required(),
      collateral: Joi.object({
        type: Joi.string()
          .valid("property", "vehicle", "jewelry", "other")
          .required(),
        description: Joi.string().min(10).max(300).required(),
        estimatedValue: Joi.number().positive().required(),
      }).optional(),
    }),
  },

  getLoanById: {
    params: Joi.object({
      id: Joi.alternatives()
        .try(
          objectId,
          Joi.string().min(5).max(50) // Allow loan application ID
        )
        .required(),
    }),
  },

  getAgentLoans: {
    params: Joi.object({
      agentId: objectId.required(),
    }),
    query: Joi.object({
      ...paginationSchema,
      status: Joi.alternatives()
        .try(
          Joi.string().valid(
            "pending",
            "approved",
            "rejected",
            "active",
            "completed",
            "defaulted",
            "under_review",
            "Active",
            "Pending",
            "Approved",
            "Rejected"
          ),
          Joi.array().items(
            Joi.string().valid(
              "pending",
              "approved",
              "rejected",
              "active",
              "completed",
              "defaulted",
              "under_review",
              "Active",
              "Pending",
              "Approved",
              "Rejected"
            )
          )
        )
        .optional(),
      startDate: Joi.date().iso().optional(),
      endDate: Joi.date().iso().min(Joi.ref("startDate")).optional(),
    }),
  },

  reviewLoan: {
    params: Joi.object({
      loanId: Joi.alternatives()
        .try(
          objectId,
          Joi.string().min(5).max(50) // Allow loan application ID
        )
        .required(),
    }),
    body: Joi.object({
      status: Joi.string()
        .valid("approved", "rejected", "needs_revision")
        .required(),
      comments: Joi.string().min(10).max(1000).required(),
      recommendedAmount: Joi.number().positive().optional(),
      conditions: Joi.array().items(Joi.string().min(5).max(200)).optional(),
    }),
  },

  updateLoanStatus: {
    params: Joi.object({
      loanId: Joi.alternatives()
        .try(
          objectId,
          Joi.string().min(5).max(50) // Allow loan application ID
        )
        .required(),
    }),
    body: Joi.object({
      status: Joi.string()
        .valid(
          "pending",
          "approved",
          "rejected",
          "active",
          "completed",
          "defaulted"
        )
        .required(),
      reason: Joi.string().min(10).max(500).required(),
      effectiveDate: Joi.date().iso().optional(),
    }),
  },

  addPayment: {
    params: Joi.object({
      loanId: Joi.alternatives()
        .try(
          objectId,
          Joi.string().min(5).max(50) // Allow loan application ID
        )
        .required(),
    }),
    body: Joi.object({
      amount: Joi.number().positive().required(),
      paymentDate: Joi.date()
        .iso()
        .default(() => new Date()),
      paymentMethod: Joi.string()
        .valid("cash", "bank_transfer", "mobile_money", "check")
        .required(),
      reference: Joi.string().min(3).max(50).optional(),
      notes: Joi.string().max(300).optional(),
    }),
  },

  searchLoans: {
    query: Joi.object({
      ...paginationSchema,
      q: Joi.string().min(2).max(100).optional(),
      status: Joi.string()
        .valid(
          "pending",
          "approved",
          "rejected",
          "active",
          "completed",
          "defaulted"
        )
        .optional(),
      minAmount: Joi.number().positive().optional(),
      maxAmount: Joi.number().positive().min(Joi.ref("minAmount")).optional(),
      startDate: Joi.date().iso().optional(),
      endDate: Joi.date().iso().min(Joi.ref("startDate")).optional(),
      agentId: objectId.optional(),
      clientId: objectId.optional(),
    }),
  },

  regionalApproval: {
    params: Joi.object({
      loanId: Joi.alternatives()
        .try(
          objectId,
          Joi.string().min(5).max(50) // Allow loan application ID
        )
        .required(),
    }),
    body: Joi.object({
      status: Joi.string().valid("approved", "rejected").required(),
      comments: Joi.string().min(10).max(1000).required(),
      conditions: Joi.array().items(Joi.string().min(5).max(200)).optional(),
      recommendedAmount: Joi.number().positive().optional(),
      approvalLevel: Joi.string()
        .valid("standard", "conditional", "high_value")
        .optional(),
    }),
  },

  getRegionalManagerLoans: {
    params: Joi.object({
      regionalManagerId: objectId.required(),
    }),
    query: Joi.object({
      ...paginationSchema,
      status: Joi.string()
        .valid("pending_approval", "approved", "rejected", "all")
        .default("pending_approval"),
      search: Joi.string().min(2).max(100).optional(),
      sortBy: Joi.string()
        .valid(
          "createdAt",
          "agentReview.reviewDate",
          "loanAmount",
          "clientName"
        )
        .default("agentReview.reviewDate"),
      sortOrder: Joi.string().valid("asc", "desc").default("asc"),
      startDate: Joi.date().iso().optional(),
      endDate: Joi.date().iso().min(Joi.ref("startDate")).optional(),
      minAmount: Joi.number().positive().optional(),
      maxAmount: Joi.number().positive().min(Joi.ref("minAmount")).optional(),
      agentId: objectId.optional(),
    }),
  },

  getEnhancedAgentLoans: {
    params: Joi.object({
      agentId: objectId.required(),
    }),
    query: Joi.object({
      ...paginationSchema,
      status: Joi.alternatives()
        .try(
          Joi.string().valid(
            "pending",
            "approved",
            "rejected",
            "active",
            "completed",
            "defaulted",
            "under_review",
            "Active",
            "Pending",
            "Approved",
            "Rejected"
          ),
          Joi.array().items(
            Joi.string().valid(
              "pending",
              "approved",
              "rejected",
              "active",
              "completed",
              "defaulted",
              "under_review",
              "Active",
              "Pending",
              "Approved",
              "Rejected"
            )
          )
        )
        .optional(),
      workflowStage: Joi.string()
        .valid(
          "application_submitted",
          "agent_approved",
          "agent_rejected",
          "regional_approved",
          "regional_rejected",
          "agreement_generated",
          "funds_disbursed",
          "loan_active",
          "loan_completed"
        )
        .optional(),
      search: Joi.string().min(2).max(100).optional(),
      sortBy: Joi.string()
        .valid("createdAt", "updatedAt", "loanAmount", "clientName", "status")
        .default("createdAt"),
      sortOrder: Joi.string().valid("asc", "desc").default("desc"),
      startDate: Joi.date().iso().optional(),
      endDate: Joi.date().iso().min(Joi.ref("startDate")).optional(),
      minAmount: Joi.number().positive().optional(),
      maxAmount: Joi.number().positive().min(Joi.ref("minAmount")).optional(),
      product: Joi.string().min(2).max(50).optional(),
      purpose: Joi.string().min(2).max(100).optional(),
    }),
  },

  getEnhancedLoanStats: {
    query: Joi.object({
      regionId: objectId.optional(),
      agentId: objectId.optional(),
      startDate: Joi.date().iso().optional(),
      endDate: Joi.date().iso().min(Joi.ref("startDate")).optional(),
      includeOverdue: Joi.boolean().default(true),
      includeWorkflowBreakdown: Joi.boolean().default(true),
    }),
  },
};

// Client schemas
const clientSchemas = {
  registerClient: {
    body: Joi.object({
      personalInfo: Joi.object({
        firstName: Joi.string().min(2).max(50).required(),
        lastName: Joi.string().min(2).max(50).required(),
        dateOfBirth: Joi.date().max("now").required(),
        gender: Joi.string().valid("male", "female", "other").required(),
        maritalStatus: Joi.string()
          .valid("single", "married", "divorced", "widowed")
          .required(),
        idNumber: Joi.string().min(5).max(20).required(),
        phoneNumber: phone.required(),
        email: email.optional(),
        address: Joi.object({
          street: Joi.string().min(5).max(100).required(),
          city: Joi.string().min(2).max(50).required(),
          district: Joi.string()
            .valid(
              "Colombo",
              "Gampaha",
              "Kalutara",
              "Kandy",
              "Matale",
              "Nuwara Eliya",
              "Galle",
              "Matara",
              "Hambantota",
              "Jaffna",
              "Kilinochchi",
              "Mannar",
              "Vavuniya",
              "Mullaitivu",
              "Batticaloa",
              "Ampara",
              "Trincomalee",
              "Kurunegala",
              "Puttalam",
              "Anuradhapura",
              "Polonnaruwa",
              "Badulla",
              "Monaragala",
              "Ratnapura",
              "Kegalle"
            )
            .required(),
          postalCode: Joi.string().min(5).max(10).required(),
        }).required(),
      }).required(),

      employmentInfo: Joi.object({
        employmentType: Joi.string()
          .valid("employed", "self_employed", "unemployed", "retired")
          .required(),
        employer: Joi.string()
          .min(2)
          .max(100)
          .when("employmentType", {
            is: Joi.valid("employed"),
            then: Joi.required(),
            otherwise: Joi.optional(),
          }),
        jobTitle: Joi.string()
          .min(2)
          .max(100)
          .when("employmentType", {
            is: Joi.valid("employed"),
            then: Joi.required(),
            otherwise: Joi.optional(),
          }),
        monthlyIncome: Joi.number().positive().required(),
        workExperience: Joi.number().integer().min(0).max(50).required(),
        businessType: Joi.string().min(2).max(100).when("employmentType", {
          is: "self_employed",
          then: Joi.required(),
          otherwise: Joi.optional(),
        }),
      }).required(),

      assignedAgent: objectId.optional(),
    }),
  },

  getClientById: {
    params: Joi.object({
      id: objectId.required(),
    }),
  },

  getClientByAssignerId: {
    params: Joi.object({
      id: objectId.required(),
    }),
    query: Joi.object({
      ...paginationSchema,
      status: Joi.string()
        .valid("pending", "approved", "rejected", "suspended", "active")
        .optional(),
    }),
  },

  approveClient: {
    params: Joi.object({
      id: objectId.required(),
    }),
    body: Joi.object({
      approvalNotes: Joi.string().max(500).optional(),
      creditLimit: Joi.number().positive().optional(),
    }),
  },

  rejectClient: {
    params: Joi.object({
      id: objectId.required(),
    }),
    body: Joi.object({
      rejectionReason: Joi.string().min(10).max(500).required(),
    }),
  },

  updateClientStatus: {
    body: Joi.object({
      clientId: objectId.required(),
      status: Joi.string()
        .valid("pending", "approved", "rejected", "suspended", "active")
        .required(),
      reason: Joi.string().min(5).max(500).optional(),
    }),
  },

  clientLogin: {
    body: Joi.object({
      email: email.required(),
      password: Joi.string().required(),
    }),
  },
};

// Staff schemas
const staffSchemas = {
  createStaff: {
    body: Joi.object({
      personalInfo: Joi.object({
        firstName: Joi.string().min(2).max(50).required(),
        lastName: Joi.string().min(2).max(50).required(),
        email: email.required(),
        phoneNumber: phone.required(),
        dateOfBirth: Joi.date().max("now").required(),
        address: Joi.string().min(10).max(200).required(),
      }).required(),

      role: Joi.string()
        .valid(
          "agent",
          "regional_manager",
          "moderate_admin",
          "ceo",
          "super_admin"
        )
        .required(),
      region: objectId.when("role", {
        is: Joi.valid("agent", "regional_manager"),
        then: Joi.required(),
        otherwise: Joi.optional(),
      }),
      managedBy: objectId.when("role", {
        is: "agent",
        then: Joi.required(),
        otherwise: Joi.optional(),
      }),

      credentials: Joi.object({
        password: password.required(),
        temporaryPassword: Joi.boolean().default(true),
      }).required(),

      permissions: Joi.array().items(Joi.string()).optional(),
    }),
  },

  updateStaff: {
    params: Joi.object({
      id: objectId.required(),
    }),
    body: Joi.object({
      personalInfo: Joi.object({
        firstName: Joi.string().min(2).max(50).optional(),
        lastName: Joi.string().min(2).max(50).optional(),
        phoneNumber: phone.optional(),
        address: Joi.string().min(10).max(200).optional(),
      }).optional(),

      region: objectId.optional(),
      managedBy: objectId.optional(),
      isActive: Joi.boolean().optional(),
      permissions: Joi.array().items(Joi.string()).optional(),
    }),
  },
};

// Regional Admin schemas
const regionalAdminSchemas = {
  getRegionalLoans: {
    query: Joi.object({
      ...paginationSchema,
      status: Joi.string()
        .valid(
          "pending",
          "approved",
          "rejected",
          "active",
          "completed",
          "defaulted"
        )
        .optional(),
      agentId: objectId.optional(),
      startDate: Joi.date().iso().optional(),
      endDate: Joi.date().iso().min(Joi.ref("startDate")).optional(),
    }),
  },

  createRegion: {
    body: Joi.object({
      name: Joi.string().min(2).max(100).required(),
      code: Joi.string().min(2).max(10).uppercase().required(),
      districts: Joi.array()
        .items(
          Joi.string().valid(
            "Colombo",
            "Gampaha",
            "Kalutara",
            "Kandy",
            "Matale",
            "Nuwara Eliya",
            "Galle",
            "Matara",
            "Hambantota",
            "Jaffna",
            "Kilinochchi",
            "Mannar",
            "Vavuniya",
            "Mullaitivu",
            "Batticaloa",
            "Ampara",
            "Trincomalee",
            "Kurunegala",
            "Puttalam",
            "Anuradhapura",
            "Polonnaruwa",
            "Badulla",
            "Monaragala",
            "Ratnapura",
            "Kegalle"
          )
        )
        .min(1)
        .required(),
      regionalManager: objectId.optional(),
      description: Joi.string().max(300).optional(),
    }),
  },

  updateRegion: {
    params: Joi.object({
      id: objectId.required(),
    }),
    body: Joi.object({
      name: Joi.string().min(2).max(100).optional(),
      districts: Joi.array()
        .items(
          Joi.string().valid(
            "Colombo",
            "Gampaha",
            "Kalutara",
            "Kandy",
            "Matale",
            "Nuwara Eliya",
            "Galle",
            "Matara",
            "Hambantota",
            "Jaffna",
            "Kilinochchi",
            "Mannar",
            "Vavuniya",
            "Mullaitivu",
            "Batticaloa",
            "Ampara",
            "Trincomalee",
            "Kurunegala",
            "Puttalam",
            "Anuradhapura",
            "Polonnaruwa",
            "Badulla",
            "Monaragala",
            "Ratnapura",
            "Kegalle"
          )
        )
        .min(1)
        .optional(),
      regionalManager: objectId.optional(),
      description: Joi.string().max(300).optional(),
      isActive: Joi.boolean().optional(),
    }),
  },

  assignAgentToManager: {
    body: Joi.object({
      agentId: objectId.required(),
      regionalManagerId: objectId.required(),
      effectiveDate: Joi.date()
        .iso()
        .default(() => new Date()),
      assignmentReason: Joi.string().max(300).optional(),
    }),
  },

  getRegionalStats: {
    params: Joi.object({
      regionalManagerId: objectId.required(),
    }),
    query: Joi.object({
      startDate: Joi.date().iso().optional(),
      endDate: Joi.date().iso().min(Joi.ref("startDate")).optional(),
      includeAgentBreakdown: Joi.boolean().default(false),
    }),
  },
};

// Agent schemas
const agentSchemas = {
  getAgentClients: {
    params: Joi.object({
      agentId: objectId.required(),
    }),
    query: Joi.object({
      ...paginationSchema,
      status: Joi.string()
        .valid("pending", "approved", "rejected", "suspended", "active")
        .optional(),
    }),
  },

  assignClientToAgent: {
    body: Joi.object({
      clientId: objectId.required(),
      agentId: objectId.required(),
      assignmentReason: Joi.string().min(10).max(300).optional(),
    }),
  },
};

// System administration schemas
const systemSchemas = {
  healthCheck: {
    query: Joi.object({
      detailed: Joi.boolean().default(false),
      includeMetrics: Joi.boolean().default(false),
    }),
  },

  systemSettings: {
    body: Joi.object({
      maxLoanAmount: Joi.number().positive().optional(),
      defaultInterestRate: Joi.number().positive().min(0.01).max(50).optional(),
      maxLoanTerm: Joi.number().integer().min(1).max(360).optional(),
      debtToIncomeRatio: Joi.number().positive().min(10).max(80).optional(),
      systemMaintenance: Joi.boolean().optional(),
      maintenanceMessage: Joi.string().max(500).optional(),
    }),
  },

  auditLog: {
    query: Joi.object({
      ...paginationSchema,
      userId: objectId.optional(),
      action: Joi.string().min(2).max(100).optional(),
      resource: Joi.string().min(2).max(100).optional(),
      startDate: Joi.date().iso().optional(),
      endDate: Joi.date().iso().min(Joi.ref("startDate")).optional(),
      level: Joi.string().valid("info", "warn", "error", "audit").optional(),
    }),
  },
};

// Payment schemas
const paymentSchemas = {
  recordPayment: {
    body: Joi.object({
      loanId: objectId.required(),
      amount: Joi.number().positive().required(),
      paymentDate: Joi.date()
        .iso()
        .default(() => new Date()),
      paymentMethod: Joi.string()
        .valid("cash", "bank_transfer", "mobile_money", "check", "online")
        .required(),
      reference: Joi.string().min(3).max(50).optional(),
      notes: Joi.string().max(500).optional(),
      receiptNumber: Joi.string().min(3).max(50).optional(),
    }),
  },

  getPaymentHistory: {
    params: Joi.object({
      loanId: Joi.alternatives()
        .try(
          objectId,
          Joi.string().min(5).max(50) // Allow loan application ID
        )
        .required(),
    }),
    query: Joi.object({
      ...paginationSchema,
      startDate: Joi.date().iso().optional(),
      endDate: Joi.date().iso().min(Joi.ref("startDate")).optional(),
      paymentMethod: Joi.string()
        .valid("cash", "bank_transfer", "mobile_money", "check", "online")
        .optional(),
    }),
  },
};

// Report schemas
const reportSchemas = {
  generateReport: {
    body: Joi.object({
      reportType: Joi.string()
        .valid(
          "loan_summary",
          "payment_history",
          "agent_performance",
          "regional_overview",
          "financial_summary"
        )
        .required(),
      startDate: Joi.date().iso().required(),
      endDate: Joi.date().iso().min(Joi.ref("startDate")).required(),
      filters: Joi.object({
        regionId: objectId.optional(),
        agentId: objectId.optional(),
        loanStatus: Joi.string()
          .valid(
            "pending",
            "approved",
            "rejected",
            "active",
            "completed",
            "defaulted"
          )
          .optional(),
        minAmount: Joi.number().positive().optional(),
        maxAmount: Joi.number().positive().min(Joi.ref("minAmount")).optional(),
      }).optional(),
      format: Joi.string().valid("pdf", "excel", "csv").default("pdf"),
      includeCharts: Joi.boolean().default(true),
    }),
  },
};

module.exports = {
  authSchemas,
  loanSchemas,
  clientSchemas,
  staffSchemas,
  regionalAdminSchemas,
  agentSchemas,
  systemSchemas,
  paymentSchemas,
  reportSchemas,
  paginationSchema,
  objectId,
  email,
  phone,
  password,
};
