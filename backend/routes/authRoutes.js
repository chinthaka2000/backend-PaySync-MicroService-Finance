// routes/authRoutes.js

const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authenticate, authRateLimit } = require('../middlewares/authMiddleware');
const { validate, authSchemas } = require('../validation');

// Public routes (with rate limiting)
router.post('/login',
  authRateLimit,
  validate(authSchemas.login.body),
  authController.login
);
router.post('/refresh-token',
  authRateLimit,
  validate(authSchemas.refreshToken.body),
  authController.refreshToken
);

// Protected routes (require authentication)
router.use(authenticate); // Apply authentication middleware to all routes below

router.post('/logout', authController.logout);
router.post('/logout-all', authController.logoutAll);
router.get('/profile', authController.getProfile);
router.put('/change-password',
  validate(authSchemas.changePassword.body),
  authController.changePassword
);
router.post('/validate-role-creation',
  validate(authSchemas.validateRoleCreation.body),
  authController.validateRoleCreation
);

module.exports = router;