// models/Client.js

const mongoose = require("mongoose");

const clientSchema = new mongoose.Schema({
  // Registration Overview
  registrationId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  submissionDate: {
    type: Date,
    default: Date.now
  },
  lastUpdated: Date,
  assignedReviewer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Staff'
  },
  verifiedOverview: { type: Boolean, default: false },

  // Agent assignment (managed by moderate admin)
  assignedAgent: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Staff',
    index: true
  },
  assignedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Staff' // moderate admin who made assignment
  },
  assignedAt: Date,
  assignmentHistory: [{
    agent: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Staff'
    },
    assignedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Staff'
    },
    assignedAt: Date,
    unassignedAt: Date,
    reason: String
  }],

  // Personal Information
  personalInfo: {
    fullName: String,
    contactNumber: String,
    email: String,
    dateOfBirth: Date,
    address: String,
    district: {
      type: String,
      enum: [
        'Colombo', 'Gampaha', 'Kalutara',
        'Kandy', 'Matale', 'Nuwara Eliya',
        'Galle', 'Matara', 'Hambantota',
        'Jaffna', 'Kilinochchi', 'Mannar',
        'Vavuniya', 'Mullaitivu',
        'Batticaloa', 'Ampara', 'Trincomalee',
        'Kurunegala', 'Puttalam',
        'Anuradhapura', 'Polonnaruwa',
        'Badulla', 'Monaragala',
        'Ratnapura', 'Kegalle'
      ],
      required: true
    },
    verified: { type: Boolean, default: false },
  },

  // Enhanced verification status
  verificationStatus: {
    identity: {
      verified: { type: Boolean, default: false },
      verifiedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Staff'
      },
      verifiedAt: Date,
      rejectionReason: String,
      documents: [{
        type: String,
        url: String,
        uploadedAt: Date,
        status: {
          type: String,
          enum: ['pending', 'approved', 'rejected'],
          default: 'pending'
        }
      }]
    },
    employment: {
      verified: { type: Boolean, default: false },
      verifiedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Staff'
      },
      verifiedAt: Date,
      rejectionReason: String,
      documents: [{
        type: String,
        url: String,
        uploadedAt: Date,
        status: {
          type: String,
          enum: ['pending', 'approved', 'rejected'],
          default: 'pending'
        }
      }]
    },
    income: {
      verified: { type: Boolean, default: false },
      verifiedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Staff'
      },
      verifiedAt: Date,
      rejectionReason: String,
      monthlyIncomeVerified: Number,
      documents: [{
        type: String,
        url: String,
        uploadedAt: Date,
        status: {
          type: String,
          enum: ['pending', 'approved', 'rejected'],
          default: 'pending'
        }
      }]
    },
    documents: {
      verified: { type: Boolean, default: false },
      verifiedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Staff'
      },
      verifiedAt: Date,
      completionPercentage: {
        type: Number,
        default: 0,
        min: 0,
        max: 100
      }
    }
  },

  // Identity Verification (enhanced)
  identityVerification: {
    idType: { type: String, default: 'NIC' },
    idNumber: String,
    idCardUrl: String,
    verified: { type: Boolean, default: false },
    verificationDate: Date,
    verificationNotes: String
  },

  // Employment Details (enhanced)
  employmentDetails: {
    employer: String,
    jobRole: String,
    monthlyIncome: Number,
    employmentDuration: String,
    employmentLetterUrl: String,
    verified: { type: Boolean, default: false },
    workAddress: String,
    supervisorContact: String,
    employmentType: {
      type: String,
      enum: ['permanent', 'contract', 'temporary', 'self_employed'],
      default: 'permanent'
    }
  },

  // Document Overview (enhanced)
  documents: {
    idCardUrl: String,
    employmentLetterUrl: String,
    photoUrl: String,
    paysheetUrl: String,
    uploadedAt: Date,
    verified: { type: Boolean, default: false },
    additionalDocuments: [{
      name: String,
      url: String,
      type: String,
      uploadedAt: Date,
      verifiedAt: Date,
      verifiedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Staff'
      }
    }]
  },

  // Risk assessment
  riskProfile: {
    score: {
      type: Number,
      min: 0,
      max: 100,
      default: 50
    },
    factors: [String],
    lastAssessed: Date,
    assessedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Staff'
    },
    riskLevel: {
      type: String,
      enum: ['low', 'medium', 'high', 'very_high'],
      default: 'medium'
    },
    notes: String
  },

  // Communication preferences
  preferences: {
    emailNotifications: {
      type: Boolean,
      default: true
    },
    smsNotifications: {
      type: Boolean,
      default: true
    },
    preferredLanguage: {
      type: String,
      enum: ['english', 'sinhala', 'tamil'],
      default: 'english'
    },
    contactTimePreference: {
      type: String,
      enum: ['morning', 'afternoon', 'evening', 'anytime'],
      default: 'anytime'
    }
  },

  // Application Details (enhanced)
  agentNotes: String,
  verifiedNote: { type: Boolean, default: false },
  internalNotes: [{
    note: String,
    addedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Staff'
    },
    addedAt: {
      type: Date,
      default: Date.now
    },
    category: {
      type: String,
      enum: ['general', 'verification', 'risk', 'communication'],
      default: 'general'
    }
  }],

  // Regional assignment
  region: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Region',
    index: true
  },

  // Enhanced status tracking
  status: {
    type: String,
    enum: ['Pending', 'Under_Review', 'Approved', 'Rejected', 'Inactive', 'Blacklisted'],
    default: 'Pending',
    index: true
  },
  statusHistory: [{
    status: String,
    changedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Staff'
    },
    changedAt: {
      type: Date,
      default: Date.now
    },
    reason: String,
    notes: String
  }],

  approvedAt: Date,
  rejectedAt: Date,
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Staff'
  },
  rejectedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Staff'
  },
  rejectionReason: String,

  // Audit trail
  auditTrail: [{
    action: {
      type: String,
      required: true,
      enum: [
        'created', 'updated', 'assigned', 'verified', 'approved', 'rejected',
        'document_uploaded', 'risk_assessed', 'status_changed', 'notes_added'
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
    changes: mongoose.Schema.Types.Mixed,
    ipAddress: String,
    userAgent: String
  }],

  // Search optimization
  searchableText: {
    type: String,
    index: 'text'
  }
},
  {
    timestamps: true
  });

// Indexes for performance optimization
clientSchema.index({ 'personalInfo.district': 1, status: 1 });
clientSchema.index({ assignedAgent: 1, status: 1 });
clientSchema.index({ region: 1, status: 1 });
clientSchema.index({ 'identityVerification.idNumber': 1 });
clientSchema.index({ 'personalInfo.email': 1 });
clientSchema.index({ 'personalInfo.contactNumber': 1 });
clientSchema.index({ 'riskProfile.riskLevel': 1, 'riskProfile.score': 1 });
clientSchema.index({ createdAt: -1, updatedAt: -1 });
clientSchema.index({ assignedBy: 1, assignedAt: -1 });

// Compound indexes for common queries
clientSchema.index({
  assignedAgent: 1,
  status: 1,
  'personalInfo.district': 1
});
clientSchema.index({
  region: 1,
  'verificationStatus.identity.verified': 1,
  'verificationStatus.employment.verified': 1
});

// Methods for client management
clientSchema.methods.addAuditEntry = function (action, performedBy, changes = {}, ipAddress = '', userAgent = '') {
  this.auditTrail.push({
    action,
    performedBy,
    changes,
    ipAddress,
    userAgent
  });
  return this;
};

clientSchema.methods.assignToAgent = function (agentId, assignedBy, reason = '') {
  // Add to assignment history
  if (this.assignedAgent) {
    this.assignmentHistory.push({
      agent: this.assignedAgent,
      assignedBy: this.assignedBy,
      assignedAt: this.assignedAt,
      unassignedAt: new Date(),
      reason: 'Reassigned'
    });
  }

  this.assignedAgent = agentId;
  this.assignedBy = assignedBy;
  this.assignedAt = new Date();

  this.addAuditEntry('assigned', assignedBy, {
    previousAgent: this.assignedAgent,
    newAgent: agentId,
    reason
  });

  return this;
};

clientSchema.methods.updateVerificationStatus = function (category, verified, verifiedBy, reason = '') {
  if (this.verificationStatus[category]) {
    this.verificationStatus[category].verified = verified;
    this.verificationStatus[category].verifiedBy = verifiedBy;
    this.verificationStatus[category].verifiedAt = new Date();

    if (!verified && reason) {
      this.verificationStatus[category].rejectionReason = reason;
    }

    this.addAuditEntry('verified', verifiedBy, {
      category,
      verified,
      reason
    });
  }
  return this;
};

clientSchema.methods.updateRiskProfile = function (score, factors, assessedBy, notes = '') {
  this.riskProfile.score = score;
  this.riskProfile.factors = factors;
  this.riskProfile.lastAssessed = new Date();
  this.riskProfile.assessedBy = assessedBy;
  this.riskProfile.notes = notes;

  // Determine risk level based on score
  if (score <= 25) this.riskProfile.riskLevel = 'low';
  else if (score <= 50) this.riskProfile.riskLevel = 'medium';
  else if (score <= 75) this.riskProfile.riskLevel = 'high';
  else this.riskProfile.riskLevel = 'very_high';

  this.addAuditEntry('risk_assessed', assessedBy, {
    score,
    riskLevel: this.riskProfile.riskLevel,
    factors
  });

  return this;
};

clientSchema.methods.changeStatus = function (newStatus, changedBy, reason = '', notes = '') {
  const oldStatus = this.status;

  this.statusHistory.push({
    status: oldStatus,
    changedBy,
    reason,
    notes
  });

  this.status = newStatus;

  if (newStatus === 'Approved') {
    this.approvedAt = new Date();
    this.approvedBy = changedBy;
  } else if (newStatus === 'Rejected') {
    this.rejectedAt = new Date();
    this.rejectedBy = changedBy;
    this.rejectionReason = reason;
  }

  this.addAuditEntry('status_changed', changedBy, {
    previousStatus: oldStatus,
    newStatus,
    reason,
    notes
  });

  return this;
};

clientSchema.methods.updateSearchableText = function () {
  const searchFields = [
    this.registrationId,
    this.personalInfo?.fullName,
    this.personalInfo?.email,
    this.personalInfo?.contactNumber,
    this.identityVerification?.idNumber,
    this.employmentDetails?.employer,
    this.status
  ];

  this.searchableText = searchFields.filter(Boolean).join(' ').toLowerCase();
  return this;
};

// Pre-save middleware
clientSchema.pre('save', function (next) {
  this.updateSearchableText();
  this.lastUpdated = new Date();
  next();
});

module.exports = mongoose.model("Client", clientSchema);
