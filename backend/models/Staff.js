// models/Staff.js

const mongoose = require("mongoose");

const staffSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true, index: true },
  passwordHash: { type: String, required: true, select: false },

  role: {
    type: String,
    enum: ['super_admin', 'moderate_admin', 'ceo', 'regional_manager', 'agent'],
    required: true,
    index: true
  },

  // Hierarchical relationships
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Staff',
    index: true
  },
  reportsTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Staff',
    index: true
  },
  managedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Staff' // For agents managed by regional managers
  },
  subordinates: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Staff'
  }],

  // Regional assignment
  region: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Region',
    index: true
  },
  assignedDistricts: [{
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
    ]
  }],

  // Enhanced permissions and access control
  permissions: [String],
  rolePermissions: {
    canCreateUsers: { type: Boolean, default: false },
    canManageRegions: { type: Boolean, default: false },
    canApproveLoans: { type: Boolean, default: false },
    canViewAllData: { type: Boolean, default: false },
    canManageSystem: { type: Boolean, default: false },
    maxLoanApprovalAmount: { type: Number, default: 0 }
  },

  // Profile information
  profile: {
    firstName: String,
    lastName: String,
    phoneNumber: String,
    address: String,
    dateOfBirth: Date,
    employeeId: {
      type: String,
      unique: true,
      sparse: true
    },
    department: String,
    position: String,
    hireDate: Date,
    profilePictureUrl: String
  },

  // Status and activity tracking
  status: {
    type: String,
    enum: ['active', 'inactive', 'suspended', 'terminated'],
    default: 'active',
    index: true
  },
  lastLogin: Date,
  lastActivity: Date,
  loginAttempts: {
    type: Number,
    default: 0
  },
  accountLocked: {
    type: Boolean,
    default: false
  },
  lockUntil: Date,

  // Performance metrics
  metrics: {
    totalClientsManaged: { type: Number, default: 0 },
    totalLoansProcessed: { type: Number, default: 0 },
    averageProcessingTime: { type: Number, default: 0 }, // in hours
    approvalRate: { type: Number, default: 0 }, // percentage
    lastPerformanceReview: Date,
    performanceScore: { type: Number, min: 0, max: 100 }
  },

  // Security settings
  security: {
    twoFactorEnabled: { type: Boolean, default: false },
    passwordLastChanged: Date,
    mustChangePassword: { type: Boolean, default: false },
    sessionTimeout: { type: Number, default: 3600 }, // in seconds
    allowedIPs: [String],
    securityQuestions: [{
      question: String,
      answerHash: String
    }]
  },

  // Audit trail
  auditTrail: [{
    action: {
      type: String,
      required: true,
      enum: [
        'created', 'updated', 'login', 'logout', 'password_changed',
        'role_changed', 'region_assigned', 'status_changed', 'permissions_updated',
        'subordinate_assigned', 'subordinate_removed', 'account_unlocked'
      ]
    },
    performedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Staff'
    },
    performedAt: {
      type: Date,
      default: Date.now
    },
    changes: mongoose.Schema.Types.Mixed,
    ipAddress: String,
    userAgent: String
  }],

  // Legacy field for backward compatibility
  area: String,

  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, {
  timestamps: true
});

// Indexes for performance optimization
staffSchema.index({ region: 1, role: 1 });
staffSchema.index({ role: 1, createdBy: 1 });
staffSchema.index({ reportsTo: 1, status: 1 });
staffSchema.index({ managedBy: 1, role: 1 });
staffSchema.index({ status: 1, lastActivity: -1 });
staffSchema.index({ createdAt: -1, updatedAt: -1 });
staffSchema.index({ assignedDistricts: 1, role: 1 });

// Compound indexes for hierarchy queries
staffSchema.index({
  role: 1,
  region: 1,
  status: 1
});
staffSchema.index({
  createdBy: 1,
  role: 1,
  createdAt: -1
});

// Virtual for full name
staffSchema.virtual('fullName').get(function () {
  if (this.profile?.firstName && this.profile?.lastName) {
    return `${this.profile.firstName} ${this.profile.lastName}`;
  }
  return this.name;
});

// Virtual for role hierarchy level
staffSchema.virtual('hierarchyLevel').get(function () {
  const levels = {
    'super_admin': 1,
    'moderate_admin': 2,
    'ceo': 3,
    'regional_manager': 4,
    'agent': 5
  };
  return levels[this.role] || 999;
});

// Methods for staff management
staffSchema.methods.addAuditEntry = function (action, performedBy, changes = {}, ipAddress = '', userAgent = '') {
  this.auditTrail.push({
    action,
    performedBy: performedBy || this._id,
    changes,
    ipAddress,
    userAgent
  });
  return this;
};

staffSchema.methods.canManage = function (targetStaff) {
  // Super admin can manage everyone
  if (this.role === 'super_admin') return true;

  // Moderate admin can manage CEO, regional managers, and agents
  if (this.role === 'moderate_admin') {
    return ['ceo', 'regional_manager', 'agent'].includes(targetStaff.role);
  }

  // Regional managers can manage agents in their region
  if (this.role === 'regional_manager') {
    return targetStaff.role === 'agent' &&
      targetStaff.region?.toString() === this.region?.toString();
  }

  return false;
};

staffSchema.methods.assignToRegion = function (regionId, assignedBy, districts = []) {
  const oldRegion = this.region;
  this.region = regionId;
  this.assignedDistricts = districts;

  this.addAuditEntry('region_assigned', assignedBy, {
    previousRegion: oldRegion,
    newRegion: regionId,
    assignedDistricts: districts
  });

  return this;
};

staffSchema.methods.changeRole = function (newRole, changedBy, reason = '') {
  const oldRole = this.role;
  this.role = newRole;

  // Update permissions based on role
  this.updateRolePermissions();

  this.addAuditEntry('role_changed', changedBy, {
    previousRole: oldRole,
    newRole,
    reason
  });

  return this;
};

staffSchema.methods.updateRolePermissions = function () {
  switch (this.role) {
    case 'super_admin':
      this.rolePermissions = {
        canCreateUsers: true,
        canManageRegions: true,
        canApproveLoans: true,
        canViewAllData: true,
        canManageSystem: true,
        maxLoanApprovalAmount: Number.MAX_SAFE_INTEGER
      };
      break;
    case 'moderate_admin':
      this.rolePermissions = {
        canCreateUsers: true,
        canManageRegions: true,
        canApproveLoans: true,
        canViewAllData: true,
        canManageSystem: false,
        maxLoanApprovalAmount: 10000000
      };
      break;
    case 'ceo':
      this.rolePermissions = {
        canCreateUsers: false,
        canManageRegions: false,
        canApproveLoans: true,
        canViewAllData: true,
        canManageSystem: false,
        maxLoanApprovalAmount: 50000000
      };
      break;
    case 'regional_manager':
      this.rolePermissions = {
        canCreateUsers: false,
        canManageRegions: false,
        canApproveLoans: true,
        canViewAllData: false,
        canManageSystem: false,
        maxLoanApprovalAmount: 5000000
      };
      break;
    case 'agent':
      this.rolePermissions = {
        canCreateUsers: false,
        canManageRegions: false,
        canApproveLoans: false,
        canViewAllData: false,
        canManageSystem: false,
        maxLoanApprovalAmount: 0
      };
      break;
  }
  return this;
};

staffSchema.methods.assignSubordinate = function (subordinateId, assignedBy) {
  if (!this.subordinates.includes(subordinateId)) {
    this.subordinates.push(subordinateId);
    this.addAuditEntry('subordinate_assigned', assignedBy, {
      subordinateId
    });
  }
  return this;
};

staffSchema.methods.removeSubordinate = function (subordinateId, removedBy) {
  this.subordinates = this.subordinates.filter(id => id.toString() !== subordinateId.toString());
  this.addAuditEntry('subordinate_removed', removedBy, {
    subordinateId
  });
  return this;
};

staffSchema.methods.updateMetrics = function (metrics) {
  Object.assign(this.metrics, metrics);
  this.metrics.lastPerformanceReview = new Date();
  return this;
};

staffSchema.methods.recordLogin = function (ipAddress = '', userAgent = '') {
  this.lastLogin = new Date();
  this.lastActivity = new Date();
  this.loginAttempts = 0;
  this.addAuditEntry('login', this._id, {}, ipAddress, userAgent);
  return this;
};

staffSchema.methods.recordFailedLogin = function () {
  this.loginAttempts += 1;

  // Lock account after 5 failed attempts
  if (this.loginAttempts >= 5) {
    this.accountLocked = true;
    this.lockUntil = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes
  }

  return this;
};

staffSchema.methods.unlockAccount = function (unlockedBy) {
  this.accountLocked = false;
  this.lockUntil = null;
  this.loginAttempts = 0;
  this.addAuditEntry('account_unlocked', unlockedBy);
  return this;
};

// Pre-save middleware
staffSchema.pre('save', function (next) {
  if (this.isNew) {
    this.updateRolePermissions();

    // Generate employee ID if not provided
    if (!this.profile?.employeeId) {
      const rolePrefix = {
        'super_admin': 'SA',
        'moderate_admin': 'MA',
        'ceo': 'CEO',
        'regional_manager': 'RM',
        'agent': 'AG'
      };
      const prefix = rolePrefix[this.role] || 'ST';
      this.profile = this.profile || {};
      this.profile.employeeId = `${prefix}${Date.now().toString().slice(-6)}`;
    }
  }

  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model("Staff", staffSchema);
