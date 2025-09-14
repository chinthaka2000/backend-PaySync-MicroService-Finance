const mongoose = require("mongoose");
const Loan = require("../models/Loan");
const Client = require("../models/Client");
const Staff = require("../models/Staff");

const seedLoans = async () => {
  try {
    console.log("Seeding Loans collection...");

    const clients = await Client.find({ status: "Approved" });
    const agents = await Staff.find({ role: "agent" });
    const regionalManagers = await Staff.find({ role: "regional_manager" });

    if (
      clients.length === 0 ||
      agents.length === 0 ||
      regionalManagers.length === 0
    ) {
      console.log(
        "Required clients or staff not found. Skipping Loans seeding."
      );
      return;
    }

    await Loan.deleteMany({});

    const loansData = [];

    for (let i = 0; i < Math.min(clients.length, 3); i++) {
      const client = clients[i];
      const agent = agents[i % agents.length];
      const regionalManager = regionalManagers[i % regionalManagers.length];

      const loan = {
        loanApplicationId: `L${String(1001 + i).padStart(6, "0")}`,
        clientUserId: client._id,
        product: "Personal Loan",
        loanAmount: 500000 + i * 100000,
        loanTerm: 24,
        interestRate: 12.5,
        purpose: "Home renovation",
        loanStatus: "Approved",
        region: client.region,
        district: client.personalInfo.district,
        assignedAgent: agent._id,
        assignedRegionalManager: regionalManager._id,
        monthlyInstallmentDueDate: 5,
        downPayment: {
          amount: 50000 + i * 10000,
          paymentSlipUrl: "https://example.com/down-payment-slip.jpg",
          status: "Verified",
        },
        workflowState: {
          currentStage: "active",
          stageHistory: [
            {
              stage: "application_submitted",
              enteredAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
              completedAt: new Date(Date.now() - 55 * 24 * 60 * 60 * 1000),
              performedBy: agent._id,
            },
            {
              stage: "agent_review",
              enteredAt: new Date(Date.now() - 55 * 24 * 60 * 60 * 1000),
              completedAt: new Date(Date.now() - 50 * 24 * 60 * 60 * 1000),
              performedBy: agent._id,
            },
            {
              stage: "regional_approval",
              enteredAt: new Date(Date.now() - 50 * 24 * 60 * 60 * 1000),
              completedAt: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000),
              performedBy: regionalManager._id,
            },
            {
              stage: "active",
              enteredAt: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000),
            },
          ],
        },
      };

      loansData.push(loan);
    }

    await Loan.insertMany(loansData);
    console.log(`Seeded ${loansData.length} Loans`);
  } catch (error) {
    console.error("Error seeding Loans:", error);
    throw error;
  }
};

module.exports = seedLoans;
