require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');
const { connectDatabase } = require('../src/config/database');
const Record = require('../src/models/Record');
const UploadJob = require('../src/models/UploadJob');
const User = require('../src/models/User');
const { hashBuffer, hashNormalizedRow } = require('../src/utils/crypto');

async function seedSystemRecords() {
  await connectDatabase(process.env.MONGO_URI);

  const admin = await User.findOne({ role: 'admin' }).sort({ createdAt: 1 });
  if (!admin) {
    throw new Error('No admin user found. Run npm run seed first.');
  }

  const filePath = path.join(__dirname, '..', '..', 'sample-data', 'sample_system_records.csv');
  const fileBuffer = fs.readFileSync(filePath);
  const rows = parse(fileBuffer, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  });

  const fileHash = hashBuffer(fileBuffer);
  const existing = await UploadJob.findOne({ fileHash, uploadType: 'system' });

  if (existing) {
    // eslint-disable-next-line no-console
    console.log(`System seed already exists in job ${existing._id}`);
    process.exit(0);
  }

  await Record.updateMany({ sourceType: 'system', active: true }, { $set: { active: false } });

  const job = await UploadJob.create({
    fileName: 'sample_system_records.csv',
    fileHash,
    uploadedBy: admin._id,
    uploadType: 'system',
    status: 'completed',
    rowCount: rows.length,
    processedRows: rows.length,
    failedRows: 0,
    columnMapping: {
      'Transaction ID': 'transactionId',
      'Reference Number': 'referenceNumber',
      Amount: 'amount',
      Date: 'date',
    },
    startedAt: new Date(),
    completedAt: new Date(),
  });

  const docs = rows.map((row, index) => {
    const normalized = {
      transactionId: String(row['Transaction ID']).trim(),
      referenceNumber: String(row['Reference Number']).trim(),
      amount: Number(Number(row.Amount).toFixed(2)),
      date: new Date(row.Date),
      rowNumber: index + 2,
      rawData: row,
    };

    return {
      uploadJobId: job._id,
      sourceType: 'system',
      ...normalized,
      normalizedHash: hashNormalizedRow(normalized),
      active: true,
    };
  });

  await Record.insertMany(docs, { ordered: false });

  // eslint-disable-next-line no-console
  console.log(`Seeded ${docs.length} system records under job ${job._id}`);
  process.exit(0);
}

seedSystemRecords().catch((error) => {
  // eslint-disable-next-line no-console
  console.error(error);
  process.exit(1);
});
