const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');
const Historical = require('../models/Historical');
const Report = require('../models/Report');
const Joined = require('../models/Joined');
const User = require('../models/User');

// Upload management page
exports.getUpload = async (req, res) => {
  try {
    // Get all reports with pagination
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    
    // Get total count for pagination
    const totalReports = await Report.countDocuments();
    const totalPages = Math.ceil(totalReports / limit);
    
    // Get reports with uploadedBy populated
    const reports = await Report.findPopulated({}, ['uploadedBy']);
    
    // Sort reports by uploadDate (newest first)
    reports.sort((a, b) => new Date(b.uploadDate) - new Date(a.uploadDate));
    
    // Apply pagination manually after sorting
    const paginatedReports = reports.slice(skip, skip + limit);
    
    res.render('upload/index', {
      title: 'Upload Management',
      reports: paginatedReports,
      currentPage: page,
      totalPages,
      limit,
      user: req.session.user
    });
  } catch (error) {
    console.error('Error loading upload management page:', error);
    req.flash('error_msg', 'An error occurred while loading the upload management page');
    res.redirect('/dashboard');
  }
};

// Process file upload
exports.postUpload = async (req, res) => {
  if (!req.files || Object.keys(req.files).length === 0) {
    req.flash('error_msg', 'No file was uploaded');
    return res.redirect('/upload');
  }
  
  try {
    // Get the uploaded file
    const reportFile = req.files.reportFile;
    const uploadPath = path.join(__dirname, '../uploads', reportFile.name);
    
    // Ensure uploads directory exists
    if (!fs.existsSync(path.join(__dirname, '../uploads'))) {
      fs.mkdirSync(path.join(__dirname, '../uploads'), { recursive: true });
    }
    
    // Save the file
    await new Promise((resolve, reject) => {
      reportFile.mv(uploadPath, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
    
    // Process the Excel file
    const workbook = XLSX.readFile(uploadPath);
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    
    // First, extract the headers to get the exact column names
    const range = XLSX.utils.decode_range(worksheet['!ref']);
    const headers = [];
    for (let C = range.s.c; C <= range.e.c; ++C) {
      const cell = worksheet[XLSX.utils.encode_cell({r: range.s.r, c: C})];
      headers.push(cell ? cell.v : undefined);
    }
    
    // Then parse the data with the exact column names
    const data = XLSX.utils.sheet_to_json(worksheet);
    
    // Initialize counters
    let lightIndustrialCount = 0;
    let professionalCount = 0;
    let submissionsCount = 0;
    let lightIndustrialSubmissionsCount = 0;
    let professionalSubmissionsCount = 0;
    
    // Find the exact column names from the headers
    const typeColumnName = headers.find(h => h && String(h).toLowerCase() === 'type');
    const submissionsColumnName = headers.find(h => h && String(h).toLowerCase() === 'submitted');
    const joinedColumnName = headers.find(h => h && String(h).toLowerCase() === 'joined');
    const createdColumnName = headers.find(h => h && String(h).toLowerCase() === 'created');
    const ageColumnName = headers.find(h => h && String(h).toLowerCase().includes('age'));
    const idColumnName = headers.find(h => h && String(h).toLowerCase() === 'id');
    const ourIdColumnName = headers.find(h => h && String(h).toLowerCase().includes('our') && String(h).toLowerCase().includes('id'));
    const companyColumnName = headers.find(h => h && String(h).toLowerCase() === 'company');
    const titleColumnName = headers.find(h => h && String(h).toLowerCase() === 'title');
    const openingsColumnName = headers.find(h => h && String(h).toLowerCase() === 'openings');
    const interviewColumnName = headers.find(h => h && String(h).toLowerCase() === 'interview');
    const statusColumnName = headers.find(h => h && String(h).toLowerCase() === 'status');
    
    console.log('Column names:', { 
      typeColumnName, 
      submissionsColumnName, 
      createdColumnName,
      idColumnName,
      companyColumnName,
      titleColumnName
    });
    
    // Create new report
    const newReport = new Report({
      filename: reportFile.name,
      uploadedBy: req.session.user.id
    });
    
    await newReport.save();
    
    // Process each row and create historical records
    const historicalRecords = [];
    
    data.forEach(row => {
      let positionType = '';
      
      // Determine position type
      if (typeColumnName && row[typeColumnName]) {
        const type = String(row[typeColumnName]);
        if (type.toLowerCase().includes('light industrial')) {
          lightIndustrialCount++;
          positionType = 'Light Industrial';
        } else if (type.toLowerCase().includes('professional')) {
          professionalCount++;
          positionType = 'Professional';
        }
      }
      
      // Count submissions
      let submissionValue = 0;
      if (submissionsColumnName && row[submissionsColumnName] !== undefined && row[submissionsColumnName] !== null) {
        const submissions = row[submissionsColumnName];
        
        if (typeof submissions === 'number') {
          submissionValue = submissions;
        } else if (typeof submissions === 'string' && !isNaN(Number(submissions))) {
          submissionValue = Number(submissions);
        } else if (submissions === true || (typeof submissions === 'string' && 
                  (submissions.toLowerCase() === 'yes' || submissions.toLowerCase() === 'true'))) {
          submissionValue = 1;
        }
        
        // Add to total submissions
        submissionsCount += submissionValue;
        
        // Add to type-specific submissions
        if (positionType === 'Light Industrial') {
          lightIndustrialSubmissionsCount += submissionValue;
        } else if (positionType === 'Professional') {
          professionalSubmissionsCount += submissionValue;
        }
      }
      
      // Ensure all values are properly formatted to prevent SQL errors
      const historicalRecord = {
        reportId: newReport.id,
        created: row[createdColumnName] ? new Date(row[createdColumnName]) : new Date(),
        age: row[ageColumnName] ? parseInt(row[ageColumnName]) : 0,
        jobId: row[idColumnName] ? String(row[idColumnName]).slice(0, 255) : '',
        ourId: row[ourIdColumnName] ? String(row[ourIdColumnName]).slice(0, 255) : '',
        company: row[companyColumnName] ? String(row[companyColumnName]).slice(0, 255) : '',
        title: row[titleColumnName] ? String(row[titleColumnName]).slice(0, 255) : '',
        openings: row[openingsColumnName] ? parseInt(row[openingsColumnName]) : 1,
        submitted: submissionValue,
        interview: row[interviewColumnName] ? parseInt(row[interviewColumnName]) : 0,
        status: row[statusColumnName] ? String(row[statusColumnName]).slice(0, 255) : '',
        type: positionType
      };
      
      historicalRecords.push(historicalRecord);
    });
    
    // Bulk insert historical records
    await Historical.insertMany(historicalRecords);
    
    // Update report with metrics
    await Report.findByIdAndUpdate(newReport.id, {
      lightIndustrialCount,
      professionalCount,
      submissionsCount,
      lightIndustrialSubmissionsCount,
      professionalSubmissionsCount
    });
    
    // Cleanup the uploaded file after processing
    // fs.unlinkSync(uploadPath); // Uncomment to delete the file after processing
    
    req.flash('success_msg', 'Report uploaded and processed successfully');
    res.redirect('/upload');
  } catch (error) {
    console.error('Error processing file:', error);
    req.flash('error_msg', `Error processing file: ${error.message}`);
    res.redirect('/upload');
  }
};

// Delete report
exports.deleteReport = async (req, res) => {
  const { id } = req.params;
  
  try {
    // Delete report and associated historical records
    await Report.findByIdAndDelete(id);
    
    req.flash('success_msg', 'Report deleted successfully');
    res.redirect('/upload');
  } catch (error) {
    console.error('Error deleting report:', error);
    req.flash('error_msg', 'An error occurred while deleting the report');
    res.redirect('/upload');
  }
};

// Upload joined employees page
exports.getUploadJoined = (req, res) => {
  res.render('upload/joined', {
    title: 'Upload Joined Employees',
    user: req.session.user
  });
};

// Generate joined employees template
exports.getJoinedTemplate = (req, res) => {
  try {
    // Create workbook
    const workbook = XLSX.utils.book_new();
    
    // Create template data with headers and sample row
    const templateData = [
      {
        'Employee Name': 'John Doe',
        'Job Title': 'Software Developer',
        'Company': 'ABC Corp',
        'Employee Type': 'Professional',
        'Recruiter Team': 'Team Braves',
        'Start Date': '2024-01-01',
        'Joined Date': '2024-01-15'
      }
    ];
    
    // Convert data to worksheet
    const worksheet = XLSX.utils.json_to_sheet(templateData);
    
    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Joined Employees Template');
    
    // Create buffer
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    
    // Set headers
    res.setHeader('Content-Disposition', 'attachment; filename=joined_employees_template.xlsx');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    
    // Send file
    res.send(buffer);
  } catch (error) {
    console.error(error);
    req.flash('error_msg', 'An error occurred while generating the template');
    res.redirect('/upload/joined');
  }
};

// Helper function to parse dates correctly from various formats
const parseDate = (dateValue) => {
  if (!dateValue) {
    return null;
  }
  
  // If it's a date object already, return it
  if (dateValue instanceof Date) {
    return dateValue;
  }
  
  // If it's a number (Excel serial date), convert it
  if (typeof dateValue === 'number') {
    // Excel's epoch starts on 1/1/1900
    // 25569 is the number of days between 1/1/1900 and 1/1/1970 (Unix epoch)
    const date = new Date((dateValue - 25569) * 86400 * 1000);
    return date;
  }
  
  // If it's a string, try various formats
  if (typeof dateValue === 'string') {
    // Try to parse the date string
    const date = new Date(dateValue);
    if (!isNaN(date.getTime())) {
      return date;
    }
    
    // Try DD/MM/YYYY format
    const parts = dateValue.split(/[\/\-\.]/);
    if (parts.length === 3) {
      // Try both MM/DD/YYYY and DD/MM/YYYY
      const m1 = new Date(parseInt(parts[2]), parseInt(parts[0]) - 1, parseInt(parts[1]));
      const m2 = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
      
      if (!isNaN(m1.getTime())) {
        return m1;
      }
      if (!isNaN(m2.getTime())) {
        return m2;
      }
    }
  }
  
  // If all else fails, return null
  return null;
};

// Process joined employees upload
exports.postUploadJoined = async (req, res) => {
  if (!req.files || Object.keys(req.files).length === 0) {
    req.flash('error_msg', 'No file was uploaded');
    return res.redirect('/upload/joined');
  }
  
  try {
    // Get the uploaded file
    const joinedFile = req.files.joinedFile;
    const uploadPath = path.join(__dirname, '../uploads', joinedFile.name);
    
    // Ensure uploads directory exists
    if (!fs.existsSync(path.join(__dirname, '../uploads'))) {
      fs.mkdirSync(path.join(__dirname, '../uploads'), { recursive: true });
    }
    
    // Save the file
    await new Promise((resolve, reject) => {
      joinedFile.mv(uploadPath, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
    
    // Process the Excel file
    const workbook = XLSX.readFile(uploadPath, { cellDates: true });
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    
    // Parse the data
    const data = XLSX.utils.sheet_to_json(worksheet, {
      raw: false,
      dateNF: 'yyyy-mm-dd',
      cellDates: true
    });
    
    // Validate required fields
    if (data.length === 0) {
      req.flash('error_msg', 'The uploaded file contains no data');
      return res.redirect('/upload/joined');
    }
    
    // Process each row and create joined employee records
    const joinedEmployees = [];
    const errors = [];
    
    data.forEach((row, index) => {
      try {
        // Map column names (allowing for different case and spacing)
        const employeeNameCol = Object.keys(row).find(key => key.toLowerCase().replace(/\s+/g, '') === 'employeename');
        const jobTitleCol = Object.keys(row).find(key => key.toLowerCase().replace(/\s+/g, '') === 'jobtitle');
        const companyCol = Object.keys(row).find(key => key.toLowerCase().replace(/\s+/g, '') === 'company');
        const typeCol = Object.keys(row).find(key => key.toLowerCase().replace(/\s+/g, '') === 'employeetype');
        const teamCol = Object.keys(row).find(key => key.toLowerCase().replace(/\s+/g, '') === 'recruiterteam');
        const startDateCol = Object.keys(row).find(key => key.toLowerCase().replace(/\s+/g, '') === 'startdate');
        const joinedDateCol = Object.keys(row).find(key => key.toLowerCase().replace(/\s+/g, '') === 'joineddate');
        
        // Check required fields
        if (!employeeNameCol || !jobTitleCol || !companyCol || !typeCol || !teamCol || !startDateCol || !joinedDateCol) {
          throw new Error('Missing required columns. Please check the template.');
        }
        
        // Validate employee type
        const employeeType = String(row[typeCol]).trim();
        if (employeeType !== 'Light Industrial' && employeeType !== 'Professional') {
          throw new Error(`Invalid Employee Type at row ${index + 2}. Must be 'Light Industrial' or 'Professional'.`);
        }
        
        // Validate recruiter team
        const recruiterTeam = String(row[teamCol]).trim();
        if (recruiterTeam !== 'Team Braves' && recruiterTeam !== 'Team Duracell') {
          throw new Error(`Invalid Recruiter Team at row ${index + 2}. Must be 'Team Braves' or 'Team Duracell'.`);
        }
        
        // Parse dates
        const startDate = parseDate(row[startDateCol]);
        const joinedDate = parseDate(row[joinedDateCol]);
        
        if (!startDate) {
          throw new Error(`Invalid Start Date at row ${index + 2}. Please use YYYY-MM-DD format.`);
        }
        
        if (!joinedDate) {
          throw new Error(`Invalid Joined Date at row ${index + 2}. Please use YYYY-MM-DD format.`);
        }
        
        // Create joined employee data
        const joinedEmployeeData = {
          employeeName: String(row[employeeNameCol]).trim(),
          jobTitle: String(row[jobTitleCol]).trim(),
          company: String(row[companyCol]).trim(),
          type: employeeType,
          recruiterTeam: recruiterTeam,
          startDate,
          joinedDate,
          createdBy: req.session.user.id
        };
        
        joinedEmployees.push(joinedEmployeeData);
      } catch (error) {
        errors.push(error.message);
      }
    });
    
    // Check if there were any errors
    if (errors.length > 0) {
      req.flash('error_msg', `Errors found: ${errors.join(', ')}`);
      return res.redirect('/upload/joined');
    }
    
    // Insert joined employees into the database
    for (const employeeData of joinedEmployees) {
      await Joined.create(employeeData);
    }
    
    // Cleanup the uploaded file after processing
    // fs.unlinkSync(uploadPath); // Uncomment to delete the file after processing
    
    req.flash('success_msg', `${joinedEmployees.length} joined employees imported successfully`);
    res.redirect('/joined');
  } catch (error) {
    console.error(error);
    req.flash('error_msg', `Error processing file: ${error.message}`);
    res.redirect('/upload/joined');
  }
};

module.exports = exports;