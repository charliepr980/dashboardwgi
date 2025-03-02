// routes/historical.js
const express = require('express');
const router = express.Router();
const historicalController = require('../controllers/historicalController');

// Historical data page
router.get('/', historicalController.getHistorical);

// Export historical data
router.get('/export', historicalController.exportHistorical);

module.exports = router;