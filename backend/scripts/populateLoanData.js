const mongoose = require('mongoose');
const Loan = require('../models/Loan');
const Client = require('../models/Client');
const Staff = require('../models/Staff');
require('dotenv').config();

// Connect to MongoDB
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/paysync');
    console.log('✅ MongoDB connected successfully');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  }
};

// Sample loan data
const sampleLoans = [
  {
    loanApplicationId: 'L001',
    product: 'Personal Loan',
    loanAmount: 23456,
    loanTerm: 24,
    interestRate: 12.5,
    repaymentFrequency: 'Monthly',
    purpose: 'Home renovation',
    loanStatus: 'Active',
    primaryGuarantor: {
      name: 'Jane Smith',
      idNumber: '123456789V',
      contactNumber: '+94771234568',
      address: 'Colombo',
      relationship: 'Spouse'
    },
    secondaryGuarantor: {
      name: 'Bob Smith',
      idNumber: '987654321V',
      contactNumber: '+94771234569',
      address: 'Kandy',
      relationship: 'Brother'
    },
    downPayment: { amount: 7819, status: 'Verified' },
    agentReview: { status: 'Approved' },
    regionalAdminApproval: { status: 'Approved' }
  },
  {
    loanApplicationId: 'L002',
    product: 'Business Loan',
    loanAmount: 45675,
    loanTerm: 36,
    interestRate: 14.0,
    repaymentFrequency: 'Monthly',
    purpose: 'Business expansion',
    loanStatus: 'Approved',
    primaryGuarantor: {
      name: 'Mike Brown',
      idNumber: '456789123V',
      contactNumber: '+94771234571',
      address: 'Galle',
      relationship: 'Husband'
    },
    secondaryGuarantor: {
      name: 'Lisa Brown',
      idNumber: '789123456V',
      contactNumber: '+94771234572',
      address: 'Matara',
      relationship: 'Sister'
    },
    downPayment: { amount: 15225, status: 'Verified' },
    agentReview: { status: 'Approved' },
    regionalAdminApproval: { status: 'Approved' }
  },
  {
    loanApplicationId: 'L003',
    product: 'Vehicle Loan',
    loanAmount: 12345,
    loanTerm: 60,
    interestRate: 11.5,
    repaymentFrequency: 'Monthly',
    purpose: 'Vehicle purchase',
    loanStatus: 'Rejected',
    primaryGuarantor: {
      name: 'Mary Smith',
      idNumber: '321654987V',
      contactNumber: '+94771234574',
      address: 'Negombo',
      relationship: 'Mother'
    },
    secondaryGuarantor: {
      name: 'Tom Smith',
      idNumber: '654987321V',
      contactNumber: '+94771234575',
      address: 'Kalutara',
      relationship: 'Father'
    },
    downPayment: { amount: 4115, status: 'Pending' },
    agentReview: { status: 'Rejected' },
    regionalAdminApproval: { status: 'Rejected' }
  },
  {
    loanApplicationId: 'L004',
    product: 'Education Loan',
    loanAmount: 43234,
    loanTerm: 48,
    interestRate: 10.0,
    repaymentFrequency: 'Monthly',
    purpose: 'Higher education',
    loanStatus: 'Approved',
    primaryGuarantor: {
      name: 'Sarah Smith',
      idNumber: '147258369V',
      contactNumber: '+94771234577',
      address: 'Anuradhapura',
      relationship: 'Sister'
    },
    secondaryGuarantor: {
      name: 'David Smith',
      idNumber: '369258147V',
      contactNumber: '+94771234578',
      address: 'Polonnaruwa',
      relationship: 'Uncle'
    },
    downPayment: { amount: 14411, status: 'Verified' },
    agentReview: { status: 'Approved' },
    regionalAdminApproval: { status: 'Approved' }
  },
  {
    loanApplicationId: 'L005',
    product: 'Personal Loan',
    loanAmount: 23000,
    loanTerm: 24,
    interestRate: 12.5,
    repaymentFrequency: 'Monthly',
    purpose: 'Personal use',
    loanStatus: 'Rejected',
    primaryGuarantor: {
      name: 'Jane Smith',
      idNumber: '123456789V',
      contactNumber: '+94771234568',
      address: 'Colombo',
      relationship: 'Spouse'
    },
    secondaryGuarantor: {
      name: 'Bob Smith',
      idNumber: '987654321V',
      contactNumber: '+94771234569',
      address: 'Kandy',
      relationship: 'Brother'
    },
    downPayment: { amount: 7819, status: 'Pending' },
    agentReview: { status: 'Rejected' },
    regionalAdminApproval: { status: 'Rejected' }
  },
  {
    loanApplicationId: 'L006',
    product: 'Personal Loan',
    loanAmount: 12000,
    loanTerm: 24,
    interestRate: 12.5,
    repaymentFrequency: 'Monthly',
    purpose: 'Personal use',
    loanStatus: 'Pending',
    primaryGuarantor: {
      name: 'Jane Smith',
      idNumber: '123456789V',
      contactNumber: '+94771234568',
      address: 'Colombo',
      relationship: 'Spouse'
    },
    secondaryGuarantor: {
      name: 'Bob Smith',
      idNumber: '987654321V',
      contactNumber: '+94771234569',
      address: 'Kandy',
      relationship: 'Brother'
    },
    downPayment: { amount: 4000, status: 'Pending' },
    agentReview: { status: 'Pending' },
    regionalAdminApproval: { status: 'Pending' }
  },
  {
    loanApplicationId: 'L007',
    product: 'Home Loan',
    loanAmount: 85000,
    loanTerm: 120,
    interestRate: 8.5,
    repaymentFrequency: 'Monthly',
    purpose: 'Home purchase',
    loanStatus: 'Pending',
    primaryGuarantor: {
      name: 'Michael Johnson',
      idNumber: '555666777V',
      contactNumber: '+94771234582',
      address: 'Kandy',
      relationship: 'Husband'
    },
    secondaryGuarantor: {
      name: 'Sarah Johnson',
      idNumber: '777888999V',
      contactNumber: '+94771234583',
      address: 'Peradeniya',
      relationship: 'Sister-in-law'
    },
    downPayment: { amount: 28333, status: 'Verified' },
    agentReview: { status: 'Pending' },
    regionalAdminApproval: { status: 'Pending' }
  },
  {
    loanApplicationId: 'L008',
    product: 'Business Loan',
    loanAmount: 150000,
    loanTerm: 60,
    interestRate: 15.0,
    repaymentFrequency: 'Monthly',
    purpose: 'Business expansion',
    loanStatus: 'Active',
    primaryGuarantor: {
      name: 'Linda Wilson',
      idNumber: '111222333V',
      contactNumber: '+94771234585',
      address: 'Colombo 07',
      relationship: 'Wife'
    },
    secondaryGuarantor: {
      name: 'Robert Wilson',
      idNumber: '444555666V',
      contactNumber: '+94771234586',
      address: 'Mount Lavinia',
      relationship: 'Brother'
    },
    downPayment: { amount: 50000, status: 'Verified' },
    agentReview: { status: 'Approved' },
    regionalAdminApproval: { status: 'Approved' },
    paymentHistory: [
      {
        paymentId: 'P001',
        amount: 3750,
        paymentDate: new Date('2025-01-01'),
        paymentMethod: 'bank_transfer',
        status: 'Approved'
      }
    ]
  }
];

// Sample client data
const sampleClients = [
  {
    _id: new mongoose.Types.ObjectId('507f1f77bcf86cd799439011'),
    registrationId: 'R001',
    personalInfo: {
      fullName: 'John Smith',
      email: 'john.smith@email.com',
      contactNumber: '+94771234567',
      dateOfBirth: new Date('1990-05-15'),
      address: '123 Main Street, Colombo 03',
      district: 'Colombo'
    },
    identityVerification: {
      idType: 'NIC',
      idNumber: '199012345678',
      verified: true
    },
    employmentDetails: {
      employer: 'ABC Company',
      jobRole: 'Software Engineer',
      monthlyIncome: 75000,
      employmentDuration: '2 years',
      verified: true
    },
    status: 'Approved',
    assignedReviewer: new mongoose.Types.ObjectId('507f1f77bcf86cd799439011')
  },
  {
    _id: new mongoose.Types.ObjectId('507f1f77bcf86cd799439012'),
    registrationId: 'R002',
    personalInfo: {
      fullName: 'Sophia Brown',
      email: 'sophia.brown@email.com',
      contactNumber: '+94771234570',
      dateOfBirth: new Date('1985-08-22'),
      address: '456 Business Avenue, Galle',
      district: 'Galle'
    },
    identityVerification: {
      idType: 'NIC',
      idNumber: '198512345679',
      verified: true
    },
    employmentDetails: {
      employer: 'XYZ Business',
      jobRole: 'Business Owner',
      monthlyIncome: 120000,
      employmentDuration: '5 years',
      verified: true
    },
    status: 'Approved',
    assignedReviewer: new mongoose.Types.ObjectId('507f1f77bcf86cd799439011')
  },
  {
    _id: new mongoose.Types.ObjectId('507f1f77bcf86cd799439013'),
    registrationId: 'R007',
    personalInfo: {
      fullName: 'Emily Johnson',
      email: 'emily.johnson@email.com',
      contactNumber: '+94771234581',
      dateOfBirth: new Date('1992-03-10'),
      address: '789 Hill View, Kandy',
      district: 'Kandy'
    },
    identityVerification: {
      idType: 'NIC',
      idNumber: '199212345680',
      verified: true
    },
    employmentDetails: {
      employer: 'Government Hospital',
      jobRole: 'Nurse',
      monthlyIncome: 65000,
      employmentDuration: '3 years',
      verified: true
    },
    status: 'Approved',
    assignedReviewer: new mongoose.Types.ObjectId('507f1f77bcf86cd799439011')
  },
  {
    _id: new mongoose.Types.ObjectId('507f1f77bcf86cd799439014'),
    registrationId: 'R008',
    personalInfo: {
      fullName: 'David Wilson',
      email: 'david.wilson@email.com',
      contactNumber: '+94771234584',
      dateOfBirth: new Date('1988-11-05'),
      address: '321 Trade Center, Colombo 07',
      district: 'Colombo'
    },
    identityVerification: {
      idType: 'NIC',
      idNumber: '198812345681',
      verified: true
    },
    employmentDetails: {
      employer: 'Wilson Enterprises',
      jobRole: 'Managing Director',
      monthlyIncome: 200000,
      employmentDuration: '8 years',
      verified: true
    },
    status: 'Approved',
    assignedReviewer: new mongoose.Types.ObjectId('507f1f77bcf86cd799439011')
  }
];

const populateData = async () => {
  try {
    console.log('🔄 Starting data population...');

    // Clear existing data
    console.log('🗑️ Clearing existing data...');
    const deletedLoans = await Loan.deleteMany({});
    const deletedClients = await Client.deleteMany({});
    console.log(`🗑️ Deleted ${deletedLoans.deletedCount} loans and ${deletedClients.deletedCount} clients`);

    // Insert sample clients one by one to catch validation errors
    console.log('👥 Inserting clients...');
    const insertedClients = [];

    for (let i = 0; i < sampleClients.length; i++) {
      try {
        const client = new Client(sampleClients[i]);
        const savedClient = await client.save();
        insertedClients.push(savedClient);
        console.log(`✅ Client ${i + 1}: ${savedClient.personalInfo.fullName} (${savedClient.registrationId})`);
      } catch (clientError) {
        console.error(`❌ Error inserting client ${i + 1}:`, clientError.message);
        throw clientError;
      }
    }

    console.log(`✅ Successfully inserted ${insertedClients.length} clients`);

    // Assign client IDs to loans and insert
    console.log('💰 Inserting loans...');
    const insertedLoans = [];

    for (let i = 0; i < sampleLoans.length; i++) {
      try {
        const loanData = {
          ...sampleLoans[i],
          clientUserId: insertedClients[i % insertedClients.length]._id
        };

        const loan = new Loan(loanData);
        const savedLoan = await loan.save();
        insertedLoans.push(savedLoan);
        console.log(`✅ Loan ${i + 1}: ${savedLoan.loanApplicationId} - ${savedLoan.loanStatus}`);
      } catch (loanError) {
        console.error(`❌ Error inserting loan ${i + 1}:`, loanError.message);
        throw loanError;
      }
    }

    console.log(`✅ Successfully inserted ${insertedLoans.length} loans`);

    // Verify the data
    console.log('\n🔍 Verification:');
    const totalClients = await Client.countDocuments();
    const totalLoans = await Loan.countDocuments();
    const agentClients = await Client.find({ assignedReviewer: '507f1f77bcf86cd799439011' });

    console.log(`📊 Final counts:`);
    console.log(`   - Total clients in DB: ${totalClients}`);
    console.log(`   - Total loans in DB: ${totalLoans}`);
    console.log(`   - Clients assigned to test agent: ${agentClients.length}`);

    console.log('\n🎉 Data population completed successfully!');
    console.log(`🔑 Agent ID for testing: 507f1f77bcf86cd799439011`);

  } catch (error) {
    console.error('❌ Error populating data:', error);
    console.error('Stack trace:', error.stack);
  } finally {
    mongoose.connection.close();
  }
};

// Run the script
connectDB().then(() => {
  populateData();
});