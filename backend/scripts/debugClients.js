const mongoose = require('mongoose');
const Loan = require('../models/Loan');
const Client = require('../models/Client');
require('dotenv').config();

const debugDatabase = async () => {
  try {
    console.log('🔄 Connecting to database...');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected successfully');

    // Check clients
    console.log('\n📋 CLIENTS:');
    const clients = await Client.find({});
    console.log(`Total clients: ${clients.length}`);

    clients.forEach((client, index) => {
      console.log(`${index + 1}. ${client.personalInfo?.fullName} (${client.registrationId}) - District: ${client.personalInfo?.district}`);
      console.log(`   Assigned to: ${client.assignedReviewer}`);
      console.log(`   Status: ${client.status}`);
    });

    // Check loans
    console.log('\n💰 LOANS:');
    const loans = await Loan.find({}).populate('clientUserId', 'personalInfo registrationId');
    console.log(`Total loans: ${loans.length}`);

    loans.forEach((loan, index) => {
      console.log(`${index + 1}. ${loan.loanApplicationId} - ${loan.clientUserId?.personalInfo?.fullName || 'Unknown'}`);
      console.log(`   Amount: ${loan.loanAmount}, Status: ${loan.loanStatus}`);
      console.log(`   Client ID: ${loan.clientUserId?._id}`);
    });

    // Check agent assignment
    console.log('\n👤 AGENT ASSIGNMENT CHECK:');
    const agentId = '507f1f77bcf86cd799439011';
    const agentClients = await Client.find({ assignedReviewer: agentId });
    console.log(`Clients assigned to agent ${agentId}: ${agentClients.length}`);

    const clientIds = agentClients.map(client => client._id);
    const agentLoans = await Loan.find({ clientUserId: { $in: clientIds } });
    console.log(`Loans for agent's clients: ${agentLoans.length}`);

    // Check for any validation issues
    console.log('\n🔍 VALIDATION CHECK:');
    try {
      const testClient = new Client({
        registrationId: 'TEST001',
        personalInfo: {
          fullName: 'Test User',
          email: 'test@example.com',
          contactNumber: '+94771234567',
          district: 'Colombo'
        },
        assignedReviewer: new mongoose.Types.ObjectId(agentId)
      });
      await testClient.validate();
      console.log('✅ Client validation passed');
    } catch (validationError) {
      console.log('❌ Client validation failed:', validationError.message);
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    mongoose.connection.close();
    console.log('\n🔌 Connection closed');
  }
};

debugDatabase();