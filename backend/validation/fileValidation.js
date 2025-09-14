const multer = require('multer');
const path = require('path');

/**
 * File magic numbers for content validation
 */
const FILE_SIGNATURES = {
  'application/pdf': [0x25, 0x50, 0x44, 0x46], // %PDF
  'image/jpeg': [0xFF, 0xD8, 0xFF],
  'image/png': [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A],
  'image/gif': [0x47, 0x49, 0x46, 0x38], // GIF8
  'application/msword': [0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': [0x50, 0x4B, 0x03, 0x04], // ZIP signature
  'text/plain': null // Text files don't have a specific signature
};

/**
 * Validate file content against declared MIME type using magic numbers
 * @param {Buffer} buffer - File buffer
 * @param {string} mimeType - Declared MIME type
 * @returns {boolean} True if content matches declared type
 */
const validateFileContent = (buffer, mimeType) => {
  const signature = FILE_SIGNATURES[mimeType];

  // If no signature defined (like text files), assume valid
  if (!signature) return true;

  // Check if buffer is large enough
  if (buffer.length < signature.length) return false;

  // Compare magic numbers
  for (let i = 0; i < signature.length; i++) {
    if (buffer[i] !== signature[i]) return false;
  }

  return true;
};

// File type configurations
const FILE_TYPES = {
  DOCUMENTS: {
    mimeTypes: [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain'
    ],
    extensions: ['.pdf', '.doc', '.docx', '.txt'],
    maxSize: 5 * 1024 * 1024, // 5MB
    description: 'PDF, Word documents, or text files'
  },

  IMAGES: {
    mimeTypes: [
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/gif',
      'image/webp'
    ],
    extensions: ['.jpg', '.jpeg', '.png', '.gif', '.webp'],
    maxSize: 2 * 1024 * 1024, // 2MB
    description: 'JPEG, PNG, GIF, or WebP images'
  },

  ID_DOCUMENTS: {
    mimeTypes: [
      'image/jpeg',
      'image/jpg',
      'image/png',
      'application/pdf'
    ],
    extensions: ['.jpg', '.jpeg', '.png', '.pdf'],
    maxSize: 3 * 1024 * 1024, // 3MB
    description: 'JPEG, PNG images or PDF documents'
  },

  AGREEMENTS: {
    mimeTypes: [
      'application/pdf'
    ],
    extensions: ['.pdf'],
    maxSize: 10 * 1024 * 1024, // 10MB
    description: 'PDF documents only'
  }
};

/**
 * Create file filter function for specific file types
 * @param {string} fileType - Type of files to allow (DOCUMENTS, IMAGES, ID_DOCUMENTS, AGREEMENTS)
 * @returns {Function} Multer file filter function
 */
const createFileFilter = (fileType) => {
  const config = FILE_TYPES[fileType];

  if (!config) {
    throw new Error(`Invalid file type configuration: ${fileType}`);
  }

  return (req, file, cb) => {
    // Check MIME type
    if (!config.mimeTypes.includes(file.mimetype)) {
      const error = new Error(`Invalid file type. Only ${config.description} are allowed.`);
      error.code = 'INVALID_FILE_TYPE';
      error.field = file.fieldname;
      return cb(error, false);
    }

    // Check file extension
    const fileExtension = path.extname(file.originalname).toLowerCase();
    if (!config.extensions.includes(fileExtension)) {
      const error = new Error(`Invalid file extension. Only ${config.extensions.join(', ')} are allowed.`);
      error.code = 'INVALID_FILE_EXTENSION';
      error.field = file.fieldname;
      return cb(error, false);
    }

    // File is valid
    cb(null, true);
  };
};

/**
 * Create file size limit function
 * @param {string} fileType - Type of files to check size for
 * @returns {number} Maximum file size in bytes
 */
const getFileSizeLimit = (fileType) => {
  const config = FILE_TYPES[fileType];
  return config ? config.maxSize : 1024 * 1024; // Default 1MB
};

/**
 * Validate uploaded files middleware
 * @param {string} fileType - Type of files to validate
 * @param {Object} fieldConfig - Multer field configuration
 * @param {Object} options - Additional validation options
 * @returns {Function} Express middleware function
 */
const validateFileUpload = (fileType, fieldConfig, options = {}) => {
  const config = FILE_TYPES[fileType];

  if (!config) {
    throw new Error(`Invalid file type configuration: ${fileType}`);
  }

  const upload = multer({
    fileFilter: createFileFilter(fileType),
    limits: {
      fileSize: options.maxSize || config.maxSize,
      files: options.maxFiles || 10, // Maximum files per request
      fields: options.maxFields || 20, // Maximum non-file fields
      fieldNameSize: options.maxFieldNameSize || 100, // Maximum field name size
      fieldSize: options.maxFieldSize || 1024 * 1024 // Maximum field value size (1MB)
    }
  });

  // Return appropriate multer middleware based on field configuration
  let multerMiddleware;
  if (Array.isArray(fieldConfig)) {
    multerMiddleware = upload.fields(fieldConfig);
  } else if (typeof fieldConfig === 'string') {
    multerMiddleware = upload.single(fieldConfig);
  } else if (fieldConfig.name && fieldConfig.maxCount) {
    multerMiddleware = upload.array(fieldConfig.name, fieldConfig.maxCount);
  } else {
    multerMiddleware = upload.any();
  }

  return (req, res, next) => {
    multerMiddleware(req, res, (err) => {
      if (err) {
        let errorMessage = 'File upload failed';
        let errorCode = 'FILE_UPLOAD_ERROR';

        if (err instanceof multer.MulterError) {
          switch (err.code) {
            case 'LIMIT_FILE_SIZE':
              errorMessage = `File too large. Maximum size allowed is ${(config.maxSize / (1024 * 1024)).toFixed(1)}MB`;
              errorCode = 'FILE_TOO_LARGE';
              break;
            case 'LIMIT_FILE_COUNT':
              errorMessage = 'Too many files uploaded';
              errorCode = 'TOO_MANY_FILES';
              break;
            case 'LIMIT_UNEXPECTED_FILE':
              errorMessage = 'Unexpected file field';
              errorCode = 'UNEXPECTED_FILE';
              break;
            case 'LIMIT_FIELD_COUNT':
              errorMessage = 'Too many fields';
              errorCode = 'TOO_MANY_FIELDS';
              break;
            case 'LIMIT_FIELD_KEY':
              errorMessage = 'Field name too long';
              errorCode = 'FIELD_NAME_TOO_LONG';
              break;
            case 'LIMIT_FIELD_VALUE':
              errorMessage = 'Field value too long';
              errorCode = 'FIELD_VALUE_TOO_LONG';
              break;
            default:
              errorMessage = err.message;
          }
        } else if (err.code === 'INVALID_FILE_TYPE' || err.code === 'INVALID_FILE_EXTENSION') {
          errorMessage = err.message;
          errorCode = err.code;
        }

        return res.status(400).json({
          success: false,
          error: {
            code: errorCode,
            message: errorMessage,
            field: err.field || 'file',
            allowedTypes: config.description,
            maxSize: `${(config.maxSize / (1024 * 1024)).toFixed(1)}MB`,
            timestamp: new Date().toISOString(),
            requestId: req.id || req.headers['x-request-id'] || 'unknown'
          }
        });
      }

      // Additional validation for uploaded files
      if (req.files || req.file) {
        const files = req.files ? Object.values(req.files).flat() : [req.file];

        for (const file of files) {
          if (file) {
            // Validate file name length
            if (file.originalname.length > 255) {
              return res.status(400).json({
                success: false,
                error: {
                  code: 'FILENAME_TOO_LONG',
                  message: 'Filename is too long. Maximum 255 characters allowed.',
                  field: file.fieldname,
                  filename: file.originalname,
                  timestamp: new Date().toISOString()
                }
              });
            }

            // Check for potentially dangerous file names
            const dangerousPatterns = [
              /\.\./,  // Directory traversal
              /[<>:"|?*]/,  // Invalid characters
              /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/i,  // Reserved names
              /^\./,  // Hidden files
              /\.(exe|bat|cmd|scr|pif|com|vbs|js|jar|app|deb|rpm)$/i  // Executable files
            ];

            if (dangerousPatterns.some(pattern => pattern.test(file.originalname))) {
              return res.status(400).json({
                success: false,
                error: {
                  code: 'INVALID_FILENAME',
                  message: 'Filename contains invalid characters, patterns, or is a potentially dangerous file type.',
                  field: file.fieldname,
                  filename: file.originalname,
                  timestamp: new Date().toISOString()
                }
              });
            }

            // Validate file content (basic magic number check)
            if (file.buffer && file.buffer.length > 0) {
              const isValidFileContent = validateFileContent(file.buffer, file.mimetype);
              if (!isValidFileContent) {
                return res.status(400).json({
                  success: false,
                  error: {
                    code: 'INVALID_FILE_CONTENT',
                    message: 'File content does not match the declared file type.',
                    field: file.fieldname,
                    filename: file.originalname,
                    declaredType: file.mimetype,
                    timestamp: new Date().toISOString()
                  }
                });
              }
            }

            // Add file metadata for logging
            file.uploadTimestamp = new Date().toISOString();
            file.uploadedBy = req.user?.userId || 'unknown';
            file.validatedType = fileType;
          }
        }
      }

      next();
    });
  };
};

/**
 * Validate specific file fields for client registration
 */
const validateClientDocuments = validateFileUpload('ID_DOCUMENTS', [
  { name: 'idCard', maxCount: 1 },
  { name: 'employmentLetter', maxCount: 1 },
  { name: 'incomeProof', maxCount: 1 },
  { name: 'addressProof', maxCount: 1 }
]);

/**
 * Validate agreement documents
 */
const validateAgreementDocuments = validateFileUpload('AGREEMENTS', 'agreement');

/**
 * Validate general document uploads
 */
const validateDocuments = validateFileUpload('DOCUMENTS', 'document');

/**
 * Validate image uploads
 */
const validateImages = validateFileUpload('IMAGES', 'image');

/**
 * Enhanced file validation for loan documents with stricter checks
 */
const validateLoanDocuments = validateFileUpload('DOCUMENTS', [
  { name: 'loanApplication', maxCount: 1 },
  { name: 'supportingDocuments', maxCount: 5 }
], { maxFiles: 6, maxSize: 8 * 1024 * 1024 }); // 8MB for loan docs

/**
 * Validate profile images with additional checks
 */
const validateProfileImages = validateFileUpload('IMAGES', 'profileImage', {
  maxSize: 1 * 1024 * 1024, // 1MB for profile images
  maxFiles: 1
});

module.exports = {
  FILE_TYPES,
  FILE_SIGNATURES,
  createFileFilter,
  getFileSizeLimit,
  validateFileUpload,
  validateFileContent,
  validateClientDocuments,
  validateAgreementDocuments,
  validateDocuments,
  validateImages,
  validateLoanDocuments,
  validateProfileImages
};