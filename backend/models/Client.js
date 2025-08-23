// models/Client.js

const mongoose = require("mongoose");

const clientSchema = new mongoose.Schema({
  // Registration Overview
  registrationId: { 
      type: String, 
      required: true, 
      unique: true 
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

  // Identity Verification
  identityVerification: {
    idType: { type: String, default: 'NIC' },
    idNumber: String,
    idCardUrl: String,
    verified: { type: Boolean, default: false }
  },

  // Employment Details
   employmentDetails: {
    employer: String,
    jobRole: String,
    monthlyIncome: Number,
    employmentDuration: String,
    employmentLetterUrl: String,
    verified: { type: Boolean, default: false }
  },

  // Document Overview
   documents: {
    idCardUrl: String,
    employmentLetterUrl: String,
    photoUrl: String,
    paysheetUrl: String,
    uploadedAt: Date,
    verified: { type: Boolean, default: false }
  },

  // Application Details
  agentNotes: String,
  verifiedNote : { type: Boolean, default: false },

  

  status: {
    type: String,
    enum: ['Pending', 'Approved', 'Rejected'],
    default: 'Pending',
  },
  
  approvedAt: Date,
  rejectedAt: Date
},
{
  timestamps: true
});

module.exports = mongoose.model("Client", clientSchema);
