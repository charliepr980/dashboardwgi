// routes/dashboard.js
const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboardController');

// Dashboard page
router.get('/', dashboardController.getDashboard);

module.exports = router;