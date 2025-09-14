const mongoose = require("mongoose");
const Payment = require("../models/Payment");
const Loan = require("../models/Loan");
const Client = require("../models/Client");
const Staff = require("../models/Staff");

const seedPayments = async () => {
  try {
    console.log("Seeding Payments collection...");

    const loans = await Loan.find({ loanStatus: "Approved" });
    const clients = await Client.find({ status: "Approved" });
    const staff = await Staff.find({ role: "agent" });

    if (loans.length === 0 || clients.length === 0 || staff.length === 0) {
      console.log(
        "Required loans, clients or staff not found. Skipping Payments seeding."
      );
      return;
    }

    await Payment.deleteMany({});

    const paymentsData = [];

    for (let i = 0; i < Math.min(loans.length, 3); i++) {
      const loan = loans[i];
      const client = clients.find(
        (c) => c._id.toString() === loan.clientUserId.toString()
      );
      const agent = staff[i % staff.length];

      if (!client) continue;

      const payment = {
        loanId: loan._id,
        clientId: client._id,
        paymentAmount: loan.monthlyInstallment || 20000,
        paymentDate: new Date(Date.now() - (i * 10 + 5) * 24 * 60 * 60 * 1000),
        paymentMethod: "bank_transfer",
        status: "verified",
        verifiedBy: agent._id,
        verifiedAt: new Date(Date.now() - (i * 10 + 4) * 24 * 60 * 60 * 1000),
        paymentProof: "https://example.com/payment-proof.jpg",
        notes: "Monthly installment payment",
        installmentNumber: i + 1,
        principalAmount: 15000,
        interestAmount: 5000,
        isLatePayment: false,
        lateFee: 0,
        daysLate: 0,
      };

      paymentsData.push(payment);
    }

    await Payment.insertMany(paymentsData);
    console.log(`Seeded ${paymentsData.length} Payments`);
  } catch (error) {
    console.error("Error seeding Payments:", error);
    throw error;
  }
};

module.exports = seedPayments;
