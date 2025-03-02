const fs = require('fs');
const path = require('path');

// Middleware to prepare upload directory
exports.prepareUploadDir = (req, res, next) => {
  try {
    // Create uploads directory if it doesn't exist
    const uploadsDir = path.join(__dirname, '../uploads');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
    
    next();
  } catch (error) {
    console.error('Error preparing upload directory:', error);
    req.flash('error_msg', 'An error occurred while preparing the upload directory');
    res.redirect('/dashboard');
  }
};