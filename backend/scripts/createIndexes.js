/**
 * Database Indexes Creation Script
 * This script creates all necessary indexes for optimal performance
 * Run this script after model updates to ensure indexes are created
 */

const mongoose = require('mongoose');
require('dotenv').config();

// Import models to ensure schemas are registered
require('../models/Loan');
require('../models/Client');
require('../models/Staff');
require('../models/Region');

// Helper function to create index with error handling
const createIndexSafely = async (collection, indexSpec, name) => {
  try {
    await collection.createIndex(indexSpec);
    console.log(`✓ Created index: ${name}`);
  } catch (error) {
    if (error.code === 86) {
      console.log(`⚠ Index ${name} already exists`);
    } else {
      console.log(`❌ Failed to create index ${name}: ${error.message}`);
    }
  }
};

const createIndexes = async () => {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/paysync');
    console.log('Connected to MongoDB successfully');

    const db = mongoose.connection.db;

    console.log('\n=== Creating Loan Collection Indexes ===');

    // Loan indexes
    await db.collection('loans').createIndex({ clientUserId: 1, loanStatus: 1 });
    console.log('✓ Created index: loans.clientUserId_1_loanStatus_1');

    await db.collection('loans').createIndex({ 'agentReview.reviewedBy': 1, createdAt: -1 });
    console.log('✓ Created index: loans.agentReview.reviewedBy_1_createdAt_-1');

    await db.collection('loans').createIndex({ 'regionalAdminApproval.approvedBy': 1, createdAt: -1 });
    console.log('✓ Created index: loans.regionalAdminApproval.approvedBy_1_createdAt_-1');

    await db.collection('loans').createIndex({ region: 1, district: 1, loanStatus: 1 });
    console.log('✓ Created index: loans.region_1_district_1_loanStatus_1');

    await db.collection('loans').createIndex({ 'workflowState.currentStage': 1, createdAt: -1 });
    console.log('✓ Created index: loans.workflowState.currentStage_1_createdAt_-1');

    await db.collection('loans').createIndex({ assignedAgent: 1, loanStatus: 1 });
    console.log('✓ Created index: loans.assignedAgent_1_loanStatus_1');

    await db.collection('loans').createIndex({ assignedRegionalManager: 1, loanStatus: 1 });
    console.log('✓ Created index: loans.assignedRegionalManager_1_loanStatus_1');

    await db.collection('loans').createIndex({ loanAmount: 1, interestRate: 1 });
    console.log('✓ Created index: loans.loanAmount_1_interestRate_1');

    await db.collection('loans').createIndex({ 'calculatedFields.nextPaymentDate': 1, loanStatus: 1 });
    console.log('✓ Created index: loans.calculatedFields.nextPaymentDate_1_loanStatus_1');

    await db.collection('loans').createIndex({ 'calculatedFields.daysOverdue': 1 });
    console.log('✓ Created index: loans.calculatedFields.daysOverdue_1');

    await db.collection('loans').createIndex({ 'metadata.priority': 1, createdAt: -1 });
    console.log('✓ Created index: loans.metadata.priority_1_createdAt_-1');

    await db.collection('loans').createIndex({ createdAt: -1, updatedAt: -1 });
    console.log('✓ Created index: loans.createdAt_-1_updatedAt_-1');

    // Compound indexes for loans
    await db.collection('loans').createIndex({
      region: 1,
      'workflowState.currentStage': 1,
      loanStatus: 1,
      createdAt: -1
    });
    console.log('✓ Created compound index: loans.region_workflowState_loanStatus_createdAt');

    await db.collection('loans').createIndex({
      assignedAgent: 1,
      'workflowState.currentStage': 1,
      loanStatus: 1
    });
    console.log('✓ Created compound index: loans.assignedAgent_workflowState_loanStatus');

    await db.collection('loans').createIndex({
      district: 1,
      loanAmount: 1,
      createdAt: -1
    });
    console.log('✓ Created compound index: loans.district_loanAmount_createdAt');

    // Text index for searchable text
    await db.collection('loans').createIndex({ searchableText: 'text' });
    console.log('✓ Created text index: loans.searchableText');

    console.log('\n=== Creating Client Collection Indexes ===');

    // Client indexes
    await db.collection('clients').createIndex({ 'personalInfo.district': 1, status: 1 });
    console.log('✓ Created index: clients.personalInfo.district_1_status_1');

    await db.collection('clients').createIndex({ assignedAgent: 1, status: 1 });
    console.log('✓ Created index: clients.assignedAgent_1_status_1');

    await db.collection('clients').createIndex({ region: 1, status: 1 });
    console.log('✓ Created index: clients.region_1_status_1');

    await db.collection('clients').createIndex({ 'identityVerification.idNumber': 1 });
    console.log('✓ Created index: clients.identityVerification.idNumber_1');

    await db.collection('clients').createIndex({ 'personalInfo.email': 1 });
    console.log('✓ Created index: clients.personalInfo.email_1');

    await db.collection('clients').createIndex({ 'personalInfo.contactNumber': 1 });
    console.log('✓ Created index: clients.personalInfo.contactNumber_1');

    await db.collection('clients').createIndex({ 'riskProfile.riskLevel': 1, 'riskProfile.score': 1 });
    console.log('✓ Created index: clients.riskProfile.riskLevel_1_score_1');

    await db.collection('clients').createIndex({ createdAt: -1, updatedAt: -1 });
    console.log('✓ Created index: clients.createdAt_-1_updatedAt_-1');

    await db.collection('clients').createIndex({ assignedBy: 1, assignedAt: -1 });
    console.log('✓ Created index: clients.assignedBy_1_assignedAt_-1');

    // Compound indexes for clients
    await db.collection('clients').createIndex({
      assignedAgent: 1,
      status: 1,
      'personalInfo.district': 1
    });
    console.log('✓ Created compound index: clients.assignedAgent_status_district');

    await db.collection('clients').createIndex({
      region: 1,
      'verificationStatus.identity.verified': 1,
      'verificationStatus.employment.verified': 1
    });
    console.log('✓ Created compound index: clients.region_verification_status');

    // Text index for searchable text
    await db.collection('clients').createIndex({ searchableText: 'text' });
    console.log('✓ Created text index: clients.searchableText');

    console.log('\n=== Creating Staff Collection Indexes ===');

    // Staff indexes
    await db.collection('staff').createIndex({ email: 1 });
    console.log('✓ Created index: staff.email_1');

    await db.collection('staff').createIndex({ role: 1 });
    console.log('✓ Created index: staff.role_1');

    await db.collection('staff').createIndex({ createdBy: 1 });
    console.log('✓ Created index: staff.createdBy_1');

    await db.collection('staff').createIndex({ reportsTo: 1 });
    console.log('✓ Created index: staff.reportsTo_1');

    await db.collection('staff').createIndex({ region: 1 });
    console.log('✓ Created index: staff.region_1');

    await db.collection('staff').createIndex({ region: 1, role: 1 });
    console.log('✓ Created index: staff.region_1_role_1');

    await db.collection('staff').createIndex({ role: 1, createdBy: 1 });
    console.log('✓ Created index: staff.role_1_createdBy_1');

    await db.collection('staff').createIndex({ reportsTo: 1, status: 1 });
    console.log('✓ Created index: staff.reportsTo_1_status_1');

    await db.collection('staff').createIndex({ managedBy: 1, role: 1 });
    console.log('✓ Created index: staff.managedBy_1_role_1');

    await db.collection('staff').createIndex({ 'profile.employeeId': 1 });
    console.log('✓ Created index: staff.profile.employeeId_1');

    await db.collection('staff').createIndex({ status: 1, lastActivity: -1 });
    console.log('✓ Created index: staff.status_1_lastActivity_-1');

    await db.collection('staff').createIndex({ createdAt: -1, updatedAt: -1 });
    console.log('✓ Created index: staff.createdAt_-1_updatedAt_-1');

    await db.collection('staff').createIndex({ assignedDistricts: 1, role: 1 });
    console.log('✓ Created index: staff.assignedDistricts_1_role_1');

    // Compound indexes for staff
    await db.collection('staff').createIndex({
      role: 1,
      region: 1,
      status: 1
    });
    console.log('✓ Created compound index: staff.role_region_status');

    await db.collection('staff').createIndex({
      createdBy: 1,
      role: 1,
      createdAt: -1
    });
    console.log('✓ Created compound index: staff.createdBy_role_createdAt');

    console.log('\n=== Creating Region Collection Indexes ===');

    // Region indexes
    try {
      await db.collection('regions').createIndex({ code: 1 });
      console.log('✓ Created index: regions.code_1');
    } catch (error) {
      if (error.code === 86) {
        console.log('⚠ Index regions.code_1 already exists (unique version)');
      } else {
        throw error;
      }
    }

    await db.collection('regions').createIndex({ name: 1 });
    console.log('✓ Created index: regions.name_1');

    await db.collection('regions').createIndex({ districts: 1 });
    console.log('✓ Created index: regions.districts_1');

    await db.collection('regions').createIndex({ regionalManager: 1, status: 1 });
    console.log('✓ Created index: regions.regionalManager_1_status_1');

    await db.collection('regions').createIndex({ createdBy: 1, createdAt: -1 });
    console.log('✓ Created index: regions.createdBy_1_createdAt_-1');

    await db.collection('regions').createIndex({ 'assignedStaff.staff': 1 });
    console.log('✓ Created index: regions.assignedStaff.staff_1');

    await db.collection('regions').createIndex({ 'statistics.totalClients': -1 });
    console.log('✓ Created index: regions.statistics.totalClients_-1');

    await db.collection('regions').createIndex({ 'statistics.activeLoans': -1 });
    console.log('✓ Created index: regions.statistics.activeLoans_-1');

    await db.collection('regions').createIndex({ status: 1 });
    console.log('✓ Created index: regions.status_1');

    // Text index for searchable text
    await db.collection('regions').createIndex({ searchableText: 'text' });
    console.log('✓ Created text index: regions.searchableText');

    console.log('\n=== Index Creation Summary ===');

    // Get index information for each collection
    const collections = ['loans', 'clients', 'staff', 'regions'];

    for (const collectionName of collections) {
      const indexes = await db.collection(collectionName).indexes();
      console.log(`\n${collectionName.toUpperCase()} Collection Indexes (${indexes.length} total):`);
      indexes.forEach((index, i) => {
        const keyStr = Object.keys(index.key).map(k => `${k}:${index.key[k]}`).join(', ');
        console.log(`  ${i + 1}. ${index.name} - {${keyStr}}`);
      });
    }

    console.log('\n✅ All indexes created successfully!');
    console.log('\n📊 Performance Optimization Complete');
    console.log('   - Enhanced query performance for all collections');
    console.log('   - Optimized compound indexes for common query patterns');
    console.log('   - Text search indexes for searchable fields');
    console.log('   - Hierarchical relationship indexes for staff management');
    console.log('   - Regional filtering indexes for data segregation');

  } catch (error) {
    console.error('❌ Error creating indexes:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
    process.exit(0);
  }
};

// Run the script
if (require.main === module) {
  createIndexes();
}

module.exports = createIndexes;