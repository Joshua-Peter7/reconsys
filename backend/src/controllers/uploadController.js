const multer = require('multer');
const UploadJob = require('../models/UploadJob');
const { getPreview } = require('../services/fileService');
const { requiredMappingMissing } = require('../utils/normalization');
const { createUploadJob, scheduleUploadJob } = require('../services/uploadProcessingService');

const maxFileSizeMb = Number(process.env.MAX_FILE_SIZE_MB || 50);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: maxFileSizeMb * 1024 * 1024,
  },
});

function parseJsonField(value) {
  if (!value) {
    return null;
  }

  if (typeof value === 'object') {
    return value;
  }

  try {
    return JSON.parse(value);
  } catch (error) {
    return null;
  }
}

async function previewUpload(req, res, next) {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'File is required.' });
    }

    const payload = await getPreview(req.file, 20);
    return res.json(payload);
  } catch (error) {
    return next(error);
  }
}

async function createJob(req, res, next) {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'File is required.' });
    }

    const columnMapping = parseJsonField(req.body.columnMapping);
    const missing = requiredMappingMissing(columnMapping);

    if (missing.length) {
      return res.status(400).json({
        message: `Missing mandatory mapping: ${missing.join(', ')}`,
      });
    }

    const matchingConfig = parseJsonField(req.body.matchingConfig) || undefined;
    const uploadType = req.body.uploadType === 'system' ? 'system' : 'transaction';

    const { reused, job } = await createUploadJob({
      file: req.file,
      uploadedBy: req.user._id,
      columnMapping,
      uploadType,
      matchingConfig,
    });

    if (!reused && job.status === 'processing') {
      scheduleUploadJob({
        jobId: job._id,
        file: req.file,
        actorUserId: req.user._id,
      });
    }

    return res.status(202).json({
      jobId: job._id,
      status: job.status,
      reused,
      uploadType: job.uploadType,
      message: reused
        ? 'An identical file was already processed. Existing job returned.'
        : 'Upload accepted and queued for asynchronous processing.',
    });
  } catch (error) {
    return next(error);
  }
}

async function listJobs(req, res, next) {
  try {
    const filters = {};

    if (req.user.role !== 'admin') {
      filters.uploadedBy = req.user._id;
    } else if (req.query.uploadedBy) {
      filters.uploadedBy = req.query.uploadedBy;
    }

    if (req.query.status) {
      filters.status = req.query.status;
    }

    if (req.query.uploadType) {
      filters.uploadType = req.query.uploadType;
    }

    if (req.query.startDate || req.query.endDate) {
      filters.createdAt = {};
      if (req.query.startDate) filters.createdAt.$gte = new Date(req.query.startDate);
      if (req.query.endDate) filters.createdAt.$lte = new Date(req.query.endDate);
    }

    const jobs = await UploadJob.find(filters)
      .populate('uploadedBy', 'fullName email role')
      .sort({ createdAt: -1 })
      .limit(200);

    return res.json({ jobs });
  } catch (error) {
    return next(error);
  }
}

async function getJobStatus(req, res, next) {
  try {
    const job = await UploadJob.findById(req.params.jobId).populate('uploadedBy', 'fullName email role');
    if (!job) {
      return res.status(404).json({ message: 'Upload job not found.' });
    }

    if (req.user.role !== 'admin' && String(job.uploadedBy._id) !== String(req.user._id)) {
      return res.status(403).json({ message: 'Forbidden for this upload job.' });
    }

    return res.json({ job });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  upload,
  previewUpload,
  createJob,
  listJobs,
  getJobStatus,
};
