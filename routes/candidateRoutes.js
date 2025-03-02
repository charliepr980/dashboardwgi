const express = require('express');
const candidateController = require('../controllers/candidateController');
const { prepareUploadDir } = require('../middleware/upload');

module.exports = (app) => {
  // Candidate tracking
  app.get('/candidates', app.checkAuthenticated, candidateController.getCandidates);
  
  // Import candidates
  app.get('/candidates/import', app.checkAuthenticated, app.checkAdmin, candidateController.getImportCandidates);
  app.post('/candidates/import', app.checkAuthenticated, app.checkAdmin, prepareUploadDir, candidateController.postImportCandidates);
  
  // Export candidates
  app.get('/candidates/export', app.checkAuthenticated, candidateController.exportCandidates);
  
  // Clear candidates (admin only)
  app.delete('/candidates/clear', app.checkAuthenticated, app.checkAdmin, candidateController.clearCandidates);
  
  // Edit candidate
  app.get('/candidates/edit/:id', app.checkAuthenticated, candidateController.getEditCandidate);
  app.post('/candidates/edit/:id', app.checkAuthenticated, candidateController.putEditCandidate);
  
  // Mass update candidates
  app.put('/candidates/mass-update', app.checkAuthenticated, candidateController.massPutEditCandidates);
};