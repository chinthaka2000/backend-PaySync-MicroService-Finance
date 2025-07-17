const express = require('express');
const router = express.Router();
const clientController = require('../controllers/clientController');

router.post('/register', clientController.registerClient);
router.get('/client', clientController.getClients);
router.get('/pending', clientController.getPendingClient);
router.get('/all', clientController.getAllClients);
router.get('/:id', clientController.getClientById);

// Original routes - these are the ones used by the frontend
router.get('/:id/approve', clientController.clientApprovedMessage);
router.post('/:id/approve', clientController.clientApprovedMessage);
router.get('/:id/reject', clientController.clientRejectedMessage);
router.post('/:id/reject', clientController.clientRejectedMessage);

// Alternative routes for flexibility
router.get('/approve', clientController.approveClientByQuery);
router.post('/approve', clientController.approveClientByQuery);
router.get('/reject', clientController.rejectClientByQuery);
router.post('/reject', clientController.rejectClientByQuery);
router.post('/update-status', clientController.updateClientStatusByQuery);



module.exports = router;
