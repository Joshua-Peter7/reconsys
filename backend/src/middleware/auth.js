const jwt = require('jsonwebtoken');
const User = require('../models/User');

function unauthorized(message = 'Unauthorized') {
  const error = new Error(message);
  error.statusCode = 401;
  return error;
}

async function authenticate(req, res, next) {
  try {
    const authorization = req.headers.authorization || '';
    const token = authorization.startsWith('Bearer ') ? authorization.slice(7) : null;

    if (!token) {
      throw unauthorized('Missing authentication token.');
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId).select('-passwordHash');

    if (!user) {
      throw unauthorized('Invalid token user.');
    }

    if (decoded.role && decoded.role !== user.role) {
      throw unauthorized('Token role is stale. Please login again.');
    }

    req.user = user;
    req.auth = {
      tokenRole: decoded.role || null,
      tokenUserId: decoded.userId,
    };
    next();
  } catch (error) {
    if (!error.statusCode) {
      error.statusCode = 401;
      error.message = 'Invalid or expired token.';
    }
    next(error);
  }
}

function authorize(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return next(unauthorized('Authentication required.'));
    }

    if (!roles.includes(req.user.role)) {
      const error = new Error('Forbidden for current role.');
      error.statusCode = 403;
      return next(error);
    }

    return next();
  };
}

module.exports = {
  authenticate,
  authorize,
};
