// controllers/joinedController.js
const Joined = require('../models/Joined');
const Historical = require('../models/Historical');
const User = require('../models/user');
const XLSX = require('xlsx');

// Get all joined employees
exports.getJoined = async (req, res) => {
  try {
    // Pagination
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    
    // Get joined employees with pagination
    const joinedEmployees = await Joined.findAll({ skip, limit });
    
    // Get total count for pagination
    const totalRecords = await Joined.getCount();
    const totalPages = Math.ceil(totalRecords / limit);
    
    // Enrich joined employees with historical data and created by user
    const enrichedJoinedEmployees = await Promise.all(joinedEmployees.map(async (joined) => {
      let historical = null;
      if (joined.historicalId) {
        historical = await Historical.findById(joined.historicalId);
      }
      
      let createdBy = null;
      if (joined.createdBy) {
        createdBy = await User.findById(joined.createdBy);
      }
      
      return {
        ...joined,
        historicalId: historical || { 
          title: 'Unknown Position', 
          company: 'Unknown Company', 
          jobId: 'Unknown ID',
          type: joined.type
        },
        createdBy: createdBy || { name: 'System' }
      };
    }));
    
    res.render('joined/index', {
      title: 'Joined Employees',
      joinedEmployees: enrichedJoinedEmployees,
      currentPage: page,
      totalPages,
      limit,
      user: req.session.user,
      isSearchResults: false, // Add this line
      searchTerm: '' // Add this line
    });
  } catch (error) {
    console.error('Error fetching joined employees:', error);
    req.flash('error_msg', 'An error occurred while fetching joined employee data');
    res.redirect('/dashboard');
  }
};

// Search joined employees
exports.searchJoined = async (req, res) => {
  try {
    const { q } = req.query;
    const searchTerm = q || '';
    
    // Pagination
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    
    if (!searchTerm.trim()) {
      return res.redirect('/joined');
    }
    
    // Get search results with pagination
    const joinedEmployees = await Joined.search(searchTerm, { skip, limit });
    
    // Get total count for pagination
    const totalRecords = await Joined.getSearchCount(searchTerm);
    const totalPages = Math.ceil(totalRecords / limit);
    
    // Enrich joined employees with historical data and created by user
    const enrichedJoinedEmployees = await Promise.all(joinedEmployees.map(async (joined) => {
      let historical = null;
      if (joined.historicalId) {
        historical = await Historical.findById(joined.historicalId);
      }
      
      let createdBy = null;
      if (joined.createdBy) {
        createdBy = await User.findById(joined.createdBy);
      }
      
      return {
        ...joined,
        historicalId: historical || { 
          title: 'Unknown Position', 
          company: 'Unknown Company', 
          jobId: 'Unknown ID',
          type: joined.type
        },
        createdBy: createdBy || { name: 'System' }
      };
    }));
    
    res.render('joined/index', {
      title: 'Search Results - Joined Employees',
      joinedEmployees: enrichedJoinedEmployees,
      currentPage: page,
      totalPages,
      limit,
      user: req.session.user,
      searchTerm,
      isSearchResults: true
    });
  } catch (error) {
    console.error('Error searching joined employees:', error);
    req.flash('error_msg', 'An error occurred while searching');
    res.redirect('/joined');
  }
};

// Get add joined employee page
exports.getAddJoined = async (req, res) => {
  try {
    const { jobId } = req.query;
    let historicalRecord = null;
    
    if (jobId) {
      // Find historical record by jobId
      const allHistorical = await Historical.findAll();
      historicalRecord = allHistorical.find(h => h.jobId === jobId);
    }
    
    // Get all historical records for dropdown
    const positions = await Historical.findAll();
    
    res.render('joined/add', {
      title: 'Add Joined Employee',
      historicalRecord,
      positions,
      user: req.session.user
    });
  } catch (error) {
    console.error('Error loading add joined employee page:', error);
    req.flash('error_msg', 'An error occurred while loading the page');
    res.redirect('/joined');
  }
};

// Process add joined employee
exports.postAddJoined = async (req, res) => {
  try {
    const { 
      historicalId, 
      employeeName, 
      startDate, 
      joinedDate, 
      type,
      recruiterTeam,
      jobTitle,
      company
    } = req.body;
    
    // Create new joined employee record
    await Joined.create({
      historicalId: historicalId || null,
      employeeName,
      jobTitle,
      company,
      startDate: new Date(startDate),
      joinedDate: new Date(joinedDate),
      type,
      recruiterTeam,
      createdBy: req.session.user.id
    });
    
    req.flash('success_msg', 'Joined employee added successfully');
    res.redirect('/joined');
  } catch (error) {
    console.error('Error adding joined employee:', error);
    req.flash('error_msg', 'An error occurred while adding the joined employee');
    res.redirect('/joined/add');
  }
};

// Get edit joined employee page
exports.getEditJoined = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Get joined employee record
    const joinedEmployee = await Joined.findById(id);
    
    if (!joinedEmployee) {
      req.flash('error_msg', 'Joined employee not found');
      return res.redirect('/joined');
    }
    
    // Enrich with historical data
    let historical = null;
    if (joinedEmployee.historicalId) {
      historical = await Historical.findById(joinedEmployee.historicalId);
    }
    
    const enrichedJoinedEmployee = {
      ...joinedEmployee,
      historicalId: historical || { 
        id: joinedEmployee.historicalId,
        title: 'Unknown Position', 
        company: 'Unknown Company', 
        jobId: 'Unknown ID',
        type: joinedEmployee.type
      }
    };
    
    // Get all historical records for dropdown
    const positions = await Historical.findAll();
    
    res.render('joined/edit', {
      title: 'Edit Joined Employee',
      joinedEmployee: enrichedJoinedEmployee,
      positions,
      user: req.session.user
    });
  } catch (error) {
    console.error('Error loading edit joined employee page:', error);
    req.flash('error_msg', 'An error occurred while loading the page');
    res.redirect('/joined');
  }
};

// Process edit joined employee
exports.putEditJoined = async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      historicalId, 
      employeeName, 
      startDate, 
      joinedDate, 
      type,
      recruiterTeam,
      jobTitle,
      company
    } = req.body;
    
    // Find joined employee
    const joinedEmployee = await Joined.findById(id);
    
    if (!joinedEmployee) {
      req.flash('error_msg', 'Joined employee not found');
      return res.redirect('/joined');
    }
    
    // Update joined employee
    await joinedEmployee.update({
      historicalId: historicalId || null,
      employeeName,
      jobTitle,
      company,
      startDate: new Date(startDate),
      joinedDate: new Date(joinedDate),
      type,
      recruiterTeam
    });
    
    req.flash('success_msg', 'Joined employee updated successfully');
    res.redirect('/joined');
  } catch (error) {
    console.error('Error updating joined employee:', error);
    req.flash('error_msg', 'An error occurred while updating the joined employee');
    res.redirect('/joined');
  }
};

// Delete joined employee
exports.deleteJoined = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Delete joined employee
    await Joined.delete(id);
    
    req.flash('success_msg', 'Joined employee deleted successfully');
    res.redirect('/joined');
  } catch (error) {
    console.error('Error deleting joined employee:', error);
    req.flash('error_msg', 'An error occurred while deleting the joined employee');
    res.redirect('/joined');
  }
};

// Export joined employees
exports.exportJoined = async (req, res) => {
  try {
    const { q } = req.query;
    const searchTerm = q || '';
    
    // Get joined employees based on search or get all
    let joinedEmployees = [];
    if (searchTerm.trim()) {
      joinedEmployees = await Joined.search(searchTerm);
    } else {
      joinedEmployees = await Joined.findAll();
    }
    
    // Enrich joined employee data
    const enrichedData = await Promise.all(joinedEmployees.map(async (employee) => {
      let historical = null;
      if (employee.historicalId) {
        historical = await Historical.findById(employee.historicalId);
      }
      
      let createdBy = null;
      if (employee.createdBy) {
        createdBy = await User.findById(employee.createdBy);
      }
      
      // Format dates as YYYY-MM-DD to ensure consistent format for Excel
      const formatDate = (date) => {
        if (!date) return '';
        const d = new Date(date);
        if (isNaN(d.getTime())) return '';
        
        return d.toISOString().split('T')[0]; // YYYY-MM-DD format
      };
      
      return {
        'Employee Name': employee.employeeName,
        'Job Title': employee.jobTitle || (historical ? historical.title : 'N/A'),
        'Company': employee.company || (historical ? historical.company : 'N/A'),
        'Employee Type': employee.type,
        'Recruiter Team': employee.recruiterTeam,
        'Start Date': formatDate(employee.startDate),
        'Joined Date': formatDate(employee.joinedDate),
        'Added By': createdBy ? createdBy.name : 'System',
        'Creation Date': formatDate(employee.createdAt)
      };
    }));
    
    // Create workbook with date handling
    const workbook = XLSX.utils.book_new();
    
    // Convert data to worksheet
    const worksheet = XLSX.utils.json_to_sheet(enrichedData);
    
    // Add worksheet to workbook
    const sheetName = searchTerm.trim() ? 
      `Search - ${searchTerm.substring(0, 20)}` : 'Joined Employees';
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
    
    // Create buffer
    const buffer = XLSX.write(workbook, { 
      type: 'buffer', 
      bookType: 'xlsx',
      cellDates: true,
      dateNF: 'yyyy-mm-dd'
    });
    
    // Set headers
    const fileName = searchTerm.trim() ? 
      `joined_employees_search_${searchTerm.replace(/[^a-z0-9]/gi, '_').substring(0, 20)}.xlsx` : 
      'joined_employees.xlsx';
    res.setHeader('Content-Disposition', `attachment; filename=${fileName}`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    
    // Send file
    res.send(buffer);
  } catch (error) {
    console.error('Error exporting joined employees:', error);
    req.flash('error_msg', 'An error occurred while exporting data');
    res.redirect('/joined');
  }
};

// Function to calculate team statistics
async function calculateTeamStats(joinedEmployees) {
  // Initialize statistics object
  const teamStats = {
    duracellLightIndustrial: 0,
    duracellProfessional: 0,
    duracellTotal: 0,
    bravesLightIndustrial: 0,
    bravesProfessional: 0,
    bravesTotal: 0
  };
  
  // Count employees by team and type
  joinedEmployees.forEach(employee => {
    if (employee.recruiterTeam === 'Team Duracell') {
      if (employee.type === 'Light Industrial') {
        teamStats.duracellLightIndustrial++;
      } else if (employee.type === 'Professional') {
        teamStats.duracellProfessional++;
      }
      teamStats.duracellTotal++;
    } else if (employee.recruiterTeam === 'Team Braves') {
      if (employee.type === 'Light Industrial') {
        teamStats.bravesLightIndustrial++;
      } else if (employee.type === 'Professional') {
        teamStats.bravesProfessional++;
      }
      teamStats.bravesTotal++;
    }
  });
  
  return teamStats;
}

// Add this code to the existing getJoined function
exports.getJoined = async (req, res) => {
  try {
    // Pagination
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    
    // Get joined employees with pagination
    const joinedEmployees = await Joined.findAll({ skip, limit });
    
    // Get all joined employees for team statistics (no pagination)
    const allJoinedEmployees = await Joined.findAll();
    
    // Calculate team statistics
    const teamStats = await calculateTeamStats(allJoinedEmployees);
    
    // Get total count for pagination
    const totalRecords = await Joined.getCount();
    const totalPages = Math.ceil(totalRecords / limit);
    
    // Enrich joined employees with historical data and created by user
    const enrichedJoinedEmployees = await Promise.all(joinedEmployees.map(async (joined) => {
      let historical = null;
      if (joined.historicalId) {
        historical = await Historical.findById(joined.historicalId);
      }
      
      let createdBy = null;
      if (joined.createdBy) {
        createdBy = await User.findById(joined.createdBy);
      }
      
      return {
        ...joined,
        historicalId: historical || { 
          title: 'Unknown Position', 
          company: 'Unknown Company', 
          jobId: 'Unknown ID',
          type: joined.type
        },
        createdBy: createdBy || { name: 'System' }
      };
    }));
    
    res.render('joined/index', {
      title: 'Joined Employees',
      joinedEmployees: enrichedJoinedEmployees,
      currentPage: page,
      totalPages,
      limit,
      teamStats, // Add team statistics
      user: req.session.user,
      isSearchResults: false,
      searchTerm: ''
    });
  } catch (error) {
    console.error('Error fetching joined employees:', error);
    req.flash('error_msg', 'An error occurred while fetching joined employee data');
    res.redirect('/dashboard');
  }
};

// Also update the searchJoined function to include team statistics
exports.searchJoined = async (req, res) => {
  try {
    const { q } = req.query;
    const searchTerm = q || '';
    
    // Pagination
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    
    if (!searchTerm.trim()) {
      return res.redirect('/joined');
    }
    
    // Get all joined employees for team statistics (no pagination)
    const allJoinedEmployees = await Joined.findAll();
    
    // Calculate team statistics
    const teamStats = await calculateTeamStats(allJoinedEmployees);
    
    // Get search results with pagination
    const joinedEmployees = await Joined.search(searchTerm, { skip, limit });
    
    // Get total count for pagination
    const totalRecords = await Joined.getSearchCount(searchTerm);
    const totalPages = Math.ceil(totalRecords / limit);
    
    // Enrich joined employees with historical data and created by user
    const enrichedJoinedEmployees = await Promise.all(joinedEmployees.map(async (joined) => {
      let historical = null;
      if (joined.historicalId) {
        historical = await Historical.findById(joined.historicalId);
      }
      
      let createdBy = null;
      if (joined.createdBy) {
        createdBy = await User.findById(joined.createdBy);
      }
      
      return {
        ...joined,
        historicalId: historical || { 
          title: 'Unknown Position', 
          company: 'Unknown Company', 
          jobId: 'Unknown ID',
          type: joined.type
        },
        createdBy: createdBy || { name: 'System' }
      };
    }));
    
    res.render('joined/index', {
      title: 'Search Results - Joined Employees',
      joinedEmployees: enrichedJoinedEmployees,
      currentPage: page,
      totalPages,
      limit,
      teamStats, // Add team statistics
      user: req.session.user,
      searchTerm,
      isSearchResults: true
    });
  } catch (error) {
    console.error('Error searching joined employees:', error);
    req.flash('error_msg', 'An error occurred while searching');
    res.redirect('/joined');
  }
};