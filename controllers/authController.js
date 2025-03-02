const { poolPromise, sql } = require('../utils/db');

// Display login page
const getLogin = (req, res) => {
  // If user is already logged in, redirect to dashboard
  if (req.session.user) {
    return res.redirect('/dashboard');
  }
  
  // Remove the layout property completely - use the default layout
  res.render('auth/login', {
    title: 'Login'
  });
};

// Process login
const postLogin = async (req, res) => {
  const { email, password } = req.body;
  
  console.log('Login attempt:', { email }); // Don't log passwords
  
  try {
    // Connect to database
    const pool = await poolPromise;
    
    // Query to find user
    console.log('Querying database for user...');
    const result = await pool.request()
      .input('email', sql.VarChar, email)
      .query('SELECT * FROM Users WHERE email = @email');
      
    console.log('Query result:', { 
      recordCount: result.recordset.length,
      found: result.recordset.length > 0 
    });
    
    // Check if user exists and password matches
    const user = result.recordset[0];
    
    if (!user) {
      console.log('User not found');
      req.flash('error_msg', 'Invalid email or password');
      return res.render('auth/login', {
        title: 'Login'
      });
    }
    
    if (user.password !== password) {
      console.log('Password mismatch');
      req.flash('error_msg', 'Invalid email or password');
      return res.render('auth/login', {
        title: 'Login'
      });
    }
    
    console.log('Login successful for user:', user.name);
    
    // Set user session
    req.session.user = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role
    };
    
    req.flash('success_msg', 'You are now logged in');
    res.redirect('/dashboard');
  } catch (error) {
    console.error('Database error:', error);
    req.flash('error_msg', 'An error occurred during login. Please try again.');
    res.render('auth/login', {
      title: 'Login'
    });
  }
};
// Process logout
const logout = (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return console.log(err);
    }
    res.redirect('/login');
  });
};

module.exports = {
  getLogin,
  postLogin,
  logout
};