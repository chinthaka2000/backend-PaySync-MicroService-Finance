const emailService = require('../services/emailService');
const { AppError } = require('../utils/customErrors');
const logger = require('../utils/logger');
const Loan = require('../models/Loan');
const Client = require('../models/Client');

class EmailController {
  // Send loan status change notification
  async sendLoanStatusNotification(req, res, next) {
    try {
      const { loanId, newStatus, message, reason } = req.body;

      // Validate required fields
      if (!loanId || !newStatus) {
        throw new AppError('Loan ID and new status are required', 400, 'VALIDATION_ERROR');
      }

      // Get loan and client data
      const loan = await Loan.findById(loanId).populate('clientUserId');
      if (!loan) {
        throw new AppError('Loan not found', 404, 'RESOURCE_NOT_FOUND');
      }

      const client = await Client.findById(loan.clientUserId);
      if (!client) {
        throw new AppError('Client not found', 404, 'RESOURCE_NOT_FOUND');
      }

      // Prepare status change data
      const statusChange = {
        newStatus,
        approvalMessage: newStatus === 'approved' ? message : null,
        rejectionReason: newStatus === 'rejected' ? reason : null,
      };

      // Send notification
      const emailId = await emailService.sendLoanStatusChangeNotification(
        loan,
        client,
        statusChange
      );

      logger.info(`Loan status notification queued: ${emailId} for loan ${loanId}`);

      res.status(200).json({
        success: true,
        message: 'Loan status notification sent successfully',
        data: {
          emailId,
          loanId,
          status: newStatus,
          recipientEmail: client.personalInfo.email
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // Send agreement ready notification
  async sendAgreementNotification(req, res, next) {
    try {
      const { loanId, downloadLink } = req.body;

      // Validate required fields
      if (!loanId || !downloadLink) {
        throw new AppError('Loan ID and download link are required', 400, 'VALIDATION_ERROR');
      }

      // Get loan and client data
      const loan = await Loan.findById(loanId).populate('clientUserId');
      if (!loan) {
        throw new AppError('Loan not found', 404, 'RESOURCE_NOT_FOUND');
      }

      const client = await Client.findById(loan.clientUserId);
      if (!client) {
        throw new AppError('Client not found', 404, 'RESOURCE_NOT_FOUND');
      }

      // Send notification
      const emailId = await emailService.sendAgreementReadyNotification(
        loan,
        client,
        downloadLink
      );

      logger.info(`Agreement ready notification queued: ${emailId} for loan ${loanId}`);

      res.status(200).json({
        success: true,
        message: 'Agreement ready notification sent successfully',
        data: {
          emailId,
          loanId,
          downloadLink,
          recipientEmail: client.personalInfo.email
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // Send payment reminder
  async sendPaymentReminder(req, res, next) {
    try {
      const { loanId, dueDate, amountDue, daysUntilDue } = req.body;

      // Validate required fields
      if (!loanId || !dueDate || !amountDue) {
        throw new AppError('Loan ID, due date, and amount due are required', 400, 'VALIDATION_ERROR');
      }

      // Get loan and client data
      const loan = await Loan.findById(loanId).populate('clientUserId');
      if (!loan) {
        throw new AppError('Loan not found', 404, 'RESOURCE_NOT_FOUND');
      }

      const client = await Client.findById(loan.clientUserId);
      if (!client) {
        throw new AppError('Client not found', 404, 'RESOURCE_NOT_FOUND');
      }

      // Prepare payment details
      const paymentDetails = {
        dueDate: new Date(dueDate).toLocaleDateString(),
        amountDue: parseFloat(amountDue),
        daysUntilDue: daysUntilDue || 0,
      };

      // Send reminder
      const emailId = await emailService.sendPaymentReminder(
        loan,
        client,
        paymentDetails
      );

      logger.info(`Payment reminder queued: ${emailId} for loan ${loanId}`);

      res.status(200).json({
        success: true,
        message: 'Payment reminder sent successfully',
        data: {
          emailId,
          loanId,
          paymentDetails,
          recipientEmail: client.personalInfo.email
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // Send custom email
  async sendCustomEmail(req, res, next) {
    try {
      const { to, subject, content, template, templateData, priority } = req.body;

      // Validate required fields
      if (!to || !subject) {
        throw new AppError('Recipient email and subject are required', 400, 'VALIDATION_ERROR');
      }

      if (!content && !template) {
        throw new AppError('Either content or template must be provided', 400, 'VALIDATION_ERROR');
      }

      // Send email
      const emailId = await emailService.sendCustomEmail(to, subject, content, {
        template,
        templateData,
        priority
      });

      logger.info(`Custom email queued: ${emailId} to ${to}`);

      res.status(200).json({
        success: true,
        message: 'Custom email sent successfully',
        data: {
          emailId,
          to,
          subject,
          template: template || 'custom'
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // Get email queue status
  async getQueueStatus(req, res, next) {
    try {
      const status = emailService.getQueueStatus();

      res.status(200).json({
        success: true,
        message: 'Email queue status retrieved successfully',
        data: status
      });
    } catch (error) {
      next(error);
    }
  }

  // Clear email queue (admin only)
  async clearQueue(req, res, next) {
    try {
      // Check if user has admin permissions
      if (!['super_admin', 'moderate_admin'].includes(req.user.role)) {
        throw new AppError('Insufficient permissions to clear email queue', 403, 'AUTHORIZATION_ERROR');
      }

      const clearedCount = emailService.clearQueue();

      logger.info(`Email queue cleared by ${req.user.email}. Cleared ${clearedCount} emails`);

      res.status(200).json({
        success: true,
        message: 'Email queue cleared successfully',
        data: {
          clearedCount
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // Bulk send loan status notifications
  async bulkSendLoanNotifications(req, res, next) {
    try {
      const { loanIds, newStatus, message, reason } = req.body;

      // Validate required fields
      if (!loanIds || !Array.isArray(loanIds) || loanIds.length === 0) {
        throw new AppError('Array of loan IDs is required', 400, 'VALIDATION_ERROR');
      }

      if (!newStatus) {
        throw new AppError('New status is required', 400, 'VALIDATION_ERROR');
      }

      const results = [];
      const errors = [];

      // Process each loan
      for (const loanId of loanIds) {
        try {
          // Get loan and client data
          const loan = await Loan.findById(loanId).populate('clientUserId');
          if (!loan) {
            errors.push({ loanId, error: 'Loan not found' });
            continue;
          }

          const client = await Client.findById(loan.clientUserId);
          if (!client) {
            errors.push({ loanId, error: 'Client not found' });
            continue;
          }

          // Prepare status change data
          const statusChange = {
            newStatus,
            approvalMessage: newStatus === 'approved' ? message : null,
            rejectionReason: newStatus === 'rejected' ? reason : null,
          };

          // Send notification
          const emailId = await emailService.sendLoanStatusChangeNotification(
            loan,
            client,
            statusChange
          );

          results.push({
            loanId,
            emailId,
            recipientEmail: client.personalInfo.email,
            status: 'queued'
          });

        } catch (error) {
          errors.push({ loanId, error: error.message });
        }
      }

      logger.info(`Bulk loan notifications processed: ${results.length} successful, ${errors.length} failed`);

      res.status(200).json({
        success: true,
        message: 'Bulk loan notifications processed',
        data: {
          successful: results,
          failed: errors,
          totalProcessed: loanIds.length,
          successCount: results.length,
          errorCount: errors.length
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // Test email functionality
  async testEmail(req, res, next) {
    try {
      const { to, template } = req.body;

      if (!to) {
        throw new AppError('Recipient email is required for testing', 400, 'VALIDATION_ERROR');
      }

      const testTemplate = template || 'loan-status-change';
      const testData = {
        clientName: 'John Doe',
        loanId: 'TEST123456',
        loanAmount: '500,000',
        loanStatus: 'approved',
        loanTerm: '12',
        interestRate: '15',
        approvalMessage: 'Your loan has been approved successfully!',
        downloadLink: 'https://example.com/download/test-agreement.pdf',
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString(),
        amountDue: '45,000',
        daysUntilDue: '30'
      };

      const emailId = await emailService.sendCustomEmail(to, 'Test Email - PaySync', null, {
        template: testTemplate,
        templateData: testData,
        priority: 'normal'
      });

      logger.info(`Test email queued: ${emailId} to ${to}`);

      res.status(200).json({
        success: true,
        message: 'Test email sent successfully',
        data: {
          emailId,
          to,
          template: testTemplate,
          testData
        }
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new EmailController();