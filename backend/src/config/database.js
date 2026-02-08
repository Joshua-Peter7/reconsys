const mongoose = require('mongoose');

async function dropLegacyReconciliationIndexes() {
  const collection = mongoose.connection.collection('reconciliationresults');

  try {
    const indexes = await collection.indexes();
    const hasLegacyRecordIdIndex = indexes.some((index) => index.name === 'recordId_1');

    if (hasLegacyRecordIdIndex) {
      await collection.dropIndex('recordId_1');
      // eslint-disable-next-line no-console
      console.log('Dropped legacy reconciliationresults.recordId_1 index.');
    }
  } catch (error) {
    if (error?.codeName === 'NamespaceNotFound') {
      return;
    }
    throw error;
  }
}

async function connectDatabase(uri) {
  if (!uri) {
    throw new Error('MONGO_URI is required.');
  }

  if (!uri.startsWith('mongodb+srv://')) {
    throw new Error('MongoDB Atlas SRV URI is required. Use mongodb+srv://...');
  }

  mongoose.set('strictQuery', true);
  await mongoose.connect(uri);
  await dropLegacyReconciliationIndexes();
}

module.exports = { connectDatabase };
