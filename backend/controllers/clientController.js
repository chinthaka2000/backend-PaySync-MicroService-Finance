const Client = require('../models/Client');
const Region = require('../models/Region');
const Staff = require('../models/Staff');

// Create a new client registration
exports.registerClient = async (req, res) => {
  try {
    const clientData = req.body;

    const existingClient = await Client.findOne({ registrationId: clientData.registrationId });
    if (existingClient) {
      return res.status(400).json({ message: 'Client with this Registration ID already exists' });
    }

    const district = clientData.personalInfo?.district;

    if (!district) {
      return res.status(400).json({ message: 'District is required in personalInfo' });
    }

    // Step 1: Find the region that includes this district
    const region = await Region.findOne({ districts: district });
    if (!region) {
      return res.status(404).json({ message: `No region found covering district: ${district}` });
    }

    // Step 2: Find an agent assigned to this region
    const agent = await Staff.findOne({ role: 'agent', region: region._id });

    if (!agent) {
      return res.status(404).json({ message: `No agent found for region: ${region.name}` });
    }

    const newClient = new Client({
      registrationId: clientData.registrationId,
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
        documentUrl: clientData.identityVerification.documentUrl
      },
      employmentDetails: {
        employer: clientData.employmentDetails.employer,
        jobRole: clientData.employmentDetails.jobRole,
        monthlyIncome: clientData.employmentDetails.monthlyIncome,
        employmentDuration: clientData.employmentDetails.employmentDuration,
        employmentLetterUrl: clientData.employmentDetails.employmentLetterUrl
      },
      assignedReviewer: agent._id
    });
    await newClient.save();

    res.status(201).json({ message: 'Client registered successfully', client: newClient });
  } catch (error) {
    res.status(500).json({ message: 'Error registering client', error: error.message });
  }
};

exports.getAllClients = async (req, res) => {
  try {
    const clients = await Client.find().populate('assignedReviewer');
    res.status(200).json(clients);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching clients', error: error.message });
  }
};

// GET /api/users
exports.getClients = async (req, res) => {
  try {
    const { status, page = 1, limit = 10, search = '' } = req.query;
    const allowedStatuses = ['Approved', 'Rejected'];
    const query = {
      status: { $in: allowedStatuses },
      ...(status && allowedStatuses.includes(status) ? { status } : {}),
      ...(search ? {
        $or: [
          { "personalInfo.fullName": { $regex: search, $options: 'i' } },
          { "personalInfo.email": { $regex: search, $options: 'i' } },
          { "personalInfo.contactNumber": { $regex: search, $options: 'i' } },
          { registrationId: { $regex: search, $options: 'i' } },
          { userId: { $regex: search, $options: 'i' } }
        ]
      } : {})
    };

    const clients = await Client.find(query, "registrationId personalInfo.fullName personalInfo.contactNumber personalInfo.email status")
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await Client.countDocuments(query);

    res.json({ clients, total, page: parseInt(page), pages: Math.ceil(total / limit) });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getPendingClient = async (req, res) => {
  const clients = await Client.find({ status: 'Pending Review' });
  res.json(clients);
};

// GET /api/users/:id
exports.getClientById = async (req, res) => {
  try {
    const client = await Client.findOne({ registrationId: req.params.id });
    if (!client) return res.status(404).json({ message: 'Client not found' });
    res.json(client);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// GET /api/summary
exports.getSummary = async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const activeUsers = await User.countDocuments({ status: 'active' });
    const inactiveUsers = await User.countDocuments({ status: 'inactive' });
    const pending = 30; // you can later link this to a Registration model
    const rejected = 4000; // placeholder or link to another model

    res.json({
      totalUsers,
      activeUsers,
      rejectRegistrations: rejected,
      pendingRegistrations: pending
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get a specific client by ID
exports.getClientById = async (req, res) => {
  try {
    const client = await Client.findById(req.params.id).populate('assignedReviewer', 'name email');

    if (!client) {
      return res.status(404).json({ message: 'Client not found' });
    }

    res.status(200).json(client);
  } catch (error) {
    res.status(500).json({ message: 'Error retrieving client', error: error.message });
  }
};

// Update client status (approve/reject)
exports.updateClientStatus = async (req, res) => {
  try {
    const { status, agentNotes } = req.body;

    const updateFields = {
      status,
      agentNotes,
      lastUpdated: new Date(),
    };

    if (status === 'Approved') updateFields.approvedAt = new Date();
    if (status === 'Rejected') updateFields.rejectedAt = new Date();

    const client = await Client.findByIdAndUpdate(req.params.id, updateFields, { new: true });

    if (!client) {
      return res.status(404).json({ message: 'Client not found' });
    }

    res.status(200).json({ message: 'Client status updated', client });
  } catch (error) {
    res.status(500).json({ message: 'Error updating client', error: error.message });
  }
};
