const mongoose = require("mongoose");
const dotenv = require("dotenv");
const Loan = require("./models/Loan");
const Staff = require("./models/Staff");

// Load environment variables
dotenv.config();

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ MongoDB connected");
  } catch (err) {
    console.error("❌ MongoDB connection failed:", err.message);
    process.exit(1);
  }
};

const createAdditionalTestData = async () => {
  try {
    // Your current user ID from the frontend or admin
    const currentUserId = "64d3f40e2e3f4a2d1234567a";
    console.log(`🎯 Creating additional data for user ID: ${currentUserId}`);

    // Check if this staff member exists
    let staff = await Staff.findById(currentUserId);
    if (!staff) {
      console.log("👤 Staff member not found, creating one...");
      staff = new Staff({
        _id: currentUserId,
        name: "Test Moderate Admin",
        email: "moderateadmin@paysync.com",
        passwordHash: "$2b$10$example",
        role: "moderate_admin",
        area: "Test Area",
      });
      await staff.save();
      console.log("✅ Staff member created");
    } else {
      console.log(`✅ Staff member found: ${staff.name}`);
    }

    // Seed loans with various statuses
    const loans = [
      {
        loanApplicationId: "L000101",
        clientUserId: new mongoose.Types.ObjectId(),
        product: "Personal Loan",
        loanAmount: 500000,
        loanTerm: 24,
        interestRate: 12,
        loanStatus: "Approved",
        assignedAgent: currentUserId,
        region: new mongoose.Types.ObjectId(),
        district: "Colombo",
        purpose: "Home renovation",
        monthlyInstallmentDueDate: 5,
        downPayment: {
          amount: 50000,
          paymentSlipUrl: "/payments/downpayment_L001001.jpg",
          status: "Verified",
        },
        agentReview: {
          reviewedBy: currentUserId,
          reviewDate: new Date(),
          status: "Approved",
          comments: "Good credit history",
          rating: 4,
        },
      },
      {
        loanApplicationId: "L000102",
        clientUserId: new mongoose.Types.ObjectId(),
        product: "Business Loan",
        loanAmount: 1000000,
        loanTerm: 36,
        interestRate: 10,
        loanStatus: "Rejected",
        assignedAgent: currentUserId,
        region: new mongoose.Types.ObjectId(),
        district: "Kandy",
        purpose: "Business expansion",
        monthlyInstallmentDueDate: 10,
        downPayment: {
          amount: 100000,
          paymentSlipUrl: "/payments/downpayment_L001002.jpg",
          status: "Verified",
        },
        agentReview: {
          reviewedBy: currentUserId,
          reviewDate: new Date(),
          status: "Rejected",
          comments: "Insufficient collateral",
          rating: 2,
        },
      },
      {
        loanApplicationId: "L000103",
        clientUserId: new mongoose.Types.ObjectId(),
        product: "Vehicle Loan",
        loanAmount: 750000,
        loanTerm: 18,
        interestRate: 11,
        loanStatus: "Pending",
        assignedAgent: currentUserId,
        region: new mongoose.Types.ObjectId(),
        district: "Galle",
        purpose: "Car purchase",
        monthlyInstallmentDueDate: 15,
        downPayment: {
          amount: 75000,
          paymentSlipUrl: "",
          status: "Pending",
        },
        agentReview: {
          reviewedBy: currentUserId,
          reviewDate: null,
          status: "Pending",
          comments: "",
          rating: null,
        },
      },
    ];

    for (const loanData of loans) {
      const existing = await Loan.findOne({
        loanApplicationId: loanData.loanApplicationId,
      });
      if (!existing) {
        const loan = new Loan(loanData);
        await loan.save();
        console.log(
          `✅ Created loan with ID: ${loanData.loanApplicationId} and status: ${loanData.loanStatus}`
        );
      } else {
        console.log(`⚠️ Loan already exists: ${loanData.loanApplicationId}`);
      }
    }

    console.log("\n🎉 Additional test data creation completed!");
  } catch (error) {
    console.error("❌ Error creating additional test data:", error);
  } finally {
    mongoose.connection.close();
    console.log("🔌 Database connection closed");
  }
};

// Run the script
const run = async () => {
  await connectDB();
  await createAdditionalTestData();
};

if (require.main === module) {
  run();
}

module.exports = { createAdditionalTestData };
