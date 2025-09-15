const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
require("dotenv").config();

// Import models
const Staff = require("./models/Staff");
const Region = require("./models/Region");
const Client = require("./models/Client");
const ClientUser = require("./models/clientUsers");

async function seedData() {
  try {
    console.log("🔄 Connecting to MongoDB...");
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ Connected to MongoDB");

    // Clear existing data
    console.log("🧹 Clearing existing data...");
    await Staff.deleteMany({});
    await Region.deleteMany({});
    await Client.deleteMany({});
    await ClientUser.deleteMany({});
    console.log("✅ Data cleared");

    // Create a temporary super admin first (will be used as createdBy for regions)
    console.log("👑 Creating temporary super admin...");
    const tempSuperAdminPassword = await bcrypt.hash("TempSuper123!", 12);
    const tempSuperAdmin = new Staff({
      name: "Temporary Super Admin",
      email: "temp.super@paysync.com",
      passwordHash: tempSuperAdminPassword,
      role: "super_admin",
      status: "active",
    });
    await tempSuperAdmin.save();
    console.log("✅ Temporary super admin created");

    // Create regions
    console.log("🏗️ Creating regions...");
    const regions = [
      {
        name: "Western Province",
        code: "WP",
        districts: ["Colombo", "Gampaha", "Kalutara"],
        createdBy: tempSuperAdmin._id,
      },
      {
        name: "Central Province",
        code: "CP",
        districts: ["Kandy", "Matale", "Nuwara Eliya"],
        createdBy: tempSuperAdmin._id,
      },
      {
        name: "Southern Province",
        code: "SP",
        districts: ["Galle", "Matara", "Hambantota"],
        createdBy: tempSuperAdmin._id,
      },
    ];

    const createdRegions = [];
    for (const regionData of regions) {
      const region = new Region(regionData);
      await region.save();
      createdRegions.push(region);
      console.log(`✅ Created region: ${region.name}`);
    }

    // Create staff users
    console.log("👥 Creating staff users...");
    const staffUsers = [
      {
        name: "Super Admin",
        email: "super.admin@paysync.com",
        password: "SuperAdmin123!",
        role: "super_admin",
        region: createdRegions[0]._id,
        status: "active",
      },
      {
        name: "Moderate Admin",
        email: "moderate.admin@paysync.com",
        password: "ModerateAdmin123!",
        role: "moderate_admin",
        region: createdRegions[0]._id,
        status: "active",
      },
      {
        name: "CEO",
        email: "ceo@paysync.com",
        password: "CeoUser123!",
        role: "ceo",
        region: createdRegions[0]._id,
        status: "active",
      },
    ];

    for (const staffData of staffUsers) {
      const hashedPassword = await bcrypt.hash(staffData.password, 12);
      const staff = new Staff({
        ...staffData,
        passwordHash: hashedPassword,
      });
      await staff.save();
      console.log(`✅ Created staff: ${staff.name} (${staff.email})`);
    }

    // Create clients
    console.log("👨‍💼 Creating clients...");
    const clients = [
      {
        registrationId: "T00001",
        personalInfo: {
          fullName: "John Smith",
          contactNumber: "+94771111111",
          email: "john.smith@email.com",
          dateOfBirth: new Date("1985-05-15"),
          address: "123 Main St, Colombo",
          district: "Colombo",
        },
        identityVerification: {
          idType: "NIC",
          idNumber: "851234567V",
          verified: true,
        },
        employmentDetails: {
          employer: "Tech Corp",
          jobRole: "Developer",
          monthlyIncome: 75000,
          employmentDuration: "3 years",
          verified: true,
        },
        documents: { verified: true },
        assignedReviewer: null,
        status: "Approved",
        approvedAt: new Date(),
      },
    ];

    for (const clientData of clients) {
      const client = new Client(clientData);
      await client.save();
      console.log(`✅ Created client: ${client.personalInfo.fullName}`);

      // Create client user
      const clientPassword = "TempPS001123!";
      const hashedClientPassword = await bcrypt.hash(clientPassword, 12);

      const clientUser = new ClientUser({
        clientId: client._id,
        username: client.personalInfo.email,
        email: client.personalInfo.email,
        password: hashedClientPassword,
        verifiedBy: null,
        role: "client",
        status: "Active",
      });
      await clientUser.save();
      console.log(
        `✅ Created client user: ${clientUser.email} (password: ${clientPassword})`
      );
    }

    console.log("\n🎉 Seeding completed successfully!");
    console.log("\n📋 SUMMARY:");
    console.log("Regions:", await Region.countDocuments());
    console.log("Staff:", await Staff.countDocuments());
    console.log("Clients:", await Client.countDocuments());
    console.log("Client Users:", await ClientUser.countDocuments());

    console.log("\n🔐 LOGIN CREDENTIALS:");
    console.log("Super Admin: super.admin@paysync.com / SuperAdmin123!");
    console.log(
      "Moderate Admin: moderate.admin@paysync.com / ModerateAdmin123!"
    );
    console.log("CEO: ceo@paysync.com / CeoUser123!");
    console.log("Client: john.smith@email.com / TempPS001123!");
  } catch (error) {
    console.error("❌ Seeding failed:", error.message);
    console.error(error.stack);
  } finally {
    await mongoose.connection.close();
    console.log("🔌 Database connection closed");
  }
}

seedData();
