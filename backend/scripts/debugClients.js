// scripts/debugClients.js
// Run this script to check what clients exist in your database

const mongoose = require('mongoose');
require('dotenv').config();

async function debugClients() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB');

    // Dynamically import the Client model
    const Client = require('../models/Client');

    // Find all clients
    const clients = await Client.find({}, 'registrationId status personalInfo.fullName personalInfo.email');

    console.log('=== AVAILABLE CLIENTS ===');
    console.log(`Total clients: ${clients.length}`);

    if (clients.length === 0) {
      console.log('❌ No clients found in the database!');
    } else {
      clients.forEach(client => {
        console.log(`- ID: ${client.registrationId}, Name: ${client.personalInfo?.fullName || 'N/A'}, Status: ${client.status}`);
      });
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

debugClients();