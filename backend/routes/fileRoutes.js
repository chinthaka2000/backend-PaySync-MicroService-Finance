const express = require('express');
const router = express.Router();
const fileController = require('../controllers/fileController');
const { authenticate, requirePermissions } = require('../middlewares/authMiddleware');
const { PERMISSIONS } = require('../utils/permissions');
const { validate, schemas } = require('../validation');
const {
  secureClientDocuments,
  secureAgreements,
  secureGeneralDocuments,
  secureImages
} = require('../middlewares/multer');
const Joi = require('joi');

const { objectId } = schemas;

// All routes require authentication
router.use(authenticate);

/**
 * General file upload endpoint
 * POST /api/files/upload
 */
router.post('/upload',
  requirePermissions(PERMISSIONS.UPLOAD_FILES),
  secureGeneralDocuments,
  validate(Joi.object({
    category: Joi.string().valid('general', 'client', 'loan', 'agreement').optional(),
    tags: Joi.alternatives().try(
      Joi.string(),
      Joi.array().items(Joi.string())
    ).optional()
  })),
  fileController.uploadFiles
);

/**
 * Client document upload endpoint
 * POST /api/files/clients/:clientId/documents
 */
router.post('/clients/:clientId/documents',
  requirePermissions(PERMISSIONS.MANAGE_CLIENTS),
  validate(Joi.object({ clientId: objectId.required() }), 'params'),
  secureClientDocuments,
  fileController.uploadClientDocuments
);

/**
 * Image upload endpoint
 * POST /api/files/images
 */
router.post('/images',
  requirePermissions(PERMISSIONS.UPLOAD_FILES),
  secureImages,
  validate(Joi.object({
    category: Joi.string().valid('profile', 'general', 'verification').optional(),
    tags: Joi.alternatives().try(
      Joi.string(),
      Joi.array().items(Joi.string())
    ).optional()
  })),
  fileController.uploadFiles
);

/**
 * Agreement upload endpoint (for manual uploads)
 * POST /api/files/agreements
 */
router.post('/agreements',
  requirePermissions(PERMISSIONS.GENERATE_AGREEMENTS),
  secureAgreements,
  validate(Joi.object({
    loanId: objectId.optional(),
    tags: Joi.alternatives().try(
      Joi.string(),
      Joi.array().items(Joi.string())
    ).optional()
  })),
  fileController.uploadFiles
);

/**
 * Download file endpoint
 * GET /api/files/:fileId/download
 */
router.get('/:fileId/download',
  validate(Joi.object({ fileId: Joi.string().required() }), 'params'),
  validate(Joi.object({
    download: Joi.string().valid('true', 'false').optional()
  }), 'query'),
  fileController.downloadFile
);

/**
 * Get file information endpoint
 * GET /api/files/:fileId
 */
router.get('/:fileId',
  validate(Joi.object({ fileId: Joi.string().required() }), 'params'),
  fileController.getFileInfo
);

/**
 * List files endpoint with filtering
 * GET /api/files
 */
router.get('/',
  validate(Joi.object({
    category: Joi.string().valid('general', 'client', 'loan', 'agreement', 'client_document').optional(),
    dateFrom: Joi.date().iso().optional(),
    dateTo: Joi.date().iso().optional(),
    tags: Joi.alternatives().try(
      Joi.string(),
      Joi.array().items(Joi.string())
    ).optional(),
    page: Joi.number().integer().min(1).optional(),
    limit: Joi.number().integer().min(1).max(100).optional(),
    sortBy: Joi.string().valid('created_at', 'original_name', 'size', 'upload_timestamp').optional(),
    sortOrder: Joi.string().valid('asc', 'desc').optional()
  }), 'query'),
  fileController.listFiles
);

/**
 * Delete file endpoint
 * DELETE /api/files/:fileId
 */
router.delete('/:fileId',
  requirePermissions(PERMISSIONS.DELETE_FILES),
  validate(Joi.object({ fileId: Joi.string().required() }), 'params'),
  fileController.deleteFile
);

/**
 * Bulk file operations
 */

/**
 * Bulk download files (returns zip)
 * POST /api/files/bulk/download
 */
router.post('/bulk/download',
  requirePermissions(PERMISSIONS.DOWNLOAD_FILES),
  validate(Joi.object({
    fileIds: Joi.array().items(Joi.string()).min(1).max(50).required(),
    zipName: Joi.string().max(100).optional()
  })),
  async (req, res) => {
    // TODO: Implement bulk download functionality
    res.json({
      success: false,
      message: 'Bulk download functionality not yet implemented',
      data: {
        requestedFiles: req.body.fileIds.length,
        status: 'pending_implementation'
      }
    });
  }
);

/**
 * Bulk delete files
 * DELETE /api/files/bulk
 */
router.delete('/bulk',
  requirePermissions(PERMISSIONS.DELETE_FILES),
  validate(Joi.object({
    fileIds: Joi.array().items(Joi.string()).min(1).max(20).required(),
    confirm: Joi.boolean().valid(true).required()
  })),
  async (req, res) => {
    // TODO: Implement bulk delete functionality
    res.json({
      success: false,
      message: 'Bulk delete functionality not yet implemented',
      data: {
        requestedFiles: req.body.fileIds.length,
        status: 'pending_implementation'
      }
    });
  }
);

/**
 * File statistics endpoint
 * GET /api/files/stats
 */
router.get('/stats/summary',
  requirePermissions(PERMISSIONS.VIEW_FILE_STATS),
  async (req, res) => {
    try {
      // TODO: Implement file statistics
      res.json({
        success: true,
        data: {
          totalFiles: 0,
          totalSize: 0,
          filesByCategory: {},
          recentUploads: [],
          storageUsage: {
            used: 0,
            limit: 0,
            percentage: 0
          }
        },
        message: 'File statistics functionality not yet implemented'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: {
          code: 'FILE_STATS_ERROR',
          message: 'Failed to get file statistics',
          timestamp: new Date().toISOString()
        }
      });
    }
  }
);

module.exports = router;