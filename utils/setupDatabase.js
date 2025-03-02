const fs = require('fs');
const path = require('path');
const { poolPromise, sql } = require('./db');

// ANSI color codes for better readability
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

const setupDatabase = async () => {
  console.log(`${colors.bright}${colors.blue}Setting up database...${colors.reset}`);
  
  try {
    const pool = await poolPromise;
    
    // Check if Users table exists
    const tableResult = await pool.request().query(`
      SELECT COUNT(*) as count 
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_NAME = 'Users'
    `);
    
    if (tableResult.recordset[0].count > 0) {
      console.log(`${colors.yellow}Tables already exist. Skipping database setup.${colors.reset}`);
      return;
    }
    
    console.log(`${colors.bright}${colors.green}Creating database tables...${colors.reset}`);
    
    // Create Users table
    await pool.request().query(`
      CREATE TABLE Users (
        id VARCHAR(50) PRIMARY KEY,
        name NVARCHAR(100) NOT NULL,
        email NVARCHAR(100) NOT NULL UNIQUE,
        password NVARCHAR(100) NOT NULL,
        role NVARCHAR(20) NOT NULL DEFAULT 'user',
        createdAt DATETIME NOT NULL DEFAULT GETDATE()
      )
    `);
    console.log(`${colors.green}✓ Users table created${colors.reset}`);
    
    // Create Reports table
    await pool.request().query(`
      CREATE TABLE Reports (
        id VARCHAR(50) PRIMARY KEY,
        filename NVARCHAR(255) NOT NULL,
        uploadDate DATETIME NOT NULL,
        uploadedBy VARCHAR(50) REFERENCES Users(id),
        lightIndustrialCount INT NOT NULL DEFAULT 0,
        professionalCount INT NOT NULL DEFAULT 0,
        submissionsCount INT NOT NULL DEFAULT 0,
        lightIndustrialSubmissionsCount INT NOT NULL DEFAULT 0,
        professionalSubmissionsCount INT NOT NULL DEFAULT 0
      )
    `);
    console.log(`${colors.green}✓ Reports table created${colors.reset}`);
    
    // Create HistoricalData table
    await pool.request().query(`
      CREATE TABLE HistoricalData (
        id VARCHAR(50) PRIMARY KEY,
        reportId VARCHAR(50) REFERENCES Reports(id),
        created DATETIME NOT NULL,
        age INT,
        jobId NVARCHAR(50),
        ourId NVARCHAR(50),
        company NVARCHAR(255),
        title NVARCHAR(255),
        openings INT DEFAULT 1,
        submitted INT DEFAULT 0,
        interview INT DEFAULT 0,
        status NVARCHAR(50),
        type NVARCHAR(50)
      )
    `);
    console.log(`${colors.green}✓ HistoricalData table created${colors.reset}`);
    
    // Create JoinedEmployees table
    await pool.request().query(`
      CREATE TABLE JoinedEmployees (
        id VARCHAR(50) PRIMARY KEY,
        historicalId VARCHAR(50) NULL,
        employeeName NVARCHAR(100) NOT NULL,
        jobTitle NVARCHAR(255),
        company NVARCHAR(255),
        startDate DATETIME,
        joinedDate DATETIME NOT NULL,
        type NVARCHAR(50) NOT NULL,
        recruiterTeam NVARCHAR(50),
        createdBy VARCHAR(50) REFERENCES Users(id),
        createdAt DATETIME NOT NULL DEFAULT GETDATE()
      )
    `);
    console.log(`${colors.green}✓ JoinedEmployees table created${colors.reset}`);
    
    // Create Interviews table
    await pool.request().query(`
      CREATE TABLE Interviews (
        id VARCHAR(50) PRIMARY KEY,
        candidateId VARCHAR(50),
        historicalId VARCHAR(50),
        interviewDate DATETIME NOT NULL,
        status NVARCHAR(50) NOT NULL,
        notes NVARCHAR(MAX),
        createdBy VARCHAR(50) REFERENCES Users(id),
        createdAt DATETIME NOT NULL DEFAULT GETDATE()
      )
    `);
    console.log(`${colors.green}✓ Interviews table created${colors.reset}`);
    
    // Create Candidates table
    await pool.request().query(`
      CREATE TABLE Candidates (
        id VARCHAR(50) PRIMARY KEY,
        name NVARCHAR(100) NOT NULL,
        email NVARCHAR(100),
        phone NVARCHAR(20),
        position NVARCHAR(255),
        status NVARCHAR(50),
        resumeUrl NVARCHAR(255),
        createdBy VARCHAR(50) REFERENCES Users(id),
        createdAt DATETIME NOT NULL DEFAULT GETDATE()
      )
    `);
    console.log(`${colors.green}✓ Candidates table created${colors.reset}`);
    
    // Create Relocations table
    await pool.request().query(`
      CREATE TABLE Relocations (
        id VARCHAR(50) PRIMARY KEY,
        candidateId VARCHAR(50) REFERENCES Candidates(id),
        fromLocation NVARCHAR(255) NOT NULL,
        toLocation NVARCHAR(255) NOT NULL,
        relocationDate DATETIME,
        status NVARCHAR(50) NOT NULL,
        budget DECIMAL(10,2),
        createdBy VARCHAR(50) REFERENCES Users(id),
        createdAt DATETIME NOT NULL DEFAULT GETDATE()
      )
    `);
    console.log(`${colors.green}✓ Relocations table created${colors.reset}`);
    
    // Create RelocationNotes table
    await pool.request().query(`
      CREATE TABLE RelocationNotes (
        id VARCHAR(50) PRIMARY KEY,
        relocationId VARCHAR(50) REFERENCES Relocations(id),
        note NVARCHAR(MAX) NOT NULL,
        createdBy VARCHAR(50) REFERENCES Users(id),
        createdAt DATETIME NOT NULL DEFAULT GETDATE()
      )
    `);
    console.log(`${colors.green}✓ RelocationNotes table created${colors.reset}`);
    
    // Insert default admin user
    await pool.request()
      .input('id', sql.VarChar, 'admin1')
      .input('name', sql.NVarChar, 'Admin User')
      .input('email', sql.NVarChar, 'admin@example.com')
      .input('password', sql.NVarChar, 'admin123')
      .input('role', sql.NVarChar, 'admin')
      .query(`
        INSERT INTO Users (id, name, email, password, role, createdAt)
        VALUES (@id, @name, @email, @password, @role, GETDATE())
      `);
    console.log(`${colors.green}✓ Default admin user created${colors.reset}`);
    console.log(`${colors.cyan}   Email: admin@example.com${colors.reset}`);
    console.log(`${colors.cyan}   Password: admin123${colors.reset}`);
    
    console.log(`${colors.bright}${colors.green}Database setup completed successfully!${colors.reset}`);
  } catch (error) {
    console.error(`${colors.red}Error setting up database: ${error.message}${colors.reset}`);
    console.error(error);
  }
};

// If this file is run directly, execute the setup
if (require.main === module) {
  setupDatabase().then(() => {
    process.exit(0);
  }).catch(err => {
    console.error(`${colors.red}Unhandled error:${colors.reset}`, err);
    process.exit(1);
  });
}

module.exports = setupDatabase;