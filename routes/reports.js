// routes/reports.js
const express = require('express');
const router = express.Router();
const reportController = require('../controllers/reportController');

// Main reports dashboard
router.get('/', reportController.getReportsDashboard);

// Team performance report
router.get('/team-performance', reportController.getTeamPerformanceReport);

// Position fill rate report
router.get('/position-fill-rate', reportController.getPositionFillRateReport);

// Timeline performance report
router.get('/timeline-performance', reportController.getTimelinePerformanceReport);

// Export reports to Excel
router.get('/team-performance/export', reportController.exportTeamPerformanceReport);
router.get('/position-fill-rate/export', reportController.exportPositionFillRateReport);
router.get('/timeline-performance/export', reportController.exportTimelinePerformanceReport);

module.exports = router;