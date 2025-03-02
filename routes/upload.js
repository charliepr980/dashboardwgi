const express = require('express');
const router = express.Router();
const { getUpload, postUpload, deleteReport } = require('../controllers/uploadController');
const { prepareUploadDir } = require('../middleware/upload');

// Upload management page
router.get('/', getUpload);

// Process file upload
router.post('/', prepareUploadDir, postUpload);

// Delete report
router.delete('/delete/:id', deleteReport);

module.exports = router;
