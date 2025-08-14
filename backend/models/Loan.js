
const mongoose = require('mongoose');

const guarantorSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  idNumber: {
    type: String,
    required: true
  },
  contactNumber: {
    type: String,
    required: true
  },
  address: {
    type: String,
    required: true
  },
  relationship: {
    type: String,
    required: true
  },
  idDocumentUrl: String,
  paysheetUrl: String
});

const paymentSchema = new mongoose.Schema({
  paymentId: {
    type: String
  },
  amount: {
    type: Number,
    required: true
  },
  paymentDate: {
    type: Date,
    required: true
  },
  paymentMethod: {
    type: String,
    enum: ['bank_transfer', 'online', 'cash', 'cheque'],
    default: 'bank_transfer'
  },
  paymentSlipUrl: String,
  status: {
    type: String,
    enum: ['Pending', 'Approved', 'Rejected'],
    default: 'Pending'
  },
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Staff'
  },
  approvedAt: Date,
  rejectedReason: String
});

const loanSchema = new mongoose.Schema({
  loanApplicationId: {
    type: String,
    unique: true
  },
  clientUserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Client',
    required: true
  },
  product: {
    type: String,
    required: true,
    enum: ['Personal Loan', 'Business Loan', 'Vehicle Loan', 'Home Loan', 'Education Loan']
  },
  loanAmount: {
    type: Number,
    required: true
  },
  loanTerm: {
    type: Number,
    required: true // in months
  },
  loanType: {
    type: String,
    enum: ['Secured', 'Unsecured'],
    default: 'Unsecured'
  },
  interestRate: {
    type: Number,
    required: true
  },
  repaymentFrequency: {
    type: String,
    enum: ['Monthly', 'Quarterly', 'Semi-annually', 'Annually'],
    default: 'Monthly'
  },
  purpose: {
    type: String,
    required: true
  },
  primaryGuarantor: guarantorSchema,
  secondaryGuarantor: guarantorSchema,
  borrowerPaysheetUrl: String,
  downPayment: {
    amount: {
      type: Number,
      required: true
    },
    paymentSlipUrl: String,
    status: {
      type: String,
      enum: ['Pending', 'Verified'],
      default: 'Pending'
    }
  },
  totalPayableAmount: Number,
  monthlyInstallment: Number,
  monthlyInstallmentDueDate: Number, // day of month (1-31)
  loanStatus: {
    type: String,
    enum: ['Pending', 'Under Review', 'Approved', 'Rejected', 'Active', 'Completed', 'Defaulted'],
    default: 'Pending'
  },
  agentReview: {
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Staff'
    },
    reviewDate: Date,
    status: {
      type: String,
      enum: ['Pending', 'Approved', 'Rejected']
    },
    comments: String,
    rating: {
      type: Number,
      min: 1,
      max: 5
    }
  },
  regionalAdminApproval: {
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Staff'
    },
    approvalDate: Date,
    status: {
      type: String,
      enum: ['Pending', 'Approved', 'Rejected']
    },
    comments: String
  },
  agreementGenerated: {
    type: Boolean,
    default: false
  },
  agreementUrl: String,
  agreementGeneratedDate: Date,
  loanClosure: {
    closureDate: Date,
    closureReason: String,
    finalAmount: Number
  },
  paymentHistory: [paymentSchema],
  agentRating: Number,
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Calculate total payable amount and monthly installment before saving
loanSchema.pre('save', function (next) {
  if (this.loanAmount && this.interestRate && this.loanTerm) {
    // Simple interest calculation for now
    const principal = this.loanAmount;
    const rate = this.interestRate / 100;
    const time = this.loanTerm / 12; // convert months to years

    const interest = principal * rate * time;
    this.totalPayableAmount = principal + interest;
    this.monthlyInstallment = this.totalPayableAmount / this.loanTerm;
  }

  this.updatedAt = Date.now();
  next();
});

// Generate unique loan application ID
loanSchema.pre('save', async function (next) {
  if (!this.loanApplicationId) {
    try {
      const count = await this.constructor.countDocuments();
      this.loanApplicationId = `L${String(count + 1).padStart(6, '0')}`;
    } catch (error) {
      return next(error);
    }
  }
  next();
});

module.exports = mongoose.model('Loan', loanSchema);
