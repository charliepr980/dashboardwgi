const express = require('express');
const router = express.Router();
const { getLogin, postLogin, logout } = require('../controllers/authController');

// Login page
router.get('/login', getLogin);
router.get('/', getLogin);

// Process login
router.post('/login', postLogin);

// Logout
router.get('/logout', logout);

module.exports = router;