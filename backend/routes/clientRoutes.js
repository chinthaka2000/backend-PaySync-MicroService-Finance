const express = require('express');
const multer = require('multer');
const storage = require('../utils/cloudinaryStorage');
const router = express.Router();
const clientController = require('../controllers/clientController');
const authClientController = require('../controllers/authClientController');

const upload = multer({ storage });

router.post('/register', upload.fields([
  { name: 'idCard', maxCount: 1 },
  { name: 'employmentLetter', maxCount: 1 }
]), clientController.registerClient);


router.get('/client', clientController.getClients);
router.get('/pending', clientController.getPendingClient);
router.get('/all', clientController.getAllClients);
router.get('/:id', clientController.getClientById);
router.get('/assigner/:id', clientController.getClientByAssignerId);

//verified clients by clientUser model
router.get('/verified/:id', clientController.getClientUserByVerifierId);

// Original routes - these are the ones used by the frontend
//router.get('/:id/approve', clientController.clientApprovedMessage);
router.post('/:id/approve', clientController.clientApprovedMessage);
router.get('/:id/reject', clientController.clientRejectedMessage);
router.post('/:id/reject', clientController.clientRejectedMessage);

// Alternative routes for flexibility
router.get('/approve', clientController.approveClientByQuery);
router.post('/approve', clientController.approveClientByQuery);
router.get('/reject', clientController.rejectClientByQuery);
router.post('/reject', clientController.rejectClientByQuery);
router.post('/update-status', clientController.updateClientStatusByQuery);

//approved clients by clientUser model
router.patch('/suspend/:id', clientController.suspendClientById);
    


router.post('/login', authClientController.clientLogin);


module.exports = router;
