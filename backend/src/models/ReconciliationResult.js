const mongoose = require('mongoose');

const differenceSchema = new mongoose.Schema(
  {
    field: { type: String, required: true },
    uploadedValue: { type: mongoose.Schema.Types.Mixed, default: null },
    systemValue: { type: mongoose.Schema.Types.Mixed, default: null },
  },
  { _id: false }
);

const reconciliationResultSchema = new mongoose.Schema(
  {
    uploadJobId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'UploadJob',
      required: true,
      index: true,
    },
    uploadedRecordId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Record',
      required: true,
    },
    matchedSystemRecordId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Record',
      default: null,
    },
    status: {
      type: String,
      enum: ['matched', 'partially_matched', 'not_matched', 'duplicate'],
      required: true,
      index: true,
    },
    confidence: {
      type: Number,
      default: 0,
    },
    amountVariancePercent: {
      type: Number,
      default: null,
    },
    differences: {
      type: [differenceSchema],
      default: [],
    },
    manuallyCorrected: {
      type: Boolean,
      default: false,
    },
    correctedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    correctedAt: {
      type: Date,
      default: null,
    },
    correctionNotes: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

reconciliationResultSchema.index({ uploadJobId: 1, status: 1 });
reconciliationResultSchema.index({ uploadedRecordId: 1 }, { unique: true });

module.exports = mongoose.model('ReconciliationResult', reconciliationResultSchema);
