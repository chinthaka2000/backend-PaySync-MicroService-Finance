const mongoose = require("mongoose");
const Loan = require("./models/Loan");
const Client = require("./models/Client");
const Staff = require("./models/Staff");

const fixLoanClientRelationships = async () => {
  try {
    console.log("🔄 Starting to fix loan-client relationships...");

    // Connect to database
    await mongoose.connect(
      process.env.MONGO_URI || "mongodb://localhost:27017/paySync",
      {
        useNewUrlParser: true,
        useUnifiedTopology: true,
      }
    );

    // Get all loans and clients
    const loans = await Loan.find({});
    const clients = await Client.find({});
    const agents = await Staff.find({ role: "agent" });
    const regionalManagers = await Staff.find({ role: "regional_manager" });

    console.log(`📊 Found ${loans.length} loans and ${clients.length} clients`);

    if (loans.length === 0 || clients.length === 0) {
      console.log("❌ No loans or clients found to fix");
      return;
    }

    // Update each loan with proper client relationship
    for (let i = 0; i < loans.length; i++) {
      const loan = loans[i];
      const client = clients[i % clients.length]; // Cycle through clients
      const agent =
        agents.find(
          (a) => a._id.toString() === loan.assignedAgentId?.toString()
        ) || agents[0];
      const regionalManager = regionalManagers[0];

      console.log(
        `🔧 Updating loan ${loan.loanApplicationId} with client ${client.personalInfo?.fullName}`
      );

      // Update loan with client information
      await Loan.findByIdAndUpdate(loan._id, {
        // Add client reference
        clientId: client._id,
        borrowerId: client._id,

        // Update borrower name
        borrowerName: client.personalInfo?.fullName || "Unknown",

        // Ensure proper agent and regional manager references
        assignedAgentId: agent?._id || loan.assignedAgentId,
        assignedRegionalManagerId:
          regionalManager?._id || loan.assignedRegionalManagerId,

        // Add client details
        borrowerDetails: {
          fullName: client.personalInfo?.fullName,
          contactNumber: client.personalInfo?.contactNumber,
          email: client.personalInfo?.email,
          address: client.personalInfo?.address,
          district: client.personalInfo?.district,
        },

        // Update timestamps
        updatedAt: new Date(),
      });
    }

    console.log("✅ Successfully updated loan-client relationships");

    // Verify the updates
    const updatedLoans = await Loan.find({}).limit(5);
    console.log("🔍 Verification - First 5 updated loans:");
    updatedLoans.forEach((loan) => {
      console.log(
        `  - ${loan.loanApplicationId}: ${loan.borrowerName} (${loan.amount})`
      );
    });

    await mongoose.disconnect();
    console.log("🔌 Database connection closed");
  } catch (error) {
    console.error("❌ Error fixing loan-client relationships:", error);
    process.exit(1);
  }
};

// Run the fix
fixLoanClientRelationships();
