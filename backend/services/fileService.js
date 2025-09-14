const fs = require('fs').promises;
const path = require('path');
const cloudinary = require('../utils/cloudinary');
const { AppError } = require('../utils/customErrors');
const logger = require('../utils/logger');

/**
 * File Service for handling secure file operations
 */
class FileService {
  constructor() {
    this.uploadDir = process.env.UPLOAD_DIR || 'uploads';
    this.maxFileSize = {
      DOCUMENTS: 5 * 1024 * 1024, // 5MB
      IMAGES: 2 * 1024 * 1024, // 2MB
      ID_DOCUMENTS: 3 * 1024 * 1024, // 3MB
      AGREEMENTS: 10 * 1024 * 1024 // 10MB
    };
  }

  /**
   * Generate secure filename with proper naming conventions
   * @param {string} originalName - Original filename
   * @param {string} userId - User ID for organization
   * @param {string} category - File category (client, loan, agreement, etc.)
   * @returns {string} Secure filename
   */
  generateSecureFilename(originalName, userId, category = 'general') {
    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(2, 15);
    const extension = path.extname(originalName).toLowerCase();
    const sanitizedName = originalName
      .replace(/[^a-zA-Z0-9.-]/g, '_')
      .substring(0, 50); // Limit base name length

    return `${category}_${userId}_${timestamp}_${randomString}_${sanitizedName}${extension}`;
  }

  /**
   * Generate folder structure for file organization
   * @param {string} category - File category
   * @param {string} userId - User ID
   * @param {Date} date - Date for organization
   * @returns {string} Folder path
   */
  generateFolderPath(category, userId, date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    return `paysync/${category}/${year}/${month}/${userId}`;
  }

  /**
   * Upload file to Cloudinary with enhanced security and organization
   * @param {Object} file - Multer file object
   * @param {Object} options - Upload options
   * @returns {Promise<Object>} Upload result
   */
  async uploadFile(file, options = {}) {
    try {
      const {
        userId,
        category = 'general',
        folder = null,
        transformation = null,
        tags = []
      } = options;

      // Generate secure filename and folder
      const secureFilename = this.generateSecureFilename(file.originalname, userId, category);
      const folderPath = folder || this.generateFolderPath(category, userId);

      // Prepare upload options
      const uploadOptions = {
        folder: folderPath,
        public_id: secureFilename.replace(/\.[^/.]+$/, ''), // Remove extension
        resource_type: this.getResourceType(file.mimetype),
        tags: ['paysync', category, userId, ...tags],
        context: {
          uploaded_by: userId,
          category: category,
          original_name: file.originalname,
          upload_timestamp: new Date().toISOString()
        }
      };

      // Add transformation if provided
      if (transformation) {
        uploadOptions.transformation = transformation;
      }

      // Upload to Cloudinary
      const result = await cloudinary.uploader.upload(file.path || file.buffer, uploadOptions);

      // Log successful upload
      logger.info('File uploaded successfully', {
        fileId: result.public_id,
        userId,
        category,
        originalName: file.originalname,
        size: file.size,
        url: result.secure_url
      });

      return {
        fileId: result.public_id,
        url: result.secure_url,
        secureUrl: result.secure_url,
        originalName: file.originalname,
        size: file.size,
        format: result.format,
        resourceType: result.resource_type,
        folder: folderPath,
        tags: result.tags,
        uploadedAt: new Date(),
        uploadedBy: userId
      };

    } catch (error) {
      logger.error('File upload failed', {
        error: error.message,
        userId: options.userId,
        filename: file.originalname
      });
      throw new AppError(`File upload failed: ${error.message}`, 500, 'FILE_UPLOAD_ERROR');
    }
  }

  /**
   * Download file with access control
   * @param {string} fileId - Cloudinary public ID
   * @param {string} userId - Requesting user ID
   * @param {Object} permissions - User permissions
   * @returns {Promise<Object>} File download info
   */
  async downloadFile(fileId, userId, permissions = {}) {
    try {
      // Get file details from Cloudinary
      const fileDetails = await cloudinary.api.resource(fileId, {
        context: true,
        tags: true
      });

      // Check access permissions
      await this.checkFileAccess(fileDetails, userId, permissions);

      // Generate secure download URL with expiration
      const downloadUrl = cloudinary.url(fileId, {
        resource_type: fileDetails.resource_type,
        type: 'authenticated',
        sign_url: true,
        expires_at: Math.floor(Date.now() / 1000) + 3600 // 1 hour expiration
      });

      // Log download access
      logger.audit('File downloaded', {
        fileId,
        userId,
        originalName: fileDetails.context?.original_name,
        downloadUrl: downloadUrl.substring(0, 50) + '...' // Log partial URL for security
      });

      return {
        downloadUrl,
        filename: fileDetails.context?.original_name || fileId,
        size: fileDetails.bytes,
        format: fileDetails.format,
        uploadedAt: fileDetails.context?.upload_timestamp
      };

    } catch (error) {
      logger.error('File download failed', {
        error: error.message,
        fileId,
        userId
      });
      throw new AppError(`File download failed: ${error.message}`, 500, 'FILE_DOWNLOAD_ERROR');
    }
  }

  /**
   * Check file access permissions
   * @param {Object} fileDetails - File details from Cloudinary
   * @param {string} userId - Requesting user ID
   * @param {Object} permissions - User permissions
   */
  async checkFileAccess(fileDetails, userId, permissions) {
    const fileUserId = fileDetails.context?.uploaded_by;
    const fileCategory = fileDetails.tags?.find(tag =>
      ['client', 'loan', 'agreement', 'general'].includes(tag)
    );

    // Super admin and moderate admin can access all files
    if (permissions.canAccessAllFiles) {
      return true;
    }

    // Regional managers can access files in their region
    if (permissions.canAccessRegionalFiles && fileCategory) {
      // Additional region-based checks would go here
      return true;
    }

    // Users can access their own files
    if (fileUserId === userId) {
      return true;
    }

    // Agents can access files of their assigned clients
    if (permissions.canAccessClientFiles && fileCategory === 'client') {
      // Additional client assignment checks would go here
      return true;
    }

    throw new AppError('Access denied to this file', 403, 'FILE_ACCESS_DENIED');
  }

  /**
   * Delete file with proper cleanup
   * @param {string} fileId - Cloudinary public ID
   * @param {string} userId - User requesting deletion
   * @param {Object} permissions - User permissions
   * @returns {Promise<Object>} Deletion result
   */
  async deleteFile(fileId, userId, permissions = {}) {
    try {
      // Get file details first
      const fileDetails = await cloudinary.api.resource(fileId, {
        context: true,
        tags: true
      });

      // Check delete permissions
      await this.checkFileAccess(fileDetails, userId, permissions);

      // Delete from Cloudinary
      const result = await cloudinary.uploader.destroy(fileId, {
        resource_type: fileDetails.resource_type
      });

      // Log deletion
      logger.audit('File deleted', {
        fileId,
        userId,
        originalName: fileDetails.context?.original_name,
        result: result.result
      });

      return {
        success: result.result === 'ok',
        fileId,
        deletedAt: new Date()
      };

    } catch (error) {
      logger.error('File deletion failed', {
        error: error.message,
        fileId,
        userId
      });
      throw new AppError(`File deletion failed: ${error.message}`, 500, 'FILE_DELETE_ERROR');
    }
  }

  /**
   * Get resource type for Cloudinary based on MIME type
   * @param {string} mimeType - File MIME type
   * @returns {string} Cloudinary resource type
   */
  getResourceType(mimeType) {
    if (mimeType.startsWith('image/')) return 'image';
    if (mimeType.startsWith('video/')) return 'video';
    return 'raw'; // For PDFs and other documents
  }

  /**
   * List files with filtering and pagination
   * @param {Object} filters - Filter options
   * @param {Object} pagination - Pagination options
   * @returns {Promise<Object>} File list with metadata
   */
  async listFiles(filters = {}, pagination = {}) {
    try {
      const {
        userId,
        category,
        dateFrom,
        dateTo,
        tags = []
      } = filters;

      const {
        page = 1,
        limit = 20,
        sortBy = 'created_at',
        sortOrder = 'desc'
      } = pagination;

      // Build search expression
      let expression = 'folder:paysync/*';

      if (userId) {
        expression += ` AND tags:${userId}`;
      }

      if (category) {
        expression += ` AND tags:${category}`;
      }

      if (tags.length > 0) {
        expression += ` AND tags:(${tags.join(' OR ')})`;
      }

      // Execute search
      const result = await cloudinary.search
        .expression(expression)
        .sort_by(sortBy, sortOrder)
        .max_results(limit)
        .next_cursor(page > 1 ? `page_${page}` : undefined)
        .with_field('context')
        .with_field('tags')
        .execute();

      return {
        files: result.resources.map(file => ({
          fileId: file.public_id,
          url: file.secure_url,
          originalName: file.context?.original_name,
          size: file.bytes,
          format: file.format,
          uploadedAt: file.context?.upload_timestamp,
          uploadedBy: file.context?.uploaded_by,
          category: file.tags?.find(tag =>
            ['client', 'loan', 'agreement', 'general'].includes(tag)
          ),
          tags: file.tags
        })),
        pagination: {
          page,
          limit,
          total: result.total_count,
          hasMore: result.next_cursor !== undefined
        }
      };

    } catch (error) {
      logger.error('File listing failed', {
        error: error.message,
        filters,
        pagination
      });
      throw new AppError(`File listing failed: ${error.message}`, 500, 'FILE_LIST_ERROR');
    }
  }

  /**
   * Validate file before upload
   * @param {Object} file - File to validate
   * @param {string} fileType - Expected file type
   * @returns {boolean} Validation result
   */
  validateFile(file, fileType) {
    const maxSize = this.maxFileSize[fileType] || this.maxFileSize.DOCUMENTS;

    if (file.size > maxSize) {
      throw new AppError(
        `File too large. Maximum size is ${Math.round(maxSize / (1024 * 1024))}MB`,
        400,
        'FILE_TOO_LARGE'
      );
    }

    return true;
  }
}

module.exports = new FileService();