const nodemailer = require('nodemailer');
const path = require('path');
const fs = require('fs').promises;
const { logger } = require('../utils/logger');
const { AppError } = require('../utils/customErrors');

class EmailService {
  constructor() {
    this.transporter = null;
    this.emailQueue = [];
    this.isProcessing = false;
    this.retryAttempts = 3;
    this.retryDelay = 5000; // 5 seconds
    this.templates = new Map();

    this.initializeTransporter();
    this.loadTemplates();
    // Queue processor will be started when first email is queued
  }

  initializeTransporter() {
    try {
      const hasCredentials = process.env.EMAIL_USER && process.env.EMAIL_PASS;

      if (!hasCredentials) {
        logger.warn('Email credentials not configured. Email service will run in mock mode.');
        return;
      }

      this.transporter = nodemailer.createTransport({
        service: 'Gmail',
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS,
        },
        pool: true,
        maxConnections: 5,
        maxMessages: 100,
      });

      // Verify transporter configuration
      this.transporter.verify((error, success) => {
        if (error) {
          logger.error('Email transporter verification failed:', error);
        } else {
          logger.info('Email service initialized successfully');
        }
      });
    } catch (error) {
      logger.error('Failed to initialize email transporter:', error);
    }
  }

  async loadTemplates() {
    try {
      const templatesDir = path.join(__dirname, '../templates/email');

      // Create templates directory if it doesn't exist
      try {
        await fs.access(templatesDir);
      } catch {
        await fs.mkdir(templatesDir, { recursive: true });
      }

      // Always ensure default templates exist
      await this.createDefaultTemplates(templatesDir);

      // Load all template files
      const templateFiles = await fs.readdir(templatesDir);

      for (const file of templateFiles) {
        if (file.endsWith('.html')) {
          const templateName = path.basename(file, '.html');
          const templatePath = path.join(templatesDir, file);
          const templateContent = await fs.readFile(templatePath, 'utf8');
          this.templates.set(templateName, templateContent);
        }
      }

      logger.info(`Loaded ${this.templates.size} email templates`);
    } catch (error) {
      logger.error('Failed to load email templates:', error);
    }
  }

  async createDefaultTemplates(templatesDir) {
    const templates = {
      'loan-status-change': `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Loan Status Update - PaySync</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #2c3e50; color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; background-color: #f9f9f9; }
        .status-badge { display: inline-block; padding: 5px 15px; border-radius: 20px; color: white; font-weight: bold; }
        .approved { background-color: #27ae60; }
        .rejected { background-color: #e74c3c; }
        .pending { background-color: #f39c12; }
        .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
        .button { display: inline-block; padding: 10px 20px; background-color: #3498db; color: white; text-decoration: none; border-radius: 5px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>PaySync - Loan Status Update</h1>
        </div>
        <div class="content">
            <h2>Dear {{clientName}},</h2>
            <p>We wanted to update you on the status of your loan application.</p>
            
            <p><strong>Loan ID:</strong> {{loanId}}</p>
            <p><strong>Amount:</strong> LKR {{loanAmount}}</p>
            <p><strong>New Status:</strong> <span class="status-badge {{statusClass}}">{{loanStatus}}</span></p>
            
            {{#if approvalMessage}}
            <div style="background-color: #d4edda; border: 1px solid #c3e6cb; padding: 15px; border-radius: 5px; margin: 15px 0;">
                <h3 style="color: #155724; margin-top: 0;">Approval Details</h3>
                <p style="color: #155724;">{{approvalMessage}}</p>
            </div>
            {{/if}}
            
            {{#if rejectionReason}}
            <div style="background-color: #f8d7da; border: 1px solid #f5c6cb; padding: 15px; border-radius: 5px; margin: 15px 0;">
                <h3 style="color: #721c24; margin-top: 0;">Rejection Reason</h3>
                <p style="color: #721c24;">{{rejectionReason}}</p>
            </div>
            {{/if}}
            
            <p>If you have any questions, please contact your assigned agent or visit our office.</p>
            
            <p>Best regards,<br>PaySync Team</p>
        </div>
        <div class="footer">
            <p>This is an automated message from PaySync. Please do not reply to this email.</p>
        </div>
    </div>
</body>
</html>`,

      'agreement-ready': `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Agreement Ready - PaySync</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #27ae60; color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; background-color: #f9f9f9; }
        .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
        .button { display: inline-block; padding: 12px 25px; background-color: #3498db; color: white; text-decoration: none; border-radius: 5px; margin: 10px 0; }
        .highlight { background-color: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 5px; margin: 15px 0; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🎉 Your Loan Agreement is Ready!</h1>
        </div>
        <div class="content">
            <h2>Dear {{clientName}},</h2>
            <p>Great news! Your loan agreement has been prepared and is ready for download.</p>
            
            <div class="highlight">
                <p><strong>Loan Details:</strong></p>
                <ul>
                    <li><strong>Loan ID:</strong> {{loanId}}</li>
                    <li><strong>Amount:</strong> LKR {{loanAmount}}</li>
                    <li><strong>Term:</strong> {{loanTerm}} months</li>
                    <li><strong>Interest Rate:</strong> {{interestRate}}%</li>
                </ul>
            </div>
            
            <p>Please download your agreement using the link below:</p>
            
            <div style="text-align: center; margin: 20px 0;">
                <a href="{{downloadLink}}" class="button">Download Agreement</a>
            </div>
            
            <p><strong>Important:</strong> Please review the agreement carefully and contact us if you have any questions before signing.</p>
            
            <p>Next steps:</p>
            <ol>
                <li>Download and review the agreement</li>
                <li>Sign the agreement</li>
                <li>Submit the signed agreement to your agent</li>
                <li>Await final processing</li>
            </ol>
            
            <p>Thank you for choosing PaySync!</p>
            
            <p>Best regards,<br>PaySync Team</p>
        </div>
        <div class="footer">
            <p>This is an automated message from PaySync. Please do not reply to this email.</p>
            <p>If you have trouble downloading, contact your agent or visit our office.</p>
        </div>
    </div>
</body>
</html>`,

      'loan-reminder': `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Payment Reminder - PaySync</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #f39c12; color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; background-color: #f9f9f9; }
        .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
        .warning { background-color: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 5px; margin: 15px 0; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Payment Reminder</h1>
        </div>
        <div class="content">
            <h2>Dear {{clientName}},</h2>
            <p>This is a friendly reminder about your upcoming loan payment.</p>
            
            <div class="warning">
                <p><strong>Payment Details:</strong></p>
                <ul>
                    <li><strong>Loan ID:</strong> {{loanId}}</li>
                    <li><strong>Due Date:</strong> {{dueDate}}</li>
                    <li><strong>Amount Due:</strong> LKR {{amountDue}}</li>
                    <li><strong>Days Until Due:</strong> {{daysUntilDue}}</li>
                </ul>
            </div>
            
            <p>Please ensure your payment is made on time to avoid any late fees.</p>
            
            <p>Best regards,<br>PaySync Team</p>
        </div>
        <div class="footer">
            <p>This is an automated message from PaySync. Please do not reply to this email.</p>
        </div>
    </div>
</body>
</html>`
    };

    for (const [name, content] of Object.entries(templates)) {
      await fs.writeFile(path.join(templatesDir, `${name}.html`), content);
    }
  }

  renderTemplate(templateName, data) {
    const template = this.templates.get(templateName);
    if (!template) {
      throw new AppError(`Email template '${templateName}' not found`, 500, 'TEMPLATE_NOT_FOUND');
    }

    // Simple template rendering (replace {{variable}} with data values)
    let rendered = template;

    // Handle simple variables
    for (const [key, value] of Object.entries(data)) {
      const regex = new RegExp(`{{${key}}}`, 'g');
      rendered = rendered.replace(regex, value || '');
    }

    // Handle conditional blocks {{#if variable}}...{{/if}}
    rendered = rendered.replace(/{{#if\s+(\w+)}}([\s\S]*?){{\/if}}/g, (match, variable, content) => {
      return data[variable] ? content : '';
    });

    // Handle status class mapping
    if (data.loanStatus) {
      const statusClass = this.getStatusClass(data.loanStatus);
      rendered = rendered.replace(/{{statusClass}}/g, statusClass);
    }

    return rendered;
  }

  getStatusClass(status) {
    const statusMap = {
      'approved': 'approved',
      'rejected': 'rejected',
      'pending': 'pending',
      'under_review': 'pending',
      'disbursed': 'approved'
    };
    return statusMap[status.toLowerCase()] || 'pending';
  }

  async queueEmail(emailData) {
    const emailJob = {
      id: `email_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      ...emailData,
      attempts: 0,
      createdAt: new Date(),
      status: 'queued'
    };

    this.emailQueue.push(emailJob);
    logger.info(`Email queued: ${emailJob.id} to ${emailJob.to}`);

    // Start processing if not already running
    if (!this.isProcessing) {
      this.processQueue();
    }

    return emailJob.id;
  }

  async processQueue() {
    if (this.isProcessing || this.emailQueue.length === 0) {
      return;
    }

    this.isProcessing = true;
    logger.info(`Starting email queue processing. Queue size: ${this.emailQueue.length}`);

    while (this.emailQueue.length > 0) {
      const emailJob = this.emailQueue.shift();

      try {
        await this.sendEmailJob(emailJob);
        logger.info(`Email sent successfully: ${emailJob.id}`);
      } catch (error) {
        await this.handleEmailError(emailJob, error);
      }

      // Small delay between emails to avoid overwhelming the service
      await this.delay(1000);
    }

    this.isProcessing = false;
    logger.info('Email queue processing completed');
  }

  async sendEmailJob(emailJob) {
    emailJob.attempts++;
    emailJob.status = 'sending';

    // Mock mode if no transporter
    if (!this.transporter) {
      logger.info(`MOCK EMAIL - ${emailJob.id}:`);
      logger.info(`To: ${emailJob.to}`);
      logger.info(`Subject: ${emailJob.subject}`);
      logger.info(`Template: ${emailJob.template || 'plain text'}`);
      emailJob.status = 'sent';
      return;
    }

    let htmlContent = emailJob.html;
    let textContent = emailJob.text;

    // Render template if specified
    if (emailJob.template && emailJob.templateData) {
      htmlContent = this.renderTemplate(emailJob.template, emailJob.templateData);
      textContent = this.extractTextFromHtml(htmlContent);
    }

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: emailJob.to,
      subject: emailJob.subject,
      text: textContent,
      html: htmlContent,
    };

    const result = await this.transporter.sendMail(mailOptions);
    emailJob.status = 'sent';
    emailJob.messageId = result.messageId;
    emailJob.sentAt = new Date();

    return result;
  }

  async handleEmailError(emailJob, error) {
    logger.error(`Email sending failed for ${emailJob.id}:`, error);

    emailJob.status = 'failed';
    emailJob.lastError = error.message;
    emailJob.lastAttemptAt = new Date();

    // Retry logic
    if (emailJob.attempts < this.retryAttempts) {
      emailJob.status = 'retry';

      // Exponential backoff
      const delay = this.retryDelay * Math.pow(2, emailJob.attempts - 1);

      logger.info(`Retrying email ${emailJob.id} in ${delay}ms (attempt ${emailJob.attempts}/${this.retryAttempts})`);

      setTimeout(() => {
        this.emailQueue.unshift(emailJob); // Add back to front of queue
        if (!this.isProcessing) {
          this.processQueue();
        }
      }, delay);
    } else {
      logger.error(`Email ${emailJob.id} failed permanently after ${this.retryAttempts} attempts`);
      emailJob.status = 'permanently_failed';
    }
  }

  extractTextFromHtml(html) {
    // Simple HTML to text conversion
    return html
      .replace(/<[^>]*>/g, '') // Remove HTML tags
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Public methods for sending specific types of emails

  async sendLoanStatusChangeNotification(loanData, clientData, statusChange) {
    const templateData = {
      clientName: `${clientData.personalInfo.firstName} ${clientData.personalInfo.lastName}`,
      loanId: loanData._id,
      loanAmount: loanData.loanAmount.toLocaleString(),
      loanStatus: statusChange.newStatus,
      approvalMessage: statusChange.approvalMessage,
      rejectionReason: statusChange.rejectionReason,
    };

    return await this.queueEmail({
      to: clientData.personalInfo.email,
      subject: `Loan Status Update - ${statusChange.newStatus.toUpperCase()}`,
      template: 'loan-status-change',
      templateData,
      priority: 'high'
    });
  }

  async sendAgreementReadyNotification(loanData, clientData, downloadLink) {
    const templateData = {
      clientName: `${clientData.personalInfo.firstName} ${clientData.personalInfo.lastName}`,
      loanId: loanData._id,
      loanAmount: loanData.loanAmount.toLocaleString(),
      loanTerm: loanData.loanTerm,
      interestRate: loanData.interestRate,
      downloadLink: downloadLink,
    };

    return await this.queueEmail({
      to: clientData.personalInfo.email,
      subject: 'Your Loan Agreement is Ready for Download',
      template: 'agreement-ready',
      templateData,
      priority: 'high'
    });
  }

  async sendPaymentReminder(loanData, clientData, paymentDetails) {
    const templateData = {
      clientName: `${clientData.personalInfo.firstName} ${clientData.personalInfo.lastName}`,
      loanId: loanData._id,
      dueDate: paymentDetails.dueDate,
      amountDue: paymentDetails.amountDue.toLocaleString(),
      daysUntilDue: paymentDetails.daysUntilDue,
    };

    return await this.queueEmail({
      to: clientData.personalInfo.email,
      subject: 'Payment Reminder - PaySync',
      template: 'loan-reminder',
      templateData,
      priority: 'normal'
    });
  }

  async sendCustomEmail(to, subject, content, options = {}) {
    return await this.queueEmail({
      to,
      subject,
      html: content.html,
      text: content.text,
      template: options.template,
      templateData: options.templateData,
      priority: options.priority || 'normal'
    });
  }

  // Queue management methods
  getQueueStatus() {
    return {
      queueSize: this.emailQueue.length,
      isProcessing: this.isProcessing,
      templatesLoaded: this.templates.size,
      transporterConfigured: !!this.transporter
    };
  }

  clearQueue() {
    const clearedCount = this.emailQueue.length;
    this.emailQueue = [];
    logger.info(`Cleared ${clearedCount} emails from queue`);
    return clearedCount;
  }
}

// Create singleton instance
const emailService = new EmailService();

module.exports = emailService;