
const mongoose = require('mongoose');


const loanSchema = new mongoose.Schema({
  loanApplicationId: {
    type: String,
    unique: true,
    index: true
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
  primaryGuarantor: { type: mongoose.Schema.Types.ObjectId, ref: 'Grantor' },
  secondaryGuarantor: { type: mongoose.Schema.Types.ObjectId, ref: 'Grantor' },
  payments: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Payment' }],
  purpose: {
    type: String,
    required: true
  },
  
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
  agreementStatus: {
    type: String,
    enum: ['Pending', 'Generated', 'Sent', 'Signed'],
    default: 'Pending'
  },
  agreementSentDate: Date,
  loanClosure: {
    closureDate: Date,
    closureReason: String,
    finalAmount: Number
  },

  agentRating: Number,

  // Enhanced audit trail
  auditTrail: [{
    action: {
      type: String,
      required: true,
      enum: [
        'created', 'updated', 'status_changed', 'approved', 'rejected',
        'payment_added', 'agreement_generated', 'workflow_advanced',
        'assigned', 'reviewed', 'documents_uploaded', 'calculation_updated',
        'workflow_blocked'
      ]
    },
    performedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Staff',
      required: true
    },
    performedAt: {
      type: Date,
      default: Date.now
    },
    changes: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },
    previousValues: mongoose.Schema.Types.Mixed,
    newValues: mongoose.Schema.Types.Mixed,
    comments: String,
    ipAddress: String,
    userAgent: String,
    sessionId: String
  }],

  // Enhanced workflow tracking
  workflowState: {
    currentStage: {
      type: String,
      enum: [
        'application_submitted', 'documents_pending', 'agent_review',
        'regional_approval', 'agreement_generation', 'agreement_signed',
        'disbursement', 'active', 'completed', 'defaulted', 'closed'
      ],
      default: 'application_submitted',
      index: true
    },
    stageHistory: [{
      stage: {
        type: String,
        required: true
      },
      enteredAt: {
        type: Date,
        default: Date.now
      },
      completedAt: Date,
      performedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Staff'
      },
      duration: Number, // in milliseconds
      notes: String
    }],
    nextStage: String,
    blockedReason: String,
    isBlocked: {
      type: Boolean,
      default: false
    }
  },

  // Regional filtering and assignment
  region: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Region',
    required: true,
    index: true
  },
  district: {
    type: String,
    required: true,
    index: true
  },
  assignedAgent: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Staff',
    index: true
  },
  assignedRegionalManager: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Staff',
    index: true
  },

  // Performance and search optimization
  searchableText: {
    type: String,
    index: 'text'
  },
  calculatedFields: {
    totalInterest: Number,
    remainingBalance: Number,
    nextPaymentDate: Date,
    daysOverdue: {
      type: Number,
      default: 0
    },
    completionPercentage: {
      type: Number,
      default: 0,
      min: 0,
      max: 100
    },
    riskScore: {
      type: Number,
      default: 0,
      min: 0,
      max: 100
    }
  },

  // Enhanced metadata
  metadata: {
    source: {
      type: String,
      enum: ['web_application', 'mobile_app', 'agent_portal', 'bulk_import'],
      default: 'web_application'
    },
    priority: {
      type: String,
      enum: ['low', 'normal', 'high', 'urgent'],
      default: 'normal'
    },
    tags: [String],
    externalReferences: [{
      system: String,
      referenceId: String,
      type: String
    }]
  },

  createdAt: {
    type: Date,
    default: Date.now,
    index: true
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

// Enhanced indexes for performance optimization
loanSchema.index({ clientUserId: 1, loanStatus: 1 });
loanSchema.index({ 'agentReview.reviewedBy': 1, createdAt: -1 });
loanSchema.index({ 'regionalAdminApproval.approvedBy': 1, createdAt: -1 });
loanSchema.index({ region: 1, district: 1, loanStatus: 1 });
loanSchema.index({ 'workflowState.currentStage': 1, createdAt: -1 });
loanSchema.index({ assignedAgent: 1, loanStatus: 1 });
loanSchema.index({ assignedRegionalManager: 1, loanStatus: 1 });
loanSchema.index({ loanAmount: 1, interestRate: 1 });
loanSchema.index({ 'calculatedFields.nextPaymentDate': 1, loanStatus: 1 });
loanSchema.index({ 'calculatedFields.daysOverdue': 1 });
loanSchema.index({ 'metadata.priority': 1, createdAt: -1 });
loanSchema.index({ createdAt: -1, updatedAt: -1 });

// Compound indexes for common queries
loanSchema.index({
  region: 1,
  'workflowState.currentStage': 1,
  loanStatus: 1,
  createdAt: -1
});
loanSchema.index({
  assignedAgent: 1,
  'workflowState.currentStage': 1,
  loanStatus: 1
});
loanSchema.index({
  district: 1,
  loanAmount: 1,
  createdAt: -1
});

// Enhanced methods for audit trail and workflow management
loanSchema.methods.addAuditEntry = function (action, performedBy, changes = {}, comments = '', ipAddress = '', userAgent = '', sessionId = '') {
  const auditEntry = {
    action,
    performedBy,
    changes,
    comments,
    ipAddress,
    userAgent,
    sessionId
  };

  // Store previous and new values if changes provided
  if (changes.previous) auditEntry.previousValues = changes.previous;
  if (changes.new) auditEntry.newValues = changes.new;

  this.auditTrail.push(auditEntry);
  return this;
};

// Method to advance workflow stage
loanSchema.methods.advanceWorkflowStage = function (newStage, performedBy, notes = '') {
  const currentStageEntry = this.workflowState.stageHistory.find(
    stage => stage.stage === this.workflowState.currentStage && !stage.completedAt
  );

  if (currentStageEntry) {
    currentStageEntry.completedAt = new Date();
    currentStageEntry.duration = currentStageEntry.completedAt - currentStageEntry.enteredAt;
  }

  this.workflowState.stageHistory.push({
    stage: newStage,
    enteredAt: new Date(),
    performedBy,
    notes
  });

  this.workflowState.currentStage = newStage;
  this.workflowState.isBlocked = false;
  this.workflowState.blockedReason = null;

  this.addAuditEntry('workflow_advanced', performedBy, {
    previous: currentStageEntry?.stage,
    new: newStage
  }, notes);

  return this;
};

// Method to block workflow
loanSchema.methods.blockWorkflow = function (reason, performedBy) {
  this.workflowState.isBlocked = true;
  this.workflowState.blockedReason = reason;
  this.addAuditEntry('workflow_blocked', performedBy, { reason }, reason);
  return this;
};

// Method to update calculated fields
loanSchema.methods.updateCalculatedFields = function () {
  if (this.loanAmount && this.interestRate && this.loanTerm) {
    const principal = this.loanAmount;
    const rate = this.interestRate / 100;
    const time = this.loanTerm / 12;

    this.calculatedFields.totalInterest = principal * rate * time;

    // Calculate remaining balance based on payments
    const totalPaid = this.paymentHistory
      .filter(payment => payment.status === 'Approved')
      .reduce((sum, payment) => sum + payment.amount, 0);

    this.calculatedFields.remainingBalance = this.totalPayableAmount - totalPaid;

    // Calculate completion percentage
    this.calculatedFields.completionPercentage = this.totalPayableAmount > 0
      ? Math.round((totalPaid / this.totalPayableAmount) * 100)
      : 0;

    // Calculate next payment date (simplified)
    if (this.monthlyInstallmentDueDate && this.loanStatus === 'Active') {
      const now = new Date();
      const nextPayment = new Date(now.getFullYear(), now.getMonth(), this.monthlyInstallmentDueDate);
      if (nextPayment <= now) {
        nextPayment.setMonth(nextPayment.getMonth() + 1);
      }
      this.calculatedFields.nextPaymentDate = nextPayment;

      // Calculate days overdue
      if (nextPayment < now) {
        this.calculatedFields.daysOverdue = Math.floor((now - nextPayment) / (1000 * 60 * 60 * 24));
      }
    }
  }
  return this;
};

// Method to update searchable text
loanSchema.methods.updateSearchableText = function () {
  const searchFields = [
    this.loanApplicationId,
    this.product,
    this.purpose,
    this.loanStatus,
    this.workflowState?.currentStage
  ];

  this.searchableText = searchFields.filter(Boolean).join(' ').toLowerCase();
  return this;
};

// Pre-save middleware to update calculated fields and searchable text
loanSchema.pre('save', function (next) {
  this.updateCalculatedFields();
  this.updateSearchableText();
  next();
});

module.exports = mongoose.model('Loan', loanSchema);
