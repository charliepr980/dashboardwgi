// controllers/dashboardController.js
const { poolPromise, sql } = require('../utils/db');
const Historical = require('../models/Historical');
const Joined = require('../models/Joined');
const Report = require('../models/Report');

exports.getDashboard = async (req, res) => {
  try {
    // Get date range parameters
    const preset = req.query.preset || 'fy2025';
    let startDate, endDate, dateRangeText;
    
    // Current date at the beginning of the day
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    
    // Set date range based on preset
    switch(preset) {
      case 'ytd': // Year to Date
        startDate = new Date(now.getFullYear(), 0, 1);
        endDate = now;
        dateRangeText = `Year to Date (${startDate.toLocaleDateString()} - ${now.toLocaleDateString()})`;
        break;
        
      case 'currentMonth': // Current Month (full calendar month)
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        // End date is the last day of the current month
        endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
        
        // Format month name
        const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 
                            'July', 'August', 'September', 'October', 'November', 'December'];
        const currentMonthName = monthNames[now.getMonth()];
        
        dateRangeText = `${currentMonthName} ${now.getFullYear()} (${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()})`;
        break;
        
      case 'mtd': // Month to Date
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        endDate = now;
        dateRangeText = `Month to Date (${startDate.toLocaleDateString()} - ${now.toLocaleDateString()})`;
        break;
        
      case 'last30': // Last 30 days
        startDate = new Date();
        startDate.setDate(now.getDate() - 30);
        endDate = now;
        dateRangeText = `Last 30 Days (${startDate.toLocaleDateString()} - ${now.toLocaleDateString()})`;
        break;
        
      case 'last90': // Last 90 days
        startDate = new Date();
        startDate.setDate(now.getDate() - 90);
        endDate = now;
        dateRangeText = `Last 90 Days (${startDate.toLocaleDateString()} - ${now.toLocaleDateString()})`;
        break;
        
      case 'custom': // Custom date range
        if (req.query.startDate) {
          startDate = new Date(req.query.startDate);
        } else {
          startDate = new Date();
          startDate.setDate(now.getDate() - 30);
        }
        
        if (req.query.endDate) {
          endDate = new Date(req.query.endDate);
          // Set to end of day
          endDate.setHours(23, 59, 59, 999);
        } else {
          endDate = now;
        }
        
        dateRangeText = `Custom Range (${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()})`;
        break;
        
      default: // Fiscal Year 2025 (Nov 1, 2024 to Oct 31, 2025)
      case 'fy2025':
        // Set fiscal year start (November 1, 2024)
        startDate = new Date(2024, 10, 1); // Month is 0-indexed, so 10 = November
        
        // Set fiscal year end (October 31, 2025)
        endDate = new Date(2025, 9, 31, 23, 59, 59, 999); // Month is 0-indexed, so 9 = October
        
        // If current date is past the fiscal year end, use it as end date
        if (now > endDate) {
          endDate = now;
        }
        
        dateRangeText = `Fiscal Year 2025 (${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()})`;
        break;
    }
    
    // Calculate months difference more accurately  
    const startYear = startDate.getFullYear();
    const startMonth = startDate.getMonth();
    const endYear = endDate.getFullYear();
    const endMonth = endDate.getMonth();
    
    // Calculate months between dates
    let monthFactor = (endYear - startYear) * 12 + (endMonth - startMonth) + 1;
    
    // Make sure we have at least 1 month
    monthFactor = Math.max(1, monthFactor);
    
    // Cap at 12 for Fiscal Year
    if (preset === 'fy2025' || preset === 'all') {
      monthFactor = Math.min(12, monthFactor);
    }
    
    // Date range for queries
    const dateRange = {
      preset,
      startDate,
      endDate,
      monthFactor
    };
    
    try {
      // Get joined employees within date range
      const joinedEmployees = await Joined.findByDateRange(startDate, endDate);
      
      // Get historical data within date range
      const historicalData = await Historical.findAll({
        startDate: startDate,
        endDate: endDate
      });
      
      // Count stats for the date range
      const joinedCount = joinedEmployees.length;
      const lightIndustrialJoinedCount = joinedEmployees.filter(j => j.type === 'Light Industrial').length;
      const professionalJoinedCount = joinedEmployees.filter(j => j.type === 'Professional').length;
      const teamBravesJoinedCount = joinedEmployees.filter(j => j.recruiterTeam === 'Team Braves').length || 0;
      const teamDuracellJoinedCount = joinedEmployees.filter(j => j.recruiterTeam === 'Team Duracell').length || 0;
      
      // Count positions by type in the date range
      const lightIndustrialCount = historicalData.filter(h => h.type === 'Light Industrial').length;
      const professionalCount = historicalData.filter(h => h.type === 'Professional').length;

// Calculate total openings for each type
const lightIndustrialOpenings = historicalData
  .filter(h => h.type === 'Light Industrial')
  .reduce((total, record) => total + (record.openings || 0), 0);
const professionalOpenings = historicalData
  .filter(h => h.type === 'Professional')
  .reduce((total, record) => total + (record.openings || 0), 0);

      
      // Count submissions in the date range
      const submissionsCount = historicalData.reduce((total, record) => total + (record.submitted || 0), 0);
      const lightIndustrialSubmissionsCount = historicalData
        .filter(h => h.type === 'Light Industrial')
        .reduce((total, record) => total + (record.submitted || 0), 0);
      const professionalSubmissionsCount = historicalData
        .filter(h => h.type === 'Professional')
        .reduce((total, record) => total + (record.submitted || 0), 0);
      
      // Get the latest report for last upload date
      const latestReport = await Report.findOne({}, { orderBy: { uploadDate: -1 } });
      
      // Compile dashboard data
      const dashboardData = {
        lightIndustrialCount,
        professionalCount,
	lightIndustrialOpenings, // Add this line
 	professionalOpenings,
        submissionsCount,
        lightIndustrialSubmissionsCount,
        professionalSubmissionsCount,
        joinedCount,
        lightIndustrialJoinedCount,
        professionalJoinedCount,
        teamBravesJoinedCount,
        teamDuracellJoinedCount,
        lastUpload: latestReport ? latestReport.uploadDate : null
      };
      
      // Get recent jobs for the dashboard (most recent historical data)
      const jobs = historicalData
        .sort((a, b) => new Date(b.created) - new Date(a.created))
        .slice(0, 10);
      
      res.render('dashboard/index', {
        title: 'Dashboard',
        data: dashboardData,
        jobs,
        dateRange,
        dateRangeText,
        monthFactor,
        user: req.session.user
      });
    } catch (error) {
      console.error('Error processing dashboard data:', error);
      throw error;
    }
  } catch (error) {
    console.error('Dashboard error:', error);
    req.flash('error_msg', 'An error occurred while loading the dashboard');
    res.render('dashboard/index', {
      title: 'Dashboard',
      data: {
        lightIndustrialCount: 0,
        professionalCount: 0,
        submissionsCount: 0,
        lightIndustrialSubmissionsCount: 0,
        professionalSubmissionsCount: 0,
        joinedCount: 0,
        lightIndustrialJoinedCount: 0,
        professionalJoinedCount: 0,
        teamBravesJoinedCount: 0,
        teamDuracellJoinedCount: 0,
        lastUpload: null
      },
      jobs: [],
      dateRange: {},
      dateRangeText: 'Error loading data',
      monthFactor: 1,
      user: req.session.user
    });
  }
};