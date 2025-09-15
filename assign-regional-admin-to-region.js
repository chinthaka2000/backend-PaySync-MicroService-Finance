const mongoose = require("mongoose");
const Staff = require("./backend/models/Staff");
const Region = require("./backend/models/Region");

// Connect to MongoDB
const connectDB = async () => {
  try {
    await mongoose.connect("mongodb://localhost:27017/paySync", {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log("✅ Connected to MongoDB");
  } catch (error) {
    console.error("❌ MongoDB connection error:", error);
    process.exit(1);
  }
};

const assignRegionalAdminToRegion = async () => {
  try {
    console.log("🔄 Starting regional admin assignment process...");

    // Find the regional admin by email
    const regionalAdmin = await Staff.findOne({
      email: "rm.western@example.com",
    });
    if (!regionalAdmin) {
      console.error(
        '❌ Regional admin with email "rm.western@example.com" not found'
      );
      return;
    }

    console.log(
      `✅ Found regional admin: ${regionalAdmin.name} (ID: ${regionalAdmin._id})`
    );

    // Find the Western region
    const westernRegion = await Region.findOne({ code: "WEST001" });
    if (!westernRegion) {
      console.error("❌ Western region (WEST001) not found");
      return;
    }

    console.log(
      `✅ Found Western region: ${westernRegion.name} (ID: ${westernRegion._id})`
    );

    // Assign the regional admin to the Western region
    regionalAdmin.region = westernRegion._id;
    regionalAdmin.assignedDistricts = westernRegion.districts; // Assign all districts in the region

    // Save the updated regional admin
    await regionalAdmin.save();

    // Update the region to assign this regional manager
    westernRegion.regionalManager = regionalAdmin._id;
    await westernRegion.save();

    console.log("✅ Successfully assigned regional admin to Western region!");
    console.log(`   - Regional Admin: ${regionalAdmin.name}`);
    console.log(`   - Region: ${westernRegion.name}`);
    console.log(
      `   - Assigned Districts: ${regionalAdmin.assignedDistricts.join(", ")}`
    );

    // Verify the assignment
    const updatedAdmin = await Staff.findById(regionalAdmin._id).populate(
      "region"
    );
    console.log("\n🔍 Verification:");
    console.log(
      `   - Admin region: ${updatedAdmin.region?.name || "Not assigned"}`
    );
    console.log(
      `   - Admin districts: ${updatedAdmin.assignedDistricts.join(", ")}`
    );
  } catch (error) {
    console.error("❌ Error assigning regional admin to region:", error);
  }
};

// Main execution
const main = async () => {
  await connectDB();
  await assignRegionalAdminToRegion();
  await mongoose.disconnect();
  console.log("✅ Database connection closed");
};

main().catch(console.error);
