const AuditLog = require('../models/AuditLog');

async function createAuditLog({
  recordId,
  uploadJobId,
  action,
  source,
  changedBy,
  changes = [],
  metadata = {},
  session,
}) {
  if (!recordId || !uploadJobId || !action || !source || !changedBy) {
    return null;
  }

  const created = await AuditLog.create(
    [
      {
        recordId,
        uploadJobId,
        action,
        source,
        changedBy,
        changes,
        metadata,
      },
    ],
    session ? { session } : {}
  );

  return created[0];
}

module.exports = {
  createAuditLog,
};
