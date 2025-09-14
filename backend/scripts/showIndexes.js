/**
 * Show Database Indexes Script
 * This script shows all existing indexes for the enhanced models
 */

const mongoose = require('mongoose');
require('dotenv').config();

const showIndexes = async () => {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/paysync');
    console.log('✅ Connected to MongoDB successfully');

    const db = mongoose.connection.db;
    const collections = ['loans', 'clients', 'staff', 'regions'];

    console.log('\n=== Database Indexes Summary ===\n');

    for (const collectionName of collections) {
      try {
        const indexes = await db.collection(collectionName).indexes();
        console.log(`📊 ${collectionName.toUpperCase()} Collection (${indexes.length} indexes):`);

        indexes.forEach((index, i) => {
          const keyStr = Object.keys(index.key).map(k => {
            if (index.key[k] === 'text') return `${k}:text`;
            return `${k}:${index.key[k]}`;
          }).join(', ');

          const unique = index.unique ? ' [UNIQUE]' : '';
          const sparse = index.sparse ? ' [SPARSE]' : '';
          const text = index.textIndexVersion ? ' [TEXT]' : '';

          console.log(`  ${i + 1}. ${index.name}${unique}${sparse}${text}`);
          console.log(`     Keys: {${keyStr}}`);
        });
        console.log('');
      } catch (error) {
        console.log(`❌ Error getting indexes for ${collectionName}: ${error.message}\n`);
      }
    }

    // Show collection statistics
    console.log('=== Collection Statistics ===\n');
    for (const collectionName of collections) {
      try {
        const stats = await db.collection(collectionName).stats();
        console.log(`📈 ${collectionName.toUpperCase()}:`);
        console.log(`   Documents: ${stats.count}`);
        console.log(`   Size: ${(stats.size / 1024).toFixed(2)} KB`);
        console.log(`   Indexes: ${stats.nindexes}`);
        console.log(`   Index Size: ${(stats.totalIndexSize / 1024).toFixed(2)} KB`);
        console.log('');
      } catch (error) {
        console.log(`❌ Error getting stats for ${collectionName}: ${error.message}\n`);
      }
    }

    console.log('✅ Index summary complete!');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
};

// Run the script
if (require.main === module) {
  showIndexes();
}

module.exports = showIndexes;