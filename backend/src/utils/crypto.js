const crypto = require('crypto');

function hashBuffer(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function hashNormalizedRow({ transactionId, referenceNumber, amount, date }) {
  const payload = [transactionId, referenceNumber, Number(amount).toFixed(2), new Date(date).toISOString()].join('|');
  return crypto.createHash('sha256').update(payload).digest('hex');
}

module.exports = {
  hashBuffer,
  hashNormalizedRow,
};
