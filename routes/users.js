const express = require('express');
const router = express.Router();
const { getUsers, getAddUser, postAddUser, getEditUser, putEditUser, deleteUser } = require('../controllers/userController');

// User management page
router.get('/', getUsers);

// Add user
router.get('/add', getAddUser);
router.post('/add', postAddUser);

// Edit user
router.get('/edit/:id', getEditUser);
router.put('/edit/:id', putEditUser);

// Delete user
router.delete('/delete/:id', deleteUser);

module.exports = router;
