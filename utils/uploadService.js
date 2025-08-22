const multer = require('multer');
const cloudinary = require('../config/cloudinary');
const { Readable } = require('stream');

// Configure multer for memory storage
const storage = multer.memoryStorage();

// File filter function
const fileFilter = (req, file, cb) => {
  // Allow PDFs and common image formats
  const allowedTypes = [
    'application/pdf',
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'image/webp'
  ];

  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only PDF, JPEG, PNG, GIF, and WebP files are allowed.'), false);
  }
};

// Create multer instance
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
});

// Convert buffer to readable stream
const bufferToStream = (buffer) => {
  const readable = new Readable();
  readable.push(buffer);
  readable.push(null);
  return readable;
};

// Upload file to Cloudinary
const uploadToCloudinary = (buffer, options = {}) => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        resource_type: 'auto', // Automatically detect file type
        folder: options.folder || 'knowledge-vault', // Organize files in folders
        public_id: options.public_id, // Custom public ID if provided
        overwrite: options.overwrite || false,
        ...options,
      },
      (error, result) => {
        if (error) {
          reject(error);
        } else {
          resolve(result);
        }
      }
    );

    bufferToStream(buffer).pipe(stream);
  });
};

// Upload PDF file
const uploadPDF = async (buffer, options = {}) => {
  const uploadOptions = {
    folder: 'knowledge-vault/pdfs',
    resource_type: 'raw', // Use 'raw' for PDF files
    ...options,
  };

  return await uploadToCloudinary(buffer, uploadOptions);
};

// Upload image file
const uploadImage = async (buffer, options = {}) => {
  const uploadOptions = {
    folder: 'knowledge-vault/images',
    resource_type: 'image',
    transformation: [
      { quality: 'auto', fetch_format: 'auto' }, // Optimize image quality and format
    ],
    ...options,
  };

  return await uploadToCloudinary(buffer, uploadOptions);
};

// Delete file from Cloudinary
const deleteFromCloudinary = async (publicId, resourceType = 'image') => {
  return new Promise((resolve, reject) => {
    cloudinary.uploader.destroy(
      publicId,
      { resource_type: resourceType },
      (error, result) => {
        if (error) {
          reject(error);
        } else {
          resolve(result);
        }
      }
    );
  });
};

// Get file info from Cloudinary
const getFileInfo = async (publicId, resourceType = 'image') => {
  return new Promise((resolve, reject) => {
    cloudinary.api.resource(
      publicId,
      { resource_type: resourceType },
      (error, result) => {
        if (error) {
          reject(error);
        } else {
          resolve(result);
        }
      }
    );
  });
};

// Generate optimized image URL
const generateOptimizedImageUrl = (publicId, options = {}) => {
  return cloudinary.url(publicId, {
    resource_type: 'image',
    transformation: [
      { quality: 'auto', fetch_format: 'auto' },
      { width: options.width, height: options.height, crop: options.crop || 'fill' },
    ],
    secure: true,
    ...options,
  });
};

module.exports = {
  upload,
  uploadPDF,
  uploadImage,
  deleteFromCloudinary,
  getFileInfo,
  generateOptimizedImageUrl,
};