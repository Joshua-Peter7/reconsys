const UploadJob = require('../models/UploadJob');
const Record = require('../models/Record');
const ReconciliationResult = require('../models/ReconciliationResult');
const User = require('../models/User');

async function getSummary(req, res, next) {
  try {
    const jobFilter = {
      uploadType: 'transaction',
      status: 'completed',
    };

    if (req.user.role !== 'admin') {
      jobFilter.uploadedBy = req.user._id;
    } else if (req.query.uploadedBy) {
      jobFilter.uploadedBy = req.query.uploadedBy;
    }

    if (req.query.startDate || req.query.endDate) {
      jobFilter.createdAt = {};
      if (req.query.startDate) jobFilter.createdAt.$gte = new Date(req.query.startDate);
      if (req.query.endDate) jobFilter.createdAt.$lte = new Date(req.query.endDate);
    }

    const jobs = await UploadJob.find(jobFilter).select('_id').lean();
    const jobIds = jobs.map((job) => job._id);

    if (!jobIds.length) {
      return res.json({
        totalRecordsUploaded: 0,
        matchedRecords: 0,
        partiallyMatchedRecords: 0,
        unmatchedRecords: 0,
        duplicateRecords: 0,
        accuracyPercentage: 0,
        chart: [],
      });
    }

    const statusFilter = req.query.status;

    const [totalRecordsUploaded, grouped] = await Promise.all([
      Record.countDocuments({ uploadJobId: { $in: jobIds }, sourceType: 'uploaded' }),
      ReconciliationResult.aggregate([
        {
          $match: {
            uploadJobId: { $in: jobIds },
            ...(statusFilter ? { status: statusFilter } : {}),
          },
        },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
          },
        },
      ]),
    ]);

    const counts = {
      matched: 0,
      partially_matched: 0,
      not_matched: 0,
      duplicate: 0,
    };

    grouped.forEach((row) => {
      counts[row._id] = row.count;
    });

    const considered = counts.matched + counts.partially_matched + counts.not_matched + counts.duplicate;
    const accuracy = considered ? (((counts.matched + counts.partially_matched) / considered) * 100).toFixed(2) : '0.00';

    return res.json({
      totalRecordsUploaded,
      matchedRecords: counts.matched,
      partiallyMatchedRecords: counts.partially_matched,
      unmatchedRecords: counts.not_matched,
      duplicateRecords: counts.duplicate,
      accuracyPercentage: Number(accuracy),
      chart: [
        { label: 'Matched', value: counts.matched },
        { label: 'Partially Matched', value: counts.partially_matched },
        { label: 'Not Matched', value: counts.not_matched },
        { label: 'Duplicate', value: counts.duplicate },
      ],
    });
  } catch (error) {
    return next(error);
  }
}

async function getFilterOptions(req, res, next) {
  try {
    let users = [];
    if (req.user.role === 'admin') {
      users = await User.find({ role: { $in: ['admin', 'analyst'] } }).select('fullName email role').sort({ fullName: 1 }).lean();
    }

    return res.json({ users });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  getSummary,
  getFilterOptions,
};
