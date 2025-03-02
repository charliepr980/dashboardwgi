// routes/interviewRoutes.js
const express = require('express');
const interviewController = require('../controllers/interviewController');
const { prepareUploadDir } = require('../middleware/upload');

module.exports = (app) => {
  // Interview management
  app.get('/interviews', app.checkAuthenticated, interviewController.getInterviews);
  
  // Add interview
  app.get('/interviews/add', app.checkAuthenticated, interviewController.getAddInterview);
  app.post('/interviews/add', app.checkAuthenticated, interviewController.postAddInterview);
  
  // Edit interview
  app.get('/interviews/edit/:id', app.checkAuthenticated, interviewController.getEditInterview);
  app.put('/interviews/edit/:id', app.checkAuthenticated, interviewController.putEditInterview);
  
  // Delete interview
  app.delete('/interviews/delete/:id', app.checkAuthenticated, interviewController.deleteInterview);
  
  // Import interviews
  app.get('/interviews/import', app.checkAuthenticated, app.checkAdmin, interviewController.getImportInterviews);
  app.post('/interviews/import', app.checkAuthenticated, app.checkAdmin, prepareUploadDir, interviewController.postImportInterviews);
  app.get('/interviews/template', app.checkAuthenticated, app.checkAdmin, interviewController.getInterviewsTemplate);
  
  // Export interviews
  app.get('/interviews/export', app.checkAuthenticated, interviewController.exportInterviews);
};