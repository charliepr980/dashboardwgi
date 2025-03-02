// routes/joined.js
const express = require('express');
const router = express.Router();
const joinedController = require('../controllers/joinedController');

// Joined employees page
router.get('/', joinedController.getJoined);

// Search joined employees - add this route before other routes
router.get('/search', joinedController.searchJoined);

// Export joined employees
router.get('/export', joinedController.exportJoined);

// Add joined employee
router.get('/add', joinedController.getAddJoined);
router.post('/add', joinedController.postAddJoined);

// Edit joined employee
router.get('/edit/:id', joinedController.getEditJoined);
router.put('/edit/:id', joinedController.putEditJoined);

// Delete joined employee
router.delete('/delete/:id', joinedController.deleteJoined);

module.exports = router;