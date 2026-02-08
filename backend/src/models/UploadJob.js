const mongoose = require('mongoose');

const uploadJobSchema = new mongoose.Schema(
  {
    fileName: {
      type: String,
      required: true,
      trim: true,
    },
    fileHash: {
      type: String,
      required: true,
      index: true,
    },
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    uploadType: {
      type: String,
      enum: ['transaction', 'system'],
      default: 'transaction',
      index: true,
    },
    status: {
      type: String,
      enum: ['processing', 'completed', 'failed'],
      default: 'processing',
      index: true,
    },
    rowCount: {
      type: Number,
      default: 0,
    },
    processedRows: {
      type: Number,
      default: 0,
    },
    failedRows: {
      type: Number,
      default: 0,
    },
    columnMapping: {
      type: Map,
      of: String,
      default: {},
    },
    matchingConfig: {
      exact: {
        fields: {
          type: [String],
          default: ['transactionId', 'amount'],
        },
      },
      partial: {
        referenceField: {
          type: String,
          default: 'referenceNumber',
        },
        amountField: {
          type: String,
          default: 'amount',
        },
        variancePercent: {
          type: Number,
          default: 2,
        },
      },
      duplicate: {
        keyField: {
          type: String,
          default: 'transactionId',
        },
      },
    },
    errorMessage: {
      type: String,
      default: null,
    },
    reusedFromJobId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'UploadJob',
      default: null,
    },
    startedAt: {
      type: Date,
      default: Date.now,
    },
    completedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

uploadJobSchema.index({ fileHash: 1, uploadType: 1 });
uploadJobSchema.index({ uploadType: 1, createdAt: -1 });

module.exports = mongoose.model('UploadJob', uploadJobSchema);
