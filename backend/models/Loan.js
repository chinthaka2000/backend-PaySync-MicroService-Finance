// models/Loan.js
const mongoose = require('mongoose');

const clientLoanSchema = new mongoose.Schema({
  loanApplicationId: {
    type: String,
    required: true,
    unique: true, // e.g., LN00001
  },

  clientUserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'clientUser',
    required: true,
  },
  product:{
    type:String,
    required: true, // e.g., Personal Loan, Home Loan, etc.
  },

  productValue: {
    type: Number,
    required: true,
  },

  loanTerm: {
    type: Number,
    required: true, // in months (e.g., 12, 24, 36)
  },
  loanType:{
    type:String,
    required: true, // e.g., Secured, Unsecured
  },

  interestRate: {
    type: Number,
    required: true, // e.g., 12.5 (%)
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

  endDate: {
    type: Date,
  },

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
    required: true, // calculated based on loan amount, interest rate, and term
  },
  monthlyInstallmentDueDate: {
    type: Date,
    required: true, // e.g., 5th of every month
  },
  
  lateFee: {
    applied: {
      type: Boolean,
      default: false, // true if late fee has been applied
    },
    amount: {
      type: Number,
      default: 0, // e.g., 500
    },
    paymentDate: {
      type: Date,
      default: null, // date when late fee was paid
    },
    paymentStatus: {
      type: String,
      enum: ['Pending', 'Paid'],
      default: 'Pending',
    }
  },

  loanStatus: {
    type: String,
    enum: ['Pending', 'Approved', 'Rejected', 'Disbursed', 'Closed'],
    default: 'Pending',
  },

  loanApprovalDate: {
    type: Date,
    default: null, // date when loan was approved
  },

  loanDisbursementDate: {
    type: Date,
    default: null, // date when loan was disbursed
  },

  loanClosure: {
    status: {
      type: String,
      enum: ['Pending', 'Closed'],
      default: 'Pending',
    },
    amount: {
      type: Number,
      default: 0, // amount paid to close the loan
    },
    closureDate: {
      type: Date,
      default: null, // date when loan was closed
    },
    paymentDate: {
      type: Date,
      default: null, // date when loan closure payment was made
    },
    paymentStatus: {
      type: String,
      enum: ['Pending', 'Paid'],
      default: 'Pending',
    }
  },

  paymentHistory: {
    paymentDate: {
      type: Date,
      default: null,
    },
    amount: {
      type: Number,
      required: true,
    },
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
  },
  
  agentNotes: String,
  agentFeedback: String,
  agentRating: {
    type: Number,
    min: 1,
    max: 5,
    default: 3, // default rating
  },

  status: {
    type: String,
    enum: ['Pending', 'Approved', 'Rejected', 'Disbursed', 'Closed'],
    default: 'Pending',
  },

  assignedAgent: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'staff', // staff/agent user
  },

  createdAt: {
    type: Date,
    default: Date.now,
  },

  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('ClientLoan', clientLoanSchema);
