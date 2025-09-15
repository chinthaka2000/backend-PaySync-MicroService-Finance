const agreementService = require('../services/agreementService');
const fileService = require('../services/fileService');
const emailService = require('../services/emailService');
const Loan = require('../models/Loan');
const Client = require('../models/Client');
const { AppError } = require('../utils/customErrors');
const logger = require('../utils/logger');
const { PERMISSIONS } = require('../utils/permissions');

/**
 * Agreement Controller
 * Handles loan agreement generation, download, and management
 */

/**
 * Generate loan agreement
 */
exports.generateAgreement = async (req, res) => {
  try {
    const { loanId } = req.params;
    const {
      template = 'standard',
      language = 'en',
      includeTerms = true,
      watermark = null
    } = req.body;

    // Find loan with client data
    const loan = await Loan.findById(loanId).populate('clientUserId');
    if (!loan) {
      throw new AppError('Loan not found', 404, 'LOAN_NOT_FOUND');
    }

    // Check if loan is approved
    if (loan.regionalAdminApproval?.status !== 'Approved') {
      throw new AppError('Loan must be approved before generating agreement', 400, 'LOAN_NOT_APPROVED');
    }

    // Check if agreement already exists
    if (loan.agreementGenerated && loan.agreementUrl) {
      return res.json({
        success: true,
        message: 'Agreement already exists',
        data: {
          agreementId: loan.agreementId,
          agreementUrl: loan.agreementUrl,
          generatedAt: loan.agreementGeneratedDate,
          canRegenerate: true
        }
      });
    }

    // Generate agreement
    const agreementResult = await agreementService.generateLoanAgreement(
      loan,
      loan.clientUserId,
      { template, language, includeTerms, watermark }
    );

    // Update loan with agreement information
    loan.agreementGenerated = true;
    loan.agreementGeneratedDate = new Date();
    loan.agreementId = agreementResult.agreementId;
    loan.agreementUrl = agreementResult.agreementUrl;
    loan.agreementStatus = 'Generated';
    loan.workflowStage = 'agreement_generated';

    // Add to audit trail
    loan.auditTrail.push({
      action: 'agreement_generated',
      performedBy: req.user.userId,
      timestamp: new Date(),
      changes: {
        agreementId: agreementResult.agreementId,
        template,
        language
      },
      ipAddress: req.ip
    });

    await loan.save();

    // Log agreement generation
    logger.audit('Loan agreement generated', {
      loanId: loan._id,
      clientId: loan.clientUserId._id,
      agreementId: agreementResult.agreementId,
      userId: req.user.userId,
      template,
      language
    });

    // Send email notification for agreement ready
    try {
      const client = await Client.findById(loan.clientUserId);
      if (client && client.personalInfo.email) {
        // Create download link (assuming we have a download endpoint)
        const downloadLink = `${req.protocol}://${req.get('host')}/api/agreements/${loan._id}/download`;

        await emailService.sendAgreementReadyNotification(loan, client, downloadLink);

        logger.info('Agreement ready email notification queued', {
          loanId: loan._id,
          clientEmail: client.personalInfo.email,
          agreementId: agreementResult.agreementId
        });
      }
    } catch (emailError) {
      // Log email error but don't fail the agreement generation
      logger.error('Failed to send agreement ready email notification', emailError, {
        loanId: loan._id,
        agreementId: agreementResult.agreementId
      });
    }

    res.status(201).json({
      success: true,
      message: 'Agreement generated successfully',
      data: {
        loan: {
          id: loan._id,
          loanApplicationId: loan.loanApplicationId,
          agreementStatus: loan.agreementStatus,
          workflowStage: loan.workflowStage
        },
        agreement: agreementResult,
        summary: agreementService.generateAgreementSummary(loan, loan.clientUserId)
      }
    });

  } catch (error) {
    logger.error('Agreement generation failed', {
      error: error.message,
      loanId: req.params.loanId,
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
        code: 'AGREEMENT_GENERATION_ERROR',
        message: 'Agreement generation failed',
        timestamp: new Date().toISOString()
      }
    });
  }
};

/**
 * Download agreement
 */
exports.downloadAgreement = async (req, res) => {
  try {
    const { agreementId } = req.params;
    const { download = 'true' } = req.query;

    if (!agreementId) {
      throw new AppError('Agreement ID is required', 400, 'AGREEMENT_ID_REQUIRED');
    }

    // Find loan by agreement ID
    const loan = await Loan.findOne({ agreementId }).populate('clientUserId');
    if (!loan) {
      throw new AppError('Agreement not found', 404, 'AGREEMENT_NOT_FOUND');
    }

    // Check access permissions
    const canAccess = await this.checkAgreementAccess(loan, req.user);
    if (!canAccess) {
      throw new AppError('Access denied to this agreement', 403, 'AGREEMENT_ACCESS_DENIED');
    }

    // Get user permissions for file service
    const permissions = {
      canAccessAllFiles: req.user.permissions?.includes(PERMISSIONS.MANAGE_ALL_FILES),
      canAccessRegionalFiles: req.user.permissions?.includes(PERMISSIONS.VIEW_REGIONAL_DATA),
      canAccessClientFiles: req.user.permissions?.includes(PERMISSIONS.MANAGE_CLIENTS)
    };

    // Get file download info
    const fileInfo = await fileService.downloadFile(agreementId, req.user.userId, permissions);

    // Set appropriate headers
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': download === 'true'
        ? `attachment; filename="agreement_${loan.loanApplicationId}.pdf"`
        : `inline; filename="agreement_${loan.loanApplicationId}.pdf"`,
      'Cache-Control': 'private, no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    });

    // Log agreement download
    logger.audit('Agreement downloaded', {
      agreementId,
      loanId: loan._id,
      clientId: loan.clientUserId._id,
      userId: req.user.userId,
      downloadType: download === 'true' ? 'attachment' : 'inline'
    });

    // Redirect to secure download URL
    res.redirect(fileInfo.downloadUrl);

  } catch (error) {
    logger.error('Agreement download failed', {
      error: error.message,
      agreementId: req.params.agreementId,
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
        code: 'AGREEMENT_DOWNLOAD_ERROR',
        message: 'Agreement download failed',
        timestamp: new Date().toISOString()
      }
    });
  }
};

/**
 * Get agreement information
 */
exports.getAgreementInfo = async (req, res) => {
  try {
    const { agreementId } = req.params;

    // Find loan by agreement ID
    const loan = await Loan.findOne({ agreementId }).populate('clientUserId');
    if (!loan) {
      throw new AppError('Agreement not found', 404, 'AGREEMENT_NOT_FOUND');
    }

    // Check access permissions
    const canAccess = await this.checkAgreementAccess(loan, req.user);
    if (!canAccess) {
      throw new AppError('Access denied to this agreement', 403, 'AGREEMENT_ACCESS_DENIED');
    }

    // Generate agreement summary
    const summary = agreementService.generateAgreementSummary(loan, loan.clientUserId);

    res.json({
      success: true,
      data: {
        agreementId,
        loanId: loan._id,
        loanApplicationId: loan.loanApplicationId,
        status: loan.agreementStatus,
        generatedAt: loan.agreementGeneratedDate,
        summary,
        client: {
          id: loan.clientUserId._id,
          name: loan.clientUserId.personalInfo.fullName,
          nic: loan.clientUserId.personalInfo.nic
        },
        downloadUrl: `/api/agreements/${agreementId}/download`,
        canRegenerate: req.user.permissions?.includes(PERMISSIONS.GENERATE_AGREEMENTS)
      }
    });

  } catch (error) {
    logger.error('Get agreement info failed', {
      error: error.message,
      agreementId: req.params.agreementId,
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
        code: 'AGREEMENT_INFO_ERROR',
        message: 'Failed to get agreement information',
        timestamp: new Date().toISOString()
      }
    });
  }
};

/**
 * List agreements with filtering
 */
exports.listAgreements = async (req, res) => {
  try {
    const {
      status,
      clientId,
      dateFrom,
      dateTo,
      page = 1,
      limit = 20,
      sortBy = 'agreementGeneratedDate',
      sortOrder = 'desc'
    } = req.query;

    // Build query filters
    const filters = { agreementGenerated: true };

    if (status) filters.agreementStatus = status;
    if (clientId) filters.clientUserId = clientId;
    if (dateFrom || dateTo) {
      filters.agreementGeneratedDate = {};
      if (dateFrom) filters.agreementGeneratedDate.$gte = new Date(dateFrom);
      if (dateTo) filters.agreementGeneratedDate.$lte = new Date(dateTo);
    }

    // Apply role-based filtering
    if (!req.user.permissions?.includes(PERMISSIONS.VIEW_ALL_AGREEMENTS)) {
      if (req.user.role === 'agent') {
        // Agents can only see agreements for their clients
        filters['agentReview.reviewedBy'] = req.user.userId;
      } else if (req.user.role === 'regional_manager') {
        // Regional managers can see agreements in their region
        filters.region = req.user.region;
      }
    }

    // Build sort options
    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // Execute query with pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const agreements = await Loan.find(filters)
      .populate('clientUserId', 'personalInfo registrationId')
      .sort(sortOptions)
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Loan.countDocuments(filters);

    // Format response
    const formattedAgreements = agreements.map(loan => ({
      agreementId: loan.agreementId,
      loanId: loan._id,
      loanApplicationId: loan.loanApplicationId,
      status: loan.agreementStatus,
      generatedAt: loan.agreementGeneratedDate,
      client: {
        id: loan.clientUserId._id,
        name: loan.clientUserId.personalInfo.fullName,
        registrationId: loan.clientUserId.registrationId
      },
      loanAmount: loan.loanAmount,
      loanTerm: loan.loanTerm,
      interestRate: loan.interestRate,
      downloadUrl: `/api/agreements/${loan.agreementId}/download`
    }));

    res.json({
      success: true,
      data: {
        agreements: formattedAgreements,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit)),
          hasNext: skip + parseInt(limit) < total,
          hasPrev: parseInt(page) > 1
        }
      }
    });

  } catch (error) {
    logger.error('List agreements failed', {
      error: error.message,
      userId: req.user?.userId,
      filters: req.query
    });

    res.status(500).json({
      success: false,
      error: {
        code: 'AGREEMENT_LIST_ERROR',
        message: 'Failed to list agreements',
        timestamp: new Date().toISOString()
      }
    });
  }
};

/**
 * Send agreement via email
 */
exports.sendAgreement = async (req, res) => {
  try {
    const { agreementId } = req.params;
    const { email, subject, message } = req.body;

    // Find loan by agreement ID
    const loan = await Loan.findOne({ agreementId }).populate('clientUserId');
    if (!loan) {
      throw new AppError('Agreement not found', 404, 'AGREEMENT_NOT_FOUND');
    }

    // Check access permissions
    const canAccess = await this.checkAgreementAccess(loan, req.user);
    if (!canAccess) {
      throw new AppError('Access denied to this agreement', 403, 'AGREEMENT_ACCESS_DENIED');
    }

    // TODO: Implement email service integration
    // This would integrate with the email notification system (task 10)

    // For now, just log the action
    logger.audit('Agreement send requested', {
      agreementId,
      loanId: loan._id,
      clientId: loan.clientUserId._id,
      userId: req.user.userId,
      recipientEmail: email,
      subject
    });

    res.json({
      success: true,
      message: 'Agreement send functionality will be implemented with email notification system',
      data: {
        agreementId,
        recipientEmail: email,
        status: 'pending_email_service_implementation'
      }
    });

  } catch (error) {
    logger.error('Send agreement failed', {
      error: error.message,
      agreementId: req.params.agreementId,
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
        code: 'AGREEMENT_SEND_ERROR',
        message: 'Failed to send agreement',
        timestamp: new Date().toISOString()
      }
    });
  }
};

/**
 * Check if user has access to agreement
 * @param {Object} loan - Loan document
 * @param {Object} user - User object
 * @returns {boolean} Access permission
 */
exports.checkAgreementAccess = async (loan, user) => {
  // Super admin and moderate admin can access all agreements
  if (user.permissions?.includes(PERMISSIONS.MANAGE_ALL_FILES)) {
    return true;
  }

  // CEO can view all agreements
  if (user.role === 'ceo') {
    return true;
  }

  // Regional managers can access agreements in their region
  if (user.role === 'regional_manager' && loan.region?.toString() === user.region?.toString()) {
    return true;
  }

  // Agents can access agreements for loans they processed
  if (user.role === 'agent' && loan.agentReview?.reviewedBy?.toString() === user.userId) {
    return true;
  }

  // Client can access their own agreement
  if (loan.clientUserId._id.toString() === user.userId) {
    return true;
  }

  return false;
};

module.exports = {
  generateAgreement: exports.generateAgreement,
  downloadAgreement: exports.downloadAgreement,
  getAgreementInfo: exports.getAgreementInfo,
  listAgreements: exports.listAgreements,
  sendAgreement: exports.sendAgreement,
  checkAgreementAccess: exports.checkAgreementAccess
};