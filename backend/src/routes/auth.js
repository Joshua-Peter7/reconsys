const express = require('express');
const { register, login, profile, listUsers } = require('../controllers/authController');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

router.post('/register', authenticate, authorize('admin'), register);
router.post('/login', login);
router.get('/profile', authenticate, profile);
router.get('/users', authenticate, authorize('admin'), listUsers);

module.exports = router;
