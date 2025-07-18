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
router.get('/:id/approve', clientController.clientApprovedMessage);
router.get('/:id/reject', clientController.clientRejectedMessage);


router.post('/login', authClientController.clientLogin);


module.exports = router;
