const fileService = require('../services/fileService');
const { AppError } = require('../utils/customErrors');
const logger = require('../utils/logger');
const { PERMISSIONS } = require('../utils/permissions');

/**
 * File Controller
 * Handles file upload, download, and management operations
 */

/**
 * Upload files with enhanced security and validation
 */
exports.uploadFiles = async (req, res) => {
  try {
    const files = req.files || (req.file ? [req.file] : []);

    if (files.length === 0) {
      throw new AppError('No files provided', 400, 'NO_FILES_PROVIDED');
    }

    const uploadResults = [];
    const { category = 'general', tags = [] } = req.body;

    // Process each file
    for (const file of files) {
      // Validate file
      fileService.validateFile(file, req.uploadMetadata?.fileType || 'DOCUMENTS');

      // Upload file
      const result = await fileService.uploadFile(file, {
        userId: req.user.userId,
        category,
        tags: Array.isArray(tags) ? tags : [tags].filter(Boolean)
      });

      uploadResults.push(result);
    }

    // Log successful uploads
    logger.audit('Files uploaded successfully', {
      userId: req.user.userId,
      fileCount: uploadResults.length,
      category,
      fileIds: uploadResults.map(r => r.fileId)
    });

    res.status(201).json({
      success: true,
      message: `${uploadResults.length} file(s) uploaded successfully`,
      data: {
        files: uploadResults,
        uploadedAt: new Date(),
        uploadedBy: req.user.userId
      }
    });

  } catch (error) {
    logger.error('File upload failed', {
      error: error.message,
      userId: req.user?.userId,
      fileCount: req.files?.length || 0
    });

    if (error instanceof AppError) {
      return res.status(error.statusCode).json({
        success: false,
        error: {
          code: error.errorCode,
          message: error.message,
          timestamp: new Date().toISOString()
        }
      });
    }

    res.status(500).json({
      success: false,
      error: {
        code: 'FILE_UPLOAD_ERROR',
        message: 'File upload failed',
        timestamp: new Date().toISOString()
      }
    });
  }
};

/**
 * Download file with access control
 */
exports.downloadFile = async (req, res) => {
  try {
    const { fileId } = req.params;
    const { download = 'true' } = req.query;

    if (!fileId) {
      throw new AppError('File ID is required', 400, 'FILE_ID_REQUIRED');
    }

    // Get user permissions
    const permissions = {
      canAccessAllFiles: req.user.permissions?.includes(PERMISSIONS.MANAGE_ALL_FILES),
      canAccessRegionalFiles: req.user.permissions?.includes(PERMISSIONS.VIEW_REGIONAL_DATA),
      canAccessClientFiles: req.user.permissions?.includes(PERMISSIONS.MANAGE_CLIENTS)
    };

    // Get file download info
    const fileInfo = await fileService.downloadFile(fileId, req.user.userId, permissions);

    // Set appropriate headers
    res.set({
      'Content-Type': 'application/octet-stream',
      'Content-Disposition': download === 'true'
        ? `attachment; filename="${fileInfo.filename}"`
        : `inline; filename="${fileInfo.filename}"`,
      'Cache-Control': 'private, no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    });

    // Redirect to secure download URL
    res.redirect(fileInfo.downloadUrl);

  } catch (error) {
    logger.error('File download failed', {
      error: error.message,
      fileId: req.params.fileId,
      userId: req.user?.userId
    });

    if (error instanceof AppError) {
      return res.status(error.statusCode).json({
        success: false,
        error: {
          code: error.errorCode,
          message: error.message,
          timestamp: new Date().toISOString()
        }
      });
    }

    res.status(500).json({
      success: false,
      error: {
        code: 'FILE_DOWNLOAD_ERROR',
        message: 'File download failed',
        timestamp: new Date().toISOString()
      }
    });
  }
};

/**
 * Get file information
 */
exports.getFileInfo = async (req, res) => {
  try {
    const { fileId } = req.params;

    if (!fileId) {
      throw new AppError('File ID is required', 400, 'FILE_ID_REQUIRED');
    }

    // Get user permissions
    const permissions = {
      canAccessAllFiles: req.user.permissions?.includes(PERMISSIONS.MANAGE_ALL_FILES),
      canAccessRegionalFiles: req.user.permissions?.includes(PERMISSIONS.VIEW_REGIONAL_DATA),
      canAccessClientFiles: req.user.permissions?.includes(PERMISSIONS.MANAGE_CLIENTS)
    };

    // Get file info (without download URL for security)
    const fileInfo = await fileService.downloadFile(fileId, req.user.userId, permissions);

    // Remove download URL from response
    const { downloadUrl, ...safeFileInfo } = fileInfo;

    res.json({
      success: true,
      data: {
        ...safeFileInfo,
        accessibleAt: new Date().toISOString()
      }
    });

  } catch (error) {
    logger.error('Get file info failed', {
      error: error.message,
      fileId: req.params.fileId,
      userId: req.user?.userId
    });

    if (error instanceof AppError) {
      return res.status(error.statusCode).json({
        success: false,
        error: {
          code: error.errorCode,
          message: error.message,
          timestamp: new Date().toISOString()
        }
      });
    }

    res.status(500).json({
      success: false,
      error: {
        code: 'FILE_INFO_ERROR',
        message: 'Failed to get file information',
        timestamp: new Date().toISOString()
      }
    });
  }
};

/**
 * List files with filtering and pagination
 */
exports.listFiles = async (req, res) => {
  try {
    const {
      category,
      dateFrom,
      dateTo,
      tags,
      page = 1,
      limit = 20,
      sortBy = 'created_at',
      sortOrder = 'desc'
    } = req.query;

    // Build filters
    const filters = {};

    // Users can only see their own files unless they have special permissions
    if (!req.user.permissions?.includes(PERMISSIONS.MANAGE_ALL_FILES)) {
      filters.userId = req.user.userId;
    }

    if (category) filters.category = category;
    if (dateFrom) filters.dateFrom = new Date(dateFrom);
    if (dateTo) filters.dateTo = new Date(dateTo);
    if (tags) filters.tags = Array.isArray(tags) ? tags : [tags];

    // Build pagination
    const pagination = {
      page: parseInt(page),
      limit: Math.min(parseInt(limit), 100), // Max 100 files per request
      sortBy,
      sortOrder
    };

    const result = await fileService.listFiles(filters, pagination);

    res.json({
      success: true,
      data: result,
      requestedAt: new Date().toISOString()
    });

  } catch (error) {
    logger.error('List files failed', {
      error: error.message,
      userId: req.user?.userId,
      filters: req.query
    });

    if (error instanceof AppError) {
      return res.status(error.statusCode).json({
        success: false,
        error: {
          code: error.errorCode,
          message: error.message,
          timestamp: new Date().toISOString()
        }
      });
    }

    res.status(500).json({
      success: false,
      error: {
        code: 'FILE_LIST_ERROR',
        message: 'Failed to list files',
        timestamp: new Date().toISOString()
      }
    });
  }
};

/**
 * Delete file with proper authorization
 */
exports.deleteFile = async (req, res) => {
  try {
    const { fileId } = req.params;

    if (!fileId) {
      throw new AppError('File ID is required', 400, 'FILE_ID_REQUIRED');
    }

    // Get user permissions
    const permissions = {
      canAccessAllFiles: req.user.permissions?.includes(PERMISSIONS.MANAGE_ALL_FILES),
      canAccessRegionalFiles: req.user.permissions?.includes(PERMISSIONS.VIEW_REGIONAL_DATA),
      canAccessClientFiles: req.user.permissions?.includes(PERMISSIONS.MANAGE_CLIENTS)
    };

    // Delete file
    const result = await fileService.deleteFile(fileId, req.user.userId, permissions);

    res.json({
      success: true,
      message: 'File deleted successfully',
      data: result
    });

  } catch (error) {
    logger.error('File deletion failed', {
      error: error.message,
      fileId: req.params.fileId,
      userId: req.user?.userId
    });

    if (error instanceof AppError) {
      return res.status(error.statusCode).json({
        success: false,
        error: {
          code: error.errorCode,
          message: error.message,
          timestamp: new Date().toISOString()
        }
      });
    }

    res.status(500).json({
      success: false,
      error: {
        code: 'FILE_DELETE_ERROR',
        message: 'File deletion failed',
        timestamp: new Date().toISOString()
      }
    });
  }
};

/**
 * Upload client documents with specific validation
 */
exports.uploadClientDocuments = async (req, res) => {
  try {
    const { clientId } = req.params;
    const files = req.files || {};

    if (Object.keys(files).length === 0) {
      throw new AppError('No documents provided', 400, 'NO_DOCUMENTS_PROVIDED');
    }

    const uploadResults = {};
    const allowedDocuments = ['idCard', 'employmentLetter', 'incomeProof', 'addressProof'];

    // Process each document type
    for (const [docType, fileArray] of Object.entries(files)) {
      if (!allowedDocuments.includes(docType)) {
        throw new AppError(`Invalid document type: ${docType}`, 400, 'INVALID_DOCUMENT_TYPE');
      }

      const file = Array.isArray(fileArray) ? fileArray[0] : fileArray;

      // Upload document
      const result = await fileService.uploadFile(file, {
        userId: req.user.userId,
        category: 'client_document',
        tags: [clientId, docType, 'verification']
      });

      uploadResults[docType] = result;
    }

    // Log successful upload
    logger.audit('Client documents uploaded', {
      userId: req.user.userId,
      clientId,
      documentTypes: Object.keys(uploadResults),
      fileIds: Object.values(uploadResults).map(r => r.fileId)
    });

    res.status(201).json({
      success: true,
      message: 'Client documents uploaded successfully',
      data: {
        clientId,
        documents: uploadResults,
        uploadedAt: new Date(),
        uploadedBy: req.user.userId
      }
    });

  } catch (error) {
    logger.error('Client document upload failed', {
      error: error.message,
      clientId: req.params.clientId,
      userId: req.user?.userId
    });

    if (error instanceof AppError) {
      return res.status(error.statusCode).json({
        success: false,
        error: {
          code: error.errorCode,
          message: error.message,
          timestamp: new Date().toISOString()
        }
      });
    }

    res.status(500).json({
      success: false,
      error: {
        code: 'CLIENT_DOCUMENT_UPLOAD_ERROR',
        message: 'Client document upload failed',
        timestamp: new Date().toISOString()
      }
    });
  }
};

module.exports = {
  uploadFiles: exports.uploadFiles,
  downloadFile: exports.downloadFile,
  getFileInfo: exports.getFileInfo,
  listFiles: exports.listFiles,
  deleteFile: exports.deleteFile,
  uploadClientDocuments: exports.uploadClientDocuments
};