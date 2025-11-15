/**
 * @fileoverview Client Controller - Handles client registration, approval, rejection, and management
 * @module controllers/clientController
 */
const mongoose = require("mongoose");
const Client = require("../models/Client");
const Region = require("../models/Region");
const Staff = require("../models/Staff");
const ClientUser = require("../models/clientUsers");
const sendEmail = require("../utils/sendEmail");

// Utility: Generate sequential registration IDs (e.g., L00001)
async function generateRegistrationId() {
  const lastClient = await Client.findOne().sort({ createdAt: -1 });
  if (!lastClient || !lastClient.registrationId) return "L00001";

  const numberPart = parseInt(lastClient.registrationId.slice(1));
  const nextNumber = numberPart + 1;
  return `L${nextNumber.toString().padStart(5, "0")}`;
}

// Register new client
exports.registerClient = async (req, res) => {
  try {
    const clientData = JSON.parse(req.body.data);

    if (!clientData.personalInfo?.district) {
      return res
        .status(400)
        .json({ message: "District is required in personalInfo" });
    }

    const existingClient = await Client.findOne({
      registrationId: clientData.registrationId,
    });
    if (existingClient)
      return res
        .status(400)
        .json({ message: "Client already exists with this ID" });

    const region = await Region.findOne({
      districts: clientData.personalInfo.district,
    });
    if (!region)
      return res
        .status(404)
        .json({ message: "No region found for this district" });

    const agent = await Staff.findOne({ role: "agent", region: region._id });
    if (!agent)
      return res
        .status(404)
        .json({ message: "No agent found for this region" });

    const files = req.files;
    const registrationId = await generateRegistrationId();

    const idCardUrl = files?.idCard ? files.idCard[0].path : null;
    const employmentLetterUrl = files?.employmentLetter ? files.employmentLetter[0].path : null;

    const newClient = new Client({
      registrationId: registrationId,
      personalInfo: {
        fullName: clientData.personalInfo.fullName,
        contactNumber: clientData.personalInfo.contactNumber,
        email: clientData.personalInfo.email,
        dateOfBirth: clientData.personalInfo.dateOfBirth,
        address: clientData.personalInfo.address,
        district: clientData.personalInfo.district
      },
      identityVerification: {
        idType: clientData.identityVerification.idType || 'NIC',
        idNumber: clientData.identityVerification.idNumber,
        idCardUrl: idCardUrl // in frontend you sholud ensure the name idcard in form-data
      },
      employmentDetails: {
        employer: clientData.employmentDetails.employer,
        jobRole: clientData.employmentDetails.jobRole,
        monthlyIncome: clientData.employmentDetails.monthlyIncome,
        employmentDuration: clientData.employmentDetails.employmentDuration,
        employmentLetterUrl: employmentLetterUrl // in frontend you should ensure the name employmentLetter in form-data
      },
      assignedReviewer: agent._id
    });

    await newClient.save();
    res
      .status(201)
      .json({ message: "Client registered successfully", client: newClient });
  } catch (error) {
    console.error("Error registering client:", error);
    res
      .status(500)
      .json({ message: "Error registering client", error: error.message });
  }
};

// Get clients with filters (Approved/Rejected + search)
exports.getClients = async (req, res) => {
  try {
    const { status, page = 1, limit = 10, search = "" } = req.query;
    const allowedStatuses = ["Approved", "Rejected"];
    const query = {
      status: { $in: allowedStatuses },
      ...(status && allowedStatuses.includes(status) ? { status } : {}),
      ...(search
        ? {
            $or: [
              { "personalInfo.fullName": { $regex: search, $options: "i" } },
              { "personalInfo.email": { $regex: search, $options: "i" } },
              {
                "personalInfo.contactNumber": { $regex: search, $options: "i" },
              },
              { registrationId: { $regex: search, $options: "i" } },
            ],
          }
        : {}),
    };

    const clients = await Client.find(
      query,
      "registrationId personalInfo.fullName personalInfo.contactNumber personalInfo.email status"
    )
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await Client.countDocuments(query);
    res.json({
      clients,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error("Error fetching clients:", error);
    res.status(500).json({ message: error.message });
  }
};

// Get pending clients
exports.getPendingClient = async (req, res) => {
  try {
    const clients = await Client.find({ status: "Pending" });
    res.json(clients);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get client details by ClientUser ID
exports.getClientById = async (req, res) => {
  try {
    const { id } = req.params;
    const clientUser = await ClientUser.findById(id).select("clientId");
    if (!clientUser)
      return res.status(404).json({ message: "ClientUser not found" });

    const client = await Client.findById(clientUser.clientId).populate(
      "assignedReviewer"
    );
    if (!client) return res.status(404).json({ message: "Client not found" });

    res.json({ message: "Client details fetched successfully", data: client });
  } catch (error) {
    console.error("Error fetching client by ID:", error);
    res.status(500).json({ message: error.message });
  }
};

// Approve client (creates ClientUser + sends email)
exports.clientApprovedMessage = async (req, res) => {
  try {
    const { id, notes } = req.body;
    const client = await Client.findOne({ registrationId: id }).populate(
      "assignedReviewer"
    );
    if (!client) return res.status(404).json({ message: "Client not found" });

    if (["Approved", "Rejected"].includes(client.status)) {
      return res
        .status(400)
        .json({ message: `Client already ${client.status}` });
    }

    const clientEmail = client.personalInfo.email;
    if (!clientEmail)
      return res.status(400).json({ message: "Client email not found" });

    const password = generateTemporaryPassword();
    await sendEmail(
      clientEmail,
      "Client approved",
      `Welcome to Loan Management System.\nYour account has been created.\nUsername: ${clientEmail}\nPassword: ${password}`
    );

    client.status = "Approved";
    client.approvedAt = new Date();
    client.agentNotes = notes;
    await client.save();

    let clientUser = await ClientUser.findOne({ email: clientEmail });
    if (!clientUser) {
      clientUser = new ClientUser({
        clientId: client._id,
        username: clientEmail,
        email: clientEmail,
        password,
        role: "client",
        isActive: true,
      });
      await clientUser.save();
    } else {
      clientUser.isActive = true;
      await clientUser.save();
    }

    res.json({
      message: "Client approved and email sent successfully",
      client,
    });
  } catch (error) {
    console.error("Error approving client:", error);
    res.status(500).json({ message: error.message });
  }
};

// Reject client
exports.clientRejectedMessage = async (req, res) => {
  try {
    const { id } = req.params;
    const client = await Client.findOne({ registrationId: id });
    if (!client) return res.status(404).json({ message: "Client not found" });

    if (["Approved", "Rejected"].includes(client.status)) {
      return res
        .status(400)
        .json({ message: `Client already ${client.status}` });
    }

    const clientEmail = client.personalInfo.email;
    await sendEmail(
      clientEmail,
      "Application Status - Declined",
      `Dear ${client.personalInfo.fullName},\n\nYour application has been declined.\n\nLoan Management Team`
    );

    client.status = "Rejected";
    client.rejectedAt = new Date();
    await client.save();

    res.json({
      message: "Client rejected and email sent successfully",
      client,
    });
  } catch (error) {
    console.error("Error rejecting client:", error);
    res.status(500).json({ message: error.message });
  }
};

// Utility: Generate temp password
function generateTemporaryPassword(length = 8) {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789@#$%";
  return Array.from(
    { length },
    () => chars[Math.floor(Math.random() * chars.length)]
  ).join("");
}
// Get clients assigned to a specific agent
exports.getAssignedClients = async (req, res) => {
  try {
    const { id } = req.params;
    const agent = await Staff.findById(id);
    if (!agent) return res.status(404).json({ message: "Agent not found" });

    const clients = await Client.find({ assignedReviewer: agent._id });
    res.json(clients);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get all clients
exports.getAllClients = async (req, res) => {
  try {
    const clients = await Client.find();
    res.json(clients);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get clients by assigner ID
exports.getClientByAssignerId = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, page = 1, limit = 10 } = req.query;
    const query = { assignedReviewer: id };
    if (status) query.status = status;

    const clients = await Client.find(query)
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await Client.countDocuments(query);
    res.json({
      clients,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / limit),
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get client users by verifier ID
exports.getClientUserByVerifierId = async (req, res) => {
  try {
    const { id } = req.params;
    const clientUsers = await ClientUser.find({ verifierId: id });
    res.json(clientUsers);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Approve client by query
exports.approveClientByQuery = async (req, res) => {
  try {
    const { id } = req.query || req.body;
    const client = await Client.findOne({ registrationId: id });
    if (!client) return res.status(404).json({ message: "Client not found" });

    if (["Approved", "Rejected"].includes(client.status)) {
      return res.status(400).json({ message: `Client already ${client.status}` });
    }

    client.status = "Approved";
    client.approvedAt = new Date();
    await client.save();

    res.json({ message: "Client approved successfully", client });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Reject client by query
exports.rejectClientByQuery = async (req, res) => {
  try {
    const { id } = req.query || req.body;
    const client = await Client.findOne({ registrationId: id });
    if (!client) return res.status(404).json({ message: "Client not found" });

    if (["Approved", "Rejected"].includes(client.status)) {
      return res.status(400).json({ message: `Client already ${client.status}` });
    }

    client.status = "Rejected";
    client.rejectedAt = new Date();
    await client.save();

    res.json({ message: "Client rejected successfully", client });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Update client status by query
exports.updateClientStatusByQuery = async (req, res) => {
  try {
    const { id, status } = req.body;
    const client = await Client.findOne({ registrationId: id });
    if (!client) return res.status(404).json({ message: "Client not found" });

    client.status = status;
    await client.save();

    res.json({ message: "Client status updated successfully", client });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Suspend client by ID
exports.suspendClientById = async (req, res) => {
  try {
    const { id } = req.params;
    const client = await Client.findById(id);
    if (!client) return res.status(404).json({ message: "Client not found" });

    client.status = "Suspended";
    await client.save();

    res.json({ message: "Client suspended successfully", client });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Activate client by ID
exports.activateClientById = async (req, res) => {
  try {
    const { id } = req.params;
    const client = await Client.findById(id);
    if (!client) return res.status(404).json({ message: "Client not found" });

    client.status = "Active";
    await client.save();

    res.json({ message: "Client activated successfully", client });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Deactivate client by ID
exports.deactivateClientById = async (req, res) => {
  try {
    const { id } = req.params;
    const client = await Client.findById(id);
    if (!client) return res.status(404).json({ message: "Client not found" });

    client.status = "Inactive";
    await client.save();

    res.json({ message: "Client deactivated successfully", client });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
