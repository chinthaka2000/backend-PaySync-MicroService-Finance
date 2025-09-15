const mongoose = require("mongoose");

const regionSchema = new mongoose.Schema({
  code: {
    type: String,
    required: true,
    unique: true,
    index: true,
    uppercase: true
  },
  name: {
    type: String,
    required: true,
    index: true
  },

  // Enhanced district management
  districts: [{
    type: String,
    required: true,
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
    ]
  }],

  // Regional management
  regionalManager: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Staff',
    index: true
  },
  assignedStaff: [{
    staff: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Staff'
    },
    role: String,
    assignedAt: Date,
    assignedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Staff'
    }
  }],

  // Administrative details
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Staff',
    required: true
  },
  managedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Staff' // Current moderate admin managing this region
  },

  // Regional configuration
  configuration: {
    maxLoanAmount: {
      type: Number,
      default: 10000000
    },
    defaultInterestRate: {
      type: Number,
      default: 12.5
    },
    maxLoanTerm: {
      type: Number,
      default: 60 // months
    },
    requiredDocuments: [String],
    approvalWorkflow: [{
      stage: String,
      requiredRole: String,
      maxAmount: Number,
      timeoutDays: Number
    }],
    businessHours: {
      start: String, // "09:00"
      end: String,   // "17:00"
      timezone: {
        type: String,
        default: "Asia/Colombo"
      },
      workingDays: [{
        type: String,
        enum: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
      }]
    }
  },

  // Regional statistics
  statistics: {
    totalClients: {
      type: Number,
      default: 0
    },
    activeLoans: {
      type: Number,
      default: 0
    },
    totalLoanAmount: {
      type: Number,
      default: 0
    },
    averageProcessingTime: {
      type: Number,
      default: 0
    },
    approvalRate: {
      type: Number,
      default: 0
    },
    lastUpdated: Date
  },

  // Status and activity
  status: {
    type: String,
    enum: ['active', 'inactive', 'suspended'],
    default: 'active',
    index: true
  },

  // Geographic information
  geography: {
    coordinates: {
      latitude: Number,
      longitude: Number
    },
    area: Number, // in square kilometers
    population: Number,
    economicZone: {
      type: String,
      enum: ['urban', 'suburban', 'rural', 'mixed']
    }
  },

  // Audit trail
  auditTrail: [{
    action: {
      type: String,
      required: true,
      enum: [
        'created', 'updated', 'district_added', 'district_removed',
        'manager_assigned', 'staff_assigned', 'configuration_updated',
        'status_changed', 'statistics_updated'
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
    ipAddress: String
  }],

  // Search optimization
  searchableText: {
    type: String,
    index: 'text'
  }
}, {
  timestamps: true
});

// Indexes for performance optimization
regionSchema.index({ districts: 1 });
regionSchema.index({ regionalManager: 1, status: 1 });
regionSchema.index({ createdBy: 1, createdAt: -1 });
regionSchema.index({ 'assignedStaff.staff': 1 });
regionSchema.index({ 'statistics.totalClients': -1 });
regionSchema.index({ 'statistics.activeLoans': -1 });

// Virtual for total staff count
regionSchema.virtual('totalStaff').get(function () {
  return this.assignedStaff ? this.assignedStaff.length : 0;
});

// Methods for region management
regionSchema.methods.addAuditEntry = function (action, performedBy, changes = {}, ipAddress = '') {
  this.auditTrail.push({
    action,
    performedBy,
    changes,
    ipAddress
  });
  return this;
};

regionSchema.methods.assignRegionalManager = function (managerId, assignedBy) {
  const previousManager = this.regionalManager;
  this.regionalManager = managerId;

  // Update assigned staff list
  this.assignedStaff = this.assignedStaff.filter(
    staff => staff.staff.toString() !== managerId.toString()
  );

  this.assignedStaff.push({
    staff: managerId,
    role: 'regional_manager',
    assignedAt: new Date(),
    assignedBy
  });

  this.addAuditEntry('manager_assigned', assignedBy, {
    previousManager,
    newManager: managerId
  });

  return this;
};

regionSchema.methods.assignStaff = function (staffId, role, assignedBy) {
  // Remove if already assigned
  this.assignedStaff = this.assignedStaff.filter(
    staff => staff.staff.toString() !== staffId.toString()
  );

  this.assignedStaff.push({
    staff: staffId,
    role,
    assignedAt: new Date(),
    assignedBy
  });

  this.addAuditEntry('staff_assigned', assignedBy, {
    staffId,
    role
  });

  return this;
};

regionSchema.methods.removeStaff = function (staffId, removedBy) {
  this.assignedStaff = this.assignedStaff.filter(
    staff => staff.staff.toString() !== staffId.toString()
  );

  this.addAuditEntry('staff_removed', removedBy, {
    staffId
  });

  return this;
};

regionSchema.methods.addDistrict = function (district, addedBy) {
  if (!this.districts.includes(district)) {
    this.districts.push(district);
    this.addAuditEntry('district_added', addedBy, {
      district
    });
  }
  return this;
};

regionSchema.methods.removeDistrict = function (district, removedBy) {
  this.districts = this.districts.filter(d => d !== district);
  this.addAuditEntry('district_removed', removedBy, {
    district
  });
  return this;
};

regionSchema.methods.updateStatistics = function (stats, updatedBy) {
  Object.assign(this.statistics, stats);
  this.statistics.lastUpdated = new Date();

  this.addAuditEntry('statistics_updated', updatedBy, {
    statistics: stats
  });

  return this;
};

regionSchema.methods.updateConfiguration = function (config, updatedBy) {
  Object.assign(this.configuration, config);

  this.addAuditEntry('configuration_updated', updatedBy, {
    configuration: config
  });

  return this;
};

regionSchema.methods.updateSearchableText = function () {
  const searchFields = [
    this.code,
    this.name,
    ...this.districts
  ];

  this.searchableText = searchFields.filter(Boolean).join(' ').toLowerCase();
  return this;
};

// Pre-save middleware
regionSchema.pre('save', function (next) {
  this.updateSearchableText();

  // Auto-generate code if not provided
  if (this.isNew && !this.code) {
    const nameCode = this.name.substring(0, 3).toUpperCase();
    const timestamp = Date.now().toString().slice(-3);
    this.code = `${nameCode}${timestamp}`;
  }

  next();
});

// Static methods for region queries
regionSchema.statics.findByDistrict = function (district) {
  return this.find({ districts: district, status: 'active' });
};

regionSchema.statics.findByManager = function (managerId) {
  return this.find({ regionalManager: managerId, status: 'active' });
};

regionSchema.statics.getRegionStatistics = function () {
  return this.aggregate([
    { $match: { status: 'active' } },
    {
      $group: {
        _id: null,
        totalRegions: { $sum: 1 },
        totalDistricts: { $sum: { $size: '$districts' } },
        totalClients: { $sum: '$statistics.totalClients' },
        totalActiveLoans: { $sum: '$statistics.activeLoans' },
        totalLoanAmount: { $sum: '$statistics.totalLoanAmount' }
      }
    }
  ]);
};

module.exports = mongoose.model("Region", regionSchema);
