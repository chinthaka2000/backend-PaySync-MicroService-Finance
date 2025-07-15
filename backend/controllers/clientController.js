const Client = require('../models/Client');
const Region = require('../models/Region');
const Staff = require('../models/Staff');
const ClientUser = require('../models/clientUsers');
const sendEmail = require('../utils/sendEmail');

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
   // const clients = await Client.find().populate('assignedReviewer');
    const clients = await Client.find()
        .populate({
          path: 'assignedReviewer', // Level 1: Populate the assigned reviewer
          populate: {
            path: 'region',         // Level 2: Populate the region inside the reviewer
            model: 'Region'         // Optional if you already defined 'ref' in User schema
          }
        });
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


exports.getClientById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ message: 'Registration ID is required' });
    }

    const client = await Client.findOne({ registrationId: id })
        .populate({
          path: 'assignedReviewer', // Level 1: Populate the assigned reviewer
          populate: {
            path: 'region',         // Level 2: Populate the region inside the reviewer
            model: 'Region'         // Optional if you already defined 'ref' in User schema
          }
        });


    if (!client) {
      return res.status(404).json({ message: 'Client not found' });
    }

    res.status(200).json({
      message: 'Client details fetched successfully',
      data: client
    });
  } catch (error) {
    console.error('Error getting client by ID:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

exports.clientApprovedMessage = async (req, res) => {
  try {
    const { id } = req.params;

    const client = await Client.findOne({ registrationId: id}).populate('assignedReviewer');
    const user = await Staff.findById(client.assignedReviewer);
    if (client.status == 'Approved') {
      return res.status(404).json({ message: 'Client already approved' });
    }
    if (client.status == 'Rejected') {
      return res.status(404).json({ message: 'Client already rejected' });
    }
    
    

    const clientEmail = client.personalInfo.email;
    const password = generateTemporaryPassword();

    const message =  `Welcome to Loan Management System
      Your account has been created successfully.
      Username: ${clientEmail}
      Password: ${password}
      Please log in and change your password after first login.`;

    //await sendEmail(clientEmail, 'Client approved', message);

    client.status = 'Approved';
    client.approvedAt = new Date(); // optional timestamp
    await client.save();

    const clientuser = new ClientUser({
      clientId: client._id,
      username: clientEmail,
      email: clientEmail,
      password: password, // Will be hashed automatically
      verifiedBy: user._id,
      role: 'client',
      isActive: true
    });

    await clientuser.save();

    res.status(200).json({ message: 'Email sent successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error sending email', error: error.message });
  }
};

function generateTemporaryPassword(length = 8) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789@#$';
  return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

exports.clientRejectedMessage = async (req, res) => {
  try {
    const { id } = req.params;

    const client = await Client.findOne({ registrationId: id });
    if (client.status == 'Approved') {
      return res.status(404).json({ message: 'Client already approved' });
    }
    if (client.status == 'Rejected') {
      return res.status(404).json({ message: 'Client already rejected' });
    }

    const clientEmail = client.personalInfo.email;

    const message = `Welcome to Loan Management System
      Your account has been created successfully.`;

    //await sendEmail(clientEmail, 'Client rejected', message);

    client.status = 'Rejected';
    client.rejectedAt = new Date(); // optional timestamp
    await client.save();

    res.status(200).json({ message: 'Email sent successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error sending email', error: error.message });
  }
};

///// Summary endpoint to get total users, active users, pending registrations, and rejected registrations
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
