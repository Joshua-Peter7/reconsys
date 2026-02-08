const mongoose = require('mongoose');

const recordSchema = new mongoose.Schema(
  {
    uploadJobId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'UploadJob',
      required: true,
      index: true,
    },
    sourceType: {
      type: String,
      enum: ['uploaded', 'system'],
      required: true,
      index: true,
    },
    transactionId: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    referenceNumber: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    amount: {
      type: Number,
      required: true,
    },
    date: {
      type: Date,
      required: true,
      index: true,
    },
    rowNumber: {
      type: Number,
      required: true,
    },
    rawData: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    normalizedHash: {
      type: String,
      required: true,
      index: true,
    },
    active: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

recordSchema.index({ transactionId: 1, sourceType: 1, active: 1 });
recordSchema.index({ referenceNumber: 1, sourceType: 1, active: 1 });
recordSchema.index({ uploadJobId: 1, sourceType: 1 });
recordSchema.index({ normalizedHash: 1, sourceType: 1 });

module.exports = mongoose.model('Record', recordSchema);
