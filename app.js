const express = require('express');
const path = require('path');
const session = require('express-session');
const fileUpload = require('express-fileupload');
const flash = require('connect-flash');
const methodOverride = require('method-override');
const XLSX = require('xlsx');
const fs = require('fs');
const expressLayouts = require('express-ejs-layouts');
const { poolPromise, sql } = require('./utils/db');
require('dotenv').config();

// Initialize express
const app = express();
const PORT = process.env.PORT || 3000;

// Initialize empty inMemoryDB object for compatibility
const inMemoryDB = { 
  users: [], 
  reports: [], 
  historical: [], 
  joined: [], 
  interviews: [],
  relocations: [],
  candidates: []
};

// Make inMemoryDB available to all routes
app.locals.inMemoryDB = inMemoryDB;

// Set view engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Add layout support
app.use(expressLayouts);
app.set('layout', 'layouts/main');
app.set('layout extractScripts', true);
app.set('layout extractStyles', true);

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(methodOverride('_method'));

// File upload middleware
app.use(fileUpload({
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB max file size
  useTempFiles: true,
  tempFileDir: path.join(__dirname, 'uploads/temp')
}));

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Session configuration
app.use(session({
  secret: 'recruitment_dashboard_secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 1000 * 60 * 60 * 24 // 1 day
  }
}));

// Flash messages middleware
app.use(flash());

// Global variables middleware
app.use((req, res, next) => {
  res.locals.success_msg = req.flash('success_msg');
  res.locals.error_msg = req.flash('error_msg');
  res.locals.error = req.flash('error');
  res.locals.user = req.session.user || null;
  next();
});

// Authentication middleware
const checkAuthenticated = (req, res, next) => {
  if (req.session.user) {
    return next();
  }
  req.flash('error_msg', 'Please log in to view this resource');
  res.redirect('/login');
};

const checkAdmin = (req, res, next) => {
  if (req.session.user && req.session.user.role === 'admin') {
    return next();
  }
  req.flash('error_msg', 'Access denied. Admin privileges required');
  res.redirect('/dashboard');
};

// Make middleware available to route modules
app.checkAuthenticated = checkAuthenticated;
app.checkAdmin = checkAdmin;

// Routes

// Register auth routes
const authRoutes = require('./routes/auth');
app.use('/', authRoutes);

// Register dashboard routes
const dashboardRoutes = require('./routes/dashboard');
app.use('/dashboard', checkAuthenticated, dashboardRoutes);

// Register historical routes
const historicalRoutes = require('./routes/historical');
app.use('/historical', checkAuthenticated, historicalRoutes);

// Register joined routes
const joinedRoutes = require('./routes/joined');
app.use('/joined', checkAuthenticated, joinedRoutes);

// Register monthly routes
const monthlyRoutes = require('./routes/monthly');
app.use('/monthly', checkAuthenticated, monthlyRoutes);

// Register upload routes
const uploadRoutes = require('./routes/upload');
app.use('/upload', checkAuthenticated, checkAdmin, uploadRoutes);

// Register import routes
const importRoutes = require('./routes/import');
app.use('/import', checkAuthenticated, checkAdmin, importRoutes);

// Register user routes
const userRoutes = require('./routes/users');
app.use('/users', checkAuthenticated, checkAdmin, userRoutes);

// Register interview routes
require('./routes/interviewRoutes')(app);

// Register relocation routes
require('./routes/relocationRoutes')(app);

// Register candidate routes
require('./routes/candidateRoutes')(app);

// Register reports routes
const reportsRoutes = require('./routes/reports');
app.use('/reports', checkAuthenticated, reportsRoutes);

// Register monthly routes
app.use('/monthly', checkAuthenticated, monthlyRoutes);

// Register CatsOne routes
const catsOneRoutes = require('./routes/catsone');
app.use('/catsone', checkAuthenticated, catsOneRoutes);

// Handle 404
app.use((req, res) => {
  res.status(404).render('404', {
    title: '404 Not Found'
  });
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});