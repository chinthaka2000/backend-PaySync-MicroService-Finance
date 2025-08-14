const mongoose = require('mongoose');

console.log('🆔 MONGODB OBJECTID EXPLAINED');
console.log('===============================\n');

// Create a new ObjectId
const objectId = new mongoose.Types.ObjectId();
console.log('📝 New ObjectId:', objectId.toString());
console.log('📝 Length:', objectId.toString().length, 'characters');

// Break down the ObjectId
const hexString = objectId.toString();
const timestamp = hexString.substring(0, 8);
const machineId = hexString.substring(8, 14);
const processId = hexString.substring(14, 18);
const counter = hexString.substring(18, 24);

console.log('\n🔍 BREAKDOWN:');
console.log('├─ Timestamp (8 chars):', timestamp);
console.log('├─ Machine ID (6 chars):', machineId);
console.log('├─ Process ID (4 chars):', processId);
console.log('└─ Counter (6 chars):', counter);

// Convert timestamp to readable date
const timestampInt = parseInt(timestamp, 16);
const date = new Date(timestampInt * 1000);
console.log('\n📅 TIMESTAMP DECODED:');
console.log('├─ Hex:', timestamp);
console.log('├─ Decimal:', timestampInt);
console.log('└─ Date:', date.toISOString());

console.log('\n🎯 KEY FEATURES:');
console.log('✅ Unique across all machines and processes');
console.log('✅ Contains creation timestamp');
console.log('✅ Sortable by creation time');
console.log('✅ No central coordination needed');
console.log('✅ 12 bytes = 24 hex characters');

console.log('\n🔄 CREATION METHODS:');

// Method 1: Automatic (MongoDB creates)
console.log('\n1️⃣ AUTOMATIC (MongoDB creates when saving):');
console.log('   const user = new User({ name: "John" });');
console.log('   await user.save(); // MongoDB auto-generates _id');

// Method 2: Manual creation
console.log('\n2️⃣ MANUAL CREATION:');
const manualId = new mongoose.Types.ObjectId();
console.log('   const id = new mongoose.Types.ObjectId();');
console.log('   Result:', manualId.toString());

// Method 3: From string
console.log('\n3️⃣ FROM STRING:');
const fromString = new mongoose.Types.ObjectId('64d3f40e2e3f4a2d12345678');
console.log('   const id = new mongoose.Types.ObjectId("64d3f40e2e3f4a2d12345678");');
console.log('   Result:', fromString.toString());

// Method 4: Multiple IDs
console.log('\n4️⃣ MULTIPLE IDs (notice they\'re sequential):');
for (let i = 0; i < 3; i++) {
  const id = new mongoose.Types.ObjectId();
  console.log(`   ID ${i + 1}:`, id.toString());
}

console.log('\n⚡ PERFORMANCE BENEFITS:');
console.log('├─ Fast generation (no database lookup)');
console.log('├─ Distributed system friendly');
console.log('├─ Built-in indexing optimization');
console.log('└─ Natural sorting by creation time');

console.log('\n🚫 COMMON MISTAKES:');
console.log('❌ Using strings like "1", "2", "user1" as ObjectIds');
console.log('❌ Not validating ObjectId format before queries');
console.log('❌ Comparing ObjectIds as strings without conversion');

console.log('\n✅ CORRECT USAGE:');
console.log('// Validation');
console.log('if (mongoose.Types.ObjectId.isValid(id)) {');
console.log('  // Safe to use');
console.log('}');
console.log('');
console.log('// Comparison');
console.log('if (user._id.equals(otherId)) {');
console.log('  // Correct comparison');
console.log('}');

console.log('\n🔍 YOUR TEST DATA IDs:');
console.log('Staff ID: 64d3f40e2e3f4a2d1234567a (manually created)');
console.log('Client IDs: 689dbc34c39667f2abd1f790 (auto-generated)');
console.log('           689dbc35c39667f2abd1f799 (auto-generated)');

// Demonstrate the timestamp extraction from your actual IDs
const yourStaffId = '64d3f40e2e3f4a2d1234567a';
const yourClientId = '689dbc34c39667f2abd1f790';

console.log('\n📊 YOUR IDs DECODED:');
console.log('Staff ID timestamp:', yourStaffId.substring(0, 8));
console.log('Staff ID date:', new Date(parseInt(yourStaffId.substring(0, 8), 16) * 1000).toISOString());
console.log('Client ID timestamp:', yourClientId.substring(0, 8));
console.log('Client ID date:', new Date(parseInt(yourClientId.substring(0, 8), 16) * 1000).toISOString());

console.log('\n🎉 That\'s how MongoDB ObjectIds work!');