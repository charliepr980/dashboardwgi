const express = require('express');
const router = express.Router();
const catsOneController = require('../controllers/catsOneController');
const { catsOneApi, validateCatsOneApiConnection } = require('../middleware/catsOneMiddleware');

// Get auth middleware from app.js
const checkAuthenticated = (req, res, next) => {
  if (req.session.user) {
    return next();
  }
  req.flash('error_msg', 'Please log in to view this resource');
  res.redirect('/login');
};

// Apply CatsOne API middleware to all routes
router.use(catsOneApi);

// Define routes once
router.get('/', checkAuthenticated, validateCatsOneApiConnection, catsOneController.getActiveJobs);
router.get('/export', checkAuthenticated, validateCatsOneApiConnection, catsOneController.exportActiveJobs);

module.exports = router;