const express = require('express');
const router = express.Router();
const regionalAdminController = require('../controllers/regionalAdminController');

// Regional admin dashboard
router.get('/:regionalAdminId/dashboard', regionalAdminController.getRegionalDashboard);

// Loan management
router.get('/:regionalAdminId/loans/pending', regionalAdminController.getPendingLoansForApproval);
router.post('/:regionalAdminId/loans/:loanId/approve', regionalAdminController.approveRejectLoan);

// Agent management
router.get('/:regionalAdminId/agents', regionalAdminController.getAgentsInRegion);

// Registration management
router.get('/:regionalAdminId/registrations/pending', regionalAdminController.getPendingRegistrations);
router.post('/:regionalAdminId/registrations/:registrationId/approve', regionalAdminController.approveRejectRegistration);

// Payment management
router.get('/:regionalAdminId/payments/pending', regionalAdminController.getPendingPayments);
router.post('/:regionalAdminId/payments/approve', regionalAdminController.approveRejectPayment);

// Reports
router.post('/:regionalAdminId/reports', regionalAdminController.generateRegionalReport);

module.exports = router;
