// models/Staff.js

const mongoose = require("mongoose");

const staffSchema = new mongoose.Schema({
  name: { type: String, required: true },

  email: { type: String, required: true, unique: true },
  passwordHash: { type: String, required: true, select: false  },

  role: {
    type: String,
    enum: ['moderate_admin', 'ceo', 'regional_manager', 'agent'],
    required: true,
  },
  region: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Region'  // <-- reference to Region collection
  },

  permissions: [String], // optional: like ['create-user', 'view-client']

  area: String, // optional: for agents or regional managers (e.g., "Jaffna")

  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Staff' }, // if created by another admin

  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("Staff", staffSchema);
