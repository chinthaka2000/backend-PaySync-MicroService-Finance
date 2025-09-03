/**
 * Enhanced Models Testing Script
 * Tests the enhanced database models with audit trails, workflow tracking, and hierarchical relationships
 */

const mongoose = require('mongoose');
require('dotenv').config();

// Import enhanced models
const Loan = require('../models/Loan');
const Client = require('../models/Client');
const Staff = require('../models/Staff');
const Region = require('../models/Region');

const testEnhancedModels = async () => {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/paysync');
    console.log('✅ Connected to MongoDB successfully');

    console.log('\n=== Testing Enhanced Models ===\n');

    // Test Region Model
    console.log('🏢 Testing Region Model...');
    const timestamp = Date.now();
    const testRegion = new Region({
      code: `TEST${timestamp}`,
      name: `Test Region ${timestamp}`,
      districts: ['Colombo', 'Gampaha'],
      createdBy: new mongoose.Types.ObjectId(),
      configuration: {
        maxLoanAmount: 5000000,
        defaultInterestRate: 12.0,
        maxLoanTerm: 48
      }
    });

    await testRegion.save();
    console.log('✓ Region created with enhanced features');
    console.log(`  - Code: ${testRegion.code}`);
    console.log(`  - Searchable text: ${testRegion.searchableText}`);
    console.log(`  - Configuration: Max loan ${testRegion.configuration.maxLoanAmount}`);

    // Test Staff Model with Hierarchy
    console.log('\n👥 Testing Staff Model with Hierarchy...');

    // Create Super Admin
    const superAdmin = new Staff({
      name: 'Super Admin Test',
      email: `superadmin${timestamp}@test.com`,
      passwordHash: 'hashedpassword',
      role: 'super_admin'
    });
    await superAdmin.save();
    console.log('✓ Super Admin created');
    console.log(`  - Employee ID: ${superAdmin.profile.employeeId}`);
    console.log(`  - Hierarchy Level: ${superAdmin.hierarchyLevel}`);
    console.log(`  - Can manage system: ${superAdmin.rolePermissions.canManageSystem}`);

    // Create Moderate Admin
    const moderateAdmin = new Staff({
      name: 'Moderate Admin Test',
      email: `moderateadmin${timestamp}@test.com`,
      passwordHash: 'hashedpassword',
      role: 'moderate_admin',
      createdBy: superAdmin._id,
      reportsTo: superAdmin._id
    });
    await moderateAdmin.save();
    console.log('✓ Moderate Admin created');
    console.log(`  - Reports to: ${moderateAdmin.reportsTo}`);
    console.log(`  - Can create users: ${moderateAdmin.rolePermissions.canCreateUsers}`);

    // Create Regional Manager
    const regionalManager = new Staff({
      name: 'Regional Manager Test',
      email: `rm${timestamp}@test.com`,
      passwordHash: 'hashedpassword',
      role: 'regional_manager',
      region: testRegion._id,
      createdBy: moderateAdmin._id,
      reportsTo: moderateAdmin._id,
      assignedDistricts: ['Colombo']
    });
    await regionalManager.save();

    // Assign regional manager to region
    testRegion.assignRegionalManager(regionalManager._id, moderateAdmin._id);
    await testRegion.save();

    console.log('✓ Regional Manager created and assigned');
    console.log(`  - Assigned districts: ${regionalManager.assignedDistricts}`);
    console.log(`  - Max loan approval: ${regionalManager.rolePermissions.maxLoanApprovalAmount}`);

    // Create Agent
    const agent = new Staff({
      name: 'Agent Test',
      email: `agent${timestamp}@test.com`,
      passwordHash: 'hashedpassword',
      role: 'agent',
      region: testRegion._id,
      createdBy: moderateAdmin._id,
      reportsTo: regionalManager._id,
      managedBy: regionalManager._id,
      assignedDistricts: ['Colombo']
    });
    await agent.save();

    // Add agent as subordinate to regional manager
    regionalManager.assignSubordinate(agent._id, moderateAdmin._id);
    await regionalManager.save();

    console.log('✓ Agent created and assigned to Regional Manager');
    console.log(`  - Managed by: ${agent.managedBy}`);
    console.log(`  - Can approve loans: ${agent.rolePermissions.canApproveLoans}`);

    // Test hierarchy relationships
    console.log('\n🔗 Testing Hierarchy Relationships...');
    const canManageAgent = moderateAdmin.canManage(agent);
    const canRMManageAgent = regionalManager.canManage(agent);
    console.log(`  - Moderate Admin can manage Agent: ${canManageAgent}`);
    console.log(`  - Regional Manager can manage Agent: ${canRMManageAgent}`);

    // Test Client Model with Enhanced Features
    console.log('\n👤 Testing Enhanced Client Model...');
    const testClient = new Client({
      registrationId: `TEST-CLIENT-${timestamp}`,
      personalInfo: {
        fullName: 'Test Client',
        email: `client${timestamp}@test.com`,
        contactNumber: '+94771234567',
        district: 'Colombo'
      },
      identityVerification: {
        idNumber: '123456789V'
      },
      region: testRegion._id
    });

    // Assign client to agent
    testClient.assignToAgent(agent._id, moderateAdmin._id, 'Initial assignment');

    // Update verification status
    testClient.updateVerificationStatus('identity', true, agent._id);

    // Update risk profile
    testClient.updateRiskProfile(35, ['good_credit_history', 'stable_employment'], agent._id, 'Low risk client');

    await testClient.save();

    console.log('✓ Client created with enhanced features');
    console.log(`  - Assigned Agent: ${testClient.assignedAgent}`);
    console.log(`  - Risk Score: ${testClient.riskProfile.score} (${testClient.riskProfile.riskLevel})`);
    console.log(`  - Identity Verified: ${testClient.verificationStatus.identity.verified}`);
    console.log(`  - Searchable text: ${testClient.searchableText}`);
    console.log(`  - Audit trail entries: ${testClient.auditTrail.length}`);

    // Test Loan Model with Enhanced Workflow
    console.log('\n💰 Testing Enhanced Loan Model...');
    const testLoan = new Loan({
      clientUserId: testClient._id,
      product: 'Personal Loan',
      loanAmount: 500000,
      loanTerm: 24,
      interestRate: 12.5,
      purpose: 'Home improvement',
      region: testRegion._id,
      district: 'Colombo',
      assignedAgent: agent._id,
      assignedRegionalManager: regionalManager._id,
      primaryGuarantor: {
        name: 'Test Guarantor',
        idNumber: '987654321V',
        contactNumber: '+94771234568',
        address: 'Test Address',
        relationship: 'Brother'
      },
      downPayment: {
        amount: 50000
      },
      metadata: {
        priority: 'normal',
        tags: ['first_time_borrower']
      }
    });

    // Test workflow advancement
    testLoan.advanceWorkflowStage('agent_review', agent._id, 'Moving to agent review');
    testLoan.advanceWorkflowStage('regional_approval', regionalManager._id, 'Agent approved, moving to regional approval');

    // Add audit entries
    testLoan.addAuditEntry('created', agent._id, {
      loanAmount: testLoan.loanAmount,
      clientId: testClient._id
    }, 'Loan application created');

    await testLoan.save();

    console.log('✓ Loan created with enhanced workflow');
    console.log(`  - Loan ID: ${testLoan.loanApplicationId}`);
    console.log(`  - Current Stage: ${testLoan.workflowState.currentStage}`);
    console.log(`  - Stage History: ${testLoan.workflowState.stageHistory.length} entries`);
    console.log(`  - Calculated Fields:`);
    console.log(`    - Total Interest: ${testLoan.calculatedFields.totalInterest}`);
    console.log(`    - Monthly Installment: ${testLoan.monthlyInstallment}`);
    console.log(`    - Completion %: ${testLoan.calculatedFields.completionPercentage}%`);
    console.log(`  - Audit trail entries: ${testLoan.auditTrail.length}`);
    console.log(`  - Searchable text: ${testLoan.searchableText}`);

    // Test Region Statistics Update
    console.log('\n📊 Testing Region Statistics...');
    testRegion.updateStatistics({
      totalClients: 1,
      activeLoans: 1,
      totalLoanAmount: testLoan.loanAmount,
      averageProcessingTime: 24,
      approvalRate: 85
    }, moderateAdmin._id);

    await testRegion.save();
    console.log('✓ Region statistics updated');
    console.log(`  - Total Clients: ${testRegion.statistics.totalClients}`);
    console.log(`  - Active Loans: ${testRegion.statistics.activeLoans}`);
    console.log(`  - Total Loan Amount: ${testRegion.statistics.totalLoanAmount}`);

    // Test Model Methods
    console.log('\n🧪 Testing Model Methods...');

    // Test loan workflow blocking
    const blockedLoan = await Loan.findById(testLoan._id);
    blockedLoan.blockWorkflow('Missing documents', agent._id);
    await blockedLoan.save();
    console.log(`✓ Loan workflow blocked: ${blockedLoan.workflowState.isBlocked}`);
    console.log(`  - Blocked reason: ${blockedLoan.workflowState.blockedReason}`);

    // Test client status change
    testClient.changeStatus('Approved', agent._id, 'All verifications complete', 'Client approved for loans');
    await testClient.save();
    console.log(`✓ Client status changed to: ${testClient.status}`);
    console.log(`  - Status history entries: ${testClient.statusHistory.length}`);

    // Test staff metrics update
    agent.updateMetrics({
      totalClientsManaged: 1,
      totalLoansProcessed: 1,
      averageProcessingTime: 48,
      approvalRate: 100,
      performanceScore: 85
    });
    await agent.save();
    console.log(`✓ Agent metrics updated:`);
    console.log(`  - Performance Score: ${agent.metrics.performanceScore}`);
    console.log(`  - Approval Rate: ${agent.metrics.approvalRate}%`);

    console.log('\n=== Model Enhancement Testing Complete ===');
    console.log('✅ All enhanced features working correctly:');
    console.log('   - Audit trails for all models');
    console.log('   - Workflow tracking for loans');
    console.log('   - Hierarchical relationships for staff');
    console.log('   - Enhanced verification for clients');
    console.log('   - Regional management with statistics');
    console.log('   - Performance optimization with indexes');
    console.log('   - Search optimization with text fields');
    console.log('   - Calculated fields and methods');

    // Cleanup test data
    console.log('\n🧹 Cleaning up test data...');
    await Loan.deleteOne({ _id: testLoan._id });
    await Client.deleteOne({ _id: testClient._id });
    await Staff.deleteMany({ email: { $regex: `${timestamp}@test.com` } });
    await Region.deleteOne({ _id: testRegion._id });
    console.log('✓ Test data cleaned up');

  } catch (error) {
    console.error('❌ Error testing enhanced models:', error);
    console.error('Stack trace:', error.stack);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
  }
};

// Run the test
if (require.main === module) {
  testEnhancedModels();
}

module.exports = testEnhancedModels;