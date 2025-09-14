const mongoose = require("mongoose");
const StaffDetails = require("../models/StaffDetails");
const Staff = require("../models/Staff");

const seedStaffDetails = async () => {
  try {
    console.log("Seeding StaffDetails collection...");

    const staff = await Staff.find({});

    if (staff.length === 0) {
      console.log("No staff found. Skipping StaffDetails seeding.");
      return;
    }

    await StaffDetails.deleteMany({});

    const staffDetailsData = [];

    for (let i = 0; i < staff.length; i++) {
      const staffMember = staff[i];

      const staffDetail = {
        staffId: staffMember._id,
        profilePicUrl: `https://example.com/profile-${staffMember.email}.jpg`,
        dateOfBirth: new Date(1980 + i, Math.floor(Math.random() * 12), Math.floor(Math.random() * 28) + 1),
        contactNumber: `+9477${String(1000000 + i).padStart(7, '0')}`,
        address: `${100 + i} Main Street, Colombo`,
        nicNumber: `${1980 + i}${String(100000 + i).padStart(6, '0')}V`,
        emergencyContact: {
          name: `Emergency Contact ${i + 1}`,
          phone: `+9477${String(2000000 + i).padStart(7, '0')}`,
          relation: "Spouse"
        },
        joinedDate: new Date(2020 + Math.floor(i / 2), Math.floor(Math.random() * 12), Math.floor(Math.random() * 28) + 1),
        additionalNotes: `Additional notes for ${staffMember.firstName} ${staffMember.lastName}`
      };

      staffDetailsData.push(staffDetail);
    }

    await StaffDetails.insertMany(staffDetailsData);
    console.log(`Seeded ${staffDetailsData.length} StaffDetails`);
  } catch (error) {
    console.error("Error seeding StaffDetails:", error);
    throw error;
  }
};

module.exports = seedStaffDetails;
