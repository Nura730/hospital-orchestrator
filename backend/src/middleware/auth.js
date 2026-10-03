const jwt = require('jsonwebtoken');
const env = require('../config/env');
const db = require('../config/db');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');

const auth = asyncHandler(async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new AppError('Authentication required. Missing Bearer token.', 401, 'UNAUTHORIZED');
  }

  const token = authHeader.split(' ')[1];
  let decoded;
  try {
    decoded = jwt.verify(token, env.JWT_SECRET);
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      throw new AppError('Session expired. Please log in again.', 401, 'TOKEN_EXPIRED');
    }
    throw new AppError('Invalid authentication token.', 401, 'INVALID_TOKEN');
  }

  // Fetch active user from database to ensure user still exists and is active
  const result = await db.query(
    'SELECT id, email, user_type, full_name, is_active FROM users WHERE id = $1',
    [decoded.userId || decoded.id]
  );

  if (result.rows.length === 0) {
    throw new AppError('User account not found.', 401, 'USER_NOT_FOUND');
  }

  const user = result.rows[0];
  if (!user.is_active) {
    throw new AppError('User account has been deactivated.', 403, 'ACCOUNT_DEACTIVATED');
  }

  // Attach standardized user object to request
  req.user = {
    id: user.id,
    email: user.email,
    userType: user.user_type,
    role: user.user_type, // alias for role
    fullName: user.full_name,
  };

  next();
});

module.exports = auth;
