const express = require('express');
const router = express.Router();
const { staffLogin } = require('../controllers/authStaffController');

router.post('/login', staffLogin);

module.exports = router;
