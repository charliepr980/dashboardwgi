const { poolPromise, sql } = require('../utils/db');
const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');
const moment = require('moment');

// Helper function to format dates for views
const formatDate = (date, format) => {
  if (!date) return '';
  return moment(date).format(format);
};

// Get all interviews with pagination and filters
exports.getInterviews = async (req, res) => {
  try {
    // Get pagination parameters
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    
    // Build search query
    const searchQuery = {
      candidate: req.query.candidate,
      company: req.query.company,
      position: req.query.position,
      status: req.query.status,
      type: req.query.type,
      startDate: req.query.startDate,
      endDate: req.query.endDate
    };
    
    // Get database connection
    const pool = await poolPromise;
    
    // Build the SQL query with filters
    let query = 'SELECT * FROM Interviews WHERE 1=1';
    const queryParams = [];
    
    if (searchQuery.candidate) {
      query += ' AND candidate LIKE @candidate';
      queryParams.push({ name: 'candidate', value: `%${searchQuery.candidate}%`, type: sql.NVarChar });
    }
    
    if (searchQuery.company) {
      query += ' AND company LIKE @company';
      queryParams.push({ name: 'company', value: `%${searchQuery.company}%`, type: sql.NVarChar });
    }
    
    if (searchQuery.position) {
      query += ' AND position LIKE @position';
      queryParams.push({ name: 'position', value: `%${searchQuery.position}%`, type: sql.NVarChar });
    }
    
    if (searchQuery.status) {
      query += ' AND status = @status';
      queryParams.push({ name: 'status', value: searchQuery.status, type: sql.NVarChar });
    }
    
    if (searchQuery.type) {
      query += ' AND type = @type';
      queryParams.push({ name: 'type', value: searchQuery.type, type: sql.NVarChar });
    }
    
    // Date filtering
    if (searchQuery.startDate) {
      query += ' AND startTime >= @startDate';
      queryParams.push({ name: 'startDate', value: new Date(searchQuery.startDate), type: sql.DateTime2 });
    }
    
    if (searchQuery.endDate) {
      // Set to end of day for the end date
      const endDate = new Date(searchQuery.endDate);
      endDate.setHours(23, 59, 59, 999);
      
      query += ' AND startTime <= @endDate';
      queryParams.push({ name: 'endDate', value: endDate, type: sql.DateTime2 });
    }
    
    // Get total count for pagination
    const countQuery = query.replace('SELECT *', 'SELECT COUNT(*) AS count');
    
    // Execute count query
    const countRequest = pool.request();
    queryParams.forEach(param => {
      countRequest.input(param.name, param.type, param.value);
    });
    
    const countResult = await countRequest.query(countQuery);
    const totalRecords = countResult.recordset[0].count;
    const totalPages = Math.ceil(totalRecords / limit);
    
    // Add sorting and pagination
    query += ' ORDER BY startTime DESC';
    query += ' OFFSET @skip ROWS FETCH NEXT @limit ROWS ONLY';
    queryParams.push({ name: 'skip', value: skip, type: sql.Int });
    queryParams.push({ name: 'limit', value: limit, type: sql.Int });
    
    // Execute main query
    const request = pool.request();
    queryParams.forEach(param => {
      request.input(param.name, param.type, param.value);
    });
    
    const result = await request.query(query);
    const interviews = result.recordset;
    
    // Get upcoming interviews for the next two weeks
    const today = moment().startOf('day');
    const startOfWeek = moment().startOf('week');
    const endOfWeek = moment().endOf('week');
    const endOfNextWeek = moment().add(1, 'week').endOf('week');
    
    const upcomingQuery = `
      SELECT * FROM Interviews 
      WHERE startTime >= @today
      AND startTime <= @endOfNextWeek
      AND status = 'Scheduled'
      ORDER BY startTime ASC
    `;
    
    const upcomingResult = await pool.request()
      .input('today', sql.DateTime2, today.toDate())
      .input('endOfNextWeek', sql.DateTime2, endOfNextWeek.toDate())
      .query(upcomingQuery);
    
    const upcomingInterviews = upcomingResult.recordset;
    
    // Get all interviews for calendar view
    const allInterviewsQuery = `
      SELECT * FROM Interviews
      WHERE status IN ('Scheduled', 'Rescheduled')
      ORDER BY startTime ASC
    `;
    
    const allInterviewsResult = await pool.request().query(allInterviewsQuery);
    const allInterviews = allInterviewsResult.recordset;
    
    res.render('interviews/index', {
      title: 'Interview Management',
      interviews,
      upcomingInterviews,
      allInterviews,
      currentPage: page,
      totalPages,
      limit,
      searchQuery,
      startOfWeek: startOfWeek.format('YYYY-MM-DD'),
      endOfWeek: endOfWeek.format('YYYY-MM-DD'),
      endOfNextWeek: endOfNextWeek.format('YYYY-MM-DD'),
      user: req.session.user,
      moment
    });
  } catch (error) {
    console.error('Error fetching interviews:', error);
    req.flash('error_msg', 'An error occurred while loading interview data');
    res.redirect('/dashboard');
  }
};

// Add interview page
exports.getAddInterview = (req, res) => {
  res.render('interviews/add', {
    title: 'Add Interview',
    user: req.session.user
  });
};

// Process add interview
exports.postAddInterview = async (req, res) => {
  const { 
    candidate, 
    company, 
    position, 
    type,
    startTime,
    endTime,
    status,
    recruiter,
    location,
    notes
  } = req.body;
  
  try {
    // Validate dates
    const start = new Date(startTime);
    const end = new Date(endTime);
    
    if (end <= start) {
      req.flash('error_msg', 'End time must be after start time');
      return res.redirect('/interviews/add');
    }
    
    // Get database connection
    const pool = await poolPromise;
    
    // Insert new interview
    await pool.request()
      .input('candidate', sql.NVarChar, candidate)
      .input('company', sql.NVarChar, company)
      .input('position', sql.NVarChar, position)
      .input('type', sql.NVarChar, type)
      .input('startTime', sql.DateTime2, start)
      .input('endTime', sql.DateTime2, end)
      .input('status', sql.NVarChar, status || 'Scheduled')
      .input('recruiter', sql.NVarChar, recruiter || '')
      .input('location', sql.NVarChar, location || 'Virtual')
      .input('notes', sql.NVarChar, notes || '')
      .input('createdBy', sql.Int, req.session.user.id)
      .query(`
        INSERT INTO Interviews (
          candidate, company, position, type, startTime, endTime, 
          status, recruiter, location, notes, createdBy, 
          createdAt, updatedAt
        )
        VALUES (
          @candidate, @company, @position, @type, @startTime, @endTime, 
          @status, @recruiter, @location, @notes, @createdBy, 
          GETDATE(), GETDATE()
        )
      `);
    
    req.flash('success_msg', 'Interview added successfully');
    res.redirect('/interviews');
  } catch (error) {
    console.error('Error adding interview:', error);
    req.flash('error_msg', 'An error occurred while adding the interview');
    res.redirect('/interviews/add');
  }
};

// Edit interview page
exports.getEditInterview = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Get database connection
    const pool = await poolPromise;
    
    // Get interview record
    const result = await pool.request()
      .input('id', sql.Int, id)
      .query('SELECT * FROM Interviews WHERE id = @id');
    
    if (result.recordset.length === 0) {
      req.flash('error_msg', 'Interview not found');
      return res.redirect('/interviews');
    }
    
    const interview = result.recordset[0];
    
    // Format dates for the form
    const formattedInterview = {
      ...interview,
      startTimeFormatted: moment(interview.startTime).format('YYYY-MM-DDTHH:mm'),
      endTimeFormatted: moment(interview.endTime).format('YYYY-MM-DDTHH:mm')
    };
    
    res.render('interviews/edit', {
      title: 'Edit Interview',
      interview: formattedInterview,
      user: req.session.user
    });
  } catch (error) {
    console.error('Error loading edit interview form:', error);
    req.flash('error_msg', 'An error occurred while loading the edit form');
    res.redirect('/interviews');
  }
};

// Process edit interview
exports.putEditInterview = async (req, res) => {
  const { id } = req.params;
  const { 
    candidate, 
    company, 
    position, 
    type,
    startTime,
    endTime,
    status,
    recruiter,
    location,
    notes
  } = req.body;
  
  try {
    // Validate dates
    const start = new Date(startTime);
    const end = new Date(endTime);
    
    if (end <= start) {
      req.flash('error_msg', 'End time must be after start time');
      return res.redirect(`/interviews/edit/${id}`);
    }
    
    // Get database connection
    const pool = await poolPromise;
    
    // Update interview
    await pool.request()
      .input('id', sql.Int, id)
      .input('candidate', sql.NVarChar, candidate)
      .input('company', sql.NVarChar, company)
      .input('position', sql.NVarChar, position)
      .input('type', sql.NVarChar, type)
      .input('startTime', sql.DateTime2, start)
      .input('endTime', sql.DateTime2, end)
      .input('status', sql.NVarChar, status)
      .input('recruiter', sql.NVarChar, recruiter || '')
      .input('location', sql.NVarChar, location || 'Virtual')
      .input('notes', sql.NVarChar, notes || '')
      .query(`
        UPDATE Interviews SET
          candidate = @candidate,
          company = @company, 
          position = @position,
          type = @type,
          startTime = @startTime,
          endTime = @endTime,
          status = @status,
          recruiter = @recruiter,
          location = @location,
          notes = @notes,
          updatedAt = GETDATE()
        WHERE id = @id
      `);
    
    req.flash('success_msg', 'Interview updated successfully');
    res.redirect('/interviews');
  } catch (error) {
    console.error('Error updating interview:', error);
    req.flash('error_msg', 'An error occurred while updating the interview');
    res.redirect(`/interviews/edit/${id}`);
  }
};

// Delete interview
exports.deleteInterview = async (req, res) => {
  const { id } = req.params;
  
  try {
    // Get database connection
    const pool = await poolPromise;
    
    // Delete interview
    await pool.request()
      .input('id', sql.Int, id)
      .query('DELETE FROM Interviews WHERE id = @id');
    
    req.flash('success_msg', 'Interview deleted successfully');
    res.redirect('/interviews');
  } catch (error) {
    console.error('Error deleting interview:', error);
    req.flash('error_msg', 'An error occurred while deleting the interview');
    res.redirect('/interviews');
  }
};

// Import interviews page
exports.getImportInterviews = (req, res) => {
  res.render('interviews/import', {
    title: 'Import Interviews',
    user: req.session.user
  });
};

// Generate interviews template
exports.getInterviewsTemplate = (req, res) => {
  try {
    // Create workbook
    const workbook = XLSX.utils.book_new();
    
    // Create template data with headers and sample row
    const templateData = [
      {
        'Candidate Name': 'John Doe',
        'Company': 'ABC Corp',
        'Position': 'Software Developer',
        'Type': 'Professional',
        'Start Time': '2025-03-01 09:00',
        'End Time': '2025-03-01 10:00',
        'Status': 'Scheduled',
        'Recruiter': 'Jane Smith',
        'Location': 'Virtual',
        'Notes': 'Initial screening interview'
      }
    ];
    
    // Convert data to worksheet
    const worksheet = XLSX.utils.json_to_sheet(templateData);
    
    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Interviews Template');
    
    // Create buffer
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    
    // Set headers
    res.setHeader('Content-Disposition', 'attachment; filename=interviews_template.xlsx');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    
    // Send file
    res.send(buffer);
  } catch (error) {
    console.error('Error generating template:', error);
    req.flash('error_msg', 'An error occurred while generating the template');
    res.redirect('/interviews/import');
  }
};

// Helper function to parse datetime values
const parseDateTime = (dateTimeValue) => {
  if (!dateTimeValue) {
    return null;
  }
  
  // Try to parse as date object first
  if (dateTimeValue instanceof Date) {
    return dateTimeValue;
  }
  
  // Try parsing as a string
  try {
    // For Excel format like "2025-03-01 09:00"
    if (typeof dateTimeValue === 'string') {
      return moment(dateTimeValue, [
        'YYYY-MM-DD HH:mm',  // Excel format
        'M/D/YYYY HH:mm',    // US format
        'D/M/YYYY HH:mm',    // UK format
        'YYYY-MM-DDTHH:mm',  // ISO format
        'MM/DD/YYYY hh:mm A', // 12-hour format
        'DD/MM/YYYY hh:mm A'  // UK 12-hour format
      ]).toDate();
    }
    
    // For Excel serial dates
    if (typeof dateTimeValue === 'number') {
      // Convert Excel serial date to JS date
      const excelEpoch = new Date(1899, 11, 30);
      const days = dateTimeValue;
      const milliseconds = days * 24 * 60 * 60 * 1000;
      return new Date(excelEpoch.getTime() + milliseconds);
    }
  } catch (error) {
    console.error('Error parsing date time value:', error);
    return null;
  }
  
  return null;
};

// Process interviews import
exports.postImportInterviews = async (req, res) => {
  if (!req.files || Object.keys(req.files).length === 0) {
    req.flash('error_msg', 'No file was uploaded');
    return res.redirect('/interviews/import');
  }
  
  try {
    // Get the uploaded file
    const interviewsFile = req.files.interviewsFile;
    const uploadPath = path.join(__dirname, '../uploads', interviewsFile.name);
    
    // Ensure uploads directory exists
    if (!fs.existsSync(path.join(__dirname, '../uploads'))) {
      fs.mkdirSync(path.join(__dirname, '../uploads'), { recursive: true });
    }
    
    // Save the file
    await interviewsFile.mv(uploadPath);
    
    // Process the Excel file with date parsing enabled
    const workbook = XLSX.readFile(uploadPath, { cellDates: true });
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    
    // Parse the data with date handling
    const rawData = XLSX.utils.sheet_to_json(worksheet, { 
      raw: false,
      dateNF: 'yyyy-mm-dd hh:mm',
      cellDates: true
    });
    
    // Validate required fields
    if (rawData.length === 0) {
      req.flash('error_msg', 'The uploaded file contains no data');
      return res.redirect('/interviews/import');
    }
    
    // Get database connection
    const pool = await poolPromise;
    
    // Process each row and create interview records
    const errors = [];
    let importedCount = 0;
    
    // Start a transaction
    const transaction = new sql.Transaction(pool);
    await transaction.begin();
    
    try {
      for (let index = 0; index < rawData.length; index++) {
        const row = rawData[index];
        
        try {
          // Find column names (case-insensitive)
          const findColumn = (pattern) => {
            const keys = Object.keys(row);
            return keys.find(k => k.toLowerCase().replace(/\s+/g, '') === pattern.toLowerCase().replace(/\s+/g, ''));
          };
          
          const candidateCol = findColumn('CandidateName');
          const companyCol = findColumn('Company');
          const positionCol = findColumn('Position');
          const typeCol = findColumn('Type');
          const startTimeCol = findColumn('StartTime');
          const endTimeCol = findColumn('EndTime');
          const statusCol = findColumn('Status');
          const recruiterCol = findColumn('Recruiter');
          const locationCol = findColumn('Location');
          const notesCol = findColumn('Notes');
          
          // Check required columns
          if (!candidateCol || !companyCol || !positionCol || !typeCol || !startTimeCol || !endTimeCol) {
            throw new Error(`Missing required columns. Row ${index + 2} could not be processed.`);
          }
          
          // Validate type
          const type = String(row[typeCol]).trim();
          if (type !== 'Light Industrial' && type !== 'Professional') {
            throw new Error(`Invalid Type at row ${index + 2}. Must be 'Light Industrial' or 'Professional'.`);
          }
          
          // Parse dates
          const startTime = parseDateTime(row[startTimeCol]);
          const endTime = parseDateTime(row[endTimeCol]);
          
          if (!startTime) {
            throw new Error(`Invalid Start Time at row ${index + 2}. Value: ${row[startTimeCol]}`);
          }
          
          if (!endTime) {
            throw new Error(`Invalid End Time at row ${index + 2}. Value: ${row[endTimeCol]}`);
          }
          
          if (endTime <= startTime) {
            throw new Error(`End Time must be after Start Time at row ${index + 2}.`);
          }
          
          // Validate status if provided
          let status = 'Scheduled'; // Default
          if (statusCol && row[statusCol]) {
            status = String(row[statusCol]).trim();
            const validStatuses = ['Scheduled', 'Completed', 'Cancelled', 'No Show', 'Rescheduled'];
            if (!validStatuses.includes(status)) {
              throw new Error(`Invalid Status at row ${index + 2}. Must be one of: ${validStatuses.join(', ')}.`);
            }
          }
          
          // Insert interview into database
          const request = transaction.request();
          request.input('candidate', sql.NVarChar, String(row[candidateCol]).trim());
          request.input('company', sql.NVarChar, String(row[companyCol]).trim());
          request.input('position', sql.NVarChar, String(row[positionCol]).trim());
          request.input('type', sql.NVarChar, type);
          request.input('startTime', sql.DateTime2, startTime);
          request.input('endTime', sql.DateTime2, endTime);
          request.input('status', sql.NVarChar, status);
          request.input('recruiter', sql.NVarChar, recruiterCol && row[recruiterCol] ? String(row[recruiterCol]).trim() : '');
          request.input('location', sql.NVarChar, locationCol && row[locationCol] ? String(row[locationCol]).trim() : 'Virtual');
          request.input('notes', sql.NVarChar, notesCol && row[notesCol] ? String(row[notesCol]).trim() : '');
          request.input('createdBy', sql.Int, req.session.user.id);
          
          await request.query(`
            INSERT INTO Interviews (
              candidate, company, position, type, startTime, endTime, 
              status, recruiter, location, notes, createdBy, 
              createdAt, updatedAt
            )
            VALUES (
              @candidate, @company, @position, @type, @startTime, @endTime, 
              @status, @recruiter, @location, @notes, @createdBy, 
              GETDATE(), GETDATE()
            )
          `);
          
          importedCount++;
        } catch (rowError) {
          errors.push(rowError.message);
        }
      }
      
      // Commit the transaction
      await transaction.commit();
      
      // Cleanup the uploaded file after processing
      try {
        fs.unlinkSync(uploadPath);
      } catch (err) {
        console.error('Error deleting temporary file:', err);
      }
      
      if (errors.length > 0) {
        req.flash('error_msg', `Imported ${importedCount} interviews with ${errors.length} errors: ${errors.join('; ')}`);
      } else {
        req.flash('success_msg', `${importedCount} interviews imported successfully`);
      }
      
      res.redirect('/interviews');
    } catch (transactionError) {
      // If an error occurs, roll back the transaction
      await transaction.rollback();
      throw transactionError;
    }
  } catch (error) {
    console.error('Error importing interviews:', error);
    req.flash('error_msg', `Error processing file: ${error.message}`);
    res.redirect('/interviews/import');
  }
};

// Export interviews
exports.exportInterviews = async (req, res) => {
  try {
    // Build search query similar to getInterviews
    const searchQuery = {
      candidate: req.query.candidate,
      company: req.query.company,
      position: req.query.position,
      status: req.query.status,
      type: req.query.type,
      startDate: req.query.startDate,
      endDate: req.query.endDate
    };
    
    // Get database connection
    const pool = await poolPromise;
    
    // Build the SQL query with filters
    let query = 'SELECT * FROM Interviews WHERE 1=1';
    const queryParams = [];
    
    if (searchQuery.candidate) {
      query += ' AND candidate LIKE @candidate';
      queryParams.push({ name: 'candidate', value: `%${searchQuery.candidate}%`, type: sql.NVarChar });
    }
    
    if (searchQuery.company) {
      query += ' AND company LIKE @company';
      queryParams.push({ name: 'company', value: `%${searchQuery.company}%`, type: sql.NVarChar });
    }
    
    if (searchQuery.position) {
      query += ' AND position LIKE @position';
      queryParams.push({ name: 'position', value: `%${searchQuery.position}%`, type: sql.NVarChar });
    }
    
    if (searchQuery.status) {
      query += ' AND status = @status';
      queryParams.push({ name: 'status', value: searchQuery.status, type: sql.NVarChar });
    }
    
    if (searchQuery.type) {
      query += ' AND type = @type';
      queryParams.push({ name: 'type', value: searchQuery.type, type: sql.NVarChar });
    }
    
    // Date filtering
    if (searchQuery.startDate) {
      query += ' AND startTime >= @startDate';
      queryParams.push({ name: 'startDate', value: new Date(searchQuery.startDate), type: sql.DateTime2 });
    }
    
    if (searchQuery.endDate) {
      // Set to end of day for the end date
      const endDate = new Date(searchQuery.endDate);
      endDate.setHours(23, 59, 59, 999);
      
      query += ' AND startTime <= @endDate';
      queryParams.push({ name: 'endDate', value: endDate, type: sql.DateTime2 });
    }
    
    // Add sorting
    query += ' ORDER BY startTime ASC';
    
    // Execute query
    const request = pool.request();
    queryParams.forEach(param => {
      request.input(param.name, param.type, param.value);
    });
    
    const result = await request.query(query);
    const interviews = result.recordset;
    
    // Create workbook
    const workbook = XLSX.utils.book_new();
    
    // Convert data to worksheet - format dates nicely
    const worksheet = XLSX.utils.json_to_sheet(interviews.map(interview => ({
      'Candidate Name': interview.candidate,
      'Company': interview.company,
      'Position': interview.position,
      'Type': interview.type,
      'Start Time': moment(interview.startTime).format('YYYY-MM-DD HH:mm'),
      'End Time': moment(interview.endTime).format('YYYY-MM-DD HH:mm'),
      'Status': interview.status,
      'Recruiter': interview.recruiter || '',
      'Location': interview.location || 'Virtual',
      'Notes': interview.notes || '',
      'Created At': moment(interview.createdAt).format('YYYY-MM-DD HH:mm')
    })));
    
    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Interviews');
    
    // Create buffer
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    
    // Set headers
    res.setHeader('Content-Disposition', 'attachment; filename=interviews_export.xlsx');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    
    // Send file
    res.send(buffer);
  } catch (error) {
    console.error('Error exporting interviews:', error);
    req.flash('error_msg', 'An error occurred while exporting interviews data');
    res.redirect('/interviews');
  }
};