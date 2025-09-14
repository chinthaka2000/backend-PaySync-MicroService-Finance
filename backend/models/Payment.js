/**
 * Payment Model
 * Handles loan payment records and verification
 */

const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  // Payment identification
  paymentId: {
    type: String,
    unique: true,
    default: function () {
      return `PAY${Date.now()}${Math.random().toString(36).substr(2, 5).toUpperCase()}`;
    }
  },

  // Related entities
  loanId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Loan',
    required: true,
    index: true
  },
  clientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Client',
    required: true,
    index: true
  },

  // Payment details
  paymentAmount: {
    type: Number,
    required: true,
    min: 0
  },
  paymentDate: {
    type: Date,
    required: true,
    index: true
  },
  paymentMethod: {
    type: String,
    enum: ['bank_transfer', 'cash_deposit', 'online_payment', 'cheque', 'mobile_payment'],
    required: true
  },
  referenceNumber: {
    type: String,
    sparse: true
  },

  // Payment proof and verification
  paymentProof: {
    type: String, // File path to uploaded proof
    required: false
  },
  status: {
    type: String,
    enum: ['pending_verification', 'verified', 'rejected', 'processing'],
    default: 'pending_verification',
    index: true
  },

  // Verification details
  verifiedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Staff'
  },
  verifiedAt: {
    type: Date
  },
  verificationNotes: {
    type: String,
    maxlength: 500
  },

  // Rejection details
  rejectedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Staff'
  },
  rejectedAt: {
    type: Date
  },
  rejectionReason: {
    type: String,
    maxlength: 500
  },

  // Additional information
  notes: {
    type: String,
    maxlength: 500
  },
  submittedAt: {
    type: Date,
    default: Date.now
  },

  // Payment processing
  processedAt: {
    type: Date
  },
  processedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Staff'
  },

  // Late payment tracking
  isLatePayment: {
    type: Boolean,
    default: false
  },
  lateFee: {
    type: Number,
    default: 0
  },
  daysLate: {
    type: Number,
    default: 0
  },

  // Installment tracking
  installmentNumber: {
    type: Number,
    min: 1
  },
  principalAmount: {
    type: Number,
    min: 0
  },
  interestAmount: {
    type: Number,
    min: 0
  },

  // Audit trail
  auditLog: [{
    action: String,
    performedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Staff'
    },
    timestamp: {
      type: Date,
      default: Date.now
    },
    details: mongoose.Schema.Types.Mixed
  }]
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for performance
paymentSchema.index({ loanId: 1, paymentDate: -1 });
paymentSchema.index({ clientId: 1, status: 1 });
paymentSchema.index({ status: 1, submittedAt: -1 });
paymentSchema.index({ verifiedBy: 1, verifiedAt: -1 });

// Virtual for payment age
paymentSchema.virtual('paymentAge').get(function () {
  return Math.floor((new Date() - this.submittedAt) / (1000 * 60 * 60 * 24));
});

// Methods
paymentSchema.methods.verify = function (staffId, notes = '') {
  this.status = 'verified';
  this.verifiedBy = staffId;
  this.verifiedAt = new Date();
  this.verificationNotes = notes;
  this.processedAt = new Date();
  this.processedBy = staffId;

  this.auditLog.push({
    action: 'verified',
    performedBy: staffId,
    details: { notes }
  });

  return this.save();
};

paymentSchema.methods.reject = function (staffId, reason) {
  this.status = 'rejected';
  this.rejectedBy = staffId;
  this.rejectedAt = new Date();
  this.rejectionReason = reason;

  this.auditLog.push({
    action: 'rejected',
    performedBy: staffId,
    details: { reason }
  });

  return this.save();
};

paymentSchema.methods.addAuditEntry = function (action, staffId, details = {}) {
  this.auditLog.push({
    action,
    performedBy: staffId,
    details
  });
};

// Static methods
paymentSchema.statics.getPendingPayments = function (agentId = null) {
  let query = { status: 'pending_verification' };

  if (agentId) {
    // Get payments for loans assigned to this agent
    return this.find(query)
      .populate({
        path: 'loanId',
        match: { assignedReviewer: agentId },
        populate: {
          path: 'clientUserId',
          select: 'firstName lastName email phone'
        }
      })
      .populate('clientId', 'firstName lastName email phone')
      .sort({ submittedAt: 1 });
  }

  return this.find(query)
    .populate('loanId', 'loanAmount loanPurpose assignedReviewer')
    .populate('clientId', 'firstName lastName email phone')
    .sort({ submittedAt: 1 });
};

paymentSchema.statics.getPaymentStats = function (startDate, endDate, agentId = null) {
  let matchStage = {
    paymentDate: { $gte: startDate, $lte: endDate }
  };

  if (agentId) {
    // This would need to be joined with Loan collection to filter by agent
    // For now, we'll keep it simple
  }

  return this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        totalAmount: { $sum: '$paymentAmount' },
        avgAmount: { $avg: '$paymentAmount' }
      }
    }
  ]);
};

// Pre-save middleware
paymentSchema.pre('save', function (next) {
  // Calculate late payment details if applicable
  if (this.isModified('paymentDate') && this.loanId) {
    // This would need loan details to calculate if payment is late
    // For now, we'll keep it simple
  }

  next();
});

module.exports = mongoose.model('Payment', paymentSchema);