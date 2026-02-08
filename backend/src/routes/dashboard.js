const express = require('express');
const { getSummary, getFilterOptions } = require('../controllers/dashboardController');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

router.get('/summary', authenticate, authorize('admin', 'analyst', 'viewer'), getSummary);
router.get('/filters', authenticate, authorize('admin', 'analyst', 'viewer'), getFilterOptions);

module.exports = router;
