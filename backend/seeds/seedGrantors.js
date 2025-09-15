const mongoose = require("mongoose");
const Grantor = require("../models/Grantor");

const seedGrantors = async () => {
  try {
    console.log("Seeding Grantors collection...");

    await Grantor.deleteMany({});

    const grantorsData = [
      {
        grantorId: "GR0001",
        personalInfo: {
          fullName: "John Smith Sr.",
          contactNumber: "+94771234567",
          email: "john.smith.sr@example.com",
          dateOfBirth: new Date("1980-05-15"),
          address: "123 Main Street, Colombo",
        },
        identityVerification: {
          idType: "NIC",
          idNumber: "801234567V",
          documentUrl: "https://example.com/nic-john-smith.jpg",
        },
        employmentDetails: {
          employer: "ABC Company",
          jobRole: "Manager",
          monthlyIncome: 75000,
          employmentLetterUrl: "https://example.com/employment-letter-john.jpg",
        },
      },
      {
        grantorId: "GR0002",
        personalInfo: {
          fullName: "Sarah Johnson",
          contactNumber: "+94772345678",
          email: "sarah.johnson@example.com",
          dateOfBirth: new Date("1975-08-20"),
          address: "456 Oak Avenue, Kandy",
        },
        identityVerification: {
          idType: "NIC",
          idNumber: "752345678V",
          documentUrl: "https://example.com/nic-sarah-johnson.jpg",
        },
        employmentDetails: {
          employer: "XYZ Corporation",
          jobRole: "Senior Engineer",
          monthlyIncome: 95000,
          employmentLetterUrl:
            "https://example.com/employment-letter-sarah.jpg",
        },
      },
      {
        grantorId: "GR0003",
        personalInfo: {
          fullName: "Michael Brown",
          contactNumber: "+94773456789",
          email: "michael.brown@example.com",
          dateOfBirth: new Date("1985-12-10"),
          address: "789 Pine Road, Galle",
        },
        identityVerification: {
          idType: "NIC",
          idNumber: "853456789V",
          documentUrl: "https://example.com/nic-michael-brown.jpg",
        },
        employmentDetails: {
          employer: "DEF Industries",
          jobRole: "Accountant",
          monthlyIncome: 65000,
          employmentLetterUrl:
            "https://example.com/employment-letter-michael.jpg",
        },
      },
    ];

    await Grantor.insertMany(grantorsData);
    console.log(`Seeded ${grantorsData.length} Grantors`);
  } catch (error) {
    console.error("Error seeding Grantors:", error);
    throw error;
  }
};

module.exports = seedGrantors;
