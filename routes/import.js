// routes/import.js
const express = require('express');
const router = express.Router();
const importController = require('../controllers/importController');
const { prepareUploadDir } = require('../middleware/upload');

// Import joined employees
router.get('/joined', importController.getImportJoined);
router.post('/joined', prepareUploadDir, importController.postImportJoined);
router.get('/joined/template', importController.getJoinedTemplate);

module.exports = router;