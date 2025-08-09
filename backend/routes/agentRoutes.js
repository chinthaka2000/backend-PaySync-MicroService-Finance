const express = require('express');
const router = express.Router();
const agentController = require('../controllers/agentController');

// Agent dashboard and profile routes
router.get('/:agentId/dashboard', agentController.getAgentDashboard);
router.get('/:agentId/profile', agentController.getAgentProfile);
router.put('/:agentId/profile', agentController.updateAgentProfile);

// Agent management routes (for admin use)
router.get('/', agentController.getAllAgents);
router.get('/stats', agentController.getAgentStats);
router.get('/region/:regionId', agentController.getAgentsByRegion);

module.exports = router;