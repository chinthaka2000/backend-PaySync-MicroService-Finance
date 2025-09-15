const multer = require("multer");
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const cloudinary = require("../utils/cloudinary");
const { createFileFilter, getFileSizeLimit } = require("../validation/fileValidation");
const fileService = require("../services/fileService");
const { AppError } = require("../utils/customErrors");
const logger = require("../utils/logger");

/**
 * Enhanced Cloudinary storage configuration with validation
 * @param {string} fileType - Type of files (DOCUMENTS, IMAGES, ID_DOCUMENTS, AGREEMENTS)
 * @param {string} folder - Cloudinary folder name
 * @returns {CloudinaryStorage} Configured storage
 */
const createCloudinaryStorage = (fileType = 'ID_DOCUMENTS', folder = 'paysync_clients') => {
  return new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
      folder: (req, file) => {
        // Generate dynamic folder based on user and category
        const userId = req.user?.userId || 'anonymous';
        const category = fileType.toLowerCase().replace('_', '');
        return fileService.generateFolderPath(category, userId);
      },
      allowed_formats: getFileExtensionsForType(fileType),
      public_id: (req, file) => {
        // Create secure filename with proper naming conventions
        const userId = req.user?.userId || 'anonymous';
        const category = fileType.toLowerCase().replace('_', '');
        return fileService.generateSecureFilename(file.originalname, userId, category)
          .replace(/\.[^/.]+$/, ''); // Remove extension for Cloudinary
      },
      resource_type: (req, file) => {
        // Determine resource type based on file
        if (file.mimetype.startsWith('image/')) return 'image';
        if (file.mimetype === 'application/pdf') return 'raw';
        return 'auto';
      },
      context: (req, file) => {
        // Add metadata for tracking
        return {
          uploaded_by: req.user?.userId || 'anonymous',
          upload_timestamp: new Date().toISOString(),
          original_name: file.originalname,
          file_type: fileType,
          ip_address: req.ip || req.connection.remoteAddress
        };
      },
      tags: (req, file) => {
        // Add tags for organization
        const userId = req.user?.userId || 'anonymous';
        const category = fileType.toLowerCase().replace('_', '');
        return ['paysync', category, userId, new Date().getFullYear().toString()];
      }
    },
  });
};

/**
 * Get file extensions for a specific file type
 * @param {string} fileType - File type configuration key
 * @returns {Array} Array of allowed extensions
 */
const getFileExtensionsForType = (fileType) => {
  const typeMap = {
    'DOCUMENTS': ['pdf', 'doc', 'docx', 'txt'],
    'IMAGES': ['jpg', 'jpeg', 'png', 'gif', 'webp'],
    'ID_DOCUMENTS': ['jpg', 'jpeg', 'png', 'pdf'],
    'AGREEMENTS': ['pdf']
  };
  return typeMap[fileType] || ['jpg', 'png', 'pdf'];
};

/**
 * Create enhanced multer upload middleware
 * @param {string} fileType - Type of files to handle
 * @param {string} folder - Cloudinary folder
 * @returns {multer} Configured multer instance
 */
const createUpload = (fileType = 'ID_DOCUMENTS', folder = 'paysync_clients') => {
  const storage = createCloudinaryStorage(fileType, folder);

  return multer({
    storage,
    fileFilter: createFileFilter(fileType),
    limits: {
      fileSize: getFileSizeLimit(fileType),
      files: 10,
      fields: 20,
      fieldNameSize: 100,
      fieldSize: 1024 * 1024
    }
  });
};

/**
 * Enhanced upload middleware with security and logging
 * @param {string} fileType - File type configuration
 * @param {string} fieldName - Form field name
 * @param {Object} options - Additional options
 * @returns {Function} Express middleware
 */
const createSecureUpload = (fileType = 'ID_DOCUMENTS', fieldName = 'file', options = {}) => {
  const upload = createUpload(fileType);
  const { maxFiles = 1, requireAuth = true } = options;

  return [
    // Authentication check
    ...(requireAuth ? [require('../middlewares/authMiddleware').authenticate] : []),

    // File upload middleware
    maxFiles === 1 ? upload.single(fieldName) : upload.array(fieldName, maxFiles),

    // Post-upload processing
    async (req, res, next) => {
      try {
        // Log file upload
        if (req.file || req.files) {
          const files = req.files || [req.file];

          logger.audit('Files uploaded', {
            userId: req.user?.userId,
            fileCount: files.length,
            fileType,
            fieldName,
            files: files.map(f => ({
              originalName: f.originalname,
              size: f.size,
              mimetype: f.mimetype
            }))
          });

          // Add upload metadata to request
          req.uploadMetadata = {
            fileType,
            uploadedAt: new Date(),
            uploadedBy: req.user?.userId,
            ipAddress: req.ip
          };
        }

        next();
      } catch (error) {
        logger.error('File upload processing failed', {
          error: error.message,
          userId: req.user?.userId,
          fileType,
          fieldName
        });
        next(new AppError('File upload processing failed', 500, 'UPLOAD_PROCESSING_ERROR'));
      }
    }
  ];
};

// Default upload instance for backward compatibility
const upload = createUpload('ID_DOCUMENTS', 'paysync_clients');

// Specialized upload instances
const uploadClientDocuments = createUpload('ID_DOCUMENTS', 'paysync_clients');
const uploadAgreements = createUpload('AGREEMENTS', 'paysync_agreements');
const uploadGeneralDocuments = createUpload('DOCUMENTS', 'paysync_documents');
const uploadImages = createUpload('IMAGES', 'paysync_images');

// Secure upload middlewares
const secureClientDocuments = createSecureUpload('ID_DOCUMENTS', 'documents', { maxFiles: 5 });
const secureAgreements = createSecureUpload('AGREEMENTS', 'agreement', { maxFiles: 1 });
const secureGeneralDocuments = createSecureUpload('DOCUMENTS', 'document', { maxFiles: 3 });
const secureImages = createSecureUpload('IMAGES', 'image', { maxFiles: 1 });

module.exports = {
  upload, // Default export for backward compatibility
  createUpload,
  createSecureUpload,
  uploadClientDocuments,
  uploadAgreements,
  uploadGeneralDocuments,
  uploadImages,
  secureClientDocuments,
  secureAgreements,
  secureGeneralDocuments,
  secureImages,
  createCloudinaryStorage
};
