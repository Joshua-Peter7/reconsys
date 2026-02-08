const express = require('express');
const {
  triggerReconciliation,
  getResults,
  getStats,
  manualCorrection,
} = require('../controllers/reconciliationController');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

router.post('/trigger', authenticate, authorize('admin', 'analyst'), triggerReconciliation);
router.get('/results', authenticate, authorize('admin', 'analyst', 'viewer'), getResults);
router.get('/stats', authenticate, authorize('admin', 'analyst', 'viewer'), getStats);
router.patch('/manual-correction/:resultId', authenticate, authorize('admin', 'analyst'), manualCorrection);

module.exports = router;
