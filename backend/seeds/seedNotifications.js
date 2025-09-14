const mongoose = require("mongoose");
const Notification = require("../models/Notification");
const Client = require("../models/Client");
const Staff = require("../models/Staff");

const seedNotifications = async () => {
  try {
    console.log("Seeding Notifications collection...");

    const clients = await Client.find({ status: "Approved" });
    const staff = await Staff.find({
      role: {
        $in: ["agent", "regional_manager", "moderate_admin", "super_admin"],
      },
    });

    if (clients.length === 0 || staff.length === 0) {
      console.log(
        "Required clients or staff not found. Skipping Notifications seeding."
      );
      return;
    }

    await Notification.deleteMany({});

    const notificationsData = [];

    for (let i = 0; i < Math.min(clients.length, 3); i++) {
      const client = clients[i];

      const notification1 = {
        recipientType: "client",
        clientId: client._id,
        title: "Welcome to PaySync!",
        message:
          "Thank you for registering with PaySync. We are here to support your financial needs.",
        type: "info",
        priority: "medium",
        isUrgent: false,
        isRead: false,
        sentBySystem: true,
      };

      const notification2 = {
        recipientType: "client",
        clientId: client._id,
        title: "Loan Application Approved",
        message:
          "Your loan application has been approved. Please check your dashboard for details.",
        type: "loan_approved",
        priority: "high",
        isUrgent: true,
        isRead: false,
        sentBySystem: true,
      };

      notificationsData.push(notification1, notification2);
    }

    await Notification.insertMany(notificationsData);
    console.log(`Seeded ${notificationsData.length} Notifications`);
  } catch (error) {
    console.error("Error seeding Notifications:", error);
    throw error;
  }
};

module.exports = seedNotifications;
