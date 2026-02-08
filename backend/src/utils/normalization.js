function toNumber(value) {
  if (typeof value === 'number') {
    return Number(value.toFixed(2));
  }

  if (typeof value === 'string') {
    const normalized = value.replace(/,/g, '').trim();
    const parsed = Number(normalized);
    if (!Number.isNaN(parsed)) {
      return Number(parsed.toFixed(2));
    }
  }

  return NaN;
}

function toDate(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
}

function normalizeRecord(rawRow, columnMapping, rowNumber) {
  const reverseLookup = {};
  Object.entries(columnMapping || {}).forEach(([inputColumn, targetField]) => {
    reverseLookup[targetField] = inputColumn;
  });

  const transactionId = String(rawRow[reverseLookup.transactionId] ?? '').trim();
  const referenceNumber = String(rawRow[reverseLookup.referenceNumber] ?? '').trim();
  const amount = toNumber(rawRow[reverseLookup.amount]);
  const date = toDate(rawRow[reverseLookup.date]);

  const validationErrors = [];
  if (!transactionId) validationErrors.push('Missing Transaction ID');
  if (!referenceNumber) validationErrors.push('Missing Reference Number');
  if (Number.isNaN(amount)) validationErrors.push('Invalid Amount');
  if (!date) validationErrors.push('Invalid Date');

  return {
    normalized: {
      transactionId,
      referenceNumber,
      amount,
      date,
      rowNumber,
      rawData: rawRow,
    },
    validationErrors,
  };
}

function requiredMappingMissing(columnMapping) {
  const requiredTargets = ['transactionId', 'referenceNumber', 'amount', 'date'];
  const mappedTargets = Object.values(columnMapping || {});
  return requiredTargets.filter((target) => !mappedTargets.includes(target));
}

module.exports = {
  normalizeRecord,
  requiredMappingMissing,
};
