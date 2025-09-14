const mongoose = require("mongoose");
const Client = require("../models/Client");

const seedClients = async () => {
  // Get references to staff and regions
  const staff = await mongoose.connection.db
    .collection("staff")
    .find({})
    .toArray();
  const regions = await mongoose.connection.db
    .collection("regions")
    .find({})
    .toArray();

  const superAdmin = staff.find((s) => s.role === "super_admin");
  const moderateAdmin = staff.find((s) => s.role === "moderate_admin");
  const agent = staff.find((s) => s.role === "agent");
  const westernRegion = regions.find((r) => r.code === "WEST001");

  const clientData = [
    {
      registrationId: "R001",
      submissionDate: new Date(),
      assignedReviewer: agent ? agent._id : null,
      verifiedOverview: true,
      assignedAgent: agent ? agent._id : null,
      assignedBy: moderateAdmin ? moderateAdmin._id : null,
      assignedAt: new Date(),
      personalInfo: {
        fullName: "John Smith",
        contactNumber: "+94771234567",
        email: "john.smith@example.com",
        dateOfBirth: new Date("1985-05-15"),
        address: "123 Main Street, Colombo",
        district: "Colombo",
        verified: true,
      },
      identityVerification: {
        idType: "NIC",
        idNumber: "851234567V",
        idCardUrl: "https://example.com/id/john.jpg",
        verified: true,
        verificationDate: new Date(),
      },
      employmentDetails: {
        employer: "ABC Company",
        jobRole: "Software Engineer",
        monthlyIncome: 150000,
        employmentDuration: "5 years",
        employmentLetterUrl: "https://example.com/employment/john.pdf",
        verified: true,
        workAddress: "456 Business Park, Colombo",
      },
      documents: {
        idCardUrl: "https://example.com/id/john.jpg",
        employmentLetterUrl: "https://example.com/employment/john.pdf",
        photoUrl: "https://example.com/photo/john.jpg",
        paysheetUrl: "https://example.com/paysheet/john.pdf",
        uploadedAt: new Date(),
        verified: true,
      },
      riskProfile: {
        score: 75,
        factors: ["Stable employment", "Good credit history"],
        lastAssessed: new Date(),
        assessedBy: agent ? agent._id : null,
        riskLevel: "low",
        notes: "Low risk client with stable income",
      },
      preferences: {
        emailNotifications: true,
        smsNotifications: true,
        preferredLanguage: "english",
        contactTimePreference: "morning",
      },
      agentNotes: "Excellent client with good repayment history",
      region: westernRegion ? westernRegion._id : null,
      status: "Approved",
      approvedAt: new Date(),
      approvedBy: moderateAdmin ? moderateAdmin._id : null,
    },
    {
      registrationId: "R002",
      submissionDate: new Date(),
      assignedReviewer: agent ? agent._id : null,
      verifiedOverview: true,
      assignedAgent: agent ? agent._id : null,
      assignedBy: moderateAdmin ? moderateAdmin._id : null,
      assignedAt: new Date(),
      personalInfo: {
        fullName: "Sarah Johnson",
        contactNumber: "+94772345678",
        email: "sarah.johnson@example.com",
        dateOfBirth: new Date("1990-08-22"),
        address: "789 Oak Avenue, Kandy",
        district: "Kandy",
        verified: true,
      },
      identityVerification: {
        idType: "NIC",
        idNumber: "902345678V",
        idCardUrl: "https://example.com/id/sarah.jpg",
        verified: true,
        verificationDate: new Date(),
      },
      employmentDetails: {
        employer: "XYZ Corporation",
        jobRole: "Marketing Manager",
        monthlyIncome: 120000,
        employmentDuration: "3 years",
        employmentLetterUrl: "https://example.com/employment/sarah.pdf",
        verified: true,
        workAddress: "321 Corporate Plaza, Kandy",
      },
      documents: {
        idCardUrl: "https://example.com/id/sarah.jpg",
        employmentLetterUrl: "https://example.com/employment/sarah.pdf",
        photoUrl: "https://example.com/photo/sarah.jpg",
        paysheetUrl: "https://example.com/paysheet/sarah.pdf",
        uploadedAt: new Date(),
        verified: true,
      },
      riskProfile: {
        score: 65,
        factors: ["Good employment", "Average credit history"],
        lastAssessed: new Date(),
        assessedBy: agent ? agent._id : null,
        riskLevel: "medium",
        notes: "Medium risk client, requires monitoring",
      },
      preferences: {
        emailNotifications: true,
        smsNotifications: false,
        preferredLanguage: "english",
        contactTimePreference: "afternoon",
      },
      agentNotes: "Good client, needs some guidance",
      region: westernRegion ? westernRegion._id : null,
      status: "Approved",
      approvedAt: new Date(),
      approvedBy: moderateAdmin ? moderateAdmin._id : null,
    },
    {
      registrationId: "R003",
      submissionDate: new Date(),
      assignedReviewer: agent ? agent._id : null,
      verifiedOverview: false,
      assignedAgent: agent ? agent._id : null,
      assignedBy: moderateAdmin ? moderateAdmin._id : null,
      assignedAt: new Date(),
      personalInfo: {
        fullName: "Michael Brown",
        contactNumber: "+94773456789",
        email: "michael.brown@example.com",
        dateOfBirth: new Date("1982-12-10"),
        address: "555 Pine Road, Galle",
        district: "Galle",
        verified: false,
      },
      identityVerification: {
        idType: "NIC",
        idNumber: "824567890V",
        idCardUrl: "https://example.com/id/michael.jpg",
        verified: false,
      },
      employmentDetails: {
        employer: "Small Business Ltd",
        jobRole: "Owner",
        monthlyIncome: 80000,
        employmentDuration: "2 years",
        employmentLetterUrl: "https://example.com/employment/michael.pdf",
        verified: false,
        workAddress: "777 Business Center, Galle",
      },
      documents: {
        idCardUrl: "https://example.com/id/michael.jpg",
        employmentLetterUrl: "https://example.com/employment/michael.pdf",
        photoUrl: "https://example.com/photo/michael.jpg",
        paysheetUrl: "https://example.com/paysheet/michael.pdf",
        uploadedAt: new Date(),
        verified: false,
      },
      riskProfile: {
        score: 45,
        factors: ["New business", "Limited credit history"],
        lastAssessed: new Date(),
        assessedBy: agent ? agent._id : null,
        riskLevel: "high",
        notes: "High risk client, additional verification needed",
      },
      preferences: {
        emailNotifications: true,
        smsNotifications: true,
        preferredLanguage: "english",
        contactTimePreference: "evening",
      },
      agentNotes: "New client, requires additional verification",
      region: westernRegion ? westernRegion._id : null,
      status: "Pending",
    },
  ];

  await Client.deleteMany({});
  await Client.insertMany(clientData);
  console.log("Seeded Client collection");
};

module.exports = seedClients;
