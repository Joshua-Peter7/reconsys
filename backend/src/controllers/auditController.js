const AuditLog = require('../models/AuditLog');
const Record = require('../models/Record');
const UploadJob = require('../models/UploadJob');

async function getRecordTimeline(req, res, next) {
  try {
    const { recordId } = req.params;

    const record = await Record.findById(recordId).select('uploadJobId sourceType transactionId');
    if (!record) {
      return res.status(404).json({ message: 'Record not found.' });
    }

    const job = await UploadJob.findById(record.uploadJobId).select('uploadedBy');
    if (!job) {
      return res.status(404).json({ message: 'Upload job not found.' });
    }

    if (req.user.role !== 'admin' && String(job.uploadedBy) !== String(req.user._id)) {
      return res.status(403).json({ message: 'Forbidden for this record.' });
    }

    const timeline = await AuditLog.find({ recordId })
      .populate('changedBy', 'fullName email role')
      .sort({ createdAt: 1 });

    return res.json({ record, timeline });
  } catch (error) {
    return next(error);
  }
}

async function getJobTimeline(req, res, next) {
  try {
    const { uploadJobId } = req.params;

    const job = await UploadJob.findById(uploadJobId).select('uploadedBy');
    if (!job) {
      return res.status(404).json({ message: 'Upload job not found.' });
    }

    if (req.user.role !== 'admin' && String(job.uploadedBy) !== String(req.user._id)) {
      return res.status(403).json({ message: 'Forbidden for this upload job.' });
    }

    const logs = await AuditLog.find({ uploadJobId })
      .populate('changedBy', 'fullName email role')
      .sort({ createdAt: 1 })
      .limit(5000);

    return res.json({ logs });
  } catch (error) {
    return next(error);
  }
}

async function getUserActions(req, res, next) {
  try {
    const filters = {};

    if (req.query.userId) {
      filters.changedBy = req.query.userId;
    }

    if (req.query.startDate || req.query.endDate) {
      filters.createdAt = {};
      if (req.query.startDate) filters.createdAt.$gte = new Date(req.query.startDate);
      if (req.query.endDate) filters.createdAt.$lte = new Date(req.query.endDate);
    }

    const actions = await AuditLog.find(filters)
      .populate('changedBy', 'fullName email role')
      .sort({ createdAt: -1 })
      .limit(2000);

    return res.json({ actions });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  getRecordTimeline,
  getJobTimeline,
  getUserActions,
};
