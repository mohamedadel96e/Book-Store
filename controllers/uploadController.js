const asyncHandler = require('express-async-handler');
const { uploadPDF, uploadImage, deleteFromCloudinary } = require('../utils/uploadService');

// @desc    Upload PDF file
// @route   POST /api/upload/pdf
// @access  Private/Watcher
const uploadPDFFile = asyncHandler(async (req, res) => {
  if (!req.file) {
    res.status(400);
    throw new Error('No file uploaded');
  }

  if (req.file.mimetype !== 'application/pdf') {
    res.status(400);
    throw new Error('Only PDF files are allowed');
  }

  try {
    console.log("Hello world");
    const sanitizePublicId = (filename) => {
      return filename.replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase();
    };
    
    const publicId = req.body.public_id 
      ? sanitizePublicId(req.body.public_id)
      : `${Date.now()}_${sanitizePublicId(req.file.originalname.replace(/\.[^/.]+$/, ""))}`;
    
    const result = await uploadPDF(req.file.buffer, {
      public_id: publicId,
      overwrite: req.body.overwrite === 'true', // Optional overwrite
    });

    res.status(200).json({
      success: true,
      message: 'PDF uploaded successfully',
      data: {
        public_id: result.public_id,
        secure_url: result.secure_url,
        original_filename: req.file.originalname,
        format: result.format,
        bytes: result.bytes,
        created_at: result.created_at,
      },
    });
  } catch (error) {
    res.status(500);
    throw new Error(`Upload failed: ${error.message}`);
  }
});

// @desc    Upload image file
// @route   POST /api/upload/image
// @access  Private/Watcher
const uploadImageFile = asyncHandler(async (req, res) => {
  if (!req.file) {
    res.status(400);
    throw new Error('No file uploaded');
  }

  const allowedImageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
  if (!allowedImageTypes.includes(req.file.mimetype)) {
    res.status(400);
    throw new Error('Only JPEG, PNG, GIF, and WebP images are allowed');
  }

  try {
    const result = await uploadImage(req.file.buffer, {
      public_id: req.body.public_id, // Optional custom ID
      overwrite: req.body.overwrite === 'true', // Optional overwrite
    });

    res.status(200).json({
      success: true,
      message: 'Image uploaded successfully',
      data: {
        public_id: result.public_id,
        secure_url: result.secure_url,
        original_filename: req.file.originalname,
        format: result.format,
        width: result.width,
        height: result.height,
        bytes: result.bytes,
        created_at: result.created_at,
      },
    });
  } catch (error) {
    res.status(500);
    throw new Error(`Upload failed: ${error.message}`);
  }
});

// @desc    Upload multiple files (PDFs and images)
// @route   POST /api/upload/multiple
// @access  Private/Watcher
const uploadMultipleFiles = asyncHandler(async (req, res) => {
  if (!req.files || req.files.length === 0) {
    res.status(400);
    throw new Error('No files uploaded');
  }

  const uploadResults = [];
  const errors = [];

  for (const file of req.files) {
    try {
      let result;
      if (file.mimetype === 'application/pdf') {
        result = await uploadPDF(file.buffer);
      } else if (file.mimetype.startsWith('image/')) {
        result = await uploadImage(file.buffer);
      } else {
        errors.push({
          filename: file.originalname,
          error: 'Unsupported file type',
        });
        continue;
      }

      uploadResults.push({
        original_filename: file.originalname,
        public_id: result.public_id,
        secure_url: result.secure_url,
        format: result.format,
        bytes: result.bytes,
        type: file.mimetype.startsWith('image/') ? 'image' : 'pdf',
      });
    } catch (error) {
      errors.push({
        filename: file.originalname,
        error: error.message,
      });
    }
  }

  res.status(200).json({
    success: true,
    message: `${uploadResults.length} files uploaded successfully`,
    data: uploadResults,
    errors: errors.length > 0 ? errors : undefined,
  });
});

// @desc    Delete file from Cloudinary
// @route   DELETE /api/upload/:publicId
// @access  Private/Watcher
const deleteFile = asyncHandler(async (req, res) => {
  const { publicId } = req.params;
  const { resourceType = 'image' } = req.query; // Default to image, can be 'raw' for PDFs

  if (!publicId) {
    res.status(400);
    throw new Error('Public ID is required');
  }

  try {
    const result = await deleteFromCloudinary(publicId, resourceType);

    if (result.result === 'ok') {
      res.status(200).json({
        success: true,
        message: 'File deleted successfully',
        data: { publicId, result: result.result },
      });
    } else {
      res.status(404);
      throw new Error('File not found or already deleted');
    }
  } catch (error) {
    res.status(500);
    throw new Error(`Delete failed: ${error.message}`);
  }
});

module.exports = {
  uploadPDFFile,
  uploadImageFile,
  uploadMultipleFiles,
  deleteFile,
};