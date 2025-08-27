// models/ClientUser.js

const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const clientUserSchema = new mongoose.Schema({
  clientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Client',
    required: true
  },
  username: {
    type: String,
    required: true,
    unique: true // should be unique
  },
  email: {
    type: String,
    required: true,
    unique: true // optional duplicate of client email
  },
  password: {
    type: String,
    required: true
  },
  role: {
    type: String,
    default: 'client'
  },
  status: {
    type: String,
    enum: ['Active', 'Suspended', 'Inactive'],
    default: 'Active',
  },
  verifiedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Staff', // could be agent or manager
    required: true
  },
  lastLogin: {
    type: Date
  },
  resetToken: String,
  resetTokenExpiry: Date
}, {
  timestamps: true
});

// Password hashing middleware (optional)
clientUserSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (err) {
    next(err);
  }
});

module.exports = mongoose.model('ClientUsers', clientUserSchema);
