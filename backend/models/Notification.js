/**
 * Notification Model
 * Handles system notifications for clients and staff
 */

const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  // Notification identification
  notificationId: {
    type: String,
    unique: true,
    default: function () {
      return `NOTIF${Date.now()}${Math.random().toString(36).substr(2, 5).toUpperCase()}`;
    }
  },

  // Recipient information
  recipientType: {
    type: String,
    enum: ['client', 'staff'],
    required: true,
    index: true
  },
  clientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Client',
    sparse: true,
    index: true
  },
  staffId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Staff',
    sparse: true,
    index: true
  },

  // Notification content
  title: {
    type: String,
    required: true,
    maxlength: 100
  },
  message: {
    type: String,
    required: true,
    maxlength: 500
  },
  type: {
    type: String,
    enum: [
      'loan_approved',
      'loan_rejected',
      'payment_due',
      'payment_overdue',
      'payment_received',
      'kyc_approved',
      'kyc_rejected',
      'system_announcement',
      'reminder',
      'alert',
      'info'
    ],
    required: true,
    index: true
  },

  // Priority and urgency
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium',
    index: true
  },
  isUrgent: {
    type: Boolean,
    default: false,
    index: true
  },

  // Related entities
  relatedLoanId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Loan',
    sparse: true
  },
  relatedPaymentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Payment',
    sparse: true
  },

  // Status tracking
  isRead: {
    type: Boolean,
    default: false,
    index: true
  },
  readAt: {
    type: Date,
    sparse: true
  },
  isDelivered: {
    type: Boolean,
    default: false
  },
  deliveredAt: {
    type: Date,
    sparse: true
  },

  // Delivery channels
  channels: {
    push: {
      enabled: { type: Boolean, default: true },
      sent: { type: Boolean, default: false },
      sentAt: Date,
      deviceTokens: [String]
    },
    email: {
      enabled: { type: Boolean, default: false },
      sent: { type: Boolean, default: false },
      sentAt: Date,
      emailAddress: String
    },
    sms: {
      enabled: { type: Boolean, default: false },
      sent: { type: Boolean, default: false },
      sentAt: Date,
      phoneNumber: String
    }
  },

  // Scheduling
  scheduledFor: {
    type: Date,
    sparse: true,
    index: true
  },
  isScheduled: {
    type: Boolean,
    default: false,
    index: true
  },

  // Action buttons (for interactive notifications)
  actions: [{
    label: String,
    action: String,
    url: String,
    style: {
      type: String,
      enum: ['primary', 'secondary', 'danger', 'success'],
      default: 'primary'
    }
  }],

  // Metadata
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },

  // Sender information
  sentBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Staff',
    sparse: true
  },
  sentBySystem: {
    type: Boolean,
    default: true
  },

  // Expiry
  expiresAt: {
    type: Date,
    sparse: true,
    index: true
  },

  // Retry mechanism for failed deliveries
  retryCount: {
    type: Number,
    default: 0,
    max: 3
  },
  lastRetryAt: {
    type: Date,
    sparse: true
  },
  failureReason: {
    type: String,
    maxlength: 200
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for performance
notificationSchema.index({ recipientType: 1, clientId: 1, isRead: 1 });
notificationSchema.index({ recipientType: 1, staffId: 1, isRead: 1 });
notificationSchema.index({ type: 1, priority: 1, createdAt: -1 });
notificationSchema.index({ isScheduled: 1, scheduledFor: 1 });
notificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Virtual for notification age
notificationSchema.virtual('age').get(function () {
  return Math.floor((new Date() - this.createdAt) / (1000 * 60 * 60 * 24));
});

// Virtual for delivery status
notificationSchema.virtual('deliveryStatus').get(function () {
  const channels = this.channels;
  let delivered = 0;
  let total = 0;

  if (channels.push.enabled) {
    total++;
    if (channels.push.sent) delivered++;
  }
  if (channels.email.enabled) {
    total++;
    if (channels.email.sent) delivered++;
  }
  if (channels.sms.enabled) {
    total++;
    if (channels.sms.sent) delivered++;
  }

  return { delivered, total, percentage: total > 0 ? (delivered / total) * 100 : 0 };
});

// Methods
notificationSchema.methods.markAsRead = function () {
  this.isRead = true;
  this.readAt = new Date();
  return this.save();
};

notificationSchema.methods.markAsDelivered = function (channel) {
  this.isDelivered = true;
  this.deliveredAt = new Date();

  if (channel && this.channels[channel]) {
    this.channels[channel].sent = true;
    this.channels[channel].sentAt = new Date();
  }

  return this.save();
};

notificationSchema.methods.markAsFailed = function (channel, reason) {
  this.retryCount += 1;
  this.lastRetryAt = new Date();
  this.failureReason = reason;

  if (channel && this.channels[channel]) {
    this.channels[channel].sent = false;
  }

  return this.save();
};

// Static methods
notificationSchema.statics.createLoanNotification = function (type, clientId, loanId, customMessage = null) {
  const messages = {
    loan_approved: {
      title: 'Loan Approved! 🎉',
      message: customMessage || 'Congratulations! Your loan application has been approved. You can now proceed with the agreement signing.'
    },
    loan_rejected: {
      title: 'Loan Application Update',
      message: customMessage || 'We regret to inform you that your loan application was not approved at this time. Please contact your agent for more details.'
    },
    payment_due: {
      title: 'Payment Reminder 💰',
      message: customMessage || 'Your loan payment is due soon. Please make your payment to avoid late fees.'
    },
    payment_overdue: {
      title: 'Payment Overdue ⚠️',
      message: customMessage || 'Your loan payment is overdue. Please make your payment immediately to avoid additional charges.'
    }
  };

  const notificationData = messages[type];
  if (!notificationData) {
    throw new Error(`Invalid notification type: ${type}`);
  }

  return this.create({
    recipientType: 'client',
    clientId,
    relatedLoanId: loanId,
    type,
    title: notificationData.title,
    message: notificationData.message,
    priority: type.includes('overdue') ? 'high' : 'medium',
    isUrgent: type.includes('overdue'),
    sentBySystem: true
  });
};

notificationSchema.statics.createPaymentNotification = function (type, clientId, paymentId, customMessage = null) {
  const messages = {
    payment_received: {
      title: 'Payment Received ✅',
      message: customMessage || 'Thank you! Your payment has been received and is being processed.'
    }
  };

  const notificationData = messages[type];
  if (!notificationData) {
    throw new Error(`Invalid notification type: ${type}`);
  }

  return this.create({
    recipientType: 'client',
    clientId,
    relatedPaymentId: paymentId,
    type,
    title: notificationData.title,
    message: notificationData.message,
    priority: 'medium',
    sentBySystem: true
  });
};

notificationSchema.statics.createKYCNotification = function (type, clientId, customMessage = null) {
  const messages = {
    kyc_approved: {
      title: 'KYC Approved ✅',
      message: customMessage || 'Your identity verification has been completed successfully. You can now apply for loans.'
    },
    kyc_rejected: {
      title: 'KYC Verification Required',
      message: customMessage || 'Additional documentation is required for identity verification. Please resubmit your documents.'
    }
  };

  const notificationData = messages[type];
  if (!notificationData) {
    throw new Error(`Invalid notification type: ${type}`);
  }

  return this.create({
    recipientType: 'client',
    clientId,
    type,
    title: notificationData.title,
    message: notificationData.message,
    priority: 'medium',
    sentBySystem: true
  });
};

notificationSchema.statics.getUnreadCount = function (recipientType, recipientId) {
  const query = { recipientType, isRead: false };

  if (recipientType === 'client') {
    query.clientId = recipientId;
  } else {
    query.staffId = recipientId;
  }

  return this.countDocuments(query);
};

notificationSchema.statics.markAllAsRead = function (recipientType, recipientId) {
  const query = { recipientType, isRead: false };

  if (recipientType === 'client') {
    query.clientId = recipientId;
  } else {
    query.staffId = recipientId;
  }

  return this.updateMany(query, {
    isRead: true,
    readAt: new Date()
  });
};

// Pre-save middleware
notificationSchema.pre('save', function (next) {
  // Set expiry date if not set (default 30 days)
  if (!this.expiresAt && this.isNew) {
    this.expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  }

  next();
});

module.exports = mongoose.model('Notification', notificationSchema);