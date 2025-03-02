// routes/monthly.js
const express = require('express');
const router = express.Router();
const monthlyController = require('../controllers/monthlyController');

// Monthly statistics page
router.get('/', monthlyController.getMonthly);

module.exports = router;