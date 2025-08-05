const mongoose = require('mongoose');
const Loan = require('../models/Loan');
const Client = require('../models/Client');
require('dotenv').config();

const fixAgentAssignment = async () => {
  try {
    console.log('🔄 Connecting to database...');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected successfully');

    const agentId = '507f1f77bcf86cd799439011';

    // Check current state
    console.log('\n📊 Current state:');
    const allClients = await Client.find({});
    const allLoans = await Loan.find({}).populate('clientUserId');

    console.log(`Total clients: ${allClients.length}`);
    console.log(`Total loans: ${allLoans.length}`);

    // Show client assignments
    console.log('\n👥 Client assignments:');
    allClients.forEach(client => {
      console.log(`${client.personalInfo.fullName} (${client.registrationId}) -> Agent: ${client.assignedReviewer}`);
    });

    // Fix agent assignments if needed
    console.log('\n🔧 Fixing agent assignments...');
    const updateResult = await Client.updateMany(
      {},
      { assignedReviewer: new mongoose.Types.ObjectId(agentId) }
    );

    console.log(`✅ Updated ${updateResult.modifiedCount} client assignments`);

    // Verify agent can see loans
    console.log('\n🔍 Testing agent loan access...');
    const agentClients = await Client.find({ assignedReviewer: agentId });
    const clientIds = agentClients.map(client => client._id);
    const agentLoans = await Loan.find({ clientUserId: { $in: clientIds } }).populate('clientUserId');

    console.log(`Agent ${agentId} can access:`);
    console.log(`- ${agentClients.length} clients`);
    console.log(`- ${agentLoans.length} loans`);

    console.log('\n💰 Loans accessible to agent:');
    agentLoans.forEach(loan => {
      console.log(`${loan.loanApplicationId} - ${loan.clientUserId?.personalInfo?.fullName} - ${loan.loanStatus}`);
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    mongoose.connection.close();
    console.log('\n🔌 Connection closed');
  }
};

fixAgentAssignment();