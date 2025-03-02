# Recruitment Dashboard

A comprehensive recruitment dashboard application built with Express.js and Azure SQL Database.

## Features

- User Authentication (Admin/User roles)
- Dashboard with date range filters
- Historical data management
- Joined employees tracking
- Monthly statistics
- Relocation management
- Candidate tracking
- Interview scheduling
- File upload and import/export functionality

## Tech Stack

- Node.js
- Express.js
- Azure SQL Database
- EJS Templates
- XLSX for Excel file processing

## Setup Instructions

### Prerequisites

- Node.js 14+ installed
- Azure SQL Database instance
- Git

### Local Development Setup

1. Clone the repository:
   ```
   git clone <repository-url>
   cd recruitment-dashboard
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Create a `.env` file in the root directory with the following variables:
   ```
   PORT=3000
   DB_USER=your_db_username
   DB_PASSWORD=your_db_password
   DB_SERVER=your_server_name.database.windows.net
   DB_NAME=recruitment_dashboard
   SESSION_SECRET=recruitment_dashboard_secret
   ```

4. Initialize the database:
   ```
   npm run init-db
   ```

5. Start the development server:
   ```
   npm run dev
   ```

6. Access the application at `http://localhost:3000`

### Deployment to Azure Web App

1. Create an Azure Web App
2. Configure the following application settings in the Azure portal:
   - DB_USER
   - DB_PASSWORD
   - DB_SERVER
   - DB_NAME
   - SESSION_SECRET

3. Deploy your code using Azure DevOps, GitHub Actions, or the Azure CLI

## Database Schema

The application uses an Azure SQL Database with the following main tables:

- Users
- Reports
- HistoricalData
- JoinedEmployees
- Interviews
- Relocations
- RelocationNotes
- Candidates

## Default Login Credentials

- Admin User:
  - Email: clopez@weilgroup.com
  - Password: admin123

- Regular User:
  - Email: emmanuel.lugo@weilgroup.com
  - Password: user123

## License

[Your License Information]