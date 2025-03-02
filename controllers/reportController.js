// controllers/reportController.js
const { poolPromise, sql } = require('../utils/db');
const XLSX = require('xlsx');
const Historical = require('../models/Historical');
const Joined = require('../models/Joined');

// Main reports dashboard
exports.getReportsDashboard = async (req, res) => {
  try {
    // Get available reports
    const reports = [
      { 
        id: 'team-performance', 
        title: 'Team Performance Report', 
        description: 'Compare the performance of recruitment teams by analyzing joined employee metrics.',
        icon: 'bi-people-fill'
      },
      { 
        id: 'position-fill-rate', 
        title: 'Position Fill Rate Report', 
        description: 'Analyze the fill rate of positions by comparing submissions to openings.',
        icon: 'bi-bar-chart-fill'
      },
      { 
        id: 'timeline-performance', 
        title: 'Timeline Performance Report', 
        description: 'Track performance trends over time for recruitment metrics.',
        icon: 'bi-graph-up'
      }
    ];
    
    res.render('reports/index', {
      title: 'Reports Dashboard',
      reports,
      user: req.session.user
    });
  } catch (error) {
    console.error('Error loading reports dashboard:', error);
    req.flash('error_msg', 'An error occurred while loading the reports dashboard');
    res.redirect('/dashboard');
  }
};

// Team Performance Report
exports.getTeamPerformanceReport = async (req, res) => {
  try {
    // Get date range parameters from query or use defaults
    const { startDate: startDateParam, endDate: endDateParam } = req.query;
    const endDate = endDateParam ? new Date(endDateParam) : new Date();
    
    // Default to 3 months ago if no start date provided
    const startDate = startDateParam ? new Date(startDateParam) : new Date();
    if (!startDateParam) {
      startDate.setMonth(startDate.getMonth() - 3);
    }
    
    // Format dates for form display
    const formattedStartDate = startDate.toISOString().split('T')[0];
    const formattedEndDate = endDate.toISOString().split('T')[0];
    
    // Get joined employees within date range
    const joinedEmployees = await Joined.findByDateRange(startDate, endDate);
    
    // Calculate team metrics
    const teamStats = {
      duracell: {
        lightIndustrial: 0,
        professional: 0,
        total: 0
      },
      braves: {
        lightIndustrial: 0,
        professional: 0,
        total: 0
      },
      overall: {
        lightIndustrial: 0,
        professional: 0,
        total: 0
      }
    };
    
    // Count by team and type
    joinedEmployees.forEach(employee => {
      // Count overall totals
      teamStats.overall.total++;
      if (employee.type === 'Light Industrial') {
        teamStats.overall.lightIndustrial++;
      } else if (employee.type === 'Professional') {
        teamStats.overall.professional++;
      }
      
      // Count by team
      if (employee.recruiterTeam === 'Team Duracell') {
        teamStats.duracell.total++;
        if (employee.type === 'Light Industrial') {
          teamStats.duracell.lightIndustrial++;
        } else if (employee.type === 'Professional') {
          teamStats.duracell.professional++;
        }
      } else if (employee.recruiterTeam === 'Team Braves') {
        teamStats.braves.total++;
        if (employee.type === 'Light Industrial') {
          teamStats.braves.lightIndustrial++;
        } else if (employee.type === 'Professional') {
          teamStats.braves.professional++;
        }
      }
    });
    
    // Calculate performance percentages
    const calculatePercentage = (part, total) => {
      return total > 0 ? Math.round((part / total) * 100) : 0;
    };
    
    const performanceMetrics = {
      duracell: {
        percentOfTotal: calculatePercentage(teamStats.duracell.total, teamStats.overall.total),
        lightIndustrialPercent: calculatePercentage(teamStats.duracell.lightIndustrial, teamStats.duracell.total),
        professionalPercent: calculatePercentage(teamStats.duracell.professional, teamStats.duracell.total)
      },
      braves: {
        percentOfTotal: calculatePercentage(teamStats.braves.total, teamStats.overall.total),
        lightIndustrialPercent: calculatePercentage(teamStats.braves.lightIndustrial, teamStats.braves.total),
        professionalPercent: calculatePercentage(teamStats.braves.professional, teamStats.braves.total)
      }
    };
    
    // Prepare chart data
    const chartData = {
      teamComparison: {
        labels: ['Team Duracell', 'Team Braves'],
        datasets: [
          {
            label: 'Light Industrial',
            data: [teamStats.duracell.lightIndustrial, teamStats.braves.lightIndustrial],
            backgroundColor: 'rgba(54, 162, 235, 0.5)',
            borderColor: 'rgb(54, 162, 235)',
            borderWidth: 1
          },
          {
            label: 'Professional',
            data: [teamStats.duracell.professional, teamStats.braves.professional],
            backgroundColor: 'rgba(153, 102, 255, 0.5)',
            borderColor: 'rgb(153, 102, 255)',
            borderWidth: 1
          }
        ]
      },
      teamDistribution: {
        labels: ['Team Duracell', 'Team Braves'],
        datasets: [{
          data: [teamStats.duracell.total, teamStats.braves.total],
          backgroundColor: ['rgba(255, 99, 132, 0.5)', 'rgba(75, 192, 192, 0.5)'],
          borderColor: ['rgb(255, 99, 132)', 'rgb(75, 192, 192)'],
          borderWidth: 1
        }]
      }
    };
    
    res.render('reports/team-performance', {
      title: 'Team Performance Report',
      teamStats,
      performanceMetrics,
      chartData: chartData,
      startDate: formattedStartDate,
      endDate: formattedEndDate,
      user: req.session.user
    });
  } catch (error) {
    console.error('Error generating team performance report:', error);
    req.flash('error_msg', 'An error occurred while generating the team performance report');
    res.redirect('/reports');
  }
};

// Position Fill Rate Report with Monthly Breakdown
exports.getPositionFillRateReport = async (req, res) => {
  try {
    // Get date range parameters from query or use defaults
    const { startDate: startDateParam, endDate: endDateParam } = req.query;
    const endDate = endDateParam ? new Date(endDateParam) : new Date();
    
    // Default to November 1, 2024 if no start date provided
    const startDate = startDateParam ? new Date(startDateParam) : new Date('2024-11-01');
    if (!startDateParam) {
      // Don't modify the date if we're using our default
      // startDate.setMonth(startDate.getMonth() - 3);
    }
    
    // Format dates for form display
    const formattedStartDate = startDate.toISOString().split('T')[0];
    const formattedEndDate = endDate.toISOString().split('T')[0];
    
    // Get historical data within date range
    const historicalData = await Historical.findAll({
      startDate,
      endDate
    });
    
    // Get joined employees within date range
    const joinedEmployees = await Joined.findByDateRange(startDate, endDate);
    
    // Count positions by type (for the Average metric)
    const lightIndustrialCount = historicalData.filter(h => h.type === 'Light Industrial').length;
    const professionalCount = historicalData.filter(h => h.type === 'Professional').length;
    const totalPositionCount = lightIndustrialCount + professionalCount;
    
    // Calculate fill rate metrics by type
    const lightIndustrialOpenings = historicalData
      .filter(h => h.type === 'Light Industrial')
      .reduce((sum, record) => sum + (record.openings || 0), 0);
      
    const professionalOpenings = historicalData
      .filter(h => h.type === 'Professional')
      .reduce((sum, record) => sum + (record.openings || 0), 0);
      
    const lightIndustrialSubmissions = historicalData
      .filter(h => h.type === 'Light Industrial')
      .reduce((sum, record) => sum + (record.submitted || 0), 0);
      
    const professionalSubmissions = historicalData
      .filter(h => h.type === 'Professional')
      .reduce((sum, record) => sum + (record.submitted || 0), 0);
      
    const lightIndustrialJoined = joinedEmployees
      .filter(j => j.type === 'Light Industrial')
      .length;
      
    const professionalJoined = joinedEmployees
      .filter(j => j.type === 'Professional')
      .length;
    
    // Calculate fill rates and submission ratios
    const calculateRate = (numerator, denominator) => {
      return denominator > 0 ? (numerator / denominator * 100).toFixed(1) : 0;
    };
    
    const fillRateMetrics = {
      lightIndustrial: {
        openings: lightIndustrialOpenings,
        submissions: lightIndustrialSubmissions,
        joined: lightIndustrialJoined,
        productivity: calculateRate(lightIndustrialSubmissions, lightIndustrialOpenings),
        efficiency: calculateRate(lightIndustrialJoined, lightIndustrialOpenings),
        hitRate: calculateRate(lightIndustrialJoined, lightIndustrialSubmissions),
        average: calculateRate(lightIndustrialJoined, lightIndustrialCount)
      },
      professional: {
        openings: professionalOpenings,
        submissions: professionalSubmissions,
        joined: professionalJoined,
        productivity: calculateRate(professionalSubmissions, professionalOpenings),
        efficiency: calculateRate(professionalJoined, professionalOpenings),
        hitRate: calculateRate(professionalJoined, professionalSubmissions),
        average: calculateRate(professionalJoined, professionalCount)
      },
      overall: {
        openings: lightIndustrialOpenings + professionalOpenings,
        submissions: lightIndustrialSubmissions + professionalSubmissions,
        joined: lightIndustrialJoined + professionalJoined,
        productivity: calculateRate(
          lightIndustrialSubmissions + professionalSubmissions, 
          lightIndustrialOpenings + professionalOpenings
        ),
        efficiency: calculateRate(
          lightIndustrialJoined + professionalJoined, 
          lightIndustrialOpenings + professionalOpenings
        ),
        hitRate: calculateRate(
          lightIndustrialJoined + professionalJoined, 
          lightIndustrialSubmissions + professionalSubmissions
        ),
        average: calculateRate(
          lightIndustrialJoined + professionalJoined, 
          totalPositionCount
        )
      }
    };
    
    // NEW: Generate monthly metrics
    const monthlyMetrics = [];
    
    // Create a copy of start date to iterate through months
    const currentDate = new Date(startDate);
    
    // Loop through each month in the date range
    while (currentDate <= endDate) {
      const monthStartDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
      const monthEndDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0, 23, 59, 59);
      
      // If month end date is after the overall end date, use the overall end date
      const adjustedMonthEndDate = monthEndDate > endDate ? endDate : monthEndDate;
      
      // Filter historical data for this month
      const monthHistoricalData = historicalData.filter(record => {
        const createdDate = new Date(record.created);
        return createdDate >= monthStartDate && createdDate <= adjustedMonthEndDate;
      });
      
      // Filter joined employees for this month
      const monthJoinedEmployees = joinedEmployees.filter(employee => {
        const joinedDate = new Date(employee.joinedDate);
        return joinedDate >= monthStartDate && joinedDate <= adjustedMonthEndDate;
      });
      
      // Calculate month metrics
      const monthOpenings = monthHistoricalData.reduce((sum, record) => sum + (record.openings || 0), 0);
      const monthSubmissions = monthHistoricalData.reduce((sum, record) => sum + (record.submitted || 0), 0);
      const monthJoined = monthJoinedEmployees.length;
      const monthPositionCount = monthHistoricalData.length;
      
      // Calculate rates
      const productivity = calculateRate(monthSubmissions, monthOpenings);
      const efficiency = calculateRate(monthJoined, monthOpenings);
      const hitRate = calculateRate(monthJoined, monthSubmissions);
      const average = calculateRate(monthJoined, monthPositionCount);
      
      // Format month name
      const monthName = monthStartDate.toLocaleString('default', { month: 'long', year: 'numeric' });
      
      // Add to monthly metrics array
      monthlyMetrics.push({
        month: monthName,
        openings: monthOpenings,
        submissions: monthSubmissions,
        joined: monthJoined,
        productivity,
        efficiency,
        hitRate,
        average
      });
      
      // Move to next month
      currentDate.setMonth(currentDate.getMonth() + 1);
    }
    
    // Prepare chart data (existing code)
    const chartData = {
      fillRateComparison: {
        labels: ['Light Industrial', 'Professional', 'Overall'],
        datasets: [
          {
            label: 'Productivity (%)',
            data: [
              fillRateMetrics.lightIndustrial.productivity,
              fillRateMetrics.professional.productivity,
              fillRateMetrics.overall.productivity
            ],
            backgroundColor: 'rgba(54, 162, 235, 0.5)',
            borderColor: 'rgb(54, 162, 235)',
            borderWidth: 1
          },
          {
            label: 'Efficiency (%)',
            data: [
              fillRateMetrics.lightIndustrial.efficiency,
              fillRateMetrics.professional.efficiency,
              fillRateMetrics.overall.efficiency
            ],
            backgroundColor: 'rgba(255, 99, 132, 0.5)',
            borderColor: 'rgb(255, 99, 132)',
            borderWidth: 1
          },
          {
            label: 'Hit Rate (%)',
            data: [
              fillRateMetrics.lightIndustrial.hitRate,
              fillRateMetrics.professional.hitRate,
              fillRateMetrics.overall.hitRate
            ],
            backgroundColor: 'rgba(75, 192, 192, 0.5)',
            borderColor: 'rgb(75, 192, 192)',
            borderWidth: 1
          },
          {
            label: 'Average (%)',
            data: [
              fillRateMetrics.lightIndustrial.average,
              fillRateMetrics.professional.average,
              fillRateMetrics.overall.average
            ],
            backgroundColor: 'rgba(153, 102, 255, 0.5)',
            borderColor: 'rgb(153, 102, 255)',
            borderWidth: 1
          }
        ]
      },
      typesComparison: {
        labels: ['Openings', 'Submissions', 'Joined'],
        datasets: [
          {
            label: 'Light Industrial',
            data: [
              fillRateMetrics.lightIndustrial.openings,
              fillRateMetrics.lightIndustrial.submissions,
              fillRateMetrics.lightIndustrial.joined
            ],
            backgroundColor: 'rgba(54, 162, 235, 0.5)',
            borderColor: 'rgb(54, 162, 235)',
            borderWidth: 1
          },
          {
            label: 'Professional',
            data: [
              fillRateMetrics.professional.openings,
              fillRateMetrics.professional.submissions,
              fillRateMetrics.professional.joined
            ],
            backgroundColor: 'rgba(153, 102, 255, 0.5)',
            borderColor: 'rgb(153, 102, 255)',
            borderWidth: 1
          }
        ]
      }
    };
    
    res.render('reports/position-fill-rate', {
      title: 'Position Fill Rate Report',
      fillRateMetrics,
      chartData,
      monthlyMetrics, // NEW: Pass monthly metrics to the template
      startDate: formattedStartDate,
      endDate: formattedEndDate,
      user: req.session.user
    });
  } catch (error) {
    console.error('Error generating position fill rate report:', error);
    req.flash('error_msg', 'An error occurred while generating the position fill rate report');
    res.redirect('/reports');
  }
};

// Timeline Performance Report
exports.getTimelinePerformanceReport = async (req, res) => {
  try {
    // Get current year or from query
    const year = parseInt(req.query.year) || new Date().getFullYear();
    
    // Get joined employees for each month of the year
    const joinedByMonth = [];
    const submissionsByMonth = [];
    const openingsByMonth = [];
    
    for (let month = 0; month < 12; month++) {
      const startDate = new Date(year, month, 1);
      const endDate = new Date(year, month + 1, 0, 23, 59, 59, 999);
      
      // Get joined employees for this month
      const joinedEmployees = await Joined.findByDateRange(startDate, endDate);
      
      // Get historical data for this month
      const historicalData = await Historical.findAll({
        startDate,
        endDate
      });
      
      // Calculate metrics for this month
      const lightIndustrialJoined = joinedEmployees.filter(j => j.type === 'Light Industrial').length;
      const professionalJoined = joinedEmployees.filter(j => j.type === 'Professional').length;
      
      const lightIndustrialSubmissions = historicalData
        .filter(h => h.type === 'Light Industrial')
        .reduce((sum, record) => sum + (record.submitted || 0), 0);
        
      const professionalSubmissions = historicalData
        .filter(h => h.type === 'Professional')
        .reduce((sum, record) => sum + (record.submitted || 0), 0);
        
      const lightIndustrialOpenings = historicalData
        .filter(h => h.type === 'Light Industrial')
        .reduce((sum, record) => sum + (record.openings || 0), 0);
        
      const professionalOpenings = historicalData
        .filter(h => h.type === 'Professional')
        .reduce((sum, record) => sum + (record.openings || 0), 0);
      
      // Store monthly data
      joinedByMonth.push({
        month: month + 1,
        monthName: new Date(year, month, 1).toLocaleString('default', { month: 'short' }),
        lightIndustrial: lightIndustrialJoined,
        professional: professionalJoined,
        total: lightIndustrialJoined + professionalJoined
      });
      
      submissionsByMonth.push({
        month: month + 1,
        monthName: new Date(year, month, 1).toLocaleString('default', { month: 'short' }),
        lightIndustrial: lightIndustrialSubmissions,
        professional: professionalSubmissions,
        total: lightIndustrialSubmissions + professionalSubmissions
      });
      
      openingsByMonth.push({
        month: month + 1,
        monthName: new Date(year, month, 1).toLocaleString('default', { month: 'short' }),
        lightIndustrial: lightIndustrialOpenings,
        professional: professionalOpenings,
        total: lightIndustrialOpenings + professionalOpenings
      });
    }
    
    // Calculate yearly totals
    const yearlyTotals = {
      joined: {
        lightIndustrial: joinedByMonth.reduce((sum, month) => sum + month.lightIndustrial, 0),
        professional: joinedByMonth.reduce((sum, month) => sum + month.professional, 0),
        total: joinedByMonth.reduce((sum, month) => sum + month.total, 0)
      },
      submissions: {
        lightIndustrial: submissionsByMonth.reduce((sum, month) => sum + month.lightIndustrial, 0),
        professional: submissionsByMonth.reduce((sum, month) => sum + month.professional, 0),
        total: submissionsByMonth.reduce((sum, month) => sum + month.total, 0)
      },
      openings: {
        lightIndustrial: openingsByMonth.reduce((sum, month) => sum + month.lightIndustrial, 0),
        professional: openingsByMonth.reduce((sum, month) => sum + month.professional, 0),
        total: openingsByMonth.reduce((sum, month) => sum + month.total, 0)
      }
    };
    
    // Prepare year options for dropdown (current year and 2 previous years)
    const currentYear = new Date().getFullYear();
    const yearOptions = [
      currentYear,
      currentYear - 1,
      currentYear - 2
    ];
    
    // Prepare chart data
    const chartData = {
      joinedTimeline: {
        labels: joinedByMonth.map(m => m.monthName),
        datasets: [
          {
            label: 'Light Industrial',
            data: joinedByMonth.map(m => m.lightIndustrial),
            backgroundColor: 'rgba(54, 162, 235, 0.5)',
            borderColor: 'rgb(54, 162, 235)',
            borderWidth: 1
          },
          {
            label: 'Professional',
            data: joinedByMonth.map(m => m.professional),
            backgroundColor: 'rgba(153, 102, 255, 0.5)',
            borderColor: 'rgb(153, 102, 255)',
            borderWidth: 1
          },
          {
            label: 'Total',
            data: joinedByMonth.map(m => m.total),
            backgroundColor: 'rgba(75, 192, 192, 0.5)',
            borderColor: 'rgb(75, 192, 192)',
            borderWidth: 1
          }
        ]
      },
      submissionsTimeline: {
        labels: submissionsByMonth.map(m => m.monthName),
        datasets: [
          {
            label: 'Submissions',
            data: submissionsByMonth.map(m => m.total),
            backgroundColor: 'rgba(255, 99, 132, 0.5)',
            borderColor: 'rgb(255, 99, 132)',
            borderWidth: 1
          },
          {
            label: 'Openings',
            data: openingsByMonth.map(m => m.total),
            backgroundColor: 'rgba(54, 162, 235, 0.5)',
            borderColor: 'rgb(54, 162, 235)',
            borderWidth: 1
          },
          {
            label: 'Joined',
            data: joinedByMonth.map(m => m.total),
            backgroundColor: 'rgba(75, 192, 192, 0.5)',
            borderColor: 'rgb(75, 192, 192)',
            borderWidth: 1
          }
        ]
      }
    };
    
    res.render('reports/timeline-performance', {
      title: 'Timeline Performance Report',
      joinedByMonth,
      submissionsByMonth,
      openingsByMonth,
      yearlyTotals,
      year,
      yearOptions,
      chartData: chartData,
      user: req.session.user
    });
  } catch (error) {
    console.error('Error generating timeline performance report:', error);
    req.flash('error_msg', 'An error occurred while generating the timeline performance report');
    res.redirect('/reports');
  }
};

// Export Team Performance Report
exports.exportTeamPerformanceReport = async (req, res) => {
  try {
    // Get date range parameters from query or use defaults
    const { startDate: startDateParam, endDate: endDateParam } = req.query;
    const endDate = endDateParam ? new Date(endDateParam) : new Date();
    
    // Default to 3 months ago if no start date provided
    const startDate = startDateParam ? new Date(startDateParam) : new Date();
    if (!startDateParam) {
      startDate.setMonth(startDate.getMonth() - 3);
    }
    
    // Get joined employees within date range
    const joinedEmployees = await Joined.findByDateRange(startDate, endDate);
    const joinedByMonth = [];
    
    // Create workbook
    const workbook = XLSX.utils.book_new();

    // Create individual employee records worksheet
    const employeeData = await Promise.all(joinedEmployees.map(async (employee) => {
      // Format dates for report
      const formatDate = (date) => {
        if (!date) return '';
        const d = new Date(date);
        if (isNaN(d.getTime())) return '';
        
        return d.toISOString().split('T')[0]; // YYYY-MM-DD format
      };
      
      return {
        'Employee Name': employee.employeeName,
        'Job Title': employee.jobTitle,
        'Company': employee.company,
        'Employee Type': employee.type,
        'Recruiter Team': employee.recruiterTeam,
        'Start Date': formatDate(employee.startDate),
        'Joined Date': formatDate(employee.joinedDate)
      };
    }));
    
    // Create worksheet for individual records
    const detailsSheet = XLSX.utils.json_to_sheet(employeeData);
    XLSX.utils.book_append_sheet(workbook, detailsSheet, 'Employee Details');
    
    // Calculate team metrics
    const teamStats = {
      duracellLightIndustrial: 0,
      duracellProfessional: 0,
      duracellTotal: 0,
      bravesLightIndustrial: 0,
      bravesProfessional: 0,
      bravesTotal: 0,
      totalLightIndustrial: 0,
      totalProfessional: 0,
      grandTotal: 0
    };
    
    // Count by team and type
    joinedEmployees.forEach(employee => {
      // Count overall totals
      if (employee.type === 'Light Industrial') {
        teamStats.totalLightIndustrial++;
      } else if (employee.type === 'Professional') {
        teamStats.totalProfessional++;
      }
      teamStats.grandTotal++;
      
      // Count by team
      if (employee.recruiterTeam === 'Team Duracell') {
        teamStats.duracellTotal++;
        if (employee.type === 'Light Industrial') {
          teamStats.duracellLightIndustrial++;
        } else if (employee.type === 'Professional') {
          teamStats.duracellProfessional++;
        }
      } else if (employee.recruiterTeam === 'Team Braves') {
        teamStats.bravesTotal++;
        if (employee.type === 'Light Industrial') {
          teamStats.bravesLightIndustrial++;
        } else if (employee.type === 'Professional') {
          teamStats.bravesProfessional++;
        }
      }
    });
    
    // Create summary data
    const summaryData = [
      { 'Team': 'Team Duracell', 'Light Industrial': teamStats.duracellLightIndustrial, 'Professional': teamStats.duracellProfessional, 'Total': teamStats.duracellTotal },
      { 'Team': 'Team Braves', 'Light Industrial': teamStats.bravesLightIndustrial, 'Professional': teamStats.bravesProfessional, 'Total': teamStats.bravesTotal },
      { 'Team': 'Total', 'Light Industrial': teamStats.totalLightIndustrial, 'Professional': teamStats.totalProfessional, 'Total': teamStats.grandTotal }
    ];
    
    // Add percentages
    const percentageData = [
      { 
        'Metric': 'Team Duracell - % of Total', 
        'Value': teamStats.grandTotal > 0 ? ((teamStats.duracellTotal / teamStats.grandTotal) * 100).toFixed(1) + '%' : '0%' 
      },
      { 
        'Metric': 'Team Braves - % of Total', 
        'Value': teamStats.grandTotal > 0 ? ((teamStats.bravesTotal / teamStats.grandTotal) * 100).toFixed(1) + '%' : '0%' 
      },
      { 
        'Metric': 'Team Duracell - Light Industrial %', 
        'Value': teamStats.duracellTotal > 0 ? ((teamStats.duracellLightIndustrial / teamStats.duracellTotal) * 100).toFixed(1) + '%' : '0%' 
      },
      { 
        'Metric': 'Team Duracell - Professional %', 
        'Value': teamStats.duracellTotal > 0 ? ((teamStats.duracellProfessional / teamStats.duracellTotal) * 100).toFixed(1) + '%' : '0%' 
      },
      { 
        'Metric': 'Team Braves - Light Industrial %', 
        'Value': teamStats.bravesTotal > 0 ? ((teamStats.bravesLightIndustrial / teamStats.bravesTotal) * 100).toFixed(1) + '%' : '0%' 
      },
      { 
        'Metric': 'Team Braves - Professional %', 
        'Value': teamStats.bravesTotal > 0 ? ((teamStats.bravesProfessional / teamStats.bravesTotal) * 100).toFixed(1) + '%' : '0%' 
      }
    ];
    
    // Create summary worksheet
    const summarySheet = XLSX.utils.json_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(workbook, summarySheet, 'Team Summary');
    
    // Create percentages worksheet
    const percentageSheet = XLSX.utils.json_to_sheet(percentageData);
    XLSX.utils.book_append_sheet(workbook, percentageSheet, 'Percentages');
    
    // Create buffer
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    
    // Format dates for filename
    const formatDateForFilename = (date) => {
      return date.toISOString().split('T')[0].replace(/-/g, '');
    };
    
    // Set headers
    res.setHeader('Content-Disposition', `attachment; filename=team_performance_${formatDateForFilename(startDate)}_to_${formatDateForFilename(endDate)}.xlsx`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    
    // Send file
    res.send(buffer);
  } catch (error) {
    console.error('Error exporting team performance report:', error);
    req.flash('error_msg', 'An error occurred while exporting the team performance report');
    res.redirect('/reports/team-performance');
  }
};

// Export Position Fill Rate Report
exports.exportPositionFillRateReport = async (req, res) => {
  try {
    // Get date range parameters from query or use defaults
    const { startDate: startDateParam, endDate: endDateParam } = req.query;
    const endDate = endDateParam ? new Date(endDateParam) : new Date();
    
    // Default to November 1, 2024 if no start date provided
    const startDate = startDateParam ? new Date(startDateParam) : new Date('2024-11-01');
    if (!startDateParam) {
      // Don't modify the date if we're using our default
      // startDate.setMonth(startDate.getMonth() - 3);
    }
    
    // Get historical data within date range
    const historicalData = await Historical.findAll({
      startDate,
      endDate
    });
    
    // Get joined employees within date range
    const joinedEmployees = await Joined.findByDateRange(startDate, endDate);
    
    // Create workbook
    const workbook = XLSX.utils.book_new();
    
    // Prepare detailed historical data
    const historicalDetails = historicalData.map(record => ({
      'Created': record.created.toLocaleDateString(),
      'Job ID': record.jobId,
      'Company': record.company,
      'Title': record.title,
      'Type': record.type,
      'Openings': record.openings,
      'Submissions': record.submitted,
      'Status': record.status
    }));
    
    // Create historical details worksheet
    const historicalSheet = XLSX.utils.json_to_sheet(historicalDetails);
    XLSX.utils.book_append_sheet(workbook, historicalSheet, 'Position Details');
    
    // Prepare joined details
    const joinedDetails = joinedEmployees.map(employee => ({
      'Employee Name': employee.employeeName,
      'Job Title': employee.jobTitle,
      'Company': employee.company,
      'Type': employee.type,
      'Joined Date': employee.joinedDate.toLocaleDateString()
    }));
    
    // Create joined details worksheet
    const joinedSheet = XLSX.utils.json_to_sheet(joinedDetails);
    XLSX.utils.book_append_sheet(workbook, joinedSheet, 'Joined Employees');

    // Calculate fill rate metrics by type
    const lightIndustrialOpenings = historicalData
      .filter(h => h.type === 'Light Industrial')
      .reduce((sum, record) => sum + (record.openings || 0), 0);
      
    const professionalOpenings = historicalData
      .filter(h => h.type === 'Professional')
      .reduce((sum, record) => sum + (record.openings || 0), 0);
      
    const lightIndustrialSubmissions = historicalData
      .filter(h => h.type === 'Light Industrial')
      .reduce((sum, record) => sum + (record.submitted || 0), 0);
      
    const professionalSubmissions = historicalData
      .filter(h => h.type === 'Professional')
      .reduce((sum, record) => sum + (record.submitted || 0), 0);
      
    const lightIndustrialJoined = joinedEmployees
      .filter(j => j.type === 'Light Industrial')
      .length;
      
    const professionalJoined = joinedEmployees
      .filter(j => j.type === 'Professional')
      .length;
    
    // Calculate total metrics
    const totalOpenings = lightIndustrialOpenings + professionalOpenings;
    const totalSubmissions = lightIndustrialSubmissions + professionalSubmissions;
    const totalJoined = lightIndustrialJoined + professionalJoined;
    
    // Create summary data
    const summaryData = [
      { 'Type': 'Light Industrial', 'Openings': lightIndustrialOpenings, 'Submissions': lightIndustrialSubmissions, 'Joined': lightIndustrialJoined },
      { 'Type': 'Professional', 'Openings': professionalOpenings, 'Submissions': professionalSubmissions, 'Joined': professionalJoined },
      { 'Type': 'Total', 'Openings': totalOpenings, 'Submissions': totalSubmissions, 'Joined': totalJoined }
    ];
    
    // Create summary worksheet
    const summarySheet = XLSX.utils.json_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary');
    
    // Create ratios data
    const calculateRate = (numerator, denominator) => {
      return denominator > 0 ? (numerator / denominator * 100).toFixed(1) + '%' : '0%';
    };
    
    // Count positions by type (for the Average metric)
    const lightIndustrialCount = historicalData.filter(h => h.type === 'Light Industrial').length;
    const professionalCount = historicalData.filter(h => h.type === 'Professional').length;
    const totalPositionCount = lightIndustrialCount + professionalCount;
    
    const ratiosData = [
      { 
        'Type': 'Light Industrial', 
        'Productivity': calculateRate(lightIndustrialSubmissions, lightIndustrialOpenings),
        'Efficiency': calculateRate(lightIndustrialJoined, lightIndustrialOpenings),
        'Hit Rate': calculateRate(lightIndustrialJoined, lightIndustrialSubmissions),
        'Average': calculateRate(lightIndustrialJoined, lightIndustrialCount)
      },
      { 
        'Type': 'Professional', 
        'Productivity': calculateRate(professionalSubmissions, professionalOpenings),
        'Efficiency': calculateRate(professionalJoined, professionalOpenings),
        'Hit Rate': calculateRate(professionalJoined, professionalSubmissions),
        'Average': calculateRate(professionalJoined, professionalCount)
      },
      { 
        'Type': 'Overall', 
        'Productivity': calculateRate(totalSubmissions, totalOpenings),
        'Efficiency': calculateRate(totalJoined, totalOpenings),
        'Hit Rate': calculateRate(totalJoined, totalSubmissions),
        'Average': calculateRate(totalJoined, totalPositionCount)
      }
    ];
    
    // Create ratios worksheet
    const ratiosSheet = XLSX.utils.json_to_sheet(ratiosData);
    XLSX.utils.book_append_sheet(workbook, ratiosSheet, 'Ratios');
    
    // NEW: Generate monthly metrics for Excel export
    const monthlyMetrics = [];
    
    // Create a copy of start date to iterate through months
    const currentDate = new Date(startDate);
    
    // Loop through each month in the date range
    while (currentDate <= endDate) {
      const monthStartDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
      const monthEndDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0, 23, 59, 59);
      
      // If month end date is after the overall end date, use the overall end date
      const adjustedMonthEndDate = monthEndDate > endDate ? endDate : monthEndDate;
      
      // Filter historical data for this month
      const monthHistoricalData = historicalData.filter(record => {
        const createdDate = new Date(record.created);
        return createdDate >= monthStartDate && createdDate <= adjustedMonthEndDate;
      });
      
      // Filter joined employees for this month
      const monthJoinedEmployees = joinedEmployees.filter(employee => {
        const joinedDate = new Date(employee.joinedDate);
        return joinedDate >= monthStartDate && joinedDate <= adjustedMonthEndDate;
      });
      
      // Calculate month metrics
      const monthOpenings = monthHistoricalData.reduce((sum, record) => sum + (record.openings || 0), 0);
      const monthSubmissions = monthHistoricalData.reduce((sum, record) => sum + (record.submitted || 0), 0);
      const monthJoined = monthJoinedEmployees.length;
      const monthPositionCount = monthHistoricalData.length;
      
      // Calculate rates
      const productivity = calculateRate(monthSubmissions, monthOpenings);
      const efficiency = calculateRate(monthJoined, monthOpenings);
      const hitRate = calculateRate(monthJoined, monthSubmissions);
      const average = calculateRate(monthJoined, monthPositionCount);
      
      // Format month name
      const monthName = monthStartDate.toLocaleString('default', { month: 'long', year: 'numeric' });
      
      // Add to monthly metrics array
      monthlyMetrics.push({
        'Month': monthName,
        'Total Openings': monthOpenings,
        'Total Submissions': monthSubmissions,
        'Total Joined': monthJoined,
        'Productivity': productivity,
        'Efficiency': efficiency,
        'Hit Rate': hitRate,
        'Average': average
      });
      
      // Move to next month
      currentDate.setMonth(currentDate.getMonth() + 1);
    }
    
    // Create monthly metrics worksheet
    const monthlySheet = XLSX.utils.json_to_sheet(monthlyMetrics);
    XLSX.utils.book_append_sheet(workbook, monthlySheet, 'Monthly Metrics');
    
    // Create buffer
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    
    // Format dates for filename
    const formatDateForFilename = (date) => {
      return date.toISOString().split('T')[0].replace(/-/g, '');
    };
    
    // Set headers
    res.setHeader('Content-Disposition', `attachment; filename=position_fill_rate_${formatDateForFilename(startDate)}_to_${formatDateForFilename(endDate)}.xlsx`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    
    // Send file
    res.send(buffer);
  } catch (error) {
    console.error('Error exporting position fill rate report:', error);
    req.flash('error_msg', 'An error occurred while exporting the position fill rate report');
    res.redirect('/reports/position-fill-rate');
  }
};

// Export Timeline Performance Report
exports.exportTimelinePerformanceReport = async (req, res) => {
  try {
    // Get current year or from query
    const year = parseInt(req.query.year) || new Date().getFullYear();
    
    // Create workbook
    const workbook = XLSX.utils.book_new();
    
    // Prepare monthly data
    const monthlyData = [];
    const monthlySubmissions = [];
    const monthlyOpenings = [];
    
    for (let month = 0; month < 12; month++) {
      const startDate = new Date(year, month, 1);
      const endDate = new Date(year, month + 1, 0, 23, 59, 59, 999);
      
      // Get month name
      const monthName = startDate.toLocaleString('default', { month: 'long' });
      
      // Get joined employees for this month
      const joinedEmployees = await Joined.findByDateRange(startDate, endDate);
      
      // Get historical data for this month
      const historicalData = await Historical.findAll({
        startDate,
        endDate
      });
      
      // Calculate metrics for this month
      const lightIndustrialJoined = joinedEmployees.filter(j => j.type === 'Light Industrial').length;
      const professionalJoined = joinedEmployees.filter(j => j.type === 'Professional').length;
      const totalJoined = lightIndustrialJoined + professionalJoined;
      
      const lightIndustrialSubmissions = historicalData
        .filter(h => h.type === 'Light Industrial')
        .reduce((sum, record) => sum + (record.submitted || 0), 0);
        
      const professionalSubmissions = historicalData
        .filter(h => h.type === 'Professional')
        .reduce((sum, record) => sum + (record.submitted || 0), 0);
        
      const totalSubmissions = lightIndustrialSubmissions + professionalSubmissions;
        
      const lightIndustrialOpenings = historicalData
        .filter(h => h.type === 'Light Industrial')
        .reduce((sum, record) => sum + (record.openings || 0), 0);
        
      const professionalOpenings = historicalData
        .filter(h => h.type === 'Professional')
        .reduce((sum, record) => sum + (record.openings || 0), 0);
        
      const totalOpenings = lightIndustrialOpenings + professionalOpenings;
      
      // Add to monthly data
      monthlyData.push({
        'Month': monthName,
        'Light Industrial Joined': lightIndustrialJoined,
        'Professional Joined': professionalJoined,
        'Total Joined': totalJoined
      });
      
      monthlySubmissions.push({
        'Month': monthName,
        'Light Industrial Submissions': lightIndustrialSubmissions,
        'Professional Submissions': professionalSubmissions,
        'Total Submissions': totalSubmissions
      });
      
      monthlyOpenings.push({
        'Month': monthName,
        'Light Industrial Openings': lightIndustrialOpenings,
        'Professional Openings': professionalOpenings,
        'Total Openings': totalOpenings
      });
    }
    
    // Create joined employees worksheet
    const joinedSheet = XLSX.utils.json_to_sheet(monthlyData);
    XLSX.utils.book_append_sheet(workbook, joinedSheet, 'Monthly Joined');
    
    // Create submissions worksheet
    const submissionsSheet = XLSX.utils.json_to_sheet(monthlySubmissions);
    XLSX.utils.book_append_sheet(workbook, submissionsSheet, 'Monthly Submissions');
    
    // Create openings worksheet
    const openingsSheet = XLSX.utils.json_to_sheet(monthlyOpenings);
    XLSX.utils.book_append_sheet(workbook, openingsSheet, 'Monthly Openings');
    
    // Create combined monthly metrics
    const combinedMetrics = [];
    
    for (let i = 0; i < 12; i++) {
      combinedMetrics.push({
  'Month': monthlyData[i].Month,
  'Openings': monthlyOpenings[i]['Total Openings'],
  'Submissions': monthlySubmissions[i]['Total Submissions'],
  'Joined': monthlyData[i]['Total Joined'],
  'Productivity': monthlyOpenings[i]['Total Openings'] > 0 
    ? ((monthlySubmissions[i]['Total Submissions'] / monthlyOpenings[i]['Total Openings']) * 100).toFixed(1) + '%' 
    : '0%',
  'Efficiency': monthlyOpenings[i]['Total Openings'] > 0 
    ? ((monthlyData[i]['Total Joined'] / monthlyOpenings[i]['Total Openings']) * 100).toFixed(1) + '%'
    : '0%',
  'Hit Rate': monthlySubmissions[i]['Total Submissions'] > 0
    ? ((monthlyData[i]['Total Joined'] / monthlySubmissions[i]['Total Submissions']) * 100).toFixed(1) + '%'
    : '0%',
  'Average': monthlyOpenings[i]['Total Openings'] > 0
  ? ((monthlyData[i]['Total Joined'] / (monthlyOpenings[i]['Total Openings'] * 0.12)) * 100).toFixed(1) + '%'
  : '0%'
});
    }
    
    // Create combined metrics worksheet
    const combinedSheet = XLSX.utils.json_to_sheet(combinedMetrics);
    XLSX.utils.book_append_sheet(workbook, combinedSheet, 'Combined Metrics');
    
    // Create buffer
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    
    // Set headers
    res.setHeader('Content-Disposition', `attachment; filename=timeline_performance_${year}.xlsx`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    
    // Send file
    res.send(buffer);
  } catch (error) {
    console.error('Error exporting timeline performance report:', error);
    req.flash('error_msg', 'An error occurred while exporting the timeline performance report');
    res.redirect('/reports/timeline-performance');
  }
};