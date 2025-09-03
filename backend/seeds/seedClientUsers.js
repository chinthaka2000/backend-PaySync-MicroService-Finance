const mongoose = require("mongoose");
const ClientUsers = require("../models/clientUsers");
const Client = require("../models/Client");
const Staff = require("../models/Staff");
const bcrypt = require("bcrypt");

const seedClientUsers = async () => {
  try {
    console.log("Seeding ClientUsers collection...");

    // Get existing clients and staff
    const clients = await Client.find({ status: "Approved" });
    const staff = await Staff.find({ role: "agent" });

    if (clients.length === 0 || staff.length === 0) {
      console.log(
        "No approved clients or agents found. Skipping ClientUsers seeding."
      );
      return;
    }

    // Clear existing data
    await ClientUsers.deleteMany({});

    const clientUsersData = [];

    for (let i = 0; i < Math.min(clients.length, 3); i++) {
      const client = clients[i];
      const agent = staff[i % staff.length];

      const clientUser = {
        clientId: client._id,
        username: client.personalInfo.email,
        email: client.personalInfo.email,
        password: "Client@123", // Will be hashed by pre-save middleware
        role: "client",
        status: "Active",
        verifiedBy: agent._id,
        lastLogin: new Date(
          Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000
        ), // Random login within last 30 days
      };

      clientUsersData.push(clientUser);
    }

    await ClientUsers.insertMany(clientUsersData);
    console.log(`Seeded ${clientUsersData.length} ClientUsers`);
  } catch (error) {
    console.error("Error seeding ClientUsers:", error);
    throw error;
  }
};

module.exports = seedClientUsers;
