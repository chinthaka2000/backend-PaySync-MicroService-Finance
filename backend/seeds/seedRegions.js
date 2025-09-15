const mongoose = require("mongoose");
const Region = require("../models/Region");

const seedRegions = async () => {
  // Get reference to super admin
  const staff = await mongoose.connection.db
    .collection("staff")
    .find({})
    .toArray();
  const superAdmin = staff.find((s) => s.role === "super_admin");

  // If no super admin exists, create a temporary ObjectId for seeding
  const createdById = superAdmin
    ? superAdmin._id
    : new mongoose.Types.ObjectId();

  const regionData = [
    {
      code: "WEST001",
      name: "Western Province",
      districts: ["Colombo", "Gampaha", "Kalutara"],
      createdBy: createdById,
      configuration: {
        maxLoanAmount: 10000000,
        defaultInterestRate: 12.5,
        maxLoanTerm: 60,
        requiredDocuments: ["NIC", "Paysheet", "Employment Letter"],
        approvalWorkflow: [
          {
            stage: "agent_review",
            requiredRole: "agent",
            maxAmount: 1000000,
            timeoutDays: 7,
          },
          {
            stage: "regional_approval",
            requiredRole: "regional_manager",
            maxAmount: 5000000,
            timeoutDays: 14,
          },
        ],
        businessHours: {
          start: "09:00",
          end: "17:00",
          timezone: "Asia/Colombo",
          workingDays: ["monday", "tuesday", "wednesday", "thursday", "friday"],
        },
      },
      statistics: {
        totalClients: 0,
        activeLoans: 0,
        totalLoanAmount: 0,
        approvalRate: 0,
      },
      status: "active",
    },
    {
      code: "CENT001",
      name: "Central Province",
      districts: ["Kandy", "Matale", "Nuwara Eliya"],
      createdBy: createdById,
      configuration: {
        maxLoanAmount: 8000000,
        defaultInterestRate: 13.0,
        maxLoanTerm: 48,
        requiredDocuments: ["NIC", "Paysheet", "Employment Letter"],
        approvalWorkflow: [
          {
            stage: "agent_review",
            requiredRole: "agent",
            maxAmount: 800000,
            timeoutDays: 7,
          },
          {
            stage: "regional_approval",
            requiredRole: "regional_manager",
            maxAmount: 4000000,
            timeoutDays: 14,
          },
        ],
        businessHours: {
          start: "09:00",
          end: "17:00",
          timezone: "Asia/Colombo",
          workingDays: ["monday", "tuesday", "wednesday", "thursday", "friday"],
        },
      },
      statistics: {
        totalClients: 0,
        activeLoans: 0,
        totalLoanAmount: 0,
        approvalRate: 0,
      },
      status: "active",
    },
    {
      code: "SOUT001",
      name: "Southern Province",
      districts: ["Galle", "Matara", "Hambantota"],
      createdBy: createdById,
      configuration: {
        maxLoanAmount: 6000000,
        defaultInterestRate: 13.5,
        maxLoanTerm: 36,
        requiredDocuments: ["NIC", "Paysheet", "Employment Letter"],
        approvalWorkflow: [
          {
            stage: "agent_review",
            requiredRole: "agent",
            maxAmount: 600000,
            timeoutDays: 7,
          },
          {
            stage: "regional_approval",
            requiredRole: "regional_manager",
            maxAmount: 3000000,
            timeoutDays: 14,
          },
        ],
        businessHours: {
          start: "09:00",
          end: "17:00",
          timezone: "Asia/Colombo",
          workingDays: ["monday", "tuesday", "wednesday", "thursday", "friday"],
        },
      },
      statistics: {
        totalClients: 0,
        activeLoans: 0,
        totalLoanAmount: 0,
        approvalRate: 0,
      },
      status: "active",
    },
  ];

  await Region.deleteMany({});
  await Region.insertMany(regionData);
  console.log("Seeded Region collection");
};

module.exports = seedRegions;
