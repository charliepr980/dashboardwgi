// models/interview.js
const { poolPromise, sql } = require('../utils/db');

class Interview {
  constructor(data) {
    this.id = data.id;
    this.candidate = data.candidate;
    this.company = data.company;
    this.position = data.position;
    this.type = data.type;
    this.startTime = data.startTime instanceof Date ? data.startTime : new Date(data.startTime);
    this.endTime = data.endTime instanceof Date ? data.endTime : new Date(data.endTime);
    this.status = data.status || 'Scheduled';
    this.notes = data.notes || '';
    this.recruiter = data.recruiter || '';
    this.location = data.location || 'Virtual';
    this.createdBy = data.createdBy;
    this.createdAt = data.createdAt instanceof Date ? data.createdAt : new Date(data.createdAt);
    this.updatedAt = data.updatedAt instanceof Date ? data.updatedAt : new Date(data.updatedAt);
  }

  // Find all interviews with optional filters and pagination
  static async findAll(filters = {}, pagination = {}) {
    try {
      const pool = await poolPromise;
      let query = 'SELECT * FROM Interviews WHERE 1=1';
      const queryParams = [];
      
      // Apply filters
      if (filters.candidate) {
        query += ' AND candidate LIKE @candidate';
        queryParams.push({ name: 'candidate', value: `%${filters.candidate}%`, type: sql.NVarChar });
      }
      
      if (filters.company) {
        query += ' AND company LIKE @company';
        queryParams.push({ name: 'company', value: `%${filters.company}%`, type: sql.NVarChar });
      }
      
      if (filters.position) {
        query += ' AND position LIKE @position';
        queryParams.push({ name: 'position', value: `%${filters.position}%`, type: sql.NVarChar });
      }
      
      if (filters.status) {
        query += ' AND status = @status';
        queryParams.push({ name: 'status', value: filters.status, type: sql.NVarChar });
      }
      
      if (filters.recruiter) {
        query += ' AND recruiter LIKE @recruiter';
        queryParams.push({ name: 'recruiter', value: `%${filters.recruiter}%`, type: sql.NVarChar });
      }
      
      // Date range filter
      if (filters.startDate) {
        query += ' AND startTime >= @startDate';
        queryParams.push({ name: 'startDate', value: new Date(filters.startDate), type: sql.DateTime2 });
      }
      
      if (filters.endDate) {
        const endDate = new Date(filters.endDate);
        endDate.setHours(23, 59, 59, 999); // Set to end of day
        query += ' AND startTime <= @endDate';
        queryParams.push({ name: 'endDate', value: endDate, type: sql.DateTime2 });
      }
      
      // Add sorting
      query += ' ORDER BY startTime DESC';
      
      // Add pagination
      if (pagination.limit && pagination.skip !== undefined) {
        query += ' OFFSET @skip ROWS FETCH NEXT @limit ROWS ONLY';
        queryParams.push({ name: 'skip', value: pagination.skip, type: sql.Int });
        queryParams.push({ name: 'limit', value: pagination.limit, type: sql.Int });
      }
      
      // Execute query
      const request = pool.request();
      queryParams.forEach(param => {
        request.input(param.name, param.type, param.value);
      });
      
      const result = await request.query(query);
      return result.recordset.map(record => new Interview(record));
    } catch (error) {
      console.error('Error finding interviews:', error);
      throw error;
    }
  }

  // Get count of interviews with optional filters
  static async getCount(filters = {}) {
    try {
      const pool = await poolPromise;
      let query = 'SELECT COUNT(*) AS count FROM Interviews WHERE 1=1';
      const queryParams = [];
      
      // Apply the same filters as in findAll
      if (filters.candidate) {
        query += ' AND candidate LIKE @candidate';
        queryParams.push({ name: 'candidate', value: `%${filters.candidate}%`, type: sql.NVarChar });
      }
      
      if (filters.company) {
        query += ' AND company LIKE @company';
        queryParams.push({ name: 'company', value: `%${filters.company}%`, type: sql.NVarChar });
      }
      
      if (filters.position) {
        query += ' AND position LIKE @position';
        queryParams.push({ name: 'position', value: `%${filters.position}%`, type: sql.NVarChar });
      }
      
      if (filters.status) {
        query += ' AND status = @status';
        queryParams.push({ name: 'status', value: filters.status, type: sql.NVarChar });
      }
      
      if (filters.recruiter) {
        query += ' AND recruiter LIKE @recruiter';
        queryParams.push({ name: 'recruiter', value: `%${filters.recruiter}%`, type: sql.NVarChar });
      }
      
      // Date range filter
      if (filters.startDate) {
        query += ' AND startTime >= @startDate';
        queryParams.push({ name: 'startDate', value: new Date(filters.startDate), type: sql.DateTime2 });
      }
      
      if (filters.endDate) {
        const endDate = new Date(filters.endDate);
        endDate.setHours(23, 59, 59, 999); // Set to end of day
        query += ' AND startTime <= @endDate';
        queryParams.push({ name: 'endDate', value: endDate, type: sql.DateTime2 });
      }
      
      // Execute query
      const request = pool.request();
      queryParams.forEach(param => {
        request.input(param.name, param.type, param.value);
      });
      
      const result = await request.query(query);
      return result.recordset[0].count;
    } catch (error) {
      console.error('Error counting interviews:', error);
      throw error;
    }
  }

  // Find interview by ID
  static async findById(id) {
    try {
      const pool = await poolPromise;
      const result = await pool.request()
        .input('id', sql.Int, id)
        .query('SELECT * FROM Interviews WHERE id = @id');
      
      if (result.recordset.length === 0) return null;
      return new Interview(result.recordset[0]);
    } catch (error) {
      console.error('Error finding interview by ID:', error);
      throw error;
    }
  }

  // Create new interview
  static async create(data) {
    try {
      const pool = await poolPromise;
      const result = await pool.request()
        .input('candidate', sql.NVarChar, data.candidate)
        .input('company', sql.NVarChar, data.company)
        .input('position', sql.NVarChar, data.position)
        .input('type', sql.NVarChar, data.type)
        .input('startTime', sql.DateTime2, data.startTime)
        .input('endTime', sql.DateTime2, data.endTime)
        .input('status', sql.NVarChar, data.status || 'Scheduled')
        .input('notes', sql.NVarChar, data.notes || '')
        .input('recruiter', sql.NVarChar, data.recruiter || '')
        .input('location', sql.NVarChar, data.location || 'Virtual')
        .input('createdBy', sql.Int, data.createdBy)
        .query(`
          INSERT INTO Interviews (candidate, company, position, type, startTime, endTime, status, notes, recruiter, location, createdBy, createdAt, updatedAt)
          OUTPUT INSERTED.*
          VALUES (@candidate, @company, @position, @type, @startTime, @endTime, @status, @notes, @recruiter, @location, @createdBy, GETDATE(), GETDATE())
        `);
      
      return new Interview(result.recordset[0]);
    } catch (error) {
      console.error('Error creating interview:', error);
      throw error;
    }
  }

  // Update interview
  static async update(id, updateData) {
    try {
      const pool = await poolPromise;
      await pool.request()
        .input('id', sql.Int, id)
        .input('candidate', sql.NVarChar, updateData.candidate)
        .input('company', sql.NVarChar, updateData.company)
        .input('position', sql.NVarChar, updateData.position)
        .input('type', sql.NVarChar, updateData.type)
        .input('startTime', sql.DateTime2, updateData.startTime)
        .input('endTime', sql.DateTime2, updateData.endTime)
        .input('status', sql.NVarChar, updateData.status)
        .input('notes', sql.NVarChar, updateData.notes || '')
        .input('recruiter', sql.NVarChar, updateData.recruiter || '')
        .input('location', sql.NVarChar, updateData.location || 'Virtual')
        .query(`
          UPDATE Interviews
          SET candidate = @candidate,
              company = @company,
              position = @position,
              type = @type,
              startTime = @startTime,
              endTime = @endTime,
              status = @status,
              notes = @notes,
              recruiter = @recruiter,
              location = @location,
              updatedAt = GETDATE()
          WHERE id = @id
        `);
      
      return await Interview.findById(id);
    } catch (error) {
      console.error('Error updating interview:', error);
      throw error;
    }
  }

  // Delete interview
  static async delete(id) {
    try {
      const pool = await poolPromise;
      await pool.request()
        .input('id', sql.Int, id)
        .query('DELETE FROM Interviews WHERE id = @id');
      
      return true;
    } catch (error) {
      console.error('Error deleting interview:', error);
      throw error;
    }
  }

  // Get upcoming interviews
  static async getUpcoming(limit = 5) {
    try {
      const pool = await poolPromise;
      const result = await pool.request()
        .input('now', sql.DateTime2, new Date())
        .input('limit', sql.Int, limit)
        .query(`
          SELECT TOP (@limit) * FROM Interviews 
          WHERE startTime >= @now AND status = 'Scheduled'
          ORDER BY startTime ASC
        `);
      
      return result.recordset.map(record => new Interview(record));
    } catch (error) {
      console.error('Error getting upcoming interviews:', error);
      throw error;
    }
  }
}

module.exports = Interview;