// middlewares/catsOneMiddleware.js
const axios = require('axios');

// CatsOne API configuration
const CATSONE_API_KEY = '7e2f011c8921320550eb74960f3e1c26';
const CATSONE_API_URL = 'https://api.catsone.com/v3';

// Create axios instance with CatsOne API configuration
const catsOneApiClient = axios.create({
  baseURL: CATSONE_API_URL,
  headers: {
    'Authorization': `Token ${CATSONE_API_KEY}`,
    'Content-Type': 'application/json'
  },
  timeout: 10000 // 10 seconds timeout
});

// Middleware to validate CatsOne API connection
const validateCatsOneApiConnection = async (req, res, next) => {
  try {
    // Instead of using /ping, try the /jobs endpoint with a very limited result
    await catsOneApiClient.get('/jobs', { params: { limit: 1 } });
    next();
  } catch (error) {
    console.error('Error connecting to CatsOne API:', error.message);
    req.flash('error_msg', 'Failed to connect to CatsOne API. Please try again later.');
    res.redirect('/dashboard');
  }
};

// Make the API client available to controllers
const catsOneApi = (req, res, next) => {
  req.catsOneApi = catsOneApiClient;
  next();
};

module.exports = {
  catsOneApi,
  validateCatsOneApiConnection
};