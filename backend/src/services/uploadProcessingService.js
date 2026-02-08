const UploadJob = require('../models/UploadJob');
const Record = require('../models/Record');
const { parseFileBuffer } = require('./fileService');
const { normalizeRecord } = require('../utils/normalization');
const { hashBuffer, hashNormalizedRow } = require('../utils/crypto');
const { runReconciliation } = require('./reconciliationService');

const inMemoryQueue = new Set();

function getInsertedCountFromBulkError(error) {
  if (Array.isArray(error?.insertedDocs)) {
    return error.insertedDocs.length;
  }

  if (typeof error?.result?.nInserted === 'number') {
    return error.result.nInserted;
  }

  if (typeof error?.result?.result?.nInserted === 'number') {
    return error.result.result.nInserted;
  }

  return 0;
}

async function insertInBatches(docs, batchSize = 1000) {
  let insertedCount = 0;
  let failedCount = 0;

  for (let index = 0; index < docs.length; index += batchSize) {
    const chunk = docs.slice(index, index + batchSize);
    if (!chunk.length) {
      continue;
    }

    try {
      const inserted = await Record.insertMany(chunk, {
        ordered: false,
      });
      insertedCount += inserted.length;
    } catch (error) {
      const insertedFromError = getInsertedCountFromBulkError(error);
      const writeErrors = Array.isArray(error?.writeErrors) ? error.writeErrors.length : 0;

      if (writeErrors > 0 || insertedFromError > 0) {
        insertedCount += insertedFromError;
        failedCount += writeErrors > 0 ? writeErrors : Math.max(chunk.length - insertedFromError, 0);
        continue;
      }

      throw error;
    }
  }

  return { insertedCount, failedCount };
}

async function processUploadJob({ jobId, file, actorUserId }) {
  const job = await UploadJob.findById(jobId);
  if (!job || inMemoryQueue.has(String(jobId))) {
    return;
  }

  inMemoryQueue.add(String(jobId));

  try {
    const rows = await parseFileBuffer(file);
    const maxRows = Number(process.env.MAX_UPLOAD_ROWS || 50000);

    job.rowCount = rows.length;
    await job.save();

    if (rows.length > maxRows) {
      throw new Error(`Upload exceeds row limit (${maxRows}). Split the file and retry.`);
    }

    if (job.uploadType === 'system') {
      await Record.updateMany(
        { sourceType: 'system', active: true },
        {
          $set: { active: false },
        }
      );
    }

    const validDocs = [];
    let failedRows = 0;

    const mappingObject =
      job.columnMapping instanceof Map
        ? Object.fromEntries(job.columnMapping.entries())
        : typeof job.columnMapping?.toJSON === 'function'
          ? job.columnMapping.toJSON()
          : { ...(job.columnMapping || {}) };

    rows.forEach((row, rowIndex) => {
      const { normalized, validationErrors } = normalizeRecord(row, mappingObject, rowIndex + 2);

      if (validationErrors.length) {
        failedRows += 1;
        return;
      }

      validDocs.push({
        uploadJobId: job._id,
        sourceType: job.uploadType === 'system' ? 'system' : 'uploaded',
        transactionId: normalized.transactionId,
        referenceNumber: normalized.referenceNumber,
        amount: normalized.amount,
        date: normalized.date,
        rowNumber: normalized.rowNumber,
        rawData: normalized.rawData,
        normalizedHash: hashNormalizedRow(normalized),
      });
    });

    const { insertedCount, failedCount } = await insertInBatches(validDocs);

    job.processedRows = insertedCount;
    job.failedRows = failedRows + failedCount;

    if (job.uploadType === 'transaction' && insertedCount > 0) {
      await runReconciliation({
        uploadJobId: job._id,
        actorUserId,
        matchingConfig: job.matchingConfig,
      });
    }

    if (insertedCount === 0 && rows.length > 0) {
      job.status = 'failed';
      job.errorMessage =
        'No valid rows were imported. Verify column mapping and data format (Transaction ID, Reference Number, Amount, Date).';
      job.completedAt = new Date();
      await job.save();
      return;
    }

    job.status = 'completed';
    job.completedAt = new Date();
    job.errorMessage = null;
    await job.save();
  } catch (error) {
    job.status = 'failed';
    job.errorMessage = error.message;
    job.completedAt = new Date();
    await job.save();
  } finally {
    inMemoryQueue.delete(String(jobId));
  }
}

function scheduleUploadJob(payload) {
  setImmediate(() => {
    processUploadJob(payload).catch(() => {
      // Errors are persisted to job status in processUploadJob.
    });
  });
}

async function createUploadJob({ file, uploadedBy, columnMapping, uploadType = 'transaction', matchingConfig }) {
  const fileHash = hashBuffer(file.buffer);

  const existing = await UploadJob.findOne({
    fileHash,
    uploadType,
    status: { $in: ['processing', 'completed'] },
  }).sort({ createdAt: -1 });
  if (existing && existing.status !== 'failed') {
    return {
      reused: true,
      job: existing,
    };
  }

  const job = await UploadJob.create({
    fileName: file.originalname,
    fileHash,
    uploadedBy,
    uploadType,
    status: 'processing',
    columnMapping,
    matchingConfig,
    startedAt: new Date(),
  });

  return {
    reused: false,
    job,
  };
}

module.exports = {
  createUploadJob,
  scheduleUploadJob,
};
