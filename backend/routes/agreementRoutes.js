const express = require('express');
const router = express.Router();
const loanController = require('../controllers/loanController');

// Agreement management routes (no auth middleware needed for now - will be added later)
router.post('/:agreementId/send', loanController.sendAgreement);
router.get('/:agreementId/download', loanController.downloadAgreement);

module.exports = router;