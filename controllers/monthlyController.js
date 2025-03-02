// controllers/monthlyController.js
const Historical = require('../models/Historical');
const Joined = require('../models/Joined');

exports.getMonthly = async (req, res) => {
  try {
    // Get month and year from query parameters or use current month/year
    const { month, year } = req.query;
    const currentDate = new Date();
    const selectedMonth = month ? parseInt(month) : currentDate.getMonth() + 1; // Months are 0-indexed
    const selectedYear = year ? parseInt(year) : currentDate.getFullYear();
    
    // Create date range for the selected month
    const startDate = new Date(selectedYear, selectedMonth - 1, 1); // Month is 0-indexed in Date constructor
    const endDate = new Date(selectedYear, selectedMonth, 0); // Last day of the month
    endDate.setHours(23, 59, 59, 999); // Set to end of day
    
    // Build search query
    const searchQuery = {
      company: req.query.company,
      title: req.query.title,
      type: req.query.type,
      status: req.query.status,
      minSubmissions: req.query.minSubmissions,
      maxSubmissions: req.query.maxSubmissions,
      startDate,
      endDate
    };
    
    // Get all historical records for the selected month with filters
    const historicalRecords = await Historical.findAll(searchQuery);
    
    // Get all joined employees for the selected month (without filtering by search query)
    // This ensures the joined metrics are accurate regardless of search filters
    const joinedEmployees = await Joined.findByDateRange(startDate, endDate);
    
    // Get ALL historical records for the selected month (for accurate metrics)
    // This ensures metrics are correct even when the table is filtered
    const allMonthHistorical = await Historical.findAll({ startDate, endDate });
    
    // Calculate metrics from all monthly data (not filtered)
    const lightIndustrialCount = allMonthHistorical.filter(r => r.type === 'Light Industrial').length;
    const professionalCount = allMonthHistorical.filter(r => r.type === 'Professional').length;

// Calculate openings for each type
const lightIndustrialOpenings = allMonthHistorical
  .filter(r => r.type === 'Light Industrial')
  .reduce((total, record) => total + (record.openings || 0), 0);
const professionalOpenings = allMonthHistorical
  .filter(r => r.type === 'Professional')
  .reduce((total, record) => total + (record.openings || 0), 0);
    
    const submissionsCount = allMonthHistorical.reduce((total, record) => total + (record.submitted || 0), 0);
    const lightIndustrialSubmissionsCount = allMonthHistorical
      .filter(r => r.type === 'Light Industrial')
      .reduce((total, record) => total + (record.submitted || 0), 0);
    const professionalSubmissionsCount = allMonthHistorical
      .filter(r => r.type === 'Professional')
      .reduce((total, record) => total + (record.submitted || 0), 0);
    
    const joinedCount = joinedEmployees.length;
    const lightIndustrialJoinedCount = joinedEmployees.filter(j => j.type === 'Light Industrial').length;
    const professionalJoinedCount = joinedEmployees.filter(j => j.type === 'Professional').length;
    const teamBravesJoinedCount = joinedEmployees.filter(j => j.recruiterTeam === 'Team Braves').length || 0;
    const teamDuracellJoinedCount = joinedEmployees.filter(j => j.recruiterTeam === 'Team Duracell').length || 0;
    
    // Prepare month selection options
    const months = [
      { value: 1, name: 'January' },
      { value: 2, name: 'February' },
      { value: 3, name: 'March' },
      { value: 4, name: 'April' },
      { value: 5, name: 'May' },
      { value: 6, name: 'June' },
      { value: 7, name: 'July' },
      { value: 8, name: 'August' },
      { value: 9, name: 'September' },
      { value: 10, name: 'October' },
      { value: 11, name: 'November' },
      { value: 12, name: 'December' }
    ];
    
    // Prepare year selection options (last 5 years)
    const years = [];
    const currentYear = currentDate.getFullYear();
    for (let i = 0; i < 5; i++) {
      years.push(currentYear - i);
    }
    
    // Format current date for display
    const monthName = months.find(m => m.value === selectedMonth).name;
    const currentDateDisplay = `${monthName} ${selectedYear}`;
    
    res.render('monthly/index', {
      title: 'Monthly Statistics',
      data: {
        lightIndustrialCount,
        professionalCount,
	lightIndustrialOpenings, // Add this line
    	professionalOpenings,    // Add this line
        submissionsCount,
        lightIndustrialSubmissionsCount,
        professionalSubmissionsCount,
        joinedCount,
        lightIndustrialJoinedCount,
        professionalJoinedCount,
        teamBravesJoinedCount,
        teamDuracellJoinedCount
      },
      selectedMonth,
      selectedYear,
      months,
      years,
      jobs: historicalRecords,
      currentDate: currentDateDisplay,
      searchQuery: req.query,
      user: req.session.user
    });
  } catch (error) {
    console.error('Error loading monthly statistics:', error);
    req.flash('error_msg', 'An error occurred while loading monthly statistics');
    res.redirect('/dashboard');
  }
};