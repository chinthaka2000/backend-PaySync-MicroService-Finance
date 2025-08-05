const mongoose = require('mongoose');
const Loan = require('../models/Loan');
const Client = require('../models/Client');
require('dotenv').config();

const testConnection = async () => {
  try {
    console.log('🔄 Testing database connection...');

    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/paysync');
    console.log('✅ MongoDB connected successfully');

    // Test data retrieval
    const clientCount = await Client.countDocuments();
    const loanCount = await Loan.countDocuments();

    console.log(`📊 Database Status:`);
    console.log(`   - Clients: ${clientCount}`);
    console.log(`   - Loans: ${loanCount}`);

    if (clientCount === 0 || loanCount === 0) {
      console.log('⚠️  No data found. Run: node scripts/populateLoanData.js');
    } else {
      console.log('✅ Database has data and is working correctly!');

      // Test a sample query
      const sampleLoan = await Loan.findOne().populate('clientUserId');
      if (sampleLoan) {
        console.log(`📝 Sample loan: ${sampleLoan.loanApplicationId} - ${sampleLoan.clientUserId?.personalInfo?.fullName}`);
      }
    }

  } catch (error) {
    console.error('❌ Database connection error:', error.message);
  } finally {
    mongoose.connection.close();
    console.log('🔌 Connection closed');
  }
};

testConnection();