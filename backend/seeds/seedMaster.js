const mongoose = require("mongoose");
const seedStaff = require("./seedStaff");
const seedRegions = require("./seedRegions");
const seedClients = require("./seedClients");
const seedClientUsers = require("./seedClientUsers");
const seedLoans = require("./seedLoans");
const seedPayments = require("./seedPayments");
const seedGrantors = require("./seedGrantors");
const seedNotifications = require("./seedNotifications");
const seedStaffDetails = require("./seedStaffDetails");

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/paysync";

const runSeeds = async () => {
  try {
    await mongoose.connect(MONGO_URI);
    console.log("Connected to MongoDB");

    await seedStaff();
    await seedRegions();
    await seedClients();
    await seedClientUsers();
    await seedLoans();
    await seedPayments();
    await seedGrantors();
    await seedNotifications();
    await seedStaffDetails();

    console.log("All seed data inserted successfully");
    process.exit(0);
  } catch (error) {
    console.error("Error running seed scripts:", error);
    process.exit(1);
  }
};

runSeeds();
