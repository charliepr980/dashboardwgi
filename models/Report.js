// models/Report.js
const { poolPromise, sql } = require('../utils/db');

class Report {
  constructor(data) {
    this.id = data.id;
    this.filename = data.filename;
    this.uploadDate = data.uploadDate;
    this.uploadedBy = data.uploadedBy;
    this.lightIndustrialCount = data.lightIndustrialCount || 0;
    this.professionalCount = data.professionalCount || 0;
    this.submissionsCount = data.submissionsCount || 0;
    this.lightIndustrialSubmissionsCount = data.lightIndustrialSubmissionsCount || 0;
    this.professionalSubmissionsCount = data.professionalSubmissionsCount || 0;
  }

  // Find all reports with pagination
  static async find(query = {}, options = {}) {
    try {
      const pool = await poolPromise;
      let sqlQuery = 'SELECT * FROM Reports';
      
      // Add WHERE clause if query parameters exist
      const queryParams = [];
      let whereClause = '';
      
      if (Object.keys(query).length > 0) {
        whereClause = ' WHERE ';
        let conditions = [];
        
        // For each query parameter, add a condition
        Object.entries(query).forEach(([key, value], index) => {
          if (value) {
            conditions.push(`${key} = @param${index}`);
            queryParams.push({ name: `param${index}`, value, type: typeof value === 'number' ? sql.Int : sql.NVarChar });
          }
        });
        
        whereClause += conditions.join(' AND ');
      }
      
      sqlQuery += whereClause;
      
      // Add sorting
      sqlQuery += ' ORDER BY uploadDate DESC';
      
      // Add pagination
      if (options.limit) {
        const skip = options.skip || 0;
        sqlQuery += ' OFFSET @skip ROWS FETCH NEXT @limit ROWS ONLY';
        queryParams.push({ name: 'skip', value: skip, type: sql.Int });
        queryParams.push({ name: 'limit', value: options.limit, type: sql.Int });
      }
      
      // Execute query
      const request = pool.request();
      queryParams.forEach(param => {
        request.input(param.name, param.type, param.value);
      });
      
      const result = await request.query(sqlQuery);
      return result.recordset.map(record => new Report(record));
    } catch (error) {
      console.error('Error finding reports:', error);
      throw error;
    }
  }

  // Count documents
  static async countDocuments(query = {}) {
    try {
      const pool = await poolPromise;
      let sqlQuery = 'SELECT COUNT(*) AS count FROM Reports';
      
      // Add WHERE clause if query parameters exist
      const queryParams = [];
      let whereClause = '';
      
      if (Object.keys(query).length > 0) {
        whereClause = ' WHERE ';
        let conditions = [];
        
        // For each query parameter, add a condition
        Object.entries(query).forEach(([key, value], index) => {
          if (value) {
            conditions.push(`${key} = @param${index}`);
            queryParams.push({ name: `param${index}`, value, type: typeof value === 'number' ? sql.Int : sql.NVarChar });
          }
        });
        
        whereClause += conditions.join(' AND ');
      }
      
      sqlQuery += whereClause;
      
      // Execute query
      const request = pool.request();
      queryParams.forEach(param => {
        request.input(param.name, param.type, param.value);
      });
      
      const result = await request.query(sqlQuery);
      return result.recordset[0].count;
    } catch (error) {
      console.error('Error counting reports:', error);
      throw error;
    }
  }

  // Find report by ID and update
  static async findByIdAndUpdate(id, updateData) {
    try {
      const pool = await poolPromise;
      const request = pool.request()
        .input('id', sql.Int, id);
      
      // Build SET clause based on updateData
      const setClauses = [];
      let paramIndex = 0;
      
      for (const [key, value] of Object.entries(updateData)) {
        if (key !== 'id') { // Skip the id field
          setClauses.push(`${key} = @param${paramIndex}`);
          request.input(`param${paramIndex}`, typeof value === 'number' ? sql.Int : sql.NVarChar, value);
          paramIndex++;
        }
      }
      
      if (setClauses.length === 0) {
        // Nothing to update
        return await Report.findById(id);
      }
      
      const setClause = setClauses.join(', ');
      const query = `UPDATE Reports SET ${setClause} WHERE id = @id; SELECT * FROM Reports WHERE id = @id;`;
      
      const result = await request.query(query);
      
      if (result.recordset.length === 0) return null;
      return new Report(result.recordset[0]);
    } catch (error) {
      console.error('Error updating report:', error);
      throw error;
    }
  }

  // Find report by ID
  static async findById(id) {
    try {
      const pool = await poolPromise;
      const result = await pool.request()
        .input('id', sql.Int, id)
        .query('SELECT * FROM Reports WHERE id = @id');
      
      if (result.recordset.length === 0) return null;
      return new Report(result.recordset[0]);
    } catch (error) {
      console.error('Error finding report by ID:', error);
      throw error;
    }
  }

  // Find one report by given criteria
  static async findOne(query) {
    try {
      const pool = await poolPromise;
      let sqlQuery = 'SELECT TOP 1 * FROM Reports';
      
      // Add WHERE clause if query parameters exist
      const queryParams = [];
      let whereClause = '';
      
      if (Object.keys(query).length > 0) {
        whereClause = ' WHERE ';
        let conditions = [];
        
        // For each query parameter, add a condition
        Object.entries(query).forEach(([key, value], index) => {
          if (value) {
            conditions.push(`${key} = @param${index}`);
            queryParams.push({ name: `param${index}`, value, type: typeof value === 'number' ? sql.Int : sql.NVarChar });
          }
        });
        
        whereClause += conditions.join(' AND ');
      }
      
      sqlQuery += whereClause;
      
      // Execute query
      const request = pool.request();
      queryParams.forEach(param => {
        request.input(param.name, param.type, param.value);
      });
      
      const result = await request.query(sqlQuery);
      
      if (result.recordset.length === 0) return null;
      return new Report(result.recordset[0]);
    } catch (error) {
      console.error('Error finding report:', error);
      throw error;
    }
  }

  // Save a new report
  async save() {
    try {
      const pool = await poolPromise;
      
      // If the report has an ID, update it
      if (this.id) {
        const request = pool.request()
          .input('id', sql.Int, this.id)
          .input('filename', sql.NVarChar, this.filename)
          .input('uploadedBy', sql.Int, this.uploadedBy)
          .input('lightIndustrialCount', sql.Int, this.lightIndustrialCount)
          .input('professionalCount', sql.Int, this.professionalCount)
          .input('submissionsCount', sql.Int, this.submissionsCount)
          .input('lightIndustrialSubmissionsCount', sql.Int, this.lightIndustrialSubmissionsCount)
          .input('professionalSubmissionsCount', sql.Int, this.professionalSubmissionsCount);
        
        await request.query(`
          UPDATE Reports SET 
            filename = @filename, 
            uploadedBy = @uploadedBy,
            lightIndustrialCount = @lightIndustrialCount,
            professionalCount = @professionalCount,
            submissionsCount = @submissionsCount,
            lightIndustrialSubmissionsCount = @lightIndustrialSubmissionsCount,
            professionalSubmissionsCount = @professionalSubmissionsCount
          WHERE id = @id
        `);
        
        return this;
      } 
      // Otherwise, insert a new report
      else {
        const result = await pool.request()
          .input('filename', sql.NVarChar, this.filename)
          .input('uploadedBy', sql.Int, this.uploadedBy)
          .input('lightIndustrialCount', sql.Int, this.lightIndustrialCount)
          .input('professionalCount', sql.Int, this.professionalCount)
          .input('submissionsCount', sql.Int, this.submissionsCount)
          .input('lightIndustrialSubmissionsCount', sql.Int, this.lightIndustrialSubmissionsCount)
          .input('professionalSubmissionsCount', sql.Int, this.professionalSubmissionsCount)
          .query(`
            INSERT INTO Reports (filename, uploadDate, uploadedBy, lightIndustrialCount, professionalCount, submissionsCount, lightIndustrialSubmissionsCount, professionalSubmissionsCount)
            OUTPUT INSERTED.*
            VALUES (@filename, GETDATE(), @uploadedBy, @lightIndustrialCount, @professionalCount, @submissionsCount, @lightIndustrialSubmissionsCount, @professionalSubmissionsCount)
          `);
        
        this.id = result.recordset[0].id;
        this.uploadDate = result.recordset[0].uploadDate;
        return this;
      }
    } catch (error) {
      console.error('Error saving report:', error);
      throw error;
    }
  }

  // Find by ID and delete
  static async findByIdAndDelete(id) {
    try {
      const pool = await poolPromise;
      
      // Start a transaction to delete report and associated historical records
      const transaction = new sql.Transaction(pool);
      await transaction.begin();
      
      try {
        // Delete historical records first (due to foreign key constraint)
        await transaction.request()
          .input('reportId', sql.Int, id)
          .query('DELETE FROM HistoricalData WHERE reportId = @reportId');
        
        // Then delete the report
        await transaction.request()
          .input('id', sql.Int, id)
          .query('DELETE FROM Reports WHERE id = @id');
        
        await transaction.commit();
        return true;
      } catch (error) {
        await transaction.rollback();
        throw error;
      }
    } catch (error) {
      console.error('Error deleting report:', error);
      throw error;
    }
  }

  // Find one and populate related data
  static async findPopulated(query = {}, populate = []) {
    try {
      if (!populate || populate.length === 0) {
        return await Report.find(query);
      }
      
      const pool = await poolPromise;
      
      // Get the reports first
      const reports = await Report.find(query);
      
      // For each populate option, fetch related data
      for (const report of reports) {
        for (const field of populate) {
          if (field === 'uploadedBy') {
            // Get user data for uploadedBy
            const userResult = await pool.request()
              .input('id', sql.Int, report.uploadedBy)
              .query('SELECT id, name, email, role FROM Users WHERE id = @id');
            
            if (userResult.recordset.length > 0) {
              report.uploadedBy = userResult.recordset[0];
            }
          }
          // Add more populate options as needed
        }
      }
      
      return reports;
    } catch (error) {
      console.error('Error finding populated reports:', error);
      throw error;
    }
  }
}

module.exports = Report;