const multer = require('multer');
const mongoose = require('mongoose');
const storage = require('../utils/cloudinaryStorage');
const Client = require('../models/Client');
const Region = require('../models/Region');
const Staff = require('../models/Staff');
const ClientUser = require('../models/clientUsers');
const sendEmail = require('../utils/sendEmail');


async function generateRegistarationId(params) {

  const lastClient = await Client.findOne().sort({ createdAt: -1 });

  if (!lastClient || !lastClient.registrationId) {
    return 'L00001';
  }
  const lastId = lastClient.registrationId;
  const numberPart = parseInt(lastId.slice(1)); // remove 'L' and convert to number
  const nextNumber = numberPart + 1;

  const nextId = `L${nextNumber.toString().padStart(5, '0')}`;
  return nextId;
}

// Create a new client registration
exports.registerClient = async (req, res) => {
  try {
    const clientData = JSON.parse(req.body.data);

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

    const files = req.files;
    const now = new Date();

    // const idCardUpload = await cloudinary.uploader.upload(files?.idCard?.[0].path);
    // const employmentLetterUpload = await cloudinary.uploader.upload(files?.employmentLetter?.[0].path);

    const idCardUrl = files?.idCard ? files.idCard[0].path : null;
    const employmentLetterUrl = files?.employmentLetter ? files.employmentLetter[0].path : null;

    


    const registrationId = await generateRegistarationId();

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

exports.getClientByAssignerId = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ message: 'Assigner ID is required' });
    }

    // Validate if the ID is a valid MongoDB ObjectId
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid assigner ID format' });
    }

    const client = await Client.find({ assignedReviewer: id })
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

    // res.status(200).json({
    //   message: 'Client details fetched successfully',
    //   data: client
    // });
    res.status(200).json(client);
  } catch (error) {
    console.error('Error getting client by ID:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

exports.clientApprovedMessage = async (req, res) => {
  try {
    const { id, notes } = req.body;

    console.log(`🔍hello Looking for client with registration ID: ${id}`);

    const client = await Client.findOne({ registrationId: id }).populate('assignedReviewer');

    if (!client) {
      console.log(`❌ Client not found with ID: ${id}`);
      const allClients = await Client.find({}, 'registrationId').limit(10);
      return res.status(404).json({
        message: 'Client not found. Please verify the registration ID exists and try again.',
        searchedId: id,
        availableIds: allClients.map(c => c.registrationId)
      });
    }

    console.log(`✅ Client found: ${client.personalInfo.fullName}`);

    if (client.status === 'Approved') {
      return res.status(400).json({ message: 'Client already approved' });
    }
    if (client.status === 'Rejected') {
      return res.status(400).json({ message: 'Client already rejected' });
    }

    // Check if assignedReviewer exists
    if (!client.assignedReviewer) {
      console.log(`❌ No assigned reviewer for client ${id}`);
      return res.status(400).json({ message: 'No reviewer assigned to this client' });
    }

    const user = await Staff.findById(client.assignedReviewer);
    if (!user) {
      console.log(`❌ Assigned reviewer not found: ${client.assignedReviewer}`);
      return res.status(400).json({ message: 'Assigned reviewer not found' });
    }

    const clientEmail = client.personalInfo.email;
    if (!clientEmail) {
      return res.status(400).json({ message: 'Client email not found' });
    }

    const password = generateTemporaryPassword();

    const message = `Welcome to Loan Management System
      Your account has been created successfully.
      Username: ${clientEmail}
      Password: ${password}
      Please log in and change your password after first login.`;

    console.log(`📧 Sending email to: ${clientEmail}`);
    await sendEmail(clientEmail, 'Client approved', message);

    client.status = 'Approved';
    client.approvedAt = new Date();
    client.agentNotes = notes;
    await client.save();

    console.log(`${agentNotes ? `📝 Notes added: ${notes}` : 'no notes available'}`);
    console.log(`✅ Client ${id} approved successfully`);

    // Check if ClientUser already exists
    const existingClientUser = await ClientUser.findOne({
      $or: [
        { username: clientEmail },
        { email: clientEmail },
        { clientId: client._id }
      ]
    });

    if (existingClientUser) {
      console.log(`⚠️ Client user already exists for: ${clientEmail}`);
      // Update existing user instead of creating new one
      existingClientUser.isActive = true;
      existingClientUser.verifiedBy = user._id;
      await existingClientUser.save();
      console.log(`✅ Client user updated for: ${clientEmail}`);
    } else {
      // Create new ClientUser
      const clientuser = new ClientUser({
        clientId: client._id,
        username: clientEmail,
        email: clientEmail,
        password: password,
        verifiedBy: user._id,
        role: 'client',
        isActive: true
      });

      await clientuser.save();
      console.log(`✅ Client user created for: ${clientEmail}`);
    }

    res.status(200).json({
      message: 'Client approved and email sent successfully',
      client: {
        registrationId: client.registrationId,
        status: client.status,
        email: clientEmail
      }
    });
  } catch (error) {
    console.error('❌ Error in clientApprovedMessage:', error);
    res.status(500).json({
      message: 'Error processing approval',
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

function generateTemporaryPassword(length = 8) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789@#$%';
  return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
} '$';


exports.clientRejectedMessage = async (req, res) => {
  try {
    const { id } = req.params;

    console.log(`🔍 Looking for client to reject with registration ID: ${id}`);

    const client = await Client.findOne({ registrationId: id });

    if (!client) {
      console.log(`❌ Client not found with ID: ${id}`);
      const allClients = await Client.find({}, 'registrationId').limit(10);
      return res.status(404).json({
        message: 'Client not found. Please verify the registration ID exists and try again.',
        searchedId: id,
        availableIds: allClients.map(c => c.registrationId)
      });
    }

    console.log(`✅ Client found: ${client.personalInfo.fullName}`);

    if (client.status === 'Approved') {
      return res.status(400).json({ message: 'Client already approved' });
    }
    if (client.status === 'Rejected') {
      return res.status(400).json({ message: 'Client already rejected' });
    }

    const clientEmail = client.personalInfo.email;
    if (!clientEmail) {
      return res.status(400).json({ message: 'Client email not found' });
    }

    const message = `Dear ${client.personalInfo.fullName},

Thank you for your application to our Loan Management System.

After careful review, we regret to inform you that your application has been declined at this time.

If you have any questions or would like to discuss this decision, please contact our support team.

Best regards,
Loan Management Team`;

    console.log(`📧 Sending rejection email to: ${clientEmail}`);
    await sendEmail(clientEmail, 'Application Status - Declined', message);

    client.status = 'Rejected';
    client.rejectedAt = new Date();
    await client.save();

    console.log(`✅ Client ${id} rejected successfully`);

    res.status(200).json({
      message: 'Client rejected and email sent successfully',
      client: {
        registrationId: client.registrationId,
        status: client.status,
        email: clientEmail
      }
    });
  } catch (error) {
    console.error('❌ Error in clientRejectedMessage:', error);
    res.status(500).json({
      message: 'Error processing rejection',
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
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
// New functions to handle frontend API calls

// Handle /approve endpoint with query parameter
exports.approveClientByQuery = async (req, res) => {
  try {
    // Get registration ID from query parameter
    const registrationId = req.query.id || req.body.id;
    const notes = req.body.agentNotes || '';

    if (!registrationId) {
      return res.status(400).json({
        message: 'Registration ID is required as a query parameter (?id=X00000) or in request body'
      });
    }

    console.log(`🔍 Looking for client with registration ID: ${registrationId}`);

    const client = await Client.findOne({ registrationId }).populate('assignedReviewer');

    if (!client) {
      console.log(`❌ Client not found with ID: ${registrationId}`);
      const allClients = await Client.find({}, 'registrationId').limit(10);
      return res.status(404).json({
        message: 'Client not found. Please verify the registration ID exists and try again.',
        searchedId: registrationId,
        availableIds: allClients.map(c => c.registrationId)
      });
    }

    console.log(`✅ Client found: ${client.personalInfo.fullName}`);

    if (client.status === 'Approved') {
      return res.status(400).json({ message: 'Client already approved' });
    }
    if (client.status === 'Rejected') {
      return res.status(400).json({ message: 'Client already rejected' });
    }

    // Check if assignedReviewer exists
    if (!client.assignedReviewer) {
      console.log(`❌ No assigned reviewer for client ${registrationId}`);
      return res.status(400).json({ message: 'No reviewer assigned to this client' });
    }

    const user = await Staff.findById(client.assignedReviewer);
    if (!user) {
      console.log(`❌ Assigned reviewer not found: ${client.assignedReviewer}`);
      return res.status(400).json({ message: 'Assigned reviewer not found' });
    }

    const clientEmail = client.personalInfo.email;
    if (!clientEmail) {
      return res.status(400).json({ message: 'Client email not found' });
    }

    const password = generateTemporaryPassword();

    const message = `Welcome to Loan Management System
      Your account has been created successfully.
      Username: ${clientEmail}
      Password: ${password}
      Please log in and change your password after first login.`;

    console.log(`📧 Sending email to: ${clientEmail}`);
    await sendEmail(clientEmail, 'Client approved', message);

    client.status = 'Approved';
    client.approvedAt = new Date();
    client.agentNotes = notes;
    await client.save();

    console.log(`✅ Client ${registrationId} approved successfully`);

    // Check if ClientUser already exists
    const existingClientUser = await ClientUser.findOne({
      $or: [
        { username: clientEmail },
        { email: clientEmail },
        { clientId: client._id }
      ]
    });

    if (existingClientUser) {
      console.log(`⚠️ Client user already exists for: ${clientEmail}`);
      // Update existing user instead of creating new one
      existingClientUser.isActive = true;
      existingClientUser.verifiedBy = user._id;
      await existingClientUser.save();
      console.log(`✅ Client user updated for: ${clientEmail}`);
    } else {
      // Create new ClientUser
      const clientuser = new ClientUser({
        clientId: client._id,
        username: clientEmail,
        email: clientEmail,
        password: password,
        verifiedBy: user._id,
        role: 'client',
        isActive: true
      });

      await clientuser.save();
      console.log(`✅ Client user created for: ${clientEmail}`);
    }

    res.status(200).json({
      message: 'Client approved and email sent successfully',
      client: {
        registrationId: client.registrationId,
        status: client.status,
        email: clientEmail
      }
    });
  } catch (error) {
    console.error('❌ Error in approveClientByQuery:', error);
    res.status(500).json({
      message: 'Error processing approval',
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

// Handle /reject endpoint with query parameter
exports.rejectClientByQuery = async (req, res) => {
  try {
    // Get registration ID from query parameter
    const registrationId = req.query.id || req.body.id;
    const notes = req.body.agentNotes || '';

    if (!registrationId) {
      return res.status(400).json({
        message: 'Registration ID is required as a query parameter (?id=X00000) or in request body'
      });
    }

    console.log(`🔍 Looking for client to reject with registration ID: ${registrationId}`);

    const client = await Client.findOne({ registrationId });

    if (!client) {
      console.log(`❌ Client not found with ID: ${registrationId}`);
      const allClients = await Client.find({}, 'registrationId').limit(10);
      return res.status(404).json({
        message: 'Client not found. Please verify the registration ID exists and try again.',
        searchedId: registrationId,
        availableIds: allClients.map(c => c.registrationId)
      });
    }

    console.log(`✅ Client found: ${client.personalInfo.fullName}`);

    if (client.status === 'Approved') {
      return res.status(400).json({ message: 'Client already approved' });
    }
    if (client.status === 'Rejected') {
      return res.status(400).json({ message: 'Client already rejected' });
    }

    const clientEmail = client.personalInfo.email;
    if (!clientEmail) {
      return res.status(400).json({ message: 'Client email not found' });
    }

    const message = `Dear ${client.personalInfo.fullName},

Thank you for your application to our Loan Management System.

After careful review, we regret to inform you that your application has been declined at this time.

If you have any questions or would like to discuss this decision, please contact our support team.

Best regards,
Loan Management Team`;

    console.log(`📧 Sending rejection email to: ${clientEmail}`);
    await sendEmail(clientEmail, 'Application Status - Declined', message);

    client.status = 'Rejected';
    client.rejectedAt = new Date();
    client.agentNotes = notes;
    await client.save();

    console.log(`✅ Client ${registrationId} rejected successfully`);

    res.status(200).json({
      message: 'Client rejected and email sent successfully',
      client: {
        registrationId: client.registrationId,
        status: client.status,
        email: clientEmail
      }
    });
  } catch (error) {
    console.error('❌ Error in rejectClientByQuery:', error);
    res.status(500).json({
      message: 'Error processing rejection',
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

// Handle /update-status endpoint
exports.updateClientStatusByQuery = async (req, res) => {
  try {
    const { id, status, agentNotes } = req.body;

    if (!id) {
      return res.status(400).json({ message: 'Client ID is required' });
    }

    if (!status || !['Approved', 'Rejected', 'Pending Review'].includes(status)) {
      return res.status(400).json({ message: 'Valid status is required (Approved, Rejected, or Pending Review)' });
    }

    console.log(`🔍 Looking for client with registration ID: ${id} to update status to ${status}`);

    const client = await Client.findOne({ registrationId: id });

    if (!client) {
      console.log(`❌ Client not found with ID: ${id}`);
      return res.status(404).json({ message: 'Client not found' });
    }

    const updateFields = {
      status,
      lastUpdated: new Date(),
    };

    if (agentNotes) {
      updateFields.agentNotes = agentNotes;
    }

    if (status === 'Approved') {
      updateFields.approvedAt = new Date();

      // If approving, handle the same logic as in approve endpoint
      if (client.status !== 'Approved') {
        // Call the approve function to handle email and user creation
        return exports.approveClientByQuery(req, res);
      }
    }

    if (status === 'Rejected') {
      updateFields.rejectedAt = new Date();

      // If rejecting, handle the same logic as in reject endpoint
      if (client.status !== 'Rejected') {
        // Call the reject function to handle email
        return exports.rejectClientByQuery(req, res);
      }
    }

    // Update the client
    const updatedClient = await Client.findOneAndUpdate(
      { registrationId: id },
      updateFields,
      { new: true }
    );

    console.log(`✅ Client ${id} status updated to ${status}`);

    res.status(200).json({
      message: 'Client status updated successfully',
      client: updatedClient
    });
  } catch (error) {
    console.error('❌ Error in updateClientStatusByQuery:', error);
    res.status(500).json({
      message: 'Error updating client status',
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

exports.getClientUserByVerifierId = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ message: 'Verifier ID is required' });
    }

    const clients = await ClientUser.find({ verifiedBy: id })
      .select('-password')
      .populate({
        path: 'clientId', // populate Client
        populate: {
          path: 'assignedReviewer', // populate Staff assignedReviewer inside Client
          populate: {
            path: 'region' // populate Region inside Staff
          }
        }
      });

    if (!clients || clients.length === 0) {
      return res.status(404).json({ message: 'No verified clients found for this verifier' });
    }

    res.status(200).json(clients);
  } catch (error) {
    console.error('Error fetching verified clients:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

exports.suspendClientById = async (req, res) => {
  try {
    const { id } = req.params;

    const client = await ClientUser.findByIdAndUpdate(
      id,
      { status: 'Suspended' },
      { new: true }
    );

    if (!client) {
      return res.status(404).json({ message: 'Client not found' });
    }

    res.json({ message: 'Client suspended successfully', client });
  } catch (error) {
    console.error('Error suspending client:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

exports.activateClientById = async (req, res) => {
  try {
    const { id ,status} = req.params;
    // console.log(`Activating status ${status}`);

    const client = await ClientUser.findByIdAndUpdate(
      id,
      { status: 'Active' },
      { new: true }
    );

    if (!client) {
      return res.status(404).json({ message: 'Client not found' });
    }

    res.json({ message: 'Client Activated successfully', client });
  } catch (error) {
    console.error('Error Activating client:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};  

exports.deactivateClientById = async (req, res) => {
    try {
    const { id ,status} = req.params;
    // console.log(`Activating status ${status}`);

    const client = await ClientUser.findByIdAndUpdate(
      id,
      { status: 'Inactive' },
      { new: true }
    );

    if (!client) {
      return res.status(404).json({ message: 'Client not found' });
    }

    res.json({ message: 'Client Deactivated successfully', client });
  } catch (error) {
    console.error('Error Deactivating client:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};