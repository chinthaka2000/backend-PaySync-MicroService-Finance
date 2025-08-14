const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Client = require('./models/Client');
const ClientUser = require('./models/clientUsers');
const Staff = require('./models/Staff');

// Load environment variables
dotenv.config();

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ MongoDB connected');
  } catch (err) {
    console.error('❌ MongoDB connection failed:', err.message);
    process.exit(1);
  }
};

function generateTemporaryPassword(length = 8) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

const createTestData = async () => {
  try {
    // Your current user ID from the frontend
    const currentUserId = '64d3f40e2e3f4a2d1234567a';
    console.log(`🎯 Creating data for user ID: ${currentUserId}`);

    // Check if this staff member exists
    let staff = await Staff.findById(currentUserId);
    if (!staff) {
      console.log('👤 Staff member not found, creating one...');
      staff = new Staff({
        _id: currentUserId,
        name: 'Test Agent',
        email: 'agent@paysync.com',
        passwordHash: '$2b$10$example',
        role: 'agent',
        area: 'Test Area'
      });
      await staff.save();
      console.log('✅ Staff member created');
    } else {
      console.log(`✅ Staff member found: ${staff.name}`);
    }

    // Create pending clients
    const pendingClients = [
      {
        registrationId: 'T00001',
        personalInfo: {
          fullName: 'Saman Kumara',
          contactNumber: '+94771111111',
          email: 'saman.kumara@test.com',
          dateOfBirth: new Date('1987-05-20'),
          address: '111 Test Street, Colombo',
          district: 'Colombo'
        },
        identityVerification: {
          idType: 'NIC',
          idNumber: '198711111111',
          verified: false
        },
        employmentDetails: {
          employer: 'Test Company',
          jobRole: 'Developer',
          monthlyIncome: 80000,
          employmentDuration: '4 years',
          verified: false
        },
        documents: { verified: false },
        assignedReviewer: currentUserId,
        status: 'Pending'
      },
      {
        registrationId: 'T00002',
        personalInfo: {
          fullName: 'Priya Jayasinghe',
          contactNumber: '+94772222222',
          email: 'priya.jayasinghe@test.com',
          dateOfBirth: new Date('1992-08-15'),
          address: '222 Test Avenue, Kandy',
          district: 'Kandy'
        },
        identityVerification: {
          idType: 'NIC',
          idNumber: '199222222222',
          verified: false
        },
        employmentDetails: {
          employer: 'Test Bank',
          jobRole: 'Analyst',
          monthlyIncome: 70000,
          employmentDuration: '2 years',
          verified: false
        },
        documents: { verified: false },
        assignedReviewer: currentUserId,
        status: 'Pending'
      }
    ];

    // Create approved clients
    const approvedClients = [
      {
        registrationId: 'T00003',
        personalInfo: {
          fullName: 'Ruwan Silva',
          contactNumber: '+94773333333',
          email: 'ruwan.silva@test.com',
          dateOfBirth: new Date('1985-12-10'),
          address: '333 Test Road, Galle',
          district: 'Galle'
        },
        identityVerification: {
          idType: 'NIC',
          idNumber: '198533333333',
          verified: true
        },
        employmentDetails: {
          employer: 'Test Corp',
          jobRole: 'Manager',
          monthlyIncome: 90000,
          employmentDuration: '6 years',
          verified: true
        },
        documents: { verified: true },
        assignedReviewer: currentUserId,
        status: 'Approved',
        approvedAt: new Date(),
        agentNotes: 'All documents verified and approved'
      },
      {
        registrationId: 'T00004',
        personalInfo: {
          fullName: 'Chamari Fernando',
          contactNumber: '+94774444444',
          email: 'chamari.fernando@test.com',
          dateOfBirth: new Date('1990-03-25'),
          address: '444 Test Lane, Matara',
          district: 'Matara'
        },
        identityVerification: {
          idType: 'NIC',
          idNumber: '199044444444',
          verified: true
        },
        employmentDetails: {
          employer: 'Test Industries',
          jobRole: 'Engineer',
          monthlyIncome: 75000,
          employmentDuration: '3 years',
          verified: true
        },
        documents: { verified: true },
        assignedReviewer: currentUserId,
        status: 'Approved',
        approvedAt: new Date(),
        agentNotes: 'Excellent credit history'
      }
    ];

    // Insert pending clients
    for (const clientData of pendingClients) {
      const existing = await Client.findOne({ registrationId: clientData.registrationId });
      if (!existing) {
        const client = new Client(clientData);
        await client.save();
        console.log(`✅ Created pending client: ${clientData.personalInfo.fullName}`);
      } else {
        console.log(`⚠️ Pending client already exists: ${clientData.registrationId}`);
      }
    }

    // Insert approved clients and create ClientUser records
    for (const clientData of approvedClients) {
      const existing = await Client.findOne({ registrationId: clientData.registrationId });
      if (!existing) {
        const client = new Client(clientData);
        await client.save();
        console.log(`✅ Created approved client: ${clientData.personalInfo.fullName}`);

        // Create ClientUser record
        const password = generateTemporaryPassword();
        const clientUser = new ClientUser({
          clientId: client._id,
          username: clientData.personalInfo.email,
          email: clientData.personalInfo.email,
          password: password,
          verifiedBy: currentUserId,
          role: 'client',
          status: 'Active'
        });

        await clientUser.save();
        console.log(`✅ Created client user: ${clientData.personalInfo.email} (password: ${password})`);
      } else {
        console.log(`⚠️ Approved client already exists: ${clientData.registrationId}`);
      }
    }

    console.log('\n🎉 Test data creation completed!');

    // Show summary for current user
    const userPendingCount = await Client.countDocuments({
      assignedReviewer: currentUserId,
      status: 'Pending'
    });
    const userApprovedCount = await Client.countDocuments({
      assignedReviewer: currentUserId,
      status: 'Approved'
    });
    const userClientUsersCount = await ClientUser.countDocuments({
      verifiedBy: currentUserId
    });

    console.log('\n📋 Summary for your user:');
    console.log(`- Pending clients: ${userPendingCount}`);
    console.log(`- Approved clients: ${userApprovedCount}`);
    console.log(`- Client users: ${userClientUsersCount}`);

  } catch (error) {
    console.error('❌ Error creating test data:', error);
  } finally {
    mongoose.connection.close();
    console.log('🔌 Database connection closed');
  }
};

// Run the script
const run = async () => {
  await connectDB();
  await createTestData();
};

if (require.main === module) {
  run();
}

module.exports = { createTestData };