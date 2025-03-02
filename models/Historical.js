// models/Historical.js
const { poolPromise, sql } = require('../utils/db');

class Historical {
  constructor(data) {
    this.id = data.id;
    this.reportId = data.reportId;
    this.created = data.created instanceof Date ? data.created : new Date(data.created);
    this.age = data.age || 0;
    this.jobId = data.jobId || '';
    this.ourId = data.ourId || '';
    this.company = data.company || '';
    this.title = data.title || '';
    this.openings = data.openings || 1;
    this.submitted = data.submitted || 0;
    this.interview = data.interview || 0;
    this.status = data.status || '';
    this.type = data.type || '';
  }

  // Find all historical records with filters and pagination
  static async findAll(filters = {}, pagination = {}) {
    try {
      const pool = await poolPromise;
      let query = 'SELECT * FROM HistoricalData WHERE 1=1';
      const queryParams = [];
      
      // Apply filters
      if (filters.company) {
        query += ' AND company LIKE @company';
        queryParams.push({ name: 'company', value: `%${filters.company}%`, type: sql.NVarChar });
      }
      
      if (filters.title) {
        query += ' AND title LIKE @title';
        queryParams.push({ name: 'title', value: `%${filters.title}%`, type: sql.NVarChar });
      }
      
      if (filters.type) {
        query += ' AND type = @type';
        queryParams.push({ name: 'type', value: filters.type, type: sql.NVarChar });
      }
      
      if (filters.status) {
        query += ' AND status LIKE @status';
        queryParams.push({ name: 'status', value: `%${filters.status}%`, type: sql.NVarChar });
      }
      
      if (filters.minSubmissions) {
        query += ' AND submitted >= @minSubmissions';
        queryParams.push({ name: 'minSubmissions', value: parseInt(filters.minSubmissions), type: sql.Int });
      }
      
      if (filters.maxSubmissions) {
        query += ' AND submitted <= @maxSubmissions';
        queryParams.push({ name: 'maxSubmissions', value: parseInt(filters.maxSubmissions), type: sql.Int });
      }
      
      if (filters.startDate) {
        query += ' AND created >= @startDate';
        queryParams.push({ name: 'startDate', value: new Date(filters.startDate), type: sql.DateTime2 });
      }
      
      if (filters.endDate) {
        query += ' AND created <= @endDate';
        queryParams.push({ name: 'endDate', value: new Date(filters.endDate), type: sql.DateTime2 });
      }
      
      // Add sorting
      query += ' ORDER BY created DESC';
      
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
      return result.recordset.map(record => new Historical(record));
    } catch (error) {
      console.error('Error finding historical records:', error);
      throw error;
    }
  }

  // Get count of historical records with filters
  static async getCount(filters = {}) {
    try {
      const pool = await poolPromise;
      let query = 'SELECT COUNT(*) AS count FROM HistoricalData WHERE 1=1';
      const queryParams = [];
      
      // Apply the same filters as in findAll
      if (filters.company) {
        query += ' AND company LIKE @company';
        queryParams.push({ name: 'company', value: `%${filters.company}%`, type: sql.NVarChar });
      }
      
      if (filters.title) {
        query += ' AND title LIKE @title';
        queryParams.push({ name: 'title', value: `%${filters.title}%`, type: sql.NVarChar });
      }
      
      if (filters.type) {
        query += ' AND type = @type';
        queryParams.push({ name: 'type', value: filters.type, type: sql.NVarChar });
      }
      
      if (filters.status) {
        query += ' AND status LIKE @status';
        queryParams.push({ name: 'status', value: `%${filters.status}%`, type: sql.NVarChar });
      }
      
      if (filters.minSubmissions) {
        query += ' AND submitted >= @minSubmissions';
        queryParams.push({ name: 'minSubmissions', value: parseInt(filters.minSubmissions), type: sql.Int });
      }
      
      if (filters.maxSubmissions) {
        query += ' AND submitted <= @maxSubmissions';
        queryParams.push({ name: 'maxSubmissions', value: parseInt(filters.maxSubmissions), type: sql.Int });
      }
      
      if (filters.startDate) {
        query += ' AND created >= @startDate';
        queryParams.push({ name: 'startDate', value: new Date(filters.startDate), type: sql.DateTime2 });
      }
      
      if (filters.endDate) {
        query += ' AND created <= @endDate';
        queryParams.push({ name: 'endDate', value: new Date(filters.endDate), type: sql.DateTime2 });
      }
      
      // Execute query
      const request = pool.request();
      queryParams.forEach(param => {
        request.input(param.name, param.type, param.value);
      });
      
      const result = await request.query(query);
      return result.recordset[0].count;
    } catch (error) {
      console.error('Error counting historical records:', error);
      throw error;
    }
  }

  // Find historical record by ID
  static async findById(id) {
    try {
      const pool = await poolPromise;
      const result = await pool.request()
        .input('id', sql.Int, id)
        .query('SELECT * FROM HistoricalData WHERE id = @id');
      
      if (result.recordset.length === 0) return null;
      return new Historical(result.recordset[0]);
    } catch (error) {
      console.error('Error finding historical record by ID:', error);
      throw error;
    }
  }

  // Insert multiple historical records
  static async insertMany(records) {
    try {
      const pool = await poolPromise;
      const transaction = new sql.Transaction(pool);
      await transaction.begin();
      
      try {
        for (const record of records) {
          // Ensure all values are properly defined and formatted
          const request = transaction.request()
            .input('reportId', sql.Int, record.reportId || null)
            .input('created', sql.DateTime2, record.created || new Date())
            .input('age', sql.Int, record.age || 0)
            .input('jobId', sql.NVarChar(255), record.jobId || '')
            .input('ourId', sql.NVarChar(255), record.ourId || '')
            .input('company', sql.NVarChar(255), record.company || '')
            .input('title', sql.NVarChar(255), record.title || '')
            .input('openings', sql.Int, record.openings || 1)
            .input('submitted', sql.Int, record.submitted || 0)
            .input('interview', sql.Int, record.interview || 0)
            .input('status', sql.NVarChar(255), record.status || '')
            .input('type', sql.NVarChar(255), record.type || '');
          
          await request.query(`
            INSERT INTO HistoricalData (reportId, created, age, jobId, ourId, company, title, openings, submitted, interview, status, type)
            VALUES (@reportId, @created, @age, @jobId, @ourId, @company, @title, @openings, @submitted, @interview, @status, @type)
          `);
        }
        
        await transaction.commit();
        return true;
      } catch (error) {
        console.error('Transaction error:', error);
        await transaction.rollback();
        throw error;
      }
    } catch (error) {
      console.error('Error inserting historical records:', error);
      throw error;
    }
  }
}

module.exports = Historical;