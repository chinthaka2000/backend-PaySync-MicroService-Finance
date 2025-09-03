// routes/moderateAdminRoutes-minimal.js

const express = require('express');
const router = express.Router();

// Simple test route
router.get('/test', (req, res) => {
  res.json({ success: true, message: 'Moderate admin routes working' });
});

module.exports = router;