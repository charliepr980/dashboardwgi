// controllers/relocationController.js
const { poolPromise, sql } = require('../utils/db');

// Relocation Management - Main listing page
// Fix for the getRelocations function in relocationController.js
exports.getRelocations = async (req, res) => {
  try {
    // Pagination
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    
    // Build search query
    const searchQuery = {
      resourceName: req.query.resourceName,
      jobTitle: req.query.jobTitle,
      client: req.query.client,
      status: req.query.status,
      relocate: req.query.relocate
    };
    
    // Get database connection
    const pool = await poolPromise;
    
    // Build the query
    let query = 'SELECT * FROM Relocations WHERE 1=1';
    const queryParams = [];
    
    if (searchQuery.resourceName) {
      query += ' AND resourceName LIKE @resourceName';
      queryParams.push({ name: 'resourceName', value: `%${searchQuery.resourceName}%`, type: sql.NVarChar });
    }
    
    if (searchQuery.jobTitle) {
      query += ' AND jobTitle LIKE @jobTitle';
      queryParams.push({ name: 'jobTitle', value: `%${searchQuery.jobTitle}%`, type: sql.NVarChar });
    }
    
    if (searchQuery.client) {
      query += ' AND client LIKE @client';
      queryParams.push({ name: 'client', value: `%${searchQuery.client}%`, type: sql.NVarChar });
    }
    
    if (searchQuery.status) {
      query += ' AND status = @status';
      queryParams.push({ name: 'status', value: searchQuery.status, type: sql.NVarChar });
    }
    
    if (searchQuery.relocate) {
      query += ' AND relocate = @relocate';
      queryParams.push({ name: 'relocate', value: searchQuery.relocate, type: sql.NVarChar });
    }
    
    // Get count for pagination - Run this as a separate query to avoid grouping issues
    const countQuery = 'SELECT COUNT(*) AS count FROM Relocations WHERE 1=1';
    
    // Add filters to count query
    let countQueryWithFilters = countQuery;
    if (searchQuery.resourceName) {
      countQueryWithFilters += ' AND resourceName LIKE @resourceName';
    }
    if (searchQuery.jobTitle) {
      countQueryWithFilters += ' AND jobTitle LIKE @jobTitle';
    }
    if (searchQuery.client) {
      countQueryWithFilters += ' AND client LIKE @client';
    }
    if (searchQuery.status) {
      countQueryWithFilters += ' AND status = @status';
    }
    if (searchQuery.relocate) {
      countQueryWithFilters += ' AND relocate = @relocate';
    }
    
    // Execute count query
    const countRequest = pool.request();
    queryParams.forEach(param => {
      countRequest.input(param.name, param.type, param.value);
    });
    
    const countResult = await countRequest.query(countQueryWithFilters);
    const totalRecords = countResult.recordset[0].count;
    const totalPages = Math.ceil(totalRecords / limit);
    
    // Add sorting and pagination to main query
    query += ' ORDER BY resourceName';
    query += ' OFFSET @skip ROWS FETCH NEXT @limit ROWS ONLY';
    queryParams.push({ name: 'skip', value: skip, type: sql.Int });
    queryParams.push({ name: 'limit', value: limit, type: sql.Int });
    
    // Execute main query
    const request = pool.request();
    queryParams.forEach(param => {
      request.input(param.name, param.type, param.value);
    });
    
    const result = await request.query(query);
    const relocations = result.recordset;
    
    // Get statistics
    const statsQuery = `
      SELECT 
        COUNT(*) AS totalRelocations,
        SUM(CASE WHEN status = 'Relocated Successfully' THEN 1 ELSE 0 END) AS successfulRelocations,
        SUM(CASE WHEN status = 'Active Worker' THEN 1 ELSE 0 END) AS activeWorkers,
        SUM(CASE WHEN status = 'Finished' THEN 1 ELSE 0 END) AS finishedWorkers
      FROM Relocations
    `;
    
    const statsResult = await pool.request().query(statsQuery);
    const stats = statsResult.recordset[0];
    
    // Get upcoming finishing workers
    const today = new Date();
    const ninetyDaysFromNow = new Date(today);
    ninetyDaysFromNow.setDate(today.getDate() + 90);
    
    const upcomingQuery = `
      SELECT * FROM Relocations
      WHERE status = 'Active Worker'
        AND estimatedEndDate >= @today
        AND estimatedEndDate <= @ninetyDaysFromNow
      ORDER BY estimatedEndDate
    `;
    
    const upcomingResult = await pool.request()
      .input('today', sql.DateTime2, today)
      .input('ninetyDaysFromNow', sql.DateTime2, ninetyDaysFromNow)
      .query(upcomingQuery);
    
    // Calculate days remaining for each upcoming worker
    const upcomingFinishing = upcomingResult.recordset.map(r => {
      const endDate = new Date(r.estimatedEndDate);
      const timeDiff = endDate.getTime() - today.getTime();
      const daysRemaining = Math.ceil(timeDiff / (1000 * 3600 * 24));
      
      return {
        ...r,
        daysRemaining
      };
    }).sort((a, b) => a.daysRemaining - b.daysRemaining);
    
    // Prepare status options for the search form
    const statusOptions = [
      'Active Worker',
      'Finished',
      'Found a Job',
      'Relocated Successfully'
    ];
    
    res.render('relocations/index', {
      title: 'Relocation Management',
      relocations,
      currentPage: page,
      totalPages,
      limit,
      searchQuery,
      stats,
      upcomingFinishing,
      statusOptions,
      user: req.session.user
    });
  } catch (error) {
    console.error('Error fetching relocations:', error);
    req.flash('error_msg', 'An error occurred while fetching relocation data');
    res.redirect('/dashboard');
  }
};

// View single relocation with notes
exports.getRelocation = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Get database connection
    const pool = await poolPromise;
    
    // Get relocation record
    const relocationResult = await pool.request()
      .input('id', sql.Int, id)
      .query('SELECT * FROM Relocations WHERE id = @id');
    
    if (relocationResult.recordset.length === 0) {
      req.flash('error_msg', 'Relocation record not found');
      return res.redirect('/relocations');
    }
    
    const relocation = relocationResult.recordset[0];
    
    // Get notes for this relocation
    const notesResult = await pool.request()
      .input('relocationId', sql.Int, id)
      .query(`
        SELECT n.*, u.name as createdByName
        FROM RelocationNotes n
        LEFT JOIN Users u ON n.createdBy = u.id
        WHERE n.relocationId = @relocationId
        ORDER BY n.createdAt DESC
      `);
    
    const notes = notesResult.recordset;
    
    // Prepare status options for the edit form
    const statusOptions = [
      'Active Worker',
      'Finished',
      'Found a Job',
      'Relocated Successfully'
    ];
    
    res.render('relocations/view', {
      title: 'View Relocation',
      relocation,
      notes,
      statusOptions,
      user: req.session.user
    });
  } catch (error) {
    console.error('Error viewing relocation:', error);
    req.flash('error_msg', 'An error occurred while loading the relocation record');
    res.redirect('/relocations');
  }
};

// Edit relocation page
exports.getEditRelocation = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Get database connection
    const pool = await poolPromise;
    
    // Get relocation record
    const relocationResult = await pool.request()
      .input('id', sql.Int, id)
      .query('SELECT * FROM Relocations WHERE id = @id');
    
    if (relocationResult.recordset.length === 0) {
      req.flash('error_msg', 'Relocation record not found');
      return res.redirect('/relocations');
    }
    
    const relocation = relocationResult.recordset[0];
    
    // Prepare status options for the edit form
    const statusOptions = [
      'Active Worker',
      'Finished',
      'Found a Job',
      'Relocated Successfully'
    ];
    
    res.render('relocations/edit', {
      title: 'Edit Relocation',
      relocation,
      statusOptions,
      user: req.session.user
    });
  } catch (error) {
    console.error('Error editing relocation:', error);
    req.flash('error_msg', 'An error occurred while loading the relocation record');
    res.redirect('/relocations');
  }
};

// Process edit relocation
exports.updateRelocation = async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      resourceName, 
      lastKnownInformation, 
      relocate, 
      jobTitle, 
      estimatedEndDate, 
      client, 
      status 
    } = req.body;
    
    // Get database connection
    const pool = await poolPromise;
    
    // Update relocation
    await pool.request()
      .input('id', sql.Int, id)
      .input('resourceName', sql.NVarChar, resourceName)
      .input('lastKnownInformation', sql.NVarChar, lastKnownInformation || '')
      .input('relocate', sql.NVarChar, relocate)
      .input('jobTitle', sql.NVarChar, jobTitle)
      .input('estimatedEndDate', sql.DateTime2, new Date(estimatedEndDate))
      .input('client', sql.NVarChar, client)
      .input('status', sql.NVarChar, status)
      .query(`
        UPDATE Relocations
        SET resourceName = @resourceName,
            lastKnownInformation = @lastKnownInformation,
            relocate = @relocate,
            jobTitle = @jobTitle,
            estimatedEndDate = @estimatedEndDate,
            client = @client,
            status = @status,
            updatedAt = GETDATE()
        WHERE id = @id
      `);
    
    req.flash('success_msg', 'Relocation updated successfully');
    res.redirect(`/relocations/view/${id}`);
  } catch (error) {
    console.error('Error updating relocation:', error);
    req.flash('error_msg', 'An error occurred while updating the relocation record');
    res.redirect('/relocations');
  }
};

// Add note to relocation
exports.addNote = async (req, res) => {
  try {
    const { id } = req.params;
    const { note } = req.body;
    
    // Get database connection
    const pool = await poolPromise;
    
    // Validate relocation exists
    const relocationResult = await pool.request()
      .input('id', sql.Int, id)
      .query('SELECT * FROM Relocations WHERE id = @id');
    
    if (relocationResult.recordset.length === 0) {
      req.flash('error_msg', 'Relocation record not found');
      return res.redirect('/relocations');
    }
    
    // Create new note
    await pool.request()
      .input('relocationId', sql.Int, id)
      .input('note', sql.NVarChar, note)
      .input('createdBy', sql.Int, req.session.user.id)
      .query(`
        INSERT INTO RelocationNotes (relocationId, note, createdBy, createdAt)
        VALUES (@relocationId, @note, @createdBy, GETDATE())
      `);
    
    req.flash('success_msg', 'Note added successfully');
    res.redirect(`/relocations/view/${id}`);
  } catch (error) {
    console.error('Error adding note:', error);
    req.flash('error_msg', 'An error occurred while adding the note');
    res.redirect('/relocations');
  }
};

// Export relocations
exports.exportRelocations = async (req, res) => {
  try {
    const XLSX = require('xlsx');
    
    // Get database connection
    const pool = await poolPromise;
    
    // Get all relocations
    const result = await pool.request().query('SELECT * FROM Relocations');
    const relocations = result.recordset;
    
    // Format dates as YYYY-MM-DD to ensure consistent format for Excel
    const formatDate = (date) => {
      if (!date) return '';
      const d = new Date(date);
      if (isNaN(d.getTime())) return '';
      
      return d.toISOString().split('T')[0]; // YYYY-MM-DD format
    };
    
    // Prepare data for export
    const exportData = relocations.map(relocation => ({
      'Resource Name': relocation.resourceName,
      'Last Known Information': relocation.lastKnownInformation,
      'Relocate?': relocation.relocate,
      'Job Title': relocation.jobTitle,
      'Estimated End Date': formatDate(relocation.estimatedEndDate),
      'Client': relocation.client,
      'Status': relocation.status,
      'Created At': formatDate(relocation.createdAt),
      'Updated At': formatDate(relocation.updatedAt)
    }));
    
    // Create workbook
    const workbook = XLSX.utils.book_new();
    
    // Convert data to worksheet
    const worksheet = XLSX.utils.json_to_sheet(exportData);
    
    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Relocations');
    
    // Create buffer
    const buffer = XLSX.write(workbook, { 
      type: 'buffer', 
      bookType: 'xlsx',
      cellDates: true,
      dateNF: 'yyyy-mm-dd'
    });
    
    // Set headers
    res.setHeader('Content-Disposition', 'attachment; filename=relocations.xlsx');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    
    // Send file
    res.send(buffer);
  } catch (error) {
    console.error('Error exporting relocations:', error);
    req.flash('error_msg', 'An error occurred while exporting data');
    res.redirect('/relocations');
  }
};

// Relocation Import page
exports.getImportRelocations = async (req, res) => {
  try {
    res.render('relocations/import', {
      title: 'Relocation Import',
      user: req.session.user
    });
  } catch (error) {
    console.error('Error loading import page:', error);
    req.flash('error_msg', 'An error occurred while loading the page');
    res.redirect('/relocations');
  }
};

// Create relocation page
exports.getCreateRelocation = async (req, res) => {
  try {
    // Prepare status options for the create form
    const statusOptions = [
      'Active Worker',
      'Finished',
      'Found a Job',
      'Relocated Successfully'
    ];
    
    res.render('relocations/create', {
      title: 'Create New Relocation',
      statusOptions,
      user: req.session.user
    });
  } catch (error) {
    console.error('Error loading create relocation page:', error);
    req.flash('error_msg', 'An error occurred while loading the page');
    res.redirect('/relocations');
  }
};

// Process create relocation
exports.createRelocation = async (req, res) => {
  try {
    const { 
      resourceName, 
      lastKnownInformation, 
      relocate, 
      jobTitle, 
      estimatedEndDate, 
      client, 
      status 
    } = req.body;
    
    // Get database connection
    const pool = await poolPromise;
    
    // Insert new relocation
    const result = await pool.request()
      .input('resourceName', sql.NVarChar, resourceName)
      .input('lastKnownInformation', sql.NVarChar, lastKnownInformation || '')
      .input('relocate', sql.NVarChar, relocate)
      .input('jobTitle', sql.NVarChar, jobTitle)
      .input('estimatedEndDate', sql.DateTime2, new Date(estimatedEndDate))
      .input('client', sql.NVarChar, client)
      .input('status', sql.NVarChar, status)
      .query(`
        INSERT INTO Relocations (resourceName, lastKnownInformation, relocate, jobTitle, estimatedEndDate, client, status, createdAt, updatedAt)
        OUTPUT INSERTED.id
        VALUES (@resourceName, @lastKnownInformation, @relocate, @jobTitle, @estimatedEndDate, @client, @status, GETDATE(), GETDATE())
      `);
    
    const newRelocationId = result.recordset[0].id;
    
    req.flash('success_msg', 'Relocation created successfully');
    res.redirect(`/relocations/view/${newRelocationId}`);
  } catch (error) {
    console.error('Error creating relocation:', error);
    req.flash('error_msg', 'An error occurred while creating the relocation');
    res.redirect('/relocations/create');
  }
};

// Process relocation import
exports.importRelocations = async (req, res) => {
  try {
    if (!req.files || Object.keys(req.files).length === 0) {
      req.flash('error_msg', 'No file was uploaded');
      return res.redirect('/relocations/import');
    }
    
    const XLSX = require('xlsx');
    const fs = require('fs');
    const path = require('path');
    
    // Get database connection
    const pool = await poolPromise;
    
    // Get the uploaded file
    const relocationFile = req.files.relocationFile;
    const uploadPath = path.join(__dirname, '..', 'uploads', relocationFile.name);
    
    // Save the file
    await new Promise((resolve, reject) => {
      relocationFile.mv(uploadPath, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
    
    try {
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
        return res.redirect('/relocations/import');
      }
      
      // Process each row and create relocation records
      const errors = [];
      
      // Start a transaction
      const transaction = new sql.Transaction(pool);
      await transaction.begin();
      
      try {
        for (let index = 0; index < rawData.length; index++) {
          const row = rawData[index];
          
          // Map column names (allowing for different case and spacing)
          const findColumn = (pattern) => {
            return Object.keys(row).find(key => 
              key && key.toLowerCase().replace(/\s+/g, '') === pattern.toLowerCase().replace(/\s+/g, '')
            );
          };
          
          const resourceNameCol = findColumn('resourcename') || findColumn('name');
          const lastKnownInfoCol = findColumn('lastknowninformation') || findColumn('lastknowninfo');
          const relocateCol = findColumn('relocate') || findColumn('relocate?');
          const jobTitleCol = findColumn('jobtitle') || findColumn('title');
          const estimatedEndDateCol = findColumn('estimatedenddate') || findColumn('enddate');
          const clientCol = findColumn('client');
          const statusCol = findColumn('status') || findColumn('statusasoftoday');
          
          // Check required fields
          if (!resourceNameCol) {
            errors.push(`Missing Resource Name column at row ${index + 2}`);
            continue;
          }
          
          // Validate status
          const validStatuses = ['Active Worker', 'Finished', 'Found a Job', 'Relocated Successfully'];
          let status = row[statusCol] ? String(row[statusCol]).trim() : 'Active Worker';
          
          if (!validStatuses.includes(status)) {
            status = 'Active Worker'; // Default to Active Worker if invalid
          }
          
          // Parse dates
          let estimatedEndDate = null;
          if (row[estimatedEndDateCol]) {
            if (row[estimatedEndDateCol] instanceof Date) {
              estimatedEndDate = row[estimatedEndDateCol];
            } else {
              // Try to parse date string
              estimatedEndDate = new Date(row[estimatedEndDateCol]);
              if (isNaN(estimatedEndDate.getTime())) {
                estimatedEndDate = null;
              }
            }
          }
          
          // Insert relocation record
          await transaction.request()
            .input('resourceName', sql.NVarChar, String(row[resourceNameCol] || '').trim())
            .input('lastKnownInformation', sql.NVarChar, String(row[lastKnownInfoCol] || '').trim())
            .input('relocate', sql.NVarChar, (row[relocateCol] || 'No').toString().trim() === 'Yes' ? 'Yes' : 'No')
            .input('jobTitle', sql.NVarChar, String(row[jobTitleCol] || '').trim())
            .input('estimatedEndDate', sql.DateTime2, estimatedEndDate || new Date())
            .input('client', sql.NVarChar, String(row[clientCol] || '').trim())
            .input('status', sql.NVarChar, status)
            .query(`
              INSERT INTO Relocations (resourceName, lastKnownInformation, relocate, jobTitle, estimatedEndDate, client, status, createdAt, updatedAt)
              VALUES (@resourceName, @lastKnownInformation, @relocate, @jobTitle, @estimatedEndDate, @client, @status, GETDATE(), GETDATE())
            `);
        }
        
        // Commit the transaction
        await transaction.commit();
        
        // Check if there were any errors
        if (errors.length > 0) {
          req.flash('error_msg', `Warnings found: ${errors.join(', ')}. Some records may have been imported.`);
        } else {
          req.flash('success_msg', `${rawData.length} relocation records imported successfully`);
        }
        
        // Cleanup the uploaded file after processing
        fs.unlinkSync(uploadPath);
        
        res.redirect('/relocations');
      } catch (error) {
        // If an error occurs, roll back the transaction
        await transaction.rollback();
        throw error;
      }
    } catch (error) {
      console.error("Error processing Excel file:", error);
      req.flash('error_msg', `Error processing Excel file: ${error.message}`);
      return res.redirect('/relocations/import');
    }
  } catch (error) {
    console.error('Error importing relocations:', error);
    req.flash('error_msg', `Error importing relocations: ${error.message}`);
    res.redirect('/relocations/import');
  }
};