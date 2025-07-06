const express = require('express');
const router = express.Router();
const clientController = require('../controllers/clientController');

router.post('/register', clientController.registerClient);
router.get('/client', clientController.getClients);
router.get('/pending', clientController.getPendingClient);
router.get('/all', clientController.getAllClients);

router.get('/:id', clientController.getClientById);
router.patch('/:id/status', clientController.updateClientStatus);

module.exports = router;
