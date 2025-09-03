const PDFDocument = require('pdfkit');
const fs = require('fs').promises;
const path = require('path');
const fileService = require('./fileService');
const { AppError } = require('../utils/customErrors');
const logger = require('../utils/logger');

/**
 * Agreement Generation Service
 * Handles creation of professional loan agreements
 */
class AgreementService {
  constructor() {
    this.templateDir = path.join(__dirname, '../templates/agreements');
    this.logoPath = path.join(__dirname, '../assets/logo.png');
  }

  /**
   * Generate loan agreement PDF
   * @param {Object} loanData - Loan information
   * @param {Object} clientData - Client information
   * @param {Object} options - Generation options
   * @returns {Promise<Object>} Generated agreement info
   */
  async generateLoanAgreement(loanData, clientData, options = {}) {
    try {
      const {
        template = 'standard',
        language = 'en',
        includeTerms = true,
        watermark = null
      } = options;

      // Create PDF document
      const doc = new PDFDocument({
        size: 'A4',
        margins: { top: 50, bottom: 50, left: 50, right: 50 },
        info: {
          Title: `Loan Agreement - ${loanData.loanApplicationId}`,
          Author: 'PaySync Microfinance',
          Subject: 'Loan Agreement',
          Keywords: 'loan, agreement, microfinance',
          CreationDate: new Date(),
          ModDate: new Date()
        }
      });

      // Generate agreement content
      await this.generateAgreementContent(doc, loanData, clientData, template, language);

      // Add terms and conditions if requested
      if (includeTerms) {
        await this.addTermsAndConditions(doc, language);
      }

      // Add signature section
      await this.addSignatureSection(doc, loanData, clientData);

      // Add watermark if specified
      if (watermark) {
        this.addWatermark(doc, watermark);
      }

      // Convert to buffer
      const pdfBuffer = await this.documentToBuffer(doc);

      // Upload to file service
      const uploadResult = await fileService.uploadFile({
        buffer: pdfBuffer,
        originalname: `loan_agreement_${loanData.loanApplicationId}.pdf`,
        mimetype: 'application/pdf',
        size: pdfBuffer.length
      }, {
        userId: loanData.agentReview?.reviewedBy || 'system',
        category: 'agreement',
        tags: ['loan_agreement', loanData.loanApplicationId, clientData._id.toString()]
      });

      // Log agreement generation
      logger.audit('Loan agreement generated', {
        loanId: loanData._id,
        clientId: clientData._id,
        agreementId: uploadResult.fileId,
        template,
        language
      });

      return {
        agreementId: uploadResult.fileId,
        agreementUrl: uploadResult.secureUrl,
        filename: uploadResult.originalName,
        size: uploadResult.size,
        generatedAt: new Date(),
        template,
        language
      };

    } catch (error) {
      logger.error('Agreement generation failed', {
        error: error.message,
        loanId: loanData._id,
        clientId: clientData._id
      });
      throw new AppError(`Agreement generation failed: ${error.message}`, 500, 'AGREEMENT_GENERATION_ERROR');
    }
  }

  /**
   * Generate main agreement content
   * @param {PDFDocument} doc - PDF document
   * @param {Object} loanData - Loan data
   * @param {Object} clientData - Client data
   * @param {string} template - Template type
   * @param {string} language - Language
   */
  async generateAgreementContent(doc, loanData, clientData, template, language) {
    // Add header with logo and company info
    await this.addHeader(doc);

    // Add title
    doc.fontSize(20)
      .font('Helvetica-Bold')
      .text('LOAN AGREEMENT', { align: 'center' })
      .moveDown(2);

    // Add agreement number and date
    doc.fontSize(12)
      .font('Helvetica')
      .text(`Agreement No: ${loanData.loanApplicationId}`, { align: 'right' })
      .text(`Date: ${new Date().toLocaleDateString()}`, { align: 'right' })
      .moveDown(2);

    // Add parties section
    await this.addPartiesSection(doc, loanData, clientData);

    // Add loan details section
    await this.addLoanDetailsSection(doc, loanData);

    // Add repayment schedule
    await this.addRepaymentSchedule(doc, loanData);

    // Add guarantor information if available
    if (loanData.guarantorInfo && loanData.guarantorInfo.length > 0) {
      await this.addGuarantorSection(doc, loanData.guarantorInfo);
    }
  }

  /**
   * Add header with logo and company information
   * @param {PDFDocument} doc - PDF document
   */
  async addHeader(doc) {
    // Add logo if available
    try {
      await fs.access(this.logoPath);
      doc.image(this.logoPath, 50, 50, { width: 100 });
    } catch (error) {
      // Logo not found, skip
    }

    // Company information
    doc.fontSize(16)
      .font('Helvetica-Bold')
      .text('PaySync Microfinance Ltd.', 170, 60)
      .fontSize(10)
      .font('Helvetica')
      .text('Registered Microfinance Institution', 170, 80)
      .text('License No: MF/2024/001', 170, 95)
      .text('Email: info@paysync.lk | Phone: +94 11 234 5678', 170, 110)
      .moveDown(3);

    // Add horizontal line
    doc.moveTo(50, 140)
      .lineTo(545, 140)
      .stroke();

    doc.y = 160;
  }

  /**
   * Add parties section
   * @param {PDFDocument} doc - PDF document
   * @param {Object} loanData - Loan data
   * @param {Object} clientData - Client data
   */
  async addPartiesSection(doc, loanData, clientData) {
    doc.fontSize(14)
      .font('Helvetica-Bold')
      .text('PARTIES TO THE AGREEMENT', { underline: true })
      .moveDown(1);

    doc.fontSize(12)
      .font('Helvetica-Bold')
      .text('LENDER:')
      .font('Helvetica')
      .text('PaySync Microfinance Ltd.')
      .text('No. 123, Main Street, Colombo 01, Sri Lanka')
      .text('Registration No: PV 12345')
      .moveDown(1);

    doc.font('Helvetica-Bold')
      .text('BORROWER:')
      .font('Helvetica')
      .text(`Name: ${clientData.personalInfo.fullName}`)
      .text(`NIC: ${clientData.personalInfo.nic}`)
      .text(`Address: ${clientData.personalInfo.address}`)
      .text(`Phone: ${clientData.personalInfo.phoneNumber}`)
      .text(`Email: ${clientData.personalInfo.email || 'N/A'}`)
      .moveDown(2);
  }

  /**
   * Add loan details section
   * @param {PDFDocument} doc - PDF document
   * @param {Object} loanData - Loan data
   */
  async addLoanDetailsSection(doc, loanData) {
    doc.fontSize(14)
      .font('Helvetica-Bold')
      .text('LOAN DETAILS', { underline: true })
      .moveDown(1);

    const loanAmount = parseFloat(loanData.loanAmount);
    const interestRate = parseFloat(loanData.interestRate);
    const loanTerm = parseInt(loanData.loanTerm);
    const monthlyPayment = this.calculateMonthlyPayment(loanAmount, interestRate, loanTerm);
    const totalAmount = monthlyPayment * loanTerm;

    doc.fontSize(12)
      .font('Helvetica')
      .text(`Loan Amount: LKR ${loanAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}`)
      .text(`Interest Rate: ${interestRate}% per annum`)
      .text(`Loan Term: ${loanTerm} months`)
      .text(`Monthly Payment: LKR ${monthlyPayment.toLocaleString('en-US', { minimumFractionDigits: 2 })}`)
      .text(`Total Repayment: LKR ${totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}`)
      .text(`Purpose: ${loanData.loanPurpose || 'General Business'}`)
      .moveDown(2);
  }

  /**
   * Add repayment schedule
   * @param {PDFDocument} doc - PDF document
   * @param {Object} loanData - Loan data
   */
  async addRepaymentSchedule(doc, loanData) {
    doc.fontSize(14)
      .font('Helvetica-Bold')
      .text('REPAYMENT SCHEDULE', { underline: true })
      .moveDown(1);

    const loanAmount = parseFloat(loanData.loanAmount);
    const interestRate = parseFloat(loanData.interestRate) / 100 / 12; // Monthly rate
    const loanTerm = parseInt(loanData.loanTerm);
    const monthlyPayment = this.calculateMonthlyPayment(loanAmount, loanData.interestRate, loanTerm);

    doc.fontSize(10)
      .font('Helvetica-Bold');

    // Table headers
    const tableTop = doc.y;
    const col1 = 50;
    const col2 = 120;
    const col3 = 200;
    const col4 = 280;
    const col5 = 360;
    const col6 = 450;

    doc.text('Payment #', col1, tableTop)
      .text('Date', col2, tableTop)
      .text('Principal', col3, tableTop)
      .text('Interest', col4, tableTop)
      .text('Payment', col5, tableTop)
      .text('Balance', col6, tableTop);

    // Draw header line
    doc.moveTo(col1, tableTop + 15)
      .lineTo(530, tableTop + 15)
      .stroke();

    let currentY = tableTop + 25;
    let remainingBalance = loanAmount;
    const startDate = new Date();

    // Generate first 12 months of schedule
    for (let i = 1; i <= Math.min(12, loanTerm); i++) {
      const interestPayment = remainingBalance * interestRate;
      const principalPayment = monthlyPayment - interestPayment;
      remainingBalance -= principalPayment;

      const paymentDate = new Date(startDate);
      paymentDate.setMonth(paymentDate.getMonth() + i);

      doc.font('Helvetica')
        .fontSize(9)
        .text(i.toString(), col1, currentY)
        .text(paymentDate.toLocaleDateString(), col2, currentY)
        .text(principalPayment.toFixed(2), col3, currentY)
        .text(interestPayment.toFixed(2), col4, currentY)
        .text(monthlyPayment.toFixed(2), col5, currentY)
        .text(Math.max(0, remainingBalance).toFixed(2), col6, currentY);

      currentY += 15;

      // Check if we need a new page
      if (currentY > 700) {
        doc.addPage();
        currentY = 50;
      }
    }

    if (loanTerm > 12) {
      doc.moveDown(1)
        .fontSize(10)
        .font('Helvetica-Italic')
        .text('* Complete repayment schedule available upon request');
    }

    doc.moveDown(2);
  }

  /**
   * Add guarantor section
   * @param {PDFDocument} doc - PDF document
   * @param {Array} guarantors - Guarantor information
   */
  async addGuarantorSection(doc, guarantors) {
    doc.fontSize(14)
      .font('Helvetica-Bold')
      .text('GUARANTOR INFORMATION', { underline: true })
      .moveDown(1);

    guarantors.forEach((guarantor, index) => {
      doc.fontSize(12)
        .font('Helvetica-Bold')
        .text(`Guarantor ${index + 1}:`)
        .font('Helvetica')
        .text(`Name: ${guarantor.fullName}`)
        .text(`NIC: ${guarantor.nic}`)
        .text(`Phone: ${guarantor.phoneNumber}`)
        .text(`Relationship: ${guarantor.relationship}`)
        .moveDown(1);
    });

    doc.moveDown(1);
  }

  /**
   * Add terms and conditions
   * @param {PDFDocument} doc - PDF document
   * @param {string} language - Language
   */
  async addTermsAndConditions(doc, language) {
    // Check if we need a new page
    if (doc.y > 600) {
      doc.addPage();
    }

    doc.fontSize(14)
      .font('Helvetica-Bold')
      .text('TERMS AND CONDITIONS', { underline: true })
      .moveDown(1);

    const terms = this.getTermsAndConditions(language);

    doc.fontSize(10)
      .font('Helvetica');

    terms.forEach((term, index) => {
      doc.text(`${index + 1}. ${term}`)
        .moveDown(0.5);

      // Check if we need a new page
      if (doc.y > 720) {
        doc.addPage();
      }
    });

    doc.moveDown(2);
  }

  /**
   * Add signature section
   * @param {PDFDocument} doc - PDF document
   * @param {Object} loanData - Loan data
   * @param {Object} clientData - Client data
   */
  async addSignatureSection(doc, loanData, clientData) {
    // Check if we need a new page
    if (doc.y > 650) {
      doc.addPage();
    }

    doc.fontSize(14)
      .font('Helvetica-Bold')
      .text('SIGNATURES', { underline: true })
      .moveDown(2);

    const signatureY = doc.y;

    // Borrower signature
    doc.fontSize(12)
      .font('Helvetica')
      .text('BORROWER:', 50, signatureY)
      .text('_________________________', 50, signatureY + 40)
      .text(`${clientData.personalInfo.fullName}`, 50, signatureY + 60)
      .text(`Date: _______________`, 50, signatureY + 80);

    // Lender signature
    doc.text('LENDER:', 300, signatureY)
      .text('_________________________', 300, signatureY + 40)
      .text('Authorized Representative', 300, signatureY + 60)
      .text('PaySync Microfinance Ltd.', 300, signatureY + 75)
      .text(`Date: _______________`, 300, signatureY + 95);

    // Witness signature
    doc.text('WITNESS:', 50, signatureY + 120)
      .text('_________________________', 50, signatureY + 160)
      .text('Name: ___________________', 50, signatureY + 180)
      .text(`Date: _______________`, 50, signatureY + 200);

    doc.moveDown(4);
  }

  /**
   * Calculate monthly payment using loan formula
   * @param {number} principal - Loan amount
   * @param {number} annualRate - Annual interest rate (percentage)
   * @param {number} termMonths - Loan term in months
   * @returns {number} Monthly payment amount
   */
  calculateMonthlyPayment(principal, annualRate, termMonths) {
    const monthlyRate = (annualRate / 100) / 12;
    if (monthlyRate === 0) return principal / termMonths;

    const payment = principal * (monthlyRate * Math.pow(1 + monthlyRate, termMonths)) /
      (Math.pow(1 + monthlyRate, termMonths) - 1);

    return Math.round(payment * 100) / 100; // Round to 2 decimal places
  }

  /**
   * Get terms and conditions based on language
   * @param {string} language - Language code
   * @returns {Array} Terms and conditions
   */
  getTermsAndConditions(language) {
    const terms = {
      en: [
        'The borrower agrees to repay the loan amount along with interest as per the repayment schedule.',
        'Monthly payments are due on the same date each month as specified in the repayment schedule.',
        'Late payment charges of 2% per month will be applied to overdue amounts.',
        'The borrower must maintain adequate insurance coverage for the duration of the loan.',
        'The lender reserves the right to demand immediate repayment if the borrower defaults.',
        'Any changes to this agreement must be made in writing and signed by both parties.',
        'This agreement is governed by the laws of Sri Lanka.',
        'The borrower has the right to prepay the loan without penalty after 6 months.',
        'All disputes shall be resolved through arbitration in Colombo, Sri Lanka.',
        'The borrower must notify the lender of any change in contact information within 30 days.'
      ]
    };

    return terms[language] || terms.en;
  }

  /**
   * Convert PDF document to buffer
   * @param {PDFDocument} doc - PDF document
   * @returns {Promise<Buffer>} PDF buffer
   */
  documentToBuffer(doc) {
    return new Promise((resolve, reject) => {
      const buffers = [];

      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => {
        const pdfBuffer = Buffer.concat(buffers);
        resolve(pdfBuffer);
      });
      doc.on('error', reject);

      doc.end();
    });
  }

  /**
   * Add watermark to document
   * @param {PDFDocument} doc - PDF document
   * @param {string} watermarkText - Watermark text
   */
  addWatermark(doc, watermarkText) {
    const pages = doc._pageBuffer.length + 1;

    for (let i = 0; i < pages; i++) {
      doc.switchToPage(i);

      doc.save()
        .rotate(45, { origin: [300, 400] })
        .fontSize(60)
        .fillColor('gray', 0.1)
        .text(watermarkText, 200, 350, { align: 'center' })
        .restore();
    }
  }

  /**
   * Generate agreement summary for quick reference
   * @param {Object} loanData - Loan data
   * @param {Object} clientData - Client data
   * @returns {Object} Agreement summary
   */
  generateAgreementSummary(loanData, clientData) {
    const loanAmount = parseFloat(loanData.loanAmount);
    const interestRate = parseFloat(loanData.interestRate);
    const loanTerm = parseInt(loanData.loanTerm);
    const monthlyPayment = this.calculateMonthlyPayment(loanAmount, interestRate, loanTerm);
    const totalAmount = monthlyPayment * loanTerm;

    return {
      agreementNumber: loanData.loanApplicationId,
      borrowerName: clientData.personalInfo.fullName,
      borrowerNIC: clientData.personalInfo.nic,
      loanAmount: loanAmount,
      interestRate: interestRate,
      loanTerm: loanTerm,
      monthlyPayment: monthlyPayment,
      totalRepayment: totalAmount,
      startDate: new Date(),
      endDate: new Date(Date.now() + (loanTerm * 30 * 24 * 60 * 60 * 1000)), // Approximate
      purpose: loanData.loanPurpose || 'General Business'
    };
  }
}

module.exports = new AgreementService();