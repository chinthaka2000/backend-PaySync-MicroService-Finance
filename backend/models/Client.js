// models/Client.js

const mongoose = require("mongoose");

const clientSchema = new mongoose.Schema({
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

  status: {
    type: String,
    enum: ['Pending', 'Approved', 'Rejected'],
    default: 'Pending',
  },

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
  },

  identityVerification: {
    idType: { type: String, default: 'NIC' },
    idNumber: String,
    documentUrl: String,
    verified: { type: Boolean, default: false }
  },

  employmentDetails: {
    employer: String,
    jobRole: String,
    monthlyIncome: Number,
    employmentDuration: String,
    employmentLetterUrl: String,
    verified: { type: Boolean, default: false }
  },

  documents: {
    idCardUrl: String,
    employmentLetterUrl: String,
    photoUrl: String,
    paysheetUrl: String,
    uploadedAt: Date,
    verified: { type: Boolean, default: false }
  },

  agentNotes: String,

  approvedAt: Date,
  rejectedAt: Date
},
{
  timestamps: true
});

module.exports = mongoose.model("Client", clientSchema);
