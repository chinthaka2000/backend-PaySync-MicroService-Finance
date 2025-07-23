// models/Loan.js
const mongoose = require('mongoose');

const LoanSchema = new mongoose.Schema({
  loanApplicationId: {
    type: String,
    required: true,
    unique: true,
  },

  clientUserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'clientUser',
    required: true,
  },

  product: {
    type: String,
    required: true,
  },

  productValue: {
    type: Number,
    required: true,
  },

  loanTerm: {
    type: Number,
    required: true,
  },

  loanType: {
    type: String,
    required: true,
  },

  interestRate: {
    type: Number,
    required: true,
    min: 1,
    max: 100,
  },

  repaymentFrequency: {
    type: String,
    enum: ['Monthly', 'Weekly', 'Bi-weekly'],
    default: 'Monthly',
  },

  primaryGrantor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Grantor',
    required: true,
  },

  secondaryGrantor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Grantor',
    required: true,
  },

  startDate: {
    type: Date,
    required: true,
  },

  endDate: Date,

  totalPayableAmount: {
    type: Number,
    required: true,
  },

  remainingAmount: {
    type: Number,
    required: true,
  },

  monthlyInstallment: {
    type: Number,
    required: true,
  },

  monthlyInstallmentDueDate: {
    type: Date,
    required: true,
  },

  lateFee: {
    applied: { type: Boolean, default: false },
    amount: { type: Number, default: 0 },
    paymentDate: { type: Date, default: null },
    paymentStatus: {
      type: String,
      enum: ['Pending', 'Paid'],
      default: 'Pending',
    },
  },

  loanStatus: {
    type: String,
    enum: ['Pending', 'Approved', 'Rejected', 'Disbursed', 'Closed'],
    default: 'Pending',
  },

  loanApprovalDate: Date,
  loanDisbursementDate: Date,

  loanClosure: {
    status: {
      type: String,
      enum: ['Pending', 'Closed'],
      default: 'Pending',
    },
    amount: { type: Number, default: 0 },
    closureDate: { type: Date, default: null },
    paymentDate: { type: Date, default: null },
    paymentStatus: {
      type: String,
      enum: ['Pending', 'Paid'],
      default: 'Pending',
    },
  },

  paymentHistory: [{
    paymentDate: { type: Date, default: null },
    amount: { type: Number, required: true },
    status: {
      type: String,
      enum: ['Pending', 'Completed', 'Failed'],
      default: 'Pending',
    },
    paymentMethod: {
      type: String,
      enum: ['Bank Transfer', 'Cash', 'Cheque'],
      default: 'Bank Transfer',
    },
  }],

  agentNotes: String,
  agentFeedback: String,
  agentRating: {
    type: Number,
    min: 1,
    max: 5,
    default: 3,
  },

  assignedAgent: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'staff',
  },
}, { timestamps: true });

module.exports = mongoose.model('Loan', LoanSchema);
