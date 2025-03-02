const Historical = require('../models/Historical');
const XLSX = require('xlsx');

// Get historical data with search and pagination
exports.getHistorical = async (req, res) => {
  try {
    // Pagination
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    
    // Build search query
    const searchQuery = {
      company: req.query.company,
      title: req.query.title,
      type: req.query.type,
      status: req.query.status,
      minSubmissions: req.query.minSubmissions,
      maxSubmissions: req.query.maxSubmissions
    };
    
    // Get filtered records with pagination
    const records = await Historical.findAll(searchQuery, { skip, limit });
    
    // Get total count for pagination
    const totalRecords = await Historical.getCount(searchQuery);
    const totalPages = Math.ceil(totalRecords / limit);
    
    res.render('historical/index', {
      title: 'Historical Data',
      records,
      currentPage: page,
      totalPages,
      limit,
      searchQuery,
      user: req.session.user
    });
  } catch (error) {
    console.error('Error fetching historical data:', error);
    req.flash('error_msg', 'An error occurred while fetching historical data');
    res.redirect('/dashboard');
  }
};

// Export historical data with search filters
exports.exportHistorical = async (req, res) => {
  try {
    // Build search query
    const searchQuery = {
      company: req.query.company,
      title: req.query.title,
      type: req.query.type,
      status: req.query.status,
      minSubmissions: req.query.minSubmissions,
      maxSubmissions: req.query.maxSubmissions
    };
    
    // Get all filtered records (no pagination needed for export)
    const records = await Historical.findAll(searchQuery);
    
    // Create workbook
    const workbook = XLSX.utils.book_new();
    
    // Convert data to worksheet
    const worksheet = XLSX.utils.json_to_sheet(records.map(record => ({
      Created: record.created,
      Age: record.age,
      ID: record.jobId,
      'Our ID': record.ourId,
      Company: record.company,
      Title: record.title,
      Openings: record.openings,
      Submitted: record.submitted,
      Interview: record.interview,
      Status: record.status,
      TYPE: record.type
    })));
    
    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Historical Data');
    
    // Create buffer
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    
    // Set headers
    res.setHeader('Content-Disposition', 'attachment; filename=historical_data.xlsx');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    
    // Send file
    res.send(buffer);
  } catch (error) {
    console.error('Error exporting historical data:', error);
    req.flash('error_msg', 'An error occurred while exporting data');
    res.redirect('/historical');
  }
};