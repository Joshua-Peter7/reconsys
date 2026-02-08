const Record = require('../models/Record');
const ReconciliationResult = require('../models/ReconciliationResult');
const AuditLog = require('../models/AuditLog');

function normalizeKeyValue(value) {
  if (typeof value === 'number') {
    return value.toFixed(2);
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  return String(value ?? '').trim();
}

function compositeKey(record, fields) {
  return fields.map((field) => normalizeKeyValue(record[field])).join('|');
}

function sameDay(leftDate, rightDate) {
  if (!leftDate || !rightDate) {
    return false;
  }

  const left = new Date(leftDate).toISOString().slice(0, 10);
  const right = new Date(rightDate).toISOString().slice(0, 10);
  return left === right;
}

function buildDifferences(uploadedRecord, systemRecord) {
  if (!systemRecord) {
    return [
      {
        field: 'systemRecord',
        uploadedValue: uploadedRecord.transactionId,
        systemValue: null,
      },
    ];
  }

  const differences = [];

  if (uploadedRecord.transactionId !== systemRecord.transactionId) {
    differences.push({
      field: 'transactionId',
      uploadedValue: uploadedRecord.transactionId,
      systemValue: systemRecord.transactionId,
    });
  }

  if (uploadedRecord.referenceNumber !== systemRecord.referenceNumber) {
    differences.push({
      field: 'referenceNumber',
      uploadedValue: uploadedRecord.referenceNumber,
      systemValue: systemRecord.referenceNumber,
    });
  }

  if (Number(uploadedRecord.amount) !== Number(systemRecord.amount)) {
    differences.push({
      field: 'amount',
      uploadedValue: uploadedRecord.amount,
      systemValue: systemRecord.amount,
    });
  }

  if (!sameDay(uploadedRecord.date, systemRecord.date)) {
    differences.push({
      field: 'date',
      uploadedValue: uploadedRecord.date,
      systemValue: systemRecord.date,
    });
  }

  return differences;
}

function buildStats(results) {
  const totals = {
    total: results.length,
    matched: 0,
    partiallyMatched: 0,
    notMatched: 0,
    duplicates: 0,
    accuracy: 0,
  };

  results.forEach((result) => {
    if (result.status === 'matched') totals.matched += 1;
    if (result.status === 'partially_matched') totals.partiallyMatched += 1;
    if (result.status === 'not_matched') totals.notMatched += 1;
    if (result.status === 'duplicate') totals.duplicates += 1;
  });

  if (totals.total > 0) {
    totals.accuracy = Number((((totals.matched + totals.partiallyMatched) / totals.total) * 100).toFixed(2));
  }

  return totals;
}

function resolveConfig(config, envVariance) {
  const allowedFields = ['transactionId', 'referenceNumber', 'amount', 'date'];
  const requestedExactFields = Array.isArray(config?.exact?.fields) ? config.exact.fields : [];
  const safeExactFields = requestedExactFields.filter((field) => allowedFields.includes(field));
  const parsedEnvVariance = Number(envVariance);
  const varianceFromEnv = Number.isFinite(parsedEnvVariance) ? parsedEnvVariance : 2;

  return {
    exact: {
      fields: safeExactFields.length ? safeExactFields : ['transactionId', 'amount'],
    },
    partial: {
      referenceField: config?.partial?.referenceField || 'referenceNumber',
      amountField: config?.partial?.amountField || 'amount',
      variancePercent: Number.isFinite(Number(config?.partial?.variancePercent))
        ? Number(config.partial.variancePercent)
        : varianceFromEnv,
    },
    duplicate: {
      keyField: config?.duplicate?.keyField || 'transactionId',
    },
  };
}

async function runReconciliation({ uploadJobId, actorUserId, matchingConfig, clearExisting = true }) {
  const config = resolveConfig(matchingConfig, process.env.DEFAULT_VARIANCE_PERCENT);

  const [uploadedRecords, systemRecords] = await Promise.all([
    Record.find({ uploadJobId, sourceType: 'uploaded', active: true }).lean(),
    Record.find({ sourceType: 'system', active: true }).lean(),
  ]);

  const duplicateCounter = new Map();
  uploadedRecords.forEach((record) => {
    const keyValue = record[config.duplicate.keyField] || '';
    duplicateCounter.set(keyValue, (duplicateCounter.get(keyValue) || 0) + 1);
  });

  const exactMap = new Map();
  const partialMap = new Map();

  systemRecords.forEach((record) => {
    const txnKey = compositeKey(record, config.exact.fields);
    exactMap.set(txnKey, record);

    const refKey = record.referenceNumber;
    if (!partialMap.has(refKey)) {
      partialMap.set(refKey, []);
    }
    partialMap.get(refKey).push(record);
  });

  if (clearExisting) {
    await ReconciliationResult.deleteMany({ uploadJobId });
  }

  const resultDocs = [];

  uploadedRecords.forEach((uploaded) => {
    const duplicateKey = uploaded[config.duplicate.keyField] || '';
    const duplicateCount = duplicateCounter.get(duplicateKey) || 0;

    if (duplicateKey && duplicateCount > 1) {
      resultDocs.push({
        uploadJobId,
        uploadedRecordId: uploaded._id,
        matchedSystemRecordId: null,
        status: 'duplicate',
        confidence: 0,
        amountVariancePercent: null,
        differences: buildDifferences(uploaded, null),
      });
      return;
    }

    const exactKey = compositeKey(uploaded, config.exact.fields);
    const exactMatch = exactMap.get(exactKey);

    if (exactMatch) {
      resultDocs.push({
        uploadJobId,
        uploadedRecordId: uploaded._id,
        matchedSystemRecordId: exactMatch._id,
        status: 'matched',
        confidence: 100,
        amountVariancePercent: 0,
        differences: buildDifferences(uploaded, exactMatch),
      });
      return;
    }

    const partialCandidates = partialMap.get(uploaded[config.partial.referenceField]) || [];
    const threshold = Number(config.partial.variancePercent);
    let bestCandidate = null;
    let bestVariance = Number.POSITIVE_INFINITY;

    partialCandidates.forEach((candidate) => {
      const candidateAmount = Number(candidate[config.partial.amountField]);
      if (!Number.isFinite(candidateAmount) || candidateAmount === 0) {
        return;
      }

      const variance = Math.abs(((uploaded.amount - candidateAmount) / candidateAmount) * 100);
      if (variance <= threshold && variance < bestVariance) {
        bestVariance = variance;
        bestCandidate = candidate;
      }
    });

    if (bestCandidate) {
      resultDocs.push({
        uploadJobId,
        uploadedRecordId: uploaded._id,
        matchedSystemRecordId: bestCandidate._id,
        status: 'partially_matched',
        confidence: 75,
        amountVariancePercent: Number(bestVariance.toFixed(4)),
        differences: buildDifferences(uploaded, bestCandidate),
      });
      return;
    }

    resultDocs.push({
      uploadJobId,
      uploadedRecordId: uploaded._id,
      matchedSystemRecordId: null,
      status: 'not_matched',
      confidence: 0,
      amountVariancePercent: null,
      differences: buildDifferences(uploaded, null),
    });
  });

  const inserted = resultDocs.length ? await ReconciliationResult.insertMany(resultDocs, { ordered: false }) : [];

  if (actorUserId && inserted.length) {
    const auditDocs = inserted.map((result) => ({
      recordId: result.uploadedRecordId,
      uploadJobId,
      action: 'reconciliation_evaluated',
      source: 'system',
      changedBy: actorUserId,
      changes: [
        {
          field: 'status',
          oldValue: null,
          newValue: result.status,
        },
      ],
      metadata: {
        confidence: result.confidence,
        amountVariancePercent: result.amountVariancePercent,
      },
    }));

    for (let index = 0; index < auditDocs.length; index += 1000) {
      const chunk = auditDocs.slice(index, index + 1000);
      if (chunk.length) {
        await AuditLog.insertMany(chunk, { ordered: false });
      }
    }
  }

  return {
    config,
    stats: buildStats(inserted),
  };
}

module.exports = {
  runReconciliation,
  buildStats,
};
