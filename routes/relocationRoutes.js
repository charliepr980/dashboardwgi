const express = require('express');
const relocationController = require('../controllers/relocationController');
const { prepareUploadDir } = require('../middleware/upload');

module.exports = (app) => {
  // Relocation management
  app.get('/relocations', app.checkAuthenticated, relocationController.getRelocations);
  
  // Create relocation
  app.get('/relocations/create', app.checkAuthenticated, relocationController.getCreateRelocation);
  app.post('/relocations/create', app.checkAuthenticated, relocationController.createRelocation);
  
  // View relocation
  app.get('/relocations/view/:id', app.checkAuthenticated, relocationController.getRelocation);
  
  // Edit relocation
  app.get('/relocations/edit/:id', app.checkAuthenticated, relocationController.getEditRelocation);
  app.post('/relocations/edit/:id', app.checkAuthenticated, relocationController.updateRelocation);
  
  // Add note to relocation
  app.post('/relocations/note/:id', app.checkAuthenticated, relocationController.addNote);
  
  // Export relocations
  app.get('/relocations/export', app.checkAuthenticated, relocationController.exportRelocations);
  
  // Import relocations
  app.get('/relocations/import', app.checkAuthenticated, app.checkAdmin, relocationController.getImportRelocations);
  app.post('/relocations/import', app.checkAuthenticated, app.checkAdmin, prepareUploadDir, relocationController.importRelocations);
};