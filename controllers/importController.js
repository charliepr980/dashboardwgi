const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');
const Joined = require('../models/Joined');

// Import joined employees page
exports.getImportJoined = (req, res) => {
  res.render('import/joined', {
    title: 'Import Joined Employee',
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
    res.redirect('/import/joined');
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

// Process joined employees import
exports.postImportJoined = async (req, res) => {
  if (!req.files || Object.keys(req.files).length === 0) {
    req.flash('error_msg', 'No file was uploaded');
    return res.redirect('/import/joined');
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
    await joinedFile.mv(uploadPath);
    
    // Process the Excel file with date parsing enabled
    const workbook = XLSX.readFile(uploadPath, { cellDates: true });
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    
    // Parse the data - specify cellDates:true to get proper date objects
    const rawData = XLSX.utils.sheet_to_json(worksheet, { 
      raw: false,
      dateNF: 'yyyy-mm-dd',
      cellDates: true
    });
    
    console.log("First row sample:", rawData[0]);
    
    // Validate required fields
    if (rawData.length === 0) {
      req.flash('error_msg', 'The uploaded file contains no data');
      return res.redirect('/import/joined');
    }
    
    // Get the first row to extract column headers
    const firstRow = rawData[0];
    const headers = Object.keys(firstRow);
    
    // Check for required column name patterns (case-insensitive and ignoring spaces)
    const findHeader = (pattern) => {
      return headers.find(h => h && h.toLowerCase().replace(/\s+/g, '') === pattern.toLowerCase().replace(/\s+/g, ''));
    };
    
    const employeeNameCol = findHeader('Employee Name');
    const jobTitleCol = findHeader('Job Title');
    const companyCol = findHeader('Company');
    const typeCol = findHeader('Employee Type');
    const teamCol = findHeader('Recruiter Team');
    const startDateCol = findHeader('Start Date');
    const joinedDateCol = findHeader('Joined Date');
    
    // Check if all required columns exist
    if (!employeeNameCol || !jobTitleCol || !companyCol || !typeCol || !teamCol || !startDateCol || !joinedDateCol) {
      let missingColumns = [];
      if (!employeeNameCol) missingColumns.push('Employee Name');
      if (!jobTitleCol) missingColumns.push('Job Title');
      if (!companyCol) missingColumns.push('Company');
      if (!typeCol) missingColumns.push('Employee Type');
      if (!teamCol) missingColumns.push('Recruiter Team');
      if (!startDateCol) missingColumns.push('Start Date');
      if (!joinedDateCol) missingColumns.push('Joined Date');
      
      req.flash('error_msg', `Missing required columns: ${missingColumns.join(', ')}. Found columns: ${headers.join(', ')}`);
      return res.redirect('/import/joined');
    }
    
    // Process each row and create joined employee records
    const joinedEmployees = [];
    const errors = [];
    const importDebug = [];
    
    rawData.forEach((row, index) => {
      try {
        // For debugging
        importDebug.push({
          row: index + 2,
          startDateRaw: row[startDateCol],
          joinedDateRaw: row[joinedDateCol]
        });
        
        // Validate employee type
        const employeeType = String(row[typeCol]).trim();
        if (employeeType !== 'Light Industrial' && employeeType !== 'Professional') {
          throw new Error(`Invalid Employee Type at row ${index + 2}. Must be 'Light Industrial' or 'Professional'. Found: '${employeeType}'`);
        }
        
        // Validate recruiter team
        const recruiterTeam = String(row[teamCol]).trim();
        if (recruiterTeam !== 'Team Braves' && recruiterTeam !== 'Team Duracell') {
          throw new Error(`Invalid Recruiter Team at row ${index + 2}. Must be 'Team Braves' or 'Team Duracell'. Found: '${recruiterTeam}'`);
        }
        
        // Parse dates - handle various formats
        const startDate = parseDate(row[startDateCol]);
        const joinedDate = parseDate(row[joinedDateCol]);
        
        if (!startDate) {
          throw new Error(`Invalid Start Date at row ${index + 2}. Value: ${row[startDateCol]}`);
        }
        
        if (!joinedDate) {
          throw new Error(`Invalid Joined Date at row ${index + 2}. Value: ${row[joinedDateCol]}`);
        }
        
        // Update debug info with parsed dates
        importDebug[importDebug.length - 1].startDateParsed = startDate;
        importDebug[importDebug.length - 1].joinedDateParsed = joinedDate;
        
        // Create joined employee record
        const joinedEmployee = new Joined({
          employeeName: String(row[employeeNameCol]).trim(),
          jobTitle: String(row[jobTitleCol]).trim(),
          company: String(row[companyCol]).trim(),
          type: employeeType,
          recruiterTeam: recruiterTeam,
          startDate,
          joinedDate,
          createdBy: req.session.user.id
        });
        
        joinedEmployees.push(joinedEmployee);
      } catch (error) {
        errors.push(error.message);
      }
    });
    
    // Logging for debugging
    console.log("Import debug:", JSON.stringify(importDebug, null, 2));
    
    // Check if there were any errors
    if (errors.length > 0) {
      req.flash('error_msg', `Errors found: ${errors.join(', ')}`);
      return res.redirect('/import/joined');
    }
    
    // Save all joined employees
    await Joined.insertMany(joinedEmployees);
    
    // Cleanup the uploaded file after processing
    // fs.unlinkSync(uploadPath); // Uncomment to delete the file after processing
    
    req.flash('success_msg', `${joinedEmployees.length} joined employees imported successfully`);
    res.redirect('/joined');
  } catch (error) {
    console.error(error);
    req.flash('error_msg', `Error processing file: ${error.message}`);
    res.redirect('/import/joined');
  }
};