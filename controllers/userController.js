// controllers/userController.js
const User = require('../models/user');

// Get all users
exports.getUsers = async (req, res) => {
  try {
    const users = await User.findAll();
    
    res.render('users/index', {
      title: 'User Management',
      users,
      currentPage: 1,
      totalPages: 1,
      limit: users.length,
      user: req.session.user
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    req.flash('error_msg', 'An error occurred while fetching users');
    res.redirect('/dashboard');
  }
};

// Add user page
exports.getAddUser = (req, res) => {
  res.render('users/add', {
    title: 'Add User',
    user: req.session.user
  });
};

// Process add user
exports.postAddUser = async (req, res) => {
  try {
    const { name, email, password, role } = req.body;
    
    // Check if user already exists
    const existingUser = await User.findByEmail(email);
    
    if (existingUser) {
      req.flash('error_msg', 'Email is already registered');
      return res.redirect('/users/add');
    }
    
    // Create new user
    await User.create({
      name,
      email,
      password,
      role: role || 'user'
    });
    
    req.flash('success_msg', 'User added successfully');
    res.redirect('/users');
  } catch (error) {
    console.error('Error adding user:', error);
    req.flash('error_msg', 'An error occurred while adding the user');
    res.redirect('/users/add');
  }
};

// Edit user page
exports.getEditUser = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Get user record
    const userRecord = await User.findById(id);
    
    if (!userRecord) {
      req.flash('error_msg', 'User not found');
      return res.redirect('/users');
    }
    
    res.render('users/edit', {
      title: 'Edit User',
      userRecord,
      user: req.session.user
    });
  } catch (error) {
    console.error('Error fetching user for edit:', error);
    req.flash('error_msg', 'An error occurred while fetching user data');
    res.redirect('/users');
  }
};

// Process edit user
exports.putEditUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, password, role } = req.body;
    
    // Find user
    const userRecord = await User.findById(id);
    
    if (!userRecord) {
      req.flash('error_msg', 'User not found');
      return res.redirect('/users');
    }
    
    // Update user
    await userRecord.update({
      name,
      email,
      password: password && password.trim() !== '' ? password : undefined,
      role
    });
    
    req.flash('success_msg', 'User updated successfully');
    res.redirect('/users');
  } catch (error) {
    console.error('Error updating user:', error);
    req.flash('error_msg', 'An error occurred while updating the user');
    res.redirect('/users');
  }
};

// Delete user
exports.deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Prevent deleting yourself
    if (id === req.session.user.id) {
      req.flash('error_msg', 'You cannot delete your own account');
      return res.redirect('/users');
    }
    
    // Find user
    const userRecord = await User.findById(id);
    
    if (!userRecord) {
      req.flash('error_msg', 'User not found');
      return res.redirect('/users');
    }
    
    // Delete user
    await userRecord.delete();
    
    req.flash('success_msg', 'User deleted successfully');
    res.redirect('/users');
  } catch (error) {
    console.error('Error deleting user:', error);
    req.flash('error_msg', 'An error occurred while deleting the user');
    res.redirect('/users');
  }
};