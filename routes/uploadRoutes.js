const express = require('express');
const router = express.Router();
const { uploadPDFFile, uploadImageFile, uploadMultipleFiles, deleteFile } = require('../controllers/uploadController');
const { protect, watcher } = require('../middleware/authMiddleware');
const { upload } = require('../utils/uploadService');

// Single PDF upload
router.post('/pdf', protect, watcher, upload.single('pdf'), uploadPDFFile);

// Single image upload
router.post('/image', protect, watcher, upload.single('image'), uploadImageFile);

// Multiple files upload (mixed PDFs and images)
router.post('/multiple', protect, watcher, upload.array('files', 10), uploadMultipleFiles);

// Delete file
router.delete('/:publicId', protect, watcher, deleteFile);

module.exports = router;