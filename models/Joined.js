// models/Joined.js
const { poolPromise, sql } = require('../utils/db');

class Joined {
  constructor(data) {
    this.id = data.id;
    this.historicalId = data.historicalId;
    this.employeeName = data.employeeName;
    this.jobTitle = data.jobTitle;
    this.company = data.company;
    this.startDate = data.startDate instanceof Date ? data.startDate : new Date(data.startDate);
    this.joinedDate = data.joinedDate instanceof Date ? data.joinedDate : new Date(data.joinedDate);
    this.type = data.type;
    this.recruiterTeam = data.recruiterTeam;
    this.createdAt = data.createdAt instanceof Date ? data.createdAt : (data.createdAt ? new Date(data.createdAt) : new Date());
    this.createdBy = data.createdBy;
  }

  // Find all joined employees with pagination
  static async findAll(pagination = {}) {
    try {
      const pool = await poolPromise;
      let query = 'SELECT * FROM JoinedEmployees ORDER BY joinedDate DESC';
      
      // Add pagination if provided
      if (pagination.limit && pagination.skip !== undefined) {
        query += ' OFFSET @skip ROWS FETCH NEXT @limit ROWS ONLY';
      }
      
      const request = pool.request();
      
      if (pagination.limit && pagination.skip !== undefined) {
        request.input('skip', sql.Int, pagination.skip);
        request.input('limit', sql.Int, pagination.limit);
      }
      
      const result = await request.query(query);
      return result.recordset.map(record => new Joined(record));
    } catch (error) {
      console.error('Error finding joined employees:', error);
      throw error;
    }
  }

  // Get count of joined employees
  static async getCount() {
    try {
      const pool = await poolPromise;
      const result = await pool.request()
        .query('SELECT COUNT(*) AS count FROM JoinedEmployees');
      
      return result.recordset[0].count;
    } catch (error) {
      console.error('Error counting joined employees:', error);
      throw error;
    }
  }

  // Find by ID
  static async findById(id) {
    try {
      const pool = await poolPromise;
      const result = await pool.request()
        .input('id', sql.Int, id)
        .query('SELECT * FROM JoinedEmployees WHERE id = @id');
      
      if (result.recordset.length === 0) return null;
      return new Joined(result.recordset[0]);
    } catch (error) {
      console.error('Error finding joined employee by ID:', error);
      throw error;
    }
  }

  // Create new joined employee
  static async create(data) {
    try {
      const pool = await poolPromise;
      
      // Handle potential null values for historicalId
      let historicalId = null;
      if (data.historicalId && data.historicalId !== 'null' && data.historicalId !== '') {
        historicalId = parseInt(data.historicalId);
        if (isNaN(historicalId)) historicalId = null;
      }
      
      const result = await pool.request()
        .input('historicalId', sql.Int, historicalId)
        .input('employeeName', sql.NVarChar(255), data.employeeName)
        .input('jobTitle', sql.NVarChar(255), data.jobTitle)
        .input('company', sql.NVarChar(255), data.company)
        .input('startDate', sql.DateTime2, data.startDate)
        .input('joinedDate', sql.DateTime2, data.joinedDate)
        .input('type', sql.NVarChar(255), data.type)
        .input('recruiterTeam', sql.NVarChar(255), data.recruiterTeam)
        .input('createdBy', sql.Int, data.createdBy)
        .query(`
          INSERT INTO JoinedEmployees (historicalId, employeeName, jobTitle, company, startDate, joinedDate, type, recruiterTeam, createdBy, createdAt)
          OUTPUT INSERTED.*
          VALUES (@historicalId, @employeeName, @jobTitle, @company, @startDate, @joinedDate, @type, @recruiterTeam, @createdBy, GETDATE())
        `);
      
      if (result.recordset.length === 0) throw new Error('Failed to create joined employee record');
      return new Joined(result.recordset[0]);
    } catch (error) {
      console.error('Error creating joined employee:', error);
      throw error;
    }
  }

  // Update joined employee
  async update(updateData) {
    try {
      const pool = await poolPromise;
      
      // Handle potential null values for historicalId
      let historicalId = null;
      if (updateData.historicalId && updateData.historicalId !== 'null' && updateData.historicalId !== '') {
        historicalId = parseInt(updateData.historicalId);
        if (isNaN(historicalId)) historicalId = null;
      }
      
      await pool.request()
        .input('id', sql.Int, this.id)
        .input('historicalId', sql.Int, historicalId)
        .input('employeeName', sql.NVarChar(255), updateData.employeeName || this.employeeName)
        .input('jobTitle', sql.NVarChar(255), updateData.jobTitle || this.jobTitle)
        .input('company', sql.NVarChar(255), updateData.company || this.company)
        .input('startDate', sql.DateTime2, updateData.startDate || this.startDate)
        .input('joinedDate', sql.DateTime2, updateData.joinedDate || this.joinedDate)
        .input('type', sql.NVarChar(255), updateData.type || this.type)
        .input('recruiterTeam', sql.NVarChar(255), updateData.recruiterTeam || this.recruiterTeam)
        .query(`
          UPDATE JoinedEmployees
          SET historicalId = @historicalId,
              employeeName = @employeeName,
              jobTitle = @jobTitle,
              company = @company,
              startDate = @startDate,
              joinedDate = @joinedDate,
              type = @type,
              recruiterTeam = @recruiterTeam
          WHERE id = @id
        `);
      
      // Update current instance with new data
      Object.assign(this, updateData);
      
      return this;
    } catch (error) {
      console.error('Error updating joined employee:', error);
      throw error;
    }
  }

  // Delete joined employee
  static async delete(id) {
    try {
      const pool = await poolPromise;
      await pool.request()
        .input('id', sql.Int, id)
        .query('DELETE FROM JoinedEmployees WHERE id = @id');
      
      return true;
    } catch (error) {
      console.error('Error deleting joined employee:', error);
      throw error;
    }
  }

  // Find by date range
  static async findByDateRange(startDate, endDate) {
    try {
      const pool = await poolPromise;
      const result = await pool.request()
        .input('startDate', sql.DateTime2, startDate)
        .input('endDate', sql.DateTime2, endDate)
        .query(`
          SELECT * FROM JoinedEmployees 
          WHERE joinedDate >= @startDate AND joinedDate <= @endDate
          ORDER BY joinedDate DESC
        `);
      
      return result.recordset.map(record => new Joined(record));
    } catch (error) {
      console.error('Error finding joined employees by date range:', error);
      throw error;
    }
  }

  // Insert many joined employees
  static async insertMany(joinedEmployees) {
    try {
      const pool = await poolPromise;
      const transaction = new sql.Transaction(pool);
      await transaction.begin();
      
      try {
        for (const employee of joinedEmployees) {
          // Handle potential null values for historicalId
          let historicalId = null;
          if (employee.historicalId && employee.historicalId !== 'null' && employee.historicalId !== '') {
            historicalId = parseInt(employee.historicalId);
            if (isNaN(historicalId)) historicalId = null;
          }
          
          await transaction.request()
            .input('historicalId', sql.Int, historicalId)
            .input('employeeName', sql.NVarChar(255), employee.employeeName)
            .input('jobTitle', sql.NVarChar(255), employee.jobTitle)
            .input('company', sql.NVarChar(255), employee.company)
            .input('startDate', sql.DateTime2, employee.startDate)
            .input('joinedDate', sql.DateTime2, employee.joinedDate)
            .input('type', sql.NVarChar(255), employee.type)
            .input('recruiterTeam', sql.NVarChar(255), employee.recruiterTeam)
            .input('createdBy', sql.Int, employee.createdBy)
            .query(`
              INSERT INTO JoinedEmployees (historicalId, employeeName, jobTitle, company, startDate, joinedDate, type, recruiterTeam, createdBy, createdAt)
              VALUES (@historicalId, @employeeName, @jobTitle, @company, @startDate, @joinedDate, @type, @recruiterTeam, @createdBy, GETDATE())
            `);
        }
        
        await transaction.commit();
        return true;
      } catch (error) {
        await transaction.rollback();
        throw error;
      }
    } catch (error) {
      console.error('Error inserting multiple joined employees:', error);
      throw error;
    }
  }

  // Search for joined employees
  static async search(searchTerm, pagination = {}) {
    try {
      const pool = await poolPromise;
      let query = `
        SELECT * FROM JoinedEmployees 
        WHERE employeeName LIKE @searchTerm 
        OR jobTitle LIKE @searchTerm 
        OR company LIKE @searchTerm
        OR type LIKE @searchTerm
        OR recruiterTeam LIKE @searchTerm
        ORDER BY joinedDate DESC
      `;
      
      // Add pagination if provided
      if (pagination.limit && pagination.skip !== undefined) {
        query += ' OFFSET @skip ROWS FETCH NEXT @limit ROWS ONLY';
      }
      
      const request = pool.request();
      request.input('searchTerm', sql.NVarChar(255), '%' + searchTerm + '%');
      
      if (pagination.limit && pagination.skip !== undefined) {
        request.input('skip', sql.Int, pagination.skip);
        request.input('limit', sql.Int, pagination.limit);
      }
      
      const result = await request.query(query);
      return result.recordset.map(record => new Joined(record));
    } catch (error) {
      console.error('Error searching joined employees:', error);
      throw error;
    }
  }

  // Get count of search results
  static async getSearchCount(searchTerm) {
    try {
      const pool = await poolPromise;
      const result = await pool.request()
        .input('searchTerm', sql.NVarChar(255), '%' + searchTerm + '%')
        .query(`
          SELECT COUNT(*) AS count FROM JoinedEmployees
          WHERE employeeName LIKE @searchTerm 
          OR jobTitle LIKE @searchTerm 
          OR company LIKE @searchTerm
          OR type LIKE @searchTerm
          OR recruiterTeam LIKE @searchTerm
        `);
      
      return result.recordset[0].count;
    } catch (error) {
      console.error('Error counting search results:', error);
      throw error;
    }
  }
}

module.exports = Joined;