const { poolPromise, sql } = require('../utils/db');
const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');

// Helper function to determine the status category
const getStatusCategory = (status, rejectionReason = '') => {
  if (!status) return 'Other';
  
  const statusLower = status.toLowerCase().trim();
  const rejectionReasonLower = (rejectionReason || '').toLowerCase().trim();
  
  // 1. Selected: Work Order Accepted, Offer Pending, Onboarded Pending, Onboarding, Work Order Confirmed, Selected
  if (
    statusLower.includes('work order accepted') ||
    statusLower.includes('offer pending') ||
    statusLower.includes('onboarded pending') ||
    statusLower.includes('onboarding') ||
    statusLower.includes('work order confirmed') ||
    statusLower.includes('selected')
  ) {
    return 'Selected';
  }
  
  // 2. Shortlisted: Shortlisted, Qualified
  if (
    statusLower.includes('shortlisted') ||
    statusLower.includes('qualified')
  ) {
    return 'Shortlisted';
  }
  
  // 3. Interview: Interview Scheduled, Interview Rejected, Interview Completed, Interview Confirmed
  if (
    statusLower.includes('interview')
  ) {
    return 'Interview';
  }
  
  // 4. Neutral: Rejected status with "neutral" in rejection reason
  if (
    (statusLower.includes('rejected') || statusLower.includes('disqualified')) &&
    rejectionReasonLower.includes('neutral')
  ) {
    return 'Neutral';
  }
  
  // 5. Rejected: Rejected, Disqualified (without neutral in rejection reason)
  if (
    statusLower.includes('rejected') || 
    statusLower.includes('disqualified')
  ) {
    return 'Rejected';
  }
  
  // Default for any other status
  return 'Other';
};

// Candidate tracking page
exports.getCandidates = async (req, res) => {
  try {
    // Pagination
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    
    // Validate date parameters to prevent invalid date errors
    if (req.query.startDate && isNaN(new Date(req.query.startDate).getTime())) {
      delete req.query.startDate;
    }
    if (req.query.endDate && isNaN(new Date(req.query.endDate).getTime())) {
      delete req.query.endDate;
    }
    
    // Build search query
    const searchQuery = {
      company: req.query.company,
      jobPostingId: req.query.jobPostingId,
      jobTitle: req.query.jobTitle,
      candidateName: req.query.candidateName,
      submittedBy: req.query.submittedBy,
      status: req.query.status,
      startDate: req.query.startDate,
      endDate: req.query.endDate
    };
    
    // Rest of the function...
    
    // Get database connection
    const pool = await poolPromise;
    
    // Build the SQL query with filters
    let query = 'SELECT * FROM Candidates WHERE 1=1';
    const queryParams = [];
    
    if (searchQuery.company) {
      query += ' AND company LIKE @company';
      queryParams.push({ name: 'company', value: `%${searchQuery.company}%`, type: sql.NVarChar });
    }
    
    if (searchQuery.jobPostingId) {
      query += ' AND jobPostingId LIKE @jobPostingId';
      queryParams.push({ name: 'jobPostingId', value: `%${searchQuery.jobPostingId}%`, type: sql.NVarChar });
    }
    
    if (searchQuery.jobTitle) {
      query += ' AND jobTitle LIKE @jobTitle';
      queryParams.push({ name: 'jobTitle', value: `%${searchQuery.jobTitle}%`, type: sql.NVarChar });
    }
    
    if (searchQuery.candidateName) {
      query += ' AND candidateName LIKE @candidateName';
      queryParams.push({ name: 'candidateName', value: `%${searchQuery.candidateName}%`, type: sql.NVarChar });
    }
    
    if (searchQuery.submittedBy) {
      query += ' AND submittedBy LIKE @submittedBy';
      queryParams.push({ name: 'submittedBy', value: `%${searchQuery.submittedBy}%`, type: sql.NVarChar });
    }
    
    // Date filtering
    if (searchQuery.startDate) {
      query += ' AND submitDate >= @startDate';
      queryParams.push({ name: 'startDate', value: new Date(searchQuery.startDate), type: sql.DateTime2 });
    }
    
    if (searchQuery.endDate) {
      // Set to end of day for the end date
      const endDate = new Date(searchQuery.endDate);
      endDate.setHours(23, 59, 59, 999);
      
      query += ' AND submitDate <= @endDate';
      queryParams.push({ name: 'endDate', value: endDate, type: sql.DateTime2 });
    }
    
    // Get all candidates (without pagination) for status categories and filters
    const allCandidatesQuery = 'SELECT * FROM Candidates';
    const allCandidatesResult = await pool.request().query(allCandidatesQuery);
    const allCandidates = allCandidatesResult.recordset;
    
    // Status filtering is tricky because it's derived
    let filteredCandidateIds = [];
    if (searchQuery.status) {
      // Find all candidates whose status category matches the filter
      filteredCandidateIds = allCandidates
        .filter(candidate => getStatusCategory(candidate.status, candidate.rejectionReason) === searchQuery.status)
        .map(candidate => candidate.id);
      
      if (filteredCandidateIds.length > 0) {
        query += ' AND id IN (' + filteredCandidateIds.join(',') + ')';
      } else {
        // If no matches, return empty result
        query += ' AND 1=0';
      }
    }
    
    // Get total count for pagination
    let countQuery = 'SELECT COUNT(*) AS count FROM (' + query + ') AS filteredResults';
    
    // Execute count query
    const countRequest = pool.request();
    queryParams.forEach(param => {
      countRequest.input(param.name, param.type, param.value);
    });
    
    const countResult = await countRequest.query(countQuery);
    const totalRecords = countResult.recordset[0].count;
    const totalPages = Math.ceil(totalRecords / limit);
    
    // Add sorting and pagination
    query += ' ORDER BY submitDate DESC';
    query += ' OFFSET @skip ROWS FETCH NEXT @limit ROWS ONLY';
    queryParams.push({ name: 'skip', value: skip, type: sql.Int });
    queryParams.push({ name: 'limit', value: limit, type: sql.Int });
    
    // Execute main query
    const request = pool.request();
    queryParams.forEach(param => {
      request.input(param.name, param.type, param.value);
    });
    
    const result = await request.query(query);
    const candidates = result.recordset.map(candidate => ({
  ...candidate,
  getStatusCategory: () => getStatusCategory(candidate.status, candidate.rejectionReason)
}));
    
    // Calculate status counts for summary
    const statusCounts = {
     total: allCandidates.length,
  selected: allCandidates.filter(c => getStatusCategory(c.status, c.rejectionReason) === 'Selected').length,
  rejected: allCandidates.filter(c => getStatusCategory(c.status, c.rejectionReason) === 'Rejected').length,
  neutral: allCandidates.filter(c => getStatusCategory(c.status, c.rejectionReason) === 'Neutral').length,
  interview: allCandidates.filter(c => getStatusCategory(c.status, c.rejectionReason) === 'Interview').length,
  shortlisted: allCandidates.filter(c => getStatusCategory(c.status, c.rejectionReason) === 'Shortlisted').length,
  other: allCandidates.filter(c => getStatusCategory(c.status, c.rejectionReason) === 'Other').length
};
    
    // Get unique job titles for filtering dropdown
    const uniqueJobTitles = [...new Set(allCandidates.map(c => c.jobTitle))].filter(Boolean).sort();
    
    // Get unique companies for filtering dropdown
    const uniqueCompanies = [...new Set(allCandidates.map(c => c.company))].filter(Boolean).sort();
    
    // Get unique submitters for filtering dropdown
    const uniqueSubmitters = [...new Set(allCandidates.map(c => c.submittedBy))].filter(Boolean).sort();
    
    res.render('candidates/index', {
      title: 'Candidate Tracking',
      candidates,
      currentPage: page,
      totalPages,
      limit,
      searchQuery,
      statusCounts,
      uniqueJobTitles,
      uniqueCompanies,
      uniqueSubmitters,
      user: req.session.user
    });
  } catch (error) {
    console.error('Error loading candidates:', error);
    req.flash('error_msg', 'An error occurred while loading candidate data');
    res.redirect('/dashboard');
  }
};

// Import candidates page
exports.getImportCandidates = (req, res) => {
  res.render('candidates/import', {
    title: 'Import Candidates',
    user: req.session.user
  });
};

// Process candidates import
exports.postImportCandidates = async (req, res) => {
  if (!req.files || Object.keys(req.files).length === 0) {
    req.flash('error_msg', 'No file was uploaded');
    return res.redirect('/candidates/import');
  }
  
  try {
    // Get the uploaded file
    const candidatesFile = req.files.candidatesFile;
    const uploadPath = path.join(__dirname, '../uploads', candidatesFile.name);
    
    // Ensure uploads directory exists
    if (!fs.existsSync(path.join(__dirname, '../uploads'))) {
      fs.mkdirSync(path.join(__dirname, '../uploads'), { recursive: true });
    }
    
    // Save the file
    await candidatesFile.mv(uploadPath);
    
    // Process the Excel file with date parsing enabled
    const workbook = XLSX.readFile(uploadPath, { cellDates: true });
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    
    // Parse the data with date handling
    const rawData = XLSX.utils.sheet_to_json(worksheet, { 
      raw: false,
      dateNF: 'yyyy-mm-dd',
      cellDates: true
    });
    
    // Validate required fields
    if (rawData.length === 0) {
      req.flash('error_msg', 'The uploaded file contains no data');
      return res.redirect('/candidates/import');
    }
    
    // Get the first row to extract column headers
    const firstRow = rawData[0];
    const headers = Object.keys(firstRow);
    
    // Function to find headers by pattern
    const findHeader = (pattern) => {
      return headers.find(h => h && h.toLowerCase().replace(/\s+/g, '') === pattern.toLowerCase().replace(/\s+/g, ''));
    };
    
    // Try to map column names from the file - find the closest match to expected column names
    const companyCol = findHeader('Company') || findHeader('company') || findHeader('employer');
    const jobPostingIdCol = findHeader('Job Posting ID') || findHeader('jobid') || findHeader('requisition') || findHeader('jobpostingid');
    const jobTitleCol = findHeader('Job Title') || findHeader('position') || findHeader('title') || findHeader('jobtitle');
    const candidateNameCol = findHeader('Candidate Name') || findHeader('candidate') || findHeader('applicant') || findHeader('candidatename');
    const submittedByCol = findHeader('Submitted By') || findHeader('recruiter') || findHeader('submitter') || findHeader('submittedby');
    const submitDateCol = findHeader('Submit Date') || findHeader('submission date') || findHeader('date submitted') || findHeader('submitdate') || findHeader('date');
    const statusCol = findHeader('Status') || findHeader('candidate status') || findHeader('application status');
    const rejectionReasonCol = findHeader('Rejection Reason') || findHeader('reject reason') || findHeader('reason') || findHeader('rejectionreason');
    const notesCol = findHeader('Notes') || findHeader('comments') || findHeader('additional information');
    
    // Check essential columns exist
    const essentialColumns = [candidateNameCol, statusCol];
    const missingColumns = essentialColumns.filter(col => !col);
    
    if (missingColumns.length > 0) {
      req.flash('error_msg', `Missing essential columns: Candidate Name and Status must be present in the file.`);
      return res.redirect('/candidates/import');
    }
    
    // Get database connection
    const pool = await poolPromise;
    
    // Process each row and create candidate records
    const errors = [];
    const processedCandidates = new Set(); // To avoid duplicates within the same file
    let importedCount = 0;
    
    // Start a transaction
    const transaction = new sql.Transaction(pool);
    await transaction.begin();
    
    try {
      for (let index = 0; index < rawData.length; index++) {
        const row = rawData[index];
        
        try {
          // Get candidate data with sensible defaults for missing values
          const candidateName = row[candidateNameCol] ? String(row[candidateNameCol]).trim() : '';
          const status = row[statusCol] ? String(row[statusCol]).trim() : '';
          
          // Skip empty rows
          if (!candidateName || !status) {
            continue;
          }
          
          // Create a unique key to avoid duplicates
          const candidateKey = `${candidateName}-${row[companyCol] || ''}-${row[jobTitleCol] || ''}`;
          
          // Skip duplicates within the same file
          if (processedCandidates.has(candidateKey)) {
            continue;
          }
          
          processedCandidates.add(candidateKey);
          
          // Parse and normalize submission date
          let submitDate = new Date();
          if (submitDateCol && row[submitDateCol]) {
            if (row[submitDateCol] instanceof Date) {
              submitDate = row[submitDateCol];
            } else {
              // Try to parse as date
              const parsedDate = new Date(row[submitDateCol]);
              if (!isNaN(parsedDate.getTime())) {
                submitDate = parsedDate;
              }
            }
          }
          
          // Get rejection reason if available
          const rejectionReason = (rejectionReasonCol && row[rejectionReasonCol]) 
            ? String(row[rejectionReasonCol]).trim() 
            : '';
          
          // Insert candidate into database
          const request = transaction.request();
          request.input('company', sql.NVarChar, companyCol && row[companyCol] ? String(row[companyCol]).trim() : '');
          request.input('jobPostingId', sql.NVarChar, jobPostingIdCol && row[jobPostingIdCol] ? String(row[jobPostingIdCol]).trim() : '');
          request.input('jobTitle', sql.NVarChar, jobTitleCol && row[jobTitleCol] ? String(row[jobTitleCol]).trim() : '');
          request.input('candidateName', sql.NVarChar, candidateName);
          request.input('submittedBy', sql.NVarChar, submittedByCol && row[submittedByCol] ? String(row[submittedByCol]).trim() : '');
          request.input('submitDate', sql.DateTime2, submitDate);
          request.input('status', sql.NVarChar, status);
          request.input('rejectionReason', sql.NVarChar, rejectionReason);
          request.input('notes', sql.NVarChar, notesCol && row[notesCol] ? String(row[notesCol]).trim() : '');
          request.input('createdBy', sql.Int, req.session.user.id);
          
          await request.query(`
            INSERT INTO Candidates (
              company, jobPostingId, jobTitle, candidateName, submittedBy,
              submitDate, status, rejectionReason, notes, createdBy,
              createdAt, updatedAt
            )
            VALUES (
              @company, @jobPostingId, @jobTitle, @candidateName, @submittedBy,
              @submitDate, @status, @rejectionReason, @notes, @createdBy,
              GETDATE(), GETDATE()
            )
          `);
          
          importedCount++;
        } catch (rowError) {
          errors.push(`Error processing row ${index + 2}: ${rowError.message}`);
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
        req.flash('error_msg', `Imported ${importedCount} candidates with ${errors.length} errors: ${errors.join('; ')}`);
      } else {
        req.flash('success_msg', `${importedCount} candidates imported successfully`);
      }
      
      res.redirect('/candidates');
    } catch (transactionError) {
      // If an error occurs, roll back the transaction
      await transaction.rollback();
      throw transactionError;
    }
  } catch (error) {
    console.error('Error importing candidates:', error);
    req.flash('error_msg', `Error processing file: ${error.message}`);
    res.redirect('/candidates/import');
  }
};

// Export candidates
exports.exportCandidates = async (req, res) => {
  try {
    // Build search query similar to getCandidates
    const searchQuery = {
      company: req.query.company,
      jobPostingId: req.query.jobPostingId,
      jobTitle: req.query.jobTitle,
      candidateName: req.query.candidateName,
      submittedBy: req.query.submittedBy,
      status: req.query.status,
      startDate: req.query.startDate,
      endDate: req.query.endDate
    };
    
    // Get database connection
    const pool = await poolPromise;
    
    // Build the SQL query with filters
    let query = 'SELECT * FROM Candidates WHERE 1=1';
    const queryParams = [];
    
    if (searchQuery.company) {
      query += ' AND company LIKE @company';
      queryParams.push({ name: 'company', value: `%${searchQuery.company}%`, type: sql.NVarChar });
    }
    
    if (searchQuery.jobPostingId) {
      query += ' AND jobPostingId LIKE @jobPostingId';
      queryParams.push({ name: 'jobPostingId', value: `%${searchQuery.jobPostingId}%`, type: sql.NVarChar });
    }
    
    if (searchQuery.jobTitle) {
      query += ' AND jobTitle LIKE @jobTitle';
      queryParams.push({ name: 'jobTitle', value: `%${searchQuery.jobTitle}%`, type: sql.NVarChar });
    }
    
    if (searchQuery.candidateName) {
      query += ' AND candidateName LIKE @candidateName';
      queryParams.push({ name: 'candidateName', value: `%${searchQuery.candidateName}%`, type: sql.NVarChar });
    }
    
    if (searchQuery.submittedBy) {
      query += ' AND submittedBy LIKE @submittedBy';
      queryParams.push({ name: 'submittedBy', value: `%${searchQuery.submittedBy}%`, type: sql.NVarChar });
    }
    
    // Date filtering
    if (searchQuery.startDate) {
      query += ' AND submitDate >= @startDate';
      queryParams.push({ name: 'startDate', value: new Date(searchQuery.startDate), type: sql.DateTime2 });
    }
    
    if (searchQuery.endDate) {
      // Set to end of day for the end date
      const endDate = new Date(searchQuery.endDate);
      endDate.setHours(23, 59, 59, 999);
      
      query += ' AND submitDate <= @endDate';
      queryParams.push({ name: 'endDate', value: endDate, type: sql.DateTime2 });
    }
    
    // Get all candidates first
    const allCandidatesResult = await pool.request().query('SELECT * FROM Candidates');
    const allCandidates = allCandidatesResult.recordset;
    
    // Status filtering
    let filteredCandidateIds = [];
    if (searchQuery.status) {
      // Find all candidates whose status category matches the filter
      filteredCandidateIds = allCandidates
        .filter(candidate => getStatusCategory(candidate.status, candidate.rejectionReason) === searchQuery.status)
        .map(candidate => candidate.id);
      
      if (filteredCandidateIds.length > 0) {
        query += ' AND id IN (' + filteredCandidateIds.join(',') + ')';
      } else {
        // If no matches, return empty result
        query += ' AND 1=0';
      }
    }
    
    // Add sorting
    query += ' ORDER BY submitDate DESC';
    
    // Execute query
    const request = pool.request();
    queryParams.forEach(param => {
      request.input(param.name, param.type, param.value);
    });
    
    const result = await request.query(query);
    const candidates = result.recordset;
    
    // Create workbook
    const workbook = XLSX.utils.book_new();
    
    // Convert data to worksheet - include both raw status and category
    const worksheet = XLSX.utils.json_to_sheet(candidates.map(candidate => ({
      'Company': candidate.company || '',
      'Job Posting ID': candidate.jobPostingId || '',
      'Job Title': candidate.jobTitle || '',
      'Candidate Name': candidate.candidateName || '',
      'Submitted By': candidate.submittedBy || '',
      'Submit Date': candidate.submitDate ? new Date(candidate.submitDate).toLocaleDateString() : '',
      'Status': candidate.status || '',
      'Status Category': getStatusCategory(candidate.status, candidate.rejectionReason),
      'Rejection Reason': candidate.rejectionReason || '',
      'Notes': candidate.notes || ''
    })));
    
    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Candidates');
    
    // Create buffer
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    
    // Set headers
    res.setHeader('Content-Disposition', 'attachment; filename=candidates_export.xlsx');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    
    // Send file
    res.send(buffer);
  } catch (error) {
    console.error('Error exporting candidates:', error);
    req.flash('error_msg', 'An error occurred while exporting candidates data');
    res.redirect('/candidates');
  }
};

// Clear all candidates (admin only)
exports.clearCandidates = async (req, res) => {
  try {
    // Get database connection
    const pool = await poolPromise;
    
    // Clear all candidates
    await pool.request().query('DELETE FROM Candidates');
    
    req.flash('success_msg', 'All candidate data has been cleared');
    res.redirect('/candidates');
  } catch (error) {
    console.error('Error clearing candidates:', error);
    req.flash('error_msg', 'An error occurred while clearing candidate data');
    res.redirect('/candidates');
  }
};

// Edit candidate page
exports.getEditCandidate = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Get database connection
    const pool = await poolPromise;
    
    // Get candidate record
    const result = await pool.request()
      .input('id', sql.Int, id)
      .query('SELECT * FROM Candidates WHERE id = @id');
    
    if (result.recordset.length === 0) {
      req.flash('error_msg', 'Candidate not found');
      return res.redirect('/candidates');
    }
    
    const candidate = result.recordset[0];
    
    res.render('candidates/edit', {
      title: 'Edit Candidate',
      candidate,
      user: req.session.user
    });
  } catch (error) {
    console.error('Error loading candidate:', error);
    req.flash('error_msg', 'An error occurred while loading the candidate');
    res.redirect('/candidates');
  }
};

// Process edit candidate
exports.putEditCandidate = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, rejectionReason, notes } = req.body;
    
    // Get database connection
    const pool = await poolPromise;
    
    // Update candidate
    await pool.request()
      .input('id', sql.Int, id)
      .input('status', sql.NVarChar, status)
      .input('rejectionReason', sql.NVarChar, rejectionReason || '')
      .input('notes', sql.NVarChar, notes || '')
      .query(`
        UPDATE Candidates
        SET status = @status,
            rejectionReason = @rejectionReason,
            notes = @notes,
            updatedAt = GETDATE()
        WHERE id = @id
      `);
    
    req.flash('success_msg', 'Candidate updated successfully');
    res.redirect('/candidates');
  } catch (error) {
    console.error('Error updating candidate:', error);
    req.flash('error_msg', 'An error occurred while updating the candidate');
    res.redirect('/candidates');
  }
};
// Add this function to candidateController.js
// Mass update candidates
exports.massPutEditCandidates = async (req, res) => {
  try {
    const { selectedCandidates, status, rejectionReason } = req.body;
    
    // Check if candidates were selected
    if (!selectedCandidates || !Array.isArray(selectedCandidates) || selectedCandidates.length === 0) {
      req.flash('error_msg', 'No candidates selected for update');
      return res.redirect('/candidates');
    }
    
    // Check if status was provided
    if (!status) {
      req.flash('error_msg', 'No status selected for update');
      return res.redirect('/candidates');
    }
    
    // Get database connection
    const pool = await poolPromise;
    
    // Start a transaction
    const transaction = new sql.Transaction(pool);
    await transaction.begin();
    
    try {
      // Update each candidate
      for (const candidateId of selectedCandidates) {
        const request = transaction.request();
        request.input('id', sql.Int, candidateId);
        request.input('status', sql.NVarChar, status);
        
        // Handle rejection reason based on status
        let reasonToUse = '';
        
        if (status === 'Rejected (Neutral)') {
          // For "Rejected (Neutral)" status, set the rejection reason to "Neutral"
          reasonToUse = 'Neutral';
          // Update the status to just "Rejected"
          request.input('actualStatus', sql.NVarChar, 'Rejected');
        } else if (status === 'Rejected' || status === 'Disqualified') {
          // For regular Rejected/Disqualified, use the provided rejection reason
          reasonToUse = rejectionReason || '';
          request.input('actualStatus', sql.NVarChar, status);
        } else if (status.startsWith('Neutral -')) {
          // For statuses that start with "Neutral -", set both the status and rejection reason
          reasonToUse = status;
          request.input('actualStatus', sql.NVarChar, 'Rejected');
        } else {
          // For all other statuses, use the status as-is and clear the rejection reason
          request.input('actualStatus', sql.NVarChar, status);
        }
        
        request.input('rejectionReason', sql.NVarChar, reasonToUse);
        
        // Use the appropriate status field in the query
        const statusField = (status === 'Rejected (Neutral)' || status.startsWith('Neutral -')) 
          ? '@actualStatus' 
          : '@status';
        
        await request.query(`
          UPDATE Candidates
          SET status = ${statusField},
              rejectionReason = @rejectionReason,
              updatedAt = GETDATE()
          WHERE id = @id
        `);
      }
      
      // Commit the transaction
      await transaction.commit();
      
      req.flash('success_msg', `${selectedCandidates.length} candidates updated successfully`);
      res.redirect('/candidates');
    } catch (err) {
      // Rollback the transaction if an error occurs
      await transaction.rollback();
      throw err;
    }
  } catch (error) {
    console.error('Error mass updating candidates:', error);
    req.flash('error_msg', `An error occurred while updating candidates: ${error.message}`);
    res.redirect('/candidates');
  }
};