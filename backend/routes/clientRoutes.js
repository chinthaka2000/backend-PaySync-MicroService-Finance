const express = require('express');
const router = express.Router();
const clientController = require('../controllers/clientController');
const authClientController = require('../controllers/authClientController');
const { validate, clientSchemas, validateClientDocuments } = require('../validation');

router.post('/register',
  validateClientDocuments,
  validate(clientSchemas.registerClient.body),
  clientController.registerClient
);


router.get('/client', clientController.getClients);
router.get('/pending', clientController.getPendingClient);
router.get('/all', clientController.getAllClients);
router.get('/:id',
  validate(clientSchemas.getClientById.params, 'params'),
  clientController.getClientById
);
router.get('/assigner/:id',
  validate(clientSchemas.getClientByAssignerId.params, 'params'),
  validate(clientSchemas.getClientByAssignerId.query, 'query'),
  clientController.getClientByAssignerId
);

//verified clients by clientUser model
router.get('/verified/:id', clientController.getClientUserByVerifierId);

// Original routes - these are the ones used by the frontend
//router.get('/:id/approve', clientController.clientApprovedMessage);
router.post('/:id/approve',
  validate(clientSchemas.approveClient.params, 'params'),
  validate(clientSchemas.approveClient.body),
  clientController.clientApprovedMessage
);
router.get('/:id/reject',
  validate(clientSchemas.rejectClient.params, 'params'),
  clientController.clientRejectedMessage
);
router.post('/:id/reject',
  validate(clientSchemas.rejectClient.params, 'params'),
  validate(clientSchemas.rejectClient.body),
  clientController.clientRejectedMessage
);

// Alternative routes for flexibility
router.get('/approve', clientController.approveClientByQuery);
router.post('/approve', clientController.approveClientByQuery);
router.get('/reject', clientController.rejectClientByQuery);
router.post('/reject', clientController.rejectClientByQuery);
router.post('/update-status',
  validate(clientSchemas.updateClientStatus.body),
  clientController.updateClientStatusByQuery
);

//approved clients by clientUser model
router.patch('/suspend/:id', clientController.suspendClientById);
router.patch('/activate/:id', clientController.activateClientById);
router.patch('/deactivate/:id', clientController.deactivateClientById);

router.post('/login',
  validate(clientSchemas.clientLogin.body),
  authClientController.clientLogin
);


module.exports = router;
