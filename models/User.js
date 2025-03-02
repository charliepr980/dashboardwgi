// models/user.js
const bcrypt = require('bcryptjs');
const { poolPromise, sql } = require('../utils/db');

class User {
  constructor(data) {
    this.id = data.id;
    this.name = data.name;
    this.email = data.email;
    this.password = data.password;
    this.role = data.role || 'user';
    this.createdAt = data.createdAt;
  }

  // Find user by ID
  static async findById(id) {
    try {
      const pool = await poolPromise;
      const result = await pool.request()
        .input('id', sql.Int, id)
        .query('SELECT * FROM Users WHERE id = @id');
      
      if (result.recordset.length === 0) return null;
      return new User(result.recordset[0]);
    } catch (error) {
      console.error('Error finding user by ID:', error);
      throw error;
    }
  }

  // Find user by email
  static async findByEmail(email) {
    try {
      const pool = await poolPromise;
      const result = await pool.request()
        .input('email', sql.NVarChar, email)
        .query('SELECT * FROM Users WHERE email = @email');
      
      if (result.recordset.length === 0) return null;
      return new User(result.recordset[0]);
    } catch (error) {
      console.error('Error finding user by email:', error);
      throw error;
    }
  }

  // Create new user
  static async create(userData) {
    try {
      // Hash the password
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(userData.password, salt);
      
      const pool = await poolPromise;
      const result = await pool.request()
        .input('name', sql.NVarChar, userData.name)
        .input('email', sql.NVarChar, userData.email)
        .input('password', sql.NVarChar, hashedPassword)
        .input('role', sql.NVarChar, userData.role || 'user')
        .query(`
          INSERT INTO Users (name, email, password, role)
          OUTPUT INSERTED.*
          VALUES (@name, @email, @password, @role)
        `);
      
      return new User(result.recordset[0]);
    } catch (error) {
      console.error('Error creating user:', error);
      throw error;
    }
  }

  // Update user
  async update(updateData) {
    try {
      const pool = await poolPromise;
      const request = pool.request()
        .input('id', sql.Int, this.id)
        .input('name', sql.NVarChar, updateData.name || this.name)
        .input('email', sql.NVarChar, updateData.email || this.email)
        .input('role', sql.NVarChar, updateData.role || this.role);
      
      let query = `
        UPDATE Users
        SET name = @name, email = @email, role = @role
      `;
      
      // Only update password if provided
      if (updateData.password) {
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(updateData.password, salt);
        request.input('password', sql.NVarChar, hashedPassword);
        query += `, password = @password`;
      }
      
      query += ` WHERE id = @id`;
      
      await request.query(query);
      
      // Update current instance with new data
      this.name = updateData.name || this.name;
      this.email = updateData.email || this.email;
      this.role = updateData.role || this.role;
      
      return this;
    } catch (error) {
      console.error('Error updating user:', error);
      throw error;
    }
  }

  // Delete user
  async delete() {
    try {
      const pool = await poolPromise;
      await pool.request()
        .input('id', sql.Int, this.id)
        .query('DELETE FROM Users WHERE id = @id');
      
      return true;
    } catch (error) {
      console.error('Error deleting user:', error);
      throw error;
    }
  }

  // Get all users
  static async findAll() {
    try {
      const pool = await poolPromise;
      const result = await pool.request()
        .query('SELECT * FROM Users ORDER BY createdAt DESC');
      
      return result.recordset.map(user => new User(user));
    } catch (error) {
      console.error('Error finding all users:', error);
      throw error;
    }
  }

  // Compare password
  async comparePassword(password) {
    return await bcrypt.compare(password, this.password);
  }
}

module.exports = User;