const express = require('express');
const router = express.Router();
const { authenticate, authorizeRoles } = require('../middlewares/authMiddleware');
const ceoController = require('../controllers/ceoController');

// All routes require authentication
router.use(authenticate);

// Allow CEO, super_admin, moderate_admin, and regional_manager to access CEO dashboard
// This allows testing and provides visibility to management roles
router.use(authorizeRoles('ceo', 'super_admin', 'moderate_admin', 'regional_manager'));

// CEO Dashboard
router.get('/:ceoId/dashboard', ceoController.getCEODashboard);

// Financial Overview
router.get('/:ceoId/financial-overview', ceoController.getFinancialOverview);

// Reports
router.get('/:ceoId/reports', ceoController.getReports);

// Regional Performance
router.get('/:ceoId/regional-performance', ceoController.getRegionalPerformance);

module.exports = router;
