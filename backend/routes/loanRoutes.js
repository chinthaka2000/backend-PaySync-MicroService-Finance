const express = require('express');
const router = express.Router();
const loanController = require('../controllers/loanController');

// Loan application routes
router.post('/create', loanController.createLoanApplication);
router.get('/', loanController.getAllLoans); // For useLoanData hook
router.get('/stats', loanController.getLoanStats); // For useLoanData hook
router.get('/agreements', loanController.getLoanAgreements); // For useLoanData hook
router.get('/agent/:agentId', loanController.getAgentLoans);
router.get('/agent/:agentId/stats', loanController.getAgentLoanStats);
router.get('/agent/:agentId/pending', loanController.getPendingLoansForAgent);
router.get('/search', loanController.searchLoans);
router.get('/:id', loanController.getLoanById);

// Loan review and management
router.post('/:loanId/review', loanController.agentReviewLoan);
router.put('/:loanId/status', loanController.updateLoanStatus);

// Payment management
router.post('/:loanId/payments', loanController.addPayment);
router.get('/:loanId/payments', loanController.getPaymentHistory);

module.exports = router;