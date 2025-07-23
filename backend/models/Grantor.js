// models/Grantor.js
const mongoose = require('mongoose');

const grantorSchema = new mongoose.Schema({
  grantorId: {
    type: String,
    required: true,
    unique: true, // e.g., GR0001
  },

  personalInfo: {
    fullName: String,
    contactNumber: String,
    email: String,
    dateOfBirth: Date,
    address: String, 
  },

  identityVerification: {
    idType: { type: String, default: 'NIC' },
    idNumber: String,
    documentUrl: String
  },

  employmentDetails: {
    employer: String,
    jobRole: String,
    monthlyIncome: Number,
    employmentLetterUrl: String
  },

  createdAt: {
    type: Date,
    default: Date.now,
  },

  updatedAt: {
    type: Date,
    default: Date.now,
  },
},
{ timestamps: true 
});

module.exports = mongoose.model('Grantor', grantorSchema);
