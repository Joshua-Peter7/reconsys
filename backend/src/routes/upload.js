const express = require('express');
const {
  upload,
  previewUpload,
  createJob,
  listJobs,
  getJobStatus,
} = require('../controllers/uploadController');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

router.post('/preview', authenticate, authorize('admin', 'analyst'), upload.single('file'), previewUpload);
router.post('/', authenticate, authorize('admin', 'analyst'), upload.single('file'), createJob);
router.get('/', authenticate, authorize('admin', 'analyst', 'viewer'), listJobs);
router.get('/:jobId', authenticate, authorize('admin', 'analyst', 'viewer'), getJobStatus);

module.exports = router;
