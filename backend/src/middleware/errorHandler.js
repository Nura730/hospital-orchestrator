const { ZodError } = require('zod');
const AppError = require('../utils/AppError');
const logger = require('../utils/logger');
const env = require('../config/env');

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  let statusCode = 500;
  let code = 'INTERNAL_SERVER_ERROR';
  let message = 'An unexpected server error occurred';
  let details = null;

  // Handle known application errors
  if (err instanceof AppError) {
    statusCode = err.statusCode;
    code = err.code;
    message = err.message;
    details = err.details;
  } else if (err instanceof ZodError) {
    // Handle Zod schema validation errors
    statusCode = 400;
    code = 'VALIDATION_ERROR';
    message = 'Validation failed for request parameters';
    details = err.errors.map((e) => ({
      field: e.path.join('.'),
      message: e.message,
      code: e.code,
    }));
  } else if (err.type === 'entity.parse.failed' || err instanceof SyntaxError) {
    // Malformed JSON in request body
    statusCode = 400;
    code = 'INVALID_JSON';
    message = 'Malformed JSON payload provided';
  } else if (err.code === '23505') {
    // PostgreSQL unique constraint violation
    statusCode = 409;
    code = 'DUPLICATE_ENTRY';
    message = err.detail || 'A record with this identifier already exists';
  } else if (err.code === '22P02' || err.code === '22007' || err.code === '22008') {
    // PostgreSQL invalid input syntax (e.g. a non-UUID id in the URL) or a bad date
    statusCode = 400;
    code = 'INVALID_INPUT';
    message = 'One of the provided values has an invalid format';
  } else if (err.code === '23503') {
    // PostgreSQL foreign key violation
    statusCode = 400;
    code = 'FOREIGN_KEY_VIOLATION';
    message = err.detail || 'Referenced record does not exist';
  }

  // Log structured error
  logger.error({
    err: {
      message: err.message,
      stack: env.NODE_ENV === 'production' ? undefined : err.stack,
      code,
      statusCode,
    },
    req: {
      method: req.method,
      url: req.originalUrl,
      ip: req.ip,
      user: req.user ? { id: req.user.id, role: req.user.userType } : null,
    },
  });

  return res.status(statusCode).json({
    ok: false,
    data: null,
    error: {
      code,
      message,
      ...(details ? { details } : {}),
      ...(env.NODE_ENV !== 'production' && statusCode === 500 ? { stack: err.stack } : {}),
    },
    meta: {
      timestamp: new Date().toISOString(),
    },
  });
}

module.exports = errorHandler;
