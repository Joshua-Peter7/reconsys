const mongoose = require('mongoose');
const UploadJob = require('../models/UploadJob');
const Record = require('../models/Record');
const ReconciliationResult = require('../models/ReconciliationResult');
const { runReconciliation, buildStats } = require('../services/reconciliationService');
const { createAuditLog } = require('../services/auditService');

async function triggerReconciliation(req, res, next) {
  try {
    const { uploadJobId, matchingConfig } = req.body;

    if (!uploadJobId) {
      return res.status(400).json({ message: 'uploadJobId is required.' });
    }

    const job = await UploadJob.findById(uploadJobId);
    if (!job) {
      return res.status(404).json({ message: 'Upload job not found.' });
    }

    if (job.uploadType !== 'transaction') {
      return res.status(400).json({ message: 'Reconciliation is only valid for transaction uploads.' });
    }

    if (req.user.role !== 'admin' && String(job.uploadedBy) !== String(req.user._id)) {
      return res.status(403).json({ message: 'Forbidden for this upload job.' });
    }

    if (matchingConfig) {
      job.matchingConfig = matchingConfig;
      await job.save();
    }

    const payload = await runReconciliation({
      uploadJobId,
      actorUserId: req.user._id,
      matchingConfig: job.matchingConfig,
      clearExisting: true,
    });

    if (job.status !== 'completed') {
      job.status = 'completed';
      job.errorMessage = null;
      job.completedAt = new Date();
      await job.save();
    }

    return res.json({
      message: 'Reconciliation completed.',
      config: payload.config,
      stats: payload.stats,
    });
  } catch (error) {
    return next(error);
  }
}

async function getResults(req, res, next) {
  try {
    const filters = {};

    if (req.query.uploadJobId) {
      filters.uploadJobId = req.query.uploadJobId;
    }

    if (req.query.status) {
      filters.status = req.query.status;
    }

    if (req.user.role !== 'admin') {
      const userJobIds = await UploadJob.find({ uploadedBy: req.user._id }).select('_id').lean();
      const allowedIds = userJobIds.map((job) => job._id);
      filters.uploadJobId = req.query.uploadJobId
        ? req.query.uploadJobId
        : {
            $in: allowedIds,
          };
    }

    const limit = Math.min(Number(req.query.limit) || 100, 500);
    const skip = Math.max(Number(req.query.skip) || 0, 0);

    const results = await ReconciliationResult.find(filters)
      .populate('uploadedRecordId')
      .populate('matchedSystemRecordId')
      .populate('correctedBy', 'fullName email role')
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip(skip);

    if (req.query.uploadJobId && req.user.role !== 'admin') {
      const job = await UploadJob.findById(req.query.uploadJobId).select('uploadedBy');
      if (!job) {
        return res.status(404).json({ message: 'Upload job not found.' });
      }
      if (req.user.role !== 'admin' && String(job.uploadedBy) !== String(req.user._id)) {
        return res.status(403).json({ message: 'Forbidden for this upload job.' });
      }
    }

    return res.json({ results });
  } catch (error) {
    return next(error);
  }
}

async function getStats(req, res, next) {
  try {
    const filters = {};
    if (req.query.uploadJobId) {
      filters.uploadJobId = new mongoose.Types.ObjectId(req.query.uploadJobId);
    }

    if (!req.query.uploadJobId && req.user.role !== 'admin') {
      const allowedJobIds = await UploadJob.find({ uploadedBy: req.user._id }).select('_id').lean();
      filters.uploadJobId = { $in: allowedJobIds.map((job) => job._id) };
    }

    const results = await ReconciliationResult.find(filters).select('status').lean();
    const stats = buildStats(results);

    return res.json({ stats });
  } catch (error) {
    return next(error);
  }
}

async function manualCorrection(req, res, next) {
  const session = await mongoose.startSession();

  try {
    const { resultId } = req.params;
    const { updates = {}, status, notes } = req.body;

    await session.withTransaction(async () => {
      const result = await ReconciliationResult.findById(resultId).session(session);
      if (!result) {
        const error = new Error('Reconciliation result not found.');
        error.statusCode = 404;
        throw error;
      }

      const uploadJob = await UploadJob.findById(result.uploadJobId).session(session);
      if (!uploadJob) {
        const error = new Error('Upload job not found.');
        error.statusCode = 404;
        throw error;
      }

      if (req.user.role !== 'admin' && String(uploadJob.uploadedBy) !== String(req.user._id)) {
        const error = new Error('Forbidden for this reconciliation result.');
        error.statusCode = 403;
        throw error;
      }

      const record = await Record.findById(result.uploadedRecordId).session(session);
      if (!record) {
        const error = new Error('Uploaded record not found.');
        error.statusCode = 404;
        throw error;
      }

      const changeSet = [];
      ['transactionId', 'referenceNumber', 'amount', 'date'].forEach((field) => {
        if (Object.prototype.hasOwnProperty.call(updates, field)) {
          const oldValue = record[field];
          let newValue = updates[field];

          if (field === 'amount') {
            newValue = Number(newValue);
          }
          if (field === 'date') {
            newValue = new Date(newValue);
          }

          if (String(oldValue) !== String(newValue)) {
            record[field] = newValue;
            changeSet.push({
              field,
              oldValue,
              newValue,
            });
          }
        }
      });

      if (changeSet.length) {
        await record.save({ session });
      }

      if (status) {
        const allowedStatuses = ['matched', 'partially_matched', 'not_matched', 'duplicate'];
        if (!allowedStatuses.includes(status)) {
          const error = new Error('Invalid status value.');
          error.statusCode = 400;
          throw error;
        }

        if (result.status !== status) {
          changeSet.push({
            field: 'status',
            oldValue: result.status,
            newValue: status,
          });
          result.status = status;
        }
      }

      result.manuallyCorrected = true;
      result.correctedBy = req.user._id;
      result.correctedAt = new Date();
      result.correctionNotes = notes || null;
      await result.save({ session });

      if (changeSet.length) {
        await createAuditLog({
          recordId: record._id,
          uploadJobId: uploadJob._id,
          action: 'manual_correction',
          source: 'manual',
          changedBy: req.user._id,
          changes: changeSet,
          metadata: {
            resultId: result._id,
            notes: notes || null,
          },
          session,
        });
      }
    });

    return res.json({ message: 'Manual correction saved successfully.' });
  } catch (error) {
    return next(error);
  } finally {
    await session.endSession();
  }
}

module.exports = {
  triggerReconciliation,
  getResults,
  getStats,
  manualCorrection,
};
