const express = require("express");
const router = express.Router();
const loanController = require("../controllers/loanController");
const {
  authenticate,
  authorizeRoles,
  requirePermissions,
} = require("../middlewares/authMiddleware");
const { agentRateLimit } = require("../middlewares/security");
const { PERMISSIONS } = require("../utils/permissions");
const { validate, loanSchemas } = require("../validation");

// All routes require authentication
router.use(authenticate);

// Apply higher rate limit for agent loan endpoints
router.use("/agent/:agentId", agentRateLimit);

// Loan application routes
router.post(
  "/create",
  
  validate(loanSchemas.createLoan.body),
  loanController.createLoanApplication
);

router.post(
  "/approve",
  loanController.approveLoan
);

router.get(
  "/",
  requirePermissions(
    PERMISSIONS.VIEW_OWN_LOANS,
    PERMISSIONS.VIEW_REGIONAL_LOANS,
    PERMISSIONS.VIEW_ALL_LOANS
  ),
  loanController.getAllLoans
);

router.get(
  "/stats",
  requirePermissions(PERMISSIONS.VIEW_SYSTEM_ANALYTICS),
  validate(loanSchemas.getEnhancedLoanStats.query, "query"),
  loanController.getLoanStats
);

router.get(
  "/agreements",
  requirePermissions(PERMISSIONS.VIEW_AGREEMENTS),
  loanController.getLoanAgreements
);

router.get(
  "/agent/:agentId",
  authorizeRoles("agent", "regional_manager", "moderate_admin", "super_admin"),
  validate(loanSchemas.getEnhancedAgentLoans.params, "params"),
  validate(loanSchemas.getEnhancedAgentLoans.query, "query"),
  loanController.getAgentLoans
);

router.get(
  "/agent/:agentId/stats",
  authorizeRoles("agent", "regional_manager", "moderate_admin", "super_admin"),
  loanController.getAgentLoanStats
);

router.get(
  "/agent/:agentId/pending",
  authorizeRoles("agent", "regional_manager", "moderate_admin", "super_admin"),
  loanController.getPendingLoansForAgent
);

router.get(
  "/search",
  requirePermissions(PERMISSIONS.VIEW_OWN_LOANS),
  validate(loanSchemas.searchLoans.query, "query"),
  loanController.searchLoans
);

router.get(
  "/:id",
  requirePermissions(PERMISSIONS.VIEW_OWN_LOANS),
  validate(loanSchemas.getLoanById.params, "params"),
  loanController.getLoanById
);

// Loan review and management
router.post(
  "/:loanId/review",
  requirePermissions(PERMISSIONS.UPDATE_OWN_LOANS),
  validate(loanSchemas.reviewLoan.params, "params"),
  validate(loanSchemas.reviewLoan.body),
  loanController.agentReviewLoan
);

router.put(
  "/:loanId/status",
  requirePermissions(
    PERMISSIONS.APPROVE_LOANS,
    PERMISSIONS.UPDATE_REGIONAL_LOANS
  ),
  validate(loanSchemas.updateLoanStatus.params, "params"),
  validate(loanSchemas.updateLoanStatus.body),
  loanController.updateLoanStatus
);

// Payment management
router.post(
  "/:loanId/payments",
  requirePermissions(PERMISSIONS.UPDATE_OWN_LOANS),
  validate(loanSchemas.addPayment.params, "params"),
  validate(loanSchemas.addPayment.body),
  loanController.addPayment
);

router.get(
  "/:loanId/payments",
  requirePermissions(PERMISSIONS.VIEW_OWN_LOANS),
  loanController.getPaymentHistory
);

// Regional manager approval workflow
router.post(
  "/:loanId/regional-approval",
  requirePermissions(PERMISSIONS.APPROVE_LOANS),
  validate(loanSchemas.regionalApproval.params, "params"),
  validate(loanSchemas.regionalApproval.body),
  loanController.regionalManagerApproval
);

// Regional manager specific endpoints
router.get(
  "/regional-manager/:regionalManagerId",
  authorizeRoles("regional_manager", "moderate_admin", "super_admin"),
  validate(loanSchemas.getRegionalManagerLoans.params, "params"),
  validate(loanSchemas.getRegionalManagerLoans.query, "query"),
  loanController.getRegionalManagerLoans
);

router.get(
  "/regional-manager/:regionalManagerId/stats",
  authorizeRoles("regional_manager", "moderate_admin", "super_admin"),
  loanController.getRegionalManagerStats
);

// Agreement management routes
router.post(
  "/:loanId/generate-agreement",
  requirePermissions(PERMISSIONS.GENERATE_AGREEMENTS),
  loanController.generateAgreement
);


module.exports = router;
