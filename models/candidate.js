// models/candidate.js
const { poolPromise, sql } = require('../utils/db');

class Candidate {
  constructor(data) {
    this.id = data.id;
    this.company = data.company;
    this.jobPostingId = data.jobPostingId;
    this.jobTitle = data.jobTitle;
    this.candidateName = data.candidateName;
    this.submittedBy = data.submittedBy;
    this.submitDate = data.submitDate instanceof Date ? data.submitDate : new Date(data.submitDate);
    this.status = data.status;
    this.rejectionReason = data.rejectionReason || '';
    this.notes = data.notes || '';
    this.createdBy = data.createdBy;
    this.createdAt = data.createdAt instanceof Date ? data.createdAt : new Date(data.createdAt);
  }

  // Get status category based on status and rejection reason
  getStatusCategory() {
    const status = (this.status || '').toLowerCase().trim();
    const rejectionReasonLower = (this.rejectionReason || '').toLowerCase().trim();
    
    // 1. Selected: Work Order Accepted, Offer Pending, Onboarded Pending, Onboarding, Work Order Confirmed, Selected
    if (
      status.includes('work order accepted') ||
      status.includes('offer pending') ||
      status.includes('onboarded pending') ||
      status.includes('onboarding') ||
      status.includes('work order confirmed') ||
      status.includes('selected')
    ) {
      return 'Selected';
    }
    
    // 2. Shortlisted: Shortlisted, Qualified
    if (
      status.includes('shortlisted') ||
      status.includes('qualified')
    ) {
      return 'Shortlisted';
    }
    
    // 3. Interview: Interview Scheduled, Interview Rejected, Interview Completed, Interview Confirmed
    if (
      status.includes('interview')
    ) {
      return 'Interview';
    }
    
    // 4. Neutral: Rejected status with "neutral" in rejection reason
    if (
      (status.includes('rejected') || status.includes('disqualified')) &&
      (rejectionReasonLower.includes('neutral') || 
      rejectionReasonLower.startsWith('neutral-') || 
      rejectionReasonLower.startsWith('neutral '))
    ) {
      return 'Neutral';
    }
    
    // 5. Rejected: Rejected, Disqualified (without neutral in rejection reason)
    if (
      status.includes('rejected') || 
      status.includes('disqualified')
    ) {
      return 'Rejected';
    }
    
    // Default for any other status
    return 'Other';
  }

  // Find all candidates with filters and pagination
  static async findAll(filters = {}, pagination = {}) {
    try {
      const pool = await poolPromise;
      let query = 'SELECT * FROM Candidates WHERE 1=1';
      const queryParams = [];
      
      // Apply filters if provided
      if (filters.company) {
        query += ' AND company LIKE @company';
        queryParams.push({ name: 'company', value: `%${filters.company}%`, type: sql.NVarChar });
      }
      
      if (filters.jobPostingId) {
        query += ' AND jobPostingId LIKE @jobPostingId';
        queryParams.push({ name: 'jobPostingId', value: `%${filters.jobPostingId}%`, type: sql.NVarChar });
      }
      
      if (filters.jobTitle) {
        query += ' AND jobTitle LIKE @jobTitle';
        queryParams.push({ name: 'jobTitle', value: `%${filters.jobTitle}%`, type: sql.NVarChar });
      }
      
      if (filters.candidateName) {
        query += ' AND candidateName LIKE @candidateName';
        queryParams.push({ name: 'candidateName', value: `%${filters.candidateName}%`, type: sql.NVarChar });
      }
      
      if (filters.submittedBy) {
        query += ' AND submittedBy LIKE @submittedBy';
        queryParams.push({ name: 'submittedBy', value: `%${filters.submittedBy}%`, type: sql.NVarChar });
      }
      
      if (filters.status) {
        query += ' AND status LIKE @status';
        queryParams.push({ name: 'status', value: `%${filters.status}%`, type: sql.NVarChar });
      }
      
      // Date filtering
      if (filters.startDate) {
        query += ' AND submitDate >= @startDate';
        queryParams.push({ name: 'startDate', value: new Date(filters.startDate), type: sql.DateTime2 });
      }
      
      if (filters.endDate) {
        const endDate = new Date(filters.endDate);
        endDate.setHours(23, 59, 59, 999); // Set to end of day
        query += ' AND submitDate <= @endDate';
        queryParams.push({ name: 'endDate', value: endDate, type: sql.DateTime2 });
      }
      
      // Add sorting
      query += ' ORDER BY submitDate DESC';
      
      // Add pagination if provided
      if (pagination.limit && pagination.skip !== undefined) {
        query += ' OFFSET @skip ROWS FETCH NEXT @limit ROWS ONLY';
        queryParams.push({ name: 'skip', value: pagination.skip, type: sql.Int });
        queryParams.push({ name: 'limit', value: pagination.limit, type: sql.Int });
      }
      
      // Build and execute the query
      const request = pool.request();
      queryParams.forEach(param => {
        request.input(param.name, param.type, param.value);
      });
      
      const result = await request.query(query);
      return result.recordset.map(record => new Candidate(record));
    } catch (error) {
      console.error('Error finding candidates:', error);
      throw error;
    }
  }

  // Get count of candidates with filters
  static async getCount(filters = {}) {
    try {
      const pool = await poolPromise;
      let query = 'SELECT COUNT(*) AS count FROM Candidates WHERE 1=1';
      const queryParams = [];
      
      // Apply the same filters as findAll
      if (filters.company) {
        query += ' AND company LIKE @company';
        queryParams.push({ name: 'company', value: `%${filters.company}%`, type: sql.NVarChar });
      }
      
      if (filters.jobPostingId) {
        query += ' AND jobPostingId LIKE @jobPostingId';
        queryParams.push({ name: 'jobPostingId', value: `%${filters.jobPostingId}%`, type: sql.NVarChar });
      }
      
      if (filters.jobTitle) {
        query += ' AND jobTitle LIKE @jobTitle';
        queryParams.push({ name: 'jobTitle', value: `%${filters.jobTitle}%`, type: sql.NVarChar });
      }
      
      if (filters.candidateName) {
        query += ' AND candidateName LIKE @candidateName';
        queryParams.push({ name: 'candidateName', value: `%${filters.candidateName}%`, type: sql.NVarChar });
      }
      
      if (filters.submittedBy) {
        query += ' AND submittedBy LIKE @submittedBy';
        queryParams.push({ name: 'submittedBy', value: `%${filters.submittedBy}%`, type: sql.NVarChar });
      }
      
      if (filters.status) {
        query += ' AND status LIKE @status';
        queryParams.push({ name: 'status', value: `%${filters.status}%`, type: sql.NVarChar });
      }
      
      // Date filtering
      if (filters.startDate) {
        query += ' AND submitDate >= @startDate';
        queryParams.push({ name: 'startDate', value: new Date(filters.startDate), type: sql.DateTime2 });
      }
      
      if (filters.endDate) {
        const endDate = new Date(filters.endDate);
        endDate.setHours(23, 59, 59, 999); // Set to end of day
        query += ' AND submitDate <= @endDate';
        queryParams.push({ name: 'endDate', value: endDate, type: sql.DateTime2 });
      }
      
      // Build and execute the query
      const request = pool.request();
      queryParams.forEach(param => {
        request.input(param.name, param.type, param.value);
      });
      
      const result = await request.query(query);
      return result.recordset[0].count;
    } catch (error) {
      console.error('Error counting candidates:', error);
      throw error;
    }
  }

  // Find candidate by ID
  static async findById(id) {
    try {
      const pool = await poolPromise;
      const result = await pool.request()
        .input('id', sql.Int, id)
        .query('SELECT * FROM Candidates WHERE id = @id');
      
      if (result.recordset.length === 0) return null;
      return new Candidate(result.recordset[0]);
    } catch (error) {
      console.error('Error finding candidate by ID:', error);
      throw error;
    }
  }

  // Create new candidate
  static async create(data) {
    try {
      const pool = await poolPromise;
      const result = await pool.request()
        .input('company', sql.NVarChar, data.company || '')
        .input('jobPostingId', sql.NVarChar, data.jobPostingId || '')
        .input('jobTitle', sql.NVarChar, data.jobTitle || '')
        .input('candidateName', sql.NVarChar, data.candidateName)
        .input('submittedBy', sql.NVarChar, data.submittedBy || '')
        .input('submitDate', sql.DateTime2, data.submitDate || new Date())
        .input('status', sql.NVarChar, data.status)
        .input('rejectionReason', sql.NVarChar, data.rejectionReason || '')
        .input('notes', sql.NVarChar, data.notes || '')
        .input('createdBy', sql.Int, data.createdBy)
        .query(`
          INSERT INTO Candidates (company, jobPostingId, jobTitle, candidateName, submittedBy, submitDate, status, rejectionReason, notes, createdBy, createdAt)
          OUTPUT INSERTED.*
          VALUES (@company, @jobPostingId, @jobTitle, @candidateName, @submittedBy, @submitDate, @status, @rejectionReason, @notes, @createdBy, GETDATE())
        `);
      
      return new Candidate(result.recordset[0]);
    } catch (error) {
      console.error('Error creating candidate:', error);
      throw error;
    }
  }

  // Update candidate
  static async update(id, updateData) {
    try {
      const pool = await poolPromise;
      await pool.request()
        .input('id', sql.Int, id)
        .input('status', sql.NVarChar, updateData.status)
        .input('rejectionReason', sql.NVarChar, updateData.rejectionReason || '')
        .input('notes', sql.NVarChar, updateData.notes || '')
        .query(`
          UPDATE Candidates
          SET status = @status,
              rejectionReason = @rejectionReason,
              notes = @notes
          WHERE id = @id
        `);
      
      return await Candidate.findById(id);
    } catch (error) {
      console.error('Error updating candidate:', error);
      throw error;
    }
  }

  // Get status counts
  static async getStatusCounts() {
    try {
      const pool = await poolPromise;
      const candidates = await Candidate.findAll();
      
      return {
        total: candidates.length,
        selected: candidates.filter(c => c.getStatusCategory() === 'Selected').length,
        rejected: candidates.filter(c => 
          c.getStatusCategory() === 'Rejected' && 
          (!c.rejectionReason || !c.rejectionReason.toLowerCase().includes('neutral'))
        ).length,
        neutral: candidates.filter(c => 
          (c.getStatusCategory() === 'Rejected' && 
           c.rejectionReason && 
           c.rejectionReason.toLowerCase().includes('neutral')) ||
          c.getStatusCategory() === 'Neutral'
        ).length,
        interview: candidates.filter(c => c.getStatusCategory() === 'Interview').length,
        shortlisted: candidates.filter(c => c.getStatusCategory() === 'Shortlisted').length,
        other: candidates.filter(c => c.getStatusCategory() === 'Other').length
      };
    } catch (error) {
      console.error('Error getting status counts:', error);
      throw error;
    }
  }
}

module.exports = Candidate;