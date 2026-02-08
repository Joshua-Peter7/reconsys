const express = require('express');
const { getRecordTimeline, getJobTimeline, getUserActions } = require('../controllers/auditController');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

router.get('/record/:recordId', authenticate, authorize('admin', 'analyst', 'viewer'), getRecordTimeline);
router.get('/job/:uploadJobId', authenticate, authorize('admin', 'analyst', 'viewer'), getJobTimeline);
router.get('/user-actions', authenticate, authorize('admin'), getUserActions);

module.exports = router;
