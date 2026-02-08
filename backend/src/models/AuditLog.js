const mongoose = require('mongoose');

const changeSchema = new mongoose.Schema(
  {
    field: { type: String, required: true },
    oldValue: { type: mongoose.Schema.Types.Mixed, default: null },
    newValue: { type: mongoose.Schema.Types.Mixed, default: null },
  },
  { _id: false }
);

const auditLogSchema = new mongoose.Schema(
  {
    recordId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Record',
      required: true,
      index: true,
    },
    uploadJobId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'UploadJob',
      required: true,
      index: true,
    },
    action: {
      type: String,
      required: true,
      trim: true,
    },
    source: {
      type: String,
      enum: ['system', 'manual', 'import'],
      required: true,
      index: true,
    },
    changedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    changes: {
      type: [changeSchema],
      default: [],
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

auditLogSchema.pre('updateOne', function rejectUpdate(next) {
  next(new Error('Audit logs are immutable and cannot be updated.'));
});

auditLogSchema.pre('findOneAndUpdate', function rejectFindUpdate(next) {
  next(new Error('Audit logs are immutable and cannot be updated.'));
});

auditLogSchema.pre('deleteOne', function rejectDelete(next) {
  next(new Error('Audit logs are immutable and cannot be deleted.'));
});

auditLogSchema.pre('findOneAndDelete', function rejectFindDelete(next) {
  next(new Error('Audit logs are immutable and cannot be deleted.'));
});

module.exports = mongoose.model('AuditLog', auditLogSchema);
